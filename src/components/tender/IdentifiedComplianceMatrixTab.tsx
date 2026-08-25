import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  hasPersistedIdentifiedCheckpoint,
  identifiedSavedBadgeState,
  runTenderTabSave,
  tenderRevisionTokenOf,
  type IdentifiedSectionTab,
} from "./IdentifiedStageShared";

type SectionKey = "matrix" | "notes" | "status";

const SECTION_TABS: IdentifiedSectionTab<SectionKey>[] = [
  { key: "matrix", label: "Requirement Matrix", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "notes", label: "Early Notes", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: "status", label: "Review Status", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
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

export default function IdentifiedComplianceMatrixTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const details = ((t as any).typeDetails || (t as any).type_details || {}) as any;
  const saved = details?.identified?.compliance_matrix_notes ?? {};
  const persistedCheckpoint = hasPersistedIdentifiedCheckpoint(saved);
  const [activeSection, setActiveSection] = useState<SectionKey>("matrix");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(persistedCheckpoint);
  const staleRetryArmed = useRef(false);

  const [reviewStatus, setReviewStatus] = useState(saved.review_status ?? "not_started");
  const [owner, setOwner] = useState(saved.owner ?? "");
  const [reviewDate, setReviewDate] = useState(saved.review_date ?? "");
  const [riskSummary, setRiskSummary] = useState(saved.risk_summary ?? "");
  const [notes, setNotes] = useState(saved.notes ?? "");

  useEffect(() => {
    if (dirty) return;
    setReviewStatus(saved.review_status ?? "not_started");
    setOwner(saved.owner ?? "");
    setReviewDate(saved.review_date ?? "");
    setRiskSummary(saved.risk_summary ?? "");
    setNotes(saved.notes ?? "");
    setSavedConfirmed(persistedCheckpoint);
  }, [dirty, persistedCheckpoint, saved]);

  const items = ws.complianceItems ?? [];
  const gapCount = items.filter(item => item.status === "non_compliant" || item.status === "partial" || item.status === "clarification_required").length;
  const reviewedCount = items.filter(item => item.status && item.status !== "not_reviewed").length;
  const mark = () => setDirty(true);

  const metrics = useMemo(() => [
    { label: "Requirements", value: `${items.length}` },
    { label: "Reviewed", value: `${reviewedCount}` },
    { label: "Gaps", value: `${gapCount}` },
    { label: "Status", value: reviewStatus.replace(/_/g, " ") },
  ], [gapCount, items.length, reviewedCount, reviewStatus]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        review_status: reviewStatus,
        owner: owner.trim(),
        review_date: reviewDate,
        risk_summary: riskSummary.trim(),
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      };
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderIdentifiedData(t.id, "compliance_matrix_notes", payload, "Identified compliance notes saved", expectedRevision),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Compliance notes saved.", failed: "Failed to save compliance notes." },
        onConfirmed: () => {
          setDirty(false);
          setSavedConfirmed(true);
          reload?.();
        },
        onStale: () => reload?.(),
      });
    } catch (error: any) {
      toast.error("Failed to save compliance notes.", { description: error?.message || "Unexpected save error." });
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
      saved={identifiedSavedBadgeState(savedConfirmed, dirty)}
      unsaved={dirty}
      actionSlot={
        <Button type="button" size="sm" className="h-7 gap-1.5 rounded-md px-2.5 text-[11px]" onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </Button>
      }
    >
      <IdentifiedSectionCard title="Requirement Matrix" icon={<ClipboardList className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "matrix"} badge={`${items.length}`}>
        {items.length === 0 ? (
          <IdentifiedEmptyState text="No compliance requirements captured yet." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Reference</th>
                  <th className="px-3 py-2 text-left font-semibold">Requirement</th>
                  <th className="px-3 py-2 text-left font-semibold">Category</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{item.reference || "-"}</td>
                    <td className="px-3 py-2">{item.requirement || "-"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.category}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{item.status.replace(/_/g, " ")}</Badge></td>
                    <td className="px-3 py-2">
                      <span className={item.riskLevel === "high" ? "text-red-600 font-medium" : item.riskLevel === "medium" ? "text-amber-600 font-medium" : "text-emerald-700"}>
                        {item.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Early Notes" icon={<ShieldCheck className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "notes"}>
        <div className="grid gap-4">
          {fieldLabel("Risk Summary", <Textarea className="min-h-[120px] text-xs" value={riskSummary} onChange={event => { setRiskSummary(event.target.value); mark(); }} />)}
          {fieldLabel("Notes", <Textarea className="min-h-[120px] text-xs" value={notes} onChange={event => { setNotes(event.target.value); mark(); }} />)}
        </div>
      </IdentifiedSectionCard>

      <IdentifiedSectionCard title="Review Status" icon={<AlertTriangle className="w-3.5 h-3.5 text-[#075eea]" />} hidden={activeSection !== "status"}>
        <div className="grid gap-4 md:grid-cols-3">
          {fieldLabel("Status", (
            <Select value={reviewStatus} onValueChange={value => { setReviewStatus(value); mark(); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="needs_clarification">Needs Clarification</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
              </SelectContent>
            </Select>
          ))}
          {fieldLabel("Owner", <Input className="h-8 text-xs" value={owner} onChange={event => { setOwner(event.target.value); mark(); }} />)}
          {fieldLabel("Review Date", <Input type="date" className="h-8 text-xs" value={reviewDate} onChange={event => { setReviewDate(event.target.value); mark(); }} />)}
        </div>
      </IdentifiedSectionCard>
    </IdentifiedStageShell>
  );
}
