import { ClipboardList, DollarSign, FileText, History, MessageSquare, Plus, Scale, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldInput, FieldRow, FieldSelect, FieldTextarea, Section } from "../ui-primitives";
import type {
  ProposalCustomerFeedback,
  ProposalNegotiationMarginImpact,
  ProposalNegotiationNote,
  ProposalPricingChange,
  ProposalRequestedScopeChange,
  ProposalRevisedVersion,
} from "../proposal-workspace-state";

const FEEDBACK_TYPE_OPTIONS = [
  { value: "clarification", label: "Clarification" },
  { value: "objection", label: "Objection" },
  { value: "scope", label: "Scope" },
  { value: "pricing", label: "Pricing" },
  { value: "acceptance", label: "Acceptance" },
  { value: "other", label: "Other" },
];

const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "concern", label: "Concern" },
  { value: "negative", label: "Negative" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "revised", label: "Revised" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

const VERSION_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "shared", label: "Shared" },
  { value: "sent", label: "Sent" },
  { value: "superseded", label: "Superseded" },
];

export function CustomerFeedbackTab({
  data,
  onChange,
}: {
  data: ProposalCustomerFeedback[];
  onChange: (d: ProposalCustomerFeedback[]) => void;
}) {
  const add = () => onChange([
    ...data,
    {
      id: `customer-feedback-${Date.now()}`,
      feedbackDate: "",
      contactName: "",
      feedbackType: "",
      feedbackSummary: "",
      sentiment: "",
      owner: "",
      nextAction: "",
    },
  ]);
  const update = (index: number, patch: Partial<ProposalCustomerFeedback>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Customer Feedback</span>
          <Badge variant="outline" className="text-[9px]">{data.length} items</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Feedback</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No negotiation feedback captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[150px_1fr_170px_150px_1fr_32px]">
                <FieldInput type="date" value={item.feedbackDate} onChange={v => update(index, { feedbackDate: v })} />
                <FieldInput value={item.contactName} onChange={v => update(index, { contactName: v })} placeholder="Customer contact" />
                <FieldSelect value={item.feedbackType} onChange={v => update(index, { feedbackType: v })} options={FEEDBACK_TYPE_OPTIONS} placeholder="Type" />
                <FieldSelect value={item.sentiment} onChange={v => update(index, { sentiment: v })} options={SENTIMENT_OPTIONS} placeholder="Sentiment" />
                <FieldInput value={item.owner} onChange={v => update(index, { owner: v })} placeholder="Hala owner" />
                <button type="button" aria-label="Remove customer feedback" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <FieldTextarea value={item.feedbackSummary} onChange={v => update(index, { feedbackSummary: v })} placeholder="Feedback summary" rows={3} />
                <FieldTextarea value={item.nextAction} onChange={v => update(index, { nextAction: v })} placeholder="Next action" rows={3} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RequestedScopeChangesTab({
  data,
  onChange,
}: {
  data: ProposalRequestedScopeChange[];
  onChange: (d: ProposalRequestedScopeChange[]) => void;
}) {
  const add = () => onChange([
    ...data,
    { id: `scope-change-${Date.now()}`, changeArea: "", requestedChange: "", operationalImpact: "", status: "", owner: "", notes: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalRequestedScopeChange>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Requested Scope Changes</span>
          <Badge variant="outline" className="text-[9px]">{data.length} changes</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Change</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No scope changes captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_170px_1fr_32px]">
                <FieldInput value={item.changeArea} onChange={v => update(index, { changeArea: v })} placeholder="Scope area" />
                <FieldSelect value={item.status} onChange={v => update(index, { status: v })} options={STATUS_OPTIONS} placeholder="Status" />
                <FieldInput value={item.owner} onChange={v => update(index, { owner: v })} placeholder="Owner" />
                <button type="button" aria-label="Remove scope change" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                <FieldTextarea value={item.requestedChange} onChange={v => update(index, { requestedChange: v })} placeholder="Requested change" rows={3} />
                <FieldTextarea value={item.operationalImpact} onChange={v => update(index, { operationalImpact: v })} placeholder="Operational impact" rows={3} />
                <FieldTextarea value={item.notes} onChange={v => update(index, { notes: v })} placeholder="Notes" rows={3} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PricingChangesTab({
  data,
  onChange,
}: {
  data: ProposalPricingChange[];
  onChange: (d: ProposalPricingChange[]) => void;
}) {
  const add = () => onChange([
    ...data,
    { id: `pricing-change-${Date.now()}`, serviceLine: "", requestedChange: "", revisedPrice: "", commercialImpact: "", status: "", notes: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalPricingChange>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Pricing Changes</span>
          <Badge variant="outline" className="text-[9px]">{data.length} changes</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Pricing Change</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No pricing changes captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_170px_1fr_32px]">
                <FieldInput value={item.serviceLine} onChange={v => update(index, { serviceLine: v })} placeholder="Service line" />
                <FieldSelect value={item.status} onChange={v => update(index, { status: v })} options={STATUS_OPTIONS} placeholder="Status" />
                <FieldInput value={item.revisedPrice} onChange={v => update(index, { revisedPrice: v })} placeholder="Revised price or rate" />
                <button type="button" aria-label="Remove pricing change" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                <FieldTextarea value={item.requestedChange} onChange={v => update(index, { requestedChange: v })} placeholder="Requested pricing change" rows={3} />
                <FieldTextarea value={item.commercialImpact} onChange={v => update(index, { commercialImpact: v })} placeholder="Commercial impact" rows={3} />
                <FieldTextarea value={item.notes} onChange={v => update(index, { notes: v })} placeholder="Notes" rows={3} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NegotiationMarginImpactTab({
  data,
  onChange,
}: {
  data: ProposalNegotiationMarginImpact;
  onChange: (d: ProposalNegotiationMarginImpact) => void;
}) {
  const update = (field: keyof ProposalNegotiationMarginImpact, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Negotiation Margin Impact" defaultOpen icon={<Scale className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Linked P&L Version">
          <FieldInput value={data.linkedPnlVersion} onChange={v => update("linkedPnlVersion", v)} placeholder="P&L version or scenario reference" />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-3">
          <FieldRow label="Revenue Impact">
            <FieldInput value={data.revenueImpact} onChange={v => update("revenueImpact", v)} placeholder="Example: -SAR 120k" />
          </FieldRow>
          <FieldRow label="Cost Impact">
            <FieldInput value={data.costImpact} onChange={v => update("costImpact", v)} placeholder="Operational cost impact" />
          </FieldRow>
          <FieldRow label="GP Impact">
            <FieldInput value={data.grossProfitImpact} onChange={v => update("grossProfitImpact", v)} placeholder="Gross profit impact" />
          </FieldRow>
        </div>
        <FieldRow label="Margin Notes">
          <FieldTextarea value={data.marginNotes} onChange={v => update("marginNotes", v)} placeholder="Margin impact notes from negotiation changes" rows={4} />
        </FieldRow>
        <FieldRow label="Internal Notes">
          <FieldTextarea value={data.approvalNotes} onChange={v => update("approvalNotes", v)} placeholder="Internal commercial notes for this negotiation change" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function RevisedVersionsTab({
  data,
  onChange,
}: {
  data: ProposalRevisedVersion[];
  onChange: (d: ProposalRevisedVersion[]) => void;
}) {
  const add = () => onChange([
    ...data,
    { id: `revised-version-${Date.now()}`, versionLabel: "", sourceVersion: "", changeSummary: "", documentRef: "", status: "", notes: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalRevisedVersion>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Revised Versions</span>
          <Badge variant="outline" className="text-[9px]">{data.length} versions</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Version</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No revised proposal versions captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[150px_150px_170px_1fr_32px]">
                <FieldInput value={item.versionLabel} onChange={v => update(index, { versionLabel: v })} placeholder="Version label" />
                <FieldInput value={item.sourceVersion} onChange={v => update(index, { sourceVersion: v })} placeholder="Source version" />
                <FieldSelect value={item.status} onChange={v => update(index, { status: v })} options={VERSION_STATUS_OPTIONS} placeholder="Status" />
                <FieldInput value={item.documentRef} onChange={v => update(index, { documentRef: v })} placeholder="Document reference" />
                <button type="button" aria-label="Remove revised version" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <FieldTextarea value={item.changeSummary} onChange={v => update(index, { changeSummary: v })} placeholder="Change summary" rows={3} />
                <FieldTextarea value={item.notes} onChange={v => update(index, { notes: v })} placeholder="Version notes" rows={3} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NegotiationNotesTab({
  data,
  onChange,
}: {
  data: ProposalNegotiationNote[];
  onChange: (d: ProposalNegotiationNote[]) => void;
}) {
  const add = () => onChange([
    ...data,
    { id: `negotiation-note-${Date.now()}`, noteDate: "", actor: "", discussionSummary: "", decision: "", nextAction: "" },
  ]);
  const update = (index: number, patch: Partial<ProposalNegotiationNote>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Negotiation Notes</span>
          <Badge variant="outline" className="text-[9px]">{data.length} notes</Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Note</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No negotiation notes captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[160px_1fr_32px]">
                <FieldInput type="date" value={item.noteDate} onChange={v => update(index, { noteDate: v })} />
                <FieldInput value={item.actor} onChange={v => update(index, { actor: v })} placeholder="Actor or meeting participants" />
                <button type="button" aria-label="Remove negotiation note" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-3">
                <FieldTextarea value={item.discussionSummary} onChange={v => update(index, { discussionSummary: v })} placeholder="Discussion summary" rows={3} />
                <FieldTextarea value={item.decision} onChange={v => update(index, { decision: v })} placeholder="Decision or position" rows={3} />
                <FieldTextarea value={item.nextAction} onChange={v => update(index, { nextAction: v })} placeholder="Next action" rows={3} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
