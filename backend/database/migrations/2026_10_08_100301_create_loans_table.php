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
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('member_id');
            $table->foreign('member_id')->references('id')->on('Member');
            $table->bigInteger('non_member_id');
            $table->foreign('non_member_id')->references('id')->on('Non_member');
            $table->date('loan_date');
            $table->decimal('loan_amount');
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
