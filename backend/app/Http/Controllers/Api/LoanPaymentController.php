<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Loanpayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class LoanpaymentController extends Controller
{
    public function index()
    {
        try {
            $payments = Loanpayment::with([
                'loan.member',
                'loan.nonmember',
            ])->latest()->get();

            return ApiMessage::success(
                'Success get all loan payments data',
                $payments,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'loan_id' => 'required|exists:loans,id',
                'amount' => 'required|numeric|gt:0',
                'payment_date' => 'required|date',
                'payment_method' => 'required|in:Cash,Bank Transfer',
                'description' => 'nullable|string|max:255',
            ], [
                'loan_id.required' => 'Loan is required',
                'loan_id.exists' => 'Selected loan does not exist',
                'amount.required' => 'Payment amount is required',
                'amount.gt' => 'Payment amount must be greater than zero',
                'payment_method.in' => 'Payment method must be Cash or Bank Transfer',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $payment = DB::transaction(function () use ($validator) {
                return Loanpayment::create($validator->validated());
            });

            $payment->load(['loan.member', 'loan.nonmember']);

            return ApiMessage::success(
                'Loan payment created successfully',
                $payment,
                201
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $payment = Loanpayment::with([
                'loan.member',
                'loan.nonmember',
            ])->find($id);

            if (!$payment) {
                return ApiMessage::error('Loan payment not found', 404);
            }

            return ApiMessage::success(
                'Success get loan payment data',
                $payment,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $payment = Loanpayment::find($id);

            if (!$payment) {
                return ApiMessage::error('Loan payment not found', 404);
            }

            $validator = Validator::make($request->all(), [
                'loan_id' => 'sometimes|required|exists:loans,id',
                'amount' => 'sometimes|required|numeric|gt:0',
                'payment_date' => 'sometimes|required|date',
                'payment_method' => 'sometimes|required|in:Cash,Bank Transfer',
                'description' => 'sometimes|nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $payment->fill($validator->validated());
            $payment->save();
            $payment->load(['loan.member', 'loan.nonmember']);

            return ApiMessage::success(
                'Loan payment updated successfully',
                $payment,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $payment = Loanpayment::find($id);

            if (!$payment) {
                return ApiMessage::error('Loan payment not found', 404);
            }

            $payment->delete();

            return ApiMessage::success(
                'Loan payment deleted successfully',
                null,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }
}
