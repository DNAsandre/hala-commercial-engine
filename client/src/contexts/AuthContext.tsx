/**
 * AuthContext — Supabase Auth integration
 * 
 * Provides the authenticated user's session and app profile across all pages.
 * On login, fetches the linked app user from the `users` table via auth_id.
 * Exposes: user, appUser, session, loading, signIn, signOut
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { setGlobalAuthUser, clearGlobalAuthUser } from "../lib/auth-state";
import { seedEscalationEvents } from "../lib/escalation-engine";
import type { Session, User } from "@supabase/supabase-js";
import { handleSupabaseError } from "@/lib/supabase-error";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string;
  avatar: string | null;
  auth_id: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  appUser: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchAppUser(authId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", authId)
    .single();
  if (error || !data) {
    handleSupabaseError('fetchAppUser_error:', { message: String(error) });
    return null;
  }
  return data as AppUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize: check existing session
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const profile = await fetchAppUser(s.user.id);
        if (mounted) {
          setAppUser(profile);
          if (profile) {
            setGlobalAuthUser(profile);
            seedEscalationEvents().catch(() => {});
          }
        }
      }
      if (mounted) setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const profile = await fetchAppUser(s.user.id);
          if (mounted) {
            setAppUser(profile);
            if (profile) setGlobalAuthUser(profile);
          }
        } else {
          setAppUser(null);
          clearGlobalAuthUser();
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setAppUser(null);
    clearGlobalAuthUser();
    // Force redirect to login after sign-out
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, appUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
