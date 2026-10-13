<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    public function index()
    {
        try {
            $user = User::with('role')->get();
            return ApiMessage::success('Success get all users data', $user, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $rules = [
                'role_id' => 'required|exists:roles,id',
                'name' => 'required|string|max:255',
                'email' => 'required|email',
                'password' => 'required|string|min:8',
                'password_confirmation' => 'required|string|same:password',
                'phone_number' => 'required|string|max:15',
            ];
            $messages = [
                'name.required' => 'Name is required',
                'email.required' => 'Email is required',
                'email.email' => 'Email must be a valid email address',
                'password.required' => 'Password is required',
                'password.min' => 'Password must be at least 8 characters',
                'password_confirmation.required' => 'Password confirmation is required',
                'password_confirmation.same' => 'Password confirmation must match the password',
                'phone_number.required' => 'Phone number is required',
                'phone_number.max' => 'Phone number must not exceed 15 characters',
            ];

            $validator = Validator::make($request->all(), $rules, $messages);
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
                return ApiMessage::success('Success', 'User created successfully', 201);
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
                return ApiMessage::error('Error', 'User not found', 400);
            }
            return ApiMessage::success('Success', $user, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 400);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $rules = [
                'name' => 'sometimes|string|max:255',
                'email' => 'sometimes|email',
                'password' => 'sometimes|string|min:8',
                'password_confirmation' => 'sometimes|string|same:password',
                'phone_number' => 'sometimes|string|max:15',
            ];
            $messages = [
                'name.string' => 'Name must be a string',
                'name.max' => 'Name must not exceed 255 characters',
                'email.email' => 'Email must be a valid email address',
                'password.min' => 'Password must be at least 8 characters',
                'password_confirmation.same' => 'Password confirmation must match the password',
                'phone_number.max' => 'Phone number must not exceed 15 characters',
            ];

            $validator = Validator::make($request->all(), $rules, $messages);
            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            $user = User::find($id);
            if (!$user) {
                return ApiMessage::error('Error', 'User not found', 404);
            }
            if ($request->has('name')) {
                $user->name = $request->name;
            }
            if ($request->has('email')) {
                $user->email = $request->email;
            }
            if ($request->has('password')) {
                $user->password = bcrypt($request->password);
            }
            if ($request->has('phone_number')) {
                $user->phone_number = $request->phone_number;
            }
            $user->save();
            return ApiMessage::success('User successfully updated', $user, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error('Error', $th->getMessage(), 400);
        }
    }

    public function destroy(string $id)
    {
        try {
            $user = User::find($id);
            if (!$user) {
                return ApiMessage::error('Error', 'User not found', 404);
            }
            $user->delete();
            return ApiMessage::success('User successfully deleted', null, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error('Error', $th->getMessage(), 400);
        }
    }
}
