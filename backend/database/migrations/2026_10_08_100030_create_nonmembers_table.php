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
        Schema::create('nonmembers', function (Blueprint $table) {
            $table->id();
            $table->string('full_name');
            $table->enum('gender', ["Male", "Female"]);
            $table->string('id_card_number');
            $table->string('phone_number');
            $table->string('address');
            $table->string('employer');
            $table->string('work_location');
            $table->timestamp('created_at');
            $table->timestamp('updated_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('nonmembers');
    }
};
