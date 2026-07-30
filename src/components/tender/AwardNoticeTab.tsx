/**
 * AwardNoticeTab — Tab 1 of Awarded Stage
 *
 * Capture the formal award notification from the client.
 * Date, reference, conditions, award letter details.
 *
 * Data: type_details.awarded_data.award_notice
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
import { Save, Loader2, Info, Trophy, CheckCircle2, Calendar, FileText, DollarSign } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderAwardedData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

export default function AwardNoticeTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.awarded_data?.award_notice ?? {};

  const [awardDate, setAwardDate] = useState(saved.award_date || "");
  const [awardReference, setAwardReference] = useState(saved.award_reference || "");
  const [awardType, setAwardType] = useState(saved.award_type || "formal_letter");
  const [clientContact, setClientContact] = useState(saved.client_contact || "");
  const [awardConditions, setAwardConditions] = useState(saved.award_conditions || "");
  const [awardedValue, setAwardedValue] = useState<number>(saved.awarded_value ?? ((ws.tender as any).estimatedValue || 0));
  const [awardedGp, setAwardedGp] = useState<number>(saved.awarded_gp ?? ((ws.tender as any).targetGpPercent || 0));
  const [contractDuration, setContractDuration] = useState(saved.contract_duration || "");
  const [startDate, setStartDate] = useState(saved.start_date || "");
  const [notes, setNotes] = useState(saved.notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const formatSar = (n: number) => n >= 1_000_000 ? `SAR ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `SAR ${(n / 1_000).toFixed(0)}K` : `SAR ${n.toLocaleString()}`;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        award_date: awardDate, award_reference: awardReference, award_type: awardType,
        client_contact: clientContact, award_conditions: awardConditions,
        awarded_value: awardedValue, awarded_gp: awardedGp,
        contract_duration: contractDuration, start_date: startDate, notes,
      };
      const res = await updateTenderAwardedData(tenderId, "award_notice", payload, `Awarded ${formatSar(awardedValue)}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Award notice saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [awardDate, awardReference, awardType, clientContact, awardConditions, awardedValue, awardedGp, contractDuration, startDate, notes, tenderId, reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
        <Trophy className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
        <span>Record the formal award notification. This is the official record that the tender was won.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Award</span>
        <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50">Won</Badge>
        {awardDate && <span className="text-[10px] text-muted-foreground">Date: {awardDate}</span>}
        {awardedValue > 0 && <span className="text-[10px] font-mono text-emerald-700">{formatSar(awardedValue)}</span>}
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Award Summary Card */}
      <Card className="border-emerald-200 shadow-none bg-emerald-50/20">
        <CardHeader className="py-2 px-4 bg-emerald-50/50 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-800">Award Summary</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-emerald-200 p-3 bg-white text-center">
              <DollarSign className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Awarded Value</p>
              <p className="text-sm font-bold text-emerald-700">{formatSar(awardedValue)}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 p-3 bg-white text-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Final GP%</p>
              <p className="text-sm font-bold text-emerald-700">{awardedGp.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-emerald-200 p-3 bg-white text-center">
              <Calendar className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Duration</p>
              <p className="text-sm font-bold">{contractDuration || "Not captured yet"}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 p-3 bg-white text-center">
              <FileText className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <p className="text-[9px] text-muted-foreground uppercase">Start Date</p>
              <p className="text-sm font-bold">{startDate || "Not captured yet"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Award Details */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Award Details</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Award Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={awardDate} onChange={e => { setAwardDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Award Reference / Letter No.</label>
              <Input className="h-8 text-xs mt-1" value={awardReference} onChange={e => { setAwardReference(e.target.value); mark(); }} placeholder="e.g. LOI-2026-0034" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Award Type</label>
              <Select value={awardType} onValueChange={v => { setAwardType(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal_letter" className="text-xs">Formal Award Letter</SelectItem>
                  <SelectItem value="loi" className="text-xs">Letter of Intent (LoI)</SelectItem>
                  <SelectItem value="email" className="text-xs">Email Notification</SelectItem>
                  <SelectItem value="verbal" className="text-xs">Verbal (pending written)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Client Contact</label>
              <Input className="h-8 text-xs mt-1" value={clientContact} onChange={e => { setClientContact(e.target.value); mark(); }} placeholder="Who communicated the award" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Awarded Value (SAR)</label>
              <Input type="number" min={0} className="h-8 text-xs mt-1" value={awardedValue} onChange={e => { setAwardedValue(parseFloat(e.target.value) || 0); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Final GP%</label>
              <Input type="number" min={0} max={100} step={0.1} className="h-8 text-xs mt-1" value={awardedGp} onChange={e => { setAwardedGp(parseFloat(e.target.value) || 0); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Contract Duration</label>
              <Input className="h-8 text-xs mt-1" value={contractDuration} onChange={e => { setContractDuration(e.target.value); mark(); }} placeholder="e.g. 3 years + 2 optional" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Expected Start Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={startDate} onChange={e => { setStartDate(e.target.value); mark(); }} /></div>
          </div>
          <div className="mt-4"><label className="text-[10px] font-semibold text-muted-foreground">Award Conditions</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={awardConditions} onChange={e => { setAwardConditions(e.target.value); mark(); }} placeholder="Any conditions attached to the award (e.g. subject to board approval, pending insurance certificate...)" /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
            <Textarea className="text-xs mt-1 min-h-[40px]" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="Internal notes about the award..." /></div>
        </CardContent>
      </Card>
    </div>
  );
}
