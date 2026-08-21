/**
 * SolutionConfigurationTab — Solution Configuration (control layer)
 * Data key: solution_design_data.configuration
 * Save: merges only solution_design_data.configuration
 *
 * Captures the architecture decision: which HIP/HOP/HAM modules are proposed,
 * customer operating road, market entry mode, solution package, deployment type,
 * expansion path, and customer problem statement.
 *
 * No AI generation. No mock data. No document-output mutation.
 *
 * 7 Sections (section-tab navigation, matching Qualification pattern):
 *   1. Customer Problem Statement
 *   2. Customer Operating Road
 *   3. Module Configuration (modules + readiness)
 *   4. Market Entry Mode
 *   5. Commercial Package (pain categories + solution package + deployment + expansion)
 *   6. Configuration Notes
 *   7. Output Use
 */
import { useState, useCallback, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { runTenderTabSave, tenderRevisionTokenOf } from "./IdentifiedStageShared";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, Settings, MessageSquare,
  Route, Layers, Crosshair, AlertTriangle, Package, Rocket, TrendingUp,
  StickyNote, Info, ArrowRight, CheckCircle2, XCircle, HelpCircle,
  FolderOpen, BarChart3, PanelRightOpen,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

// ── Option sets ──────────────────────────────────────────────────────
const CUSTOMER_ROADS = ["Outsourced", "Insourced", "Hybrid", "Unknown / Not Captured", "Not Assessed"] as const;

const MODULE_CONFIGS = [
  "HIP Only", "HOP Only", "HAM Only",
  "HIP + HOP", "HIP + HAM", "HOP + HAM",
  "HIP + HOP + HAM", "Not Selected",
] as const;

const ENTRY_MODES = [
  "Full 3PL Outsourcing", "Managed In-House Model", "Platform-Led Entry",
  "Operations-Led Entry", "Manpower-Led Entry", "Hybrid Orchestration", "Not Assessed",
] as const;

const PAIN_CATEGORIES = [
  "Poor Visibility", "Weak Operations", "Manpower Instability", "Inventory Inaccuracy",
  "Compliance Risk", "Cost Pressure", "SLA Instability", "Fragmented Providers",
  "Weak Reporting", "Customer Wants Control But Needs Capability", "Other",
] as const;

const SOLUTION_PACKAGES = [
  "Visibility Command Package", "Managed Warehouse Package",
  "Managed In-House Operations Package", "Manpower Productivity Package",
  "Compliance Operations Package", "Integrated Logistics Command Package",
  "4PL Coordination Package", "Other", "Not Selected",
] as const;

const DEPLOYMENT_TYPES = [
  "Standard Launch", "Controlled Pilot", "Phased Deployment",
  "Stabilization Turnaround", "Managed In-House Deployment",
  "Full Integrated Deployment", "Not Assessed",
] as const;

const EXPANSION_PATHS = [
  "HIP → HOP", "HOP → HIP", "HAM → HOP",
  "HOP + HAM → HIP", "HIP + HOP → HAM",
  "Single Site → Multi-Site", "Single Service → Expanded Scope",
  "Pilot → Full Deployment", "No Expansion Path Captured",
] as const;

const FUTURE_WIRING = [
  { source: "Solution Configuration", outputs: ["Executive Summary", "Customer Operating Context", "Hala Solution Package", "HIP/HOP/HAM Modules Included"] },
  { source: "Customer Operating Road", outputs: ["Customer Context", "Solution Strategy", "Win Narrative"] },
  { source: "Selected Modules", outputs: ["Proposal Structure", "Solution Description", "Service Configuration"] },
  { source: "Market Entry Mode", outputs: ["Implementation Approach", "Commercial Model", "Governance Model"] },
  { source: "Deployment Type", outputs: ["Mobilization Plan", "Implementation Plan", "First 90-Day Stabilization"] },
  { source: "Expansion Path", outputs: ["Account Expansion Strategy", "Future-State Roadmap", "Customer Success Plan"] },
];

// ── Section tabs ─────────────────────────────────────────────────────
type ConfigSectionKey = "problem" | "road" | "modules" | "entry" | "commercial" | "notes" | "wiring";

const CONFIG_SECTION_TABS: { key: ConfigSectionKey; label: string; icon: ReactNode }[] = [
  { key: "problem", label: "Customer Problem", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "road", label: "Operating Road", icon: <Route className="w-3.5 h-3.5" /> },
  { key: "modules", label: "Module Configuration", icon: <Layers className="w-3.5 h-3.5" /> },
  { key: "entry", label: "Market Entry Mode", icon: <Crosshair className="w-3.5 h-3.5" /> },
  { key: "commercial", label: "Commercial Package", icon: <Package className="w-3.5 h-3.5" /> },
  { key: "notes", label: "Configuration Notes", icon: <StickyNote className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

// ── Module readiness derivation ──────────────────────────────────────
type ModuleStatus = "Required" | "Not Selected" | "Not Assessed";

function deriveModuleReadiness(selected: string): { hip: ModuleStatus; hop: ModuleStatus; ham: ModuleStatus } {
  if (!selected || selected === "Not Selected") return { hip: "Not Assessed", hop: "Not Assessed", ham: "Not Assessed" };
  const s = selected.toUpperCase();
  return {
    hip: s.includes("HIP") ? "Required" : "Not Selected",
    hop: s.includes("HOP") ? "Required" : "Not Selected",
    ham: s.includes("HAM") ? "Required" : "Not Selected",
  };
}

function statusColor(s: ModuleStatus): string {
  if (s === "Required") return "bg-emerald-100 border-emerald-300 text-emerald-700";
  if (s === "Not Selected") return "bg-slate-100 border-slate-300 text-slate-500";
  return "bg-amber-50 border-amber-200 text-amber-600";
}

function statusIcon(s: ModuleStatus) {
  if (s === "Required") return <CheckCircle2 className="w-3 h-3 text-emerald-600" />;
  if (s === "Not Selected") return <XCircle className="w-3 h-3 text-slate-400" />;
  return <HelpCircle className="w-3 h-3 text-amber-500" />;
}

// ── Helpers ──────────────────────────────────────────────────────────
function btnCls(sel: boolean): string {
  return sel
    ? "bg-blue-100 border-blue-300 text-blue-700 font-medium"
    : "bg-card border-border text-muted-foreground hover:bg-muted/30";
}

function chipCls(sel: boolean): string {
  return sel
    ? "bg-[#075eea]/15 border-[#075eea]/30 text-[#075eea] font-medium"
    : "bg-card border-border text-muted-foreground hover:bg-muted/30";
}

// ── Types ────────────────────────────────────────────────────────────
interface ConfigData {
  customer_problem: { statement: string; evidence: string; owner: string };
  customer_operating_road: string;
  selected_modules: string;
  market_entry_mode: string;
  customer_pain_categories: string[];
  solution_package: string;
  deployment_type: string;
  expansion_path: string[];
  notes: string;
}

function emptyConfig(): ConfigData {
  return {
    customer_problem: { statement: "", evidence: "", owner: "" },
    customer_operating_road: "Not Assessed",
    selected_modules: "Not Selected",
    market_entry_mode: "Not Assessed",
    customer_pain_categories: [],
    solution_package: "Not Selected",
    deployment_type: "Not Assessed",
    expansion_path: [],
    notes: "",
  };
}

// ── Component ────────────────────────────────────────────────────────
/**
 * TCW-T3 (P2b) — this tab's patch carries ONLY its own solution_design_data
 * key (configuration). The write layer patch-merges, so sibling tabs' keys are
 * preserved by the STORED facet — never re-sent from a page-load copy.
 * Exported pure for direct testing.
 */
export function buildSolutionConfigurationPatch(data: ConfigData): Record<string, any> {
  return { configuration: data };
}

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  /** Fires ONLY after a confirmed save (the workspace shell passes reload). */
  onSaved?: () => void;
}

export default function SolutionConfigurationTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const cfg = existing?.configuration;

  const [data, setData] = useState<ConfigData>(() => cfg ? { ...emptyConfig(), ...cfg, customer_problem: { ...emptyConfig().customer_problem, ...(cfg.customer_problem || {}) }, customer_pain_categories: Array.isArray(cfg.customer_pain_categories) ? cfg.customer_pain_categories : [], expansion_path: Array.isArray(cfg.expansion_path) ? cfg.expansion_path : [] } : emptyConfig());

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<ConfigSectionKey>("problem");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const set = <K extends keyof ConfigData>(k: K, v: ConfigData[K]) => setData(p => ({ ...p, [k]: v }));
  const toggleChip = (field: "customer_pain_categories" | "expansion_path", val: string) => {
    setData(p => {
      const arr = [...p[field]];
      const idx = arr.indexOf(val);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(val);
      return { ...p, [field]: arr };
    });
  };

  const moduleReadiness = deriveModuleReadiness(data.selected_modules);

  const staleRetryArmed = useRef(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderSolutionDesignData(tenderId, buildSolutionConfigurationPatch(data), {
            expectedRevision,
            reason: "Solution Configuration saved",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Solution Configuration saved", failed: "Save failed" },
        onConfirmed: () => onSaved?.(),
        // Stale: local form state is untouched — the user's entry stays.
      });
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally { setSaving(false); }
  }, [tenderId, data, onSaved, ws]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          {/* ── Dark Stage Menu Header ───────────────────────── */}
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Solution Design Stage Menu
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                Stage 4
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                stageIntelOpen
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`}
              onClick={() => setStageIntelOpen(prev => !prev)}
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
            </Button>
            {!saving && data.customer_problem.statement && <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>}
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <StageIntelMetric label="Operating Road" value={data.customer_operating_road} />
                <StageIntelMetric label="Modules" value={data.selected_modules} />
                <StageIntelMetric label="Market Entry" value={data.market_entry_mode} />
                <StageIntelMetric label="Package" value={data.solution_package} />
                <StageIntelMetric label="Deployment" value={data.deployment_type} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          {/* ── Section Tab Buttons ─────────────────────────── */}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {CONFIG_SECTION_TABS.map(section => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
                  activeSection === section.key
                    ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
                    : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
                }`}
              >
                <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
                <span className="block whitespace-normal text-center">{section.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 1. Customer Problem Statement ───────────────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "problem" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Customer Problem Statement" icon={<MessageSquare className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">What customer control problem are we solving?</label>
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[70px] resize-y" placeholder="Describe the customer problem..." value={data.customer_problem.statement} onChange={e => set("customer_problem", { ...data.customer_problem, statement: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Problem Evidence / Source</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="e.g. RFP Section 3, site visit notes" value={data.customer_problem.evidence} onChange={e => set("customer_problem", { ...data.customer_problem, evidence: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Problem Owner</label>
              <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Who owns this analysis?" value={data.customer_problem.owner} onChange={e => set("customer_problem", { ...data.customer_problem, owner: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Customer Operating Road ──────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "road" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Customer Operating Road" icon={<Route className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.customer_operating_road} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <p className="text-[10px] text-muted-foreground">Defines whether the customer already outsources logistics, keeps it internal, or uses a hybrid model.</p>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOMER_ROADS.map(o => (
              <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.customer_operating_road === o)}`} onClick={() => set("customer_operating_road", o)}>{o}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Module Configuration ─────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border border-[#075eea]/20 py-0 shadow-none ${activeSection !== "modules" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Selected HIP / HOP / HAM Configuration" icon={<Layers className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.selected_modules} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {MODULE_CONFIGS.map(o => (
              <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.selected_modules === o)}`} onClick={() => set("selected_modules", o)}>{o}</button>
            ))}
          </div>
          {/* Module Readiness Panel */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs font-semibold">Module Readiness</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["hip", "hop", "ham"] as const).map(mod => {
                const s = moduleReadiness[mod];
                const label = mod.toUpperCase();
                const full = mod === "hip" ? "Information & Systems" : mod === "hop" ? "Operations" : "Manpower";
                return (
                  <div key={mod} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${statusColor(s)}`}>
                    {statusIcon(s)}
                    <div>
                      <div className="text-xs font-semibold">{label}</div>
                      <div className="text-[9px]">{full}</div>
                      <div className="text-[9px] font-medium mt-0.5">{s}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — does not block saving or tab access.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Market Entry Mode ────────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "entry" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Market Entry Mode" icon={<Crosshair className="w-3.5 h-3.5 text-[#075eea]" />} badge={data.market_entry_mode} />
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {ENTRY_MODES.map(o => (
              <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.market_entry_mode === o)}`} onClick={() => set("market_entry_mode", o)}>{o}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Commercial Package (pain + package + deploy + expand) */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "commercial" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Commercial Package" icon={<Package className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${data.customer_pain_categories.length} pains, ${data.solution_package}`} />
        </CardHeader>
        <CardContent className="p-4 space-y-5">
          {/* Pain Categories */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Pain Categories</span>
              <Badge variant="outline" className="text-[8px] ml-auto">{data.customer_pain_categories.length} selected</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_CATEGORIES.map(o => (
                <button key={o} type="button" className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${chipCls(data.customer_pain_categories.includes(o))}`} onClick={() => toggleChip("customer_pain_categories", o)}>{o}</button>
              ))}
            </div>
          </div>
          {/* Solution Package */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3 h-3 text-[#075eea]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sector Solution Package</span>
              <Badge variant="outline" className="text-[8px] ml-auto">{data.solution_package}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SOLUTION_PACKAGES.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.solution_package === o)}`} onClick={() => set("solution_package", o)}>{o}</button>
              ))}
            </div>
          </div>
          {/* Deployment Type */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-3 h-3 text-sky-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deployment Type</span>
              <Badge variant="outline" className="text-[8px] ml-auto">{data.deployment_type}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEPLOYMENT_TYPES.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.deployment_type === o)}`} onClick={() => set("deployment_type", o)}>{o}</button>
              ))}
            </div>
          </div>
          {/* Expansion Path */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3 h-3 text-teal-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expansion Path</span>
              <Badge variant="outline" className="text-[8px] ml-auto">{data.expansion_path.length} selected</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXPANSION_PATHS.map(o => (
                <button key={o} type="button" className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${chipCls(data.expansion_path.includes(o))}`} onClick={() => toggleChip("expansion_path", o)}>{o}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 6. Configuration Notes ──────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "notes" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Configuration Notes" icon={<StickyNote className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4">
          <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Any additional configuration notes..." value={data.notes} onChange={e => set("notes", e.target.value)} />
        </CardContent>
      </Card>

      {/* ── 7. Output Use ────────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-2">
            {FUTURE_WIRING.map(fw => (
              <div key={fw.source} className="flex items-start gap-2 text-[10px]">
                <Badge variant="outline" className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea] shrink-0 mt-0.5">{fw.source}</Badge>
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{fw.outputs.join(", ")}</span>
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to discontinued document tooling.</p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Solution Configuration
        </Button>
      </div>
      </div>
    </div>
  );
}

// ── Helper: Section Header (matches SowSectionHeader) ────────────────
function SectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left group">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

// ── Helper: Stage Intel Metric (matches Qualification) ───────────────
function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
