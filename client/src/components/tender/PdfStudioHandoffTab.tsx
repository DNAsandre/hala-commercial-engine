/**
 * PdfStudioHandoffTab — Tab 7 of Tender Drafting
 *
 * PDF Studio receives the ordered block register.
 * Shows volume counts, status counts, full ordered block list.
 * No PDF Studio mutation. No sync execution in this sprint.
 *
 * No AI. No mock data.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Save, Loader2, FileOutput, Layers, CheckCircle2, Lock, ExternalLink, BarChart3, Info,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderDraftingData } from "@/lib/supabase-tender-actions";
import { normalizeEditorStage, TENDER_EDITOR_STAGE_CONFIG } from "./TenderProposalEditorBlock";

interface Props { ws: TenderWorkspace; reload: () => void }

export default function PdfStudioHandoffTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const saved = drafting.pdf_studio_handoff ?? {};
  const blocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const [templateId, setTemplateId] = useState(saved.template_id || "");
  const [brandingProfileId, setBrandingProfileId] = useState(saved.branding_profile_id || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sorted blocks
  const sortedBlocks = useMemo(() =>
    [...blocks].sort((a: any, b: any) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999)),
  [blocks]);

  // Counts
  const counts = useMemo(() => ({
    total: blocks.length,
    technical: blocks.filter((b: any) => b.volume === "Technical").length,
    commercial: blocks.filter((b: any) => b.volume === "Commercial").length,
    shared: blocks.filter((b: any) => b.volume === "Shared").length,
    appendix: blocks.filter((b: any) => b.volume === "Appendix").length,
    draft: blocks.filter((b: any) => b.draft_status === "Not Ready" || b.draft_status === "Ready to Draft").length,
    humanEdited: blocks.filter((b: any) => b.draft_status === "Human Edited" || b.draft_status === "Manual Draft").length,
    approved: blocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length,
  }), [blocks]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ordered_block_ids: sortedBlocks.map((b: any) => b.id),
        template_id: templateId,
        branding_profile_id: brandingProfileId,
        last_synced_at: saved.last_synced_at || "",
        last_synced_by: saved.last_synced_by || "",
      };
      const res = await updateTenderDraftingData(tenderId, "pdf_studio_handoff", payload, "Handoff metadata updated");
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("PDF Studio Handoff saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [sortedBlocks, templateId, brandingProfileId, saved, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "Approved" || s === "Locked") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "Human Edited" || s === "Manual Draft") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />
        <span>PDF Studio receives the ordered block register from Proposal Block Workbench. Edit and approve blocks there first. PDF Studio sync is not yet active.</span>
      </div>

      {/* Volume & Status Counts */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-semibold">Handoff Summary</span>
            </div>
            <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-3 text-center mb-3">
            {[
              ["Total Blocks", counts.total],
              ["Technical", counts.technical],
              ["Commercial", counts.commercial],
              ["Shared", counts.shared],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-md border border-border p-2">
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              ["Appendix", counts.appendix],
              ["Drafting", counts.draft],
              ["Human Edited", counts.humanEdited],
              ["Approved", counts.approved],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-md border border-border p-2">
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Handoff Config */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <FileOutput className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Handoff Configuration</span>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Template</label>
              <Input className="h-8 text-xs mt-1" value={templateId} onChange={e => { setTemplateId(e.target.value); setDirty(true); }} placeholder="Template ID or name" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Branding Profile</label>
              <Input className="h-8 text-xs mt-1" value={brandingProfileId} onChange={e => { setBrandingProfileId(e.target.value); setDirty(true); }} placeholder="Branding profile ID" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Last Synced</label>
              <p className="text-xs mt-2 text-muted-foreground">{saved.last_synced_at ? new Date(saved.last_synced_at).toLocaleString() : "Never"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
            <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1.5" disabled>
              <Lock className="w-3 h-3" /> Create Proposal Instance
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1.5" disabled={counts.approved === 0} onClick={() => toast.info("PDF Studio sync is not yet configured. Approved blocks are listed below for manual handoff.")}>
              <CheckCircle2 className="w-3 h-3" /> Sync Approved Blocks
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-[10px] gap-1.5" onClick={() => window.open("/pdf-studio", "_blank")}>
              <ExternalLink className="w-3 h-3" /> Open PDF Studio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ordered Block List */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Ordered Block Register</span>
            <Badge variant="outline" className="text-[8px]">{sortedBlocks.length} block{sortedBlocks.length !== 1 ? "s" : ""}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No proposal blocks to hand off yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Title</th>
                    <th className="px-3 py-2 text-left font-semibold">Volume</th>
                    <th className="px-3 py-2 text-left font-semibold">Stage</th>
                    <th className="px-3 py-2 text-left font-semibold">Draft</th>
                    <th className="px-3 py-2 text-left font-semibold">Approval</th>
                    <th className="px-3 py-2 text-left font-semibold">PDF Target</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBlocks.map((b: any, i: number) => {
                    const stage = normalizeEditorStage(b.editor_stage);
                    return (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{b.section_number || i + 1}</td>
                        <td className="px-3 py-2 font-medium">{b.title || "Untitled"}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{b.volume}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${TENDER_EDITOR_STAGE_CONFIG[stage].badge}`}>{TENDER_EDITOR_STAGE_CONFIG[stage].label}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.draft_status || "Not Ready")}`}>{b.draft_status || "Not Ready"}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.approval_status || "Draft")}`}>{b.approval_status || "Draft"}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground">{b.pdf_studio_target || "—"}</td>
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
