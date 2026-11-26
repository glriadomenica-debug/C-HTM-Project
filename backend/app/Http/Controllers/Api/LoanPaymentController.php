<?php

namespace App\Http\Controllers\Api;

use App\Models\Loan;
use App\Models\LoanPayment;
use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Services\AutomaticLedgerService;
use Carbon\Carbon;
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
     * Create a loan payment and synchronize its ledger entry.
     */
    public function store(
        Request $request,
        AutomaticLedgerService $ledgerService
    ) {
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

        $data = $validator->validated();

        $paymentDate = Carbon::parse(
            $data['payment_date']
        )->toDateString();

        if ($paymentDate < config('cash.start_date', '2026-11-01')) {
            return ApiMessage::error(
                'Payment dates cannot be before the cash ledger start date.',
                422
            );
        }

        $result = DB::transaction(function () use (
            $data,
            $ledgerService,
            $paymentDate
        ) {
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

            $alreadyPaid = (float) LoanPayment::where(
                'loan_id',
                $loan->id
            )->sum('amount');

            $remaining = round(
                max(0, $loanTotal - $alreadyPaid),
                2
            );

            $amount = round(
                (float) $data['amount'],
                2
            );

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
            $data['payment_date'] = $paymentDate;

            $payment = LoanPayment::create($data);

            if ($payment->payment_method === 'Cash') {
                $ledgerService->syncCashPaymentDate(
                    Carbon::parse(
                        $payment->payment_date
                    )->toDateString()
                );
            } else {
                $ledgerService->syncBankPayment($payment);
            }

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
     * Update a payment and synchronize old and new ledger entries.
     */
    public function update(
        Request $request,
        $id,
        AutomaticLedgerService $ledgerService
    ) {
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

        $data = $validator->validated();

        if (isset($data['payment_date'])) {
            $paymentDate = Carbon::parse(
                $data['payment_date']
            )->toDateString();

            if ($paymentDate < config('cash.start_date', '2026-11-01')) {
                return ApiMessage::error(
                    'Payment dates cannot be before the cash ledger start date.',
                    422
                );
            }

            $data['payment_date'] = $paymentDate;
        }

        $result = DB::transaction(function () use (
            $data,
            $id,
            $ledgerService
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

            $oldDate = Carbon::parse(
                $payment->payment_date
            )->toDateString();

            $oldMethod = $payment->payment_method;
            $oldPaymentId = (int) $payment->id;

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

            $loanTotal = $this->getLoanTotal($loan);

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

            $newDate = Carbon::parse(
                $payment->payment_date
            )->toDateString();

            $newMethod = $payment->payment_method;

            // Recalculate the previous cash payment date
            // or remove the previous bank transfer entry.
            if ($oldMethod === 'Cash') {
                $ledgerService->syncCashPaymentDate($oldDate);
            } else {
                $ledgerService->deleteBankPayment($oldPaymentId);
            }

            // Synchronize the updated payment.
            if ($newMethod === 'Cash') {
                $ledgerService->syncCashPaymentDate($newDate);
            } else {
                $ledgerService->syncBankPayment($payment);
            }

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
     * Delete a payment and synchronize its ledger entry.
     */
    public function destroy(
        $id,
        AutomaticLedgerService $ledgerService
    ) {
        $result = DB::transaction(function () use (
            $id,
            $ledgerService
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

            $paymentDate = Carbon::parse(
                $payment->payment_date
            )->toDateString();

            $paymentMethod = $payment->payment_method;
            $paymentId = (int) $payment->id;

            $payment->delete();

            if ($paymentMethod === 'Cash') {
                $ledgerService->syncCashPaymentDate(
                    $paymentDate
                );
            } else {
                $ledgerService->deleteBankPayment($paymentId);
            }

            return ['success' => true];
        });

        if (isset($result['error'])) {
            return ApiMessage::error(
                $result['error'],
                $result['status']
            );
        }

        return ApiMessage::success(
            'Loan payment deleted successfully.',
            null
        );
    }

    /**
     * Calculate the full loan total, including interest.
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

        if ($storedTotal > $principal) {
            return $storedTotal;
        }

        if ($interest > 0) {
            return round($principal + $interest, 2);
        }

        if ($rate > 0 && $rate < 1) {
            $rate *= 100;
        }

        if ($rate > 0) {
            $interest = round(
                $principal * $rate / 100,
                2
            );

            return round($principal + $interest, 2);
        }

        $isMember = $loan->member()->exists();

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

        return round(
            $principal + $interest,
            2
        );
    }
}
