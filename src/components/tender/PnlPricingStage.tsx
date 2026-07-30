import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Lock,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  PanelRightOpen,
  Scale,
  ScrollText,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { getCurrentUser } from "@/lib/auth-state";
import { canEditCosts } from "@/lib/sla-integrity";
import type { UserRole } from "@/lib/store";
import { updateTenderPricingData } from "@/lib/supabase-tender-actions";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";
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
  onOpenGlobalIntel?: () => void;
}

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
  label, value, onChange, type = "text", placeholder, disabled,
}: {
  label: string; value: string; onChange: (value: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={event => onChange(event.target.value)} className={inputClass(disabled)} />
    </div>
  );
}

function TextAreaField({
  label, value, onChange, placeholder, disabled,
}: {
  label: string; value: string; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <Textarea value={value} placeholder={placeholder} disabled={disabled} onChange={event => onChange(event.target.value)} className={`min-h-[64px] resize-y text-xs ${disabled ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}`} />
    </div>
  );
}

function SelectField<T extends string>({
  label, value, options, onChange, disabled,
}: {
  label: string; value: T; options: readonly T[];
  onChange: (value: T) => void; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} disabled={disabled} onChange={event => onChange(event.target.value as T)} className={`h-8 w-full rounded-md border border-border bg-card px-2 text-xs ${disabled ? "bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}`}>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed py-7 text-center text-xs text-muted-foreground">{children}</div>;
}

function SaveFooter({
  dirty, saving, onSave, label,
}: {
  dirty: boolean; saving: boolean; onSave: () => void; label: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-500" : "bg-emerald-500"}`} />
        {dirty ? "Unsaved changes" : "Saved"}
      </div>
      <Button size="sm" disabled={!dirty || saving} onClick={onSave} className="gap-1.5 bg-[#075eea] text-white hover:bg-[#0655d6] active:bg-[#064fc4]">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {label}
      </Button>
    </div>
  );
}

function FutureOutputCard({ rows }: { rows: string[][] }) {
  return (
    <Card className="gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none">
      <CardHeader className="p-0"><SectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
      <CardContent className="p-3">
        <div className="space-y-1.5">
          {rows.map(([source, output]) => (
            <div key={`${source}-${output}`} className="flex items-center gap-2 text-[10px]">
              <Badge variant="outline" className="border-[#075eea]/20 bg-[#075eea]/10 text-[8px] text-[#075eea]">{source}</Badge>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-muted-foreground">{output}</span>
            </div>
          ))}
          <p className="pt-1 text-[9px] text-muted-foreground/70">Informational only. This panel does not generate content or write to discontinued document tooling.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function hasText(...values: string[]): boolean {
  return values.some(value => value.trim().length > 0);
}

function scenarioHasContent(row: PricingScenariosData["rows"][number]): boolean {
  return hasText(
    row.scenario_name, row.linked_pnl_snapshot_reference, row.revenue, row.cost,
    row.gp_percent, row.target_gp_percent, row.variance, row.operational_assumption,
    row.commercial_risk, row.notes,
  ) || row.recommended !== "Not Assessed";
}

function sanitizeScenarios(data: PricingScenariosData): PricingScenariosData {
  const rows = data.rows.filter(scenarioHasContent);
  const selectedStillExists = rows.some(row => row.id === data.selected_scenario.selected_scenario_id);
  const selected_scenario = selectedStillExists
    ? data.selected_scenario
    : { selected_scenario_id: "", selected_scenario_name: "", reason_for_selection: data.selected_scenario.reason_for_selection, approval_required: data.selected_scenario.approval_required };
  return { ...data, rows, selected_scenario, summary: calculatePricingScenarioSummary({ rows, selected_scenario }) };
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

// ═══════════════════════════════════════════════════════════
// Stage Menu Components (shared)
// ═══════════════════════════════════════════════════════════

function StageMenuHeader({
  stageIntelOpen, setStageIntelOpen, intelContent, tabs, activeSection, setActiveSection, onOpenDocuments, onOpenGlobalIntel,
}: {
  stageIntelOpen: boolean;
  setStageIntelOpen: (v: boolean) => void;
  intelContent?: ReactNode;
  tabs: { key: string; label: string; icon: ReactNode }[];
  activeSection: string;
  setActiveSection: (k: any) => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
      <CardContent className="p-0">
        <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">P&L / Pricing Stage Menu</span>
            <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">Stage 5</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onOpenDocuments && (
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                <FolderOpen className="w-3.5 h-3.5" />Open Documents
              </Button>
            )}
            {onOpenGlobalIntel && (
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                <BarChart3 className="w-3.5 h-3.5" />Global Intelligence
              </Button>
            )}
            <Button type="button" variant="outline" size="sm"
              className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${stageIntelOpen ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white" : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"}`}
              onClick={() => setStageIntelOpen(!stageIntelOpen)}>
              <PanelRightOpen className="w-3.5 h-3.5" />{stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
            </Button>
          </div>
        </div>
        {stageIntelOpen && (
          <>
            {intelContent}
            <div className="border-b border-border bg-card px-4 pb-4">
              <TenderStageIntelligenceSlot />
            </div>
          </>
        )}
        <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
          {tabs.map(section => (
            <button key={section.key} type="button" onClick={() => setActiveSection(section.key)}
              className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${activeSection === section.key ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]" : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"}`}>
              <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
              <span className="block whitespace-normal text-center">{section.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string | number }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left group">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge !== undefined && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════

function usePricingSave<T extends Record<string, any>>(
  tenderId: string, section: TenderPricingSectionKey, label: string,
  data: T, markSaved: (next: T) => void, reload: () => void,
) {
  const [saving, setSaving] = useState(false);
  const save = async (payload: T = data) => {
    setSaving(true);
    try {
      const result = await updateTenderPricingData(tenderId, section, payload, `${label} saved`);
      if (result.success) { markSaved(payload); toast.success(`${label} saved`); reload(); }
      else { toast.error("Save failed", { description: result.error }); }
    } finally { setSaving(false); }
  };
  return { saving, save };
}

// ═══════════════════════════════════════════════════════════
// Pricing Scenarios Tab — 4 section tabs
// ═══════════════════════════════════════════════════════════

type ScenarioSectionKey = "register" | "selected" | "comparison" | "future";
const SCENARIO_TABS: { key: ScenarioSectionKey; label: string; icon: ReactNode }[] = [
  { key: "register", label: "Scenario Register", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "selected", label: "Selected Scenario", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "comparison", label: "Comparison Summary", icon: <Info className="w-3.5 h-3.5" /> },
  { key: "future", label: "Output Use", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

function PricingScenariosTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; reload: () => void; onOpenDocuments: () => void; onOpenGlobalIntel?: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<PricingScenariosData>(pricing.scenarios);
  const { saving, save } = usePricingSave(ws.tender.id, "scenarios", "Pricing Scenarios", data as any, markSaved as any, reload);
  const summary = calculatePricingScenarioSummary(data);
  const [activeSection, setActiveSection] = useState<ScenarioSectionKey>("register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const setRows = (rows: PricingScenariosData["rows"]) => setData(prev => ({ ...prev, rows, summary: calculatePricingScenarioSummary({ ...prev, rows }) }));
  const updateRow = (index: number, patch: Partial<PricingScenariosData["rows"][number]>) => setRows(data.rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const removeRow = (index: number) => setRows(data.rows.filter((_, i) => i !== index));
  const payload = { ...data, summary };
  const handleSave = () => { const sanitized = sanitizeScenarios(payload); setData(sanitized); save(sanitized as any); };

  return (
    <div className="space-y-4">
      <StageMenuHeader
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen}
        onOpenDocuments={onOpenDocuments}
        onOpenGlobalIntel={onOpenGlobalIntel}
        intelContent={
          <div className="grid gap-3 border-b border-border bg-card p-4 sm:grid-cols-4">
            <StageIntelMetric label="Scenarios" value={`${data.rows.length}`} />
            <StageIntelMetric label="Selected" value={data.selected_scenario.selected_scenario_name || "None"} />
            <StageIntelMetric label="Highest GP" value={summary.highest_gp_percent || "N/A"} />
            <StageIntelMetric label="Below Target" value={`${summary.scenarios_below_target_gp}`} />
          </div>
        }
        tabs={SCENARIO_TABS} activeSection={activeSection} setActiveSection={setActiveSection}
      />

      <div className="p-4 space-y-4">
      {/* Register */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "register" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Scenario Register" icon={<BarChart3 className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${data.rows.length} scenarios`} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          {data.rows.length === 0 ? <EmptyState>No pricing scenarios captured yet.</EmptyState> : (
            <div className="space-y-3">
              {data.rows.map((row, index) => (
                <div key={row.id} className="relative rounded-lg border border-border p-3">
                  <button type="button" className="absolute right-2 top-2 text-muted-foreground hover:text-red-600" onClick={() => removeRow(index)}><Trash2 className="h-3.5 w-3.5" /></button>
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
          <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => setRows([...data.rows, emptyPricingScenario()])}><Plus className="h-3 w-3" /> Add Pricing Scenario</Button>
        </CardContent>
      </Card>

      {/* Selected */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "selected" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Selected Scenario" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected Scenario</label>
              <select value={data.selected_scenario.selected_scenario_id} onChange={event => { const selected = data.rows.find(row => row.id === event.target.value); setData(prev => ({ ...prev, selected_scenario: { ...prev.selected_scenario, selected_scenario_id: event.target.value, selected_scenario_name: selected?.scenario_name ?? "" } })); }} className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs">
                <option value="">Not Selected</option>
                {data.rows.map(row => <option key={row.id} value={row.id}>{row.scenario_name || "Unnamed scenario"}</option>)}
              </select>
            </div>
            <SelectField label="Approval Required" value={data.selected_scenario.approval_required} options={YES_NO_NOT_ASSESSED_OPTIONS} onChange={value => updateNested(setData, "selected_scenario", { approval_required: value })} />
            <TextField label="Selected Scenario Name" value={data.selected_scenario.selected_scenario_name} onChange={value => updateNested(setData, "selected_scenario", { selected_scenario_name: value })} />
          </div>
          <TextAreaField label="Reason for Selection" value={data.selected_scenario.reason_for_selection} onChange={value => updateNested(setData, "selected_scenario", { reason_for_selection: value })} />
        </CardContent>
      </Card>

      {/* Comparison */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "comparison" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Scenario Comparison Summary" icon={<Info className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4">
          {data.rows.length === 0 ? <EmptyState>No pricing scenarios captured yet.</EmptyState> : (
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
        </CardContent>
      </Card>

      {/* Future */}
      <div className={activeSection !== "future" ? "hidden" : ""}><FutureOutputCard rows={FUTURE_OUTPUT.scenarios} /></div>

      <SaveFooter dirty={dirty} saving={saving} onSave={handleSave} label="Save Pricing Scenarios" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Commercial Terms Tab — 8 section tabs
// ═══════════════════════════════════════════════════════════

type CommercialSectionKey = "payment" | "mobilization" | "insurance" | "surcharges" | "responsibilities" | "exclusions" | "assumptions" | "future";
const COMMERCIAL_TABS: { key: CommercialSectionKey; label: string; icon: ReactNode }[] = [
  { key: "payment", label: "Payment / Tax", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "mobilization", label: "Mobilization", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "insurance", label: "Insurance", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { key: "surcharges", label: "Surcharges", icon: <Plus className="w-3.5 h-3.5" /> },
  { key: "responsibilities", label: "Responsibilities", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "exclusions", label: "Exclusions", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "assumptions", label: "Assumptions", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "future", label: "Output", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

function CommercialTermsTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; reload: () => void; onOpenDocuments: () => void; onOpenGlobalIntel?: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<CommercialTermsData>(pricing.commercial_terms);
  const { saving, save } = usePricingSave(ws.tender.id, "commercial_terms", "Commercial Terms", data as any, markSaved as any, reload);
  const [activeSection, setActiveSection] = useState<CommercialSectionKey>("payment");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const updateArray = <T extends { id: string }>(key: keyof CommercialTermsData, rows: T[]) => setData(prev => ({ ...prev, [key]: rows }));
  const updateArrayRow = <T extends { id: string }>(key: keyof CommercialTermsData, index: number, patch: Partial<T>) => {
    const rows = data[key] as unknown as T[];
    updateArray(key, rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  };
  const removeArrayRow = <T extends { id: string }>(key: keyof CommercialTermsData, index: number) => {
    const rows = data[key] as unknown as T[];
    updateArray(key, rows.filter((_, i) => i !== index));
  };
  const handleSave = () => { const sanitized = sanitizeCommercialTerms(data); setData(sanitized); save(sanitized as any); };

  return (
    <div className="space-y-4">
      <StageMenuHeader
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen}
        onOpenDocuments={onOpenDocuments}
        onOpenGlobalIntel={onOpenGlobalIntel}
        intelContent={
          <div className="grid gap-3 border-b border-border bg-card p-4 sm:grid-cols-4">
            <StageIntelMetric label="Payment Terms" value={data.payment_tax_validity.payment_terms} />
            <StageIntelMetric label="Surcharges" value={`${data.surcharges.length}`} />
            <StageIntelMetric label="Exclusions" value={`${data.exclusions.length}`} />
            <StageIntelMetric label="Assumptions" value={`${data.assumptions.length}`} />
          </div>
        }
        tabs={COMMERCIAL_TABS} activeSection={activeSection} setActiveSection={setActiveSection}
      />

      <div className="p-4 space-y-4">
      {/* Payment / Tax / Validity */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "payment" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Payment / Tax / Validity" icon={<DollarSign className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Payment Terms" value={data.payment_tax_validity.payment_terms} options={PAYMENT_TERMS_OPTIONS} onChange={value => updateNested(setData, "payment_tax_validity", { payment_terms: value })} />
            <SelectField label="VAT Treatment" value={data.payment_tax_validity.vat_treatment} options={VAT_TREATMENT_OPTIONS} onChange={value => updateNested(setData, "payment_tax_validity", { vat_treatment: value })} />
            <TextField label="VAT %" value={data.payment_tax_validity.vat_percent} onChange={value => updateNested(setData, "payment_tax_validity", { vat_percent: value })} />
            <TextField label="Proposal Validity" value={data.payment_tax_validity.proposal_validity} onChange={value => updateNested(setData, "payment_tax_validity", { proposal_validity: value })} />
            <TextField label="Contract Term" value={data.payment_tax_validity.contract_term} onChange={value => updateNested(setData, "payment_tax_validity", { contract_term: value })} />
            <TextField label="Extension Option" value={data.payment_tax_validity.extension_option} onChange={value => updateNested(setData, "payment_tax_validity", { extension_option: value })} />
          </div>
        </CardContent>
      </Card>

      {/* Mobilization */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "mobilization" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Mobilization / Notice / Forecast" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <TextField label="Mobilization Period" value={data.mobilization_notice_forecast.mobilization_period} onChange={value => updateNested(setData, "mobilization_notice_forecast", { mobilization_period: value })} />
            <TextField label="Movement Notice Period" value={data.mobilization_notice_forecast.movement_notice_period} onChange={value => updateNested(setData, "mobilization_notice_forecast", { movement_notice_period: value })} />
            <TextField label="Forecast Notice Period" value={data.mobilization_notice_forecast.forecast_notice_period} onChange={value => updateNested(setData, "mobilization_notice_forecast", { forecast_notice_period: value })} />
            <TextField label="ASN Requirement" value={data.mobilization_notice_forecast.asn_requirement} onChange={value => updateNested(setData, "mobilization_notice_forecast", { asn_requirement: value })} />
            <TextField label="Customer Forecast Responsibility" value={data.mobilization_notice_forecast.customer_forecast_responsibility} onChange={value => updateNested(setData, "mobilization_notice_forecast", { customer_forecast_responsibility: value })} />
          </div>
          <TextAreaField label="Notes" value={data.mobilization_notice_forecast.notes} onChange={value => updateNested(setData, "mobilization_notice_forecast", { notes: value })} />
        </CardContent>
      </Card>

      {/* Insurance */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "insurance" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Insurance / Liability" icon={<ShieldAlert className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Insurance Treatment" value={data.insurance_liability.insurance_treatment} options={INSURANCE_TREATMENT_OPTIONS} onChange={value => updateNested(setData, "insurance_liability", { insurance_treatment: value })} />
            <TextField label="Coverage Limit" value={data.insurance_liability.coverage_limit} onChange={value => updateNested(setData, "insurance_liability", { coverage_limit: value })} />
            <TextField label="Force Majeure Treatment" value={data.insurance_liability.force_majeure_treatment} onChange={value => updateNested(setData, "insurance_liability", { force_majeure_treatment: value })} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextAreaField label="Liability Notes" value={data.insurance_liability.liability_notes} onChange={value => updateNested(setData, "insurance_liability", { liability_notes: value })} />
            <TextAreaField label="Damage Responsibility Notes" value={data.insurance_liability.damage_responsibility_notes} onChange={value => updateNested(setData, "insurance_liability", { damage_responsibility_notes: value })} />
          </div>
        </CardContent>
      </Card>

      {/* Surcharges */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "surcharges" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Surcharges / Additional Charges" icon={<Plus className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.surcharges.length} /></CardHeader>
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Customer Responsibilities */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "responsibilities" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Customer Responsibilities" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.customer_responsibilities.length} /></CardHeader>
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Exclusions */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "exclusions" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Exclusions" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.exclusions.length} /></CardHeader>
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Commercial Assumptions */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "assumptions" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Commercial Assumptions" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.assumptions.length} /></CardHeader>
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Future */}
      <div className={activeSection !== "future" ? "hidden" : ""}><FutureOutputCard rows={FUTURE_OUTPUT.commercial_terms} /></div>

      <SaveFooter dirty={dirty} saving={saving} onSave={handleSave} label="Save Commercial Terms" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Pricing Approval Tab — 5 section tabs
// ═══════════════════════════════════════════════════════════

type ApprovalSectionKey = "summary" | "chain" | "checks" | "conditions" | "future";
const APPROVAL_TABS: { key: ApprovalSectionKey; label: string; icon: ReactNode }[] = [
  { key: "summary", label: "Approval Summary", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "chain", label: "Approval Chain", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { key: "checks", label: "Approval Checks", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "conditions", label: "Conditions", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: "future", label: "Output", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

function PricingApprovalTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: { ws: TenderWorkspace; reload: () => void; onOpenDocuments: () => void; onOpenGlobalIntel?: () => void }) {
  const pricing = useMemo(() => normalizeTenderPricingData(ws.tender.pricingData), [ws.tender.pricingData]);
  const { data, setData, dirty, markSaved } = useSectionForm<PricingApprovalData>(pricing.approval);
  const { saving, save } = usePricingSave(ws.tender.id, "approval", "Pricing Approval", data as any, markSaved as any, reload);
  const [activeSection, setActiveSection] = useState<ApprovalSectionKey>("summary");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const updateChain = (rows: ApprovalChainRow[]) => setData(prev => ({ ...prev, approval_chain: rows }));
  const updateChecks = (rows: ApprovalCheckRow[]) => setData(prev => ({ ...prev, approval_checks: rows }));
  const updateConditions = (rows: ApprovalConditionRow[]) => setData(prev => ({ ...prev, conditions: rows }));
  const handleSave = () => { const sanitized = sanitizeApproval(data); setData(sanitized); save(sanitized as any); };

  return (
    <div className="space-y-4">
      <StageMenuHeader
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen}
        onOpenDocuments={onOpenDocuments}
        onOpenGlobalIntel={onOpenGlobalIntel}
        intelContent={
          <div className="grid gap-3 border-b border-border bg-card p-4 sm:grid-cols-4">
            <StageIntelMetric label="Status" value={data.summary.approval_status} />
            <StageIntelMetric label="Chain" value={`${data.approval_chain.length} roles`} />
            <StageIntelMetric label="Checks" value={`${data.approval_checks.length}`} />
            <StageIntelMetric label="Conditions" value={`${data.conditions.length}`} />
          </div>
        }
        tabs={APPROVAL_TABS} activeSection={activeSection} setActiveSection={setActiveSection}
      />

      <div className="p-4 space-y-4">
      {/* Approval Summary */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "summary" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Approval Summary" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Approval Status" value={data.summary.approval_status} options={PRICING_APPROVAL_STATUS_OPTIONS} onChange={value => updateNested(setData, "summary", { approval_status: value })} />
            <TextField label="Approval Level Required" value={data.summary.approval_level_required} onChange={value => updateNested(setData, "summary", { approval_level_required: value })} />
            <TextField label="Current Approver" value={data.summary.current_approver} onChange={value => updateNested(setData, "summary", { current_approver: value })} />
            <TextField label="Submitted Date" type="date" value={data.summary.submitted_date} onChange={value => updateNested(setData, "summary", { submitted_date: value })} />
            <TextField label="Approved Date" type="date" value={data.summary.approved_date} onChange={value => updateNested(setData, "summary", { approved_date: value })} />
          </div>
          <TextAreaField label="Rejection / Revision Reason" value={data.summary.rejection_revision_reason} onChange={value => updateNested(setData, "summary", { rejection_revision_reason: value })} />
        </CardContent>
      </Card>

      {/* Approval Chain */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "chain" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Approval Chain" icon={<ShieldAlert className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.approval_chain.length} /></CardHeader>
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Approval Checks */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "checks" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Approval Checks" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.approval_checks.length} /></CardHeader>
        <CardContent className="p-4 space-y-2">
          {data.approval_checks.map((row, index) => (
            <div key={row.id} className="grid gap-2 rounded-md border border-border p-2 md:grid-cols-[1.4fr_0.7fr_1.4fr_0.8fr]">
              <TextField label="Check" value={row.check} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, check: value } : r))} />
              <SelectField label="Status" value={row.status} options={APPROVAL_CHECK_STATUS_OPTIONS} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, status: value } : r))} />
              <TextField label="Evidence / Notes" value={row.evidence_notes} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, evidence_notes: value } : r))} />
              <TextField label="Owner" value={row.owner} onChange={value => updateChecks(data.approval_checks.map((r, i) => i === index ? { ...r, owner: value } : r))} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Approval Conditions */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "conditions" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Approval Conditions" icon={<AlertTriangle className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.conditions.length} /></CardHeader>
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Future */}
      <div className={activeSection !== "future" ? "hidden" : ""}><FutureOutputCard rows={FUTURE_OUTPUT.approval} /></div>

      <SaveFooter dirty={dirty} saving={saving} onSave={handleSave} label="Save Pricing Approval" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════

export default function PnlPricingStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  if (activeTab === "pricing_scenarios") return <PricingScenariosTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "commercial_terms") return <CommercialTermsTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  if (activeTab === "pricing_approval") return <PricingApprovalTab ws={ws} reload={reload} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;
  return <EmptyState>No P&L / Pricing view configured for this tab.</EmptyState>;
}
