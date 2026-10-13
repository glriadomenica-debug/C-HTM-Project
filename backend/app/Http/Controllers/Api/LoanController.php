<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Loan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LoanController extends Controller
{
    public function index()
    {
        try {
            $loans = Loan::with([
                'member',
                'nonmember',
                'payments',
            ])->latest()->get();

            return ApiMessage::success(
                'Success get all loans data',
                $loans,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'member_number' => 'nullable|string|exists:members,member_number',
            'non_member_number' => 'nullable|string|exists:nonmembers,non_member_number',
            'loan_date' => 'required|date',
            'loan_amount' => 'required|numeric|gt:0',
        ]);

        $validator->after(function ($validator) use ($request) {
            $hasMember = $request->filled('member_number');
            $hasNonmember = $request->filled('non_member_number');

            if ($hasMember === $hasNonmember) {
                $validator->errors()->add(
                    'member_number',
                    'Provide exactly one valid member_number or non_member_number.'
                );
            }
        });

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        try {
            $loan = Loan::create($validator->validated());
            $loan->load(['member', 'nonmember', 'payments']);

            return ApiMessage::success(
                'Loan created successfully',
                $loan,
                201
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $loan = Loan::with([
                'member',
                'nonmember',
                'payments',
            ])->find($id);

            if (!$loan) {
                return ApiMessage::error('Loan not found', 404);
            }

            return ApiMessage::success(
                'Success get loan data',
                $loan,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        $loan = Loan::find($id);

        if (!$loan) {
            return ApiMessage::error('Loan not found', 404);
        }

        $validator = Validator::make($request->all(), [
            'member_number' => 'sometimes|nullable|string|exists:members,member_number',
            'non_member_number' => 'sometimes|nullable|string|exists:nonmembers,non_member_number',
            'loan_date' => 'sometimes|required|date',
            'loan_amount' => 'sometimes|required|numeric|gt:0',
        ]);

        $validator->after(function ($validator) use ($request, $loan) {
            $memberNumber = $request->exists('member_number')
                ? $request->input('member_number')
                : $loan->member_number;

            $nonmemberNumber = $request->exists('non_member_number')
                ? $request->input('non_member_number')
                : $loan->non_member_number;

            $hasMember = filled($memberNumber);
            $hasNonmember = filled($nonmemberNumber);

            if ($hasMember === $hasNonmember) {
                $validator->errors()->add(
                    'member_number',
                    'The loan must belong to exactly one member or nonmember.'
                );
            }
        });

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        try {
            $loan->update($validator->validated());
            $loan->load(['member', 'nonmember', 'payments']);

            return ApiMessage::success(
                'Loan updated successfully',
                $loan,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $loan = Loan::find($id);

            if (!$loan) {
                return ApiMessage::error('Loan not found', 404);
            }

            if ($loan->payments()->exists()) {
                return ApiMessage::error(
                    'Cannot delete a loan that already has payments.',
                    409
                );
            }

            $loan->delete();

            return ApiMessage::success(
                'Loan deleted successfully',
                null,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }
}
