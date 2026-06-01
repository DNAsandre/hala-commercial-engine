/**
 * proposal-block-foundation.ts
 * ════════════════════════════════════════════════════════════
 * PROPOSAL BLOCK FOUNDATION — Stage Data Contracts + Readiness Map
 *
 * This is a read-only foundation layer.
 *
 * It defines:
 *   1. Stage Data Contract types
 *   2. Stage Data Contract registry
 *   3. Proposal Block Mapping registry
 *   4. Block Readiness evaluator (pure helper — no side-effects)
 *
 * It does NOT:
 *   - Generate AI content
 *   - Write to Supabase
 *   - Modify PDF Studio / doc_instances / doc_instance_versions
 *   - Move tender or CRM stages
 *   - Create mock/fake data
 *   - Call any external API
 *
 * All data is generic. No customer-specific or tender-specific values.
 */

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type StageKey =
  | "identified"
  | "qualification"
  | "bid_no_bid"
  | "solution_design"
  | "pnl_pricing"
  | "tender_drafting"
  | "internal_review"
  | "approval_matrix"
  | "final_approved"
  | "submitted"
  | "clarification"
  | "technical_review"
  | "commercial_review"
  | "award"
  | "lost"
  | "archived";

export type ProposalBlockReadinessStatus =
  | "not_ready"
  | "ready_to_draft"
  | "drafted"
  | "human_edited"
  | "approved"
  | "sent_to_pdf_studio"
  | "locked";

export interface ProposalBlockTarget {
  blockKey: string;
  blockLabel: string;
  blockFamily?: string;
  pdfStudioTarget?: string;
  semanticTokens?: string[];
  intendedProposalSection: string;
}

export interface StageDataContract {
  stageKey: StageKey;
  stageLabel: string;
  capturedDataKeys: string[];
  requiredDataKeys: string[];
  optionalDataKeys: string[];
  documentNeeds: string[];
  outputsCreated: string[];
}

export interface ProposalBlockMapping {
  id: string;
  stageKey: StageKey;
  sourceDataKeys: string[];
  requiredSourceDataKeys: string[];
  targetBlocks: ProposalBlockTarget[];
  futureUse: string[];
  readinessRule: string;
}

export interface BlockReadinessResult {
  mappingId: string;
  stageKey: StageKey;
  status: ProposalBlockReadinessStatus;
  ready: boolean;
  missingRequiredData: string[];
  availableData: string[];
  message: string;
}

// ═══════════════════════════════════════════════════════════
// STAGE DATA CONTRACT REGISTRY
// ═══════════════════════════════════════════════════════════

export const STAGE_DATA_CONTRACTS: StageDataContract[] = [
  {
    stageKey: "identified",
    stageLabel: "Identified",
    capturedDataKeys: [
      "tender_summary", "customer_snapshot", "sow_data",
      "source_documents", "supporting_documents",
    ],
    requiredDataKeys: ["tender_summary", "customer_snapshot", "source_documents"],
    optionalDataKeys: ["sow_data", "supporting_documents"],
    documentNeeds: ["RFQ / RFP document", "Scope of work", "Tender notice"],
    outputsCreated: ["tender_intake_summary", "initial_scope_capture", "document_register"],
  },
  {
    stageKey: "qualification",
    stageLabel: "Qualification",
    capturedDataKeys: [
      "sow_qualification", "technical_qualification",
      "customer_fit", "risk_snapshot", "qualification_documents",
    ],
    requiredDataKeys: ["sow_qualification", "technical_qualification", "customer_fit", "risk_snapshot"],
    optionalDataKeys: ["qualification_documents"],
    documentNeeds: ["Technical certificates", "Case studies", "Warehouse/fleet profiles"],
    outputsCreated: [
      "qualification_summary", "clarification_candidates",
      "technical_gap_register", "qualification_risk_register",
    ],
  },
  {
    stageKey: "bid_no_bid",
    stageLabel: "Bid / No-Bid",
    capturedDataKeys: [
      "bid_decision", "strategic_rationale", "win_themes",
      "resource_commitment", "decision_record", "qualification_summary",
    ],
    requiredDataKeys: ["bid_decision", "strategic_rationale", "resource_commitment"],
    optionalDataKeys: ["win_themes", "decision_record", "qualification_summary"],
    documentNeeds: ["Qualification scorecard", "Risk register"],
    outputsCreated: ["bid_no_bid_decision", "win_theme_summary", "executive_decision_record"],
  },
  {
    stageKey: "solution_design",
    stageLabel: "Solution Design",
    capturedDataKeys: [
      "solution_design.configuration", "solution_design.hop",
      "solution_design.ham", "solution_design.hip",
      "solution_design.scope_matrix", "solution_design.sla_kpi",
      "solution_design.assumptions_dependencies",
    ],
    requiredDataKeys: ["solution_design.configuration"],
    optionalDataKeys: [
      "solution_design.hop", "solution_design.ham", "solution_design.hip",
      "solution_design.scope_matrix", "solution_design.sla_kpi",
      "solution_design.assumptions_dependencies",
    ],
    documentNeeds: ["Site survey data", "Fleet specifications", "Technology requirements"],
    outputsCreated: ["technical_solution_blueprint", "methodology_inputs", "service_configuration_inputs"],
  },
  {
    stageKey: "pnl_pricing",
    stageLabel: "P&L / Pricing",
    capturedDataKeys: [
      "pricing_model", "boq_inputs", "commercial_terms",
      "assumptions", "exclusions", "target_gp", "margin_review",
      "pricing.pnl_snapshot", "pricing.scenarios", "pricing.approval",
    ],
    requiredDataKeys: ["pricing_model", "commercial_terms", "target_gp"],
    optionalDataKeys: ["boq_inputs", "assumptions", "exclusions", "margin_review", "pricing.pnl_snapshot", "pricing.scenarios", "pricing.approval"],
    documentNeeds: ["BOQ template", "Cost model", "Competitor pricing intelligence"],
    outputsCreated: ["commercial_summary_inputs", "pricing_table_inputs", "commercial_assumption_inputs"],
  },
  {
    stageKey: "tender_drafting",
    stageLabel: "Tender Drafting",
    capturedDataKeys: [
      "approved_win_themes", "solution_blueprint",
      "pricing_summary", "risk_mitigations", "supporting_documents",
    ],
    requiredDataKeys: ["approved_win_themes", "solution_blueprint", "pricing_summary"],
    optionalDataKeys: ["risk_mitigations", "supporting_documents"],
    documentNeeds: ["Solution design pack", "Pricing pack", "Risk register"],
    outputsCreated: ["proposal_draft_inputs", "technical_volume_inputs", "commercial_volume_inputs"],
  },
  {
    stageKey: "internal_review",
    stageLabel: "Internal Review",
    capturedDataKeys: [
      "draft_review_comments", "compliance_review",
      "commercial_review", "legal_review", "red_team_findings",
    ],
    requiredDataKeys: ["compliance_review", "commercial_review"],
    optionalDataKeys: ["draft_review_comments", "legal_review", "red_team_findings"],
    documentNeeds: ["Draft proposal", "Compliance matrix", "Review checklist"],
    outputsCreated: ["review_pack", "revision_actions"],
  },
  {
    stageKey: "approval_matrix",
    stageLabel: "Approval Matrix",
    capturedDataKeys: [
      "approval_status", "approval_conditions",
      "executive_signoff", "legal_signoff", "finance_signoff",
    ],
    requiredDataKeys: ["approval_status", "executive_signoff"],
    optionalDataKeys: ["approval_conditions", "legal_signoff", "finance_signoff"],
    documentNeeds: ["Final proposal pack", "P&L summary", "Risk summary"],
    outputsCreated: ["approval_record", "final_conditions"],
  },
  {
    stageKey: "submitted",
    stageLabel: "Submitted",
    capturedDataKeys: [
      "final_submission_pack", "submission_checklist",
      "portal_receipt", "submitted_documents",
    ],
    requiredDataKeys: ["final_submission_pack", "submission_checklist"],
    optionalDataKeys: ["portal_receipt", "submitted_documents"],
    documentNeeds: ["Final approved pack", "Submission checklist"],
    outputsCreated: ["submission_record", "lessons_learned_inputs"],
  },
];

// ═══════════════════════════════════════════════════════════
// PROPOSAL BLOCK MAPPING REGISTRY
// ═══════════════════════════════════════════════════════════

export const PROPOSAL_BLOCK_MAPPINGS: ProposalBlockMapping[] = [
  // 1. Identification → Tender Intake / Background
  {
    id: "map-identified-intake",
    stageKey: "identified",
    sourceDataKeys: ["tender_summary", "customer_snapshot", "sow_data"],
    requiredSourceDataKeys: ["tender_summary", "customer_snapshot"],
    targetBlocks: [{
      blockKey: "intro.narrative",
      blockLabel: "Introduction / Background Narrative",
      blockFamily: "intro",
      pdfStudioTarget: "intro.narrative",
      semanticTokens: ["customer_name", "tender_title", "source", "region"],
      intendedProposalSection: "Executive Summary / Customer Background",
    }],
    futureUse: ["Executive Summary", "Understanding of Requirement", "Customer Context"],
    readinessRule: "tender_summary and customer_snapshot must be captured",
  },

  // 2. Identification / SOW Capture → Scope of Services
  {
    id: "map-identified-scope",
    stageKey: "identified",
    sourceDataKeys: [
      "sow_data.scope_summary", "sow_data.service_lines",
      "sow_data.warehousing", "sow_data.transport",
    ],
    requiredSourceDataKeys: ["sow_data.scope_summary", "sow_data.service_lines"],
    targetBlocks: [
      {
        blockKey: "scope.list",
        blockLabel: "Scope of Services List",
        blockFamily: "scope",
        pdfStudioTarget: "scope.list",
        semanticTokens: ["service_lines", "scope_summary"],
        intendedProposalSection: "Scope of Services",
      },
      {
        blockKey: "scope.table",
        blockLabel: "Scope Configuration Table",
        blockFamily: "scope",
        pdfStudioTarget: "scope.table",
        semanticTokens: ["warehousing", "transport", "handling"],
        intendedProposalSection: "Solution Description / Scope Table",
      },
    ],
    futureUse: ["Scope of Services", "Solution Description", "Technical Proposal Scope"],
    readinessRule: "sow_data.scope_summary and sow_data.service_lines must exist",
  },

  // 3. Qualification → Clarification Log / Assumptions
  {
    id: "map-qualification-clarifications",
    stageKey: "qualification",
    sourceDataKeys: [
      "qualification.sow.clarifications",
      "qualification.sow.coverage_matrix",
      "qualification.technical.gaps",
      "qualification.risk.register",
    ],
    requiredSourceDataKeys: [
      "qualification.sow.clarifications",
      "qualification.technical.gaps",
    ],
    targetBlocks: [{
      blockKey: "terms.standard",
      blockLabel: "Clarifications / Assumptions / Dependencies",
      blockFamily: "terms",
      pdfStudioTarget: "terms.standard",
      semanticTokens: ["clarifications", "assumptions", "dependencies", "deviations"],
      intendedProposalSection: "Clarification Log / Assumptions & Dependencies",
    }],
    futureUse: ["Clarification Log", "Assumptions & Dependencies", "Deviations / Clarifications"],
    readinessRule: "At least one clarification or gap must be captured",
  },

  // 4. Qualification → Technical Capability Narrative
  {
    id: "map-qualification-technical",
    stageKey: "qualification",
    sourceDataKeys: [
      "qualification.technical.capability_assessment",
      "qualification.technical.gaps",
      "qualification.technical.recommendation",
    ],
    requiredSourceDataKeys: ["qualification.technical.capability_assessment"],
    targetBlocks: [{
      blockKey: "annexure.a.config",
      blockLabel: "Technical Capability / Methodology",
      blockFamily: "annexure",
      pdfStudioTarget: "annexure.a.config",
      semanticTokens: ["warehouse_capability", "transport_capability", "systems_fit", "compliance_fit", "hse_fit"],
      intendedProposalSection: "Technical Methodology / Compliance & Certifications",
    }],
    futureUse: ["Technical Methodology", "Technology & Systems", "Compliance & Certifications", "HSE / Security"],
    readinessRule: "capability_assessment must have at least 1 assessed row",
  },

  // 5. Qualification → Risk Register / Mitigation
  {
    id: "map-qualification-risk",
    stageKey: "qualification",
    sourceDataKeys: [
      "qualification.risk.register",
      "qualification.risk.mitigation_actions",
      "qualification.risk.clarifications",
    ],
    requiredSourceDataKeys: ["qualification.risk.register"],
    targetBlocks: [{
      blockKey: "legal.clauses.locked",
      blockLabel: "Risk Register / Mitigation Plan",
      blockFamily: "legal",
      pdfStudioTarget: "legal.clauses.locked",
      semanticTokens: ["risks", "mitigations", "bid_blockers", "exceptions"],
      intendedProposalSection: "Risk Register / Commercial Exceptions",
    }],
    futureUse: ["Risk Register", "Risk Mitigation", "Assumptions", "Commercial / Technical Exceptions"],
    readinessRule: "risk.register must have at least 1 risk row",
  },

  // 6. Bid / No-Bid → Win Themes
  {
    id: "map-bid-win-themes",
    stageKey: "bid_no_bid",
    sourceDataKeys: [
      "bid_no_bid.strategic_rationale",
      "bid_no_bid.win_themes",
      "bid_no_bid.decision_record",
    ],
    requiredSourceDataKeys: ["bid_no_bid.strategic_rationale", "bid_no_bid.win_themes"],
    targetBlocks: [{
      blockKey: "intro.narrative",
      blockLabel: "Win Themes / Value Proposition",
      blockFamily: "intro",
      pdfStudioTarget: "intro.narrative",
      semanticTokens: ["win_themes", "value_proposition", "strategic_rationale"],
      intendedProposalSection: "Executive Summary / Why Hala",
    }],
    futureUse: ["Executive Summary", "Value Proposition", "Why Hala", "Proposal Win Themes"],
    readinessRule: "strategic_rationale and win_themes must be captured",
  },

  // 7. Solution Design → Technical Solution
  {
    id: "map-solution-technical",
    stageKey: "solution_design",
    sourceDataKeys: [
      "solution_design.configuration",
      "solution_design.hop",
      "solution_design.ham",
      "solution_design.hip",
      "solution_design.scope_matrix",
      "solution_design.sla_kpi",
      "solution_design.assumptions_dependencies",
    ],
    requiredSourceDataKeys: [
      "solution_design.configuration",
    ],
    targetBlocks: [
      {
        blockKey: "scope.list",
        blockLabel: "Proposed Solution Scope",
        blockFamily: "scope",
        pdfStudioTarget: "scope.list",
        intendedProposalSection: "Proposed Solution / Methodology",
      },
      {
        blockKey: "scope.table",
        blockLabel: "Solution Configuration Table",
        blockFamily: "scope",
        pdfStudioTarget: "scope.table",
        intendedProposalSection: "Service Configuration",
      },
      {
        blockKey: "annexure.a.config",
        blockLabel: "Technical Annexure",
        blockFamily: "annexure",
        pdfStudioTarget: "annexure.a.config",
        intendedProposalSection: "Implementation Approach",
      },
    ],
    futureUse: ["Proposed Solution", "Methodology", "Service Configuration", "Implementation Approach", "Executive Summary / Customer Operating Context"],
    readinessRule: "solution_design.configuration must be captured; HOP/HAM/HIP required based on selected_modules",
  },

  // 8. Pricing → Commercial Proposal
  {
    id: "map-pricing-commercial",
    stageKey: "pnl_pricing",
    sourceDataKeys: [
      "pnl_pricing.pricing_model",
      "pnl_pricing.boq_inputs",
      "pnl_pricing.commercial_terms",
      "pnl_pricing.assumptions",
      "pnl_pricing.exclusions",
      "pnl_pricing.target_gp",
    ],
    requiredSourceDataKeys: [
      "pnl_pricing.pricing_model",
      "pnl_pricing.commercial_terms",
      "pnl_pricing.target_gp",
    ],
    targetBlocks: [
      {
        blockKey: "pricing.table.single",
        blockLabel: "Pricing Table",
        blockFamily: "pricing",
        pdfStudioTarget: "pricing.table.single",
        intendedProposalSection: "Pricing Summary / Detailed Pricing",
      },
      {
        blockKey: "terms.standard",
        blockLabel: "Commercial Terms & Conditions",
        blockFamily: "terms",
        pdfStudioTarget: "terms.standard",
        intendedProposalSection: "Commercial Terms / Assumptions / Exclusions",
      },
    ],
    futureUse: ["Pricing Summary", "Detailed Pricing", "Commercial Terms", "Assumptions", "Exclusions"],
    readinessRule: "pricing_model, commercial_terms, and target_gp must be captured",
  },

  // 9. Tender Drafting → Full Proposal Assembly
  {
    id: "map-drafting-assembly",
    stageKey: "tender_drafting",
    sourceDataKeys: [
      "tender_drafting.approved_win_themes",
      "tender_drafting.solution_blueprint",
      "tender_drafting.pricing_summary",
      "tender_drafting.risk_mitigations",
    ],
    requiredSourceDataKeys: [
      "tender_drafting.approved_win_themes",
      "tender_drafting.solution_blueprint",
      "tender_drafting.pricing_summary",
    ],
    targetBlocks: [
      { blockKey: "intro.narrative", blockLabel: "Executive Summary", pdfStudioTarget: "intro.narrative", intendedProposalSection: "Executive Summary" },
      { blockKey: "scope.list", blockLabel: "Scope of Services", pdfStudioTarget: "scope.list", intendedProposalSection: "Scope" },
      { blockKey: "scope.table", blockLabel: "Scope Configuration", pdfStudioTarget: "scope.table", intendedProposalSection: "Solution Configuration" },
      { blockKey: "annexure.a.config", blockLabel: "Technical Annexure", pdfStudioTarget: "annexure.a.config", intendedProposalSection: "Technical Volume" },
      { blockKey: "annexure.b.sla_matrix", blockLabel: "SLA Matrix", pdfStudioTarget: "annexure.b.sla_matrix", intendedProposalSection: "Service Levels" },
      { blockKey: "pricing.table.single", blockLabel: "Pricing Table", pdfStudioTarget: "pricing.table.single", intendedProposalSection: "Commercial Volume" },
      { blockKey: "terms.standard", blockLabel: "Terms & Conditions", pdfStudioTarget: "terms.standard", intendedProposalSection: "Legal / Terms" },
    ],
    futureUse: ["Technical Proposal Draft", "Commercial Proposal Draft", "PDF Studio Assembly"],
    readinessRule: "approved_win_themes, solution_blueprint, and pricing_summary must be captured",
  },
];

// ═══════════════════════════════════════════════════════════
// READINESS EVALUATOR — Pure helper. No side effects.
// ═══════════════════════════════════════════════════════════

/**
 * Resolve a dot-delimited path against an object.
 * Returns undefined if any segment is missing.
 *
 * Example: getValueByPath(obj, "sow_data.scope_summary")
 */
export function getValueByPath(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const segments = path.split(".");
  let current: any = obj;
  for (const seg of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[seg];
  }
  return current;
}

/**
 * Default/placeholder labels that should never count as meaningful data.
 * These are structural labels, not user-captured content.
 */
const DEFAULT_LABELS: ReadonlySet<string> = new Set([
  "not assessed",
  "not captured",
  "unknown",
  "not available",
  "not decided",
  "open",            // default status on assessment rows
  "",
]);

/**
 * Structural row labels (area/dimension names) that exist as scaffolding,
 * not user-captured content. These should not make a row "meaningful".
 */
const STRUCTURAL_FIELD_KEYS: ReadonlySet<string> = new Set([
  "area",
  "dimension",
  "question",
  "key",
  "label",
]);

/**
 * Determine if a primitive value is meaningful (not a placeholder/default).
 *
 * Boolean note: Only `true` counts as meaningful. `false` is the default
 * state for checkboxes (e.g. clarification_needed) and should not make
 * a row appear as if the user entered real data.
 */
function isPrimitiveMeaningful(value: any): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value === true;
  if (typeof value === "number") return true;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) return false;
    return !DEFAULT_LABELS.has(trimmed);
  }
  return false;
}

/**
 * Determine if an object-type row (like a coverage_matrix row or capability
 * assessment row) contains at least one meaningful user-entered value.
 *
 * Structural fields (area, dimension, question, key, label) are ignored —
 * they are scaffolding, not captured data.
 *
 * A row is meaningful only if at least one non-structural field
 * contains a meaningful value.
 */
function isRowMeaningful(row: Record<string, any>): boolean {
  for (const [key, val] of Object.entries(row)) {
    // Skip structural scaffold fields
    if (STRUCTURAL_FIELD_KEYS.has(key)) continue;
    // Recursively check the value
    if (isMeaningfulTenderValue(val)) return true;
  }
  return false;
}

/**
 * Hardened meaningfulness check for tender data values.
 *
 * Treats these as NOT meaningful:
 *   - null, undefined
 *   - empty string / whitespace-only
 *   - placeholder labels: "Not Assessed", "Not captured", "Unknown",
 *     "Not available", "Not decided", "Open"
 *   - empty array []
 *   - array where every item is a default/unassessed row
 *   - empty object {}
 *   - object where every field is empty/default
 *
 * Treats these as meaningful:
 *   - non-default string (real evidence, real notes, real owner)
 *   - number (including 0)
 *   - boolean
 *   - array with at least one row containing user-entered data
 *   - object with at least one field containing user-entered data
 *
 * PURE — no side effects, no database, no AI, no mutations.
 */
export function isMeaningfulTenderValue(value: any): boolean {
  if (value == null) return false;

  // Primitives — boolean `false` is a default checkbox state, not user intent
  if (typeof value === "boolean") return value === true;
  if (typeof value === "number") return true;
  if (typeof value === "string") return isPrimitiveMeaningful(value);

  // Arrays — meaningful only if at least one item has real data
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    return value.some(item => {
      if (item == null) return false;
      if (typeof item === "object" && !Array.isArray(item)) {
        return isRowMeaningful(item);
      }
      return isMeaningfulTenderValue(item);
    });
  }

  // Objects — meaningful only if at least one non-structural field has real data
  if (typeof value === "object") {
    return isRowMeaningful(value);
  }

  return false;
}

/**
 * Legacy alias — kept for backward compatibility but delegates
 * to the hardened version.
 */
export function isMeaningfulValue(value: any): boolean {
  return isMeaningfulTenderValue(value);
}

/**
 * Evaluate whether a proposal block mapping has sufficient source data.
 *
 * RULES:
 * - Inspects actual tenderData only.
 * - Never invents missing data.
 * - Never calls AI.
 * - Never writes to database.
 * - Never mutates tenderData.
 * - Never modifies PDF Studio.
 * - Uses isMeaningfulTenderValue (hardened) for all checks.
 * - Returns a pure result object.
 */
export function evaluateProposalBlockReadiness(
  mapping: ProposalBlockMapping,
  tenderData: Record<string, any> | null | undefined,
): BlockReadinessResult {
  if (!tenderData) {
    return {
      mappingId: mapping.id,
      stageKey: mapping.stageKey,
      status: "not_ready",
      ready: false,
      missingRequiredData: [...mapping.requiredSourceDataKeys],
      availableData: [],
      message: "No tender data available.",
    };
  }

  const available: string[] = [];
  const missing: string[] = [];

  for (const key of mapping.requiredSourceDataKeys) {
    const val = getValueByPath(tenderData, key);
    if (isMeaningfulTenderValue(val)) {
      available.push(key);
    } else {
      missing.push(key);
    }
  }

  // Also check optional source data for reporting
  for (const key of mapping.sourceDataKeys) {
    if (mapping.requiredSourceDataKeys.includes(key)) continue;
    const val = getValueByPath(tenderData, key);
    if (isMeaningfulTenderValue(val)) {
      available.push(key);
    }
  }

  const ready = missing.length === 0;

  return {
    mappingId: mapping.id,
    stageKey: mapping.stageKey,
    status: ready ? "ready_to_draft" : "not_ready",
    ready,
    missingRequiredData: missing,
    availableData: available,
    message: ready
      ? "Required source data is available."
      : `Missing required source data: ${missing.join(", ")}`,
  };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/** Get all contracts for a given stage */
export function getStageContract(stageKey: StageKey): StageDataContract | undefined {
  return STAGE_DATA_CONTRACTS.find(c => c.stageKey === stageKey);
}

/** Get all block mappings for a given stage */
export function getStageMappings(stageKey: StageKey): ProposalBlockMapping[] {
  return PROPOSAL_BLOCK_MAPPINGS.filter(m => m.stageKey === stageKey);
}

/** Map internal tender stage string to StageKey (best-effort) */
export function toStageKey(stageValue: string): StageKey {
  const map: Record<string, StageKey> = {
    identified: "identified",
    qualification: "qualification",
    bid_no_bid: "bid_no_bid",
    solution_design: "solution_design",
    pnl_pricing: "pnl_pricing",
    tender_drafting: "tender_drafting",
    internal_review: "internal_review",
    approval_matrix: "approval_matrix",
    final_approved: "final_approved",
    submitted: "submitted",
    clarification: "clarification",
    technical_review: "technical_review",
    commercial_review: "commercial_review",
    negotiation: "award",
    awarded: "award",
    lost_withdrawn: "lost",
  };
  return map[stageValue] || "identified";
}
