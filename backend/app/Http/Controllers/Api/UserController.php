<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        try {
            $users = User::with('role')->get();

            return ApiMessage::success(
                'Success get all users data',
                $users,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $rules = [
                'role_id' => 'required|integer|exists:roles,id',
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:8',
                'password_confirmation' => 'required|string|same:password',
                'phone_number' => 'required|string|max:15',
            ];

            $messages = [
                'role_id.required' => 'Role is required',
                'role_id.exists' => 'Selected role does not exist',
                'name.required' => 'Name is required',
                'email.required' => 'Email is required',
                'email.email' => 'Email must be a valid email address',
                'email.unique' => 'Email has already been taken',
                'password.required' => 'Password is required',
                'password.min' => 'Password must be at least 8 characters',
                'password_confirmation.required' => 'Password confirmation is required',
                'password_confirmation.same' => 'Password confirmation must match the password',
                'phone_number.required' => 'Phone number is required',
                'phone_number.max' => 'Phone number must not exceed 15 characters',
            ];

            $validator = Validator::make(
                $request->all(),
                $rules,
                $messages
            );

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            DB::beginTransaction();

            try {
                $user = new User();
                $user->role_id = $request->role_id;
                $user->name = $request->name;
                $user->email = $request->email;
                $user->password = bcrypt($request->password);
                $user->phone_number = $request->phone_number;
                $user->save();

                DB::commit();

                return ApiMessage::success(
                    'Success',
                    'User created successfully',
                    201
                );
            } catch (\Throwable $th) {
                DB::rollBack();

                return ApiMessage::error($th->getMessage(), 500);
            }
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $user = User::with('role')->find($id);

            if (!$user) {
                return ApiMessage::error('User not found', 404);
            }

            return ApiMessage::success('Success', $user, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $user = User::find($id);

            if (!$user) {
                return ApiMessage::error('User not found', 404);
            }

            $rules = [
                'role_id' => 'sometimes|required|integer|exists:roles,id',
                'name' => 'sometimes|required|string|max:255',
                'email' => [
                    'sometimes',
                    'required',
                    'email',
                    Rule::unique('users', 'email')->ignore($user->id),
                ],
                'password' => 'sometimes|required|string|min:8|confirmed',
                'password_confirmation' => 'sometimes|required_with:password|string',
                'phone_number' => 'sometimes|required|string|max:15',
            ];

            $messages = [
                'role_id.exists' => 'Selected role does not exist',
                'name.required' => 'Name cannot be empty',
                'email.email' => 'Email must be a valid email address',
                'email.unique' => 'Email has already been taken',
                'password.min' => 'Password must be at least 8 characters',
                'password.confirmed' => 'Password confirmation must match the password',
                'phone_number.max' => 'Phone number must not exceed 15 characters',
            ];

            $validator = Validator::make(
                $request->all(),
                $rules,
                $messages
            );

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            if ($request->has('role_id')) {
                $user->role_id = $request->role_id;
            }

            if ($request->has('name')) {
                $user->name = $request->name;
            }

            if ($request->has('email')) {
                $user->email = $request->email;
            }

            if ($request->filled('password')) {
                $user->password = bcrypt($request->password);
            }

            if ($request->has('phone_number')) {
                $user->phone_number = $request->phone_number;
            }

            $user->save();

            return ApiMessage::success(
                'User successfully updated',
                $user->load('role'),
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $user = User::find($id);

            if (!$user) {
                return ApiMessage::error('User not found', 404);
            }

            $user->delete();

            return ApiMessage::success(
                'User successfully deleted',
                null,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }
}
