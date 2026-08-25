/**
 * Clean Dashboard — AUTHORED, not copied.
 *
 * The legacy Dashboard.tsx is a 4-tab shell where 3 of 4 tabs are empty
 * isolation placeholders and the page fetches zero data. Copying it would have
 * imported three dead tabs.
 *
 * DELIBERATELY NOT SHOWING derived process health (tender/proposal readiness,
 * risk scoring, lifecycle state). lib/process-isolation.ts forbids
 * dashboard-derived process state and enforces it via FORBIDDEN_PROCESS_SOURCES
 * / isForbiddenProcessSource(). Navigation + honest status only.
 */

import { Link } from "wouter";
import type { ElementType } from "react";
import {
  GitBranch, Users, Briefcase, FolderOpen, FileOutput, ShieldOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { isDashboardProcessFeedEnabled, getDashboardProcessIsolationReason } from "@/lib/process-isolation";
import { cleanHref } from "@clean/lib/clean-routing";

type Surface = { href: string; label: string; desc: string; icon: ElementType };

const SURFACES: Surface[] = [
  { href: "/crm-pipeline", label: "CRM Pipeline", desc: "Kanban across the 10 CRM stages", icon: GitBranch },
  { href: "/customers", label: "Customer Command Center", desc: "Portfolio grid across all customers", icon: Users },
  { href: "/workspaces/tenders", label: "Tender Portfolio Overview", desc: "All tenders and their 15-stage progress", icon: Briefcase },
  { href: "/workspaces/proposals", label: "Proposal Portfolio Overview", desc: "All proposals in the sell cycle", icon: FolderOpen },
  { href: "/pdf-studio", label: "Final Pack Studio", desc: "FinalPack document composition and export", icon: FileOutput },
];

export default function CleanDashboard() {
  const { appUser } = useAuth();
  const feedsEnabled = isDashboardProcessFeedEnabled();

  return (
    <div className="max-w-[1400px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif">Commercial Command</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {appUser?.name ? `Welcome, ${appUser.name}. ` : ""}
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {!feedsEnabled && (
          <Badge variant="outline" className="gap-1.5 text-xs">
            <ShieldOff className="h-3 w-3" />
            Process isolation active
          </Badge>
        )}
      </div>

      {!feedsEnabled && (
        <Card className="mb-6 border-amber-300 bg-amber-50/60">
          <CardContent className="p-4">
            <p className="text-sm text-amber-900">{getDashboardProcessIsolationReason()}</p>
            <p className="mt-1 text-xs text-amber-800/80">
              Roll-up metrics are intentionally withheld here. Open a workspace to see live stage data.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={cleanHref(href)}>
            <Card className="h-full cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/40">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
