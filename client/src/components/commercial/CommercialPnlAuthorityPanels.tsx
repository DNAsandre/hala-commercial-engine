/**
 * CW-003: P&L Snapshot + Margin Authority Panels
 * Mock-only — no real P&L engine, no approval enforcement.
 * SUPA-004: Actions now write to Supabase.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, ShieldAlert, AlertTriangle, CheckCircle2, Eye,
  Play, Info, Users, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { logMockAction, markPnlReviewedMock, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── TYPES ─────────────────────────────────────────────────

export type PnlConfidence = "Missing" | "Draft Mock" | "Needs Finance Input" | "Needs Ops Input" | "Needs Finance + Ops Input" | "Ready for Review Mock" | "Reviewed Mock";
export type AuthoritySeverity = "green" | "amber" | "red" | "critical";

export interface QuotePnlSnapshot {
  scenarioId: string;
  revenue: number;
  warehouseCost: number;
  transportCost: number;
  laborCost: number;
  specialHandlingCost: number;
  adminReportingCost: number;
  riskReserve: number;
  totalCost: number;
  grossProfit: number;
  gpPercent: number;
  pnlConfidence: PnlConfidence;
  missingInputs: string[];
  inputOwners: { owner: string; item: string }[];
  assumptions: string[];
  notes: string;
  lastReviewed: string;
  reviewedBy: string;
}

export interface MarginAuthoritySignal {
  scenarioId: string;
  gpPercent: number;
  thresholdBand: string;
  authorityLevel: string;
  requiredRolesFuture: string[];
  severity: AuthoritySeverity;
  reason: string;
  wouldRequireApproval: boolean;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  runtimeMode: string;
  notes: string;
}

// ─── HELPERS ───────────────────────────────────────────────

const confColors: Record<PnlConfidence, string> = {
  "Missing": "text-red-700 bg-red-50 border-red-200",
  "Draft Mock": "text-slate-600 bg-slate-50 border-slate-200",
  "Needs Finance Input": "text-blue-700 bg-blue-50 border-blue-200",
  "Needs Ops Input": "text-violet-700 bg-violet-50 border-violet-200",
  "Needs Finance + Ops Input": "text-amber-700 bg-amber-50 border-amber-200",
  "Ready for Review Mock": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Reviewed Mock": "text-emerald-700 bg-emerald-50 border-emerald-200",
};

const sevColors: Record<AuthoritySeverity, { bg: string; text: string; border: string }> = {
  green: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  red: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
  critical: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
};

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `SAR ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `SAR ${(v / 1_000).toFixed(1)}K`;
  return `SAR ${v.toLocaleString()}`;
}

function gpColor(gp: number): string {
  if (gp >= 22) return "text-emerald-600";
  if (gp >= 10) return "text-amber-600";
  return "text-red-600";
}

// ─── P&L SNAPSHOT PANEL ────────────────────────────────────

export function PnlSnapshotPanel({ pnl, workspaceId, scenarioId, scenarioName, onActionComplete }: { pnl: QuotePnlSnapshot; workspaceId?: string; scenarioId?: string; scenarioName?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };
  const costLines = [
    { label: "Warehouse / Storage", value: pnl.warehouseCost },
    { label: "Transport", value: pnl.transportCost },
    { label: "Labor / Manpower", value: pnl.laborCost },
    { label: "Special Handling", value: pnl.specialHandlingCost },
    { label: "Admin / Reporting", value: pnl.adminReportingCost },
    { label: "Risk Reserve", value: pnl.riskReserve },
  ];

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-hala-navy)]" /> P&L Snapshot
          </CardTitle>
          <Badge variant="outline" className={`text-[9px] ${confColors[pnl.pnlConfidence]}`}>{pnl.pnlConfidence}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Revenue / GP summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-muted/30 rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue</p>
            <p className="text-sm font-bold mt-0.5">{fmtK(pnl.revenue)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Total Cost</p>
            <p className="text-sm font-bold mt-0.5">{fmtK(pnl.totalCost)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Gross Profit</p>
            <p className={`text-sm font-bold mt-0.5 ${gpColor(pnl.gpPercent)}`}>{fmtK(pnl.grossProfit)}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">GP%</p>
            <p className={`text-sm font-bold mt-0.5 ${gpColor(pnl.gpPercent)}`}>{pnl.gpPercent.toFixed(1)}%</p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="rounded-lg border p-2 space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Cost Breakdown</p>
          {costLines.map(c => (
            <div key={c.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="font-medium">{fmtK(c.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs font-bold pt-1 border-t mt-1">
            <span>Total Cost</span>
            <span>{fmtK(pnl.totalCost)}</span>
          </div>
        </div>

        {/* Missing inputs */}
        {pnl.missingInputs.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 space-y-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-700">Missing Inputs</p>
            {pnl.inputOwners.map((io, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[8px]">{io.owner}</Badge>
                <span className="text-amber-800">{io.item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Assumptions */}
        {pnl.assumptions.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground font-medium hover:text-foreground">Assumptions ({pnl.assumptions.length})</summary>
            <ul className="mt-1 space-y-0.5 pl-4 list-disc text-muted-foreground">
              {pnl.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </details>
        )}

        {/* Review info + actions */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed">
          <div className="text-[10px] text-muted-foreground">
            {pnl.reviewedBy ? `Last reviewed by ${pnl.reviewedBy} · ${pnl.lastReviewed}` : "Not yet reviewed"}
          </div>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={async () => {
            if (workspaceId) {
              const result = await markPnlReviewedMock(scenarioId ?? 'unknown', workspaceId, scenarioName ?? 'Unknown Scenario', actor);
              if (result.success) { toast.success("P&L review saved to Supabase. No production approval triggered."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved to Supabase: ${result.error}`); }
            } else { toast.info("P&L review logged (mock). No backend update."); }
          }}>
            <Eye className="w-3 h-3" /> Review P&L Mock
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MARGIN AUTHORITY PANEL ────────────────────────────────

const AUTHORITY_MATRIX = [
  { band: "GP ≥ 22%", level: "Regional / Local Authority", color: "text-emerald-700" },
  { band: "GP < 22%", level: "Commercial / Ops Review", color: "text-amber-700" },
  { band: "GP < 13%", level: "Director / Finance Escalation", color: "text-orange-700" },
  { band: "GP < 10%", level: "CEO / CFO Escalation", color: "text-red-700" },
];

export function MarginAuthorityPanel({ signal, workspaceId, scenarioName, onActionComplete }: { signal: MarginAuthoritySignal; workspaceId?: string; scenarioName?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };
  const sev = sevColors[signal.severity];
  const SevIcon = signal.severity === "green" ? CheckCircle2 : signal.severity === "amber" ? AlertTriangle : ShieldAlert;

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[var(--color-hala-navy)]" /> Margin Authority
          </CardTitle>
          <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">{signal.runtimeMode}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Signal banner */}
        <div className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${sev.bg} ${sev.border}`}>
          <SevIcon className={`w-4 h-4 shrink-0 mt-0.5 ${sev.text}`} />
          <div>
            <p className={`text-xs font-semibold ${sev.text}`}>
              {signal.authorityLevel} — GP {signal.gpPercent.toFixed(1)}%
            </p>
            <p className={`text-[10px] mt-0.5 ${sev.text}`}>{signal.reason}</p>
            {signal.mockEscalationCreated && (
              <p className={`text-[10px] mt-1 font-medium ${sev.text}`}>
                Mock escalation created — testing may continue.
              </p>
            )}
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <div><span className="text-muted-foreground">GP%</span><p className={`font-bold ${gpColor(signal.gpPercent)}`}>{signal.gpPercent.toFixed(1)}%</p></div>
          <div><span className="text-muted-foreground">Threshold Band</span><p className="font-medium">{signal.thresholdBand}</p></div>
          <div><span className="text-muted-foreground">Authority Level</span><p className="font-medium">{signal.authorityLevel}</p></div>
          <div><span className="text-muted-foreground">Future Approval</span><p className="font-medium">{signal.wouldRequireApproval ? "Yes" : "No"}</p></div>
          <div><span className="text-muted-foreground">Future Escalation</span><p className="font-medium">{signal.wouldEscalate ? "Yes" : "No"}</p></div>
          <div><span className="text-muted-foreground">Test Bypass</span><p className="font-medium">{signal.allowTestBypass ? "Allowed" : "N/A"}</p></div>
        </div>

        {/* Future roles */}
        {signal.requiredRolesFuture.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium">Future required:</span>
            {signal.requiredRolesFuture.map(r => (
              <Badge key={r} variant="outline" className="text-[8px]">{r}</Badge>
            ))}
          </div>
        )}

        {/* Authority matrix */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground font-medium hover:text-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" /> Authority Matrix Reference
          </summary>
          <div className="mt-1.5 rounded border p-2 space-y-1">
            {AUTHORITY_MATRIX.map(a => (
              <div key={a.band} className={`flex items-center justify-between ${signal.thresholdBand === a.band ? "font-bold" : ""}`}>
                <span className={signal.thresholdBand === a.band ? a.color : "text-muted-foreground"}>{a.band}</span>
                <span className={signal.thresholdBand === a.band ? a.color : ""}>{a.level}</span>
              </div>
            ))}
          </div>
        </details>

        {signal.notes && <div className="text-[10px] text-muted-foreground"><span className="font-medium">Notes:</span> {signal.notes}</div>}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={async () => {
            if (workspaceId) {
              const result = await logMockAction(
                { workspaceId, eventType: 'margin_reviewed_mock', title: 'Margin authority reviewed (mock)',
                  description: `Margin authority reviewed for ${scenarioName ?? 'Unknown Scenario'}. GP ${signal.gpPercent.toFixed(1)}%. No production approval.`,
                  category: 'Margin', actor, severity: 'Info', relatedArtifact: scenarioName ?? 'Unknown Scenario', relatedModule: 'Margin Authority' },
                { workspaceId, eventCode: 'MARGIN_REVIEWED_MOCK', eventName: 'Margin Reviewed Mock',
                  description: `Margin reviewed: GP ${signal.gpPercent.toFixed(1)}%`,
                  category: 'MARGIN', actor, entityType: 'Margin Authority', entityName: scenarioName ?? 'Unknown Scenario',
                  beforeState: `${signal.gpPercent.toFixed(1)}% GP`, afterState: 'Mock Reviewed', severity: 'Info' }
              );
              if (result.success) { toast.success("Mock margin review saved to Supabase."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved: ${result.error}`); }
            } else { toast.info("Margin authority reviewed (mock). No backend update."); }
          }}>
            <Eye className="w-3 h-3" /> Mark Margin Reviewed Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-blue-700 border-blue-200" onClick={async () => {
            if (workspaceId) {
              const result = await logMockAction(
                { workspaceId, eventType: 'margin_bypass_mock', title: 'Margin testing bypass',
                  description: `Continue for testing — margin enforcement not applied. GP ${signal.gpPercent.toFixed(1)}%.`,
                  category: 'Margin', actor, severity: 'Info', relatedArtifact: scenarioName ?? 'Unknown Scenario', relatedModule: 'Margin Authority' },
                { workspaceId, eventCode: 'MARGIN_BYPASS_MOCK', eventName: 'Margin Bypass Mock',
                  description: `Testing bypass: margin for ${scenarioName ?? 'Unknown Scenario'}`,
                  category: 'MARGIN', actor, entityType: 'Margin Authority', entityName: scenarioName ?? 'Unknown Scenario',
                  beforeState: `${signal.gpPercent.toFixed(1)}% GP`, afterState: 'Testing Bypass', severity: 'Info' }
              );
              if (result.success) { toast.success("Testing bypass saved to Supabase."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved: ${result.error}`); }
            } else { toast.info("Continue for testing — no enforcement applied."); }
          }}>
            <Play className="w-3 h-3" /> Continue for Testing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
