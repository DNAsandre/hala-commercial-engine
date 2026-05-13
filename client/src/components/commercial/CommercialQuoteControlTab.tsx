/**
 * CW-001 through CW-007: Commercial Quote Control Tab
 * SUPA-003: Now reads from Supabase via useCommercialWorkspaceData hook.
 * Development mode only — no real pricing, no backend, no CRM sync.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign, AlertTriangle, CheckCircle2, Info, ShieldAlert, Eye, FileText,
  Play, CircleDot, ChevronDown, ChevronRight, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import CommercialPricingLinesTable, { ScenarioComparisonSummary } from "./CommercialPricingLinesTable";
import { PnlSnapshotPanel, MarginAuthorityPanel } from "./CommercialPnlAuthorityPanels";
import CommercialCustomerScorePanel from "./CommercialCustomerScorePanel";
import CommercialCapacityFitPanel from "./CommercialCapacityFitPanel";
import CommercialPricingPosturePanel from "./CommercialPricingPosturePanel";
import CommercialRevenueRealizationPanel from "./CommercialRevenueRealizationPanel";
import CommercialMockEscalationPanel from "./CommercialMockEscalationPanel";
import { type QuoteScenario, type QuoteScenarioStatus } from "@/lib/commercial-workspace-data";
import { useCommercialWorkspaceData } from "@/hooks/useCommercialWorkspaceData";
import { getPricingLinesForScenarioFromBundle } from "@/lib/supabase-commercial-data";
import { logMockAction, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── HELPERS ───────────────────────────────────────────────

function getStatusLabel(s: QuoteScenarioStatus): string {
  return ({
    not_started: "Not Started",
    draft_scenario: "Draft Scenario",
    pnl_basis_added: "P&L Basis Added",
    ready_for_review_mock: "Ready for Review (Mock)",
    margin_risk_flagged: "Margin Risk Flagged",
    mock_reviewed: "Mock Reviewed",
    client_facing_draft_mock: "Client-Facing Draft (Mock)",
    superseded_mock: "Superseded (Mock)",
  })[s];
}

function getStatusColor(s: QuoteScenarioStatus): string {
  return ({
    not_started: "text-slate-600 bg-slate-50 border-slate-200",
    draft_scenario: "text-blue-700 bg-blue-50 border-blue-200",
    pnl_basis_added: "text-violet-700 bg-violet-50 border-violet-200",
    ready_for_review_mock: "text-emerald-700 bg-emerald-50 border-emerald-200",
    margin_risk_flagged: "text-red-700 bg-red-50 border-red-200",
    mock_reviewed: "text-emerald-700 bg-emerald-50 border-emerald-200",
    client_facing_draft_mock: "text-blue-700 bg-blue-50 border-blue-200",
    superseded_mock: "text-slate-500 bg-slate-50 border-slate-200",
  })[s];
}

function getGpColor(gp: number): string {
  if (gp >= 22) return "text-emerald-600";
  if (gp >= 10) return "text-amber-600";
  return "text-red-600";
}

function getGpBg(gp: number): string {
  if (gp >= 22) return "border-l-emerald-400";
  if (gp >= 10) return "border-l-amber-400";
  return "border-l-red-400";
}

function getGpSignalLabel(gp: number): string {
  if (gp >= 22) return "Local Authority";
  if (gp >= 10) return "Future Approval";
  return "Red Signal";
}

function formatSAR(v: number): string {
  return `SAR ${(v / 1000000).toFixed(2)}M`;
}

// ─── SCENARIO CARD ─────────────────────────────────────────

function ScenarioCard({ s, selected, onSelect }: { s: QuoteScenario; selected: boolean; onSelect: () => void }) {
  const gpValue = s.revenue - s.cost;
  const isRed = s.gpPercent < 10;
  return (
    <Card
      className={`border shadow-none transition-all cursor-pointer border-l-4 ${getGpBg(s.gpPercent)} ${selected ? "ring-2 ring-[var(--color-hala-navy)] bg-muted/20" : "hover:bg-muted/10"}`}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <CircleDot className={`w-3.5 h-3.5 ${selected ? "text-[var(--color-hala-navy)]" : "text-muted-foreground"}`} />
            <span className="text-sm font-semibold">{s.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px]">{s.version}</Badge>
            <Badge variant="outline" className={`text-[9px] ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs mb-2">
          <div><span className="text-muted-foreground">Revenue</span><p className="font-medium">{formatSAR(s.revenue)}</p></div>
          <div><span className="text-muted-foreground">Cost</span><p className="font-medium">{formatSAR(s.cost)}</p></div>
          <div><span className="text-muted-foreground">GP</span><p className={`font-bold ${getGpColor(s.gpPercent)}`}>{s.gpPercent}%</p></div>
          <div><span className="text-muted-foreground">GP Value</span><p className="font-medium">{formatSAR(gpValue)}</p></div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs">
          <div><span className="text-muted-foreground">Posture</span><p className="font-medium">{s.pricingPosture}</p></div>
          <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{s.customerScore}</p></div>
          <div><span className="text-muted-foreground">Capacity</span><p className="font-medium">{s.capacityFit}</p></div>
          <div><span className="text-muted-foreground">Timing</span><p className="font-medium">{s.revenueTiming}</p></div>
        </div>

        {isRed && (
          <div className="mt-2 p-2 rounded-md border border-red-200 bg-red-50 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <p className="text-[10px] text-red-700">Red Signal Detected — Mock escalation created for Commercial Director review. Testing may continue.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DETAIL PANEL ──────────────────────────────────────────

function ScenarioDetailPanel({ s, workspaceId, onActionComplete }: { s: QuoteScenario; workspaceId?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };

  const mkAction = async (eventType: string, title: string, desc: string, code: string, after: string) => {
    if (!workspaceId) { toast.info(`${title}. No backend update.`); return; }
    const result = await logMockAction(
      { workspaceId, eventType, title, description: desc, category: 'Quote', actor, severity: 'Info', relatedArtifact: s.name, relatedModule: 'Quote Control', relatedScenarioId: s.id },
      { workspaceId, eventCode: code, eventName: title, description: desc, category: 'QUOTE', actor, entityType: 'Quote Scenario', entityName: s.name, beforeState: getStatusLabel(s.status), afterState: after, severity: 'Info' }
    );
    if (result.success) { toast.success(`${title} saved to Supabase.`); onActionComplete?.(); }
    else { toast.error(`Mock action could not be saved: ${result.error}`); }
  };

  const gpValue = s.revenue - s.cost;
  const isRed = s.gpPercent < 10;
  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--color-hala-navy)]" />
            {s.name}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] ${getStatusColor(s.status)}`}>{getStatusLabel(s.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-4">
        {/* Financial summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Revenue", value: formatSAR(s.revenue), color: "" },
            { label: "Cost", value: formatSAR(s.cost), color: "" },
            { label: "Gross Profit", value: formatSAR(gpValue), color: "" },
            { label: "GP%", value: `${s.gpPercent}%`, color: getGpColor(s.gpPercent) },
            { label: "Margin Signal", value: getGpSignalLabel(s.gpPercent), color: getGpColor(s.gpPercent) },
            { label: "Owner", value: s.owner, color: "" },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-muted-foreground">Pricing Posture</span><p className="font-medium mt-0.5">{s.pricingPosture}</p></div>
          <div><span className="text-muted-foreground">Customer Score</span><p className="font-medium mt-0.5">{s.customerScore}</p></div>
          <div><span className="text-muted-foreground">Capacity Fit</span><p className="font-medium mt-0.5">{s.capacityFit}</p></div>
          <div><span className="text-muted-foreground">Revenue Timing</span><p className="font-medium mt-0.5">{s.revenueTiming}</p></div>
        </div>

        {/* Escalation */}
        <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${isRed ? "border-red-200 bg-red-50" : s.gpPercent < 22 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          {isRed ? <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> :
           s.gpPercent < 22 ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /> :
           <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
          <div>
            <p className={`text-xs font-semibold ${isRed ? "text-red-800" : s.gpPercent < 22 ? "text-amber-800" : "text-emerald-800"}`}>
              {isRed ? "Mock Escalation Active" : s.gpPercent < 22 ? "Future Approval Required" : "Within Local Authority"}
            </p>
            <p className={`text-[10px] mt-0.5 ${isRed ? "text-red-700" : s.gpPercent < 22 ? "text-amber-700" : "text-emerald-700"}`}>{s.mockEscalation}</p>
          </div>
        </div>

        {s.notes && (
          <div className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {s.notes}</div>
        )}

        {/* Mock actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => mkAction('quote_reviewed_mock', 'Quote Reviewed Mock', `Mock review logged for "${s.name}". No external action taken.`, 'QUOTE_REVIEWED_MOCK', 'Mock Reviewed')}>
            <Eye className="w-3.5 h-3.5" /> Review Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => mkAction('quote_preview_mock', 'Quote Preview Mock', `Mock quote preview generated for "${s.name}". No real document created.`, 'QUOTE_PREVIEW_MOCK', 'Preview Generated')}>
            <FileText className="w-3.5 h-3.5" /> Generate Quote Preview Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 text-blue-700 border-blue-200" onClick={() => mkAction('quote_bypass_mock', 'Quote Testing Bypass', 'Continue for testing — no enforcement applied.', 'QUOTE_BYPASS_MOCK', 'Testing Bypass')}>
            <Play className="w-3.5 h-3.5" /> Continue for Testing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────

interface Props {
  workspaceId: string;
  customerName?: string;
  gpPercent?: number;
  estimatedValue?: number;
}

export default function CommercialQuoteControlTab({ workspaceId, customerName, gpPercent, estimatedValue }: Props) {
  const { bundle, status, errorMessage, reload } = useCommercialWorkspaceData(workspaceId);
  const [selectedId, setSelectedId] = useState<string>("qs-a");
  const [detailExpanded, setDetailExpanded] = useState(true);

  // ─── Loading state ─────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-12 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading commercial workspace data from Supabase…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Card className="border-2 border-red-200 shadow-none bg-red-50/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-red-800 mb-1">Could not load Supabase commercial data</div>
              <p className="text-xs text-red-700">{errorMessage || 'Unknown error'}</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={reload}>Retry</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'empty' || !bundle || bundle.scenarios.length === 0) {
    return (
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800 mb-1">Supabase seed data missing for workspace</div>
              <p className="text-xs text-amber-700">No commercial quote scenarios found in Supabase for workspace {workspaceId}. Seed data may not have been inserted for this workspace.</p>
              <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={reload}>Retry</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Data from Supabase bundle ─────────────────────────────
  const scenarios = bundle.scenarios;
  const selected = scenarios.find(s => s.id === selectedId) || scenarios[0];
  const pricingLines = getPricingLinesForScenarioFromBundle(bundle, selected.id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-serif font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[var(--color-hala-navy)]" /> Quote Control
          </h3>
          <p className="text-xs text-muted-foreground">
            Mock quote scenarios for {customerName || "this workspace"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Supabase-Backed</Badge>
          <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">CRM Sync: Mock / Not Connected</Badge>
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Development Mode</Badge>
        </div>
      </div>

      {/* Development banner */}
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: quote controls and pricing lines are Supabase-backed mock data</div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Red signals create mock escalations but do not block testing.
                No real pricing engine, CRM sync, or approval enforcement is active.
                All values are Supabase-backed development-mode mock data. RLS is development-permissive.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Quote Scenarios</h4>
          <Badge variant="outline" className="text-[9px]">{scenarios.length} scenarios</Badge>
        </div>
        {scenarios.map(s => (
          <ScenarioCard key={s.id} s={s} selected={selectedId === s.id} onSelect={() => setSelectedId(s.id)} />
        ))}
      </div>

      {/* Selected detail */}
      <div>
        <button
          className="flex items-center gap-1.5 text-sm font-semibold mb-2 hover:text-[var(--color-hala-navy)] transition-colors"
          onClick={() => setDetailExpanded(!detailExpanded)}
        >
          {detailExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Selected Scenario Detail
        </button>
        {detailExpanded && (
          <div className="space-y-4">
            {detailExpanded && selected && <ScenarioDetailPanel s={selected} workspaceId={workspaceId} onActionComplete={reload} />}
            <CommercialPricingLinesTable lines={pricingLines} scenarioName={selected.name} workspaceId={workspaceId} onActionComplete={reload} />
            {/* CW-003: P&L Snapshot + Margin Authority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bundle.pnlSnapshots[selected.id] && <PnlSnapshotPanel pnl={bundle.pnlSnapshots[selected.id]} />}
              {bundle.marginSignals[selected.id] && <MarginAuthorityPanel signal={bundle.marginSignals[selected.id]} />}
            </div>
          </div>
        )}
      </div>

      {/* CW-004: Customer Score / ECR */}
      {bundle.customerScore && <CommercialCustomerScorePanel score={bundle.customerScore} gpPercent={selected.gpPercent} />}

      {/* CW-005: Capacity Fit */}
      {bundle.capacityFits[selected.id] && <CommercialCapacityFitPanel cap={bundle.capacityFits[selected.id]} />}

      {/* CW-006: Pricing Posture */}
      {bundle.pricingPostures[selected.id] && <CommercialPricingPosturePanel p={bundle.pricingPostures[selected.id]} />}

      {/* CW-006: Revenue Realization */}
      {bundle.revenueRealization[selected.id] && <CommercialRevenueRealizationPanel r={bundle.revenueRealization[selected.id]} />}

      {/* CW-007: Mock Escalation Register */}
      <CommercialMockEscalationPanel scenarioId={selected.id} escalations={bundle.escalations[selected.id]} />

      {/* Scenario Comparison (CW-002) */}
      <ScenarioComparisonSummary scenarios={scenarios.map(s => ({
        name: s.name,
        revenue: s.revenue,
        cost: s.cost,
        gpPercent: s.gpPercent,
        pricingPosture: s.pricingPosture,
        capacityFit: s.capacityFit,
        riskLines: getPricingLinesForScenarioFromBundle(bundle, s.id).filter(l => l.riskLevel === "High" || l.riskLevel === "Critical").length,
        mockEscalation: s.mockEscalation,
      }))} />

      {/* Info footer */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          All quote controls are Supabase-backed mock data for development. P&L, margin authority, customer scoring, capacity
          fit, pricing posture, revenue realization, and mock escalations show future decision paths but do not
          enforce approvals, block testing, or sync with CRM/Finance. RLS is development-permissive and requires production hardening later.
        </p>
      </div>
    </div>
  );
}
