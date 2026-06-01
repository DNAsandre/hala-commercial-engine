/**
 * WinStrategyTab — Manual Win Strategy Capture
 *
 * Sections:
 *   1. Strategic Rationale (3 textareas)
 *   2. Win Themes (repeatable rows)
 *   3. Differentiators (repeatable rows)
 *   4. Evaluation Criteria Alignment (repeatable rows)
 *   5. Future Output Use (read-only)
 *   6. Save Button
 *
 * Data: ws.tender.bidNoBidData.win_strategy
 * Save: updateTenderBidNoBidData → merges win_strategy only
 *
 * Rules:
 * - No fake data, no AI, no hardcoded examples.
 * - Manual capture only. No stage movement. No CRM/PDF Studio.
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  Lightbulb, Trophy, Star, BarChart3, ArrowRight, Info,
} from "lucide-react";

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

const FUTURE_WIRING = [
  { source: "Win Themes", output: "Executive Summary / Value Proposition" },
  { source: "Differentiators", output: "Why Hala / Technical Proposal" },
  { source: "Evaluation Criteria", output: "Proposal structure and scoring alignment" },
  { source: "Rationale", output: "Bid / No-Bid pack and executive approval note" },
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

interface Props {
  ws: TenderWorkspace;
}

export default function WinStrategyTab({ ws }: Props) {
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
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    rationale: true, themes: true, differentiators: true, eval: true, future: false,
  });
  const toggle = (k: string) => setSectionsOpen(p => ({ ...p, [k]: !p[k] }));

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), win_strategy: data };
      const result = await updateTenderBidNoBidData(tenderId, patch, "Win Strategy tab saved");
      if (result.success) toast.success("Win Strategy saved");
      else toast.error("Save failed", { description: result.error });
    } finally {
      setSaving(false);
    }
  }, [tenderId, data, existing]);

  return (
    <div className="space-y-4">
      {/* ── Rationale ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("rationale")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.rationale ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Strategic Rationale</span>
          </div>
        </CardHeader>
        {sectionsOpen.rationale && (
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
        )}
      </Card>

      {/* ── Win Themes ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("themes")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.themes ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Trophy className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Win Themes</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.win_themes.length} themes</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.themes && (
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
        )}
      </Card>

      {/* ── Differentiators ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("differentiators")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.differentiators ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Star className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-xs font-semibold">Differentiators</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.differentiators.length}</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.differentiators && (
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
        )}
      </Card>

      {/* ── Evaluation Criteria Alignment ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("eval")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.eval ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Evaluation Criteria Alignment</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.evaluation_alignment.length}</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.eval && (
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
        )}
      </Card>

      {/* ── Future Output Use (read-only) ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("future")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.future ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-muted-foreground">Future Output Use</span>
          </div>
        </CardHeader>
        {sectionsOpen.future && (
          <CardContent className="p-3">
            <div className="space-y-1.5">
              {FUTURE_WIRING.map(fw => (
                <div key={fw.source} className="flex items-center gap-2 text-[10px]">
                  <Badge variant="outline" className="text-[8px] border-violet-200 bg-violet-50 text-violet-600">{fw.source}</Badge>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{fw.output}</span>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to PDF Studio.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Win Strategy
        </Button>
      </div>
    </div>
  );
}
