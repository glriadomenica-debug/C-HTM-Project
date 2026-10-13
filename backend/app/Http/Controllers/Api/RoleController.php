<?php

namespace App\Http\Controllers\Api;

use App\Helpers\ApiMessage;
use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class RoleController extends Controller
{
    public function index()
    {
        try {
            $roles = Role::all();
            return ApiMessage::success('Roles retrieved successfully', $roles, 200);
        } catch (\Exception $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $rule = [
                'role_name' => 'required|string'
            ];

            $message = [
                'role_name.required' => 'Role name is required'
            ];
            $validator = Validator::make($request->all(), $rule, $message);
            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }
            try {
                //save ke table role
                $role = new Role();
                $role->role_name = $request->role_name;
                $role->save();

                DB::commit();
                return ApiMessage::success('Success', 'Registration successful', 201);
            } catch (\Throwable $th) {
                DB::rollBack();
                return ApiMessage::error($th->getMessage(), 500);
            }
        } catch (\Exception $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        try {
            $roles = Role::find($id);
            if (!$roles) {
                return ApiMessage::error('Error', 'Role not found', 400);
            }
            return ApiMessage::success('Success', $roles, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 400);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        try {
            $rules = [
                'role_name' => 'sometimes|string'
            ];
            $message = [
                'role_name.required' => 'Role name is required'
            ];
            $validator = Validator::make($request->all(), $rules, $message);
            if ($validator->fails()) {
                return ApiMessage::error('error', $validator->errors(), 400);
            }
            $role = Role::find($id);

            if (!$role) {
                return ApiMessage::error('Error', 'Role not found', 404);
            }
            if ($request->has('role_name')) {
                $role->role_name = $request->role_name;
            }
            $role->save();
            return ApiMessage::success('Role successfully updated', $role, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error('Error', $th->getMessage(), 400);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        try {
            $role = Role::find($id);
            if (!$role) {
                return ApiMessage::error('Error', 'Role not found', 404);
            }
            //check apakah role dipakai user
            if ($role->users()->count() > 0) {
                return ApiMessage::error('Error', 'Role cannot be deleted because it is still used by users', 400);
            }
            $role->delete();
            return ApiMessage::success('Role successfully deleted', null, 200);
        } catch (\Throwable $th) {
            return ApiMessage::error('Error', $th->getMessage(), 400);
        }
    }
}
