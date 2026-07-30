/**
 * SC-01 W02-T03 clean-owned replacement — Revenue Realization Timing Panel.
 * Renders revenue-timing data supplied by the workspace bundle (props only;
 * no own transport). Advisory display: never blocks any action.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Eye, Play, Clock } from "lucide-react";
import { toast } from "sonner";
import { logMockAction, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── TYPES ─────────────────────────────────────────────────

type BudgetImpactTiming = "This Month" | "This Quarter" | "Next Quarter" | "Next Year" | "Unknown";
type RealizationConfidence = "Low" | "Medium" | "High" | "Mock Reviewed";

interface TimelineStage {
  stage: string;
  date: string;
  status: "done" | "current" | "upcoming" | "at_risk";
}

export interface CommercialRevenueRealization {
  scenarioId: string;
  budgetImpactTiming: BudgetImpactTiming;
  realizationConfidence: RealizationConfidence;
  timeline: TimelineStage[];
  delayRisks: string[];
  accelerationOpportunities: string[];
  owner: string;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  notes: string;
}

// ─── HELPERS ───────────────────────────────────────────────

const impactColors: Record<BudgetImpactTiming, string> = {
  "This Month": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "This Quarter": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Next Quarter": "text-amber-700 bg-amber-50 border-amber-200",
  "Next Year": "text-red-600 bg-red-50 border-red-200",
  Unknown: "text-slate-600 bg-slate-50 border-slate-200",
};

const confColors: Record<RealizationConfidence, string> = {
  Low: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  High: "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Mock Reviewed": "text-emerald-700 bg-emerald-50 border-emerald-200",
};

const stageColors = {
  done: "bg-emerald-500",
  current: "bg-blue-500",
  upcoming: "bg-muted",
  at_risk: "bg-red-500",
};
const stageText = {
  done: "text-emerald-700",
  current: "text-blue-700 font-semibold",
  upcoming: "text-muted-foreground",
  at_risk: "text-red-700",
};

// ─── MAIN PANEL ────────────────────────────────────────────

export default function CommercialRevenueRealizationPanel({ r, workspaceId, onActionComplete }: { r: CommercialRevenueRealization; workspaceId?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? "Unknown User", role: appUser?.role ?? "Unassigned" };
  const mkAction = async (eventType: string, title: string, desc: string, code: string, after: string) => {
    if (!workspaceId) { toast.error(`${title}: no workspace context — nothing was recorded.`); return; }
    const result = await logMockAction(
      { workspaceId, eventType, title, description: desc, category: "Revenue Timing", actor, severity: "Info", relatedModule: "Revenue Realization", relatedScenarioId: r.scenarioId },
      { workspaceId, eventCode: code, eventName: title, description: desc, category: "REVENUE_TIMING", actor, entityType: "Revenue Realization", entityName: r.budgetImpactTiming, beforeState: r.realizationConfidence, afterState: after, severity: "Info" }
    );
    if (result.success) { toast.success(`${title} recorded.`); onActionComplete?.(); }
    else { toast.error(`Advisory action could not be recorded: ${result.error}`); }
  };
  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[var(--color-hala-navy)]" /> Revenue Realization
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[9px] font-bold ${impactColors[r.budgetImpactTiming]}`}>{r.budgetImpactTiming}</Badge>
            <Badge variant="outline" className={`text-[9px] font-bold ${confColors[r.realizationConfidence]}`}>{r.realizationConfidence}</Badge>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Advisory</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Doctrine callout */}
        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span><strong>Deal close is not revenue.</strong> Revenue depends on contract, onboarding, stock movement, and billing.</span>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Budget Impact", value: r.budgetImpactTiming },
            { label: "Confidence", value: r.realizationConfidence },
            { label: "Owner", value: r.owner || "Not assigned" },
          ].map(m => (
            <div key={m.label} className="bg-muted/30 rounded-lg p-1.5 text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className="text-[10px] font-bold mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Revenue Timeline</p>
          {r.timeline.length > 0 ? (
            <div className="space-y-0">
              {r.timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${stageColors[t.status]} shrink-0 mt-0.5`} />
                    {i < r.timeline.length - 1 && <div className="w-px h-4 bg-muted" />}
                  </div>
                  <div className="flex items-center gap-2 pb-1">
                    <span className={`text-[10px] ${stageText[t.status]}`}>{t.stage}</span>
                    <span className="text-[9px] text-muted-foreground">{t.date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No timeline stages recorded.</p>
          )}
        </div>

        {/* Risk + Acceleration */}
        {(r.delayRisks.length > 0 || r.accelerationOpportunities.length > 0) && (
          <div className="grid grid-cols-2 gap-2">
            {r.delayRisks.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/30 p-2 space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-red-700">Delay Risks</p>
                <ul className="text-[10px] text-red-800 space-y-0.5 list-disc pl-3">
                  {r.delayRisks.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {r.accelerationOpportunities.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2 space-y-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">Acceleration</p>
                <ul className="text-[10px] text-emerald-800 space-y-0.5 list-disc pl-3">
                  {r.accelerationOpportunities.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Advisory note */}
        <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">
          <span className="font-medium">Advisory signal:</span> revenue timing guides quote review. It does not enforce decisions or sync with CRM/Finance.
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction("revenue_timing_reviewed_mock", "Revenue timing reviewed", `Revenue timing (${r.budgetImpactTiming}) reviewed. No enforcement.`, "REVENUE_TIMING_REVIEWED_MOCK", "Reviewed")}>
            <Eye className="w-3 h-3" /> Mark Timing Reviewed
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-blue-700 border-blue-200" onClick={() => mkAction("revenue_timing_bypass_mock", "Revenue timing advisory acknowledged", "Continue — revenue timing signal acknowledged; no enforcement exists.", "REVENUE_TIMING_BYPASS_MOCK", "Acknowledged")}>
            <Play className="w-3 h-3" /> Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
