
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deposits', function (Blueprint $table) {
            $table->id();

            $table->foreignId('member_id')->constrained('members')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->date('deposit_date');
            $table->enum('deposit_type', ['Initial', 'Regular', 'Additional', 'Withdrawal',]);
            $table->string('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deposits');
    }
};
