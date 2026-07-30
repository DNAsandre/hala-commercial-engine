/**
 * CommercialVolumeTab - Tab 4 of Tender Drafting
 *
 * Filtered view of proposal_blocks where volume = Commercial or Shared.
 * Not an independent content system. No separate save for sections.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DollarSign, BarChart3, Info } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { normalizeEditorStage, TENDER_EDITOR_STAGE_CONFIG } from "./TenderProposalEditorBlock";
import { TenderStageSectionCard, TenderStageTaskShell } from "./TenderStageTaskShell";

type CommSectionKey = "readiness" | "blocks";

const COMM_SECTION_TABS: { key: CommSectionKey; label: string; icon: ReactNode }[] = [
  { key: "readiness", label: "Commercial Volume Readiness", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "blocks", label: "Commercial / Shared Blocks", icon: <DollarSign className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function CommercialVolumeTab({ ws, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const allBlocks = useMemo(() => Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [], [drafting.proposal_blocks]);

  const commBlocks = useMemo(() =>
    allBlocks
      .filter((b: any) => b.volume === "Commercial" || b.volume === "Shared")
      .sort((a: any, b: any) => (parseInt(a.section_number) || 9999) - (parseInt(b.section_number) || 9999)),
  [allBlocks]);

  const summary = useMemo(() => ({
    total: commBlocks.length,
    drafted: commBlocks.filter((b: any) => b.draft_status !== "Not Ready" && b.draft_status !== "Ready to Draft").length,
    approved: commBlocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length,
    shared: commBlocks.filter((b: any) => b.volume === "Shared").length,
  }), [commBlocks]);

  const metrics = useMemo(() => [
    { label: "Total Blocks", value: String(summary.total) },
    { label: "Drafted", value: String(summary.drafted) },
    { label: "Approved", value: String(summary.approved) },
    { label: "Shared", value: String(summary.shared) },
  ], [summary.approved, summary.drafted, summary.shared, summary.total]);

  const [activeSection, setActiveSection] = useState<CommSectionKey>("readiness");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const statusColor = (s: string) => {
    if (s === "Approved" || s === "Locked") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "Human Edited" || s === "Manual Draft") return "border-blue-300 text-blue-700 bg-blue-50";
    if (s === "Needs Review") return "border-amber-300 text-amber-700 bg-amber-50";
    if (s === "Rejected") return "border-red-300 text-red-700 bg-red-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  return (
    <TenderStageTaskShell
      stageTitle="Tender Drafting Stage Menu"
      stageBadge="Stage 6"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={COMM_SECTION_TABS}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      metrics={metrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={commBlocks.length > 0}
    >
      <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
        <span>This is a <strong>filtered view</strong> of proposal blocks with volume = Commercial or Shared. Edit blocks in the Proposal Block Workbench tab.</span>
      </div>

      <TenderStageSectionCard
        title="Commercial Volume Readiness"
        icon={<BarChart3 className="h-3.5 w-3.5 text-[#075eea]" />}
        badge={`${summary.drafted}/${summary.total} drafted`}
        hidden={activeSection !== "readiness"}
      >
        <div className="grid gap-3 text-center sm:grid-cols-2 lg:grid-cols-4">
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
      </TenderStageSectionCard>

      <TenderStageSectionCard
        title="Commercial / Shared Blocks"
        icon={<DollarSign className="h-3.5 w-3.5 text-[#075eea]" />}
        badge={`${commBlocks.length} block${commBlocks.length !== 1 ? "s" : ""}`}
        hidden={activeSection !== "blocks"}
      >
        {commBlocks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No Commercial or Shared blocks in proposal block register.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="w-8 px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Title</th>
                  <th className="px-3 py-2 text-left font-semibold">Volume</th>
                  <th className="px-3 py-2 text-left font-semibold">Stage</th>
                  <th className="px-3 py-2 text-left font-semibold">Draft</th>
                  <th className="px-3 py-2 text-left font-semibold">Approval</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                </tr>
              </thead>
              <tbody>
                {commBlocks.map((b: any) => {
                  const stage = normalizeEditorStage(b.editor_stage);
                  return (
                    <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{b.section_number || "-"}</td>
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
      </TenderStageSectionCard>
    </TenderStageTaskShell>
  );
}
