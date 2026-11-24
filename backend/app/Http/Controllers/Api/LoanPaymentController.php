<?php

namespace App\Http\Controllers\Api;

use App\Models\Loan;
use App\Models\LoanPayment;
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
        $payments = LoanPayment::with([
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
            return ApiMessage::error(
                $validator->errors(),
                400
            );
        }

        $result = DB::transaction(function () use ($validator) {
            $data = $validator->validated();

            // Lock the loan to prevent simultaneous overpayments.
            $loan = Loan::where('id', $data['loan_id'])
                ->lockForUpdate()
                ->first();

            if (!$loan) {
                return [
                    'error' => 'Loan not found.',
                    'status' => 404,
                ];
            }

            // Calculate the full loan amount, including interest.
            $loanTotal = $this->getLoanTotal($loan);

            // Calculate all payments already recorded for this loan.
            $alreadyPaid = (float) LoanPayment::where(
                'loan_id',
                $loan->id
            )->sum('amount');

            $remaining = round(
                max(0, $loanTotal - $alreadyPaid),
                2
            );

            $amount = round((float) $data['amount'], 2);

            if ($amount > $remaining) {
                return [
                    'error' => sprintf(
                        'Payment exceeds the remaining balance of $%.2f.',
                        $remaining
                    ),
                    'status' => 422,
                ];
            }

            $data['amount'] = $amount;

            $payment = LoanPayment::create($data);

            $payment->load([
                'loan.member',
                'loan.nonmember',
            ]);

            return [
                'payment' => $payment,
            ];
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
            return ApiMessage::error(
                $validator->errors(),
                400
            );
        }

        $result = DB::transaction(function () use (
            $validator,
            $id
        ) {
            $payment = LoanPayment::where('id', $id)
                ->lockForUpdate()
                ->first();

            if (!$payment) {
                return [
                    'error' => 'Loan payment not found.',
                    'status' => 404,
                ];
            }

            $data = $validator->validated();

            $targetLoanId = $data['loan_id']
                ?? $payment->loan_id;

            $loan = Loan::where('id', $targetLoanId)
                ->lockForUpdate()
                ->first();

            if (!$loan) {
                return [
                    'error' => 'Loan not found.',
                    'status' => 404,
                ];
            }

            // Calculate the full amount, including interest.
            $loanTotal = $this->getLoanTotal($loan);

            // Exclude this payment when checking the new balance.
            $otherPayments = (float) LoanPayment::where(
                'loan_id',
                $targetLoanId
            )
                ->where('id', '!=', $payment->id)
                ->sum('amount');

            $remaining = round(
                max(0, $loanTotal - $otherPayments),
                2
            );

            $newAmount = round(
                (float) ($data['amount'] ?? $payment->amount),
                2
            );

            if ($newAmount > $remaining) {
                return [
                    'error' => sprintf(
                        'Payment exceeds the remaining balance of $%.2f.',
                        $remaining
                    ),
                    'status' => 422,
                ];
            }

            $data['amount'] = $newAmount;

            $payment->fill($data);
            $payment->save();

            $payment->load([
                'loan.member',
                'loan.nonmember',
            ]);

            return [
                'payment' => $payment,
            ];
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
        $payment = LoanPayment::find($id);

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
     * Priority:
     * 1. Use total_amount when it is greater than principal.
     * 2. Otherwise use a saved interest_amount.
     * 3. Otherwise calculate from a saved interest_rate.
     * 4. If no rate exists, calculate using the C-HTM tiers.
     */
    private function getLoanTotal(Loan $loan): float
    {
        $principal = round(
            (float) ($loan->loan_amount ?? 0),
            2
        );

        $storedTotal = round(
            (float) ($loan->total_amount ?? 0),
            2
        );

        $interest = round(
            (float) ($loan->interest_amount ?? 0),
            2
        );

        $rate = (float) ($loan->interest_rate ?? 0);

        // The saved total already includes interest.
        if ($storedTotal > $principal) {
            return $storedTotal;
        }

        // Use a positive saved interest amount.
        if ($interest > 0) {
            return round($principal + $interest, 2);
        }

        // Support rates saved as 4 or 0.04 for 4%.
        if ($rate > 0 && $rate < 1) {
            $rate *= 100;
        }

        // Use the stored interest rate when available.
        if ($rate > 0) {
            $interest = round(
                $principal * $rate / 100,
                2
            );

            return round($principal + $interest, 2);
        }

        // Determine the loan owner type.
        $ownerType = strtolower(
            (string) ($loan->owner_type ?? '')
        );

        if ($ownerType === 'member') {
            $isMember = true;
        } elseif ($ownerType === 'nonmember') {
            $isMember = false;
        } else {
            // Fallback to the member relationship.
            $isMember = $loan->member()->exists();
        }

        // C-HTM member interest tiers.
        if ($isMember) {
            if ($principal < 1000) {
                $rate = 4;
            } elseif ($principal < 3000) {
                $rate = 3.5;
            } elseif ($principal < 5000) {
                $rate = 2.75;
            } elseif ($principal < 7500) {
                $rate = 2;
            } elseif ($principal < 10000) {
                $rate = 1.5;
            } else {
                $rate = 1;
            }
        } else {
            // C-HTM non-member interest tiers.
            if ($principal < 5000) {
                $rate = 5;
            } elseif ($principal < 10000) {
                $rate = 4;
            } else {
                $rate = 3.5;
            }
        }

        $interest = round(
            $principal * $rate / 100,
            2
        );

        return round($principal + $interest, 2);
    }
}
