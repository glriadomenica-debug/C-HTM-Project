<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Loan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        try {
            $validator = Validator::make($request->all(), [
                'member_id' => 'nullable|integer|exists:members,id',
                'non_member_id' => 'nullable|integer|exists:nonmembers,id',
                'loan_date' => 'required|date',
                'loan_amount' => 'required|numeric|gt:0',
            ], [
                'member_id.exists' => 'Selected member does not exist',
                'non_member_id.exists' => 'Selected nonmember does not exist',
                'loan_amount.gt' => 'Loan amount must be greater than zero',
            ]);

            $validator->after(function ($validator) use ($request) {
                $hasMember = $request->filled('member_id');
                $hasNonmember = $request->filled('non_member_id');

                if ($hasMember === $hasNonmember) {
                    $validator->errors()->add(
                        'member_id',
                        'Select exactly one borrower: a member or a nonmember.'
                    );
                }
            });

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $loan = DB::transaction(function () use ($validator) {
                return Loan::create($validator->validated());
            });

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
        try {
            $loan = Loan::find($id);

            if (!$loan) {
                return ApiMessage::error('Loan not found', 404);
            }

            $validator = Validator::make($request->all(), [
                'member_id' => 'sometimes|nullable|integer|exists:members,id',
                'non_member_id' => 'sometimes|nullable|integer|exists:nonmembers,id',
                'loan_date' => 'sometimes|required|date',
                'loan_amount' => 'sometimes|required|numeric|gt:0',
            ]);

            $validator->after(function ($validator) use ($request, $loan) {
                $memberId = $request->exists('member_id')
                    ? $request->input('member_id')
                    : $loan->member_id;

                $nonmemberId = $request->exists('non_member_id')
                    ? $request->input('non_member_id')
                    : $loan->non_member_id;

                $hasMember = !empty($memberId);
                $hasNonmember = !empty($nonmemberId);

                if ($hasMember === $hasNonmember) {
                    $validator->errors()->add(
                        'member_id',
                        'The loan must belong to exactly one member or nonmember.'
                    );
                }
            });

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $loan->fill($validator->validated());
            $loan->save();
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
