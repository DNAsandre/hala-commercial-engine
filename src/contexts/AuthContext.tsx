/**
 * SC-01.1 — clean-owned authentication context.
 *
 * AUTHORED for the standalone app (not copied). The old AuthContext:
 *  - navigated to the old app's /login via window.location on sign-out, and
 *  - mirrored the profile into an old-app module-global store (auth-state.ts).
 * Neither behaviour belongs in the clean boundary. Sign-out here resolves to
 * THIS app's own /login route. The small auth-state mirror is updated only for
 * clean-owned non-React data services that must record the signed-in actor.
 *
 * Session storage is namespaced via the clean supabase client (storageKey
 * "hala-clean-auth") — see src/lib/supabase.ts.
 */
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearGlobalAuthUser, setGlobalAuthUser } from "@/lib/auth-state";

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
    let profileRequest = 0;
    const deferredLoads = new Set<ReturnType<typeof setTimeout>>();

    const applyProfile = (profile: AppUser | null) => {
      setAppUser(profile);
      if (profile) {
        setGlobalAuthUser({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          region: profile.region ?? "",
        });
      } else {
        clearGlobalAuthUser();
      }
    };

    const loadProfile = async (authId: string, request: number) => {
      const profile = await fetchAppUser(authId);
      if (!cancelled && request === profileRequest) applyProfile(profile);
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      const request = ++profileRequest;
      if (data.session?.user) {
        await loadProfile(data.session.user.id, request);
      } else {
        applyProfile(null);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return;
      setSession(next);
      const request = ++profileRequest;
      if (!next?.user) {
        applyProfile(null);
        return;
      }

      // Supabase can deadlock every later API call when its auth callback
      // awaits another Supabase request. Run the profile read after the auth
      // callback has returned instead.
      const timer = setTimeout(() => {
        deferredLoads.delete(timer);
        void loadProfile(next.user.id, request);
      }, 0);
      deferredLoads.add(timer);
    });

    return () => {
      cancelled = true;
      profileRequest += 1;
      for (const timer of deferredLoads) clearTimeout(timer);
      deferredLoads.clear();
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
