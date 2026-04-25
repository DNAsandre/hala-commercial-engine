/**
 * PortfolioTab — Customer-first Portfolio Risk & Quality View
 *
 * NOT a customer table. NOT a workspace list.
 * Answers: "Which customers are wrong-fit, deteriorating, risky,
 * or require action — and what is the commercial consequence?"
 *
 * Structure:
 *   1. Summary strip (4 metric chips)
 *   2. Wrong-fit / deteriorating (Grade D/F)
 *   3. Payment risk (Bad / high-DSO payers)
 *   4. Renewal risk (expiry within 90d + no strategy / no workspace)
 *   5. Key accounts with active risk signals
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { ChevronRight, ArrowRight, AlertOctagon, CreditCard, RefreshCw, Star, CheckCircle } from "lucide-react";
import type { Workspace, Customer, Signal } from "@/lib/store";
import { formatSARCompact } from "@/lib/store";
import type { RenewalWorkspace } from "@/lib/renewal-engine";

const CheckCircle2 = CheckCircle;

// ─── Shared ──────────────────────────────────────────────────

function RagDot({ color }: { color: "red" | "amber" | "green" }) {
  return (
    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
      color === "red" ? "bg-red-500" : color === "amber" ? "bg-amber-500" : "bg-emerald-500"
    }`} />
  );
}

function FlagTag({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${color}`}>
      {label}
    </span>
  );
}

// ─── Summary metric chip ──────────────────────────────────────

function MetricChip({
  label,
  value,
  rag,
}: {
  label: string;
  value: string | number;
  rag: "red" | "amber" | "green";
}) {
  const border =
    rag === "red" ? "border-l-red-500" : rag === "amber" ? "border-l-amber-500" : "border-l-emerald-500";
  const text =
    rag === "red"
      ? "text-red-600 dark:text-red-400"
      : rag === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className={`flex flex-col gap-1 px-4 py-3 bg-card border border-border border-l-4 ${border} rounded-xl min-w-[110px]`}>
      <span className={`text-xl font-bold ${text}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

// ─── Customer row (shared across sections) ───────────────────

interface CustomerRowData {
  id: string;
  name: string;
  owner: string;
  region: string;
  grade: string;
  paymentStatus: string;
  dso: number;
  contractValue: number;
  contractExpiry?: string;
  flags: { label: string; color: string }[];
  urgency: "red" | "amber";
  href: string;
}

function CustomerRow({ row }: { row: CustomerRowData }) {
  return (
    <Link href={row.href}>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors cursor-pointer group min-w-0">
        <RagDot color={row.urgency} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">{row.name}</span>
            {row.flags.map((f, i) => (
              <FlagTag key={i} label={f.label} color={f.color} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            {row.owner} · {row.region}
            {row.contractExpiry ? ` · Expiry ${row.contractExpiry}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold">{formatSARCompact(row.contractValue)}</p>
          <p className="text-[10px] text-muted-foreground">DSO {row.dso}d</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─── Section wrapper ─────────────────────────────────────────

function PortfolioSection({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  viewAllHref,
  children,
  empty,
}: {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  subtitle: string;
  viewAllHref: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Link href={viewAllHref}>
          <span className="text-xs text-primary hover:underline flex items-center gap-1 whitespace-nowrap shrink-0">
            All customers <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>
      <div className="px-5 py-4 space-y-2">
        {empty ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm text-muted-foreground">No customers in this category</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface PortfolioTabProps {
  customers: Customer[];
  workspaces: Workspace[];
  signals: Signal[];
  renewalWorkspaces: RenewalWorkspace[];
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function PortfolioTab({ customers, workspaces, signals, renewalWorkspaces }: PortfolioTabProps) {
  const now = Date.now();

  // ── Summary metrics ─────────────────────────────────────────

  const metrics = useMemo(() => {
    const activeCustomers = customers.filter(c => c.status === "Active");
    const wrongFit = activeCustomers.filter(c => c.grade === "D" || c.grade === "F");
    const badPayers = activeCustomers.filter(c => c.paymentStatus === "Bad");
    const renewedIds = new Set(renewalWorkspaces.map(r => r.customerId));
    const renewalDue90 = activeCustomers.filter(c => {
      if (!c.contractExpiry) return false;
      const d = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
      return d >= 0 && d <= 90;
    });
    const keyAccountsAtRisk = activeCustomers.filter(c => {
      if (c.grade !== "A" && c.grade !== "B") return false;
      return signals.some(s => {
        const ws = workspaces.find(w => w.id === s.workspaceId);
        return ws?.customerId === c.id && (s.severity === "red" || s.severity === "amber");
      });
    });
    return { wrongFit, badPayers, renewalDue90, keyAccountsAtRisk };
  }, [customers, signals, workspaces]);

  // ── 1. Wrong-fit customers (Grade D/F) ──────────────────────

  const wrongFitRows = useMemo((): CustomerRowData[] => {
    return customers
      .filter(c => c.status === "Active" && (c.grade === "D" || c.grade === "F"))
      .sort((a, b) => (a.grade > b.grade ? 1 : -1))
      .slice(0, 6)
      .map(c => ({
        id: c.id,
        name: c.name,
        owner: c.accountOwner,
        region: c.region,
        grade: c.grade,
        paymentStatus: c.paymentStatus,
        dso: c.dso,
        contractValue: c.contractValue2025,
        contractExpiry: c.contractExpiry
          ? new Date(c.contractExpiry).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
          : undefined,
        flags: [
          { label: `Grade ${c.grade}`, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
          ...(c.paymentStatus === "Bad"
            ? [{ label: "Bad Payer", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }]
            : []),
        ],
        urgency: "red" as const,
        href: `/customers/${c.id}`,
      }));
  }, [customers]);

  // ── 2. Payment risk customers ────────────────────────────────

  const paymentRiskRows = useMemo((): CustomerRowData[] => {
    return customers
      .filter(c => c.status === "Active" && (c.paymentStatus === "Bad" || c.dso > 60))
      .sort((a, b) => b.dso - a.dso)
      .slice(0, 6)
      .map(c => {
        const flags = [];
        if (c.paymentStatus === "Bad") flags.push({ label: "Bad Payer", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" });
        if (c.paymentStatus === "Acceptable") flags.push({ label: "Late Payer", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" });
        if (c.dso > 90) flags.push({ label: `DSO ${c.dso}d`, color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" });
        else if (c.dso > 60) flags.push({ label: `DSO ${c.dso}d`, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" });
        return {
          id: c.id,
          name: c.name,
          owner: c.accountOwner,
          region: c.region,
          grade: c.grade,
          paymentStatus: c.paymentStatus,
          dso: c.dso,
          contractValue: c.contractValue2025,
          flags,
          urgency: c.paymentStatus === "Bad" ? "red" as const : "amber" as const,
          href: `/customers/${c.id}`,
        };
      });
  }, [customers]);

  // ── 3. Renewal risk (expiry ≤ 90d) ──────────────────────────

  const renewalRiskRows = useMemo((): CustomerRowData[] => {
    const renewedIds = new Set(renewalWorkspaces.map(r => r.customerId));
    return customers
      .filter(c => {
        if (c.status !== "Active" || !c.contractExpiry) return false;
        const d = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
        return d >= 0 && d <= 90;
      })
      .sort((a, b) => new Date(a.contractExpiry).getTime() - new Date(b.contractExpiry).getTime())
      .slice(0, 6)
      .map(c => {
        const days = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
        const hasRenewal = renewedIds.has(c.id);
        const flags = [];
        flags.push({
          label: `${days}d`,
          color: days <= 30
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        });
        if (!hasRenewal) flags.push({ label: "No workspace", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" });
        if (c.paymentStatus === "Bad") flags.push({ label: "Bad Payer", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" });
        return {
          id: c.id,
          name: c.name,
          owner: c.accountOwner,
          region: c.region,
          grade: c.grade,
          paymentStatus: c.paymentStatus,
          dso: c.dso,
          contractValue: c.contractValue2025,
          contractExpiry: new Date(c.contractExpiry).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }),
          flags,
          urgency: days <= 30 ? "red" as const : "amber" as const,
          href: `/customers/${c.id}`,
        };
      });
  }, [customers]);

  // ── 4. Key accounts with active signals ─────────────────────

  const keyAccountRows = useMemo((): CustomerRowData[] => {
    return customers
      .filter(c => {
        if (c.status !== "Active") return false;
        if (c.grade !== "A" && c.grade !== "B") return false;
        return signals.some(s => {
          const ws = workspaces.find(w => w.id === s.workspaceId);
          return ws?.customerId === c.id && (s.severity === "red" || s.severity === "amber");
        });
      })
      .slice(0, 5)
      .map(c => {
        const wsSignals = signals.filter(s => {
          const ws = workspaces.find(w => w.id === s.workspaceId);
          return ws?.customerId === c.id;
        });
        const worstSeverity = wsSignals.some(s => s.severity === "red") ? "red" : "amber";
        const topSignal = wsSignals.find(s => s.severity === worstSeverity);
        return {
          id: c.id,
          name: c.name,
          owner: c.accountOwner,
          region: c.region,
          grade: c.grade,
          paymentStatus: c.paymentStatus,
          dso: c.dso,
          contractValue: c.contractValue2025,
          flags: [
            { label: `Grade ${c.grade}`, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
            {
              label: worstSeverity === "red" ? "Critical Signal" : "Warning",
              color: worstSeverity === "red"
                ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            },
          ],
          urgency: worstSeverity,
          href: `/customers/${c.id}`,
        };
      });
  }, [customers, signals, workspaces]);

  // ── RENDER ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* SUMMARY STRIP */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 scrollbar-hide">
        <MetricChip
          label="Wrong-fit customers"
          value={metrics.wrongFit.length}
          rag={metrics.wrongFit.length > 0 ? "red" : "green"}
        />
        <MetricChip
          label="Bad payers"
          value={metrics.badPayers.length}
          rag={metrics.badPayers.length > 0 ? "red" : "green"}
        />
        <MetricChip
          label="Renewals due 90d"
          value={metrics.renewalDue90.length}
          rag={metrics.renewalDue90.filter(c => {
            const d = Math.ceil((new Date(c.contractExpiry).getTime() - now) / 86400000);
            return d <= 30;
          }).length > 0 ? "red" : metrics.renewalDue90.length > 0 ? "amber" : "green"}
        />
        <MetricChip
          label="Key accounts at risk"
          value={metrics.keyAccountsAtRisk.length}
          rag={metrics.keyAccountsAtRisk.length > 0 ? "amber" : "green"}
        />
      </div>

      {/* SECTION 1 — Wrong-fit / deteriorating */}
      <PortfolioSection
        icon={AlertOctagon}
        iconClass="text-red-500"
        title="Wrong-fit & Deteriorating Customers"
        subtitle="Grade D/F active customers consuming resources without adequate return"
        viewAllHref="/customers"
        empty={wrongFitRows.length === 0}
      >
        {wrongFitRows.map(row => <CustomerRow key={row.id} row={row} />)}
      </PortfolioSection>

      {/* SECTION 2 — Payment risk */}
      <PortfolioSection
        icon={CreditCard}
        iconClass="text-red-500"
        title="Payment Risk"
        subtitle="Bad payers, late payers, and customers with high DSO — cash exposure and collection risk"
        viewAllHref="/customers"
        empty={paymentRiskRows.length === 0}
      >
        {paymentRiskRows.map(row => <CustomerRow key={row.id} row={row} />)}
      </PortfolioSection>

      {/* SECTION 3 — Renewal risk */}
      <PortfolioSection
        icon={RefreshCw}
        iconClass="text-amber-500"
        title="Renewal Risk"
        subtitle="Contracts expiring within 90 days — review, renew, fix, exit, or replace"
        viewAllHref="/renewals"
        empty={renewalRiskRows.length === 0}
      >
        {renewalRiskRows.map(row => <CustomerRow key={row.id} row={row} />)}
      </PortfolioSection>

      {/* SECTION 4 — Key accounts at risk */}
      {keyAccountRows.length > 0 && (
        <PortfolioSection
          icon={Star}
          iconClass="text-indigo-500"
          title="Key Accounts Requiring Attention"
          subtitle="Grade A/B customers with active warning or critical signals — protect strategic relationships"
          viewAllHref="/customers"
          empty={keyAccountRows.length === 0}
        >
          {keyAccountRows.map(row => <CustomerRow key={row.id} row={row} />)}
        </PortfolioSection>
      )}

    </div>
  );
}
