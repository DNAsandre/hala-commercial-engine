/**
 * InternalReviewExceptionsTab — The Drafter's Inbox
 *
 * 1 Section Tab (matching Qualification pattern):
 *   1. Exceptions Inbox — all rejected blocks
 *
 * No AI. No mock data.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw, Loader2, CheckCircle2, Inbox } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
import { updateBlockReviewStatus } from "@/lib/supabase-tender-actions";
import {
  ensureReviewFields,
  DEPARTMENT_LABELS,
  type ReviewDepartment,
} from "@/lib/internal-review-types";

interface Props { ws: TenderWorkspace; reload: () => void; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void }

interface RejectedEntry {
  blockId: string;
  blockTitle: string;
  blockSection: string;
  department: ReviewDepartment;
  comment: string;
  reviewer: string;
  reviewedAt: string;
}

type ExSection = "inbox";
const SECTION_TABS: TenderStageSectionTab<ExSection>[] = [
  { key: "inbox", label: "Exceptions Inbox", icon: <Inbox className="w-3.5 h-3.5" /> },
];

export default function InternalReviewExceptionsTab({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const tenderId = ws.tender.id;
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const blocks = useMemo(
    () => (Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : []).map(ensureReviewFields),
    [drafting.proposal_blocks],
  );

  const [resubmitting, setResubmitting] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ExSection>("inbox");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  // Flatten all rejected department entries
  const rejectedEntries: RejectedEntry[] = useMemo(() => {
    const entries: RejectedEntry[] = [];
    const depts: ReviewDepartment[] = ["ops", "finance", "legal"];
    for (const b of blocks) {
      for (const d of depts) {
        if (b[`${d}_status`] === "Rejected") {
          entries.push({
            blockId: b.id,
            blockTitle: b.title || "Untitled",
            blockSection: b.section_number || "?",
            department: d,
            comment: b[`${d}_comment`] || "",
            reviewer: b[`${d}_reviewer`] || "Unknown",
            reviewedAt: b[`${d}_reviewed_at`] || "",
          });
        }
      }
    }
    return entries;
  }, [blocks]);
  const intelMetrics: TenderStageMetric[] = [
    { label: "Rejected Blocks", value: `${rejectedEntries.length}` },
    { label: "Status", value: rejectedEntries.length === 0 ? "All Clear" : "Needs Attention" },
  ];

  const handleResubmit = async (entry: RejectedEntry) => {
    const key = `${entry.blockId}-${entry.department}`;
    setResubmitting(key);
    const res = await updateBlockReviewStatus(tenderId, entry.blockId, entry.department, "Pending", "", "Resubmitted by drafter");
    if (res.success) {
      toast.success(`Block "§${entry.blockSection} ${entry.blockTitle}" resubmitted to ${DEPARTMENT_LABELS[entry.department]}.`);
      reload();
    } else {
      toast.error(res.error || "Failed to resubmit.");
    }
    setResubmitting(null);
  };

  return (
    <div className="space-y-4">
      <TenderStageTaskShell
        stageTitle="Internal Review Stage Menu"
        stageBadge="Stage 7"
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        sectionTabs={SECTION_TABS}
        stageIntelOpen={stageIntelOpen}
        onStageIntelOpenChange={setStageIntelOpen}
        metrics={intelMetrics}
        onOpenDocuments={onOpenDocuments}
        onOpenGlobalIntel={onOpenGlobalIntel}
        saved
      />

      {/* ── 1. Exceptions Inbox ── */}
      <div className={activeSection !== "inbox" ? "hidden" : ""}>
      {rejectedEntries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-400" />
          <p className="text-sm font-medium">No exceptions — all blocks are clear.</p>
          <p className="text-xs mt-1">No department has rejected any proposal blocks.</p>
        </div>
      ) : (
        <Card className="border-border shadow-none">
          <CardHeader className="py-2 px-4 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2">
              <Inbox className="w-3.5 h-3.5 text-red-600" />
              <span className="text-xs font-semibold text-red-700">Exceptions Inbox</span>
              <Badge variant="outline" className="text-[8px] border-red-200 text-red-600">{rejectedEntries.length} rejected</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-12">§</th>
                    <th className="px-3 py-2 text-left font-semibold">Block Title</th>
                    <th className="px-3 py-2 text-left font-semibold w-24">Department</th>
                    <th className="px-3 py-2 text-left font-semibold">Reviewer Comment</th>
                    <th className="px-3 py-2 text-left font-semibold w-24">Rejected By</th>
                    <th className="px-3 py-2 text-left font-semibold w-28">Date</th>
                    <th className="px-3 py-2 text-center font-semibold w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedEntries.map((entry, i) => {
                    const key = `${entry.blockId}-${entry.department}`;
                    return (
                      <tr key={`${key}-${i}`} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{entry.blockSection}</td>
                        <td className="px-3 py-2 font-medium">{entry.blockTitle}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[8px] border-red-200 text-red-600">{DEPARTMENT_LABELS[entry.department]}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {entry.comment ? (
                            <span className="flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                              {entry.comment}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">No comment provided</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{entry.reviewer}</td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">
                          {entry.reviewedAt ? new Date(entry.reviewedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] gap-1"
                            disabled={resubmitting === key}
                            onClick={() => handleResubmit(entry)}
                          >
                            {resubmitting === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Resubmit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
