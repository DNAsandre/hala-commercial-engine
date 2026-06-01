import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, CheckCircle, Shield, XCircle, SkipForward,
} from "lucide-react";

// ─── HALA GP MATRIX — Sprint 1: GP Only (Cumulative) ──────────────────
// ≥30%  → Salesman + Regional Sales Head
// 25-30 → Salesman + Regional Sales Head
// 22-25 → + Regional Operations Head
// 10-22 → + Directors
// <10   → + CEO/CFO

function gpApprover(gp: number): { approver: string; color: string; level: number } {
  if (gp < 10) return { approver: "CEO/CFO + Directors + Regional Ops + Regional Sales", color: "text-red-700 bg-red-50 border-red-200", level: 4 };
  if (gp < 22) return { approver: "Directors + Regional Ops + Regional Sales", color: "text-amber-700 bg-amber-50 border-amber-200", level: 3 };
  if (gp < 25) return { approver: "Regional Ops + Regional Sales", color: "text-orange-700 bg-orange-50 border-orange-200", level: 2 };
  if (gp < 30) return { approver: "Salesman + Regional Sales Head", color: "text-blue-700 bg-blue-50 border-blue-200", level: 1 };
  return { approver: "Salesman + Regional Sales Head", color: "text-emerald-700 bg-emerald-50 border-emerald-200", level: 0 };
}

const GP_LEVELS = ["Salesman + Regional Sales Head", "Salesman + Regional Sales Head", "+ Regional Operations Head", "+ Directors", "+ CEO/CFO"];

interface ApprovalRow {
  id: string;
  workspace_type: string;
  workspace_id: string;
  approval_status: string;
  gp_percent: number;
  volume_pallets: number;
  required_approver: string;
  final_approver: string | null;
  override_reason: string;
  overridden: boolean;
  overridden_by: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  approved:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:  "bg-red-50 text-red-700 border-red-200",
  overridden:"bg-purple-50 text-purple-700 border-purple-200",
};

export default function ApprovalsV2() {
  const user = getCurrentUser();
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");

  // Action dialogs
  const [actionTarget, setActionTarget] = useState<ApprovalRow | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "override" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadApprovals(); }, []);

  async function loadApprovals() {
    setLoading(true);
    const { data, error } = await supabase
      .from("commercial_v2_approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) console.error("Failed to load approvals:", error);
    setApprovals((data ?? []) as ApprovalRow[]);
    setLoading(false);
  }

  async function handleApprove() {
    if (!actionTarget) return;
    setSubmitting(true);
    try {
      await supabase.rpc("commercial_v2_approve_approval", {
        p_approval_id: actionTarget.id,
        p_final_approver: user?.name || "system",
      });
      closeAction();
      loadApprovals();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  async function handleReject() {
    if (!actionTarget || actionReason.length < 5) return;
    setSubmitting(true);
    try {
      await supabase.rpc("commercial_v2_reject_approval", {
        p_approval_id: actionTarget.id,
        p_rejected_by: user?.name || "system",
        p_reason: actionReason,
      });
      closeAction();
      loadApprovals();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  async function handleOverride() {
    if (!actionTarget || actionReason.length < 5) return;
    setSubmitting(true);
    try {
      await supabase.rpc("commercial_v2_override_approval", {
        p_approval_id: actionTarget.id,
        p_override_by: user?.name || "system",
        p_override_reason: actionReason,
      });
      closeAction();
      loadApprovals();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  function openAction(a: ApprovalRow, type: "approve" | "reject" | "override") {
    setActionTarget(a);
    setActionType(type);
    setActionReason("");
  }

  function closeAction() {
    setActionTarget(null);
    setActionType(null);
    setActionReason("");
  }

  const pending = approvals.filter(a => a.approval_status === "pending");
  const approved = approvals.filter(a => a.approval_status === "approved");
  const overridden = approvals.filter(a => a.approval_status === "overridden");
  const rejected = approvals.filter(a => a.approval_status === "rejected");

  function filterBySearch(list: ApprovalRow[]) {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(a =>
      a.required_approver?.toLowerCase().includes(s) ||
      a.final_approver?.toLowerCase().includes(s) ||
      a.workspace_id?.toLowerCase().includes(s)
    );
  }

  function renderTable(list: ApprovalRow[]) {
    const filtered = filterBySearch(list);
    if (filtered.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground text-xs">
          <Shield className="h-6 w-6 mx-auto opacity-30 mb-2" />
          No approvals in this category
        </div>
      );
    }
    return (
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity</TableHead>
              <TableHead>GP%</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>GP Band</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Final Approver</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(a => {
              const gp = gpApprover(a.gp_percent || 0);
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">{a.workspace_type}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-1 font-mono">{a.workspace_id?.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold text-sm ${a.gp_percent < 10 ? "text-red-700" : a.gp_percent < 22 ? "text-amber-700" : "text-emerald-700"}`}>
                      {a.gp_percent || 0}%
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{a.required_approver || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {GP_LEVELS.map((level, i) => (
                        <div
                          key={level}
                          className={`w-3 h-3 rounded-sm ${i >= gp.level ? gp.color : "bg-slate-100 border-slate-200"} border`}
                          title={level}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${STATUS_COLORS[a.approval_status] || ""}`}>
                      {a.approval_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.final_approver || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {a.approval_status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-emerald-700" onClick={() => openAction(a, "approve")}>
                          <CheckCircle className="h-3 w-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-red-700" onClick={() => openAction(a, "reject")}>
                          <XCircle className="h-3 w-3" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 text-amber-700" onClick={() => openAction(a, "override")}>
                          <SkipForward className="h-3 w-3" /> Override
                        </Button>
                      </div>
                    )}
                    {a.approval_status !== "pending" && a.override_reason && (
                      <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px] block">{a.override_reason}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Approvals V.2</h1>
          <p className="text-sm text-muted-foreground">
            GP-based approval matrix — Hala bands · No hard stops · Override always available
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadApprovals}>Refresh</Button>
      </div>

      {/* GP Matrix Reference */}
      <div className="rounded border bg-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Hala GP Approval Matrix — Sprint 1
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { band: "≥30%", approver: "Salesman + Regional Sales Head", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { band: "25–30%", approver: "Salesman + Regional Sales Head", color: "bg-blue-50 text-blue-700 border-blue-200" },
            { band: "22–25%", approver: "+ Regional Operations Head", color: "bg-orange-50 text-orange-700 border-orange-200" },
            { band: "10–22%", approver: "+ Directors", color: "bg-amber-50 text-amber-700 border-amber-200" },
            { band: "<10%", approver: "+ CEO/CFO", color: "bg-red-50 text-red-700 border-red-200" },
          ].map(b => (
            <div key={b.band} className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs ${b.color}`}>
              <Shield className="h-3 w-3" />
              <span className="font-semibold">{b.band}</span>
              <span>→ {b.approver}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search approver, entity..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-64"
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="overridden">Override ({overridden.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {loading ? <div className="py-8 text-center text-muted-foreground">Loading...</div> : renderTable(pending)}
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
          {renderTable(approved)}
        </TabsContent>
        <TabsContent value="overridden" className="mt-4">
          {renderTable(overridden)}
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
          {renderTable(rejected)}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionTarget && !!actionType} onOpenChange={(open) => { if (!open) closeAction(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Approve Approval"}
              {actionType === "reject" && "Reject Approval"}
              {actionType === "override" && "Override Approval"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" && "Confirm approval. This will mark the record as approved."}
              {actionType === "reject" && "Provide a reason for rejection (min 5 characters)."}
              {actionType === "override" && "Provide an override reason (min 5 characters). No hard stop — this is logged."}
            </DialogDescription>
          </DialogHeader>

          {actionTarget && (
            <div className="space-y-3">
              <div className="rounded border bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Entity</span><span className="capitalize">{actionTarget.workspace_type} {actionTarget.workspace_id?.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GP%</span><span className="font-semibold">{actionTarget.gp_percent}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Required Approver</span><span>{actionTarget.required_approver}</span></div>
              </div>

              {(actionType === "reject" || actionType === "override") && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Reason *</label>
                  <Textarea
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value)}
                    placeholder={actionType === "reject" ? "Why is this being rejected?" : "Why is this being overridden?"}
                    rows={3}
                    className="text-xs"
                  />
                  {actionReason.length > 0 && actionReason.length < 5 && (
                    <p className="text-[10px] text-red-600">Minimum 5 characters required</p>
                  )}
                </div>
              )}

              {actionType === "override" && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Override is not a block. It is logged and auditable. Continue freely.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeAction}>Cancel</Button>
            {actionType === "approve" && (
              <Button onClick={handleApprove} disabled={submitting} className="gap-1">
                <CheckCircle className="h-3 w-3" /> {submitting ? "Approving..." : "Confirm Approve"}
              </Button>
            )}
            {actionType === "reject" && (
              <Button onClick={handleReject} disabled={submitting || actionReason.length < 5} variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" /> {submitting ? "Rejecting..." : "Confirm Reject"}
              </Button>
            )}
            {actionType === "override" && (
              <Button onClick={handleOverride} disabled={submitting || actionReason.length < 5} className="gap-1 bg-amber-600 hover:bg-amber-700">
                <SkipForward className="h-3 w-3" /> {submitting ? "Overriding..." : "Log Override & Continue"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}