import { Link } from "wouter";
import { useState } from "react";
import { Calculator, Download, ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatSAR, formatPercent } from "@/lib/store";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth-state";
import { canEditCosts, COST_BLOCKED_ROLES } from "@/lib/sla-integrity";
import type { UserRole } from "@/lib/store";

export default function PnLCalculator() {
  const [storageRate, setStorageRate] = useState(40);
  const [pallets, setPallets] = useState(2500);
  const [inboundRate, setInboundRate] = useState(7);
  const [inboundVol, setInboundVol] = useState(800);
  const [outboundRate, setOutboundRate] = useState(7);
  const [outboundVol, setOutboundVol] = useState(800);
  const [vasRevenue, setVasRevenue] = useState(5000);
  const [facilityCost, setFacilityCost] = useState(120000);
  const [staffCost, setStaffCost] = useState(85000);
  const [mheCost, setMheCost] = useState(15000);
  const [insuranceCost, setInsuranceCost] = useState(5000);
  const [otherCost, setOtherCost] = useState(8000);

  const user = getCurrentUser();
  const userRole = user.role as UserRole;
  const costEditable = canEditCosts(userRole);

  const storageRev = storageRate * pallets * 30;
  const inboundRev = inboundRate * inboundVol;
  const outboundRev = outboundRate * outboundVol;
  const monthlyRev = storageRev + inboundRev + outboundRev + vasRevenue;
  const annualRev = monthlyRev * 12;
  const monthlyOpex = facilityCost + staffCost + mheCost + insuranceCost + otherCost;
  const gaCost = monthlyOpex * 0.10;
  const totalMonthlyOpex = monthlyOpex + gaCost;
  const annualOpex = totalMonthlyOpex * 12;
  const grossProfit = annualRev - annualOpex;
  const gpPercent = annualRev > 0 ? (grossProfit / annualRev) * 100 : 0;

  const handleCostChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!costEditable) {
      toast.error("Cost editing restricted", {
        description: "Sales roles cannot modify cost fields. Contact Ops, Finance, or Admin.",
      });
      return;
    }
    setter(Number(e.target.value));
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/workspaces">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Workspaces
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold">P&L Calculator</h1><p className="text-sm text-muted-foreground mt-0.5">Deal-level profitability model</p></div>
        <Button variant="outline" onClick={() => toast("PDF export coming soon")}><Download className="w-4 h-4 mr-1.5" />Export P&L</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Revenue Model</CardTitle></CardHeader><CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[{ l: "Storage Rate (SAR/plt/day)", v: storageRate, s: setStorageRate }, { l: "Pallet Volume", v: pallets, s: setPallets }, { l: "Inbound Rate (SAR/plt)", v: inboundRate, s: setInboundRate }, { l: "Inbound Volume/mo", v: inboundVol, s: setInboundVol }, { l: "Outbound Rate (SAR/plt)", v: outboundRate, s: setOutboundRate }, { l: "Outbound Volume/mo", v: outboundVol, s: setOutboundVol }, { l: "VAS Revenue/mo", v: vasRevenue, s: setVasRevenue }].map(f => (
                <div key={f.l}><Label className="text-xs">{f.l}</Label><Input type="number" value={f.v} onChange={e => f.s(Number(e.target.value))} className="mt-1 h-8 text-sm data-value" /></div>
              ))}
            </div>
          </CardContent></Card>

          {/* Cost Model — role-gated */}
          <Card className={`border shadow-none ${!costEditable ? "border-amber-300 bg-amber-50/20" : "border-border"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-serif flex items-center gap-2">
                  Cost Model
                  {!costEditable && (
                    <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50 ml-1">
                      <Lock className="w-3 h-3 mr-1" />READ-ONLY
                    </Badge>
                  )}
                </CardTitle>
              </div>
              {!costEditable && (
                <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Cost fields are restricted for Sales roles. Contact Ops, Finance, or Admin to modify.
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { l: "Facility Cost/mo", v: facilityCost, s: setFacilityCost },
                  { l: "Staff Cost/mo", v: staffCost, s: setStaffCost },
                  { l: "MHE Cost/mo", v: mheCost, s: setMheCost },
                  { l: "Insurance/mo", v: insuranceCost, s: setInsuranceCost },
                  { l: "Other Operational/mo", v: otherCost, s: setOtherCost },
                ].map(f => (
                  <div key={f.l}>
                    <Label className="text-xs">{f.l}</Label>
                    <Input
                      type="number"
                      value={f.v}
                      onChange={handleCostChange(f.s)}
                      readOnly={!costEditable}
                      tabIndex={!costEditable ? -1 : undefined}
                      className={`mt-1 h-8 text-sm data-value ${!costEditable ? "opacity-60 cursor-not-allowed bg-muted/50" : ""}`}
                    />
                  </div>
                ))}
                <div><Label className="text-xs">G&A (10% of OPEX)</Label><div className="mt-1 h-8 flex items-center text-sm data-value text-muted-foreground">{formatSAR(gaCost)}/mo</div></div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="border border-border shadow-none bg-muted/30"><CardHeader className="pb-3"><CardTitle className="text-base font-serif flex items-center gap-2"><Calculator className="w-4 h-4" />P&L Summary</CardTitle></CardHeader><CardContent className="pt-0 space-y-3">
            {[{ l: "Monthly Revenue", v: formatSAR(monthlyRev) }, { l: "Annual Revenue", v: formatSAR(annualRev) }, { l: "Monthly OPEX", v: formatSAR(totalMonthlyOpex) }, { l: "Annual OPEX", v: formatSAR(annualOpex) }].map(r => (
              <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="data-value font-medium">{r.v}</span></div>
            ))}
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex justify-between"><span className="text-sm font-semibold">Gross Profit</span><span className={`data-value text-lg font-bold ${grossProfit >= 0 ? "rag-green" : "rag-red"}`}>{formatSAR(grossProfit)}</span></div>
              <div className="flex justify-between mt-1"><span className="text-sm font-semibold">GP%</span><span className={`data-value text-2xl font-bold ${gpPercent >= 22 ? "rag-green" : gpPercent >= 10 ? "rag-amber" : "rag-red"}`}>{formatPercent(gpPercent)}</span></div>
            </div>
            <div className="mt-4 p-3 rounded border border-border bg-card">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Approval Requirement</p>
              <p className="text-sm font-medium">{gpPercent >= 30 ? "Regional Sales Head + Ops Feasibility" : gpPercent >= 22 ? "Regional Sales Head + Ops Head" : gpPercent >= 10 ? "All above + Directors" : "All above + CEO/CFO"}</p>
            </div>
          </CardContent></Card>
          <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Revenue Breakdown</CardTitle></CardHeader><CardContent className="pt-0 space-y-2">
            {[{ l: "Storage", v: storageRev, pct: monthlyRev > 0 ? (storageRev/monthlyRev)*100 : 0 }, { l: "Inbound", v: inboundRev, pct: monthlyRev > 0 ? (inboundRev/monthlyRev)*100 : 0 }, { l: "Outbound", v: outboundRev, pct: monthlyRev > 0 ? (outboundRev/monthlyRev)*100 : 0 }, { l: "VAS", v: vasRevenue, pct: monthlyRev > 0 ? (vasRevenue/monthlyRev)*100 : 0 }].map(r => (
              <div key={r.l}>
                <div className="flex justify-between text-xs mb-0.5"><span>{r.l}</span><span className="data-value">{formatSAR(r.v)} ({r.pct.toFixed(1)}%)</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${r.pct}%` }} /></div>
              </div>
            ))}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
