/**
 * TenderSubmissionGatesTab.tsx
 * ─────────────────────────────
 * Submission Readiness — Informational Panel
 *
 * Gates & submission locks are deferred to the Hardening Phase.
 * For now this tab shows real compliance + document readiness
 * derived from Supabase data, with a clear label that gate
 * enforcement will be configured here in a future sprint.
 *
 * Doctrine: No blocking. No locks. No enforcement. Advisory only.
 * ⚠️ HARDENING PHASE REMINDER: Wire real submission gates here.
 */
import { Badge } from "@/components/ui/badge";
import { Construction, CheckCircle2, AlertTriangle, FileText, ShieldCheck, Info } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";

// ─── SUMMARY ROW ────────────────────────────────────────────────
function ReadinessRow({
  label,
  value,
  total,
  status,
}: {
  label: string;
  value: number;
  total: number;
  status: "ok" | "warn" | "gap";
}) {
  const color =
    status === "ok" ? "text-emerald-700" : status === "warn" ? "text-amber-700" : "text-red-700";
  const bg =
    status === "ok" ? "bg-emerald-50 border-emerald-200" : status === "warn" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
  const Icon = status === "ok" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={`text-xs font-bold font-mono ${color}`}>
        {total > 0 ? `${value} / ${total}` : value === 0 ? "None" : String(value)}
      </span>
    </div>
  );
}

export default function TenderSubmissionGatesTab({
  ws,
}: {
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
}) {
  // Derive real readiness signals from Supabase-backed data
  const complianceTotal = ws.complianceItems.length;
  const complianceCompliant = ws.complianceItems.filter(c => c.status === "compliant").length;
  const complianceGaps = ws.complianceItems.filter(
    c => c.status === "non_compliant" || c.status === "clarification_required"
  ).length;
  const compliancePartial = ws.complianceItems.filter(c => c.status === "partial").length;

  const docsTotal = ws.packs.reduce((s, p) => s + p.documentsTotal, 0);
  const docsReady = ws.packs.reduce((s, p) => s + p.documentsReady, 0);

  const placeholdersTotal = ws.packs.reduce((s, p) => s + p.placeholdersTotal, 0);
  const placeholdersFilled = ws.packs.reduce((s, p) => s + p.placeholdersPopulated, 0);
  const placeholdersMissing = placeholdersTotal - placeholdersFilled;

  const drafting = (ws.tender as any).tenderDraftingData ?? {};
  const blocks: any[] = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
  const blocksApproved = blocks.filter((b: any) => b.approval_status === "Approved").length;

  const overallOk = complianceGaps === 0 && docsTotal > 0 && docsReady === docsTotal && placeholdersMissing === 0;

  return (
    <div className="space-y-5">
      {/* Hardening Phase Reminder Banner */}
      <div className="p-4 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3">
        <Construction className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            ⚠️ Hardening Phase — Submission Gates Not Yet Active
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Submission gate enforcement, locking rules, and mandatory approval checks are deferred
            to the Hardening &amp; Testing phase. This tab currently shows readiness signals
            only — all advisory, nothing blocks.
          </p>
          <p className="text-[10px] text-amber-600 mt-2 font-mono">
            TODO (Hardening): Define gate rules → wire enforcement → test with real submission cycle.
          </p>
        </div>
      </div>

      {/* Real Readiness Data from Supabase */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Readiness Signals (Live from Supabase)
          </span>
          {overallOk && (
            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
              ✓ All Clear
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <ReadinessRow
            label="Compliance Matrix"
            value={complianceCompliant}
            total={complianceTotal}
            status={complianceGaps > 0 ? "gap" : compliancePartial > 0 ? "warn" : "ok"}
          />
          <ReadinessRow
            label="Required Documents Ready"
            value={docsReady}
            total={docsTotal}
            status={docsTotal === 0 ? "warn" : docsReady < docsTotal ? "warn" : "ok"}
          />
          <ReadinessRow
            label="Placeholders Populated"
            value={placeholdersFilled}
            total={placeholdersTotal}
            status={placeholdersMissing > 3 ? "gap" : placeholdersMissing > 0 ? "warn" : "ok"}
          />
          {blocks.length > 0 && (
            <ReadinessRow
              label="Proposal Blocks Approved"
              value={blocksApproved}
              total={blocks.length}
              status={blocksApproved < blocks.length ? "warn" : "ok"}
            />
          )}
        </div>
      </div>

      {/* What will go here */}
      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900/20">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600">What goes here in the Hardening Phase:</p>
            <ul className="text-[10px] text-slate-500 space-y-0.5 list-disc list-inside">
              <li>Configurable gate rules per tender type</li>
              <li>Mandatory sign-off checklist before submission</li>
              <li>Advisory escalation for non-compliant items</li>
              <li>Final submission readiness score with pass/warn thresholds</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Document status reference */}
      {ws.documents && ws.documents.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Documents ({ws.documents.length})
            </span>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Document</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ws.documents.slice(0, 10).map(doc => (
                  <tr key={doc.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium max-w-[240px] truncate">{doc.document_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.document_category}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[9px]">{doc.status}</Badge>
                    </td>
                  </tr>
                ))}
                {ws.documents.length > 10 && (
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-2 text-center text-[10px] text-muted-foreground">
                      + {ws.documents.length - 10} more documents — view in Document Library
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
