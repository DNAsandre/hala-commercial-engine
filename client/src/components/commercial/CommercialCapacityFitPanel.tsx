/**
 * CW-005: Capacity Fit + Warehouse Constraint Panel
 * Mock-only — no real WMS/LFS integration, no capacity engine.
 * SUPA-004: Actions now write to Supabase.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gauge, AlertTriangle, Eye, Play, ShieldAlert, Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { logMockAction, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── TYPES ─────────────────────────────────────────────────

export type CapacityFitStatus = "Strong Fit" | "Acceptable Fit" | "Constrained" | "High Risk" | "Mock Escalated";
export type CapacityRiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface WarehouseConstraint {
  label: string;
  value: string;
  status: "ok" | "warning" | "risk";
}

export interface CommercialCapacityFit {
  scenarioId: string;
  workspaceId: string;
  customerName: string;
  requiredPalletPositions: number;
  availablePalletPositions: number;
  effectiveRequiredPositions: number;
  utilizationBefore: number;
  utilizationAfter: number;
  utilizationTarget: number;
  capacityFitScore: number;
  capacityFitStatus: CapacityFitStatus;
  riskLevel: CapacityRiskLevel;
  constraints: WarehouseConstraint[];
  riskReasons: string[];
  positiveReasons: string[];
  promiseGaps: string[];
  opsOwner: string;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

// ─── HELPERS ───────────────────────────────────────────────

const statusColors: Record<CapacityFitStatus, { bg: string; text: string; border: string }> = {
  "Strong Fit": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Acceptable Fit": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Constrained": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "High Risk": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "Mock Escalated": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function scoreColor(s: number): string {
  if (s >= 70) return "text-emerald-600";
  if (s >= 55) return "text-amber-600";
  return "text-red-600";
}
function barColor(s: number): string {
  if (s >= 70) return "bg-emerald-500";
  if (s >= 55) return "bg-amber-500";
  return "bg-red-500";
}
function utilColor(u: number, target: number): string {
  if (u <= target - 5) return "text-emerald-600";
  if (u <= target + 3) return "text-amber-600";
  return "text-red-600";
}
function utilBar(u: number, target: number): string {
  if (u <= target - 5) return "bg-emerald-500";
  if (u <= target + 3) return "bg-amber-500";
  return "bg-red-500";
}

const constraintStatusColors = {
  ok: "border-emerald-200 bg-emerald-50/30 text-emerald-800",
  warning: "border-amber-200 bg-amber-50/30 text-amber-800",
  risk: "border-red-200 bg-red-50/30 text-red-800",
};

// ─── MAIN PANEL ────────────────────────────────────────────

export default function CommercialCapacityFitPanel({ cap, workspaceId, onActionComplete }: { cap: CommercialCapacityFit; workspaceId?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };
  const mkAction = async (eventType: string, title: string, desc: string, code: string, after: string) => {
    if (!workspaceId) { toast.info(`${title}. No backend update.`); return; }
    const result = await logMockAction(
      { workspaceId, eventType, title, description: desc, category: 'Capacity', actor, severity: 'Info', relatedArtifact: cap.customerName, relatedModule: 'Capacity Fit' },
      { workspaceId, eventCode: code, eventName: title, description: desc, category: 'CAPACITY', actor, entityType: 'Capacity Fit', entityName: cap.customerName, beforeState: cap.capacityFitStatus, afterState: after, severity: 'Info' }
    );
    if (result.success) { toast.success(`${title} saved to Supabase.`); onActionComplete?.(); }
    else { toast.error(`Mock action could not be saved: ${result.error}`); }
  };
  const sc = statusColors[cap.capacityFitStatus];
  const isRed = cap.riskLevel === "High" || cap.riskLevel === "Critical";

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[var(--color-hala-navy)]" /> Capacity Fit
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[9px] font-bold ${sc.text} ${sc.bg} ${sc.border}`}>{cap.capacityFitStatus}</Badge>
            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Mock</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Summary metrics */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: "Score", value: `${cap.capacityFitScore}`, color: scoreColor(cap.capacityFitScore) },
            { label: "Required", value: `${cap.requiredPalletPositions} plt`, color: "" },
            { label: "Effective", value: `${cap.effectiveRequiredPositions} plt`, color: cap.effectiveRequiredPositions > cap.requiredPalletPositions ? "text-amber-600" : "" },
            { label: "Available", value: `${cap.availablePalletPositions} plt`, color: "" },
            { label: "Util After", value: `${cap.utilizationAfter}%`, color: utilColor(cap.utilizationAfter, cap.utilizationTarget) },
            { label: "Ops Owner", value: cap.opsOwner.split(" · ")[0], color: "" },
          ].map(m => (
            <div key={m.label} className="bg-muted/30 rounded-lg p-1.5 text-center">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Score + Utilization bars */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Capacity Fit Score</span>
              <span className={`text-xs font-bold ${scoreColor(cap.capacityFitScore)}`}>{cap.capacityFitScore}/100</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor(cap.capacityFitScore)}`} style={{ width: `${cap.capacityFitScore}%` }} />
            </div>
          </div>
          <div className="rounded-lg border p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Utilization</span>
              <span className="text-[9px] text-muted-foreground">target {cap.utilizationTarget}%</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-12 text-muted-foreground">Before</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${utilBar(cap.utilizationBefore, cap.utilizationTarget)}`} style={{ width: `${cap.utilizationBefore}%` }} />
              </div>
              <span className={`font-bold w-8 text-right ${utilColor(cap.utilizationBefore, cap.utilizationTarget)}`}>{cap.utilizationBefore}%</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-12 text-muted-foreground">After</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${utilBar(cap.utilizationAfter, cap.utilizationTarget)}`} style={{ width: `${Math.min(cap.utilizationAfter, 100)}%` }} />
              </div>
              <span className={`font-bold w-8 text-right ${utilColor(cap.utilizationAfter, cap.utilizationTarget)}`}>{cap.utilizationAfter}%</span>
            </div>
          </div>
        </div>

        {/* Warehouse constraints */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Warehouse Constraints</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {cap.constraints.map(c => (
              <div key={c.label} className={`rounded border p-1.5 ${constraintStatusColors[c.status]}`}>
                <p className="text-[8px] font-semibold uppercase tracking-wider opacity-70">{c.label}</p>
                <p className="text-[10px] font-medium mt-0.5">{c.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Risk + Positive */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-red-200 bg-red-50/30 p-2 space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-red-700">Risk Factors</p>
            <ul className="text-[10px] text-red-800 space-y-0.5 list-disc pl-3">
              {cap.riskReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-2 space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">Positive Factors</p>
            <ul className="text-[10px] text-emerald-800 space-y-0.5 list-disc pl-3">
              {cap.positiveReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>

        {/* Promise gaps */}
        {cap.promiseGaps.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Commercial Promise Gaps
            </p>
            <p className="text-[9px] text-amber-600 mb-1">Promise gaps show where quoted assumptions may differ from operational reality. Current mode: mock warning only.</p>
            <ul className="text-[10px] text-amber-800 space-y-0.5 list-disc pl-3">
              {cap.promiseGaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}

        {/* Escalation */}
        {isRed && cap.mockEscalationCreated && (
          <div className="p-2 rounded border border-red-200 bg-red-50 text-xs text-red-800 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            Red Capacity Signal — Mock escalation created for Operations / Commercial Director review. Testing may continue.
          </div>
        )}
        {!isRed && cap.riskLevel === "Medium" && (
          <div className="p-2 rounded border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Amber Capacity Review — acceptable with planning confirmation. Current mode: mock warning only.
          </div>
        )}

        {/* Dev note */}
        <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">
          <span className="font-medium">Development mode:</span> Capacity fit is mock data. It influences quote review but does not block testing or sync with warehouse systems.
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed flex-wrap">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction('capacity_reviewed_mock','Capacity reviewed (mock)',`Capacity for ${cap.customerName} reviewed. Utilization ${cap.utilizationAfter}%.`,'CAPACITY_REVIEWED_MOCK','Mock Reviewed')}>
            <Eye className="w-3 h-3" /> Review Capacity Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction('ops_input_requested_mock','Ops input requested (mock)',`Ops input requested for ${cap.customerName}. No real workflow created.`,'OPS_INPUT_REQUESTED_MOCK','Ops Input Requested')}>
            <UsersIcon className="w-3 h-3" /> Request Ops Input Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction('capacity_marked_reviewed_mock','Capacity marked reviewed (mock)',`Capacity marked reviewed for ${cap.customerName}.`,'CAPACITY_MARKED_REVIEWED_MOCK','Mock Reviewed')}>
            <Eye className="w-3 h-3" /> Mark Reviewed Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-blue-700 border-blue-200" onClick={() => mkAction('capacity_bypass_mock','Capacity testing bypass',`Continue for testing — capacity enforcement not applied for ${cap.customerName}.`,'CAPACITY_BYPASS_MOCK','Testing Bypass')}>
            <Play className="w-3 h-3" /> Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
