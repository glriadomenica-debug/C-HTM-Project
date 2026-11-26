<?php

return [
  /*
    |--------------------------------------------------------------------------
    | Cash Ledger Start Date
    |--------------------------------------------------------------------------
    |
    | The date from which cash ledger balances are calculated.
    | Each cash account starts at zero on this date.
    |
    */

  'start_date' => env('CASH_LEDGER_START_DATE', '2026-11-01'),
];
