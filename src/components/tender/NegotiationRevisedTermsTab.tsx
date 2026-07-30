/**
 * NegotiationRevisedTermsTab — Tab 4 of Negotiation Stage
 *
 * Current state of agreed contract terms vs original submission.
 * Each term category shows original → revised.
 *
 * Data: type_details.negotiation_data.revised_terms
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
import { Save, Loader2, Info, FileText, ArrowRight } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderNegotiationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

interface TermEntry {
  id: string;
  category: string;
  original_term: string;
  revised_term: string;
  status: string;
}

const TERM_CATEGORIES = [
  { value: "contract_value", label: "Contract Value" },
  { value: "payment_terms", label: "Payment Terms" },
  { value: "contract_duration", label: "Contract Duration" },
  { value: "mobilization_period", label: "Mobilization Period" },
  { value: "sla_framework", label: "SLA Framework" },
  { value: "penalties_ld", label: "Penalties / LD" },
  { value: "insurance", label: "Insurance / Liability" },
  { value: "termination_clause", label: "Termination Clause" },
  { value: "price_escalation", label: "Price Escalation" },
  { value: "scope_definition", label: "Scope Definition" },
  { value: "reporting_kpi", label: "Reporting / KPIs" },
  { value: "staffing_levels", label: "Staffing Levels" },
  { value: "other", label: "Other" },
] as const;

const TERM_STATUSES = [
  { value: "unchanged", label: "Unchanged" },
  { value: "agreed", label: "Agreed" },
  { value: "pending", label: "Pending" },
  { value: "disputed", label: "Disputed" },
] as const;

export default function NegotiationRevisedTermsTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.negotiation_data?.revised_terms ?? {};
  const savedTerms: TermEntry[] = Array.isArray(saved.terms) ? saved.terms : [];

  const [terms, setTerms] = useState<TermEntry[]>(savedTerms);
  const [overallNotes, setOverallNotes] = useState(saved.overall_notes || "");
  const [contractReadiness, setContractReadiness] = useState(saved.contract_readiness || "not_ready");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const addTerm = () => {
    setTerms(prev => [...prev, {
      id: `trm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: "contract_value", original_term: "", revised_term: "", status: "pending",
    }]);
    mark();
  };

  const updateTerm = (id: string, field: keyof TermEntry, value: string) => {
    setTerms(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t)); mark();
  };
  const removeTerm = (id: string) => { setTerms(prev => prev.filter(t => t.id !== id)); mark(); };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = { terms, overall_notes: overallNotes, contract_readiness: contractReadiness };
      const res = await updateTenderNegotiationData(tenderId, "revised_terms", payload, `${terms.length} terms, readiness: ${contractReadiness}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Revised terms saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [terms, overallNotes, contractReadiness, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "agreed") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "disputed") return "border-red-300 text-red-700 bg-red-50";
    if (s === "unchanged") return "border-slate-200 text-slate-500 bg-slate-50";
    return "border-amber-300 text-amber-700 bg-amber-50";
  };
  const readinessColor = (r: string) => {
    if (r === "ready") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (r === "near_ready") return "border-amber-300 text-amber-700 bg-amber-50";
    return "border-slate-200 text-slate-500 bg-slate-50";
  };

  const agreedCount = terms.filter(t => t.status === "agreed").length;
  const disputedCount = terms.filter(t => t.status === "disputed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Record the current state of contract terms: what was originally proposed vs what has been agreed through negotiation. This becomes the basis for the final contract.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Terms</span>
        <Badge variant="outline" className="text-[8px]">{terms.length} terms</Badge>
        {agreedCount > 0 && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-700 bg-emerald-50">{agreedCount} agreed</Badge>}
        {disputedCount > 0 && <Badge variant="outline" className="text-[8px] border-red-200 text-red-700 bg-red-50">{disputedCount} disputed</Badge>}
        <Badge variant="outline" className={`text-[8px] ml-2 ${readinessColor(contractReadiness)}`}>
          Contract: {contractReadiness === "ready" ? "Ready" : contractReadiness === "near_ready" ? "Near Ready" : "Not Ready"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Contract Readiness */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Contract Readiness</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Readiness</label>
              <Select value={contractReadiness} onValueChange={v => { setContractReadiness(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_ready" className="text-xs">Not Ready</SelectItem>
                  <SelectItem value="near_ready" className="text-xs">Near Ready</SelectItem>
                  <SelectItem value="ready" className="text-xs">Ready for Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4"><label className="text-[10px] font-semibold text-muted-foreground">Overall Notes</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={overallNotes} onChange={e => { setOverallNotes(e.target.value); mark(); }} placeholder="Summary of negotiation position, outstanding issues..." /></div>
        </CardContent>
      </Card>

      {/* Terms Table */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Contract Terms — Original vs Revised</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addTerm}>+ Add Term</Button>
        </CardHeader>
        <CardContent className="p-0">
          {terms.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No terms logged yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">Category</div>
                <div className="col-span-3">Original Term</div>
                <div className="col-span-1 flex items-center justify-center"><ArrowRight className="w-3 h-3" /></div>
                <div className="col-span-3">Revised Term</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1"></div>
              </div>
              {terms.map(term => (
                <div key={term.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-start">
                  <div className="col-span-2">
                    <Select value={term.category} onValueChange={v => updateTerm(term.id, "category", v)}>
                      <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{TERM_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Input className="h-7 text-[10px]" value={term.original_term} onChange={e => updateTerm(term.id, "original_term", e.target.value)} placeholder="What was proposed" />
                  </div>
                  <div className="col-span-1 flex items-center justify-center pt-1"><ArrowRight className="w-3 h-3 text-muted-foreground" /></div>
                  <div className="col-span-3">
                    <Input className="h-7 text-[10px]" value={term.revised_term} onChange={e => updateTerm(term.id, "revised_term", e.target.value)} placeholder="What was agreed" />
                  </div>
                  <div className="col-span-2">
                    <Select value={term.status} onValueChange={v => updateTerm(term.id, "status", v)}>
                      <SelectTrigger className={`h-7 text-[10px] ${statusColor(term.status)}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{TERM_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeTerm(term.id)}>×</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
