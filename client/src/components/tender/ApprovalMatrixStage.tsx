/**
 * ApprovalMatrixStage — Stage 8: Route for mandatory approvals based on GP% and volume.
 *
 * DATA SOURCE: ONLY from this tender's own stages.
 * - GP% → from pricingData (P&L/Pricing stage)
 * - Pallet volume → from solutionDesignData (Solution Design stage)
 * - Target GP% → from tender identity (targetGpPercent)
 *
 * If data hasn't been captured in those stages → "Not captured yet". NO guessing.
 *
 * The bot does NOT approve. Humans approve. AI is advisory only.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Users, Lock,
  ChevronDown, ChevronRight, FileCheck2, TrendingUp, Info, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";

// ─── Types ─────────────────────────────────────────────────

interface Props {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
}

interface ApprovalRequirement {
  role: string;
  roleLabel: string;
  type: "approval" | "feasibility";
  level: number;
}

interface ApprovalRecord {
  id: string;
  role: string;
  role_label: string;
  type: "approval" | "feasibility";
  decision: "pending" | "approved" | "rejected";
  decided_by: string;
  comment: string;
  decided_at: string | null;
}

// ─── Approval Logic (from doctrine) ───────────────────────

function getApprovalRequirements(gpPercent: number | null, palletVolume: number | null): ApprovalRequirement[] {
  const reqs: ApprovalRequirement[] = [];

  // Always needs salesman + regional sales head
  reqs.push({ role: "salesman", roleLabel: "Salesman", type: "approval", level: 4 });
  reqs.push({ role: "regional_sales_head", roleLabel: "Regional Sales Head", type: "approval", level: 3 });

  if (gpPercent === null) {
    // GP not captured — we don't know who else needs to approve
    // Show minimum requirements only
    return reqs;
  }

  // GP% based routing (from doctrine)
  if (gpPercent > 25) {
    reqs.push({ role: "regional_ops_head", roleLabel: "Regional Ops Head", type: "feasibility", level: 3 });
  } else if (gpPercent > 22) {
    reqs.push({ role: "regional_ops_head", roleLabel: "Regional Ops Head", type: "approval", level: 3 });
  } else if (gpPercent >= 10) {
    reqs.push({ role: "regional_ops_head", roleLabel: "Regional Ops Head", type: "approval", level: 3 });
    reqs.push({ role: "director", roleLabel: "Directors (Ops & Commercial)", type: "approval", level: 2 });
  } else {
    // < 10% GP — needs CEO/CFO
    reqs.push({ role: "regional_ops_head", roleLabel: "Regional Ops Head", type: "approval", level: 3 });
    reqs.push({ role: "director", roleLabel: "Directors (Ops & Commercial)", type: "approval", level: 2 });
    reqs.push({ role: "ceo_cfo", roleLabel: "CEO / CFO", type: "approval", level: 1 });
  }

  // Pallet volume escalation
  if (palletVolume !== null && palletVolume > 300) {
    // Directors needed for volume > 300 (if not already required)
    if (!reqs.some(r => r.role === "director")) {
      reqs.push({ role: "director", roleLabel: "Directors (Ops & Commercial)", type: "approval", level: 2 });
    }
  }

  return reqs;
}

// ─── GP% color ────────────────────────────────────────────

function gpColor(gp: number): { bg: string; text: string; ring: string; label: string } {
  if (gp >= 30) return { bg: "bg-emerald-50", text: "text-emerald-700", ring: "stroke-emerald-500", label: "Strong" };
  if (gp >= 22) return { bg: "bg-blue-50", text: "text-blue-700", ring: "stroke-blue-500", label: "Good" };
  if (gp >= 10) return { bg: "bg-amber-50", text: "text-amber-700", ring: "stroke-amber-500", label: "Needs Directors" };
  return { bg: "bg-red-50", text: "text-red-700", ring: "stroke-red-500", label: "CEO Required" };
}

// ─── Extract GP% ONLY from this tender's pricing stage ────

function extractGpFromTender(t: any): { gp: number | null; source: string } {
  // 1. Try pricing data (P&L/Pricing stage scenarios)
  const pricing = t.pricingData;
  if (pricing && typeof pricing === "object") {
    // Check summary first
    if (pricing.summary && pricing.summary.lowest_gp_percent) {
      const lowest = Number(pricing.summary.lowest_gp_percent);
      if (!isNaN(lowest) && lowest > 0) return { gp: lowest, source: "P&L Pricing (lowest scenario)" };
    }
    // Check individual scenarios
    if (Array.isArray(pricing.scenarios) && pricing.scenarios.length > 0) {
      const gps = pricing.scenarios.map((s: any) => Number(s.gp_percent)).filter((n: number) => !isNaN(n) && n > 0);
      if (gps.length > 0) {
        const lowest = Math.min(...gps);
        return { gp: lowest, source: `P&L Pricing (${gps.length} scenario${gps.length > 1 ? "s" : ""})` };
      }
    }
  }

  // 2. Try target GP% from tender identity
  if (typeof t.targetGpPercent === "number" && t.targetGpPercent > 0) {
    return { gp: t.targetGpPercent, source: "Tender target GP%" };
  }

  return { gp: null, source: "Not captured in any tender stage" };
}

// ─── Extract pallet volume ONLY from this tender's solution design ─

function extractPalletsFromTender(t: any): { pallets: number | null; source: string } {
  const sd = t.solutionDesignData;
  if (sd && typeof sd === "object") {
    // Check HOP (Hub Operations Plan) warehouse section
    if (sd.hop?.warehouse?.storage_capacity) {
      const cap = Number(sd.hop.warehouse.storage_capacity);
      if (!isNaN(cap) && cap > 0) return { pallets: cap, source: "Solution Design (HOP warehouse)" };
    }
    if (sd.hop?.warehouse?.pallet_positions) {
      const pp = Number(sd.hop.warehouse.pallet_positions);
      if (!isNaN(pp) && pp > 0) return { pallets: pp, source: "Solution Design (HOP pallet positions)" };
    }
    // Check configuration
    if (sd.configuration?.pallet_volume) {
      const pv = Number(sd.configuration.pallet_volume);
      if (!isNaN(pv) && pv > 0) return { pallets: pv, source: "Solution Design (configuration)" };
    }
  }
  return { pallets: null, source: "Not captured in Solution Design stage" };
}

// ─── Component ────────────────────────────────────────────

export default function ApprovalMatrixStage({ ws, activeTab, reload }: Props) {
  const t = ws.tender as any;
  const tenderId = t.id;

  // Extract data ONLY from this tender's stages
  const { gp: gpPercent, source: gpSource } = useMemo(() => extractGpFromTender(t), [t]);
  const { pallets: palletVolume, source: palletSource } = useMemo(() => extractPalletsFromTender(t), [t]);

  // Determine required approvers
  const requirements = useMemo(() => getApprovalRequirements(gpPercent, palletVolume), [gpPercent, palletVolume]);

  // Load existing approval records from tender's type_details
  const existingApprovals: ApprovalRecord[] = useMemo(() => {
    const td = t.tenderDraftingData ?? {};
    const matrix = td.approval_matrix;
    if (matrix && Array.isArray(matrix.approvals)) return matrix.approvals;
    return [];
  }, [t]);

  // Merge requirements with existing records
  const approvalRows = useMemo(() => {
    return requirements.map(req => {
      const existing = existingApprovals.find(a => a.role === req.role);
      return {
        ...req,
        decision: existing?.decision || "pending",
        decided_by: existing?.decided_by || "",
        comment: existing?.comment || "",
        decided_at: existing?.decided_at || null,
        record_id: existing?.id || "",
      };
    });
  }, [requirements, existingApprovals]);

  const approvedCount = approvalRows.filter(r => r.decision === "approved").length;
  const rejectedCount = approvalRows.filter(r => r.decision === "rejected").length;
  const pendingCount = approvalRows.filter(r => r.decision === "pending").length;
  const allApproved = pendingCount === 0 && rejectedCount === 0 && approvalRows.length > 0;

  // UI state
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  // Save approval decision
  const handleDecision = useCallback(async (role: string, roleLabel: string, type: "approval" | "feasibility", decision: "approved" | "rejected") => {
    setSaving(role);
    try {
      // Read current tender data
      const { data: row, error: readErr } = await supabase
        .from("commercial_tickets")
        .select("type_details")
        .eq("id", tenderId)
        .eq("ticket_type", "tender")
        .eq("active", true)
        .single();

      if (readErr || !row) {
        toast.error("Failed to read tender data.");
        setSaving(null);
        return;
      }

      const details = (row.type_details && typeof row.type_details === "object" && !Array.isArray(row.type_details))
        ? row.type_details as Record<string, any>
        : {};
      const drafting = details.tender_drafting ?? {};
      const matrix = drafting.approval_matrix ?? { approvals: [], created_at: new Date().toISOString() };
      const approvals: ApprovalRecord[] = Array.isArray(matrix.approvals) ? [...matrix.approvals] : [];

      // Remove any existing record for this role
      const filtered = approvals.filter(a => a.role !== role);

      // Add new record
      filtered.push({
        id: `apr-${nanoid(8)}`,
        role,
        role_label: roleLabel,
        type,
        decision,
        decided_by: "Current User", // Will be replaced with auth user
        comment: approvalComment,
        decided_at: new Date().toISOString(),
      });

      // Save back
      const updatedDrafting = {
        ...drafting,
        approval_matrix: {
          ...matrix,
          approvals: filtered,
          updated_at: new Date().toISOString(),
        },
      };

      const { error: writeErr } = await supabase
        .from("commercial_tickets")
        .update({
          type_details: { ...details, tender_drafting: updatedDrafting },
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenderId);

      if (writeErr) {
        toast.error(`Failed to save: ${writeErr.message}`);
      } else {
        toast.success(`${roleLabel}: ${decision === "approved" ? "Approved" : "Rejected"}`);
        setApprovalComment("");
        setExpandedRole(null);
        reload();
      }
    } catch (err: any) {
      toast.error(err.message || "Save failed.");
    }
    setSaving(null);
  }, [tenderId, approvalComment, reload]);

  // Reset a decision
  const handleReset = useCallback(async (role: string) => {
    setSaving(role);
    try {
      const { data: row, error: readErr } = await supabase
        .from("commercial_tickets")
        .select("type_details")
        .eq("id", tenderId)
        .eq("ticket_type", "tender")
        .eq("active", true)
        .single();

      if (readErr || !row) { toast.error("Failed to read."); setSaving(null); return; }

      const details = (row.type_details && typeof row.type_details === "object" && !Array.isArray(row.type_details))
        ? row.type_details as Record<string, any>
        : {};
      const drafting = details.tender_drafting ?? {};
      const matrix = drafting.approval_matrix ?? { approvals: [] };
      const filtered = (Array.isArray(matrix.approvals) ? matrix.approvals : []).filter((a: any) => a.role !== role);

      const updatedDrafting = {
        ...drafting,
        approval_matrix: { ...matrix, approvals: filtered, updated_at: new Date().toISOString() },
      };

      const { error: writeErr } = await supabase
        .from("commercial_tickets")
        .update({ type_details: { ...details, tender_drafting: updatedDrafting }, updated_at: new Date().toISOString() })
        .eq("id", tenderId);

      if (writeErr) toast.error(`Reset failed: ${writeErr.message}`);
      else { toast.success("Decision reset."); reload(); }
    } catch (err: any) { toast.error(err.message); }
    setSaving(null);
  }, [tenderId, reload]);

  // GP% gauge
  const gpGauge = gpPercent !== null ? gpColor(gpPercent) : null;

  return (
    <div className="space-y-4">
      {/* ─── Header: Data Sources Panel ─────────────────────── */}
      <Card className="border-2 border-[var(--color-hala-navy)]/20 shadow-none bg-gradient-to-r from-[var(--color-hala-navy)]/5 to-transparent">
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-lg bg-[var(--color-hala-navy)] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold">Approval Matrix</h3>
            <p className="text-[10px] text-muted-foreground">Mandatory sign-offs based on GP% and pallet volume from this tender's stages</p>
          </div>
          {allApproved && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
              <CheckCircle2 className="w-3 h-3" /> All Approved
            </Badge>
          )}
        </div>

        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Data Inputs */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tender Data Inputs
                </span>
              </div>
              <div className="space-y-2">
                {/* GP% */}
                <div className={`rounded-lg border p-2.5 ${gpGauge ? gpGauge.bg : "bg-slate-50"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Gross Profit %</span>
                    {gpPercent !== null ? (
                      <span className={`text-sm font-bold ${gpGauge!.text}`}>{gpPercent.toFixed(1)}%</span>
                    ) : (
                      <span className="text-sm font-bold text-slate-400">—</span>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{gpSource}</p>
                  {gpPercent !== null && gpGauge && (
                    <Badge variant="outline" className={`text-[8px] mt-1 ${gpGauge.text} ${gpGauge.bg}`}>{gpGauge.label}</Badge>
                  )}
                </div>

                {/* Pallet Volume */}
                <div className="rounded-lg border p-2.5 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Pallet Volume</span>
                    {palletVolume !== null ? (
                      <span className={`text-sm font-bold ${palletVolume > 300 ? "text-amber-700" : "text-slate-700"}`}>
                        {palletVolume.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-400">—</span>
                    )}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{palletSource}</p>
                  {palletVolume !== null && palletVolume > 300 && (
                    <Badge variant="outline" className="text-[8px] mt-1 border-amber-200 text-amber-700 bg-amber-50">
                      &gt;300 → Directors Required
                    </Badge>
                  )}
                </div>
              </div>

              {/* Missing data warning */}
              {(gpPercent === null || palletVolume === null) && (
                <div className="mt-2 flex items-start gap-1.5 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    {gpPercent === null && palletVolume === null
                      ? "GP% and pallet volume not captured yet. Complete P&L/Pricing and Solution Design stages first. Showing minimum approval requirements only."
                      : gpPercent === null
                        ? "GP% not captured yet. Complete P&L/Pricing stage. Showing minimum approval requirements."
                        : "Pallet volume not captured yet. Complete Solution Design stage. Volume-based escalation cannot be determined."
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Right: Approval Progress */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Signoff Progress
                </span>
              </div>

              <div className="flex gap-3">
                {/* Circular gauge */}
                {(() => {
                  const pct = approvalRows.length > 0 ? Math.round((approvedCount / approvalRows.length) * 100) : 0;
                  const circ = 2 * Math.PI * 26;
                  const isComplete = allApproved;
                  return (
                    <div className={`flex flex-col items-center justify-center p-2 rounded-lg border min-w-[80px] ${isComplete ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200" />
                        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5"
                          className={isComplete ? "stroke-emerald-500" : pct > 0 ? "stroke-blue-500" : "stroke-slate-300"}
                          strokeDasharray={`${circ}`}
                          strokeDashoffset={`${circ - (pct / 100) * circ}`}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
                        />
                      </svg>
                      <span className={`text-lg font-bold -mt-11 ${isComplete ? "text-emerald-600" : "text-slate-700"}`}>{pct}%</span>
                      <span className="text-[8px] text-muted-foreground mt-5">Signoff</span>
                    </div>
                  );
                })()}

                {/* Counts */}
                <div className="flex-1 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="text-center p-1.5 rounded-md bg-slate-50 border border-slate-200">
                      <span className="text-sm font-bold text-slate-700">{pendingCount}</span>
                      <p className="text-[8px] text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-emerald-50 border border-emerald-200">
                      <span className="text-sm font-bold text-emerald-700">{approvedCount}</span>
                      <p className="text-[8px] text-muted-foreground">Approved</p>
                    </div>
                    <div className="text-center p-1.5 rounded-md bg-red-50 border border-red-200">
                      <span className="text-sm font-bold text-red-700">{rejectedCount}</span>
                      <p className="text-[8px] text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${approvalRows.length > 0 ? Math.round((approvedCount / approvalRows.length) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-[8px] text-muted-foreground text-right">
                    {approvedCount}/{approvalRows.length} sign-offs complete
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── GP% Routing Explanation ──────────────────────── */}
      <div className="flex items-center gap-2 px-1">
        <FileCheck2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Required Approvals ({approvalRows.length})
        </span>
        {gpPercent !== null && (
          <Badge variant="outline" className="text-[8px]">
            GP {gpPercent.toFixed(1)}% → {approvalRows.length} approver{approvalRows.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* ─── Signoff Cards ───────────────────────────────── */}
      {approvalRows.map((row) => {
        const isExpanded = expandedRole === row.role;
        const isSaving = saving === row.role;
        const decisionColor = row.decision === "approved"
          ? "border-emerald-300 bg-emerald-50/50"
          : row.decision === "rejected"
            ? "border-red-300 bg-red-50/50"
            : "border-border";

        return (
          <Card key={row.role} className={`shadow-none ${decisionColor}`}>
            <CardHeader
              className="py-2.5 px-4 cursor-pointer hover:bg-muted/10"
              onClick={() => setExpandedRole(isExpanded ? null : row.role)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}

                {/* Level badge */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  row.level === 1 ? "bg-red-100 text-red-700" :
                  row.level === 2 ? "bg-amber-100 text-amber-700" :
                  row.level === 3 ? "bg-blue-100 text-blue-700" :
                  "bg-slate-100 text-slate-700"
                }`}>
                  L{row.level}
                </div>

                <div className="flex-1">
                  <span className="text-xs font-semibold">{row.roleLabel}</span>
                  <p className="text-[9px] text-muted-foreground">
                    {row.type === "feasibility" ? "Space & Ability Check" : "Full Approval Required"}
                  </p>
                </div>

                {/* Decision badge */}
                {row.decision === "approved" && (
                  <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                  </Badge>
                )}
                {row.decision === "rejected" && (
                  <Badge variant="outline" className="text-[8px] border-red-300 text-red-700 bg-red-50 gap-0.5">
                    <XCircle className="w-2.5 h-2.5" /> Rejected
                  </Badge>
                )}
                {row.decision === "pending" && (
                  <Badge variant="outline" className="text-[8px] border-slate-200 text-slate-500 gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> Pending
                  </Badge>
                )}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-4 pt-0 space-y-3">
                {/* Previous decision info */}
                {row.decision !== "pending" && (
                  <div className={`flex items-center gap-2 text-[10px] rounded-md border px-3 py-2 ${
                    row.decision === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
                  }`}>
                    {row.decision === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span><strong>{row.decided_by}</strong> — {row.decided_at ? new Date(row.decided_at).toLocaleString() : "—"}</span>
                    {row.comment && <span className="ml-1 text-muted-foreground">"{row.comment}"</span>}
                  </div>
                )}

                {/* Action area */}
                <div className="space-y-2">
                  <Textarea
                    placeholder={`Comment for ${row.roleLabel} decision (optional)...`}
                    className="text-xs min-h-[60px]"
                    value={expandedRole === row.role ? approvalComment : ""}
                    onChange={e => setApprovalComment(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isSaving}
                      onClick={() => handleDecision(row.role, row.roleLabel, row.type, "approved")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {row.type === "feasibility" ? "Confirm Feasibility" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px] gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                      disabled={isSaving}
                      onClick={() => handleDecision(row.role, row.roleLabel, row.type, "rejected")}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                    {row.decision !== "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-[11px] gap-1 text-muted-foreground ml-auto"
                        disabled={isSaving}
                        onClick={() => handleReset(row.role)}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ─── Governance Note ────────────────────────────── */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2.5">
        <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-foreground">Doctrine: Director approval must be obtained in writing.</p>
          <p className="mt-0.5">All approval decisions are logged to the audit trail. AI cannot approve, sign, override, or delete. Human judgment has final authority.</p>
        </div>
      </div>
    </div>
  );
}
