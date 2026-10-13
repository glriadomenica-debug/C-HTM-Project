<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class MemberController extends Controller
{
    public function index()
    {
        try {
            $members = Member::withCount(['deposits', 'loans'])->get();
            
            return ApiMessage::success(
                'Success get all members data',
                $members,
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
                'member_number' => 'required|string|max:255|unique:members,member_number',
                'full_name' => 'required|string|max:255',
                'gender' => 'required|in:Male,Female',
                'id_card_number' => 'required|string|max:255',
                'phone_number' => 'required|string|max:255',
                'address' => 'required|string|max:255',
                'employer' => 'required|string|max:255',
                'work_location' => 'required|string|max:255',
                'membership_status' => 'sometimes|in:Active,Inactive',
            ], [
                'member_number.required' => 'Member number is required',
                'member_number.unique' => 'Member number already exists',
                'full_name.required' => 'Full name is required',
                'gender.in' => 'Gender must be Male or Female',
                'membership_status.in' => 'Membership status must be Active or Inactive',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $member = DB::transaction(function () use ($request) {
                $member = new Member();
                $member->fill($request->only([
                    'member_number',
                    'full_name',
                    'gender',
                    'id_card_number',
                    'phone_number',
                    'address',
                    'employer',
                    'work_location',
                    'membership_status',
                ]));
                $member->save();

                return $member;
            });

            return ApiMessage::success('Member created successfully',$member,201);
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $member = Member::with(['deposits', 'loans.payments'])->find($id);

            if (!$member) {
                return ApiMessage::error('Member not found', 404);
            }

            return ApiMessage::success('Success get member data',$member, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $member = Member::find($id);

            if (!$member) {
                return ApiMessage::error('Member not found', 404);
            }

            $validator = Validator::make($request->all(), [
                'member_number' => 'sometimes|required|string|max:255|unique:members,member_number,' . $id,
                'full_name' => 'sometimes|required|string|max:255',
                'gender' => 'sometimes|required|in:Male,Female',
                'id_card_number' => 'sometimes|required|string|max:255',
                'phone_number' => 'sometimes|required|string|max:255',
                'address' => 'sometimes|required|string|max:255',
                'employer' => 'sometimes|required|string|max:255',
                'work_location' => 'sometimes|required|string|max:255',
                'membership_status' => 'sometimes|required|in:Active,Inactive',
            ]);

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $member->fill($request->only([
                'member_number',
                'full_name',
                'gender',
                'id_card_number',
                'phone_number',
                'address',
                'employer',
                'work_location',
                'membership_status',
            ]));

            $member->save();

            return ApiMessage::success(
                'Member updated successfully',
                $member,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $member = Member::find($id);

            if (!$member) {
                return ApiMessage::error('Member not found', 404);
            }

            $member->delete();

            return ApiMessage::success('Member deleted successfully',null, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error('Unable to delete member. Check whether the member still has deposits or loans.', 409  );
        }
    }
}
