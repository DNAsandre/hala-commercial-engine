/**
 * WorkspaceProposalSection — Proposal management for Workspace Commercial tab
 * Sprint 4: Shows proposals, status actions, version history, linked quote badge.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus, Edit, Send, CheckCircle2, XCircle, Copy, Clock, ChevronDown, ChevronRight,
  FileCheck, Link2, Eye, ArrowRight, AlertTriangle, Info,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import ProposalWizard from "./ProposalWizard";

const statusCfg: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  ready_for_review: { color: "bg-blue-100 text-blue-700", label: "Ready for Review" },
  ready_for_crm: { color: "bg-indigo-100 text-indigo-700", label: "Ready for CRM" },
  sent: { color: "bg-purple-100 text-purple-700", label: "Sent" },
  negotiation_active: { color: "bg-orange-100 text-orange-700", label: "Negotiation" },
  approved: { color: "bg-emerald-100 text-emerald-700", label: "Approved" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  superseded: { color: "bg-amber-100 text-amber-700", label: "Superseded" },
};

interface Props { workspaceId: string; customerId?: string; customerName?: string; }

export default function WorkspaceProposalSection({ workspaceId, customerId, customerName }: Props) {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editProp, setEditProp] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [versionReason, setVersionReason] = useState("");

  const fetch_ = useCallback(async () => {
    try { const r = await api.proposals.listByWorkspace(workspaceId); setProposals(r.data || []); }
    catch (e: any) { console.warn("[ProposalSection]", e.message); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); toast.success(msg); fetch_(); } catch (e: any) { toast.error(e.message); }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error("Reason required"); return; }
    await act(() => api.proposals.reject(rejectId!, rejectReason), "Proposal rejected");
    setRejectId(null); setRejectReason("");
  };

  const handleVersion = async () => {
    if (!versionId || !versionReason.trim()) { toast.error("Reason required"); return; }
    await act(() => api.proposals.createVersion(versionId!, versionReason), "New version created");
    setVersionId(null); setVersionReason("");
  };

  if (wizardOpen || editProp) {
    return <ProposalWizard workspaceId={workspaceId} customerId={customerId} customerName={customerName}
      existingProposal={editProp} onSaved={() => { setWizardOpen(false); setEditProp(null); fetch_(); }}
      onCancel={() => { setWizardOpen(false); setEditProp(null); }} />;
  }

  const latest = proposals.find(p => p.status !== "superseded") || proposals[0];
  const older = proposals.filter(p => p !== latest);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> Proposals
            {proposals.length > 0 && <Badge variant="outline" className="text-[10px]">{proposals.length}</Badge>}
          </CardTitle>
          <Button size="sm" onClick={() => setWizardOpen(true)} className="text-xs h-7 bg-[var(--color-hala-navy)]"><Plus className="w-3.5 h-3.5 mr-1" />New Proposal</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? <p className="text-xs text-muted-foreground py-8 text-center">Loading...</p>
        : proposals.length === 0 ? (
          <div className="text-center py-8">
            <FileCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No proposals yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create a proposal from an existing quote.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {latest && <PropCard p={latest} isLatest
              onEdit={() => latest.status === "draft" ? setEditProp(latest) : setVersionId(latest.id)}
              onSubmitReview={() => act(() => api.proposals.submitReview(latest.id), "Submitted for review")}
              onMarkReadyCRM={() => act(() => api.proposals.markReadyCRM(latest.id), "Marked ready for CRM")}
              onMarkSent={() => act(() => api.proposals.markSent(latest.id), "Marked as sent")}
              onMarkNeg={() => act(() => api.proposals.markNegotiation(latest.id), "Negotiation active")}
              onApprove={() => act(() => api.proposals.approve(latest.id), "Proposal approved")}
              onReject={() => setRejectId(latest.id)}
              onNewVersion={() => setVersionId(latest.id)}
            />}

            {rejectId && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-800">Rejection Reason</p>
                <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why?" className="h-8 text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setRejectId(null); setRejectReason(""); }} className="text-xs h-7">Cancel</Button>
                  <Button size="sm" onClick={handleReject} className="text-xs h-7 bg-red-600 hover:bg-red-700">Reject</Button>
                </div>
              </div>
            )}

            {versionId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800">New Version — Change Reason</p>
                <Input value={versionReason} onChange={e => setVersionReason(e.target.value)} placeholder="Why is a new version needed?" className="h-8 text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setVersionId(null); setVersionReason(""); }} className="text-xs h-7">Cancel</Button>
                  <Button size="sm" onClick={handleVersion} className="text-xs h-7 bg-blue-600 hover:bg-blue-700">Create Version</Button>
                </div>
              </div>
            )}

            {older.length > 0 && (
              <div>
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Version History ({older.length})
                </button>
                {expanded && older.map(p => <PropCard key={p.id} p={p} isLatest={false} />)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropCard({ p, isLatest, onEdit, onSubmitReview, onMarkReadyCRM, onMarkSent, onMarkNeg, onApprove, onReject, onNewVersion }: {
  p: any; isLatest: boolean; onEdit?: () => void; onSubmitReview?: () => void; onMarkReadyCRM?: () => void;
  onMarkSent?: () => void; onMarkNeg?: () => void; onApprove?: () => void; onReject?: () => void; onNewVersion?: () => void;
}) {
  const cfg = statusCfg[p.status] || statusCfg.draft;
  const snap = p.pricing_snapshot;

  return (
    <div className={`rounded-lg border p-3 ${isLatest ? "" : "bg-muted/10 border-muted"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold">{p.proposal_number || `V${p.version_number || p.version}`}</span>
        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
        {p.linked_quote_id && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 gap-0.5"><Link2 className="w-2.5 h-2.5" />{snap?.quote_number || "Quote"}</Badge>}
        {isLatest && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50">Latest</Badge>}
        {p.indicative_sla_disclaimer && <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />SLA Advisory</Badge>}
      </div>
      {p.title && <p className="text-xs font-medium mb-1">{p.title}</p>}
      {snap && (
        <div className="grid grid-cols-3 gap-3 text-xs mb-2">
          <div><span className="text-muted-foreground">Annual Value</span><p className="font-medium">{snap.currency || "SAR"} {(snap.annual_revenue || 0).toLocaleString()}</p></div>
          <div><span className="text-muted-foreground">GP%</span><p className="font-medium">{snap.gp_percent || 0}%</p></div>
          <div><span className="text-muted-foreground">Service</span><p className="font-medium">{snap.service_type}</p></div>
        </div>
      )}
      {p.change_reason && <p className="text-[10px] text-muted-foreground"><span className="font-medium">Change:</span> {p.change_reason}</p>}

      {isLatest && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed">
          {p.status === "draft" && onEdit && <Btn onClick={onEdit} icon={Edit} label="Edit" />}
          {p.status === "draft" && onSubmitReview && <Btn onClick={onSubmitReview} icon={Send} label="Submit Review" />}
          {p.status === "ready_for_review" && onMarkReadyCRM && <Btn onClick={onMarkReadyCRM} icon={ArrowRight} label="Ready CRM" />}
          {p.status === "ready_for_review" && onApprove && <Btn onClick={onApprove} icon={CheckCircle2} label="Approve" color="emerald" />}
          {p.status === "ready_for_crm" && onMarkSent && <Btn onClick={onMarkSent} icon={Send} label="Mark Sent" />}
          {p.status === "sent" && onMarkNeg && <Btn onClick={onMarkNeg} icon={ArrowRight} label="Negotiation" />}
          {p.status === "sent" && onApprove && <Btn onClick={onApprove} icon={CheckCircle2} label="Approve" color="emerald" />}
          {p.status === "negotiation_active" && onApprove && <Btn onClick={onApprove} icon={CheckCircle2} label="Approve" color="emerald" />}
          {["ready_for_review", "ready_for_crm", "sent", "negotiation_active"].includes(p.status) && onReject && <Btn onClick={onReject} icon={XCircle} label="Reject" color="red" />}
          {["approved", "rejected"].includes(p.status) && onNewVersion && <Btn onClick={onNewVersion} icon={Copy} label="New Version" color="blue" />}
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, icon: Icon, label, color }: { onClick: () => void; icon: any; label: string; color?: string }) {
  const c = color === "emerald" ? "border-emerald-300 text-emerald-700" : color === "red" ? "border-red-300 text-red-700" : color === "blue" ? "border-blue-300 text-blue-700" : "";
  return <Button variant="outline" size="sm" onClick={onClick} className={`text-[10px] h-6 ${c}`}><Icon className="w-3 h-3 mr-0.5" />{label}</Button>;
}
