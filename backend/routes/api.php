<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\NonMemberController;
use App\Http\Controllers\Api\DepositController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LoanPaymentController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AuthenticatedUserSettingsController;
use App\Http\Controllers\Api\TransactionController;

// Authentication
Route::post('auth/login', [AuthController::class, 'login']);
Route::post('auth/registration', [AuthController::class, 'registration']);

// Roles
Route::apiResource('roles', RoleController::class);

// Users
Route::apiResource('users', UserController::class);

// Members
Route::apiResource('members', MemberController::class);

// Non-members
Route::apiResource('nonmembers', NonMemberController::class);

// Deposits
Route::apiResource('deposits', DepositController::class);

// Loans
Route::apiResource('loans', LoanController::class);

// Loan payments
Route::apiResource('loanpayments', LoanPaymentController::class);

// Cash Accounts
Route::get('/cash-accounts', [TransactionController::class,  'accounts',]);

// Transactions
Route::get('/transactions', [TransactionController::class, 'index',]);

Route::post('/transactions', [TransactionController::class,  'store',]);

Route::delete('/transactions/{transaction}', [TransactionController::class,  'destroy',]);

// User Settings
Route::middleware('auth:sanctum')->group(function () {
  Route::get('profile', [
    AuthenticatedUserSettingsController::class,
    'show',
  ]);

  Route::put('profile', [
    AuthenticatedUserSettingsController::class,
    'updateProfile',
  ]);

  Route::put('change-password', [
    AuthenticatedUserSettingsController::class,
    'changePassword',
  ]);
});
