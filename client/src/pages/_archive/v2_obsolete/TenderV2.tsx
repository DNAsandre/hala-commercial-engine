import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  Circle,
  FileCheck,
  FileText,
  Gavel,
  Info,
  ListChecks,
  Plus,
  Shield,
  Square,
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

// ─── STAGES — Hala Tender Process Flow 2025 ──────────────────
// Phase 1: Qualification & Review
// Phase 2: Tender Build
// Phase 3: Approval & Submission

const TENDER_PHASE_1 = [
  { key: "sow_qualification",  label: "SOW Qualification",  color: "slate" },
  { key: "technical_review",   label: "Technical Review",   color: "blue" },
  { key: "commercial_analysis",label: "Commercial Analysis", color: "indigo" },
  { key: "scope_of_work",     label: "Scope of Work",      color: "violet" },
  { key: "finance_review",    label: "Finance Review",     color: "purple" },
  { key: "legal_review",      label: "Legal Review",       color: "fuchsia" },
];

const TENDER_PHASE_2 = [
  { key: "draft_tender",      label: "Draft Tender",       color: "amber" },
  { key: "pnl_input",         label: "P&L Input",          color: "orange" },
  { key: "pricing",           label: "Pricing",            color: "rose" },
  { key: "bank_guarantee",    label: "Bank Guarantee",     color: "pink" },
];

const TENDER_PHASE_3 = [
  { key: "committee_review",  label: "Committee Review",   color: "cyan" },
  { key: "director_approval", label: "Director Approval",  color: "teal" },
  { key: "final_tender",      label: "Final Tender",       color: "lime" },
  { key: "submission",        label: "Submission",         color: "emerald" },
];

const TENDER_STAGES = [...TENDER_PHASE_1, ...TENDER_PHASE_2, ...TENDER_PHASE_3];

const STAGE_COLORS: Record<string, string> = {
  sow_qualification:   "bg-slate-100 text-slate-700 border-slate-200",
  technical_review:    "bg-blue-50 text-blue-700 border-blue-200",
  commercial_analysis: "bg-indigo-50 text-indigo-700 border-indigo-200",
  scope_of_work:       "bg-violet-50 text-violet-700 border-violet-200",
  finance_review:      "bg-purple-50 text-purple-700 border-purple-200",
  legal_review:        "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  draft_tender:        "bg-amber-50 text-amber-700 border-amber-200",
  pnl_input:           "bg-orange-50 text-orange-700 border-orange-200",
  pricing:             "bg-rose-50 text-rose-700 border-rose-200",
  bank_guarantee:      "bg-pink-50 text-pink-700 border-pink-200",
  committee_review:    "bg-cyan-50 text-cyan-700 border-cyan-200",
  director_approval:   "bg-teal-50 text-teal-700 border-teal-200",
  final_tender:        "bg-lime-50 text-lime-700 border-lime-200",
  submission:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  awarded:             "bg-emerald-100 text-emerald-800 border-emerald-300",
  lost:                "bg-red-50 text-red-700 border-red-200",
};

const OUTCOME_COLORS: Record<string, string> = {
  awarded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost:    "bg-red-50 text-red-700 border-red-200",
  open:    "bg-blue-50 text-blue-700 border-blue-200",
};

function stageLabel(s: string) {
  return TENDER_STAGES.find(t => t.key === s)?.label || s;
}

function stagePhase(s: string): string {
  if (TENDER_PHASE_1.find(p => p.key === s)) return "Phase 1";
  if (TENDER_PHASE_2.find(p => p.key === s)) return "Phase 2";
  if (TENDER_PHASE_3.find(p => p.key === s)) return "Phase 3";
  return "";
}

// ─── RPC ───────────────────────────────────────────────────────

async function rpcUpdateTenderStage(id: string, newStage: string, userName: string, skip = false, notes = "") {
  const { error } = await supabase.rpc("commercial_v2_update_tender_stage", {
    p_tender_id: id, p_new_stage: newStage, p_user_name: userName, p_skip: skip, p_notes: notes,
  });
  if (error) throw error;
}

async function rpcUpdateTenderChecklist(id: string, section: string, complete: boolean) {
  const { error } = await supabase.rpc("commercial_v2_update_tender_checklist", {
    p_tender_id: id, p_section: section, p_complete: complete,
  });
  if (error) throw error;
}

async function rpcSetTenderOutcome(id: string, outcome: string, notes: string) {
  const { error } = await supabase.rpc("commercial_v2_set_tender_outcome", {
    p_tender_id: id, p_outcome: outcome, p_outcome_notes: notes,
  });
  if (error) throw error;
}

async function rpcLogActivity(entityType: string, entityId: string, action: string, notes: string, userName: string) {
  await supabase.rpc("commercial_v2_log_activity", {
    p_entity_type: entityType, p_entity_id: entityId, p_action: action,
    p_notes: notes, p_user_name: userName,
  });
}

// ─── TYPES ────────────────────────────────────────────────────

interface V2Tender {
  id: string; v2_ticket_id: string; tender_ws_id: string; tender_ref: string;
  customer_name: string; stage: string;
  qualification_complete: boolean; registration_complete: boolean;
  required_docs_complete: boolean; compliance_complete: boolean;
  technical_complete: boolean; commercial_complete: boolean;
  ops_review_complete: boolean; finance_review_complete: boolean;
  legal_complete: boolean; pricing_complete: boolean; committee_complete: boolean;
  submission_ready: boolean;
  outcome: string | null; outcome_notes: string;
  customer_master_id: string | null; legacy_workspace_id: string | null;
  created_at: string; updated_at: string;
}

// ─── STAGE ADVANCE DIALOG ─────────────────────────────────────

function StageAdvanceDialog({ tender, onRefresh }: { tender: V2Tender; onRefresh: () => void }) {
  const user = getCurrentUser();
  const [open, setOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [notes, setNotes] = useState("");
  const [skip, setSkip] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleMove() {
    if (!newStage) return;
    setSubmitting(true);
    try {
      await rpcUpdateTenderStage(tender.id, newStage, user?.name || "system", skip, notes);
      setOpen(false);
      setNewStage(""); setNotes(""); setSkip(false);
      onRefresh();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
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
          <DialogTitle>Advance Stage — {tender.customer_name}</DialogTitle>
          <DialogDescription>
            Current: <strong>{stageLabel(tender.stage)}</strong>.
            Skip is logged. Linde tender workspace is never modified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1.5">
            {TENDER_STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setNewStage(s.key)}
                className={`rounded border px-2 py-1.5 text-[10px] font-medium transition-colors ${
                  newStage === s.key ? "bg-indigo-600 text-white border-indigo-600" : STAGE_COLORS[s.key]
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="skip-tender" checked={skip} onChange={e => setSkip(e.target.checked)} className="accent-indigo-600" />
            <Label htmlFor="skip-tender" className="text-xs">Skip stage (log as skipped)</Label>
          </div>
          <Textarea placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={!newStage || submitting}>
              {submitting ? "Moving..." : "Move to " + (TENDER_STAGES.find(s => s.key === newStage)?.label || newStage)}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── OUTCOME SELECTOR ─────────────────────────────────────────

function OutcomeSelector({ tender, onSaved }: { tender: V2Tender; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState(tender.outcome || "open");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSet() {
    setSubmitting(true);
    try {
      await rpcSetTenderOutcome(tender.id, outcome, notes);
      setOpen(false);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {tender.outcome
            ? <Badge variant="outline" className={`text-[10px] ${OUTCOME_COLORS[tender.outcome]}`}>{tender.outcome}</Badge>
            : <span className="text-[10px] text-muted-foreground">Set Outcome</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Outcome — {tender.customer_name}</DialogTitle>
          <DialogDescription>Set tender outcome. Open means still active.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["open", "awarded", "lost"] as const).map(o => (
              <Button key={o} variant={outcome === o ? "default" : "outline"} onClick={() => setOutcome(o)} className="flex-1 capitalize">{o}</Button>
            ))}
          </div>
          <Textarea placeholder="Outcome notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSet} disabled={submitting}>{submitting ? "Setting..." : "Set Outcome"}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── CHECKLIST PANEL ───────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { key: "qualification_complete",   label: "Qualification",       section: "qualification" },
  { key: "registration_complete",    label: "Registration",        section: "registration" },
  { key: "required_docs_complete",  label: "Required Docs",       section: "required_docs" },
  { key: "compliance_complete",      label: "Compliance",          section: "compliance" },
  { key: "technical_complete",        label: "Technical Review",     section: "technical" },
  { key: "commercial_complete",       label: "Commercial Review",  section: "commercial" },
  { key: "ops_review_complete",       label: "Ops Review",          section: "ops_review" },
  { key: "finance_review_complete",   label: "Finance Review",      section: "finance_review" },
  { key: "legal_complete",           label: "Legal Review",        section: "legal" },
  { key: "pricing_complete",          label: "Pricing",             section: "pricing" },
  { key: "committee_complete",        label: "Committee",           section: "committee" },
  { key: "submission_ready",          label: "Submission Ready",   section: "submission" },
];

function ChecklistPanel({ tender, onToggle }: { tender: V2Tender; onToggle: () => void }) {
  const user = getCurrentUser();
  const incomplete = CHECKLIST_ITEMS.filter(i => !tender[i.key as keyof V2Tender]);

  async function handleToggle(key: string, current: boolean) {
    try {
      await rpcUpdateTenderChecklist(tender.id, key.replace("_complete", "").replace("_ready", ""), !current);
      onToggle();
    } catch (e) { console.error(e); }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5 text-indigo-600" /> Tender Checklist</span>
          {incomplete.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">
              {incomplete.length} incomplete
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {CHECKLIST_ITEMS.map(item => {
            const done = tender[item.key as keyof V2Tender] as boolean;
            return (
              <button
                key={item.key}
                onClick={() => handleToggle(item.key, done)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  done ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50 text-muted-foreground"
                }`}
              >
                {done
                  ? <CheckSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  : <Square className="h-3.5 w-3.5 shrink-0" />}
                <span className={done ? "" : "line-through opacity-60"}>{item.label}</span>
              </button>
            );
          })}
        </div>
        {incomplete.length > 0 && (
          <div className="mt-3 rounded border border-amber-100 bg-amber-50/50 px-3 py-2 text-[10px] text-amber-700">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {incomplete.length} section{incomplete.length > 1 ? "s" : ""} incomplete — continue anyway?
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── TENDER LIST ──────────────────────────────────────────────

function TenderList({ onSelect }: { onSelect: (t: V2Tender) => void }) {
  const [tenders, setTenders] = useState<V2Tender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("commercial_v2_tenders").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setTenders(data || []); setLoading(false); });
  }, []);

  if (loading) return <div className="py-8 text-center text-xs text-muted-foreground">Loading tenders...</div>;
  if (tenders.length === 0) {
    return (
      <div className="py-12 text-center">
        <Gavel className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground mb-3">No tenders yet</p>
        <p className="text-[10px] text-muted-foreground">Convert a lead from Pipeline V.2 to see it here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {tenders.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
        >
          <div>
            <div className="font-medium text-sm">{t.customer_name || "Unnamed"}</div>
            <div className="text-[10px] text-muted-foreground">
              {t.tender_ref ? `Ref: ${t.tender_ref} · ` : ""}
              Stage: {stageLabel(t.stage)} · Created: {new Date(t.created_at).toLocaleDateString()}
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[t.stage] || ""}`}>
            {stageLabel(t.stage)}
          </Badge>
        </button>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────

export default function TenderV2() {
  const [tender, setTender] = useState<V2Tender | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleSelect(t: V2Tender) { setTender(t); }

  async function loadDetails() {
    if (!tender) return;
    const [{ data: acts }] = await Promise.all([
      supabase.from("commercial_v2_activity")
        .select("*").eq("entity_type", "tender").eq("entity_id", tender.id)
        .order("created_at", { ascending: false }).limit(30),
    ]);
    setActivities(acts || []);
  }

  useEffect(() => { loadDetails(); }, [tender?.id, refreshKey]);

  function handleRefresh() { setRefreshKey(k => k + 1); loadDetails(); }

  if (!tender) {
    return (
      <div className="flex h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-xl px-6 py-6">
            <div className="mb-4 flex items-center gap-2">
              <Gavel className="h-4 w-4 text-indigo-600" />
              <h1 className="text-base font-semibold">Tender V.2</h1>
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">BETA</Badge>
            </div>
            <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 mb-4 flex gap-3 text-[10px] text-amber-700">
              <Shield className="h-3 w-3" /> Soft workflow — Linde tender workspace preserved
            </div>
            <Card className="shadow-none">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Select or Create Tender</CardTitle></CardHeader>
              <CardContent>
                <TenderList onSelect={handleSelect} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = TENDER_STAGES.findIndex(s => s.key === tender.stage);
  const completeCount = CHECKLIST_ITEMS.filter(i => tender[i.key as keyof V2Tender]).length;
  const missingSections = CHECKLIST_ITEMS.filter(i => !tender[i.key as keyof V2Tender]).map(i => i.label);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-indigo-600" />
                <h1 className="text-base font-semibold">{tender.customer_name}</h1>
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">TENDER V.2</Badge>
                <Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[tender.stage] || ""}`}>{stageLabel(tender.stage)}</Badge>
                {tender.tender_ref && (
                  <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600">Ref: {tender.tender_ref}</Badge>
                )}
                {tender.outcome && <Badge variant="outline" className={`text-[10px] ${OUTCOME_COLORS[tender.outcome]}`}>{tender.outcome}</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {tender.tender_ws_id ? `Linked to tender workspace: ${tender.tender_ws_id}` : "No tender workspace link"} · Linde preserved
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <StageAdvanceDialog tender={tender} onRefresh={handleRefresh} />
              <OutcomeSelector tender={tender} onSaved={handleRefresh} />
              {tender.tender_ws_id && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={`/tenders/${tender.tender_ws_id}`} target="_blank" rel="noopener noreferrer" className="text-[10px]">
                    Open Linde WS →
                  </a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setTender(null)}>← All Tenders</Button>
            </div>
          </div>

          {/* Doctrine Banner */}
          <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-3 text-[10px] text-amber-700">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Tender V.2 — Linde workspace never modified</span>
            <span>• Checklist incomplete → warning, not blocker</span>
            <span>• Stage skip allowed — logged in activity</span>
            <span>• Open in new tab → Linde tender workspace</span>
          </div>

          {/* Phase Progress */}
          <div className="rounded border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Tender Process — 3 Phases</p>
            {[{ label: "Phase 1 — Qualification & Review", stages: TENDER_PHASE_1 },
              { label: "Phase 2 — Tender Build", stages: TENDER_PHASE_2 },
              { label: "Phase 3 — Approval & Submission", stages: TENDER_PHASE_3 },
            ].map(phase => (
              <div key={phase.label} className="mb-3 last:mb-0">
                <p className="text-[9px] font-medium text-muted-foreground mb-1">{phase.label}</p>
                <div className="flex items-center gap-0.5">
                  {phase.stages.map((s, i) => {
                    const globalIdx = TENDER_STAGES.findIndex(ts => ts.key === s.key);
                    return (
                      <div key={s.key} className="flex-1 flex items-center">
                        <div className={`flex-1 h-1.5 rounded ${globalIdx <= currentIdx ? STAGE_COLORS[s.key] : "bg-slate-100"}`} />
                        {i < phase.stages.length - 1 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 mx-px" />}
                      </div>
                    );
                  })}
                </div>
                <div className={`mt-1 grid gap-0.5`} style={{ gridTemplateColumns: `repeat(${phase.stages.length}, 1fr)` }}>
                  {phase.stages.map(s => (
                    <span key={s.key} className={`text-[8px] text-center ${s.key === tender.stage ? "font-semibold text-indigo-700" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Phase Tabs */}
          <Tabs defaultValue="phase1" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-9">
              <TabsTrigger value="phase1" className="text-[10px]">Phase 1</TabsTrigger>
              <TabsTrigger value="phase2" className="text-[10px]">Phase 2</TabsTrigger>
              <TabsTrigger value="phase3" className="text-[10px]">Phase 3</TabsTrigger>
              <TabsTrigger value="docs" className="text-[10px] gap-1"><FileText className="h-3 w-3" />Documents</TabsTrigger>
            </TabsList>

            {/* Phase 1: Qualification & Review */}
            <TabsContent value="phase1" className="space-y-4 mt-4">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <FileCheck className="h-3.5 w-3.5 text-indigo-600" /> Phase 1 — Qualification & Review
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{tender.customer_name}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tender Ref</span><span>{tender.tender_ref || "--"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Stage</span><Badge variant="outline" className={`text-[10px] ${STAGE_COLORS[tender.stage]}`}>{stageLabel(tender.stage)}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Phase</span><span>{stagePhase(tender.stage)}</span></div>
                  </div>
                </CardContent>
              </Card>
              <ChecklistPanel tender={tender} onToggle={handleRefresh} />
              {missingSections.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Incomplete Sections
                  </div>
                  <div className="text-xs text-amber-700">{missingSections.join(", ")}</div>
                  <div className="text-[10px] text-amber-600 mt-1">Warnings only — no hard block.</div>
                </div>
              )}
            </TabsContent>

            {/* Phase 2: Tender Build */}
            <TabsContent value="phase2" className="space-y-4 mt-4">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5 text-indigo-600" /> Phase 2 — Tender Build
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <p className="text-muted-foreground">Draft tender document, input P&L figures, finalize pricing, and arrange bank guarantee.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TENDER_PHASE_2.map(s => {
                      const globalIdx = TENDER_STAGES.findIndex(ts => ts.key === s.key);
                      const reached = globalIdx <= currentIdx;
                      return (
                        <div key={s.key} className={`rounded border px-3 py-2 flex items-center gap-2 ${reached ? STAGE_COLORS[s.key] : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                          {reached ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                          <span className="text-xs">{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Phase 3: Approval & Submission */}
            <TabsContent value="phase3" className="space-y-4 mt-4">
              <Card className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-indigo-600" /> Phase 3 — Approval & Submission
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <p className="text-muted-foreground">Committee review, director sign-off, finalize tender, and submit.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TENDER_PHASE_3.map(s => {
                      const globalIdx = TENDER_STAGES.findIndex(ts => ts.key === s.key);
                      const reached = globalIdx <= currentIdx;
                      return (
                        <div key={s.key} className={`rounded border px-3 py-2 flex items-center gap-2 ${reached ? STAGE_COLORS[s.key] : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                          {reached ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                          <span className="text-xs">{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="docs" className="space-y-4 mt-4">
              <TenderDocsTab tender={tender} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline activities={activities} />
    </div>
  );
}

// ─── TENDER DOCS TAB ─────────────────────────────────────────

function TenderDocsTab({ tender }: { tender: V2Tender }) {
  const user = getCurrentUser();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState("technical");
  const [docNotes, setDocNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("commercial_v2_documents")
      .select("*").eq("parent_type", "tender").eq("parent_id", tender.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setDocs(data || []); setLoading(false); });
  }, [tender.id]);

  const DOC_CATS = [
    { value: "technical", label: "Technical" },
    { value: "commercial", label: "Commercial" },
    { value: "legal", label: "Legal" },
    { value: "finance", label: "Finance" },
    { value: "compliance_cert", label: "Compliance Cert" },
    { value: "insurance_cert", label: "Insurance Cert" },
    { value: "submission_pack", label: "Submission Pack" },
  ];

  async function handleUpload() {
    setSubmitting(true);
    try {
      await supabase.rpc("commercial_v2_create_document", {
        params: JSON.stringify({
          parent_type: "tender", parent_id: tender.id,
          document_type: docType, file_name: fileName,
          uploaded_by: user?.name || "system", notes: docNotes,
        }),
      });
      setUploadOpen(false); setFileName(""); setDocNotes("");
      const { data } = await supabase.from("commercial_v2_documents")
        .select("*").eq("parent_type", "tender").eq("parent_id", tender.id)
        .order("created_at", { ascending: false });
      setDocs(data || []);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-indigo-600" /> Tender Documents</span>
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
            <p className="text-xs text-muted-foreground">No documents yet.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{d.file_name || "Unnamed"}</span>
                  <Badge variant="outline" className="text-[9px]">{DOC_CATS.find(c => c.value === d.document_type)?.label || d.document_type}</Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tender Document — {tender.customer_name}</DialogTitle>
              <DialogDescription>Register a document record linked to this tender.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">File Name *</Label>
                <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="e.g. SOW_Technical_v1.pdf" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category *</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_CATS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} />
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