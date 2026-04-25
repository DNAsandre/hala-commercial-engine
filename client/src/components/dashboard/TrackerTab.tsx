/**
 * TrackerTab — Macro Lifecycle Intelligence
 *
 * NOT a board. NOT a kanban. NOT a duplicate of the overview pages.
 * Answers: "Where is work accumulating, where is risk accumulating,
 * and which entities inside those stages need attention?"
 *
 * Structure (3 stacked sections):
 *   A. Tender Lifecycle Tracker
 *   B. Commercial Lifecycle Tracker
 *   C. Renewal Lifecycle Tracker
 *
 * Each section:
 *   1. Header + summary line
 *   2. Lifecycle strip (stage chips with count / risk indicators)
 *   3. Flagged items list (max 5, problematic items only)
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { ChevronRight, ArrowRight, Gavel, BarChart3, RefreshCw } from "lucide-react";
import type { Workspace, Customer, ApprovalRecord } from "@/lib/store";
import { COMMERCIAL_MILESTONES, formatSARCompact } from "@/lib/store";
import {
  getTenderStatusDisplayName,
  TENDER_KANBAN_COLUMNS,
  type TenderMilestone,
  type Tender,
} from "@/lib/tender-engine";
import {
  type RenewalWorkspace,
  type ContractBaseline,
} from "@/lib/renewal-engine";

// ─── Shared primitives ───────────────────────────────────────

function RagDot({ color }: { color: "red" | "amber" | "green" | "neutral" }) {
  return (
    <div className={`w-2 h-2 rounded-full shrink-0 ${
      color === "red"    ? "bg-red-500" :
      color === "amber"  ? "bg-amber-500" :
      color === "green"  ? "bg-emerald-500" :
      "bg-slate-300 dark:bg-slate-600"
    }`} />
  );
}

// ─── Stage chip in lifecycle strip ───────────────────────────

interface StageInfo {
  value: string;
  label: string;
  shortLabel?: string;
  count: number;
  redCount: number;
  amberCount: number;
  isTerminal?: boolean;
}

function StageChip({ stage }: { stage: StageInfo }) {
  const hasRed = stage.redCount > 0;
  const hasAmber = stage.amberCount > 0;
  const isEmpty = stage.count === 0;

  const bg = isEmpty
    ? "bg-muted/30 border-border"
    : hasRed
      ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/50"
      : hasAmber
        ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40"
        : "bg-card border-border";

  return (
    <div className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border min-w-[72px] max-w-[96px] transition-colors ${bg} ${stage.isTerminal ? "opacity-70" : ""}`}>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none text-center whitespace-nowrap overflow-hidden">
        {stage.shortLabel ?? stage.label}
      </span>
      <span className={`text-sm font-bold leading-none ${isEmpty ? "text-muted-foreground/40" : "text-foreground"}`}>
        {stage.count}
      </span>
      {(hasRed || hasAmber) && (
        <div className="flex items-center gap-0.5">
          {hasRed   && <span className="text-[8px] font-bold text-red-600">{stage.redCount}🔴</span>}
          {hasAmber && <span className="text-[8px] font-bold text-amber-600">{stage.amberCount}🟡</span>}
        </div>
      )}
    </div>
  );
}

function StageArrow() {
  return <span className="text-muted-foreground/30 text-xs shrink-0 self-center">›</span>;
}

// ─── Lifecycle strip ─────────────────────────────────────────

function LifecycleStrip({ stages }: { stages: StageInfo[] }) {
  return (
    <div className="flex items-stretch gap-0.5 overflow-x-auto pb-1 scrollbar-hide">
      {stages.map((s, i) => (
        <div key={s.value} className="flex items-center gap-0.5 shrink-0">
          <StageChip stage={s} />
          {i < stages.length - 1 && <StageArrow />}
        </div>
      ))}
    </div>
  );
}

// ─── Flagged item row (shared) ────────────────────────────────

interface FlaggedItem {
  id: string;
  name: string;
  stageLabel: string;
  stageColor: string;
  reason: string;
  owner: string;
  urgency: "red" | "amber";
  value?: string;
  href: string;
}

function FlaggedRow({ item }: { item: FlaggedItem }) {
  return (
    <Link href={item.href}>
      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-muted/40 transition-colors cursor-pointer group min-w-0">
        <RagDot color={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${item.stageColor}`}>
              {item.stageLabel}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.reason}</p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          {item.value && (
            <p className="text-[10px] font-mono font-semibold text-foreground">{item.value}</p>
          )}
          <p className="text-[10px] text-muted-foreground">{item.owner}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── Tracker section wrapper ──────────────────────────────────

function TrackerSection({
  icon: Icon,
  title,
  summaryLine,
  viewAllHref,
  viewAllLabel,
  stages,
  flaggedItems,
  emptyMessage,
}: {
  icon: React.ElementType;
  title: string;
  summaryLine: string;
  viewAllHref: string;
  viewAllLabel: string;
  stages: StageInfo[];
  flaggedItems: FlaggedItem[];
  emptyMessage: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{summaryLine}</p>
          </div>
        </div>
        <Link href={viewAllHref}>
          <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
            {viewAllLabel} <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      {/* Lifecycle strip */}
      <div className="px-5 py-4 border-b border-border/60">
        <LifecycleStrip stages={stages} />
      </div>

      {/* Flagged items */}
      <div className="px-5 py-4 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Flagged — requires attention
        </p>
        {flaggedItems.length > 0 ? (
          flaggedItems.map(item => <FlaggedRow key={item.id} item={item} />)
        ) : (
          <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface TrackerTabProps {
  workspaces: Workspace[];
  customers: Customer[];
  approvalRecords: ApprovalRecord[];
  tenders: Tender[];
  renewalWorkspaces: RenewalWorkspace[];
  contractBaselines: ContractBaseline[];
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function TrackerTab({ workspaces, customers, approvalRecords, tenders, renewalWorkspaces, contractBaselines }: TrackerTabProps) {

  // ── A. TENDER TRACKER ──────────────────────────────────────

  const tenderStages = useMemo((): StageInfo[] => {
    const DISPLAY: Record<TenderMilestone, string> = {
      identified:          "Identified",
      preparing_submission: "Preparing",
      submitted:           "Submitted",
      clarification:       "Clarification",
      technical_review:    "Tech Review",
      commercial_review:   "Commercial",
      negotiation:         "Negotiation",
      awarded:             "Awarded",
      lost:                "Lost",
      withdrawn:           "Withdrawn",
    };

    return TENDER_KANBAN_COLUMNS.map(milestone => {
      const inStage = tenders.filter(t => t.status === milestone);
      const now = Date.now();
      const redCount = inStage.filter(t => {
        if (!t.submissionDeadline) return t.targetGpPercent < 22;
        const days = Math.ceil((new Date(t.submissionDeadline).getTime() - now) / 86400000);
        return days < 0 || t.targetGpPercent < 22;
      }).length;
      const amberCount = inStage.filter(t => {
        if (!t.submissionDeadline) return t.daysInStatus > 14;
        const days = Math.ceil((new Date(t.submissionDeadline).getTime() - now) / 86400000);
        return (days >= 0 && days <= 14) || t.daysInStatus > 14;
      }).length;

      const isTerminal = ["awarded", "lost", "withdrawn"].includes(milestone);
      return {
        value: milestone,
        label: DISPLAY[milestone],
        shortLabel: DISPLAY[milestone],
        count: inStage.length,
        redCount: Math.min(redCount, inStage.length),
        amberCount: Math.min(amberCount, inStage.length - redCount),
        isTerminal,
      };
    });
  }, [tenders]);

  const tenderFlagged = useMemo((): FlaggedItem[] => {
    const now = Date.now();
    const items: FlaggedItem[] = [];

    for (const t of tenders.filter(
      t => !["awarded", "lost", "withdrawn"].includes(t.status)
    )) {
      const days = Math.ceil((new Date(t.submissionDeadline).getTime() - now) / 86400000);
      const isOverdue = days < 0;
      const deadlinePressure = days >= 0 && days <= 14;
      const stalled = t.daysInStatus > 14;
      const lowMargin = t.targetGpPercent < 22;

      if (!isOverdue && !deadlinePressure && !stalled && !lowMargin) continue;

      const reasons: string[] = [];
      if (isOverdue) reasons.push(`Submission ${Math.abs(days)}d overdue`);
      else if (deadlinePressure) reasons.push(`${days}d to submission`);
      if (stalled) reasons.push(`${t.daysInStatus}d in stage`);
      if (lowMargin) reasons.push(`GP ${t.targetGpPercent}% below 22%`);

      items.push({
        id: t.id,
        name: t.customerName,
        stageLabel: getTenderStatusDisplayName(t.status),
        stageColor: isOverdue || lowMargin
          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        reason: reasons.join(" · "),
        owner: t.assignedOwner,
        urgency: isOverdue || lowMargin ? "red" : "amber",
        value: formatSARCompact(t.estimatedValue),
        href: "/tenders",
      });
    }

    return items
      .sort((a, b) => (a.urgency === "red" ? -1 : 1) - (b.urgency === "red" ? -1 : 1))
      .slice(0, 5);
  }, [tenders]);

  const tenderSummary = useMemo(() => {
    const active = tenders.filter(t => !["awarded", "lost", "withdrawn"].includes(t.status));
    const stalled = tenders.filter(t => t.daysInStatus > 14 && !["awarded", "lost", "withdrawn"].includes(t.status));
    const lowMargin = tenders.filter(t => t.targetGpPercent < 22 && !["awarded", "lost", "withdrawn"].includes(t.status));
    return `${active.length} active · ${stalled.length} stalled · ${lowMargin.length} below margin`;
  }, [tenders]);

  // ── B. COMMERCIAL TRACKER ──────────────────────────────────

  const commercialWS = useMemo(
    () => workspaces.filter(w => w.type !== "tender"),
    [workspaces]
  );

  const commercialStages = useMemo((): StageInfo[] => {
    return COMMERCIAL_MILESTONES.map(s => {
      const inStage = commercialWS.filter(w => w.stage === s.value);
      const redCount = inStage.filter(w => w.ragStatus === "red").length;
      const amberCount = inStage.filter(
        w => w.ragStatus === "amber" || w.approvalState === "pending"
      ).length;
      return {
        value: s.value,
        label: s.label,
        shortLabel: s.label
          .replace("Commercial Approved", "Apprvd")
          .replace("Solution Design", "Sol.Des")
          .replace("Proposal Active", "Proposal")
          .replace("Contract Signed", "Signed"),
        count: inStage.length,
        redCount,
        amberCount: Math.min(amberCount, inStage.length - redCount),
        isTerminal: s.value === "closed_lost",
      };
    });
  }, [commercialWS]);

  const commercialFlagged = useMemo((): FlaggedItem[] => {
    const pendingApprovalWsIds = new Set(
      approvalRecords.filter(a => a.decision === "pending").map(a => a.workspaceId)
    );

    const candidates = commercialWS.filter(w => {
      const isRed = w.ragStatus === "red";
      const isAmber = w.ragStatus === "amber";
      const stuck = (w.daysInStage ?? 0) > 14 && !["go_live"].includes(w.stage);
      const blocked = pendingApprovalWsIds.has(w.id);
      const lowGP = w.gpPercent < 22 && !["go_live", "contract_signed"].includes(w.stage);
      return isRed || isAmber || stuck || blocked || lowGP;
    });

    return candidates
      .sort((a, b) => {
        if (a.ragStatus === "red" && b.ragStatus !== "red") return -1;
        if (b.ragStatus === "red" && a.ragStatus !== "red") return 1;
        return (b.daysInStage ?? 0) - (a.daysInStage ?? 0);
      })
      .slice(0, 5)
      .map(w => {
        const reasons: string[] = [];
        if (w.ragStatus === "red") reasons.push("Critical signal");
        if (w.ragStatus === "amber") reasons.push("Warning signal");
        if ((w.daysInStage ?? 0) > 14) reasons.push(`${w.daysInStage}d in stage`);
        if (pendingApprovalWsIds.has(w.id)) reasons.push("Approval pending");
        if (w.gpPercent < 22) reasons.push(`GP ${w.gpPercent.toFixed(1)}% below threshold`);
        const stageEntry = COMMERCIAL_MILESTONES.find(s => s.value === w.stage);
        return {
          id: w.id,
          name: w.customerName,
          stageLabel: stageEntry?.label ?? w.stage,
          stageColor: w.ragStatus === "red"
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
          reason: reasons.join(" · "),
          owner: w.owner,
          urgency: w.ragStatus === "red" ? "red" : "amber" as "red" | "amber",
          value: formatSARCompact(w.estimatedValue),
          href: `/workspaces/${w.id}`,
        };
      });
  }, [commercialWS, approvalRecords]);

  const commercialSummary = useMemo(() => {
    const red = commercialWS.filter(w => w.ragStatus === "red").length;
    const stuck = commercialWS.filter(w => (w.daysInStage ?? 0) > 14 && !["go_live"].includes(w.stage)).length;
    const pendingApproval = approvalRecords.filter(a => a.decision === "pending").length;
    return `${commercialWS.length} active · ${red} critical · ${stuck} stuck · ${pendingApproval} approval-blocked`;
  }, [commercialWS, approvalRecords]);

  // ── C. RENEWAL TRACKER ────────────────────────────────────

  const RENEWAL_STAGES: { value: string; label: string }[] = [
    { value: "active_contract",  label: "Active Contract" },
    { value: "draft",            label: "Triggered" },
    { value: "under_review",     label: "Under Review" },
    { value: "decision_pending", label: "Decision Pending" },
    { value: "approved",         label: "Approved" },
    { value: "locked",           label: "Renewed" },
    { value: "rejected",         label: "Exited" },
  ];

  const renewalStages = useMemo((): StageInfo[] => {
    // "Active Contract" = active baselines with NO associated renewal workspace
    const renewedCustomerIds = new Set(renewalWorkspaces.map(r => r.customerId));
    const activeContractCustomers = contractBaselines.filter(
      b => b.status === "active" && !renewedCustomerIds.has(b.customerId)
    );

    const now = Date.now();

    return RENEWAL_STAGES.map(s => {
      let count = 0;
      let redCount = 0;
      let amberCount = 0;

      if (s.value === "active_contract") {
        count = activeContractCustomers.length;
        redCount = activeContractCustomers.filter(b => {
          const days = Math.ceil((new Date(b.baselineEndDate).getTime() - now) / 86400000);
          return days >= 0 && days <= 30;
        }).length;
        amberCount = activeContractCustomers.filter(b => {
          const days = Math.ceil((new Date(b.baselineEndDate).getTime() - now) / 86400000);
          return days > 30 && days <= 90;
        }).length;
      } else if (s.value === "decision_pending") {
        const ws = renewalWorkspaces.filter(
          r => r.renewalDecision === "pending" && r.status !== "rejected" && r.status !== "locked"
        );
        count = ws.length;
        amberCount = ws.length;
      } else {
        const ws = renewalWorkspaces.filter(r => r.status === s.value);
        count = ws.length;
        // Under review with no decision = amber
        if (s.value === "under_review") {
          amberCount = ws.filter(r => r.renewalDecision === "pending").length;
        }
      }

      const isTerminal = s.value === "locked" || s.value === "rejected";
      return {
        value: s.value,
        label: s.label,
        count,
        redCount,
        amberCount,
        isTerminal,
      };
    });
  }, [renewalWorkspaces, contractBaselines]);

  const renewalFlagged = useMemo((): FlaggedItem[] => {
    const items: FlaggedItem[] = [];
    const now = Date.now();

    // 1. Renewal workspaces with pending decision
    for (const rw of renewalWorkspaces.filter(
      r => r.renewalDecision === "pending" && r.status !== "rejected" && r.status !== "locked"
    )) {
      const customer = customers.find(c => c.id === rw.customerId);
      items.push({
        id: rw.id,
        name: rw.customerName,
        stageLabel: "Decision Pending",
        stageColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        reason: `No renewal decision — renew / renegotiate / exit / replace`,
        owner: rw.ownerName,
        urgency: "amber",
        value: customer ? formatSARCompact(customer.contractValue2025) : undefined,
        href: "/renewals",
      });
    }

    // 2. Active customers with contract expiry ≤ 60d and no renewal workspace
    const renewedCustomerIds = new Set(renewalWorkspaces.map(r => r.customerId));
    for (const c of customers.filter(cu => {
      if (cu.status !== "Active" || !cu.contractExpiry) return false;
      if (renewedCustomerIds.has(cu.id)) return false;
      const days = Math.ceil((new Date(cu.contractExpiry).getTime() - now) / 86400000);
      return days >= 0 && days <= 60;
    })) {
      const days = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
      items.push({
        id: c.id,
        name: c.name,
        stageLabel: "Active Contract",
        stageColor: days <= 30
          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        reason: `Contract expires in ${days}d — no renewal workspace created`,
        owner: c.accountOwner,
        urgency: days <= 30 ? "red" : "amber",
        value: formatSARCompact(c.contractValue2025),
        href: `/customers/${c.id}`,
      });
    }

    // 3. Bad-grade customers with active contracts (wrong-fit renewal concern)
    for (const c of customers.filter(
      cu => cu.status === "Active" && (cu.grade === "D" || cu.grade === "F")
    ).slice(0, 2)) {
      if (!items.find(i => i.id === c.id)) {
        items.push({
          id: c.id,
          name: c.name,
          stageLabel: `Grade ${c.grade}`,
          stageColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
          reason: `Wrong-fit customer — renewal decision required: exit / replace`,
          owner: c.accountOwner,
          urgency: "amber",
          value: formatSARCompact(c.contractValue2025),
          href: `/customers/${c.id}`,
        });
      }
    }

    return items
      .sort((a, b) => (a.urgency === "red" ? -1 : 1) - (b.urgency === "red" ? -1 : 1))
      .slice(0, 5);
  }, [customers, renewalWorkspaces]);

  const renewalSummary = useMemo(() => {
    const now = Date.now();
    const pending = renewalWorkspaces.filter(r => r.renewalDecision === "pending" && r.status !== "rejected").length;
    const expiring30 = customers.filter(c => {
      if (!c.contractExpiry || c.status !== "Active") return false;
      const d = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
      return d >= 0 && d <= 30;
    }).length;
    const expiring90 = customers.filter(c => {
      if (!c.contractExpiry || c.status !== "Active") return false;
      const d = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
      return d > 30 && d <= 90;
    }).length;
    return `${pending} decision pending · ${expiring30} expiring in 30d · ${expiring90} in 30–90d`;
  }, [customers, renewalWorkspaces]);

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* A — TENDER */}
      <TrackerSection
        icon={Gavel}
        title="Tender Lifecycle"
        summaryLine={tenderSummary}
        viewAllHref="/tenders-overview"
        viewAllLabel="Full tender view"
        stages={tenderStages}
        flaggedItems={tenderFlagged}
        emptyMessage="No flagged tenders — pipeline is clean"
      />

      {/* B — COMMERCIAL */}
      <TrackerSection
        icon={BarChart3}
        title="Commercial Lifecycle"
        summaryLine={commercialSummary}
        viewAllHref="/commercial-overview"
        viewAllLabel="Full commercial view"
        stages={commercialStages}
        flaggedItems={commercialFlagged}
        emptyMessage="No flagged commercial workspaces"
      />

      {/* C — RENEWALS */}
      <TrackerSection
        icon={RefreshCw}
        title="Renewal Lifecycle"
        summaryLine={renewalSummary}
        viewAllHref="/renewals-overview"
        viewAllLabel="Full renewals view"
        stages={renewalStages}
        flaggedItems={renewalFlagged}
        emptyMessage="No flagged renewals — portfolio is healthy"
      />
    </div>
  );
}
