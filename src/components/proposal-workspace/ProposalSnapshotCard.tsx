/**
 * ProposalSnapshotCard — Compact proposal summary for the main workspace.
 * Replaces the oversized CommercialProposalControlTab in the Overview flow.
 * Full version management stays in the Proposals tab.
 */
import { FileText, ExternalLink, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CommercialProposalVersion,
  getProposalsForWorkspace,
} from "@/lib/commercial-workspace-data";
import { useCommercialWorkspaceData } from "@/hooks/useCommercialWorkspaceData";

function getGpColor(gp: number): string {
  if (gp >= 22) return "text-emerald-600";
  if (gp >= 10) return "text-amber-600";
  return "text-red-600";
}

function formatSAR(v: number): string {
  return `SAR ${(v / 1000000).toFixed(2)}M`;
}

interface Props {
  workspaceId: string;
  onOpenProposalsTab?: () => void;
}

export default function ProposalSnapshotCard({ workspaceId, onOpenProposalsTab }: Props) {
  const { bundle } = useCommercialWorkspaceData(workspaceId);
  const proposals = bundle ? bundle.proposals : getProposalsForWorkspace(workspaceId);

  if (proposals.length === 0) {
    return (
      <Card className="border border-border shadow-none">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No proposal versions yet</span>
          </div>
          {onOpenProposalsTab && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onOpenProposalsTab}>
              Open Proposals Tab <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Find the active/latest proposal
  const active = proposals.find(p => p.status.includes("Client-Facing")) 
    || proposals.find(p => !p.status.includes("Superseded"))
    || proposals[proposals.length - 1];

  const statusColor = active.status.includes("Client-Facing")
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : active.status.includes("Negotiation")
      ? "bg-[#075eea]/10 text-[#075eea] border-[#075eea]/20"
      : active.status.includes("Reviewed")
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-hala-navy)]" />
            <span className="text-sm font-semibold">Proposal Snapshot</span>
            <Badge variant="outline" className="text-[9px]">{proposals.length} version{proposals.length !== 1 ? "s" : ""}</Badge>
          </div>
          <Badge variant="outline" className={`text-[9px] ${statusColor}`}>{active.status}</Badge>
        </div>

        {/* Compact metrics grid */}
        <div className="grid grid-cols-6 gap-2">
          {[
            { label: "Active Version", value: active.version },
            { label: "Linked Quote", value: active.linkedQuoteScenarioName, truncate: true },
            { label: "GP%", value: `${active.gpPercent}%`, color: getGpColor(active.gpPercent) },
            { label: "Revenue", value: formatSAR(active.revenue) },
            { label: "Client-Facing", value: active.clientFacingMock ? "Yes" : "No" },
            { label: "Last Updated", value: active.lastUpdated || "—" },
          ].map(m => (
            <div key={m.label} className="bg-muted/20 rounded-lg p-2">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</p>
              <p className={`text-xs font-bold mt-0.5 ${m.color || ""} ${m.truncate ? "truncate" : ""}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onOpenProposalsTab && (
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onOpenProposalsTab}>
              <FileText className="w-3 h-3" /> View All Versions
            </Button>
          )}
          {onOpenProposalsTab && (
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={onOpenProposalsTab}>
              <ExternalLink className="w-3 h-3" /> Open Proposals Tab
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
