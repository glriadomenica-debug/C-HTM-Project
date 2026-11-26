<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CashAccount;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    private function ledgerStartDate(): string
    {
        return Carbon::parse(
            config('cash.start_date', '2026-11-01')
        )->toDateString();
    }

    /**
     * Automatically create the three standard ledger accounts
     * if they do not already exist.
     */
    private function ensureDefaultAccounts(): void
    {
        $accounts = [
            'Bank BNU',
            'Brankas Manleu',
            'Office CHTM',
        ];

        foreach ($accounts as $name) {
            CashAccount::firstOrCreate(
                ['name' => $name],
                [
                    'opening_balance' => null,
                    'opening_date' => null,
                    'is_active' => true,
                ]
            );
        }
    }

    /**
     * List active accounts with balances.
     */
    public function accounts(Request $request)
    {
        $this->ensureDefaultAccounts();

        $data = $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        $asOf = Carbon::parse(
            $data['as_of'] ?? now()->toDateString()
        )->toDateString();

        $accounts = CashAccount::where('is_active', true)
            ->orderBy('id')
            ->get()
            ->map(function ($account) use ($asOf) {
                $account->balance = $this->balanceAsOf(
                    $account,
                    $asOf
                );

                return $account;
            });

        return response()->json([
            'message' => 'Cash accounts retrieved successfully.',
            'data' => $accounts,
        ]);
    }

    /**
     * List transactions and calculate monthly summaries.
     */
    public function index(Request $request)
    {
        $this->ensureDefaultAccounts();

        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'account_id' => [
                'nullable',
                'integer',
                'exists:cash_accounts,id',
            ],
            'type' => [
                'nullable',
                Rule::in(['income', 'expense', 'transfer']),
            ],
        ]);

        $month = $data['month'] ?? now()->format('Y-m');

        $start = Carbon::createFromFormat(
            '!Y-m',
            $month
        )->startOfMonth();

        $end = $start->copy()->endOfMonth();

        $ledgerStart = Carbon::parse($this->ledgerStartDate());

        $query = Transaction::with([
            'account:id,name',
            'fromAccount:id,name',
            'toAccount:id,name',
        ])->whereBetween('transaction_date', [
            $start->toDateString(),
            $end->toDateString(),
        ]);

        if (!empty($data['account_id'])) {
            $accountId = $data['account_id'];

            $query->where(function ($q) use ($accountId) {
                $q->where('account_id', $accountId)
                    ->orWhere('from_account_id', $accountId)
                    ->orWhere('to_account_id', $accountId);
            });
        }

        if (!empty($data['type'])) {
            $query->where('type', $data['type']);
        }

        $transactions = $query
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->get();

        $accounts = CashAccount::where('is_active', true)
            ->orderBy('id')
            ->get()
            ->map(function ($account) use (
                $start,
                $end,
                $ledgerStart
            ) {
                $previousDay = $start->copy()
                    ->subDay()
                    ->toDateString();

                /*
                 * The ledger starts on 1 November 2026.
                 * Keep the Office CHTM opening balance unknown
                 * before the ledger start date.
                 */
                $isOfficeAccount = str_contains(
                    strtolower($account->name),
                    'office'
                );

                if (
                    $previousDay < $ledgerStart->toDateString()
                    && $isOfficeAccount
                    && $account->opening_balance === null
                ) {
                    $account->opening_balance = null;
                } else {
                    $account->opening_balance = $previousDay
                        < $ledgerStart->toDateString()
                        ? 0.00
                        : $this->balanceAsOf(
                            $account,
                            $previousDay
                        );
                }

                $account->closing_balance = $this->balanceAsOf(
                    $account,
                    $end->toDateString()
                );

                $account->income_total = $this->sumTransactions(
                    $account,
                    'income',
                    $start,
                    $end
                );

                $account->expense_total = $this->sumTransactions(
                    $account,
                    'expense',
                    $start,
                    $end
                );

                $account->transfer_in_total = $this->sumTransfers(
                    $account,
                    'in',
                    $start,
                    $end
                );

                $account->transfer_out_total = $this->sumTransfers(
                    $account,
                    'out',
                    $start,
                    $end
                );

                return $account;
            });

        return response()->json([
            'message' => 'Transactions retrieved successfully.',
            'data' => $transactions,
            'accounts' => $accounts,
            'month' => $month,
        ]);
    }

    /**
     * Create a manual income, expense, or transfer.
     */
    public function store(Request $request)
    {
        $this->ensureDefaultAccounts();

        $data = $request->validate([
            'type' => [
                'required',
                Rule::in(['income', 'expense', 'transfer']),
            ],
            'transaction_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'category' => ['nullable', 'string', 'max:255'],
            'ledger_category' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],

            'account_id' => [
                'nullable',
                'required_if:type,income,expense',
                'integer',
                'exists:cash_accounts,id',
            ],

            'from_account_id' => [
                'nullable',
                'required_if:type,transfer',
                'integer',
                'exists:cash_accounts,id',
            ],

            'to_account_id' => [
                'nullable',
                'required_if:type,transfer',
                'integer',
                'different:from_account_id',
                'exists:cash_accounts,id',
            ],
        ]);

        $transactionDate = Carbon::parse(
            $data['transaction_date']
        )->toDateString();

        if ($transactionDate < $this->ledgerStartDate()) {
            throw ValidationException::withMessages([
                'transaction_date' =>
                'Transactions cannot be recorded before the ledger start date.',
            ]);
        }

        if ($data['type'] === 'transfer') {
            $from = CashAccount::findOrFail(
                $data['from_account_id']
            );

            $to = CashAccount::findOrFail(
                $data['to_account_id']
            );

            if (!$from->is_active || !$to->is_active) {
                throw ValidationException::withMessages([
                    'from_account_id' =>
                    'Both transfer accounts must be active.',
                ]);
            }
        } else {
            $account = CashAccount::findOrFail(
                $data['account_id']
            );

            if (!$account->is_active) {
                throw ValidationException::withMessages([
                    'account_id' => 'This account is inactive.',
                ]);
            }
        }

        $data['transaction_date'] = $transactionDate;

        $transaction = DB::transaction(function () use ($data) {
            // source_key is intentionally not accepted from the client.
            return Transaction::create($data);
        });

        $transaction->load([
            'account:id,name',
            'fromAccount:id,name',
            'toAccount:id,name',
        ]);

        return response()->json([
            'message' => 'Transaction saved successfully.',
            'data' => $transaction,
        ], 201);
    }

    /**
     * Delete manual transactions only.
     * Automatically generated ledger entries must be maintained
     * through their corresponding loan/payment records.
     */
    public function destroy(Transaction $transaction)
    {
        if ($transaction->source_key !== null) {
            throw ValidationException::withMessages([
                'transaction' =>
                'This is an automatic ledger entry. Update or delete its original loan or payment record instead.',
            ]);
        }

        $transaction->delete();

        return response()->json([
            'message' => 'Transaction deleted successfully.',
        ]);
    }

    /**
     * Calculate an account balance as of a date.
     *
     * The ledger starts at zero on the configured start date.
     * Opening balances stored in the accounts table are not used
     * for this calculation.
     */
    private function balanceAsOf(
        CashAccount $account,
        string $date
    ): ?float {
        $ledgerStart = $this->ledgerStartDate();

        if ($date < $ledgerStart) {
            return null;
        }

        $income = Transaction::where(
            'account_id',
            $account->id
        )
            ->where('type', 'income')
            ->whereBetween('transaction_date', [
                $ledgerStart,
                $date,
            ])
            ->sum('amount');

        $expense = Transaction::where(
            'account_id',
            $account->id
        )
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [
                $ledgerStart,
                $date,
            ])
            ->sum('amount');

        $transferIn = Transaction::where(
            'to_account_id',
            $account->id
        )
            ->where('type', 'transfer')
            ->whereBetween('transaction_date', [
                $ledgerStart,
                $date,
            ])
            ->sum('amount');

        $transferOut = Transaction::where(
            'from_account_id',
            $account->id
        )
            ->where('type', 'transfer')
            ->whereBetween('transaction_date', [
                $ledgerStart,
                $date,
            ])
            ->sum('amount');

        return round(
            (float) $income
                - (float) $expense
                + (float) $transferIn
                - (float) $transferOut,
            2
        );
    }

    private function sumTransactions(
        CashAccount $account,
        string $type,
        Carbon $start,
        Carbon $end
    ): float {
        $effectiveStart = $start->copy();

        $ledgerStart = Carbon::parse($this->ledgerStartDate());

        if ($effectiveStart->lt($ledgerStart)) {
            $effectiveStart = $ledgerStart->copy();
        }

        if ($effectiveStart->gt($end)) {
            return 0.0;
        }

        return (float) Transaction::where(
            'account_id',
            $account->id
        )
            ->where('type', $type)
            ->whereBetween('transaction_date', [
                $effectiveStart->toDateString(),
                $end->toDateString(),
            ])
            ->sum('amount');
    }

    private function sumTransfers(
        CashAccount $account,
        string $direction,
        Carbon $start,
        Carbon $end
    ): float {
        $effectiveStart = $start->copy();

        $ledgerStart = Carbon::parse($this->ledgerStartDate());

        if ($effectiveStart->lt($ledgerStart)) {
            $effectiveStart = $ledgerStart->copy();
        }

        if ($effectiveStart->gt($end)) {
            return 0.0;
        }

        $column = $direction === 'in'
            ? 'to_account_id'
            : 'from_account_id';

        return (float) Transaction::where(
            $column,
            $account->id
        )
            ->where('type', 'transfer')
            ->whereBetween('transaction_date', [
                $effectiveStart->toDateString(),
                $end->toDateString(),
            ])
            ->sum('amount');
    }
}
