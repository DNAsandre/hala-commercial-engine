/**
 * sow-data-types.ts
 * ────────────────────────
 * Pure SOW (Scope of Work) data structures for tender capture.
 *
 * Previously part of discontinued document-studio wiring.
 * Old document-studio references have been removed — this file now contains
 * only the SOW types and helpers used by tender scope capture.
 *
 * Rules:
 * - No database writes
 * - No AI generation
 * - No hardcoded tender facts
 * - Missing SOW fields map to empty/null safely
 * - Never invent fallback content
 */

// ═══════════════════════════════════════════════════════════
// SOW DATA TYPES
// ═══════════════════════════════════════════════════════════

export interface SowTransportLane {
  origin: string;
  destination: string;
  frequency: string;
  estimated_trips: string;
  sla_requirement: string;
  special_handling: string;
  notes: string;
}

export interface SowSlaKpi {
  name: string;
  target: string;
  measurement_tool: string;
  source: string;
  hala_response: string; // Compliant | Partially Compliant | Not Compliant | Clarification Required | Not Applicable
  notes: string;
}

export interface SowSite {
  region: string;
  city: string;
  site_name: string;
  site_type: string;
  address: string;
  notes: string;
}

export interface SowClarification {
  question: string;
  source_reference: string;
  status: string; // Draft | Submitted | Answered | Closed
  buyer_response: string;
}

export interface SowData {
  scope_summary: string;
  service_lines: string[];
  warehousing: {
    storage_types: string[];
    capacity_value: string;
    capacity_unit: string;
    activities: string[];
    notes: string;
  };
  transport: {
    required: boolean;
    models: string[];
    vehicle_types: string[];
    lanes: SowTransportLane[];
  };
  technology: {
    systems: string[];
    integration_notes: string;
  };
  sla_kpis: SowSlaKpi[];
  execution_regions: string[];
  sites: SowSite[];
  compliance: {
    requirements: string[];
    notes: string;
  };
  assumptions: string;
  exclusions: string;
  clarifications: SowClarification[];
  internal_notes: string;
}

export function emptySowData(): SowData {
  return {
    scope_summary: "",
    service_lines: [],
    warehousing: { storage_types: [], capacity_value: "", capacity_unit: "", activities: [], notes: "" },
    transport: { required: false, models: [], vehicle_types: [], lanes: [] },
    technology: { systems: [], integration_notes: "" },
    sla_kpis: [],
    execution_regions: [],
    sites: [],
    compliance: { requirements: [], notes: "" },
    assumptions: "",
    exclusions: "",
    clarifications: [],
    internal_notes: "",
  };
}

// ═══════════════════════════════════════════════════════════
// SCOPE SNAPSHOT PAYLOAD
// ═══════════════════════════════════════════════════════════

export interface ScopeSnapshotPayload {
  location: string | null;
  palletPositions: number | null;
  storageType: string | null;
  serviceLines: string[];
  warehouseActivities: string[];
  transportModels: string[];
  vehicleTypes: string[];
  technologySystems: string[];
  executionRegions: string[];
  sites: SowSite[];
  scopeSummary: string | null;
  capacityValue: string | null;
  capacityUnit: string | null;
}

export function buildScopeSnapshotPayloadFromSowData(sow: SowData): ScopeSnapshotPayload {
  const firstSite = sow.sites.length > 0 ? sow.sites[0] : null;
  const location = firstSite
    ? [firstSite.site_name, firstSite.city].filter(Boolean).join(", ") || null
    : null;

  const palletPositions =
    sow.warehousing.capacity_unit === "Pallets" && sow.warehousing.capacity_value
      ? Number(sow.warehousing.capacity_value) || null
      : null;

  const storageType =
    sow.warehousing.storage_types.length > 0
      ? sow.warehousing.storage_types.join(", ")
      : null;

  return {
    location,
    palletPositions,
    storageType,
    serviceLines: sow.service_lines,
    warehouseActivities: sow.warehousing.activities,
    transportModels: sow.transport.models,
    vehicleTypes: sow.transport.vehicle_types,
    technologySystems: sow.technology.systems,
    executionRegions: sow.execution_regions,
    sites: sow.sites,
    scopeSummary: sow.scope_summary || null,
    capacityValue: sow.warehousing.capacity_value || null,
    capacityUnit: sow.warehousing.capacity_unit || null,
  };
}

// ═══════════════════════════════════════════════════════════
// SLA SNAPSHOT PAYLOAD
// ═══════════════════════════════════════════════════════════

export interface SlaSnapshotPayload {
  kpis: Array<{
    name: string;
    target: string;
    measurementTool: string;
    source: string;
    halaResponse: string;
    notes: string;
  }>;
  complianceRequirements: string[];
  complianceNotes: string | null;
}

export function buildSlaSnapshotPayloadFromSowData(sow: SowData): SlaSnapshotPayload {
  return {
    kpis: sow.sla_kpis.map(k => ({
      name: k.name,
      target: k.target,
      measurementTool: k.measurement_tool,
      source: k.source,
      halaResponse: k.hala_response,
      notes: k.notes,
    })),
    complianceRequirements: sow.compliance.requirements,
    complianceNotes: sow.compliance.notes || null,
  };
}
