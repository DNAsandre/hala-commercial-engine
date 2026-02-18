// ─── Renewal Workspace Detail Page ───
// Design: Swiss Precision — white cards, subtle borders, enterprise SaaS aesthetic
// Governance Hardened: integrity validation, role-based overrides, rule set version tags, supersession checks
// Tabs: Overview, Delta Comparison, Gate Results, Integrity, Versions, Audit Trail
import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getRenewalWorkspace,
  getBaseline,
  getRenewalVersions,
  getLatestRenewalVersion,
  getLatestGateEvaluation,
  getLatestDelta,
  getRenewalAudit,
  getRenewalOutcome,
  getDaysUntilExpiry,
  getExpiryUrgency,
  getStatusColor,
  getDecisionColor,
  getGateResultColor,
  getGateResultBg,
  getDeltaSeverityColor,
  getDeltaDirectionIcon,
  formatSAR,
  overrideGate,
  updateRenewalWorkspaceStatus,
  updateRenewalDecision,
  type RenewalDecision,
  type GateCheckResult,
} from "@/lib/renewal-engine";
import { getEcrScoreByCustomerName, getGradeColor } from "@/lib/ecr";
import {
  validateCommercialIntegrity,
  validateSupersessionIntegrity,
  getOverridesForEntity,
  overrideRoleConfigs,
  validateOverrideRole,
  createCommercialOverride,
  checkUniqueActiveBaseline,
  type IntegrityValidation,
  type CommercialOverrideRecord,
} from "@/lib/commercial-integrity";
import {
  ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  Plus, FileText, History, Lock, Unlock, RefreshCw, ChevronRight,
  ShieldCheck, ShieldAlert, Users, GitBranch, Eye,
} from "lucide-react";
import { toast } from "sonner";
import EcrUpgradeModal from "@/components/EcrUpgradeModal";
import { Dna } from "lucide-react";

export default function RenewalDetail() {
  const params = useParams<{ id: string }>();
  const [, setRefresh] = useState(0);
  const forceUpdate = () => setRefresh(n => n + 1);

  const workspace = getRenewalWorkspace(params.id || "");
  const baseline = workspace ? getBaseline(workspace.baselineId) : undefined;
  const versions = workspace ? getRenewalVersions(workspace.id) : [];
  const latestVersion = workspace ? getLatestRenewalVersion(workspace.id) : undefined;
  const gateEval = workspace ? getLatestGateEvaluation(workspace.id) : undefined;
  const delta = workspace ? getLatestDelta(workspace.id) : undefined;
  const outcome = workspace ? getRenewalOutcome(workspace.id) : undefined;
  const auditEntries = workspace ? getRenewalAudit(workspace.id) : [];
  const ecr = workspace ? getEcrScoreByCustomerName(workspace.customerName) : undefined;
  const daysLeft = baseline ? getDaysUntilExpiry(baseline.baselineEndDate) : 999;
  const urgency = getExpiryUrgency(daysLeft);

  // Commercial integrity data
  const commercialOverrides = workspace ? getOverridesForEntity("renewal", workspace.id) : [];
  const activeOverrides = commercialOverrides.filter(o => !o.superseded);
  const pendingApprovals = activeOverrides.filter(o => o.requires_second_approval && o.second_approval_status === "pending");

  // Integrity validation (computed on demand)
  const [integrityResult, setIntegrityResult] = useState<IntegrityValidation | null>(null);

  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{ gate: GateCheckResult; evalId: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Decision modal
  const [decisionModal, setDecisionModal] = useState(false);
  const [newDecision, setNewDecision] = useState<RenewalDecision>("pending");

  // ECR Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!workspace || !baseline) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <Link href="/renewals"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Renewals</Button></Link>
        <Card className="border border-gray-200 shadow-none"><CardContent className="p-8 text-center text-gray-500">Renewal workspace not found.</CardContent></Card>
      </div>
    );
  }

  const bp = baseline.pricingSnapshot;
  const rp = latestVersion?.pricingSnapshot;

  const handleOverride = () => {
    if (!overrideModal || !overrideReason.trim()) return;

    // Use the new commercial override system
    const result = createCommercialOverride({
      gateKey: overrideModal.gate.gateKey,
      gateName: overrideModal.gate.gateName,
      entityType: "renewal",
      entityId: workspace.id,
      workspaceId: workspace.id,
      rule_set_version_id: gateEval?.ruleSetVersionId || null,
      ecr_rule_version_id: gateEval?.ruleSetVersionId || null,
      previous_result: overrideModal.gate.result,
      userId: "u1",
      userName: "Amin Al-Rashid",
      userRole: "director",
      reason: overrideReason,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    // Also update the gate evaluation for display
    overrideGate(overrideModal.evalId, overrideModal.gate.gateKey, overrideReason, "u1", "Amin Al-Rashid");

    if (result.requires_second_approval) {
      toast.warning("Override created — pending second approval", {
        description: "A senior approver must confirm this override before it takes effect.",
        duration: 5000,
      });
    } else {
      toast.success("Override approved — gate result updated", {
        description: `Reason logged. Rule set version: ${gateEval?.ruleSetVersionId || "N/A"}`,
        duration: 4000,
      });
    }

    setOverrideModal(null);
    setOverrideReason("");
    forceUpdate();
  };

  const handleDecisionChange = () => {
    if (!workspace) return;
    updateRenewalDecision(workspace.id, newDecision, "u1", "Amin Al-Rashid");
    setDecisionModal(false);
    forceUpdate();
  };

  const handleStatusChange = (status: "under_review" | "approved" | "rejected") => {
    if (!workspace) return;
    updateRenewalWorkspaceStatus(workspace.id, status, "u1", "Amin Al-Rashid");
    forceUpdate();
  };

  const runIntegrityCheck = () => {
    const result = validateCommercialIntegrity({
      entityType: "renewal",
      entityId: workspace.id,
      workspaceId: workspace.id,
      userId: "u1",
      userName: "Amin Al-Rashid",
    });
    setIntegrityResult(result);
    forceUpdate();
    if (result.valid) {
      toast.success("Integrity validation passed", { description: "All checks passed — ready for lock." });
    } else {
      toast.error("Integrity validation failed", { description: `${result.checks.filter(c => c.status === "fail").length} check(s) failed.` });
    }
  };

  // Supersession check
  const supersessionCheck = useMemo(() => {
    return validateSupersessionIntegrity(workspace, baseline);
  }, [workspace, baseline]);

  const baselineUniqueCheck = useMemo(() => {
    return checkUniqueActiveBaseline(workspace.customerId);
  }, [workspace.customerId]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Back + Header */}
      <Link href="/renewals"><Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Renewals</Button></Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">{workspace.renewalCycleName}</h1>
            <Badge variant="outline" className={`text-xs border ${getStatusColor(workspace.status)}`}>{workspace.status.replace("_", " ")}</Badge>
            <Badge variant="outline" className={`text-xs border ${getDecisionColor(workspace.renewalDecision)}`}>{workspace.renewalDecision}</Badge>
            {ecr && <Badge variant="outline" className={`text-xs border-gray-200 ${getGradeColor(ecr.grade)}`}>ECR {ecr.grade} ({ecr.totalScore.toFixed(0)})</Badge>}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link href={`/customers/${workspace.customerId}`}><span className="hover:text-[#1B2A4A] cursor-pointer underline underline-offset-2">{workspace.customerName}</span></Link>
            <span>Owner: {workspace.ownerName}</span>
            <Badge variant="outline" className={`text-[10px] border-0 ${urgency.color}`}>
              <Clock className="w-3 h-3 mr-1" />
              {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d to expiry`}
            </Badge>
            {gateEval?.ruleSetVersionId && (
              <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                <GitBranch className="w-3 h-3 mr-1" /> {gateEval.ruleSetVersionId}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUpgradeModal(true)} className="border-violet-200 text-violet-700 hover:bg-violet-50">
            <Dna className="w-3.5 h-3.5 mr-1" /> Upgrade ECR
          </Button>
          <Button variant="outline" size="sm" onClick={runIntegrityCheck} className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Integrity Check
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNewDecision(workspace.renewalDecision); setDecisionModal(true); }}>
            Change Decision
          </Button>
          {workspace.status === "draft" && (
            <Button size="sm" onClick={() => handleStatusChange("under_review")} className="bg-amber-600 hover:bg-amber-700">Submit for Review</Button>
          )}
          {workspace.status === "under_review" && (
            <>
              <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleStatusChange("rejected")}>Reject</Button>
              <Button size="sm" onClick={() => handleStatusChange("approved")} className="bg-emerald-600 hover:bg-emerald-700">Approve</Button>
            </>
          )}
        </div>
      </div>

      {/* Pending Second Approvals Banner */}
      {pendingApprovals.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">{pendingApprovals.length} override(s) pending second approval.</span>{" "}
            {pendingApprovals.map(o => (
              <span key={o.id} className="inline-flex items-center gap-1 mr-2">
                <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">{o.gateName}</Badge>
                <span className="text-xs text-amber-600">by {o.overridden_by}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="delta">Delta Comparison</TabsTrigger>
          <TabsTrigger value="gates">Gate Results</TabsTrigger>
          <TabsTrigger value="integrity">Integrity</TabsTrigger>
          <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail ({auditEntries.length})</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Baseline Summary */}
            <Card className="border border-gray-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                  <Lock className="w-4 h-4 text-gray-400" /> Baseline (Immutable)
                  <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500 ml-auto">{baseline.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-gray-500">{baseline.baselineName}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-gray-500 block">Period</span><span className="text-slate-700">{baseline.baselineStartDate} → {baseline.baselineEndDate}</span></div>
                  <div><span className="text-xs text-gray-500 block">Annual Revenue</span><span className="text-slate-700">{formatSAR(bp.annualRevenue)}</span></div>
                  <div><span className="text-xs text-gray-500 block">Storage Rate</span><span className="text-slate-700">SAR {bp.storageRate}/pallet</span></div>
                  <div><span className="text-xs text-gray-500 block">GP%</span><span className="font-mono font-bold text-slate-900">{bp.gpPercent}%</span></div>
                  <div><span className="text-xs text-gray-500 block">Pallet Volume</span><span className="text-slate-700">{bp.palletVolume.toLocaleString()}</span></div>
                  <div><span className="text-xs text-gray-500 block">VAS Revenue</span><span className="text-slate-700">{formatSAR(bp.vasRevenue)}</span></div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">SLA Scope</span>
                  <div className="flex flex-wrap gap-1">
                    {bp.slaScope.map(s => <Badge key={s} variant="outline" className="text-[10px] border-gray-200 text-gray-600">{s}</Badge>)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1">Lanes</span>
                  <div className="flex flex-wrap gap-1">
                    {bp.lanes.map(l => <Badge key={l} variant="outline" className="text-[10px] border-gray-200 text-gray-600">{l}</Badge>)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Renewal Version */}
            <Card className="border border-gray-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                  <Unlock className="w-4 h-4 text-amber-600" /> Current Renewal (v{latestVersion?.versionNumber || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestVersion ? (
                  <>
                    <div className="text-xs text-gray-500">{latestVersion.notes}</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-xs text-gray-500 block">Target Period</span><span className="text-slate-700">{workspace.targetStartDate} → {workspace.targetEndDate}</span></div>
                      <div><span className="text-xs text-gray-500 block">Annual Revenue</span>
                        <span className="flex items-center gap-1 text-slate-700">
                          {formatSAR(rp!.annualRevenue)}
                          {rp!.annualRevenue > bp.annualRevenue ? <ArrowUpRight className="w-3 h-3 text-emerald-600" /> : rp!.annualRevenue < bp.annualRevenue ? <ArrowDownRight className="w-3 h-3 text-red-600" /> : <Minus className="w-3 h-3 text-gray-400" />}
                        </span>
                      </div>
                      <div><span className="text-xs text-gray-500 block">Storage Rate</span><span className="text-slate-700">SAR {rp!.storageRate}/pallet</span></div>
                      <div><span className="text-xs text-gray-500 block">GP%</span>
                        <span className={`font-mono font-bold ${rp!.gpPercent >= bp.gpPercent ? "text-emerald-700" : "text-red-700"}`}>
                          {rp!.gpPercent}% ({rp!.gpPercent >= bp.gpPercent ? "+" : ""}{(rp!.gpPercent - bp.gpPercent).toFixed(1)}%)
                        </span>
                      </div>
                      <div><span className="text-xs text-gray-500 block">Pallet Volume</span><span className="text-slate-700">{rp!.palletVolume.toLocaleString()}</span></div>
                      <div><span className="text-xs text-gray-500 block">VAS Revenue</span><span className="text-slate-700">{formatSAR(rp!.vasRevenue)}</span></div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">SLA Scope</span>
                      <div className="flex flex-wrap gap-1">
                        {rp!.slaScope.map(s => {
                          const isNew = !bp.slaScope.includes(s);
                          return <Badge key={s} variant="outline" className={`text-[10px] ${isNew ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-gray-200 text-gray-600"}`}>{isNew && <Plus className="w-2.5 h-2.5 mr-0.5" />}{s}</Badge>;
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">Lanes</span>
                      <div className="flex flex-wrap gap-1">
                        {rp!.lanes.map(l => {
                          const isNew = !bp.lanes.includes(l);
                          return <Badge key={l} variant="outline" className={`text-[10px] ${isNew ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-gray-200 text-gray-600"}`}>{isNew && <Plus className="w-2.5 h-2.5 mr-0.5" />}{l}</Badge>;
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">No renewal version created yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Gate Summary */}
          {gateEval && (
            <Card className="border border-gray-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                  <Shield className="w-4 h-4" /> Gate Summary
                  <Badge variant="outline" className={`text-[10px] border ${getGateResultBg(gateEval.result)} ${getGateResultColor(gateEval.result)}`}>{gateEval.result.toUpperCase()}</Badge>
                  {gateEval.ruleSetVersionId && (
                    <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50 ml-auto">
                      <GitBranch className="w-3 h-3 mr-1" /> Rule Set: {gateEval.ruleSetVersionId}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {gateEval.gates.map(g => (
                    <div key={g.gateKey} className={`p-3 rounded-lg border-l-4 bg-white border border-gray-200 ${g.overridden || g.result === "pass" ? "border-l-emerald-500" : g.result === "warn" ? "border-l-amber-500" : "border-l-red-500"}`}>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        {g.overridden ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : g.result === "pass" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : g.result === "warn" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                        {g.gateName}
                      </div>
                      {g.overridden && <div className="text-[10px] text-emerald-600 mt-1">Overridden</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Flags */}
          {delta && delta.riskFlagsJson.length > 0 && (
            <Card className="border border-gray-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Risk Flags ({delta.riskFlagsJson.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {delta.riskFlagsJson.map((rf, i) => (
                    <div key={i} className={`p-3 rounded-lg border-l-4 border border-gray-200 ${rf.severity === "critical" ? "border-l-red-500 bg-red-50/50" : rf.severity === "high" ? "border-l-amber-500 bg-amber-50/50" : "border-l-gray-300 bg-gray-50/50"}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${rf.severity === "critical" ? "text-red-700 bg-red-50 border-red-200" : rf.severity === "high" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-gray-600 bg-gray-50 border-gray-200"}`}>{rf.severity}</Badge>
                        <span className="text-sm text-slate-700">{rf.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── DELTA COMPARISON TAB ─── */}
        <TabsContent value="delta" className="space-y-4">
          {delta ? (
            <>
              <Card className="border border-gray-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-700">Baseline vs Renewal v{latestVersion?.versionNumber} — Field-by-Field Delta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-xs text-gray-500">
                          <th className="text-left py-2 pr-4">Field</th>
                          <th className="text-left py-2 pr-4">Category</th>
                          <th className="text-right py-2 pr-4">Baseline</th>
                          <th className="text-right py-2 pr-4">Renewal</th>
                          <th className="text-right py-2 pr-4">Change</th>
                          <th className="text-center py-2">Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {delta.deltaJson.map((d, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="py-2.5 pr-4 font-medium text-slate-700">{d.field}</td>
                            <td className="py-2.5 pr-4"><Badge variant="outline" className="text-[10px] border-gray-200 text-gray-600">{d.category}</Badge></td>
                            <td className="py-2.5 pr-4 text-right font-mono text-gray-500">{typeof d.baselineValue === "number" ? d.baselineValue.toLocaleString() : d.baselineValue}</td>
                            <td className="py-2.5 pr-4 text-right font-mono text-slate-700">{typeof d.renewalValue === "number" ? d.renewalValue.toLocaleString() : d.renewalValue}</td>
                            <td className={`py-2.5 pr-4 text-right font-mono font-bold ${getDeltaSeverityColor(d.severity)}`}>
                              {d.changePercent !== null ? `${d.changePercent >= 0 ? "+" : ""}${d.changePercent}%` : "—"}
                            </td>
                            <td className={`py-2.5 text-center text-lg ${getDeltaSeverityColor(d.severity)}`}>
                              {getDeltaDirectionIcon(d.direction)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Scope Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border border-gray-200 shadow-none">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-700">SLA Scope Comparison</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {Array.from(new Set([...bp.slaScope, ...(rp?.slaScope || [])])).map(item => {
                        const inBaseline = bp.slaScope.includes(item);
                        const inRenewal = rp?.slaScope.includes(item);
                        return (
                          <div key={item} className={`flex items-center gap-2 text-sm p-1.5 rounded ${!inBaseline ? "bg-emerald-50" : !inRenewal ? "bg-red-50" : ""}`}>
                            {!inBaseline ? <Plus className="w-3.5 h-3.5 text-emerald-600" /> : !inRenewal ? <Minus className="w-3.5 h-3.5 text-red-600" /> : <CheckCircle className="w-3.5 h-3.5 text-gray-400" />}
                            <span className={`${!inBaseline ? "text-emerald-700" : !inRenewal ? "text-red-700 line-through" : "text-slate-700"}`}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-gray-200 shadow-none">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-slate-700">Lanes Comparison</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {Array.from(new Set([...bp.lanes, ...(rp?.lanes || [])])).map(item => {
                        const inBaseline = bp.lanes.includes(item);
                        const inRenewal = rp?.lanes.includes(item);
                        return (
                          <div key={item} className={`flex items-center gap-2 text-sm p-1.5 rounded ${!inBaseline ? "bg-emerald-50" : !inRenewal ? "bg-red-50" : ""}`}>
                            {!inBaseline ? <Plus className="w-3.5 h-3.5 text-emerald-600" /> : !inRenewal ? <Minus className="w-3.5 h-3.5 text-red-600" /> : <CheckCircle className="w-3.5 h-3.5 text-gray-400" />}
                            <span className={`${!inBaseline ? "text-emerald-700" : !inRenewal ? "text-red-700 line-through" : "text-slate-700"}`}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-8 text-center text-gray-500">No delta computed yet. Create a renewal version to see the comparison.</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── GATE RESULTS TAB ─── */}
        <TabsContent value="gates" className="space-y-4">
          {gateEval ? (
            <>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <Badge variant="outline" className={`text-xs border ${getGateResultBg(gateEval.result)} ${getGateResultColor(gateEval.result)}`}>
                  Overall: {gateEval.result.toUpperCase()}
                </Badge>
                <span className="text-xs text-gray-500">Evaluated: {gateEval.evaluatedAt}</span>
                {gateEval.ruleSetVersionId && (
                  <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                    <GitBranch className="w-3 h-3 mr-1" /> {gateEval.ruleSetVersionId}
                  </Badge>
                )}
                {activeOverrides.length > 0 && (
                  <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">
                    <Shield className="w-3 h-3 mr-1" /> {activeOverrides.length} override(s)
                  </Badge>
                )}
              </div>
              <div className="space-y-3">
                {gateEval.gates.map(g => {
                  const overrideConfig = overrideRoleConfigs.find(c => c.gateKey === g.gateKey);
                  const commercialOverride = activeOverrides.find(o => o.gateKey === g.gateKey);

                  return (
                    <Card key={g.gateKey} className={`border border-gray-200 shadow-none border-l-4 ${g.overridden || g.result === "pass" ? "border-l-emerald-500" : g.result === "warn" ? "border-l-amber-500" : "border-l-red-500"}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {g.overridden ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : g.result === "pass" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : g.result === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                              <span className="font-medium text-sm text-slate-900">{g.gateName}</span>
                              <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500">{g.mode}</Badge>
                              {g.overridden && <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">Overridden</Badge>}
                              {overrideConfig?.requires_second_approval && (
                                <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                                  <Users className="w-3 h-3 mr-0.5" /> 2nd Approval Required
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 ml-6">{g.reason}</p>

                            {/* Override role permissions */}
                            {overrideConfig && overrideConfig.allowed_override_roles.length > 0 && (g.result === "warn" || g.result === "block") && !g.overridden && (
                              <div className="ml-6 mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-gray-400">Override roles:</span>
                                {overrideConfig.allowed_override_roles.map(role => (
                                  <Badge key={role} variant="outline" className="text-[10px] border-gray-200 text-gray-500">{role.replace(/_/g, " ")}</Badge>
                                ))}
                              </div>
                            )}

                            {/* Commercial override details */}
                            {commercialOverride && (
                              <div className="ml-6 mt-2 p-3 rounded border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-emerald-700 font-medium">Override Record</span>
                                  {commercialOverride.requires_second_approval && (
                                    <Badge variant="outline" className={`text-[10px] ${commercialOverride.second_approval_status === "approved" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : commercialOverride.second_approval_status === "pending" ? "border-amber-200 text-amber-700 bg-amber-50" : "border-red-200 text-red-700 bg-red-50"}`}>
                                      2nd: {commercialOverride.second_approval_status || "N/A"}
                                    </Badge>
                                  )}
                                  {commercialOverride.is_final && <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700">Final</Badge>}
                                </div>
                                <p className="text-xs text-slate-700">{commercialOverride.reason}</p>
                                <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                                  <span>By: {commercialOverride.overridden_by} ({commercialOverride.overridden_by_role.replace(/_/g, " ")})</span>
                                  <span>At: {new Date(commercialOverride.overridden_at).toLocaleString()}</span>
                                  {commercialOverride.rule_set_version_id && <span>Rule Set: {commercialOverride.rule_set_version_id}</span>}
                                  <span>Previous: {commercialOverride.previous_result}</span>
                                </div>
                              </div>
                            )}

                            {/* Legacy override (from old system) */}
                            {g.overridden && !commercialOverride && (
                              <div className="ml-6 mt-2 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs">
                                <span className="text-emerald-700 font-medium">Override:</span> <span className="text-slate-700">{g.overrideReason} — by {g.overrideBy} at {g.overrideAt ? new Date(g.overrideAt).toLocaleString() : ""}</span>
                              </div>
                            )}
                          </div>
                          {(g.result === "warn" || g.result === "block") && g.overridable && !g.overridden && (
                            <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50 shrink-0" onClick={() => { setOverrideModal({ gate: g, evalId: gateEval.id }); setOverrideReason(""); }}>
                              Override
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-8 text-center text-gray-500">No gate evaluation available.</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── INTEGRITY TAB ─── */}
        <TabsContent value="integrity" className="space-y-4">
          {/* Supersession Integrity */}
          <Card className="border border-gray-200 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <Lock className="w-4 h-4" /> Supersession Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    {baselineUniqueCheck.valid ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                    <span className="text-sm font-medium text-slate-700">Unique Active Baseline</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">
                    {baselineUniqueCheck.valid
                      ? `Customer has ${baselineUniqueCheck.activeCount} active baseline(s) — constraint satisfied`
                      : `Customer has ${baselineUniqueCheck.activeCount} active baselines — violation! IDs: ${baselineUniqueCheck.activeIds.join(", ")}`}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    {baseline.status === "active" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    <span className="text-sm font-medium text-slate-700">Baseline Status</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-6">
                    Current baseline is "{baseline.status}" — {baseline.status === "active" ? "ready for supersession" : "cannot be superseded"}
                  </p>
                </div>
              </div>
              {supersessionCheck.errors.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-red-700">Supersession Errors:</span>
                  {supersessionCheck.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded border border-red-200 bg-red-50/50">
                      <XCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                      <span className="text-xs text-red-700">{err}</span>
                    </div>
                  ))}
                </div>
              )}
              {supersessionCheck.warnings.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-amber-700">Warnings:</span>
                  {supersessionCheck.warnings.map((warn, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded border border-amber-200 bg-amber-50/50">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <span className="text-xs text-amber-700">{warn}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Commercial Integrity Validation */}
          <Card className="border border-gray-200 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <ShieldCheck className="w-4 h-4" /> Commercial Integrity Validation
                {integrityResult && (
                  <Badge variant="outline" className={`text-[10px] ml-auto ${integrityResult.valid ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-red-200 text-red-700 bg-red-50"}`}>
                    {integrityResult.valid ? "PASSED" : "FAILED"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {integrityResult ? (
                <>
                  <div className="text-xs text-gray-500 mb-2">
                    Validated by {integrityResult.validatedBy} at {new Date(integrityResult.timestamp).toLocaleString()}
                  </div>
                  <div className="space-y-2">
                    {integrityResult.checks.map((check, i) => (
                      <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${check.status === "pass" ? "border-emerald-200 bg-emerald-50/50" : check.status === "fail" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50"}`}>
                        {check.status === "pass" ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : check.status === "fail" ? <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">{check.check}</span>
                            <Badge variant="outline" className={`text-[10px] ${check.status === "pass" ? "border-emerald-200 text-emerald-700" : check.status === "fail" ? "border-red-200 text-red-700" : "border-amber-200 text-amber-700"}`}>
                              {check.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{check.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">Run an integrity check to validate all commercial dependencies</p>
                  <Button variant="outline" size="sm" onClick={runIntegrityCheck} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Run Integrity Check
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Override History */}
          <Card className="border border-gray-200 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-700">
                <Shield className="w-4 h-4" /> Override History ({commercialOverrides.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {commercialOverrides.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No overrides recorded for this renewal</p>
              ) : (
                <div className="space-y-2">
                  {commercialOverrides.map(o => (
                    <div key={o.id} className={`p-3 rounded-lg border ${o.superseded ? "border-gray-200 bg-gray-50 opacity-60" : "border-gray-200"}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-slate-700">{o.gateName}</span>
                        {o.superseded && <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500">Superseded</Badge>}
                        {o.is_final && !o.superseded && <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">Final</Badge>}
                        {o.requires_second_approval && (
                          <Badge variant="outline" className={`text-[10px] ${o.second_approval_status === "approved" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : o.second_approval_status === "pending" ? "border-amber-200 text-amber-700 bg-amber-50" : "border-red-200 text-red-700 bg-red-50"}`}>
                            2nd: {o.second_approval_status || "N/A"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{o.reason}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1 flex-wrap">
                        <span>{o.overridden_by} ({o.overridden_by_role.replace(/_/g, " ")})</span>
                        <span>{new Date(o.overridden_at).toLocaleString()}</span>
                        <span>Previous: {o.previous_result}</span>
                        {o.rule_set_version_id && <span>Rule Set: {o.rule_set_version_id}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── VERSIONS TAB ─── */}
        <TabsContent value="versions" className="space-y-3">
          {versions.map(v => (
            <Card key={v.id} className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-600">v{v.versionNumber}</Badge>
                      <span className="text-sm font-medium text-slate-900">{v.notes}</span>
                    </div>
                    <div className="text-xs text-gray-500">Created by {v.createdBy} on {v.createdAt}</div>
                    <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                      <div><span className="text-gray-500 block">Storage Rate</span><span className="text-slate-700">SAR {v.pricingSnapshot.storageRate}</span></div>
                      <div><span className="text-gray-500 block">Annual Rev</span><span className="text-slate-700">{formatSAR(v.pricingSnapshot.annualRevenue)}</span></div>
                      <div><span className="text-gray-500 block">GP%</span><span className="font-mono font-bold text-slate-900">{v.pricingSnapshot.gpPercent}%</span></div>
                      <div><span className="text-gray-500 block">Pallets</span><span className="text-slate-700">{v.pricingSnapshot.palletVolume.toLocaleString()}</span></div>
                    </div>
                  </div>
                  {v.id === latestVersion?.id && <Badge className="bg-blue-600 text-white text-[10px]">Current</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ─── AUDIT TRAIL TAB ─── */}
        <TabsContent value="audit" className="space-y-3">
          {auditEntries.length === 0 ? (
            <Card className="border border-gray-200 shadow-none"><CardContent className="p-8 text-center text-gray-500">No audit entries.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {auditEntries.map(a => {
                const isOverride = a.action.includes("override");
                const isGate = a.action.includes("gate");
                return (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-gray-200">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isOverride ? "bg-amber-500" : isGate ? "bg-blue-500" : "bg-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">{a.action.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-[10px] border-gray-200 text-gray-500">{a.entityType.replace(/_/g, " ")}</Badge>
                        {isOverride && <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700 bg-amber-50">Override</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{a.details}</p>
                      <div className="text-[10px] text-gray-400 mt-1">{a.userName} · {new Date(a.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Override Modal — Enhanced with role validation */}
      <Dialog open={!!overrideModal} onOpenChange={() => setOverrideModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Override Gate: {overrideModal?.gate.gateName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800">{overrideModal?.gate.reason}</div>

            {/* Role validation info */}
            {overrideModal && (() => {
              const config = overrideRoleConfigs.find(c => c.gateKey === overrideModal.gate.gateKey);
              return config ? (
                <div className="p-2 rounded bg-blue-50 border border-blue-200 text-xs space-y-1">
                  <div className="flex items-center gap-1 text-blue-700 font-medium">
                    <Users className="w-3 h-3" /> Override Role Requirements
                  </div>
                  <div className="text-blue-600">
                    Allowed roles: {config.allowed_override_roles.map(r => r.replace(/_/g, " ")).join(", ")}
                  </div>
                  {config.requires_second_approval && (
                    <div className="text-amber-700 font-medium">
                      Second approval required from: {config.second_approval_roles.map(r => r.replace(/_/g, " ")).join(", ")}
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Override Reason (required, min 10 characters)</label>
              <Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Explain why this gate is being overridden..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOverrideModal(null)}>Cancel</Button>
            <Button size="sm" disabled={overrideReason.trim().length < 10} onClick={handleOverride} className="bg-amber-600 hover:bg-amber-700">Confirm Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ECR Upgrade Modal */}
      <EcrUpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        contextType="renewal"
        contextId={workspace.id}
        customerId={workspace.customerId}
        customerName={workspace.customerName}
        currentRuleSetId={ecr?.ruleSetId || 'rs-2'}
        onUpgradeRequested={() => forceUpdate()}
      />

      {/* Decision Modal */}
      <Dialog open={decisionModal} onOpenChange={setDecisionModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Change Renewal Decision</DialogTitle>
          </DialogHeader>
          <Select value={newDecision} onValueChange={v => setNewDecision(v as RenewalDecision)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="renew">Renew</SelectItem>
              <SelectItem value="renegotiate">Renegotiate</SelectItem>
              <SelectItem value="exit">Exit</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDecisionModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleDecisionChange} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">Save Decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
