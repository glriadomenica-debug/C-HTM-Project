<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Nonmember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class NonmemberController extends Controller
{
    public function index()
    {
        try {
            $nonmembers = Nonmember::withCount('loans')->get();

            return ApiMessage::success(
                'Success get all nonmembers data',
                $nonmembers,
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
                'full_name' => 'required|string|max:255',
                'gender' => 'required|in:Male,Female',
                'id_card_number' => 'required|string|max:255',
                'phone_number' => 'required|string|max:255',
                'address' => 'required|string|max:255',
                'employer' => 'required|string|max:255',
                'work_location' => 'required|string|max:255',
            ], [
                'full_name.required' => 'Full name is required',
                'gender.in' => 'Gender must be Male or Female',
                'id_card_number.required' => 'ID card number is required',
                'phone_number.required' => 'Phone number is required',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $nonmember = Nonmember::create(
                $validator->validated()
            );

            return ApiMessage::success(
                'Nonmember created successfully',
                $nonmember,
                201
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $nonmember = Nonmember::with('loans.payments')->find($id);

            if (!$nonmember) {
                return ApiMessage::error('Nonmember not found', 404);
            }

            return ApiMessage::success(
                'Success get nonmember data',
                $nonmember,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $nonmember = Nonmember::find($id);

            if (!$nonmember) {
                return ApiMessage::error('Nonmember not found', 404);
            }

            $validator = Validator::make($request->all(), [
                'full_name' => 'sometimes|required|string|max:255',
                'gender' => 'sometimes|required|in:Male,Female',
                'id_card_number' => 'sometimes|required|string|max:255',
                'phone_number' => 'sometimes|required|string|max:255',
                'address' => 'sometimes|required|string|max:255',
                'employer' => 'sometimes|required|string|max:255',
                'work_location' => 'sometimes|required|string|max:255',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $nonmember->fill($validator->validated());
            $nonmember->save();

            return ApiMessage::success(
                'Nonmember updated successfully',
                $nonmember,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $nonmember = Nonmember::find($id);

            if (!$nonmember) {
                return ApiMessage::error('Nonmember not found', 404);
            }

            $nonmember->delete();

            return ApiMessage::success(
                'Nonmember deleted successfully',
                null,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error(
                'Unable to delete nonmember. Check whether the nonmember still has loans.',
                409
            );
        }
    }
}
