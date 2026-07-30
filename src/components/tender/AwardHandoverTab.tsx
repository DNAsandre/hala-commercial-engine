/**
 * AwardHandoverTab — Tab 4 of Awarded Stage
 *
 * Operations team handover checklist.
 * Transfer from commercial team to the people who run the contract.
 *
 * Data: type_details.awarded_data.handover
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
import { Save, Loader2, Info, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderAwardedData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const HANDOVER_STATUS = [
  { value: "not_started", label: "Not Started" },
  { value: "briefing", label: "Briefing Ops Team" },
  { value: "in_progress", label: "Handover In Progress" },
  { value: "completed", label: "Handover Complete" },
] as const;

const HANDOVER_CHECKLIST = [
  { key: "ops_team_identified", label: "Operations team identified and assigned" },
  { key: "ops_briefing_held", label: "Operations briefing meeting held" },
  { key: "solution_design_shared", label: "Solution design pack shared with ops" },
  { key: "site_surveys_scheduled", label: "Site surveys / assessments scheduled" },
  { key: "mobilization_plan", label: "Mobilization plan drafted" },
  { key: "staffing_plan", label: "Staffing plan drafted" },
  { key: "it_systems_setup", label: "IT / WMS / TMS setup initiated" },
  { key: "client_intro_meeting", label: "Client introductory meeting with ops team" },
  { key: "contract_handover", label: "Signed contract shared with ops" },
  { key: "sla_handover", label: "SLA handoff brief shared with ops" },
  { key: "risk_register_handover", label: "Risk register shared with ops" },
  { key: "commercial_close", label: "Commercial engine record marked as closed/won" },
] as const;

export default function AwardHandoverTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.awarded_data?.handover ?? {};

  const [handoverStatus, setHandoverStatus] = useState(saved.handover_status || "not_started");
  const [opsManager, setOpsManager] = useState(saved.ops_manager || "");
  const [opsTeam, setOpsTeam] = useState(saved.ops_team || "");
  const [handoverDate, setHandoverDate] = useState(saved.handover_date || "");
  const [mobilizationDate, setMobilizationDate] = useState(saved.mobilization_date || "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(saved.checklist ?? {});
  const [lessonsLearned, setLessonsLearned] = useState(saved.lessons_learned || "");
  const [notes, setNotes] = useState(saved.notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);
  const toggleCheck = (key: string) => { setChecklist(prev => ({ ...prev, [key]: !prev[key] })); mark(); };

  const completedCount = HANDOVER_CHECKLIST.filter(i => checklist[i.key]).length;
  const totalCount = HANDOVER_CHECKLIST.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        handover_status: handoverStatus, ops_manager: opsManager, ops_team: opsTeam,
        handover_date: handoverDate, mobilization_date: mobilizationDate,
        checklist, lessons_learned: lessonsLearned, notes,
      };
      const res = await updateTenderAwardedData(tenderId, "handover", payload, `Status: ${handoverStatus}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Handover saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [handoverStatus, opsManager, opsTeam, handoverDate, mobilizationDate, checklist, lessonsLearned, notes, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "completed") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "in_progress") return "border-blue-300 text-blue-700 bg-blue-50";
    if (s === "briefing") return "border-amber-300 text-amber-700 bg-amber-50";
    return "border-slate-200 text-slate-500 bg-slate-50";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Hand over from the commercial team to operations. This is the final step before the commercial engine closes this tender as "Won".</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Handover</span>
        <Badge variant="outline" className={`text-[8px] ${statusColor(handoverStatus)}`}>
          {HANDOVER_STATUS.find(s => s.value === handoverStatus)?.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{completedCount}/{totalCount} ({pct}%)</span>
        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Handover Details */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Handover Details</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">Handover Status</label>
              <Select value={handoverStatus} onValueChange={v => { setHandoverStatus(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{HANDOVER_STATUS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Operations Manager</label>
              <Input className="h-8 text-xs mt-1" value={opsManager} onChange={e => { setOpsManager(e.target.value); mark(); }} placeholder="Who takes ownership" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Operations Team</label>
              <Input className="h-8 text-xs mt-1" value={opsTeam} onChange={e => { setOpsTeam(e.target.value); mark(); }} placeholder="Team / department" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Handover Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={handoverDate} onChange={e => { setHandoverDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Mobilization Start Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={mobilizationDate} onChange={e => { setMobilizationDate(e.target.value); mark(); }} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Handover Checklist */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Handover Checklist</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{completedCount}/{totalCount}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {HANDOVER_CHECKLIST.map(item => (
              <div key={item.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toggleCheck(item.key)}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checklist[item.key] ? "bg-emerald-500 border-emerald-500" : "border-border"}`}>
                  {checklist[item.key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-xs ${checklist[item.key] ? "text-muted-foreground line-through" : ""}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lessons Learned */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Lessons Learned & Close-out</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div><label className="text-[10px] font-semibold text-muted-foreground">Lessons Learned</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={lessonsLearned} onChange={e => { setLessonsLearned(e.target.value); mark(); }} placeholder="What went well? What could be improved for future tenders?" /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
            <Textarea className="text-xs mt-1 min-h-[40px]" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="Final notes..." /></div>
        </CardContent>
      </Card>
    </div>
  );
}
