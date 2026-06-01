/**
 * PnLCalculatorCore — Shared P&L Calculator Engine
 *
 * Extracted from the standalone PnLCalculator page.
 * Contains: Revenue model, role-gated cost model, GP calculation,
 * approval chain derivation, revenue breakdown, P&L summary.
 *
 * Used by:
 *   - Standalone /pnl page (PnLCalculatorPageShell)
 *   - Tender P&L Calculator tab (TenderPnLCalculatorPanel)
 *
 * No Supabase writes. No AI. No PDF Studio. No fake data.
 */
import { useState, useEffect, useCallback } from "react";
import { Calculator, Lock, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatSAR, formatPercent } from "@/lib/store";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth-state";
import { canEditCosts } from "@/lib/sla-integrity";
import type { UserRole } from "@/lib/store";

// ═══════════════════════════════════════════════════════════
// TYPES — Calculator State
// ═══════════════════════════════════════════════════════════

export interface PnLCalculatorState {
  storageRate: number;
  pallets: number;
  inboundRate: number;
  inboundVol: number;
  outboundRate: number;
  outboundVol: number;
  vasRevenue: number;
  facilityCost: number;
  staffCost: number;
  mheCost: number;
  insuranceCost: number;
  otherCost: number;
}

export interface PnLCalculatorSummary {
  storageRev: number;
  inboundRev: number;
  outboundRev: number;
  monthlyRev: number;
  annualRev: number;
  monthlyOpex: number;
  gaCost: number;
  totalMonthlyOpex: number;
  annualOpex: number;
  grossProfit: number;
  gpPercent: number;
  approvalChain: string;
}

export function emptyCalculatorState(): PnLCalculatorState {
  return {
    storageRate: 0, pallets: 0,
    inboundRate: 0, inboundVol: 0,
    outboundRate: 0, outboundVol: 0,
    vasRevenue: 0,
    facilityCost: 0, staffCost: 0, mheCost: 0, insuranceCost: 0, otherCost: 0,
  };
}

export function calculateSummary(s: PnLCalculatorState): PnLCalculatorSummary {
  const storageRev = s.storageRate * s.pallets * 30;
  const inboundRev = s.inboundRate * s.inboundVol;
  const outboundRev = s.outboundRate * s.outboundVol;
  const monthlyRev = storageRev + inboundRev + outboundRev + s.vasRevenue;
  const annualRev = monthlyRev * 12;
  const monthlyOpex = s.facilityCost + s.staffCost + s.mheCost + s.insuranceCost + s.otherCost;
  const gaCost = monthlyOpex * 0.10;
  const totalMonthlyOpex = monthlyOpex + gaCost;
  const annualOpex = totalMonthlyOpex * 12;
  const grossProfit = annualRev - annualOpex;
  const gpPercent = annualRev > 0 ? (grossProfit / annualRev) * 100 : 0;
  const approvalChain =
    gpPercent >= 30 ? "Regional Sales Head + Ops Feasibility" :
    gpPercent >= 22 ? "Regional Sales Head + Ops Head" :
    gpPercent >= 10 ? "All above + Directors" :
    "All above + CEO/CFO";
  return { storageRev, inboundRev, outboundRev, monthlyRev, annualRev, monthlyOpex, gaCost, totalMonthlyOpex, annualOpex, grossProfit, gpPercent, approvalChain };
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface PnLCalculatorCoreProps {
  initialState?: PnLCalculatorState;
  onStateChange?: (state: PnLCalculatorState, summary: PnLCalculatorSummary) => void;
  compact?: boolean;
}

export default function PnLCalculatorCore({ initialState, onStateChange, compact }: PnLCalculatorCoreProps) {
  const [state, setState] = useState<PnLCalculatorState>(() => initialState ?? emptyCalculatorState());

  // Sync if initialState changes (e.g. reload from draft)
  useEffect(() => {
    if (initialState) setState(initialState);
  }, [initialState]);

  const summary = calculateSummary(state);

  const user = getCurrentUser();
  const userRole = user.role as UserRole;
  const costEditable = canEditCosts(userRole);

  const update = useCallback((key: keyof PnLCalculatorState, val: number) => {
    setState(prev => {
      const next = { ...prev, [key]: val };
      return next;
    });
  }, []);

  // Lift state + summary up
  useEffect(() => {
    onStateChange?.(state, summary);
  }, [state, summary, onStateChange]);

  const handleCostChange = (key: keyof PnLCalculatorState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!costEditable) {
      toast.error("Cost editing restricted", { description: "Sales roles cannot modify cost fields. Contact Ops, Finance, or Admin." });
      return;
    }
    update(key, Number(e.target.value));
  };

  const revFields: { l: string; k: keyof PnLCalculatorState }[] = [
    { l: "Storage Rate (SAR/plt/day)", k: "storageRate" },
    { l: "Pallet Volume", k: "pallets" },
    { l: "Inbound Rate (SAR/plt)", k: "inboundRate" },
    { l: "Inbound Volume/mo", k: "inboundVol" },
    { l: "Outbound Rate (SAR/plt)", k: "outboundRate" },
    { l: "Outbound Volume/mo", k: "outboundVol" },
    { l: "VAS Revenue/mo", k: "vasRevenue" },
  ];

  const costFields: { l: string; k: keyof PnLCalculatorState }[] = [
    { l: "Facility Cost/mo", k: "facilityCost" },
    { l: "Staff Cost/mo", k: "staffCost" },
    { l: "MHE Cost/mo", k: "mheCost" },
    { l: "Insurance/mo", k: "insuranceCost" },
    { l: "Other Operational/mo", k: "otherCost" },
  ];

  const revBreakdown = [
    { l: "Storage", v: summary.storageRev, pct: summary.monthlyRev > 0 ? (summary.storageRev / summary.monthlyRev) * 100 : 0 },
    { l: "Inbound", v: summary.inboundRev, pct: summary.monthlyRev > 0 ? (summary.inboundRev / summary.monthlyRev) * 100 : 0 },
    { l: "Outbound", v: summary.outboundRev, pct: summary.monthlyRev > 0 ? (summary.outboundRev / summary.monthlyRev) * 100 : 0 },
    { l: "VAS", v: state.vasRevenue, pct: summary.monthlyRev > 0 ? (state.vasRevenue / summary.monthlyRev) * 100 : 0 },
  ];

  return (
    <div className={`grid ${compact ? "grid-cols-1 xl:grid-cols-3" : "grid-cols-1 lg:grid-cols-3"} gap-4`}>
      <div className={`${compact ? "xl:col-span-2" : "lg:col-span-2"} space-y-4`}>
        {/* Revenue Model */}
        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Revenue Model</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className={`grid ${compact ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-3`}>
              {revFields.map(f => (
                <div key={f.k}>
                  <Label className="text-[10px]">{f.l}</Label>
                  <Input type="number" value={state[f.k]} onChange={e => update(f.k, Number(e.target.value))} className="mt-1 h-8 text-xs" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost Model — role-gated */}
        <Card className={`border shadow-none ${!costEditable ? "border-amber-300 bg-amber-50/20" : "border-border"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Cost Model
                {!costEditable && (
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50 ml-1">
                    <Lock className="w-3 h-3 mr-1" />READ-ONLY
                  </Badge>
                )}
              </CardTitle>
            </div>
            {!costEditable && (
              <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Cost fields are restricted for Sales roles. Contact Ops, Finance, or Admin to modify.
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`grid ${compact ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"} gap-3`}>
              {costFields.map(f => (
                <div key={f.k}>
                  <Label className="text-[10px]">{f.l}</Label>
                  <Input
                    type="number"
                    value={state[f.k]}
                    onChange={handleCostChange(f.k)}
                    readOnly={!costEditable}
                    tabIndex={!costEditable ? -1 : undefined}
                    className={`mt-1 h-8 text-xs ${!costEditable ? "opacity-60 cursor-not-allowed bg-muted/50" : ""}`}
                  />
                </div>
              ))}
              <div>
                <Label className="text-[10px]">G&A (10% of OPEX)</Label>
                <div className="mt-1 h-8 flex items-center text-xs text-muted-foreground">{formatSAR(summary.gaCost)}/mo</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right column: Summary + Breakdown */}
      <div className="space-y-4">
        <Card className="border border-border shadow-none bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4" />P&L Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[
              { l: "Monthly Revenue", v: formatSAR(summary.monthlyRev) },
              { l: "Annual Revenue", v: formatSAR(summary.annualRev) },
              { l: "Monthly OPEX", v: formatSAR(summary.totalMonthlyOpex) },
              { l: "Annual OPEX", v: formatSAR(summary.annualOpex) },
            ].map(r => (
              <div key={r.l} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{r.l}</span>
                <span className="font-medium">{r.v}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-xs font-semibold">Gross Profit</span>
                <span className={`text-base font-bold ${summary.grossProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatSAR(summary.grossProfit)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs font-semibold">GP%</span>
                <span className={`text-xl font-bold ${summary.gpPercent >= 22 ? "text-emerald-700" : summary.gpPercent >= 10 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(summary.gpPercent)}</span>
              </div>
            </div>
            <div className="mt-3 p-2 rounded border border-border bg-card">
              <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-0.5">Approval Requirement</p>
              <p className="text-xs font-medium">{summary.approvalChain}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Revenue Breakdown</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {revBreakdown.map(r => (
              <div key={r.l}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span>{r.l}</span>
                  <span>{formatSAR(r.v)} ({r.pct.toFixed(1)}%)</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
