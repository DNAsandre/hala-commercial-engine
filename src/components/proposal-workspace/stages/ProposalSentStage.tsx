import { FileCheck, FolderOpen, History, Plus, Radio, Send, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldInput, FieldRow, FieldSelect, FieldTextarea, Section } from "../ui-primitives";
import type {
  ProposalCrmSyncRecord,
  ProposalDeliveryRecord,
  ProposalRecipientContact,
  ProposalSentAttachment,
  ProposalSentAuditNote,
  ProposalSentVersion,
} from "../proposal-workspace-state";
import { DocumentReferenceSelect, type SupportingDocument } from "../SupportingDocumentsPanel";

const SENT_STATUS_OPTIONS = [
  { value: "prepared", label: "Prepared" },
  { value: "sent", label: "Sent" },
  { value: "resent", label: "Resent" },
  { value: "superseded", label: "Superseded" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "crm", label: "CRM" },
  { value: "portal", label: "Customer Portal" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

const DELIVERY_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "failed", label: "Failed" },
];

const ATTACHMENT_CATEGORY_OPTIONS = [
  { value: "technical", label: "Technical Proposal" },
  { value: "commercial", label: "Commercial Proposal" },
  { value: "quote", label: "Quote" },
  { value: "appendix", label: "Appendix" },
  { value: "other", label: "Other" },
];

const CRM_SYNC_STATUS_OPTIONS = [
  { value: "not_recorded", label: "Not Recorded" },
  { value: "recorded", label: "Recorded" },
  { value: "needs_update", label: "Needs Update" },
  { value: "not_applicable", label: "Not Applicable" },
];

export function SentVersionTab({
  data,
  onChange,
  documents = [],
}: {
  data: ProposalSentVersion;
  onChange: (d: ProposalSentVersion) => void;
  documents?: SupportingDocument[];
}) {
  const update = (field: keyof ProposalSentVersion, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section
        title="Sent Version"
        defaultOpen
        icon={<Send className="h-4 w-4 text-[#075eea]" />}
        badge={<Badge variant="outline" className="text-[9px]">Record only</Badge>}
      >
        <FieldRow label="Version Label">
          <FieldInput value={data.sentVersionLabel} onChange={v => update("sentVersionLabel", v)} placeholder="Example: Proposal v1.0" />
        </FieldRow>
        <FieldRow label="Source Draft">
          <FieldInput value={data.sourceDraftReference} onChange={v => update("sourceDraftReference", v)} placeholder="Draft, block set, or internal version reference" />
        </FieldRow>
        <FieldRow label="Proposal Title">
          <FieldInput value={data.proposalTitle} onChange={v => update("proposalTitle", v)} placeholder="Customer-facing proposal title" />
        </FieldRow>
        <FieldRow label="Sent Status">
          <FieldSelect value={data.sentStatus} onChange={v => update("sentStatus", v)} options={SENT_STATUS_OPTIONS} placeholder="Select status" />
        </FieldRow>
        <FieldRow label="Document Ref">
          <DocumentReferenceSelect value={data.sentDocumentRef} onChange={v => update("sentDocumentRef", v)} documents={documents} />
        </FieldRow>
        <FieldRow label="Notes">
          <FieldTextarea value={data.notes} onChange={v => update("notes", v)} placeholder="What exactly was included in this sent version?" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function DeliveryRecordTab({
  data,
  onChange,
}: {
  data: ProposalDeliveryRecord;
  onChange: (d: ProposalDeliveryRecord) => void;
}) {
  const update = (field: keyof ProposalDeliveryRecord, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Delivery Record" defaultOpen icon={<FileCheck className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Sent Date">
            <FieldInput type="date" value={data.sentDate} onChange={v => update("sentDate", v)} />
          </FieldRow>
          <FieldRow label="Sent Time">
            <FieldInput type="time" value={data.sentTime} onChange={v => update("sentTime", v)} />
          </FieldRow>
        </div>
        <FieldRow label="Channel">
          <FieldSelect value={data.channel} onChange={v => update("channel", v)} options={CHANNEL_OPTIONS} placeholder="Select channel" />
        </FieldRow>
        <FieldRow label="Sent By">
          <FieldInput value={data.sentBy} onChange={v => update("sentBy", v)} placeholder="Hala owner who sent or recorded the send" />
        </FieldRow>
        <FieldRow label="Delivery Status">
          <FieldSelect value={data.deliveryStatus} onChange={v => update("deliveryStatus", v)} options={DELIVERY_STATUS_OPTIONS} placeholder="Select delivery status" />
        </FieldRow>
        <FieldRow label="Delivery Notes">
          <FieldTextarea value={data.deliveryNotes} onChange={v => update("deliveryNotes", v)} placeholder="Delivery notes, acknowledgement, bounce, or follow-up context" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function RecipientContactLogTab({
  data,
  onChange,
}: {
  data: ProposalRecipientContact[];
  onChange: (d: ProposalRecipientContact[]) => void;
}) {
  const add = () => onChange([
    ...data,
    { id: `recipient-${Date.now()}`, contactName: "", role: "", company: "", email: "", phone: "", included: false, notes: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalRecipientContact>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Recipient / Contact Log</span>
          <Badge variant="outline" className="text-[9px]">{data.length} contacts</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Contact</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No proposal recipients captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((contact, index) => (
            <div key={contact.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_140px_1fr_1fr_120px_32px]">
                <FieldInput value={contact.contactName} onChange={v => update(index, { contactName: v })} placeholder="Contact name" />
                <FieldInput value={contact.role} onChange={v => update(index, { role: v })} placeholder="Role" />
                <FieldInput value={contact.company} onChange={v => update(index, { company: v })} placeholder="Company" />
                <FieldInput value={contact.email} onChange={v => update(index, { email: v })} placeholder="Email" />
                <label className="flex h-9 items-center gap-2 rounded-md border border-border px-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={contact.included} onChange={e => update(index, { included: e.target.checked })} />
                  Included
                </label>
                <button type="button" aria-label="Remove recipient" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-[220px_1fr]">
                <FieldInput value={contact.phone} onChange={v => update(index, { phone: v })} placeholder="Phone" />
                <FieldTextarea value={contact.notes} onChange={v => update(index, { notes: v })} placeholder="Recipient notes" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentsRegisterTab({
  data,
  onChange,
  documents = [],
}: {
  data: ProposalSentAttachment[];
  onChange: (d: ProposalSentAttachment[]) => void;
  documents?: SupportingDocument[];
}) {
  const add = () => onChange([
    ...data,
    { id: `sent-attachment-${Date.now()}`, documentName: "", category: "", versionLabel: "", documentRef: "", included: false, notes: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalSentAttachment>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Attachments Register</span>
          <Badge variant="outline" className="text-[9px]">{data.length} attachments</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Attachment</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No sent attachments captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((attachment, index) => (
            <div key={attachment.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_170px_140px_1fr_120px_32px]">
                <FieldInput value={attachment.documentName} onChange={v => update(index, { documentName: v })} placeholder="Document name" />
                <FieldSelect value={attachment.category} onChange={v => update(index, { category: v })} options={ATTACHMENT_CATEGORY_OPTIONS} placeholder="Category" />
                <FieldInput value={attachment.versionLabel} onChange={v => update(index, { versionLabel: v })} placeholder="Version" />
                <DocumentReferenceSelect value={attachment.documentRef} onChange={v => update(index, { documentRef: v })} documents={documents} />
                <label className="flex h-9 items-center gap-2 rounded-md border border-border px-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={attachment.included} onChange={e => update(index, { included: e.target.checked })} />
                  Included
                </label>
                <button type="button" aria-label="Remove attachment" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <FieldTextarea value={attachment.notes} onChange={v => update(index, { notes: v })} placeholder="Attachment notes" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProposalCrmSyncTab({
  data,
  onChange,
}: {
  data: ProposalCrmSyncRecord;
  onChange: (d: ProposalCrmSyncRecord) => void;
}) {
  const update = (field: keyof ProposalCrmSyncRecord, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section
        title="CRM Sync Record"
        defaultOpen
        icon={<Radio className="h-4 w-4 text-[#075eea]" />}
        badge={<Badge variant="outline" className="text-[9px]">Manual record</Badge>}
      >
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          This is a human record of CRM status only. It does not push to CRM or automate stage movement.
        </div>
        <FieldRow label="CRM Ref">
          <FieldInput value={data.crmOpportunityRef} onChange={v => update("crmOpportunityRef", v)} placeholder="CRM opportunity or proposal reference" />
        </FieldRow>
        <FieldRow label="CRM Stage">
          <FieldInput value={data.crmStage} onChange={v => update("crmStage", v)} placeholder="CRM stage as observed" />
        </FieldRow>
        <FieldRow label="Sync Status">
          <FieldSelect value={data.syncStatus} onChange={v => update("syncStatus", v)} options={CRM_SYNC_STATUS_OPTIONS} placeholder="Select status" />
        </FieldRow>
        <FieldRow label="Recorded By">
          <FieldInput value={data.recordedBy} onChange={v => update("recordedBy", v)} placeholder="Person who recorded this status" />
        </FieldRow>
        <FieldRow label="Recorded At">
          <FieldInput type="datetime-local" value={data.recordedAt} onChange={v => update("recordedAt", v)} />
        </FieldRow>
        <FieldRow label="Notes">
          <FieldTextarea value={data.notes} onChange={v => update("notes", v)} placeholder="CRM sync notes or manual follow-up" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function ProposalSentAuditTrailTab({
  data,
  onChange,
}: {
  data: ProposalSentAuditNote[];
  onChange: (d: ProposalSentAuditNote[]) => void;
}) {
  const add = () => onChange([
    ...data,
    { id: `sent-audit-${Date.now()}`, eventDate: "", actor: "", action: "", notes: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalSentAuditNote>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Delivery Notes Register</span>
          <Badge variant="outline" className="text-[9px]">{data.length} notes</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Note</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No sent-stage audit notes captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((note, index) => (
            <div key={note.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[160px_180px_1fr_32px]">
                <FieldInput type="date" value={note.eventDate} onChange={v => update(index, { eventDate: v })} />
                <FieldInput value={note.actor} onChange={v => update(index, { actor: v })} placeholder="Actor" />
                <FieldInput value={note.action} onChange={v => update(index, { action: v })} placeholder="Action" />
                <button type="button" aria-label="Remove audit note" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <FieldTextarea value={note.notes} onChange={v => update(index, { notes: v })} placeholder="Audit note" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
