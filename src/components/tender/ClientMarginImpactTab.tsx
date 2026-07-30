/**
 * ClientMarginImpactTab — Tab 3 of Client Evaluation Stage
 *
 * Before/after pricing comparison showing margin impact.
 * Reads original values from the tender record (estimatedValue, targetGpPercent).
 * User enters current quoted values if they've changed.
 *
 * Data: type_details.client_evaluation.margin_impact
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Loader2, Info, TrendingDown, TrendingUp, DollarSign, ArrowRight, Minus } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderClientEvaluationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

export default function ClientMarginImpactTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.client_evaluation?.margin_impact ?? {};

  const originalValue = (ws.tender as any).estimatedValue || 0;
  const originalGp = (ws.tender as any).targetGpPercent || 0;
  const originalPricingLabel = saved.original_pricing_label || "Original Submission";

  const [currentValue, setCurrentValue] = useState<number>(saved.current_value ?? originalValue);
  const [currentGp, setCurrentGp] = useState<number>(saved.current_gp ?? originalGp);
  const [impactNotes, setImpactNotes] = useState(saved.impact_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const valueDelta = currentValue - originalValue;
  const gpDelta = currentGp - originalGp;
  const valueDeltaPct = originalValue > 0 ? ((valueDelta / originalValue) * 100) : 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        current_value: currentValue,
        current_gp: currentGp,
        original_pricing_label: originalPricingLabel,
        impact_notes: impactNotes,
      };
      const res = await updateTenderClientEvaluationData(tenderId, "margin_impact", payload, `Margin: ${originalGp.toFixed(1)}% → ${currentGp.toFixed(1)}%`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Margin impact saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [currentValue, currentGp, originalPricingLabel, impactNotes, originalGp, tenderId, reload]);

  const formatSar = (n: number) => n >= 1_000_000 ? `SAR ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `SAR ${(n / 1_000).toFixed(0)}K` : `SAR ${n.toLocaleString()}`;

  const gpBarColor = (gp: number) => gp >= 22 ? "bg-emerald-500" : gp >= 15 ? "bg-amber-500" : "bg-red-500";
  const gpTextColor = (gp: number) => gp >= 22 ? "text-emerald-700" : gp >= 15 ? "text-amber-700" : "text-red-700";

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Compare the original tender pricing with the current position. If BAFO or negotiation has changed the pricing, update the current values to track margin drift.</span>
      </div>

      {/* Save Strip */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Margin</span>
        <div className="flex items-center gap-1.5">
          {gpDelta < 0 ? <TrendingDown className="w-3 h-3 text-red-500" /> : gpDelta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <Minus className="w-3 h-3 text-slate-400" />}
          <span className={`text-[10px] font-mono font-semibold ${gpDelta < 0 ? "text-red-600" : gpDelta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
            {gpDelta >= 0 ? "+" : ""}{gpDelta.toFixed(1)}% GP shift
          </span>
        </div>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Visual Comparison */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Pricing Comparison</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-6">
            {/* Original */}
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Original Submission</p>
              <p className="text-xl font-bold">{formatSar(originalValue)}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Gross Profit</span>
                  <span className={`text-xs font-bold ${gpTextColor(originalGp)}`}>{originalGp.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${gpBarColor(originalGp)} transition-all`} style={{ width: `${Math.min(originalGp, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center justify-center">
              <ArrowRight className="w-6 h-6 text-[#5b9cff]" />
              <div className="mt-2 text-center">
                <p className={`text-lg font-bold ${valueDelta < 0 ? "text-red-600" : valueDelta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {valueDelta >= 0 ? "+" : ""}{valueDeltaPct.toFixed(1)}%
                </p>
                <p className="text-[9px] text-muted-foreground">price change</p>
                <p className={`text-sm font-bold mt-1 ${gpDelta < 0 ? "text-red-600" : gpDelta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {gpDelta >= 0 ? "+" : ""}{gpDelta.toFixed(1)}%
                </p>
                <p className="text-[9px] text-muted-foreground">GP shift</p>
              </div>
            </div>

            {/* Current */}
            <div className="rounded-lg border border-[#075eea]/20 p-4 bg-[#075eea]/10">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#075eea] mb-3">Current Position</p>
              <p className="text-xl font-bold">{formatSar(currentValue)}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Gross Profit</span>
                  <span className={`text-xs font-bold ${gpTextColor(currentGp)}`}>{currentGp.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-[#075eea]/15 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${gpBarColor(currentGp)} transition-all`} style={{ width: `${Math.min(currentGp, 100)}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* GP Threshold Warning */}
          {currentGp < 22 && currentGp > 0 && (
            <div className={`mt-4 flex items-center gap-2 text-[10px] px-3 py-2 rounded-md border ${currentGp < 15 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <TrendingDown className="w-3 h-3 shrink-0" />
              <span>{currentGp < 15 ? "GP is below minimum threshold (15%). Requires executive approval." : "GP is below target (22%). Review margin protection."}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Current Position */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Update Current Position</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Current Quoted Value (SAR)</label>
              <Input type="number" min={0} className="h-8 text-xs mt-1" value={currentValue} onChange={e => { setCurrentValue(parseFloat(e.target.value) || 0); mark(); }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Current GP%</label>
              <Input type="number" min={0} max={100} step={0.1} className="h-8 text-xs mt-1" value={currentGp} onChange={e => { setCurrentGp(parseFloat(e.target.value) || 0); mark(); }} />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-[10px] font-semibold text-muted-foreground">Impact Notes</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={impactNotes} onChange={e => { setImpactNotes(e.target.value); mark(); }} placeholder="Why did pricing change? What drove the margin shift?" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
