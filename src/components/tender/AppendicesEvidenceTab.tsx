/**
 * AppendicesEvidenceTab - Tab 6 of Tender Drafting
 *
 * Maps Tender Drafting documents to proposal blocks as evidence/appendices.
 * Evidence gaps tracker. Open Documents remains the only document upload/edit route.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { Save, Loader2, Plus, Trash2, FileText, AlertTriangle } from "lucide-react";
import { documentsForTenderStage, summarizeTenderDocuments, type TenderWorkspace, type TenderDocument } from "@/lib/tender-workspace-data";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";
import { TenderStageSectionCard, TenderStageTaskShell } from "./TenderStageTaskShell";

const GAP_STATUSES = ["Missing", "Requested", "Uploaded", "Needs Update", "Not Required"];
const UNLINKED_BLOCK_VALUE = "__none__";

interface EvidenceGap {
  id: string;
  missing_evidence: string;
  required_for: string;
  linked_block_id: string;
  linked_section: string;
  owner: string;
  due_date: string;
  status: string;
  notes: string;
}

type AppSectionKey = "register" | "gaps";

const APP_SECTION_TABS: { key: AppSectionKey; label: string; icon: ReactNode }[] = [
  { key: "register", label: "Evidence Register", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "gaps", label: "Evidence Gaps", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function AppendicesEvidenceTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const saved = drafting.appendices_evidence ?? {};
  const docs = useMemo(() => documentsForTenderStage(ws.documents ?? [], "tender_drafting"), [ws.documents]);
  const blocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const [gaps, setGaps] = useState<EvidenceGap[]>(() => Array.isArray(saved.evidence_gaps) ? saved.evidence_gaps : []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSectionKey>("register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const blockOptions = useMemo(
    () => blocks.map((b: any) => ({ id: b.id, label: `Section ${b.section_number || "?"} ${b.title || "Untitled"}` })),
    [blocks]
  );

  const addGap = () => {
    setGaps(prev => [...prev, { id: nanoid(8), missing_evidence: "", required_for: "", linked_block_id: "", linked_section: "", owner: "", due_date: "", status: "Missing", notes: "" }]);
    setDirty(true);
  };

  const updateGap = (id: string, patch: Partial<EvidenceGap>) => {
    setGaps(prev => prev.map(g => g.id === id ? { ...g, ...patch } : g));
    setDirty(true);
  };

  const removeGap = (id: string) => {
    setGaps(prev => prev.filter(g => g.id !== id));
    setDirty(true);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // P2a threading + honest outcome; stale keeps the edited rows on screen.
      const res = await updateTenderDraftingData(tenderId, "appendices_evidence", { evidence_gaps: gaps }, "Appendices & evidence updated", wsRevisionToken(ws));
      if (!reportSaveOutcome(res, "Appendices & Evidence saved.")) return;
      setDirty(false);
      onSaved?.();
      reload();
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [gaps, tenderId, reload, onSaved, ws]);

  const statusColor = (s: string) => {
    if (s === "Uploaded") return "border-emerald-200 text-emerald-600";
    if (s === "Missing") return "border-red-200 text-red-600";
    if (s === "Needs Update") return "border-amber-200 text-amber-600";
    if (s === "Requested") return "border-blue-200 text-blue-600";
    return "border-slate-200 text-slate-500";
  };

  const summary = useMemo(() => {
    const documentSummary = summarizeTenderDocuments(docs);
    return {
      total: documentSummary.total,
      uploaded: documentSummary.ready,
      missing: documentSummary.missing,
      required: documentSummary.required,
      gaps: gaps.length,
    };
  }, [docs, gaps]);

  const metrics = useMemo(() => [
    { label: "Total Documents", value: String(summary.total) },
    { label: "Uploaded", value: String(summary.uploaded) },
    { label: "Missing", value: String(summary.missing) },
    { label: "Required", value: String(summary.required) },
    { label: "Gaps", value: String(summary.gaps) },
  ], [summary.gaps, summary.missing, summary.required, summary.total, summary.uploaded]);

  return (
    <TenderStageTaskShell
      stageTitle="Tender Drafting Stage Menu"
      stageBadge="Stage 6"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={APP_SECTION_TABS}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      metrics={metrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      /* TCW-T4 (C3 tightening): green only when THIS tab's own register (the
         evidence-gap rows) is stored and clean — the presence of stage
         documents is not this tab's save state. */
      saved={gaps.length > 0 && !dirty}
      unsaved={dirty}
    >
      <TenderStageSectionCard
        title="Evidence Register"
        icon={<FileText className="h-3.5 w-3.5 text-[#075eea]" />}
        badge={`${docs.length} stage document${docs.length !== 1 ? "s" : ""}`}
        hidden={activeSection !== "register"}
      >
        {docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No documents linked to Tender Drafting yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">Document</th>
                  <th className="px-2 py-2 text-left font-semibold">Type</th>
                  <th className="px-2 py-2 text-left font-semibold">Category</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                  <th className="px-2 py-2 text-left font-semibold">Expiry</th>
                  <th className="px-2 py-2 text-left font-semibold">Required</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d: TenderDocument) => (
                  <tr key={d.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-2 py-1.5 font-medium">{d.document_name}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{d.document_type || "-"}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{d.document_category || "-"}</td>
                    <td className="px-2 py-1.5"><Badge variant="outline" className={`text-[8px] ${statusColor(d.status)}`}>{d.status}</Badge></td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{d.expiry_date || "-"}</td>
                    <td className="px-2 py-1.5">{d.required_for_submission ? <Badge variant="outline" className="border-amber-200 text-[8px] text-amber-600">Required</Badge> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TenderStageSectionCard>

      <TenderStageSectionCard
        title="Evidence Gaps"
        icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
        badge={String(gaps.length)}
        hidden={activeSection !== "gaps"}
        actionSlot={(
          <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={addGap}>
            <Plus className="h-3 w-3" /> Add Gap
          </Button>
        )}
      >
        {gaps.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No evidence gaps recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {gaps.map(g => (
              <div key={g.id} className="grid items-start gap-2 rounded-md border border-border p-2 sm:grid-cols-2 xl:grid-cols-8">
                <Input className="h-7 text-[10px] sm:col-span-2 xl:col-span-2" value={g.missing_evidence} onChange={e => updateGap(g.id, { missing_evidence: e.target.value })} placeholder="Missing evidence" />
                <Input className="h-7 text-[10px]" value={g.required_for} onChange={e => updateGap(g.id, { required_for: e.target.value })} placeholder="Required for" />
                <Select value={g.linked_block_id || UNLINKED_BLOCK_VALUE} onValueChange={v => updateGap(g.id, { linked_block_id: v === UNLINKED_BLOCK_VALUE ? "" : v })}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="Link block" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNLINKED_BLOCK_VALUE}>None</SelectItem>
                    {blockOptions.map((bo: any) => <SelectItem key={bo.id} value={bo.id}>{bo.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="h-7 text-[10px]" value={g.owner} onChange={e => updateGap(g.id, { owner: e.target.value })} placeholder="Owner" />
                <Input className="h-7 text-[10px]" type="date" value={g.due_date} onChange={e => updateGap(g.id, { due_date: e.target.value })} />
                <Select value={g.status} onValueChange={v => updateGap(g.id, { status: v })}>
                  <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{GAP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeGap(g.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </TenderStageSectionCard>

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="hala-save-button h-9 gap-1.5 px-5 text-xs">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Appendices & Evidence
        </Button>
      </div>
    </TenderStageTaskShell>
  );
}
