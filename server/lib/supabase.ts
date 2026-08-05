/**
 * SC-01 Wave 03 (W03-3) — clean-server Supabase access.
 *
 * INDEPENDENCE / SECURITY PROPERTIES:
 *  - Configuration comes from THIS package's .env only (VITE_SUPABASE_URL /
 *    VITE_SUPABASE_ANON_KEY, loaded by server/index.ts). Nothing is imported
 *    from, proxied to, or inherited from hala-commercial-engine.
 *  - The ANON key is the only key this server ever holds. No service-role key,
 *    no secret material, no privilege escalation. (Service-role handling is
 *    Sprint X security work and is deliberately NOT done here.)
 *  - Because the anon key alone carries no identity, every request is executed
 *    as the CALLING USER: the caller's Supabase access token is forwarded as
 *    the Authorization header, so Postgres RLS decides what is visible.
 *
 *    This matters for honesty. `generated_documents` grants SELECT to the
 *    `authenticated` role only, so an anonymous query would return an EMPTY
 *    list rather than an error — an empty-but-OK lie. The routes therefore
 *    require a bearer token and fail with 401 instead of pretending the vault
 *    is empty.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase Storage bucket that holds document bytes (established contract). */
export const DOCUMENT_BUCKET = "documents";

/** Supabase table that holds document metadata (established contract). */
export const DOCUMENT_TABLE = "generated_documents";

export class SupabaseConfigError extends Error {}

/**
 * Read the Supabase configuration at call time (not at import time) so that a
 * misconfigured environment surfaces as an explicit 500 on the affected
 * request instead of crashing the process at import.
 */
function readConfig(): { url: string; anonKey: string } {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseConfigError(
      "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env " +
        "inside hala-clean-commercial-engine and fill both values.",
    );
  }
  return { url, anonKey };
}

/**
 * Build a per-request Supabase client that acts as the calling user.
 *
 * @param accessToken the caller's Supabase access token (from `Authorization:
 *        Bearer <token>`). Never logged, never persisted.
 */
export function createUserScopedClient(accessToken: string): SupabaseClient {
  const { url, anonKey } = readConfig();
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
