<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\NonmemberController;
use App\Http\Controllers\Api\DepositController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\LoanpaymentController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;

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
Route::apiResource('nonmembers', NonmemberController::class);

// Deposits
Route::apiResource('deposits', DepositController::class);

// Loans
Route::apiResource('loans', LoanController::class);

// Loan payments
Route::apiResource('loanpayments', LoanpaymentController::class);
