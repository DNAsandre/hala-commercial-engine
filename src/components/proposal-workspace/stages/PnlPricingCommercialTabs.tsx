import { AlertTriangle, DollarSign, FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FieldInput, FieldRow, FieldTextarea, Section } from "../ui-primitives";
import type { CommercialTerms, PricingAssumptionsExclusions } from "../proposal-workspace-state";

export function CommercialTermsTab({
  data,
  onChange,
}: {
  data: CommercialTerms;
  onChange: (d: CommercialTerms) => void;
}) {
  const update = (field: keyof CommercialTerms, value: string) => onChange({ ...data, [field]: value });
  const captured = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileSignature className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Commercial Terms</span>
        <Badge variant="outline" className="text-[9px]">{captured}/22 captured</Badge>
      </div>

      <Section title="Core Commercial Terms" defaultOpen icon={<FileSignature className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-x-4 lg:grid-cols-2">
          <FieldRow label="VAT"><FieldInput value={data.vat} onChange={v => update("vat", v)} placeholder="e.g. VAT excluded / VAT applicable" /></FieldRow>
          <FieldRow label="Payment Terms"><FieldInput value={data.paymentTerms} onChange={v => update("paymentTerms", v)} placeholder="e.g. 30 days from invoice" /></FieldRow>
          <FieldRow label="Validity"><FieldInput value={data.proposalValidity} onChange={v => update("proposalValidity", v)} placeholder="e.g. Valid for 30 days" /></FieldRow>
          <FieldRow label="Contract Term"><FieldInput value={data.contractDuration} onChange={v => update("contractDuration", v)} placeholder="e.g. 12 months" /></FieldRow>
          <FieldRow label="Renewal Notice"><FieldInput value={data.renewalNotice} onChange={v => update("renewalNotice", v)} placeholder="e.g. 60 days before expiry" /></FieldRow>
          <FieldRow label="Mobilization"><FieldInput value={data.mobilization} onChange={v => update("mobilization", v)} placeholder="Mobilization fee or lead time" /></FieldRow>
          <FieldRow label="Working Days"><FieldInput value={data.workingDays} onChange={v => update("workingDays", v)} placeholder="e.g. Sunday to Thursday" /></FieldRow>
          <FieldRow label="Working Hours"><FieldInput value={data.workingHours} onChange={v => update("workingHours", v)} placeholder="e.g. 08:00 to 17:00" /></FieldRow>
          <FieldRow label="Forecast Notice"><FieldInput value={data.forecastNotice} onChange={v => update("forecastNotice", v)} placeholder="e.g. 48-hour forecast notice" /></FieldRow>
        </div>
      </Section>

      <Section title="Responsibilities And Charge Rules" defaultOpen icon={<DollarSign className="h-4 w-4 text-amber-500" />}>
        <div className="grid gap-x-4 lg:grid-cols-2">
          <FieldRow label="Loading"><FieldTextarea value={data.loadingResponsibility} onChange={v => update("loadingResponsibility", v)} placeholder="Who owns loading, manpower, equipment, and timing" rows={2} /></FieldRow>
          <FieldRow label="Offloading"><FieldTextarea value={data.offloadingResponsibility} onChange={v => update("offloadingResponsibility", v)} placeholder="Who owns offloading, site readiness, and delays" rows={2} /></FieldRow>
          <FieldRow label="Permits"><FieldTextarea value={data.permits} onChange={v => update("permits", v)} placeholder="Permits, site access, truck restrictions, and approvals" rows={2} /></FieldRow>
          <FieldRow label="Weight Limits"><FieldTextarea value={data.weightLimits} onChange={v => update("weightLimits", v)} placeholder="Weight limits, load constraints, and declaration responsibility" rows={2} /></FieldRow>
          <FieldRow label="Insurance"><FieldTextarea value={data.insurance} onChange={v => update("insurance", v)} placeholder="Insurance coverage and value declaration boundaries" rows={2} /></FieldRow>
          <FieldRow label="Liability"><FieldTextarea value={data.liabilityExclusions} onChange={v => update("liabilityExclusions", v)} placeholder="Liability exclusions, consequential loss, force majeure, and product risk" rows={2} /></FieldRow>
          <FieldRow label="Overtime"><FieldTextarea value={data.overtime} onChange={v => update("overtime", v)} placeholder="Overtime basis and charge trigger" rows={2} /></FieldRow>
          <FieldRow label="Cancellation"><FieldTextarea value={data.cancellation} onChange={v => update("cancellation", v)} placeholder="Cancellation notice and charges" rows={2} /></FieldRow>
          <FieldRow label="Detention"><FieldTextarea value={data.detention} onChange={v => update("detention", v)} placeholder="Detention trigger, free time, and charge basis" rows={2} /></FieldRow>
          <FieldRow label="Demurrage"><FieldTextarea value={data.demurrage} onChange={v => update("demurrage", v)} placeholder="Demurrage basis if applicable" rows={2} /></FieldRow>
          <FieldRow label="Fuel Surcharge"><FieldTextarea value={data.fuelSurcharge} onChange={v => update("fuelSurcharge", v)} placeholder="Fuel surcharge formula or review basis" rows={2} /></FieldRow>
          <FieldRow label="Policy Changes"><FieldTextarea value={data.policyChangeClause} onChange={v => update("policyChangeClause", v)} placeholder="Government policy, toll, compliance, or regulatory change treatment" rows={2} /></FieldRow>
          <FieldRow label="Extra Charges"><FieldTextarea value={data.additionalChargeApproval} onChange={v => update("additionalChargeApproval", v)} placeholder="How additional charges are requested, documented, and accepted" rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

export function PricingAssumptionsExclusionsTab({
  data,
  onChange,
}: {
  data: PricingAssumptionsExclusions;
  onChange: (d: PricingAssumptionsExclusions) => void;
}) {
  const update = (field: keyof PricingAssumptionsExclusions, value: string) => onChange({ ...data, [field]: value });
  const captured = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">Assumptions / Exclusions</span>
        <Badge variant="outline" className="text-[9px]">{captured}/10 captured</Badge>
      </div>

      <Section title="Pricing Basis" defaultOpen icon={<DollarSign className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Pricing"><FieldTextarea value={data.pricingAssumptions} onChange={v => update("pricingAssumptions", v)} placeholder="Pricing basis, rate validity, minimum volumes, pass-through costs, and charge triggers" rows={3} /></FieldRow>
        <FieldRow label="Operations"><FieldTextarea value={data.operationalAssumptions} onChange={v => update("operationalAssumptions", v)} placeholder="Operating assumptions used to build the commercial model" rows={3} /></FieldRow>
        <FieldRow label="Volumes"><FieldTextarea value={data.volumeAssumptions} onChange={v => update("volumeAssumptions", v)} placeholder="Volume assumptions, forecast basis, seasonality, and utilization assumptions" rows={3} /></FieldRow>
      </Section>

      <Section title="Responsibilities And Protection" defaultOpen icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
        <FieldRow label="Customer"><FieldTextarea value={data.customerResponsibilities} onChange={v => update("customerResponsibilities", v)} placeholder="Customer responsibilities that support the pricing and service promise" rows={3} /></FieldRow>
        <FieldRow label="Hala"><FieldTextarea value={data.halaResponsibilities} onChange={v => update("halaResponsibilities", v)} placeholder="Hala responsibilities included in the proposed commercial model" rows={3} /></FieldRow>
        <FieldRow label="Exclusions"><FieldTextarea value={data.exclusions} onChange={v => update("exclusions", v)} placeholder="Excluded services, out-of-scope activities, and excluded costs" rows={3} /></FieldRow>
        <FieldRow label="Dependencies"><FieldTextarea value={data.dependencies} onChange={v => update("dependencies", v)} placeholder="Customer data, site access, systems, approvals, suppliers, or third-party dependencies" rows={3} /></FieldRow>
        <FieldRow label="Limitations"><FieldTextarea value={data.limitations} onChange={v => update("limitations", v)} placeholder="Limitations, constraints, boundaries, and caveats" rows={3} /></FieldRow>
        <FieldRow label="Risk Notes"><FieldTextarea value={data.commercialRiskNotes} onChange={v => update("commercialRiskNotes", v)} placeholder="Commercial risk notes that must carry into quote, drafting, and negotiation" rows={3} /></FieldRow>
        <FieldRow label="Pricing Notes"><FieldTextarea value={data.pricingApprovalNotes} onChange={v => update("pricingApprovalNotes", v)} placeholder="Human pricing review notes, rationale, or sign-off context. Informational only during MVP testing." rows={3} /></FieldRow>
      </Section>
    </div>
  );
}
