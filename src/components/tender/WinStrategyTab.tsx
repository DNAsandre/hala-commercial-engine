/**
 * WinStrategyTab — Manual Win Strategy Capture
 *
 * 4 Sub-Sections (sub-tabs):
 *   1. Strategic Rationale (3 textareas)
 *   2. Win Themes (repeatable rows)
 *   3. Differentiators (repeatable rows)
 *   4. Evaluation Criteria Alignment (repeatable rows)
 *   + Save Button
 *
 * Data: ws.tender.bidNoBidData.win_strategy
 * Save: updateTenderBidNoBidData → merges win_strategy only
 *
 * Rules:
 * - No fake data, no AI, no hardcoded examples.
 * - Manual capture only. No stage movement. No CRM/document-output tooling.
 */

import { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { runTenderTabSave, tenderRevisionTokenOf } from "./IdentifiedStageShared";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, Plus, X,
  Lightbulb, Trophy, Star, BarChart3,
  FolderOpen, PanelRightOpen,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type ThemeStatus = "Draft" | "Confirmed" | "Needs Evidence" | "Not Used";
type DiffStatus = "Draft" | "Confirmed" | "Needs Evidence" | "Not Used";

interface WinThemeRow {
  theme: string;
  buyer_need: string;
  hala_proof: string;
  linked_criteria: string;
  proposal_section: string;
  owner: string;
  status: ThemeStatus;
}

interface DifferentiatorRow {
  differentiator: string;
  evidence: string;
  where_to_use: string;
  owner: string;
  status: DiffStatus;
}

interface EvalAlignmentRow {
  criteria: string;
  weight: string;
  response_strategy: string;
  evidence_needed: string;
  owner: string;
}

interface Rationale {
  why_bid: string;
  why_win: string;
  client_values: string;
}

interface WinStrategyData {
  rationale: Rationale;
  win_themes: WinThemeRow[];
  differentiators: DifferentiatorRow[];
  evaluation_alignment: EvalAlignmentRow[];
}

type WinSectionKey = "rationale" | "themes" | "differentiators" | "eval";

const WIN_SECTION_TABS: { key: WinSectionKey; label: string; icon: ReactNode }[] = [
  { key: "rationale", label: "Strategic Rationale", icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { key: "themes", label: "Win Themes", icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: "differentiators", label: "Differentiators", icon: <Star className="w-3.5 h-3.5" /> },
  { key: "eval", label: "Evaluation Alignment", icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const THEME_STATUS_OPTIONS: ThemeStatus[] = ["Draft", "Confirmed", "Needs Evidence", "Not Used"];
const DIFF_STATUS_OPTIONS: DiffStatus[] = ["Draft", "Confirmed", "Needs Evidence", "Not Used"];

const WIN_THEME_CATEGORIES = [
  "Service Reliability", "Operational Coverage", "Technology Visibility",
  "Compliance / Safety", "Cost-to-Serve", "Local Content",
  "Sector Experience", "Speed / Responsiveness", "Risk Reduction", "Scalability",
];

// ═══════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════

function emptyRationale(): Rationale {
  return { why_bid: "", why_win: "", client_values: "" };
}

function emptyTheme(): WinThemeRow {
  return { theme: "", buyer_need: "", hala_proof: "", linked_criteria: "", proposal_section: "", owner: "", status: "Draft" };
}

function emptyDifferentiator(): DifferentiatorRow {
  return { differentiator: "", evidence: "", where_to_use: "", owner: "", status: "Draft" };
}

function emptyEvalAlignment(): EvalAlignmentRow {
  return { criteria: "", weight: "", response_strategy: "", evidence_needed: "", owner: "" };
}

function emptyWinStrategy(): WinStrategyData {
  return { rationale: emptyRationale(), win_themes: [], differentiators: [], evaluation_alignment: [] };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusBtnClass(selected: boolean, status: string): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (status === "Confirmed") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (status === "Draft") return "bg-blue-100 border-blue-300 text-blue-700 font-medium";
  if (status === "Needs Evidence") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

/**
 * TCW-T3 (P2b) — this tab's patch carries ONLY its own bid_no_bid_data key
 * (win_strategy). The write layer patch-merges, so sibling tabs' keys are
 * preserved by the STORED facet — never re-sent from a page-load copy.
 * Exported pure for direct testing.
 */
export function buildWinStrategyPatch(data: WinStrategyData): Record<string, any> {
  return { win_strategy: data };
}

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function WinStrategyTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.bidNoBidData as any;

  const [data, setData] = useState<WinStrategyData>(() => {
    if (existing?.win_strategy && typeof existing.win_strategy === "object") {
      return {
        rationale: { ...emptyRationale(), ...(existing.win_strategy.rationale || {}) },
        win_themes: Array.isArray(existing.win_strategy.win_themes) ? existing.win_strategy.win_themes : [],
        differentiators: Array.isArray(existing.win_strategy.differentiators) ? existing.win_strategy.differentiators : [],
        evaluation_alignment: Array.isArray(existing.win_strategy.evaluation_alignment) ? existing.win_strategy.evaluation_alignment : [],
      };
    }
    return emptyWinStrategy();
  });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<WinSectionKey>("rationale");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  // Array mutators
  const addTheme = () => setData(p => ({ ...p, win_themes: [...p.win_themes, emptyTheme()] }));
  const removeTheme = (i: number) => setData(p => ({ ...p, win_themes: p.win_themes.filter((_, idx) => idx !== i) }));
  const updateTheme = (i: number, f: keyof WinThemeRow, v: any) => setData(p => ({ ...p, win_themes: p.win_themes.map((r, idx) => idx === i ? { ...r, [f]: v } : r) }));

  const addDiff = () => setData(p => ({ ...p, differentiators: [...p.differentiators, emptyDifferentiator()] }));
  const removeDiff = (i: number) => setData(p => ({ ...p, differentiators: p.differentiators.filter((_, idx) => idx !== i) }));
  const updateDiff = (i: number, f: keyof DifferentiatorRow, v: any) => setData(p => ({ ...p, differentiators: p.differentiators.map((r, idx) => idx === i ? { ...r, [f]: v } : r) }));

  const addEval = () => setData(p => ({ ...p, evaluation_alignment: [...p.evaluation_alignment, emptyEvalAlignment()] }));
  const removeEval = (i: number) => setData(p => ({ ...p, evaluation_alignment: p.evaluation_alignment.filter((_, idx) => idx !== i) }));
  const updateEval = (i: number, f: keyof EvalAlignmentRow, v: any) => setData(p => ({ ...p, evaluation_alignment: p.evaluation_alignment.map((r, idx) => idx === i ? { ...r, [f]: v } : r) }));

  // Stats for stage intel
  const stats = useMemo(() => {
    const rationaleFilled = [data.rationale.why_bid, data.rationale.why_win, data.rationale.client_values].filter(v => typeof v === "string" && v.trim().length > 0).length;
    return {
      rationaleFilled,
      themesCount: data.win_themes.length,
      diffsCount: data.differentiators.length,
      evalsCount: data.evaluation_alignment.length,
    };
  }, [data]);

  const staleRetryArmed = useRef(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderBidNoBidData(tenderId, buildWinStrategyPatch(data), {
            expectedRevision,
            reason: "Win Strategy tab saved",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Win Strategy saved.", failed: "Save failed" },
        onConfirmed: () => onSaved?.(),
        onStale: () => onSaved?.(),
      });
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, data, onSaved, ws]);

  return (
    <div className="space-y-4">
      {/* ── Stage Menu + Sub-Tab Bar ───────────────────────── */}
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Bid / No-Bid Stage Menu
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                Stage 3
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {onOpenDocuments && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Documents
                </Button>
              )}
              {onOpenGlobalIntel && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  Global Intelligence
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                stageIntelOpen
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`} onClick={() => setStageIntelOpen(prev => !prev)}>
                <PanelRightOpen className="w-3.5 h-3.5" />
                {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
              </Button>
              {(existing?.win_strategy?.rationale || existing?.win_strategy?.win_themes?.length || existing?.win_strategy?.differentiators?.length || existing?.win_strategy?.evaluation_alignment?.length) && (
                <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>
              )}
            </div>
          </div>

          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <StageIntelMetric label="Rationale Filled" value={`${stats.rationaleFilled}/3`} />
                <StageIntelMetric label="Win Themes" value={String(stats.themesCount)} />
                <StageIntelMetric label="Differentiators" value={String(stats.diffsCount)} />
                <StageIntelMetric label="Evaluation Criteria" value={String(stats.evalsCount)} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          <WinInnerTabs tabs={WIN_SECTION_TABS} activeKey={activeSection} onSelect={setActiveSection} />
        </CardContent>
      </Card>

      {/* ── 1. Strategic Rationale ─────────────────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "rationale" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <WinSectionHeader title="Strategic Rationale" icon={<Lightbulb className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${stats.rationaleFilled}/3 filled`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Why should Hala bid?</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter strategic rationale for bidding..." value={data.rationale.why_bid} onChange={e => setData(p => ({ ...p, rationale: { ...p.rationale, why_bid: e.target.value } }))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Why can Hala win?</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter competitive advantage..." value={data.rationale.why_win} onChange={e => setData(p => ({ ...p, rationale: { ...p.rationale, why_win: e.target.value } }))} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">What is the client likely to value most?</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter key client priorities..." value={data.rationale.client_values} onChange={e => setData(p => ({ ...p, rationale: { ...p.rationale, client_values: e.target.value } }))} />
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Win Themes ──────────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "themes" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <WinSectionHeader title="Win Themes" icon={<Trophy className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${data.win_themes.length} themes`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {data.win_themes.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No win themes added yet.</p>
          )}
          {data.win_themes.map((row, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeTheme(idx)}>
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Win Theme</label>
                  <select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.theme} onChange={e => updateTheme(idx, "theme", e.target.value)}>
                    <option value="">Select or type...</option>
                    {WIN_THEME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Buyer Need / Pain Point</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="What problem does this solve?" value={row.buyer_need} onChange={e => updateTheme(idx, "buyer_need", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Hala Proof / Evidence</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Evidence..." value={row.hala_proof} onChange={e => updateTheme(idx, "hala_proof", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Linked Evaluation Criteria</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Which RFP criteria?" value={row.linked_criteria} onChange={e => updateTheme(idx, "linked_criteria", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Proposal Section Later</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Exec Summary, Tech..." value={row.proposal_section} onChange={e => updateTheme(idx, "proposal_section", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateTheme(idx, "owner", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label>
                  <div className="flex gap-1">
                    {THEME_STATUS_OPTIONS.map(opt => (
                      <button key={opt} type="button" className={`px-2 py-1 rounded border text-[9px] transition-colors ${statusBtnClass(row.status === opt, opt)}`} onClick={() => updateTheme(idx, "status", opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addTheme}>
            <Plus className="w-3 h-3" /> Add Win Theme
          </Button>
        </CardContent>
      </Card>

      {/* ── 3. Differentiators ─────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "differentiators" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <WinSectionHeader title="Differentiators" icon={<Star className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${data.differentiators.length} items`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {data.differentiators.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No differentiators added yet.</p>
          )}
          {data.differentiators.map((row, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeDiff(idx)}>
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Differentiator</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="What makes Hala different?" value={row.differentiator} onChange={e => updateDiff(idx, "differentiator", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Evidence / Source</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Evidence..." value={row.evidence} onChange={e => updateDiff(idx, "evidence", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Where to Use Later</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Proposal section..." value={row.where_to_use} onChange={e => updateDiff(idx, "where_to_use", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateDiff(idx, "owner", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label>
                  <div className="flex gap-1">
                    {DIFF_STATUS_OPTIONS.map(opt => (
                      <button key={opt} type="button" className={`px-2 py-1 rounded border text-[9px] transition-colors ${statusBtnClass(row.status === opt, opt)}`} onClick={() => updateDiff(idx, "status", opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addDiff}>
            <Plus className="w-3 h-3" /> Add Differentiator
          </Button>
        </CardContent>
      </Card>

      {/* ── 4. Evaluation Criteria Alignment ───────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "eval" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <WinSectionHeader title="Evaluation Criteria Alignment" icon={<BarChart3 className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${data.evaluation_alignment.length} criteria`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {data.evaluation_alignment.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No evaluation criteria added yet.</p>
          )}
          {data.evaluation_alignment.map((row, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeEval(idx)}>
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Evaluation Criteria</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="e.g. Technical Approach" value={row.criteria} onChange={e => updateEval(idx, "criteria", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Weight / Importance</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="e.g. 30%" value={row.weight} onChange={e => updateEval(idx, "weight", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateEval(idx, "owner", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Hala Response Strategy</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="How will Hala respond?" value={row.response_strategy} onChange={e => updateEval(idx, "response_strategy", e.target.value)} />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Evidence Needed</label>
                  <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="What evidence is required?" value={row.evidence_needed} onChange={e => updateEval(idx, "evidence_needed", e.target.value)} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addEval}>
            <Plus className="w-3 h-3" /> Add Evaluation Criteria
          </Button>
        </CardContent>
      </Card>

      {/* ── Save Button ────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="hala-save-button gap-1.5 h-9 text-xs px-5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Win Strategy
        </Button>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}

function WinSectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function WinInnerTabs<T extends string>({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: { key: T; label: string; icon: ReactNode }[];
  activeKey: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
      {tabs.map(section => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
            activeKey === section.key
              ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
              : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
          }`}
        >
          <span className={`mb-1 flex justify-center ${activeKey === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
          <span className="block whitespace-normal text-center">{section.label}</span>
        </button>
      ))}
    </div>
  );
}
