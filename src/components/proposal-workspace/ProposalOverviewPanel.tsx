/**
 * ProposalOverviewPanel - readiness summary for proposal workspace data.
 */
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calcDiscoveryCompleteness,
  calcPricingConfidence,
  calcQualificationReadiness,
  calcSolutionReadiness,
  type ProposalWorkspaceData,
} from "./proposal-workspace-state";
import { formatSAR } from "./ui-primitives";

interface ProposalOverviewPanelProps {
  wsData: ProposalWorkspaceData;
  activeStage: string;
  onGoToStage?: (stage: string) => void;
}

export default function ProposalOverviewPanel({ wsData, onGoToStage }: ProposalOverviewPanelProps) {
  const qualReady = calcQualificationReadiness(wsData);
  const discReady = calcDiscoveryCompleteness(wsData);
  const solnReady = calcSolutionReadiness(wsData);
  const priceReady = calcPricingConfidence(wsData);

  const workingPnl = wsData.pnlVersions.find(version => version.isApproved);
  const totalRev = workingPnl?.revenue.reduce((sum, line) => sum + line.amount, 0) ?? 0;
  const totalCost = workingPnl?.costs.reduce((sum, line) => sum + line.amount, 0) ?? 0;
  const gp = totalRev - totalCost;
  const gpPct = totalRev > 0 ? (gp / totalRev) * 100 : 0;

  const suggestAction = (): { label: string; stage: string } => {
    if (qualReady < 50) return { label: "Complete Qualification - fill customer details and fit assessment", stage: "qualified" };
    if (discReady < 40) return { label: "Run Discovery - capture meeting notes and volume data", stage: "discovery" };
    if (solnReady < 40) return { label: "Build Solution Design - define warehouse and transport models", stage: "solution_design" };
    if (priceReady < 40) return { label: "Create P&L - establish commercial baseline with pricing", stage: "pnl_pricing" };
    if (!workingPnl) return { label: "Select working P&L scenario for quote preparation", stage: "pnl_pricing" };
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
      <Card className="border border-[#075eea]/20 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0b73ff]" />
            Proposal Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {readinessItems.map(item => (
              <button key={item.stage} onClick={() => onGoToStage?.(item.stage)} className="p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors text-left">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${item.score >= 70 ? "bg-emerald-500" : item.score >= 40 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${item.score}%` }} />
                  </div>
                  <span className={`text-sm font-bold ${item.score >= 70 ? "text-emerald-600" : item.score >= 40 ? "text-amber-600" : "text-red-600"}`}>{item.score}%</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <button onClick={() => onGoToStage?.(action.stage)} className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#075eea]/20 bg-[#075eea]/10 hover:bg-[#075eea]/10 transition-colors text-left">
        <ArrowRight className="w-4 h-4 text-[#075eea] shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#075eea]">Suggested Next Action</p>
          <p className="text-sm font-medium">{action.label}</p>
        </div>
      </button>

      {wsData.pnlVersions.length > 0 && (
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#0b73ff]" />
              P&L Snapshot
              <Badge variant="outline" className="text-[9px]">{wsData.pnlVersions.length} version{wsData.pnlVersions.length > 1 ? "s" : ""}</Badge>
              {workingPnl && <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600">Working: {workingPnl.name}</Badge>}
            </CardTitle>
          </CardHeader>
          {workingPnl && (
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
    </div>
  );
}
