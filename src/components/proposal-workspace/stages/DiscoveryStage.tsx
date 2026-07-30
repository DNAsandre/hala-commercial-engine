/**
 * Stage 2 — DISCOVERY
 * Capture commercial truth from customer interaction.
 *
 * Tabs: Meeting Notes | Customer Needs | Current Pain | Volumes/Lanes | Risks & Assumptions
 */
import { useState } from "react";
import { MessageSquare, Users, Zap, Package, Shield, Plus, Trash2, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Section, FieldRow, FieldInput, FieldTextarea, ReadinessBadge, SignalCard,
} from "../ui-primitives";
import type {
  MeetingNote, CustomerNeeds, CurrentPain, VolumesLanesStorage, RisksAssumptions,
} from "../proposal-workspace-state";

// ═══════════════════════════════════════════════════════════
// TAB: Meeting Notes
// ═══════════════════════════════════════════════════════════

export function MeetingNotesTab({
  data, onChange,
}: {
  data: MeetingNote[];
  onChange: (d: MeetingNote[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addNote = () => {
    const note: MeetingNote = {
      id: `mn-${Date.now()}`,
      date: "",
      attendees: "", notes: "", keyDecisions: "", openQuestions: "", nextActions: "",
    };
    onChange([note, ...data]);
    setExpandedId(note.id);
  };

  const updateNote = (id: string, field: keyof MeetingNote, val: string) => {
    onChange(data.map(n => n.id === id ? { ...n, [field]: val } : n));
  };

  const removeNote = (id: string) => {
    onChange(data.filter(n => n.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold">Meeting Notes</span>
          <Badge variant="outline" className="text-[9px]">{data.length} meetings</Badge>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={addNote}>
          <Plus className="w-3 h-3" /> Add Meeting
        </Button>
      </div>

      {data.length === 0 && (
        <SignalCard type="info" message="No meeting notes captured" recommendation="Record discovery meeting details to build commercial intelligence" />
      )}

      {data.map(note => (
        <div key={note.id} className="border border-border rounded-lg bg-background">
          <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                className="text-left text-sm font-medium hover:text-cyan-700"
              >
                {note.date || "No date"}
              </button>
              {note.attendees && <span className="text-xs text-muted-foreground">· {note.attendees.split(",").length} attendees</span>}
              {note.notes && <Badge variant="outline" className="text-[8px] border-emerald-200 text-emerald-600">Has notes</Badge>}
            </div>
            <button type="button" onClick={() => removeNote(note.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors" aria-label="Remove meeting note">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {expandedId === note.id && (
            <div className="px-4 pb-4 pt-1 space-y-0.5">
              <FieldRow label="Date"><FieldInput type="date" value={note.date} onChange={v => updateNote(note.id, "date", v)} /></FieldRow>
              <FieldRow label="Attendees"><FieldInput value={note.attendees} onChange={v => updateNote(note.id, "attendees", v)} placeholder="Name 1, Name 2, ..." /></FieldRow>
              <FieldRow label="Notes"><FieldTextarea value={note.notes} onChange={v => updateNote(note.id, "notes", v)} placeholder="Meeting summary and key discussion points" rows={4} /></FieldRow>
              <FieldRow label="Key Decisions"><FieldTextarea value={note.keyDecisions} onChange={v => updateNote(note.id, "keyDecisions", v)} placeholder="Decisions made during this meeting" rows={2} /></FieldRow>
              <FieldRow label="Open Questions"><FieldTextarea value={note.openQuestions} onChange={v => updateNote(note.id, "openQuestions", v)} placeholder="Unresolved questions" rows={2} /></FieldRow>
              <FieldRow label="Next Actions"><FieldTextarea value={note.nextActions} onChange={v => updateNote(note.id, "nextActions", v)} placeholder="Action items with owners" rows={2} /></FieldRow>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Customer Needs
// ═══════════════════════════════════════════════════════════

export function CustomerNeedsTab({
  data, onChange,
}: {
  data: CustomerNeeds;
  onChange: (d: CustomerNeeds) => void;
}) {
  const u = (field: keyof CustomerNeeds, val: string) => onChange({ ...data, [field]: val });
  const filled = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Service Requirements" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{filled}/6 captured</Badge>}
        icon={<Users className="w-4 h-4 text-blue-500" />}
      >
        <div className="space-y-0.5">
          <FieldRow label="Warehousing"><FieldTextarea value={data.warehousing} onChange={v => u("warehousing", v)} placeholder="Storage needs, pallet positions, temp requirements..." rows={2} /></FieldRow>
          <FieldRow label="Transport"><FieldTextarea value={data.transport} onChange={v => u("transport", v)} placeholder="Delivery requirements, lanes, frequency..." rows={2} /></FieldRow>
          <FieldRow label="VAS"><FieldTextarea value={data.vas} onChange={v => u("vas", v)} placeholder="Value-added services: labeling, kitting, co-packing..." rows={2} /></FieldRow>
          <FieldRow label="Reporting"><FieldTextarea value={data.reporting} onChange={v => u("reporting", v)} placeholder="Reporting frequency, KPIs, dashboards..." rows={2} /></FieldRow>
          <FieldRow label="Compliance"><FieldTextarea value={data.compliance} onChange={v => u("compliance", v)} placeholder="Regulatory, SFDA, customs, quality..." rows={2} /></FieldRow>
          <FieldRow label="SLA Expectations"><FieldTextarea value={data.slaExpectations} onChange={v => u("slaExpectations", v)} placeholder="Service levels, penalties, response times..." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Current Pain
// ═══════════════════════════════════════════════════════════

export function CurrentPainTab({
  data, onChange,
}: {
  data: CurrentPain;
  onChange: (d: CurrentPain) => void;
}) {
  const u = (field: keyof CurrentPain, val: string) => onChange({ ...data, [field]: val });

  return (
    <div className="space-y-1">
      <Section title="Customer Pain Points" defaultOpen icon={<Zap className="w-4 h-4 text-amber-500" />}>
        <div className="space-y-0.5">
          <FieldRow label="Current Provider"><FieldTextarea value={data.currentProvider} onChange={v => u("currentProvider", v)} placeholder="Current 3PL provider and key issues" rows={2} /></FieldRow>
          <FieldRow label="Cost Pain"><FieldTextarea value={data.costPain} onChange={v => u("costPain", v)} placeholder="Cost pressure, budget constraints, overcharges..." rows={2} /></FieldRow>
          <FieldRow label="Service Pain"><FieldTextarea value={data.servicePain} onChange={v => u("servicePain", v)} placeholder="Service failures, SLA breaches, quality issues..." rows={2} /></FieldRow>
          <FieldRow label="Speed Pain"><FieldTextarea value={data.speedPain} onChange={v => u("speedPain", v)} placeholder="Delivery delays, processing time, response gaps..." rows={2} /></FieldRow>
          <FieldRow label="Compliance Pain"><FieldTextarea value={data.compliancePain} onChange={v => u("compliancePain", v)} placeholder="Regulatory issues, audit failures, documentation gaps..." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Volumes / Lanes / Storage
// ═══════════════════════════════════════════════════════════

export function VolumesLanesTab({
  data, onChange,
}: {
  data: VolumesLanesStorage;
  onChange: (d: VolumesLanesStorage) => void;
}) {
  const u = (field: keyof VolumesLanesStorage, val: string) => onChange({ ...data, [field]: val });
  const filled = Object.values(data).filter(Boolean).length;

  return (
    <div className="space-y-1">
      <Section title="Volume Data" defaultOpen
        badge={<Badge variant="outline" className="text-[9px]">{filled}/8 captured</Badge>}
        icon={<Package className="w-4 h-4 text-[#0b73ff]" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <FieldRow label="SKU Count"><FieldInput value={data.skuCount} onChange={v => u("skuCount", v)} placeholder="e.g. 2,500 SKUs" /></FieldRow>
          <FieldRow label="Pallets"><FieldInput value={data.pallets} onChange={v => u("pallets", v)} placeholder="e.g. 8,000 pallet positions" /></FieldRow>
          <FieldRow label="Inbound"><FieldInput value={data.inbound} onChange={v => u("inbound", v)} placeholder="e.g. 200 pallets/day" /></FieldRow>
          <FieldRow label="Outbound"><FieldInput value={data.outbound} onChange={v => u("outbound", v)} placeholder="e.g. 180 pallets/day" /></FieldRow>
          <FieldRow label="Locations"><FieldInput value={data.locations} onChange={v => u("locations", v)} placeholder="e.g. Riyadh, Jeddah" /></FieldRow>
          <FieldRow label="Temp Zones"><FieldInput value={data.tempZones} onChange={v => u("tempZones", v)} placeholder="e.g. Ambient, Chilled 2-8°C" /></FieldRow>
        </div>
      </Section>

      <Section title="Route & Seasonality" defaultOpen={false}>
        <FieldRow label="Lane Matrix"><FieldTextarea value={data.laneMatrix} onChange={v => u("laneMatrix", v)} placeholder="Origin → Destination lanes, frequency, FTL/LTL..." rows={3} /></FieldRow>
        <FieldRow label="Peak Seasonality"><FieldTextarea value={data.peakSeasonality} onChange={v => u("peakSeasonality", v)} placeholder="Ramadan, summer, back-to-school, year-end..." rows={2} /></FieldRow>
      </Section>

      {!data.pallets && !data.skuCount && (
        <SignalCard type="warning" message="Missing volume data" recommendation="Capture pallet and SKU volumes — essential for Solution Design and P&L" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB: Risks & Assumptions
// ═══════════════════════════════════════════════════════════

export function RisksAssumptionsTab({
  data, onChange,
}: {
  data: RisksAssumptions;
  onChange: (d: RisksAssumptions) => void;
}) {
  const u = (field: keyof RisksAssumptions, val: string) => onChange({ ...data, [field]: val });

  return (
    <div className="space-y-1">
      <Section title="Risk & Assumption Register" defaultOpen icon={<Shield className="w-4 h-4 text-red-400" />}>
        <div className="space-y-0.5">
          <FieldRow label="Unknowns"><FieldTextarea value={data.unknowns} onChange={v => u("unknowns", v)} placeholder="What don't we know yet?" rows={2} /></FieldRow>
          <FieldRow label="Data Gaps"><FieldTextarea value={data.dataGaps} onChange={v => u("dataGaps", v)} placeholder="Missing customer data, incomplete volumes..." rows={2} /></FieldRow>
          <FieldRow label="Customer Risk"><FieldTextarea value={data.customerUncertainty} onChange={v => u("customerUncertainty", v)} placeholder="Customer decision uncertainty, budget risk..." rows={2} /></FieldRow>
          <FieldRow label="Capacity"><FieldTextarea value={data.capacityAssumptions} onChange={v => u("capacityAssumptions", v)} placeholder="Assumed capacity, equipment, manpower availability..." rows={2} /></FieldRow>
          <FieldRow label="Commercial"><FieldTextarea value={data.commercialAssumptions} onChange={v => u("commercialAssumptions", v)} placeholder="Pricing assumptions, margin expectations..." rows={2} /></FieldRow>
        </div>
      </Section>
    </div>
  );
}
