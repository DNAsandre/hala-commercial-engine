/**
 * SC-01.1 — standalone application root.
 *
 * The clean app operates from its OWN root: routes are top-level (/login,
 * /dashboard, ...) with no /clean prefix and no wouter base — per sprint
 * SC-01.6 ("no route contains a dependency on /clean; the new app operates
 * from its own root").
 *
 * SC-01.1 ships the foundation only: the login route and an honest
 * foundation-status page behind the auth guard. The approved product surfaces
 * arrive in SC-01.2 (surface copy). The status page states this plainly —
 * rule 9: empty or unavailable functionality is shown honestly, never faked.
 */
import { Route, Switch, Redirect } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";

function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

/** Honest SC-01.1 landing: foundation is live, surfaces arrive in SC-01.2. */
function FoundationStatus() {
  const { appUser, signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <div>
            <h1 className="text-lg font-semibold">Standalone foundation is running</h1>
            <p className="text-xs text-muted-foreground">
              hala-clean-commercial-engine · SC-01.1
            </p>
          </div>
        </div>
        <ul className="mb-4 space-y-1.5 text-sm text-muted-foreground">
          <li>• Signed in as <span className="font-medium text-foreground">{appUser?.name ?? "…"}</span>{appUser?.role ? ` (${appUser.role})` : ""} under this app's own session namespace.</li>
          <li>• Own package, build, routing, environment and login — no old-app source or configuration involved.</li>
          <li>• Product surfaces (CRM, Customers, Workspaces, FinalStudio, System) are <span className="font-medium text-foreground">not yet migrated</span> — that is SC-01.2, pending inspection of this wave.</li>
        </ul>
        <button
          onClick={signOut}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Protected() {
  const { session, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  return <FoundationStatus />;
}

function PublicLogin() {
  const { session, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (session) return <Redirect to="/" />;
  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster />
      <Switch>
        <Route path="/login" component={PublicLogin} />
        <Route component={Protected} />
      </Switch>
    </AuthProvider>
  );
}
