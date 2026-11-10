<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();

            $table->enum('type', [
                'income',
                'expense',
                'transfer',
            ]);

            // Digunakan untuk income dan expense.
            $table->foreignId('account_id')
                ->nullable()
                ->constrained('cash_accounts')
                ->restrictOnDelete();

            // Digunakan untuk transfer.
            $table->foreignId('from_account_id')
                ->nullable()
                ->constrained('cash_accounts')
                ->restrictOnDelete();

            $table->foreignId('to_account_id')
                ->nullable()
                ->constrained('cash_accounts')
                ->restrictOnDelete();

            $table->date('transaction_date');
            $table->decimal('amount', 15, 2);
            $table->string('category')->nullable();
            $table->text('description')->nullable();

            $table->timestamps();

            $table->index(['transaction_date', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
