/**
 * TenderPnLCalculatorPanel — Tender-embedded P&L Calculator
 *
 * Sections:
 *   1. Tender Pricing Context (read-only)
 *   2. Embedded PnLCalculatorCore
 *   3. Snapshot Actions (Save Draft / Create Snapshot / Submit for Approval)
 *   4. Latest Snapshot Summary (incl. legacy snapshot)
 *   5. Legacy Cost Inputs (collapsed, read-only, if data exists)
 *   6. Open Full P&L Calculator link
 *
 * Data: pricing.pnl_snapshot (working draft + snapshots)
 * Save: updateTenderPricingData → merges pnl_snapshot only
 * No AI. No PDF Studio. No fake data. No formula duplication.
 */
import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderPricingData } from "@/lib/supabase-tender-actions";
import { normalizeTenderPricingData } from "@/lib/tender-pricing-types";
import { getCurrentUser } from "@/lib/auth-state";
import { formatSAR, formatPercent } from "@/lib/store";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  Loader2, Save, ChevronDown, ChevronRight, Calculator,
  Info, Camera, Send, FileText, Clock, CheckCircle2, AlertTriangle,
  Database, ArrowRight,
} from "lucide-react";
import PnLCalculatorCore, {
  type PnLCalculatorState,
  type PnLCalculatorSummary,
  emptyCalculatorState,
  calculateSummary,
} from "@/components/pnl/PnLCalculatorCore";

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

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusColor(s: string): string {
  if (s.includes("Approved")) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (s === "Snapshot Created" || s === "Working Draft") return "bg-blue-50 border-blue-200 text-blue-700";
  if (s === "Submitted for Pricing Approval") return "bg-indigo-50 border-indigo-200 text-indigo-700";
  if (s === "Rejected") return "bg-red-50 border-red-200 text-red-700";
  if (s === "Revision Required") return "bg-amber-50 border-amber-200 text-amber-700";
  if (s === "Superseded") return "bg-slate-50 border-slate-200 text-slate-500";
  return "bg-slate-50 border-slate-200 text-slate-500";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props { ws: TenderWorkspace; reload: () => void; }

export default function TenderPnLCalculatorPanel({ ws, reload }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const pricing = useMemo(() => normalizeTenderPricingData(t.pricingData), [t.pricingData]);
  const pnlData = pricing.pnl_snapshot as any;
  const costData = pricing.cost_inputs as any;
  const user = getCurrentUser();

  // Target GP: from tender record, with manual override
  const tenderTargetGp = t.targetGpPercent ? String(t.targetGpPercent) : "";
  const savedDraft = pnlData?.working_draft as PnLWorkingDraft | undefined;
  const savedSnapshots = Array.isArray(pnlData?.snapshots) ? pnlData.snapshots as PnLSnapshotRecord[] : [];
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
  const [sections, setSections] = useState<Record<string, boolean>>({
    context: true, calculator: true, actions: true, snapshot: true, legacy_cost: false, legacy_snapshot: false,
  });
  const tog = (k: string) => setSections(p => ({ ...p, [k]: !p[k] }));

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
      const patch = { ...pnlData, working_draft: draft };
      const result = await updateTenderPricingData(tenderId, "pnl_snapshot", patch, "P&L working draft saved");
      if (result.success) { toast.success("P&L working draft saved"); reload(); }
      else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [calcState, targetGpOverride, targetGpSource, user.name, pnlData, tenderId, reload]);

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
      const patch = { ...pnlData, snapshots: existing, active_snapshot_id: snap.id };
      const result = await updateTenderPricingData(tenderId, "pnl_snapshot", patch, "P&L snapshot created");
      if (result.success) { toast.success("P&L snapshot created"); reload(); }
      else toast.error("Snapshot failed", { description: result.error });
    } finally { setSnapshotting(false); }
  }, [calcState, calcSummary, effectiveTargetGp, targetGpSource, user.name, pnlData, tenderId, reload]);

  // Submit for Approval
  const handleSubmitForApproval = useCallback(async () => {
    if (!latestSnapshot) return;
    setSaving(true);
    try {
      const updated = savedSnapshots.map(s =>
        s.id === latestSnapshot.id ? { ...s, status: "Submitted for Pricing Approval" as SnapshotStatus, submitted_at: new Date().toISOString(), updated_by: user.name, updated_at: new Date().toISOString() } : s
      );
      const patch = { ...pnlData, snapshots: updated };
      const result = await updateTenderPricingData(tenderId, "pnl_snapshot", patch, "Snapshot submitted for pricing approval");
      if (result.success) { toast.success("Snapshot submitted for pricing approval"); reload(); }
      else toast.error("Submit failed", { description: result.error });
    } finally { setSaving(false); }
  }, [latestSnapshot, savedSnapshots, pnlData, tenderId, user.name, reload]);


  // Check if legacy cost data exists
  const hasLegacyCost = !!(costData && (
    costData.source?.cost_input_source !== "Not Assessed" ||
    costData.source?.source_reference ||
    costData.notes?.cost_assumptions ||
    Object.values(costData.warehouse_operations || {}).some((v: any) => v && v.trim && v.trim() !== "")
  ));

  return (
    <div className="space-y-4">
      {/* 1 — Tender Pricing Context */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("context")}>
          <div className="flex items-center gap-2">
            {sections.context ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Tender Pricing Context</span>
            <Badge variant="outline" className="text-[8px] ml-auto">read-only</Badge>
          </div>
        </CardHeader>
        {sections.context && (
          <CardContent className="p-3">
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
          </CardContent>
        )}
      </Card>

      {/* Target GP Override */}
      <Card className="border-border shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Target GP % Override</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  className="w-24 border border-border rounded-md px-2 py-1.5 text-xs bg-card"
                  placeholder={tenderTargetGp || "e.g. 22"}
                  value={targetGpOverride}
                  onChange={e => setTargetGpOverride(e.target.value)}
                />
                <Badge variant="outline" className={`text-[8px] ${targetGpSource === "Tender Default" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}`}>
                  {targetGpSource}
                </Badge>
                {targetGpOverride && (
                  <button className="text-[10px] text-muted-foreground hover:text-foreground underline" onClick={() => setTargetGpOverride("")}>
                    Reset to tender default
                  </button>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Effective Target GP</p>
              <p className="text-lg font-bold text-indigo-700">{effectiveTargetGp ? `${effectiveTargetGp}%` : "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 — Embedded P&L Calculator */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("calculator")}>
          <div className="flex items-center gap-2">
            {sections.calculator ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">P&L Calculator</span>
            <Badge variant="outline" className="text-[8px] ml-auto border-indigo-200 text-indigo-700">live calculation</Badge>
          </div>
        </CardHeader>
        {sections.calculator && (
          <CardContent className="p-4">
            <PnLCalculatorCore
              initialState={calcState}
              onStateChange={handleCalcChange}
              compact
            />
          </CardContent>
        )}
      </Card>

      {/* 3 — Snapshot Actions */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("actions")}>
          <div className="flex items-center gap-2">
            {sections.actions ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Camera className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">Snapshot Actions</span>
          </div>
        </CardHeader>
        {sections.actions && (
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Working Draft
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50" onClick={handleCreateSnapshot} disabled={snapshotting}>
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
                <p><strong>Snapshot</strong> — Frozen tender pricing truth. Used for approval and later PDF Studio.</p>
                <p>Approved snapshots are protected from silent overwrite.</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 4 — Latest Snapshot Summary */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("snapshot")}>
          <div className="flex items-center gap-2">
            {sections.snapshot ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Latest Snapshot Summary</span>
            {latestSnapshot && <Badge variant="outline" className={`text-[8px] ml-auto ${statusColor(latestSnapshot.status)}`}>{latestSnapshot.status}</Badge>}
            {!latestSnapshot && hasLegacySnapshot && <Badge variant="outline" className="text-[8px] ml-auto border-amber-200 text-amber-700">Legacy Snapshot</Badge>}
          </div>
        </CardHeader>
        {sections.snapshot && (
          <CardContent className="p-4">
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
        )}
      </Card>

      {/* 5 — Legacy Cost Inputs (collapsed, read-only) */}
      {hasLegacyCost && (
        <Card className="border-border shadow-none">
          <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("legacy_cost")}>
            <div className="flex items-center gap-2">
              {sections.legacy_cost ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-muted-foreground">Legacy Cost Inputs</span>
              <Badge variant="outline" className="text-[8px] ml-auto border-slate-200 text-slate-500">read-only</Badge>
            </div>
          </CardHeader>
          {sections.legacy_cost && (
            <CardContent className="p-3">
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
            </CardContent>
          )}
        </Card>
      )}

      {/* 6 — Future Output Use + Open Full Calculator */}
      <Card className="border-border shadow-none">
        <CardContent className="p-3">
          <div className="space-y-1">
              {[
                { source: "P&L Snapshot", output: "pricing.table.single / Pricing Summary / Approval Matrix" },
                { source: "Approved Snapshot", output: "PDF Studio (future) — proposal-safe pricing truth" },
              ].map(fw => (
                <div key={fw.source} className="flex items-center gap-2 text-[10px]">
                  <Badge variant="outline" className="text-[8px] border-violet-200 bg-violet-50 text-violet-600">{fw.source}</Badge>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{fw.output}</span>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground/60 italic">Informational only — no content is generated or written to PDF Studio.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
