<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AuthenticatedUserSettingsController extends Controller
{
  /**
   * Get the authenticated user's profile.
   */
  public function show(Request $request): JsonResponse
  {
    $user = $request->user()->load('role');

    return response()->json([
      'message' => 'Profile retrieved successfully.',
      'data' => $user,
    ]);
  }

  /**
   * Update the authenticated user's profile.
   */
  public function updateProfile(Request $request): JsonResponse
  {
    $user = $request->user();

    $validated = $request->validate([
      'name' => ['required', 'string', 'max:255'],

      'email' => [
        'required',
        'email',
        'max:255',
        Rule::unique('users', 'email')->ignore($user->id),
      ],

      'phone_number' => [
        'nullable',
        'string',
        'max:30',
      ],
    ]);

    $user->update($validated);
    $user->load('role');

    return response()->json([
      'message' => 'Profile updated successfully.',
      'data' => $user,
    ]);
  }

  /**
   * Change the authenticated user's password.
   */
  public function changePassword(Request $request): JsonResponse
  {
    $validated = $request->validate([
      'current_password' => [
        'required',
        'current_password',
      ],

      'password' => [
        'required',
        'string',
        'min:8',
        'confirmed',
        'different:current_password',
      ],
    ]);

    $user = $request->user();

    // The User model's hashed password cast handles hashing.
    $user->password = $validated['password'];
    $user->save();

    return response()->json([
      'message' => 'Password changed successfully.',
    ]);
  }
}
