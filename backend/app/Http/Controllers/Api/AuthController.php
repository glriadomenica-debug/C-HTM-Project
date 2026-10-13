<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Helpers\ApiMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    // LOGIN
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ], [
            'email.required' => 'Email is required',
            'email.email' => 'Email is not valid',
            'password.required' => 'Password is required',
            'password.string' => 'Password must be a string',
        ]);

        if ($validator->fails()) {
            return ApiMessage::error(
                $validator->errors(),
                400
            );
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return ApiMessage::error(
                'User or Password is incorrect',
                401
            );
        }

        $user->load('role');

        $token = $user->createToken('auth_token')->plainTextToken;

        return ApiMessage::success('Login successful', [
            'user' => $user,
            'token' => $token,
        ], 200);
    }

    // REGISTRATION
    public function registration(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'password_confirmation' => 'required|string|same:password',
            'role_id' => 'required|exists:roles,id',
        ], [
            'name.required' => 'Name is required',
            'email.required' => 'Email is required',
            'email.email' => 'Email must be a valid email address',
            'email.unique' => 'Email is already registered',
            'password.required' => 'Password is required',
            'password.min' => 'Password must be at least 6 characters',
            'password_confirmation.required' => 'Password confirmation is required',
            'password_confirmation.same' => 'Password confirmation must match password',
            'role_id.required' => 'Role is required',
            'role_id.exists' => 'Role not found',
        ]);

        if ($validator->fails()) {
            return ApiMessage::error(
                $validator->errors(),
                400
            );
        }

        try {
            DB::beginTransaction();

            $user = new User();
            $user->name = $request->name;
            $user->email = $request->email;
            $user->password = Hash::make($request->password);
            $user->role_id = $request->role_id;
            $user->save();

            DB::commit();

            return ApiMessage::success(
                'Registration successful',
                $user,
                201
            );
        } catch (\Throwable $th) {
            DB::rollBack();

            return ApiMessage::error(
                'Registration failed',
                500
            );
        }
    }
}
