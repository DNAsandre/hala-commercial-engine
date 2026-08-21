/**
 * ScopeOfWorkCapture — Structured Scope of Work Capture Module
 *
 * 10 Subsections:
 *   1. Scope Summary
 *   2. Service Lines Required
 *   3. Warehousing Scope
 *   4. Transportation Scope
 *   5. Technology / Systems Scope
 *   6. SLA / KPI Requirements
 *   7. Locations / Sites
 *   8. Compliance / HSE Requirements
 *   9. Assumptions / Exclusions / Clarifications
 *  10. Internal Notes
 *
 * Data: ws.tender.sowData → emptySowData() fallback
 * Save: updateTenderSowData() → type_details.sow_data
 *
 * Rules:
 * - No fake data, no AI generation, no hardcoded tender facts.
 * - Manual capture only.
 * - No stage movement. No CRM sync. No PDF generation.
 * - No localStorage.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  type SowData,
  type SowTransportLane,
  type SowSlaKpi,
  type SowSite,
  type SowClarification,
  emptySowData,
} from "@/lib/sow-data-types";
import { updateTenderSowData } from "@/lib/supabase-tender-actions";
import {
  runTenderTabSave,
  tenderRevisionTokenOf,
} from "./IdentifiedStageShared";
import { toast } from "sonner";
import {
  Loader2, Save, Globe, ChevronDown, ChevronRight, Plus, X,
  FileText, Truck, Warehouse, Cpu, ShieldCheck, MapPin,
  ClipboardList, NotebookPen, Info, ToggleLeft, ToggleRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════
// CONSTANTS — Generic reusable options. NOT tender facts.
// ═══════════════════════════════════════════════════════════

const SERVICE_LINE_OPTIONS = [
  "Warehousing", "Transportation", "Inventory Management", "Order Fulfilment",
  "Distribution", "Freight Forwarding", "Customs Clearance", "Value Added Services",
  "Office Space", "Technology Integration", "Reporting / Dashboards", "HSE / Compliance",
  "Stock Count", "Command Center / Control Tower", "Security / Risk Management", "Business Continuity",
];

const STORAGE_TYPE_OPTIONS = [
  "Dry", "Ambient", "Temperature Controlled", "Chilled", "Frozen",
  "Dangerous Goods", "Bonded", "Open Yard", "Secure / Fenced Area", "Crossdock",
];

const CAPACITY_UNIT_OPTIONS = ["SQM", "Pallets", "CBM", "Containers", "Other"];

const WAREHOUSE_ACTIVITY_OPTIONS = [
  "Receiving", "Inspection", "Quality Check", "Putaway", "Storage",
  "Picking", "Packing", "Kitting", "Labelling", "Dispatch",
  "Cycle Count", "Full Inventory Audit", "Damage Reporting", "Returns Processing",
  "Palletization", "Re-palletization", "Stretch Wrapping", "Destuffing", "VAS",
];

const TRANSPORT_MODEL_OPTIONS = [
  "Dedicated Fleet", "Shared Fleet", "Per Trip", "Per Month", "Linehaul",
  "Last Mile", "Shuttle", "Express", "Ad-hoc", "Full Truck Load", "Multi-drop",
];

const VEHICLE_TYPE_OPTIONS = [
  "Reefer", "Dry Truck", "1 Ton", "4 Ton", "5 Ton", "6 Ton", "10 Ton",
  "40 FT Trailer", "Flatbed", "Curtain Side", "Dyna", "Other",
];

const TECHNOLOGY_OPTIONS = [
  "WMS", "TMS", "GPS Tracking", "Electronic POD", "Barcode Scanning",
  "RFID", "Customer Portal", "ERP Integration", "API Integration",
  "Dashboard Reporting", "AWB Automation", "Photo Evidence", "Digital Signatures",
];

const DEFAULT_KPI_NAMES = [
  "On-time Delivery", "Order Accuracy", "Inventory Accuracy", "Warehouse Throughput",
  "Return Processing Time", "Damage / Loss Rate", "Pickup Window", "Complaint Resolution",
];

const HALA_RESPONSE_OPTIONS = [
  "Compliant", "Partially Compliant", "Not Compliant", "Clarification Required", "Not Applicable",
];

const REGION_OPTIONS = ["Central", "East", "West", "North", "South", "Nationwide"];

const SITE_TYPE_OPTIONS = [
  "Client Site", "Hala Warehouse", "Factory", "Crossdock", "Distribution Point",
  "Port", "Airport", "Border", "Secure Yard", "Other",
];

const COMPLIANCE_OPTIONS = [
  "Civil Defense", "NFPA", "ISO 9001", "ISO 45001", "SFDA", "DG Handling",
  "CCTV / Security", "Fire Suppression", "Emergency Response", "Staff Training",
  "Pest Control", "Hygiene Maintenance", "BCP / DRP", "Data Security",
  "Supplier Code of Conduct", "Local Content / LCGPA",
];

const CLARIFICATION_STATUS_OPTIONS = ["Draft", "Submitted", "Answered", "Closed"];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function emptyLane(): SowTransportLane {
  return { origin: "", destination: "", frequency: "", estimated_trips: "", sla_requirement: "", special_handling: "", notes: "" };
}

function emptyKpi(name = ""): SowSlaKpi {
  return { name, target: "", measurement_tool: "", source: "", hala_response: "", notes: "" };
}

function emptySite(): SowSite {
  return { region: "", city: "", site_name: "", site_type: "", address: "", notes: "" };
}

function emptyClarification(): SowClarification {
  return { question: "", source_reference: "", status: "Draft", buyer_response: "" };
}

/** Deep clone helper for mutable state updates */
function cloneSow(sow: SowData): SowData {
  return JSON.parse(JSON.stringify(sow));
}

/**
 * TCW-T3 F7 — the state a mount starts from is EXACTLY the stored facet
 * (normalized), with no template rows injected. An empty stored KPI list stays
 * empty; DEFAULT_KPI_NAMES exist only as add-on-click suggestions below.
 * Exported pure for direct testing.
 */
export function initialSowState(saved: unknown): SowData {
  if (saved && typeof saved === "object") {
    const stored = saved as Partial<SowData> & Record<string, any>;
    const base = emptySowData();
    return {
      ...base,
      ...stored,
      warehousing: { ...base.warehousing, ...(stored.warehousing ?? {}) },
      transport: { ...base.transport, ...(stored.transport ?? {}) },
      technology: { ...base.technology, ...(stored.technology ?? {}) },
      compliance: { ...base.compliance, ...(stored.compliance ?? {}) },
      service_lines: Array.isArray(stored.service_lines) ? stored.service_lines : [],
      sla_kpis: Array.isArray(stored.sla_kpis) ? stored.sla_kpis : [],
      execution_regions: Array.isArray(stored.execution_regions) ? stored.execution_regions : [],
      sites: Array.isArray(stored.sites) ? stored.sites : [],
      clarifications: Array.isArray(stored.clarifications) ? stored.clarifications : [],
    };
  }
  return emptySowData();
}

/**
 * TCW-T3 F7 — suggestion names not yet present in the captured rows. Clicking
 * one adds a row to LOCAL state only; nothing persists until the user saves.
 * Exported pure for direct testing.
 */
export function kpiSuggestionsFor(rows: SowSlaKpi[]): string[] {
  const used = new Set(rows.map(row => row.name.trim().toLowerCase()).filter(Boolean));
  return DEFAULT_KPI_NAMES.filter(name => !used.has(name.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════
// CHIP MULTI-SELECT
// ═══════════════════════════════════════════════════════════

function ChipMultiSelect({
  options, selected, onToggle, accentColor = "blue",
}: {
  options: string[]; selected: string[]; onToggle: (val: string) => void; accentColor?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const sel = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer ${
              sel
                ? `bg-${accentColor}-100 text-${accentColor}-800 border-${accentColor}-300 ring-1 ring-${accentColor}-400/20`
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxGrid({
  options, selected, onToggle,
}: {
  options: string[]; selected: string[]; onToggle: (val: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
      {options.map(opt => {
        const sel = selected.includes(opt);
        return (
          <label key={opt}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-all ${
              sel ? "bg-[#075eea]/10 border-[#075eea]/20 text-[#064fc4]" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            <input type="checkbox" checked={sel} onChange={() => onToggle(opt)} className="accent-[#075eea] w-3.5 h-3.5" />
            {opt}
          </label>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION HEADER (collapsible)
// ═══════════════════════════════════════════════════════════

function SectionHeader({
  icon, title, collapsed, onToggle, badge,
}: {
  icon: React.ReactNode; title: string; collapsed: boolean; onToggle: () => void; badge?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onToggle}
      className="w-full flex items-center gap-2 text-left group">
      {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0b73ff] transition-colors" /> : <ChevronDown className="w-4 h-4 text-[#0b73ff]" />}
      <span className="text-slate-400">{icon}</span>
      <span className="text-sm font-semibold">{title}</span>
      {badge}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
  /** Lifts the unsaved-edits state to the hosting stage tab (badge truth). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Fires ONLY after a confirmed save (badge truth in the hosting stage tab). */
  onConfirmedSave?: () => void;
}

export default function ScopeOfWorkCapture({ ws, reload, onDirtyChange, onConfirmedSave }: Props) {
  // ── State ────────────────────────────────────────────────
  // F7: initialize from the stored facet only — no template KPI seeding.
  const [sow, setSow] = useState<SowData>(() => initialSowState(ws.tender.sowData));

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const staleRetryArmed = useRef(false);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Collapsible sections
  const [warehouseCollapsed, setWarehouseCollapsed] = useState(false);
  const [transportCollapsed, setTransportCollapsed] = useState(false);
  const [technologyCollapsed, setTechnologyCollapsed] = useState(false);
  const [slaCollapsed, setSlaCollapsed] = useState(false);
  const [locationsCollapsed, setLocationsCollapsed] = useState(false);
  const [complianceCollapsed, setComplianceCollapsed] = useState(false);
  const [assumptionsCollapsed, setAssumptionsCollapsed] = useState(false);

  // ── Updaters ─────────────────────────────────────────────
  const update = useCallback((patcher: (draft: SowData) => void) => {
    setSow(prev => {
      const draft = cloneSow(prev);
      patcher(draft);
      return draft;
    });
    setDirty(true);
  }, []);

  const toggleArray = useCallback((field: string[], value: string): string[] => {
    return field.includes(value) ? field.filter(v => v !== value) : [...field, value];
  }, []);

  // ── Save ─────────────────────────────────────────────────
  // sow_data is a single-tab facet: this component owns ALL its keys, so the
  // patch-merge payload is the full facet (per design pin P2b).
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await runTenderTabSave({
        write: expectedRevision =>
          updateTenderSowData(ws.tender.id, sow as Record<string, any>, {
            expectedRevision,
            reason: "Manual SOW capture",
          }),
        revisionToken: tenderRevisionTokenOf(ws),
        staleRetryArmed,
        labels: { saved: "Scope of Work saved successfully.", failed: "Failed to save Scope of Work" },
        onConfirmed: () => {
          setDirty(false);
          onConfirmedSave?.();
          reload?.();
        },
        onStale: () => reload?.(),
      });
    } catch (error: any) {
      toast.error("Failed to save Scope of Work", { description: error?.message || "Unexpected save error." });
    } finally {
      setSaving(false);
    }
  }, [ws, sow, reload, onConfirmedSave]);

  // F7: the former on-mount DEFAULT_KPI_NAMES seeding is removed — an empty
  // stored KPI list renders empty. The names survive only as click-to-add
  // suggestions in the SLA/KPI section (persisted solely by a user save).

  return (
    <Card className="border-border shadow-none border-l-4 border-l-[#075eea]">
      <CardHeader className="pb-2 border-b border-border bg-[#075eea]/10">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#075eea]" />
          Scope of Work Capture
          {dirty && <Badge variant="outline" className="text-[9px] border-amber-300 bg-amber-50 text-amber-700 ml-2">Unsaved</Badge>}
          <span className="text-[9px] text-muted-foreground/60 ml-auto font-normal">
            Structured operational scope used by pricing, compliance, and proposal generation.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">

        {/* ── 1. Scope Summary ─────────────────────────────── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Scope Summary
          </p>
          <p className="text-[9px] text-muted-foreground/60 mb-1.5">
            High-level summary of what the client is asking Hala to deliver.
          </p>
          <textarea
            value={sow.scope_summary}
            onChange={e => update(d => { d.scope_summary = e.target.value; })}
            placeholder="Describe the scope of work the client is requesting..."
            className="w-full min-h-[80px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
          />
        </div>

        {/* ── 2. Service Lines Required ────────────────────── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <ClipboardList className="w-3 h-3" /> Service Lines Required
          </p>
          {sow.service_lines.length > 0 && (
            <Badge variant="outline" className="text-[9px] mb-2">{sow.service_lines.length} selected</Badge>
          )}
          <ChipMultiSelect
            options={SERVICE_LINE_OPTIONS}
            selected={sow.service_lines}
            onToggle={val => update(d => { d.service_lines = toggleArray(d.service_lines, val); })}
          />
        </div>

        {/* ── 3. Warehousing Scope ─────────────────────────── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<Warehouse className="w-4 h-4" />}
              title="Warehousing Scope"
              collapsed={warehouseCollapsed}
              onToggle={() => setWarehouseCollapsed(p => !p)}
              badge={sow.warehousing.storage_types.length > 0 ? <Badge variant="outline" className="text-[9px] ml-2">{sow.warehousing.storage_types.length} types</Badge> : undefined}
            />
          </div>
          {!warehouseCollapsed && (
            <div className="p-4 space-y-4">
              {/* Storage Types */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Storage Type</p>
                <ChipMultiSelect
                  options={STORAGE_TYPE_OPTIONS}
                  selected={sow.warehousing.storage_types}
                  onToggle={val => update(d => { d.warehousing.storage_types = toggleArray(d.warehousing.storage_types, val); })}
                />
              </div>
              {/* Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Capacity Value</p>
                  <input
                    type="text" inputMode="numeric"
                    value={sow.warehousing.capacity_value}
                    onChange={e => update(d => { d.warehousing.capacity_value = e.target.value; })}
                    placeholder="Value"
                    className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Capacity Unit</p>
                  <select
                    value={sow.warehousing.capacity_unit}
                    onChange={e => update(d => { d.warehousing.capacity_unit = e.target.value; })}
                    className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs bg-white">
                    <option value="">Select unit...</option>
                    {CAPACITY_UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {/* Activities */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Warehouse Activities</p>
                <CheckboxGrid
                  options={WAREHOUSE_ACTIVITY_OPTIONS}
                  selected={sow.warehousing.activities}
                  onToggle={val => update(d => { d.warehousing.activities = toggleArray(d.warehousing.activities, val); })}
                />
              </div>
              {/* Notes */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Additional Warehousing Notes</p>
                <textarea
                  value={sow.warehousing.notes}
                  onChange={e => update(d => { d.warehousing.notes = e.target.value; })}
                  placeholder="Additional warehousing context..."
                  className="w-full min-h-[50px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 4. Transportation Scope ──────────────────────── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<Truck className="w-4 h-4" />}
              title="Transportation Scope"
              collapsed={transportCollapsed}
              onToggle={() => setTransportCollapsed(p => !p)}
              badge={sow.transport.required ? <Badge variant="outline" className="text-[9px] ml-2 border-emerald-200 bg-emerald-50 text-emerald-700">Required</Badge> : undefined}
            />
          </div>
          {!transportCollapsed && (
            <div className="p-4 space-y-4">
              {/* Transport Required Toggle */}
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transport Required</p>
                <button type="button" onClick={() => update(d => { d.transport.required = !d.transport.required; })}
                  className="flex items-center gap-1.5 text-xs cursor-pointer">
                  {sow.transport.required
                    ? <><ToggleRight className="w-5 h-5 text-emerald-600" /><span className="text-emerald-700 font-medium">Yes</span></>
                    : <><ToggleLeft className="w-5 h-5 text-slate-400" /><span className="text-slate-500">No</span></>
                  }
                </button>
              </div>

              {sow.transport.required && (
                <>
                  {/* Transport Model */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Transport Model</p>
                    <ChipMultiSelect
                      options={TRANSPORT_MODEL_OPTIONS}
                      selected={sow.transport.models}
                      onToggle={val => update(d => { d.transport.models = toggleArray(d.transport.models, val); })}
                    />
                  </div>
                  {/* Vehicle Type */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Vehicle Type</p>
                    <ChipMultiSelect
                      options={VEHICLE_TYPE_OPTIONS}
                      selected={sow.transport.vehicle_types}
                      onToggle={val => update(d => { d.transport.vehicle_types = toggleArray(d.transport.vehicle_types, val); })}
                    />
                  </div>
                  {/* Transport Lanes */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Transport Lanes</p>
                    {sow.transport.lanes.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {sow.transport.lanes.map((lane, idx) => (
                          <div key={idx} className="grid grid-cols-7 gap-1.5 items-start p-2 rounded-md bg-slate-50 border border-slate-200 relative group">
                            <input value={lane.origin} onChange={e => update(d => { d.transport.lanes[idx].origin = e.target.value; })}
                              placeholder="Origin" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                            <input value={lane.destination} onChange={e => update(d => { d.transport.lanes[idx].destination = e.target.value; })}
                              placeholder="Destination" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                            <input value={lane.frequency} onChange={e => update(d => { d.transport.lanes[idx].frequency = e.target.value; })}
                              placeholder="Frequency" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                            <input value={lane.estimated_trips} onChange={e => update(d => { d.transport.lanes[idx].estimated_trips = e.target.value; })}
                              placeholder="Est. Trips" inputMode="numeric" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                            <input value={lane.sla_requirement} onChange={e => update(d => { d.transport.lanes[idx].sla_requirement = e.target.value; })}
                              placeholder="SLA Req." className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                            <input value={lane.special_handling} onChange={e => update(d => { d.transport.lanes[idx].special_handling = e.target.value; })}
                              placeholder="Special" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                            <div className="flex gap-1">
                              <input value={lane.notes} onChange={e => update(d => { d.transport.lanes[idx].notes = e.target.value; })}
                                placeholder="Notes" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white flex-1" />
                              <button type="button" onClick={() => update(d => { d.transport.lanes.splice(idx, 1); })}
                                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                      onClick={() => update(d => { d.transport.lanes.push(emptyLane()); })}>
                      <Plus className="w-3 h-3" /> Add Transport Lane
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── 5. Technology / Systems Scope ─────────────────── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<Cpu className="w-4 h-4" />}
              title="Technology / Systems Scope"
              collapsed={technologyCollapsed}
              onToggle={() => setTechnologyCollapsed(p => !p)}
              badge={sow.technology.systems.length > 0 ? <Badge variant="outline" className="text-[9px] ml-2">{sow.technology.systems.length} selected</Badge> : undefined}
            />
          </div>
          {!technologyCollapsed && (
            <div className="p-4 space-y-4">
              <CheckboxGrid
                options={TECHNOLOGY_OPTIONS}
                selected={sow.technology.systems}
                onToggle={val => update(d => { d.technology.systems = toggleArray(d.technology.systems, val); })}
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Integration Notes</p>
                <textarea
                  value={sow.technology.integration_notes}
                  onChange={e => update(d => { d.technology.integration_notes = e.target.value; })}
                  placeholder="Integration requirements, APIs, system interfaces..."
                  className="w-full min-h-[50px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 6. SLA / KPI Requirements ────────────────────── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<ClipboardList className="w-4 h-4" />}
              title="SLA / KPI Requirements"
              collapsed={slaCollapsed}
              onToggle={() => setSlaCollapsed(p => !p)}
              badge={<Badge variant="outline" className="text-[9px] ml-2">{sow.sla_kpis.length} rows</Badge>}
            />
          </div>
          {!slaCollapsed && (
            <div className="p-0">
              {sow.sla_kpis.length === 0 && (
                <div className="px-4 pt-3 text-[10px] text-muted-foreground">
                  No SLA / KPI requirements captured yet. Add rows manually or pick from the suggestions below — nothing is saved until you press Save.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-muted/10">
                      <th className="text-left p-2 font-semibold text-muted-foreground">KPI / SLA Name</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Target</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Measurement Tool</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Source</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Hala Response</th>
                      <th className="text-left p-2 font-semibold text-muted-foreground">Notes</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sow.sla_kpis.map((kpi, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-muted/10">
                        <td className="p-1.5">
                          <input value={kpi.name} onChange={e => update(d => { d.sla_kpis[idx].name = e.target.value; })}
                            placeholder="KPI name" className="w-full h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        </td>
                        <td className="p-1.5">
                          <input value={kpi.target} onChange={e => update(d => { d.sla_kpis[idx].target = e.target.value; })}
                            placeholder="Target" className="w-full h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        </td>
                        <td className="p-1.5">
                          <input value={kpi.measurement_tool} onChange={e => update(d => { d.sla_kpis[idx].measurement_tool = e.target.value; })}
                            placeholder="Tool" className="w-full h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        </td>
                        <td className="p-1.5">
                          <input value={kpi.source} onChange={e => update(d => { d.sla_kpis[idx].source = e.target.value; })}
                            placeholder="Source" className="w-full h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        </td>
                        <td className="p-1.5">
                          <select value={kpi.hala_response} onChange={e => update(d => { d.sla_kpis[idx].hala_response = e.target.value; })}
                            className="w-full h-7 px-1 rounded border border-slate-200 text-[10px] bg-white">
                            <option value="">Select...</option>
                            {HALA_RESPONSE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input value={kpi.notes} onChange={e => update(d => { d.sla_kpis[idx].notes = e.target.value; })}
                            placeholder="Notes" className="w-full h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        </td>
                        <td className="p-1.5">
                          <button type="button" onClick={() => update(d => { d.sla_kpis.splice(idx, 1); })}
                            className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-2 space-y-2">
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => update(d => { d.sla_kpis.push(emptyKpi()); })}>
                  <Plus className="w-3 h-3" /> Add KPI / SLA
                </Button>
                {kpiSuggestionsFor(sow.sla_kpis).length > 0 && (
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Common KPI suggestions (click to add a row — saved only when you press Save)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {kpiSuggestionsFor(sow.sla_kpis).map(name => (
                        <button key={name} type="button"
                          onClick={() => update(d => { d.sla_kpis.push(emptyKpi(name)); })}
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[9px] text-slate-600 hover:border-[#075eea]/40 hover:bg-[#075eea]/5 hover:text-[#064fc4] transition-colors">
                          + {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 7. Locations / Sites ──────────────────────────── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<MapPin className="w-4 h-4" />}
              title="Locations / Sites"
              collapsed={locationsCollapsed}
              onToggle={() => setLocationsCollapsed(p => !p)}
              badge={sow.sites.length > 0 ? <Badge variant="outline" className="text-[9px] ml-2">{sow.sites.length} sites</Badge> : undefined}
            />
          </div>
          {!locationsCollapsed && (
            <div className="p-4 space-y-4">
              {/* Region chips */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Execution Regions</p>
                <ChipMultiSelect
                  options={REGION_OPTIONS}
                  selected={sow.execution_regions}
                  onToggle={val => update(d => { d.execution_regions = toggleArray(d.execution_regions, val); })}
                />
              </div>
              {/* Site rows */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sites</p>
                {sow.sites.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {sow.sites.map((site, idx) => (
                      <div key={idx} className="grid grid-cols-6 gap-1.5 items-start p-2 rounded-md bg-slate-50 border border-slate-200 relative">
                        <select value={site.region} onChange={e => update(d => { d.sites[idx].region = e.target.value; })}
                          className="h-7 px-1 rounded border border-slate-200 text-[10px] bg-white">
                          <option value="">Region...</option>
                          {REGION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input value={site.city} onChange={e => update(d => { d.sites[idx].city = e.target.value; })}
                          placeholder="City" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        <input value={site.site_name} onChange={e => update(d => { d.sites[idx].site_name = e.target.value; })}
                          placeholder="Site Name" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        <select value={site.site_type} onChange={e => update(d => { d.sites[idx].site_type = e.target.value; })}
                          className="h-7 px-1 rounded border border-slate-200 text-[10px] bg-white">
                          <option value="">Type...</option>
                          {SITE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input value={site.address} onChange={e => update(d => { d.sites[idx].address = e.target.value; })}
                          placeholder="Address / Map Link" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        <div className="flex gap-1">
                          <input value={site.notes} onChange={e => update(d => { d.sites[idx].notes = e.target.value; })}
                            placeholder="Notes" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white flex-1" />
                          <button type="button" onClick={() => update(d => { d.sites.splice(idx, 1); })}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => update(d => { d.sites.push(emptySite()); })}>
                  <Plus className="w-3 h-3" /> Add Site
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── 8. Compliance / HSE Requirements ──────────────── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Compliance / HSE Requirements"
              collapsed={complianceCollapsed}
              onToggle={() => setComplianceCollapsed(p => !p)}
              badge={sow.compliance.requirements.length > 0 ? <Badge variant="outline" className="text-[9px] ml-2">{sow.compliance.requirements.length} selected</Badge> : undefined}
            />
          </div>
          {!complianceCollapsed && (
            <div className="p-4 space-y-4">
              <CheckboxGrid
                options={COMPLIANCE_OPTIONS}
                selected={sow.compliance.requirements}
                onToggle={val => update(d => { d.compliance.requirements = toggleArray(d.compliance.requirements, val); })}
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Compliance Notes</p>
                <textarea
                  value={sow.compliance.notes}
                  onChange={e => update(d => { d.compliance.notes = e.target.value; })}
                  placeholder="Additional compliance or HSE context..."
                  className="w-full min-h-[50px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 9. Assumptions / Exclusions / Clarifications ─── */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/20 border-b border-slate-200">
            <SectionHeader
              icon={<NotebookPen className="w-4 h-4" />}
              title="Assumptions, Exclusions & Clarifications"
              collapsed={assumptionsCollapsed}
              onToggle={() => setAssumptionsCollapsed(p => !p)}
            />
          </div>
          {!assumptionsCollapsed && (
            <div className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Assumptions</p>
                  <textarea
                    value={sow.assumptions}
                    onChange={e => update(d => { d.assumptions = e.target.value; })}
                    placeholder="Key assumptions for this scope..."
                    className="w-full min-h-[70px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Exclusions</p>
                  <textarea
                    value={sow.exclusions}
                    onChange={e => update(d => { d.exclusions = e.target.value; })}
                    placeholder="What is explicitly excluded from scope..."
                    className="w-full min-h-[70px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
                  />
                </div>
              </div>
              {/* Clarifications */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Clarification Questions</p>
                {sow.clarifications.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {sow.clarifications.map((cl, idx) => (
                      <div key={idx} className="grid grid-cols-4 gap-1.5 items-start p-2 rounded-md bg-slate-50 border border-slate-200 relative">
                        <input value={cl.question} onChange={e => update(d => { d.clarifications[idx].question = e.target.value; })}
                          placeholder="Question" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white col-span-1" />
                        <input value={cl.source_reference} onChange={e => update(d => { d.clarifications[idx].source_reference = e.target.value; })}
                          placeholder="Source Reference" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white" />
                        <select value={cl.status} onChange={e => update(d => { d.clarifications[idx].status = e.target.value; })}
                          className="h-7 px-1 rounded border border-slate-200 text-[10px] bg-white">
                          {CLARIFICATION_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="flex gap-1">
                          <input value={cl.buyer_response} onChange={e => update(d => { d.clarifications[idx].buyer_response = e.target.value; })}
                            placeholder="Buyer Response" className="h-7 px-1.5 rounded border border-slate-200 text-[10px] bg-white flex-1" />
                          <button type="button" onClick={() => update(d => { d.clarifications.splice(idx, 1); })}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => update(d => { d.clarifications.push(emptyClarification()); })}>
                  <Plus className="w-3 h-3" /> Add Clarification Question
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── 10. Internal Notes ────────────────────────────── */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
            <NotebookPen className="w-3 h-3" /> Internal Notes
          </p>
          <p className="text-[9px] text-muted-foreground/60 mb-1.5">
            Internal-only notes. Not included in external documents.
          </p>
          <textarea
            value={sow.internal_notes}
            onChange={e => update(d => { d.internal_notes = e.target.value; })}
            placeholder="Internal team notes..."
            className="w-full min-h-[50px] px-3 py-2 rounded-md border border-slate-200 text-xs resize-y bg-white focus:outline-none focus:ring-1 focus:ring-[#075eea]"
          />
        </div>

        {/* ── Save Button ───────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-2">
          <Button size="sm" className="gap-1.5 h-9 text-xs px-5" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Scope of Work
          </Button>
          {dirty && <span className="text-[10px] text-amber-600">You have unsaved changes.</span>}
          {!dirty && sow.scope_summary && <span className="text-[10px] text-emerald-600">✓ Saved</span>}
        </div>

      </CardContent>
    </Card>
  );
}
