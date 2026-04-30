/*
 * Renewals Pipeline — ECR-Centered Portfolio Decision Engine
 *
 * Structural clone of Tender Pipeline:
 *   1. Page title + summary metrics
 *   2. Filters (first)
 *   3. Search (second)
 *   4. Tabs (Overview, Commercial, Delivery, Risk & Signals, Customer, Documents, Activity, Audit Trail)
 *   5. Lifecycle strip + detail panel
 *   6. List cards on left
 *
 * Renewal stages (NOT sales stages):
 *   Active Contract → Renewal Triggered → Customer Assessment →
 *   Strategy Defined → Decision Pending → Decision Approved →
 *   Contract Update → Outcome
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  RotateCcw,
  Search,
  X,
  ChevronDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldAlert,
  XCircle,
  TrendingDown,
  TrendingUp,
  Users,
  Activity,
  Zap,
  ArrowLeft,
  FileText,
  Shield,
  Target,
  DollarSign,
  Building2,
} from "lucide-react";
import { WorkspaceRiskSignalsTab } from "@/components/WorkspaceRiskSignalsTab";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getRenewalAudit,
  formatSAR,
  type RenewalWorkspace,
  type RenewalWorkspaceStatus,
  type RenewalDecision,
} from "@/lib/renewal-engine";
import { getEcrScoreByCustomerName } from "@/lib/ecr";
import { useLocation } from "wouter";
import { LifecycleLight, getLightState } from "@/components/LifecycleLight";

// ─── RENEWAL MILESTONES (ECR-derived, not sales pipeline) ────────

const RENEWAL_STAGES = [
  { value: "active_contract",    label: "Active Contract" },
  { value: "renewal_triggered",  label: "Renewal Triggered" },
  { value: "customer_assessment",label: "Customer Assessment" },
  { value: "strategy_defined",   label: "Strategy Defined" },
  { value: "decision_pending",   label: "Decision Pending" },
  { value: "decision_approved",  label: "Decision Approved" },
  { value: "contract_update",    label: "Contract Update" },
  { value: "outcome",            label: "Outcome" },
] as const;

type RenewalStage = typeof RENEWAL_STAGES[number]["value"];

const STAGE_VALUES = RENEWAL_STAGES.map(s => s.value);
const STRIP_STAGES = STAGE_VALUES.filter(v => v !== "outcome");

// Map existing RenewalWorkspaceStatus to our pipeline stages
function mapToRenewalStage(rw: RenewalWorkspace): RenewalStage {
  const baseline = getBaseline(rw.baselineId);
  const daysLeft = baseline ? getDaysUntilExpiry(baseline.baselineEndDate) : 999;
  const ecr = getEcrScoreByCustomerName(rw.customerName);

  if (rw.status === "locked") return "outcome";
  if (rw.status === "rejected") return "outcome";
  if (rw.status === "approved" && rw.renewalDecision !== "pending") return "decision_approved";
  if (rw.status === "under_review" && rw.renewalDecision !== "pending") return "strategy_defined";
  if (rw.status === "under_review" && rw.renewalDecision === "pending") return "decision_pending";
  if (rw.status === "draft" && ecr) return "customer_assessment";
  if (rw.status === "draft" && daysLeft <= 180) return "renewal_triggered";
  return "active_contract";
}

// Outcome tag for terminal states
function getOutcomeTag(rw: RenewalWorkspace): string {
  if (rw.status === "rejected") return rw.renewalDecision === "exit" ? "Exited" : "Rejected";
  if (rw.status === "locked") {
    if (rw.renewalDecision === "renew") return "Renewed";
    if (rw.renewalDecision === "renegotiate") return "Amended";
    return "Renewed";
  }
  return "";
}

// ─── ENRICHED RENEWAL ────────────────────────────────────────────

interface EnrichedRenewal extends RenewalWorkspace {
  stage: RenewalStage;
  outcomeTag: string;
  daysLeft: number;
  urgencyLabel: string;
  urgencyColor: string;
  ecrGrade: string;
  ecrScore: number | null;
  recommendation: string;
  recommendationColor: string;
  baselineValue: number;
  renewalValue: number;
  gpDelta: number;
  hasWarnings: boolean;
  riskCount: number;
  gateResult: string;
  riskFlags: string[];
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

  const recMap: Record<RenewalDecision, { label: string; color: string }> = {
    renew: { label: "Renew", color: "text-emerald-600" },
    renegotiate: { label: "Amend / Reprice", color: "text-amber-600" },
    exit: { label: "Exit", color: "text-red-600" },
    pending: { label: "Pending", color: "text-muted-foreground" },
  };

  const flags: string[] = [];
  if (!ecr) flags.push("ECR Missing");
  if (daysLeft < 0) flags.push("Expired");
  if (daysLeft >= 0 && daysLeft <= 30) flags.push("Expiry Critical");
  if (gpDelta < -3) flags.push("Margin Deteriorating");
  if (hasWarnings) flags.push("Gate Warnings");
  if (rw.renewalDecision === "pending" && daysLeft <= 90) flags.push("Strategy Missing");

  return {
    ...rw,
    stage: mapToRenewalStage(rw),
    outcomeTag: getOutcomeTag(rw),
    daysLeft,
    urgencyLabel: urgency.label,
    urgencyColor: urgency.color,
    ecrGrade: ecr?.grade || "N/A",
    ecrScore: ecr?.totalScore ?? null,
    recommendation: recMap[rw.renewalDecision].label,
    recommendationColor: recMap[rw.renewalDecision].color,
    baselineValue: baseline?.pricingSnapshot.annualRevenue || 0,
    renewalValue: latestVersion?.pricingSnapshot.annualRevenue || 0,
    gpDelta,
    hasWarnings,
    riskCount: delta?.riskFlagsJson.length || 0,
    gateResult: gateEval?.result || "none",
    riskFlags: flags,
  };
}

// ─── STAGE COLORS ────────────────────────────────────────────────

function getStageColor(stage: RenewalStage): string {
  const map: Record<string, string> = {
    active_contract:     "text-slate-600 bg-slate-50 border-slate-200",
    renewal_triggered:   "text-blue-700 bg-blue-50 border-blue-200",
    customer_assessment: "text-indigo-700 bg-indigo-50 border-indigo-200",
    strategy_defined:    "text-violet-700 bg-violet-50 border-violet-200",
    decision_pending:    "text-amber-700 bg-amber-50 border-amber-200",
    decision_approved:   "text-emerald-700 bg-emerald-50 border-emerald-200",
    contract_update:     "text-teal-700 bg-teal-50 border-teal-200",
    outcome:             "text-green-700 bg-green-50 border-green-200",
  };
  return map[stage] || "text-gray-600 bg-gray-50 border-gray-200";
}

function getStageLabelColor(stage: string): string {
  const map: Record<string, string> = {
    active_contract:     "text-slate-600",
    renewal_triggered:   "text-blue-600",
    customer_assessment: "text-indigo-600",
    strategy_defined:    "text-violet-600",
    decision_pending:    "text-amber-600",
    decision_approved:   "text-emerald-600",
    contract_update:     "text-teal-600",
    outcome:             "text-green-600",
  };
  return map[stage] || "text-muted-foreground";
}

// ─── MILESTONE STRIP ─────────────────────────────────────────────

function MilestoneStrip({ current }: { current: RenewalStage }) {
  const currentIdx = STRIP_STAGES.indexOf(current as typeof STRIP_STAGES[number]);
  const isOutcome = current === "outcome";
  const suggestedIdx = isOutcome ? -1 : currentIdx + 1;

  return (
    <div>
      {/* Strip — button nodes with connectors (matching Commercial / Tender exactly) */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
        {STRIP_STAGES.map((s, i) => {
          const isCurrent = s === current && !isOutcome;
          const isPast = !isOutcome && i < currentIdx;
          const isSuggested = i === suggestedIdx;
          const label = RENEWAL_STAGES.find(rs => rs.value === s)?.label || s;

          return (
            <div key={s} className="flex items-center shrink-0">
              {/* Step node */}
              <div
                className={`
                  relative flex flex-col items-center px-3 py-2 rounded-lg transition-all
                  ${isCurrent
                    ? "bg-[var(--color-hala-navy)] text-white shadow-md"
                    : isPast
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      : isSuggested
                        ? "border border-dashed border-primary/50 text-primary"
                        : "text-muted-foreground/50"
                  }
                `}
              >
                {/* 3D LED Light */}
                <LifecycleLight state={getLightState(i, currentIdx, isOutcome)} size={12} className="mb-1.5" />
                <span className={`text-[10px] font-medium whitespace-nowrap leading-none ${
                  isCurrent ? "text-white font-semibold" : ""
                }`}>
                  {label}
                </span>

              </div>

              {/* Connector */}
              {i < STRIP_STAGES.length - 1 && (
                <div className={`h-px w-4 shrink-0 ${
                  i < currentIdx ? "bg-emerald-400" : "bg-muted-foreground/15"
                }`} />
              )}
            </div>
          );
        })}

        {/* Terminal state — separated */}
        <div className="ml-3 flex items-center gap-1">
          <div className="h-4 w-px bg-border mx-1" />
          <div className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
            isOutcome
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : "text-muted-foreground/40"
          }`}>
            Outcome
          </div>
        </div>
      </div>

      {/* Helper microcopy */}
      <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
        Renewal lifecycle tracker — ECR-driven decision stages.
        {!isOutcome && suggestedIdx >= 0 && suggestedIdx < STRIP_STAGES.length && (
          <span className="ml-1 text-primary/70 not-italic">
            Suggested next: <strong>{RENEWAL_STAGES.find(rs => rs.value === STRIP_STAGES[suggestedIdx])?.label}</strong>
          </span>
        )}
      </p>
    </div>
  );
}

// ─── LIST CARD ───────────────────────────────────────────────────

function RenewalListCard({
  renewal,
  selected,
  onClick,
}: {
  renewal: EnrichedRenewal;
  selected: boolean;
  onClick: () => void;
}) {
  const isExpired = renewal.daysLeft < 0;
  const isUrgent = renewal.daysLeft >= 0 && renewal.daysLeft <= 30;
  const ragColor =
    isExpired || renewal.ecrGrade === "D" || renewal.ecrGrade === "F" ? "bg-red-500" :
    isUrgent || renewal.ecrGrade === "C" || renewal.hasWarnings ? "bg-amber-500" :
    "bg-emerald-500";

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-sm transition-all cursor-pointer ${
        selected ? "border-primary ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ragColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium leading-snug line-clamp-2">{renewal.renewalCycleName}</span>
              <Badge variant="outline" className={`text-[9px] shrink-0 whitespace-nowrap ${getStageColor(renewal.stage)}`}>
                {RENEWAL_STAGES.find(s => s.value === renewal.stage)?.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{renewal.customerName} · {renewal.ownerName}</p>

            {/* Mini milestone bar */}
            <div className="flex items-center gap-0.5 mb-2">
              {STRIP_STAGES.map((s, i) => {
                const idx = STRIP_STAGES.indexOf(renewal.stage as typeof STRIP_STAGES[number]);
                const isCur = s === renewal.stage;
                const isPast = i < idx && idx !== -1;
                return (
                  <div
                    key={s}
                    className={`h-1 rounded-full flex-1 transition-all ${
                      isCur ? "bg-[var(--color-hala-navy)]" :
                      isPast ? "bg-emerald-400" :
                      "bg-muted-foreground/10"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground uppercase">Value</span>
              <span className="text-xs font-bold font-mono">{formatSAR(renewal.baselineValue)}</span>
              <span className={`text-[10px] font-semibold ${renewal.ecrGrade === "D" || renewal.ecrGrade === "F" ? "text-red-600" : renewal.ecrGrade === "C" ? "text-amber-600" : "text-emerald-600"}`}>
                ECR {renewal.ecrGrade}
              </span>
              <span className={`text-[10px] font-medium ml-auto ${
                isExpired ? "text-red-600" :
                renewal.daysLeft <= 30 ? "text-amber-600" :
                "text-muted-foreground"
              }`}>
                {isExpired ? `Expired ${Math.abs(renewal.daysLeft)}d` : `${renewal.daysLeft}d to expiry`}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── KPI ROW (decision signals, not vanity metrics) ──────────────

function KpiRow({ renewal }: { renewal: EnrichedRenewal }) {
  const isExpired = renewal.daysLeft < 0;

  return (
    <div className="grid grid-cols-5 gap-3">
      {/* Value */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Value
        </span>
        <span className="text-sm font-bold font-mono mt-0.5">{formatSAR(renewal.baselineValue)}</span>
      </div>

      {/* ECR */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Target className="w-3 h-3" /> ECR
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            renewal.ecrGrade === "A" || renewal.ecrGrade === "B" ? "bg-emerald-500" :
            renewal.ecrGrade === "C" ? "bg-amber-500" : "bg-red-500"
          }`} />
          <span className={`text-sm font-semibold ${
            renewal.ecrGrade === "A" || renewal.ecrGrade === "B" ? "text-emerald-600" :
            renewal.ecrGrade === "C" ? "text-amber-600" : "text-red-600"
          }`}>{renewal.ecrGrade}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{renewal.ecrScore ? `Score: ${renewal.ecrScore}` : "Not Scored"}</span>
      </div>

      {/* Recommendation */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Activity className="w-3 h-3" /> Decision
        </span>
        <span className={`text-sm font-semibold mt-0.5 ${renewal.recommendationColor}`}>{renewal.recommendation}</span>
      </div>

      {/* Expiry */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock className="w-3 h-3" /> Expiry
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isExpired ? "bg-red-500" : renewal.daysLeft <= 30 ? "bg-red-500" : renewal.daysLeft <= 90 ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span className={`text-sm font-semibold ${isExpired ? "text-red-600" : renewal.daysLeft <= 30 ? "text-red-600" : renewal.daysLeft <= 90 ? "text-amber-600" : "text-emerald-600"}`}>
            {isExpired ? "Expired" : renewal.daysLeft <= 30 ? "Urgent" : renewal.daysLeft <= 90 ? "At Risk" : "On Track"}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {isExpired ? `${Math.abs(renewal.daysLeft)}d ago` : `${renewal.daysLeft}d left`}
        </span>
      </div>

      {/* Owner */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Users className="w-3 h-3" /> Owner
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-5 h-5 rounded-full bg-[var(--color-hala-navy)] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {renewal.ownerName.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium truncate">{renewal.ownerName}</span>
        </div>
      </div>
    </div>
  );
}

// ─── SUGGESTED NEXT ACTION BAR ───────────────────────────────────

function SuggestedAction({ renewal }: { renewal: EnrichedRenewal }) {
  const isExpired = renewal.daysLeft < 0;
  let action = "Continue assessment";
  let urgency = "normal";

  if (renewal.ecrGrade === "N/A") { action = "Complete ECR assessment"; urgency = "warn"; }
  else if (renewal.renewalDecision === "pending" && renewal.ecrGrade !== "N/A") { action = "Define renewal strategy"; urgency = "warn"; }
  else if (renewal.renewalDecision === "exit") { action = "Proceed with exit plan"; urgency = "critical"; }
  else if (renewal.renewalDecision === "renegotiate") { action = "Prepare amendment / repricing"; urgency = "normal"; }
  else if (renewal.renewalDecision === "renew" && renewal.status === "approved") { action = "Update contract documents"; urgency = "normal"; }
  else if (renewal.renewalDecision === "renew" && renewal.status !== "approved") { action = "Submit for approval"; urgency = "normal"; }
  if (isExpired && urgency !== "critical") urgency = "critical";

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      urgency === "critical" ? "bg-red-50 border-red-200 dark:bg-red-950/20" :
      urgency === "warn" ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20" :
      "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20"
    }`}>
      <div className="flex items-center gap-2">
        <Zap className={`w-4 h-4 ${urgency === "critical" ? "text-red-600" : urgency === "warn" ? "text-amber-600" : "text-emerald-600"}`} />
        <span className="text-sm font-medium">Suggested next: <strong>{action}</strong></span>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────

export default function Renewals() {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterDecision, setFilterDecision] = useState("all");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [filterEcr, setFilterEcr] = useState("all");

  // Enrich all renewals
  const enriched = useMemo(() => renewalWorkspaces.map(enrichRenewal), []);

  const owners = useMemo(() => Array.from(new Set(enriched.map(r => r.ownerName))).sort(), [enriched]);

  const filtered = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return enriched.filter(r => {
      if (filterOwner !== "all" && r.ownerName !== filterOwner) return false;
      if (filterStage !== "all" && r.stage !== filterStage) return false;
      if (filterDecision !== "all" && r.renewalDecision !== filterDecision) return false;
      if (filterEcr !== "all" && r.ecrGrade !== filterEcr) return false;
      if (filterExpiry === "expired" && r.daysLeft >= 0) return false;
      if (filterExpiry === "critical" && (r.daysLeft < 0 || r.daysLeft > 30)) return false;
      if (filterExpiry === "urgent" && (r.daysLeft < 0 || r.daysLeft > 90)) return false;
      if (search && !r.customerName.toLowerCase().includes(search) && !r.renewalCycleName.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [enriched, filterSearch, filterOwner, filterStage, filterDecision, filterEcr, filterExpiry]);

  const selected = enriched.find(r => r.id === selectedId) ?? null;

  const totalValue = filtered.reduce((s, r) => s + r.baselineValue, 0);
  const atRiskCount = filtered.filter(r => r.riskFlags.length > 0).length;
  const activeStages = new Set(filtered.map(r => r.stage)).size;

  const hasActiveFilters = filterOwner !== "all" || filterSearch || filterStage !== "all" || filterDecision !== "all" || filterEcr !== "all" || filterExpiry !== "all";

  const auditLog = selected ? getRenewalAudit(selected.id) : [];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Prototype Data Banner */}
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Placeholder data — not live</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            This module is currently displaying sample data. Real renewal records will appear here once the data integration sprint is complete.
          </p>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Renewals Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} renewals · {activeStages} active stages · {formatSAR(totalValue)} baseline value
            {atRiskCount > 0 && <span className="text-amber-600"> · {atRiskCount} at risk</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/renewals-overview")}>
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Renewals Overview
          </Button>
        </div>
      </div>

      {/* Filters (FIRST) */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="All Owners" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="All Stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {RENEWAL_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterDecision} onValueChange={setFilterDecision}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="All Decisions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="renew">Renew</SelectItem>
            <SelectItem value="renegotiate">Amend / Reprice</SelectItem>
            <SelectItem value="exit">Exit</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEcr} onValueChange={setFilterEcr}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="ECR Grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ECR</SelectItem>
            <SelectItem value="A">A</SelectItem>
            <SelectItem value="B">B</SelectItem>
            <SelectItem value="C">C</SelectItem>
            <SelectItem value="D">D</SelectItem>
            <SelectItem value="F">F</SelectItem>
            <SelectItem value="N/A">Not Scored</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterExpiry} onValueChange={setFilterExpiry}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Expiry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expiry</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="critical">Critical (&lt;30d)</SelectItem>
            <SelectItem value="urgent">Urgent (&lt;90d)</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => {
            setFilterOwner("all"); setFilterSearch(""); setFilterStage("all"); setFilterDecision("all"); setFilterEcr("all"); setFilterExpiry("all");
          }}>Clear all</Button>
        )}
      </div>

      {/* Search (SECOND) */}
      <div className="relative mb-4">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search company or renewal name..."
          value={filterSearch}
          onChange={e => { setFilterSearch(e.target.value); setSelectedId(null); }}
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
        />
        {filterSearch && (
          <button onClick={() => setFilterSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Layout */}
      <div className="space-y-6">
        {/* Detail — shown when a renewal is selected */}
        {selected && (
          <div className="space-y-4">
            <Tabs defaultValue="overview">
              <div className="border border-border rounded-xl overflow-hidden shadow-none">
                {/* Tab bar */}
                <div className="border-b border-border bg-muted/20 px-3 pt-2 pb-0">
                  <TabsList className="h-9 bg-muted/40 rounded-lg p-0.5 gap-0.5">
                    {[
                      { value: "overview", label: "Overview" },
                      { value: "commercial", label: "Commercial" },
                      { value: "delivery", label: "Delivery" },
                      { value: "risk", label: "Risk & Signals" },
                      { value: "customer", label: "Customer" },
                      { value: "documents", label: "Documents" },
                      { value: "activity", label: "Activity" },
                      { value: "audit", label: "Audit Trail" },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="rounded-md px-3 h-7 text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
                      >{tab.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* ── OVERVIEW TAB ── */}
                <TabsContent value="overview" className="mt-0">
                  {/* Lifecycle strip */}
                  <div className="px-4 pt-4 pb-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Lifecycle Tracker
                      </span>
                    </div>
                    <MilestoneStrip current={selected.stage} />
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}>
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-serif font-bold">{selected.customerName}</h2>
                          <Badge variant="outline" className="text-[10px]">Renewal</Badge>
                          <Badge variant="outline" className={`text-[10px] ${getStageColor(selected.stage)}`}>
                            {RENEWAL_STAGES.find(s => s.value === selected.stage)?.label}
                          </Badge>
                          {selected.outcomeTag && (
                            <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200">{selected.outcomeTag}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{selected.renewalCycleName}</p>
                      </div>
                    </div>

                    {/* KPI Row */}
                    <KpiRow renewal={selected} />

                    {/* Suggested Action */}
                    <SuggestedAction renewal={selected} />

                    {/* Risk Flags */}
                    {selected.riskFlags.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {selected.riskFlags.map(f => (
                          <Badge key={f} variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                            <AlertTriangle className="w-3 h-3 mr-1" /> {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ── COMMERCIAL TAB ── */}
                <TabsContent value="commercial" className="mt-0 p-4 space-y-4">
                  <h3 className="text-sm font-serif font-bold">Financial Overview</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="border shadow-none"><CardContent className="p-4 space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase">Baseline Revenue</p>
                      <p className="text-lg font-mono font-bold">{formatSAR(selected.baselineValue)}</p>
                    </CardContent></Card>
                    <Card className="border shadow-none"><CardContent className="p-4 space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase">Renewal Revenue</p>
                      <p className="text-lg font-mono font-bold">{selected.renewalValue ? formatSAR(selected.renewalValue) : "—"}</p>
                    </CardContent></Card>
                    <Card className="border shadow-none"><CardContent className="p-4 space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase">GP% Delta</p>
                      <p className={`text-lg font-mono font-bold ${selected.gpDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {selected.gpDelta >= 0 ? "+" : ""}{selected.gpDelta.toFixed(1)}%
                      </p>
                    </CardContent></Card>
                  </div>
                </TabsContent>

                {/* ── DELIVERY TAB ── */}
                <TabsContent value="delivery" className="mt-0 p-4">
                  <h3 className="text-sm font-serif font-bold mb-3">Operational Complexity</h3>
                  <p className="text-xs text-muted-foreground">Delivery risk and operational complexity assessment will be driven by ECR operational scoring. No active delivery signals for this renewal.</p>
                </TabsContent>

                {/* ── RISK & SIGNALS TAB ── */}
                <TabsContent value="risk" className="mt-0 p-4">
                  <WorkspaceRiskSignalsTab
                    renewalId={selected.id}
                    customerId={selected.customerId}
                    contextLabel={`${selected.customerName} Renewal`}
                    derivedSignals={[
                      ...selected.riskFlags.map(f => ({
                        label: "Renewal Risk Flag",
                        detail: f,
                        severity: "amber" as const,
                      })),
                      ...(selected.gateResult === "block" ? [{
                        label: "Gate Blocked",
                        detail: "One or more renewal gates are blocking progression",
                        severity: "red" as const,
                      }] : selected.gateResult === "warn" ? [{
                        label: "Gate Warning",
                        detail: "Renewal has gate warnings — review before locking",
                        severity: "amber" as const,
                      }] : []),
                      ...(selected.daysLeft < 0 ? [{
                        label: "Renewal Overdue",
                        detail: `Renewal target start date passed ${Math.abs(selected.daysLeft)}d ago`,
                        severity: "red" as const,
                      }] : selected.daysLeft <= 30 ? [{
                        label: "Renewal Urgent",
                        detail: `${selected.daysLeft} days until target renewal start`,
                        severity: "amber" as const,
                      }] : []),
                    ]}
                  />
                </TabsContent>

                {/* ── CUSTOMER TAB ── */}
                <TabsContent value="customer" className="mt-0 p-4 space-y-4">
                  <h3 className="text-sm font-serif font-bold">Customer Profile</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="text-sm font-semibold">{selected.customerName}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">ECR Grade</p>
                      <p className={`text-sm font-semibold ${
                        selected.ecrGrade === "A" || selected.ecrGrade === "B" ? "text-emerald-600" :
                        selected.ecrGrade === "C" ? "text-amber-600" : "text-red-600"
                      }`}>ECR {selected.ecrGrade} {selected.ecrScore ? `(${selected.ecrScore})` : ""}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Owner</p>
                      <p className="text-sm">{selected.ownerName}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Contract Period</p>
                      <p className="text-sm">{selected.targetStartDate} → {selected.targetEndDate}</p>
                    </div>
                  </div>
                </TabsContent>

                {/* ── DOCUMENTS TAB ── */}
                <TabsContent value="documents" className="mt-0 p-4">
                  <h3 className="text-sm font-serif font-bold mb-3">Related Documents</h3>
                  <p className="text-xs text-muted-foreground">Amendment drafts, signed contracts, and SLA references will appear here when connected to the document engine.</p>
                </TabsContent>

                {/* ── ACTIVITY TAB ── */}
                <TabsContent value="activity" className="mt-0 p-4">
                  <h3 className="text-sm font-serif font-bold mb-3">Activity</h3>
                  <p className="text-xs text-muted-foreground">Notes, stage changes, and strategy updates for {selected.renewalCycleName}.</p>
                </TabsContent>

                {/* ── AUDIT TRAIL TAB ── */}
                <TabsContent value="audit" className="mt-0 p-4 space-y-3">
                  <h3 className="text-sm font-serif font-bold">Audit Trail</h3>
                  {auditLog.length > 0 ? (
                    <div className="space-y-2">
                      {auditLog.map(entry => (
                        <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold">{entry.action.replace(/_/g, " ")}</span>
                              <span className="text-[10px] text-muted-foreground">{entry.userName}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{new Date(entry.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{entry.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No audit entries yet.</p>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {/* Renewal List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No renewals match the current filters.</p>
            </div>
          ) : (
            filtered.map(r => (
              <RenewalListCard
                key={r.id}
                renewal={r}
                selected={selectedId === r.id}
                onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
