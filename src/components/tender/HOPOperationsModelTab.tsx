/**
 * HOPOperationsModelTab — HOP Operations Model
 *
 * 5 Sections (section-tab navigation, matching Qualification pattern):
 *   1. Warehouse / Storage Design
 *   2. Transport / Distribution Design (repeatable lanes)
 *   3. Operational Flow (repeatable steps)
 *   4. HOP Recommendation
 *   5. Output Use (read-only)
 *
 * Data: ws.tender.solutionDesignData.hop
 * Save: updateTenderSolutionDesignData → merges hop only
 */

import { useState, useCallback, useRef, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderSolutionDesignData } from "@/lib/supabase-tender-actions";
import { runTenderTabSave, tenderRevisionTokenOf } from "./IdentifiedStageShared";
import { toast } from "sonner";
import {
  Loader2, Save, ChevronDown, Plus, X,
  Warehouse, Truck, ArrowRight, ClipboardList, Info,
  FolderOpen, BarChart3, PanelRightOpen,
} from "lucide-react";
import { TenderStageIntelligenceSlot } from "./TenderStageTaskShell";

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

// ── Section tabs ─────────────────────────────────────────────────────
type HOPSectionKey = "warehouse" | "transport" | "flow" | "recommendation" | "wiring";

const HOP_SECTION_TABS: { key: HOPSectionKey; label: string; icon: ReactNode }[] = [
  { key: "warehouse", label: "Warehouse Model", icon: <Warehouse className="w-3.5 h-3.5" /> },
  { key: "transport", label: "Transport Model", icon: <Truck className="w-3.5 h-3.5" /> },
  { key: "flow", label: "Operational Flow", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "recommendation", label: "HOP Recommendation", icon: <ArrowRight className="w-3.5 h-3.5" /> },
  { key: "wiring", label: "Output Use", icon: <Info className="w-3.5 h-3.5" /> },
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
  return "bg-[#075eea]/15 border-[#075eea]/30 text-[#075eea] font-medium cursor-pointer";
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

/**
 * TCW-T3 (P2b) — this tab's patch carries ONLY its own solution_design_data
 * key (hop). The write layer patch-merges, so sibling tabs' keys are
 * preserved by the STORED facet — never re-sent from a page-load copy.
 * Exported pure for direct testing.
 */
export function buildHopPatch(
  warehouse: WarehouseData,
  transport: TransportData,
  flow: OperationalFlowStep[],
  recommendation: { readiness: ReadinessStatus; notes: string },
): Record<string, any> {
  return { hop: { warehouse, transport, operational_flow: flow, recommendation } };
}

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  /** Fires ONLY after a confirmed save (the workspace shell passes reload). */
  onSaved?: () => void;
}

export default function HOPOperationsModelTab({ ws, onOpenDocuments, onOpenGlobalIntel, onSaved }: Props) {
  const t = ws.tender;
  const tenderId = t.id;
  const existing = t.solutionDesignData as any;
  const hop = existing?.hop;

  const [warehouse, setWarehouse] = useState<WarehouseData>(() => hop?.warehouse ? { ...emptyWarehouse(), ...hop.warehouse } : emptyWarehouse());
  const [transport, setTransport] = useState<TransportData>(() => hop?.transport ? { ...emptyTransport(), ...hop.transport, lanes: Array.isArray(hop.transport?.lanes) ? hop.transport.lanes : [] } : emptyTransport());
  const [flow, setFlow] = useState<OperationalFlowStep[]>(() => Array.isArray(hop?.operational_flow) ? hop.operational_flow : []);
  const [recommendation, setRecommendation] = useState<{ readiness: ReadinessStatus; notes: string }>(() => hop?.recommendation ? { readiness: "Not Assessed", notes: "", ...hop.recommendation } : { readiness: "Not Assessed", notes: "" });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<HOPSectionKey>("warehouse");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const toggleChip = (arr: string[], val: string) => arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  const addLane = () => setTransport(p => ({ ...p, lanes: [...p.lanes, emptyLane()] }));
  const removeLane = (i: number) => setTransport(p => ({ ...p, lanes: p.lanes.filter((_, idx) => idx !== i) }));
  const updateLane = (i: number, f: keyof TransportLane, v: string) => setTransport(p => ({ ...p, lanes: p.lanes.map((r, idx) => idx === i ? { ...r, [f]: v } : r) }));

  const addFlowStep = () => setFlow(p => [...p, emptyFlowStep()]);
  const removeFlowStep = (i: number) => setFlow(p => p.filter((_, idx) => idx !== i));
  const updateFlowStep = (i: number, f: keyof OperationalFlowStep, v: string) => setFlow(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const staleRetryArmed = useRef(false);
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderSolutionDesignData(tenderId, buildHopPatch(warehouse, transport, flow, recommendation), {
            expectedRevision,
            reason: "HOP Operations Model saved",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "HOP Operations Model saved", failed: "Save failed" },
        onConfirmed: () => onSaved?.(),
        // Stale: local form state is untouched — the user's entry stays.
      });
    } catch (e: any) {
      toast.error(e.message || "Save failed.");
    } finally { setSaving(false); }
  }, [tenderId, warehouse, transport, flow, recommendation, onSaved, ws]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden border-border bg-card py-0 shadow-none">
        <CardContent className="p-0">
          {/* ── Dark Stage Menu Header ───────────────────────── */}
          <div className="-mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-lg border-b border-[#1f3f6f] bg-[#0b1726] px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Solution Design Stage Menu
              </span>
              <Badge variant="outline" className="h-5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2 text-[9px] font-medium text-slate-200">
                Stage 4
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`h-7 gap-1.5 rounded-md px-2.5 text-[11px] font-medium shadow-sm ${
                stageIntelOpen
                  ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                  : "border-[#2f5f9d] bg-[#102844]/80 text-slate-50 hover:bg-[#17365d] hover:text-white"
              }`}
              onClick={() => setStageIntelOpen(prev => !prev)}
            >
              <PanelRightOpen className="w-3.5 h-3.5" />
              {stageIntelOpen ? "Hide Stage Intel" : "Show Stage Intel"}
            </Button>
            </div>
          </div>
          {stageIntelOpen && (
            <div className="border-b border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <StageIntelMetric label="Storage Required" value={warehouse.storage_required} />
                <StageIntelMetric label="Transport Required" value={transport.transport_required} />
                <StageIntelMetric label="Flow Steps" value={`${flow.length}`} />
                <StageIntelMetric label="Readiness" value={recommendation.readiness} />
              </div>
              <div className="mt-3">
                <TenderStageIntelligenceSlot />
              </div>
            </div>
          )}

          {/* ── Section Tab Buttons ─────────────────────────── */}
          <div className="flex items-end gap-0 overflow-x-auto border-b-2 border-[#075eea] bg-card px-3 pt-3">
            {HOP_SECTION_TABS.map(section => (
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
        const hopIncluded = sel.toUpperCase().includes("HOP");
        const notSelected = !sel || sel === "Not Selected";
        if (notSelected) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600"><Info className="w-3.5 h-3.5 shrink-0" /> Solution configuration has not been selected yet.</div>;
        if (hopIncluded) return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs text-emerald-700"><Info className="w-3.5 h-3.5 shrink-0" /> HOP is required by the selected solution configuration.</div>;
        return <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-700"><Info className="w-3.5 h-3.5 shrink-0" /> HOP is not selected in the current solution configuration. Capture only if operational scope is still relevant.</div>;
      })()}

      {/* ── 1. Warehouse / Storage Design ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "warehouse" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Warehouse / Storage Design" icon={<Warehouse className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Storage Required</label>
            <div className="flex gap-1.5">{YES_NO_OPTIONS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(warehouse.storage_required === o)}`} onClick={() => setWarehouse(p => ({ ...p, storage_required: o }))}>{o}</button>)}</div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Storage Type</label>
            <div className="flex flex-wrap gap-1.5">{STORAGE_TYPES.map(o => <button key={o} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${statusBtnClass(warehouse.storage_type === o)}`} onClick={() => setWarehouse(p => ({ ...p, storage_type: o }))}>{o}</button>)}</div>
          </div>
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
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Warehouse Activities</label>
            <div className="flex flex-wrap gap-1.5">{WAREHOUSE_ACTIVITIES.map(a => <button key={a} type="button" className={`px-2.5 py-1 rounded-md border text-[10px] transition-colors ${chipClass(warehouse.activities.includes(a))}`} onClick={() => setWarehouse(p => ({ ...p, activities: toggleChip(p.activities, a) }))}>{a}</button>)}</div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Evidence / Source</label><input type="text" className="w-full border border-border rounded-md px-3 py-1.5 text-xs bg-card" placeholder="Source reference..." value={warehouse.evidence} onChange={e => setWarehouse(p => ({ ...p, evidence: e.target.value }))} /></div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[50px] resize-y" placeholder="Warehouse notes..." value={warehouse.notes} onChange={e => setWarehouse(p => ({ ...p, notes: e.target.value }))} /></div>
        </CardContent>
      </Card>

      {/* ── 2. Transport / Distribution Design ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "transport" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Transport / Distribution Design" icon={<Truck className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${transport.lanes.length} lanes`} />
        </CardHeader>
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
      </Card>

      {/* ── 3. Operational Flow ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "flow" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Operational Flow" icon={<ClipboardList className="w-3.5 h-3.5 text-[#075eea]" />} badge={`${flow.length} steps`} />
        </CardHeader>
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
      </Card>

      {/* ── 4. HOP Recommendation ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "recommendation" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="HOP Recommendation" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} badge={recommendation.readiness} />
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Operations Model Readiness</label>
            <div className="flex flex-wrap gap-1.5">{READINESS_OPTIONS.map(o => <button key={o} type="button" className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${statusBtnClass(recommendation.readiness === o)}`} onClick={() => setRecommendation(p => ({ ...p, readiness: o }))}>{o}</button>)}</div>
          </div>
          <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Operations Notes</label><textarea className="w-full border border-border rounded-md px-3 py-2 text-xs bg-card min-h-[60px] resize-y" placeholder="Enter operations notes..." value={recommendation.notes} onChange={e => setRecommendation(p => ({ ...p, notes: e.target.value }))} /></div>
        </CardContent>
      </Card>

      {/* ── 5. Output Use ── */}
      <Card className={`gap-0 overflow-hidden rounded-lg border-border py-0 shadow-none ${activeSection !== "wiring" ? "hidden" : ""}`}>
        <CardHeader className="p-0">
          <SectionHeader title="Output Use" icon={<ArrowRight className="w-3.5 h-3.5 text-[#075eea]" />} />
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-1.5">
            {FUTURE_WIRING.map(fw => (
              <div key={fw.source} className="flex items-center gap-2 text-[10px]">
                <Badge variant="outline" className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]">{fw.source}</Badge>
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">{fw.output}</span>
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground/60 mt-2 italic">Informational only — no content is generated or written to discontinued document tooling.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Save ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save HOP Operations Model
        </Button>
      </div>
      </div>
    </div>
  );
}

// ── Helper: Section Header (matches SowSectionHeader) ────────────────
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

// ── Helper: Stage Intel Metric (matches Qualification) ───────────────
function StageIntelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
