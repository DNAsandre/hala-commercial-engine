import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileCheck,
  FileText,
  Handshake,
  Info,
  ListChecks,
  Pencil,
  Plus,
  Scale,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-state";
import { PROPOSAL_TRACKER_STAGES, getProposalStageIndex, getProposalStageLabel, getProposalStage } from "@/components/proposal-workspace/proposal-stages";
import ProposalStageWorkbench from "@/components/proposal-workspace/ProposalStageWorkbench";
import {
  type ProposalWorkspaceData,
  createDefaultWorkspaceData,
  calcQualificationReadiness,
  calcDiscoveryCompleteness,
  calcSolutionReadiness,
  calcPricingConfidence,
  generateSignals,
  type PnlVersion,
} from "@/components/proposal-workspace/proposal-workspace-state";
// types are local to this module

// ─── STAGES ───────────────────────────────────────────────────

const PROPOSAL_STAGES = [
  { key: "prospecting",      label: "Prospecting",       color: "slate" },
  { key: "research",         label: "Research",           color: "blue" },
  { key: "qualification",    label: "Qualification",      color: "cyan" },
  { key: "meeting",          label: "Meeting",            color: "indigo" },
  { key: "client_interest",  label: "Client Interest",    color: "violet" },
  { key: "design_solution",  label: "Design Solution",    color: "purple" },
  { key: "determine_pnl",    label: "Determine P&L",      color: "fuchsia" },
  { key: "prepare_proposal", label: "Prepare Proposal",   color: "amber" },
  { key: "approval",         label: "Approval",           color: "orange" },
  { key: "negotiation",      label: "Negotiation",        color: "rose" },
  { key: "contract",         label: "Contract",           color: "emerald" },
];

const STAGE_COLORS: Record<string, string> = {
  // Legacy stages (existing proposals)
  prospecting:       "bg-slate-100 text-slate-700 border-slate-200",
  research:          "bg-blue-50 text-blue-700 border-blue-200",
  qualification:     "bg-cyan-50 text-cyan-700 border-cyan-200",
  meeting:           "bg-indigo-50 text-indigo-700 border-indigo-200",
  client_interest:   "bg-violet-50 text-violet-700 border-violet-200",
  design_solution:   "bg-purple-50 text-purple-700 border-purple-200",
  determine_pnl:     "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  prepare_proposal:  "bg-amber-50 text-amber-700 border-amber-200",
  approval:          "bg-orange-50 text-orange-700 border-orange-200",
  negotiation:       "bg-rose-50 text-rose-700 border-rose-200",
  contract:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  // New proposal tracker stages
  qualified:          "bg-blue-50 text-blue-700 border-blue-200",
  discovery:          "bg-cyan-50 text-cyan-700 border-cyan-200",
  solution_design:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  pnl_pricing:        "bg-violet-50 text-violet-700 border-violet-200",
  quote:              "bg-emerald-50 text-emerald-700 border-emerald-200",
  proposal_drafting: "bg-teal-50 text-teal-700 border-teal-200",
  proposal_sent:      "bg-sky-50 text-sky-700 border-sky-200",
  negotiation_stage: "bg-amber-50 text-amber-700 border-amber-200",
  commercial_approval:"bg-orange-50 text-orange-700 border-orange-200",
  contract_signed:    "bg-green-50 text-green-700 border-green-200",
  go_live:            "bg-rose-50 text-rose-700 border-rose-200",
  // Outcomes
  won:               "bg-emerald-100 text-emerald-800 border-emerald-300",
  lost:              "bg-red-50 text-red-700 border-red-200",
  open:              "bg-blue-50 text-blue-700 border-blue-200",
};

const OUTCOME_COLORS: Record<string, string> = {
  won:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost:   "bg-red-50 text-red-700 border-red-200",
  open:   "bg-blue-50 text-blue-700 border-blue-200",
};

function stageLabel(s: string) {
  return PROPOSAL_TRACKER_STAGES.find(p => p.key === s)?.label
    ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── RPC ───────────────────────────────────────────────────────

async function rpcUpdateProposalStage(id: string, newStage: string, userName: string, skip = false, notes = "") {
  const { data, error } = await supabase.rpc("commercial_v2_update_proposal_stage", {
    p_proposal_id: id,
    p_new_stage: newStage,
    p_user_name: userName,
    p_skip: skip,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

async function rpcUpdatePnL(id: string, gpPercent: number, volumePallets: number, volumeSar: number, pnlNotes: string) {
  const { data, error } = await supabase.rpc("commercial_v2_update_proposal_pnl", {
    p_proposal_id: id,
    p_gp_percent: gpPercent,
    p_volume_pallets: volumePallets,
    p_volume_sar: volumeSar,
    p_pnl_notes: pnlNotes,
  });
  if (error) throw error;
  return data;
}

async function rpcSetOutcome(id: string, outcome: string, notes: string) {
  const { data, error } = await supabase.rpc("commercial_v2_set_proposal_outcome", {
    p_proposal_id: id,
    p_outcome: outcome,
    p_outcome_notes: notes,
  });
  if (error) throw error;
  return data;
}

async function rpcLogActivity(entityType: string, entityId: string, action: string, notes: string, userName: string) {
  await supabase.rpc("commercial_v2_log_activity", {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_action: action,
    p_notes: notes,
    p_user_name: userName,
  });
}

async function rpcSavePnlVersion(
  proposalId: string,
  name: string,
  notes: string,
  isApproved: boolean,
  overheadPercent: number,
  revenueLines: { label: string; amount: number }[],
  costLines: { label: string; amount: number }[]
) {
  const { data, error } = await supabase.rpc("commercial_v2_save_proposal_pnl_version", {
    p_proposal_id: proposalId,
    p_name: name,
    p_notes: notes,
    p_is_approved: isApproved,
    p_overhead_percent: overheadPercent,
    p_revenue_lines: JSON.stringify(revenueLines),
    p_cost_lines: JSON.stringify(costLines),
  });
  if (error) throw error;
  return data;
}

async function rpcSyncProposalToCrm(proposalId: string, syncType: string, notes: string) {
  const { data, error } = await supabase.rpc("commercial_v2_sync_proposal_to_crm", {
    p_proposal_id: proposalId,
    p_sync_type: syncType,
    p_notes: notes,
  });
  if (error) throw error;
  return data;
}

// ─── STAGE TRACKER ─────────────────────────────────────────────

function StageTracker({ proposal, onRefresh }: { proposal: V2Proposal; onRefresh: () => void }) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [notes, setNotes] = useState("");
  const [skip, setSkip] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentIdx = PROPOSAL_TRACKER_STAGES.findIndex(s => s.key === proposal.stage);

  async function handleMove() {
    if (!newStage) return;
    setSubmitting(true);
    try {
      await rpcUpdateProposalStage(proposal.id, newStage, user?.name || "system", skip, notes);
      setOpen(false);
      setNewStage("");
      setNotes("");
      setSkip(false);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" /> Advance Stage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Advance Stage — {proposal.customer_name}</DialogTitle>
          <DialogDescription>
            Moving from <strong>{stageLabel(proposal.stage)}</strong>.
            Stage skip is allowed — logged in activity timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target Stage</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {PROPOSAL_TRACKER_STAGES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setNewStage(s.key)}
                  className={`rounded border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                    newStage === s.key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : `${s.bgColor} ${s.color} ${s.borderColor}`
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="skip-proposal" checked={skip} onChange={e => setSkip(e.target.checked)} className="accent-indigo-600" />
            <Label htmlFor="skip-proposal" className="text-xs">Skip stage (log as skipped)</Label>
          </div>
          <Textarea placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={!newStage || submitting}>
              {submitting ? "Moving..." : "Move to " + (PROPOSAL_TRACKER_STAGES.find(s => s.key === newStage)?.label || newStage)}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── P&L EDITOR ───────────────────────────────────────────────

function PnLEditor({ proposal, onSaved }: { proposal: V2Proposal; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [gpPercent, setGpPercent] = useState(proposal.gp_percent || 0);
  const [volumePallets, setVolumePallets] = useState(proposal.volume_pallets || 0);
  const [volumeSar, setVolumeSar] = useState(proposal.volume_sar || 0);
  const [pnlNotes, setPnlNotes] = useState(proposal.pnl_notes || "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      await rpcUpdatePnL(proposal.id, gpPercent, volumePallets, volumeSar, pnlNotes);
      setOpen(false);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <DollarSign className="h-3.5 w-3.5" /> Edit P&L
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>P&L — {proposal.customer_name}</DialogTitle>
          <DialogDescription>GP% and volume inputs. Approval matrix derives from these values.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">GP Margin %</Label>
              <Input type="number" value={gpPercent} onChange={e => setGpPercent(parseFloat(e.target.value) || 0)} step="0.1" min="0" max="100" />
              <p className="text-[10px] text-muted-foreground">Enter 0–100</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Volume (Pallets)</Label>
              <Input type="number" value={volumePallets} onChange={e => setVolumePallets(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Volume (SAR)</Label>
            <Input type="number" value={volumeSar} onChange={e => setVolumeSar(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">P&L Notes</Label>
            <Textarea value={pnlNotes} onChange={e => setPnlNotes(e.target.value)} rows={3} placeholder="Notes on cost assumptions, margin targets..." />
          </div>
          {gpPercent > 0 && (
            <div className={`rounded border px-3 py-2 text-xs ${gpPercent < 10 ? "border-red-200 bg-red-50 text-red-700" : gpPercent < 22 ? "border-amber-200 bg-amber-50 text-amber-700" : gpPercent < 25 ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {gpPercent < 22
              ? <AlertTriangle className="h-3.5 w-3.5 inline mr-1" /> : <CheckSquare className="h-3.5 w-3.5 inline mr-1" />}
              GP% = {gpPercent}% — {gpPercent < 10 ? "Full chain: CEO/CFO + Directors" : gpPercent < 22 ? "Directors + Regional Ops" : gpPercent < 25 ? "Regional Ops + Regional Sales" : "Salesman + Regional Sales"}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>{submitting ? "Saving..." : "Save P&L"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── OUTCOME SELECTOR ──────────────────────────────────────────

function OutcomeSelector({ proposal, onSaved }: { proposal: V2Proposal; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState(proposal.outcome || "open");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSet() {
    setSubmitting(true);
    try {
      await rpcSetOutcome(proposal.id, outcome, outcomeNotes);
      setOpen(false);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          {proposal.outcome ? (
            <Badge variant="outline" className={`text-[10px] ${OUTCOME_COLORS[proposal.outcome] || ""}`}>{proposal.outcome}</Badge>
          ) : (
            <span className="text-[10px] text-muted-foreground">Set Outcome</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Outcome — {proposal.customer_name}</DialogTitle>
          <DialogDescription>Set the final outcome. Open means still active.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["open", "won", "lost"] as const).map(o => (
              <Button
                key={o}
                variant={outcome === o ? "default" : "outline"}
                onClick={() => setOutcome(o)}
                className="flex-1 capitalize"
              >
                {o}
              </Button>
            ))}
          </div>
          <Textarea placeholder="Outcome notes..." value={outcomeNotes} onChange={e => setOutcomeNotes(e.target.value)} rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSet} disabled={submitting}>{submitting ? "Setting..." : "Set Outcome"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── MEETING NOTES ────────────────────────────────────────────

function MeetingNotesPanel({ proposalId }: { proposalId: string }) {
  const [notes, setNotes] = useState("");
  const user = getCurrentUser();

  async function handleAddNote() {
    if (!notes.trim()) return;
    try {
      await rpcLogActivity("proposal", proposalId, "note_added", notes.trim(), user?.name || "system");
      setNotes("");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add a meeting note..."
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="text-xs"
      />
      <Button size="sm" variant="outline" onClick={handleAddNote} disabled={!notes.trim()}>
        <Plus className="h-3 w-3 mr-1" /> Add Note
      </Button>
    </div>
  );
}

// ─── PROPOSAL LIST ─────────────────────────────────────────────

function ProposalList({ onSelect }: { onSelect: (p: V2Proposal) => void }) {
  const [proposals, setProposals] = useState<V2Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("commercial_v2_proposals").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setProposals(data || []); setLoading(false); });
  }, []);

  if (loading) return <div className="py-8 text-center text-xs text-muted-foreground">Loading proposals...</div>;
  if (proposals.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground mb-3">No proposals yet</p>
        <p className="text-[10px] text-muted-foreground">Convert a lead from Pipeline V.2 to see it here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {proposals.map(p => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
        >
          <div>
            <div className="font-medium text-sm">{p.customer_name || "Unnamed"}</div>
            <div className="text-[10px] text-muted-foreground">
              Stage: {stageLabel(p.stage)} · Created: {new Date(p.created_at).toLocaleDateString()}
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[p.stage] || ""}`}>
            {stageLabel(p.stage)}
          </Badge>
        </button>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────

interface V2Proposal {
  id: string; v2_ticket_id: string; customer_name: string; contact_name: string;
  stage: string; gp_percent: number; volume_pallets: number; volume_sar: number;
  pnl_notes: string; has_proposal_draft: boolean; has_pricing_sheet: boolean;
  has_sla_draft: boolean; has_contract_draft: boolean;
  design_solution_notes: string; negotiation_notes: string; contract_status: string;
  outcome: string | null; outcome_notes: string;
  customer_master_id: string | null; legacy_workspace_id: string | null;
  pipeline_stage: string;
  lead_owner: string;
  region: string;
  created_at: string; updated_at: string;
}

export default function ProposalV2() {
  const [proposal, setProposal] = useState<V2Proposal | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [wsData, setWsData] = useState(() => createDefaultWorkspaceData());

  function handleSelect(p: V2Proposal) {
    setProposal(p);
  }

  async function loadProposalDetails() {
    if (!proposal) return;
    const [{ data: acts }] = await Promise.all([
      supabase.from("commercial_v2_activity")
        .select("*").eq("entity_type", "proposal").eq("entity_id", proposal.id)
        .order("created_at", { ascending: false }).limit(30),
    ]);
    setActivities(acts || []);
  }

  useEffect(() => { loadProposalDetails(); }, [proposal?.id, refreshKey]);

  function handleRefresh() { setRefreshKey(k => k + 1); loadProposalDetails(); }

  // Derived signals from workspace data
  const signals = proposal ? generateSignals(wsData) : [];

  async function handleSavePnlVersion(proposalId: string, version: PnlVersion) {
    if (!proposalId) return;
    try {
      await rpcSavePnlVersion(
        proposalId,
        version.name,
        version.notes,
        version.isApproved,
        version.overheadPercent,
        version.revenue,
        version.costs,
      );
    } catch (e) {
      console.error("Failed to persist P&L version:", e);
    }
  }

  if (!proposal) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-xl px-6 py-6">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              <h1 className="text-base font-semibold">Proposal V.2</h1>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">BETA</Badge>
            </div>
            <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 mb-4 flex gap-3 text-[10px] text-amber-700">
              <Shield className="h-3 w-3" /> Soft workflow — no hard gates
            </div>
            <Card className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Select or Create Proposal</CardTitle>
              </CardHeader>
              <CardContent>
                <ProposalList onSelect={handleSelect} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const docCount = [proposal.has_proposal_draft, proposal.has_pricing_sheet, proposal.has_sla_draft, proposal.has_contract_draft].filter(Boolean).length;
  // Default tracker to the first new-tracker stage that makes sense for the proposal's internal state
  const [activeTrackerStage, setActiveTrackerStage] = useState(() => {
    // Try to match the proposal's internal stage to a tracker stage key
    const match = PROPOSAL_TRACKER_STAGES.find(s => s.key === proposal.stage);
    return match ? match.key : "qualified";
  });
  const trackerIdx = getProposalStageIndex(activeTrackerStage);
  const pipelineStage = proposal.pipeline_stage || "prospecting";
  const pipelineLabel = pipelineStage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Proposal Workspace */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6 space-y-4">
          {/* ─── WORKSPACE HEADER ─────────────────────────── */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h1 className="text-lg font-semibold">{proposal.customer_name}</h1>
                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">PROPOSAL</Badge>
                {proposal.outcome && <Badge variant="outline" className={`text-[10px] ${OUTCOME_COLORS[proposal.outcome] || ""}`}>{proposal.outcome}</Badge>}
              </div>
              <div className="flex items-center gap-1.5">
                <StageTracker proposal={proposal} onRefresh={handleRefresh} />
                <OutcomeSelector proposal={proposal} onSaved={handleRefresh} />
                <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>← Back</Button>
              </div>
            </div>
            {/* Key info row */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded border px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">CRM Pipeline</div>
                <div className="text-sm font-semibold text-indigo-700 mt-0.5">{pipelineLabel}</div>
              </div>
              <div className="rounded border px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Internal Stage</div>
                <div className="text-sm font-semibold mt-0.5">{stageLabel(proposal.stage)}</div>
              </div>
              <div className="rounded border px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">GP%</div>
                <div className={`text-sm font-semibold mt-0.5 ${proposal.gp_percent < 10 ? "text-red-700" : proposal.gp_percent < 22 ? "text-amber-700" : "text-emerald-700"}`}>{proposal.gp_percent || 0}%</div>
              </div>
              <div className="rounded border px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Value (SAR)</div>
                <div className="text-sm font-semibold mt-0.5">{proposal.volume_sar ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(proposal.volume_sar) : "—"}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span>Owner: <strong className="text-foreground">{proposal.lead_owner || "—"}</strong></span>
              <span>Region: <strong className="text-foreground">{proposal.region || "—"}</strong></span>
              <span>Contact: <strong className="text-foreground">{proposal.contact_name || "—"}</strong></span>
              <span>Docs: <strong className="text-foreground">{docCount}/4</strong></span>
              <span>Updated: <strong className="text-foreground">{new Date(proposal.updated_at).toLocaleDateString()}</strong></span>
            </div>
          </div>

          {/* ─── DOCTRINE BANNER ──────────────────────────── */}
          <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-3 text-[10px] text-amber-700">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Soft workflow — no hard gates</span>
            <span>• CRM and internal stages are independent</span>
            <span>• Stage skip allowed — logged</span>
            <span>• Override always available</span>
          </div>

          {/* ─── 11-STAGE PROPOSAL PROCESS TRACKER ─────────── */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Internal Proposal Tracker</p>
              <Badge variant="outline" className="text-[9px]">{getProposalStageLabel(activeTrackerStage)} selected</Badge>
            </div>
            <div className="flex items-center gap-0.5">
              {PROPOSAL_TRACKER_STAGES.map((s, i) => {
                const stage = getProposalStage(s.key);
                const isActive = s.key === activeTrackerStage;
                const isCurrent = i <= trackerIdx;
                return (
                  <button
                    key={s.key}
                    onClick={() => setActiveTrackerStage(s.key)}
                    className={`flex-1 py-1.5 rounded text-[8px] font-medium transition-all border ${
                      isActive
                        ? `${stage?.bgColor} ${stage?.color} ${stage?.borderColor} ring-2 ring-offset-1 ring-indigo-300`
                        : isCurrent
                        ? `${stage?.bgColor} ${stage?.color} ${stage?.borderColor} opacity-80 hover:opacity-100`
                        : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                    }`}
                    title={s.label}
                  >
                    {s.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── STAGE WORKBENCH ───────────────────────────── */}
          <div className="rounded-lg border bg-card p-4">
            <ProposalStageWorkbench activeStage={activeTrackerStage} workspaceId={proposal.id} customerName={proposal.customer_name} wsData={wsData} onWsDataChange={setWsData} onSavePnlVersions={handleSavePnlVersion} />
          </div>

          {/* Global Workspace Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-8 h-9">
              <TabsTrigger value="overview" className="text-[10px] gap-1"><BookOpen className="h-3 w-3" />Overview</TabsTrigger>
              <TabsTrigger value="commercial" className="text-[10px] gap-1"><BarChart3 className="h-3 w-3" />Commercial</TabsTrigger>
              <TabsTrigger value="delivery" className="text-[10px] gap-1"><ListChecks className="h-3 w-3" />Delivery</TabsTrigger>
              <TabsTrigger value="risk" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Risk</TabsTrigger>
              <TabsTrigger value="customer" className="text-[10px] gap-1"><Handshake className="h-3 w-3" />Customer</TabsTrigger>
              <TabsTrigger value="docs" className="text-[10px] gap-1"><FileText className="h-3 w-3" />Documents</TabsTrigger>
              <TabsTrigger value="activity" className="text-[10px] gap-1"><ClipboardList className="h-3 w-3" />Activity</TabsTrigger>
              <TabsTrigger value="audit" className="text-[10px] gap-1"><Shield className="h-3 w-3" />Audit Trail</TabsTrigger>
            </TabsList>

            {/* ── Tab: Overview ─────────────────────────── */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Readiness summary strip */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
                  <div className={`text-lg font-bold ${calcQualificationReadiness(wsData) >= 70 ? "text-emerald-700" : calcQualificationReadiness(wsData) >= 40 ? "text-amber-700" : "text-red-700"}`}>
                    {calcQualificationReadiness(wsData)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Qualified</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">readiness</div>
                </div>
                <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-center">
                  <div className={`text-lg font-bold ${calcDiscoveryCompleteness(wsData) >= 70 ? "text-emerald-700" : calcDiscoveryCompleteness(wsData) >= 40 ? "text-amber-700" : "text-red-700"}`}>
                    {calcDiscoveryCompleteness(wsData)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Discovery</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">completeness</div>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-center">
                  <div className={`text-lg font-bold ${calcSolutionReadiness(wsData) >= 70 ? "text-emerald-700" : calcSolutionReadiness(wsData) >= 40 ? "text-amber-700" : "text-red-700"}`}>
                    {calcSolutionReadiness(wsData)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Solution</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">readiness</div>
                </div>
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-center">
                  <div className={`text-lg font-bold ${calcPricingConfidence(wsData) >= 70 ? "text-emerald-700" : calcPricingConfidence(wsData) >= 40 ? "text-amber-700" : "text-red-700"}`}>
                    {calcPricingConfidence(wsData)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Pricing</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-0.5">confidence</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-indigo-600" /> Client Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{proposal.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{proposal.contact_name || "--"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Stage</span><Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[proposal.stage]}`}>{stageLabel(proposal.stage)}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ticket Link</span><span className="text-[10px] font-mono">{proposal.v2_ticket_id?.slice(0, 8) || "--"}</span></div>
                    {proposal.customer_master_id && <div className="flex justify-between"><span className="text-muted-foreground">Master ID</span><span className="text-[10px]">{proposal.customer_master_id}</span></div>}
                  </CardContent>
                </Card>
                <Card className="shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-indigo-600" /> Meeting Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <MeetingNotesPanel proposalId={proposal.id} />
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {activities.filter(a => a.action === "note_added").slice(0, 5).map(a => (
                        <div key={a.id} className="rounded border bg-slate-50 px-2 py-1.5 text-[10px]">
                          <div className="text-muted-foreground mb-0.5">{a.user_name} · {new Date(a.created_at).toLocaleString()}</div>
                          <div>{a.notes}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Tab: Commercial ───────────────────────── */}
            <TabsContent value="commercial" className="space-y-4 mt-4">
              <DesignSolutionTab proposal={proposal} onSaved={handleRefresh} />
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-indigo-600" /> P&L Builder</span>
                    <PnLEditor proposal={proposal} onSaved={handleRefresh} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded border p-3 text-center">
                      <div className={`text-lg font-bold ${proposal.gp_percent < 10 ? "text-red-700" : proposal.gp_percent < 22 ? "text-amber-700" : "text-emerald-700"}`}>{proposal.gp_percent || 0}%</div>
                      <div className="text-[10px] text-muted-foreground">GP Margin</div>
                    </div>
                    <div className="rounded border p-3 text-center">
                      <div className="text-lg font-bold">{proposal.volume_pallets || "--"}</div>
                      <div className="text-[10px] text-muted-foreground">Pallets</div>
                    </div>
                    <div className="rounded border p-3 text-center">
                      <div className="text-lg font-bold">{proposal.volume_sar ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(proposal.volume_sar) : "--"}</div>
                      <div className="text-[10px] text-muted-foreground">SAR Volume</div>
                    </div>
                  </div>
                  {proposal.pnl_notes && <div className="text-[10px] text-muted-foreground italic border-t pt-2">{proposal.pnl_notes}</div>}
                </CardContent>
              </Card>
              <Card className="shadow-none border-violet-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-violet-600" /> Approval — GP Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ApprovalMatrixPanel proposal={proposal} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Delivery ─────────────────────────── */}
            <TabsContent value="delivery" className="space-y-4 mt-4">
              <NegotiationTab proposal={proposal} onSaved={handleRefresh} />
              <ContractTab proposal={proposal} onSaved={handleRefresh} onRefresh={handleRefresh} />
            </TabsContent>

            {/* ── Tab: Risk & Signals ──────────────────── */}
            <TabsContent value="risk" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold">Risk & Signals</span>
                {signals.length > 0 && <Badge variant="outline" className="text-[9px]">{signals.length} active</Badge>}
              </div>
              {signals.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-6 text-center">
                  <CheckSquare className="w-5 h-5 mx-auto text-emerald-400 mb-2" />
                  <p className="text-xs text-emerald-600 font-medium">No active signals — commercial cockpit is clear</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Signals appear automatically as stage data is captured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {signals.map((s, i) => {
                    const cfg = s.type === "critical"
                      ? { border: "border-red-200 bg-red-50", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />, text: "text-red-700" }
                      : s.type === "warning"
                      ? { border: "border-amber-200 bg-amber-50", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, text: "text-amber-700" }
                      : { border: "border-blue-200 bg-blue-50", icon: <Info className="w-3.5 h-3.5 text-blue-500" />, text: "text-blue-700" };
                    return (
                      <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border ${cfg.border}`}>
                        <div className="mt-0.5">{cfg.icon}</div>
                        <div>
                          <p className={`text-xs font-medium ${cfg.text}`}>{s.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">→ {s.recommendation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Customer ─────────────────────────── */}
            <TabsContent value="customer" className="space-y-4 mt-4">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Handshake className="h-3.5 w-3.5 text-indigo-600" /> Customer Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{proposal.customer_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contact</span><span>{proposal.contact_name || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Region</span><span>{proposal.region || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Master ID</span><span className="text-[10px] font-mono">{proposal.customer_master_id || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ticket Link</span><span className="text-[10px] font-mono">{proposal.v2_ticket_id?.slice(0, 8) || "--"}</span></div>
                </CardContent>
              </Card>
              <MeetingNotesPanel proposalId={proposal.id} />
            </TabsContent>

            {/* ── Tab: Documents ────────────────────────── */}
            <TabsContent value="docs" className="space-y-4 mt-4">
              <ProposalDocsTab proposal={proposal} onRefresh={handleRefresh} />
            </TabsContent>

            {/* ── Tab: Activity ─────────────────────────── */}
            <TabsContent value="activity" className="space-y-4 mt-4">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-indigo-600" /> Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No activity recorded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {activities.map(e => (
                        <div key={e.id} className="rounded border bg-slate-50 px-3 py-2 text-[10px]">
                          <div className="flex justify-between gap-1 mb-0.5">
                            <span className="font-medium">{e.action?.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                          </div>
                          {e.notes && <div className="text-muted-foreground mt-0.5">{e.notes}</div>}
                          <div className="text-muted-foreground mt-0.5">{e.user_name || "system"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab: Audit Trail ──────────────────────── */}
            <TabsContent value="audit" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold">Audit Trail</span>
                <Badge variant="outline" className="text-[9px]">{activities.length} events</Badge>
              </div>
              {activities.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-foreground/20 p-6 text-center">
                  <p className="text-xs text-muted-foreground">No audit events recorded yet.</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Stage changes, document uploads, and overrides will appear here.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activities.map(e => {
                    const isStage = e.action === "stage_moved" || e.action === "stage_skipped";
                    const isDoc = e.action === "document_uploaded";
                    const isOverride = e.action === "approval_overridden";
                    const icon = isStage ? <ChevronRight className="w-3 h-3" /> : isDoc ? <FileText className="w-3 h-3" /> : isOverride ? <Shield className="w-3 h-3" /> : <Info className="w-3 h-3" />;
                    return (
                      <div key={e.id} className={`flex items-start gap-3 p-3 rounded-lg border text-xs ${
                        isStage ? "border-indigo-100 bg-indigo-50/30" :
                        isOverride ? "border-amber-100 bg-amber-50/30" :
                        "border-border bg-background"
                      }`}>
                        <div className={`mt-0.5 ${isStage ? "text-indigo-500" : isOverride ? "text-amber-500" : "text-muted-foreground"}`}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[11px]">{e.action?.replace(/_/g, " ")}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                          </div>
                          {e.stage_from && e.stage_to && (
                            <div className={`text-[10px] mt-0.5 font-medium ${e.skipped ? "text-amber-700" : "text-emerald-700"}`}>
                              {stageLabel(e.stage_from)} → {stageLabel(e.stage_to)}{e.skipped ? " (skipped)" : ""}
                            </div>
                          )}
                          {e.notes && <div className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2">{e.notes}</div>}
                          <div className="text-[10px] text-muted-foreground/50 mt-1">{e.user_name || "system"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right: Activity Timeline */}
      <ActivityTimeline activities={activities} />
    </div>
  );
}

// ─── APPROVAL MATRIX PANEL ─────────────────────────────────────

function ApprovalMatrixPanel({ proposal }: { proposal: V2Proposal }) {
  const user = getCurrentUser();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const gp = proposal.gp_percent || 0;
  const pallets = proposal.volume_pallets || 0;

  // Hala GP Approval Matrix — Sprint 1: GP only (Cumulative)
  // ≥30% → Salesman + Regional Sales Head
  // 25–30% → Salesman + Regional Sales Head
  // 22–25% → + Regional Operations Head
  // 10–22% → + Directors
  // <10% → + CEO/CFO
  let requiredApprover = "Salesman + Regional Sales Head";
  let justification = "GP% ≥ 30% — Salesman + Regional Sales Head approval";
  if (gp > 0 && gp < 10) {
    requiredApprover = "CEO/CFO + Directors + Regional Ops + Regional Sales";
    justification = "GP% < 10% — Full escalation chain required. Critical risk.";
  } else if (gp >= 10 && gp < 22) {
    requiredApprover = "Directors + Regional Ops + Regional Sales";
    justification = "GP% 10–22% — Directors + Regional chain required.";
  } else if (gp >= 22 && gp < 25) {
    requiredApprover = "Regional Ops + Regional Sales";
    justification = "GP% 22–25% — Regional Operations Head + Regional Sales required.";
  } else if (gp >= 25 && gp < 30) {
    requiredApprover = "Salesman + Regional Sales Head";
    justification = "GP% 25–30% — Salesman + Regional Sales Head approval.";
  }

  async function handleOverride() {
    if (!overrideReason.trim() || overrideReason.length < 5) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.from("commercial_v2_approvals").insert({
        workspace_type: "proposal",
        workspace_id: proposal.id,
        gp_percent: gp,
        volume_pallets: pallets,
        volume_sar: proposal.volume_sar,
        region: "",
        opp_type: "proposal",
        required_approver: requiredApprover,
        overridden: true,
        override_reason: overrideReason,
        overridden_by: user?.name || "system",
        overridden_at: new Date().toISOString(),
        approval_status: "pending",
      });
      setOverrideOpen(false);
      setOverrideReason("");
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const approverColor = gp < 10 ? "text-red-700 bg-red-50 border-red-200"
    : gp < 22 ? "text-amber-700 bg-amber-50 border-amber-200"
    : gp < 25 ? "text-orange-700 bg-orange-50 border-orange-200"
    : "text-emerald-700 bg-emerald-50 border-emerald-200";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className={`rounded border px-4 py-2 flex items-center gap-2 ${approverColor}`}>
          <Shield className="h-4 w-4" />
          <div>
            <div className="text-xs font-semibold">{requiredApprover} Required</div>
            <div className="text-[10px] opacity-80">{justification}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          GP: <strong>{gp}%</strong> · Pallets: <strong>{pallets}</strong>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setOverrideOpen(true)} className="text-[10px]">
            Override (log reason)
          </Button>
        </div>
      </div>

      {/* Approval path visual */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {["Salesman + Regional", "Regional Ops", "Director", "CFO", "CEO"].map((level, i) => {
          const levels = ["Salesman + Regional", "Regional Ops", "Director", "CFO", "CEO"];
          const requiredIdx = levels.indexOf(requiredApprover);
          return (
            <div key={level} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] ${i >= requiredIdx ? approverColor : "bg-slate-50 text-slate-400 border-slate-200"}`}>
              {i >= requiredIdx ? <Shield className="h-3 w-3" /> : <Shield className="h-3 w-3 opacity-40" />}
              <span>{level}</span>
            </div>
          );
        })}
      </div>

      {/* Override Dialog */}
      {overrideOpen && (
        <div className="rounded border border-amber-200 bg-amber-50/50 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Override requires logged reason. No hard stop — override is recorded.
          </div>
          <Textarea
            placeholder="Reason for override (min 5 characters)..."
            value={overrideReason}
            onChange={e => setOverrideReason(e.target.value)}
            rows={2}
            className="text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleOverride} disabled={overrideReason.length < 5 || submitting}>
              {submitting ? "Logging..." : "Log Override & Continue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DESIGN SOLUTION TAB ──────────────────────────────────────

function DesignSolutionTab({ proposal, onSaved }: { proposal: V2Proposal; onSaved: () => void }) {
  const [notes, setNotes] = useState(proposal.design_solution_notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await supabase.rpc("commercial_v2_update_proposal_workspace", {
        p_proposal_id: proposal.id,
        p_design_solution_notes: notes,
      });
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5 text-indigo-600" /> Design Solution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Describe the proposed solution — warehousing model, distribution network, service scope, SLA commitments, staffing, equipment..."
          rows={8}
          className="text-xs"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Design Notes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PROPOSAL DOCS TAB ───────────────────────────────────────

function ProposalDocsTab({ proposal, onRefresh }: { proposal: V2Proposal; onRefresh: () => void }) {
  const user = getCurrentUser();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState("proposal_draft");
  const [docNotes, setDocNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("commercial_v2_documents")
      .select("*").eq("parent_type", "proposal").eq("parent_id", proposal.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, [proposal.id]);

  async function handleUpload() {
    setSubmitting(true);
    try {
      await supabase.rpc("commercial_v2_create_document", {
        params: JSON.stringify({
          parent_type: "proposal",
          parent_id: proposal.id,
          document_type: docType,
          file_name: fileName,
          uploaded_by: user?.name || "system",
          notes: docNotes,
        }),
      });
      setUploadOpen(false);
      setFileName(""); setDocNotes("");
      const { data } = await supabase.from("commercial_v2_documents")
        .select("*").eq("parent_type", "proposal").eq("parent_id", proposal.id)
        .order("created_at", { ascending: false });
      setDocs(data || []);
      onRefresh();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  const DOC_TYPES = [
    { value: "proposal_draft", label: "Proposal Draft" },
    { value: "pricing_sheet", label: "Pricing Sheet" },
    { value: "sla_draft", label: "SLA Draft" },
    { value: "contract_draft", label: "Contract Draft" },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-indigo-600" /> Proposal Documents</span>
          <Button size="sm" variant="outline" className="gap-1 text-[10px]" onClick={() => setUploadOpen(true)}>
            <Upload className="h-3 w-3" /> Add Document
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
        : docs.length === 0 ? (
          <div className="py-6 text-center">
            <FileText className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No documents yet. Add your first document above.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{d.file_name || "Unnamed"}</span>
                  <Badge variant="outline" className="text-[9px]">{DOC_TYPES.find(t => t.value === d.document_type)?.label || d.document_type}</Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                  <span>{d.uploaded_by}</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Document — {proposal.customer_name}</DialogTitle>
              <DialogDescription>Register a document record linked to this proposal.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">File Name *</Label>
                <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. SABIC_Proposal_v2.pdf" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category *</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} placeholder="Version notes, changes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!fileName.trim() || submitting}>
                {submitting ? "Saving..." : "Add Document"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── NEGOTIATION TAB ─────────────────────────────────────────

function NegotiationTab({ proposal, onSaved }: { proposal: V2Proposal; onSaved: () => void }) {
  const [notes, setNotes] = useState(proposal.negotiation_notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await supabase.rpc("commercial_v2_update_proposal_workspace", {
        p_proposal_id: proposal.id,
        p_negotiation_notes: notes,
      });
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-indigo-600" /> Negotiation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Counter-offers, client feedback, pricing adjustments, revised terms..."
          rows={6}
          className="text-xs"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Negotiation Notes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CONTRACT TAB ────────────────────────────────────────────

function ContractTab({ proposal, onSaved, onRefresh }: { proposal: V2Proposal; onSaved: () => void; onRefresh: () => void }) {
  const [status, setStatus] = useState(proposal.contract_status || "draft");
  const [saving, setSaving] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    try {
      await supabase.rpc("commercial_v2_update_proposal_workspace", {
        p_proposal_id: proposal.id,
        p_contract_status: newStatus,
      });
      setStatus(newStatus);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  const STATUS_STEPS = [
    { key: "draft", label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-200" },
    { key: "negotiating", label: "Negotiating", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "signed", label: "Signed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "expired", label: "Expired", color: "bg-red-50 text-red-700 border-red-200" },
  ];

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-indigo-600" /> Contract Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {STATUS_STEPS.map(s => (
            <button
              key={s.key}
              onClick={() => handleStatusChange(s.key)}
              disabled={saving}
              className={`flex-1 rounded border px-3 py-2 text-xs font-medium transition-colors ${
                status === s.key ? s.color + " ring-2 ring-indigo-300" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ProposalDocsTab proposal={proposal} onRefresh={onRefresh} />
      </CardContent>
    </Card>
  );
}

// ─── ACTIVITY TIMELINE ────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: any[] }) {
  function actionLabel(a: string) {
    const map: Record<string, string> = {
      stage_moved: "Stage moved", stage_skipped: "Stage skipped",
      note_added: "Note added", outcome_set: "Outcome set",
      approval_overridden: "Approval overridden", document_uploaded: "Doc uploaded",
    };
    return map[a] || a;
  }

  return (
    <div className="w-72 border-l overflow-y-auto bg-slate-50/30 hidden xl:block px-3 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Activity</p>
      <div className="space-y-2">
        {activities.length === 0 && <p className="text-[10px] text-muted-foreground py-4 text-center">No activity</p>}
        {activities.map(e => (
          <div key={e.id} className="rounded border bg-white px-3 py-2 text-[10px]">
            <div className="flex justify-between gap-1 mb-0.5">
              <span className="font-medium">{actionLabel(e.action)}</span>
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            {e.stage_from && e.stage_to && (
              <div className={e.skipped ? "text-amber-700" : "text-emerald-700"}>
                {stageLabel(e.stage_from)} → {stageLabel(e.stage_to)}{e.skipped ? " (skipped)" : ""}
              </div>
            )}
            {e.notes && <div className="text-muted-foreground mt-0.5 line-clamp-2">{e.notes}</div>}
            <div className="text-muted-foreground mt-0.5">{e.user_name || "system"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}