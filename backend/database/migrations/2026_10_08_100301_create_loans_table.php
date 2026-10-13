
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();
            $table->string('member_number')->nullable();
            $table->string('non_member_number')->nullable();
            $table->foreign('member_number')->references('member_number')->on('members')->restrictOnDelete();
            $table->foreign('non_member_number')->references('non_member_number')->on('nonmembers')->restrictOnDelete();
            $table->date('loan_date');
            $table->decimal('loan_amount', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
