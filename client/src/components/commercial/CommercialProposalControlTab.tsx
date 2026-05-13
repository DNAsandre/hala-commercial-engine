/**
 * CW-008: Proposal Control Mock Layer
 * Controlled proposal artifact linked to quote scenarios.
 * Mock-only — no real PDF, CRM, approval, or document generation.
 * SUPA-003B: Now reads from Supabase via useCommercialWorkspaceData.
 * SUPA-004: Actions now write to Supabase.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, AlertTriangle, Eye, Play, ShieldAlert,
  ChevronDown, ChevronRight, ArrowLeftRight, Link2, Info, Loader2, Database,
} from "lucide-react";
import { toast } from "sonner";
import { logMockAction, markProposalReviewedMock, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";
import {
  type CommercialProposalVersion, type CommercialNegotiationRound,
  getProposalsForWorkspace, getNegotiationsForProposal, getLinkedQuoteForProposal,
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

const reviewColor = (s: string) => {
  if (s.includes("Future Approval")) return "text-red-600 bg-red-50 border-red-200";
  if (s.includes("Needs")) return "text-amber-700 bg-amber-50 border-amber-200";
  if (s.includes("Mock Reviewed")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};

const gateColor = (s: string) => {
  if (s.includes("Would Require")) return "text-red-600 bg-red-50 border-red-200";
  if (s.includes("Warning")) return "text-amber-700 bg-amber-50 border-amber-200";
  if (s.includes("No Gate")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};

const escColor = (s: string) => {
  if (s.startsWith("Critical")) return "text-red-700 bg-red-100 border-red-300";
  if (s.startsWith("Red")) return "text-red-600 bg-red-50 border-red-200";
  if (s.startsWith("Amber")) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
};

const negStatusColor = (s: string) => {
  if (s === "Revised Proposal Needed") return "text-red-600 bg-red-50 border-red-200";
  if (s === "Awaiting Client") return "text-amber-700 bg-amber-50 border-amber-200";
  if (s === "Responded Mock" || s === "Closed Mock") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};

// ─── PROPOSAL CARD ─────────────────────────────────────────

function ProposalCard({ p, selected, onSelect }: { p: CommercialProposalVersion; selected: boolean; onSelect: () => void }) {
  const isRed = p.gpPercent < 10;
  return (
    <Card
      className={`border shadow-none transition-all cursor-pointer border-l-4 ${getGpBg(p.gpPercent)} ${selected ? "ring-2 ring-[var(--color-hala-navy)] bg-muted/20" : "hover:bg-muted/10"}`}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className={`w-3.5 h-3.5 ${selected ? "text-[var(--color-hala-navy)]" : "text-muted-foreground"}`} />
            <span className="text-sm font-semibold">{p.proposalName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px]">{p.version}</Badge>
            <Badge variant="outline" className={`text-[9px] ${statusColor(p.status)}`}>{p.status}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 text-xs mb-2">
          <div><span className="text-muted-foreground">Linked Quote</span><p className="font-medium truncate">{p.linkedQuoteScenarioName}</p></div>
          <div><span className="text-muted-foreground">GP%</span><p className={`font-bold ${getGpColor(p.gpPercent)}`}>{p.gpPercent}%</p></div>
          <div><span className="text-muted-foreground">Client-Facing</span><p className="font-medium">{p.clientFacingMock ? "Yes (Mock)" : "No"}</p></div>
          <div><span className="text-muted-foreground">Revenue</span><p className="font-medium">{formatSAR(p.revenue)}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><span className="text-muted-foreground">Review</span><p className="font-medium">{p.reviewStatus}</p></div>
          <div><span className="text-muted-foreground">Gate</span><p className="font-medium">{p.futureGateStatus}</p></div>
          <div><span className="text-muted-foreground">Escalation</span><p className="font-medium">{p.mockEscalationStatus}</p></div>
        </div>
        {isRed && (
          <div className="mt-2 p-2 rounded-md border border-red-200 bg-red-50 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <p className="text-[10px] text-red-700">Future Gate: production would require review before client-facing proposal. Current mode: mock only.</p>
          </div>
        )}
      </CardContent>
    </Card>
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
    if (result.success) { toast.success(`${title} saved to Supabase.`); onActionComplete?.(); }
    else { toast.error(`Mock action could not be saved: ${result.error}`); }
  };
  const linkedQuote = getLinkedQuoteForProposal(p);
  const isRed = p.gpPercent < 10;
  const isAmber = p.gpPercent >= 10 && p.gpPercent < 22;

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
      <CardContent className="pt-3 space-y-4">
        {/* Financial summary */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { label: "Revenue", value: formatSAR(p.revenue), color: "" },
            { label: "GP%", value: `${p.gpPercent}%`, color: getGpColor(p.gpPercent) },
            { label: "Margin Δ", value: p.marginDeltaFromQuote === 0 ? "No change" : `${p.marginDeltaFromQuote > 0 ? "+" : ""}${p.marginDeltaFromQuote}%`, color: p.marginDeltaFromQuote < 0 ? "text-red-600" : p.marginDeltaFromQuote > 0 ? "text-emerald-600" : "" },
            { label: "Type", value: p.proposalType, color: "" },
            { label: "Client-Facing", value: p.clientFacingMock ? "Yes (Mock)" : "No", color: "" },
            { label: "Owner", value: p.owner, color: "" },
          ].map(item => (
            <div key={item.label} className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Status badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-muted-foreground">Review Status</span><p className="mt-0.5"><Badge variant="outline" className={`text-[9px] ${reviewColor(p.reviewStatus)}`}>{p.reviewStatus}</Badge></p></div>
          <div><span className="text-muted-foreground">Future Gate</span><p className="mt-0.5"><Badge variant="outline" className={`text-[9px] ${gateColor(p.futureGateStatus)}`}>{p.futureGateStatus}</Badge></p></div>
          <div><span className="text-muted-foreground">Escalation</span><p className="mt-0.5"><Badge variant="outline" className={`text-[9px] ${escColor(p.mockEscalationStatus)}`}>{p.mockEscalationStatus}</Badge></p></div>
          <div><span className="text-muted-foreground">Linked Quote</span><p className="mt-0.5"><Badge variant="outline" className="text-[9px]">{p.linkedQuoteScenarioName}</Badge></p></div>
        </div>

        {/* Linked Quote Basis */}
        {linkedQuote && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-[var(--color-hala-navy)]" /> Linked Quote Basis</p>
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
        )}

        {/* Gate warning */}
        {isRed && (
          <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Future Gate: production would require commercial/finance/executive review before client-facing proposal. Current mode: mock warning only.</p>
              <p className="text-[10px] text-red-700 mt-0.5">Testing may continue. No real document will be generated.</p>
            </div>
          </div>
        )}
        {isAmber && (
          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Amber Review: future Commercial/Ops review would be required. Current mode: mock warning only.</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {p.notes && <div className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {p.notes}</div>}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-dashed">
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={async () => {
            if (workspaceId) {
              const result = await markProposalReviewedMock(p.id, workspaceId, p.proposalName, actor);
              if (result.success) { toast.success("Proposal review saved to Supabase."); onActionComplete?.(); }
              else { toast.error(`Mock action could not be saved: ${result.error}`); }
            } else { toast.info(`Mock review logged for "${p.version}". No external action taken.`); }
          }}>
            <Eye className="w-3.5 h-3.5" /> Review Proposal Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => mkAction('proposal_revision_mock', 'Create Revised Mock', `Mock revised proposal created from "${p.version}". No real document.`, 'PROPOSAL_REVISION_MOCK', 'Mock Revised')}>
            <ArrowLeftRight className="w-3.5 h-3.5" /> Create Revised Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => mkAction('proposal_preview_mock', 'Proposal Preview Mock', `Mock proposal preview generated for "${p.version}". No real PDF.`, 'PROPOSAL_PREVIEW_MOCK', 'Preview Generated')}>
            <FileText className="w-3.5 h-3.5" /> Proposal Preview Mock
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 text-blue-700 border-blue-200" onClick={() => mkAction('proposal_bypass_mock', 'Proposal Testing Bypass', `Continue for testing — no enforcement applied.`, 'PROPOSAL_BYPASS_MOCK', 'Testing Bypass')}>
            <Play className="w-3.5 h-3.5" /> Continue for Testing
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
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-[var(--color-hala-navy)]" /> Negotiation Loop Tracker
          <Badge variant="outline" className="text-[9px]">{rounds.length} round{rounds.length !== 1 ? "s" : ""}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
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
                <p className="text-[8px] font-semibold uppercase tracking-wider text-blue-700">Client Ask</p>
                <p className="mt-0.5">{r.clientAsk}</p>
              </div>
              <div className="bg-emerald-50/30 rounded p-1.5 border border-emerald-100">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-emerald-700">Hala Response</p>
                <p className="mt-0.5">{r.halaResponse}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Pricing Δ</span><p className="font-medium">{r.pricingChange}</p></div>
              <div><span className="text-muted-foreground">Margin Δ</span><p className="font-medium">{r.marginChange}</p></div>
              <div><span className="text-muted-foreground">Concession</span><p className="font-medium">{r.concessionReason}</p></div>
              <div><span className="text-muted-foreground">Approval Impact</span><p className="font-medium">{r.approvalImpact}</p></div>
            </div>
            {r.notes && <p className="text-[10px] text-muted-foreground"><span className="font-medium">Notes:</span> {r.notes}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── PROPOSAL COMPARISON ───────────────────────────────────

function ProposalComparisonSummary({ proposals }: { proposals: CommercialProposalVersion[] }) {
  if (proposals.length < 2) return null;
  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-[var(--color-hala-navy)]" /> Proposal Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-1 font-semibold">Version</th>
                <th className="text-left py-1 font-semibold">Linked Quote</th>
                <th className="text-right py-1 font-semibold">GP%</th>
                <th className="text-left py-1 font-semibold">Status</th>
                <th className="text-left py-1 font-semibold">Review</th>
                <th className="text-left py-1 font-semibold">Gate</th>
                <th className="text-left py-1 font-semibold">Escalation</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-1.5 font-semibold">{p.version}</td>
                  <td className="py-1.5 truncate max-w-[150px]">{p.linkedQuoteScenarioName}</td>
                  <td className={`py-1.5 text-right font-bold ${getGpColor(p.gpPercent)}`}>{p.gpPercent}%</td>
                  <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${statusColor(p.status)}`}>{p.status}</Badge></td>
                  <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${reviewColor(p.reviewStatus)}`}>{p.reviewStatus}</Badge></td>
                  <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${gateColor(p.futureGateStatus)}`}>{p.futureGateStatus}</Badge></td>
                  <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${escColor(p.mockEscalationStatus)}`}>{p.mockEscalationStatus}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────

interface Props {
  workspaceId: string;
  customerName?: string;
}

export default function CommercialProposalControlTab({ workspaceId, customerName }: Props) {
  const { bundle, status, reload } = useCommercialWorkspaceData(workspaceId);

  // SUPA-003B: Use Supabase-backed data when available, else fall back to in-memory mock
  const proposals = bundle ? bundle.proposals : getProposalsForWorkspace(workspaceId);
  const isSupabaseBacked = bundle?.supabaseBacked && bundle.proposals.length > 0;

  const [selectedId, setSelectedId] = useState<string>(proposals[0]?.id || "");
  const [detailExpanded, setDetailExpanded] = useState(true);

  const selected = proposals.find(p => p.id === selectedId) || proposals[0];
  const allNegotiations = bundle
    ? bundle.negotiations
    : proposals.flatMap(p => getNegotiationsForProposal(p.id));

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-hala-navy)]" />
        <span className="text-sm text-muted-foreground">Loading proposal data from Supabase…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-serif font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--color-hala-navy)]" /> Proposal Control
          </h3>
          <p className="text-xs text-muted-foreground">
            Mock proposal versions for {customerName || "this workspace"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseBacked && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><Database className="w-3 h-3 mr-1" />Supabase-Backed</Badge>}
          <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">CRM Sync: Mock / Not Connected</Badge>
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Development Mode</Badge>
        </div>
      </div>

      {/* Development banner */}
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: proposal controls are mock-only</div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Future gates show review requirements but do not block testing or generate real documents.
                No real PDF, CRM sync, approval enforcement, or document locking is active. "Proposal Preview Mock" does not create a real document.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposal version cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Proposal Versions</h4>
          <Badge variant="outline" className="text-[9px]">{proposals.length} version{proposals.length !== 1 ? "s" : ""}</Badge>
        </div>
        {proposals.map(p => (
          <ProposalCard key={p.id} p={p} selected={selectedId === p.id} onSelect={() => setSelectedId(p.id)} />
        ))}
      </div>

      {/* Selected detail */}
      {selected && (
        <div>
          <button
            className="flex items-center gap-1.5 text-sm font-semibold mb-2 hover:text-[var(--color-hala-navy)] transition-colors"
            onClick={() => setDetailExpanded(!detailExpanded)}
          >
            {detailExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Selected Proposal Detail
          </button>
          {detailExpanded && (
            <div className="space-y-4">
              <ProposalDetailPanel p={selected} workspaceId={workspaceId} onActionComplete={reload} />
              <NegotiationTracker rounds={allNegotiations.sort((a, b) => a.roundNumber - b.roundNumber)} />
            </div>
          )}
        </div>
      )}

      {/* Proposal comparison */}
      <ProposalComparisonSummary proposals={proposals} />

      {/* Info footer */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800">
          All proposal controls are mock-only for development. Proposal versions, negotiation rounds, and future gates
          show decision paths but do not generate real documents, sync with CRM, or enforce approvals.
        </p>
      </div>
    </div>
  );
}
