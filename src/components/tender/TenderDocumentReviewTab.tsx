import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, FileText, FolderOpen, Loader2, Save, Upload, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  documentsForTenderStage,
  getTenderDocumentStatusColor,
  isTenderDocumentExpired,
  summarizeTenderDocuments,
  type TenderDocument,
  type TenderDocumentStatus,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";
import { updateTenderDocumentMetadata, updateTenderIdentifiedData } from "@/lib/supabase-tender-actions";
import {
  IdentifiedEmptyState,
  IdentifiedSectionCard,
  IdentifiedStageShell,
  announceTenderTabSaveOutcome,
  hasPersistedIdentifiedCheckpoint,
  identifiedSavedBadgeState,
  resolveTenderTabSaveOutcome,
  runTenderTabSave,
  tenderRevisionTokenOf,
  type IdentifiedSectionTab,
} from "./IdentifiedStageShared";

type SectionKey = "inventory" | "review" | "missing";

const SECTION_TABS: IdentifiedSectionTab<SectionKey>[] = [
  { key: "inventory", label: "Document Inventory", icon: <FolderOpen className="w-3.5 h-3.5" /> },
  { key: "review", label: "Review Notes", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "missing", label: "Missing Documents", icon: <FileText className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

function fieldLabel(label: string, children: ReactNode) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function docStatus(doc: TenderDocument): TenderDocumentStatus {
  return isTenderDocumentExpired(doc) ? "Expired" : doc.status;
}

export default function TenderDocumentReviewTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const details = ((t as any).typeDetails || (t as any).type_details || {}) as any;
  const saved = details?.identified?.document_review ?? {};
  const persistedCheckpoint = hasPersistedIdentifiedCheckpoint(saved);
  const [activeSection, setActiveSection] = useState<SectionKey>("inventory");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(persistedCheckpoint);
  const staleRetryArmed = useRef(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState(saved.review_status ?? "not_started");
  const [reviewer, setReviewer] = useState(saved.reviewer ?? "");
  const [reviewDate, setReviewDate] = useState(saved.review_date ?? "");
  const [keyObligations, setKeyObligations] = useState(saved.key_obligations ?? "");
  const [missingDocuments, setMissingDocuments] = useState(saved.missing_documents ?? "");
  const [reviewNotes, setReviewNotes] = useState(saved.review_notes ?? "");

  useEffect(() => {
    if (dirty) return;
    setReviewStatus(saved.review_status ?? "not_started");
    setReviewer(saved.reviewer ?? "");
    setReviewDate(saved.review_date ?? "");
    setKeyObligations(saved.key_obligations ?? "");
    setMissingDocuments(saved.missing_documents ?? "");
    setReviewNotes(saved.review_notes ?? "");
    setSavedConfirmed(persistedCheckpoint);
  }, [dirty, persistedCheckpoint, saved]);

  const docs = ws.documents ?? [];
  const identifiedDocs = useMemo(() => documentsForTenderStage(docs, "identified"), [docs]);
  const identifiedDocIds = useMemo(() => new Set(identifiedDocs.map(doc => doc.id)), [identifiedDocs]);
  const unlinkedDocs = useMemo(() => docs.filter(doc => !identifiedDocIds.has(doc.id)), [docs, identifiedDocIds]);
  const documentSummary = useMemo(() => summarizeTenderDocuments(identifiedDocs), [identifiedDocs]);
  const missingCount = documentSummary.missing;
  const reviewedCount = documentSummary.reviewed;
  const mark = () => setDirty(true);

  const metrics = useMemo(() => [
    { label: "Identified Docs", value: `${identifiedDocs.length}` },
    { label: "Reviewed", value: `${reviewedCount}` },
    { label: "Missing", value: `${missingCount}` },
    { label: "Status", value: reviewStatus.replace(/_/g, " ") },
  ], [identifiedDocs.length, missingCount, reviewedCount, reviewStatus]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        review_status: reviewStatus,
        reviewer: reviewer.trim(),
        review_date: reviewDate,
        key_obligations: keyObligations.trim(),
        missing_documents: missingDocuments.trim(),
        review_notes: reviewNotes.trim(),
        updated_at: new Date().toISOString(),
      };
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderIdentifiedData(t.id, "document_review", payload, "Document review saved", expectedRevision),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Document review saved.", failed: "Failed to save document review." },
        onConfirmed: () => {
          setDirty(false);
          setSavedConfirmed(true);
          reload?.();
        },
        onStale: () => reload?.(),
      });
    } catch (error: any) {
      toast.error("Failed to save document review.", { description: error?.message || "Unexpected save error." });
    } finally {
      setSaving(false);
    }
  }

  async function linkToIdentified(doc: TenderDocument) {
    setLinkingId(doc.id);
    const nextStages = Array.from(new Set([...doc.stage_relevance, "Identified" as const]));
    // Document-list writer: revision is guarded in-call by the write layer
    // (updateTenderDocumentList); no expectedRevision parameter exists on it.
    const result = await updateTenderDocumentMetadata(t.id, doc.id, { stage_relevance: nextStages });
    setLinkingId(null);
    const outcome = resolveTenderTabSaveOutcome(result, {
      saved: "Document linked to Identified.",
      failed: "Failed to link document.",
    });
    announceTenderTabSaveOutcome(outcome);
    if (outcome.confirmedSaved) reload?.();
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
      saved={identifiedSavedBadgeState(savedConfirmed, dirty)}
      unsaved={dirty}
      actionSlot={
        <Button type="button" size="sm" className="h-7 gap-1.5 rounded-md px-2.5 text-[11px]" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </Button>
      }
    >
      <IdentifiedSectionCard title="Document Inventory" icon={<FolderOpen className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "inventory"} badge={`${identifiedDocs.length}`}>
        <div className="flex flex-wrap justify-end gap-2 pb-3">
          {onOpenDocuments && (
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenDocuments}>
              <Upload className="w-3.5 h-3.5" />
              Upload Document
            </Button>
          )}
        </div>
        {identifiedDocs.length === 0 ? (
          <IdentifiedEmptyState text="No documents linked to Identified yet." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Document</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody>
                {identifiedDocs.map(doc => (
                  <tr key={doc.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{doc.document_name}</td>
                    <td className="px-3 py-2">{doc.document_category}</td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.document_type || "-"}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getTenderDocumentStatusColor(docStatus(doc))}`}>{docStatus(doc)}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">{doc.owner || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Review Notes" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "review"}>
        <div className="grid gap-4 md:grid-cols-3">
          {fieldLabel("Review Status", (
            <Select value={reviewStatus} onValueChange={value => { setReviewStatus(value); mark(); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="needs_documents">Needs Documents</SelectItem>
              </SelectContent>
            </Select>
          ))}
          {fieldLabel("Reviewer", <Input className="h-8 text-xs" value={reviewer} onChange={event => { setReviewer(event.target.value); mark(); }} />)}
          {fieldLabel("Review Date", <Input type="date" className="h-8 text-xs" value={reviewDate} onChange={event => { setReviewDate(event.target.value); mark(); }} />)}
          <div className="md:col-span-3">{fieldLabel("Key Obligations Found", <Textarea className="min-h-[120px] text-xs" value={keyObligations} onChange={event => { setKeyObligations(event.target.value); mark(); }} />)}</div>
          <div className="md:col-span-3">{fieldLabel("Review Notes", <Textarea className="min-h-[120px] text-xs" value={reviewNotes} onChange={event => { setReviewNotes(event.target.value); mark(); }} />)}</div>
        </div>
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Missing Documents" icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "missing"} badge={`${unlinkedDocs.length} other tender docs`}>
        <div className="grid gap-4">
          {fieldLabel("Missing Document Notes", <Textarea className="min-h-[120px] text-xs" value={missingDocuments} onChange={event => { setMissingDocuments(event.target.value); mark(); }} />)}
          {unlinkedDocs.length > 0 && (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Other Tender Document</th>
                    <th className="px-3 py-2 text-left font-semibold">Stage Relevance</th>
                    <th className="px-3 py-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unlinkedDocs.map(doc => (
                    <tr key={doc.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{doc.document_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{doc.stage_relevance.join(", ") || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[10px]" onClick={() => linkToIdentified(doc)} disabled={linkingId === doc.id}>
                          {linkingId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                          Link
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </IdentifiedSectionCard>
    </IdentifiedStageShell>
  );
}
