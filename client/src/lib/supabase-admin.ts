/**
 * Supabase Admin Client — Service Role
 * 
 * ⚠️  WARNING: This uses the service_role key which bypasses RLS.
 *     In production, move these operations to a secure backend API.
 *     This is acceptable for an internal admin tool with limited access.
 * 
 * Used exclusively for:
 * - Creating new auth users
 * - Updating user emails in auth.users
 * - Resetting passwords
 * - Deactivating/banning users
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgzODU2NSwiZXhwIjoyMDg3NDE0NTY1fQ.AR5WyyxVgXtHt8Foj66ms15vl-fBskXhxwTb99tz99A';

const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  return fn();
};

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    lock: noopLock,
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================

export interface CreateUserParams {
  email: string;
  password: string;
  name: string;
  role: string;
  department?: string;
  region?: string;
}

export interface UpdateUserParams {
  userId: string;       // public.users.id (e.g., "u1")
  authId: string;       // auth.users.id (UUID)
  email?: string;
  name?: string;
  role?: string;
  department?: string;
  region?: string;
  status?: string;
}

/**
 * Create a new user in Supabase Auth + public.users table
 */
export async function adminCreateUser(params: CreateUserParams): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    const authId = authData.user.id;

    // 2. Generate a new user ID for public.users
    const { data: existingUsers } = await supabaseAdmin.from('users').select('id').order('id', { ascending: false });
    const maxNum = (existingUsers || []).reduce((max: number, u: any) => {
      const num = parseInt(u.id.replace('u', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const newUserId = `u${maxNum + 1}`;

    // 3. Create public.users record
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      auth_id: authId,
      name: params.name,
      email: params.email,
      role: params.role,
      department: params.department || params.role,
      region: params.region || 'All',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (userError) {
      // Rollback: delete auth user if public.users insert fails
      await supabaseAdmin.auth.admin.deleteUser(authId);
      return { success: false, error: userError.message };
    }

    return { success: true, userId: newUserId };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Update an existing user's profile and/or auth email
 */
export async function adminUpdateUser(params: UpdateUserParams): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Update auth email if changed
    if (params.email && params.authId) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(params.authId, {
        email: params.email,
      });
      if (authError) {
        return { success: false, error: `Auth update failed: ${authError.message}` };
      }
    }

    // 2. Update public.users record
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (params.name) updates.name = params.name;
    if (params.email) updates.email = params.email;
    if (params.role) updates.role = params.role;
    if (params.department) updates.department = params.department;
    if (params.region) updates.region = params.region;
    if (params.status) updates.status = params.status;

    const { error: userError } = await supabaseAdmin.from('users').update(updates).eq('id', params.userId);
    if (userError) {
      return { success: false, error: userError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Reset a user's password
 */
export async function adminResetPassword(authId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authId, {
      password: newPassword,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Deactivate (ban) a user — prevents login but keeps data
 */
export async function adminDeactivateUser(authId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Ban in auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
      ban_duration: '876000h', // ~100 years
    });
    if (authError) return { success: false, error: authError.message };

    // Mark inactive in public.users
    const { error: userError } = await supabaseAdmin.from('users').update({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
    if (userError) return { success: false, error: userError.message };

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Reactivate a previously deactivated user
 */
export async function adminReactivateUser(authId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
      ban_duration: 'none',
    });
    if (authError) return { success: false, error: authError.message };

    const { error: userError } = await supabaseAdmin.from('users').update({
      status: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
    if (userError) return { success: false, error: userError.message };

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}
