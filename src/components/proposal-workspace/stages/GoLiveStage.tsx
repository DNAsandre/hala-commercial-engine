import { AlertTriangle, History, Route, Target, Truck, Users } from "lucide-react";
import { FieldInput, FieldRow, FieldTextarea, Section } from "../ui-primitives";
import type {
  ProposalGoLiveSummary,
  ProposalMobilizationTracker,
  ProposalOpenImplementationRisks,
  ProposalOperationsHandover,
  ProposalRenewalFutureMemory,
  ProposalSlaKpiSetup,
} from "../proposal-workspace-state";

export function GoLiveSummaryTab({
  data,
  onChange,
}: {
  data: ProposalGoLiveSummary;
  onChange: (d: ProposalGoLiveSummary) => void;
}) {
  const update = (field: keyof ProposalGoLiveSummary, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Go-Live Summary" defaultOpen icon={<Route className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Go-Live Date">
            <FieldInput type="date" value={data.goLiveDate} onChange={v => update("goLiveDate", v)} />
          </FieldRow>
          <FieldRow label="Status">
            <FieldInput value={data.goLiveStatus} onChange={v => update("goLiveStatus", v)} placeholder="Go-live status" />
          </FieldRow>
        </div>
        <div className="grid gap-2 lg:grid-cols-3">
          <FieldRow label="Commercial Owner">
            <FieldInput value={data.commercialOwner} onChange={v => update("commercialOwner", v)} placeholder="Commercial owner" />
          </FieldRow>
          <FieldRow label="Operational Owner">
            <FieldInput value={data.operationalOwner} onChange={v => update("operationalOwner", v)} placeholder="Operations owner" />
          </FieldRow>
          <FieldRow label="Customer Contact">
            <FieldInput value={data.customerContact} onChange={v => update("customerContact", v)} placeholder="Customer go-live contact" />
          </FieldRow>
        </div>
        <FieldRow label="Commercial Promise Summary">
          <FieldTextarea value={data.commercialPromiseSummary} onChange={v => update("commercialPromiseSummary", v)} placeholder="Summary of the commercial promise handed into execution" rows={5} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function MobilizationTrackerTab({
  data,
  onChange,
}: {
  data: ProposalMobilizationTracker;
  onChange: (d: ProposalMobilizationTracker) => void;
}) {
  const update = (field: keyof ProposalMobilizationTracker, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Mobilization Tracker" defaultOpen icon={<Truck className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-2 lg:grid-cols-3">
          <FieldRow label="Status">
            <FieldInput value={data.mobilizationStatus} onChange={v => update("mobilizationStatus", v)} placeholder="Mobilization status" />
          </FieldRow>
          <FieldRow label="Start Date">
            <FieldInput type="date" value={data.mobilizationStartDate} onChange={v => update("mobilizationStartDate", v)} />
          </FieldRow>
          <FieldRow label="Target Go-Live">
            <FieldInput type="date" value={data.targetGoLiveDate} onChange={v => update("targetGoLiveDate", v)} />
          </FieldRow>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Facility Readiness">
            <FieldTextarea value={data.facilityReadiness} onChange={v => update("facilityReadiness", v)} placeholder="Facility, site, warehouse, or lane readiness" rows={3} />
          </FieldRow>
          <FieldRow label="Resource Readiness">
            <FieldTextarea value={data.resourceReadiness} onChange={v => update("resourceReadiness", v)} placeholder="People, equipment, vehicles, vendors, or capacity readiness" rows={3} />
          </FieldRow>
          <FieldRow label="Systems Readiness">
            <FieldTextarea value={data.systemsReadiness} onChange={v => update("systemsReadiness", v)} placeholder="Systems, reporting, integration, or visibility readiness" rows={3} />
          </FieldRow>
          <FieldRow label="Customer Readiness">
            <FieldTextarea value={data.customerReadiness} onChange={v => update("customerReadiness", v)} placeholder="Customer inputs, access, data, or operating readiness" rows={3} />
          </FieldRow>
        </div>
        <FieldRow label="Mobilization Notes">
          <FieldTextarea value={data.mobilizationNotes} onChange={v => update("mobilizationNotes", v)} placeholder="Mobilization notes and follow-ups" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function OperationsHandoverTab({
  data,
  onChange,
}: {
  data: ProposalOperationsHandover;
  onChange: (d: ProposalOperationsHandover) => void;
}) {
  const update = (field: keyof ProposalOperationsHandover, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Operations Handover" defaultOpen icon={<Users className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Operations Owner">
            <FieldInput value={data.operationsOwner} onChange={v => update("operationsOwner", v)} placeholder="Operations handover owner" />
          </FieldRow>
          <FieldRow label="Handover Date">
            <FieldInput type="date" value={data.handoverDate} onChange={v => update("handoverDate", v)} />
          </FieldRow>
        </div>
        <FieldRow label="Handover Checklist">
          <FieldTextarea value={data.handoverChecklist} onChange={v => update("handoverChecklist", v)} placeholder="Handover checklist, actions, or readiness notes" rows={4} />
        </FieldRow>
        <FieldRow label="Final Scope Reference">
          <FieldTextarea value={data.finalScopeReference} onChange={v => update("finalScopeReference", v)} placeholder="Final scope, contract, or approved proposal reference used for handover" rows={3} />
        </FieldRow>
        <FieldRow label="Key Responsibilities">
          <FieldTextarea value={data.keyResponsibilities} onChange={v => update("keyResponsibilities", v)} placeholder="Customer and Hala responsibilities handed into operations" rows={4} />
        </FieldRow>
        <FieldRow label="Handover Notes">
          <FieldTextarea value={data.handoverNotes} onChange={v => update("handoverNotes", v)} placeholder="Operations handover notes" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function SlaKpiSetupTab({
  data,
  onChange,
}: {
  data: ProposalSlaKpiSetup;
  onChange: (d: ProposalSlaKpiSetup) => void;
}) {
  const update = (field: keyof ProposalSlaKpiSetup, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="SLA / KPI Setup" defaultOpen icon={<Target className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Service Level Summary">
          <FieldTextarea value={data.serviceLevelSummary} onChange={v => update("serviceLevelSummary", v)} placeholder="Service level language or setup notes carried from proposal/contract truth" rows={4} />
        </FieldRow>
        <FieldRow label="KPI Definitions">
          <FieldTextarea value={data.kpiDefinitions} onChange={v => update("kpiDefinitions", v)} placeholder="KPI definitions, metrics, or measurement points" rows={4} />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Measurement Method">
            <FieldTextarea value={data.measurementMethod} onChange={v => update("measurementMethod", v)} placeholder="How performance will be measured" rows={3} />
          </FieldRow>
          <FieldRow label="Reporting Cadence">
            <FieldTextarea value={data.reportingCadence} onChange={v => update("reportingCadence", v)} placeholder="Reporting rhythm, format, or owner" rows={3} />
          </FieldRow>
        </div>
        <FieldRow label="Exclusions">
          <FieldTextarea value={data.exclusions} onChange={v => update("exclusions", v)} placeholder="Service-level or KPI exclusions to preserve" rows={3} />
        </FieldRow>
        <FieldRow label="Open SLA / KPI Notes">
          <FieldTextarea value={data.openSlaKpiNotes} onChange={v => update("openSlaKpiNotes", v)} placeholder="Open service-level or KPI notes for execution memory" rows={4} />
        </FieldRow>
      </Section>
    </div>
  );
}

export function OpenRisksTab({
  data,
  onChange,
}: {
  data: ProposalOpenImplementationRisks;
  onChange: (d: ProposalOpenImplementationRisks) => void;
}) {
  const update = (field: keyof ProposalOpenImplementationRisks, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Open Risks" defaultOpen icon={<AlertTriangle className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Risk Summary">
          <FieldTextarea value={data.riskSummary} onChange={v => update("riskSummary", v)} placeholder="Open implementation risks" rows={4} />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Customer Dependencies">
            <FieldTextarea value={data.customerDependencies} onChange={v => update("customerDependencies", v)} placeholder="Customer dependencies or missing inputs" rows={3} />
          </FieldRow>
          <FieldRow label="Operational Risks">
            <FieldTextarea value={data.operationalRisks} onChange={v => update("operationalRisks", v)} placeholder="Operational risks or constraints" rows={3} />
          </FieldRow>
          <FieldRow label="Commercial Risks">
            <FieldTextarea value={data.commercialRisks} onChange={v => update("commercialRisks", v)} placeholder="Commercial risks, exceptions, or assumptions" rows={3} />
          </FieldRow>
          <FieldRow label="Mitigation Plan">
            <FieldTextarea value={data.mitigationPlan} onChange={v => update("mitigationPlan", v)} placeholder="Mitigation plan or next action" rows={3} />
          </FieldRow>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Owner">
            <FieldInput value={data.owner} onChange={v => update("owner", v)} placeholder="Risk owner" />
          </FieldRow>
          <FieldRow label="Status">
            <FieldInput value={data.status} onChange={v => update("status", v)} placeholder="Risk status" />
          </FieldRow>
        </div>
      </Section>
    </div>
  );
}

export function RenewalFutureMemoryTab({
  data,
  onChange,
}: {
  data: ProposalRenewalFutureMemory;
  onChange: (d: ProposalRenewalFutureMemory) => void;
}) {
  const update = (field: keyof ProposalRenewalFutureMemory, value: string) => onChange({ ...data, [field]: value });

  return (
    <div className="space-y-3">
      <Section title="Renewal / Future Memory" defaultOpen icon={<History className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Renewal Baseline Notes">
          <FieldTextarea value={data.renewalBaselineNotes} onChange={v => update("renewalBaselineNotes", v)} placeholder="Renewal baseline notes to preserve from the signed contract and go-live handover" rows={4} />
        </FieldRow>
        <FieldRow label="Notice Period Memory">
          <FieldTextarea value={data.noticePeriodMemory} onChange={v => update("noticePeriodMemory", v)} placeholder="Notice period or contract review memory" rows={3} />
        </FieldRow>
        <div className="grid gap-2 lg:grid-cols-2">
          <FieldRow label="Future Opportunity Notes">
            <FieldTextarea value={data.futureOpportunityNotes} onChange={v => update("futureOpportunityNotes", v)} placeholder="Future commercial opportunity notes" rows={3} />
          </FieldRow>
          <FieldRow label="Expansion Potential">
            <FieldTextarea value={data.expansionPotential} onChange={v => update("expansionPotential", v)} placeholder="Expansion, additional services, or future lanes/sites" rows={3} />
          </FieldRow>
        </div>
        <FieldRow label="Contract Review Notes">
          <FieldTextarea value={data.contractReviewNotes} onChange={v => update("contractReviewNotes", v)} placeholder="Contract review memory for future use" rows={4} />
        </FieldRow>
        <FieldRow label="Memory Owner">
          <FieldInput value={data.memoryOwner} onChange={v => update("memoryOwner", v)} placeholder="Owner of future memory notes" />
        </FieldRow>
      </Section>
    </div>
  );
}
