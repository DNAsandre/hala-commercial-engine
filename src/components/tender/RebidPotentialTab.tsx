/**
 * RebidPotentialTab — Tab 4 of Lost/Withdrawn Stage
 *
 * Assess whether this tender could be rebid in the future.
 * Rebid probability, timeline, conditions, strategy notes.
 *
 * Data: type_details.lost_withdrawn_data.rebid_potential
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
import { Save, Loader2, Info, TrendingUp, RefreshCw } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderLostWithdrawnData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const REBID_LIKELIHOOD = [
  { value: "high", label: "High — Likely to rebid" },
  { value: "medium", label: "Medium — Possible" },
  { value: "low", label: "Low — Unlikely" },
  { value: "none", label: "None — Will not rebid" },
] as const;

export default function RebidPotentialTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.lost_withdrawn_data?.rebid_potential ?? {};

  const [likelihood, setLikelihood] = useState(saved.likelihood || "none");
  const [expectedTimeline, setExpectedTimeline] = useState(saved.expected_timeline || "");
  const [contractDuration, setContractDuration] = useState(saved.current_contract_duration || "");
  const [conditionsForRebid, setConditionsForRebid] = useState(saved.conditions_for_rebid || "");
  const [strategyNotes, setStrategyNotes] = useState(saved.strategy_notes || "");
  const [clientRelationship, setClientRelationship] = useState(saved.client_relationship || "neutral");
  const [nextSteps, setNextSteps] = useState(saved.next_steps || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        likelihood, expected_timeline: expectedTimeline, current_contract_duration: contractDuration,
        conditions_for_rebid: conditionsForRebid, strategy_notes: strategyNotes,
        client_relationship: clientRelationship, next_steps: nextSteps,
      };
      const res = await updateTenderLostWithdrawnData(tenderId, "rebid_potential", payload, `Rebid: ${likelihood}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Rebid potential saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [likelihood, expectedTimeline, contractDuration, conditionsForRebid, strategyNotes, clientRelationship, nextSteps, tenderId, reload]);

  const likelihoodColor = (l: string) => {
    if (l === "high") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (l === "medium") return "border-amber-300 text-amber-700 bg-amber-50";
    if (l === "low") return "border-slate-200 text-slate-500 bg-slate-50";
    return "border-red-200 text-red-500 bg-red-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <RefreshCw className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Assess whether this contract will come back to market and if Hala should pursue it again. This informs future pipeline planning.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Rebid</span>
        <Badge variant="outline" className={`text-[8px] ${likelihoodColor(likelihood)}`}>
          {likelihood === "high" ? "Likely" : likelihood === "medium" ? "Possible" : likelihood === "low" ? "Unlikely" : "No Rebid"}
        </Badge>
        {expectedTimeline && <span className="text-[10px] text-muted-foreground">Timeline: {expectedTimeline}</span>}
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Rebid Assessment */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Rebid Assessment</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Rebid Likelihood</label>
              <Select value={likelihood} onValueChange={v => { setLikelihood(v); mark(); }}>
                <SelectTrigger className={`h-8 text-xs mt-1 ${likelihoodColor(likelihood)}`}><SelectValue /></SelectTrigger>
                <SelectContent>{REBID_LIKELIHOOD.map(r => <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Expected Timeline</label>
              <Input className="h-8 text-xs mt-1" value={expectedTimeline} onChange={e => { setExpectedTimeline(e.target.value); mark(); }} placeholder="e.g. Q3 2027, 18 months, next year" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Current Contract Duration</label>
              <Input className="h-8 text-xs mt-1" value={contractDuration} onChange={e => { setContractDuration(e.target.value); mark(); }} placeholder="e.g. 3 years from July 2026" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Client Relationship Status</label>
              <Select value={clientRelationship} onValueChange={v => { setClientRelationship(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strong" className="text-xs">Strong — Active relationship</SelectItem>
                  <SelectItem value="neutral" className="text-xs">Neutral — Professional</SelectItem>
                  <SelectItem value="strained" className="text-xs">Strained — Needs repair</SelectItem>
                  <SelectItem value="none" className="text-xs">None — No relationship</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy & Conditions */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Strategy & Conditions</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div><label className="text-[10px] font-semibold text-muted-foreground">Conditions for Rebid</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={conditionsForRebid} onChange={e => { setConditionsForRebid(e.target.value); mark(); }} placeholder="What needs to change for us to win next time? (e.g. lower pricing, different solution, better track record...)" /></div>
          <div><label className="text-[10px] font-semibold text-muted-foreground">Rebid Strategy Notes</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={strategyNotes} onChange={e => { setStrategyNotes(e.target.value); mark(); }} placeholder="How would we approach this differently? Key strategic changes..." /></div>
          <div><label className="text-[10px] font-semibold text-muted-foreground">Next Steps</label>
            <Textarea className="text-xs mt-1 min-h-[40px]" value={nextSteps} onChange={e => { setNextSteps(e.target.value); mark(); }} placeholder="Specific actions to take to maintain readiness (e.g. maintain client relationship, monitor contract performance...)" /></div>
        </CardContent>
      </Card>
    </div>
  );
}
