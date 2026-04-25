/**
 * Decision Blocks — Top Row (replaces KPI sparkline cards)
 *
 * 4 blocks only. Each answers a decision question:
 *  1. Attention Required — what needs action now
 *  2. Pipeline Reality   — real weighted live value
 *  3. Revenue / Go-Live Risk — what value is at risk
 *  4. Portfolio / Renewal Risk — customer base exposure
 *
 * No sparklines. No trend arrows. No vanity metrics.
 */
import { useMemo } from "react";
import { ShieldAlert, BarChart3, TrendingDown, RefreshCw } from "lucide-react";
import type { Workspace, Customer, Signal, ApprovalRecord } from "@/lib/store";
import { formatSARCompact } from "@/lib/store";

interface DecisionBlocksProps {
  workspaces: Workspace[];
  customers: Customer[];
  signals: Signal[];
  approvalRecords: ApprovalRecord[];
  tenderMetrics: {
    stalled: { id: string; customerName: string }[];
    weightedPipeline: number;
    totalOpen: number;
    lowMargin: { id: string; customerName: string }[];
    overdue: { id: string; customerName: string }[];
  };
}

// ─── Single block ────────────────────────────────────────────

function Block({
  icon: Icon,
  label,
  primaryValue,
  rag,
  lines,
  accentClass,
}: {
  icon: React.ElementType;
  label: string;
  primaryValue: string;
  rag: "red" | "amber" | "green";
  lines: { text: string; strong?: boolean }[];
  accentClass: string;
}) {
  const borderColor =
    rag === "red"
      ? "border-l-red-500"
      : rag === "amber"
        ? "border-l-amber-500"
        : "border-l-emerald-500";

  return (
    <div
      className={`bg-card border border-border border-l-4 ${borderColor} rounded-xl p-4 flex flex-col gap-3 min-w-0`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight truncate">
          {label}
        </span>
      </div>

      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
        {primaryValue}
      </p>

      <div className="space-y-0.5">
        {lines.map((l, i) => (
          <p
            key={i}
            className={`text-[11px] leading-snug ${
              l.strong
                ? "text-foreground font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export default function ExecutiveSnapshot({
  workspaces,
  customers,
  signals,
  approvalRecords,
  tenderMetrics,
}: DecisionBlocksProps) {
  const metrics = useMemo(() => {
    const now = Date.now();

    // ── Block 1: Attention Required ──────────────────────────
    const redWS = workspaces.filter((w) => w.ragStatus === "red");
    const amberWS = workspaces.filter((w) => w.ragStatus === "amber");
    const pendingApprovals = approvalRecords.filter(
      (a) => a.decision === "pending"
    );
    const criticalCount = redWS.length + tenderMetrics.lowMargin.length;
    const warningCount =
      amberWS.length + pendingApprovals.length + tenderMetrics.stalled.length;
    const attentionTotal = criticalCount + warningCount;
    const attentionRag: "red" | "amber" | "green" =
      criticalCount > 0 ? "red" : warningCount > 0 ? "amber" : "green";

    // ── Block 2: Pipeline Reality ────────────────────────────
    const activeCommercial = workspaces.filter(
      (w) =>
        w.type !== "tender" && !["go_live", "contract_signed"].includes(w.stage)
    );
    const commercialPipeline = activeCommercial.reduce(
      (s, w) => s + w.estimatedValue,
      0
    );
    const stalledCommercial = activeCommercial.filter(
      (w) => (w.daysInStage ?? 0) > 14
    );
    const stalledValue = stalledCommercial.reduce(
      (s, w) => s + w.estimatedValue,
      0
    );
    const nearTermWS = workspaces.filter(
      (w) =>
        w.stage === "negotiation" || w.stage === "commercial_approved"
    );
    const nearTermValue = nearTermWS.reduce((s, w) => s + w.estimatedValue, 0);
    const totalWeighted = commercialPipeline + tenderMetrics.weightedPipeline;
    const pipelineRag: "red" | "amber" | "green" =
      stalledValue > totalWeighted * 0.35
        ? "red"
        : stalledValue > totalWeighted * 0.2
          ? "amber"
          : "green";

    // ── Block 3: Revenue / Go-Live Risk ──────────────────────
    const redSignalWS = workspaces.filter((w) => w.ragStatus === "red");
    const lateStageStuck = workspaces.filter(
      (w) =>
        ["commercial_approved", "contract_signed", "go_live"].includes(w.stage) &&
        (w.daysInStage ?? 0) > 14
    );
    const approvalBlockedWS = workspaces.filter(
      (w) =>
        w.approvalState === "pending" ||
        w.approvalState === "partially_approved"
    );
    // De-dup by workspace id across all risk categories
    const riskWsIds = new Set([
      ...redSignalWS.map((w) => w.id),
      ...lateStageStuck.map((w) => w.id),
      ...approvalBlockedWS.map((w) => w.id),
    ]);
    const revenueAtRisk = workspaces
      .filter((w) => riskWsIds.has(w.id))
      .reduce((s, w) => s + w.estimatedValue, 0);
    const riskRag: "red" | "amber" | "green" =
      redSignalWS.length > 0 || lateStageStuck.length > 0
        ? "red"
        : approvalBlockedWS.length > 0
          ? "amber"
          : "green";

    // ── Block 4: Portfolio / Renewal Risk ────────────────────
    const d30 = new Date(now + 30 * 86400000);
    const d60 = new Date(now + 60 * 86400000);
    const d90 = new Date(now + 90 * 86400000);

    const activeCustomers = customers.filter(
      (c) => c.status === "Active" && c.contractExpiry
    );
    const due30 = activeCustomers.filter((c) => {
      const e = new Date(c.contractExpiry);
      return e >= new Date(now) && e <= d30;
    });
    const due60 = activeCustomers.filter((c) => {
      const e = new Date(c.contractExpiry);
      return e > d30 && e <= d60;
    });
    const due90 = activeCustomers.filter((c) => {
      const e = new Date(c.contractExpiry);
      return e > d60 && e <= d90;
    });
    const badPayers = customers.filter(
      (c) => c.status === "Active" && c.paymentStatus === "Bad"
    );
    const wrongFit = customers.filter(
      (c) =>
        c.status === "Active" &&
        (c.grade === "D" || c.grade === "F")
    );
    const renewalValueAt90 = [...due30, ...due60, ...due90].reduce(
      (s, c) => s + c.contractValue2025,
      0
    );
    const portfolioRag: "red" | "amber" | "green" =
      due30.length > 0 || badPayers.length > 1
        ? "red"
        : due60.length > 0 || wrongFit.length > 0
          ? "amber"
          : "green";

    return {
      attention: { total: attentionTotal, critical: criticalCount, warning: warningCount, rag: attentionRag },
      pipeline: { total: totalWeighted, commercial: commercialPipeline, tender: tenderMetrics.weightedPipeline, stalled: stalledValue, nearTerm: nearTermValue, nearTermCount: nearTermWS.length, rag: pipelineRag },
      risk: { value: revenueAtRisk, redCount: redSignalWS.length, lateStuck: lateStageStuck.length, approvalBlocked: pendingApprovals.length, rag: riskRag },
      portfolio: { due30: due30.length, due60: due60.length, due90: due90.length, badPayers: badPayers.length, wrongFit: wrongFit.length, valueAt90: renewalValueAt90, rag: portfolioRag },
    };
  }, [workspaces, customers, signals, approvalRecords, tenderMetrics]);

  const { attention, pipeline, risk, portfolio } = metrics;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* BLOCK 1 — Attention Required */}
      <Block
        icon={ShieldAlert}
        label="Attention Required"
        primaryValue={
          attention.total === 0 ? "All clear" : String(attention.total)
        }
        rag={attention.rag}
        accentClass={
          attention.rag === "red"
            ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : attention.rag === "amber"
              ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        }
        lines={
          attention.total === 0
            ? [{ text: "No items needing action", strong: false }]
            : [
                {
                  text: `${attention.critical} critical · ${attention.warning} warnings`,
                  strong: attention.critical > 0,
                },
                {
                  text: `${approvalRecords.filter((a) => a.decision === "pending").length} approval${approvalRecords.filter((a) => a.decision === "pending").length !== 1 ? "s" : ""} pending`,
                },
              ]
        }
      />

      {/* BLOCK 2 — Pipeline Reality */}
      <Block
        icon={BarChart3}
        label="Pipeline Reality"
        primaryValue={formatSARCompact(pipeline.total)}
        rag={pipeline.rag}
        accentClass="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        lines={[
          {
            text: `Commercial ${formatSARCompact(pipeline.commercial)} · Tender ${formatSARCompact(pipeline.tender)} wtd`,
          },
          {
            text:
              pipeline.stalled > 0
                ? `${formatSARCompact(pipeline.stalled)} stalled · ${pipeline.nearTermCount} near-term close`
                : `${pipeline.nearTermCount} deal${pipeline.nearTermCount !== 1 ? "s" : ""} near close · pipeline moving`,
            strong: pipeline.stalled > 0,
          },
        ]}
      />

      {/* BLOCK 3 — Revenue / Go-Live Risk */}
      <Block
        icon={TrendingDown}
        label="Revenue / Go-Live Risk"
        primaryValue={risk.value > 0 ? formatSARCompact(risk.value) : "Low"}
        rag={risk.rag}
        accentClass={
          risk.rag === "red"
            ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : risk.rag === "amber"
              ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        }
        lines={[
          {
            text:
              risk.redCount > 0
                ? `${risk.redCount} deal${risk.redCount !== 1 ? "s" : ""} with critical signals`
                : "No critical deal signals",
            strong: risk.redCount > 0,
          },
          {
            text:
              risk.lateStuck > 0
                ? `${risk.lateStuck} late-stage deal${risk.lateStuck !== 1 ? "s" : ""} stuck · ${risk.approvalBlocked} approval-blocked`
                : risk.approvalBlocked > 0
                  ? `${risk.approvalBlocked} deal${risk.approvalBlocked !== 1 ? "s" : ""} approval-blocked`
                  : "Go-live & contracting on track",
          },
        ]}
      />

      {/* BLOCK 4 — Portfolio / Renewal Risk */}
      <Block
        icon={RefreshCw}
        label="Portfolio / Renewal Risk"
        primaryValue={
          portfolio.due30 + portfolio.due60 + portfolio.due90 > 0
            ? `${portfolio.due30 + portfolio.due60 + portfolio.due90} renewals`
            : "Low"
        }
        rag={portfolio.rag}
        accentClass={
          portfolio.rag === "red"
            ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : portfolio.rag === "amber"
              ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        }
        lines={[
          {
            text:
              portfolio.due30 + portfolio.due60 + portfolio.due90 > 0
                ? `30d: ${portfolio.due30} · 60d: ${portfolio.due60} · 90d: ${portfolio.due90}  (${formatSARCompact(portfolio.valueAt90)})`
                : "No contracts expiring in 90d",
            strong: portfolio.due30 > 0,
          },
          {
            text:
              portfolio.badPayers > 0 || portfolio.wrongFit > 0
                ? `${portfolio.badPayers} bad payer${portfolio.badPayers !== 1 ? "s" : ""} · ${portfolio.wrongFit} wrong-fit customer${portfolio.wrongFit !== 1 ? "s" : ""}`
                : "No bad payers or wrong-fit customers",
            strong: portfolio.badPayers > 0,
          },
        ]}
      />
    </div>
  );
}
