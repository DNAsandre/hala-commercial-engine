/**
 * ClientEvaluationStatusTab — Tab 4 of Client Evaluation Stage
 *
 * High-level evaluation tracker:
 * - Technical evaluation status
 * - Commercial evaluation status
 * - Overall status (auto-derived)
 * - Expected decision date
 * - Competitor intelligence
 *
 * Data: type_details.client_evaluation.evaluation_status
 * No AI. No mock data.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Info, Eye, CheckCircle2, XCircle, Clock, HelpCircle } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderClientEvaluationData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

const EVAL_STATUSES = [
  { value: "pending", label: "Pending", icon: Clock, color: "border-amber-300 text-amber-700 bg-amber-50" },
  { value: "shortlisted", label: "Shortlisted", icon: CheckCircle2, color: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  { value: "eliminated", label: "Eliminated", icon: XCircle, color: "border-red-300 text-red-700 bg-red-50" },
  { value: "unknown", label: "Unknown", icon: HelpCircle, color: "border-slate-200 text-slate-500 bg-slate-50" },
] as const;

function deriveOverall(tech: string, comm: string): string {
  if (tech === "eliminated" || comm === "eliminated") return "eliminated";
  if (tech === "shortlisted" && comm === "shortlisted") return "shortlisted";
  if (tech === "shortlisted" || comm === "shortlisted") return "pending";
  return "pending";
}

export default function ClientEvaluationStatusTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.client_evaluation?.evaluation_status ?? {};

  const [techStatus, setTechStatus] = useState(saved.technical_status || "pending");
  const [commStatus, setCommStatus] = useState(saved.commercial_status || "pending");
  const [expectedDecision, setExpectedDecision] = useState(saved.expected_decision_date || "");
  const [clientContact, setClientContact] = useState(saved.client_contact || "");
  const [contactNotes, setContactNotes] = useState(saved.contact_notes || "");
  const [competitors, setCompetitors] = useState(saved.competitor_intelligence || "");
  const [evalNotes, setEvalNotes] = useState(saved.evaluation_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const overallStatus = useMemo(() => deriveOverall(techStatus, commStatus), [techStatus, commStatus]);
  const overallMeta = EVAL_STATUSES.find(s => s.value === overallStatus) || EVAL_STATUSES[0];

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        technical_status: techStatus,
        commercial_status: commStatus,
        overall_status: overallStatus,
        expected_decision_date: expectedDecision,
        client_contact: clientContact,
        contact_notes: contactNotes,
        competitor_intelligence: competitors,
        evaluation_notes: evalNotes,
      };
      const res = await updateTenderClientEvaluationData(tenderId, "evaluation_status", payload, `Overall: ${overallStatus}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("Evaluation status saved.");
      setDirty(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [techStatus, commStatus, overallStatus, expectedDecision, clientContact, contactNotes, competitors, evalNotes, tenderId, reload]);

  const StatusCard = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => {
    const meta = EVAL_STATUSES.find(s => s.value === value) || EVAL_STATUSES[3];
    const Icon = meta.icon;
    return (
      <div className="flex flex-col items-center p-4 rounded-lg border border-border bg-card">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border-2 ${meta.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <Select value={value} onValueChange={v => { onChange(v); mark(); }}>
          <SelectTrigger className="h-7 text-[10px] w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVAL_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Track the client's evaluation progress. The overall status is automatically derived from the technical and commercial evaluations.</span>
      </div>

      {/* Save Strip */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Evaluation</span>
        <Badge variant="outline" className={`text-[8px] ${overallMeta.color}`}>
          Overall: {overallMeta.label}
        </Badge>
        {expectedDecision && (
          <span className="text-[10px] text-muted-foreground">Decision: {expectedDecision}</span>
        )}
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Evaluation Status Cards */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Evaluation Status</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <StatusCard label="Technical Evaluation" value={techStatus} onChange={setTechStatus} />
            <StatusCard label="Commercial Evaluation" value={commStatus} onChange={setCommStatus} />
            <div className="flex flex-col items-center p-4 rounded-lg border-2 border-[#075eea]/20 bg-[#075eea]/10">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#075eea] mb-2">Overall</p>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border-2 ${overallMeta.color}`}>
                <overallMeta.icon className="w-5 h-5" />
              </div>
              <Badge variant="outline" className={`text-[10px] ${overallMeta.color}`}>
                {overallMeta.label}
              </Badge>
              <p className="text-[8px] text-muted-foreground mt-1">Auto-derived</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">Expected Decision Date</label>
                <Input type="date" className="h-8 text-xs mt-1" value={expectedDecision} onChange={e => { setExpectedDecision(e.target.value); mark(); }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Contact During Evaluation */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Client Contact & Intelligence</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Client Contact (during evaluation)</label>
              <Input className="h-8 text-xs mt-1" value={clientContact} onChange={e => { setClientContact(e.target.value); mark(); }} placeholder="Primary client contact" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Contact Notes</label>
              <Input className="h-8 text-xs mt-1" value={contactNotes} onChange={e => { setContactNotes(e.target.value); mark(); }} placeholder="Role, relationship..." />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-[10px] font-semibold text-muted-foreground">Competitor Intelligence</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={competitors} onChange={e => { setCompetitors(e.target.value); mark(); }} placeholder="Who else is bidding? Known competitors, strengths, pricing intelligence..." />
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-[10px] font-semibold text-muted-foreground">Evaluation Notes</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={evalNotes} onChange={e => { setEvalNotes(e.target.value); mark(); }} placeholder="General notes about the evaluation process..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
