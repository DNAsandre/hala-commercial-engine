/**
 * SC-01.1 — clean login route.
 *
 * AUTHORED for the standalone app. Signs into the shared Supabase auth service
 * (accepted external service) but stores the session under this app's own
 * namespaced key, so the clean session is independent of the old app's.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      // Honest failure — show the real reason, fabricate nothing.
      setError(error);
      return;
    }
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-[var(--color-hala-navy,#1B2A4A)]">
            <span className="font-serif text-lg font-bold text-white">H</span>
          </div>
          <h1 className="text-xl font-semibold">Hala Commercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">Clean application — sign in to your account</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="you@halascs.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-hala-navy,#1B2A4A)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            Team accounts are pre-configured by your administrator.
          </p>
        </form>
      </div>
    </div>
  );
}
