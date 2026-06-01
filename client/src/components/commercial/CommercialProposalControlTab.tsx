/**
 * CW-008: Proposal Control — Full Management Tab
 * Lives inside the Proposals global tab for deep proposal management.
 *
 * Contains: version archive, detail panel, negotiation tracker, comparison.
 * All dev-mode banners removed from core flow (collapsed tech note only).
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Eye, ArrowLeftRight, Link2, Loader2, Database,
  ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { toast } from "sonner";
import { logMockAction, markProposalReviewedMock, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";
import {
  type CommercialProposalVersion, type CommercialNegotiationRound,
} from "@/lib/commercial-workspace-data";
import { useCommercialWorkspaceData } from "@/hooks/useCommercialWorkspaceData";

// ─── HELPERS ───────────────────────────────────────────────

function getGpColor(gp: number): string {
  if (gp >= 22) return "text-emerald-600";
  if (gp >= 10) return "text-amber-600";
  return "text-red-600";
}

function getGpBg(gp: number): string {
  if (gp >= 22) return "border-l-emerald-400";
  if (gp >= 10) return "border-l-amber-400";
  return "border-l-red-400";
}

function formatSAR(v: number): string {
  return `SAR ${(v / 1000000).toFixed(2)}M`;
}

const statusColor = (s: string) => {
  if (s.includes("Client-Facing")) return "text-blue-700 bg-blue-50 border-blue-200";
  if (s.includes("Negotiation")) return "text-violet-700 bg-violet-50 border-violet-200";
  if (s.includes("Reviewed")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (s.includes("Superseded")) return "text-slate-500 bg-slate-50 border-slate-200";
  if (s.includes("Drafting") || s.includes("Draft")) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};

const negStatusColor = (s: string) => {
  if (s === "Revised Proposal Needed") return "text-red-600 bg-red-50 border-red-200";
  if (s === "Awaiting Client") return "text-amber-700 bg-amber-50 border-amber-200";
  if (s === "Responded Mock" || s === "Closed Mock") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};

// ─── COMPACT VERSION ROW ──────────────────────────────────

function ProposalVersionRow({ p, selected, onSelect }: { p: CommercialProposalVersion; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border border-l-4 p-3 transition-all ${getGpBg(p.gpPercent)} ${
        selected ? "ring-2 ring-[var(--color-hala-navy)] bg-muted/20" : "hover:bg-muted/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className={`w-3.5 h-3.5 ${selected ? "text-[var(--color-hala-navy)]" : "text-muted-foreground"}`} />
          <span className="text-sm font-semibold">{p.proposalName}</span>
          <Badge variant="outline" className="text-[9px]">{p.version}</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${getGpColor(p.gpPercent)}`}>{p.gpPercent}%</span>
          <Badge variant="outline" className={`text-[9px] ${statusColor(p.status)}`}>{p.status}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
        <span>Quote: {p.linkedQuoteScenarioName}</span>
        <span>Revenue: {formatSAR(p.revenue)}</span>
        <span>Client-Facing: {p.clientFacingMock ? "Yes" : "No"}</span>
      </div>
    </button>
  );
}

// ─── DETAIL PANEL ──────────────────────────────────────────

function ProposalDetailPanel({ p, workspaceId, onActionComplete }: { p: CommercialProposalVersion; workspaceId?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };
  
  const mkAction = async (eventType: string, title: string, desc: string, code: string, after: string) => {
    if (!workspaceId) { toast.info(`${title}. No backend update.`); return; }
    const result = await logMockAction(
      { workspaceId, eventType, title, description: desc, category: 'Proposal', actor, severity: 'Info', relatedArtifact: p.proposalName, relatedModule: 'Proposal Control', relatedScenarioId: p.linkedQuoteScenarioId },
      { workspaceId, eventCode: code, eventName: title, description: desc, category: 'PROPOSAL', actor, entityType: 'Proposal', entityName: p.proposalName, beforeState: p.reviewStatus, afterState: after, severity: 'Info' }
    );
    if (result.success) { toast.success(`${title} saved.`); onActionComplete?.(); }
    else { toast.error(`Action could not be saved: ${result.error}`); }
  };
  const linkedQuote = null as {
    name: string;
    gpPercent: number;
    pricingPosture: string;
    capacityFit: string;
    customerScore: string;
    revenueTiming: string;
  } | null;

  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--color-hala-navy)]" />
            {p.proposalName} — {p.version}
          </CardTitle>
          <Badge variant="outline" className={`text-[10px] ${statusColor(p.status)}`}>{p.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {/* Financial summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: "Revenue", value: formatSAR(p.revenue) },
            { label: "GP%", value: `${p.gpPercent}%`, color: getGpColor(p.gpPercent) },
            { label: "Margin Δ", value: p.marginDeltaFromQuote === 0 ? "No change" : `${p.marginDeltaFromQuote > 0 ? "+" : ""}${p.marginDeltaFromQuote}%`, color: p.marginDeltaFromQuote < 0 ? "text-red-600" : p.marginDeltaFromQuote > 0 ? "text-emerald-600" : "" },
            { label: "Type", value: p.proposalType },
            { label: "Client-Facing", value: p.clientFacingMock ? "Yes" : "No" },
            { label: "Owner", value: p.owner },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-2">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`text-xs font-bold mt-0.5 ${item.color || ""}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Linked Quote Basis */}
        {linkedQuote && (
          <details className="rounded-lg border border-slate-200 bg-slate-50/50">
            <summary className="p-2.5 cursor-pointer text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100/50 rounded-lg">
              <Link2 className="w-3.5 h-3.5 text-[var(--color-hala-navy)]" /> Linked Quote Basis
            </summary>
            <div className="px-2.5 pb-2.5">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                {[
                  { label: "Quote", value: linkedQuote.name },
                  { label: "GP%", value: `${linkedQuote.gpPercent}%` },
                  { label: "Posture", value: linkedQuote.pricingPosture },
                  { label: "Capacity", value: linkedQuote.capacityFit },
                  { label: "Customer", value: linkedQuote.customerScore },
                  { label: "Timing", value: linkedQuote.revenueTiming },
                ].map(f => (
                  <div key={f.label} className="bg-white rounded p-1.5">
                    <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                    <p className="font-medium mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        )}

        {/* Notes */}
        {p.notes && <div className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {p.notes}</div>}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={async () => {
            if (workspaceId) {
              const result = await markProposalReviewedMock(p.id, workspaceId, p.proposalName, actor);
              if (result.success) { toast.success("Proposal review saved."); onActionComplete?.(); }
              else { toast.error(`Action could not be saved: ${result.error}`); }
            } else { toast.info(`Review logged for "${p.version}".`); }
          }}>
            <Eye className="w-3 h-3" /> Review Proposal
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction('proposal_revision_mock', 'Create Revision', `Revised proposal from "${p.version}".`, 'PROPOSAL_REVISION', 'Revised')}>
            <ArrowLeftRight className="w-3 h-3" /> Create Revision
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => mkAction('proposal_preview_mock', 'Generate PDF', `PDF preview for "${p.version}".`, 'PROPOSAL_PDF', 'PDF Generated')}>
            <FileText className="w-3 h-3" /> Generate PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── NEGOTIATION TRACKER ───────────────────────────────────

function NegotiationTracker({ rounds }: { rounds: CommercialNegotiationRound[] }) {
  if (rounds.length === 0) return null;
  return (
    <details className="border rounded-lg">
      <summary className="p-3 cursor-pointer hover:bg-muted/30 rounded-lg">
        <span className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-[var(--color-hala-navy)]" /> Negotiation Rounds
          <Badge variant="outline" className="text-[9px]">{rounds.length}</Badge>
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-2 border-t pt-2">
        {rounds.map(r => (
          <div key={r.id} className="rounded-lg border p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Round {r.roundNumber}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={`text-[9px] ${negStatusColor(r.status)}`}>{r.status}</Badge>
                <span className="text-[9px] text-muted-foreground">{r.lastUpdated}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-blue-50/30 rounded p-1.5 border border-blue-100">
                <p className="text-[8px] font-semibold uppercase text-blue-700">Client Ask</p>
                <p className="mt-0.5">{r.clientAsk}</p>
              </div>
              <div className="bg-emerald-50/30 rounded p-1.5 border border-emerald-100">
                <p className="text-[8px] font-semibold uppercase text-emerald-700">Hala Response</p>
                <p className="mt-0.5">{r.halaResponse}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Pricing Δ</span><p className="font-medium">{r.pricingChange}</p></div>
              <div><span className="text-muted-foreground">Margin Δ</span><p className="font-medium">{r.marginChange}</p></div>
              <div><span className="text-muted-foreground">Concession</span><p className="font-medium">{r.concessionReason}</p></div>
              <div><span className="text-muted-foreground">Approval</span><p className="font-medium">{r.approvalImpact}</p></div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

// ─── COMPARISON TABLE ──────────────────────────────────────

function ProposalComparisonTable({ proposals }: { proposals: CommercialProposalVersion[] }) {
  if (proposals.length < 2) return null;
  return (
    <details className="border rounded-lg">
      <summary className="p-3 cursor-pointer hover:bg-muted/30 rounded-lg">
        <span className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-[var(--color-hala-navy)]" /> Version Comparison
          <Badge variant="outline" className="text-[9px]">{proposals.length} versions</Badge>
        </span>
      </summary>
      <div className="px-3 pb-3 border-t pt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-1 font-semibold">Version</th>
              <th className="text-left py-1 font-semibold">Linked Quote</th>
              <th className="text-right py-1 font-semibold">GP%</th>
              <th className="text-left py-1 font-semibold">Status</th>
              <th className="text-left py-1 font-semibold">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map(p => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-1.5 font-semibold">{p.version}</td>
                <td className="py-1.5 truncate max-w-[150px]">{p.linkedQuoteScenarioName}</td>
                <td className={`py-1.5 text-right font-bold ${getGpColor(p.gpPercent)}`}>{p.gpPercent}%</td>
                <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${statusColor(p.status)}`}>{p.status}</Badge></td>
                <td className="py-1.5">{formatSAR(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────

interface Props {
  workspaceId: string;
  customerName?: string;
}

export default function CommercialProposalControlTab({ workspaceId, customerName }: Props) {
  const { bundle, status, reload } = useCommercialWorkspaceData(workspaceId);
  const proposals = bundle?.proposals ?? [];
  const isSupabaseBacked = bundle?.supabaseBacked && bundle.proposals.length > 0;

  const [selectedId, setSelectedId] = useState<string>(proposals[0]?.id || "");
  const selected = proposals.find(p => p.id === selectedId) || proposals[0];
  const allNegotiations = bundle?.negotiations ?? [];

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-hala-navy)]" />
        <span className="text-sm text-muted-foreground">Loading proposal data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-serif font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--color-hala-navy)]" /> Proposal Management
          </h3>
          <p className="text-xs text-muted-foreground">
            Version archive, comparison, and negotiation history for {customerName || "this workspace"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseBacked && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><Database className="w-3 h-3 mr-1" />Supabase</Badge>}
          <Badge variant="outline" className="text-[9px]">{proposals.length} version{proposals.length !== 1 ? "s" : ""}</Badge>
        </div>
      </div>

      {/* Version list — compact rows */}
      <div className="space-y-2">
        {proposals.length > 0 ? (
          proposals.map(p => (
            <ProposalVersionRow key={p.id} p={p} selected={selectedId === p.id} onSelect={() => setSelectedId(p.id)} />
          ))
        ) : (
          <Card className="border shadow-none">
            <CardContent className="p-4 text-sm text-muted-foreground">
              No verified proposal versions are linked to this workspace yet.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected detail */}
      {selected && (
        <ProposalDetailPanel p={selected} workspaceId={workspaceId} onActionComplete={reload} />
      )}

      {/* Negotiation tracker — collapsible */}
      <NegotiationTracker rounds={allNegotiations.sort((a, b) => a.roundNumber - b.roundNumber)} />

      {/* Comparison — collapsible */}
      <ProposalComparisonTable proposals={proposals} />

      {/* Dev tech note — collapsed by default */}
      <details className="text-[10px] text-muted-foreground/60">
        <summary className="cursor-pointer hover:text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" /> Technical Note
        </summary>
        <p className="mt-1 pl-4">
          Proposal controls operate in development mode. Future gates, CRM sync, and document generation are simulated.
        </p>
      </details>
    </div>
  );
}
