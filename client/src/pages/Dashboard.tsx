/**
 * Commercial Command — Decision Cockpit
 *
 * Tab structure (exact order):
 *   1. Overview   — morning decision cockpit (default)
 *   2. Trackers   — macro lifecycle intelligence
 *   3. Portfolio  — customer-first quality/risk view
 *   4. Exceptions — summarized escalation dashboard
 *
 * Header (title + date) is always visible outside tabs.
 * Filters live inside Overview tab only.
 *
 * Overview layout:
 *   TOP ROW   — 4 decision blocks
 *   PANEL 1   — Attention Required  (escalation engine)
 *   PANEL 2   — Decision Now
 *   PANEL 3   — Risk Signals
 *   PANEL 4   — Time Sensitivity
 *   PORTFOLIO — compact customers requiring review
 */

import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  ChevronRight,
  ArrowRight,
  Loader2,
  Clock,
  Zap,
  CheckCircle,
  Radio,
  User,
  LayoutDashboard,
  BarChart3,
  Users,
  ShieldAlert,
} from "lucide-react";

const CheckCircle2 = CheckCircle;

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSAR, formatSARCompact, getStageLabel } from "@/lib/store";
import type { Customer } from "@/lib/store";
import { useWorkspaces, useCustomers, useSignals, useApprovalRecords, useTenders, useRenewalWorkspaces } from "@/hooks/useSupabase";
import { getTenderMetrics } from "@/lib/tender-engine";
import { runGlobalEscalationSweep } from "@/lib/escalation-triggers";

import ExecutiveSnapshot from "@/components/dashboard/ExecutiveSnapshot";
import EscalationAttentionPanel from "@/components/dashboard/EscalationAttentionPanel";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import type { DashboardFilterState } from "@/components/dashboard/DashboardFilters";
import TrackerTab from "@/components/dashboard/TrackerTab";
import PortfolioTab from "@/components/dashboard/PortfolioTab";
import ExceptionsTab from "@/components/dashboard/ExceptionsTab";

// ─── Shared UI primitives ─────────────────────────────────────

function RagDot({ color }: { color: "red" | "amber" | "green" }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
      color === "red" ? "bg-red-500" :
      color === "amber" ? "bg-amber-500" :
      "bg-emerald-500"
    }`} />
  );
}

function ModeBadge({ mode }: { mode: "Tender" | "Commercial" | "Renewal" | "Customer" }) {
  const styles: Record<string, string> = {
    Tender:     "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    Commercial: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300",
    Renewal:    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
    Customer:   "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  };
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${styles[mode]}`}>
      {mode}
    </span>
  );
}

// ─── Risk signal row ──────────────────────────────────────────

function RiskRow({
  color, title, reason, href,
}: {
  color: "red" | "amber" | "green";
  title: string;
  reason: string;
  href?: string;
}) {
  const inner = (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
      color === "red"   ? "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/50"
      : color === "amber" ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50"
      :                     "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
    } ${href ? "hover:opacity-90 cursor-pointer" : ""}`}>
      <RagDot color={color} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{reason}</p>
      </div>
      {href && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

// ─── Decision item ────────────────────────────────────────────

interface DecisionItemData {
  label: string;
  mode: "Tender" | "Commercial" | "Renewal" | "Customer";
  why: string;
  consequence: string;
  href: string;
  urgency: "critical" | "high" | "medium";
}

function DecisionItem({ item }: { item: DecisionItemData }) {
  const borderColor =
    item.urgency === "critical" ? "border-l-red-500"
    : item.urgency === "high"   ? "border-l-amber-500"
    :                              "border-l-indigo-400";
  return (
    <Link href={item.href}>
      <div className={`flex items-start gap-3 p-3 rounded-r-xl border border-l-2 border-border ${borderColor} bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group min-w-0`}>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <ModeBadge mode={item.mode} />
            <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
          </div>
          <p className="text-[11px] text-foreground/80 leading-relaxed">{item.why}</p>
          <p className="text-[10px] text-muted-foreground italic">If delayed: {item.consequence}</p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── Time sensitivity item ────────────────────────────────────

interface TimeItemData {
  label: string;
  sublabel: string;
  mode: "Tender" | "Commercial" | "Renewal" | "Customer";
  urgency: "red" | "amber" | "green";
  timeLabel: string;
  detail: string;
  href: string;
}

function TimeSensitivityItem({ item }: { item: TimeItemData }) {
  return (
    <Link href={item.href}>
      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-muted/40 transition-colors cursor-pointer group min-w-0">
        <RagDot color={item.urgency} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <ModeBadge mode={item.mode} />
            <span className="text-xs font-medium truncate text-foreground">{item.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.sublabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-bold ${
            item.urgency === "red" ? "text-red-600 dark:text-red-400"
            : item.urgency === "amber" ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
          }`}>{item.timeLabel}</p>
          <p className="text-[10px] text-muted-foreground">{item.detail}</p>
        </div>
      </div>
    </Link>
  );
}

// ─── Portfolio customer row ───────────────────────────────────

function PortfolioRow({ customer }: { customer: Customer }) {
  const now = Date.now();
  const daysToExpiry = customer.contractExpiry
    ? Math.ceil((new Date(customer.contractExpiry).getTime() - now) / 86400000)
    : null;
  const flags: { label: string; color: string }[] = [];
  if (customer.grade === "D" || customer.grade === "F")
    flags.push({ label: `Grade ${customer.grade}`, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" });
  if (customer.paymentStatus === "Bad")
    flags.push({ label: "Bad Payer", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" });
  if (customer.paymentStatus === "Acceptable")
    flags.push({ label: "Late Payer", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" });
  if (daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30)
    flags.push({ label: `Expiry ${daysToExpiry}d`, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" });
  return (
    <Link href={`/customers/${customer.id}`}>
      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border hover:bg-muted/40 transition-colors cursor-pointer min-w-0 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-xs font-medium text-foreground truncate">{customer.name}</span>
            {flags.map((f, i) => (
              <span key={i} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${f.color}`}>{f.label}</span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {customer.accountOwner} · {customer.region} · {customer.serviceType}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold">{formatSARCompact(customer.contractValue2025)}</p>
          <p className="text-[10px] text-muted-foreground">DSO {customer.dso}d</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────

export default function Dashboard() {
  const { data: workspaces, loading: wsLoading } = useWorkspaces();
  const { data: customers, loading: custLoading } = useCustomers();
  const { data: signals, loading: sigLoading } = useSignals();
  const { data: approvalRecords, loading: appLoading } = useApprovalRecords();
  const { data: tenders, loading: tendersLoading } = useTenders();
  const { data: renewalWorkspaces, loading: renewalsLoading } = useRenewalWorkspaces();

  const [filters, setFilters] = useState<DashboardFilterState>({
    timeRange: "all",
    customerSegment: "all",
    workspaceType: "all",
  });

  const loading = wsLoading || custLoading || sigLoading || appLoading || tendersLoading || renewalsLoading;

  useEffect(() => {
    if (!wsLoading && !custLoading && customers.length > 0) {
      runGlobalEscalationSweep().catch(err => {
        console.warn("[EscalationSweep]", err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsLoading, custLoading]);

  const filteredWorkspaces = useMemo(() => {
    let ws = workspaces;
    if (filters.workspaceType === "commercial") ws = ws.filter(w => w.type !== "tender");
    if (filters.workspaceType === "tender") ws = ws.filter(w => w.type === "tender");
    if (filters.customerSegment !== "all") {
      const custIds = new Set(
        customers.filter(c => c.grade === filters.customerSegment).map(c => c.id)
      );
      ws = ws.filter(w => custIds.has(w.customerId));
    }
    return ws;
  }, [workspaces, customers, filters]);

  const filteredCustomers = useMemo(() => {
    let c = customers;
    if (filters.customerSegment !== "all") c = c.filter(cu => cu.grade === filters.customerSegment);
    return c;
  }, [customers, filters]);

  const filteredSignals = useMemo(() => {
    const wsIds = new Set(filteredWorkspaces.map(w => w.id));
    return signals.filter(s => wsIds.has(s.workspaceId));
  }, [signals, filteredWorkspaces]);

  const tenderMetrics = useMemo(() => getTenderMetrics(tenders), [tenders]);

  // ── PANEL 2 — Decision Now ──────────────────────────────────

  const decisionItems = useMemo((): DecisionItemData[] => {
    const items: DecisionItemData[] = [];
    const pendingApprovals = approvalRecords.filter(a => a.decision === "pending");
    for (const ap of pendingApprovals.slice(0, 2)) {
      const ws = filteredWorkspaces.find(w => w.id === ap.workspaceId);
      if (ws) items.push({
        label: ws.customerName, mode: "Commercial",
        why: `${ap.approverRole.replace(/_/g, " ")} approval pending on ${ap.entityType} — blocking commercial progression`,
        consequence: "Deal cannot advance to next stage until approved",
        href: `/workspaces/${ws.id}?tab=approvals`, urgency: "high",
      });
    }
    for (const t of tenderMetrics.lowMargin.slice(0, 2)) {
      items.push({
        label: t.customerName, mode: "Tender",
        why: "GP% below 22% threshold — pricing direction or repricing required before submission",
        consequence: "Tender submitted below margin floor or opportunity missed entirely",
        href: "/tenders", urgency: "critical",
      });
    }
    const pendingRenewals = renewalWorkspaces.filter(
      r => r.renewalDecision === "pending" && r.status !== "rejected"
    );
    for (const rw of pendingRenewals.slice(0, 2)) {
      items.push({
        label: rw.customerName, mode: "Renewal",
        why: "No renewal decision — renew / renegotiate / exit / replace call required",
        consequence: `Contract ends ${rw.targetEndDate} — delay risks rollover, margin erosion, or unplanned exit`,
        href: "/renewals", urgency: "high",
      });
    }
    const wrongFit = filteredCustomers.filter(c => c.status === "Active" && (c.grade === "D" || c.grade === "F"));
    for (const c of wrongFit.slice(0, 2)) {
      items.push({
        label: c.name, mode: "Customer",
        why: `Grade ${c.grade} customer — consuming operations and capacity without adequate commercial return`,
        consequence: "Wrong-fit customers damage margin, ops quality, and portfolio standing",
        href: `/customers/${c.id}`, urgency: "medium",
      });
    }
    const highValueRed = filteredWorkspaces.filter(
      w => w.ragStatus === "red" && w.estimatedValue > 1_000_000 && w.type !== "tender"
    );
    for (const w of highValueRed.slice(0, 1)) {
      items.push({
        label: w.customerName, mode: "Commercial",
        why: `${formatSAR(w.estimatedValue)} deal has critical signals — strategic review and direction needed`,
        consequence: "High-value deal at risk of loss or significant delay without senior intervention",
        href: `/workspaces/${w.id}`, urgency: "critical",
      });
    }
    return items
      .sort((a, b) => ({ critical: 0, high: 1, medium: 2 }[a.urgency] - { critical: 0, high: 1, medium: 2 }[b.urgency]))
      .slice(0, 7);
  }, [filteredWorkspaces, filteredCustomers, approvalRecords, tenderMetrics]);

  // ── PANEL 3 — Risk Signals ──────────────────────────────────

  const riskItems = useMemo(() => {
    const items: { color: "red" | "amber" | "green"; title: string; reason: string; href?: string }[] = [];
    const redWS = filteredWorkspaces.filter(w => w.ragStatus === "red" && w.type !== "tender");
    if (redWS.length > 0) items.push({ color: "red", title: `${redWS.length} commercial deal${redWS.length > 1 ? "s" : ""} with critical signals`, reason: `${redWS.map(w => w.customerName).slice(0, 2).join(", ")}${redWS.length > 2 ? ` +${redWS.length - 2} more` : ""}`, href: "/commercial" });
    const badPayers = filteredCustomers.filter(c => c.status === "Active" && c.paymentStatus === "Bad");
    if (badPayers.length > 0) items.push({ color: "red", title: `${badPayers.length} active customer${badPayers.length > 1 ? "s" : ""} with bad payment status`, reason: `DSO risk — ${badPayers.map(c => c.name).slice(0, 2).join(", ")}`, href: "/customers" });
    if (tenderMetrics.lowMargin.length > 0) items.push({ color: "red", title: `${tenderMetrics.lowMargin.length} tender${tenderMetrics.lowMargin.length > 1 ? "s" : ""} below 22% GP threshold`, reason: `Under-quoting risk — ${tenderMetrics.lowMargin.map(t => t.customerName).slice(0, 2).join(", ")}`, href: "/tenders" });
    const approvalBlocked = filteredWorkspaces.filter(w => w.approvalState === "pending" || w.approvalState === "partially_approved");
    if (approvalBlocked.length > 0) items.push({ color: "amber", title: `${approvalBlocked.length} deal${approvalBlocked.length > 1 ? "s" : ""} blocked pending approval`, reason: `Commercial progression stalled — ${approvalBlocked.map(w => w.customerName).slice(0, 2).join(", ")}`, href: "/workspaces" });
    const wrongFit = filteredCustomers.filter(c => c.status === "Active" && (c.grade === "D" || c.grade === "F"));
    if (wrongFit.length > 0) items.push({ color: "amber", title: `${wrongFit.length} wrong-fit customer${wrongFit.length > 1 ? "s" : ""} (Grade D/F) active`, reason: `Review, fix, or exit — ${wrongFit.map(c => c.name).slice(0, 2).join(", ")}`, href: "/customers" });
    const lowGP = filteredWorkspaces.filter(w => w.type !== "tender" && w.gpPercent < 22 && !["go_live", "contract_signed"].includes(w.stage));
    if (lowGP.length > 0) items.push({ color: "amber", title: `${lowGP.length} commercial proposal${lowGP.length > 1 ? "s" : ""} with GP below 22%`, reason: `Margin exposure — ${lowGP.map(w => w.customerName).slice(0, 2).join(", ")}`, href: "/workspaces" });
    if (tenderMetrics.stalled.length > 0) items.push({ color: "amber", title: `${tenderMetrics.stalled.length} tender${tenderMetrics.stalled.length > 1 ? "s" : ""} stalled beyond 14 days`, reason: `No milestone movement — ${tenderMetrics.stalled.map(t => t.customerName).slice(0, 2).join(", ")}`, href: "/tenders" });
    const pendingRenewals = renewalWorkspaces.filter(r => r.renewalDecision === "pending" && r.status !== "rejected");
    if (pendingRenewals.length > 0) items.push({ color: "amber", title: `${pendingRenewals.length} renewal${pendingRenewals.length > 1 ? "s" : ""} with no decision`, reason: pendingRenewals.map(r => r.customerName).join(", "), href: "/renewals" });
    if (items.length === 0) items.push({ color: "green", title: "No active risk signals", reason: "Pipeline, customers, and renewals look healthy" });
    return items;
  }, [filteredWorkspaces, filteredCustomers, tenderMetrics]);

  // ── PANEL 4 — Time Sensitivity ──────────────────────────────

  const timeItems = useMemo((): TimeItemData[] => {
    const now = Date.now();
    const items: TimeItemData[] = [];
    for (const t of tenders.filter(t => !["awarded", "lost", "withdrawn"].includes(t.status))) {
      const days = Math.ceil((new Date(t.submissionDeadline).getTime() - now) / 86400000);
      if (days <= 14) items.push({ label: t.customerName, sublabel: t.title, mode: "Tender", urgency: days < 0 ? "red" : days <= 7 ? "red" : "amber", timeLabel: days < 0 ? `${Math.abs(days)}d overdue` : `${days}d to submission`, detail: formatSARCompact(t.estimatedValue), href: "/tenders" });
    }
    const stuck = filteredWorkspaces.filter(w => w.type !== "tender" && (w.daysInStage ?? 0) > 14 && !["go_live"].includes(w.stage)).sort((a, b) => (b.daysInStage ?? 0) - (a.daysInStage ?? 0)).slice(0, 4);
    for (const w of stuck) items.push({ label: w.customerName, sublabel: getStageLabel(w.stage), mode: "Commercial", urgency: (w.daysInStage ?? 0) > 21 ? "red" : "amber", timeLabel: `${w.daysInStage}d in stage`, detail: formatSARCompact(w.estimatedValue), href: `/workspaces/${w.id}` });
    const expiringCustomers = filteredCustomers.filter(c => {
      if (!c.contractExpiry || c.status !== "Active") return false;
      const d = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
      return d >= 0 && d <= 30;
    });
    for (const c of expiringCustomers.slice(0, 3)) {
      const days = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
      items.push({ label: c.name, sublabel: "Contract expiry", mode: "Renewal", urgency: days <= 14 ? "red" : "amber", timeLabel: `${days}d to expiry`, detail: `${formatSARCompact(c.contractValue2025)} contract`, href: `/customers/${c.id}` });
    }
    const agingApprovals = approvalRecords.filter(a => {
      if (a.decision !== "pending") return false;
      return Math.floor((now - new Date(a.timestamp).getTime()) / 86400000) > 3;
    });
    for (const a of agingApprovals.slice(0, 2)) {
      const ws = workspaces.find(w => w.id === a.workspaceId);
      const age = Math.floor((now - new Date(a.timestamp).getTime()) / 86400000);
      items.push({ label: ws?.customerName ?? "Workspace", sublabel: `${a.approverRole.replace(/_/g, " ")} approval`, mode: "Commercial", urgency: age > 7 ? "red" : "amber", timeLabel: `${age}d waiting`, detail: "Approval blocking progression", href: ws ? `/workspaces/${ws.id}?tab=approvals` : "/approvals" });
    }
    return items.sort((a, b) => ({ red: 0, amber: 1, green: 2 }[a.urgency] - { red: 0, amber: 1, green: 2 }[b.urgency])).slice(0, 7);
  }, [filteredWorkspaces, filteredCustomers, approvalRecords, workspaces]);

  // ── Portfolio — compact overview customers ──────────────────

  const portfolioCustomers = useMemo((): Customer[] => {
    const now = Date.now();
    return filteredCustomers.filter(c => {
      if (c.status !== "Active") return false;
      return c.grade === "D" || c.grade === "F" || c.paymentStatus === "Bad" ||
        (c.contractExpiry ? Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000) <= 30 : false);
    }).slice(0, 6);
  }, [filteredCustomers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">

      {/* HEADER — always visible */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Commercial Command</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* TABS */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto p-1 gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs px-3 py-2">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trackers" className="flex items-center gap-1.5 text-xs px-3 py-2">
            <BarChart3 className="w-3.5 h-3.5" />
            Trackers
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="flex items-center gap-1.5 text-xs px-3 py-2">
            <Users className="w-3.5 h-3.5" />
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="flex items-center gap-1.5 text-xs px-3 py-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Exceptions
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: OVERVIEW ─────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-0">

          {/* Filters (Overview only) */}
          <div className="flex justify-end">
            <DashboardFilters filters={filters} onChange={setFilters} />
          </div>

          {/* 4 Decision blocks */}
          <ExecutiveSnapshot
            workspaces={filteredWorkspaces}
            customers={filteredCustomers}
            signals={filteredSignals}
            approvalRecords={approvalRecords}
            tenderMetrics={tenderMetrics}
          />

          {/* Row 1: Attention Required + Decision Now */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EscalationAttentionPanel />
            <Card className="border border-border shadow-none h-full overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    What Needs Your Decision Now
                  </CardTitle>
                  <Link href="/escalations">
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
                      All exceptions <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Decisions only — not operational tasks</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {decisionItems.length > 0 ? (
                    decisionItems.map((item, i) => <DecisionItem key={i} item={item} />)
                  ) : (
                    <div className="flex items-center gap-2 py-6 justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <p className="text-sm text-muted-foreground">No decisions pending</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Risk Signals + Time Sensitivity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Radio className="w-4 h-4 text-orange-500 shrink-0" />
                    Risk Signals
                  </CardTitle>
                  <Link href="/commercial">
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
                      Commercial <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
                <p className="text-[11px] text-muted-foreground">Tender · Commercial · Renewal · Customer</p>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {riskItems.map((r, i) => <RiskRow key={i} color={r.color} title={r.title} reason={r.reason} href={r.href} />)}
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-500 shrink-0" />
                    Time Sensitivity
                  </CardTitle>
                  <Link href="/tenders">
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
                      Tenders <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
                <p className="text-[11px] text-muted-foreground">Deadlines · stuck deals · expiry windows · ageing approvals</p>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {timeItems.length > 0 ? (
                  timeItems.map((item, i) => <TimeSensitivityItem key={i} item={item} />)
                ) : (
                  <div className="flex items-center gap-2 py-6 justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">No time pressure detected</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Portfolio compact strip */}
          {portfolioCustomers.length > 0 && (
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    Portfolio — Customers Requiring Review
                  </CardTitle>
                  <Link href="/customers">
                    <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
                      All customers <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
                <p className="text-[11px] text-muted-foreground">Wrong-fit · bad payers · expiring contracts · fix / exit / replace</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {portfolioCustomers.map(c => <PortfolioRow key={c.id} customer={c} />)}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB 2: TRACKERS ─────────────────────────────────── */}
        <TabsContent value="trackers" className="mt-0">
          <TrackerTab
            workspaces={workspaces}
            customers={customers}
            approvalRecords={approvalRecords}
            tenders={tenders}
            renewalWorkspaces={renewalWorkspaces}
            contractBaselines={[]}
          />
        </TabsContent>

        {/* ── TAB 3: PORTFOLIO ────────────────────────────────── */}
        <TabsContent value="portfolio" className="mt-0">
          <PortfolioTab
            customers={customers}
            workspaces={workspaces}
            signals={signals}
            renewalWorkspaces={renewalWorkspaces}
          />
        </TabsContent>

        {/* ── TAB 4: EXCEPTIONS ───────────────────────────────── */}
        <TabsContent value="exceptions" className="mt-0">
          <ExceptionsTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}
