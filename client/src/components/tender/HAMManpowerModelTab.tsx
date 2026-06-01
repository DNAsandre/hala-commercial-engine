/**
 * HAMManpowerModelTab — HAM Manpower Model
 * Data key: solution_design.ham
 * Save: merges only solution_design_data.ham
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import { Loader2, Save, ChevronDown, ChevronRight, Plus, X, Users, ShieldCheck, Clock, Zap, ArrowRight, Info } from "lucide-react";

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

interface StaffRow { role: string; department: string; quantity: string; shift_coverage: string; dedicated_shared: string; required_from: string; owner: string; status: ResourceStatus; notes: string; }
interface MobRow { activity: string; role_needed: string; owner: string; due_date: string; status: MobStatus; notes: string; }
interface GovernanceData { primary_account_owner: string; operations_owner: string; transport_owner: string; warehouse_owner: string; quality_owner: string; hsse_owner: string; it_owner: string; escalation_owner: string; customer_spoc_required: YesNoNA; }
interface ShiftData { operating_days: string; operating_hours: string; shift_model: ShiftModel; emergency_support: string; }
interface HAMData { staffing: StaffRow[]; governance: GovernanceData; shift: ShiftData; mobilization: MobRow[]; recommendation: { readiness: ReadinessStatus; notes: string }; }

function emptyStaff(): StaffRow { return { role: "", department: "", quantity: "", shift_coverage: "", dedicated_shared: "", required_from: "", owner: "", status: "Not Assessed", notes: "" }; }
function emptyMob(): MobRow { return { activity: "", role_needed: "", owner: "", due_date: "", status: "Not Assessed", notes: "" }; }
function emptyGov(): GovernanceData { return { primary_account_owner: "", operations_owner: "", transport_owner: "", warehouse_owner: "", quality_owner: "", hsse_owner: "", it_owner: "", escalation_owner: "", customer_spoc_required: "Not Assessed" }; }
function emptyShift(): ShiftData { return { operating_days: "", operating_hours: "", shift_model: "Not Assessed", emergency_support: "Not Assessed" }; }

function btnCls(sel: boolean): string { return sel ? "bg-blue-100 border-blue-300 text-blue-700 font-medium" : "bg-card border-border text-muted-foreground hover:bg-muted/30"; }

interface Props { ws: TenderWorkspace; }

export default function HAMManpowerModelTab({ ws }: Props) {
  const t = ws.tender; const tenderId = t.id;
  const existing = t.solutionDesignData as any; const ham = existing?.ham;

  const [staffing, setStaffing] = useState<StaffRow[]>(() => Array.isArray(ham?.staffing) ? ham.staffing : []);
  const [governance, setGovernance] = useState<GovernanceData>(() => ham?.governance ? { ...emptyGov(), ...ham.governance } : emptyGov());
  const [shift, setShift] = useState<ShiftData>(() => ham?.shift ? { ...emptyShift(), ...ham.shift } : emptyShift());
  const [mobilization, setMobilization] = useState<MobRow[]>(() => Array.isArray(ham?.mobilization) ? ham.mobilization : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => ham?.recommendation ? { readiness: "Not Assessed", notes: "", ...ham.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ staffing: true, governance: true, shift: true, mobilization: true, rec: true, future: false });
  const tog = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  const addStaff = () => setStaffing(p => [...p, emptyStaff()]);
  const rmStaff = (i: number) => setStaffing(p => p.filter((_, x) => x !== i));
  const upStaff = (i: number, f: keyof StaffRow, v: any) => setStaffing(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));
  const addMob = () => setMobilization(p => [...p, emptyMob()]);
  const rmMob = (i: number) => setMobilization(p => p.filter((_, x) => x !== i));
  const upMob = (i: number, f: keyof MobRow, v: any) => setMobilization(p => p.map((r, x) => x === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), ham: { staffing, governance, shift, mobilization, recommendation } };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "HAM Manpower Model saved");
      if (result.success) toast.success("HAM Manpower Model saved"); else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, staffing, governance, shift, mobilization, recommendation, existing]);

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
      {/* Configuration-aware advisory banner */}
      {(() => {
        const cfg = existing?.configuration;
        const sel = cfg?.selected_modules || "";
        const hamIncluded = sel.toUpperCase().includes("HAM");
        const notSelected = !sel || sel === "Not Selected";
        if (notSelected) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600"><Info className="w-3.5 h-3.5 shrink-0" /> Solution configuration has not been selected yet.</div>;
        if (hamIncluded) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700"><Info className="w-3.5 h-3.5 shrink-0" /> HAM is required by the selected solution configuration.</div>;
        return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700"><Info className="w-3.5 h-3.5 shrink-0" /> HAM is not selected in the current solution configuration. Capture only if operational scope is still relevant.</div>;
      })()}
      {/* Staffing */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("staffing")}>
          <div className="flex items-center gap-2">
            {open.staffing ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Staffing Model</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{staffing.length} roles</Badge>
          </div>
        </CardHeader>
        {open.staffing && (
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
        )}
      </Card>

      {/* Governance */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("governance")}>
          <div className="flex items-center gap-2">
            {open.governance ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-semibold">Governance / Ownership</span>
          </div>
        </CardHeader>
        {open.governance && (
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
        )}
      </Card>

      {/* Shift & Coverage */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("shift")}>
          <div className="flex items-center gap-2">
            {open.shift ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Shift & Coverage</span>
          </div>
        </CardHeader>
        {open.shift && (
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
        )}
      </Card>

      {/* Mobilization */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("mobilization")}>
          <div className="flex items-center gap-2">
            {open.mobilization ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Zap className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">Mobilization Manpower Plan</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{mobilization.length}</Badge>
          </div>
        </CardHeader>
        {open.mobilization && (
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
        )}
      </Card>

      {/* HAM Recommendation */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("rec")}>
          <div className="flex items-center gap-2">
            {open.rec ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">HAM Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{recommendation.readiness !== "Not Assessed" ? recommendation.readiness : "Not Assessed"}</Badge>
          </div>
        </CardHeader>
        {open.rec && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Manpower Readiness</label>
              <div className="flex flex-wrap gap-1.5">{READINESS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${btnCls(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Manpower Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter manpower notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
          </CardContent>
        )}
      </Card>

      {/* Future Output Use */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => tog("future")}>
          <div className="flex items-center gap-2">
            {open.future ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-muted-foreground">Future Output Use</span>
          </div>
        </CardHeader>
        {open.future && (
          <CardContent className="p-3"><div className="space-y-1.5">{FUTURE_WIRING.map(fw => (<div key={fw.source} className="flex items-center gap-2 text-[10px]"><Badge variant="outline" className="text-[8px] border-violet-200 bg-violet-50 text-violet-600">{fw.source}</Badge><ArrowRight className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-muted-foreground">{fw.output}</span></div>))}<p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to PDF Studio.</p></div></CardContent>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save HAM Manpower Model
        </Button>
      </div>
    </div>
  );
}
