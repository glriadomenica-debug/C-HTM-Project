<?php

namespace App\Http\Controllers\Api;

use App\Models\Loan;
use App\Models\Loanpayment;
use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LoanpaymentController extends Controller
{
    /**
     * Get all loan payments.
     */
    public function index()
    {
        $payments = Loanpayment::with([
            'loan.member',
            'loan.nonmember',
        ])
            ->latest()
            ->get();

        return ApiMessage::success(
            'Loan payments retrieved successfully.',
            $payments
        );
    }

    /**
     * Create a loan payment.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'loan_id' => 'required|exists:loans,id',
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_method' => 'required|in:Cash,Bank Transfer',
            'description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        $result = DB::transaction(function () use ($validator) {
            $data = $validator->validated();

            $loan = Loan::where('id', $data['loan_id'])
                ->lockForUpdate()
                ->first();

            if (!$loan) {
                return [
                    'error' => 'Loan not found.',
                    'status' => 404,
                ];
            }

            $loanTotal = $this->getLoanTotal($loan);

            $alreadyPaid = Loanpayment::where(
                'loan_id',
                $loan->id
            )->sum('amount');

            $remaining = max(0, $loanTotal - (float) $alreadyPaid);
            $amount = (float) $data['amount'];

            if ($amount > $remaining + 0.009) {
                return [
                    'error' => sprintf(
                        'Payment exceeds the remaining balance of $%.2f.',
                        $remaining
                    ),
                    'status' => 422,
                ];
            }

            $payment = Loanpayment::create($data);

            $payment->load([
                'loan.member',
                'loan.nonmember',
            ]);

            return ['payment' => $payment];
        });

        if (isset($result['error'])) {
            return ApiMessage::error(
                $result['error'],
                $result['status']
            );
        }

        return ApiMessage::success(
            'Loan payment created successfully.',
            $result['payment']
        );
    }

    /**
     * Update an existing loan payment.
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'loan_id' => 'sometimes|required|exists:loans,id',
            'amount' => 'sometimes|required|numeric|min:0.01',
            'payment_date' => 'sometimes|required|date',
            'payment_method' => 'sometimes|required|in:Cash,Bank Transfer',
            'description' => 'sometimes|nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        $result = DB::transaction(function () use ($validator, $id) {
            $payment = Loanpayment::where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$payment) {
                return [
                    'error' => 'Loan payment not found.',
                    'status' => 404,
                ];
            }

            $data = $validator->validated();

            $targetLoanId = $data['loan_id'] ?? $payment->loan_id;

            $loan = Loan::where('id', $targetLoanId)
                ->lockForUpdate()
                ->first();

            if (!$loan) {
                return [
                    'error' => 'Loan not found.',
                    'status' => 404,
                ];
            }

            $loanTotal = $this->getLoanTotal($loan);

            // Exclude the current payment when calculating the balance.
            $otherPayments = Loanpayment::where(
                'loan_id',
                $targetLoanId
            )
                ->where('id', '!=', $payment->id)
                ->sum('amount');

            $remaining = max(
                0,
                $loanTotal - (float) $otherPayments
            );

            $newAmount = (float) (
                $data['amount'] ?? $payment->amount
            );

            if ($newAmount > $remaining + 0.009) {
                return [
                    'error' => sprintf(
                        'Payment exceeds the remaining balance of $%.2f.',
                        $remaining
                    ),
                    'status' => 422,
                ];
            }

            $payment->fill($data);
            $payment->save();

            $payment->load([
                'loan.member',
                'loan.nonmember',
            ]);

            return ['payment' => $payment];
        });

        if (isset($result['error'])) {
            return ApiMessage::error(
                $result['error'],
                $result['status']
            );
        }

        return ApiMessage::success(
            'Loan payment updated successfully.',
            $result['payment']
        );
    }

    /**
     * Delete a loan payment.
     */
    public function destroy($id)
    {
        $payment = Loanpayment::find($id);

        if (!$payment) {
            return ApiMessage::error(
                'Loan payment not found.',
                404
            );
        }

        $payment->delete();

        return ApiMessage::success(
            'Loan payment deleted successfully.',
            null
        );
    }

    /**
     * Calculate the full loan total, including interest.
     *
     * Supports older records where total_amount or interest_amount
     * may not have been saved correctly.
     */
    private function getLoanTotal(Loan $loan): float
    {
        $principal = (float) ($loan->loan_amount ?? 0);
        $storedTotal = (float) ($loan->total_amount ?? 0);
        $interest = (float) ($loan->interest_amount ?? 0);
        $rate = (float) ($loan->interest_rate ?? 0);

        // Use a saved total when it already includes interest.
        if ($storedTotal > $principal) {
            return round($storedTotal, 2);
        }

        // Calculate interest if the saved interest amount is missing.
        if ($interest <= 0 && $rate > 0) {
            $interest = round($principal * $rate / 100, 2);
        }

        $calculatedTotal = round($principal + $interest, 2);

        // Keep a higher saved total if one exists.
        return round(max($calculatedTotal, $storedTotal), 2);
    }
}
