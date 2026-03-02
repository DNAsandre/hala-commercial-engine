/**
 * Admin API Client — Edge Function Proxy
 * 
 * All admin operations (user CRUD, password reset, ban/unban) are routed
 * through the `admin-user-management` Supabase Edge Function.
 * 
 * The Edge Function holds the service_role key server-side.
 * The client sends the user's Supabase auth JWT for verification.
 * The Edge Function checks the caller has role = 'admin' before executing.
 * 
 * This file replaces the old supabase-admin.ts which exposed the
 * service_role key in the browser bundle.
 */

import { supabase } from './supabase';

const EDGE_FUNCTION_URL =
  'https://kositquaqmuousalmoar.supabase.co/functions/v1/admin-user-management';

// ============================================================
// Types (preserved from old supabase-admin.ts)
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

type AdminResult = { success: boolean; error?: string; userId?: string };

// ============================================================
// Internal helper
// ============================================================

async function callEdgeFunction(
  action: string,
  params: Record<string, unknown>
): Promise<AdminResult> {
  // Get the current session JWT
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated — please log in again.' };
  }

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mzg1NjUsImV4cCI6MjA4NzQxNDU2NX0.ULDr14MImvZz6ssst3m-mtgEtsJ5o2TDe9cz4mOTcEc',
      },
      body: JSON.stringify({ action, ...params }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` };
    }

    return data as AdminResult;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error calling admin function' };
  }
}

// ============================================================
// Public API — drop-in replacements for old supabase-admin.ts
// ============================================================

/**
 * Create a new user in Supabase Auth + public.users table
 */
export async function adminCreateUser(params: CreateUserParams): Promise<AdminResult> {
  return callEdgeFunction('create-user', { ...params });
}

/**
 * Update an existing user's profile and/or auth email
 */
export async function adminUpdateUser(params: UpdateUserParams): Promise<AdminResult> {
  return callEdgeFunction('update-user', { ...params });
}

/**
 * Reset a user's password
 */
export async function adminResetPassword(authId: string, newPassword: string): Promise<AdminResult> {
  return callEdgeFunction('reset-password', { authId, newPassword });
}

/**
 * Deactivate (ban) a user — prevents login but keeps data
 */
export async function adminDeactivateUser(authId: string, userId: string): Promise<AdminResult> {
  return callEdgeFunction('deactivate-user', { authId, userId });
}

/**
 * Reactivate a previously deactivated user
 */
export async function adminReactivateUser(authId: string, userId: string): Promise<AdminResult> {
  return callEdgeFunction('reactivate-user', { authId, userId });
}
