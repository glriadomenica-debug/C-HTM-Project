<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deposit extends Model
{
    protected $fillable = [
        'member_number',
        'amount',
        'deposit_date',
        'deposit_type',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'member_number' => 'string',
            'amount' => 'decimal:2',
            'deposit_date' => 'date',
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
}
