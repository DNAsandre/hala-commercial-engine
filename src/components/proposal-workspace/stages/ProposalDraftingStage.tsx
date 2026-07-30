import { Archive, BookOpen, ClipboardList, FileText, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldInput, FieldRow, FieldSelect, FieldTextarea, Section } from "../ui-primitives";
import type {
  ProposalAppendixNotes,
  ProposalCommercialVolume,
  ProposalDraftBlock,
  ProposalEvidenceItem,
  ProposalFinalDraftReview,
  ProposalSourceMapItem,
  ProposalTechnicalVolume,
  ProposalTocSection,
} from "../proposal-workspace-state";

const VOLUME_OPTIONS = [
  { value: "technical", label: "Technical" },
  { value: "commercial", label: "Commercial" },
  { value: "shared", label: "Shared" },
  { value: "appendix", label: "Appendix" },
];

const STAGE_OPTIONS = [
  { value: "qualified", label: "Qualified" },
  { value: "discovery", label: "Discovery" },
  { value: "solution_design", label: "Solution Design" },
  { value: "pnl_pricing", label: "P&L / Pricing" },
  { value: "quote", label: "Quote" },
  { value: "proposal_drafting", label: "Proposal Drafting" },
];

const BLOCK_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "drafting", label: "Drafting" },
  { value: "reviewing", label: "Reviewing" },
  { value: "ready", label: "Ready" },
];

function countFilled(values: unknown[]): number {
  return values.filter(value => {
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return Boolean(value);
  }).length;
}

function sectionLabel(sections: ProposalTocSection[], sectionId: string): string {
  return sections.find(section => section.id === sectionId)?.sectionTitle || "No section linked";
}

export function TocPlannerTab({
  data,
  onChange,
}: {
  data: ProposalTocSection[];
  onChange: (d: ProposalTocSection[]) => void;
}) {
  const add = () => onChange([
    ...data,
    {
      id: `toc-${Date.now()}`,
      sectionTitle: "",
      volume: "",
      purpose: "",
      sourceStage: "",
      includeInProposal: true,
      notes: "",
    },
  ]);
  const update = (index: number, patch: Partial<ProposalTocSection>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">TOC Planner</span>
          <Badge variant="outline" className="text-[9px]">{data.length} sections</Badge>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Section</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No proposal sections captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((section, index) => (
            <div key={section.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_150px_160px_92px_32px]">
                <FieldInput value={section.sectionTitle} onChange={v => update(index, { sectionTitle: v })} placeholder="Section title" />
                <FieldSelect value={section.volume} onChange={v => update(index, { volume: v })} options={VOLUME_OPTIONS} placeholder="Volume" />
                <FieldSelect value={section.sourceStage} onChange={v => update(index, { sourceStage: v })} options={STAGE_OPTIONS} placeholder="Source stage" />
                <label className="flex h-9 items-center gap-2 rounded-md border border-border px-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={section.includeInProposal} onChange={e => update(index, { includeInProposal: e.target.checked })} />
                  Include
                </label>
                <button type="button" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <FieldTextarea value={section.purpose} onChange={v => update(index, { purpose: v })} placeholder="Purpose of this proposal section" rows={2} />
                <FieldTextarea value={section.notes} onChange={v => update(index, { notes: v })} placeholder="Planning notes" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourceMapTab({
  data,
  tocSections,
  onChange,
}: {
  data: ProposalSourceMapItem[];
  tocSections: ProposalTocSection[];
  onChange: (d: ProposalSourceMapItem[]) => void;
}) {
  const sectionOptions = tocSections.map(section => ({ value: section.id, label: section.sectionTitle || "Untitled section" }));
  const add = () => onChange([
    ...data,
    {
      id: `source-map-${Date.now()}`,
      sourceStage: "",
      sourceTab: "",
      sourceField: "",
      targetSectionId: "",
      usageNotes: "",
    },
  ]);
  const update = (index: number, patch: Partial<ProposalSourceMapItem>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Source Map</span>
          <Badge variant="outline" className="text-[9px]">{data.length} mappings</Badge>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Mapping</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No source mappings captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((mapping, index) => (
            <div key={mapping.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[150px_1fr_1fr_1fr_32px]">
                <FieldSelect value={mapping.sourceStage} onChange={v => update(index, { sourceStage: v })} options={STAGE_OPTIONS} placeholder="Source stage" />
                <FieldInput value={mapping.sourceTab} onChange={v => update(index, { sourceTab: v })} placeholder="Source tab / task" />
                <FieldInput value={mapping.sourceField} onChange={v => update(index, { sourceField: v })} placeholder="Source field" />
                <FieldSelect value={mapping.targetSectionId} onChange={v => update(index, { targetSectionId: v })} options={sectionOptions} placeholder="Target section" />
                <button type="button" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <FieldTextarea value={mapping.usageNotes} onChange={v => update(index, { usageNotes: v })} placeholder="How this source should be used in the proposal" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlockRegisterTab({
  data,
  tocSections,
  onChange,
}: {
  data: ProposalDraftBlock[];
  tocSections: ProposalTocSection[];
  onChange: (d: ProposalDraftBlock[]) => void;
}) {
  const sectionOptions = tocSections.map(section => ({ value: section.id, label: section.sectionTitle || "Untitled section" }));
  const add = () => onChange([
    ...data,
    {
      id: `block-${Date.now()}`,
      sectionId: "",
      blockTitle: "",
      volume: "",
      owner: "",
      status: "",
      sourceRefs: "",
      content: "",
    },
  ]);
  const update = (index: number, patch: Partial<ProposalDraftBlock>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Block Register</span>
          <Badge variant="outline" className="text-[9px]">{data.length} blocks</Badge>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Block</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No proposal blocks captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((block, index) => (
            <div key={block.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_1fr_140px_140px_110px_32px]">
                <FieldInput value={block.blockTitle} onChange={v => update(index, { blockTitle: v })} placeholder="Block title" />
                <FieldSelect value={block.sectionId} onChange={v => update(index, { sectionId: v })} options={sectionOptions} placeholder="Section" />
                <FieldSelect value={block.volume} onChange={v => update(index, { volume: v })} options={VOLUME_OPTIONS} placeholder="Volume" />
                <FieldInput value={block.owner} onChange={v => update(index, { owner: v })} placeholder="Owner" />
                <FieldSelect value={block.status} onChange={v => update(index, { status: v })} options={BLOCK_STATUS_OPTIONS} placeholder="Status" />
                <button type="button" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                <FieldTextarea value={block.sourceRefs} onChange={v => update(index, { sourceRefs: v })} placeholder="Source references for this block" rows={2} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlockEditorTab({
  data,
  tocSections,
  onChange,
}: {
  data: ProposalDraftBlock[];
  tocSections: ProposalTocSection[];
  onChange: (d: ProposalDraftBlock[]) => void;
}) {
  const update = (index: number, patch: Partial<ProposalDraftBlock>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Block Editor</span>
        <Badge variant="outline" className="text-[9px]">{data.length} blocks</Badge>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          Create blocks in the Block Register first.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((block, index) => (
            <Section
              key={block.id}
              title={block.blockTitle || "Untitled block"}
              badge={<Badge variant="outline" className="text-[9px]">{sectionLabel(tocSections, block.sectionId)}</Badge>}
              defaultOpen={index === 0}
              icon={<FileText className="h-4 w-4 text-[#075eea]" />}
            >
              <FieldRow label="Block Content">
                <FieldTextarea value={block.content} onChange={v => update(index, { content: v })} placeholder="Human-written proposal block content" rows={7} />
              </FieldRow>
              <FieldRow label="Source Refs">
                <FieldTextarea value={block.sourceRefs} onChange={v => update(index, { sourceRefs: v })} placeholder="Source references used by this block" rows={2} />
              </FieldRow>
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourceInspectorTab({
  tocSections,
  sourceMap,
  blocks,
  carryForward,
}: {
  tocSections: ProposalTocSection[];
  sourceMap: ProposalSourceMapItem[];
  blocks: ProposalDraftBlock[];
  carryForward: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Source Inspector</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Sections</p>
          <p className="mt-1 text-sm font-semibold">{tocSections.length}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Mappings</p>
          <p className="mt-1 text-sm font-semibold">{sourceMap.length}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Blocks</p>
          <p className="mt-1 text-sm font-semibold">{blocks.length}</p>
        </div>
      </div>
      <Section title="Previous Stage Carry-Forward" defaultOpen icon={<Search className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-2 md:grid-cols-2">
          {carryForward.map(item => (
            <div key={item.label} className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{item.value || "Not captured yet."}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function TechnicalOperationalVolumeTab({
  data,
  onChange,
}: {
  data: ProposalTechnicalVolume;
  onChange: (d: ProposalTechnicalVolume) => void;
}) {
  const update = (field: keyof ProposalTechnicalVolume, value: string) => onChange({ ...data, [field]: value });
  const captured = countFilled(Object.values(data));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Technical / Operational Volume</span>
        <Badge variant="outline" className="text-[9px]">{captured}/6 captured</Badge>
      </div>
      <Section title="Technical Content" defaultOpen icon={<BookOpen className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Solution Overview"><FieldTextarea value={data.solutionOverview} onChange={v => update("solutionOverview", v)} placeholder="Operational solution overview" rows={3} /></FieldRow>
        <FieldRow label="Warehouse Ops"><FieldTextarea value={data.warehouseOperations} onChange={v => update("warehouseOperations", v)} placeholder="Warehouse model, handling, capacity, and service approach" rows={3} /></FieldRow>
        <FieldRow label="Transport Ops"><FieldTextarea value={data.transportOperations} onChange={v => update("transportOperations", v)} placeholder="Transport model, lanes, vehicles, frequency, and routing approach" rows={3} /></FieldRow>
        <FieldRow label="Systems"><FieldTextarea value={data.systemsVisibility} onChange={v => update("systemsVisibility", v)} placeholder="WMS/TMS/reporting/visibility approach" rows={3} /></FieldRow>
        <FieldRow label="Service Levels"><FieldTextarea value={data.serviceLevels} onChange={v => update("serviceLevels", v)} placeholder="Service levels, KPI references, and operating windows" rows={3} /></FieldRow>
        <FieldRow label="Implementation"><FieldTextarea value={data.implementationNotes} onChange={v => update("implementationNotes", v)} placeholder="Implementation, mobilization, and transition notes" rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function CommercialVolumeTab({
  data,
  onChange,
}: {
  data: ProposalCommercialVolume;
  onChange: (d: ProposalCommercialVolume) => void;
}) {
  const update = (field: keyof ProposalCommercialVolume, value: string) => onChange({ ...data, [field]: value });
  const captured = countFilled(Object.values(data));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Commercial Volume</span>
        <Badge variant="outline" className="text-[9px]">{captured}/5 captured</Badge>
      </div>
      <Section title="Commercial Content" defaultOpen icon={<FileText className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Pricing"><FieldTextarea value={data.pricingNarrative} onChange={v => update("pricingNarrative", v)} placeholder="Pricing narrative and commercial model summary" rows={3} /></FieldRow>
        <FieldRow label="Terms"><FieldTextarea value={data.commercialTerms} onChange={v => update("commercialTerms", v)} placeholder="Payment, validity, VAT, duration, and other commercial terms" rows={3} /></FieldRow>
        <FieldRow label="Assumptions"><FieldTextarea value={data.assumptionsExclusions} onChange={v => update("assumptionsExclusions", v)} placeholder="Assumptions, exclusions, dependencies, and limitations" rows={3} /></FieldRow>
        <FieldRow label="Value"><FieldTextarea value={data.valueNarrative} onChange={v => update("valueNarrative", v)} placeholder="Hala value narrative for this proposal" rows={3} /></FieldRow>
        <FieldRow label="Risk Notes"><FieldTextarea value={data.riskNotes} onChange={v => update("riskNotes", v)} placeholder="Commercial risks and notes to review before sending" rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function EvidenceRegisterTab({
  data,
  tocSections,
  onChange,
}: {
  data: ProposalEvidenceItem[];
  tocSections: ProposalTocSection[];
  onChange: (d: ProposalEvidenceItem[]) => void;
}) {
  const sectionOptions = tocSections.map(section => ({ value: section.id, label: section.sectionTitle || "Untitled section" }));
  const add = () => onChange([
    ...data,
    {
      id: `evidence-${Date.now()}`,
      evidenceTitle: "",
      evidenceType: "",
      sourceStage: "",
      linkedSectionId: "",
      documentRef: "",
      notes: "",
    },
  ]);
  const update = (index: number, patch: Partial<ProposalEvidenceItem>) => onChange(data.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(data.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-[#075eea]" />
          <span className="text-sm font-semibold">Evidence Register</span>
          <Badge variant="outline" className="text-[9px]">{data.length} items</Badge>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}><Plus className="h-3 w-3" />Add Evidence</Button>
      </div>
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
          No evidence items captured yet.
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 lg:grid-cols-[1fr_130px_150px_1fr_32px]">
                <FieldInput value={item.evidenceTitle} onChange={v => update(index, { evidenceTitle: v })} placeholder="Evidence title" />
                <FieldInput value={item.evidenceType} onChange={v => update(index, { evidenceType: v })} placeholder="Type" />
                <FieldSelect value={item.sourceStage} onChange={v => update(index, { sourceStage: v })} options={STAGE_OPTIONS} placeholder="Source stage" />
                <FieldSelect value={item.linkedSectionId} onChange={v => update(index, { linkedSectionId: v })} options={sectionOptions} placeholder="Linked section" />
                <button type="button" onClick={() => remove(index)} className="flex h-9 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <FieldInput value={item.documentRef} onChange={v => update(index, { documentRef: v })} placeholder="Document reference" />
                <FieldInput value={item.notes} onChange={v => update(index, { notes: v })} placeholder="Evidence notes" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppendixNotesTab({
  data,
  onChange,
}: {
  data: ProposalAppendixNotes;
  onChange: (d: ProposalAppendixNotes) => void;
}) {
  const update = (field: keyof ProposalAppendixNotes, value: string) => onChange({ ...data, [field]: value });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Archive className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Appendix Notes</span>
      </div>
      <Section title="Appendix Planning" defaultOpen icon={<Archive className="h-4 w-4 text-[#075eea]" />}>
        <FieldRow label="Appendix Plan"><FieldTextarea value={data.appendixPlan} onChange={v => update("appendixPlan", v)} placeholder="Appendix structure and supporting pack notes" rows={4} /></FieldRow>
        <FieldRow label="Evidence Gaps"><FieldTextarea value={data.evidenceGaps} onChange={v => update("evidenceGaps", v)} placeholder="Missing evidence or documents still needed" rows={3} /></FieldRow>
        <FieldRow label="Formatting"><FieldTextarea value={data.formattingNotes} onChange={v => update("formattingNotes", v)} placeholder="Formatting, branding, or assembly notes" rows={3} /></FieldRow>
      </Section>
    </div>
  );
}

export function FinalDraftReviewTab({
  data,
  onChange,
}: {
  data: ProposalFinalDraftReview;
  onChange: (d: ProposalFinalDraftReview) => void;
}) {
  const update = (field: keyof ProposalFinalDraftReview, value: string) => onChange({ ...data, [field]: value });
  const captured = countFilled(Object.values(data));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[#075eea]" />
        <span className="text-sm font-semibold">Final Draft Review</span>
        <Badge variant="outline" className="text-[9px]">{captured}/5 captured</Badge>
      </div>
      <Section title="Review Notes" defaultOpen icon={<ClipboardList className="h-4 w-4 text-[#075eea]" />}>
        <div className="grid gap-x-4 lg:grid-cols-2">
          <FieldRow label="Owner"><FieldInput value={data.reviewOwner} onChange={v => update("reviewOwner", v)} placeholder="Reviewer / owner" /></FieldRow>
          <FieldRow label="Review Date"><FieldInput type="date" value={data.reviewDate} onChange={v => update("reviewDate", v)} /></FieldRow>
        </div>
        <FieldRow label="Readiness"><FieldTextarea value={data.readinessNotes} onChange={v => update("readinessNotes", v)} placeholder="Draft readiness notes" rows={3} /></FieldRow>
        <FieldRow label="Open Issues"><FieldTextarea value={data.openIssues} onChange={v => update("openIssues", v)} placeholder="Open drafting issues to resolve" rows={3} /></FieldRow>
        <FieldRow label="Next Action"><FieldTextarea value={data.nextAction} onChange={v => update("nextAction", v)} placeholder="Next human action" rows={2} /></FieldRow>
      </Section>
    </div>
  );
}
