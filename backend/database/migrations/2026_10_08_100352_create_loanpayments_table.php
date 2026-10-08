<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('loanpayments', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('loan_id');
            $table->foreign('loan_id')->references('id')->on('Loans');
            $table->decimal('amount');
            $table->date('payment_date');
            $table->enum('payment_method', ["Cash", "Bank Transfer"]);
            $table->string('description');
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loanpayments');
    }
};
