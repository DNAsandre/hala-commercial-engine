/**
 * CleanRequireRole — access guard for the clean app's System section.
 *
 * Authored (not copied) because the existing RequireRole has two defects that
 * would misbehave in the clean shell:
 *   1. It does not wait for auth to load, so it flashes a 403 card AND fires a
 *      spurious error toast on every admin page load while appUser is null.
 *   2. Its 403 card hardcodes <Link href="/"> which escapes the clean surface.
 *
 * THIS IS ACCESS CONTROL, NOT WORKFLOW GATING. It restricts who may open admin
 * pages. It must never be used to block a tender/proposal from progressing.
 */

import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cleanHref } from "./lib/clean-routing";

export default function CleanRequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: React.ReactNode;
}) {
  const { appUser, loading } = useAuth();

  // Wait for the session before judging authorisation — avoids the 403 flash.
  if (loading || !appUser) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (!roles.includes(appUser.role)) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <h2 className="mb-1 text-base font-semibold">Access restricted</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This page requires the {roles.join(" or ")} role. You are signed in as{" "}
            <span className="font-medium">{appUser.role}</span>.
          </p>
          {/* Root-mounted app (SC-01.6): cleanHref normalizes to /dashboard, stays in the clean surface. */}
          <Link
            href={cleanHref("/dashboard")}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
