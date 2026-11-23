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
            $roles = Role::withCount('users')->get();

            return ApiMessage::success(
                'Roles retrieved successfully',
                $roles,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        $validator = Validator::make(
            $request->all(),
            [
                'role_name' => 'required|string|max:255|unique:roles,role_name',
            ],
            [
                'role_name.required' => 'Role name is required',
                'role_name.unique' => 'This role already exists',
                'role_name.max' => 'Role name must not exceed 255 characters',
            ]
        );

        if ($validator->fails()) {
            return ApiMessage::error($validator->errors(), 400);
        }

        try {
            $role = Role::create([
                'role_name' => trim($request->role_name),
            ]);

            return ApiMessage::success(
                'Role created successfully',
                $role,
                201
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function show(string $id)
    {
        try {
            $role = Role::withCount('users')->find($id);

            if (!$role) {
                return ApiMessage::error('Role not found', 404);
            }

            return ApiMessage::success(
                'Role retrieved successfully',
                $role,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function update(Request $request, string $id)
    {
        try {
            $role = Role::find($id);

            if (!$role) {
                return ApiMessage::error('Role not found', 404);
            }

            $validator = Validator::make(
                $request->all(),
                [
                    'role_name' => [
                        'sometimes',
                        'required',
                        'string',
                        'max:255',
                        'unique:roles,role_name,' . $role->id,
                    ],
                ],
                [
                    'role_name.required' => 'Role name is required',
                    'role_name.unique' => 'This role already exists',
                    'role_name.max' => 'Role name must not exceed 255 characters',
                ]
            );

            if ($validator->fails()) {
                return ApiMessage::error($validator->errors(), 400);
            }

            if ($request->has('role_name')) {
                $role->role_name = trim($request->role_name);
                $role->save();
            }

            return ApiMessage::success(
                'Role successfully updated',
                $role->loadCount('users'),
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }

    public function destroy(string $id)
    {
        try {
            $role = Role::find($id);

            if (!$role) {
                return ApiMessage::error('Role not found', 404);
            }

            // Do not delete a role that is assigned to any user.
            if ($role->users()->exists()) {
                return ApiMessage::error(
                    'Cannot delete this role because it is currently assigned to one or more users. Please assign those users to another role first.',
                    409
                );
            }

            $role->delete();

            return ApiMessage::success(
                'Role successfully deleted',
                null,
                200
            );
        } catch (\Throwable $th) {
            return ApiMessage::error($th->getMessage(), 500);
        }
    }
}
