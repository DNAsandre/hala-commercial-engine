import { ClipboardList, DollarSign, FileCheck, FileSignature, Handshake } from "lucide-react";
import { FieldInput, FieldRow, FieldTextarea, Section } from "../ui-primitives";
import type {
  ProposalContractHandoverPrep,
  ProposalFinalContractPricing,
  ProposalFinalContractScope,
  ProposalFinalContractTerms,
  ProposalSignedContractReference,
} from "../proposal-workspace-state";
import { DocumentReferenceSelect, type SupportingDocument } from "../SupportingDocumentsPanel";

export function SignedContractReferenceTab({
  data,
  onChange,
  documents = [],
}: {
  data: ProposalSignedContractReference;
  onChange: (d: ProposalSignedContractReference) => void;
  documents?: SupportingDocument[];
}) {
  const update = (field: keyof ProposalSignedContractReference, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section
        title="Signed Contract Reference"
        defaultOpen
        icon={<FileSignature className="h-4 w-4 text-[#075eea]" />}
      >
        <FieldRow label="Contract Title">
          <FieldInput value={data.contractTitle} onChange={v => update("contractTitle", v)} placeholder="Signed agreement title" />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Contract No.">
            <FieldInput value={data.contractNumber} onChange={v => update("contractNumber", v)} placeholder="Contract number or reference" />
          </FieldRow>
          <FieldRow label="Signed Date">
            <FieldInput type="date" value={data.signedDate} onChange={v => update("signedDate", v)} />
          </FieldRow>
        </div>
        <FieldRow label="Final Customer">
          <FieldInput value={data.finalCustomer} onChange={v => update("finalCustomer", v)} placeholder="Final contracting customer name" />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Customer Signatory">
            <FieldInput value={data.customerSignatory} onChange={v => update("customerSignatory", v)} placeholder="Customer signatory or role" />
          </FieldRow>
          <FieldRow label="Hala Signatory">
            <FieldInput value={data.halaSignatory} onChange={v => update("halaSignatory", v)} placeholder="Hala signatory or role" />
          </FieldRow>
        </div>
        <FieldRow label="Document Ref">
          <DocumentReferenceSelect value={data.contractDocumentRef} onChange={v => update("contractDocumentRef", v)} documents={documents} />
        </FieldRow>
        <FieldRow label="Notes">
          <FieldTextarea value={data.notes} onChange={v => update("notes", v)} placeholder="Signed-contract reference notes" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function FinalScopeTab({
  data,
  onChange,
}: {
  data: ProposalFinalContractScope;
  onChange: (d: ProposalFinalContractScope) => void;
}) {
  const update = (field: keyof ProposalFinalContractScope, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Final Scope" defaultOpen icon={<ClipboardList className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Service Scope">
          <FieldTextarea value={data.finalServiceScope} onChange={v => update("finalServiceScope", v)} placeholder="Final contracted logistics service scope" rows={4} />
        </FieldRow>
        <FieldRow label="Locations">
          <FieldTextarea value={data.finalLocations} onChange={v => update("finalLocations", v)} placeholder="Final service locations, sites, regions, or lanes" rows={4} />
        </FieldRow>
        <FieldRow label="Volumes">
          <FieldTextarea value={data.finalVolumes} onChange={v => update("finalVolumes", v)} placeholder="Final volume, pallet, SKU, shipment, or activity assumptions" rows={4} />
        </FieldRow>
        <FieldRow label="Hala Responsibilities">
          <FieldTextarea value={data.halaResponsibilities} onChange={v => update("halaResponsibilities", v)} placeholder="Hala contracted responsibilities" rows={4} />
        </FieldRow>
        <FieldRow label="Customer Responsibilities">
          <FieldTextarea value={data.customerResponsibilities} onChange={v => update("customerResponsibilities", v)} placeholder="Customer contracted responsibilities" rows={4} />
        </FieldRow>
        <FieldRow label="Exclusions">
          <FieldTextarea value={data.exclusions} onChange={v => update("exclusions", v)} placeholder="Final exclusions or out-of-scope items" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function FinalPricingTab({
  data,
  onChange,
}: {
  data: ProposalFinalContractPricing;
  onChange: (d: ProposalFinalContractPricing) => void;
}) {
  const update = (field: keyof ProposalFinalContractPricing, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Final Pricing" defaultOpen icon={<DollarSign className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Commercial Approval Ref">
          <FieldInput value={data.linkedCommercialApproval} onChange={v => update("linkedCommercialApproval", v)} placeholder="Commercial Approval reference or final position" />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-4">
          <FieldRow label="Revenue">
            <FieldInput value={data.finalRevenue} onChange={v => update("finalRevenue", v)} placeholder="Final revenue" />
          </FieldRow>
          <FieldRow label="Cost">
            <FieldInput value={data.finalCost} onChange={v => update("finalCost", v)} placeholder="Final cost" />
          </FieldRow>
          <FieldRow label="GP">
            <FieldInput value={data.finalGrossProfit} onChange={v => update("finalGrossProfit", v)} placeholder="Gross profit" />
          </FieldRow>
          <FieldRow label="GP %">
            <FieldInput value={data.finalGpPercent} onChange={v => update("finalGpPercent", v)} placeholder="Margin percentage" />
          </FieldRow>
        </div>
        <FieldRow label="Pricing Notes">
          <FieldTextarea value={data.pricingNotes} onChange={v => update("pricingNotes", v)} placeholder="Final signed pricing notes, assumptions, or exceptions" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function FinalTermsTab({
  data,
  onChange,
}: {
  data: ProposalFinalContractTerms;
  onChange: (d: ProposalFinalContractTerms) => void;
}) {
  const update = (field: keyof ProposalFinalContractTerms, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Final Terms" defaultOpen icon={<FileCheck className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Payment Terms">
            <FieldInput value={data.paymentTerms} onChange={v => update("paymentTerms", v)} placeholder="Final payment terms" />
          </FieldRow>
          <FieldRow label="Contract Term">
            <FieldInput value={data.contractTerm} onChange={v => update("contractTerm", v)} placeholder="Term or duration" />
          </FieldRow>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Start Date">
            <FieldInput type="date" value={data.startDate} onChange={v => update("startDate", v)} />
          </FieldRow>
          <FieldRow label="Notice Period">
            <FieldInput value={data.renewalNotice} onChange={v => update("renewalNotice", v)} placeholder="Contract notice period" />
          </FieldRow>
        </div>
        <FieldRow label="Liability Position">
          <FieldTextarea value={data.liabilityPosition} onChange={v => update("liabilityPosition", v)} placeholder="Liability, insurance, or risk position captured in the signed contract" rows={4} />
        </FieldRow>
        <FieldRow label="Termination Terms">
          <FieldTextarea value={data.terminationTerms} onChange={v => update("terminationTerms", v)} placeholder="Termination, cancellation, or exit terms" rows={4} />
        </FieldRow>
        <FieldRow label="SLA / KPI Notes">
          <FieldTextarea value={data.finalSlaKpiNotes} onChange={v => update("finalSlaKpiNotes", v)} placeholder="Final signed service-level or KPI notes, if captured in the contract" rows={4} />
        </FieldRow>
        <FieldRow label="Special Conditions">
          <FieldTextarea value={data.specialConditions} onChange={v => update("specialConditions", v)} placeholder="Special signed terms or conditions to preserve" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function HandoverPrepTab({
  data,
  onChange,
}: {
  data: ProposalContractHandoverPrep;
  onChange: (d: ProposalContractHandoverPrep) => void;
}) {
  const update = (field: keyof ProposalContractHandoverPrep, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section
        title="Handover Prep"
        defaultOpen
        icon={<Handshake className="h-4 w-4 text-[#075eea]" />}
      >
        <div className="grid gap-2 lg:grid-cols-3">
          <FieldRow label="Handover Owner">
            <FieldInput value={data.handoverOwner} onChange={v => update("handoverOwner", v)} placeholder="Commercial handover owner" />
          </FieldRow>
          <FieldRow label="Ops Owner">
            <FieldInput value={data.operationsOwner} onChange={v => update("operationsOwner", v)} placeholder="Operations owner" />
          </FieldRow>
          <FieldRow label="Handover Date">
            <FieldInput type="date" value={data.handoverDate} onChange={v => update("handoverDate", v)} />
          </FieldRow>
        </div>
        <FieldRow label="Mobilisation Notes">
          <FieldTextarea value={data.mobilisationNotes} onChange={v => update("mobilisationNotes", v)} placeholder="Mobilisation notes for operations handover" rows={4} />
        </FieldRow>
        <FieldRow label="Open Actions">
          <FieldTextarea value={data.openActions} onChange={v => update("openActions", v)} placeholder="Open handover actions or follow-ups" rows={4} />
        </FieldRow>
        <FieldRow label="Contract Memory">
          <FieldTextarea value={data.contractMemoryNotes} onChange={v => update("contractMemoryNotes", v)} placeholder="Important signed-contract memory for Go-Live or future handover" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}
