/**
 * HAMManpowerModelTab — HAM Manpower Model
 * Data key: solution_design.ham
 * Save: merges only solution_design_data.ham
 *
 * 6 Sections (section-tab navigation, matching Qualification pattern):
 *   1. Staffing Model
 *   2. Governance / Ownership
 *   3. Shift & Coverage
 *   4. Mobilization Manpower Plan
 *   5. HAM Recommendation
 *   6. Output Use
 */
import { useState, useCallback, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { runTenderTabSave, tenderRevisionTokenOf } from "./IdentifiedStageShared";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, Plus, X, Users, ShieldCheck, Clock, Zap, ArrowRight, Info, FolderOpen, BarChart3, PanelRightOpen } from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

type ResourceStatus = "Required" | "Available" | "Constrained" | "Not Required" | "Not Assessed";
type MobStatus = "Open" | "In Progress" | "Done" | "Blocked" | "Not Assessed";
type ShiftModel = "Single Shift" | "Double Shift" | "24/7" | "On-Demand" | "Not Assessed";
type YesNoNA = "Yes" | "No" | "Not Assessed";
type ReadinessStatus = "Ready" | "Partially Ready" | "Constrained" | "Needs Clarification" | "Not Assessed";

const ROLE_OPTIONS = ["Project Manager","Operations Manager","Warehouse Manager","Transport Manager","Supervisor","Coordinator","Warehouse Operators","Drivers","Control Tower Agent","Customer Service","Quality / Compliance","HSSE","IT / Systems","Finance Support","Legal Support","Other"];
const STATUS_OPTIONS: ResourceStatus[] = ["Required","Available","Constrained","Not Required","Not Assessed"];
const MOB_STATUS_OPTIONS: MobStatus[] = ["Open","In Progress","Done","Blocked","Not Assessed"];
const SHIFT_OPTIONS: ShiftModel[] = ["Single Shift","Double Shift","24/7","On-Demand","Not Assessed"];
const YES_NO: YesNoNA[] = ["Yes","No","Not Assessed"];
const READINESS: ReadinessStatus[] = ["Ready","Partially Ready","Constrained","Needs Clarification","Not Assessed"];

const FUTURE_WIRING = [
  { source: "Staffing Model", output: "Team & Roles / RACI / Human Resources" },
  { source: "Governance", output: "Governance Model / Escalation Matrix" },
  { source: "Mobilization", output: "Mobilization Plan / annexure.a.config" },
];

// ── Section tabs ─────────────────────────────────────────────────────
type HAMSectionKey = "staffing" | "governance" | "shift" | "mobilization" | "recommendation" | "wiring";

const HAM_SECTION_TABS: { key: HAMSectionKey; label: string; icon: ReactNode }[] = [
  { key: "staffing", label: "Staffing Model", icon: <Users className="w-3.5 h-3.5" /> },
  { key: "governance", label: "Governance", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { key: "shift", label: "Shift & Coverage", icon: <Clock className="w-3.5 h-3.5" /> },
  { key: "mobilization", label: "Mobilization", icon: <Zap className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "HAM Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <Info className="w-3.5 h-3.5" /> },
];

interface StaffRow { role: string; department: string; quantity: string; shift_coverage: string; dedicated_shared: string; required_from: string; owner: string; status: ResourceStatus; notes: string; }
interface MobRow { activity: string; role_needed: string; owner: string; due_date: string; status: MobStatus; notes: string; }
interface GovernanceData { primary_account_owner: string; operations_owner: string; transport_owner: string; warehouse_owner: string; quality_owner: string; hsse_owner: string; it_owner: string; escalation_owner: string; customer_spoc_required: YesNoNA; }
interface ShiftData { operating_days: string; operating_hours: string; shift_model: ShiftModel; emergency_support: string; }

function emptyStaff(): StaffRow { return { role: "", department: "", quantity: "", shift_coverage: "", dedicated_shared: "", required_from: "", owner: "", status: "Not Assessed", notes: "" }; }
function emptyMob(): MobRow { return { activity: "", role_needed: "", owner: "", due_date: "", status: "Not Assessed", notes: "" }; }
function emptyGov(): GovernanceData { return { primary_account_owner: "", operations_owner: "", transport_owner: "", warehouse_owner: "", quality_owner: "", hsse_owner: "", it_owner: "", escalation_owner: "", customer_spoc_required: "Not Assessed" }; }
function emptyShift(): ShiftData { return { operating_days: "", operating_hours: "", shift_model: "Not Assessed", emergency_support: "Not Assessed" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }

/**
 * TCW-T3 (P2b) — this tab's patch carries ONLY its own solution_design_data
 * key (ham). The write layer patch-merges, so sibling tabs' keys are
 * preserved by the STORED facet — never re-sent from a page-load copy.
 * Exported pure for direct testing.
 */
export function buildHamPatch(
  staffing: StaffRow[],
  governance: GovernanceData,
  shift: ShiftData,
  mobilization: MobRow[],
  recommendation: { readiness: ReadinessStatus; notes: string },
): Record<string, any> {
  return { ham: { staffing, governance, shift, mobilization, recommendation } };
}

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  /** Fires ONLY after a confirmed save (the workspace shell passes reload). */
  onSaved?: () => void;
}

export default function HAMManpowerModelTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any; const ham = existing?.ham;

  const [staffing, setStaffing] = useState<StaffRow[]>(() => Array.isArray(ham?.staffing) ? ham.staffing : []);
  const [governance, setGovernance] = useState<GovernanceData>(() => ham?.governance ? { ...emptyGov(), ...ham.governance } : emptyGov());
  const [shift, setShift] = useState<ShiftData>(() => ham?.shift ? { ...emptyShift(), ...ham.shift } : emptyShift());
  const [mobilization, setMobilization] = useState<MobRow[]>(() => Array.isArray(ham?.mobilization) ? ham.mobilization : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => ham?.recommendation ? { readiness: "Not Assessed", notes: "", ...ham.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<HAMSectionKey>("staffing");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const addStaff = () => setStaffing(p => [...p, emptyStaff()]);
  const rmStaff = (i: number) => setStaffing(p => p.filter((_, x) => x !== i));
  const upStaff = (i: number, f: keyof StaffRow, v: any) => setStaffing(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  const addMob = () => setMobilization(p => [...p, emptyMob()]);
  const rmMob = (i: number) => setMobilization(p => p.filter((_, x) => x !== i));
  const upMob = (i: number, f: keyof MobRow, v: any) => setMobilization(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));

  const staleRetryArmed = useRef(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderSolutionDesignData(tenderId, buildHamPatch(staffing, governance, shift, mobilization, recommendation), {
            expectedRevision,
            reason: "HAM Manpower Model saved",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "HAM Manpower Model saved", failed: "Save failed" },
        onConfirmed: () => onSaved?.(),
        // Stale: local form state is untouched — the user's entry stays.
      });
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally { setSaving(false); }
  }, [tenderId, staffing, governance, shift, mobilization, recommendation, onSaved, ws]);

  const govFields: { key: keyof GovernanceData; label: string }[] = [
    { key: "primary_account_owner", label: "Primary Account Owner" },
    { key: "operations_owner", label: "Operations Owner" },
    { key: "transport_owner", label: "Transport Owner" },
    { key: "warehouse_owner", label: "Warehouse Owner" },
    { key: "quality_owner", label: "Quality / Compliance Owner" },
    { key: "hsse_owner", label: "HSSE Owner" },
    { key: "it_owner", label: "IT / Systems Owner" },
    { key: "escalation_owner", label: "Escalation Owner" },
  ];

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          {/* ── Dark Stage Menu Header ───────────────────────── */}
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">Solution Design Stage Menu</span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">Stage 4</Badge>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
            {onOpenDocuments && (
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenDocuments}>
                <FolderOpen className="w-3.5 h-3.5" />Open Documents
              </Button>
            )}
            {onOpenGlobalIntel && (
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white" onClick={onOpenGlobalIntel}>
                <BarChart3 className="w-3.5 h-3.5" />Global Intelligence
              </Button>
            )}
            <Button type="button" variant="outline" size="sm"
              className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${stageIntelOpen ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white" : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"}`}
              onClick={() => setStageIntelOpen(prev => !prev)}>
              <PanelRightOpen className="w-3.5 h-3.5" />{stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
            </Button>
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <StageIntelMetric label="Staffing" value={`${staffing.length} roles`} />
                <StageIntelMetric label="Shift Model" value={shift.shift_model} />
                <StageIntelMetric label="Mobilization" value={`${mobilization.length} activities`} />
                <StageIntelMetric label="Readiness" value={recommendation.readiness} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          {/* ── Section Tab Buttons ─────────────────────────── */}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {HAM_SECTION_TABS.map(section => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`min-h-16 min-w-[138px] rounded-t-lg border border-b-0 px-3 py-2 text-center text-[11px] font-medium leading-tight transition-colors ${
                  activeSection === section.key
                    ? "mb-[-2px] border-[#075eea] bg-[#075eea]/10 text-[#075eea] shadow-[0_-1px_0_rgba(7,94,234,.22)]"
                    : "border-slate-200 bg-slate-50/45 text-muted-foreground hover:border-slate-300 hover:bg-[#075eea]/10 hover:text-[#075eea]"
                }`}
              >
                <span className={`mb-1 flex justify-center ${activeSection === section.key ? "text-[#0b73ff]" : "text-slate-400"}`}>{section.icon}</span>
                <span className="block whitespace-normal text-center">{section.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Configuration-aware advisory banner ── */}
      <div className="p-4 space-y-4">
      {(() => {
        const cfg = existing?.configuration;
        const sel = cfg?.selected_modules || "";
        const hamIncluded = sel.toUpperCase().includes("HAM");
        const notSelected = !sel || sel === "Not Selected";
        if (notSelected) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600"><Info className="w-3.5 h-3.5 shrink-0" /> Solution configuration has not been selected yet.</div>;
        if (hamIncluded) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700"><Info className="w-3.5 h-3.5 shrink-0" /> HAM is required by the selected solution configuration.</div>;
        return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700"><Info className="w-3.5 h-3.5 shrink-0" /> HAM is not selected in the current solution configuration. Capture only if operational scope is still relevant.</div>;
      })()}

      {/* ── 1. Staffing Model ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "staffing" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Staffing Model" icon={<Users className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${staffing.length} roles`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {staffing.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No staffing rows captured yet.</p>}
          {staffing.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmStaff(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Role</label><select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.role} onChange={e => upStaff(i, "role", e.target.value)}><option value="">Select...</option>{ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Department</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.department} onChange={e => upStaff(i, "department", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Quantity</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.quantity} onChange={e => upStaff(i, "quantity", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Shift / Coverage</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.shift_coverage} onChange={e => upStaff(i, "shift_coverage", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Dedicated / Shared</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.dedicated_shared} onChange={e => upStaff(i, "dedicated_shared", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Required From</label><input type="date" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.required_from} onChange={e => upStaff(i, "required_from", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upStaff(i, "owner", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{STATUS_OPTIONS.map(s => <button key={s} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upStaff(i, "status", s)}>{s}</button>)}</div></div>
              </div>
              <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Notes</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.notes} onChange={e => upStaff(i, "notes", e.target.value)} /></div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addStaff}><Plus className="w-3 h-3" /> Add Staffing Role</Button>
        </CardContent>
      </Card>

      {/* ── 2. Governance / Ownership ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "governance" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Governance / Ownership" icon={<ShieldCheck className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {govFields.map(gf => (
              <div key={gf.key}>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">{gf.label}</label>
                <input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder={`${gf.label}...`} value={(governance as any)[gf.key]} onChange={e => setGovernance(p => ({ ...p, [gf.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Customer SPOC Required</label>
            <div className="flex gap-1.5">{YES_NO.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(governance.customer_spoc_required === o)}`} onClick={() => setGovernance(p => ({ ...p, customer_spoc_required: o }))}>{o}</button>)}</div>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Shift & Coverage ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "shift" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Shift & Coverage" icon={<Clock className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Operating Days</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="e.g. Sun–Thu" value={shift.operating_days} onChange={e => setShift(p => ({ ...p, operating_days: e.target.value }))} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Operating Hours</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="e.g. 7AM–7PM" value={shift.operating_hours} onChange={e => setShift(p => ({ ...p, operating_hours: e.target.value }))} /></div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Shift Model</label>
            <div className="flex flex-wrap gap-1.5">{SHIFT_OPTIONS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(shift.shift_model === o)}`} onClick={() => setShift(p => ({ ...p, shift_model: o }))}>{o}</button>)}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Emergency / After-hours Support</label>
            <div className="flex gap-1.5">{["Required", "Not Required", "Not Assessed"].map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(shift.emergency_support === o)}`} onClick={() => setShift(p => ({ ...p, emergency_support: o }))}>{o}</button>)}</div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Mobilization Manpower Plan ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "mobilization" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Mobilization Manpower Plan" icon={<Zap className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${mobilization.length}`} />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {mobilization.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No mobilization activities captured yet.</p>}
          {mobilization.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
              <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500" onClick={() => rmMob(i)}><X className="w-3.5 h-3.5" /></button>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Activity</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.activity} onChange={e => upMob(i, "activity", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Role Needed</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.role_needed} onChange={e => upMob(i, "role_needed", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Owner</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.owner} onChange={e => upMob(i, "owner", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Due Date</label><input type="date" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.due_date} onChange={e => upMob(i, "due_date", e.target.value)} /></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Status</label><div className="flex flex-wrap gap-0.5">{MOB_STATUS_OPTIONS.map(s => <button key={s} type="button" className={`px-1.5 py-0.5 rounded border text-[8px] transition-colors ${btnCls(row.status === s)}`} onClick={() => upMob(i, "status", s)}>{s}</button>)}</div></div>
                <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Notes</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={row.notes} onChange={e => upMob(i, "notes", e.target.value)} /></div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addMob}><Plus className="w-3 h-3" /> Add Mobilization Activity</Button>
        </CardContent>
      </Card>

      {/* ── 5. HAM Recommendation ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="HAM Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.readiness} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Manpower Readiness</label>
            <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Manpower Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter manpower notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
        </CardContent>
      </Card>

      {/* ── 6. Output Use ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-3"><div className="space-y-1.5">{FUTURE_WIRING.map(fw => (<div key={fw.source} className="flex items-center gap-2 text-[10px]"><Badge variant="outline" className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]">{fw.source}</Badge><ArrowRight className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-muted-foreground">{fw.output}</span></div>))}<p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to discontinued document tooling.</p></div></CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save HAM Manpower Model
        </Button>
      </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon, badge }: { title: string; icon: ReactNode; badge?: string }) {
  return (
    <div className="flex items-center gap-2 w-full border-b border-border bg-muted/20 px-4 py-3 text-left group">
      <ChevronDown className="w-3 h-3 text-muted-foreground" />
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold group-hover:text-foreground transition-colors">{title}</span>
      {badge && <Badge variant="outline" className="text-[8px] ml-auto">{badge}</Badge>}
    </div>
  );
}

function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
