/**
 * Clean Renewals placeholder — AUTHORED, not copied.
 *
 * WHY THIS IS A PLACEHOLDER (Gap Identified — for Codex):
 * Brief §2 approves "Renewals Overview" and "Renewals Workspace" as clean
 * surfaces, but renewals data is disabled at four independent layers:
 *   1. lib/intake-save.ts:191-193   — createTicket early-returns for ticket_type "renewal"
 *   2. lib/process-isolation.ts:267 — filterAllowedOperationalTickets returns [] for renewal
 *   3. lib/process-isolation.ts:276 — isAllowedOperationalTicket returns false for renewal
 *   4. lib/renewal-engine.ts:169-175 — renewalWorkspaces / contractBaselines are empty literals
 *
 * The legacy pages/Renewals.tsx is itself a fail-closed isolation shell, and the
 * brief's denylist forbids copying fail-closed placeholder pages. So rather than
 * copy that shell OR drop two approved nav items, this states the isolation
 * honestly and sources the reason from the same helper the legacy shell used.
 *
 * NO-GATE: informational only. Blocks nothing.
 */

import { Link } from "wouter";
import { ShieldOff, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEmptyRenewalState } from "@/lib/process-isolation";
import { cleanHref } from "@clean/lib/clean-routing";

const ACTIVE_SURFACES = [
  { href: "/crm-pipeline", label: "CRM Pipeline" },
  { href: "/workspaces/tenders", label: "Tender Portfolio Overview" },
  { href: "/workspaces/proposals", label: "Proposal Portfolio Overview" },
];

export default function CleanRenewals() {
  const { reason } = getEmptyRenewalState();

  return (
    <div className="max-w-[900px]">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold font-serif">Renewals</h1>
        <Badge variant="outline" className="gap-1.5 text-xs">
          <ShieldOff className="h-3 w-3" />
          Isolation active
        </Badge>
      </div>

      <Card className="mb-6 border-amber-300 bg-amber-50/60">
        <CardContent className="p-5">
          <p className="text-sm text-amber-900">{reason}</p>
          <p className="mt-2 text-xs text-amber-800/80">
            Renewals are disabled at the write path, the read filter, and the data engine. This
            surface is present because it is an approved clean destination, but it has no data to
            show and will stay empty until renewals are re-enabled.
          </p>
        </CardContent>
      </Card>

      <div className="text-xs font-medium text-muted-foreground">Active surfaces</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {ACTIVE_SURFACES.map((s) => (
          <Link
            key={s.href}
            href={cleanHref(s.href)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-muted"
          >
            {s.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}
