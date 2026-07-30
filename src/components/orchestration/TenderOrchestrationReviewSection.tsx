/**
 * TenderOrchestrationReviewSection.tsx
 * ────────────────────────────────────
 * Sprint 2.6 — Non-disruptive mount of the orchestration review surface inside
 * the tender workspace.
 *
 * - Collapsible card labelled "AI Orchestration Review", scoped to ONE tenderId.
 * - Review-only: it mounts ConnectedOrchestrationReviewPanel (Accept / Edit /
 *   Reject / Defer). It does NOT write canonical fields, does NOT change tender
 *   stage or CRM, does NOT touch the document output layer, and adds NO
 *   apply / submit / export / approve action.
 * - Lazy by construction: the connected panel (and its service/supabase import)
 *   only mounts when the section is expanded, so opening a tender fetches nothing.
 * - Never blocks tender work; collapsing/ignoring it leaves the workspace intact.
 */

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectedOrchestrationReviewPanel } from "./OrchestrationReviewPanel";

interface Props {
  tenderId: string;
  reviewerName?: string;
}

export default function TenderOrchestrationReviewSection({ tenderId, reviewerName }: Props) {
  const [open, setOpen] = useState(false);
  // Counts are filled in after the first expand (no pre-fetch on tender open).
  const [counts, setCounts] = useState<{ total: number; pending: number } | null>(null);

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="px-4 py-2.5 border-b border-border bg-muted/20">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-foreground">AI Orchestration Review</span>
          {counts && (
            <>
              <Badge variant="outline" className="text-[9px]">{counts.total} total</Badge>
              {counts.pending > 0 && (
                <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-700 bg-slate-50">{counts.pending} pending</Badge>
              )}
            </>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground">{open ? "Hide" : "Show"}</span>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
            <p>AI suggestion — human review required before official tender update.</p>
            <p>Reviewing suggestions is optional and never blocks tender work.</p>
            <p>Accepted or edited suggestions are not applied to tender fields in this screen.</p>
          </div>
          <ConnectedOrchestrationReviewPanel tenderId={tenderId} reviewerName={reviewerName} onLoaded={setCounts} />
        </CardContent>
      )}
    </Card>
  );
}
