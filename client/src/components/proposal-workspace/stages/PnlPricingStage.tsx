/**
 * Stage 4 — P&L / PRICING
 * The commercial truth engine. Value is created or destroyed here.
 */
import { useState } from "react";
import { Calculator, DollarSign, BarChart3, Scale, Zap, Plus, Trash2, CheckCircle2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, FieldRow, FieldInput, FieldTextarea, SignalCard, formatSAR } from "../ui-primitives";
import type { PnlVersion, PnlLine, CostInput, PricingLine, MarginScenario, ApprovalSignal } from "../proposal-workspace-state";

// ═══════════════════════════════════════════
// TAB: P&L Calculator
// ═══════════════════════════════════════════

export function PnlCalculatorTab({
  versions, activeId, onVersionsChange, onActiveChange, onSave,
}: {
  versions: PnlVersion[];
  activeId: string;
  onVersionsChange: (v: PnlVersion[]) => void;
  onActiveChange: (id: string) => void;
  onSave?: (v: PnlVersion) => void;
}) {
  const active = versions.find(v => v.id === activeId);

  const createVersion = () => {
    const v: PnlVersion = {
      id: `pnl-${Date.now()}`, name: `Version ${versions.length + 1}`,
      createdAt: new Date().toISOString().slice(0, 10),
      revenue: [
        { label: "Storage Revenue", amount: 0 }, { label: "Handling Revenue", amount: 0 },
        { label: "Transport Revenue", amount: 0 }, { label: "VAS Revenue", amount: 0 },
      ],
      costs: [
        { label: "Warehouse Cost", amount: 0 }, { label: "Transport Cost", amount: 0 },
        { label: "Labor Cost", amount: 0 }, { label: "Equipment Cost", amount: 0 },
        { label: "VAS Cost", amount: 0 },
      ],
      overheadPercent: 5, notes: "", isApproved: false,
    };
    onVersionsChange([...versions, v]);
    onActiveChange(v.id);
  };

  const duplicateVersion = () => {
    if (!active) return;
    const v: PnlVersion = {
      ...JSON.parse(JSON.stringify(active)),
      id: `pnl-${Date.now()}`, name: `${active.name} (copy)`,
      createdAt: new Date().toISOString().slice(0, 10), isApproved: false,
    };
    onVersionsChange([...versions, v]);
    onActiveChange(v.id);
  };

  const updateLine = (type: "revenue" | "costs", idx: number, amount: number) => {
    if (!active) return;
    const lines = [...active[type]];
    lines[idx] = { ...lines[idx], amount };
    onVersionsChange(versions.map(v => v.id === active.id ? { ...v, [type]: lines } : v));
  };

  const addLine = (type: "revenue" | "costs") => {
    if (!active) return;
    const lines = [...active[type], { label: "New Line", amount: 0 }];
    onVersionsChange(versions.map(v => v.id === active.id ? { ...v, [type]: lines } : v));
  };

  const updateField = (field: string, val: any) => {
    if (!active) return;
    onVersionsChange(versions.map(v => v.id === active.id ? { ...v, [field]: val } : v));
  };

  const toggleApproved = () => {
    if (!active) return;
    const next = versions.map(v => v.id === active.id ? { ...v, isApproved: !v.isApproved } : v);
    onVersionsChange(next);
    const updated = next.find(v => v.id === active.id);
    if (updated?.isApproved) onSave?.(updated);
  };

  const totalRev = active?.revenue.reduce((s, l) => s + l.amount, 0) ?? 0;
  const totalCost = active?.costs.reduce((s, l) => s + l.amount, 0) ?? 0;
  const overhead = active ? totalCost * (active.overheadPercent / 100) : 0;
  const totalCostWithOH = totalCost + overhead;
  const gp = totalRev - totalCostWithOH;
  const gpPct = totalRev > 0 ? (gp / totalRev) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Version selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calculator className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-semibold">P&L Calculator</span>
        <div className="flex gap-1 ml-2 flex-wrap">
          {versions.map(v => (
            <button key={v.id} onClick={() => onActiveChange(v.id)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                v.id === activeId ? "bg-violet-100 border-violet-300 text-violet-700" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
              }`}>
              {v.name} {v.isApproved && "✓"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={createVersion}><Plus className="w-3 h-3" />New</Button>
          {active && <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={duplicateVersion}><Copy className="w-3 h-3" />Duplicate</Button>}
        </div>
      </div>

      {!active ? (
        <SignalCard type="info" message="No P&L version created" recommendation="Create a P&L version to establish commercial baseline" />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Revenue", value: formatSAR(totalRev), color: "" },
              { label: "Total Cost", value: formatSAR(totalCostWithOH), color: "" },
              { label: "Gross Profit", value: formatSAR(gp), color: gp >= 0 ? "text-emerald-700" : "text-red-700" },
              { label: "GP%", value: `${gpPct.toFixed(1)}%`, color: gpPct >= 22 ? "text-emerald-700" : gpPct >= 10 ? "text-amber-700" : "text-red-700" },
            ].map(k => (
              <div key={k.label} className="rounded-lg border border-border p-3 bg-muted/10">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-bold mt-0.5 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Revenue lines */}
          <Section title="Revenue Lines" defaultOpen icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
            badge={<Badge variant="outline" className="text-[9px] text-emerald-600">{formatSAR(totalRev)}</Badge>}>
            <div className="space-y-1.5">
              {active.revenue.map((l, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input value={l.label} onChange={e => { const lines = [...active.revenue]; lines[i] = { ...l, label: e.target.value }; updateField("revenue", lines); }}
                    className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-background" />
                  <input type="number" value={l.amount || ""} onChange={e => updateLine("revenue", i, Number(e.target.value))}
                    className="w-32 px-2 py-1.5 text-sm rounded border border-border bg-background text-right" placeholder="SAR" />
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-muted-foreground" onClick={() => addLine("revenue")}><Plus className="w-3 h-3" />Add line</Button>
            </div>
          </Section>

          {/* Cost lines */}
          <Section title="Cost Lines" defaultOpen icon={<BarChart3 className="w-4 h-4 text-red-400" />}
            badge={<Badge variant="outline" className="text-[9px] text-red-600">{formatSAR(totalCostWithOH)}</Badge>}>
            <div className="space-y-1.5">
              {active.costs.map((l, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input value={l.label} onChange={e => { const lines = [...active.costs]; lines[i] = { ...l, label: e.target.value }; updateField("costs", lines); }}
                    className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-background" />
                  <input type="number" value={l.amount || ""} onChange={e => updateLine("costs", i, Number(e.target.value))}
                    className="w-32 px-2 py-1.5 text-sm rounded border border-border bg-background text-right" placeholder="SAR" />
                </div>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-6 gap-1 text-muted-foreground" onClick={() => addLine("costs")}><Plus className="w-3 h-3" />Add line</Button>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <FieldRow label="Overhead %">
                <div className="flex items-center gap-2">
                  <input type="number" value={active.overheadPercent} onChange={e => updateField("overheadPercent", Number(e.target.value))}
                    className="w-20 px-2 py-1.5 text-sm rounded border border-border bg-background text-right" />
                  <span className="text-xs text-muted-foreground">= {formatSAR(overhead)}</span>
                </div>
              </FieldRow>
            </div>
          </Section>

          {/* Version controls */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant={active.isApproved ? "default" : "outline"} className="text-xs h-7 gap-1" onClick={toggleApproved}>
              <CheckCircle2 className="w-3 h-3" /> {active.isApproved ? "Approved Working Scenario ✓" : "Mark as Approved Scenario"}
            </Button>
            <FieldRow label="Notes"><FieldTextarea value={active.notes} onChange={v => updateField("notes", v)} placeholder="Version notes..." rows={2} /></FieldRow>
          </div>

          {gpPct < 10 && gpPct > 0 && <SignalCard type="critical" message={`GP% at ${gpPct.toFixed(1)}% — critically low`} recommendation="Review pricing or escalate for director/CEO approval" />}
          {gpPct >= 10 && gpPct < 22 && <SignalCard type="warning" message={`GP% at ${gpPct.toFixed(1)}% — below 22% target`} recommendation="Consider margin improvement opportunities" />}

          {/* Version Comparison */}
          {versions.length >= 2 && (
            <Section title="Version Comparison" icon={<Scale className="w-4 h-4 text-indigo-500" />}
              badge={<Badge variant="outline" className="text-[9px]">{versions.length} versions</Badge>}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Metric</th>
                      {versions.map(v => (
                        <th key={v.id} className={`text-right py-2 px-2 font-semibold ${v.id === activeId ? "text-violet-700" : "text-muted-foreground"}`}>
                          {v.name} {v.isApproved && "✓"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["Revenue", "Cost", "GP", "GP%"] as const).map(metric => {
                      const vals = versions.map(v => {
                        const r = v.revenue.reduce((s, l) => s + l.amount, 0);
                        const c = v.costs.reduce((s, l) => s + l.amount, 0);
                        const oh = c * (v.overheadPercent / 100);
                        const tc = c + oh;
                        switch (metric) {
                          case "Revenue": return r;
                          case "Cost": return tc;
                          case "GP": return r - tc;
                          case "GP%": return r > 0 ? ((r - tc) / r) * 100 : 0;
                        }
                      });
                      const best = metric === "Cost" ? Math.min(...vals.filter(v => v > 0)) : Math.max(...vals);
                      return (
                        <tr key={metric} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 font-medium">{metric}</td>
                          {vals.map((val, i) => (
                            <td key={i} className={`text-right py-2 px-2 font-mono ${
                              val === best && val !== 0 ? "font-bold text-emerald-700" : ""
                            } ${metric === "GP%" && val < 10 && val > 0 ? "text-red-600" : ""}`}>
                              {metric === "GP%" ? `${val.toFixed(1)}%` : formatSAR(val)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB: Cost Inputs
// ═══════════════════════════════════════════

export function CostInputsTab({
  data, onChange,
}: {
  data: CostInput[];
  onChange: (d: CostInput[]) => void;
}) {
  const add = () => onChange([...data, { category: "", description: "", amount: 0, source: "", verified: false }]);
  const remove = (i: number) => onChange(data.filter((_, j) => j !== i));
  const update = (i: number, field: string, val: any) => onChange(data.map((c, j) => j === i ? { ...c, [field]: val } : c));
  const unverified = data.filter(c => !c.verified).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold">Cost Inputs</span>
          <Badge variant="outline" className="text-[9px]">{data.length} inputs</Badge>
          {unverified > 0 && <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-600">{unverified} unverified</Badge>}
        </div>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={add}><Plus className="w-3 h-3" />Add Input</Button>
      </div>

      {data.length === 0 ? (
        <SignalCard type="info" message="No cost inputs captured" recommendation="Add external quotes, vendor rates, and finance assumptions" />
      ) : (
        <div className="space-y-2">
          {data.map((c, i) => (
            <div key={i} className={`p-3 rounded-lg border ${c.verified ? "border-emerald-200 bg-emerald-50/20" : "border-border"}`}>
              <div className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 items-center">
                <input value={c.category} onChange={e => update(i, "category", e.target.value)} placeholder="Category" className="px-2 py-1.5 text-sm rounded border border-border bg-background" />
                <input value={c.description} onChange={e => update(i, "description", e.target.value)} placeholder="Description" className="px-2 py-1.5 text-sm rounded border border-border bg-background" />
                <input type="number" value={c.amount || ""} onChange={e => update(i, "amount", Number(e.target.value))} placeholder="SAR" className="px-2 py-1.5 text-sm rounded border border-border bg-background text-right" />
                <div className="flex items-center gap-1">
                  <button onClick={() => update(i, "verified", !c.verified)} className={`px-2 py-1 rounded text-[9px] font-medium border ${c.verified ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "bg-muted/30 border-border text-muted-foreground"}`}>
                    {c.verified ? "✓ Verified" : "Unverified"}
                  </button>
                  <button onClick={() => remove(i)} className="text-muted-foreground/40 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <input value={c.source} onChange={e => update(i, "source", e.target.value)} placeholder="Source: e.g. vendor quote, finance team..." className="w-full mt-1.5 px-2 py-1 text-xs rounded border border-border bg-background" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB: Pricing Lines
// ═══════════════════════════════════════════

export function PricingLinesTab({
  data, onChange,
}: {
  data: PricingLine[];
  onChange: (d: PricingLine[]) => void;
}) {
  const add = () => onChange([...data, { service: "", unit: "", rate: 0, quantity: 0, frequency: "", total: 0 }]);
  const remove = (i: number) => onChange(data.filter((_, j) => j !== i));
  const update = (i: number, field: string, val: any) => {
    const line = { ...data[i], [field]: val };
    if (field === "rate" || field === "quantity") line.total = line.rate * line.quantity;
    onChange(data.map((l, j) => j === i ? line : l));
  };
  const totalPricing = data.reduce((s, l) => s + l.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold">Pricing Lines</span>
          <Badge variant="outline" className="text-[9px]">{formatSAR(totalPricing)} total</Badge>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={add}><Plus className="w-3 h-3" />Add Line</Button>
      </div>

      {data.length === 0 ? (
        <SignalCard type="info" message="No pricing lines defined" recommendation="Define storage, handling, transport, and VAS pricing" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] text-muted-foreground uppercase border-b">
              <th className="text-left py-2 font-medium">Service</th><th className="text-left py-2 font-medium">Unit</th>
              <th className="text-right py-2 font-medium">Rate</th><th className="text-right py-2 font-medium">Qty</th>
              <th className="text-left py-2 font-medium">Freq</th><th className="text-right py-2 font-medium">Total</th><th className="w-8"></th>
            </tr></thead>
            <tbody>
              {data.map((l, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5"><input value={l.service} onChange={e => update(i, "service", e.target.value)} placeholder="Service" className="w-full px-1 py-1 text-xs rounded border border-border bg-background" /></td>
                  <td className="py-1.5"><input value={l.unit} onChange={e => update(i, "unit", e.target.value)} placeholder="Unit" className="w-20 px-1 py-1 text-xs rounded border border-border bg-background" /></td>
                  <td className="py-1.5"><input type="number" value={l.rate || ""} onChange={e => update(i, "rate", Number(e.target.value))} className="w-20 px-1 py-1 text-xs rounded border border-border bg-background text-right" /></td>
                  <td className="py-1.5"><input type="number" value={l.quantity || ""} onChange={e => update(i, "quantity", Number(e.target.value))} className="w-16 px-1 py-1 text-xs rounded border border-border bg-background text-right" /></td>
                  <td className="py-1.5"><input value={l.frequency} onChange={e => update(i, "frequency", e.target.value)} placeholder="Monthly" className="w-20 px-1 py-1 text-xs rounded border border-border bg-background" /></td>
                  <td className="py-1.5 text-right text-xs font-medium">{formatSAR(l.total)}</td>
                  <td className="py-1.5"><button onClick={() => remove(i)} className="text-muted-foreground/30 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB: Margin Scenarios
// ═══════════════════════════════════════════

export function MarginScenariosTab({
  data, onChange,
}: {
  data: MarginScenario[];
  onChange: (d: MarginScenario[]) => void;
}) {
  const update = (i: number, field: string, val: any) => {
    const s = { ...data[i], [field]: val };
    if (field === "revenue" || field === "cost") { s.gp = s.revenue - s.cost; s.gpPercent = s.revenue > 0 ? (s.gp / s.revenue) * 100 : 0; }
    onChange(data.map((sc, j) => j === i ? s : sc));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Scale className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold">Margin Scenarios</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {data.map((s, i) => (
          <div key={i} className="p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{s.name}</span>
              <Badge variant="outline" className={`text-[9px] ${s.gpPercent >= 22 ? "text-emerald-600 border-emerald-200" : s.gpPercent >= 10 ? "text-amber-600 border-amber-200" : s.gpPercent > 0 ? "text-red-600 border-red-200" : ""}`}>
                GP: {s.gpPercent.toFixed(1)}%
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Revenue</label>
                <input type="number" value={s.revenue || ""} onChange={e => update(i, "revenue", Number(e.target.value))} className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background text-right" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Cost</label>
                <input type="number" value={s.cost || ""} onChange={e => update(i, "cost", Number(e.target.value))} className="w-full px-2 py-1.5 text-sm rounded border border-border bg-background text-right" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">GP</label>
                <div className={`px-2 py-1.5 text-sm rounded border border-border bg-muted/20 text-right font-medium ${s.gp >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatSAR(s.gp)}</div>
              </div>
            </div>
            <input value={s.notes} onChange={e => update(i, "notes", e.target.value)} placeholder="Scenario notes..." className="w-full mt-2 px-2 py-1 text-xs rounded border border-border bg-background" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// TAB: Approval Signals
// ═══════════════════════════════════════════

export function ApprovalSignalsTab({
  versions, costInputs,
}: {
  versions: PnlVersion[];
  costInputs: CostInput[];
}) {
  const signals: ApprovalSignal[] = [];
  const approved = versions.find(v => v.isApproved);
  if (!approved && versions.length > 0) signals.push({ type: "warning", message: "No approved working scenario selected", recommendation: "Mark a P&L version as the approved working scenario" });
  if (approved) {
    const rev = approved.revenue.reduce((s, l) => s + l.amount, 0);
    const cost = approved.costs.reduce((s, l) => s + l.amount, 0);
    const gpPct = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
    if (gpPct < 10) signals.push({ type: "critical", message: `GP at ${gpPct.toFixed(1)}% — critically low margin`, recommendation: "Requires CEO/CFO approval or re-pricing before quote" });
    else if (gpPct < 22) signals.push({ type: "warning", message: `GP at ${gpPct.toFixed(1)}% — below 22% target`, recommendation: "Director approval recommended" });
  }
  if (costInputs.length === 0) signals.push({ type: "warning", message: "No cost inputs documented", recommendation: "Add external quotes and cost support documents" });
  const unverified = costInputs.filter(c => !c.verified).length;
  if (unverified > 0) signals.push({ type: "warning", message: `${unverified} unverified cost input(s)`, recommendation: "Verify cost sources before generating quote" });
  if (versions.length === 0) signals.push({ type: "info", message: "No P&L version created yet", recommendation: "Create initial P&L to generate approval signals" });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold">Approval Signals</span>
        <Badge variant="outline" className="text-[9px]">{signals.length} signals</Badge>
        <span className="text-[10px] text-muted-foreground/60 ml-2 italic">Advisory only — does not block progress</span>
      </div>
      {signals.length === 0 ? (
        <div className="py-6 text-center rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30">
          <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-400 mb-1.5" />
          <p className="text-xs text-emerald-600 font-medium">All clear — no approval signals</p>
        </div>
      ) : (
        <div className="space-y-2">{signals.map((s, i) => <SignalCard key={i} type={s.type} message={s.message} recommendation={s.recommendation} />)}</div>
      )}
    </div>
  );
}
