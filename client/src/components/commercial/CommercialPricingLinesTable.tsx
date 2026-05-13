/**
 * CW-002: Pricing Lines Table + Review Modal
 * Extracted from CommercialQuoteControlTab.
 * Mock-only — no backend, no real pricing engine.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, X, CheckCircle2, AlertTriangle, ShieldAlert, BarChart3,
  TrendingUp, Users, Info,
} from "lucide-react";
import { toast } from "sonner";
import { markPricingLineReviewedMock, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

// ─── TYPES (exported for parent) ───────────────────────────

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";
export type ReviewStatus = "Draft Mock" | "Needs Ops Input" | "Needs Finance Input" | "Reviewed Mock" | "Risk Flagged";
export type CostOwner = "Operations" | "Finance" | "Transport" | "Warehouse" | "HSE" | "Projects";
export type ServiceCategory = "Storage" | "Inbound Handling" | "Outbound Handling" | "Value Added Services" | "Transport Add-On" | "Special Handling" | "Dedicated Manpower" | "Admin / Reporting";

export interface QuotePricingLine {
  id: string;
  scenarioId: string;
  serviceCategory: ServiceCategory;
  serviceName: string;
  description: string;
  unit: string;
  volume: number;
  sellingRate: number;
  revenue: number;
  costRate: number;
  cost: number;
  grossProfit: number;
  gpPercent: number;
  costOwner: CostOwner;
  sellingOwner: string;
  assumption: string;
  riskLevel: RiskLevel;
  riskReason: string;
  reviewStatus: ReviewStatus;
  notes: string;
}

// ─── HELPERS ───────────────────────────────────────────────

const riskColors: Record<RiskLevel, string> = {
  Low: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Medium: "text-amber-700 bg-amber-50 border-amber-200",
  High: "text-orange-700 bg-orange-50 border-orange-200",
  Critical: "text-red-700 bg-red-50 border-red-200",
};

const reviewColors: Record<ReviewStatus, string> = {
  "Draft Mock": "text-slate-600 bg-slate-50 border-slate-200",
  "Needs Ops Input": "text-violet-700 bg-violet-50 border-violet-200",
  "Needs Finance Input": "text-blue-700 bg-blue-50 border-blue-200",
  "Reviewed Mock": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "Risk Flagged": "text-red-700 bg-red-50 border-red-200",
};

function gpColor(gp: number): string {
  if (gp >= 22) return "text-emerald-600";
  if (gp >= 10) return "text-amber-600";
  return "text-red-600";
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

// ─── TOTALS SUMMARY ────────────────────────────────────────

function TotalsSummary({ lines }: { lines: QuotePricingLine[] }) {
  const rev = lines.reduce((s, l) => s + l.revenue, 0);
  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const gp = rev - cost;
  const gpPct = rev > 0 ? (gp / rev) * 100 : 0;
  const highCrit = lines.filter(l => l.riskLevel === "High" || l.riskLevel === "Critical").length;
  const opsInput = lines.filter(l => l.reviewStatus === "Needs Ops Input").length;
  const finInput = lines.filter(l => l.reviewStatus === "Needs Finance Input").length;

  const items = [
    { label: "Total Revenue", value: `SAR ${fmtK(rev)}`, color: "" },
    { label: "Total Cost", value: `SAR ${fmtK(cost)}`, color: "" },
    { label: "Gross Profit", value: `SAR ${fmtK(gp)}`, color: gpColor(gpPct) },
    { label: "GP%", value: `${gpPct.toFixed(1)}%`, color: gpColor(gpPct) },
    { label: "High/Critical Lines", value: `${highCrit}`, color: highCrit > 0 ? "text-red-600" : "text-emerald-600" },
    { label: "Needs Input", value: `${opsInput + finInput}`, color: (opsInput + finInput) > 0 ? "text-amber-600" : "" },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {items.map(i => (
        <div key={i.label} className="bg-muted/30 rounded-lg p-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{i.label}</p>
          <p className={`text-sm font-bold mt-0.5 ${i.color}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── REVIEW MODAL ──────────────────────────────────────────

function LineReviewModal({ line, workspaceId, onActionComplete, onClose }: { line: QuotePricingLine; workspaceId?: string; onActionComplete?: () => void; onClose: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-lg border shadow-xl" onClick={e => e.stopPropagation()}>
        <CardHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-serif flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--color-hala-navy)]" /> Line Review — {line.serviceName}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0"><X className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">Service</span><p className="font-medium">{line.serviceName}</p></div>
            <div><span className="text-muted-foreground">Category</span><p className="font-medium">{line.serviceCategory}</p></div>
            <div><span className="text-muted-foreground">Cost Owner</span><p className="font-medium">{line.costOwner}</p></div>
            <div><span className="text-muted-foreground">Selling Owner</span><p className="font-medium">{line.sellingOwner}</p></div>
            <div><span className="text-muted-foreground">Risk Level</span><Badge variant="outline" className={`text-[9px] ${riskColors[line.riskLevel]}`}>{line.riskLevel}</Badge></div>
            <div><span className="text-muted-foreground">Review Status</span><Badge variant="outline" className={`text-[9px] ${reviewColors[line.reviewStatus]}`}>{line.reviewStatus}</Badge></div>
          </div>

          <div className="text-xs"><span className="text-muted-foreground font-medium">Description:</span> <span>{line.description}</span></div>
          <div className="text-xs"><span className="text-muted-foreground font-medium">Assumption:</span> <span>{line.assumption}</span></div>

          {line.riskReason && (
            <div className={`p-2 rounded border text-xs ${line.riskLevel === "Critical" || line.riskLevel === "High" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <span className="font-medium">Risk Reason:</span> {line.riskReason}
            </div>
          )}

          {(line.riskLevel === "Critical" || line.riskLevel === "High") && (
            <div className="p-2 rounded border border-orange-200 bg-orange-50 text-xs text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Would require review in production — mock only.
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 text-xs bg-muted/20 rounded-lg p-2">
            <div><span className="text-muted-foreground">Volume</span><p className="font-medium">{line.volume.toLocaleString()} {line.unit}</p></div>
            <div><span className="text-muted-foreground">Revenue</span><p className="font-medium">SAR {fmtK(line.revenue)}</p></div>
            <div><span className="text-muted-foreground">Cost</span><p className="font-medium">SAR {fmtK(line.cost)}</p></div>
            <div><span className="text-muted-foreground">GP%</span><p className={`font-bold ${gpColor(line.gpPercent)}`}>{line.gpPercent.toFixed(1)}%</p></div>
          </div>

          {line.notes && <div className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {line.notes}</div>}

          <div className="flex items-center gap-2 pt-2 border-t border-dashed">
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={async () => {
              if (workspaceId) {
                const result = await markPricingLineReviewedMock(line.id, workspaceId, line.serviceName, actor);
                if (result.success) { toast.success(`"${line.serviceName}" review saved to Supabase.`); onActionComplete?.(); }
                else { toast.error(`Mock action could not be saved: ${result.error}`); }
              } else { toast.info(`"${line.serviceName}" marked as reviewed (mock). No backend update.`); }
              onClose();
            }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reviewed Mock
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MAIN TABLE ────────────────────────────────────────────

interface Props {
  lines: QuotePricingLine[];
  scenarioName: string;
  workspaceId?: string;
  onActionComplete?: () => void;
}

export default function CommercialPricingLinesTable({ lines, scenarioName, workspaceId, onActionComplete }: Props) {
  const [reviewLine, setReviewLine] = useState<QuotePricingLine | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" /> Pricing Lines
          <Badge variant="outline" className="text-[9px]">{lines.length} lines</Badge>
        </h4>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" /> Cost base: Ops/Finance · Selling: Commercial · Mode: mock only
        </div>
      </div>

      <TotalsSummary lines={lines} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b">
              {["Service", "Category", "Unit", "Vol", "Sell Rate", "Revenue", "Cost Rate", "Cost", "GP", "GP%", "Owner", "Risk", "Review", ""].map(h => (
                <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => {
              const isRisky = l.riskLevel === "High" || l.riskLevel === "Critical";
              return (
                <tr key={l.id} className={`border-b last:border-0 hover:bg-muted/20 ${isRisky ? "bg-red-50/30" : ""}`}>
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap max-w-[140px] truncate">{l.serviceName}</td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{l.serviceCategory}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{l.unit}</td>
                  <td className="px-2 py-1.5 text-right">{l.volume.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right">{l.sellingRate.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right font-medium">{fmtK(l.revenue)}</td>
                  <td className="px-2 py-1.5 text-right">{l.costRate.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtK(l.cost)}</td>
                  <td className={`px-2 py-1.5 text-right font-medium ${l.grossProfit < 0 ? "text-red-600" : ""}`}>{fmtK(l.grossProfit)}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${gpColor(l.gpPercent)}`}>{l.gpPercent.toFixed(1)}%</td>
                  <td className="px-2 py-1.5"><Badge variant="outline" className="text-[8px] whitespace-nowrap">{l.costOwner}</Badge></td>
                  <td className="px-2 py-1.5"><Badge variant="outline" className={`text-[8px] ${riskColors[l.riskLevel]}`}>{l.riskLevel}</Badge></td>
                  <td className="px-2 py-1.5"><Badge variant="outline" className={`text-[8px] whitespace-nowrap ${reviewColors[l.reviewStatus]}`}>{l.reviewStatus}</Badge></td>
                  <td className="px-2 py-1.5">
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 px-1.5" onClick={() => setReviewLine(l)}>
                      <Eye className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reviewLine && <LineReviewModal line={reviewLine} workspaceId={workspaceId} onActionComplete={onActionComplete} onClose={() => setReviewLine(null)} />}
    </div>
  );
}

// ─── COMPARISON SUMMARY (exported) ─────────────────────────

interface ComparisonScenario {
  name: string;
  revenue: number;
  cost: number;
  gpPercent: number;
  pricingPosture: string;
  capacityFit: string;
  riskLines: number;
  mockEscalation: string;
}

export function ScenarioComparisonSummary({ scenarios }: { scenarios: ComparisonScenario[] }) {
  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-hala-navy)]" /> Scenario Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                {["Scenario", "Revenue", "Cost", "GP%", "Posture", "Capacity", "Risk Lines", "Escalation"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map(s => (
                <tr key={s.name} className="border-b last:border-0">
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">{s.name}</td>
                  <td className="px-2 py-1.5">SAR {fmtK(s.revenue)}</td>
                  <td className="px-2 py-1.5">SAR {fmtK(s.cost)}</td>
                  <td className={`px-2 py-1.5 font-bold ${gpColor(s.gpPercent)}`}>{s.gpPercent.toFixed(1)}%</td>
                  <td className="px-2 py-1.5">{s.pricingPosture}</td>
                  <td className="px-2 py-1.5">{s.capacityFit}</td>
                  <td className={`px-2 py-1.5 font-medium ${s.riskLines > 0 ? "text-red-600" : "text-emerald-600"}`}>{s.riskLines}</td>
                  <td className="px-2 py-1.5 text-muted-foreground max-w-[200px] truncate">{s.mockEscalation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
