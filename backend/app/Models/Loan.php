<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Loan extends Model
{
    protected $fillable = [
        'member_id',
        'non_member_id',
        'loan_date',
        'loan_amount',
    ];

    protected function casts(): array
    {
        return [
            'member_id' => 'integer',
            'non_member_id' => 'integer',
            'loan_date' => 'date',
            'loan_amount' => 'decimal:2',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'member_id');
    }

    public function nonmember(): BelongsTo
    {
        return $this->belongsTo(Nonmember::class, 'non_member_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Loanpayment::class, 'loan_id');
    }
}