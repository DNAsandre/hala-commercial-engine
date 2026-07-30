/**
 * SubmissionLogTab — Tab 1 of Submitted Stage
 *
 * Records the official tender submission event:
 * when, how, to whom, and receipt confirmation.
 *
 * All data persisted to type_details.submission.submission_record.
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Loader2, Send, CheckCircle2, Info, Mail, Building2, Hash, FileText, Clock, User } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSubmissionData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const SUBMISSION_METHODS = [
  { value: "email", label: "Email" },
  { value: "portal", label: "Portal Upload" },
  { value: "hand_delivery", label: "Hand Delivery" },
  { value: "courier", label: "Courier" },
  { value: "other", label: "Other" },
] as const;

export default function SubmissionLogTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.submission?.submission_record ?? {};

  const [submittedAt, setSubmittedAt] = useState(saved.submitted_at || "");
  const [submittedBy, setSubmittedBy] = useState(saved.submitted_by || "");
  const [method, setMethod] = useState(saved.submission_method || "email");
  const [methodDetail, setMethodDetail] = useState(saved.submission_method_detail || "");
  const [recipientName, setRecipientName] = useState(saved.recipient_name || "");
  const [recipientEmail, setRecipientEmail] = useState(saved.recipient_email || "");
  const [recipientOrg, setRecipientOrg] = useState(saved.recipient_org || "");
  const [refNumber, setRefNumber] = useState(saved.reference_number || "");
  const [attachmentsCount, setAttachmentsCount] = useState<number>(saved.attachments_count ?? 0);
  const [notes, setNotes] = useState(saved.submission_notes || "");
  const [receiptConfirmed, setReceiptConfirmed] = useState<boolean>(saved.receipt_confirmed ?? false);
  const [receiptConfirmedAt, setReceiptConfirmedAt] = useState(saved.receipt_confirmed_at || "");
  const [receiptNotes, setReceiptNotes] = useState(saved.receipt_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);
  const hasSavedData = !!(saved.submitted_at || saved.submitted_by);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        submitted_at: submittedAt,
        submitted_by: submittedBy,
        submission_method: method,
        submission_method_detail: methodDetail,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        recipient_org: recipientOrg,
        reference_number: refNumber,
        attachments_count: attachmentsCount,
        submission_notes: notes,
        receipt_confirmed: receiptConfirmed,
        receipt_confirmed_at: receiptConfirmedAt,
        receipt_notes: receiptNotes,
      };
      const res = await updateTenderSubmissionData(tenderId, "submission_record", payload, "Submission log recorded");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Submission log saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [submittedAt, submittedBy, method, methodDetail, recipientName, recipientEmail, recipientOrg, refNumber, attachmentsCount, notes, receiptConfirmed, receiptConfirmedAt, receiptNotes, tenderId, reload]);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Record the official tender submission details. This creates an immutable log entry for audit purposes.</span>
      </div>

      {/* Status Strip */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${hasSavedData ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`text-[10px] ${hasSavedData ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            {hasSavedData ? "Submission Recorded" : "Not Yet Recorded"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-3">
          <div className={`w-2 h-2 rounded-full ${receiptConfirmed ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`text-[10px] ${receiptConfirmed ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            {receiptConfirmed ? "Receipt Confirmed" : "Receipt Pending"}
          </span>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Submission Record */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Submission Record</span>
            {hasSavedData && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50">Saved</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Submitted At</label>
              <Input type="datetime-local" className="h-8 text-xs mt-1" value={submittedAt} onChange={e => { setSubmittedAt(e.target.value); mark(); }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Submitted By</label>
              <Input className="h-8 text-xs mt-1" value={submittedBy} onChange={e => { setSubmittedBy(e.target.value); mark(); }} placeholder="Person who submitted" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Send className="w-3 h-3" /> Submission Method</label>
              <Select value={method} onValueChange={v => { setMethod(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBMISSION_METHODS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Method Detail</label>
              <Input className="h-8 text-xs mt-1" value={methodDetail} onChange={e => { setMethodDetail(e.target.value); mark(); }} placeholder="e.g. portal URL, courier name" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Reference Number</label>
              <Input className="h-8 text-xs mt-1" value={refNumber} onChange={e => { setRefNumber(e.target.value); mark(); }} placeholder="Client-issued reference" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Attachments Count</label>
              <Input type="number" min={0} className="h-8 text-xs mt-1" value={attachmentsCount} onChange={e => { setAttachmentsCount(parseInt(e.target.value) || 0); mark(); }} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recipient</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Name</label>
                <Input className="h-8 text-xs mt-1" value={recipientName} onChange={e => { setRecipientName(e.target.value); mark(); }} placeholder="Recipient name" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                <Input type="email" className="h-8 text-xs mt-1" value={recipientEmail} onChange={e => { setRecipientEmail(e.target.value); mark(); }} placeholder="Recipient email" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Organisation</label>
                <Input className="h-8 text-xs mt-1" value={recipientOrg} onChange={e => { setRecipientOrg(e.target.value); mark(); }} placeholder="Client organisation" />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-[10px] font-semibold text-muted-foreground">Submission Notes</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="Any additional notes about the submission..." />
          </div>
        </CardContent>
      </Card>

      {/* Receipt Confirmation */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Receipt Confirmation</span>
            {receiptConfirmed && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50">Confirmed</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Switch checked={receiptConfirmed} onCheckedChange={v => { setReceiptConfirmed(v); mark(); }} />
            <span className="text-xs font-medium">Client has confirmed receipt of the tender submission</span>
          </div>
          {receiptConfirmed && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Confirmed At</label>
                <Input type="datetime-local" className="h-8 text-xs mt-1" value={receiptConfirmedAt} onChange={e => { setReceiptConfirmedAt(e.target.value); mark(); }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Receipt Notes</label>
                <Input className="h-8 text-xs mt-1" value={receiptNotes} onChange={e => { setReceiptNotes(e.target.value); mark(); }} placeholder="Confirmation reference or notes" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
