<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Deposit;
use Illuminate\Http\Request;
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
        $validator = Validator::make($request->all(), [
            'member_number' => 'required|string|exists:members,member_number',
            'amount' => 'required|numeric|gt:0',
            'deposit_date' => 'required|date',
            'deposit_type' => 'required|in:Initial,Regular,Additional,Withdrawal',
            'description' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        try {
            $deposit = Deposit::create($validator->validated());
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
        $deposit = Deposit::find($id);

        if (!$deposit) {
            return ApiMessage::error('Deposit not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'member_number' => 'sometimes|required|string|exists:members,member_number',
            'amount' => 'sometimes|required|numeric|gt:0',
            'deposit_date' => 'sometimes|required|date',
            'deposit_type' => 'sometimes|required|in:Initial,Regular,Additional,Withdrawal',
            'description' => 'sometimes|nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        try {
            $deposit->update($validator->validated());
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
