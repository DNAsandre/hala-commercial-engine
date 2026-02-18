// ─── Renewals List Page ───
// Design: Swiss Precision — white cards, subtle borders, enterprise SaaS aesthetic
// Aligned with Workspaces, Proposals, Document Engine, ECR Dashboard
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  renewalWorkspaces,
  contractBaselines,
  getBaseline,
  getLatestRenewalVersion,
  getLatestGateEvaluation,
  getLatestDelta,
  getDaysUntilExpiry,
  getExpiryUrgency,
  getStatusColor,
  getDecisionColor,
  getGateResultColor,
  formatSAR,
  type RenewalWorkspaceStatus,
  type RenewalDecision,
} from "@/lib/renewal-engine";
import { getEcrScoreByCustomerName } from "@/lib/ecr";
import { RefreshCw, Search, Filter, ArrowRight, AlertTriangle, CheckCircle, Clock, XCircle, Shield, TrendingUp } from "lucide-react";

export default function Renewals() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");
  const [riskOnly, setRiskOnly] = useState(false);

  // Enrich renewal workspaces with computed data
  const enriched = useMemo(() => {
    return renewalWorkspaces.map(rw => {
      const baseline = getBaseline(rw.baselineId);
      const latestVersion = getLatestRenewalVersion(rw.id);
      const gateEval = getLatestGateEvaluation(rw.id);
      const delta = getLatestDelta(rw.id);
      const daysLeft = baseline ? getDaysUntilExpiry(baseline.baselineEndDate) : 999;
      const urgency = getExpiryUrgency(daysLeft);
      const ecr = getEcrScoreByCustomerName(rw.customerName);
      const hasWarnings = gateEval ? gateEval.gates.some(g => g.result === "warn" || g.result === "block") : false;
      const gpDelta = latestVersion && baseline ? latestVersion.pricingSnapshot.gpPercent - baseline.pricingSnapshot.gpPercent : 0;
      const revDelta = latestVersion && baseline ? latestVersion.pricingSnapshot.annualRevenue - baseline.pricingSnapshot.annualRevenue : 0;
      return { ...rw, baseline, latestVersion, gateEval, delta, daysLeft, urgency, ecr, hasWarnings, gpDelta, revDelta };
    });
  }, []);

  // Unique owners
  const owners = useMemo(() => Array.from(new Set(renewalWorkspaces.map(w => w.ownerName))), []);

  // Filtered
  const filtered = useMemo(() => {
    return enriched.filter(rw => {
      if (search && !rw.renewalCycleName.toLowerCase().includes(search.toLowerCase()) && !rw.customerName.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && rw.status !== statusFilter) return false;
      if (decisionFilter !== "all" && rw.renewalDecision !== decisionFilter) return false;
      if (ownerFilter !== "all" && rw.ownerName !== ownerFilter) return false;
      if (expiryFilter === "critical" && rw.daysLeft > 30) return false;
      if (expiryFilter === "urgent" && (rw.daysLeft > 90 || rw.daysLeft < 0)) return false;
      if (expiryFilter === "approaching" && (rw.daysLeft > 180 || rw.daysLeft < 0)) return false;
      if (expiryFilter === "expired" && rw.daysLeft >= 0) return false;
      if (riskOnly && !rw.hasWarnings) return false;
      return true;
    });
  }, [enriched, search, statusFilter, decisionFilter, ownerFilter, expiryFilter, riskOnly]);

  // Metrics
  const metrics = useMemo(() => {
    const active = enriched.filter(r => r.status !== "rejected" && r.status !== "locked");
    const withWarnings = enriched.filter(r => r.hasWarnings);
    const totalBaselineRev = enriched.reduce((s, r) => s + (r.baseline?.pricingSnapshot.annualRevenue || 0), 0);
    const totalRenewalRev = enriched.filter(r => r.latestVersion).reduce((s, r) => s + (r.latestVersion?.pricingSnapshot.annualRevenue || 0), 0);
    const avgGpDelta = enriched.filter(r => r.latestVersion).length > 0
      ? enriched.filter(r => r.latestVersion).reduce((s, r) => s + r.gpDelta, 0) / enriched.filter(r => r.latestVersion).length
      : 0;
    return { active: active.length, withWarnings: withWarnings.length, totalBaselineRev, totalRenewalRev, avgGpDelta };
  }, [enriched]);

  const activeFilters = [statusFilter !== "all", decisionFilter !== "all", ownerFilter !== "all", expiryFilter !== "all", riskOnly].filter(Boolean).length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Renewal Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">Baseline → Renewal → Locked cycle with delta comparison and policy gates</p>
        </div>
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          {enriched.length} baselines
        </Badge>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="border border-gray-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Active Renewals</p>
            <p className="text-2xl font-bold text-[#1B2A4A] mt-1">{metrics.active}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">With Warnings</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{metrics.withWarnings}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Baseline Revenue</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatSAR(metrics.totalBaselineRev)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Renewal Revenue</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatSAR(metrics.totalRenewalRev)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 bg-indigo-50">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Avg GP% Delta</p>
            <p className={`text-2xl font-bold mt-1 ${metrics.avgGpDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {metrics.avgGpDelta >= 0 ? "+" : ""}{metrics.avgGpDelta.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search renewals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Decision" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="renew">Renew</SelectItem>
            <SelectItem value="renegotiate">Renegotiate</SelectItem>
            <SelectItem value="exit">Exit</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Owner" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={expiryFilter} onValueChange={setExpiryFilter}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Expiry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expiry</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="critical">Critical (&lt;30d)</SelectItem>
            <SelectItem value="urgent">Urgent (&lt;90d)</SelectItem>
            <SelectItem value="approaching">Approaching (&lt;180d)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={riskOnly ? "default" : "outline"} size="sm" onClick={() => setRiskOnly(!riskOnly)} className={riskOnly ? "bg-amber-600 hover:bg-amber-700" : ""}>
          <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Risk Only
        </Button>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setDecisionFilter("all"); setOwnerFilter("all"); setExpiryFilter("all"); setRiskOnly(false); setSearch(""); }} className="text-gray-500">
            Clear ({activeFilters})
          </Button>
        )}
      </div>

      {/* Renewal Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="border border-gray-200 shadow-none">
            <CardContent className="p-8 text-center text-gray-500">
              No renewal workspaces match the current filters.
            </CardContent>
          </Card>
        )}
        {filtered.map(rw => (
          <Link key={rw.id} href={`/renewals/${rw.id}`}>
            <Card className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 truncate">{rw.renewalCycleName}</span>
                      <Badge variant="outline" className={`text-[10px] border ${getStatusColor(rw.status)}`}>
                        {rw.status.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] border ${getDecisionColor(rw.renewalDecision)}`}>
                        {rw.renewalDecision}
                      </Badge>
                      {rw.ecr && (
                        <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-600">
                          ECR {rw.ecr.grade}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{rw.customerName}</span>
                      <span>Owner: {rw.ownerName}</span>
                      <span>Target: {rw.targetStartDate} → {rw.targetEndDate}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {/* Expiry badge */}
                      <Badge variant="outline" className={`text-[10px] border-0 ${rw.urgency.color}`}>
                        <Clock className="w-3 h-3 mr-1" />
                        {rw.daysLeft < 0 ? `Expired ${Math.abs(rw.daysLeft)}d ago` : `${rw.daysLeft}d to expiry`}
                      </Badge>
                      {/* Gate result */}
                      {rw.gateEval && (
                        <Badge variant="outline" className={`text-[10px] border-0 ${rw.gateEval.result === "pass" ? "text-emerald-700 bg-emerald-50" : rw.gateEval.result === "warn" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          Gates: {rw.gateEval.result}
                        </Badge>
                      )}
                      {/* Risk flags */}
                      {rw.delta && rw.delta.riskFlagsJson.length > 0 && (
                        <Badge variant="outline" className="text-[10px] border-0 text-amber-700 bg-amber-50">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {rw.delta.riskFlagsJson.length} risk flag{rw.delta.riskFlagsJson.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right: Financials */}
                  <div className="flex items-center gap-6 text-right shrink-0">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Baseline Rev</div>
                      <div className="text-sm font-mono text-slate-700">{rw.baseline ? formatSAR(rw.baseline.pricingSnapshot.annualRevenue) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Renewal Rev</div>
                      <div className="text-sm font-mono text-slate-700">{rw.latestVersion ? formatSAR(rw.latestVersion.pricingSnapshot.annualRevenue) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">GP% Δ</div>
                      <div className={`text-sm font-mono font-bold ${rw.gpDelta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {rw.gpDelta >= 0 ? "+" : ""}{rw.gpDelta.toFixed(1)}%
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
