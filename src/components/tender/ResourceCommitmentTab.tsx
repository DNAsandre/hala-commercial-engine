/**
 * ResourceCommitmentTab — Manual Resource Commitment Assessment
 *
 * 4 Sub-Sections (sub-tabs):
 *   1. Resource Commitment Assessment (10 rows)
 *   2. Effort Estimate (4 selectors)
 *   3. Required Internal Actions (repeatable)
 *   4. Resource Recommendation
 *   + Save Button
 *
 * Data: ws.tender.bidNoBidData.resource_commitment
 * Save: updateTenderBidNoBidData → merges resource_commitment only
 *
 * Rules:
 * - No fake data. No AI. No hardcoded examples.
 * - "Available" only appears if manually selected by user. Default = "Not Assessed".
 * - No stage/CRM/document-output mutation.
 */

import { useState, useCallback, useMemo, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderBidNoBidData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, Plus, X,
  Users, Gauge, ListTodo, ArrowRight,
  FolderOpen, BarChart3, PanelRightOpen,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

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

type ResourceSectionKey = "resources" | "effort" | "actions" | "recommendation";

const RESOURCE_SECTION_TABS: { key: ResourceSectionKey; label: string; icon: ReactNode }[] = [
  { key: "resources", label: "Resource Assessment", icon: <Users className="w-3.5 h-3.5" /> },
  { key: "effort", label: "Effort Estimate", icon: <Gauge className="w-3.5 h-3.5" /> },
  { key: "actions", label: "Required Actions", icon: <ListTodo className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "Resource Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
];

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
  "HSSE Review", "Document Assembly / Proposal Production",
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
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  onSaved?: () => void;
}

export default function ResourceCommitmentTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
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
  const [activeSection, setActiveSection] = useState<ResourceSectionKey>("resources");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const updateRow = (i: number, f: keyof ResourceRow, v: any) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const addAction = () => setActions(p => [...p, emptyAction()]);
  const removeAction = (i: number) => setActions(p => p.filter((_, idx) => idx !== i));
  const updateAction = (i: number, f: keyof ActionRow, v: any) => setActions(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  // Stats for stage intel
  const stats = useMemo(() => {
    const availableCount = rows.filter(r => r.status === "Available").length;
    const requiredCount = rows.filter(r => r.status === "Required").length;
    const constrainedCount = rows.filter(r => r.status === "Constrained").length;
    const recSet = recommendation.recommendation !== "Not Decided";
    return { availableCount, requiredCount, constrainedCount, actionsCount: actions.length, recSet };
  }, [rows, actions, recommendation]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = {
        ...(existing || {}),
        resource_commitment: { rows, effort, actions, recommendation },
      };
      const result = await updateTenderBidNoBidData(tenderId, patch, "Resource Commitment tab saved");
      if (result.success) {
        toast.success("Resource Commitment saved.");
        onSaved?.();
      } else {
        toast.error("Save failed", { description: result.error });
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [tenderId, rows, effort, actions, recommendation, existing, onSaved]);

  return (
    <div className="space-y-4">
      {/* ── Stage Menu + Sub-Tab Bar ───────────────────────── */}
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Bid / No-Bid Stage Menu
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                Stage 3
              </Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {onOpenDocuments && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Open Documents
                </Button>
              )}
              {onOpenGlobalIntel && (
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                  <BarChart3 className="w-3.5 h-3.5" />
                  Global Intelligence
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                stageIntelOpen
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`} onClick={() => setStageIntelOpen(prev => !prev)}>
                <PanelRightOpen className="w-3.5 h-3.5" />
                {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
              </Button>
              {(existing?.resource_commitment?.rows?.length || existing?.resource_commitment?.effort || existing?.resource_commitment?.actions?.length || existing?.resource_commitment?.recommendation) && (
                <Badge variant="outline" className="h-7 rounded-md border-emerald-400 bg-emerald-500/15 px-2.5 text-[11px] font-medium text-emerald-200">Saved</Badge>
              )}
            </div>
          </div>

          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-5">
                <StageIntelMetric label="Available" value={`${stats.availableCount}/${rows.length}`} />
                <StageIntelMetric label="Constrained" value={String(stats.constrainedCount)} />
                <StageIntelMetric label="Required" value={String(stats.requiredCount)} />
                <StageIntelMetric label="Actions" value={String(stats.actionsCount)} />
                <StageIntelMetric label="Recommendation" value={stats.recSet ? recommendation.recommendation : "Not Decided"} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          <ResourceInnerTabs tabs={RESOURCE_SECTION_TABS} activeKey={activeSection} onSelect={setActiveSection} />
        </CardContent>
      </Card>

      {/* ── 1. Resource Commitment Assessment ──────────────── */}
      <div className="p-4 space-y-4">
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "resources" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <ResourceSectionHeader title="Resource Commitment Assessment" icon={<Users className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${stats.availableCount}/${rows.length} available`} />
        </CardHeader>
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
      </Card>

      {/* ── 2. Effort Estimate ─────────────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "effort" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <ResourceSectionHeader title="Effort Estimate" icon={<Gauge className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
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
      </Card>

      {/* ── 3. Required Internal Actions ───────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "actions" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <ResourceSectionHeader title="Required Internal Actions" icon={<ListTodo className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${actions.length} items`} />
        </CardHeader>
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
      </Card>

      {/* ── 4. Resource Recommendation ─────────────────────── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <ResourceSectionHeader title="Resource Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.recommendation !== "Not Decided" ? "Set" : "Not Decided"} />
        </CardHeader>
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
      </Card>

      {/* ── Save ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={handleSave} disabled={saving} size="sm" className="hala-save-button gap-1.5 h-9 text-xs px-5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Resource Commitment
        </Button>
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}

function ResourceSectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function ResourceInnerTabs<T extends string>({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: { key: T; label: string; icon: ReactNode }[];
  activeKey: T;
  onSelect: (key: T) => void;
}) {
  return (
    <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
      {tabs.map(section => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
            activeKey === section.key
              ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
              : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
          }`}
        >
          <span className={`mb-1 flex justify-center ${activeKey === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
          <span className="block whitespace-normal text-center">{section.label}</span>
        </button>
      ))}
    </div>
  );
}
