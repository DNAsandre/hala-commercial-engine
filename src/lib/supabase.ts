/**
 * SC-01.1 — clean-owned Supabase client.
 *
 * INDEPENDENCE PROPERTIES:
 *  - Configuration comes from THIS package's environment (.env), not from any
 *    old-app source file.
 *  - `storageKey` is explicitly namespaced ("hala-clean-auth"). The old app
 *    uses the supabase-js default key (sb-<project-ref>-auth-token), so the
 *    two applications hold fully independent sessions even on the same
 *    machine/origin. Signing out of one never signs out the other.
 *    (Binding decision B1 from the approved migration plan.)
 *
 * The shared Supabase BUSINESS DATABASE is the accepted external service for
 * SC-01 (sprint §5). Sharing the database is deliberate; sharing the session
 * is not, and is prevented here.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Fail loudly and honestly at startup rather than limping into fetch errors.
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env inside hala-clean-commercial-engine and fill both values.",
  );
}

/**
 * Bypass Navigator.locks to prevent auth deadlocks in preview/iframe
 * environments (same workaround the product already relies on).
 */
const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => fn();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storageKey: "hala-clean-auth",
    lock: noopLock,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
