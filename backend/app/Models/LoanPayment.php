<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanPayment extends Model
{
  protected $table = 'loanpayments';

  protected $fillable = [
    'loan_id',
    'amount',
    'payment_date',
    'payment_method',
    'description',
  ];

  protected function casts(): array
  {
    return [
      'loan_id' => 'integer',
      'amount' => 'decimal:2',
      'payment_date' => 'date',
    ];
  }

  public function loan(): BelongsTo
  {
    return $this->belongsTo(Loan::class, 'loan_id');
  }
}
