<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\LoanPayment;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class AutomaticLedgerService
{
    /**
     * Account IDs from the existing cash_accounts table.
     */
    private const BANK_BNU_ID = 1;
    private const OFFICE_CHTM_ID = 3;

    /**
     * Synchronize the daily loan disbursement summary.
     * The ledger records principal actually disbursed.
     */
    public function syncLoanDate(string $date): void
    {
        DB::transaction(function () use ($date) {
            $loans = Loan::whereDate('loan_date', $date)->get();

            $sourceKey = "loan-summary:{$date}";

            if ($loans->isEmpty()) {
                Transaction::where('source_key', $sourceKey)->delete();

                return;
            }

            $amount = $loans->sum(
                fn(Loan $loan) => (float) $loan->loan_amount
            );

            $count = $loans->count();

            Transaction::updateOrCreate(
                ['source_key' => $sourceKey],
                [
                    'type' => 'expense',
                    'account_id' => self::OFFICE_CHTM_ID,
                    'from_account_id' => null,
                    'to_account_id' => null,
                    'transaction_date' => $date,
                    'amount' => $amount,
                    'category' => 'loan_disbursement',
                    'ledger_category' => 'Emprestimu',
                    'description' => "Emprestimu ema {$count}",
                ]
            );
        });
    }

    /**
     * Synchronize the daily cash repayment summary.
     */
    public function syncCashPaymentDate(string $date): void
    {
        DB::transaction(function () use ($date) {
            $payments = LoanPayment::whereDate('payment_date', $date)
                ->where('payment_method', 'Cash')
                ->get();

            $sourceKey = "cash-payment-summary:{$date}";

            if ($payments->isEmpty()) {
                Transaction::where('source_key', $sourceKey)->delete();

                return;
            }

            $amount = $payments->sum(
                fn(LoanPayment $payment) => (float) $payment->amount
            );

            $count = $payments->count();

            Transaction::updateOrCreate(
                ['source_key' => $sourceKey],
                [
                    'type' => 'income',
                    'account_id' => self::OFFICE_CHTM_ID,
                    'from_account_id' => null,
                    'to_account_id' => null,
                    'transaction_date' => $date,
                    'amount' => $amount,
                    'category' => 'loan_repayment_cash',
                    'ledger_category' => 'Pagamentu emprestimu',
                    'description' => "Pagamentu emprestimu {$count}",
                ]
            );
        });
    }

    /**
     * Synchronize one bank-transfer repayment.
     * Each payment has its own ledger row.
     */
    public function syncBankPayment(LoanPayment $payment): void
    {
        DB::transaction(function () use ($payment) {
            $sourceKey = "bank-payment:{$payment->id}";

            if ($payment->payment_method !== 'Bank Transfer') {
                Transaction::where('source_key', $sourceKey)->delete();

                return;
            }

            $payment->loadMissing(['loan.member', 'loan.nonmember']);

            $borrowerName = $payment->loan?->member?->full_name
                ?? $payment->loan?->nonmember?->full_name
                ?? 'Unknown borrower';

            Transaction::updateOrCreate(
                ['source_key' => $sourceKey],
                [
                    'type' => 'income',
                    'account_id' => self::BANK_BNU_ID,
                    'from_account_id' => null,
                    'to_account_id' => null,
                    'transaction_date' => $payment->payment_date,
                    'amount' => $payment->amount,
                    'category' => 'loan_repayment_bank',
                    'ledger_category' => 'Pagamentu emprestimu',
                    'description' => "Transfer {$borrowerName}",
                ]
            );
        });
    }

    /**
     * Synchronize the ledger after a payment is deleted.
     */
    public function deleteBankPayment(int $paymentId): void
    {
        Transaction::where(
            'source_key',
            "bank-payment:{$paymentId}"
        )->delete();
    }
}
