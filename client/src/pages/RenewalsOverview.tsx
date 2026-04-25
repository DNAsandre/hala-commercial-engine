/**
 * Renewals Overview — Swimlane View by Renewal Lifecycle Stage
 *
 * Structurally IDENTICAL to TendersOverview:
 *   - Vertical swimlanes: each row = one renewal milestone
 *   - Cards inside each lane are 2-wide max
 *   - Clicking a card navigates to Renewal workspace detail
 *
 * Only change: data source, milestone labels, card content (renewal-specific)
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  RotateCcw,
  Search,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldAlert,
  XCircle,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  renewalWorkspaces,
  getBaseline,
  getLatestRenewalVersion,
  getLatestGateEvaluation,
  getLatestDelta,
  getDaysUntilExpiry,
  getExpiryUrgency,
  formatSAR,
  type RenewalWorkspace,
  type RenewalWorkspaceStatus,
  type RenewalDecision,
} from "@/lib/renewal-engine";
import { getEcrScoreByCustomerName } from "@/lib/ecr";

// ─── RENEWAL MILESTONES (swimlane stages) ────────────────────────

type RenewalMilestone = string;

const RENEWAL_MILESTONES: { value: RenewalMilestone; label: string }[] = [
  { value: "draft", label: "Assessment" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Decision Approved" },
  { value: "rejected", label: "Exited / Rejected" },
  { value: "locked", label: "Outcome Locked" },
];

const ALL_MILESTONES = RENEWAL_MILESTONES.map(m => m.value);
const MAIN_MILESTONES = ALL_MILESTONES.filter(v => v !== "rejected");

// ─── STAGE ACCENT COLORS (matching Tender swimlane aesthetic) ────

const MILESTONE_ACCENT: Record<string, string> = {
  draft:          "border-l-slate-400 bg-slate-50 dark:bg-slate-900/20",
  under_review:   "border-l-amber-400 bg-amber-50 dark:bg-amber-900/20",
  approved:       "border-l-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  rejected:       "border-l-red-400 bg-red-50 dark:bg-red-900/20",
  locked:         "border-l-blue-400 bg-blue-50 dark:bg-blue-900/20",
};

const MILESTONE_LABEL_COLOR: Record<string, string> = {
  draft:          "text-slate-600 dark:text-slate-400",
  under_review:   "text-amber-600 dark:text-amber-400",
  approved:       "text-emerald-600 dark:text-emerald-400",
  rejected:       "text-red-600 dark:text-red-400",
  locked:         "text-blue-600 dark:text-blue-400",
};

// ─── ENRICHED RENEWAL TYPE ───────────────────────────────────────

interface EnrichedRenewal extends RenewalWorkspace {
  daysLeft: number;
  urgencyLabel: string;
  urgencyColor: string;
  ecrGrade: string;
  recommendation: string;
  recommendationColor: string;
  baselineValue: number;
  renewalValue: number;
  gpDelta: number;
  hasWarnings: boolean;
  riskCount: number;
  gateResult: string;
}

function enrichRenewal(rw: RenewalWorkspace): EnrichedRenewal {
  const baseline = getBaseline(rw.baselineId);
  const latestVersion = getLatestRenewalVersion(rw.id);
  const gateEval = getLatestGateEvaluation(rw.id);
  const delta = getLatestDelta(rw.id);
  const daysLeft = baseline ? getDaysUntilExpiry(baseline.baselineEndDate) : 999;
  const urgency = getExpiryUrgency(daysLeft);
  const ecr = getEcrScoreByCustomerName(rw.customerName);
  const hasWarnings = gateEval ? gateEval.gates.some(g => g.result === "warn" || g.result === "block") : false;
  const gpDelta = latestVersion && baseline ? latestVersion.pricingSnapshot.gpPercent - baseline.pricingSnapshot.gpPercent : 0;

  // Decision interpretation
  const recMap: Record<RenewalDecision, { label: string; color: string }> = {
    renew: { label: "Renew", color: "text-emerald-600" },
    renegotiate: { label: "Renegotiate", color: "text-amber-600" },
    exit: { label: "Exit", color: "text-red-600" },
    pending: { label: "Pending", color: "text-muted-foreground" },
  };

  return {
    ...rw,
    daysLeft,
    urgencyLabel: urgency.label,
    urgencyColor: urgency.color,
    ecrGrade: ecr?.grade || "N/A",
    recommendation: recMap[rw.renewalDecision].label,
    recommendationColor: recMap[rw.renewalDecision].color,
    baselineValue: baseline?.pricingSnapshot.annualRevenue || 0,
    renewalValue: latestVersion?.pricingSnapshot.annualRevenue || 0,
    gpDelta,
    hasWarnings,
    riskCount: delta?.riskFlagsJson.length || 0,
    gateResult: gateEval?.result || "none",
  };
}

// ─── MINI LIFECYCLE BAR (matching Tender bar exactly) ────────────

function MiniLifecycleBar({ current }: { current: string }) {
  const currentIdx = MAIN_MILESTONES.indexOf(current);
  const isTerminal = current === "rejected";

  return (
    <div className="flex items-center gap-0.5 mb-3">
      {MAIN_MILESTONES.map((stage, i) => {
        let color: string;
        if (stage === current) color = "bg-[var(--color-hala-navy)] h-2";
        else if (isTerminal) color = "bg-red-400 h-1.5";
        else if (i < currentIdx) color = "bg-emerald-400 h-1.5";
        else if (i === currentIdx + 1) color = "bg-border h-1.5 border border-dashed border-slate-300";
        else color = "bg-muted h-1.5";
        return (
          <div
            key={stage}
            title={RENEWAL_MILESTONES.find(m => m.value === stage)?.label || stage}
            className={`flex-1 rounded-sm transition-all ${color}`}
          />
        );
      })}
    </div>
  );
}

// ─── SWIMLANE CARD (matching Tender card, renewal content) ───────

function SwimLaneCard({
  renewal,
  onClick,
}: {
  renewal: EnrichedRenewal;
  onClick: () => void;
}) {
  const isExpired = renewal.daysLeft < 0;
  const isUrgent = renewal.daysLeft >= 0 && renewal.daysLeft <= 30;
  const isCriticalBorder = (isExpired || isUrgent) && renewal.renewalDecision === "pending";

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group ${
        isCriticalBorder ? "border-red-300" : "border-border"
      }`}
    >
      <CardContent className="p-4">
        {/* Mini lifecycle bar */}
        <MiniLifecycleBar current={renewal.status} />

        {/* Customer + renewal */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold truncate">{renewal.customerName}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate leading-snug">
            {renewal.renewalCycleName}
          </p>
        </div>

        {/* Decision signals row */}
        <div className="flex items-center gap-3 mb-3">
          {/* ECR */}
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-semibold ${
              renewal.ecrGrade === "A" || renewal.ecrGrade === "B" ? "text-emerald-600" :
              renewal.ecrGrade === "C" ? "text-amber-600" :
              renewal.ecrGrade === "D" || renewal.ecrGrade === "F" ? "text-red-600" :
              "text-muted-foreground"
            }`}>ECR {renewal.ecrGrade}</span>
          </div>
          {/* Recommendation */}
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-semibold ${renewal.recommendationColor}`}>{renewal.recommendation}</span>
          </div>
          {/* Time */}
          <div className="flex items-center gap-1">
            {(isExpired || isUrgent) && <Clock className="w-2.5 h-2.5 text-red-500" />}
            <span className={`text-[10px] font-medium ${
              isExpired ? "text-red-600" :
              renewal.daysLeft <= 30 ? "text-red-600" :
              renewal.daysLeft <= 90 ? "text-amber-600" :
              "text-emerald-600"
            }`}>
              {isExpired ? `Expired ${Math.abs(renewal.daysLeft)}d` :
               renewal.daysLeft <= 30 ? "Urgent" :
               renewal.daysLeft <= 90 ? "At Risk" :
               "On Track"}
            </span>
          </div>
        </div>

        {/* Footer — value + signal tag */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground">VALUE</p>
            <p className="text-xs font-mono font-semibold">{formatSAR(renewal.baselineValue)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">GP% Δ</p>
            <p className={`text-xs font-semibold ${renewal.gpDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {renewal.gpDelta >= 0 ? "+" : ""}{renewal.gpDelta.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            {isCriticalBorder && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-semibold">No Strategy</span>
              </div>
            )}
            {!isCriticalBorder && renewal.hasWarnings && (
              <div className="flex items-center gap-1 text-amber-600">
                <ShieldAlert className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Gates Warn</span>
              </div>
            )}
            {!isCriticalBorder && !renewal.hasWarnings && renewal.renewalDecision === "exit" && (
              <div className="flex items-center gap-1 text-red-600">
                <XCircle className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Exit</span>
              </div>
            )}
            {!isCriticalBorder && !renewal.hasWarnings && renewal.renewalDecision === "renew" && (
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Renew</span>
              </div>
            )}
            {!isCriticalBorder && !renewal.hasWarnings && renewal.renewalDecision === "renegotiate" && (
              <div className="flex items-center gap-1 text-amber-600">
                <TrendingDown className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Renegotiate</span>
              </div>
            )}
            {!isCriticalBorder && !renewal.hasWarnings && renewal.renewalDecision === "pending" && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-semibold">Pending</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────

export default function RenewalsOverview() {
  const [, navigate] = useLocation();
  const [filterSearch, setFilterSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterDecision, setFilterDecision] = useState("all");

  // Enrich all renewals
  const enriched = useMemo(
    () => renewalWorkspaces.map(enrichRenewal),
    []
  );

  const owners = useMemo(
    () => Array.from(new Set(enriched.map(r => r.ownerName))).sort(),
    [enriched]
  );

  const filtered = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return enriched.filter(r => {
      if (filterOwner !== "all" && r.ownerName !== filterOwner) return false;
      if (filterDecision !== "all" && r.renewalDecision !== filterDecision) return false;
      if (
        search &&
        !r.customerName.toLowerCase().includes(search) &&
        !r.renewalCycleName.toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [enriched, filterSearch, filterOwner, filterDecision]);

  // Group by milestone — preserving order
  const byMilestone = useMemo(() => {
    const map = new Map<string, EnrichedRenewal[]>();
    for (const ms of ALL_MILESTONES) {
      const cards = filtered.filter(r => r.status === ms);
      if (cards.length > 0) map.set(ms, cards);
    }
    return map;
  }, [filtered]);

  const totalValue = filtered.reduce((s, r) => s + r.baselineValue, 0);
  const atRiskCount = filtered.filter(r => r.daysLeft <= 90 && r.daysLeft >= 0).length;

  function getMilestoneLabel(value: string): string {
    return RENEWAL_MILESTONES.find(m => m.value === value)?.label || value;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header — matching Tender Overview exactly */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Renewals Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} renewals · {byMilestone.size} active stages ·{" "}
            {formatSAR(totalValue)} portfolio value
            {atRiskCount > 0 && <span className="text-amber-600"> · {atRiskCount} at risk</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/renewals")}>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Renewal Engine
          </Button>
        </div>
      </div>

      {/* Search + Filters — matching Tender layout */}
      <div className="space-y-2 mb-6">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customer or renewal name..."
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDecision} onValueChange={setFilterDecision}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Decisions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Decisions</SelectItem>
              <SelectItem value="renew">Renew</SelectItem>
              <SelectItem value="renegotiate">Renegotiate</SelectItem>
              <SelectItem value="exit">Exit</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          {(filterSearch || filterOwner !== "all" || filterDecision !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setFilterSearch(""); setFilterOwner("all"); setFilterDecision("all"); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Swimlane View — EXACT same structure as Tender/Commercial Overview */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No renewals match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-0 rounded-xl border border-border overflow-hidden">
          {ALL_MILESTONES.map(ms => {
            const cards = byMilestone.get(ms);
            if (!cards || cards.length === 0) return null;

            return (
              <div
                key={ms}
                className={`flex gap-0 border-b last:border-b-0 border-border ${MILESTONE_ACCENT[ms] || "bg-muted/20"} border-l-4`}
              >
                {/* Milestone label — left column */}
                <div className="w-44 shrink-0 px-4 py-4 border-r border-border/60 flex flex-col justify-start">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${MILESTONE_LABEL_COLOR[ms] || "text-muted-foreground"}`}>
                    {getMilestoneLabel(ms)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {cards.length} renewal{cards.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatSAR(cards.reduce((s, r) => s + r.baselineValue, 0))}
                  </span>
                </div>

                {/* Cards — 2-column grid */}
                <div className="flex-1 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {cards.map(r => (
                      <SwimLaneCard
                        key={r.id}
                        renewal={r}
                        onClick={() => navigate(`/renewals/${r.id}`)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
