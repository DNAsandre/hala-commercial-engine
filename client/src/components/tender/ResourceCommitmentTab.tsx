/**
 * ResourceCommitmentTab — Manual Resource Commitment Assessment
 *
 * Sections:
 *   1. Resource Commitment Assessment (10 rows)
 *   2. Effort Estimate (4 selectors)
 *   3. Required Internal Actions (repeatable)
 *   4. Resource Recommendation
 *   5. Save Button
 *
 * Data: ws.tender.bidNoBidData.resource_commitment
 * Save: updateTenderBidNoBidData → merges resource_commitment only
 *
 * Rules:
 * - No fake data. No AI. No hardcoded examples.
 * - "Available" only appears if manually selected by user. Default = "Not Assessed".
 * - No stage/CRM/PDF Studio mutation.
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  Users, Gauge, ListTodo, ArrowRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type ResourceStatus = "Available" | "Constrained" | "Required" | "Not Required" | "Not Assessed";
type EffortLevel = "Low" | "Medium" | "High" | "Major" | "Not Assessed";
type DeadlinePressure = "Low" | "Medium" | "High" | "Critical" | "Not Assessed";
type CanSubmitOnTime = "Yes" | "No" | "At Risk" | "Not Assessed";
type ProposalComplexity = "Low" | "Medium" | "High" | "Not Assessed";
type ActionStatus = "Open" | "In Progress" | "Done" | "Blocked" | "Deferred";
type ResourceRecommendation = "Resources acceptable to proceed" | "Proceed with constraints" | "Hold pending resource confirmation" | "Escalate resource conflict" | "Do not proceed" | "Not Decided";

interface ResourceRow {
  resource: string;
  status: ResourceStatus;
  owner: string;
  evidence: string;
  due_date: string;
}

interface EffortData {
  estimated_effort: EffortLevel;
  deadline_pressure: DeadlinePressure;
  can_submit_on_time: CanSubmitOnTime;
  proposal_complexity: ProposalComplexity;
}

interface ActionRow {
  action: string;
  owner: string;
  due_date: string;
  status: ActionStatus;
  notes: string;
}

interface ResourceRecommendationData {
  recommendation: ResourceRecommendation;
  reason: string;
}

interface ResourceCommitmentData {
  rows: ResourceRow[];
  effort: EffortData;
  actions: ActionRow[];
  recommendation: ResourceRecommendationData;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const RESOURCE_STATUS_OPTIONS: ResourceStatus[] = ["Available", "Constrained", "Required", "Not Required", "Not Assessed"];
const EFFORT_OPTIONS: EffortLevel[] = ["Low", "Medium", "High", "Major", "Not Assessed"];
const DEADLINE_OPTIONS: DeadlinePressure[] = ["Low", "Medium", "High", "Critical", "Not Assessed"];
const CAN_SUBMIT_OPTIONS: CanSubmitOnTime[] = ["Yes", "No", "At Risk", "Not Assessed"];
const COMPLEXITY_OPTIONS: ProposalComplexity[] = ["Low", "Medium", "High", "Not Assessed"];
const ACTION_STATUS_OPTIONS: ActionStatus[] = ["Open", "In Progress", "Done", "Blocked", "Deferred"];
const RESOURCE_REC_OPTIONS: ResourceRecommendation[] = [
  "Resources acceptable to proceed", "Proceed with constraints",
  "Hold pending resource confirmation", "Escalate resource conflict",
  "Do not proceed", "Not Decided",
];

const RESOURCE_LABELS = [
  "Bid Manager Capacity", "Pricing / Finance Support", "Operations Input",
  "Technical Input", "Legal / Contract Review", "Compliance Review",
  "HSSE Review", "PDF Studio / Proposal Production",
  "Executive Approval Availability", "Document Support Availability",
];

// ═══════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════

function emptyResourceRows(): ResourceRow[] {
  return RESOURCE_LABELS.map(r => ({ resource: r, status: "Not Assessed" as ResourceStatus, owner: "", evidence: "", due_date: "" }));
}

function emptyEffort(): EffortData {
  return { estimated_effort: "Not Assessed", deadline_pressure: "Not Assessed", can_submit_on_time: "Not Assessed", proposal_complexity: "Not Assessed" };
}

function emptyAction(): ActionRow {
  return { action: "", owner: "", due_date: "", status: "Open", notes: "" };
}

function emptyResourceRecommendation(): ResourceRecommendationData {
  return { recommendation: "Not Decided", reason: "" };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusBtnClass(selected: boolean, status: string): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  if (status === "Available" || status === "Yes" || status === "Done" || status === "Low") return "bg-emerald-100 border-emerald-300 text-emerald-700 font-medium";
  if (status === "Constrained" || status === "At Risk" || status === "Medium" || status === "In Progress") return "bg-amber-100 border-amber-300 text-amber-700 font-medium";
  if (status === "Required" || status === "High" || status === "Blocked" || status === "No") return "bg-red-100 border-red-300 text-red-700 font-medium";
  if (status === "Critical" || status === "Major") return "bg-red-200 border-red-400 text-red-800 font-semibold";
  if (status === "Not Required" || status === "Deferred") return "bg-slate-100 border-slate-300 text-slate-500 font-medium";
  return "bg-slate-100 border-slate-300 text-slate-600 font-medium";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
}

export default function ResourceCommitmentTab({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.bidNoBidData as any;
  const rc = existing?.resource_commitment;

  const [rows, setRows] = useState<ResourceRow[]>(() => {
    if (Array.isArray(rc?.rows) && rc.rows.length === RESOURCE_LABELS.length) return rc.rows;
    return emptyResourceRows();
  });

  const [effort, setEffort] = useState<EffortData>(() => {
    if (rc?.effort && typeof rc.effort === "object") return { ...emptyEffort(), ...rc.effort };
    return emptyEffort();
  });

  const [actions, setActions] = useState<ActionRow[]>(() => {
    return Array.isArray(rc?.actions) ? rc.actions : [];
  });

  const [recommendation, setRecommendation] = useState<ResourceRecommendationData>(() => {
    if (rc?.recommendation && typeof rc.recommendation === "object") return { ...emptyResourceRecommendation(), ...rc.recommendation };
    return emptyResourceRecommendation();
  });

  const [saving, setSaving] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ resources: true, effort: true, actions: true, recommendation: true });
  const toggle = (k: string) => setSectionsOpen(p => ({ ...p, [k]: !p[k] }));

  const updateRow = (i: number, f: keyof ResourceRow, v: any) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const addAction = () => setActions(p => [...p, emptyAction()]);
  const removeAction = (i: number) => setActions(p => p.filter((_, idx) => idx !== i));
  const updateAction = (i: number, f: keyof ActionRow, v: any) => setActions(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = {
        ...(existing || {}),
        resource_commitment: { rows, effort, actions, recommendation },
      };
      const result = await updateTenderBidNoBidData(tenderId, patch, "Resource Commitment tab saved");
      if (result.success) toast.success("Resource Commitment saved");
      else toast.error("Save failed", { description: result.error });
    } finally {
      setSaving(false);
    }
  }, [tenderId, rows, effort, actions, recommendation, existing]);

  const availableCount = rows.filter(r => r.status === "Available").length;
  const constrainedCount = rows.filter(r => r.status === "Constrained").length;

  return (
    <div className="space-y-4">
      {/* ── Resource Assessment ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("resources")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.resources ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Resource Commitment Assessment</span>
            <div className="ml-auto flex items-center gap-1.5">
              {availableCount > 0 && <Badge variant="outline" className="text-[8px] border-emerald-300 bg-emerald-50 text-emerald-700">{availableCount} available</Badge>}
              {constrainedCount > 0 && <Badge variant="outline" className="text-[8px] border-amber-300 bg-amber-50 text-amber-700">{constrainedCount} constrained</Badge>}
            </div>
          </div>
        </CardHeader>
        {sectionsOpen.resources && (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[200px]">Resource</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[280px]">Status</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[120px]">Owner</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Evidence / Notes</th>
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[120px]">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{row.resource}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {RESOURCE_STATUS_OPTIONS.map(opt => (
                            <button key={opt} type="button" className={`px-2 py-1 rounded border text-[10px] transition-colors ${statusBtnClass(row.status === opt, opt)}`} onClick={() => updateRow(idx, "status", opt)}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" className="w-full border border-border rounded px-2 py-1 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateRow(idx, "owner", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" className="w-full border border-border rounded px-2 py-1 text-xs bg-card" placeholder="Notes..." value={row.evidence} onChange={e => updateRow(idx, "evidence", e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" className="w-full border border-border rounded px-2 py-1 text-xs bg-card" value={row.due_date} onChange={e => updateRow(idx, "due_date", e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Effort Estimate ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("effort")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.effort ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Gauge className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Effort Estimate</span>
          </div>
        </CardHeader>
        {sectionsOpen.effort && (
          <CardContent className="p-4 space-y-4">
            {([
              { label: "Estimated Bid Effort", key: "estimated_effort" as keyof EffortData, options: EFFORT_OPTIONS },
              { label: "Deadline Pressure", key: "deadline_pressure" as keyof EffortData, options: DEADLINE_OPTIONS },
              { label: "Can Submit On Time", key: "can_submit_on_time" as keyof EffortData, options: CAN_SUBMIT_OPTIONS },
              { label: "Proposal Complexity", key: "proposal_complexity" as keyof EffortData, options: COMPLEXITY_OPTIONS },
            ] as const).map(({ label, key, options }) => (
              <div key={key}>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
                <div className="flex flex-wrap gap-1.5">
                  {options.map(opt => (
                    <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(effort[key] === opt, opt)}`} onClick={() => setEffort(p => ({ ...p, [key]: opt }))}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ── Required Internal Actions ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("actions")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.actions ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ListTodo className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">Required Internal Actions</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{actions.length}</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.actions && (
          <CardContent className="p-4 space-y-3">
            {actions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No resource actions added yet.</p>
            )}
            {actions.map((row, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeAction(idx)}>
                  <X className="w-3.5 h-3.5" />
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Action</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="What needs to happen?" value={row.action} onChange={e => updateAction(idx, "action", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Owner..." value={row.owner} onChange={e => updateAction(idx, "owner", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Due Date</label>
                    <input type="date" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.due_date} onChange={e => updateAction(idx, "due_date", e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label>
                    <div className="flex flex-wrap gap-1">
                      {ACTION_STATUS_OPTIONS.map(opt => (
                        <button key={opt} type="button" className={`px-2 py-1 rounded border text-[9px] transition-colors ${statusBtnClass(row.status === opt, opt)}`} onClick={() => updateAction(idx, "status", opt)}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Notes</label>
                    <input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" placeholder="Notes..." value={row.notes} onChange={e => updateAction(idx, "notes", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addAction}>
              <Plus className="w-3 h-3" /> Add Resource Action
            </Button>
          </CardContent>
        )}
      </Card>

      {/* ── Resource Recommendation ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("recommendation")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.recommendation ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">Resource Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">
              {recommendation.recommendation !== "Not Decided" ? "Set" : "Not Decided"}
            </Badge>
          </div>
        </CardHeader>
        {sectionsOpen.recommendation && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Recommendation</label>
              <div className="flex flex-wrap gap-1.5">
                {RESOURCE_REC_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(recommendation.recommendation === opt, opt === "Resources acceptable to proceed" ? "Available" : opt === "Proceed with constraints" ? "Constrained" : opt === "Do not proceed" ? "No" : "Not Assessed")}`} onClick={() => setRecommendation(p => ({ ...p, recommendation: opt }))}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Reason / Notes</label>
              <textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter resource recommendation rationale..." value={recommendation.reason} onChange={e => setRecommendation(p => ({ ...p, reason: e.target.value }))} />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Resource Commitment
        </Button>
      </div>
    </div>
  );
}
