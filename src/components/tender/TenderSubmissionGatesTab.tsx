/**
 * TenderSubmissionGatesTab.tsx — TCW-T5 (Tender Functional Closure Wave).
 *
 * LEFT-BEHIND REGISTER ENTRY: this surface is NOT ROUTED anywhere. TCW-T2
 * removed its only (already-unreachable) route from TenderWorkspace.tsx with
 * orphan proof; re-routing was ruled outside P6's reachability additions.
 * The file is kept honest for the record pending an integration ruling on
 * retirement — do not treat anything rendered here as live product surface.
 *
 * Honesty corrections applied while it stands (B19):
 *   - the "(Live from Supabase)" heading and the "✓ All Clear" green verdict
 *     are gone — this component receives a workspace projection and performs
 *     no read of its own, so it must not claim live-read authority or issue
 *     an overall verdict;
 *   - counts derive from the P1 submission-readiness register projections on
 *     the workspace (placeholders / required documents / compliance items);
 *     when the register carries no rows the row states "Not assessed" instead
 *     of implying a passing check;
 *   - the pack-derived rows are gone — the clean bundle loads no packs, so
 *     those totals were structurally always 0/0, rendered as amber "warnings"
 *     about data that was never recorded.
 *
 * Doctrine unchanged: no gates, no locks, no enforcement. Advisory only.
 */
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Construction, FileText, Info, MinusCircle, ShieldCheck } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";

// ─── SUMMARY ROW ────────────────────────────────────────────────

type ReadinessRowStatus = "ok" | "warn" | "gap" | "not_assessed";

function ReadinessRow({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: ReadinessRowStatus;
}) {
  const styles: Record<ReadinessRowStatus, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
    ok: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", Icon: CheckCircle2 },
    warn: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", Icon: AlertTriangle },
    gap: { color: "text-red-700", bg: "bg-red-50 border-red-200", Icon: AlertTriangle },
    not_assessed: { color: "text-slate-600", bg: "bg-slate-50 border-slate-200", Icon: MinusCircle },
  };
  const { color, bg, Icon } = styles[status];

  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className={`font-mono text-xs font-bold ${color}`}>{detail}</span>
    </div>
  );
}

/**
 * Pure derivation from the register projections: a section with no recorded
 * rows is NOT ASSESSED (never "ok"); with rows, a gap is an explicitly
 * recorded problem. Exported for tests.
 */
export function deriveGatesTabRows(ws: Pick<TenderWorkspace, "placeholders" | "requiredDocuments" | "complianceItems">): Array<{
  label: string;
  detail: string;
  status: ReadinessRowStatus;
}> {
  const compliance = ws.complianceItems ?? [];
  const complianceGaps = compliance.filter((c) => c.status === "non_compliant").length;
  const complianceConcluded = compliance.filter((c) => c.status === "compliant").length;

  const requiredDocs = ws.requiredDocuments ?? [];
  const docsSatisfied = requiredDocs.filter((d) => ["ready", "approved", "signed", "stamped"].includes(d.status)).length;
  const docsAwaiting = requiredDocs.filter((d) => d.status === "awaiting").length;

  const placeholders = ws.placeholders ?? [];
  const placeholdersApproved = placeholders.filter((p) => p.status === "approved").length;
  const placeholdersMissing = placeholders.filter((p) => p.status === "missing").length;

  return [
    {
      label: "Compliance Items",
      detail: compliance.length === 0 ? "Not assessed" : `${complianceConcluded} / ${compliance.length} compliant`,
      status: compliance.length === 0 ? "not_assessed" : complianceGaps > 0 ? "gap" : complianceConcluded === compliance.length ? "ok" : "warn",
    },
    {
      label: "Required Documents",
      detail: requiredDocs.length === 0 ? "Not assessed" : `${docsSatisfied} / ${requiredDocs.length} satisfied`,
      status: requiredDocs.length === 0 ? "not_assessed" : docsAwaiting > 0 ? "warn" : docsSatisfied === requiredDocs.length ? "ok" : "warn",
    },
    {
      label: "Placeholders",
      detail: placeholders.length === 0 ? "Not assessed" : `${placeholdersApproved} / ${placeholders.length} approved`,
      status: placeholders.length === 0 ? "not_assessed" : placeholdersMissing > 0 ? "gap" : placeholdersApproved === placeholders.length ? "ok" : "warn",
    },
  ];
}

export default function TenderSubmissionGatesTab({
  ws,
}: {
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
}) {
  const rows = deriveGatesTabRows(ws);

  return (
    <div className="space-y-5">
      {/* Unrouted / no-enforcement banner */}
      <div className="flex items-start gap-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
        <Construction className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Submission gates are not active — and this panel is not routed</p>
          <p className="mt-1 text-xs text-amber-700">
            No gate enforcement, locking rule, or mandatory approval check exists anywhere in this build.
            This panel itself is currently unreachable from the workspace (left-behind register entry);
            it is kept honest pending an integration ruling. Everything below is advisory.
          </p>
        </div>
      </div>

      {/* Register-derived readiness signals — no overall verdict */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Readiness signals from the submission-readiness register
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <ReadinessRow key={row.label} label={row.label} detail={row.detail} status={row.status} />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          "Not assessed" means no rows are recorded in that register section for this tender — it is not a pass.
        </p>
      </div>

      {/* Documents reference (register-backed) */}
      {ws.documents && ws.documents.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Uploaded Documents ({ws.documents.length})
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Document</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ws.documents.slice(0, 10).map((doc) => (
                  <tr key={doc.id} className="border-t border-border hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-3 py-2 font-medium">{doc.document_name}</td>
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:bg-slate-900/20">
        <p className="flex items-start gap-2 text-[10px] text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          If a future sprint activates configurable submission gates, they would be designed here.
          Nothing is configured, evaluated, or enforced today.
        </p>
      </div>
    </div>
  );
}
