/**
 * RequireRole — Role-based route guard component
 * 
 * Wraps page components to enforce role-based access control.
 * Checks the logged-in user's role from the Supabase `users` table
 * (via AuthContext) and redirects unauthorized users to /dashboard
 * with a "Not authorized" toast.
 * 
 * Usage:
 *   <RequireRole roles={["admin"]}>
 *     <AdminPanel />
 *   </RequireRole>
 * 
 *   // Or with component prop:
 *   <RequireRole roles={["admin", "manager"]} component={SomePage} />
 */

import React, { useEffect, useRef } from "react";
import { Redirect } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface RequireRoleProps {
  /** Allowed roles — user must have one of these roles to access */
  roles: string[];
  /** Component to render if authorized (alternative to children) */
  component?: React.ComponentType;
  /** Children to render if authorized */
  children?: React.ReactNode;
}

export default function RequireRole({ roles, component: Component, children }: RequireRoleProps) {
  const { appUser } = useAuth();
  const toastShown = useRef(false);

  const isAuthorized = appUser && roles.includes(appUser.role);

  useEffect(() => {
    if (!isAuthorized && !toastShown.current) {
      toastShown.current = true;
      toast.error("Not authorized", {
        description: `This page requires one of these roles: ${roles.join(", ")}`,
        duration: 4000,
      });
    }
  }, [isAuthorized, roles]);

  if (!isAuthorized) {
    return <Redirect to="/" />;
  }

  if (Component) return <Component />;
  return <>{children}</>;
}
