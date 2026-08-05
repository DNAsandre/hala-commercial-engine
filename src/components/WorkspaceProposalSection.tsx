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
import {
  listProposalsByWorkspace,
  markProposalSent,
  markProposalNegotiation,
  approveProposal,
  recordProposalSubmittedForReview,
  recordProposalReadyForCrm,
  recordProposalRejected,
  PROPOSAL_VERSION_UNAVAILABLE,
  type ProposalRecord,
  type ProposalMutationOutcome,
  type RuntimeResult,
} from "@/lib/commercial-runtime";
import ProposalWizard from "./ProposalWizard";

/**
 * Status vocabulary = the states the established internal_stage → proposal
 * state mapping can actually produce. Nothing else is displayable, so nothing
 * else is listed.
 */
const statusCfg: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  ready_for_crm: { color: "bg-[#075eea]/15 text-[#075eea]", label: "Ready for CRM" },
  sent: { color: "bg-[#075eea]/15 text-[#075eea]", label: "Sent" },
  negotiation_active: { color: "bg-orange-100 text-orange-700", label: "Negotiation" },
  commercial_approved: { color: "bg-emerald-100 text-emerald-700", label: "Commercial Approved" },
};

interface Props { workspaceId: string; customerId?: string; customerName?: string; }

export default function WorkspaceProposalSection({ workspaceId, customerId, customerName }: Props) {
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editProp, setEditProp] = useState<ProposalRecord | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetch_ = useCallback(async () => {
    const r = await listProposalsByWorkspace(workspaceId);
    if (!r.ok) {
      // A failed query is NOT an empty list — surface it.
      setLoadError(r.error);
      setProposals([]);
    } else {
      setLoadError(null);
      setProposals(r.data);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  /** Report only what actually happened — never a success we did not confirm. */
  const act = async (
    fn: () => Promise<RuntimeResult<ProposalMutationOutcome>>,
    msg: string,
  ) => {
    const res = await fn();
    if (!res.ok) { toast.error(res.error); return false; }
    const notes = [res.data.recorded, ...res.data.warnings];
    if (res.data.unstoredFields.length > 0) {
      notes.push(`Not stored (no established column): ${res.data.unstoredFields.join(", ")}.`);
    }
    toast.success(msg, { description: notes.join(" ") });
    fetch_();
    return true;
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error("Reason required"); return; }
    const done = await act(() => recordProposalRejected(rejectId, rejectReason), "Rejection recorded");
    if (!done) return;
    setRejectId(null); setRejectReason("");
  };

  if (wizardOpen || editProp) {
    return <ProposalWizard workspaceId={workspaceId} customerId={customerId} customerName={customerName}
      existingProposal={editProp} onSaved={() => { setWizardOpen(false); setEditProp(null); fetch_(); }}
      onCancel={() => { setWizardOpen(false); setEditProp(null); }} />;
  }

  // The established feed returns the workspace's proposal tickets newest-first;
  // there is no "superseded" proposal state in commercial_tickets, so the first
  // row is simply the current one.
  const latest = proposals[0];
  const older = proposals.slice(1);

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
        : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Proposals could not be loaded</p>
              <p className="text-[11px] text-red-700 mt-0.5">{loadError}</p>
              <p className="text-[10px] text-red-700/80 mt-1">This is a read failure, not an empty list. Nothing below is being hidden.</p>
            </div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-8">
            <FileCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No proposals yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create a proposal from an existing quote.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {latest && <PropCard p={latest} isLatest
              onEdit={() => setEditProp(latest)}
              onSubmitReview={() => act(() => recordProposalSubmittedForReview(latest.id), "Submitted for review")}
              onMarkReadyCRM={() => act(() => recordProposalReadyForCrm(latest.id), "Marked ready for CRM")}
              onMarkSent={() => act(() => markProposalSent(latest.id), "Marked as sent")}
              onMarkNeg={() => act(() => markProposalNegotiation(latest.id), "Negotiation active")}
              onApprove={() => act(() => approveProposal(latest.id), "Proposal approved")}
              onReject={() => setRejectId(latest.id)}
              onNewVersion={() => toast.error(PROPOSAL_VERSION_UNAVAILABLE)}
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
  p: ProposalRecord; isLatest: boolean; onEdit?: () => void; onSubmitReview?: () => void; onMarkReadyCRM?: () => void;
  onMarkSent?: () => void; onMarkNeg?: () => void; onApprove?: () => void; onReject?: () => void; onNewVersion?: () => void;
}) {
  const cfg = statusCfg[p.status] || statusCfg.draft;

  return (
    <div className={`rounded-lg border p-3 ${isLatest ? "" : "bg-muted/10 border-muted"}`}>
      <div className="flex items-center gap-2 mb-2">
        {/* Only shown when the ticket actually carries a version. No established
            path writes type_details.proposal_version, so rendering "V1"
            unconditionally asserted a number the database does not hold. */}
        {p.version_number != null && <span className="text-sm font-semibold">V{p.version_number}</span>}
        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
        {isLatest && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50">Latest</Badge>}
      </div>
      {p.title && <p className="text-xs font-medium mb-1">{p.title}</p>}
      <div className="grid grid-cols-2 gap-3 text-xs mb-2">
        <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{p.customer_name || "Not captured"}</p></div>
        <div><span className="text-muted-foreground">Internal stage</span><p className="font-medium">{p.internal_stage || "Not captured"}</p></div>
      </div>

      {isLatest && (
        // No gates: every recorded action stays available to the human at any
        // stage. Actions marked "record" write an audit entry only — there is
        // no established internal stage for them, so no stage is invented.
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed">
          {onEdit && <Btn onClick={onEdit} icon={Edit} label="Edit" />}
          {onSubmitReview && <Btn onClick={onSubmitReview} icon={Send} label="Submit Review (record)" />}
          {onMarkReadyCRM && <Btn onClick={onMarkReadyCRM} icon={ArrowRight} label="Ready CRM (record)" />}
          {onMarkSent && <Btn onClick={onMarkSent} icon={Send} label="Mark Sent" />}
          {onMarkNeg && <Btn onClick={onMarkNeg} icon={ArrowRight} label="Negotiation" />}
          {onApprove && <Btn onClick={onApprove} icon={CheckCircle2} label="Approve" color="emerald" />}
          {onReject && <Btn onClick={onReject} icon={XCircle} label="Reject (record)" color="red" />}
          {onNewVersion && <Btn onClick={onNewVersion} icon={Copy} label="New Version" color="blue" />}
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, icon: Icon, label, color }: { onClick: () => void; icon: any; label: string; color?: string }) {
  const c = color === "emerald" ? "border-emerald-300 text-emerald-700" : color === "red" ? "border-red-300 text-red-700" : color === "blue" ? "border-blue-300 text-blue-700" : "";
  return <Button variant="outline" size="sm" onClick={onClick} className={`text-[10px] h-6 ${c}`}><Icon className="w-3 h-3 mr-0.5" />{label}</Button>;
}
