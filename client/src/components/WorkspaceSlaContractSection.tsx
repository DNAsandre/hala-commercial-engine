/**
 * WorkspaceSlaContractSection — SLA list + Contract Readiness + Contract Status
 * Sprint 5: Shows SLA management, contract readiness checklist, contract tracking.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Edit, Send, CheckCircle2, XCircle, Copy, ChevronDown, ChevronRight,
  ShieldCheck, Link2, Eye, ArrowRight, AlertTriangle, ClipboardList, FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import SlaWizard from "./SlaWizard";

const slaCfg: Record<string, { color: string; label: string }> = {
  not_started: { color: "bg-gray-100 text-gray-600", label: "Not Started" },
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  operational_review: { color: "bg-orange-100 text-orange-700", label: "Ops Review" },
  submitted: { color: "bg-blue-100 text-blue-700", label: "Submitted" },
  approved: { color: "bg-emerald-100 text-emerald-700", label: "Approved" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  superseded: { color: "bg-amber-100 text-amber-700", label: "Superseded" },
};

const contractCfg: Record<string, { color: string; label: string }> = {
  not_ready: { color: "bg-gray-100 text-gray-600", label: "Not Ready" },
  ready: { color: "bg-blue-100 text-blue-700", label: "Ready" },
  sent: { color: "bg-purple-100 text-purple-700", label: "Sent" },
  signed: { color: "bg-emerald-100 text-emerald-700", label: "Signed" },
  delayed: { color: "bg-amber-100 text-amber-700", label: "Delayed" },
  cancelled: { color: "bg-red-100 text-red-700", label: "Cancelled" },
};

interface Props {
  workspaceId: string; customerId?: string; customerName?: string;
  quotes?: any[]; proposals?: any[];
}

export default function WorkspaceSlaContractSection({ workspaceId, customerId, customerName, quotes = [], proposals = [] }: Props) {
  const [slas, setSlas] = useState<any[]>([]);
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editSla, setEditSla] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [versionReason, setVersionReason] = useState("");
  const [contractEdit, setContractEdit] = useState(false);
  const [cForm, setCForm] = useState({ contract_status: "not_ready", contract_sent_at: "", contract_signed_at: "", contract_reference: "", notes: "" });

  const fetch_ = useCallback(async () => {
    try {
      const [sR, cR] = await Promise.all([api.slas.listByWorkspace(workspaceId), api.contractStatus.get(workspaceId)]);
      setSlas(sR.data || []);
      const cs = cR.data;
      setContract(cs);
      setCForm({ contract_status: cs?.contract_status || "not_ready", contract_sent_at: cs?.contract_sent_at || "", contract_signed_at: cs?.contract_signed_at || "", contract_reference: cs?.contract_reference || "", notes: cs?.notes || "" });
    } catch (e: any) { console.warn("[SlaContract]", e.message); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const act = async (fn: () => Promise<any>, msg: string) => {
    try { await fn(); toast.success(msg); fetch_(); } catch (e: any) { toast.error(e.message); }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error("Reason required"); return; }
    await act(() => api.slas.reject(rejectId!, rejectReason), "SLA rejected");
    setRejectId(null); setRejectReason("");
  };

  const handleVersion = async () => {
    if (!versionId || !versionReason.trim()) { toast.error("Reason required"); return; }
    await act(() => api.slas.createVersion(versionId!, versionReason), "New SLA version created");
    setVersionId(null); setVersionReason("");
  };

  const handleContractSave = async () => {
    await act(() => api.contractStatus.update(workspaceId, cForm), "Contract status updated");
    setContractEdit(false);
  };

  if (wizardOpen || editSla) {
    return <SlaWizard workspaceId={workspaceId} customerId={customerId} customerName={customerName}
      existingSla={editSla} onSaved={() => { setWizardOpen(false); setEditSla(null); fetch_(); }}
      onCancel={() => { setWizardOpen(false); setEditSla(null); }} />;
  }

  const latest = slas.find(s => s.status !== "superseded") || slas[0];
  const older = slas.filter(s => s !== latest);

  // ─── Contract Readiness Checklist (informational) ──────
  const hasQuote = quotes.length > 0;
  const quoteApproved = quotes.some(q => q.status === "approved");
  const hasProposal = proposals.length > 0;
  const proposalReady = proposals.some(p => ["approved", "ready_for_crm", "sent"].includes(p.status));
  const hasSla = slas.length > 0;
  const slaApproved = slas.some(s => s.status === "approved");
  const contractSent = !!contract?.contract_sent_at;
  const contractSigned = !!contract?.contract_signed_at;
  const checks = [
    { label: "Quote exists", ok: hasQuote },
    { label: "Quote approved", ok: quoteApproved },
    { label: "Proposal exists", ok: hasProposal },
    { label: "Proposal ready", ok: proposalReady },
    { label: "SLA exists", ok: hasSla },
    { label: "SLA approved", ok: slaApproved },
    { label: "Contract sent", ok: contractSent },
    { label: "Contract signed", ok: contractSigned },
  ];

  return (
    <div className="space-y-4">
      {/* SLA Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-serif flex items-center gap-2"><ShieldCheck className="w-4 h-4" />SLA{slas.length > 0 && <Badge variant="outline" className="text-[10px]">{slas.length}</Badge>}</CardTitle>
            <Button size="sm" onClick={() => setWizardOpen(true)} className="text-xs h-7 bg-[var(--color-hala-navy)]"><Plus className="w-3.5 h-3.5 mr-1" />New SLA</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? <p className="text-xs text-muted-foreground py-6 text-center">Loading...</p>
          : slas.length === 0 ? (
            <div className="text-center py-6"><ShieldCheck className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No SLAs yet</p><p className="text-xs text-muted-foreground/60 mt-1">Create an SLA from an existing proposal.</p></div>
          ) : (
            <div className="space-y-3">
              {latest && <SlaCard s={latest} isLatest
                onEdit={() => latest.status === "draft" ? setEditSla(latest) : setVersionId(latest.id)}
                onSubmit={() => act(() => api.slas.submit(latest.id), "SLA submitted")}
                onOpsReview={() => act(() => api.slas.markOperationalReview(latest.id), "Moved to Ops Review")}
                onApprove={() => act(() => api.slas.approve(latest.id), "SLA approved")}
                onReject={() => setRejectId(latest.id)}
                onNewVersion={() => setVersionId(latest.id)} />}
              {rejectId && <ReasonBox color="red" label="Rejection Reason" value={rejectReason} onChange={setRejectReason} onCancel={() => { setRejectId(null); setRejectReason(""); }} onConfirm={handleReject} confirmLabel="Reject" />}
              {versionId && <ReasonBox color="blue" label="New Version — Change Reason" value={versionReason} onChange={setVersionReason} onCancel={() => { setVersionId(null); setVersionReason(""); }} onConfirm={handleVersion} confirmLabel="Create Version" />}
              {older.length > 0 && (
                <div>
                  <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">{expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}Version History ({older.length})</button>
                  {expanded && older.map(s => <SlaCard key={s.id} s={s} isLatest={false} />)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Readiness Checklist */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b"><CardTitle className="text-sm font-serif flex items-center gap-2"><ClipboardList className="w-4 h-4" />Contract Readiness <Badge variant="outline" className="text-[10px]">Informational</Badge></CardTitle></CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-2 gap-1.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1">
                {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" />}
                <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contract Status */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-serif flex items-center gap-2"><FileCheck className="w-4 h-4" />Contract Status</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setContractEdit(!contractEdit)} className="text-xs h-7">{contractEdit ? "Cancel" : "Update"}</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-3">
          {contractEdit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={cForm.contract_status} onValueChange={v => setCForm(f => ({ ...f, contract_status: v }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(contractCfg).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Reference</label><Input value={cForm.contract_reference} onChange={e => setCForm(f => ({ ...f, contract_reference: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Sent Date</label><Input type="date" value={cForm.contract_sent_at} onChange={e => setCForm(f => ({ ...f, contract_sent_at: e.target.value }))} className="h-8 text-xs" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Signed Date</label><Input type="date" value={cForm.contract_signed_at} onChange={e => setCForm(f => ({ ...f, contract_signed_at: e.target.value }))} className="h-8 text-xs" /></div>
              </div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Notes</label><Input value={cForm.notes} onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))} className="h-8 text-xs" /></div>
              <Button size="sm" onClick={handleContractSave} className="text-xs h-7 bg-[var(--color-hala-navy)]">Save Contract Status</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Status</span><p className="font-medium"><Badge variant="outline" className={`text-[10px] ${(contractCfg[contract?.contract_status || "not_ready"] || contractCfg.not_ready).color}`}>{(contractCfg[contract?.contract_status || "not_ready"] || contractCfg.not_ready).label}</Badge></p></div>
              <div><span className="text-muted-foreground">Reference</span><p className="font-medium">{contract?.contract_reference || "—"}</p></div>
              <div><span className="text-muted-foreground">Sent</span><p className="font-medium">{contract?.contract_sent_at || "—"}</p></div>
              <div><span className="text-muted-foreground">Signed</span><p className="font-medium">{contract?.contract_signed_at || "—"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SlaCard({ s, isLatest, onEdit, onSubmit, onOpsReview, onApprove, onReject, onNewVersion }: {
  s: any; isLatest: boolean; onEdit?: () => void; onSubmit?: () => void; onOpsReview?: () => void;
  onApprove?: () => void; onReject?: () => void; onNewVersion?: () => void;
}) {
  const cfg = slaCfg[s.status] || slaCfg.draft;
  const kpiCount = Array.isArray(s.kpi_rows) ? s.kpi_rows.length : 0;
  const penaltyCount = Array.isArray(s.kpi_rows) ? s.kpi_rows.filter((k: any) => k.penalty_applies).length : 0;

  return (
    <div className={`rounded-lg border p-3 ${isLatest ? "" : "bg-muted/10 border-muted"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold">{s.sla_number || `V${s.version_number}`}</span>
        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
        {s.linked_proposal_id && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 gap-0.5"><Link2 className="w-2.5 h-2.5" />Proposal</Badge>}
        {isLatest && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50">Latest</Badge>}
      </div>
      {s.title && <p className="text-xs font-medium mb-1">{s.title}</p>}
      <div className="grid grid-cols-3 gap-3 text-xs mb-2">
        <div><span className="text-muted-foreground">KPIs</span><p className="font-medium">{kpiCount}</p></div>
        <div><span className="text-muted-foreground">Penalties</span><p className="font-medium">{penaltyCount}</p></div>
        <div><span className="text-muted-foreground">Effective</span><p className="font-medium">{s.effective_date || "—"}</p></div>
      </div>
      {isLatest && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-dashed">
          {s.status === "draft" && onEdit && <Btn onClick={onEdit} icon={Edit} label="Edit" />}
          {s.status === "draft" && onSubmit && <Btn onClick={onSubmit} icon={Send} label="Submit" />}
          {["draft", "submitted"].includes(s.status) && onOpsReview && <Btn onClick={onOpsReview} icon={Eye} label="Ops Review" />}
          {["submitted", "operational_review"].includes(s.status) && onApprove && <Btn onClick={onApprove} icon={CheckCircle2} label="Approve" color="emerald" />}
          {["submitted", "operational_review"].includes(s.status) && onReject && <Btn onClick={onReject} icon={XCircle} label="Reject" color="red" />}
          {["approved", "rejected"].includes(s.status) && onNewVersion && <Btn onClick={onNewVersion} icon={Copy} label="New Version" color="blue" />}
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, icon: Icon, label, color }: { onClick: () => void; icon: any; label: string; color?: string }) {
  const c = color === "emerald" ? "border-emerald-300 text-emerald-700" : color === "red" ? "border-red-300 text-red-700" : color === "blue" ? "border-blue-300 text-blue-700" : "";
  return <Button variant="outline" size="sm" onClick={onClick} className={`text-[10px] h-6 ${c}`}><Icon className="w-3 h-3 mr-0.5" />{label}</Button>;
}

function ReasonBox({ color, label, value, onChange, onCancel, onConfirm, confirmLabel }: any) {
  const border = color === "red" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50";
  const textColor = color === "red" ? "text-red-800" : "text-blue-800";
  const btnColor = color === "red" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700";
  return (
    <div className={`rounded-lg border ${border} p-3 space-y-2`}>
      <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
      <Input value={value} onChange={(e: any) => onChange(e.target.value)} placeholder="Reason..." className="h-8 text-xs" />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-7">Cancel</Button>
        <Button size="sm" onClick={onConfirm} className={`text-xs h-7 ${btnColor}`}>{confirmLabel}</Button>
      </div>
    </div>
  );
}
