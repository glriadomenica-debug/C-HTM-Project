<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Deposit extends Model
{
    protected $fillable = [
        'member_id',
        'amount',
        'deposit_date',
        'deposit_type',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'member_id' => 'integer',
            'amount' => 'decimal:2',
            'deposit_date' => 'date',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class, 'member_id');
    }
}
