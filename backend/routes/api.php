
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\NonmemberController;
use App\Http\Controllers\Api\DepositController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LoanpaymentController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;

Route::apiResource('roles', RoleController::class);
Route::apiResource('users', UserController::class);
Route::apiResource('members', MemberController::class);
Route::apiResource('nonmembers', NonmemberController::class);
Route::apiResource('deposits', DepositController::class);
Route::apiResource('loans', LoanController::class);
Route::apiResource('loanpayments', LoanpaymentController::class);
