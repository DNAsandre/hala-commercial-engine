import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
// New publishable key (replaces legacy anon JWT — see Sprint 4A key rotation)
const SUPABASE_ANON_KEY = 'sb_publishable_wHi7-wUj8lkF4gmDPJrgfg_CPTD9-rg';

/**
 * Custom lock function that bypasses Navigator.locks to prevent deadlocks
 * in preview/iframe environments where locks can get stuck.
 */
const noopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  return fn();
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Bypass Navigator Lock to prevent deadlocks in preview environments
    lock: noopLock,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
