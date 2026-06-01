import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Lock,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  documentsForTenderStage,
  isTenderDocumentExpired,
  type TenderDocument,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";
import { getCurrentUser } from "@/lib/auth-state";
import { canEditCosts } from "@/lib/sla-integrity";
import type { UserRole } from "@/lib/store";
import { isMeaningfulTenderValue } from "@/lib/proposal-block-foundation";
import { updateTenderPricingData } from "@/lib/supabase-tender-actions";
import {
  APPROVAL_CHAIN_STATUS_OPTIONS,
  APPROVAL_CHECK_STATUS_OPTIONS,
  APPROVAL_CONDITION_STATUS_OPTIONS,
  APPROVAL_ROLE_OPTIONS,
  ASSUMPTION_CATEGORY_OPTIONS,
  CALCULATOR_SOURCE_OPTIONS,
  CHARGE_TYPE_OPTIONS,
  COMMERCIAL_ASSUMPTION_STATUS_OPTIONS,
  COST_INPUT_GROUPS,
  COST_INPUT_SOURCE_OPTIONS,
  INSURANCE_TREATMENT_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  PNL_SNAPSHOT_STATUS_OPTIONS,
  PRICING_APPROVAL_STATUS_OPTIONS,
  RESPONSIBILITY_LABEL_OPTIONS,
  SCENARIO_TYPE_OPTIONS,
  VAT_TREATMENT_OPTIONS,
  YES_NO_NOT_ASSESSED_OPTIONS,
  calculatePricingScenarioSummary,
  emptyApprovalChainRow,
  emptyApprovalConditionRow,
  emptyCommercialAssumption,
  emptyCustomerResponsibility,
  emptyExclusion,
  emptyPricingScenario,
  emptySurcharge,
  hasPricingData,
  normalizeTenderPricingData,
  type ApprovalChainRow,
  type ApprovalCheckRow,
  type ApprovalConditionRow,
  type CommercialAssumptionRow,
  type CommercialTermsData,
  type CostInputsData,
  type CustomerResponsibilityRow,
  type ExclusionRow,
  type PnlSnapshotData,
  type PricingApprovalData,
  type PricingScenariosData,
  type SurchargeRow,
  type TenderPricingSectionKey,
} from "@/lib/tender-pricing-types";

interface StageProps {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments: () => void;
}

interface HeaderProps {
  ws: TenderWorkspace;
  onOpenDocuments: () => void;
}

const PRICING_DOCUMENT_TYPES = [
  "BOQ / Pricing Template",
  "Commercial Terms",
  "Payment Terms",
  "Contract Draft",
  "Insurance Certificate",
  "Costing Attachments",
  "Pricing Approval Attachments",
];

const FUTURE_OUTPUT = {
  pnl_snapshot: [
    ["P&L Snapshot", "pricing.table.single / Pricing Summary / Approval Matrix"],
    ["Calculator Link", "Commercial Proposal Summary"],
  ],
  cost_inputs: [
    ["Cost Inputs", "Internal pricing model"],
    ["Cost Notes", "Not exported unless selected"],
  ],
  scenarios: [
    ["Pricing Scenarios", "pricing.table.single / Commercial Options / Value Comparison"],
  ],
  commercial_terms: [
    ["Commercial Terms", "terms.standard / Assumptions & Dependencies / Exclusions"],
    ["Customer Responsibilities", "Commercial Terms & Conditions"],
  ],
  approval: [
    ["Pricing Approval", "Internal governance / approval record"],
    ["Approval Conditions", "Not normally exported to customer proposal unless selected"],
  ],
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function useSectionForm<T>(initial: T) {
  const initialJson = useMemo(() => stableStringify(initial), [initial]);
  const [data, setData] = useState<T>(initial);
  const [savedJson, setSavedJson] = useState(initialJson);

  useEffect(() => {
    setData(initial);
    setSavedJson(initialJson);
  }, [initialJson, initial]);

  const dataJson = stableStringify(data);
  const dirty = dataJson !== savedJson;
  const markSaved = (next: T) => setSavedJson(stableStringify(next));

  return { data, setData, dirty, markSaved };
}

function updateRecord<T extends Record<string, any>, K extends keyof T>(setter: Dispatch<SetStateAction<T>>, key: K, value: T[K]) {
  setter(prev => ({ ...prev, [key]: value }));
}

function updateNested<T extends Record<string, any>, K extends keyof T>(
  setter: Dispatch<SetStateAction<T>>,
  key: K,
  patch: Partial<T[K]>,
) {
  setter(prev => ({ ...prev, [key]: { ...(prev[key] as Record<string, any>), ...patch } }));
}

function inputClass(disabled?: boolean): string {
  return `h-8 text-xs ${disabled ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}`;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        className={inputClass(disabled)}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Textarea
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={event => onChange(event.target.value)}
        className={`min-h-[64px] resize-y text-xs ${disabled ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as T)}
        className={`h-8 w-full rounded-md border border-border bg-card px-2 text-xs ${disabled ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}`}
      >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function Section({
  title,
  icon: Icon = FileText,
  badge,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: typeof FileText;
  badge?: string | number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="cursor-pointer border-b border-border bg-muted/20 pb-2" onClick={() => setOpen(prev => !prev)}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <Icon className="h-3.5 w-3.5 text-indigo-600" />
          <span className="text-xs font-semibold">{title}</span>
          {badge !== undefined && <Badge variant="outline" className="ml-auto text-[8px]">{badge}</Badge>}
        </div>
      </CardHeader>
      {open && <CardContent className="p-4">{children}</CardContent>}
    </Card>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed py-7 text-center text-xs text-muted-foreground">{children}</div>;
}

function SaveFooter({
  dirty,
  saving,
  onSave,
  label,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-500" : "bg-emerald-500"}`} />
        {dirty ? "Unsaved changes" : "Saved"}
      </div>
      <Button size="sm" disabled={!dirty || saving} onClick={onSave} className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {label}
      </Button>
    </div>
  );
}

function FutureOutputUse({ rows }: { rows: string[][] }) {
  return (
    <Section title="Future Output Use" icon={ArrowRight} defaultOpen={false}>
      <div className="space-y-1.5">
        {rows.map(([source, output]) => (
          <div key={`${source}-${output}`} className="flex items-center gap-2 text-[10px]">
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[8px] text-violet-600">{source}</Badge>
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-muted-foreground">{output}</span>
          </div>
        ))}
        <p className="pt-1 text-[9px] text-muted-foreground/70">Informational only. This panel does not generate content or write to PDF Studio.</p>
      </div>
    </Section>
  );
}

function statusFromMeaningful(data: unknown, preferred?: string): string {
  if (!isMeaningfulTenderValue(data)) return "Not captured";
  if (preferred && preferred !== "Not Assessed" && preferred !== "Not Captured" && preferred !== "Not Decided") return preferred;
  return "Captured";
}

function hasText(...values: string[]): boolean {
  return values.some(value => value.trim().length > 0);
}

function scenarioHasContent(row: PricingScenariosData["rows"][number]): boolean {
  return hasText(
    row.scenario_name,
    row.linked_pnl_snapshot_reference,
    row.revenue,
    row.cost,
    row.gp_percent,
    row.target_gp_percent,
    row.variance,
    row.operational_assumption,
    row.commercial_risk,
    row.notes,
  ) || row.recommended !== "Not Assessed";
}

function sanitizeScenarios(data: PricingScenariosData): PricingScenariosData {
  const rows = data.rows.filter(scenarioHasContent);
  const selectedStillExists = rows.some(row => row.id === data.selected_scenario.selected_scenario_id);
  const selected_scenario = selectedStillExists
    ? data.selected_scenario
    : { selected_scenario_id: "", selected_scenario_name: "", reason_for_selection: data.selected_scenario.reason_for_selection, approval_required: data.selected_scenario.approval_required };
  return {
    ...data,
    rows,
    selected_scenario,
    summary: calculatePricingScenarioSummary({ rows, selected_scenario }),
  };
}

function sanitizeCommercialTerms(data: CommercialTermsData): CommercialTermsData {
  return {
    ...data,
    surcharges: data.surcharges.filter(row => hasText(row.trigger, row.rate_formula, row.applies_to, row.notes) || row.include_in_proposal !== "Not Assessed"),
    customer_responsibilities: data.customer_responsibilities.filter(row => hasText(row.responsibility, row.applies_to, row.source_evidence, row.commercial_impact) || row.include_in_proposal !== "Not Assessed"),
    exclusions: data.exclusions.filter(row => hasText(row.exclusion, row.reason, row.commercial_impact, row.notes) || row.include_in_proposal !== "Not Assessed"),
    assumptions: data.assumptions.filter(row => hasText(row.assumption, row.impact, row.owner, row.source) || row.status !== "Draft" || row.include_in_proposal !== "Not Assessed"),
  };
}

function sanitizeApproval(data: PricingApprovalData): PricingApprovalData {
  return {
    ...data,
    approval_chain: data.approval_chain.filter(row => hasText(row.approver, row.date, row.notes) || row.required !== "Not Assessed" || row.status !== "Not Started"),
    conditions: data.conditions.filter(row => hasText(row.condition, row.owner, row.due_date, row.notes) || row.status !== "Open"),
  };
}

function countArray(data: any, key: string): number {
  return Array.isArray(data?.[key]) ? data[key].length : 0;
}

function PnlPreviousStageIntelligence({ ws }: { ws: TenderWorkspace }) {
  const [open, setOpen] = useState(false);
  const t = ws.tender;
  const sd = t.solutionDesignData as any;
  const risk = t.riskSnapshotData as any;
  const bnb = t.bidNoBidData as any;
  const docs = documentsForTenderStage(ws.documents ?? [], "pnl_pricing");
  const pricingDocIssues = docs.filter(doc => doc.status === "Missing" || doc.status === "Expired" || isTenderDocumentExpired(doc)).length;
  const riskRegister = Array.isArray(risk?.register) ? risk.register : [];
  const openRisks = riskRegister.filter((row: any) => !["Resolved", "Mitigated"].includes(row.status)).length;
  const bidBlockers = riskRegister.filter((row: any) => row.bid_blocker === true).length;
  const clarifications =
    countArray(t.sowQualificationData as any, "clarifications") +
    countArray(t.technicalQualificationData as any, "clarifications") +
    countArray(risk, "clarifications") +
    countArray(sd?.assumptions_dependencies, "clarifications");

  const rows = [
    ["Bid / No-Bid Decision", statusFromMeaningful(bnb, bnb?.decision?.decision || bnb?.decision_record?.formal?.decision)],
    ["Solution Design Status", statusFromMeaningful(sd)],
    ["HOP Operations Model Status", statusFromMeaningful(sd?.hop, sd?.hop?.recommendation?.readiness)],
    ["HAM Manpower Model Status", statusFromMeaningful(sd?.ham, sd?.ham?.recommendation?.readiness)],
    ["HIP Systems & IP Model Status", statusFromMeaningful(sd?.hip, sd?.hip?.recommendation?.readiness)],
    ["Scope Matrix Status", statusFromMeaningful(sd?.scope_matrix)],
    ["SLA / KPI Model Status", statusFromMeaningful(sd?.sla_kpi, sd?.sla_kpi?.recommendation?.readiness)],
    ["Assumptions / Dependencies Status", statusFromMeaningful(sd?.assumptions_dependencies)],
    ["Open Risks Count", String(openRisks)],
    ["Bid Blockers Count", String(bidBlockers)],
    ["Clarifications Needed Count", String(clarifications)],
    ["Missing / Expired Pricing Documents Count", String(pricingDocIssues)],
  ];

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="cursor-pointer border-b border-border bg-muted/20 pb-2" onClick={() => setOpen(prev => !prev)}>
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
          <span className="text-xs font-semibold">Previous Stage Intelligence</span>
          <Badge variant="outline" className="ml-auto text-[8px]">read-only</Badge>
        </div>
        {!open && <p className="pl-5 text-[10px] text-muted-foreground">Actual saved prior-stage data only. Missing data remains Not captured.</p>}
      </CardHeader>
      {open && (
        <CardContent className="grid gap-2 p-3 md:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-card p-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className={`mt-1 text-xs ${value === "Not captured" ? "text-muted-foreground" : "font-medium text-foreground"}`}>{value}</p>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function PricingDocumentsCard({ ws, onOpenDocuments }: HeaderProps) {
  const docs = documentsForTenderStage(ws.documents ?? [], "pnl_pricing");
  const issues = docs.filter(doc => doc.status === "Missing" || doc.status === "Expired" || doc.status === "Needs Update" || isTenderDocumentExpired(doc));
  const findDoc = (type: string): TenderDocument | undefined => docs.find(doc => doc.document_type === type || doc.document_name.toLowerCase().includes(type.toLowerCase()));

  return (
    <Card className="border-border shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-semibold">Pricing Documents</h3>
              <Badge variant="outline" className="text-[9px]">{docs.length}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Filtered from the global tender document library only.</p>
          </div>
          <Button size="sm" className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800" onClick={onOpenDocuments}>
            <FolderOpen className="h-3.5 w-3.5" /> Open Documents
          </Button>
        </div>

        {docs.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">No documents uploaded yet.</div>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {PRICING_DOCUMENT_TYPES.map(type => {
              const doc = findDoc(type);
              return (
                <div key={type} className="rounded-md border border-border p-2">
                  <p className="text-[10px] font-semibold text-foreground">{type}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{doc ? `${doc.status}${doc.version ? ` - v${doc.version}` : ""}` : "Not captured"}</p>
                </div>
              );
            })}
          </div>
        )}

        {issues.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {issues.length} pricing document{issues.length === 1 ? "" : "s"} missing, expired, or needing update.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PnlPricingStageHeader({ ws, onOpenDocuments }: HeaderProps) {
  const pricing = normalizeTenderPricingData(ws.tender.pricingData);
  const statuses = [
    { label: "P&L Calculator", saved: !!(isMeaningfulTenderValue(pricing.pnl_snapshot) && (pricing.pnl_snapshot.snapshot_status !== "No Snapshot" || (pricing.pnl_snapshot as any).working_draft || (pricing.pnl_snapshot as any).snapshots?.length > 0)) },
    { label: "Scenarios", saved: pricing.scenarios.rows.length > 0 },
    { label: "Terms", saved: isMeaningfulTenderValue(pricing.commercial_terms) },
    { label: "Approval", saved: isMeaningfulTenderValue(pricing.approval) && pricing.approval.summary.approval_status !== "Not Submitted" },
  ];

  return (
    <div className="px-5 pt-3 space-y-3">
      <PnlPreviousStageIntelligence ws={ws} />
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/10 px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Save Status</span>
        {statuses.map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${item.saved ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className={`text-[9px] ${item.saved ? "font-medium text-emerald-700" : "text-muted-foreground"}`}>{item.label}</span>
          </div>
        ))}
        {!hasPricingData(ws.tender.pricingData) && <span className="ml-auto text-[9px] text-muted-foreground">No pricing data captured yet.</span>}
      </div>
      <PricingDocumentsCard ws={ws} onOpenDocuments={onOpenDocuments} />
    </div>
  );
}

function usePricingSave<T extends Record<string, any>>(
  tenderId: string,
  section: TenderPricingSectionKey,
  label: string,
  data: T,
  markSaved: (next: T) => void,
  reload: () => void,
) {
  const [saving, setSaving] = useState(false);
  const save = async (payload: T = data) => {
    setSaving(true);
    try {
      const result = await updateTenderPricingData(tenderId, section, payload, `${label} saved`);
      if (result.success) {
        markSaved(payload);
        toast.success(`${label} saved`);
        reload();
      } else {
        toast.error("Save failed", { description: result.error });
      }
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

function PnlSnapshotTab({ ws, reload }: { ws: TenderWorkspace; reload: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<PnlSnapshotData>(pricing.pnl_snapshot);
  const { saving, save } = usePricingSave(ws.tender.id, "pnl_snapshot", "P&L Snapshot", data as any, markSaved as any, reload);
  const pnlHref = `/pnl?tenderId=${encodeURIComponent(ws.tender.id)}`;

  const summaryFields: { key: keyof PnlSnapshotData; label: string }[] = [
    { key: "monthly_revenue", label: "Monthly Revenue" },
    { key: "annual_revenue", label: "Annual Revenue" },
    { key: "monthly_opex", label: "Monthly OPEX" },
    { key: "annual_opex", label: "Annual OPEX" },
    { key: "gross_profit_sar", label: "Gross Profit SAR" },
    { key: "gp_percent", label: "GP %" },
    { key: "target_gp_percent", label: "Target GP %" },
    { key: "variance_to_target_gp", label: "Variance to Target GP" },
    { key: "approval_chain_required", label: "Approval Chain Required" },
  ];

  return (
    <div className="space-y-4">
      <Section title="Linked P&L Calculator Status" icon={Calculator}>
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Linked P&L Record ID" value={data.linked_pnl_record_id} onChange={value => updateRecord(setData, "linked_pnl_record_id", value)} />
          <SelectField label="Snapshot Status" value={data.snapshot_status} options={PNL_SNAPSHOT_STATUS_OPTIONS} onChange={value => updateRecord(setData, "snapshot_status", value)} />
          <SelectField label="Calculator Source" value={data.calculator_source} options={CALCULATOR_SOURCE_OPTIONS} onChange={value => updateRecord(setData, "calculator_source", value)} />
          <TextField label="Last Snapshot Date" type="date" value={data.last_snapshot_date} onChange={value => updateRecord(setData, "last_snapshot_date", value)} />
          <TextField label="Last Updated By" value={data.last_updated_by} onChange={value => updateRecord(setData, "last_updated_by", value)} />
        </div>
        {!data.linked_pnl_record_id && <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">No P&L snapshot linked to this tender yet.</p>}
      </Section>

      <Section title="P&L Summary" icon={BarChart3}>
        <div className="grid gap-3 md:grid-cols-3">
          {summaryFields.map(field => (
            <TextField key={field.key} label={field.label} value={data[field.key] as string} onChange={value => updateRecord(setData, field.key, value as any)} />
          ))}
        </div>
        <TextAreaField label="Snapshot Notes" value={data.notes} onChange={value => updateRecord(setData, "notes", value)} />
      </Section>

      <Section title="Actions" icon={ArrowRight}>
        <div className="flex flex-wrap gap-2">
          <Link href={pnlHref}>
            <Button size="sm" className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800">
              <Calculator className="h-3.5 w-3.5" /> Open P&L Calculator
            </Button>
          </Link>
          <Button size="sm" variant="outline" disabled>Link Existing P&L Snapshot</Button>
          <Button size="sm" variant="outline" disabled>Create / Update Tender P&L Snapshot</Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Snapshot linking and creation will be enabled after calculator linkage is confirmed.</p>
      </Section>

      <FutureOutputUse rows={FUTURE_OUTPUT.pnl_snapshot} />
      <SaveFooter dirty={dirty} saving={saving} onSave={() => save(data as any)} label="Save P&L Snapshot" />
    </div>
  );
}

function CostInputsTab({ ws, reload }: { ws: TenderWorkspace; reload: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<CostInputsData>(pricing.cost_inputs);
  const { saving, save } = usePricingSave(ws.tender.id, "cost_inputs", "Cost Inputs", data as any, markSaved as any, reload);
  const user = getCurrentUser();
  const costEditable = canEditCosts(user.role as UserRole);

  const updateCostGroup = (group: keyof Pick<CostInputsData, "warehouse_operations" | "transport" | "manpower" | "systems_hip" | "risk_contingency">, key: string, value: string) => {
    setData(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  };

  return (
    <div className="space-y-4">
      <Section title="Cost Input Source" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Cost Input Source" value={data.source.cost_input_source} options={COST_INPUT_SOURCE_OPTIONS} onChange={value => updateNested(setData, "source", { cost_input_source: value })} />
          <TextField label="Source Reference" value={data.source.source_reference} onChange={value => updateNested(setData, "source", { source_reference: value })} />
          <TextField label="Owner" value={data.source.owner} onChange={value => updateNested(setData, "source", { owner: value })} />
          <TextField label="Last Updated" type="date" value={data.source.last_updated} onChange={value => updateNested(setData, "source", { last_updated: value })} />
        </div>
        <div className="mt-3">
          <TextAreaField label="Source Notes" value={data.source.notes} onChange={value => updateNested(setData, "source", { notes: value })} />
        </div>
      </Section>

      {!costEditable && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/40 px-3 py-2 text-xs text-amber-800">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Cost inputs are role-restricted. Sales users may view approved summaries only.
        </div>
      )}

      <Section title="Cost Input Summary" icon={ShieldAlert}>
        <div className="space-y-4">
          {(Object.entries(COST_INPUT_GROUPS) as [keyof CostInputsData, readonly (readonly [string, string])[]][]).map(([group, fields]) => (
            <div key={String(group)} className="rounded-md border border-border p-3">
              <p className="mb-3 text-xs font-semibold capitalize">{String(group).replace(/_/g, " ")}</p>
              <div className="grid gap-2 md:grid-cols-3">
                {fields.map(([key, label]) => (
                  <TextField
                    key={key}
                    label={label}
                    value={(data[group] as Record<string, string>)[key] ?? ""}
                    disabled={!costEditable}
                    onChange={value => updateCostGroup(group as any, key, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Cost Input Notes" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-2">
          <TextAreaField label="Cost Assumptions" value={data.notes.cost_assumptions} disabled={!costEditable} onChange={value => updateNested(setData, "notes", { cost_assumptions: value })} />
          <TextAreaField label="Pricing Dependencies" value={data.notes.pricing_dependencies} disabled={!costEditable} onChange={value => updateNested(setData, "notes", { pricing_dependencies: value })} />
          <TextAreaField label="Source Notes" value={data.notes.source_notes} onChange={value => updateNested(setData, "notes", { source_notes: value })} />
          <TextAreaField label="Finance Comments" value={data.notes.finance_comments} disabled={!costEditable} onChange={value => updateNested(setData, "notes", { finance_comments: value })} />
        </div>
      </Section>

      <FutureOutputUse rows={FUTURE_OUTPUT.cost_inputs} />
      <SaveFooter dirty={dirty} saving={saving} onSave={() => save(data as any)} label="Save Cost Inputs" />
    </div>
  );
}

function PricingScenariosTab({ ws, reload }: { ws: TenderWorkspace; reload: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<PricingScenariosData>(pricing.scenarios);
  const { saving, save } = usePricingSave(ws.tender.id, "scenarios", "Pricing Scenarios", data as any, markSaved as any, reload);
  const summary = calculatePricingScenarioSummary(data);

  const setRows = (rows: PricingScenariosData["rows"]) => setData(prev => ({ ...prev, rows, summary: calculatePricingScenarioSummary({ ...prev, rows }) }));
  const updateRow = (index: number, patch: Partial<PricingScenariosData["rows"][number]>) => setRows(data.rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const removeRow = (index: number) => setRows(data.rows.filter((_, i) => i !== index));
  const payload = { ...data, summary };
  const handleSave = () => {
    const sanitized = sanitizeScenarios(payload);
    setData(sanitized);
    save(sanitized as any);
  };

  return (
    <div className="space-y-4">
      <Section title="Scenario Register" icon={BarChart3} badge={`${data.rows.length} scenarios`}>
        {data.rows.length === 0 ? (
          <EmptyState>No pricing scenarios captured yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {data.rows.map((row, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => removeRow(index)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="grid gap-2 pr-6 md:grid-cols-4">
                  <TextField label="Scenario Name" value={row.scenario_name} onChange={value => updateRow(index, { scenario_name: value })} />
                  <SelectField label="Scenario Type" value={row.scenario_type} options={SCENARIO_TYPE_OPTIONS} onChange={value => updateRow(index, { scenario_type: value })} />
                  <TextField label="Linked P&L Snapshot / Reference" value={row.linked_pnl_snapshot_reference} onChange={value => updateRow(index, { linked_pnl_snapshot_reference: value })} />
                  <SelectField label="Recommended?" value={row.recommended} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateRow(index, { recommended: value })} />
                  <TextField label="Revenue" value={row.revenue} onChange={value => updateRow(index, { revenue: value })} />
                  <TextField label="Cost" value={row.cost} onChange={value => updateRow(index, { cost: value })} />
                  <TextField label="GP %" value={row.gp_percent} onChange={value => updateRow(index, { gp_percent: value })} />
                  <TextField label="Target GP %" value={row.target_gp_percent} onChange={value => updateRow(index, { target_gp_percent: value })} />
                  <TextField label="Variance" value={row.variance} onChange={value => updateRow(index, { variance: value })} />
                  <TextField label="Operational Assumption" value={row.operational_assumption} onChange={value => updateRow(index, { operational_assumption: value })} />
                  <TextField label="Commercial Risk" value={row.commercial_risk} onChange={value => updateRow(index, { commercial_risk: value })} />
                  <TextField label="Notes" value={row.notes} onChange={value => updateRow(index, { notes: value })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => setRows([...data.rows, emptyPricingScenario()])}>
          <Plus className="h-3 w-3" /> Add Pricing Scenario
        </Button>
      </Section>

      <Section title="Selected Scenario" icon={CheckCircle2}>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected Scenario</label>
            <select
              value={data.selected_scenario.selected_scenario_id}
              onChange={event => {
                const selected = data.rows.find(row => row.id === event.target.value);
                setData(prev => ({
                  ...prev,
                  selected_scenario: {
                    ...prev.selected_scenario,
                    selected_scenario_id: event.target.value,
                    selected_scenario_name: selected?.scenario_name ?? "",
                  },
                }));
              }}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs"
            >
              <option value="">Not Selected</option>
              {data.rows.map(row => <option key={row.id} value={row.id}>{row.scenario_name || "Unnamed scenario"}</option>)}
            </select>
          </div>
          <SelectField label="Approval Required" value={data.selected_scenario.approval_required} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateNested(setData, "selected_scenario", { approval_required: value })} />
          <TextField label="Selected Scenario Name" value={data.selected_scenario.selected_scenario_name} onChange={value => updateNested(setData, "selected_scenario", { selected_scenario_name: value })} />
        </div>
        <div className="mt-3">
          <TextAreaField label="Reason for Selection" value={data.selected_scenario.reason_for_selection} onChange={value => updateNested(setData, "selected_scenario", { reason_for_selection: value })} />
        </div>
      </Section>

      <Section title="Scenario Comparison Summary" icon={Info}>
        {data.rows.length === 0 ? (
          <EmptyState>No pricing scenarios captured yet.</EmptyState>
        ) : (
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["Scenarios", String(summary.number_of_scenarios)],
              ["Highest GP %", summary.highest_gp_percent || "Not captured"],
              ["Lowest GP %", summary.lowest_gp_percent || "Not captured"],
              ["Selected", summary.selected_scenario || "Not Selected"],
              ["Below Target GP", String(summary.scenarios_below_target_gp)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border p-3">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold">{value}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <FutureOutputUse rows={FUTURE_OUTPUT.scenarios} />
      <SaveFooter dirty={dirty} saving={saving} onSave={handleSave} label="Save Pricing Scenarios" />
    </div>
  );
}

function CommercialTermsTab({ ws, reload }: { ws: TenderWorkspace; reload: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<CommercialTermsData>(pricing.commercial_terms);
  const { saving, save } = usePricingSave(ws.tender.id, "commercial_terms", "Commercial Terms", data as any, markSaved as any, reload);

  const updateArray = <T extends { id: string }>(key: keyof CommercialTermsData, rows: T[]) => setData(prev => ({ ...prev, [key]: rows }));
  const updateArrayRow = <T extends { id: string }>(key: keyof CommercialTermsData, index: number, patch: Partial<T>) => {
    const rows = data[key] as unknown as T[];
    updateArray(key, rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  };
  const removeArrayRow = <T extends { id: string }>(key: keyof CommercialTermsData, index: number) => {
    const rows = data[key] as unknown as T[];
    updateArray(key, rows.filter((_, i) => i !== index));
  };
  const handleSave = () => {
    const sanitized = sanitizeCommercialTerms(data);
    setData(sanitized);
    save(sanitized as any);
  };

  return (
    <div className="space-y-4">
      <Section title="Payment / Tax / Validity" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Payment Terms" value={data.payment_tax_validity.payment_terms} options={PAYMENT_TERMS_OPTIONS} onChange={value => updateNested(setData, "payment_tax_validity", { payment_terms: value })} />
          <SelectField label="VAT Treatment" value={data.payment_tax_validity.vat_treatment} options={VAT_TREATMENT_OPTIONS} onChange={value => updateNested(setData, "payment_tax_validity", { vat_treatment: value })} />
          <TextField label="VAT %" value={data.payment_tax_validity.vat_percent} onChange={value => updateNested(setData, "payment_tax_validity", { vat_percent: value })} />
          <TextField label="Proposal Validity" value={data.payment_tax_validity.proposal_validity} onChange={value => updateNested(setData, "payment_tax_validity", { proposal_validity: value })} />
          <TextField label="Contract Term" value={data.payment_tax_validity.contract_term} onChange={value => updateNested(setData, "payment_tax_validity", { contract_term: value })} />
          <TextField label="Extension Option" value={data.payment_tax_validity.extension_option} onChange={value => updateNested(setData, "payment_tax_validity", { extension_option: value })} />
        </div>
      </Section>

      <Section title="Mobilization / Notice / Forecast" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="Mobilization Period" value={data.mobilization_notice_forecast.mobilization_period} onChange={value => updateNested(setData, "mobilization_notice_forecast", { mobilization_period: value })} />
          <TextField label="Movement Notice Period" value={data.mobilization_notice_forecast.movement_notice_period} onChange={value => updateNested(setData, "mobilization_notice_forecast", { movement_notice_period: value })} />
          <TextField label="Forecast Notice Period" value={data.mobilization_notice_forecast.forecast_notice_period} onChange={value => updateNested(setData, "mobilization_notice_forecast", { forecast_notice_period: value })} />
          <TextField label="ASN Requirement" value={data.mobilization_notice_forecast.asn_requirement} onChange={value => updateNested(setData, "mobilization_notice_forecast", { asn_requirement: value })} />
          <TextField label="Customer Forecast Responsibility" value={data.mobilization_notice_forecast.customer_forecast_responsibility} onChange={value => updateNested(setData, "mobilization_notice_forecast", { customer_forecast_responsibility: value })} />
        </div>
        <div className="mt-3">
          <TextAreaField label="Notes" value={data.mobilization_notice_forecast.notes} onChange={value => updateNested(setData, "mobilization_notice_forecast", { notes: value })} />
        </div>
      </Section>

      <Section title="Insurance / Liability" icon={ShieldAlert}>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Insurance Treatment" value={data.insurance_liability.insurance_treatment} options={INSURANCE_TREATMENT_OPTIONS} onChange={value => updateNested(setData, "insurance_liability", { insurance_treatment: value })} />
          <TextField label="Coverage Limit" value={data.insurance_liability.coverage_limit} onChange={value => updateNested(setData, "insurance_liability", { coverage_limit: value })} />
          <TextField label="Force Majeure Treatment" value={data.insurance_liability.force_majeure_treatment} onChange={value => updateNested(setData, "insurance_liability", { force_majeure_treatment: value })} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <TextAreaField label="Liability Notes" value={data.insurance_liability.liability_notes} onChange={value => updateNested(setData, "insurance_liability", { liability_notes: value })} />
          <TextAreaField label="Damage Responsibility Notes" value={data.insurance_liability.damage_responsibility_notes} onChange={value => updateNested(setData, "insurance_liability", { damage_responsibility_notes: value })} />
        </div>
      </Section>

      <Section title="Surcharges / Additional Charges" icon={Plus} badge={data.surcharges.length}>
        {data.surcharges.length === 0 ? <EmptyState>No surcharges captured yet.</EmptyState> : (
          <div className="space-y-3">
            {data.surcharges.map((row: SurchargeRow, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => removeArrayRow<SurchargeRow>("surcharges", index)}><Trash2 className="h-3.5 w-3.5" /></button>
                <div className="grid gap-2 pr-6 md:grid-cols-3">
                  <SelectField label="Charge Type" value={row.charge_type} options={CHARGE_TYPE_OPTIONS} onChange={value => updateArrayRow<SurchargeRow>("surcharges", index, { charge_type: value })} />
                  <TextField label="Trigger" value={row.trigger} onChange={value => updateArrayRow<SurchargeRow>("surcharges", index, { trigger: value })} />
                  <TextField label="Rate / Formula" value={row.rate_formula} onChange={value => updateArrayRow<SurchargeRow>("surcharges", index, { rate_formula: value })} />
                  <TextField label="Applies To" value={row.applies_to} onChange={value => updateArrayRow<SurchargeRow>("surcharges", index, { applies_to: value })} />
                  <SelectField label="Include in Proposal?" value={row.include_in_proposal} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateArrayRow<SurchargeRow>("surcharges", index, { include_in_proposal: value })} />
                  <TextField label="Notes" value={row.notes} onChange={value => updateArrayRow<SurchargeRow>("surcharges", index, { notes: value })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => updateArray("surcharges", [...data.surcharges, emptySurcharge()])}><Plus className="h-3 w-3" /> Add Surcharge</Button>
      </Section>

      <Section title="Customer Responsibilities" icon={FileText} badge={data.customer_responsibilities.length}>
        {data.customer_responsibilities.length === 0 ? <EmptyState>No customer responsibilities captured yet.</EmptyState> : (
          <div className="space-y-3">
            {data.customer_responsibilities.map((row: CustomerResponsibilityRow, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => removeArrayRow<CustomerResponsibilityRow>("customer_responsibilities", index)}><Trash2 className="h-3.5 w-3.5" /></button>
                <div className="grid gap-2 pr-6 md:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsibility</label>
                    <input list="responsibility-labels" value={row.responsibility} onChange={event => updateArrayRow<CustomerResponsibilityRow>("customer_responsibilities", index, { responsibility: event.target.value })} className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs" />
                  </div>
                  <TextField label="Applies To" value={row.applies_to} onChange={value => updateArrayRow<CustomerResponsibilityRow>("customer_responsibilities", index, { applies_to: value })} />
                  <TextField label="Source / Evidence" value={row.source_evidence} onChange={value => updateArrayRow<CustomerResponsibilityRow>("customer_responsibilities", index, { source_evidence: value })} />
                  <TextField label="Commercial Impact" value={row.commercial_impact} onChange={value => updateArrayRow<CustomerResponsibilityRow>("customer_responsibilities", index, { commercial_impact: value })} />
                  <SelectField label="Include in Proposal?" value={row.include_in_proposal} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateArrayRow<CustomerResponsibilityRow>("customer_responsibilities", index, { include_in_proposal: value })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <datalist id="responsibility-labels">{RESPONSIBILITY_LABEL_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => updateArray("customer_responsibilities", [...data.customer_responsibilities, emptyCustomerResponsibility()])}><Plus className="h-3 w-3" /> Add Responsibility</Button>
      </Section>

      <Section title="Exclusions" icon={FileText} badge={data.exclusions.length}>
        {data.exclusions.length === 0 ? <EmptyState>No exclusions captured yet.</EmptyState> : (
          <div className="space-y-3">
            {data.exclusions.map((row: ExclusionRow, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => removeArrayRow<ExclusionRow>("exclusions", index)}><Trash2 className="h-3.5 w-3.5" /></button>
                <div className="grid gap-2 pr-6 md:grid-cols-5">
                  <TextField label="Exclusion" value={row.exclusion} onChange={value => updateArrayRow<ExclusionRow>("exclusions", index, { exclusion: value })} />
                  <TextField label="Reason" value={row.reason} onChange={value => updateArrayRow<ExclusionRow>("exclusions", index, { reason: value })} />
                  <TextField label="Commercial Impact" value={row.commercial_impact} onChange={value => updateArrayRow<ExclusionRow>("exclusions", index, { commercial_impact: value })} />
                  <SelectField label="Include in Proposal?" value={row.include_in_proposal} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateArrayRow<ExclusionRow>("exclusions", index, { include_in_proposal: value })} />
                  <TextField label="Notes" value={row.notes} onChange={value => updateArrayRow<ExclusionRow>("exclusions", index, { notes: value })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => updateArray("exclusions", [...data.exclusions, emptyExclusion()])}><Plus className="h-3 w-3" /> Add Exclusion</Button>
      </Section>

      <Section title="Commercial Assumptions" icon={FileText} badge={data.assumptions.length}>
        {data.assumptions.length === 0 ? <EmptyState>No commercial assumptions captured yet.</EmptyState> : (
          <div className="space-y-3">
            {data.assumptions.map((row: CommercialAssumptionRow, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => removeArrayRow<CommercialAssumptionRow>("assumptions", index)}><Trash2 className="h-3.5 w-3.5" /></button>
                <div className="grid gap-2 pr-6 md:grid-cols-4">
                  <TextField label="Assumption" value={row.assumption} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { assumption: value })} />
                  <SelectField label="Category" value={row.category} options={ASSUMPTION_CATEGORY_OPTIONS} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { category: value })} />
                  <TextField label="Impact" value={row.impact} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { impact: value })} />
                  <TextField label="Owner" value={row.owner} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { owner: value })} />
                  <TextField label="Source" value={row.source} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { source: value })} />
                  <SelectField label="Status" value={row.status} options={COMMERCIAL_ASSUMPTION_STATUS_OPTIONS} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { status: value })} />
                  <SelectField label="Include in Proposal?" value={row.include_in_proposal} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateArrayRow<CommercialAssumptionRow>("assumptions", index, { include_in_proposal: value })} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => updateArray("assumptions", [...data.assumptions, emptyCommercialAssumption()])}><Plus className="h-3 w-3" /> Add Assumption</Button>
      </Section>

      <FutureOutputUse rows={FUTURE_OUTPUT.commercial_terms} />
      <SaveFooter dirty={dirty} saving={saving} onSave={handleSave} label="Save Commercial Terms" />
    </div>
  );
}

function PricingApprovalTab({ ws, reload }: { ws: TenderWorkspace; reload: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<PricingApprovalData>(pricing.approval);
  const { saving, save } = usePricingSave(ws.tender.id, "approval", "Pricing Approval", data as any, markSaved as any, reload);

  const updateChain = (rows: ApprovalChainRow[]) => setData(prev => ({ ...prev, approval_chain: rows }));
  const updateChecks = (rows: ApprovalCheckRow[]) => setData(prev => ({ ...prev, approval_checks: rows }));
  const updateConditions = (rows: ApprovalConditionRow[]) => setData(prev => ({ ...prev, conditions: rows }));
  const handleSave = () => {
    const sanitized = sanitizeApproval(data);
    setData(sanitized);
    save(sanitized as any);
  };

  return (
    <div className="space-y-4">
      <Section title="Approval Summary" icon={CheckCircle2}>
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField label="Approval Status" value={data.summary.approval_status} options={PRICING_APPROVAL_STATUS_OPTIONS} onChange={value => updateNested(setData, "summary", { approval_status: value })} />
          <TextField label="Approval Level Required" value={data.summary.approval_level_required} onChange={value => updateNested(setData, "summary", { approval_level_required: value })} />
          <TextField label="Current Approver" value={data.summary.current_approver} onChange={value => updateNested(setData, "summary", { current_approver: value })} />
          <TextField label="Submitted Date" type="date" value={data.summary.submitted_date} onChange={value => updateNested(setData, "summary", { submitted_date: value })} />
          <TextField label="Approved Date" type="date" value={data.summary.approved_date} onChange={value => updateNested(setData, "summary", { approved_date: value })} />
        </div>
        <div className="mt-3">
          <TextAreaField label="Rejection / Revision Reason" value={data.summary.rejection_revision_reason} onChange={value => updateNested(setData, "summary", { rejection_revision_reason: value })} />
        </div>
      </Section>

      <Section title="Approval Chain" icon={ShieldAlert} badge={data.approval_chain.length}>
        {data.approval_chain.length === 0 ? <EmptyState>No approval chain rows captured yet.</EmptyState> : (
          <div className="space-y-3">
            {data.approval_chain.map((row, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => updateChain(data.approval_chain.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                <div className="grid gap-2 pr-6 md:grid-cols-6">
                  <SelectField label="Approval Role" value={row.approval_role} options={APPROVAL_ROLE_OPTIONS} onChange={value => updateChain(data.approval_chain.map((r, i) => i === index ? { ...r, approval_role: value } : r))} />
                  <TextField label="Approver" value={row.approver} onChange={value => updateChain(data.approval_chain.map((r, i) => i === index ? { ...r, approver: value } : r))} />
                  <SelectField label="Required?" value={row.required} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateChain(data.approval_chain.map((r, i) => i === index ? { ...r, required: value } : r))} />
                  <SelectField label="Status" value={row.status} options={APPROVAL_CHAIN_STATUS_OPTIONS} onChange={value => updateChain(data.approval_chain.map((r, i) => i === index ? { ...r, status: value } : r))} />
                  <TextField label="Date" type="date" value={row.date} onChange={value => updateChain(data.approval_chain.map((r, i) => i === index ? { ...r, date: value } : r))} />
                  <TextField label="Notes" value={row.notes} onChange={value => updateChain(data.approval_chain.map((r, i) => i === index ? { ...r, notes: value } : r))} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => updateChain([...data.approval_chain, emptyApprovalChainRow()])}><Plus className="h-3 w-3" /> Add Approval Role</Button>
      </Section>

      <Section title="Approval Checks" icon={CheckCircle2} badge={data.approval_checks.length}>
        <div className="space-y-2">
          {data.approval_checks.map((row, index) => (
            <div key={row.id} className="grid gap-2 rounded-md border border-border p-2 md:grid-cols-[1.4fr_0.7fr_1.4fr_0.8fr]">
              <TextField label="Check" value={row.check} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, check: value } : r))} />
              <SelectField label="Status" value={row.status} options={APPROVAL_CHECK_STATUS_OPTIONS} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, status: value } : r))} />
              <TextField label="Evidence / Notes" value={row.evidence_notes} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, evidence_notes: value } : r))} />
              <TextField label="Owner" value={row.owner} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, owner: value } : r))} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Approval Conditions" icon={AlertTriangle} badge={data.conditions.length}>
        {data.conditions.length === 0 ? <EmptyState>No approval conditions captured yet.</EmptyState> : (
          <div className="space-y-3">
            {data.conditions.map((row, index) => (
              <div key={row.id} className="relative rounded-lg border border-border p-3">
                <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => updateConditions(data.conditions.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></button>
                <div className="grid gap-2 pr-6 md:grid-cols-5">
                  <TextField label="Condition" value={row.condition} onChange={value => updateConditions(data.conditions.map((r, i) => i === index ? { ...r, condition: value } : r))} />
                  <TextField label="Owner" value={row.owner} onChange={value => updateConditions(data.conditions.map((r, i) => i === index ? { ...r, owner: value } : r))} />
                  <TextField label="Due Date" type="date" value={row.due_date} onChange={value => updateConditions(data.conditions.map((r, i) => i === index ? { ...r, due_date: value } : r))} />
                  <SelectField label="Status" value={row.status} options={APPROVAL_CONDITION_STATUS_OPTIONS} onChange={value => updateConditions(data.conditions.map((r, i) => i === index ? { ...r, status: value } : r))} />
                  <TextField label="Notes" value={row.notes} onChange={value => updateConditions(data.conditions.map((r, i) => i === index ? { ...r, notes: value } : r))} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => updateConditions([...data.conditions, emptyApprovalConditionRow()])}><Plus className="h-3 w-3" /> Add Condition</Button>
      </Section>

      <FutureOutputUse rows={FUTURE_OUTPUT.approval} />
      <SaveFooter dirty={dirty} saving={saving} onSave={handleSave} label="Save Pricing Approval" />
    </div>
  );
}

export default function PnlPricingStage({ ws, activeTab, reload }: StageProps) {
  if (activeTab === "pricing_scenarios") return <PricingScenariosTab ws={ws} reload={reload} />;
  if (activeTab === "commercial_terms") return <CommercialTermsTab ws={ws} reload={reload} />;
  if (activeTab === "pricing_approval") return <PricingApprovalTab ws={ws} reload={reload} />;
  return <EmptyState>No P&L / Pricing view configured for this tab.</EmptyState>;
}
