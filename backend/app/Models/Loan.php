<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Loan extends Model
{
    protected $fillable = [
        'member_number',
        'non_member_number',
        'loan_date',
        'loan_amount',
        'interest_rate',
        'interest_amount',
        'total_amount',
    ];

    protected function casts(): array
    {
        return [
            'member_number' => 'string',
            'non_member_number' => 'string',
            'loan_date' => 'date',
            'loan_amount' => 'decimal:2',
            'interest_rate' => 'decimal:2',
            'interest_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(
            Member::class,
            'member_number',
            'member_number'
        );
    }

    public function nonmember(): BelongsTo
    {
        return $this->belongsTo(
            Nonmember::class,
            'non_member_number',
            'non_member_number'
        );
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Loanpayments::class, 'loan_id');
    }
}
