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
    /**
     * Daftar akun dan saldo sampai tanggal tertentu.
     */
    public function accounts(Request $request)
    {
        $data = $request->validate([
            'as_of' => ['nullable', 'date'],
        ]);

        $asOf = $data['as_of'] ?? now()->toDateString();

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
     * Daftar transaksi dan ringkasan saldo bulanan.
     */
    public function index(Request $request)
    {
        $data = $request->validate([
            'month' => [
                'nullable',
                'date_format:Y-m',
            ],
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

        $query = Transaction::with([
            'account:id,name',
            'fromAccount:id,name',
            'toAccount:id,name',
        ])
            ->whereBetween('transaction_date', [
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
            ->map(function ($account) use ($start, $end) {
                $previousDay = $start->copy()
                    ->subDay()
                    ->toDateString();

                $account->opening_balance = $this->balanceAsOf(
                    $account,
                    $previousDay
                );

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
     * Simpan income, expense atau transfer.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => [
                'required',
                Rule::in(['income', 'expense', 'transfer']),
            ],
            'transaction_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'category' => ['nullable', 'string', 'max:255'],
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

        $transaction = DB::transaction(function () use ($data) {
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
     * Hapus transaksi.
     * Saldo akan dihitung ulang dari transaksi yang tersisa.
     */
    public function destroy(Transaction $transaction)
    {
        $transaction->delete();

        return response()->json([
            'message' => 'Transaction deleted successfully.',
        ]);
    }

    /**
     * Hitung saldo akun sampai tanggal tertentu.
     *
     * opening_balance adalah saldo pada opening_date.
     */
    private function balanceAsOf(
        CashAccount $account,
        string $date
    ): ?float {
        if (
            $account->opening_balance === null ||
            $account->opening_date === null
        ) {
            return null;
        }

        $openingDate = $account->opening_date->toDateString();

        if ($date < $openingDate) {
            return null;
        }

        $income = Transaction::where('account_id', $account->id)
            ->where('type', 'income')
            ->whereBetween('transaction_date', [
                $openingDate,
                $date,
            ])
            ->sum('amount');

        $expense = Transaction::where('account_id', $account->id)
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [
                $openingDate,
                $date,
            ])
            ->sum('amount');

        $transferIn = Transaction::where(
            'to_account_id',
            $account->id
        )
            ->where('type', 'transfer')
            ->whereBetween('transaction_date', [
                $openingDate,
                $date,
            ])
            ->sum('amount');

        $transferOut = Transaction::where(
            'from_account_id',
            $account->id
        )
            ->where('type', 'transfer')
            ->whereBetween('transaction_date', [
                $openingDate,
                $date,
            ])
            ->sum('amount');

        return round(
            (float) $account->opening_balance
                + (float) $income
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
        return (float) Transaction::where(
            'account_id',
            $account->id
        )
            ->where('type', $type)
            ->whereBetween('transaction_date', [
                $start->toDateString(),
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
        $column = $direction === 'in'
            ? 'to_account_id'
            : 'from_account_id';

        return (float) Transaction::where(
            $column,
            $account->id
        )
            ->where('type', 'transfer')
            ->whereBetween('transaction_date', [
                $start->toDateString(),
                $end->toDateString(),
            ])
            ->sum('amount');
    }
}
