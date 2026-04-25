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
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

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
      toast.error("Access Denied", {
        description: `This section requires one of these clearances: ${roles.join(", ")}`,
        duration: 5000,
      });
    }
  }, [isAuthorized, roles]);

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] p-6">
        <Card className="w-full max-w-md border-destructive/20 shadow-lg">
          <CardContent className="pt-10 pb-8 px-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">403 Access Denied</h2>
            <p className="text-sm text-muted-foreground mb-8">
              This administrative quadrant is restricted to users with <strong className="text-foreground">{roles.join(" or ")}</strong> clearance. Your current active role is <strong className="text-foreground">{appUser?.role || "guest"}</strong>.
            </p>
            <Link href="/">
              <Button variant="default" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (Component) return <Component />;
  return <>{children}</>;
}
