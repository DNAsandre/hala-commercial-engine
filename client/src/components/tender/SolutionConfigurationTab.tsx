/**
 * SolutionConfigurationTab — Solution Configuration (control layer)
 * Data key: solution_design_data.configuration
 * Save: merges only solution_design_data.configuration
 *
 * Captures the architecture decision: which HIP/HOP/HAM modules are proposed,
 * customer operating road, market entry mode, solution package, deployment type,
 * expansion path, and customer problem statement.
 *
 * No AI generation. No mock data. No PDF Studio mutation.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Settings, MessageSquare,
  Route, Layers, Crosshair, AlertTriangle, Package, Rocket, TrendingUp,
  StickyNote, Info, ArrowRight, CheckCircle2, XCircle, HelpCircle,
} from "lucide-react";

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
    ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium"
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
interface Props { ws: TenderWorkspace; }

export default function SolutionConfigurationTab({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const cfg = existing?.configuration;

  const [data, setData] = useState<ConfigData>(() => cfg ? { ...emptyConfig(), ...cfg, customer_problem: { ...emptyConfig().customer_problem, ...(cfg.customer_problem || {}) }, customer_pain_categories: Array.isArray(cfg.customer_pain_categories) ? cfg.customer_pain_categories : [], expansion_path: Array.isArray(cfg.expansion_path) ? cfg.expansion_path : [] } : emptyConfig());

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({
    problem: true, road: true, modules: true, entry: true, pain: true,
    package: true, deploy: true, expand: true, notes: true,
    readiness: true, future: false,
  });
  const tog = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), configuration: data };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "Solution Configuration saved");
      if (result.success) toast.success("Solution Configuration saved");
      else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, data, existing]);

  return (
    <div className="space-y-4">
      {/* 1 — Customer Problem Statement */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("problem")}>
          <div className="flex items-center gap-2">
            {open.problem ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Customer Problem Statement</span>
          </div>
        </CardHeader>
        {open.problem && (
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
        )}
      </Card>

      {/* 2 — Customer Operating Road */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("road")}>
          <div className="flex items-center gap-2">
            {open.road ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Route className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Customer Operating Road</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.customer_operating_road}</Badge>
          </div>
        </CardHeader>
        {open.road && (
          <CardContent className="p-4 space-y-3">
            <p className="text-[10px] text-muted-foreground">Defines whether the customer already outsources logistics, keeps it internal, or uses a hybrid model.</p>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOMER_ROADS.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.customer_operating_road === o)}`} onClick={() => set("customer_operating_road", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 3 — Selected HIP/HOP/HAM Configuration */}
      <Card className="border-border shadow-none border-indigo-200">
        <CardHeader className="pb-2 border-b border-indigo-200 bg-indigo-50/30 cursor-pointer" onClick={() => tog("modules")}>
          <div className="flex items-center gap-2">
            {open.modules ? <ChevronDown className="w-3 h-3 text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-900">Selected HIP / HOP / HAM Configuration</span>
            <Badge variant="outline" className="text-[8px] ml-auto border-indigo-300 text-indigo-700">{data.selected_modules}</Badge>
          </div>
        </CardHeader>
        {open.modules && (
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {MODULE_CONFIGS.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.selected_modules === o)}`} onClick={() => set("selected_modules", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Module Readiness Panel */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("readiness")}>
          <div className="flex items-center gap-2">
            {open.readiness ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-semibold">Module Readiness</span>
          </div>
        </CardHeader>
        {open.readiness && (
          <CardContent className="p-4">
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
          </CardContent>
        )}
      </Card>

      {/* 4 — Market Entry Mode */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("entry")}>
          <div className="flex items-center gap-2">
            {open.entry ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Crosshair className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Market Entry Mode</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.market_entry_mode}</Badge>
          </div>
        </CardHeader>
        {open.entry && (
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {ENTRY_MODES.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.market_entry_mode === o)}`} onClick={() => set("market_entry_mode", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 5 — Customer Pain Categories */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("pain")}>
          <div className="flex items-center gap-2">
            {open.pain ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-semibold">Customer Pain Categories</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.customer_pain_categories.length} selected</Badge>
          </div>
        </CardHeader>
        {open.pain && (
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {PAIN_CATEGORIES.map(o => (
                <button key={o} type="button" className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${chipCls(data.customer_pain_categories.includes(o))}`} onClick={() => toggleChip("customer_pain_categories", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 6 — Solution Package */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("package")}>
          <div className="flex items-center gap-2">
            {open.package ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Package className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">Sector Solution Package</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.solution_package}</Badge>
          </div>
        </CardHeader>
        {open.package && (
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {SOLUTION_PACKAGES.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.solution_package === o)}`} onClick={() => set("solution_package", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 7 — Deployment Type */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("deploy")}>
          <div className="flex items-center gap-2">
            {open.deploy ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Rocket className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-xs font-semibold">Deployment Type</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.deployment_type}</Badge>
          </div>
        </CardHeader>
        {open.deploy && (
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {DEPLOYMENT_TYPES.map(o => (
                <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(data.deployment_type === o)}`} onClick={() => set("deployment_type", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 8 — Expansion Path */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("expand")}>
          <div className="flex items-center gap-2">
            {open.expand ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-xs font-semibold">Expansion Path</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{data.expansion_path.length} selected</Badge>
          </div>
        </CardHeader>
        {open.expand && (
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">
              {EXPANSION_PATHS.map(o => (
                <button key={o} type="button" className={`px-2.5 py-1.5 rounded-md border text-xs transition-colors ${chipCls(data.expansion_path.includes(o))}`} onClick={() => toggleChip("expansion_path", o)}>{o}</button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 9 — Configuration Notes */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("notes")}>
          <div className="flex items-center gap-2">
            {open.notes ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <StickyNote className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold">Configuration Notes</span>
          </div>
        </CardHeader>
        {open.notes && (
          <CardContent className="p-4">
            <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Any additional configuration notes..." value={data.notes} onChange={e => set("notes", e.target.value)} />
          </CardContent>
        )}
      </Card>

      {/* Future Output Use */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("future")}>
          <div className="flex items-center gap-2">
            {open.future ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-muted-foreground">Future Output Use</span>
          </div>
        </CardHeader>
        {open.future && (
          <CardContent className="p-3">
            <div className="space-y-2">
              {FUTURE_WIRING.map(fw => (
                <div key={fw.source} className="flex items-start gap-2 text-[10px]">
                  <Badge variant="outline" className="text-[8px] border-violet-200 bg-violet-50 text-violet-600 shrink-0 mt-0.5">{fw.source}</Badge>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{fw.outputs.join(", ")}</span>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to PDF Studio.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Solution Configuration
        </Button>
      </div>
    </div>
  );
}
