/**
 * TenderPnLCalculatorPanel — Tender-embedded P&L Calculator
 *
 * 5 Sections (section-tab navigation, matching Qualification pattern):
 *   1. Tender Pricing Context
 *   2. P&L Calculator
 *   3. Snapshot Actions
 *   4. Latest Snapshot Summary
 *   5. Legacy Cost Inputs
 *
 * Data: pricing.pnl_snapshot (working draft + snapshots)
 * Save: updateTenderPricingData → merges pnl_snapshot only
 * No AI. No document-output tooling. No fake data. No formula duplication.
 */
import { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderPricingData } from "@/lib/supabase-tender-actions";
import { runTenderTabSave, tenderRevisionTokenOf } from "./IdentifiedStageShared";
import { normalizeTenderPricingData } from "@/lib/tender-pricing-types";
import { getCurrentUser } from "@/lib/auth-state";
import { formatSAR, formatPercent } from "@/lib/store";
import { nanoid } from "nanoid";
import {
  Loader2, Save, ChevronDown, Calculator,
  Info, Camera, Send, CheckCircle2, AlertTriangle,
  Database, ArrowRight, FolderOpen, BarChart3, PanelRightOpen,
} from "lucide-react";
import PnLCalculatorCore, {
  type PnLCalculatorState,
  type PnLCalculatorSummary,
  emptyCalculatorState,
  calculateSummary,
} from "@/components/pnl/PnLCalculatorCore";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

const SNAPSHOT_STATUSES = [
  "Working Draft", "Snapshot Created", "Submitted for Pricing Approval",
  "Finance Approved", "Commercial Approved", "Management Approved",
  "Rejected", "Revision Required", "Superseded",
] as const;

type SnapshotStatus = typeof SNAPSHOT_STATUSES[number];

interface PnLSnapshotRecord {
  id: string;
  status: SnapshotStatus;
  calculator_state: PnLCalculatorState;
  summary: {
    monthly_revenue: number;
    annual_revenue: number;
    monthly_opex: number;
    annual_opex: number;
    gross_profit: number;
    gp_percent: number;
    target_gp_percent: string;
    target_gp_source: string;
    variance_to_target: string;
    approval_chain_required: string;
  };
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  submitted_at: string;
  approved_by: string;
  approved_at: string;
  notes: string;
}

interface PnLWorkingDraft {
  calculator_state: PnLCalculatorState;
  target_gp_override: string;
  target_gp_source: string;
  updated_by: string;
  updated_at: string;
}

export function isUsablePnLSnapshotRecord(value: unknown): value is PnLSnapshotRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && record.id.trim().length > 0
    && typeof record.status === "string"
    && SNAPSHOT_STATUSES.includes(record.status as SnapshotStatus)
    && Boolean(record.calculator_state)
    && typeof record.calculator_state === "object"
    && Boolean(record.summary)
    && typeof record.summary === "object";
}

// ── Section tabs ─────────────────────────────────────────────────────
type CalcSectionKey = "context" | "calculator" | "actions" | "snapshot" | "legacy_cost";

const CALC_SECTION_TABS: { key: CalcSectionKey; label: string; icon: ReactNode }[] = [
  { key: "context", label: "Pricing Context", icon: <Info className="w-3.5 h-3.5" /> },
  { key: "calculator", label: "P&L Calculator", icon: <Calculator className="w-3.5 h-3.5" /> },
  { key: "actions", label: "Snapshot Actions", icon: <Camera className="w-3.5 h-3.5" /> },
  { key: "snapshot", label: "Latest Snapshot", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "legacy_cost", label: "Legacy Cost Inputs", icon: <Database className="w-3.5 h-3.5" /> },
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusColor(s: string): string {
  if (s.includes("Approved")) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (s === "Snapshot Created" || s === "Working Draft") return "bg-blue-50 border-blue-200 text-blue-700";
  if (s === "Submitted for Pricing Approval") return "bg-[#075eea]/10 border-[#075eea]/20 text-[#075eea]";
  if (s === "Rejected") return "bg-red-50 border-red-200 text-red-700";
  if (s === "Revision Required") return "bg-amber-50 border-amber-200 text-amber-700";
  if (s === "Superseded") return "bg-slate-50 border-slate-200 text-slate-500";
  return "bg-slate-50 border-slate-200 text-slate-500";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props { ws: TenderWorkspace; reload: () => void; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; }

export default function TenderPnLCalculatorPanel({ ws, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const pricing = useMemo(() => normalizeTenderPricingData(t.pricingData), [t.pricingData]);
  const pnlData = pricing.pnl_snapshot as any;
  const costData = pricing.cost_inputs as any;
  const user = getCurrentUser();

  // Target GP: from tender record, with manual override
  const tenderTargetGp = t.targetGpPercent ? String(t.targetGpPercent) : "";
  const savedDraft = pnlData?.working_draft as PnLWorkingDraft | undefined;
  const rawSnapshots: unknown[] = Array.isArray(pnlData?.snapshots) ? pnlData.snapshots : [];
  const savedSnapshots = rawSnapshots.filter(isUsablePnLSnapshotRecord);
  const ignoredSnapshotCount = rawSnapshots.length - savedSnapshots.length;
  const latestSnapshot = savedSnapshots.length > 0 ? savedSnapshots[savedSnapshots.length - 1] : null;

  // Is there a legacy snapshot from old manual text fields?
  const hasLegacySnapshot = !!(pnlData?.snapshot_status && pnlData.snapshot_status !== "No Snapshot" && !pnlData?.snapshots);

  // Calculator state: load from draft, or empty
  const [calcState, setCalcState] = useState<PnLCalculatorState>(
    () => savedDraft?.calculator_state ?? emptyCalculatorState()
  );
  const [calcSummary, setCalcSummary] = useState<PnLCalculatorSummary>(() => calculateSummary(calcState));
  const [targetGpOverride, setTargetGpOverride] = useState(savedDraft?.target_gp_override ?? "");
  const effectiveTargetGp = targetGpOverride || tenderTargetGp;
  const targetGpSource = targetGpOverride ? "Manual Override" : "Tender Default";

  const [saving, setSaving] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [activeSection, setActiveSection] = useState<CalcSectionKey>("context");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const staleRetryArmed = useRef(false);

  const handleCalcChange = useCallback((state: PnLCalculatorState, summary: PnLCalculatorSummary) => {
    setCalcState(state);
    setCalcSummary(summary);
  }, []);

  // Save Working Draft
  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const draft: PnLWorkingDraft = {
        calculator_state: calcState,
        target_gp_override: targetGpOverride,
        target_gp_source: targetGpSource,
        updated_by: user.name,
        updated_at: new Date().toISOString(),
      };
      // Contract note: `pnlData` derives from the CURRENT ws prop (memo on
      // t.pricingData), so the section base is the freshly loaded bundle at
      // save time, and the same bundle's revision token guards the write — a
      // stale base can no longer silently overwrite snapshots/draft.
      const patch = { ...pnlData, working_draft: draft };
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderPricingData(tenderId, "pnl_snapshot", patch, "P&L working draft saved", expectedRevision),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "P&L working draft saved", failed: "Save failed" },
        onConfirmed: () => reload(),
        // Stale: calculator state is local and untouched; refresh the bundle
        // underneath so the retry runs against the current stored pricing.
        onStale: () => reload(),
      });
    } finally { setSaving(false); }
  }, [calcState, targetGpOverride, targetGpSource, user.name, pnlData, tenderId, reload, ws]);

  // Create Snapshot
  const handleCreateSnapshot = useCallback(async () => {
    setSnapshotting(true);
    try {
      const varianceNum = effectiveTargetGp ? (calcSummary.gpPercent - parseFloat(effectiveTargetGp)).toFixed(2) : "N/A";
      const snap: PnLSnapshotRecord = {
        id: nanoid(),
        status: "Snapshot Created",
        calculator_state: calcState,
        summary: {
          monthly_revenue: calcSummary.monthlyRev,
          annual_revenue: calcSummary.annualRev,
          monthly_opex: calcSummary.totalMonthlyOpex,
          annual_opex: calcSummary.annualOpex,
          gross_profit: calcSummary.grossProfit,
          gp_percent: calcSummary.gpPercent,
          target_gp_percent: effectiveTargetGp || "Not captured",
          target_gp_source: targetGpSource,
          variance_to_target: varianceNum !== "N/A" ? `${varianceNum}%` : "Not captured",
          approval_chain_required: calcSummary.approvalChain,
        },
        created_by: user.name,
        created_at: new Date().toISOString(),
        updated_by: user.name,
        updated_at: new Date().toISOString(),
        submitted_at: "",
        approved_by: "",
        approved_at: "",
        notes: "",
      };
      const existing = Array.isArray(pnlData?.snapshots) ? [...pnlData.snapshots] : [];
      existing.push(snap);
      // Section base = freshly loaded ws at save time; token from the same
      // bundle guards against appending onto a stale snapshot list.
      const patch = { ...pnlData, snapshots: existing, active_snapshot_id: snap.id };
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderPricingData(tenderId, "pnl_snapshot", patch, "P&L snapshot created", expectedRevision),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "P&L snapshot created", failed: "Snapshot failed" },
        onConfirmed: () => reload(),
        onStale: () => reload(),
      });
    } finally { setSnapshotting(false); }
  }, [calcState, calcSummary, effectiveTargetGp, targetGpSource, user.name, pnlData, tenderId, reload, ws]);

  // Submit for Approval
  const handleSubmitForApproval = useCallback(async () => {
    if (!latestSnapshot) return;
    setSaving(true);
    try {
      const updated = savedSnapshots.map(s =>
        s.id === latestSnapshot.id ? { ...s, status: "Submitted for Pricing Approval" as SnapshotStatus, submitted_at: new Date().toISOString(), updated_by: user.name, updated_at: new Date().toISOString() } : s
      );
      // Section base = freshly loaded ws at save time (savedSnapshots derives
      // from the current bundle); the same bundle's token guards the write.
      const patch = { ...pnlData, snapshots: updated };
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderPricingData(tenderId, "pnl_snapshot", patch, "Snapshot submitted for pricing approval", expectedRevision),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Snapshot submitted for pricing approval", failed: "Submit failed" },
        onConfirmed: () => reload(),
        onStale: () => reload(),
      });
    } finally { setSaving(false); }
  }, [latestSnapshot, savedSnapshots, pnlData, tenderId, user.name, reload, ws]);

  // Check if legacy cost data exists
  const hasLegacyCost = !!(costData && (
    costData.source?.cost_input_source !== "Not Assessed" ||
    costData.source?.source_reference ||
    costData.notes?.cost_assumptions ||
    Object.values(costData.warehouse_operations || {}).some((v: any) => v && v.trim && v.trim() !== "")
  ));

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          {/* ── Dark Stage Menu Header ───────────────────────── */}
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">P&L / Pricing Stage Menu</span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">Stage 5</Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {onOpenDocuments && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                  <FolderOpen className="w-3.5 h-3.5" />Open Documents
                </Button>
              )}
              {onOpenGlobalIntel && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                  <BarChart3 className="w-3.5 h-3.5" />Global Intelligence
                </Button>
              )}
              <Button type="button" variant="outline" size="sm"
                className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${stageIntelOpen ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white" : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"}`}
                onClick={() => setStageIntelOpen(prev => !prev)}>
                <PanelRightOpen className="w-3.5 h-3.5" />{stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
              </Button>
              {(savedSnapshots.length > 0 || hasLegacySnapshot || (pnlData as any)?.snapshots?.length > 0) && (
                <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>
              )}
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <StageIntelMetric label="Target GP" value={effectiveTargetGp ? `${effectiveTargetGp}%` : "Not set"} />
                <StageIntelMetric label="GP Source" value={targetGpSource} />
                <StageIntelMetric label="Latest Snapshot" value={latestSnapshot ? latestSnapshot.status : hasLegacySnapshot ? "Legacy" : "None"} />
                <StageIntelMetric label="Snapshots" value={`${savedSnapshots.length}`} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          {/* ── Section Tab Buttons ─────────────────────────── */}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {CALC_SECTION_TABS.map(section => (
              <button key={section.key} type="button" onClick={() => setActiveSection(section.key)}
                className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${activeSection === section.key ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]" : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"}`}>
                <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
                <span className="block whitespace-normal text-center">{section.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="p-4 space-y-4">
      {/* ── 1. Tender Pricing Context ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "context" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Tender Pricing Context" icon={<Info className="w-3.5 h-3.5 text-[#075eea]" />} badge="read-only" /></CardHeader>
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ["Tender", t.title || "Not captured"],
              ["Customer", t.customerName || "Not captured"],
              ["Tender ID", tenderId.substring(0, 8) + "…"],
              ["Current Stage", t.status?.replace(/_/g, " ") || "Not captured"],
              ["Target GP", tenderTargetGp ? `${tenderTargetGp}%` : "Not captured"],
              ["Latest Snapshot", latestSnapshot ? latestSnapshot.status : hasLegacySnapshot ? "Legacy Snapshot" : "No snapshot"],
              ["Solution Config", (t.solutionDesignData as any)?.configuration?.selected_modules || "Not captured"],
              ["Active Snapshot ID", pnlData?.active_snapshot_id ? pnlData.active_snapshot_id.substring(0, 8) + "…" : "None"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-border bg-card p-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className={`mt-0.5 text-xs ${value === "Not captured" || value === "No snapshot" || value === "None" ? "text-muted-foreground" : "font-medium"}`}>{value}</p>
              </div>
            ))}
          </div>
          {/* Target GP Override */}
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Target GP % Override</label>
              <div className="flex items-center gap-2">
                <input type="number" step="0.1" className="w-24 border border-border rounded-md px-2 py-1.5 text-xs bg-card" placeholder={tenderTargetGp || "e.g. 22"} value={targetGpOverride} onChange={e => setTargetGpOverride(e.target.value)} />
                <Badge variant="outline" className={`text-[8px] ${targetGpSource === "Tender Default" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}`}>{targetGpSource}</Badge>
                {targetGpOverride && (<button className="text-[10px] text-muted-foreground hover:text-foreground underline" onClick={() => setTargetGpOverride("")}>Reset to tender default</button>)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Effective Target GP</p>
              <p className="text-lg font-bold text-[#075eea]">{effectiveTargetGp ? `${effectiveTargetGp}%` : "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. P&L Calculator ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "calculator" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="P&L Calculator" icon={<Calculator className="w-3.5 h-3.5 text-[#075eea]" />} badge="live calculation" /></CardHeader>
        <CardContent className="p-4">
          <PnLCalculatorCore
            initialState={calcState}
            onStateChange={handleCalcChange}
            compact
          />
        </CardContent>
      </Card>

      {/* ── 3. Snapshot Actions ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "actions" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Snapshot Actions" icon={<Camera className="w-3.5 h-3.5 text-[#075eea]" />} /></CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={handleSaveDraft} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Working Draft
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 border-[#075eea]/30 text-[#075eea] hover:bg-[#075eea]/10" onClick={handleCreateSnapshot} disabled={snapshotting}>
              {snapshotting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              Create P&L Snapshot
            </Button>
            {latestSnapshot && latestSnapshot.status === "Snapshot Created" && (
              <Button size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={handleSubmitForApproval} disabled={saving}>
                <Send className="w-3.5 h-3.5" />
                Submit for Pricing Approval
              </Button>
            )}
          </div>
          <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <div>
              <p><strong>Working Draft</strong> — Editable calculator state. Not proposal-safe.</p>
              <p><strong>Snapshot</strong> — Frozen tender pricing truth. Used for approval and final pack readiness.</p>
              <p>Approved snapshots are protected from silent overwrite.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Latest Snapshot Summary ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "snapshot" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Latest Snapshot Summary" icon={<CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />} badge={latestSnapshot ? latestSnapshot.status : hasLegacySnapshot ? "Legacy" : "None"} />
        </CardHeader>
        <CardContent className="p-4">
          {ignoredSnapshotCount > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{ignoredSnapshotCount} incomplete pricing snapshot {ignoredSnapshotCount === 1 ? "row was" : "rows were"} ignored. Create and save a new snapshot to replace it.</span>
            </div>
          )}
          {latestSnapshot ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ["Snapshot ID", latestSnapshot.id.substring(0, 12) + "…"],
                  ["Status", latestSnapshot.status],
                  ["Monthly Revenue", formatSAR(latestSnapshot.summary.monthly_revenue)],
                  ["Annual Revenue", formatSAR(latestSnapshot.summary.annual_revenue)],
                  ["Monthly OPEX", formatSAR(latestSnapshot.summary.monthly_opex)],
                  ["Annual OPEX", formatSAR(latestSnapshot.summary.annual_opex)],
                  ["Gross Profit", formatSAR(latestSnapshot.summary.gross_profit)],
                  ["GP %", `${latestSnapshot.summary.gp_percent.toFixed(2)}%`],
                  ["Target GP %", latestSnapshot.summary.target_gp_percent],
                  ["Variance to Target", latestSnapshot.summary.variance_to_target],
                  ["Approval Chain", latestSnapshot.summary.approval_chain_required],
                  ["Target GP Source", latestSnapshot.summary.target_gp_source || "Not captured"],
                  ["Created By", latestSnapshot.created_by || "Not captured"],
                  ["Created At", latestSnapshot.created_at ? new Date(latestSnapshot.created_at).toLocaleString() : "Not captured"],
                  ["Approved By", latestSnapshot.approved_by || "Not captured"],
                  ["Approved At", latestSnapshot.approved_at ? new Date(latestSnapshot.approved_at).toLocaleString() : "Not captured"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border p-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className={`mt-0.5 text-xs ${value === "Not captured" ? "text-muted-foreground" : "font-medium"}`}>{value}</p>
                  </div>
                ))}
              </div>
              {savedSnapshots.length > 1 && (
                <p className="text-[10px] text-muted-foreground">{savedSnapshots.length} total snapshots recorded for this tender.</p>
              )}
            </div>
          ) : hasLegacySnapshot ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Legacy snapshot from manual entry. Create a new snapshot from the embedded calculator for controlled pricing.
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ["Snapshot Status", pnlData.snapshot_status || "Not captured"],
                  ["Calculator Source", pnlData.calculator_source || "Not captured"],
                  ["Monthly Revenue", pnlData.monthly_revenue || "Not captured"],
                  ["Annual Revenue", pnlData.annual_revenue || "Not captured"],
                  ["Monthly OPEX", pnlData.monthly_opex || "Not captured"],
                  ["Annual OPEX", pnlData.annual_opex || "Not captured"],
                  ["Gross Profit SAR", pnlData.gross_profit_sar || "Not captured"],
                  ["GP %", pnlData.gp_percent || "Not captured"],
                  ["Target GP %", pnlData.target_gp_percent || "Not captured"],
                  ["Approval Chain", pnlData.approval_chain_required || "Not captured"],
                  ["Last Updated By", pnlData.last_updated_by || "Not captured"],
                  ["Last Snapshot Date", pnlData.last_snapshot_date || "Not captured"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border p-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className={`mt-0.5 text-xs ${value === "Not captured" ? "text-muted-foreground" : "font-medium"}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
              No P&L snapshot created for this tender yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Legacy Cost Inputs ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "legacy_cost" ? "hidden" : ""}`}>
        <CardHeader className="p-0"><SectionHeader title="Legacy Cost Inputs" icon={<Database className="w-3.5 h-3.5 text-[#075eea]" />} badge="read-only" /></CardHeader>
        <CardContent className="p-3">
          {hasLegacyCost ? (
            <>
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Existing cost input data from the previous Cost Inputs tab. Read-only — not used by the calculator unless explicitly mapped.
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  ["Source", costData.source?.cost_input_source || "Not captured"],
                  ["Source Reference", costData.source?.source_reference || "Not captured"],
                  ["Owner", costData.source?.owner || "Not captured"],
                  ["Last Updated", costData.source?.last_updated || "Not captured"],
                  ["Cost Assumptions", costData.notes?.cost_assumptions || "Not captured"],
                  ["Pricing Dependencies", costData.notes?.pricing_dependencies || "Not captured"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border p-2">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className={`mt-0.5 text-xs ${value === "Not captured" ? "text-muted-foreground" : ""}`}>{value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
              No legacy cost input data found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Output Use */}
      <Card className="gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none">
        <CardContent className="p-3">
          <div className="space-y-1">
            {[
              { source: "P&L Snapshot", output: "pricing.table.single / Pricing Summary / Approval Matrix" },
              { source: "Approved Snapshot", output: "Final Pack Pricing Truth" },
            ].map(fw => (
              <div key={fw.source} className="flex items-center gap-2 text-[10px]">
                <Badge variant="outline" className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]">{fw.source}</Badge>
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">{fw.output}</span>
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground/60 italic">Informational only — no content is generated or written to discontinued document tooling.</p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

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

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
