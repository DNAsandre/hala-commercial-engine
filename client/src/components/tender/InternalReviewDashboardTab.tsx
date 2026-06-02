/**
 * InternalReviewDashboardTab — Review Dashboard (Bid Manager's Control Tower)
 *
 * Shows high-level approval metrics per department, overall readiness,
 * and a summary of all AI flags across the proposal.
 *
 * No AI generation here. No mock data.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, DollarSign, Scale, AlertTriangle, CheckCircle2, XCircle, Clock, BarChart3, Bot,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  ensureReviewFields,
  countByStatus,
  DEPARTMENT_LABELS,
  DEPARTMENT_VOLUMES,
  type ReviewDepartment,
} from "@/lib/internal-review-types";

interface Props { ws: TenderWorkspace; reload: () => void }

const DEPT_ICONS: Record<ReviewDepartment, typeof Shield> = {
  ops: Shield,
  finance: DollarSign,
  legal: Scale,
};

const DEPT_COLORS: Record<ReviewDepartment, { bg: string; border: string; text: string }> = {
  ops: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  finance: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  legal: { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
};

export default function InternalReviewDashboardTab({ ws }: Props) {
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const blocks = useMemo(
    () => (Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : []).map(ensureReviewFields),
    [drafting.proposal_blocks],
  );

  // Department stats
  const deptStats = useMemo(() => {
    const depts: ReviewDepartment[] = ["ops", "finance", "legal"];
    return depts.map(d => ({
      department: d,
      ...countByStatus(blocks, d, DEPARTMENT_VOLUMES[d]),
    }));
  }, [blocks]);

  // Overall readiness
  const totalRequired = deptStats.reduce((s, d) => s + d.total, 0);
  const totalApproved = deptStats.reduce((s, d) => s + d.approved, 0);
  const totalRejected = deptStats.reduce((s, d) => s + d.rejected, 0);
  const totalPending = deptStats.reduce((s, d) => s + d.pending, 0);
  const readinessPct = totalRequired > 0 ? Math.round((totalApproved / totalRequired) * 100) : 0;

  // All AI flags across all blocks
  const allFlags = useMemo(() => {
    const flags: any[] = [];
    for (const b of blocks) {
      if (Array.isArray(b.ai_flags)) {
        for (const f of b.ai_flags) {
          flags.push({ ...f, blockTitle: b.title || "Untitled", blockSection: b.section_number || "?" });
        }
      }
    }
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return flags.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
  }, [blocks]);

  const highFlags = allFlags.filter(f => f.severity === "high").length;

  if (blocks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No proposal blocks exist yet.</p>
        <p className="text-xs mt-1">Complete the Tender Drafting stage first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Department Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {deptStats.map(stat => {
          const Icon = DEPT_ICONS[stat.department];
          const colors = DEPT_COLORS[stat.department];
          const pct = stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0;
          return (
            <Card key={stat.department} className={`border ${colors.border} shadow-none`}>
              <CardHeader className={`py-3 px-4 ${colors.bg} border-b ${colors.border}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                  <span className={`text-sm font-semibold ${colors.text}`}>{DEPARTMENT_LABELS[stat.department]} Review</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{stat.approved}<span className="text-lg text-muted-foreground">/{stat.total}</span></span>
                  <span className="text-xs text-muted-foreground">blocks approved</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> {stat.approved} Approved</span>
                  <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> {stat.rejected} Rejected</span>
                  <span className="flex items-center gap-1 text-slate-500"><Clock className="w-3 h-3" /> {stat.pending} Pending</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Overall Readiness */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Overall Review Readiness</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 mb-3">
            <Progress value={readinessPct} className="h-3 flex-1" />
            <span className="text-lg font-bold">{readinessPct}%</span>
          </div>
          <div className="flex gap-4 text-xs">
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 gap-1">
              <CheckCircle2 className="w-3 h-3" /> {totalApproved} Approved
            </Badge>
            <Badge variant="outline" className="border-red-200 text-red-700 gap-1">
              <XCircle className="w-3 h-3" /> {totalRejected} Rejected
            </Badge>
            <Badge variant="outline" className="border-slate-200 text-slate-600 gap-1">
              <Clock className="w-3 h-3" /> {totalPending} Pending
            </Badge>
            {highFlags > 0 && (
              <Badge variant="outline" className="border-amber-200 text-amber-700 gap-1">
                <AlertTriangle className="w-3 h-3" /> {highFlags} Critical AI Flags
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Flags Summary */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">AI Review Flags</span>
            <Badge variant="outline" className="text-[8px]">{allFlags.length} flag{allFlags.length !== 1 ? "s" : ""}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {allFlags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No AI flags yet. Run departmental AI reviews first.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold w-16">Severity</th>
                    <th className="px-3 py-2 text-left font-semibold">Block</th>
                    <th className="px-3 py-2 text-left font-semibold w-20">Dept</th>
                    <th className="px-3 py-2 text-left font-semibold">Issue</th>
                    <th className="px-3 py-2 text-left font-semibold">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {allFlags.map((f, i) => (
                    <tr key={f.id || i} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={`text-[8px] ${f.severity === "high" ? "border-red-300 text-red-700 bg-red-50" : f.severity === "medium" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-slate-200 text-slate-600"}`}>
                          {f.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">§{f.blockSection} {f.blockTitle}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[8px]">{DEPARTMENT_LABELS[f.department as ReviewDepartment] || f.department}</Badge>
                      </td>
                      <td className="px-3 py-2">{f.issue}</td>
                      <td className="px-3 py-2 text-muted-foreground">{f.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
