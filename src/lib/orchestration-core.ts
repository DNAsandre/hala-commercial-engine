/**
 * orchestration-core.ts
 * ─────────────────────
 * Sprint 2.2 — Orchestration Suggestion Store + Field Path Registry (PURE CORE).
 *
 * This module is the network-free heart of the orchestration foundation:
 *   - Types for packages + suggestions + state (per Sprint 2.1 contract).
 *   - The LIVE-ACCURATE field-path registry (bound to real `type_details` keys).
 *   - The source_role vocabulary.
 *   - Pure transforms (build / merge / filter / status-transition).
 *
 * STRICT SCOPE (Sprint 2.2):
 *   - Suggestions are a SEPARATE holding layer under `type_details.orchestration`.
 *   - NOTHING here writes a canonical tender field. `apply` is DEFERRED to Sprint 2.3.
 *   - No gates: pending suggestions are advisory and never block any workflow.
 *   - No supabase import — this file is safely unit-testable.
 *
 * The async service that persists this state lives in `orchestration.ts`.
 */

// ═══════════════════════════════════════════════════════════
// Versioning
// ═══════════════════════════════════════════════════════════

/** Bump when the field registry shape/content changes. Stored on state. */
export const FIELD_REGISTRY_VERSION = "2.3.0";

// ═══════════════════════════════════════════════════════════
// Status + role vocabularies
// ═══════════════════════════════════════════════════════════

export const SUGGESTION_STATUSES = [
  "pending_review",
  "accepted",
  "edited",
  "rejected",
  "superseded",
  "applied",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const PACKAGE_STATUSES = [
  "draft",
  "ready",
  "processing",
  "completed",
  "failed",
  "archived",
] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export const ORCHESTRATION_MODES = [
  "manual_upload",
  "codex_test_harness",
  "api_package",
  "future_bulk_upload",
] as const;
export type OrchestrationMode = (typeof ORCHESTRATION_MODES)[number];

/** Document source-role facet — additive, maps onto existing document_type/category. */
export const SOURCE_ROLES = [
  "RFQ",
  "SOW",
  "BOQ",
  "pricing_template",
  "commercial_terms",
  "legal_terms",
  "clarification_document",
  "customer_email",
  "compliance_requirement",
  "technical_specification",
  "appendix",
  "evidence_document",
  "certification",
  "previous_proposal",
  "other",
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

export function isValidSourceRole(v: unknown): v is SourceRole {
  return typeof v === "string" && (SOURCE_ROLES as readonly string[]).includes(v);
}

/** Coerce an unknown role to a valid one (invalid → "other"). Never throws. */
export function normalizeSourceRole(v: unknown): SourceRole {
  return isValidSourceRole(v) ? v : "other";
}

// ═══════════════════════════════════════════════════════════
// Data shapes (Sprint 2.1 contract)
// ═══════════════════════════════════════════════════════════

export interface OrchestrationPackage {
  id: string;
  tender_id: string;
  package_name: string;
  package_type?: string;
  document_ids: string[];
  status: PackageStatus;
  orchestration_mode?: OrchestrationMode;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  notes?: string;
}

export interface OrchestrationSuggestion {
  id: string;
  tender_id: string;
  package_id?: string;

  stage: string;
  tab?: string;
  field_path: string;

  proposed_value: unknown;
  current_saved_value?: unknown;

  source_document_id?: string;
  source_role?: SourceRole;
  storage_path?: string;
  source_page?: number;
  source_section?: string;
  source_span?: string;

  confidence?: number;

  bot_id?: string;
  bot_version_id?: string;
  ai_run_id?: string;

  status: SuggestionStatus;

  created_by?: string;
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;

  accepted_value?: unknown;
  rejection_reason?: string;
  notes?: string;

  /** Sprint 2.4: whether a baseline (current_saved_value) was captured at creation. */
  baseline_status?: BaselineStatus;
}

export type BaselineStatus = "baseline_captured" | "baseline_unavailable";

export interface TenderOrchestrationState {
  packages: OrchestrationPackage[];
  suggestions: OrchestrationSuggestion[];
  field_registry_version?: string;
  updated_at?: string;
}

export const EMPTY_ORCHESTRATION_STATE: TenderOrchestrationState = {
  packages: [],
  suggestions: [],
  field_registry_version: FIELD_REGISTRY_VERSION,
};

/** Safely coerce an unknown `type_details.orchestration` blob into a valid state. */
export function normalizeOrchestrationState(raw: unknown): TenderOrchestrationState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_ORCHESTRATION_STATE };
  }
  const o = raw as Record<string, unknown>;
  return {
    packages: Array.isArray(o.packages) ? (o.packages as OrchestrationPackage[]) : [],
    suggestions: Array.isArray(o.suggestions) ? (o.suggestions as OrchestrationSuggestion[]) : [],
    field_registry_version:
      typeof o.field_registry_version === "string" ? o.field_registry_version : FIELD_REGISTRY_VERSION,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : undefined,
  };
}

// ═══════════════════════════════════════════════════════════
// LIVE-ACCURATE FIELD PATH REGISTRY
// ═══════════════════════════════════════════════════════════
//
// Each entry binds a routable `field_path` to the REAL `type_details` key and
// the existing writer function (documented only — NOT invoked in Sprint 2.2).
// `apply_supported` is FALSE for every entry: apply lands in Sprint 2.3.
// `suggestion_supported` = true means a suggestion may TARGET this path now.

export type RegistryValueType = "object" | "array" | "string" | "number" | "boolean";

export interface FieldRegistryEntry {
  /** Routable id, e.g. "qualification.sow_qualification_data". */
  field_path: string;
  /** Internal tender stage value (matches commercial_tickets.internal_stage). */
  stage: string;
  stage_label: string;
  tab?: string;
  /** Real top-level key inside commercial_tickets.type_details. */
  type_details_key: string;
  /** Nested section for `<key>.{section}` writers; null for flat *_data blobs. */
  section: string | null;
  value_type: RegistryValueType;
  /** Existing writer fn name. DOCUMENTATION ONLY — not called in Sprint 2.2. */
  writer: string;
  /** May a suggestion target this path in Sprint 2.2? */
  suggestion_supported: boolean;
  /** Always false in Sprint 2.2 — apply is deferred to Sprint 2.3. */
  apply_supported: boolean;
  notes?: string;
}

const DEFER = "Suggestion storage only in Sprint 2.2. Apply deferred to Sprint 2.3.";

export const FIELD_REGISTRY: FieldRegistryEntry[] = [
  // ── Identified (type_details.identified.{section}) ──
  { field_path: "identified.intake_file_audit", stage: "identified", stage_label: "Identified", tab: "Intake & File Audit", type_details_key: "identified", section: "intake_file_audit", value_type: "object", writer: "updateTenderIdentifiedData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "identified.document_review", stage: "identified", stage_label: "Identified", tab: "Document Review", type_details_key: "identified", section: "document_review", value_type: "object", writer: "updateTenderIdentifiedData", suggestion_supported: true, apply_supported: false, notes: `${DEFER} Document ROWS live in the tender document registry, not here.` },
  { field_path: "identified.compliance_matrix_notes", stage: "identified", stage_label: "Identified", tab: "Compliance Matrix", type_details_key: "identified", section: "compliance_matrix_notes", value_type: "object", writer: "updateTenderIdentifiedData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "identified.clarification_log", stage: "identified", stage_label: "Identified", tab: "Clarification Log", type_details_key: "identified", section: "clarification_log", value_type: "array", writer: "updateTenderIdentifiedData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Qualification (flat *_data blobs) ──
  { field_path: "qualification.sow_qualification_data", stage: "qualification", stage_label: "Qualification", tab: "SOW Qualification", type_details_key: "sow_qualification_data", section: null, value_type: "object", writer: "updateTenderSowQualificationData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "qualification.technical_qualification_data", stage: "qualification", stage_label: "Qualification", tab: "Technical Qualification", type_details_key: "technical_qualification_data", section: null, value_type: "object", writer: "updateTenderTechnicalQualificationData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "qualification.customer_fit_data", stage: "qualification", stage_label: "Qualification", tab: "Customer Fit", type_details_key: "customer_fit_data", section: null, value_type: "object", writer: "updateTenderCustomerFitData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "qualification.risk_snapshot_data", stage: "qualification", stage_label: "Qualification", tab: "Risk Snapshot", type_details_key: "risk_snapshot_data", section: null, value_type: "object", writer: "updateTenderRiskSnapshotData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Bid / No-Bid (flat blob) ──
  { field_path: "bid_no_bid.bid_no_bid_data", stage: "bid_no_bid", stage_label: "Bid / No-Bid", tab: "Bid Decision", type_details_key: "bid_no_bid_data", section: null, value_type: "object", writer: "updateTenderBidNoBidData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Solution Design (flat blobs) ──
  { field_path: "solution_design.solution_design_data", stage: "solution_design", stage_label: "Solution Design", tab: "Solution Configuration", type_details_key: "solution_design_data", section: null, value_type: "object", writer: "updateTenderSolutionDesignData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "solution_design.sow_data", stage: "solution_design", stage_label: "Solution Design", tab: "Scope of Work", type_details_key: "sow_data", section: null, value_type: "object", writer: "updateTenderSowData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── P&L / Pricing (type_details.pricing.{section}) ──
  { field_path: "pnl_pricing.pricing.pnl_snapshot", stage: "pnl_pricing", stage_label: "P&L / Pricing", tab: "P&L Calculator", type_details_key: "pricing", section: "pnl_snapshot", value_type: "object", writer: "updateTenderPricingData", suggestion_supported: true, apply_supported: false, notes: `${DEFER} Section keys follow TenderPricingSectionKey.` },
  { field_path: "pnl_pricing.pricing.scenarios", stage: "pnl_pricing", stage_label: "P&L / Pricing", tab: "Pricing Scenarios", type_details_key: "pricing", section: "scenarios", value_type: "object", writer: "updateTenderPricingData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "pnl_pricing.pricing.commercial_terms", stage: "pnl_pricing", stage_label: "P&L / Pricing", tab: "Commercial Terms", type_details_key: "pricing", section: "commercial_terms", value_type: "object", writer: "updateTenderPricingData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "pnl_pricing.pricing.approval", stage: "pnl_pricing", stage_label: "P&L / Pricing", tab: "Pricing Approval", type_details_key: "pricing", section: "approval", value_type: "object", writer: "updateTenderPricingData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Tender Drafting (type_details.tender_drafting.{section}) ──
  { field_path: "tender_drafting.tender_drafting.proposal_architecture", stage: "tender_drafting", stage_label: "Tender Drafting", tab: "Proposal Architecture / TOC", type_details_key: "tender_drafting", section: "proposal_architecture", value_type: "object", writer: "updateTenderDraftingData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "tender_drafting.tender_drafting.proposal_blocks", stage: "tender_drafting", stage_label: "Tender Drafting", tab: "Proposal Block Workbench", type_details_key: "tender_drafting", section: "proposal_blocks", value_type: "array", writer: "updateTenderDraftingData", suggestion_supported: true, apply_supported: false, notes: `${DEFER} Block→FinalStudio bridge is out of scope.` },

  // ── Internal Review / Approval Matrix / Final Approved ──
  // No dedicated type_details writer confirmed for these stages → UNSUPPORTED targets in 2.2.
  { field_path: "internal_review.UNKNOWN", stage: "internal_review", stage_label: "Internal Review", tab: undefined, type_details_key: "UNKNOWN", section: null, value_type: "object", writer: "UNKNOWN", suggestion_supported: false, apply_supported: false, notes: "No confirmed type_details writer. Mark suggestions unsupported until field manifest extracts real path." },
  { field_path: "approval_matrix.UNKNOWN", stage: "approval_matrix", stage_label: "Approval Matrix", tab: undefined, type_details_key: "UNKNOWN", section: null, value_type: "object", writer: "UNKNOWN", suggestion_supported: false, apply_supported: false, notes: "No confirmed type_details writer. Unsupported until extracted." },
  { field_path: "final_approved.UNKNOWN", stage: "final_approved", stage_label: "Final Approved", tab: undefined, type_details_key: "UNKNOWN", section: null, value_type: "object", writer: "UNKNOWN", suggestion_supported: false, apply_supported: false, notes: "Readiness-only stage. No field write target." },

  // ── Submitted (type_details.submission.{section}) ──
  { field_path: "submitted.submission.submission_record", stage: "submitted", stage_label: "Submitted", tab: "Submission Log", type_details_key: "submission", section: "submission_record", value_type: "object", writer: "updateTenderSubmissionData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "submitted.submission.submitted_version", stage: "submitted", stage_label: "Submitted", tab: "Submitted Version", type_details_key: "submission", section: "submitted_version", value_type: "object", writer: "updateTenderSubmissionData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "submitted.submission.crm_sync", stage: "submitted", stage_label: "Submitted", tab: "CRM Sync", type_details_key: "submission", section: "crm_sync", value_type: "object", writer: "updateTenderSubmissionData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Clarification (type_details.clarification.{section}) ──
  { field_path: "clarification.clarification.qa_log", stage: "clarification", stage_label: "Clarification", tab: "Q&A Log", type_details_key: "clarification", section: "qa_log", value_type: "array", writer: "updateTenderClarificationData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "clarification.clarification.response", stage: "clarification", stage_label: "Clarification", tab: "Response Drafts", type_details_key: "clarification", section: "response", value_type: "object", writer: "updateTenderClarificationData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Client Evaluation (type_details.client_evaluation.{section}) ──
  { field_path: "client_evaluation.client_evaluation.request_log", stage: "client_evaluation", stage_label: "Client Evaluation", tab: "Request Log", type_details_key: "client_evaluation", section: "request_log", value_type: "array", writer: "updateTenderClientEvaluationData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "client_evaluation.client_evaluation.bafo", stage: "client_evaluation", stage_label: "Client Evaluation", tab: "BAFO Manager", type_details_key: "client_evaluation", section: "bafo", value_type: "object", writer: "updateTenderClientEvaluationData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Negotiation (type_details.negotiation_data.{section}) ──
  { field_path: "negotiation.negotiation_data.negotiation_log", stage: "negotiation", stage_label: "Negotiation", tab: "Negotiation Log", type_details_key: "negotiation_data", section: "negotiation_log", value_type: "array", writer: "updateTenderNegotiationData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "negotiation.negotiation_data.revised_terms", stage: "negotiation", stage_label: "Negotiation", tab: "Revised Versions", type_details_key: "negotiation_data", section: "revised_terms", value_type: "object", writer: "updateTenderNegotiationData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Awarded (type_details.awarded_data.{section}) ──
  { field_path: "awarded.awarded_data.award_notice", stage: "awarded", stage_label: "Awarded", tab: "Award Notice", type_details_key: "awarded_data", section: "award_notice", value_type: "object", writer: "updateTenderAwardedData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "awarded.awarded_data.contract_prep", stage: "awarded", stage_label: "Awarded", tab: "Contract Prep", type_details_key: "awarded_data", section: "contract_prep", value_type: "object", writer: "updateTenderAwardedData", suggestion_supported: true, apply_supported: false, notes: DEFER },

  // ── Lost / Withdrawn (type_details.lost_withdrawn_data.{section}) ──
  { field_path: "lost_withdrawn.lost_withdrawn_data.loss_reason", stage: "lost_withdrawn", stage_label: "Lost / Withdrawn", tab: "Loss Reason", type_details_key: "lost_withdrawn_data", section: "loss_reason", value_type: "object", writer: "updateTenderLostWithdrawnData", suggestion_supported: true, apply_supported: false, notes: DEFER },
  { field_path: "lost_withdrawn.lost_withdrawn_data.lessons_learned", stage: "lost_withdrawn", stage_label: "Lost / Withdrawn", tab: "Lessons Learned", type_details_key: "lost_withdrawn_data", section: "lessons_learned", value_type: "object", writer: "updateTenderLostWithdrawnData", suggestion_supported: true, apply_supported: false, notes: DEFER },
];

// ── Sprint 2.3: narrow apply-enablement ──────────────────────
// Apply is enabled ONLY for a small set of safe, verified paths that have a real
// flat/nested canonical target + a real writer binding. Everything else (later
// stages, document-registry, tender_drafting→FinalStudio bridge, the 3 UNKNOWN
// stages) stays apply-disabled until separately verified. No invented targets.
export const APPLY_ENABLED_PATHS = new Set<string>([
  "identified.intake_file_audit",
  "identified.compliance_matrix_notes",
  "identified.clarification_log",
  "qualification.sow_qualification_data",
  "qualification.technical_qualification_data",
  "qualification.customer_fit_data",
  "qualification.risk_snapshot_data",
  "bid_no_bid.bid_no_bid_data",
  "solution_design.solution_design_data",
  "solution_design.sow_data",
  "pnl_pricing.pricing.commercial_terms",
]);

// Derive apply_supported from the allow-list (only ever true for supported paths
// with a real target + writer). Mutates the registry once at module load.
for (const e of FIELD_REGISTRY) {
  e.apply_supported =
    e.suggestion_supported &&
    e.type_details_key !== "UNKNOWN" &&
    e.writer !== "UNKNOWN" &&
    APPLY_ENABLED_PATHS.has(e.field_path);
}

export interface FieldPathResolution {
  supported: boolean;
  entry: FieldRegistryEntry | null;
  reason?: string;
}

/** Resolve a field_path against the live registry. Never throws. */
export function resolveFieldPath(fieldPath: string): FieldPathResolution {
  const entry = FIELD_REGISTRY.find((e) => e.field_path === fieldPath) ?? null;
  if (!entry) {
    return { supported: false, entry: null, reason: "unknown_field_path" };
  }
  if (!entry.suggestion_supported) {
    return { supported: false, entry, reason: "field_path_not_supported_in_2_2" };
  }
  return { supported: true, entry };
}

export function getFieldRegistry(): FieldRegistryEntry[] {
  return FIELD_REGISTRY.map((e) => ({ ...e }));
}

// ═══════════════════════════════════════════════════════════
// Pure transforms — build / merge / filter / status transition
// ═══════════════════════════════════════════════════════════

/** Injectable id + clock so transforms are deterministic in tests. */
export interface CoreDeps {
  newId: () => string;
  now: () => string;
}

export const defaultDeps: CoreDeps = {
  newId: () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`),
  now: () => new Date().toISOString(),
};

export interface NewPackageInput {
  tender_id: string;
  package_name: string;
  package_type?: string;
  document_ids?: string[];
  orchestration_mode?: OrchestrationMode;
  created_by?: string;
  status?: PackageStatus;
  notes?: string;
}

export function buildPackage(input: NewPackageInput, deps: CoreDeps = defaultDeps): OrchestrationPackage {
  return {
    id: deps.newId(),
    tender_id: input.tender_id,
    package_name: input.package_name,
    package_type: input.package_type,
    document_ids: Array.isArray(input.document_ids) ? input.document_ids : [],
    status: input.status ?? "draft",
    orchestration_mode: input.orchestration_mode,
    created_by: input.created_by,
    created_at: deps.now(),
    notes: input.notes,
  };
}

export type NewSuggestionInput = Omit<
  OrchestrationSuggestion,
  "id" | "created_at" | "status" | "source_role" | "reviewed_by" | "reviewed_at" | "accepted_value"
> & {
  /** Optional at creation; coerced to a valid role when present. */
  source_role?: unknown;
  /** Optional override; defaults to pending_review (the only safe creation state). */
  status?: SuggestionStatus;
};

/**
 * Build a suggestion. ALWAYS starts at pending_review unless an explicit
 * non-applied status is passed (the service rejects `applied` separately).
 * Coerces source_role to the valid vocabulary. Never throws.
 */
export function buildSuggestion(input: NewSuggestionInput, deps: CoreDeps = defaultDeps): OrchestrationSuggestion {
  const { source_role, status, ...rest } = input;
  return {
    ...rest,
    id: deps.newId(),
    status: status ?? "pending_review",
    source_role: source_role === undefined ? undefined : normalizeSourceRole(source_role),
    created_at: deps.now(),
  };
}

// ── Sprint 2.4: baseline capture (pure) ──────────────────────
// Reads the live canonical value a registry entry points at, so source-drift
// protection (Sprint 2.3) can later compare creation-time vs apply-time values.

/** Read the canonical value at a registry entry's target (flat key or bucket.section). */
export function readTargetValue(
  typeDetails: Record<string, unknown> | undefined,
  entry: FieldRegistryEntry,
): unknown {
  const td = typeDetails && typeof typeDetails === "object" && !Array.isArray(typeDetails) ? typeDetails : {};
  const bucket = td[entry.type_details_key];
  if (entry.section == null) return bucket;
  if (bucket && typeof bucket === "object" && !Array.isArray(bucket)) {
    return (bucket as Record<string, unknown>)[entry.section];
  }
  return undefined;
}

export interface BaselineCaptureResult {
  current_saved_value?: unknown;
  baseline_status: BaselineStatus;
}

/**
 * Capture the current canonical value for a field_path. Never invents routing:
 * unknown/unsupported paths, or a target with no current value, → baseline_unavailable.
 */
export function captureBaseline(
  typeDetails: Record<string, unknown> | undefined,
  fieldPath: string,
): BaselineCaptureResult {
  const res = resolveFieldPath(fieldPath);
  if (!res.supported || !res.entry || res.entry.type_details_key === "UNKNOWN") {
    return { baseline_status: "baseline_unavailable" };
  }
  const value = readTargetValue(typeDetails, res.entry);
  if (value === undefined) {
    // Supported path, but no current value to resolve → treat as unavailable
    // (a first-time population; apply will skip the drift check for it).
    return { baseline_status: "baseline_unavailable" };
  }
  return { current_saved_value: value, baseline_status: "baseline_captured" };
}

/**
 * Build a suggestion AND capture its baseline. A caller-provided current_saved_value
 * is preserved (never overridden); otherwise the baseline is read from typeDetails.
 */
export function buildSuggestionWithBaseline(
  input: NewSuggestionInput,
  typeDetails: Record<string, unknown> | undefined,
  deps: CoreDeps = defaultDeps,
): OrchestrationSuggestion {
  const s = buildSuggestion(input, deps);
  if (s.current_saved_value !== undefined) {
    // Caller supplied a baseline — preserve it.
    return { ...s, baseline_status: "baseline_captured" };
  }
  const cap = captureBaseline(typeDetails, s.field_path);
  return { ...s, current_saved_value: cap.current_saved_value, baseline_status: cap.baseline_status };
}

export interface StatusUpdateInput {
  status: SuggestionStatus;
  reviewed_by?: string;
  accepted_value?: unknown;
  rejection_reason?: string;
  notes?: string;
}

export interface StatusTransitionResult {
  ok: boolean;
  suggestion?: OrchestrationSuggestion;
  error?: string;
}

/**
 * Pure status transition. Does NOT touch canonical tender data.
 *
 * Guards (Sprint 2.2):
 *   - `applied` is REJECTED here (apply belongs to Sprint 2.3).
 *   - `edited` requires an accepted_value.
 *   - `rejected` should carry a rejection_reason (warned via notes, not blocked).
 */
export function applyStatusTransition(
  suggestion: OrchestrationSuggestion,
  update: StatusUpdateInput,
  deps: CoreDeps = defaultDeps,
): StatusTransitionResult {
  if (!(SUGGESTION_STATUSES as readonly string[]).includes(update.status)) {
    return { ok: false, error: `Unknown status "${update.status}".` };
  }
  if (update.status === "applied") {
    return {
      ok: false,
      error: "Status 'applied' is deferred to Sprint 2.3 (apply-reviewed-patch). It cannot be set in Sprint 2.2.",
    };
  }
  if (update.status === "edited" && update.accepted_value === undefined) {
    return { ok: false, error: "Status 'edited' requires an accepted_value." };
  }

  const next: OrchestrationSuggestion = {
    ...suggestion,
    status: update.status,
    reviewed_by: update.reviewed_by ?? suggestion.reviewed_by,
    reviewed_at: deps.now(),
  };

  if (update.status === "accepted") {
    // Accepting as-is records the proposed value as the accepted value.
    next.accepted_value = update.accepted_value !== undefined ? update.accepted_value : suggestion.proposed_value;
  }
  if (update.status === "edited") {
    next.accepted_value = update.accepted_value;
  }
  if (update.status === "rejected") {
    next.rejection_reason = update.rejection_reason ?? suggestion.rejection_reason ?? "(no reason provided)";
  }
  if (update.notes !== undefined) next.notes = update.notes;

  return { ok: true, suggestion: next };
}

// ── State merge helpers (immutable) ──

export function mergePackageIntoState(
  state: TenderOrchestrationState,
  pkg: OrchestrationPackage,
  deps: CoreDeps = defaultDeps,
): TenderOrchestrationState {
  const exists = state.packages.some((p) => p.id === pkg.id);
  return {
    ...state,
    packages: exists ? state.packages.map((p) => (p.id === pkg.id ? pkg : p)) : [...state.packages, pkg],
    field_registry_version: FIELD_REGISTRY_VERSION,
    updated_at: deps.now(),
  };
}

export function mergeSuggestionIntoState(
  state: TenderOrchestrationState,
  suggestion: OrchestrationSuggestion,
  deps: CoreDeps = defaultDeps,
): TenderOrchestrationState {
  const exists = state.suggestions.some((s) => s.id === suggestion.id);
  return {
    ...state,
    suggestions: exists
      ? state.suggestions.map((s) => (s.id === suggestion.id ? suggestion : s))
      : [...state.suggestions, suggestion],
    field_registry_version: FIELD_REGISTRY_VERSION,
    updated_at: deps.now(),
  };
}

export interface SuggestionFilter {
  package_id?: string;
  status?: SuggestionStatus;
  stage?: string;
  field_path?: string;
}

export function filterSuggestions(
  state: TenderOrchestrationState,
  filter: SuggestionFilter = {},
): OrchestrationSuggestion[] {
  return state.suggestions.filter((s) => {
    if (filter.package_id && s.package_id !== filter.package_id) return false;
    if (filter.status && s.status !== filter.status) return false;
    if (filter.stage && s.stage !== filter.stage) return false;
    if (filter.field_path && s.field_path !== filter.field_path) return false;
    return true;
  });
}

/** Count suggestions by status (for advisory review summaries — never a gate). */
export function countByStatus(state: TenderOrchestrationState): Record<SuggestionStatus, number> {
  const counts = Object.fromEntries(SUGGESTION_STATUSES.map((s) => [s, 0])) as Record<SuggestionStatus, number>;
  for (const s of state.suggestions) {
    if (counts[s.status] !== undefined) counts[s.status] += 1;
  }
  return counts;
}
