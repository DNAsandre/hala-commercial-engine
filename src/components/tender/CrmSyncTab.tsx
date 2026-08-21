/**
 * CrmSyncTab — Tab 3 of Submitted Stage
 *
 * Records CRM pipeline stage update after tender submission.
 * Shows a visual strip of CRM pipeline stages with before/after markers.
 *
 * All data persisted to type_details.submission.crm_sync.
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
import { Save, Loader2, Radio, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSubmissionData } from "@/lib/supabase-tender-actions";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";

interface Props {
  ws: TenderWorkspace;
  reload: () => void;
  /** TCW-T4 (C3): lets the stage shell render the real Unsaved/Saved badge. */
  onDirtyChange?: (dirty: boolean) => void;
}

const CRM_STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "contract_negotiation", label: "Contract Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "contract_signed", label: "Contract Signed" },
  { value: "operational_handover", label: "Operational Handover" },
  { value: "closed_lost", label: "Closed Lost" },
  { value: "discontinued", label: "Discontinued" },
] as const;

const SYNC_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "synced", label: "Synced" },
  { value: "failed", label: "Failed" },
  { value: "manual", label: "Manual Update" },
] as const;

export default function CrmSyncTab({ ws, reload, onDirtyChange }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.submission?.crm_sync ?? {};

  const currentCrmStage = (ws.tender as any).crmPipelineStage || "prospecting";

  const [stageBefore, setStageBefore] = useState(saved.crm_stage_before || currentCrmStage);
  const [stageAfter, setStageAfter] = useState(saved.crm_stage_after || "proposal_sent");
  const [syncedAt, setSyncedAt] = useState(saved.synced_at || "");
  const [syncedBy, setSyncedBy] = useState(saved.synced_by || "");
  const [syncStatus, setSyncStatus] = useState(saved.sync_status || "pending");
  const [syncNotes, setSyncNotes] = useState(saved.sync_notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => { setDirty(true); onDirtyChange?.(true); };
  const hasSavedData = !!(saved.crm_stage_after || saved.synced_at);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        crm_stage_before: stageBefore,
        crm_stage_after: stageAfter,
        synced_at: syncedAt,
        synced_by: syncedBy,
        sync_status: syncStatus,
        sync_notes: syncNotes,
      };
      // P2a threading + honest outcome; stale keeps the entry on screen.
      const res = await updateTenderSubmissionData(tenderId, "crm_sync", payload, `CRM sync: ${stageBefore} → ${stageAfter}`, wsRevisionToken(ws));
      if (!reportSaveOutcome(res, "CRM sync record saved.")) return;
      setDirty(false);
      onDirtyChange?.(false);
      reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [stageBefore, stageAfter, syncedAt, syncedBy, syncStatus, syncNotes, tenderId, reload, ws, onDirtyChange]);

  const stageLabel = (val: string) => CRM_STAGES.find(s => s.value === val)?.label || val;
  const syncStatusColor = (s: string) => {
    if (s === "synced") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "failed") return "border-red-300 text-red-700 bg-red-50";
    if (s === "manual") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-amber-300 text-amber-700 bg-amber-50";
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Record the CRM pipeline stage update after tender submission. This tracks the handover from the tender process to the sales pipeline.</span>
      </div>

      {/* Save Strip */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">CRM Sync</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${hasSavedData ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`text-[10px] ${hasSavedData ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>
            {hasSavedData ? "Recorded" : "Not Yet Recorded"}
          </span>
        </div>
        {hasSavedData && (
          <Badge variant="outline" className={`text-[8px] ${syncStatusColor(saved.sync_status || "pending")}`}>
            {SYNC_STATUSES.find(s => s.value === (saved.sync_status || "pending"))?.label}
          </Badge>
        )}
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* CRM Pipeline Visual */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">CRM Pipeline Stage Transition</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-0 overflow-x-auto pb-2">
            {CRM_STAGES.map((stage, i) => {
              const isBefore = stage.value === stageBefore;
              const isAfter = stage.value === stageAfter;
              const beforeIdx = CRM_STAGES.findIndex(s => s.value === stageBefore);
              const afterIdx = CRM_STAGES.findIndex(s => s.value === stageAfter);
              const isPast = i < beforeIdx;
              const isInTransition = i > beforeIdx && i < afterIdx;

              return (
                <div key={stage.value} className="flex items-center shrink-0">
                  <div className={`
                    relative flex flex-col items-center px-2 py-1.5 rounded-lg transition-all
                    ${isBefore
                      ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                      : isAfter
                        ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300"
                        : isPast
                          ? "bg-slate-100 text-slate-500"
                          : isInTransition
                            ? "bg-[#075eea]/10 text-[#0b73ff]"
                            : "text-muted-foreground/40"
                    }
                  `}>
                    <div className={`
                      w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold mb-0.5
                      ${isBefore ? "bg-amber-300 text-amber-900"
                        : isAfter ? "bg-emerald-300 text-emerald-900"
                        : isPast ? "bg-slate-200 text-slate-500"
                        : "bg-muted/60 text-muted-foreground/60"}
                    `}>
                      {isAfter ? <CheckCircle2 className="w-2.5 h-2.5" /> : i + 1}
                    </div>
                    <span className={`text-[8px] font-medium whitespace-nowrap ${isBefore || isAfter ? "font-semibold" : ""}`}>
                      {stage.label}
                    </span>
                    {isBefore && <span className="text-[7px] font-bold text-amber-600 mt-0.5">BEFORE</span>}
                    {isAfter && <span className="text-[7px] font-bold text-emerald-600 mt-0.5">AFTER</span>}
                  </div>
                  {i < CRM_STAGES.length - 1 && (
                    <div className={`h-px w-2 shrink-0 ${isInTransition || isAfter ? "bg-[#8bb9ff]" : isPast ? "bg-slate-300" : "bg-muted-foreground/15"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Transition Summary */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-md border border-[#075eea]/15 bg-[#075eea]/10">
            <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-700 bg-amber-50">{stageLabel(stageBefore)}</Badge>
            <ArrowRight className="w-3.5 h-3.5 text-[#0b73ff]" />
            <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-700 bg-emerald-50">{stageLabel(stageAfter)}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* CRM Sync Form */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Sync Details</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">CRM Stage Before</label>
              <Select value={stageBefore} onValueChange={v => { setStageBefore(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_STAGES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">CRM Stage After</label>
              <Select value={stageAfter} onValueChange={v => { setStageAfter(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_STAGES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Sync Status</label>
              <Select value={syncStatus} onValueChange={v => { setSyncStatus(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYNC_STATUSES.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Synced At</label>
              <Input type="datetime-local" className="h-8 text-xs mt-1" value={syncedAt} onChange={e => { setSyncedAt(e.target.value); mark(); }} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">Synced By</label>
              <Input className="h-8 text-xs mt-1" value={syncedBy} onChange={e => { setSyncedBy(e.target.value); mark(); }} placeholder="Person who updated CRM" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-[10px] font-semibold text-muted-foreground">Sync Notes</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={syncNotes} onChange={e => { setSyncNotes(e.target.value); mark(); }} placeholder="Notes about the CRM sync..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
