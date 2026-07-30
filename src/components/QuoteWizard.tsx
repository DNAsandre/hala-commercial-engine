/**
 * QuoteWizard — 6-step guided quote creation
 * Sprint 3: Service Scope → Volume → Pricing → Margin → Assumptions → Review
 * RAG indicators are advisory only — no blocking.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Save, Send, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

// ── Constants ────────────────────────────────────────────
const GP_GREEN = 25, GP_AMBER = 15;

const SERVICE_TYPES = [
  { value: "warehousing", label: "Warehousing" },
  { value: "transport", label: "Transport" },
  { value: "vas", label: "Value Added Services (VAS)" },
  { value: "multi_service", label: "Multi-Service" },
];

const VOLUME_UNITS: Record<string, { value: string; label: string }[]> = {
  warehousing: [{ value: "pallets", label: "Pallets" }, { value: "sqm", label: "Sq Metres" }],
  transport: [{ value: "trips", label: "Trips/Month" }, { value: "tonnes", label: "Tonnes" }],
  vas: [{ value: "units", label: "Units" }, { value: "orders", label: "Orders" }],
  multi_service: [{ value: "pallets", label: "Pallets" }, { value: "trips", label: "Trips" }],
};

const VALIDITY_OPTIONS = [15, 30, 45, 60, 90];
const STEPS = ["Service Scope", "Volume", "Pricing", "Margin Preview", "Assumptions", "Review & Save"];

function getRAG(gp: number): "green" | "amber" | "red" {
  if (gp >= GP_GREEN) return "green";
  if (gp >= GP_AMBER) return "amber";
  return "red";
}

const ragColors = { green: "bg-emerald-100 text-emerald-800 border-emerald-300", amber: "bg-amber-100 text-amber-800 border-amber-300", red: "bg-red-100 text-red-800 border-red-300" };
const ragDot = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };

// ── Types ────────────────────────────────────────────────
interface QuoteFormData {
  service_type: string;
  volume_unit: string;
  pallet_volume: number;
  monthly_volume: number;
  storage_rate: number;
  inbound_rate: number;
  outbound_rate: number;
  estimated_cost: number;
  discount_percent: number;
  validity_days: number;
  assumptions: string;
  exclusions: string;
  notes: string;
  currency: string;
}

interface Props {
  workspaceId: string;
  customerId?: string;
  customerName?: string;
  existingQuote?: any;
  onSaved: (quote: any) => void;
  onCancel: () => void;
}

export default function QuoteWizard({ workspaceId, customerId, customerName, existingQuote, onSaved, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const isEdit = !!existingQuote;

  const [form, setForm] = useState<QuoteFormData>(() => ({
    service_type: existingQuote?.service_type || "warehousing",
    volume_unit: existingQuote?.volume_unit || "pallets",
    pallet_volume: existingQuote?.pallet_volume || 0,
    monthly_volume: existingQuote?.monthly_volume || 0,
    storage_rate: existingQuote?.storage_rate || 0,
    inbound_rate: existingQuote?.inbound_rate || 0,
    outbound_rate: existingQuote?.outbound_rate || 0,
    estimated_cost: existingQuote?.estimated_cost || existingQuote?.total_cost || 0,
    discount_percent: existingQuote?.discount_percent || 0,
    validity_days: existingQuote?.validity_days || 30,
    assumptions: existingQuote?.assumptions || "",
    exclusions: existingQuote?.exclusions || "",
    notes: existingQuote?.notes || "",
    currency: existingQuote?.currency || "SAR",
  }));

  const set = (key: keyof QuoteFormData, val: any) => setForm(f => ({ ...f, [key]: val }));
  const setNum = (key: keyof QuoteFormData, raw: string) => set(key, parseFloat(raw) || 0);

  // ── Margin calculations ────────────────────────────────
  const calc = useMemo(() => {
    const monthlyRev = (form.storage_rate * form.pallet_volume) + (form.inbound_rate * form.monthly_volume) + (form.outbound_rate * form.monthly_volume);
    const discounted = monthlyRev * (1 - form.discount_percent / 100);
    const annual = discounted * 12;
    const gpAmt = annual - form.estimated_cost;
    const gpPct = annual > 0 ? (gpAmt / annual) * 100 : 0;
    return {
      monthlyRevenue: Math.round(discounted),
      annualRevenue: Math.round(annual),
      gpAmount: Math.round(gpAmt),
      gpPercent: Math.round(gpPct * 10) / 10,
      rag: getRAG(gpPct),
      valid: annual > 0,
    };
  }, [form]);

  // ── Save / Submit ──────────────────────────────────────
  const handleSave = async (andSubmit = false) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        monthly_revenue: calc.monthlyRevenue,
        annual_revenue: calc.annualRevenue,
        gp_amount: calc.gpAmount,
        gp_percent: calc.gpPercent,
        customer_id: customerId,
      };

      let quote: any;
      if (isEdit) {
        const res = await api.quotes.update(existingQuote.id, payload);
        quote = res.data;
      } else {
        const res = await api.quotes.create(workspaceId, payload);
        quote = res.data;
      }

      if (andSubmit && quote) {
        const res = await api.quotes.submit(quote.id);
        quote = res.data;
        toast.success("Quote submitted for approval");
      } else {
        toast.success(isEdit ? "Quote updated" : "Quote saved as draft");
      }

      onSaved(quote);
    } catch (err: any) {
      toast.error(err.message || "Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  // ── Step rendering ─────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Service Type</h3>
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_TYPES.map(st => (
              <button key={st.value} onClick={() => { set("service_type", st.value); set("volume_unit", VOLUME_UNITS[st.value]?.[0]?.value || "pallets"); }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${form.service_type === st.value ? "border-[var(--color-hala-navy)] bg-[var(--color-hala-navy)]/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}>
                <span className="text-sm font-medium">{st.label}</span>
              </button>
            ))}
          </div>
          {customerName && <p className="text-xs text-muted-foreground mt-2">Customer: <span className="font-medium text-foreground">{customerName}</span></p>}
        </div>
      );

      case 1: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Volume Assumptions</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Volume Unit</label>
              <Select value={form.volume_unit} onValueChange={v => set("volume_unit", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(VOLUME_UNITS[form.service_type] || VOLUME_UNITS.warehousing).map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Storage Volume ({form.volume_unit})</label>
              <Input type="number" min={0} value={form.pallet_volume || ""} onChange={e => setNum("pallet_volume", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Monthly Handling Volume</label>
              <Input type="number" min={0} value={form.monthly_volume || ""} onChange={e => setNum("monthly_volume", e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Pricing Input</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Storage Rate ({form.currency}/{form.volume_unit}/mo)</label>
              <Input type="number" min={0} step={0.01} value={form.storage_rate || ""} onChange={e => setNum("storage_rate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Inbound Rate ({form.currency}/unit)</label>
              <Input type="number" min={0} step={0.01} value={form.inbound_rate || ""} onChange={e => setNum("inbound_rate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Outbound Rate ({form.currency}/unit)</label>
              <Input type="number" min={0} step={0.01} value={form.outbound_rate || ""} onChange={e => setNum("outbound_rate", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estimated Annual Cost ({form.currency})</label>
              <Input type="number" min={0} value={form.estimated_cost || ""} onChange={e => setNum("estimated_cost", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Discount (%)</label>
              <Input type="number" min={0} max={100} step={0.5} value={form.discount_percent || ""} onChange={e => setNum("discount_percent", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional pricing notes" className="h-9 text-sm" />
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Margin Preview</h3>
          {!calc.valid ? (
            <div className="flex items-center gap-2 p-4 rounded-lg border border-muted bg-muted/30">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Insufficient pricing data — enter rates and volume first.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Monthly Revenue" value={`${form.currency} ${calc.monthlyRevenue.toLocaleString()}`} />
                <Stat label="Annual Revenue" value={`${form.currency} ${calc.annualRevenue.toLocaleString()}`} />
                <Stat label="Estimated Cost" value={`${form.currency} ${form.estimated_cost.toLocaleString()}`} />
                <Stat label="Gross Profit" value={`${form.currency} ${calc.gpAmount.toLocaleString()}`} />
              </div>
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${ragColors[calc.rag]}`}>
                <div className={`w-4 h-4 rounded-full ${ragDot[calc.rag]} shrink-0`} />
                <div>
                  <span className="text-lg font-bold">{calc.gpPercent}%</span>
                  <span className="text-sm ml-2">Gross Profit</span>
                </div>
                <Badge variant="outline" className="ml-auto text-xs">{calc.rag === "green" ? "Healthy" : calc.rag === "amber" ? "Tight" : "Critical"}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Advisory only — does not block saving or submission.
              </p>
            </>
          )}
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Assumptions & Exclusions</h3>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Assumptions</label>
            <textarea value={form.assumptions} onChange={e => set("assumptions", e.target.value)}
              placeholder="e.g., Based on 5-day working week, ambient storage only..."
              className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Exclusions</label>
            <textarea value={form.exclusions} onChange={e => set("exclusions", e.target.value)}
              placeholder="e.g., Hazmat handling, overtime charges, insurance..."
              className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Validity Period</label>
            <Select value={String(form.validity_days)} onValueChange={v => set("validity_days", parseInt(v))}>
              <SelectTrigger className="h-9 text-sm w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALIDITY_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Review & Save</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <ReviewRow label="Service Type" value={SERVICE_TYPES.find(s => s.value === form.service_type)?.label || form.service_type} />
            <ReviewRow label="Volume" value={`${form.pallet_volume} ${form.volume_unit} storage, ${form.monthly_volume} handling/mo`} />
            <ReviewRow label="Rates" value={`Storage: ${form.storage_rate}, In: ${form.inbound_rate}, Out: ${form.outbound_rate}`} />
            <ReviewRow label="Monthly Revenue" value={`${form.currency} ${calc.monthlyRevenue.toLocaleString()}`} />
            <ReviewRow label="Annual Revenue" value={`${form.currency} ${calc.annualRevenue.toLocaleString()}`} />
            <ReviewRow label="Estimated Cost" value={`${form.currency} ${form.estimated_cost.toLocaleString()}`} />
            <ReviewRow label="Gross Profit" value={`${calc.gpPercent}% (${form.currency} ${calc.gpAmount.toLocaleString()})`} rag={calc.rag} />
            <ReviewRow label="Validity" value={`${form.validity_days} days`} />
            {form.discount_percent > 0 && <ReviewRow label="Discount" value={`${form.discount_percent}%`} />}
          </div>
          {form.assumptions && <div className="text-xs"><span className="font-medium">Assumptions:</span> <span className="text-muted-foreground">{form.assumptions}</span></div>}
          {form.exclusions && <div className="text-xs"><span className="font-medium">Exclusions:</span> <span className="text-muted-foreground">{form.exclusions}</span></div>}
        </div>
      );

      default: return null;
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-serif">{isEdit ? "Edit Quote" : "New Quote"}</CardTitle>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-[var(--color-hala-navy)] scale-125" : i < step ? "bg-emerald-400" : "bg-muted-foreground/20"}`}
                title={s} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Step {step + 1}/{STEPS.length}: {STEPS[step]}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-5 pb-4 min-h-[280px]">
        {renderStep()}
      </CardContent>
      <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="text-xs h-8"><ChevronLeft className="w-3.5 h-3.5 mr-1" />Back</Button>}
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-8">Cancel</Button>
        </div>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)} className="text-xs h-8 bg-[var(--color-hala-navy)]">Next<ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="text-xs h-8">
                <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800">
                <Send className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save & Submit"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function ReviewRow({ label, value, rag }: { label: string; value: string; rag?: "green" | "amber" | "red" }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-dashed border-muted last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium flex items-center gap-1.5">
        {rag && <span className={`w-2 h-2 rounded-full ${ragDot[rag]}`} />}
        {value}
      </span>
    </div>
  );
}
