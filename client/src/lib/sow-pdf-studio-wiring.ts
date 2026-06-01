/**
 * sow-pdf-studio-wiring.ts
 * ────────────────────────
 * Pure mapping layer between SOW capture data and PDF Studio structures.
 *
 * Rules:
 * - No database writes
 * - No AI generation
 * - No hardcoded tender facts
 * - No mutation of composer documents
 * - No overwrite of user-edited PDF Studio blocks
 * - Missing SOW fields map to empty/null safely
 * - Never invent fallback content
 *
 * These helpers prepare payloads ONLY. Actual snapshot creation
 * requires an explicit user action (future feature).
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
// Maps SOW data → scope_snapshot structure for PDF Studio bindings.
// Used by: scope.table block, {{scope.*}} tokens

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
  // Location: first site name, or null
  const firstSite = sow.sites.length > 0 ? sow.sites[0] : null;
  const location = firstSite
    ? [firstSite.site_name, firstSite.city].filter(Boolean).join(", ") || null
    : null;

  // Pallet positions: only when capacity_unit is Pallets
  const palletPositions =
    sow.warehousing.capacity_unit === "Pallets" && sow.warehousing.capacity_value
      ? Number(sow.warehousing.capacity_value) || null
      : null;

  // Storage type: joined list or null
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
// Maps SOW sla_kpis → sla_snapshot structure for PDF Studio bindings.
// Used by: annexure.b.sla_matrix block

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

// ═══════════════════════════════════════════════════════════
// SEMANTIC VARIABLES FROM SOW
// ═══════════════════════════════════════════════════════════
// Maps SOW data → semantic variable overrides for token resolution.
// Used by: {{scope.warehouse_location}}, {{scope.pallet_positions}}, {{scope.storage_type}}

export interface SemanticVariableOverride {
  key: string;
  value: unknown;
}

export function buildSemanticVariablesFromSowData(sow: SowData): SemanticVariableOverride[] {
  const overrides: SemanticVariableOverride[] = [];
  const scope = buildScopeSnapshotPayloadFromSowData(sow);

  if (scope.location) {
    overrides.push({ key: "scope.warehouse_location", value: scope.location });
  }
  if (scope.palletPositions !== null) {
    overrides.push({ key: "scope.pallet_positions", value: scope.palletPositions });
  }
  if (scope.storageType) {
    overrides.push({ key: "scope.storage_type", value: scope.storageType });
  }

  return overrides;
}

// ═══════════════════════════════════════════════════════════
// PDF STUDIO WIRING MAP (Static — for UI display)
// ═══════════════════════════════════════════════════════════
// Read-only mapping reference. Rendered in the SOW capture UI.

export interface WiringMapEntry {
  sowField: string;
  blockKey: string | null;
  semanticToken: string | null;
  proposalSection: string;
}

export const PDF_STUDIO_WIRING_MAP: WiringMapEntry[] = [
  { sowField: "Scope Summary", blockKey: "scope.list", semanticToken: null, proposalSection: "Executive Summary / Understanding of Requirement" },
  { sowField: "Service Lines", blockKey: "scope.list", semanticToken: null, proposalSection: "Scope of Services" },
  { sowField: "Warehousing — Storage Types", blockKey: "scope.table", semanticToken: "{{scope.storage_type}}", proposalSection: "Warehouse Solution Description" },
  { sowField: "Warehousing — Capacity", blockKey: "scope.table", semanticToken: "{{scope.pallet_positions}}", proposalSection: "Warehouse Solution Description" },
  { sowField: "Warehousing — Activities", blockKey: "scope.table", semanticToken: null, proposalSection: "Service Configuration (Annexure A)" },
  { sowField: "Transportation Scope", blockKey: null, semanticToken: null, proposalSection: "Transport Methodology" },
  { sowField: "Transport Lanes", blockKey: null, semanticToken: null, proposalSection: "Transport Route Schedule" },
  { sowField: "Technology / Systems", blockKey: "annexure.a.config", semanticToken: null, proposalSection: "Technology & Systems" },
  { sowField: "SLA / KPI Requirements", blockKey: "annexure.b.sla_matrix", semanticToken: null, proposalSection: "SLA Commitment (Annexure B)" },
  { sowField: "Locations / Sites", blockKey: null, semanticToken: "{{scope.warehouse_location}}", proposalSection: "Geographic Coverage" },
  { sowField: "Compliance / HSE", blockKey: null, semanticToken: null, proposalSection: "Compliance & Certifications" },
  { sowField: "Assumptions", blockKey: null, semanticToken: null, proposalSection: "Assumptions & Dependencies" },
  { sowField: "Exclusions", blockKey: null, semanticToken: null, proposalSection: "Technical / Commercial Exclusions" },
  { sowField: "Clarifications", blockKey: null, semanticToken: null, proposalSection: "Clarification Log (Submission)" },
];
