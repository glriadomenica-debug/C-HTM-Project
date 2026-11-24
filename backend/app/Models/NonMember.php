<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NonMember extends Model
{
  protected $table = 'nonmembers';

  protected $fillable = [
    'non_member_number',
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

  public function loans()
  {
    return $this->hasMany(
      Loan::class,
      'non_member_number',
      'non_member_number'
    );
  }
}
