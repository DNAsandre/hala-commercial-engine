/*
 * Semantic Variable Engine — Deterministic Token Resolution System
 * 
 * Architecture:
 *   VariableDefinition = Schema for a single token (key, type, scope, source, binding)
 *   VariableSet = Collection of variables scoped to a doc_type or template version
 *   DocVariableOverride = Per-document instance value overrides
 *   TokenResolver = Deterministic resolution pipeline with hierarchical precedence
 *
 * Token Syntax:
 *   {{token}}                 — simple token
 *   {{namespace.token}}       — scoped token
 *   {{#if token}}...{{/if}}   — conditional block
 *
 * Resolution Precedence (highest → lowest):
 *   1. Record-specific overrides (doc_instance variable overrides)
 *   2. Template-level defaults
 *   3. Global defaults
 *
 * Missing Token Handling (per variable's fallback_mode):
 *   'empty'         → replace with blank + warning
 *   'warning'       → replace with ⚠ MISSING: {{token}} and report
 *   'block_compile' → fail compile with error list
 *
 * No-AI-Creep: Token resolution is purely deterministic. Never hallucinate values.
 */

// ============================================================
// ENUMS & TYPES
// ============================================================

export type VariableDataType =
  | "text" | "number" | "currency" | "date"
  | "percent" | "boolean" | "image" | "table";

export type VariableScope = "global" | "template" | "record";
export type VariableSource = "static" | "binding" | "computed";
export type FallbackMode = "empty" | "warning" | "block_compile";

export interface VariableDefinition {
  id: string;
  key: string;                          // e.g. "customer.name", "quote.total"
  label: string;
  description: string;
  data_type: VariableDataType;
  scope: VariableScope;
  source: VariableSource;
  binding_path: string | null;          // e.g. "customer.name", "pricing_snapshot.total"
  default_value_json: unknown | null;
  allowed_in_doc_types: string[];       // empty = all doc types
  namespace: string;                    // derived from key prefix: "customer", "quote", etc.
  created_by: string;
  created_at: string;
}

export interface VariableSet {
  id: string;
  name: string;
  doc_type: string;
  template_version_id: string | null;
  variable_ids: string[];               // references to VariableDefinition.id
  created_at: string;
}

export interface VariableSetItem {
  id: string;
  variable_set_id: string;
  variable_definition_id: string;
  required: boolean;
  fallback_mode: FallbackMode;
}

export interface DocVariableOverride {
  id: string;
  doc_instance_id: string;
  key: string;
  value_json: unknown;
  created_by: string;
  created_at: string;
}

// ============================================================
// TOKEN RESOLUTION TYPES
// ============================================================

export interface MissingToken {
  key: string;
  label: string;
  fallback_mode: FallbackMode;
  severity: "info" | "warning" | "error";
}

export interface TokenResolutionResult {
  renderedText: string;
  missingTokens: MissingToken[];
  resolvedCount: number;
  totalTokens: number;
  hasBlockingErrors: boolean;
}

export interface ResolutionContext {
  recordOverrides: Record<string, unknown>;
  templateDefaults: Record<string, unknown>;
  globalDefaults: Record<string, unknown>;
  entityBindings: Record<string, unknown>;
}

// ============================================================
// NAMESPACE CONFIGURATION
// ============================================================

export interface NamespaceConfig {
  key: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
}

export const NAMESPACE_CONFIG: Record<string, NamespaceConfig> = {
  company: { key: "company", label: "Company", icon: "Building2", color: "text-blue-700", bg: "bg-blue-50" },
  customer: { key: "customer", label: "Customer", icon: "Users", color: "text-emerald-700", bg: "bg-emerald-50" },
  quote: { key: "quote", label: "Quote", icon: "FileCheck", color: "text-purple-700", bg: "bg-purple-50" },
  proposal: { key: "proposal", label: "Proposal", icon: "BookOpen", color: "text-indigo-700", bg: "bg-indigo-50" },
  sla: { key: "sla", label: "SLA", icon: "FileSignature", color: "text-amber-700", bg: "bg-amber-50" },
  pricing: { key: "pricing", label: "Pricing", icon: "DollarSign", color: "text-rose-700", bg: "bg-rose-50" },
  dates: { key: "dates", label: "Dates", icon: "Calendar", color: "text-teal-700", bg: "bg-teal-50" },
  contacts: { key: "contacts", label: "Contacts", icon: "Phone", color: "text-orange-700", bg: "bg-orange-50" },
  scope: { key: "scope", label: "Scope", icon: "ClipboardList", color: "text-cyan-700", bg: "bg-cyan-50" },
  ecr: { key: "ecr", label: "ECR", icon: "BarChart3", color: "text-violet-700", bg: "bg-violet-50" },
};

// ============================================================
// VARIABLE DEFINITIONS — SEED DATA
// ============================================================

export const variableDefinitions: VariableDefinition[] = [
  // === Company namespace ===
  {
    id: "vd-001", key: "company.name", label: "Company Name", description: "Legal entity name of Hala",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "Hala Supply Chain Services", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-002", key: "company.legal_name", label: "Company Legal Name", description: "Full legal entity name",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "Hala Supply Chain Services Co. Ltd.", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-003", key: "company.cr_number", label: "CR Number", description: "Commercial Registration number",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "2050123456", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-004", key: "company.vat_number", label: "VAT Number", description: "VAT registration number",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "300012345600003", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-005", key: "company.address", label: "Company Address", description: "Headquarters address",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "King Fahd Industrial City, Dammam 31482, Saudi Arabia", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-006", key: "company.phone", label: "Company Phone", description: "Main phone number",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "+966 13 812 0000", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-007", key: "company.email", label: "Company Email", description: "Main contact email",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "commercial@halascs.com", allowed_in_doc_types: [],
    namespace: "company", created_by: "System", created_at: "2026-01-01",
  },

  // === Customer namespace ===
  {
    id: "vd-010", key: "customer.name", label: "Customer Name", description: "Customer company name",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.name",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-011", key: "customer.code", label: "Customer Code", description: "Customer account code",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.code",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-012", key: "customer.industry", label: "Customer Industry", description: "Customer industry sector",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.industry",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-013", key: "customer.city", label: "Customer City", description: "Customer primary city",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.city",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-014", key: "customer.contact_name", label: "Customer Contact", description: "Primary contact person name",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.contactName",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-015", key: "customer.contact_email", label: "Customer Email", description: "Primary contact email",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.contactEmail",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-016", key: "customer.contact_phone", label: "Customer Phone", description: "Primary contact phone",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.contactPhone",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "customer", created_by: "System", created_at: "2026-01-01",
  },

  // === Quote namespace ===
  {
    id: "vd-020", key: "quote.ref_number", label: "Quote Reference", description: "Quote reference number",
    data_type: "text", scope: "record", source: "binding", binding_path: "quote.refNumber",
    default_value_json: null, allowed_in_doc_types: ["quote"],
    namespace: "quote", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-021", key: "quote.total", label: "Quote Total", description: "Total quote amount (SAR)",
    data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.total",
    default_value_json: null, allowed_in_doc_types: ["quote", "proposal"],
    namespace: "quote", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-022", key: "quote.monthly_total", label: "Monthly Total", description: "Estimated monthly total (SAR)",
    data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.monthlyTotal",
    default_value_json: null, allowed_in_doc_types: ["quote", "proposal"],
    namespace: "quote", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-023", key: "quote.validity_days", label: "Quote Validity", description: "Quote validity in days",
    data_type: "number", scope: "template", source: "static", binding_path: null,
    default_value_json: 30, allowed_in_doc_types: ["quote"],
    namespace: "quote", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-024", key: "quote.discount", label: "Discount %", description: "Applied discount percentage",
    data_type: "percent", scope: "record", source: "binding", binding_path: "pricing_snapshot.discount",
    default_value_json: null, allowed_in_doc_types: ["quote", "proposal"],
    namespace: "quote", created_by: "System", created_at: "2026-01-01",
  },

  // === Proposal namespace ===
  {
    id: "vd-030", key: "proposal.ref_number", label: "Proposal Reference", description: "Proposal reference number",
    data_type: "text", scope: "record", source: "binding", binding_path: "proposal.refNumber",
    default_value_json: null, allowed_in_doc_types: ["proposal"],
    namespace: "proposal", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-031", key: "proposal.title", label: "Proposal Title", description: "Proposal document title",
    data_type: "text", scope: "record", source: "static", binding_path: null,
    default_value_json: "Commercial Proposal", allowed_in_doc_types: ["proposal"],
    namespace: "proposal", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-032", key: "proposal.contract_duration", label: "Contract Duration", description: "Proposed contract duration",
    data_type: "text", scope: "template", source: "static", binding_path: null,
    default_value_json: "24 months", allowed_in_doc_types: ["proposal"],
    namespace: "proposal", created_by: "System", created_at: "2026-01-01",
  },

  // === SLA namespace ===
  {
    id: "vd-040", key: "sla.ref_number", label: "SLA Reference", description: "SLA reference number",
    data_type: "text", scope: "record", source: "binding", binding_path: "sla.refNumber",
    default_value_json: null, allowed_in_doc_types: ["sla"],
    namespace: "sla", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-041", key: "sla.review_frequency", label: "SLA Review Frequency", description: "How often SLA is reviewed",
    data_type: "text", scope: "template", source: "static", binding_path: null,
    default_value_json: "Quarterly", allowed_in_doc_types: ["sla"],
    namespace: "sla", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-042", key: "sla.penalty_cap", label: "Penalty Cap %", description: "Maximum penalty as % of monthly invoice",
    data_type: "percent", scope: "template", source: "static", binding_path: null,
    default_value_json: 10, allowed_in_doc_types: ["sla"],
    namespace: "sla", created_by: "System", created_at: "2026-01-01",
  },

  // === Pricing namespace ===
  {
    id: "vd-050", key: "pricing.total", label: "Pricing Total", description: "Total pricing amount from snapshot",
    data_type: "currency", scope: "record", source: "binding", binding_path: "pricing_snapshot.total",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "pricing", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-051", key: "pricing.currency", label: "Currency", description: "Pricing currency",
    data_type: "text", scope: "global", source: "static", binding_path: null,
    default_value_json: "SAR", allowed_in_doc_types: [],
    namespace: "pricing", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-052", key: "pricing.vat_rate", label: "VAT Rate", description: "Applied VAT rate",
    data_type: "percent", scope: "global", source: "static", binding_path: null,
    default_value_json: 15, allowed_in_doc_types: [],
    namespace: "pricing", created_by: "System", created_at: "2026-01-01",
  },

  // === Dates namespace ===
  {
    id: "vd-060", key: "dates.document_date", label: "Document Date", description: "Date document was created",
    data_type: "date", scope: "record", source: "computed", binding_path: null,
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "dates", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-061", key: "dates.contract_start", label: "Contract Start Date", description: "Proposed contract start date",
    data_type: "date", scope: "record", source: "static", binding_path: null,
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "dates", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-062", key: "dates.contract_end", label: "Contract End Date", description: "Contract expiry date",
    data_type: "date", scope: "record", source: "binding", binding_path: "customer.contractExpiry",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "dates", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-063", key: "dates.validity_expiry", label: "Validity Expiry", description: "Quote/proposal validity expiry date",
    data_type: "date", scope: "record", source: "computed", binding_path: null,
    default_value_json: null, allowed_in_doc_types: ["quote", "proposal"],
    namespace: "dates", created_by: "System", created_at: "2026-01-01",
  },

  // === Contacts namespace ===
  {
    id: "vd-070", key: "contacts.prepared_by", label: "Prepared By", description: "Name of person who prepared the document",
    data_type: "text", scope: "record", source: "static", binding_path: null,
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "contacts", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-071", key: "contacts.approved_by", label: "Approved By", description: "Name of person who approved the document",
    data_type: "text", scope: "record", source: "static", binding_path: null,
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "contacts", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-072", key: "contacts.account_manager", label: "Account Manager", description: "Assigned account manager",
    data_type: "text", scope: "record", source: "binding", binding_path: "customer.accountManager",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "contacts", created_by: "System", created_at: "2026-01-01",
  },

  // === Scope namespace ===
  {
    id: "vd-080", key: "scope.warehouse_location", label: "Warehouse Location", description: "Primary warehouse facility location",
    data_type: "text", scope: "record", source: "binding", binding_path: "scope_snapshot.location",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "scope", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-081", key: "scope.pallet_positions", label: "Pallet Positions", description: "Number of pallet positions",
    data_type: "number", scope: "record", source: "binding", binding_path: "scope_snapshot.palletPositions",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "scope", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-082", key: "scope.storage_type", label: "Storage Type", description: "Type of storage (ambient, cold, etc.)",
    data_type: "text", scope: "record", source: "binding", binding_path: "scope_snapshot.storageType",
    default_value_json: "Ambient", allowed_in_doc_types: [],
    namespace: "scope", created_by: "System", created_at: "2026-01-01",
  },

  // === ECR namespace ===
  {
    id: "vd-090", key: "ecr.score", label: "ECR Score", description: "Customer ECR score",
    data_type: "number", scope: "record", source: "binding", binding_path: "ecr_snapshot.score",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "ecr", created_by: "System", created_at: "2026-01-01",
  },
  {
    id: "vd-091", key: "ecr.risk_tier", label: "ECR Risk Tier", description: "Customer risk tier from ECR",
    data_type: "text", scope: "record", source: "binding", binding_path: "ecr_snapshot.riskTier",
    default_value_json: null, allowed_in_doc_types: [],
    namespace: "ecr", created_by: "System", created_at: "2026-01-01",
  },
];

// ============================================================
// VARIABLE SETS — SEED DATA
// ============================================================

export const variableSets: VariableSet[] = [
  {
    id: "vs-001", name: "Quote Standard Variables", doc_type: "quote",
    template_version_id: null,
    variable_ids: ["vd-001", "vd-002", "vd-003", "vd-004", "vd-005", "vd-006", "vd-007",
      "vd-010", "vd-011", "vd-012", "vd-013", "vd-014", "vd-015", "vd-016",
      "vd-020", "vd-021", "vd-022", "vd-023", "vd-024",
      "vd-050", "vd-051", "vd-052",
      "vd-060", "vd-061", "vd-063",
      "vd-070", "vd-071", "vd-072"],
    created_at: "2026-01-01",
  },
  {
    id: "vs-002", name: "Proposal Standard Variables", doc_type: "proposal",
    template_version_id: null,
    variable_ids: ["vd-001", "vd-002", "vd-003", "vd-004", "vd-005", "vd-006", "vd-007",
      "vd-010", "vd-011", "vd-012", "vd-013", "vd-014", "vd-015", "vd-016",
      "vd-030", "vd-031", "vd-032",
      "vd-021", "vd-022", "vd-024",
      "vd-050", "vd-051", "vd-052",
      "vd-060", "vd-061", "vd-062", "vd-063",
      "vd-070", "vd-071", "vd-072",
      "vd-080", "vd-081", "vd-082",
      "vd-090", "vd-091"],
    created_at: "2026-01-01",
  },
  {
    id: "vs-003", name: "SLA Standard Variables", doc_type: "sla",
    template_version_id: null,
    variable_ids: ["vd-001", "vd-002", "vd-003", "vd-004", "vd-005", "vd-006", "vd-007",
      "vd-010", "vd-011", "vd-012", "vd-013", "vd-014", "vd-015", "vd-016",
      "vd-040", "vd-041", "vd-042",
      "vd-050", "vd-051", "vd-052",
      "vd-060", "vd-061", "vd-062",
      "vd-070", "vd-071", "vd-072",
      "vd-080", "vd-081", "vd-082",
      "vd-090", "vd-091"],
    created_at: "2026-01-01",
  },
  {
    id: "vs-004", name: "MSA Standard Variables", doc_type: "msa",
    template_version_id: null,
    variable_ids: ["vd-001", "vd-002", "vd-003", "vd-004", "vd-005", "vd-006", "vd-007",
      "vd-010", "vd-011", "vd-012", "vd-013", "vd-014", "vd-015", "vd-016",
      "vd-060", "vd-061", "vd-062",
      "vd-070", "vd-071", "vd-072"],
    created_at: "2026-01-01",
  },
  {
    id: "vs-005", name: "Service Order Variables", doc_type: "service_order_transport",
    template_version_id: null,
    variable_ids: ["vd-001", "vd-002", "vd-003", "vd-004", "vd-005", "vd-006", "vd-007",
      "vd-010", "vd-011", "vd-012", "vd-013", "vd-014", "vd-015", "vd-016",
      "vd-050", "vd-051", "vd-052",
      "vd-060", "vd-061", "vd-062",
      "vd-070", "vd-071", "vd-072",
      "vd-080", "vd-081", "vd-082"],
    created_at: "2026-01-01",
  },
];

// ============================================================
// VARIABLE SET ITEMS — SEED DATA
// ============================================================

export const variableSetItems: VariableSetItem[] = [
  // Quote set — key required items
  { id: "vsi-001", variable_set_id: "vs-001", variable_definition_id: "vd-001", required: true, fallback_mode: "warning" },
  { id: "vsi-002", variable_set_id: "vs-001", variable_definition_id: "vd-010", required: true, fallback_mode: "block_compile" },
  { id: "vsi-003", variable_set_id: "vs-001", variable_definition_id: "vd-020", required: true, fallback_mode: "block_compile" },
  { id: "vsi-004", variable_set_id: "vs-001", variable_definition_id: "vd-021", required: true, fallback_mode: "warning" },
  { id: "vsi-005", variable_set_id: "vs-001", variable_definition_id: "vd-060", required: true, fallback_mode: "empty" },
  // Proposal set — key required items
  { id: "vsi-010", variable_set_id: "vs-002", variable_definition_id: "vd-001", required: true, fallback_mode: "warning" },
  { id: "vsi-011", variable_set_id: "vs-002", variable_definition_id: "vd-010", required: true, fallback_mode: "block_compile" },
  { id: "vsi-012", variable_set_id: "vs-002", variable_definition_id: "vd-030", required: true, fallback_mode: "block_compile" },
  { id: "vsi-013", variable_set_id: "vs-002", variable_definition_id: "vd-031", required: true, fallback_mode: "warning" },
  { id: "vsi-014", variable_set_id: "vs-002", variable_definition_id: "vd-090", required: false, fallback_mode: "empty" },
  // SLA set — key required items
  { id: "vsi-020", variable_set_id: "vs-003", variable_definition_id: "vd-001", required: true, fallback_mode: "warning" },
  { id: "vsi-021", variable_set_id: "vs-003", variable_definition_id: "vd-010", required: true, fallback_mode: "block_compile" },
  { id: "vsi-022", variable_set_id: "vs-003", variable_definition_id: "vd-040", required: true, fallback_mode: "block_compile" },
  { id: "vsi-023", variable_set_id: "vs-003", variable_definition_id: "vd-041", required: true, fallback_mode: "warning" },
];

// ============================================================
// DOC VARIABLE OVERRIDES — SEED DATA
// ============================================================

export const docVariableOverrides: DocVariableOverride[] = [
  // SABIC proposal overrides
  {
    id: "dvo-001", doc_instance_id: "di-001", key: "customer.name",
    value_json: "SABIC", created_by: "Faisal Al-Rashid", created_at: "2026-02-01",
  },
  {
    id: "dvo-002", doc_instance_id: "di-001", key: "proposal.ref_number",
    value_json: "HCS-PR-2026-001", created_by: "Faisal Al-Rashid", created_at: "2026-02-01",
  },
  {
    id: "dvo-003", doc_instance_id: "di-001", key: "dates.document_date",
    value_json: "2026-02-01", created_by: "Faisal Al-Rashid", created_at: "2026-02-01",
  },
  {
    id: "dvo-004", doc_instance_id: "di-001", key: "contacts.prepared_by",
    value_json: "Faisal Al-Rashid", created_by: "Faisal Al-Rashid", created_at: "2026-02-01",
  },
  {
    id: "dvo-005", doc_instance_id: "di-001", key: "quote.monthly_total",
    value_json: "539,000", created_by: "Faisal Al-Rashid", created_at: "2026-02-01",
  },
  // Ma'aden SLA overrides
  {
    id: "dvo-010", doc_instance_id: "di-002", key: "customer.name",
    value_json: "Ma'aden", created_by: "Faisal Al-Rashid", created_at: "2026-02-05",
  },
  {
    id: "dvo-011", doc_instance_id: "di-002", key: "sla.ref_number",
    value_json: "HCS-SLA-2026-001", created_by: "Faisal Al-Rashid", created_at: "2026-02-05",
  },
  {
    id: "dvo-012", doc_instance_id: "di-002", key: "dates.document_date",
    value_json: "2026-02-05", created_by: "Faisal Al-Rashid", created_at: "2026-02-05",
  },
];

// ============================================================
// TOKEN RESOLUTION ENGINE — Deterministic Pipeline
// ============================================================

/**
 * Extract all token keys from a text string.
 * Matches both simple {{token}} and scoped {{namespace.token}} patterns.
 * Also detects conditional blocks {{#if token}}...{{/if}}.
 */
export function extractTokenKeys(text: string): string[] {
  const tokenRegex = /\{\{(?:#if\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;
  const keys: string[] = [];
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    if (!keys.includes(match[1])) {
      keys.push(match[1]);
    }
  }
  return keys;
}

/**
 * Resolve a single token value using hierarchical precedence.
 * 1. Record-specific overrides
 * 2. Template-level defaults
 * 3. Global defaults
 * Returns null if no value found at any level.
 */
function resolveTokenValue(key: string, context: ResolutionContext): unknown | null {
  // 1. Record-specific overrides (highest priority)
  if (key in context.recordOverrides && context.recordOverrides[key] != null) {
    return context.recordOverrides[key];
  }

  // 1b. Entity bindings (from bound snapshots)
  if (key in context.entityBindings && context.entityBindings[key] != null) {
    return context.entityBindings[key];
  }

  // 2. Template-level defaults
  if (key in context.templateDefaults && context.templateDefaults[key] != null) {
    return context.templateDefaults[key];
  }

  // 3. Global defaults
  if (key in context.globalDefaults && context.globalDefaults[key] != null) {
    return context.globalDefaults[key];
  }

  return null;
}

/**
 * Format a token value for display based on its data type.
 */
function formatTokenValue(value: unknown, dataType: VariableDataType): string {
  if (value == null) return "";
  switch (dataType) {
    case "currency":
      return typeof value === "number" ? `SAR ${value.toLocaleString()}` : String(value);
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "percent":
      return typeof value === "number" ? `${value}%` : String(value);
    case "date":
      return String(value);
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

/**
 * Get the fallback mode for a token key from variable set items.
 * Defaults to 'warning' if not found.
 */
function getFallbackMode(key: string, docType: string): FallbackMode {
  const varDef = variableDefinitions.find(v => v.key === key);
  if (!varDef) return "warning";

  const relevantSets = variableSets.filter(vs => vs.doc_type === docType);
  for (const set of relevantSets) {
    const item = variableSetItems.find(
      vsi => vsi.variable_set_id === set.id && vsi.variable_definition_id === varDef.id
    );
    if (item) return item.fallback_mode;
  }
  return "warning";
}

/**
 * Process conditional blocks: {{#if token}}...{{/if}}
 * Truthy if variable exists and is non-empty / true.
 */
function processConditionals(text: string, context: ResolutionContext): string {
  const conditionalRegex = /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_.]*)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  return text.replace(conditionalRegex, (_match, key: string, content: string) => {
    const value = resolveTokenValue(key, context);
    const isTruthy = value != null && value !== "" && value !== false && value !== 0;
    return isTruthy ? content : "";
  });
}

/**
 * Main token resolution function.
 * Resolves all tokens in a text string using the hierarchical context.
 * Returns rendered text + list of missing tokens with severity.
 */
export function resolveTokens(text: string, context: ResolutionContext, docType: string): TokenResolutionResult {
  const missingTokens: MissingToken[] = [];
  let resolvedCount = 0;

  // Step 1: Process conditionals first
  let processed = processConditionals(text, context);

  // Step 2: Extract remaining tokens
  const tokenKeys = extractTokenKeys(processed);
  const totalTokens = tokenKeys.length;

  // Step 3: Resolve each token
  for (const key of tokenKeys) {
    const value = resolveTokenValue(key, context);
    const varDef = variableDefinitions.find(v => v.key === key);
    const dataType = varDef?.data_type || "text";
    const label = varDef?.label || key;
    const fallbackMode = getFallbackMode(key, docType);

    if (value != null && value !== "") {
      // Token resolved successfully
      const formatted = formatTokenValue(value, dataType);
      const tokenPattern = new RegExp(`\\{\\{${key.replace(/\./g, "\\.")}\\}\\}`, "g");
      processed = processed.replace(tokenPattern, formatted);
      resolvedCount++;
    } else {
      // Token missing — apply fallback mode
      const tokenPattern = new RegExp(`\\{\\{${key.replace(/\./g, "\\.")}\\}\\}`, "g");

      switch (fallbackMode) {
        case "empty":
          processed = processed.replace(tokenPattern, "");
          missingTokens.push({ key, label, fallback_mode: "empty", severity: "info" });
          break;
        case "warning":
          processed = processed.replace(tokenPattern, `<span class="token-missing" style="color:#d97706;background:#fef3c7;padding:0 4px;border-radius:2px;font-size:0.85em;">⚠ MISSING: {{${key}}}</span>`);
          missingTokens.push({ key, label, fallback_mode: "warning", severity: "warning" });
          break;
        case "block_compile":
          processed = processed.replace(tokenPattern, `<span class="token-blocked" style="color:#dc2626;background:#fef2f2;padding:0 4px;border-radius:2px;font-size:0.85em;">🚫 REQUIRED: {{${key}}}</span>`);
          missingTokens.push({ key, label, fallback_mode: "block_compile", severity: "error" });
          break;
      }
    }
  }

  return {
    renderedText: processed,
    missingTokens,
    resolvedCount,
    totalTokens,
    hasBlockingErrors: missingTokens.some(t => t.fallback_mode === "block_compile"),
  };
}

// ============================================================
// CONTEXT BUILDER — Build resolution context from document data
// ============================================================

export function buildResolutionContext(
  docInstanceId: string,
  docType: string,
  customerData: Record<string, unknown> | null,
  entityBindings: Record<string, unknown>,
): ResolutionContext {
  // 1. Record overrides
  const recordOverrides: Record<string, unknown> = {};
  const overrides = docVariableOverrides.filter(o => o.doc_instance_id === docInstanceId);
  for (const override of overrides) {
    recordOverrides[override.key] = override.value_json;
  }

  // 2. Template defaults (from variable definitions with scope=template)
  const templateDefaults: Record<string, unknown> = {};
  const relevantVarIds = variableSets
    .filter(vs => vs.doc_type === docType)
    .flatMap(vs => vs.variable_ids);
  for (const varId of relevantVarIds) {
    const varDef = variableDefinitions.find(v => v.id === varId);
    if (varDef && varDef.scope === "template" && varDef.default_value_json != null) {
      templateDefaults[varDef.key] = varDef.default_value_json;
    }
  }

  // 3. Global defaults (from variable definitions with scope=global)
  const globalDefaults: Record<string, unknown> = {};
  for (const varDef of variableDefinitions) {
    if (varDef.scope === "global" && varDef.default_value_json != null) {
      globalDefaults[varDef.key] = varDef.default_value_json;
    }
  }

  // 4. Entity bindings — resolve from customer data and bound snapshots
  const resolvedBindings: Record<string, unknown> = { ...entityBindings };
  if (customerData) {
    for (const varDef of variableDefinitions) {
      if (varDef.source === "binding" && varDef.binding_path) {
        const parts = varDef.binding_path.split(".");
        if (parts[0] === "customer") {
          const fieldKey = parts.slice(1).join(".");
          const value = (customerData as Record<string, unknown>)[fieldKey];
          if (value != null) {
            resolvedBindings[varDef.key] = value;
          }
        }
      }
    }
  }

  // 5. Computed values
  const now = new Date();
  resolvedBindings["dates.document_date"] = now.toISOString().split("T")[0];

  return {
    recordOverrides,
    templateDefaults,
    globalDefaults,
    entityBindings: resolvedBindings,
  };
}

// ============================================================
// HELPERS
// ============================================================

/** Get all variable definitions for a given doc type */
export function getVariablesForDocType(docType: string): VariableDefinition[] {
  return variableDefinitions.filter(v =>
    v.allowed_in_doc_types.length === 0 || v.allowed_in_doc_types.includes(docType)
  );
}

/** Get variables grouped by namespace */
export function getVariablesGroupedByNamespace(docType: string): Record<string, VariableDefinition[]> {
  const vars = getVariablesForDocType(docType);
  const grouped: Record<string, VariableDefinition[]> = {};
  for (const v of vars) {
    if (!grouped[v.namespace]) grouped[v.namespace] = [];
    grouped[v.namespace].push(v);
  }
  return grouped;
}

/** Get variable definition by key */
export function getVariableByKey(key: string): VariableDefinition | undefined {
  return variableDefinitions.find(v => v.key === key);
}

/** Get overrides for a doc instance */
export function getOverridesForInstance(docInstanceId: string): DocVariableOverride[] {
  return docVariableOverrides.filter(o => o.doc_instance_id === docInstanceId);
}

/** Add or update an override for a doc instance */
export function setVariableOverride(
  docInstanceId: string, key: string, value: unknown, createdBy: string
): DocVariableOverride {
  const existing = docVariableOverrides.find(
    o => o.doc_instance_id === docInstanceId && o.key === key
  );
  if (existing) {
    existing.value_json = value;
    existing.created_at = new Date().toISOString();
    return existing;
  }
  const newOverride: DocVariableOverride = {
    id: `dvo-${Date.now()}`,
    doc_instance_id: docInstanceId,
    key,
    value_json: value,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
  docVariableOverrides.push(newOverride);
  return newOverride;
}

/** Get variable set for a doc type */
export function getVariableSetForDocType(docType: string): VariableSet | undefined {
  return variableSets.find(vs => vs.doc_type === docType);
}

/** Get variable set items with definitions */
export function getVariableSetItemsWithDefs(variableSetId: string): Array<VariableSetItem & { definition: VariableDefinition }> {
  return variableSetItems
    .filter(vsi => vsi.variable_set_id === variableSetId)
    .map(vsi => {
      const definition = variableDefinitions.find(v => v.id === vsi.variable_definition_id);
      return definition ? { ...vsi, definition } : null;
    })
    .filter((item): item is VariableSetItem & { definition: VariableDefinition } => item !== null);
}

/** Add a new variable definition (admin action) */
export function addVariableDefinition(def: Omit<VariableDefinition, "id" | "created_at" | "namespace">): VariableDefinition {
  const namespace = def.key.split(".")[0] || "custom";
  const newDef: VariableDefinition = {
    ...def,
    id: `vd-custom-${Date.now()}`,
    namespace,
    created_at: new Date().toISOString(),
  };
  variableDefinitions.push(newDef);
  return newDef;
}

/** Resolve all tokens in all blocks of a document */
export function resolveDocumentTokens(
  blocks: Array<{ content: string; block_key: string }>,
  context: ResolutionContext,
  docType: string,
): Array<{ block_key: string; result: TokenResolutionResult }> {
  return blocks.map(block => ({
    block_key: block.block_key,
    result: resolveTokens(block.content, context, docType),
  }));
}

/** Check if all required tokens are resolved (compile-readiness check) */
export function checkCompileReadiness(
  blocks: Array<{ content: string; block_key: string }>,
  context: ResolutionContext,
  docType: string,
): { ready: boolean; blockingTokens: MissingToken[]; warningTokens: MissingToken[] } {
  const results = resolveDocumentTokens(blocks, context, docType);
  const allMissing = results.flatMap(r => r.result.missingTokens);
  const blockingTokens = allMissing.filter(t => t.fallback_mode === "block_compile");
  const warningTokens = allMissing.filter(t => t.fallback_mode === "warning");
  return {
    ready: blockingTokens.length === 0,
    blockingTokens,
    warningTokens,
  };
}

// ============================================================
// DATA TYPE DISPLAY CONFIG
// ============================================================

export const DATA_TYPE_CONFIG: Record<VariableDataType, { label: string; icon: string; color: string }> = {
  text: { label: "Text", icon: "Type", color: "text-gray-600" },
  number: { label: "Number", icon: "Hash", color: "text-blue-600" },
  currency: { label: "Currency", icon: "DollarSign", color: "text-emerald-600" },
  date: { label: "Date", icon: "Calendar", color: "text-purple-600" },
  percent: { label: "Percent", icon: "Percent", color: "text-amber-600" },
  boolean: { label: "Boolean", icon: "ToggleLeft", color: "text-teal-600" },
  image: { label: "Image", icon: "Image", color: "text-rose-600" },
  table: { label: "Table", icon: "Table", color: "text-indigo-600" },
};

export const SCOPE_CONFIG: Record<VariableScope, { label: string; color: string; bg: string }> = {
  global: { label: "Global", color: "text-blue-700", bg: "bg-blue-50" },
  template: { label: "Template", color: "text-purple-700", bg: "bg-purple-50" },
  record: { label: "Record", color: "text-emerald-700", bg: "bg-emerald-50" },
};

export const SOURCE_CONFIG: Record<VariableSource, { label: string; color: string; bg: string }> = {
  static: { label: "Static", color: "text-gray-700", bg: "bg-gray-100" },
  binding: { label: "Binding", color: "text-indigo-700", bg: "bg-indigo-50" },
  computed: { label: "Computed", color: "text-amber-700", bg: "bg-amber-50" },
};

export const FALLBACK_CONFIG: Record<FallbackMode, { label: string; color: string; bg: string; description: string }> = {
  empty: { label: "Empty", color: "text-gray-600", bg: "bg-gray-100", description: "Replace with blank + info" },
  warning: { label: "Warning", color: "text-amber-700", bg: "bg-amber-50", description: "Show ⚠ MISSING marker" },
  block_compile: { label: "Block Compile", color: "text-red-700", bg: "bg-red-50", description: "Fail compile with error" },
};
