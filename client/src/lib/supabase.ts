import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kositquaqmuousalmoar.supabase.co';
// Legacy JWT anon key — required for PostgREST/REST API compatibility.
// The new sb_publishable_ format only works with Auth endpoints, not REST.
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvc2l0cXVhcW11b3VzYWxtb2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4Mzg1NjUsImV4cCI6MjA4NzQxNDU2NX0.ULDr14MImvZz6ssst3m-mtgEtsJ5o2TDe9cz4mOTcEc';

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
