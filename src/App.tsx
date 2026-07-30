/**
 * SC-01.1 — standalone application root.
 *
 * The clean app operates from its OWN root: routes are top-level (/login,
 * /dashboard, ...) with no /clean prefix and no wouter base — per sprint
 * SC-01.6 ("no route contains a dependency on /clean; the new app operates
 * from its own root").
 *
 * SC-01 Wave 02 integration: the approved clean surface shell (CleanApp)
 * is mounted at the root behind the auth guard. Every product route lives
 * inside CleanApp; this file owns only auth gating and the login route.
 */
import { Route, Switch, Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import CleanApp from "@/CleanApp";

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

function Protected() {
  const { session, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!session) return <Redirect to="/login" />;
  return <CleanApp />;
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
