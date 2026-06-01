/**
 * ProposalOverviewPanel — Readiness dashboard injected into the Overview tab.
 * Shows stage readiness scores, active signals, P&L summary, and suggested next action.
 */
import { CheckCircle2, AlertTriangle, Info, ArrowRight, Calculator, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ProposalWorkspaceData,
  calcQualificationReadiness, calcDiscoveryCompleteness,
  calcSolutionReadiness, calcPricingConfidence, generateSignals,
} from "./proposal-workspace-state";
import { formatSAR } from "./ui-primitives";

interface ProposalOverviewPanelProps {
  wsData: ProposalWorkspaceData;
  activeStage: string;
  onGoToStage?: (stage: string) => void;
}

export default function ProposalOverviewPanel({ wsData, activeStage, onGoToStage }: ProposalOverviewPanelProps) {
  const qualReady = calcQualificationReadiness(wsData);
  const discReady = calcDiscoveryCompleteness(wsData);
  const solnReady = calcSolutionReadiness(wsData);
  const priceReady = calcPricingConfidence(wsData);
  const signals = generateSignals(wsData);
  const criticals = signals.filter(s => s.type === "critical");
  const warnings = signals.filter(s => s.type === "warning");
  const infos = signals.filter(s => s.type === "info");

  // P&L summary
  const approvedPnl = wsData.pnlVersions.find(v => v.isApproved);
  const totalRev = approvedPnl?.revenue.reduce((s, l) => s + l.amount, 0) ?? 0;
  const totalCost = approvedPnl?.costs.reduce((s, l) => s + l.amount, 0) ?? 0;
  const gp = totalRev - totalCost;
  const gpPct = totalRev > 0 ? (gp / totalRev) * 100 : 0;

  // Suggested next action
  const suggestAction = (): { label: string; stage: string } => {
    if (qualReady < 50) return { label: "Complete Qualification — fill customer details and fit assessment", stage: "qualified" };
    if (discReady < 40) return { label: "Run Discovery — capture meeting notes and volume data", stage: "discovery" };
    if (solnReady < 40) return { label: "Build Solution Design — define warehouse and transport models", stage: "solution_design" };
    if (priceReady < 40) return { label: "Create P&L — establish commercial baseline with pricing", stage: "pnl_pricing" };
    if (!approvedPnl) return { label: "Approve P&L scenario — mark a working scenario for quoting", stage: "pnl_pricing" };
    return { label: "Ready to proceed to Quote stage", stage: "quote" };
  };
  const action = suggestAction();

  const readinessItems = [
    { label: "Qualification", score: qualReady, stage: "qualified" },
    { label: "Discovery", score: discReady, stage: "discovery" },
    { label: "Solution Design", score: solnReady, stage: "solution_design" },
    { label: "Pricing Confidence", score: priceReady, stage: "pnl_pricing" },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Readiness strip */}
      <Card className="border border-indigo-200/60 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
            Proposal Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {readinessItems.map(r => (
              <button key={r.stage} onClick={() => onGoToStage?.(r.stage)}
                className="p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors text-left">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{r.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${r.score >= 70 ? "bg-emerald-500" : r.score >= 40 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${r.score}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${r.score >= 70 ? "text-emerald-600" : r.score >= 40 ? "text-amber-600" : "text-red-600"}`}>{r.score}%</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggested next action */}
      <button onClick={() => onGoToStage?.(action.stage)}
        className="w-full flex items-center gap-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition-colors text-left">
        <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">Suggested Next Action</p>
          <p className="text-sm font-medium">{action.label}</p>
        </div>
      </button>

      {/* P&L snapshot */}
      {wsData.pnlVersions.length > 0 && (
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-violet-500" />
              P&L Snapshot
              <Badge variant="outline" className="text-[9px]">{wsData.pnlVersions.length} version{wsData.pnlVersions.length > 1 ? "s" : ""}</Badge>
              {approvedPnl && <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600">Approved: {approvedPnl.name}</Badge>}
            </CardTitle>
          </CardHeader>
          {approvedPnl && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 rounded bg-muted/20">
                  <p className="text-[9px] text-muted-foreground uppercase">Revenue</p>
                  <p className="text-sm font-bold">{formatSAR(totalRev)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/20">
                  <p className="text-[9px] text-muted-foreground uppercase">Cost</p>
                  <p className="text-sm font-bold">{formatSAR(totalCost)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/20">
                  <p className="text-[9px] text-muted-foreground uppercase">GP</p>
                  <p className={`text-sm font-bold ${gp >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSAR(gp)}</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/20">
                  <p className="text-[9px] text-muted-foreground uppercase">GP%</p>
                  <p className={`text-sm font-bold ${gpPct >= 22 ? "text-emerald-700" : gpPct >= 10 ? "text-amber-700" : "text-red-700"}`}>{gpPct.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Active signals summary */}
      {signals.length > 0 && (
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Active Signals
              {criticals.length > 0 && <Badge variant="outline" className="text-[9px] border-red-200 text-red-600">{criticals.length} critical</Badge>}
              {warnings.length > 0 && <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600">{warnings.length} warnings</Badge>}
              {infos.length > 0 && <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-600">{infos.length} info</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1.5">
            {signals.slice(0, 5).map((s, i) => (
              <button key={i} onClick={() => onGoToStage?.(s.stage)}
                className={`w-full flex items-start gap-2 p-2.5 rounded-lg border text-left hover:bg-muted/20 transition-colors ${
                  s.type === "critical" ? "border-red-200 bg-red-50/30" : s.type === "warning" ? "border-amber-200 bg-amber-50/30" : "border-blue-200 bg-blue-50/30"
                }`}>
                {s.type === "critical" ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  : s.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  : <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium">{s.message}</p>
                  <p className="text-[10px] text-muted-foreground">→ {s.recommendation}</p>
                </div>
              </button>
            ))}
            {signals.length > 5 && <p className="text-[10px] text-muted-foreground text-center">+ {signals.length - 5} more signals</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
