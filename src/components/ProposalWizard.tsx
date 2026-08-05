/**
 * ProposalWizard — 7-step guided proposal creation from quote
 * Sprint 4: Select Quote → Basics → Scope → Pricing Snapshot → Assumptions → Negotiation → Review
 * Proposal must link to a quote. Pricing is read-only snapshot.
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Save, Send, FileText, Info, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  listQuotesByWorkspace,
  updateProposal,
  recordProposalSubmittedForReview,
  PROPOSAL_CREATE_UNAVAILABLE,
  type QuoteRecord,
  type ProposalRecord,
} from "@/lib/commercial-runtime";

const STEPS = ["Select Quote", "Basics", "Scope", "Pricing Snapshot", "Assumptions", "Negotiation", "Review & Save"];
const ragDot: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  // No captured margin gets a neutral light, not a red one.
  unknown: "bg-muted-foreground/30",
};
function getRAG(gp: number | null) {
  if (gp == null) return "unknown";
  return gp >= 25 ? "green" : gp >= 15 ? "amber" : "red";
}

/** null = the column holds no value. 0 = a real, stored zero. */
function money(currency: string | null, value: number | null) {
  if (value == null) return "Not captured";
  return `${currency || "—"} ${value.toLocaleString()}`;
}

function percent(value: number | null) {
  return value == null ? "Not captured" : `${value}%`;
}

interface Props {
  workspaceId: string;
  customerId?: string;
  customerName?: string;
  existingProposal?: ProposalRecord | null;
  onSaved: (p: ProposalRecord | null) => void;
  onCancel: () => void;
}

export default function ProposalWizard({ workspaceId, customerId, customerName, existingProposal, onSaved, onCancel }: Props) {
  const [step, setStep] = useState(existingProposal ? 1 : 0);
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const isEdit = !!existingProposal;

  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  // Only `title` has an established column (commercial_tickets.ticket_title).
  // The narrative fields below are captured for the human's own review but are
  // NOT persisted — see commercial-runtime.ts PROPOSAL_UNSTORED_KEYS.
  const [form, setForm] = useState({
    title: existingProposal?.title || "",
    executive_summary: "",
    scope_description: "",
    service_summary: "",
    assumptions: "",
    exclusions: "",
    negotiation_notes: "",
    client_request_summary: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    listQuotesByWorkspace(workspaceId).then(res => {
      if (cancelled) return;
      if (!res.ok) { setQuotesError(res.error); setQuotes([]); }
      else { setQuotesError(null); setQuotes(res.data.filter(q => q.status !== "superseded")); }
      setLoadingQuotes(false);
    });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);
  const pricingSnapshot = selectedQuote ? {
    quote_id: selectedQuote.id,
    quote_number: selectedQuote.quote_number,
    quote_version: selectedQuote.version_number,
    quote_status: selectedQuote.status,
    storage_rate: selectedQuote.storage_rate, inbound_rate: selectedQuote.inbound_rate,
    outbound_rate: selectedQuote.outbound_rate, pallet_volume: selectedQuote.pallet_volume,
    monthly_revenue: selectedQuote.monthly_revenue, annual_revenue: selectedQuote.annual_revenue,
    estimated_cost: selectedQuote.estimated_cost,
    gp_amount: selectedQuote.gp_amount, gp_percent: selectedQuote.gp_percent,
    currency: selectedQuote.currency, service_type: selectedQuote.service_type,
  } : null;

  const handleSave = async (andSubmit = false) => {
    if (!selectedQuoteId && !isEdit) { toast.error("Select a quote first"); return; }
    if (!isEdit) {
      // No established contract for creating a proposal record — fail honestly
      // rather than pretend anything was written.
      toast.error(PROPOSAL_CREATE_UNAVAILABLE);
      return;
    }
    setSaving(true);
    try {
      const res = await updateProposal(existingProposal!.id, { ...form, linked_quote_id: selectedQuoteId, customer_id: customerId });
      if (!res.ok) { toast.error(res.error); return; }

      const notes: string[] = [res.data.recorded, ...res.data.warnings];
      if (res.data.unstoredFields.length > 0) {
        notes.push(`Not stored (no established column): ${res.data.unstoredFields.join(", ")}.`);
      }

      if (andSubmit) {
        const submitted = await recordProposalSubmittedForReview(existingProposal!.id);
        if (!submitted.ok) {
          toast.error(submitted.error, { description: `The title WAS saved. ${notes.join(" ")}`.trim() });
          onSaved(res.data.proposal);
          return;
        }
        notes.push(submitted.data.recorded, ...submitted.data.warnings);
        toast.success("Proposal submitted for review", { description: notes.join(" ") });
      } else {
        toast.success("Proposal updated", { description: notes.join(" ") });
      }
      onSaved(res.data.proposal);
    } finally { setSaving(false); }
  };

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Select Quote</h3>
          {!isEdit && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800">{PROPOSAL_CREATE_UNAVAILABLE}</p>
            </div>
          )}
          {loadingQuotes ? <p className="text-xs text-muted-foreground py-4">Loading quotes...</p>
          : quotesError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div><p className="text-sm font-medium text-red-800">Quotes could not be loaded</p>
              <p className="text-xs text-red-700 mt-0.5">{quotesError}</p></div>
            </div>
          ) : quotes.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div><p className="text-sm font-medium text-amber-800">No quotes available</p>
              <p className="text-xs text-amber-700 mt-0.5">Create a quote before creating a proposal.</p></div>
            </div>
          ) : quotes.map(q => {
            const rag = getRAG(q.gp_percent);
            return (
              <button key={q.id} onClick={() => { setSelectedQuoteId(q.id); if (!form.assumptions && q.assumptions) set("assumptions", q.assumptions); if (!form.exclusions && q.exclusions) set("exclusions", q.exclusions); }}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedQuoteId === q.id ? "border-[var(--color-hala-navy)] bg-[var(--color-hala-navy)]/5" : "border-border hover:border-muted-foreground/30"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${ragDot[rag]}`} />
                  <span className="text-sm font-medium">{q.quote_number || `V${q.version_number ?? "?"}`}</span>
                  <Badge variant="outline" className="text-[10px]">{q.status ?? "not captured"}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">GP: {percent(q.gp_percent)}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Revenue: {money(q.currency, q.annual_revenue)}{q.annual_revenue != null ? "/yr" : ""}</span>
                  <span>Service: {q.service_type || "Not captured"}</span>
                </div>
              </button>
            );
          })}
        </div>
      );

      case 1: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Proposal Basics</h3>
          <Field label="Title" value={form.title} onChange={v => set("title", v)} placeholder="e.g., Warehousing Services Proposal — Sadara Chemical" />
          <div><label className="text-xs text-muted-foreground mb-1 block">Executive Summary</label>
          <textarea value={form.executive_summary} onChange={e => set("executive_summary", e.target.value)} placeholder="Brief overview of the proposal..." className="w-full h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <Field label="Service Summary" value={form.service_summary} onChange={v => set("service_summary", v)} placeholder="e.g., Full warehousing and distribution" />
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Scope Description</h3>
          <div><label className="text-xs text-muted-foreground mb-1 block">Scope of Services</label>
          <textarea value={form.scope_description} onChange={e => set("scope_description", e.target.value)} placeholder="Describe the full scope of services being proposed..." className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">Pricing Snapshot <Badge variant="outline" className="text-[10px]">Read-only from Quote</Badge></h3>
          {pricingSnapshot ? (
            <>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 flex items-center gap-2 text-xs">
                <Link2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Linked to <span className="font-semibold">{pricingSnapshot.quote_number || `V${pricingSnapshot.quote_version ?? "?"}`}</span> ({pricingSnapshot.quote_status ?? "not captured"})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Annual Revenue" value={money(pricingSnapshot.currency, pricingSnapshot.annual_revenue)} />
                <Stat label="Monthly Revenue" value={money(pricingSnapshot.currency, pricingSnapshot.monthly_revenue)} />
                <Stat label="Estimated Cost" value={money(pricingSnapshot.currency, pricingSnapshot.estimated_cost)} />
                <Stat label="Gross Profit" value={`${percent(pricingSnapshot.gp_percent)} (${money(pricingSnapshot.currency, pricingSnapshot.gp_amount)})`} rag={getRAG(pricingSnapshot.gp_percent)} />
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Info className="w-3 h-3" /> Read directly from the selected quote record. This link is shown for review only — it is not stored on the proposal.</p>
            </>
          ) : <p className="text-sm text-muted-foreground py-4">No quote selected — go back to Step 1.</p>}
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Assumptions & Exclusions</h3>
          {selectedQuote?.assumptions && <div className="rounded-md border border-muted bg-muted/20 p-2 text-xs"><span className="font-medium">Inherited from quote:</span> <span className="text-muted-foreground">{selectedQuote.assumptions}</span></div>}
          <div><label className="text-xs text-muted-foreground mb-1 block">Assumptions</label>
          <textarea value={form.assumptions} onChange={e => set("assumptions", e.target.value)} placeholder="Proposal-specific assumptions..." className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          {selectedQuote?.exclusions && <div className="rounded-md border border-muted bg-muted/20 p-2 text-xs"><span className="font-medium">Inherited from quote:</span> <span className="text-muted-foreground">{selectedQuote.exclusions}</span></div>}
          <div><label className="text-xs text-muted-foreground mb-1 block">Exclusions</label>
          <textarea value={form.exclusions} onChange={e => set("exclusions", e.target.value)} placeholder="Proposal-specific exclusions..." className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
        </div>
      );

      case 5: return (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Negotiation Notes</h3>
          <div><label className="text-xs text-muted-foreground mb-1 block">Client Request / Context</label>
          <textarea value={form.client_request_summary} onChange={e => set("client_request_summary", e.target.value)} placeholder="Why is this proposal being created? What did the client request?" className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Negotiation Notes</label>
          <textarea value={form.negotiation_notes} onChange={e => set("negotiation_notes", e.target.value)} placeholder="Commercial concerns, competitor context, pricing flexibility notes..." className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
        </div>
      );

      case 6: return (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Review & Save</h3>
          {pricingSnapshot && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-2 flex items-center gap-2 text-xs">
              <Link2 className="w-3.5 h-3.5 text-blue-500" />
              Linked to <span className="font-semibold">{pricingSnapshot.quote_number || `V${pricingSnapshot.quote_version ?? "?"}`}</span> — GP: {percent(pricingSnapshot.gp_percent)}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <ReviewRow label="Title" value={form.title || "(untitled)"} />
            <ReviewRow label="Service" value={pricingSnapshot?.service_type || "—"} />
            <ReviewRow label="Annual Value" value={pricingSnapshot ? money(pricingSnapshot.currency, pricingSnapshot.annual_revenue) : "—"} />
            <ReviewRow label="GP%" value={pricingSnapshot ? percent(pricingSnapshot.gp_percent) : "—"} />
          </div>
          {form.executive_summary && <div className="text-xs"><span className="font-medium">Summary:</span> <span className="text-muted-foreground">{form.executive_summary.substring(0, 200)}</span></div>}
          {form.negotiation_notes && <div className="text-xs"><span className="font-medium">Negotiation:</span> <span className="text-muted-foreground">{form.negotiation_notes.substring(0, 200)}</span></div>}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800">
              Saved to the commercial ticket: the title. Executive summary, scope, service summary,
              assumptions, exclusions, negotiation notes, client request and the quote link have no
              established column and are NOT stored — the confirmation after saving lists exactly
              what was left out.
            </p>
          </div>
        </div>
      );
      default: return null;
    }
  };

  const canProceed = step === 0 ? !!selectedQuoteId : true;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-serif">{isEdit ? "Edit Proposal" : "New Proposal"}</CardTitle>
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => canProceed && setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-[var(--color-hala-navy)] scale-125" : i < step ? "bg-emerald-400" : "bg-muted-foreground/20"}`} title={s} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{step + 1}/{STEPS.length}: {STEPS[step]}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-5 pb-4 min-h-[280px]">{renderStep()}</CardContent>
      <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} className="text-xs h-8"><ChevronLeft className="w-3.5 h-3.5 mr-1" />Back</Button>}
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs h-8">Cancel</Button>
        </div>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => canProceed && setStep(s => s + 1)} disabled={!canProceed} className="text-xs h-8 bg-[var(--color-hala-navy)]">Next<ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={saving} className="text-xs h-8"><Save className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save Draft"}</Button>
              <Button size="sm" onClick={() => handleSave(true)} disabled={saving} className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800"><Send className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save & Submit"}</Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className="text-xs text-muted-foreground mb-1 block">{label}</label><Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" /></div>;
}
function Stat({ label, value, rag }: { label: string; value: string; rag?: string }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p><p className="text-sm font-semibold flex items-center gap-1.5">{rag && <span className={`w-2 h-2 rounded-full ${ragDot[rag]}`} />}{value}</p></div>;
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-1.5 border-b border-dashed border-muted last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-xs font-medium">{value}</span></div>;
}
