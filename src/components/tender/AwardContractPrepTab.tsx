/**
 * AwardContractPrepTab — Tab 2 of Awarded Stage
 *
 * Track contract document preparation and signing status.
 * From award to signed contract.
 *
 * Data: type_details.awarded_data.contract_prep
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Info, FileText, CheckCircle2 } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderAwardedData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const CONTRACT_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "drafting", label: "Drafting" },
  { value: "under_review", label: "Under Review" },
  { value: "redlined", label: "Redlined" },
  { value: "final_review", label: "Final Review" },
  { value: "signed", label: "Signed" },
] as const;

const CHECKLIST_ITEMS = [
  { key: "award_letter_received", label: "Award letter / LoI received" },
  { key: "contract_template_received", label: "Contract template received from client" },
  { key: "hala_legal_review", label: "Hala legal review completed" },
  { key: "commercial_terms_verified", label: "Commercial terms match negotiated agreement" },
  { key: "sla_appendix_attached", label: "SLA handoff brief reviewed / attached if available" },
  { key: "insurance_certificates", label: "Insurance certificates ready" },
  { key: "bank_guarantee", label: "Bank guarantee arranged (if required)" },
  { key: "authorized_signatory", label: "Authorized signatory identified" },
  { key: "contract_signed", label: "Contract signed by both parties" },
] as const;

export default function AwardContractPrepTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.awarded_data?.contract_prep ?? {};

  const [contractStatus, setContractStatus] = useState(saved.contract_status || "not_started");
  const [contractRef, setContractRef] = useState(saved.contract_reference || "");
  const [draftDate, setDraftDate] = useState(saved.draft_date || "");
  const [targetSignDate, setTargetSignDate] = useState(saved.target_sign_date || "");
  const [actualSignDate, setActualSignDate] = useState(saved.actual_sign_date || "");
  const [halaLegalOwner, setHalaLegalOwner] = useState(saved.hala_legal_owner || "");
  const [clientLegalContact, setClientLegalContact] = useState(saved.client_legal_contact || "");
  const [redlineNotes, setRedlineNotes] = useState(saved.redline_notes || "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(saved.checklist ?? {});
  const [notes, setNotes] = useState(saved.notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const toggleCheck = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    mark();
  };

  const completedCount = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length;
  const totalCount = CHECKLIST_ITEMS.length;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        contract_status: contractStatus, contract_reference: contractRef,
        draft_date: draftDate, target_sign_date: targetSignDate, actual_sign_date: actualSignDate,
        hala_legal_owner: halaLegalOwner, client_legal_contact: clientLegalContact,
        redline_notes: redlineNotes, checklist, notes,
      };
      const res = await updateTenderAwardedData(tenderId, "contract_prep", payload, `Status: ${contractStatus}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Contract prep saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [contractStatus, contractRef, draftDate, targetSignDate, actualSignDate, halaLegalOwner, clientLegalContact, redlineNotes, checklist, notes, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "signed") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "final_review") return "border-blue-300 text-blue-700 bg-blue-50";
    if (s === "redlined") return "border-amber-300 text-amber-700 bg-amber-50";
    if (s === "under_review" || s === "drafting") return "border-blue-200 text-blue-600 bg-blue-50";
    return "border-slate-200 text-slate-500 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Track the contract from drafting to signing. Use the checklist to ensure nothing is missed before contract execution.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Contract</span>
        <Badge variant="outline" className={`text-[8px] ${statusColor(contractStatus)}`}>
          {CONTRACT_STATUSES.find(s => s.value === contractStatus)?.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{completedCount}/{totalCount} checklist</span>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Contract Details */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Contract Details</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Contract Status</label>
              <Select value={contractStatus} onValueChange={v => { setContractStatus(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Contract Reference</label>
              <Input className="h-8 text-xs mt-1" value={contractRef} onChange={e => { setContractRef(e.target.value); mark(); }} placeholder="Contract number" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Draft Received Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={draftDate} onChange={e => { setDraftDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Target Sign Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={targetSignDate} onChange={e => { setTargetSignDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Actual Sign Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={actualSignDate} onChange={e => { setActualSignDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Hala Legal Owner</label>
              <Input className="h-8 text-xs mt-1" value={halaLegalOwner} onChange={e => { setHalaLegalOwner(e.target.value); mark(); }} placeholder="Name" /></div>
            <div className="col-span-2"><label className="text-[10px] font-semibold text-muted-foreground">Client Legal Contact</label>
              <Input className="h-8 text-xs mt-1" value={clientLegalContact} onChange={e => { setClientLegalContact(e.target.value); mark(); }} placeholder="Name" /></div>
          </div>
          <div className="mt-4"><label className="text-[10px] font-semibold text-muted-foreground">Redline / Amendment Notes</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={redlineNotes} onChange={e => { setRedlineNotes(e.target.value); mark(); }} placeholder="Key redline items, amendments discussed..." /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
            <Textarea className="text-xs mt-1 min-h-[40px]" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="General contract notes..." /></div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Contract Readiness Checklist</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{completedCount}/{totalCount}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {CHECKLIST_ITEMS.map(item => (
              <div key={item.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toggleCheck(item.key)}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checklist[item.key] ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                  {checklist[item.key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-xs ${checklist[item.key] ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
