<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class LoanController extends Controller
{
    /**
     * Determine the interest rate from borrower type and loan amount.
     */
    private function calculateInterestRate(
        float $loanAmount,
        bool $isMember
    ): float {
        if ($isMember) {
            if ($loanAmount < 1000) {
                return 4.00;
            }

            if ($loanAmount < 3000) {
                return 3.50;
            }

            if ($loanAmount < 5000) {
                return 2.75;
            }

            if ($loanAmount < 7500) {
                return 2.00;
            }

            if ($loanAmount < 10000) {
                return 1.50;
            }

            return 1.00;
        }

        if ($loanAmount < 5000) {
            return 5.00;
        }

        if ($loanAmount < 10000) {
            return 4.00;
        }

        return 3.50;
    }

    /**
     * Calculate and return the loan's financial values.
     */
    private function calculateLoanAmounts(
        float $loanAmount,
        bool $isMember
    ): array {
        $interestRate = $this->calculateInterestRate(
            $loanAmount,
            $isMember
        );

        $interestAmount = round(
            $loanAmount * $interestRate / 100,
            2
        );

        return [
            'loan_amount' => round($loanAmount, 2),
            'interest_rate' => $interestRate,
            'interest_amount' => $interestAmount,
            'total_amount' => round(
                $loanAmount + $interestAmount,
                2
            ),
        ];
    }

    /**
     * Return a consistent API response.
     */
    private function apiResponse(
        string $message,
        mixed $data = null,
        int $status = 200
    ): JsonResponse {
        return response()->json([
            'success' => $status < 400,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    /**
     * List all loans.
     */
    public function index(): JsonResponse
    {
        $loans = Loan::with([
            'member',
            'nonmember',
            'payments',
        ])
            ->latest('id')
            ->get();

        return $this->apiResponse(
            'Loans retrieved successfully.',
            $loans
        );
    }

    /**
     * Create a new loan.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'member_number' => [
                'nullable',
                'required_without:non_member_number',
                'exists:members,member_number',
            ],
            'non_member_number' => [
                'nullable',
                'required_without:member_number',
                'exists:nonmembers,non_member_number',
            ],
            'loan_date' => [
                'required',
                'date',
            ],
            'loan_amount' => [
                'required',
                'numeric',
                'min:1',
                'max:9999999999.99',
            ],
        ]);

        if ($validator->fails()) {
            return $this->apiResponse(
                'Validation failed.',
                [
                    'errors' => $validator->errors(),
                ],
                422
            );
        }

        $data = $validator->validated();

        $memberNumber = $data['member_number'] ?? null;
        $nonMemberNumber = $data['non_member_number'] ?? null;

        // A loan must belong to exactly one borrower type.
        if (
            (empty($memberNumber) && empty($nonMemberNumber)) ||
            (!empty($memberNumber) && !empty($nonMemberNumber))
        ) {
            return $this->apiResponse(
                'Select exactly one borrower: Member or Non-Member.',
                null,
                422
            );
        }

        $loanAmount = (float) $data['loan_amount'];
        $isMember = !empty($memberNumber);

        $financialData = $this->calculateLoanAmounts(
            $loanAmount,
            $isMember
        );

        $loan = Loan::create([
            'member_number' => $memberNumber,
            'non_member_number' => $nonMemberNumber,
            'loan_date' => $data['loan_date'],
            ...$financialData,
        ]);

        $loan->load([
            'member',
            'nonmember',
            'payments',
        ]);

        return $this->apiResponse(
            'Loan created successfully.',
            $loan,
            201
        );
    }

    /**
     * Show a single loan.
     */
    public function show(string $id): JsonResponse
    {
        $loan = Loan::with([
            'member',
            'nonmember',
            'payments',
        ])->find($id);

        if (!$loan) {
            return $this->apiResponse(
                'Loan not found.',
                null,
                404
            );
        }

        return $this->apiResponse(
            'Loan retrieved successfully.',
            $loan
        );
    }

    /**
     * Update an existing loan.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $loan = Loan::with('payments')->find($id);

        if (!$loan) {
            return $this->apiResponse(
                'Loan not found.',
                null,
                404
            );
        }

        $validator = Validator::make($request->all(), [
            'member_number' => [
                'sometimes',
                'nullable',
                'exists:members,member_number',
            ],
            'non_member_number' => [
                'sometimes',
                'nullable',
                'exists:nonmembers,non_member_number',
            ],
            'loan_date' => [
                'sometimes',
                'required',
                'date',
            ],
            'loan_amount' => [
                'sometimes',
                'required',
                'numeric',
                'min:1',
                'max:9999999999.99',
            ],
        ]);

        if ($validator->fails()) {
            return $this->apiResponse(
                'Validation failed.',
                [
                    'errors' => $validator->errors(),
                ],
                422
            );
        }

        $data = $validator->validated();

        $memberNumber = $loan->member_number;
        $nonMemberNumber = $loan->non_member_number;

        // If borrower information is submitted, update the borrower type.
        if (
            array_key_exists('member_number', $data) ||
            array_key_exists('non_member_number', $data)
        ) {
            $memberNumber = $data['member_number'] ?? null;
            $nonMemberNumber = $data['non_member_number'] ?? null;
        }

        if (
            (empty($memberNumber) && empty($nonMemberNumber)) ||
            (!empty($memberNumber) && !empty($nonMemberNumber))
        ) {
            return $this->apiResponse(
                'Select exactly one borrower: Member or Non-Member.',
                null,
                422
            );
        }

        $loanAmount = (float) (
            $data['loan_amount'] ?? $loan->loan_amount
        );

        $isMember = !empty($memberNumber);

        $financialData = $this->calculateLoanAmounts(
            $loanAmount,
            $isMember
        );

        // Do not allow the revised loan total to fall below
        // the Total Pagamentu already recorded.
        $paidAmount = (float) $loan->payments->sum('amount');

        if (
            $financialData['total_amount'] + 0.009 < $paidAmount
        ) {
            return $this->apiResponse(
                'The updated total loan amount cannot be less than the payments already recorded.',
                [
                    'paid_amount' => round($paidAmount, 2),
                    'new_total_amount' => $financialData['total_amount'],
                ],
                422
            );
        }

        $loan->update([
            'member_number' => $memberNumber,
            'non_member_number' => $nonMemberNumber,
            'loan_date' => $data['loan_date'] ?? $loan->loan_date,
            ...$financialData,
        ]);

        $loan->load([
            'member',
            'nonmember',
            'payments',
        ]);

        return $this->apiResponse(
            'Loan updated successfully.',
            $loan
        );
    }

    /**
     * Delete a loan that has no payment records.
     */
    public function destroy(string $id): JsonResponse
    {
        $loan = Loan::with('payments')->find($id);

        if (!$loan) {
            return $this->apiResponse(
                'Loan not found.',
                null,
                404
            );
        }

        if ($loan->payments->isNotEmpty()) {
            return $this->apiResponse(
                'This loan cannot be deleted because it already has payment records.',
                null,
                409
            );
        }

        $loan->delete();

        return $this->apiResponse(
            'Loan deleted successfully.'
        );
    }
}
