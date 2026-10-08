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
        Schema::create('deposits', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('member_id');
            $table->foreign('member_id')->references('id')->on('Member');
            $table->decimal('amount');
            $table->date('deposit_date');
            $table->enum('deposit_type', ["Initial", "Regular", "Additional", "Withdrawal"]);
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
        Schema::dropIfExists('deposits');
    }
};
