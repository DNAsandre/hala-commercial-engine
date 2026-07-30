import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderIdentifiedData } from "@/lib/supabase-tender-actions";
import {
  IdentifiedEmptyState,
  IdentifiedSectionCard,
  IdentifiedStageShell,
  type IdentifiedSectionTab,
} from "./IdentifiedStageShared";

type SectionKey = "register" | "status" | "notes";

const SECTION_TABS: IdentifiedSectionTab<SectionKey>[] = [
  { key: "register", label: "Question Register", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "status", label: "Response Status", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "notes", label: "Notes", icon: <MessageSquare className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

interface ClarificationRow {
  id: string;
  question: string;
  source_reference: string;
  category: string;
  owner: string;
  due_date: string;
  status: string;
  submitted_to_client: boolean;
  response_received: boolean;
  notes: string;
}

function newRow(): ClarificationRow {
  return {
    id: crypto.randomUUID(),
    question: "",
    source_reference: "",
    category: "",
    owner: "",
    due_date: "",
    status: "draft",
    submitted_to_client: false,
    response_received: false,
    notes: "",
  };
}

export default function IdentifiedClarificationLogTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const details = ((t as any).typeDetails || (t as any).type_details || {}) as any;
  const savedRows = details?.identified?.clarification_log;
  const savedNotes = details?.identified?.clarification_log_notes ?? "";
  const [activeSection, setActiveSection] = useState<SectionKey>("register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ClarificationRow[]>(Array.isArray(savedRows) ? savedRows : []);
  const [notes, setNotes] = useState(savedNotes);

  useEffect(() => {
    if (dirty) return;
    setRows(Array.isArray(savedRows) ? savedRows : []);
    setNotes(savedNotes);
  }, [dirty, savedRows, savedNotes]);

  const openRows = rows.filter(row => row.status !== "answered" && row.status !== "closed").length;
  const submittedRows = rows.filter(row => row.submitted_to_client).length;
  const answeredRows = rows.filter(row => row.response_received || row.status === "answered" || row.status === "closed").length;

  const metrics = useMemo(() => [
    { label: "Questions", value: `${rows.length}` },
    { label: "Open", value: `${openRows}` },
    { label: "Submitted", value: `${submittedRows}` },
    { label: "Answered", value: `${answeredRows}` },
  ], [answeredRows, openRows, rows.length, submittedRows]);

  const mark = () => setDirty(true);

  function updateRow(id: string, patch: Partial<ClarificationRow>) {
    setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
    mark();
  }

  function addRow() {
    setRows(prev => [...prev, newRow()]);
    mark();
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(row => row.id !== id));
    mark();
  }

  async function save() {
    setSaving(true);
    try {
      const cleanedRows = rows.map(row => ({
        ...row,
        question: row.question.trim(),
        source_reference: row.source_reference.trim(),
        category: row.category.trim(),
        owner: row.owner.trim(),
        notes: row.notes.trim(),
      }));
      const logResult = await updateTenderIdentifiedData(t.id, "clarification_log", cleanedRows, "Identified clarification log saved");
      const notesResult = logResult.success
        ? await updateTenderIdentifiedData(t.id, "clarification_log_notes", notes.trim(), "Identified clarification notes saved")
        : logResult;
      if (logResult.success && notesResult.success) {
        setDirty(false);
        toast.success("Clarification log saved.");
        reload?.();
      } else {
        toast.error("Failed to save clarification log.", { description: logResult.error || notesResult.error });
      }
    } catch (error: any) {
      toast.error("Failed to save clarification log.", { description: error?.message || "Unexpected save error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <IdentifiedStageShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={SECTION_TABS}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      metrics={metrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      unsaved={dirty}
      actionSlot={
        <Button type="button" size="sm" className="h-7 gap-1.5 rounded-md px-2.5 text-[11px]" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </Button>
      }
    >
      <IdentifiedSectionCard title="Question Register" icon={<MessageSquare className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "register"} badge={`${rows.length}`}>
        <div className="flex justify-end pb-3">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={addRow}>
            <Plus className="w-3.5 h-3.5" />
            Add Question
          </Button>
        </div>
        {rows.length === 0 ? (
          <IdentifiedEmptyState text="No pre-submission clarification questions captured yet." />
        ) : (
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-md border p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Question {index + 1}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => removeRow(row.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-semibold text-muted-foreground">Question</label>
                    <Textarea className="mt-1 min-h-[70px] text-xs" value={row.question} onChange={event => updateRow(row.id, { question: event.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Source Document / Page</label>
                    <Input className="mt-1 h-8 text-xs" value={row.source_reference} onChange={event => updateRow(row.id, { source_reference: event.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Category</label>
                    <Input className="mt-1 h-8 text-xs" value={row.category} onChange={event => updateRow(row.id, { category: event.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Owner</label>
                    <Input className="mt-1 h-8 text-xs" value={row.owner} onChange={event => updateRow(row.id, { owner: event.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Due Date</label>
                    <Input type="date" className="mt-1 h-8 text-xs" value={row.due_date} onChange={event => updateRow(row.id, { due_date: event.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Response Status" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "status"}>
        {rows.length === 0 ? (
          <IdentifiedEmptyState text="No clarification status to review yet." />
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.id} className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_160px_130px_130px]">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{row.question || "Untitled question"}</p>
                  <p className="text-[10px] text-muted-foreground">{row.owner || "Unassigned"}</p>
                </div>
                <Select value={row.status} onValueChange={value => updateRow(row.id, { status: value })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="answered">Answered</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={row.submitted_to_client} onCheckedChange={checked => updateRow(row.id, { submitted_to_client: checked === true })} />
                  Submitted
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox checked={row.response_received} onCheckedChange={checked => updateRow(row.id, { response_received: checked === true })} />
                  Answered
                </label>
              </div>
            ))}
          </div>
        )}
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Notes" icon={<MessageSquare className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "notes"}>
        <Textarea className="min-h-[180px] text-xs" value={notes} onChange={event => { setNotes(event.target.value); mark(); }} />
      </IdentifiedSectionCard>
    </IdentifiedStageShell>
  );
}
