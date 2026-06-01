/**
 * DecisionRecordTab — Formal Bid / No-Bid Decision Record
 *
 * Sections:
 *   1. Formal Decision Record
 *   2. If Bid
 *   3. If No-Bid
 *   4. Decision Evidence (repeatable)
 *   5. Save Button
 *
 * Data: ws.tender.bidNoBidData.decision_record
 * Save: updateTenderBidNoBidData → merges decision_record only
 *
 * This is NOT an activity/audit feed.
 * This is a structured decision record.
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  Stamp, CheckCircle2, XCircle, FileText,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type FinalDecision = "Bid" | "No-Bid" | "Hold" | "Escalated" | "Not Decided";
type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Not Required" | "Not Assessed";
type NextStage = "Solution Design" | "P&L / Pricing" | "Tender Drafting" | "Other" | "Not Decided";
type YesNoNA = "Yes" | "No" | "Not Assessed";
type NoBidReason = "Poor Fit" | "Low Margin" | "Insufficient Capability" | "Risk Too High" | "Deadline Impossible" | "Missing Mandatory Requirement" | "Commercially Unattractive" | "Strategic Mismatch" | "Other" | "Not Assessed";
type EvidenceType = "Qualification Summary" | "Technical Evidence" | "Risk Evidence" | "Customer Fit Evidence" | "Commercial Evidence" | "Approval Evidence" | "Other";

interface FormalRecord {
  decision: FinalDecision;
  decision_date: string;
  decision_owner: string;
  approver: string;
  approval_status: ApprovalStatus;
  decision_summary: string;
  conditions: string;
  clarifications_required: string;
}

interface IfBidData {
  approved_next_stage: NextStage;
  approved_to_commit: YesNoNA;
  proposal_authorized: YesNoNA;
}

interface IfNoBidData {
  reason: NoBidReason;
  notes: string;
}

interface EvidenceRow {
  evidence_type: EvidenceType | "";
  description: string;
  source: string;
  document_reference: string;
  owner: string;
}

interface DecisionRecordData {
  formal: FormalRecord;
  if_bid: IfBidData;
  if_no_bid: IfNoBidData;
  evidence: EvidenceRow[];
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const FINAL_DECISION_OPTIONS: FinalDecision[] = ["Bid", "No-Bid", "Hold", "Escalated", "Not Decided"];
const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = ["Pending", "Approved", "Rejected", "Not Required", "Not Assessed"];
const NEXT_STAGE_OPTIONS: NextStage[] = ["Solution Design", "P&L / Pricing", "Tender Drafting", "Other", "Not Decided"];
const YES_NO_OPTIONS: YesNoNA[] = ["Yes", "No", "Not Assessed"];
const NO_BID_REASON_OPTIONS: NoBidReason[] = [
  "Poor Fit", "Low Margin", "Insufficient Capability", "Risk Too High",
  "Deadline Impossible", "Missing Mandatory Requirement", "Commercially Unattractive",
  "Strategic Mismatch", "Other", "Not Assessed",
];
const EVIDENCE_TYPE_OPTIONS: EvidenceType[] = [
  "Qualification Summary", "Technical Evidence", "Risk Evidence",
  "Customer Fit Evidence", "Commercial Evidence", "Approval Evidence", "Other",
];

// ═══════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════

function emptyFormal(): FormalRecord {
  return { decision: "Not Decided", decision_date: "", decision_owner: "", approver: "", approval_status: "Not Assessed", decision_summary: "", conditions: "", clarifications_required: "" };
}
function emptyIfBid(): IfBidData {
  return { approved_next_stage: "Not Decided", approved_to_commit: "Not Assessed", proposal_authorized: "Not Assessed" };
}
function emptyIfNoBid(): IfNoBidData {
  return { reason: "Not Assessed", notes: "" };
}
function emptyEvidence(): EvidenceRow {
  return { evidence_type: "", description: "", source: "", document_reference: "", owner: "" };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusBtnClass(selected: boolean, status: string): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (status === "Bid" || status === "Yes" || status === "Approved") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (status === "Hold" || status === "Pending" || status === "Escalated") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (status === "No-Bid" || status === "No" || status === "Rejected") return "bg-red-100 border-red-300 text-red-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
}

export default function DecisionRecordTab({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.bidNoBidData as any;
  const dr = existing?.decision_record;

  const [formal, setFormal] = useState<FormalRecord>(() => {
    if (dr?.formal && typeof dr.formal === "object") return { ...emptyFormal(), ...dr.formal };
    return emptyFormal();
  });

  const [ifBid, setIfBid] = useState<IfBidData>(() => {
    if (dr?.if_bid && typeof dr.if_bid === "object") return { ...emptyIfBid(), ...dr.if_bid };
    return emptyIfBid();
  });

  const [ifNoBid, setIfNoBid] = useState<IfNoBidData>(() => {
    if (dr?.if_no_bid && typeof dr.if_no_bid === "object") return { ...emptyIfNoBid(), ...dr.if_no_bid };
    return emptyIfNoBid();
  });

  const [evidence, setEvidence] = useState<EvidenceRow[]>(() => {
    return Array.isArray(dr?.evidence) ? dr.evidence : [];
  });

  const [saving, setSaving] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ formal: true, if_bid: true, if_no_bid: true, evidence: true });
  const toggle = (k: string) => setSectionsOpen(p => ({ ...p, [k]: !p[k] }));

  const addEvidence = () => setEvidence(p => [...p, emptyEvidence()]);
  const removeEvidence = (i: number) => setEvidence(p => p.filter((_, idx) => idx !== i));
  const updateEvidence = (i: number, f: keyof EvidenceRow, v: any) => setEvidence(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = {
        ...(existing || {}),
        decision_record: { formal, if_bid: ifBid, if_no_bid: ifNoBid, evidence },
      };
      const result = await updateTenderBidNoBidData(tenderId, patch, "Decision Record tab saved");
      if (result.success) toast.success("Decision Record saved");
      else toast.error("Save failed", { description: result.error });
    } finally {
      setSaving(false);
    }
  }, [tenderId, formal, ifBid, ifNoBid, evidence, existing]);

  const showIfBid = formal.decision === "Bid";
  const showIfNoBid = formal.decision === "No-Bid";

  return (
    <div className="space-y-4">
      {/* ── Formal Decision Record ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("formal")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.formal ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Stamp className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Formal Decision Record</span>
            <Badge variant="outline" className="text-[8px] ml-auto">
              {formal.decision !== "Not Decided" ? formal.decision : "Not Decided"}
            </Badge>
          </div>
        </CardHeader>
        {sectionsOpen.formal && (
          <CardContent className="p-4 space-y-4">
            {/* Final Decision */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Final Decision</label>
              <div className="flex flex-wrap gap-1.5">
                {FINAL_DECISION_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(formal.decision === opt, opt)}`} onClick={() => setFormal(p => ({ ...p, decision: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Owner + Approver */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Date</label>
                <input type="date" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" value={formal.decision_date} onChange={e => setFormal(p => ({ ...p, decision_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Owner</label>
                <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Owner..." value={formal.decision_owner} onChange={e => setFormal(p => ({ ...p, decision_owner: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Approver</label>
                <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Approver..." value={formal.approver} onChange={e => setFormal(p => ({ ...p, approver: e.target.value }))} />
              </div>
            </div>

            {/* Approval Status */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approval Status</label>
              <div className="flex flex-wrap gap-1.5">
                {APPROVAL_STATUS_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(formal.approval_status === opt, opt)}`} onClick={() => setFormal(p => ({ ...p, approval_status: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Textareas */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Decision Summary</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Summary of the decision and its basis..." value={formal.decision_summary} onChange={e => setFormal(p => ({ ...p, decision_summary: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Conditions / Assumptions</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" placeholder="Enter conditions or assumptions..." value={formal.conditions} onChange={e => setFormal(p => ({ ...p, conditions: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Clarifications Required Before Proceeding</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" placeholder="Outstanding clarifications..." value={formal.clarifications_required} onChange={e => setFormal(p => ({ ...p, clarifications_required: e.target.value }))} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── If Bid ── */}
      {showIfBid && (
        <Card className="border-border shadow-none border-emerald-200">
          <CardHeader className="pb-2 border-b border-emerald-200 bg-emerald-50/30 cursor-pointer" onClick={() => toggle("if_bid")}>
            <div className="flex items-center gap-2">
              {sectionsOpen.if_bid ? <ChevronDown className="w-3 h-3 text-emerald-600" /> : <ChevronRight className="w-3 h-3 text-emerald-600" />}
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800">If Bid — Next Steps</span>
            </div>
          </CardHeader>
          {sectionsOpen.if_bid && (
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approved Next Stage</label>
                <div className="flex flex-wrap gap-1.5">
                  {NEXT_STAGE_OPTIONS.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifBid.approved_next_stage === opt, opt === "Not Decided" ? "Not Assessed" : "Bid")}`} onClick={() => setIfBid(p => ({ ...p, approved_next_stage: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Approved to Commit Resources</label>
                  <div className="flex gap-1.5">
                    {YES_NO_OPTIONS.map(opt => (
                      <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifBid.approved_to_commit === opt, opt)}`} onClick={() => setIfBid(p => ({ ...p, approved_to_commit: opt }))}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Proposal Production Authorized</label>
                  <div className="flex gap-1.5">
                    {YES_NO_OPTIONS.map(opt => (
                      <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifBid.proposal_authorized === opt, opt)}`} onClick={() => setIfBid(p => ({ ...p, proposal_authorized: opt }))}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── If No-Bid ── */}
      {showIfNoBid && (
        <Card className="border-border shadow-none border-red-200">
          <CardHeader className="pb-2 border-b border-red-200 bg-red-50/30 cursor-pointer" onClick={() => toggle("if_no_bid")}>
            <div className="flex items-center gap-2">
              {sectionsOpen.if_no_bid ? <ChevronDown className="w-3 h-3 text-red-600" /> : <ChevronRight className="w-3 h-3 text-red-600" />}
              <XCircle className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-semibold text-red-800">If No-Bid — Reason</span>
            </div>
          </CardHeader>
          {sectionsOpen.if_no_bid && (
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">No-Bid Reason</label>
                <div className="flex flex-wrap gap-1.5">
                  {NO_BID_REASON_OPTIONS.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(ifNoBid.reason === opt, opt === "Not Assessed" ? "Not Assessed" : "No-Bid")}`} onClick={() => setIfNoBid(p => ({ ...p, reason: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">No-Bid Notes</label>
                <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter no-bid rationale and notes..." value={ifNoBid.notes} onChange={e => setIfNoBid(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Decision Evidence ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("evidence")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.evidence ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-semibold">Decision Evidence</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{evidence.length}</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.evidence && (
          <CardContent className="p-4 space-y-3">
            {evidence.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No decision evidence added yet.</p>
            )}
            {evidence.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeEvidence(idx)}>
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Evidence Type</label>
                    <select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.evidence_type} onChange={e => updateEvidence(idx, "evidence_type", e.target.value)}>
                      <option value="">Select...</option>
                      {EVIDENCE_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Source</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Source..." value={row.source} onChange={e => updateEvidence(idx, "source", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateEvidence(idx, "owner", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Description</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Describe the evidence..." value={row.description} onChange={e => updateEvidence(idx, "description", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Document Reference</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Doc ref..." value={row.document_reference} onChange={e => updateEvidence(idx, "document_reference", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addEvidence}>
              <Plus className="w-3 h-3" /> Add Decision Evidence
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Decision Record
        </Button>
      </div>
    </div>
  );
}
