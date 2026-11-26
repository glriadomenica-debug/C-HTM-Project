<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Services\AutomaticLedgerService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LoanController extends Controller
{
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
     * Create a loan and synchronize its daily ledger summary.
     */
    public function store(
        Request $request,
        AutomaticLedgerService $ledgerService
    ): JsonResponse {
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
                ['errors' => $validator->errors()],
                422
            );
        }

        $data = $validator->validated();

        $memberNumber = $data['member_number'] ?? null;
        $nonMemberNumber = $data['non_member_number'] ?? null;

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

        $loanDate = Carbon::parse($data['loan_date'])
            ->toDateString();

        if ($loanDate < config('cash.start_date', '2026-11-01')) {
            return $this->apiResponse(
                'Loan dates cannot be before the cash ledger start date.',
                null,
                422
            );
        }

        $loan = DB::transaction(function () use (
            $memberNumber,
            $nonMemberNumber,
            $loanDate,
            $financialData,
            $ledgerService
        ) {
            $loan = Loan::create([
                'member_number' => $memberNumber,
                'non_member_number' => $nonMemberNumber,
                'loan_date' => $loanDate,
                ...$financialData,
            ]);

            $ledgerService->syncLoanDate($loanDate);

            return $loan;
        });

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
     * Update a loan and synchronize affected dates.
     */
    public function update(
        Request $request,
        string $id,
        AutomaticLedgerService $ledgerService
    ): JsonResponse {
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
                ['errors' => $validator->errors()],
                422
            );
        }

        $data = $validator->validated();

        $memberNumber = $loan->member_number;
        $nonMemberNumber = $loan->non_member_number;

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

        $oldDate = Carbon::parse($loan->loan_date)
            ->toDateString();

        $newDate = Carbon::parse(
            $data['loan_date'] ?? $oldDate
        )->toDateString();

        if ($newDate < config('cash.start_date', '2026-11-01')) {
            return $this->apiResponse(
                'Loan dates cannot be before the cash ledger start date.',
                null,
                422
            );
        }

        DB::transaction(function () use (
            $loan,
            $memberNumber,
            $nonMemberNumber,
            $newDate,
            $financialData,
            $oldDate,
            $ledgerService
        ) {
            $loan->update([
                'member_number' => $memberNumber,
                'non_member_number' => $nonMemberNumber,
                'loan_date' => $newDate,
                ...$financialData,
            ]);

            // Recalculate the original date's summary.
            $ledgerService->syncLoanDate($oldDate);

            // If the date changed, recalculate the destination date too.
            if ($newDate !== $oldDate) {
                $ledgerService->syncLoanDate($newDate);
            }
        });

        $loan->refresh()->load([
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
     * Delete a loan that has no payments and synchronize its date.
     */
    public function destroy(
        string $id,
        AutomaticLedgerService $ledgerService
    ): JsonResponse {
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

        $loanDate = Carbon::parse($loan->loan_date)
            ->toDateString();

        DB::transaction(function () use (
            $loan,
            $loanDate,
            $ledgerService
        ) {
            $loan->delete();

            // Delete the summary if no loans remain on this date;
            // otherwise, update its amount and borrower count.
            $ledgerService->syncLoanDate($loanDate);
        });

        return $this->apiResponse(
            'Loan deleted successfully.'
        );
    }
}
