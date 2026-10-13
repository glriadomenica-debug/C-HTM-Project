<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Nonmember extends Model
{
    protected $table = 'nonmembers';

    protected $fillable = [
        'full_name',
        'gender',
        'id_card_number',
        'phone_number',
        'address',
        'employer',
        'work_location',
    ];

    protected function casts(): array
    {
        return [
            'gender' => 'string',
        ];
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class, 'non_member_id');
    }
}
