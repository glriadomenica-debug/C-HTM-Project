<?php

namespace Database\Seeders;

use App\Models\CashAccount;
use Illuminate\Database\Seeder;

class CashAccountSeeder extends Seeder
{
    public function run(): void
    {
        $accounts = [
            [
                'name' => 'Bank BNU',
                'opening_balance' => 136582.33,
                'opening_date' => '2025-01-01',
            ],
            [
                'name' => 'Brankas I Manleu',
                'opening_balance' => 6760.00,
                'opening_date' => '2025-01-01',
            ],
            [
                'name' => 'Office CHTM',
                // Isi setelah saldo awal dari ledger Office
                // Januari 2025 sudah dikonfirmasi.
                'opening_balance' => null,
                'opening_date' => null,
            ],
        ];

        foreach ($accounts as $account) {
            CashAccount::firstOrCreate(
                ['name' => $account['name']],
                [
                    'opening_balance' => $account['opening_balance'],
                    'opening_date' => $account['opening_date'],
                    'is_active' => true,
                ]
            );
        }
    }
}
