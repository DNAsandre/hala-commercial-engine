/**
 * ComplianceCoverageTab - Tab 5 of Tender Drafting
 *
 * Maps RFP requirements to proposal blocks and evidence/appendices.
 * Compliance Coverage does not create separate proposal content.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Save, Loader2, Plus, Trash2, Shield, BarChart3 } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";
import { TenderStageSectionCard, TenderStageTaskShell } from "./TenderStageTaskShell";

const COMPLIANCE_STATUSES = ["Not Started", "Drafted", "Covered", "Gap", "Clarification Required", "Not Applicable"];
const UNLINKED_BLOCK_VALUE = "__none__";

interface ComplianceRow {
  id: string;
  requirement_id: string;
  requirement_text: string;
  source_document: string;
  linked_block_id: string;
  linked_appendix_or_document_id: string;
  status: string;
  owner: string;
  notes: string;
}

type CompSectionKey = "summary" | "requirements";

const COMP_SECTION_TABS: { key: CompSectionKey; label: string; icon: ReactNode }[] = [
  { key: "summary", label: "Compliance Coverage Summary", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "requirements", label: "Compliance Requirements", icon: <Shield className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function ComplianceCoverageTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const saved = drafting.compliance_coverage ?? {};
  const blocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const [requirements, setRequirements] = useState<ComplianceRow[]>(() =>
    Array.isArray(saved.requirements) ? saved.requirements : []
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<CompSectionKey>("summary");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const addRow = () => {
    setRequirements(prev => [...prev, {
      id: nanoid(8),
      requirement_id: `REQ-${String(prev.length + 1).padStart(3, "0")}`,
      requirement_text: "",
      source_document: "",
      linked_block_id: "",
      linked_appendix_or_document_id: "",
      status: "Not Started",
      owner: "",
      notes: "",
    }]);
    setDirty(true);
  };

  const updateRow = (id: string, patch: Partial<ComplianceRow>) => {
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const removeRow = (id: string) => {
    setRequirements(prev => prev.filter(r => r.id !== id));
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // P2a threading + honest outcome; stale keeps the edited rows on screen.
      const res = await updateTenderDraftingData(tenderId, "compliance_coverage", { requirements }, "Compliance coverage updated", wsRevisionToken(ws));
      if (!reportSaveOutcome(res, "Compliance Coverage saved.")) return;
      setDirty(false);
      onSaved?.();
      reload();
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [requirements, tenderId, reload, onSaved, ws]);

  const summary = useMemo(() => ({
    total: requirements.length,
    covered: requirements.filter(r => r.status === "Covered").length,
    drafted: requirements.filter(r => r.status === "Drafted").length,
    gaps: requirements.filter(r => r.status === "Gap").length,
    clarification: requirements.filter(r => r.status === "Clarification Required").length,
    notApplicable: requirements.filter(r => r.status === "Not Applicable").length,
  }), [requirements]);

  const metrics = useMemo(() => [
    { label: "Total Requirements", value: String(summary.total) },
    { label: "Covered", value: String(summary.covered) },
    { label: "Gaps", value: String(summary.gaps) },
    { label: "Clarification", value: String(summary.clarification) },
  ], [summary.clarification, summary.covered, summary.gaps, summary.total]);

  const blockOptions = useMemo(
    () => blocks.map((b: any) => ({ id: b.id, label: `Section ${b.section_number || "?"} ${b.title || "Untitled"}` })),
    [blocks]
  );

  return (
    <TenderStageTaskShell
      stageTitle="Tender Drafting Stage Menu"
      stageBadge="Stage 6"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={COMP_SECTION_TABS}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      metrics={metrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={requirements.length > 0 && !dirty}
      unsaved={dirty}
    >
      <TenderStageSectionCard
        title="Compliance Coverage Summary"
        icon={<BarChart3 className="h-3.5 w-3.5 text-[#075eea]" />}
        badge={`${summary.covered}/${summary.total} covered`}
        hidden={activeSection !== "summary"}
      >
        <div className="grid gap-3 text-center sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            ["Total", summary.total],
            ["Covered", summary.covered],
            ["Drafted", summary.drafted],
            ["Gaps", summary.gaps],
            ["Clarification", summary.clarification],
            ["N/A", summary.notApplicable],
          ].map(([label, val]) => (
            <div key={label as string} className="rounded-md border border-border p-2">
              <p className="text-lg font-bold">{val}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </TenderStageSectionCard>

      <TenderStageSectionCard
        title="Compliance Requirements"
        icon={<Shield className="h-3.5 w-3.5 text-[#075eea]" />}
        badge={`${requirements.length} requirement${requirements.length !== 1 ? "s" : ""}`}
        hidden={activeSection !== "requirements"}
        actionSlot={(
          <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={addRow}>
            <Plus className="h-3 w-3" /> Add Requirement
          </Button>
        )}
      >
        {requirements.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No compliance requirements captured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="w-20 px-2 py-2 text-left font-semibold">Req ID</th>
                  <th className="px-2 py-2 text-left font-semibold">Requirement</th>
                  <th className="w-28 px-2 py-2 text-left font-semibold">Source Doc</th>
                  <th className="w-44 px-2 py-2 text-left font-semibold">Linked Block</th>
                  <th className="w-28 px-2 py-2 text-left font-semibold">Status</th>
                  <th className="w-20 px-2 py-2 text-left font-semibold">Owner</th>
                  <th className="w-8 px-2 py-2 text-center font-semibold">x</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-2 py-1.5">
                      <Input className="h-6 bg-transparent p-0 font-mono text-[10px]" value={r.requirement_id} onChange={e => updateRow(r.id, { requirement_id: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input className="h-6 bg-transparent p-0 text-[10px]" value={r.requirement_text} onChange={e => updateRow(r.id, { requirement_text: e.target.value })} placeholder="Requirement text" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input className="h-6 bg-transparent p-0 text-[10px]" value={r.source_document} onChange={e => updateRow(r.id, { source_document: e.target.value })} placeholder="e.g. RFP" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={r.linked_block_id || UNLINKED_BLOCK_VALUE} onValueChange={v => updateRow(r.id, { linked_block_id: v === UNLINKED_BLOCK_VALUE ? "" : v })}>
                        <SelectTrigger className="h-6 bg-transparent p-0 text-[10px]"><SelectValue placeholder="Link to block" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNLINKED_BLOCK_VALUE}>None</SelectItem>
                          {blockOptions.map((bo: any) => <SelectItem key={bo.id} value={bo.id}>{bo.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={r.status} onValueChange={v => updateRow(r.id, { status: v })}>
                        <SelectTrigger className="h-6 bg-transparent p-0 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{COMPLIANCE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input className="h-6 bg-transparent p-0 text-[10px]" value={r.owner} onChange={e => updateRow(r.id, { owner: e.target.value })} placeholder="-" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeRow(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TenderStageSectionCard>

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="hala-save-button h-9 gap-1.5 px-5 text-xs">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Compliance Coverage
        </Button>
      </div>
    </TenderStageTaskShell>
  );
}
