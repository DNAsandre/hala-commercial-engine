/**
 * HOPOperationsModelTab — HOP Operations Model
 *
 * Sections:
 *   1. Warehouse / Storage Design
 *   2. Transport / Distribution Design (repeatable lanes)
 *   3. Operational Flow (repeatable steps)
 *   4. HOP Recommendation
 *   5. Future Output Use (read-only)
 *   6. Save Button
 *
 * Data: ws.tender.solutionDesignData.hop
 * Save: updateTenderSolutionDesignData → merges hop only
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, ChevronRight, Plus, X,
  Warehouse, Truck, ArrowRight, ClipboardList, Info,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════

type YesNoNA = "Yes" | "No" | "Not Assessed";
type ReadinessStatus = "Ready" | "Partially Ready" | "Needs Clarification" | "Not Assessed";

const STORAGE_TYPES = ["Dry", "Ambient", "Temperature Controlled", "Chilled", "Frozen", "Dangerous Goods", "Bonded", "Open Yard", "Secure / Fenced Area", "Crossdock", "Not Assessed"] as const;
const CAPACITY_UNITS = ["SQM", "Pallets", "CBM", "Containers", "Other"] as const;
const FACILITY_OWNERSHIP = ["Hala Facility", "Customer Site", "Partner Facility", "To Be Confirmed", "Not Assessed"] as const;
const WAREHOUSE_ACTIVITIES = [
  "Receiving", "Inspection", "Quality Check", "Putaway", "Storage", "Picking", "Packing",
  "Kitting", "Labelling", "Dispatch", "Cycle Count", "Full Inventory Audit", "Damage Reporting",
  "Returns Processing", "Palletization", "Re-palletization", "Stretch Wrapping", "Destuffing", "Value Added Services",
] as const;

const TRANSPORT_MODELS = ["Dedicated Fleet", "Shared Fleet", "Per Trip", "Per Month", "Linehaul", "Shuttle", "Last Mile", "Express", "Ad-hoc", "Full Truck Load", "Multi-drop", "Not Assessed"] as const;
const VEHICLE_TYPES = ["Reefer", "Dry Truck", "1 Ton", "4 Ton", "5 Ton", "6 Ton", "10 Ton", "40 FT Trailer", "Flatbed", "Curtain Side", "Dyna", "Other"] as const;
const PROCESS_STEP_LABELS = ["Inbound", "Receiving", "Storage", "Order Processing", "Dispatch", "Transport", "POD", "Returns", "Reporting"] as const;
const READINESS_OPTIONS: ReadinessStatus[] = ["Ready", "Partially Ready", "Needs Clarification", "Not Assessed"];
const YES_NO_OPTIONS: YesNoNA[] = ["Yes", "No", "Not Assessed"];

const FUTURE_WIRING = [
  { source: "Warehouse Design", output: "Warehouse Methodology / annexure.a.config" },
  { source: "Transport Design", output: "Transport Methodology / Solution Description" },
  { source: "Operational Flow", output: "Scope of Services / scope.table" },
  { source: "HOP Recommendation", output: "Solution Description / Executive Summary" },
];

// ═══════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════

interface WarehouseData {
  storage_required: YesNoNA;
  storage_type: string;
  capacity_value: string;
  capacity_unit: string;
  facility: string;
  city: string;
  region: string;
  facility_ownership: string;
  activities: string[];
  evidence: string;
  notes: string;
}

interface TransportLane {
  origin: string; destination: string; frequency: string; estimated_trips: string;
  sla_requirement: string; special_handling: string; loading_responsibility: string;
  offloading_responsibility: string; permit_responsibility: string; notes: string;
}

interface TransportData {
  transport_required: YesNoNA;
  transport_model: string[];
  vehicle_types: string[];
  lanes: TransportLane[];
}

interface OperationalFlowStep {
  process_step: string; description: string; hala_responsibility: string;
  customer_responsibility: string; system_used: string; risk_dependency: string; notes: string;
}

interface HOPData {
  warehouse: WarehouseData;
  transport: TransportData;
  operational_flow: OperationalFlowStep[];
  recommendation: { readiness: ReadinessStatus; notes: string };
}

// ═══════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════

function emptyWarehouse(): WarehouseData {
  return { storage_required: "Not Assessed", storage_type: "Not Assessed", capacity_value: "", capacity_unit: "", facility: "", city: "", region: "", facility_ownership: "Not Assessed", activities: [], evidence: "", notes: "" };
}
function emptyTransport(): TransportData {
  return { transport_required: "Not Assessed", transport_model: [], vehicle_types: [], lanes: [] };
}
function emptyLane(): TransportLane {
  return { origin: "", destination: "", frequency: "", estimated_trips: "", sla_requirement: "", special_handling: "", loading_responsibility: "", offloading_responsibility: "", permit_responsibility: "", notes: "" };
}
function emptyFlowStep(): OperationalFlowStep {
  return { process_step: "", description: "", hala_responsibility: "", customer_responsibility: "", system_used: "", risk_dependency: "", notes: "" };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function statusBtnClass(selected: boolean): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30";
  return "bg-blue-100 border-blue-300 text-blue-700 font-medium";
}
function chipClass(selected: boolean): string {
  if (!selected) return "bg-card border-border text-muted-foreground hover:bg-muted/30 cursor-pointer";
  return "bg-indigo-100 border-indigo-300 text-indigo-700 font-medium cursor-pointer";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props { ws: TenderWorkspace; }

export default function HOPOperationsModelTab({ ws }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const hop = existing?.hop;

  const [warehouse, setWarehouse] = useState<WarehouseData>(() => hop?.warehouse ? { ...emptyWarehouse(), ...hop.warehouse } : emptyWarehouse());
  const [transport, setTransport] = useState<TransportData>(() => hop?.transport ? { ...emptyTransport(), ...hop.transport, lanes: Array.isArray(hop.transport?.lanes) ? hop.transport.lanes : [] } : emptyTransport());
  const [flow, setFlow] = useState<OperationalFlowStep[]>(() => Array.isArray(hop?.operational_flow) ? hop.operational_flow : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => hop?.recommendation ? { readiness: "Not Assessed", notes: "", ...hop.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({ warehouse: true, transport: true, flow: true, recommendation: true, future: false });
  const toggle = (k: string) => setSectionsOpen(p => ({ ...p, [k]: !p[k] }));

  const toggleChip = (arr: string[], val: string) => arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const addLane = () => setTransport(p => ({ ...p, lanes: [...p.lanes, emptyLane()] }));
  const removeLane = (i: number) => setTransport(p => ({ ...p, lanes: p.lanes.filter((_, idx) => idx !== i) }));
  const updateLane = (i: number, f: keyof TransportLane, v: string) => setTransport(p => ({ ...p, lanes: p.lanes.map((r, idx) => idx === i ? { ...r, [f]: v } : r) }));

  const addFlowStep = () => setFlow(p => [...p, emptyFlowStep()]);
  const removeFlowStep = (i: number) => setFlow(p => p.filter((_, idx) => idx !== i));
  const updateFlowStep = (i: number, f: keyof OperationalFlowStep, v: string) => setFlow(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Record<string, any> = { ...(existing || {}), hop: { warehouse, transport, operational_flow: flow, recommendation } };
      const result = await updateTenderSolutionDesignData(tenderId, patch, "HOP Operations Model saved");
      if (result.success) toast.success("HOP Operations Model saved");
      else toast.error("Save failed", { description: result.error });
    } finally { setSaving(false); }
  }, [tenderId, warehouse, transport, flow, recommendation, existing]);

  return (
    <div className="space-y-4">
      {/* Configuration-aware advisory banner */}
      {(() => {
        const cfg = existing?.configuration;
        const sel = cfg?.selected_modules || "";
        const hopIncluded = sel.toUpperCase().includes("HOP");
        const notSelected = !sel || sel === "Not Selected";
        if (notSelected) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600"><Info className="w-3.5 h-3.5 shrink-0" /> Solution configuration has not been selected yet.</div>;
        if (hopIncluded) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700"><Info className="w-3.5 h-3.5 shrink-0" /> HOP is required by the selected solution configuration.</div>;
        return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700"><Info className="w-3.5 h-3.5 shrink-0" /> HOP is not selected in the current solution configuration. Capture only if operational scope is still relevant.</div>;
      })()}
      {/* ── Warehouse / Storage Design ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("warehouse")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.warehouse ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Warehouse className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-semibold">Warehouse / Storage Design</span>
          </div>
        </CardHeader>
        {sectionsOpen.warehouse && (
          <CardContent className="p-4 space-y-4">
            {/* Storage Required */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Storage Required</label>
              <div className="flex gap-1.5">{YES_NO_OPTIONS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(warehouse.storage_required === o)}`} onClick={() => setWarehouse(p => ({ ...p, storage_required: o }))}>{o}</button>)}</div>
            </div>
            {/* Storage Type */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Storage Type</label>
              <div className="flex flex-wrap gap-1.5">{STORAGE_TYPES.map(o => <button key={o} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${statusBtnClass(warehouse.storage_type === o)}`} onClick={() => setWarehouse(p => ({ ...p, storage_type: o }))}>{o}</button>)}</div>
            </div>
            {/* Capacity + Unit + Location */}
            <div className="grid grid-cols-4 gap-3">
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Capacity</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Value..." value={warehouse.capacity_value} onChange={e => setWarehouse(p => ({ ...p, capacity_value: e.target.value }))} /></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Unit</label><select className="w-full border border-border rounded-md px-2 py-1.5 text-xs bg-card" value={warehouse.capacity_unit} onChange={e => setWarehouse(p => ({ ...p, capacity_unit: e.target.value }))}><option value="">Select...</option>{CAPACITY_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">City</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="City..." value={warehouse.city} onChange={e => setWarehouse(p => ({ ...p, city: e.target.value }))} /></div>
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Region</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Region..." value={warehouse.region} onChange={e => setWarehouse(p => ({ ...p, region: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Facility / Location</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Facility name..." value={warehouse.facility} onChange={e => setWarehouse(p => ({ ...p, facility: e.target.value }))} /></div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Facility Ownership</label>
                <div className="flex flex-wrap gap-1">{FACILITY_OWNERSHIP.map(o => <button key={o} type="button" className={`px-2 py-1 rounded border text-[10px] transition-colors ${statusBtnClass(warehouse.facility_ownership === o)}`} onClick={() => setWarehouse(p => ({ ...p, facility_ownership: o }))}>{o}</button>)}</div>
              </div>
            </div>
            {/* Activities */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Warehouse Activities</label>
              <div className="flex flex-wrap gap-1.5">{WAREHOUSE_ACTIVITIES.map(a => <button key={a} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${chipClass(warehouse.activities.includes(a))}`} onClick={() => setWarehouse(p => ({ ...p, activities: toggleChip(p.activities, a) }))}>{a}</button>)}</div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Evidence / Source</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Source reference..." value={warehouse.evidence} onChange={e => setWarehouse(p => ({ ...p, evidence: e.target.value }))} /></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" placeholder="Warehouse notes..." value={warehouse.notes} onChange={e => setWarehouse(p => ({ ...p, notes: e.target.value }))} /></div>
          </CardContent>
        )}
      </Card>

      {/* ── Transport / Distribution Design ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("transport")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.transport ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold">Transport / Distribution Design</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{transport.lanes.length} lanes</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.transport && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Transport Required</label>
              <div className="flex gap-1.5">{YES_NO_OPTIONS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(transport.transport_required === o)}`} onClick={() => setTransport(p => ({ ...p, transport_required: o }))}>{o}</button>)}</div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Transport Model</label>
              <div className="flex flex-wrap gap-1.5">{TRANSPORT_MODELS.map(m => <button key={m} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${chipClass(transport.transport_model.includes(m))}`} onClick={() => setTransport(p => ({ ...p, transport_model: toggleChip(p.transport_model, m) }))}>{m}</button>)}</div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Vehicle Types</label>
              <div className="flex flex-wrap gap-1.5">{VEHICLE_TYPES.map(v => <button key={v} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${chipClass(transport.vehicle_types.includes(v))}`} onClick={() => setTransport(p => ({ ...p, vehicle_types: toggleChip(p.vehicle_types, v) }))}>{v}</button>)}</div>
            </div>
            {/* Transport Lanes */}
            <div className="space-y-3">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Transport Lanes</label>
              {transport.lanes.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No transport lanes added yet.</p>}
              {transport.lanes.map((lane, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                  <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeLane(idx)}><X className="w-3.5 h-3.5" /></button>
                  <div className="grid grid-cols-4 gap-2">
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Origin</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.origin} onChange={e => updateLane(idx, "origin", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Destination</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.destination} onChange={e => updateLane(idx, "destination", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Frequency</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.frequency} onChange={e => updateLane(idx, "frequency", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Est. Trips</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.estimated_trips} onChange={e => updateLane(idx, "estimated_trips", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">SLA Requirement</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.sla_requirement} onChange={e => updateLane(idx, "sla_requirement", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Special Handling</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.special_handling} onChange={e => updateLane(idx, "special_handling", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Notes</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.notes} onChange={e => updateLane(idx, "notes", e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Loading Resp.</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.loading_responsibility} onChange={e => updateLane(idx, "loading_responsibility", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Offloading Resp.</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.offloading_responsibility} onChange={e => updateLane(idx, "offloading_responsibility", e.target.value)} /></div>
                    <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Permit Resp.</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={lane.permit_responsibility} onChange={e => updateLane(idx, "permit_responsibility", e.target.value)} /></div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addLane}><Plus className="w-3 h-3" /> Add Transport Lane</Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Operational Flow ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("flow")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.flow ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ClipboardList className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-xs font-semibold">Operational Flow</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{flow.length} steps</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.flow && (
          <CardContent className="p-4 space-y-3">
            {flow.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No operational flow steps captured yet.</p>}
            {flow.map((step, idx) => (
              <div key={idx} className="border border-border rounded-lg p-3 bg-card space-y-2 relative">
                <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors" onClick={() => removeFlowStep(idx)}><X className="w-3.5 h-3.5" /></button>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Process Step</label><select className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.process_step} onChange={e => updateFlowStep(idx, "process_step", e.target.value)}><option value="">Select...</option>{PROCESS_STEP_LABELS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div className="col-span-2"><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Description</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.description} onChange={e => updateFlowStep(idx, "description", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Hala Responsibility</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.hala_responsibility} onChange={e => updateFlowStep(idx, "hala_responsibility", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Customer Responsibility</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.customer_responsibility} onChange={e => updateFlowStep(idx, "customer_responsibility", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">System Used</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.system_used} onChange={e => updateFlowStep(idx, "system_used", e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Risk / Dependency</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.risk_dependency} onChange={e => updateFlowStep(idx, "risk_dependency", e.target.value)} /></div>
                  <div><label className="text-[9px] font-semibold text-muted-foreground mb-0.5 block">Notes</label><input type="text" className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" value={step.notes} onChange={e => updateFlowStep(idx, "notes", e.target.value)} /></div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={addFlowStep}><Plus className="w-3 h-3" /> Add Flow Step</Button>
          </CardContent>
        )}
      </Card>

      {/* ── HOP Recommendation ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("recommendation")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.recommendation ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold">HOP Recommendation</span>
            <Badge variant="outline" className="text-[8px] ml-auto">{recommendation.readiness !== "Not Assessed" ? recommendation.readiness : "Not Assessed"}</Badge>
          </div>
        </CardHeader>
        {sectionsOpen.recommendation && (
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Operations Model Readiness</label>
              <div className="flex flex-wrap gap-1.5">{READINESS_OPTIONS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
            </div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Operations Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter operations notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
          </CardContent>
        )}
      </Card>

      {/* ── Future Output Use ── */}
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20 cursor-pointer" onClick={() => toggle("future")}>
          <div className="flex items-center gap-2">
            {sectionsOpen.future ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-muted-foreground">Future Output Use</span>
          </div>
        </CardHeader>
        {sectionsOpen.future && (
          <CardContent className="p-3">
            <div className="space-y-1.5">
              {FUTURE_WIRING.map(fw => (
                <div key={fw.source} className="flex items-center gap-2 text-[10px]">
                  <Badge variant="outline" className="text-[8px] border-violet-200 bg-violet-50 text-violet-600">{fw.source}</Badge>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{fw.output}</span>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to PDF Studio.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save HOP Operations Model
        </Button>
      </div>
    </div>
  );
}
