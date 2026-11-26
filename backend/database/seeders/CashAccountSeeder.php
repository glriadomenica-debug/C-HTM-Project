<?php

namespace Database\Seeders;

use App\Models\CashAccount;
use Illuminate\Database\Seeder;

class CashAccountSeeder extends Seeder
{
    public function run(): void
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
}
