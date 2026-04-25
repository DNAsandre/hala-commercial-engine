/**
 * Server-side Supabase client — uses SERVICE ROLE KEY.
 * 
 * This key bypasses RLS and has full access.
 * It must NEVER be exposed to the frontend.
 * 
 * The frontend continues to use its own anon key for auth.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ FATAL: SUPABASE_URL environment variable is required');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

/**
 * Service-role Supabase client for server-side operations.
 * Bypasses RLS — use with care. All mutations must go through
 * validated API routes with audit logging.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
