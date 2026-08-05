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
  office?: string;
}

export interface UpdateUserParams {
  userId: string;       // public.users.id (e.g., "u1")
  authId: string;       // auth.users.id (UUID)
  email?: string;
  name?: string;
  role?: string;
  department?: string;
  region?: string;
  office?: string;
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
        'apikey': 'sb_publishable_wHi7-wUj8lkF4gmDPJrgfg_CPTD9-rg',
      },
      body: JSON.stringify({ action, ...params }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    }

    /* SC-01 Wave 04: a submitted request is not proof of persistence. Only an
     * explicit `success: true` in the response body is treated as success —
     * a 2xx with a missing, malformed or non-boolean body is reported as an
     * unconfirmed change, never surfaced to the user as "User updated". */
    if (!data || typeof data !== 'object') {
      return { success: false, error: `HTTP ${res.status} but the response body could not be read. The change was not confirmed.` };
    }
    if ((data as AdminResult).success !== true) {
      return {
        success: false,
        error: (data as AdminResult).error
          || `HTTP ${res.status} but the response did not confirm the change. Nothing is reported as saved.`,
      };
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
