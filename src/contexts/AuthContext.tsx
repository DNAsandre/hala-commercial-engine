/**
 * SC-01.1 — clean-owned authentication context.
 *
 * AUTHORED for the standalone app (not copied). The old AuthContext:
 *  - navigated to the old app's /login via window.location on sign-out, and
 *  - mirrored the profile into an old-app module-global store (auth-state.ts).
 * Neither behaviour belongs in the clean boundary. Sign-out here resolves to
 * THIS app's own /login route; there is no global mirror until a copied module
 * actually needs one (SC-01.3 decides that with its real callers).
 *
 * Session storage is namespaced via the clean supabase client (storageKey
 * "hala-clean-auth") — see src/lib/supabase.ts.
 */
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  region: string | null;
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

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

async function fetchAppUser(authId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, region, avatar, auth_id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) {
    // Honest failure: surface nothing rather than a fabricated profile.
    console.warn("[clean-auth] users profile lookup failed:", error.message);
    return null;
  }
  return (data as AppUser) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) setAppUser(await fetchAppUser(data.session.user.id));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (cancelled) return;
      setSession(next);
      setAppUser(next?.user ? await fetchAppUser(next.user.id) : null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthState["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // Stay inside the clean app. This app owns its origin root, so a plain
    // in-app path is sufficient — never the old application's login.
    window.location.assign("/login");
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, appUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
