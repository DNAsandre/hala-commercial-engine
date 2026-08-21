/**
 * ClarificationStatusTab — Tab 4 of Clarification Stage
 *
 * High-level clarification status tracker:
 * - Clarification round status
 * - Expected resolution date
 * - Overall outcome
 *
 * Data: type_details.clarification.status
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
import { Save, Loader2, Info, CheckCircle2, Clock, XCircle, HelpCircle } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderClarificationData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  /** TCW-T4 (C3): lets the stage shell render the real Unsaved/Saved badge. */
  onDirtyChange?: (dirty: boolean) => void;
}

const CLARIFICATION_STATUSES = [
  { value: "open", label: "Open", icon: Clock, color: "border-amber-300 text-amber-700 bg-amber-50" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "border-blue-300 text-blue-700 bg-blue-50" },
  { value: "resolved", label: "Resolved", icon: CheckCircle2, color: "border-emerald-300 text-emerald-700 bg-emerald-50" },
  { value: "needs_attention", label: "Needs Attention", icon: XCircle, color: "border-red-300 text-red-700 bg-red-50" },
  { value: "unknown", label: "Unknown", icon: HelpCircle, color: "border-slate-200 text-slate-500 bg-slate-50" },
] as const;

function normalizeRoundStatus(status: string) {
  return status === "escalated" ? "needs_attention" : status;
}

export default function ClarificationStatusTab({ ws, reload, onDirtyChange }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.clarification?.status ?? {};

  const [roundStatus, setRoundStatus] = useState(normalizeRoundStatus(saved.round_status || "open"));
  const [expectedResolution, setExpectedResolution] = useState(saved.expected_resolution_date || "");
  const [clientContact, setClientContact] = useState(saved.client_contact || "");
  const [roundNumber, setRoundNumber] = useState(saved.round_number || "1");
  const [statusNotes, setStatusNotes] = useState(saved.status_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => { setDirty(true); onDirtyChange?.(true); };

  const statusMeta = CLARIFICATION_STATUSES.find(s => s.value === roundStatus) || CLARIFICATION_STATUSES[4];
  const StatusIcon = statusMeta.icon;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        round_status: roundStatus,
        expected_resolution_date: expectedResolution,
        client_contact: clientContact,
        round_number: roundNumber,
        status_notes: statusNotes,
      };
      const res = await updateTenderClarificationData(tenderId, "status", payload, `Clarification status: ${roundStatus}`, wsRevisionToken(ws));
      // P2a threading + honest outcome; stale keeps the entry on screen.
      if (!reportSaveOutcome(res, "Clarification status saved.")) return;
      setDirty(false);
      onDirtyChange?.(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [roundStatus, expectedResolution, clientContact, roundNumber, statusNotes, tenderId, reload, ws, onDirtyChange]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Track the overall status of the clarification round. Record expected resolution dates and attention status.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Clarification</span>
        <Badge variant="outline" className={`text-[8px] ${statusMeta.color}`}>
          Round {roundNumber} · {statusMeta.label}
        </Badge>
        {expectedResolution && (
          <span className="text-[10px] text-muted-foreground">Resolution: {expectedResolution}</span>
        )}
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Clarification Round Status</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-6 mb-6">
            <div className="flex flex-col items-center p-4 rounded-lg border-2 border-[#075eea]/20 bg-[#075eea]/10 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#075eea] mb-2">Current Status</p>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border-2 ${statusMeta.color}`}>
                <StatusIcon className="w-5 h-5" />
              </div>
              <Select value={roundStatus} onValueChange={v => { setRoundStatus(v); mark(); }}>
                <SelectTrigger className="h-7 text-[10px] w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLARIFICATION_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Clarification Round #</label>
              <Input className="h-8 text-xs mt-1" value={roundNumber} onChange={e => { setRoundNumber(e.target.value); mark(); }} placeholder="1" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Expected Resolution Date</label>
              <Input type="date" className="h-8 text-xs mt-1" value={expectedResolution} onChange={e => { setExpectedResolution(e.target.value); mark(); }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Client Contact</label>
              <Input className="h-8 text-xs mt-1" value={clientContact} onChange={e => { setClientContact(e.target.value); mark(); }} placeholder="Primary contact" />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[10px] font-semibold text-muted-foreground">Status Notes</label>
            <Textarea className="text-xs mt-1 min-h-[80px]" value={statusNotes} onChange={e => { setStatusNotes(e.target.value); mark(); }} placeholder="General notes about this clarification round, attention reasons, client feedback..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
