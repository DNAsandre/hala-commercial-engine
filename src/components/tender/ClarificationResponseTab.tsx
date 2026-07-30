/**
 * ClarificationResponseTab — Tab 2 of Clarification Stage (Formal Response / BAFO)
 *
 * Manages formal written responses to clarification questions.
 * Tracks response status, revised pricing if any, and response notes.
 *
 * Data: type_details.clarification.response
 * No AI. No mock data.
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Info, ArrowRight, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderClarificationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const RESPONSE_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "drafting", label: "Drafting" },
  { value: "under_review", label: "Under Review" },
  { value: "submitted", label: "Submitted" },
  { value: "not_applicable", label: "Not Applicable" },
] as const;

export default function ClarificationResponseTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.clarification?.response ?? {};

  const originalValue = (ws.tender as any).estimatedValue || 0;
  const originalGp = (ws.tender as any).targetGpPercent || 0;

  const [responseStatus, setResponseStatus] = useState(saved.response_status || "not_started");
  const [receivedDate, setReceivedDate] = useState(saved.received_date || "");
  const [dueDate, setDueDate] = useState(saved.due_date || "");
  const [scopeChanges, setScopeChanges] = useState(saved.scope_changes || "");
  const [revisedPrice, setRevisedPrice] = useState<number>(saved.revised_price ?? originalValue);
  const [revisedGp, setRevisedGp] = useState<number>(saved.revised_gp ?? originalGp);
  const [pricingNotes, setPricingNotes] = useState(saved.pricing_notes || "");
  const [submittedDate, setSubmittedDate] = useState(saved.submitted_date || "");
  const [responseNotes, setResponseNotes] = useState(saved.response_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);
  const isActive = responseStatus !== "not_started" && responseStatus !== "not_applicable";
  const priceDelta = revisedPrice - originalValue;
  const gpDelta = revisedGp - originalGp;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        response_status: responseStatus,
        received_date: receivedDate,
        due_date: dueDate,
        scope_changes: scopeChanges,
        revised_price: revisedPrice,
        revised_gp: revisedGp,
        pricing_notes: pricingNotes,
        submitted_date: submittedDate,
        response_notes: responseNotes,
      };
      const res = await updateTenderClarificationData(tenderId, "response", payload, `Response status: ${responseStatus}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Response record saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [responseStatus, receivedDate, dueDate, scopeChanges, revisedPrice, revisedGp, pricingNotes, submittedDate, responseNotes, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "submitted") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "under_review") return "border-blue-300 text-blue-700 bg-blue-50";
    if (s === "drafting") return "border-amber-300 text-amber-700 bg-amber-50";
    if (s === "not_applicable") return "border-slate-200 text-slate-500 bg-slate-50";
    return "border-slate-200 text-slate-500 bg-slate-50";
  };
  const formatSar = (n: number) => n >= 1_000_000 ? `SAR ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `SAR ${(n / 1_000).toFixed(0)}K` : `SAR ${n.toLocaleString()}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Draft and track formal responses to client clarification questions. If pricing changes are required, record the revised pricing and GP impact.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Response</span>
        <Badge variant="outline" className={`text-[8px] ${statusColor(responseStatus)}`}>
          {RESPONSE_STATUSES.find(s => s.value === responseStatus)?.label}
        </Badge>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Response Status & Details</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Response Status</label>
              <Select value={responseStatus} onValueChange={v => { setResponseStatus(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{RESPONSE_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isActive && (
              <>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground">Request Received Date</label>
                  <Input type="date" className="h-8 text-xs mt-1" value={receivedDate} onChange={e => { setReceivedDate(e.target.value); mark(); }} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground">Response Due Date</label>
                  <Input type="date" className="h-8 text-xs mt-1" value={dueDate} onChange={e => { setDueDate(e.target.value); mark(); }} />
                </div>
              </>
            )}
          </div>
          {isActive && (
            <div className="mt-4 pt-4 border-t border-border">
              <label className="text-[10px] font-semibold text-muted-foreground">Scope Changes / Client Instructions</label>
              <Textarea className="text-xs mt-1 min-h-[60px]" value={scopeChanges} onChange={e => { setScopeChanges(e.target.value); mark(); }} placeholder="What scope or pricing changes did the client request?" />
            </div>
          )}
        </CardContent>
      </Card>

      {isActive && (
        <Card className="border-border shadow-none">
          <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#075eea]" />
              <span className="text-xs font-semibold">Pricing Comparison (if applicable)</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 mb-4 p-3 rounded-lg border border-[#075eea]/15 bg-[#075eea]/10">
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Original</p>
                <p className="text-sm font-bold">{formatSar(originalValue)}</p>
                <p className="text-[10px] text-muted-foreground">{originalGp.toFixed(1)}% GP</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#5b9cff] shrink-0" />
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Revised</p>
                <p className="text-sm font-bold">{formatSar(revisedPrice)}</p>
                <p className="text-[10px] text-muted-foreground">{revisedGp.toFixed(1)}% GP</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[#5b9cff] shrink-0" />
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Impact</p>
                <div className="flex items-center gap-1">
                  {priceDelta < 0 ? <TrendingDown className="w-3 h-3 text-red-500" /> : priceDelta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : null}
                  <p className={`text-sm font-bold ${priceDelta < 0 ? "text-red-600" : priceDelta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {priceDelta >= 0 ? "+" : ""}{formatSar(priceDelta)}
                  </p>
                </div>
                <p className={`text-[10px] ${gpDelta < 0 ? "text-red-600" : gpDelta > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {gpDelta >= 0 ? "+" : ""}{gpDelta.toFixed(1)}% GP
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Revised Total Price (SAR)</label>
                <Input type="number" min={0} className="h-8 text-xs mt-1" value={revisedPrice} onChange={e => { setRevisedPrice(parseFloat(e.target.value) || 0); mark(); }} />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Revised GP%</label>
                <Input type="number" min={0} max={100} step={0.1} className="h-8 text-xs mt-1" value={revisedGp} onChange={e => { setRevisedGp(parseFloat(e.target.value) || 0); mark(); }} />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[10px] font-semibold text-muted-foreground">Pricing Notes</label>
              <Textarea className="text-xs mt-1 min-h-[50px]" value={pricingNotes} onChange={e => { setPricingNotes(e.target.value); mark(); }} placeholder="Justification for pricing changes..." />
            </div>
          </CardContent>
        </Card>
      )}

      {isActive && (
        <Card className="border-border shadow-none">
          <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-[#075eea]" />
              <span className="text-xs font-semibold">Response Submission</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Response Submitted Date</label>
                <Input type="date" className="h-8 text-xs mt-1" value={submittedDate} onChange={e => { setSubmittedDate(e.target.value); mark(); }} />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-[10px] font-semibold text-muted-foreground">Response Notes</label>
              <Textarea className="text-xs mt-1 min-h-[50px]" value={responseNotes} onChange={e => { setResponseNotes(e.target.value); mark(); }} placeholder="Summary of what was submitted..." />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
