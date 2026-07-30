import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarClock, ClipboardList, FileText, Loader2, Save, StickyNote, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderIdentifiedData } from "@/lib/supabase-tender-actions";
import {
  IdentifiedSectionCard,
  IdentifiedStageShell,
  type IdentifiedSectionTab,
} from "./IdentifiedStageShared";

type SectionKey = "files" | "source" | "deadline" | "notes";

const SECTION_TABS: IdentifiedSectionTab<SectionKey>[] = [
  { key: "files", label: "Received Files", icon: <UploadCloud className="w-3.5 h-3.5" /> },
  { key: "source", label: "Source Details", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "deadline", label: "Deadline Check", icon: <CalendarClock className="w-3.5 h-3.5" /> },
  { key: "notes", label: "Initial Notes", icon: <StickyNote className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

function asTextList(value: unknown): string {
  return Array.isArray(value) ? value.join("\n") : "";
}

function textToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function fieldLabel(label: string, children: ReactNode) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function IntakeFileAuditTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const details = ((t as any).typeDetails || (t as any).type_details || {}) as any;
  const saved = details?.identified?.intake_file_audit ?? {};
  const [activeSection, setActiveSection] = useState<SectionKey>("files");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [receivedFiles, setReceivedFiles] = useState(asTextList(saved.received_files));
  const [sourceChannel, setSourceChannel] = useState(saved.source_channel ?? "");
  const [buyerReference, setBuyerReference] = useState(saved.buyer_reference ?? "");
  const [deadlineStatus, setDeadlineStatus] = useState(saved.deadline_status ?? "not_checked");
  const [tenderOwner, setTenderOwner] = useState(saved.tender_owner ?? t.assignedOwner ?? "");
  const [missingItems, setMissingItems] = useState(asTextList(saved.missing_intake_items));
  const [initialNotes, setInitialNotes] = useState(saved.initial_notes ?? "");

  useEffect(() => {
    if (dirty) return;
    setReceivedFiles(asTextList(saved.received_files));
    setSourceChannel(saved.source_channel ?? "");
    setBuyerReference(saved.buyer_reference ?? "");
    setDeadlineStatus(saved.deadline_status ?? "not_checked");
    setTenderOwner(saved.tender_owner ?? t.assignedOwner ?? "");
    setMissingItems(asTextList(saved.missing_intake_items));
    setInitialNotes(saved.initial_notes ?? "");
  }, [dirty, saved, t.assignedOwner]);

  const fileCount = textToList(receivedFiles).length;
  const missingCount = textToList(missingItems).length;
  const mark = () => setDirty(true);

  const metrics = useMemo(() => [
    { label: "Files", value: `${fileCount}` },
    { label: "Missing Items", value: `${missingCount}` },
    { label: "Deadline", value: deadlineStatus.replace(/_/g, " ") },
    { label: "Owner", value: tenderOwner || "Unassigned" },
  ], [deadlineStatus, fileCount, missingCount, tenderOwner]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        received_files: textToList(receivedFiles),
        source_channel: sourceChannel.trim(),
        buyer_reference: buyerReference.trim(),
        deadline_status: deadlineStatus,
        tender_owner: tenderOwner.trim(),
        missing_intake_items: textToList(missingItems),
        initial_notes: initialNotes.trim(),
        updated_at: new Date().toISOString(),
      };
      const result = await updateTenderIdentifiedData(t.id, "intake_file_audit", payload, "Intake file audit saved");
      if (result.success) {
        setDirty(false);
        toast.success("Intake file audit saved.");
        reload?.();
      } else {
        toast.error("Failed to save intake file audit.", { description: result.error });
      }
    } catch (error: any) {
      toast.error("Failed to save intake file audit.", { description: error?.message || "Unexpected save error." });
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
      <IdentifiedSectionCard title="Received Files" icon={<UploadCloud className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "files"} badge={`${fileCount}`}>
        <div className="grid gap-4 md:grid-cols-2">
          {fieldLabel("Received File List", <Textarea className="min-h-[180px] text-xs" value={receivedFiles} onChange={event => { setReceivedFiles(event.target.value); mark(); }} />)}
          {fieldLabel("Missing Intake Items", <Textarea className="min-h-[180px] text-xs" value={missingItems} onChange={event => { setMissingItems(event.target.value); mark(); }} />)}
        </div>
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Source Details" icon={<ClipboardList className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "source"}>
        <div className="grid gap-4 md:grid-cols-2">
          {fieldLabel("Source Channel", <Input className="h-8 text-xs" value={sourceChannel} onChange={event => { setSourceChannel(event.target.value); mark(); }} />)}
          {fieldLabel("Buyer Reference", <Input className="h-8 text-xs" value={buyerReference} onChange={event => { setBuyerReference(event.target.value); mark(); }} />)}
          {fieldLabel("Tender Owner", <Input className="h-8 text-xs" value={tenderOwner} onChange={event => { setTenderOwner(event.target.value); mark(); }} />)}
          {fieldLabel("Tender Record", <Input className="h-8 text-xs" value={t.title || ""} readOnly />)}
        </div>
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Deadline Check" icon={<CalendarClock className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "deadline"} badge={t.submissionDeadline || "Not captured"}>
        <div className="grid gap-4 md:grid-cols-2">
          {fieldLabel("Submission Deadline", <Input className="h-8 text-xs" value={t.submissionDeadline || ""} readOnly />)}
          {fieldLabel("Deadline Status", (
            <Select value={deadlineStatus} onValueChange={value => { setDeadlineStatus(value); mark(); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_checked">Not Checked</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="needs_clarification">Needs Clarification</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          ))}
        </div>
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Initial Notes" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "notes"}>
        {fieldLabel("Notes", <Textarea className="min-h-[180px] text-xs" value={initialNotes} onChange={event => { setInitialNotes(event.target.value); mark(); }} />)}
      </IdentifiedSectionCard>
    </IdentifiedStageShell>
  );
}
