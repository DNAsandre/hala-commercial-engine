/**
 * Stage 3 — SOLUTION DESIGN
 * Translate customer need into operational design.
 *
 * Tabs: Warehouse Model | Transport Model | VAS | Service Scope | Operational Feasibility
 */
import { Package, Truck, ClipboardList, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Section, FieldRow, FieldInput, FieldTextarea, FieldSelect, ReadinessBadge, SignalCard,
} from "../ui-primitives";
import type {
  WarehouseModel, TransportModel, VasHandling, ServiceScope, OperationalFeasibility,
} from "../proposal-workspace-state";

const FIT_OPTIONS = [
  { value: "fit", label: "Fit" },
  { value: "tight", label: "Tight" },
  { value: "gap", label: "Gap" },
];

// ═══════════════════════════════════════════════════════════
// TAB: Warehouse Model
// ═══════════════════════════════════════════════════════════

export function WarehouseModelTab({
  data, onChange,
}: {
  data: WarehouseModel;
  onChange: (d: WarehouseModel) => void;
}) {
  const u = (field: keyof WarehouseModel, val: string) => onChange({ ...data, [field]: val });
  const filled = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Warehouse Configuration" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{filled}/6 defined</Badge>}
        icon={<Package className="w-4 h-4 text-indigo-500" />}
      >
        <div className="space-y-0.5">
          <FieldRow label="Storage Type">
            <FieldSelect value={data.storageType} onChange={v => u("storageType", v)} options={[
              { value: "racking", label: "Selective Racking" }, { value: "block", label: "Block Stacking" },
              { value: "double_deep", label: "Double Deep" }, { value: "drive_in", label: "Drive-In" },
              { value: "mobile", label: "Mobile Racking" }, { value: "automated", label: "AS/RS" },
              { value: "mixed", label: "Mixed" },
            ]} />
          </FieldRow>
          <FieldRow label="Facility Type">
            <FieldSelect value={data.facilityType} onChange={v => u("facilityType", v)} options={[
              { value: "ambient", label: "Ambient" }, { value: "chilled", label: "Chilled" },
              { value: "frozen", label: "Frozen" }, { value: "multi_temp", label: "Multi-Temperature" },
              { value: "bonded", label: "Bonded/Free Zone" },
            ]} />
          </FieldRow>
          <FieldRow label="Capacity Est."><FieldInput value={data.capacityEstimate} onChange={v => u("capacityEstimate", v)} placeholder="e.g. 12,000 pallet positions" /></FieldRow>
          <FieldRow label="Handling"><FieldTextarea value={data.handlingAssumptions} onChange={v => u("handlingAssumptions", v)} placeholder="In/out handling model, MHE requirements, shift patterns..." rows={2} /></FieldRow>
          <FieldRow label="Temp Zones"><FieldInput value={data.tempZones} onChange={v => u("tempZones", v)} placeholder="e.g. Zone A: 2-8°C, Zone B: Ambient" /></FieldRow>
          <FieldRow label="Labor"><FieldTextarea value={data.laborAssumptions} onChange={v => u("laborAssumptions", v)} placeholder="Headcount estimates, shift structure, skill requirements..." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Transport Model
// ═══════════════════════════════════════════════════════════

export function TransportModelTab({
  data, onChange,
}: {
  data: TransportModel;
  onChange: (d: TransportModel) => void;
}) {
  const u = (field: keyof TransportModel, val: string) => onChange({ ...data, [field]: val });
  const filled = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Transport Configuration" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{filled}/6 defined</Badge>}
        icon={<Truck className="w-4 h-4 text-cyan-500" />}
      >
        <div className="space-y-0.5">
          <FieldRow label="Lane Structure"><FieldTextarea value={data.laneStructure} onChange={v => u("laneStructure", v)} placeholder="Origin → Destination lanes, volume per lane..." rows={3} /></FieldRow>
          <FieldRow label="Vehicle Types">
            <FieldInput value={data.vehicleTypes} onChange={v => u("vehicleTypes", v)} placeholder="e.g. 10T trailer, 3T van, last mile" />
          </FieldRow>
          <FieldRow label="Frequency"><FieldInput value={data.frequency} onChange={v => u("frequency", v)} placeholder="e.g. Daily, 3x/week, on-demand" /></FieldRow>
          <FieldRow label="SLA"><FieldInput value={data.sla} onChange={v => u("sla", v)} placeholder="e.g. Next-day delivery, 4-hour window" /></FieldRow>
          <FieldRow label="Route Complexity">
            <FieldSelect value={data.routeComplexity} onChange={v => u("routeComplexity", v)} options={[
              { value: "simple", label: "Simple — few lanes" },
              { value: "moderate", label: "Moderate — multi-lane" },
              { value: "complex", label: "Complex — last mile + hub" },
            ]} />
          </FieldRow>
          <FieldRow label="Vendor Needs"><FieldTextarea value={data.vendorRequirements} onChange={v => u("vendorRequirements", v)} placeholder="Subcontractor needs, specialized vehicles, cross-dock..." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: VAS / Special Handling
// ═══════════════════════════════════════════════════════════

export function VasHandlingTab({
  data, onChange,
}: {
  data: VasHandling;
  onChange: (d: VasHandling) => void;
}) {
  const u = (field: keyof VasHandling, val: string) => onChange({ ...data, [field]: val });

  return (
    <div className="space-y-1">
      <Section title="Value-Added Services" defaultOpen icon={<ClipboardList className="w-4 h-4 text-violet-500" />}>
        <div className="space-y-0.5">
          <FieldRow label="Labeling"><FieldTextarea value={data.labeling} onChange={v => u("labeling", v)} placeholder="Label types, frequency, compliance requirements..." rows={2} /></FieldRow>
          <FieldRow label="Kitting"><FieldTextarea value={data.kitting} onChange={v => u("kitting", v)} placeholder="Kit assembly, BOM requirements, packaging..." rows={2} /></FieldRow>
          <FieldRow label="Packaging"><FieldTextarea value={data.packaging} onChange={v => u("packaging", v)} placeholder="Repacking, shrink-wrap, gift packaging..." rows={2} /></FieldRow>
          <FieldRow label="Returns"><FieldTextarea value={data.returns} onChange={v => u("returns", v)} placeholder="Reverse logistics, returns processing, QC checks..." rows={2} /></FieldRow>
          <FieldRow label="Compliance"><FieldTextarea value={data.compliance} onChange={v => u("compliance", v)} placeholder="SFDA, customs, quality checks, documentation..." rows={2} /></FieldRow>
          <FieldRow label="Specialized"><FieldTextarea value={data.specializedHandling} onChange={v => u("specializedHandling", v)} placeholder="Hazmat, fragile, high-value, RFID, special equipment..." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Service Scope
// ═══════════════════════════════════════════════════════════

export function ServiceScopeTab({
  data, onChange,
}: {
  data: ServiceScope;
  onChange: (d: ServiceScope) => void;
}) {
  const u = (field: keyof ServiceScope, val: string) => onChange({ ...data, [field]: val });

  return (
    <div className="space-y-1">
      <Section title="Included Services" defaultOpen icon={<FileText className="w-4 h-4 text-emerald-500" />}>
        <FieldRow label="Included"><FieldTextarea value={data.included} onChange={v => u("included", v)} placeholder="All services Hala will provide..." rows={4} /></FieldRow>
      </Section>

      <Section title="Excluded Services" defaultOpen>
        <FieldRow label="Excluded"><FieldTextarea value={data.excluded} onChange={v => u("excluded", v)} placeholder="What is NOT included in this proposal..." rows={3} /></FieldRow>
      </Section>

      <Section title="Responsibilities" defaultOpen={false}>
        <FieldRow label="Customer"><FieldTextarea value={data.customerResponsibilities} onChange={v => u("customerResponsibilities", v)} placeholder="What the customer must provide or manage..." rows={3} /></FieldRow>
        <FieldRow label="Hala"><FieldTextarea value={data.halaResponsibilities} onChange={v => u("halaResponsibilities", v)} placeholder="What Hala commits to deliver and manage..." rows={3} /></FieldRow>
      </Section>

      <Section title="KPIs" defaultOpen={false}>
        <FieldRow label="KPI Scope"><FieldTextarea value={data.kpiScope} onChange={v => u("kpiScope", v)} placeholder="Proposed KPIs: order accuracy, OTIF, inventory accuracy, etc." rows={3} /></FieldRow>
      </Section>

      {!data.included && !data.excluded && (
        <SignalCard type="info" message="Scope not defined" recommendation="Define included and excluded services before pricing" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Operational Feasibility
// ═══════════════════════════════════════════════════════════

export function OperationalFeasibilityTab({
  data, onChange,
}: {
  data: OperationalFeasibility;
  onChange: (d: OperationalFeasibility) => void;
}) {
  const u = (field: keyof OperationalFeasibility, val: string) => onChange({ ...data, [field]: val });
  const assessed = [data.capacityFit, data.equipmentFit, data.regionFit].filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Feasibility Assessment" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{assessed}/3 assessed</Badge>}
        icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
      >
        <div className="space-y-2">
          {([
            { field: "capacityFit" as const, label: "Capacity" },
            { field: "equipmentFit" as const, label: "Equipment" },
            { field: "regionFit" as const, label: "Region" },
          ]).map(({ field, label }) => (
            <FieldRow key={field} label={label}>
              <div className="flex gap-1">
                {FIT_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => u(field, data[field] === o.value ? "" : o.value)}
                    className={`px-3 py-1 rounded text-[10px] font-medium border transition-all ${
                      data[field] === o.value
                        ? o.value === "fit" ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                          : o.value === "tight" ? "bg-amber-100 border-amber-300 text-amber-700"
                          : "bg-red-100 border-red-300 text-red-700"
                        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >{o.label}</button>
                ))}
              </div>
            </FieldRow>
          ))}
        </div>
      </Section>

      <Section title="Operations Input" defaultOpen={false}>
        <FieldRow label="Ops Comments"><FieldTextarea value={data.opsComments} onChange={v => u("opsComments", v)} placeholder="Operations team comments and feasibility notes..." rows={3} /></FieldRow>
        <FieldRow label="Risk Flags"><FieldTextarea value={data.riskFlags} onChange={v => u("riskFlags", v)} placeholder="Operational risks: capacity, timing, equipment, manpower..." rows={3} /></FieldRow>
      </Section>

      {data.capacityFit === "gap" && (
        <SignalCard type="critical" message="Capacity gap identified" recommendation="Escalate to operations before proceeding to pricing" />
      )}
      {data.equipmentFit === "gap" && (
        <SignalCard type="warning" message="Equipment gap identified" recommendation="Assess CAPEX requirements or vendor options" />
      )}
    </div>
  );
}
