
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->decimal('interest_rate', 5, 2)->default(0);
            $table->decimal('interest_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
        });

        // Preserve existing loans without adding interest retroactively.
        DB::table('loans')->update([
            'total_amount' => DB::raw('loan_amount'),
        ]);
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->dropColumn([
                'interest_rate',
                'interest_amount',
                'total_amount',
            ]);
        });
    }
};