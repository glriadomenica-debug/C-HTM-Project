<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Member extends Model
{
    protected $fillable = [
        'member_number',
        'full_name',
        'gender',
        'id_card_number',
        'phone_number',
        'address',
        'employer',
        'work_location',
        'membership_status',
    ];

    protected function casts(): array
    {
        return [
            'member_number' => 'string',
            'gender' => 'string',
            'membership_status' => 'string',
        ];
    }


    public function deposits(): HasMany
    {
        return $this->hasMany(
            Deposit::class,
            'member_number',
            'member_number'
        );
    }

    public function loans(): HasMany
    {
        return $this->hasMany(
            Loan::class,
            'member_number',
            'member_number'
        );
    }
}
