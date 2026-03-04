/**
 * Customer Risk Heatmap — Color-coded grid based on ECR, escalations, renewal risk, SLA
 *
 * DESIGN: Compact cards with overflow protection, truncated text
 */
import { useMemo } from "react";
import { Link } from "wouter";
import type { Customer, Signal, Workspace } from "@/lib/store";
import { calculateECR, formatSAR } from "@/lib/store";

interface CustomerRiskMapProps {
  customers: Customer[];
  signals: Signal[];
  workspaces: Workspace[];
}

type RiskLevel = "green" | "yellow" | "red";

interface CustomerRisk {
  id: string;
  name: string;
  grade: string;
  risk: RiskLevel;
  revenue: number;
  reasons: string[];
  workspaceId?: string;
}

function getRiskLevel(customer: Customer, signals: Signal[], workspaces: Workspace[]): { risk: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // ECR score
  const ecr = calculateECR(customer.dso, customer.contractValue2025, 25, 50, 50);
  if (ecr.grade === "D" || ecr.grade === "F") { score += 3; reasons.push(`ECR Grade ${ecr.grade}`); }
  else if (ecr.grade === "C") { score += 1; reasons.push(`ECR Grade ${ecr.grade}`); }

  // Red signals
  const customerWS = workspaces.filter(w => w.customerId === customer.id);
  const wsIds = customerWS.map(w => w.id);
  const redSignals = signals.filter(s => wsIds.includes(s.workspaceId) && s.severity === "red");
  if (redSignals.length > 0) { score += 2; reasons.push(`${redSignals.length} red signal(s)`); }

  const amberSignals = signals.filter(s => wsIds.includes(s.workspaceId) && s.severity === "amber");
  if (amberSignals.length > 0) { score += 1; reasons.push(`${amberSignals.length} amber signal(s)`); }

  // Renewal risk
  if (customer.contractExpiry) {
    const daysToExpiry = (new Date(customer.contractExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysToExpiry < 0) { score += 3; reasons.push("Contract expired"); }
    else if (daysToExpiry < 60) { score += 2; reasons.push(`Expires in ${Math.round(daysToExpiry)}d`); }
    else if (daysToExpiry < 120) { score += 1; reasons.push(`Expires in ${Math.round(daysToExpiry)}d`); }
  }

  // Payment risk
  if (customer.paymentStatus === "Bad") { score += 2; reasons.push("Bad payment status"); }
  else if (customer.dso > 50) { score += 1; reasons.push(`DSO ${customer.dso}d`); }

  if (score >= 4) return { risk: "red", reasons };
  if (score >= 2) return { risk: "yellow", reasons };
  return { risk: "green", reasons: reasons.length ? reasons : ["Healthy"] };
}

const riskColors: Record<RiskLevel, { bg: string; border: string; text: string; dot: string }> = {
  green: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  yellow: { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  red: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
};

export default function CustomerRiskMap({ customers, signals, workspaces }: CustomerRiskMapProps) {
  const riskData = useMemo(() => {
    return customers
      .filter(c => c.status === "Active")
      .map(c => {
        const { risk, reasons } = getRiskLevel(c, signals, workspaces);
        const ws = workspaces.find(w => w.customerId === c.id);
        return { id: c.id, name: c.name, grade: c.grade, risk, revenue: c.contractValue2025, reasons, workspaceId: ws?.id } as CustomerRisk;
      })
      .sort((a, b) => {
        const order: Record<RiskLevel, number> = { red: 0, yellow: 1, green: 2 };
        return order[a.risk] - order[b.risk] || b.revenue - a.revenue;
      });
  }, [customers, signals, workspaces]);

  const counts = useMemo(() => ({
    red: riskData.filter(r => r.risk === "red").length,
    yellow: riskData.filter(r => r.risk === "yellow").length,
    green: riskData.filter(r => r.risk === "green").length,
  }), [riskData]);

  return (
    <div className="bg-card border border-border rounded-xl p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Customer Risk Map</h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">ECR, escalations, renewal &amp; payment risk</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {(["red", "yellow", "green"] as RiskLevel[]).map(r => (
            <div key={r} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${riskColors[r].dot}`} />
              <span className="text-xs font-medium text-muted-foreground">{counts[r]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {riskData.map(c => {
          const colors = riskColors[c.risk];
          const inner = (
            <div className={`p-2.5 rounded-lg border ${colors.bg} ${colors.border} hover:shadow-sm transition-shadow cursor-pointer overflow-hidden`}>
              <div className="flex items-center gap-1.5 mb-1 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                <span className="text-xs font-bold text-foreground truncate">{c.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{formatSAR(c.revenue)}</p>
              <p className={`text-[10px] mt-0.5 ${colors.text} leading-tight truncate`}>
                {c.reasons.slice(0, 2).join(" · ")}
              </p>
            </div>
          );
          if (c.workspaceId) {
            return <Link key={c.id} href={`/workspaces/${c.workspaceId}`}>{inner}</Link>;
          }
          return <div key={c.id}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
