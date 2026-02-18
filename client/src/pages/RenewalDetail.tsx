// ─── Renewal Workspace Detail Page ───
// Tabs: Overview, Delta Comparison, Gate Results, Versions, Audit Trail
import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  evaluateRenewalGates,
  computeDelta,
  overrideGate,
  updateRenewalWorkspaceStatus,
  updateRenewalDecision,
  addRenewalAuditEntry,
  type RenewalDecision,
  type GateCheckResult,
} from "@/lib/renewal-engine";
import { getEcrScoreByCustomerName, getGradeColor } from "@/lib/ecr";
import {
  ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  Plus, FileText, History, Lock, Unlock, RefreshCw, ChevronRight,
} from "lucide-react";

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

  // Override modal state
  const [overrideModal, setOverrideModal] = useState<{ gate: GateCheckResult; evalId: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Decision modal
  const [decisionModal, setDecisionModal] = useState(false);
  const [newDecision, setNewDecision] = useState<RenewalDecision>("pending");

  if (!workspace || !baseline) {
    return (
      <div className="space-y-6">
        <Link href="/renewals"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Renewals</Button></Link>
        <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="p-8 text-center text-muted-foreground">Renewal workspace not found.</CardContent></Card>
      </div>
    );
  }

  const bp = baseline.pricingSnapshot;
  const rp = latestVersion?.pricingSnapshot;

  const handleOverride = () => {
    if (!overrideModal || !overrideReason.trim()) return;
    overrideGate(overrideModal.evalId, overrideModal.gate.gateKey, overrideReason, "u1", "Current User");
    setOverrideModal(null);
    setOverrideReason("");
    forceUpdate();
  };

  const handleDecisionChange = () => {
    if (!workspace) return;
    updateRenewalDecision(workspace.id, newDecision, "u1", "Current User");
    setDecisionModal(false);
    forceUpdate();
  };

  const handleStatusChange = (status: "under_review" | "approved" | "rejected") => {
    if (!workspace) return;
    updateRenewalWorkspaceStatus(workspace.id, status, "u1", "Current User");
    forceUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <Link href="/renewals"><Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Renewals</Button></Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{workspace.renewalCycleName}</h1>
            <Badge variant="outline" className={`text-xs border ${getStatusColor(workspace.status)}`}>{workspace.status.replace("_", " ")}</Badge>
            <Badge variant="outline" className={`text-xs border ${getDecisionColor(workspace.renewalDecision)}`}>{workspace.renewalDecision}</Badge>
            {ecr && <Badge variant="outline" className={`text-xs border-zinc-700 ${getGradeColor(ecr.grade)}`}>ECR {ecr.grade} ({ecr.totalScore.toFixed(0)})</Badge>}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={`/customers/${workspace.customerId}`}><span className="hover:text-zinc-200 cursor-pointer underline underline-offset-2">{workspace.customerName}</span></Link>
            <span>Owner: {workspace.ownerName}</span>
            <Badge variant="outline" className={`text-[10px] border-0 ${urgency.color}`}>
              <Clock className="w-3 h-3 mr-1" />
              {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft}d to expiry`}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => { setNewDecision(workspace.renewalDecision); setDecisionModal(true); }}>
            Change Decision
          </Button>
          {workspace.status === "draft" && (
            <Button size="sm" onClick={() => handleStatusChange("under_review")} className="bg-amber-600 hover:bg-amber-700">Submit for Review</Button>
          )}
          {workspace.status === "under_review" && (
            <>
              <Button size="sm" variant="outline" className="border-red-800 text-red-400 hover:bg-red-900/30" onClick={() => handleStatusChange("rejected")}>Reject</Button>
              <Button size="sm" onClick={() => handleStatusChange("approved")} className="bg-emerald-600 hover:bg-emerald-700">Approve</Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-zinc-900/50 border border-zinc-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="delta">Delta Comparison</TabsTrigger>
          <TabsTrigger value="gates">Gate Results</TabsTrigger>
          <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail ({auditEntries.length})</TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Baseline Summary */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4 text-zinc-500" /> Baseline (Immutable)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">{baseline.baselineName}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">Period</span>{baseline.baselineStartDate} → {baseline.baselineEndDate}</div>
                  <div><span className="text-xs text-muted-foreground block">Annual Revenue</span>{formatSAR(bp.annualRevenue)}</div>
                  <div><span className="text-xs text-muted-foreground block">Storage Rate</span>SAR {bp.storageRate}/pallet</div>
                  <div><span className="text-xs text-muted-foreground block">GP%</span><span className="font-mono font-bold">{bp.gpPercent}%</span></div>
                  <div><span className="text-xs text-muted-foreground block">Pallet Volume</span>{bp.palletVolume.toLocaleString()}</div>
                  <div><span className="text-xs text-muted-foreground block">VAS Revenue</span>{formatSAR(bp.vasRevenue)}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">SLA Scope</span>
                  <div className="flex flex-wrap gap-1">
                    {bp.slaScope.map(s => <Badge key={s} variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{s}</Badge>)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block mb-1">Lanes</span>
                  <div className="flex flex-wrap gap-1">
                    {bp.lanes.map(l => <Badge key={l} variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{l}</Badge>)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Renewal Version */}
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Unlock className="w-4 h-4 text-amber-400" /> Current Renewal (v{latestVersion?.versionNumber || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestVersion ? (
                  <>
                    <div className="text-xs text-muted-foreground">{latestVersion.notes}</div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-xs text-muted-foreground block">Target Period</span>{workspace.targetStartDate} → {workspace.targetEndDate}</div>
                      <div><span className="text-xs text-muted-foreground block">Annual Revenue</span>
                        <span className="flex items-center gap-1">
                          {formatSAR(rp!.annualRevenue)}
                          {rp!.annualRevenue > bp.annualRevenue ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : rp!.annualRevenue < bp.annualRevenue ? <ArrowDownRight className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-zinc-500" />}
                        </span>
                      </div>
                      <div><span className="text-xs text-muted-foreground block">Storage Rate</span>SAR {rp!.storageRate}/pallet</div>
                      <div><span className="text-xs text-muted-foreground block">GP%</span>
                        <span className={`font-mono font-bold ${rp!.gpPercent >= bp.gpPercent ? "text-emerald-400" : "text-red-400"}`}>
                          {rp!.gpPercent}% ({rp!.gpPercent >= bp.gpPercent ? "+" : ""}{(rp!.gpPercent - bp.gpPercent).toFixed(1)}%)
                        </span>
                      </div>
                      <div><span className="text-xs text-muted-foreground block">Pallet Volume</span>{rp!.palletVolume.toLocaleString()}</div>
                      <div><span className="text-xs text-muted-foreground block">VAS Revenue</span>{formatSAR(rp!.vasRevenue)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">SLA Scope</span>
                      <div className="flex flex-wrap gap-1">
                        {rp!.slaScope.map(s => {
                          const isNew = !bp.slaScope.includes(s);
                          return <Badge key={s} variant="outline" className={`text-[10px] ${isNew ? "border-amber-600 text-amber-400" : "border-zinc-700 text-zinc-400"}`}>{isNew && <Plus className="w-2.5 h-2.5 mr-0.5" />}{s}</Badge>;
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block mb-1">Lanes</span>
                      <div className="flex flex-wrap gap-1">
                        {rp!.lanes.map(l => {
                          const isNew = !bp.lanes.includes(l);
                          return <Badge key={l} variant="outline" className={`text-[10px] ${isNew ? "border-amber-600 text-amber-400" : "border-zinc-700 text-zinc-400"}`}>{isNew && <Plus className="w-2.5 h-2.5 mr-0.5" />}{l}</Badge>;
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No renewal version created yet.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Gate Summary */}
          {gateEval && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Gate Summary
                  <Badge variant="outline" className={`text-[10px] border ${getGateResultBg(gateEval.result)} ${getGateResultColor(gateEval.result)}`}>{gateEval.result.toUpperCase()}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {gateEval.gates.map(g => (
                    <div key={g.gateKey} className={`p-3 rounded-lg border ${getGateResultBg(g.overridden ? "pass" : g.result)}`}>
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        {g.overridden ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : g.result === "pass" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : g.result === "warn" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        {g.gateName}
                      </div>
                      {g.overridden && <div className="text-[10px] text-emerald-400 mt-1">Overridden</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Flags */}
          {delta && delta.riskFlagsJson.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Risk Flags ({delta.riskFlagsJson.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {delta.riskFlagsJson.map((rf, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${rf.severity === "critical" ? "bg-red-400/5 border-red-400/20" : rf.severity === "high" ? "bg-amber-400/5 border-amber-400/20" : "bg-zinc-800/50 border-zinc-700"}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${rf.severity === "critical" ? "text-red-400 border-red-400/30" : rf.severity === "high" ? "text-amber-400 border-amber-400/30" : "text-zinc-400 border-zinc-600"}`}>{rf.severity}</Badge>
                        <span className="text-sm">{rf.message}</span>
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
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Baseline vs Renewal v{latestVersion?.versionNumber} — Field-by-Field Delta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-xs text-muted-foreground">
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
                          <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                            <td className="py-2.5 pr-4 font-medium">{d.field}</td>
                            <td className="py-2.5 pr-4"><Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{d.category}</Badge></td>
                            <td className="py-2.5 pr-4 text-right font-mono text-zinc-400">{typeof d.baselineValue === "number" ? d.baselineValue.toLocaleString() : d.baselineValue}</td>
                            <td className="py-2.5 pr-4 text-right font-mono">{typeof d.renewalValue === "number" ? d.renewalValue.toLocaleString() : d.renewalValue}</td>
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
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">SLA Scope Comparison</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {Array.from(new Set([...bp.slaScope, ...(rp?.slaScope || [])])).map(item => {
                        const inBaseline = bp.slaScope.includes(item);
                        const inRenewal = rp?.slaScope.includes(item);
                        return (
                          <div key={item} className={`flex items-center gap-2 text-sm p-1.5 rounded ${!inBaseline ? "bg-emerald-400/5" : !inRenewal ? "bg-red-400/5" : ""}`}>
                            {!inBaseline ? <Plus className="w-3.5 h-3.5 text-emerald-400" /> : !inRenewal ? <Minus className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle className="w-3.5 h-3.5 text-zinc-500" />}
                            <span className={!inBaseline ? "text-emerald-400" : !inRenewal ? "text-red-400 line-through" : ""}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Lanes Comparison</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {Array.from(new Set([...bp.lanes, ...(rp?.lanes || [])])).map(item => {
                        const inBaseline = bp.lanes.includes(item);
                        const inRenewal = rp?.lanes.includes(item);
                        return (
                          <div key={item} className={`flex items-center gap-2 text-sm p-1.5 rounded ${!inBaseline ? "bg-emerald-400/5" : !inRenewal ? "bg-red-400/5" : ""}`}>
                            {!inBaseline ? <Plus className="w-3.5 h-3.5 text-emerald-400" /> : !inRenewal ? <Minus className="w-3.5 h-3.5 text-red-400" /> : <CheckCircle className="w-3.5 h-3.5 text-zinc-500" />}
                            <span className={!inBaseline ? "text-emerald-400" : !inRenewal ? "text-red-400 line-through" : ""}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-8 text-center text-muted-foreground">No delta computed yet. Create a renewal version to see the comparison.</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── GATE RESULTS TAB ─── */}
        <TabsContent value="gates" className="space-y-4">
          {gateEval ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className={`text-xs border ${getGateResultBg(gateEval.result)} ${getGateResultColor(gateEval.result)}`}>
                  Overall: {gateEval.result.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">Evaluated: {gateEval.evaluatedAt}</span>
              </div>
              <div className="space-y-3">
                {gateEval.gates.map(g => (
                  <Card key={g.gateKey} className={`border ${getGateResultBg(g.overridden ? "pass" : g.result)}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            {g.overridden ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : g.result === "pass" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : g.result === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                            <span className="font-medium text-sm">{g.gateName}</span>
                            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{g.mode}</Badge>
                            {g.overridden && <Badge variant="outline" className="text-[10px] border-emerald-600 text-emerald-400">Overridden</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground ml-6">{g.reason}</p>
                          {g.overridden && (
                            <div className="ml-6 mt-2 p-2 rounded bg-emerald-400/5 border border-emerald-400/20 text-xs">
                              <span className="text-emerald-400 font-medium">Override:</span> {g.overrideReason} — by {g.overrideBy} at {g.overrideAt ? new Date(g.overrideAt).toLocaleString() : ""}
                            </div>
                          )}
                        </div>
                        {(g.result === "warn" || g.result === "block") && g.overridable && !g.overridden && (
                          <Button variant="outline" size="sm" className="border-amber-600 text-amber-400 hover:bg-amber-900/30 shrink-0" onClick={() => { setOverrideModal({ gate: g, evalId: gateEval.id }); setOverrideReason(""); }}>
                            Override
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-8 text-center text-muted-foreground">No gate evaluation available.</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── VERSIONS TAB ─── */}
        <TabsContent value="versions" className="space-y-3">
          {versions.map(v => (
            <Card key={v.id} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">v{v.versionNumber}</Badge>
                      <span className="text-sm font-medium">{v.notes}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Created by {v.createdBy} on {v.createdAt}</div>
                    <div className="grid grid-cols-4 gap-4 mt-2 text-xs">
                      <div><span className="text-muted-foreground block">Storage Rate</span>SAR {v.pricingSnapshot.storageRate}</div>
                      <div><span className="text-muted-foreground block">Annual Rev</span>{formatSAR(v.pricingSnapshot.annualRevenue)}</div>
                      <div><span className="text-muted-foreground block">GP%</span><span className="font-mono font-bold">{v.pricingSnapshot.gpPercent}%</span></div>
                      <div><span className="text-muted-foreground block">Pallets</span>{v.pricingSnapshot.palletVolume.toLocaleString()}</div>
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
            <Card className="bg-zinc-900/50 border-zinc-800"><CardContent className="p-8 text-center text-muted-foreground">No audit entries.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {auditEntries.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <div className="w-2 h-2 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{a.action.replace(/_/g, " ")}</span>
                      <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{a.entityType.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.details}</p>
                    <div className="text-[10px] text-zinc-500 mt-1">{a.userName} · {new Date(a.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Override Modal */}
      <Dialog open={!!overrideModal} onOpenChange={() => setOverrideModal(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Override Gate: {overrideModal?.gate.gateName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded bg-amber-400/5 border border-amber-400/20 text-sm text-amber-300">{overrideModal?.gate.reason}</div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Override Reason (required)</label>
              <Textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="Explain why this gate is being overridden..." className="bg-zinc-800 border-zinc-700" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => setOverrideModal(null)}>Cancel</Button>
            <Button size="sm" disabled={!overrideReason.trim()} onClick={handleOverride} className="bg-amber-600 hover:bg-amber-700">Confirm Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Modal */}
      <Dialog open={decisionModal} onOpenChange={setDecisionModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Change Renewal Decision</DialogTitle>
          </DialogHeader>
          <Select value={newDecision} onValueChange={v => setNewDecision(v as RenewalDecision)}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="renew">Renew</SelectItem>
              <SelectItem value="renegotiate">Renegotiate</SelectItem>
              <SelectItem value="exit">Exit</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" size="sm" className="border-zinc-700" onClick={() => setDecisionModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleDecisionChange}>Save Decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
