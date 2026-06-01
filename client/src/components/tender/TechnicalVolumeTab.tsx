/**
 * TechnicalVolumeTab — Tab 3 of Tender Drafting
 *
 * Filtered VIEW of proposal_blocks where volume = Technical or Shared.
 * Not an independent content system. No separate save for sections.
 * Read-only view of proposal_blocks as source of truth.
 *
 * No AI. No mock data. No duplicate sections.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, BarChart3, Info } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { normalizeEditorStage, TENDER_EDITOR_STAGE_CONFIG } from "./TenderProposalEditorBlock";

interface Props { ws: TenderWorkspace; reload: () => void }

export default function TechnicalVolumeTab({ ws }: Props) {
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const allBlocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const techBlocks = useMemo(() =>
    allBlocks
      .filter((b: any) => b.volume === "Technical" || b.volume === "Shared")
      .sort((a: any, b: any) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999)),
  [allBlocks]);

  const summary = useMemo(() => ({
    total: techBlocks.length,
    drafted: techBlocks.filter((b: any) => b.draft_status !== "Not Ready" && b.draft_status !== "Ready to Draft").length,
    approved: techBlocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length,
    shared: techBlocks.filter((b: any) => b.volume === "Shared").length,
  }), [techBlocks]);

  const statusColor = (s: string) => {
    if (s === "Approved" || s === "Locked") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "Human Edited" || s === "Manual Draft") return "border-blue-300 text-blue-700 bg-blue-50";
    if (s === "Needs Review") return "border-amber-300 text-amber-700 bg-amber-50";
    if (s === "Rejected") return "border-red-300 text-red-700 bg-red-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" />
        <span>This is a <strong>filtered view</strong> of proposal blocks with volume = Technical or Shared. Edit blocks in the Proposal Block Workbench tab.</span>
      </div>

      {/* Readiness Summary */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Technical Volume Readiness</span>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              ["Total Blocks", summary.total],
              ["Drafted", summary.drafted],
              ["Approved", summary.approved],
              ["Shared", summary.shared],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-md border border-border p-2">
                <p className="text-lg font-bold">{val}</p>
                <p className="text-[9px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Block List */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Technical / Shared Blocks</span>
            <Badge variant="outline" className="text-[8px]">{techBlocks.length} block{techBlocks.length !== 1 ? "s" : ""}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {techBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No Technical or Shared blocks in proposal block register.</p>
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
                    <th className="px-3 py-2 text-left font-semibold">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {techBlocks.map((b: any) => {
                    const stage = normalizeEditorStage(b.editor_stage);
                    return (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{b.section_number || "-"}</td>
                        <td className="px-3 py-2 font-medium">{b.title || "Untitled"}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{b.volume}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${TENDER_EDITOR_STAGE_CONFIG[stage].badge}`}>{TENDER_EDITOR_STAGE_CONFIG[stage].label}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.draft_status || "Not Ready")}`}>{b.draft_status || "Not Ready"}</Badge></td>
                        <td className="px-3 py-2"><Badge variant="outline" className={`text-[8px] ${statusColor(b.approval_status || "Draft")}`}>{b.approval_status || "Draft"}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground">{b.owner || "-"}</td>
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
