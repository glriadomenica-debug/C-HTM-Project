<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_number_sequences', function (Blueprint $table) {
            $table->unsignedBigInteger('id')->primary();
            $table->unsignedBigInteger('current_number')->default(0);
        });

        // Start after the highest existing CHTM member number.
        $maximum = 0;

        foreach (DB::table('members')->pluck('member_number') as $number) {
            if (preg_match('/^CHTM-(\d+)$/', $number, $matches)) {
                $maximum = max($maximum, (int) $matches[1]);
            }
        }

        DB::table('member_number_sequences')->insert([
            'id' => 1,
            'current_number' => $maximum,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('member_number_sequences');
    }
};
