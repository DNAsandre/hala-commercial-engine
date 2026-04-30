/**
 * Portfolio — Customer Decision Engine
 *
 * DOCTRINE:
 *   One customer = ONE portfolio category = ONE place on this page.
 *   Signals are attached to the customer row — not repeated as separate rows.
 *   Recommended Action is the dominant field.
 *   Grade (ECR proxy) is the base classifier; signals modify it.
 *
 * Structure:
 *   Header → Decision Strip → Filters → 5 Decision Sections
 *   Sections (in priority order):
 *     1. Exit / Replace  — D/F + bad behavior
 *     2. Fix             — recoverable problems
 *     3. Monitor         — stable but needs watching
 *     4. Protect         — A/B accounts with risk signals
 *     5. Grow            — clean high-quality accounts
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  AlertOctagon,
  TrendingDown,
  Eye,
  Shield,
  TrendingUp,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { useCustomers, useTenders, useRenewalWorkspaces } from "@/hooks/useSupabase";
import { formatSARCompact } from "@/lib/store";
import {
  buildPortfolioViews,
  buildPortfolioSummary,
  sortByUrgency,
  PORTFOLIO_CATEGORY_STYLES,
  ECR_GRADE_STYLES,
  type CustomerPortfolioView,
  type PortfolioCategory,
  type PortfolioSignal,
  type SignalSeverity,
} from "@/lib/portfolio-engine";

// ─────────────────────────────────────────────────────────────
// SIGNAL TAG
// ─────────────────────────────────────────────────────────────

const SEVERITY_PILL: Record<SignalSeverity, string> = {
  critical: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50",
  warning:  "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50",
  info:     "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50",
};

function SignalPill({ signal }: { signal: PortfolioSignal }) {
  return (
    <span
      title={signal.detail}
      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 cursor-help ${SEVERITY_PILL[signal.severity]}`}
    >
      {signal.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// GRADE BADGE
// ─────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const style = ECR_GRADE_STYLES[grade as keyof typeof ECR_GRADE_STYLES]
    ?? { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300" };
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 ${style.bg} ${style.text}`}
      title={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER CARD
// One customer, one place. Action is dominant.
// ─────────────────────────────────────────────────────────────

function CustomerCard({ view }: { view: CustomerPortfolioView }) {
  const { customer, ecr, signals, category, renewalWindowStatus, renewalDaysToExpiry } = view;
  const catStyle = PORTFOLIO_CATEGORY_STYLES[category];

  // Primary action label — most important thing on the card
  const primaryAction = ecr?.recommendation ?? catStyle.label;

  // Sort: critical first, then warning, then info
  const sortedSignals = [...signals].sort((a, b) => {
    const order: Record<SignalSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const hasCritical = signals.some(s => s.severity === "critical");
  const urgencyBorder = hasCritical
    ? "border-l-red-500"
    : signals.some(s => s.severity === "warning")
    ? "border-l-amber-400"
    : "border-l-transparent";

  return (
    <Link href={`/customers/${customer.id}`}>
      <div className={`flex items-start gap-3 p-3.5 rounded-xl border border-border border-l-4 ${urgencyBorder} hover:bg-muted/30 transition-all cursor-pointer group min-w-0`}>

        {/* Grade */}
        <GradeBadge grade={ecr?.overallGrade ?? customer.grade} />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1.5">

          {/* Row 1: Name */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {customer.name}
            </span>
            {view.activeTendersCount > 0 && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">
                {view.activeTendersCount} tender{view.activeTendersCount > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Row 2: Owner · Region · Renewal context */}
          <p className="text-[10px] text-muted-foreground truncate">
            {customer.accountOwner}
            {customer.region ? ` · ${customer.region}` : ""}
            {renewalWindowStatus === "expired" && renewalDaysToExpiry !== null && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {` · Contract expired ${Math.abs(renewalDaysToExpiry)}d ago`}
              </span>
            )}
            {renewalWindowStatus !== "none" && renewalWindowStatus !== "expired" && renewalDaysToExpiry !== null && (
              <span className={`font-medium ${
                renewalWindowStatus === "30d" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              }`}>
                {` · Renews in ${renewalDaysToExpiry}d`}
              </span>
            )}
          </p>

          {/* Row 3: Signals — ALL signals, compact */}
          {sortedSignals.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {sortedSignals.map(s => <SignalPill key={s.key} signal={s} />)}
            </div>
          )}
        </div>

        {/* Right column: value + DSO + PRIMARY ACTION */}
        <div className="text-right shrink-0 space-y-1 min-w-[100px]">
          <p className="text-sm font-bold">
            {formatSARCompact(customer.contractValue2025)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            DSO {customer.dso}d
          </p>
          {/* PRIMARY ACTION — dominant, coloured */}
          <p className={`text-[9px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 inline-block ${catStyle.bg} ${catStyle.text}`}>
            → {primaryAction}
          </p>
        </div>

        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// DECISION SECTION
// ─────────────────────────────────────────────────────────────

function DecisionSection({
  icon: Icon,
  iconClass,
  bgClass,
  title,
  subtitle,
  views,
  emptyMessage,
  viewAllHref,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  title: string;
  subtitle: string;
  views: CustomerPortfolioView[];
  emptyMessage: string;
  viewAllHref?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || views.length > 0);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-muted/10 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
            <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                views.length > 0
                  ? "bg-foreground/10 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {views.length}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-lg">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {viewAllHref && views.length > 0 && (
            <Link href={viewAllHref}>
              <span
                onClick={e => e.stopPropagation()}
                className="text-xs text-primary hover:underline"
              >
                View all →
              </span>
            </Link>
          )}
          <span className="text-[10px] text-muted-foreground font-mono">
            {open ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 py-4 space-y-2">
          {views.length === 0 ? (
            <div className="flex items-center gap-2 py-5 justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            views.map(v => <CustomerCard key={v.customer.id} view={v} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DECISION STRIP CHIP
// ─────────────────────────────────────────────────────────────

function DecisionChip({
  icon: Icon,
  iconClass,
  borderClass,
  valueClass,
  label,
  value,
  sub,
  active,
  onClick,
}: {
  icon: React.ElementType;
  iconClass: string;
  borderClass: string;
  valueClass: string;
  label: string;
  value: number;
  sub?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-1.5 px-4 py-3.5 bg-card border border-border border-l-4 ${borderClass} rounded-xl min-w-[148px] flex-1 text-left transition-all ${
        active ? "ring-2 ring-primary/50 shadow-sm" : "hover:shadow-sm hover:border-border"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconClass}`} />
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${valueClass}`}>{value}</span>
      {sub && <span className="text-[9px] text-muted-foreground">{sub}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

type ActiveFilter = "all" | PortfolioCategory;

export default function Portfolio() {
  const { data: customers, loading: custLoading } = useCustomers();
  const { data: tenders,   loading: tendersLoading } = useTenders();
  const { data: renewalWorkspaces, loading: renewalsLoading } = useRenewalWorkspaces();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loading = custLoading || tendersLoading || renewalsLoading;

  // ── Build portfolio ────────────────────────────────────────
  const allViews = useMemo(() => {
    if (loading || customers.length === 0) return [];
    return sortByUrgency(buildPortfolioViews(customers, renewalWorkspaces, tenders));
  }, [customers, renewalWorkspaces, tenders, loading]);

  const summary = useMemo(() => buildPortfolioSummary(allViews), [allViews]);

  // ── Filter options ─────────────────────────────────────────
  const owners = useMemo(
    () => Array.from(new Set(customers.map(c => c.accountOwner).filter(Boolean))).sort(),
    [customers]
  );
  const regions = useMemo(
    () => Array.from(new Set(customers.map(c => c.region).filter(Boolean))).sort(),
    [customers]
  );

  // ── Apply filters ──────────────────────────────────────────
  const filteredViews = useMemo(() => {
    let views = allViews;
    if (activeFilter !== "all") views = views.filter(v => v.category === activeFilter);
    if (regionFilter !== "all") views = views.filter(v => v.customer.region === regionFilter);
    if (ownerFilter  !== "all") views = views.filter(v => v.customer.accountOwner === ownerFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      views = views.filter(v =>
        v.customer.name.toLowerCase().includes(q) ||
        v.customer.code.toLowerCase().includes(q) ||
        v.customer.accountOwner.toLowerCase().includes(q)
      );
    }
    return views;
  }, [allViews, activeFilter, regionFilter, ownerFilter, search]);

  // ── ONE customer per section — partition by category ───────
  const byCategory = (cat: PortfolioCategory) =>
    filteredViews.filter(v => v.category === cat);

  const exitViews    = byCategory("Exit / Replace");
  const fixViews     = byCategory("Fix");
  const monitorViews = byCategory("Monitor");
  const protectViews = byCategory("Protect");
  const growViews    = byCategory("Grow");

  // ── Renewal requiring decision (for strip) ─────────────────
  const renewalDecisionRequired = allViews.filter(v => v.renewalActionRequired).length;

  const atRisk = summary.protectCount + summary.monitorCount;

  if (loading && customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading portfolio…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-bold">Portfolio Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {summary.totalActive} active customers ·{" "}
            <span className={`font-medium ${summary.exitReplaceCount + summary.fixCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              {summary.exitReplaceCount + summary.fixCount} require action
            </span>{" "}
            · {summary.growCount} growing
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-wrap text-xs">
          {(
            [
              { key: "all",            label: "All" },
              { key: "Exit / Replace", label: "Exit / Replace" },
              { key: "Fix",            label: "Fix" },
              { key: "Monitor",        label: "Monitor" },
              { key: "Protect",        label: "Protect" },
              { key: "Grow",           label: "Grow" },
            ] as { key: ActiveFilter; label: string }[]
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-3 py-1.5 font-medium rounded-md transition-all ${
                activeFilter === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1 text-[9px] opacity-60">
                  {allViews.filter(v => v.category === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── DECISION STRIP — decisions, not signal types ─────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <DecisionChip
          icon={AlertOctagon}
          iconClass="text-red-500"
          borderClass="border-l-red-500"
          valueClass="text-red-600 dark:text-red-400"
          label="Fix / Exit Required"
          value={summary.exitReplaceCount + summary.fixCount}
          sub={`${summary.exitReplaceCount} exit · ${summary.fixCount} fix`}
          active={activeFilter === "Exit / Replace" || activeFilter === "Fix"}
          onClick={() => setActiveFilter(activeFilter === "Exit / Replace" ? "all" : "Exit / Replace")}
        />
        <DecisionChip
          icon={Eye}
          iconClass="text-amber-500"
          borderClass="border-l-amber-500"
          valueClass="text-amber-600 dark:text-amber-400"
          label="At Risk — Monitor / Protect"
          value={atRisk}
          sub={`${summary.protectCount} protect · ${summary.monitorCount} monitor`}
          active={activeFilter === "Monitor" || activeFilter === "Protect"}
          onClick={() => setActiveFilter(activeFilter === "Monitor" ? "all" : "Monitor")}
        />
        <DecisionChip
          icon={AlertOctagon}
          iconClass="text-orange-500"
          borderClass="border-l-orange-500"
          valueClass="text-orange-600 dark:text-orange-400"
          label="Renewals Requiring Decision"
          value={renewalDecisionRequired}
          sub={`${summary.renewalsUrgentCount} urgent (≤30d)`}
        />
        <DecisionChip
          icon={TrendingUp}
          iconClass="text-emerald-500"
          borderClass="border-l-emerald-500"
          valueClass="text-emerald-600 dark:text-emerald-400"
          label="Healthy / Grow"
          value={summary.growCount}
          sub="Clean accounts — expand"
          active={activeFilter === "Grow"}
          onClick={() => setActiveFilter(activeFilter === "Grow" ? "all" : "Grow")}
        />
      </div>

      {/* ── SEARCH + FILTERS ──────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customer, code, owner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm bg-muted rounded-md border-0 w-60 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-all ${
            filtersOpen || regionFilter !== "all" || ownerFilter !== "all"
              ? "border-primary text-primary bg-primary/5"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {(regionFilter !== "all" || ownerFilter !== "all") && (
            <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-primary text-primary-foreground">
              {[regionFilter !== "all", ownerFilter !== "all"].filter(Boolean).length}
            </span>
          )}
        </button>

        {filtersOpen && (
          <>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-muted border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              className="h-8 px-2 text-xs bg-muted border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Owners</option>
              {owners.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {(regionFilter !== "all" || ownerFilter !== "all") && (
              <button
                onClick={() => { setRegionFilter("all"); setOwnerFilter("all"); }}
                className="text-xs text-muted-foreground hover:text-red-500"
              >
                Clear
              </button>
            )}
          </>
        )}

        <span className="text-xs text-muted-foreground ml-auto">
          {filteredViews.length} of {allViews.length} customers
        </span>
      </div>

      {/* ── DECISION SECTIONS — ONE customer, ONE section ─────── */}

      {/* 1. EXIT / REPLACE */}
      <DecisionSection
        icon={AlertOctagon}
        iconClass="text-red-600"
        bgClass="bg-red-100 dark:bg-red-900/30"
        title="Exit / Replace"
        subtitle="Grade F · grade D with expired contract · bad behavior with no recovery path. Decision required: exit or replace."
        views={exitViews}
        emptyMessage="No exit / replace candidates — portfolio is clean"
      />

      {/* 2. FIX */}
      <DecisionSection
        icon={TrendingDown}
        iconClass="text-amber-600"
        bgClass="bg-amber-100 dark:bg-amber-900/30"
        title="Fix"
        subtitle="Grade D · bad payers · C-grade with serious issues still recoverable. Intervention required before renewal."
        views={fixViews}
        emptyMessage="No customers currently in Fix"
      />

      {/* 3. MONITOR */}
      <DecisionSection
        icon={Eye}
        iconClass="text-slate-600 dark:text-slate-300"
        bgClass="bg-slate-100 dark:bg-slate-800"
        title="Monitor"
        subtitle="Grade C · early signals · stable but watch. No immediate action — but do not let slide."
        views={monitorViews}
        emptyMessage="No customers in Monitor — portfolio is healthy"
        defaultOpen={monitorViews.length > 0 && activeFilter !== "all" ? true : false}
      />

      {/* 4. PROTECT */}
      <DecisionSection
        icon={Shield}
        iconClass="text-indigo-600"
        bgClass="bg-indigo-100 dark:bg-indigo-900/30"
        title="Protect"
        subtitle="Grade A/B with active risk signals. Strategic accounts — protect the relationship before damage occurs."
        views={protectViews}
        emptyMessage="No key accounts currently at risk"
      />

      {/* 5. GROW */}
      <DecisionSection
        icon={TrendingUp}
        iconClass="text-emerald-600"
        bgClass="bg-emerald-100 dark:bg-emerald-900/30"
        title="Grow"
        subtitle="Grade A/B · clean payment history · good strategic fit. Focus commercial energy here — expand and lock in."
        views={growViews}
        emptyMessage="No customers currently in Grow category"
        defaultOpen={growViews.length > 0}
      />

    </div>
  );
}
