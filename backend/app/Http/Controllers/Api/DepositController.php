<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Deposit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DepositController extends Controller
{
    public function index()
    {
        try {
            $deposits = Deposit::with('member')->latest()->get();

            return ApiMessage::success(
                'Success get all deposits data',
                $deposits,
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
                'member_id' => 'required|exists:members,id',
                'amount' => 'required|numeric|gt:0',
                'deposit_date' => 'required|date',
                'deposit_type' => 'required|in:Initial,Regular,Additional,Withdrawal',
                'description' => 'nullable|string|max:255',
            ], [
                'member_id.required' => 'Member is required',
                'member_id.exists' => 'Selected member does not exist',
                'amount.required' => 'Amount is required',
                'amount.gt' => 'Amount must be greater than zero',
                'deposit_type.in' => 'Invalid deposit type',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $deposit = DB::transaction(function () use ($validator) {
                return Deposit::create($validator->validated());
            });

            $deposit->load('member');

            return ApiMessage::success(
                'Deposit created successfully',
                $deposit,
                201
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $deposit = Deposit::with('member')->find($id);

            if (!$deposit) {
                return ApiMessage::error('Deposit not found', 404);
            }

            return ApiMessage::success(
                'Success get deposit data',
                $deposit,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $deposit = Deposit::find($id);

            if (!$deposit) {
                return ApiMessage::error('Deposit not found', 404);
            }

            $validator = Validator::make($request->all(), [
                'member_id' => 'sometimes|required|exists:members,id',
                'amount' => 'sometimes|required|numeric|gt:0',
                'deposit_date' => 'sometimes|required|date',
                'deposit_type' => 'sometimes|required|in:Initial,Regular,Additional,Withdrawal',
                'description' => 'sometimes|nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $deposit->fill($validator->validated());
            $deposit->save();
            $deposit->load('member');

            return ApiMessage::success(
                'Deposit updated successfully',
                $deposit,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $deposit = Deposit::find($id);

            if (!$deposit) {
                return ApiMessage::error('Deposit not found', 404);
            }

            $deposit->delete();

            return ApiMessage::success(
                'Deposit deleted successfully',
                null,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }
}
