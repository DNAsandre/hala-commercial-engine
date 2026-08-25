/**
 * SubmittedVersionTab — Tab 2 of Submitted Stage
 *
 * Records manually captured version FACTS about the submitted tender (label,
 * timestamp, hash, volumes). TCW-T4 (B21): nothing is frozen by this record —
 * the block table below is the LIVE tender_drafting.proposal_blocks list,
 * which remains editable in Tender Drafting; the copy on this tab says so.
 *
 * All data persisted to type_details.submission.submitted_version.
 * No AI. No mock data.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save, Loader2, Info, FileText, Layers, Hash } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSubmissionData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  /** TCW-T4 (C3): lets the stage shell render the real Unsaved/Saved badge. */
  onDirtyChange?: (dirty: boolean) => void;
}

const VOLUMES = ["Technical", "Commercial", "Shared", "Appendix"] as const;

function normalizeVolumes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((volume): volume is (typeof VOLUMES)[number] =>
    VOLUMES.includes(volume as (typeof VOLUMES)[number]),
  );
}

function formatContentSize(length: number) {
  if (length <= 0) return "—";
  if (length < 1024) return `${length} B`;
  return `${(length / 1024).toFixed(length < 10 * 1024 ? 1 : 0)} KB`;
}

export default function SubmittedVersionTab({ ws, reload, onDirtyChange }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.submission?.submitted_version ?? {};

  const [versionLabel, setVersionLabel] = useState(saved.version_label || "");
  const [frozenAt, setFrozenAt] = useState(saved.frozen_at || "");
  const [frozenBy, setFrozenBy] = useState(saved.frozen_by || "");
  const [docHash, setDocHash] = useState(saved.document_hash || "");
  const [totalPages, setTotalPages] = useState<number>(saved.total_pages ?? 0);
  const [fileSizeMb, setFileSizeMb] = useState<number>(saved.file_size_mb ?? 0);
  const [volumesIncluded, setVolumesIncluded] = useState<string[]>(normalizeVolumes(saved.volumes_included));
  const [versionNotes, setVersionNotes] = useState(saved.version_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => { setDirty(true); onDirtyChange?.(true); };
  const hasSavedData = !!(saved.version_label || saved.frozen_at);

  // Read-only proposal blocks snapshot from tender_drafting
  const drafting = td?.tender_drafting ?? {};
  const proposalBlocks = useMemo(() =>
    Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [],
  [drafting.proposal_blocks]);

  const sortedBlocks = useMemo(() =>
    [...proposalBlocks].sort((a: any, b: any) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999)),
  [proposalBlocks]);

  const toggleVolume = (vol: string) => {
    setVolumesIncluded(prev => prev.includes(vol) ? prev.filter(v => v !== vol) : [...prev, vol]);
    mark();
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        version_label: versionLabel,
        frozen_at: frozenAt,
        frozen_by: frozenBy,
        document_hash: docHash,
        total_pages: totalPages,
        file_size_mb: fileSizeMb,
        volumes_included: normalizeVolumes(volumesIncluded),
        version_notes: versionNotes,
      };
      // P2a threading + honest outcome; stale keeps the entry on screen.
      const res = await updateTenderSubmissionData(tenderId, "submitted_version", payload, "Submitted version recorded", wsRevisionToken(ws));
      if (!reportSaveOutcome(res, "Submitted version record saved.")) return;
      setDirty(false);
      onDirtyChange?.(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [versionLabel, frozenAt, frozenBy, docHash, totalPages, fileSizeMb, volumesIncluded, versionNotes, tenderId, reload, ws, onDirtyChange]);

  const draftStatusColor = (s: string) => {
    if (s === "Approved" || s === "Locked") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "Human Edited" || s === "Manual Draft") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      {/* Info Banner — TCW-T4 (B21): the old text claimed this "locks the
          version"; nothing is locked or snapshotted by this record. */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Record the version facts of the submitted tender (manual entry). This does NOT lock or snapshot anything — proposal blocks remain editable in Tender Drafting, and this record itself can be edited here.</span>
      </div>

      {/* Save Strip */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Version</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${hasSavedData ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`text-[10px] ${hasSavedData ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            {hasSavedData ? `${saved.version_label || "Recorded"}` : "Not Yet Recorded"}
          </span>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Version Snapshot */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Version Record</span>
            {/* TCW-T4 (B21): "Frozen" claimed a lock that does not exist. */}
            {hasSavedData && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50">Recorded (manual)</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Version Label</label>
              <Input className="h-8 text-xs mt-1" value={versionLabel} onChange={e => { setVersionLabel(e.target.value); mark(); }} placeholder="e.g. v1.0 Final" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Recorded At</label>
              <Input type="datetime-local" className="h-8 text-xs mt-1" value={frozenAt} onChange={e => { setFrozenAt(e.target.value); mark(); }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Recorded By</label>
              <Input className="h-8 text-xs mt-1" value={frozenBy} onChange={e => { setFrozenBy(e.target.value); mark(); }} placeholder="Person who recorded the version" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Document Hash</label>
              <Input className="h-8 text-xs mt-1 font-mono" value={docHash} onChange={e => { setDocHash(e.target.value); mark(); }} placeholder="SHA256 or 'manual'" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Total Pages</label>
              <Input type="number" min={0} className="h-8 text-xs mt-1" value={totalPages} onChange={e => { setTotalPages(parseInt(e.target.value) || 0); mark(); }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">File Size (MB)</label>
              <Input type="number" min={0} step={0.1} className="h-8 text-xs mt-1" value={fileSizeMb} onChange={e => { setFileSizeMb(parseFloat(e.target.value) || 0); mark(); }} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-[10px] font-semibold text-muted-foreground mb-2 block">Volumes Included</label>
            <div className="flex items-center gap-4">
              {VOLUMES.map(vol => (
                <label key={vol} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={volumesIncluded.includes(vol)} onCheckedChange={() => toggleVolume(vol)} />
                  <span className="text-xs">{vol}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-[10px] font-semibold text-muted-foreground">Version Notes</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={versionNotes} onChange={e => { setVersionNotes(e.target.value); mark(); }} placeholder="Notes about this version..." />
          </div>
        </CardContent>
      </Card>

      {/* Proposal Blocks Snapshot (Read-only) */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#075eea]" />
            {/* TCW-T4 (B21): this is the LIVE drafting block list, not a
                snapshot — the blocks remain editable in Tender Drafting. */}
            <span className="text-xs font-semibold">Current Proposal Blocks (live)</span>
            <Badge variant="outline" className="text-[8px]">{sortedBlocks.length} block{sortedBlocks.length !== 1 ? "s" : ""}</Badge>
            <Badge variant="outline" className="text-[8px] border-slate-200 text-slate-500">Live view — editable in Tender Drafting</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No proposal blocks found in tender drafting data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Volume</th>
                    <th className="px-3 py-2 text-left font-semibold">Draft Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Approval</th>
                    <th className="px-3 py-2 text-right font-semibold">Content</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((b: any, i: number) => {
                    const contentLen = (b.content_html || b.editor_content || b.draft_content || b.content_text || "").length;
                    return (
                      <tr key={b.id || i} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{b.section_number || i + 1}</td>
                        <td className="px-3 py-2 font-medium">{b.title || "Untitled"}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{b.volume || "—"}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${draftStatusColor(b.draft_status || "Not Ready")}`}>{b.draft_status || "Not Ready"}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${draftStatusColor(b.approval_status || "Draft")}`}>{b.approval_status || "Draft"}</Badge></td>
                        <td className="px-3 py-2 text-right text-muted-foreground font-mono">{formatContentSize(contentLen)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
