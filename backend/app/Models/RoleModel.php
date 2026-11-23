<?php

// namespace App\Models;
// use Illuminate\Database\Eloquent\Model;
// use Illuminate\Database\Eloquent\Relations\HasMany;

// class RoleModel extends Model
// {
//     protected $table = 'roles';

//     protected $fillable = [
//         'role_name',
//     ];

//     public function users(): HasMany
//     {
//         return $this->hasMany(User::class, 'role_id');
//     }
// }


namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    protected $fillable = [
        'role_name',
    ];

    /**
     * Get all users with this role.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}

