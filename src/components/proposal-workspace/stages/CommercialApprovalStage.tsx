import { AlertTriangle, CheckCircle2, FileCheck, Landmark, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FieldInput, FieldRow, FieldSelect, FieldTextarea, Section } from "../ui-primitives";
import type {
  ProposalApprovalRecord,
  ProposalApprovalSummary,
  ProposalFinalCommercialPosition,
  ProposalMarginTermsReview,
  ProposalRiskExceptionNotes,
} from "../proposal-workspace-state";

const REVIEW_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "in_review", label: "In Review" },
  { value: "position_ready", label: "Position Ready" },
  { value: "needs_rework", label: "Needs Rework" },
  { value: "recorded", label: "Recorded" },
];

const DECISION_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "supported", label: "Supported" },
  { value: "supported_with_conditions", label: "Supported With Conditions" },
  { value: "not_supported", label: "Not Supported" },
  { value: "rework_required", label: "Rework Required" },
];

export function ApprovalSummaryTab({
  data,
  onChange,
}: {
  data: ProposalApprovalSummary;
  onChange: (d: ProposalApprovalSummary) => void;
}) {
  const update = (field: keyof ProposalApprovalSummary, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section
        title="Approval Summary"
        defaultOpen
        icon={<FileCheck className="h-4 w-4 text-[#075eea]" />}
        badge={<Badge variant="outline" className="text-[9px]">Source truth</Badge>}
      >
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Review Owner">
            <FieldInput value={data.reviewOwner} onChange={v => update("reviewOwner", v)} placeholder="Hala commercial owner" />
          </FieldRow>
          <FieldRow label="Review Date">
            <FieldInput type="date" value={data.reviewDate} onChange={v => update("reviewDate", v)} />
          </FieldRow>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Review Status">
            <FieldSelect value={data.reviewStatus} onChange={v => update("reviewStatus", v)} options={REVIEW_STATUS_OPTIONS} placeholder="Select status" />
          </FieldRow>
          <FieldRow label="Proposal Version">
            <FieldInput value={data.proposalVersion} onChange={v => update("proposalVersion", v)} placeholder="Proposal version being reviewed" />
          </FieldRow>
        </div>
        <FieldRow label="Review Scope">
          <FieldTextarea value={data.reviewScope} onChange={v => update("reviewScope", v)} placeholder="What commercial items are being reviewed?" rows={4} />
        </FieldRow>
        <FieldRow label="Summary Notes">
          <FieldTextarea value={data.summaryNotes} onChange={v => update("summaryNotes", v)} placeholder="Commercial approval summary notes" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function MarginTermsReviewTab({
  data,
  onChange,
}: {
  data: ProposalMarginTermsReview;
  onChange: (d: ProposalMarginTermsReview) => void;
}) {
  const update = (field: keyof ProposalMarginTermsReview, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Margin / Terms Review" defaultOpen icon={<Scale className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Linked P&L Version">
          <FieldInput value={data.linkedPnlVersion} onChange={v => update("linkedPnlVersion", v)} placeholder="Final P&L or pricing scenario reference" />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-4">
          <FieldRow label="Final Revenue">
            <FieldInput value={data.finalRevenue} onChange={v => update("finalRevenue", v)} placeholder="Revenue position" />
          </FieldRow>
          <FieldRow label="Final Cost">
            <FieldInput value={data.finalCost} onChange={v => update("finalCost", v)} placeholder="Cost position" />
          </FieldRow>
          <FieldRow label="Final GP">
            <FieldInput value={data.finalGrossProfit} onChange={v => update("finalGrossProfit", v)} placeholder="Gross profit" />
          </FieldRow>
          <FieldRow label="Final GP %">
            <FieldInput value={data.finalGpPercent} onChange={v => update("finalGpPercent", v)} placeholder="Margin percentage" />
          </FieldRow>
        </div>
        <FieldRow label="Margin Position">
          <FieldTextarea value={data.marginPosition} onChange={v => update("marginPosition", v)} placeholder="Final margin position and rationale" rows={4} />
        </FieldRow>
        <FieldRow label="Payment Terms">
          <FieldTextarea value={data.paymentTermsPosition} onChange={v => update("paymentTermsPosition", v)} placeholder="Final payment terms position" rows={4} />
        </FieldRow>
        <FieldRow label="Commercial Terms">
          <FieldTextarea value={data.commercialTermsPosition} onChange={v => update("commercialTermsPosition", v)} placeholder="Final commercial terms position" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function RiskExceptionNotesTab({
  data,
  onChange,
}: {
  data: ProposalRiskExceptionNotes;
  onChange: (d: ProposalRiskExceptionNotes) => void;
}) {
  const update = (field: keyof ProposalRiskExceptionNotes, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Risk / Exception Notes" defaultOpen icon={<AlertTriangle className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Risk Summary">
          <FieldTextarea value={data.riskSummary} onChange={v => update("riskSummary", v)} placeholder="Commercial, operational, legal, or delivery risks" rows={4} />
        </FieldRow>
        <FieldRow label="Exceptions">
          <FieldTextarea value={data.exceptionSummary} onChange={v => update("exceptionSummary", v)} placeholder="Exceptions, deviations, or special terms to remember" rows={4} />
        </FieldRow>
        <FieldRow label="Mitigation Notes">
          <FieldTextarea value={data.mitigationNotes} onChange={v => update("mitigationNotes", v)} placeholder="Mitigations or handling notes" rows={4} />
        </FieldRow>
        <FieldRow label="Unresolved Items">
          <FieldTextarea value={data.unresolvedItems} onChange={v => update("unresolvedItems", v)} placeholder="Items still unresolved for the commercial position" rows={4} />
        </FieldRow>
        <FieldRow label="Customer Dependencies">
          <FieldTextarea value={data.customerDependencies} onChange={v => update("customerDependencies", v)} placeholder="Customer inputs, approvals, data, or commitments still needed" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function FinalCommercialPositionTab({
  data,
  onChange,
}: {
  data: ProposalFinalCommercialPosition;
  onChange: (d: ProposalFinalCommercialPosition) => void;
}) {
  const update = (field: keyof ProposalFinalCommercialPosition, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Final Commercial Position" defaultOpen icon={<Landmark className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Final Scope">
          <FieldTextarea value={data.finalScopePosition} onChange={v => update("finalScopePosition", v)} placeholder="Final scope position for this proposal" rows={4} />
        </FieldRow>
        <FieldRow label="Final Pricing">
          <FieldTextarea value={data.finalPricingPosition} onChange={v => update("finalPricingPosition", v)} placeholder="Final pricing position and commercial logic" rows={4} />
        </FieldRow>
        <FieldRow label="Final Terms">
          <FieldTextarea value={data.finalTermsPosition} onChange={v => update("finalTermsPosition", v)} placeholder="Final terms position" rows={4} />
        </FieldRow>
        <FieldRow label="Negotiation Carry-Forward">
          <FieldTextarea value={data.negotiationCarryForward} onChange={v => update("negotiationCarryForward", v)} placeholder="What from negotiation must carry forward?" rows={4} />
        </FieldRow>
        <FieldRow label="Value Justification">
          <FieldTextarea value={data.valueJustification} onChange={v => update("valueJustification", v)} placeholder="Why this final position makes sense for Hala and the customer" rows={4} />
        </FieldRow>
        <FieldRow label="Handover Notes">
          <FieldTextarea value={data.handoverNotes} onChange={v => update("handoverNotes", v)} placeholder="Notes for contract, operations, or next-stage handover" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function ApprovalRecordTab({
  data,
  onChange,
}: {
  data: ProposalApprovalRecord;
  onChange: (d: ProposalApprovalRecord) => void;
}) {
  const update = (field: keyof ProposalApprovalRecord, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section
        title="Approval Record"
        defaultOpen
        icon={<CheckCircle2 className="h-4 w-4 text-[#075eea]" />}
        badge={<Badge variant="outline" className="text-[9px]">Record only</Badge>}
      >
        <div className="grid gap-2 lg:grid-cols-3">
          <FieldRow label="Decision">
            <FieldSelect value={data.recordedDecision} onChange={v => update("recordedDecision", v)} options={DECISION_OPTIONS} placeholder="Select decision" />
          </FieldRow>
          <FieldRow label="Recorded By">
            <FieldInput value={data.recordedBy} onChange={v => update("recordedBy", v)} placeholder="Name or role" />
          </FieldRow>
          <FieldRow label="Recorded Date">
            <FieldInput type="date" value={data.recordedDate} onChange={v => update("recordedDate", v)} />
          </FieldRow>
        </div>
        <FieldRow label="Reference">
          <FieldInput value={data.reference} onChange={v => update("reference", v)} placeholder="Approval reference, email, meeting, or note" />
        </FieldRow>
        <FieldRow label="Conditions">
          <FieldTextarea value={data.conditions} onChange={v => update("conditions", v)} placeholder="Conditions or caveats attached to the recorded decision" rows={4} />
        </FieldRow>
        <FieldRow label="Next Action">
          <FieldTextarea value={data.nextAction} onChange={v => update("nextAction", v)} placeholder="Next action after this recorded commercial position" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}
