/**
 * SC-01 W02-T03 clean-owned replacement — Advisory Escalation Register Panel.
 * The legacy export name is kept by contract. Escalation records come from the
 * workspace bundle via props; nothing is fabricated. With zero records the
 * panel renders an explicit, honest empty state (no counts, no banners).
 * Advisory display: never blocks any action.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert, AlertTriangle, Eye, Play, X, CheckCircle2, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  type CommercialMockEscalation, type EscalationSeverity,
} from "@/lib/commercial-workspace-data";
import { markEscalationReviewedMock, markEscalationBypassMock, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── HELPERS ───────────────────────────────────────────────

const sevBadge: Record<EscalationSeverity, string> = {
  Low: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  High: "text-red-600 bg-red-50 border-red-200",
  Critical: "text-red-700 bg-red-100 border-red-300 font-bold",
};

const sevDot: Record<EscalationSeverity, string> = {
  Low: "bg-emerald-500",
  Medium: "bg-amber-500",
  High: "bg-red-500",
  Critical: "bg-red-600",
};

const sourceBadge = (src: string) => {
  const map: Record<string, string> = {
    "Margin Authority": "bg-[#075eea]/10 text-[#075eea] border-[#075eea]/20",
    "Customer Score": "bg-blue-50 text-blue-700 border-blue-200",
    "Capacity Fit": "bg-orange-50 text-orange-700 border-orange-200",
    "Pricing Posture": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Revenue Realization": "bg-cyan-50 text-cyan-700 border-cyan-200",
    "P&L Confidence": "bg-[#075eea]/10 text-[#075eea] border-[#075eea]/20",
  };
  return map[src] || "bg-slate-50 text-slate-600 border-slate-200";
};

// ─── ESCALATION DETAIL MODAL ───────────────────────────────

function EscalationDetailModal({ esc, onClose, onMarkReviewed, onBypass }: {
  esc: CommercialMockEscalation;
  onClose: () => void;
  onMarkReviewed: (id: string) => void;
  onBypass: (id: string, name: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <Card className="w-full max-w-lg shadow-xl border-2 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-serif flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[var(--color-hala-navy)]" />
              Escalation Detail
            </CardTitle>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Header badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`text-[9px] ${sevBadge[esc.severity]}`}>{esc.severity}</Badge>
            <Badge variant="outline" className={`text-[9px] ${sourceBadge(esc.signalSource)}`}>{esc.signalSource}</Badge>
            <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200">{esc.status}</Badge>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Advisory</Badge>
          </div>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Escalation Code", value: esc.escalationCode },
              { label: "Signal Name", value: esc.signalName },
              { label: "Source", value: esc.signalSource },
              { label: "Severity", value: esc.severity },
              { label: "Status", value: esc.status },
              { label: "Owner", value: esc.owner },
              { label: "Runtime Mode", value: esc.runtimeMode },
              { label: "Created", value: esc.createdAt },
            ].map(f => (
              <div key={f.label} className="bg-muted/30 rounded p-1.5">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                <p className="font-medium mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Future roles */}
          {esc.futureRequiredRoles.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Future Required Roles</p>
              <div className="flex flex-wrap gap-1">
                {esc.futureRequiredRoles.map(r => (
                  <span key={r} className="text-[9px] px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">{r}</span>
                ))}
              </div>
            </div>
          )}

          {/* Trigger / Impact / Action */}
          {[
            { label: "Trigger Reason", value: esc.triggerReason, color: "border-red-200 bg-red-50/30" },
            { label: "Commercial Impact", value: esc.commercialImpact, color: "border-amber-200 bg-amber-50/30" },
            { label: "Recommended Action", value: esc.recommendedAction, color: "border-emerald-200 bg-emerald-50/30" },
          ].map(b => (
            <div key={b.label} className={`rounded-lg border p-2 ${b.color}`}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{b.label}</p>
              <p className="text-xs mt-0.5">{b.value}</p>
            </div>
          ))}

          {/* Linked controls */}
          {esc.linkedControls.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Linked Controls</p>
              <div className="flex flex-wrap gap-1">
                {esc.linkedControls.map(c => (
                  <span key={c} className="text-[9px] px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {esc.notes && (
            <div className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {esc.notes}</div>
          )}

          {/* Advisory note */}
          <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">
            <span className="font-medium">Advisory mode:</span> no approval workflow, CRM update, or notification is triggered. Client-facing progression remains a human decision.
          </div>

          {/* Modal actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-dashed">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => { onMarkReviewed(esc.id); onClose(); }}>
              <CheckCircle2 className="w-3 h-3" /> Mark Reviewed
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-blue-700 border-blue-200" onClick={() => { onBypass(esc.id, esc.signalName); onClose(); }}>
              <Play className="w-3 h-3" /> Continue with Advisory Override
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN PANEL ────────────────────────────────────────────

interface Props {
  scenarioId: string;
  /** Escalation records from the workspace bundle. Only real records are shown. */
  escalations?: CommercialMockEscalation[];
  /** Workspace ID for advisory write actions */
  workspaceId?: string;
  /** Callback after a write action completes (triggers data reload) */
  onActionComplete?: () => void;
}

export default function CommercialMockEscalationPanel({ scenarioId, escalations: escalationsProp, workspaceId, onActionComplete }: Props) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? "Unknown User", role: appUser?.role ?? "Unassigned" };

  void scenarioId;
  const escalations = escalationsProp ?? [];
  const summary = {
    total: escalations.length,
    critical: escalations.filter(e => e.severity === "Critical").length,
    high: escalations.filter(e => e.severity === "High").length,
    medium: escalations.filter(e => e.severity === "Medium").length,
    flagged: escalations.filter(e => e.mockEscalationCreated).length,
    bypassAvailable: escalations.filter(e => e.allowTestBypass).length,
    hasRed: escalations.some(e => e.severity === "Critical" || e.severity === "High"),
  };
  const [expanded, setExpanded] = useState(true);
  const [selectedEsc, setSelectedEsc] = useState<CommercialMockEscalation | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const markReviewed = async (id: string) => {
    if (!workspaceId) {
      toast.error("Escalation review: no workspace context — nothing was recorded.");
      return;
    }
    const esc = escalations.find(e => e.id === id);
    const result = await markEscalationReviewedMock(id, workspaceId, esc?.signalName ?? id, actor);
    if (result.success) {
      setReviewedIds(prev => new Set(prev).add(id));
      toast.success("Escalation review recorded. No production approval triggered.");
      onActionComplete?.();
    } else {
      toast.error(`Advisory action could not be recorded: ${result.error}`);
    }
  };

  const handleBypass = async (id: string, name: string) => {
    if (!workspaceId) {
      toast.error("Advisory override: no workspace context — nothing was recorded.");
      return;
    }
    const result = await markEscalationBypassMock(id, workspaceId, name, actor);
    if (result.success) {
      toast.success("Advisory override recorded. No production approval triggered.");
      onActionComplete?.();
    } else {
      toast.error(`Advisory action could not be recorded: ${result.error}`);
    }
  };

  // Honest empty state — exclusive of counts, banners, and register rows.
  if (escalations.length === 0) {
    return (
      <Card className="border shadow-none">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--color-hala-navy)]" /> Advisory Escalations
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <p className="text-sm text-muted-foreground">
            No escalation records exist for this scenario.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`border shadow-none ${summary.hasRed ? "border-l-4 border-l-red-400" : "border-l-4 border-l-amber-400"}`}>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 hover:text-[var(--color-hala-navy)] transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <CardTitle className="text-sm font-serif flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[var(--color-hala-navy)]" /> Advisory Escalations
              </CardTitle>
            </button>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px]">{summary.total} signal{summary.total !== 1 ? "s" : ""}</Badge>
              {summary.critical > 0 && <Badge variant="outline" className="text-[9px] text-red-700 bg-red-100 border-red-300 font-bold">{summary.critical} Critical</Badge>}
              {summary.high > 0 && <Badge variant="outline" className="text-[9px] text-red-600 bg-red-50 border-red-200">{summary.high} High</Badge>}
              {summary.medium > 0 && <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">{summary.medium} Amber</Badge>}
              <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Advisory</Badge>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-3 space-y-3">
            {/* Red/Amber banner */}
            {summary.hasRed ? (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-800">
                    {summary.critical > 0
                      ? "Critical commercial posture: executive review is recommended before client-facing progression. Advisory only."
                      : "Red signal detected. Advisory review is recommended before client-facing progression."}
                  </p>
                  <p className="text-[10px] text-red-700 mt-0.5">
                    {summary.critical} critical · {summary.high} high · {summary.flagged} advisory escalation{summary.flagged !== 1 ? "s" : ""} flagged · Advisory override available
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">
                    Amber review: Commercial/Ops review may be warranted. Advisory only.
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5">
                    {summary.medium} amber review{summary.medium !== 1 ? "s" : ""} · No red signal present
                  </p>
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {[
                { label: "Total Signals", value: summary.total, color: "" },
                { label: "Critical", value: summary.critical, color: summary.critical > 0 ? "text-red-700 font-bold" : "" },
                { label: "High", value: summary.high, color: summary.high > 0 ? "text-red-600" : "" },
                { label: "Amber", value: summary.medium, color: summary.medium > 0 ? "text-amber-700" : "" },
                { label: "Advisory Flagged", value: summary.flagged, color: "" },
                { label: "Override Available", value: summary.bypassAvailable, color: "text-blue-700" },
              ].map(m => (
                <div key={m.label} className="bg-muted/30 rounded-lg p-1.5 text-center">
                  <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Advisory copy */}
            <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">
              <span className="font-medium">Advisory mode:</span> red signals flag advisory escalations only. No approval, notification, CRM update, or workflow is triggered.
            </div>

            {/* Escalation register */}
            <div className="space-y-2">
              {escalations.map(esc => {
                const isReviewed = reviewedIds.has(esc.id);
                return (
                  <div
                    key={esc.id}
                    className={`rounded-lg border p-2.5 flex items-start gap-2 transition-all ${
                      isReviewed ? "bg-emerald-50/30 border-emerald-200" :
                      esc.severity === "Critical" ? "bg-red-50/30 border-red-200" :
                      esc.severity === "High" ? "bg-red-50/20 border-red-200" :
                      "bg-amber-50/20 border-amber-200"
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${isReviewed ? "bg-emerald-500" : sevDot[esc.severity]} shrink-0 mt-1`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold truncate">{esc.signalName}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[8px] ${isReviewed ? "text-emerald-700 bg-emerald-50 border-emerald-200" : sevBadge[esc.severity]}`}>{isReviewed ? "Reviewed" : esc.severity}</Badge>
                          <Badge variant="outline" className={`text-[8px] ${sourceBadge(esc.signalSource)}`}>{esc.signalSource}</Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{esc.triggerReason}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] text-muted-foreground">Owner: <strong>{esc.owner}</strong></span>
                        <span className="text-[9px] text-muted-foreground">· Action: {esc.recommendedAction}</span>
                      </div>
                      {/* Row actions */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 px-2" onClick={() => setSelectedEsc(esc)}>
                          <Eye className="w-3 h-3" /> Review
                        </Button>
                        {!isReviewed && (
                          <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 px-2" onClick={() => markReviewed(esc.id)}>
                            <CheckCircle2 className="w-3 h-3" /> Mark Reviewed
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="text-[10px] h-6 gap-1 px-2 text-blue-700 border-blue-200" onClick={() => handleBypass(esc.id, esc.signalName)}>
                          <Play className="w-3 h-3" /> Continue
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detail modal */}
      {selectedEsc && (
        <EscalationDetailModal
          esc={selectedEsc}
          onClose={() => setSelectedEsc(null)}
          onMarkReviewed={markReviewed}
          onBypass={handleBypass}
        />
      )}
    </>
  );
}
