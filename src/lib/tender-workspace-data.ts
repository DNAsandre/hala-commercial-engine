/**
 * tender-workspace-data.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.12).
 *
 * Type definitions + pure label/color/summarize helpers for the Tender
 * Workspace. No records live here: reads go through
 * lib/supabase-tender-data.ts and writes through lib/supabase-tender-actions.ts.
 *
 * SX-007 (plan v3 section 6, Rev 2 ruling): the entire gate/enforcement
 * surface — all 14 quarantined symbols, including the gate data types and
 * labels — is EXCLUDED from this module. Nothing here defines, evaluates,
 * blocks, or enforces any gate. Callers that needed that surface are
 * blocked on SX-007.
 */

import type { Tender } from "./tender-engine";

// ─── TENDER PACK ───────────────────────────────────────────

export type TenderPackType =
  | "internal_master"
  | "external_submission"
  | "technical"
  | "commercial"
  | "compliance"
  | "clarification_response"
  | "contract_conversion";

export type TenderPackStatus =
  | "not_started"
  | "drafting"
  | "in_review"
  | "blocked_mock"
  | "ready_for_approval"
  | "approved_for_submission"
  | "submitted_mock"
  | "superseded"
  | "withdrawn"
  | "archived";

export type PackSectionStatus = "not_started" | "drafting" | "in_review" | "approved" | "needs_revision";
export type PackSectionApproval = "not_reviewed" | "mock_reviewed" | "future_approval_required";

export interface TenderPackSection {
  id: string;
  packId: string;
  title: string;
  owner: string;
  status: PackSectionStatus;
  missingPlaceholders: number;
  lastUpdated: string;
  approvalState: PackSectionApproval;
}

// Internal (non-exported): referenced by TenderPack only.
interface ReadinessBreakdown {
  sections: number;
  placeholders: number;
  required_documents: number;
  compliance: number;
  readiness_signals: number;
  outputs: number;
}

export interface TenderPack {
  id: string;
  tenderWorkspaceId: string;
  packName: string;
  packType: TenderPackType;
  isMaster: boolean;
  isExternalSubmittable: boolean;
  status: TenderPackStatus;
  readinessScore: number;
  version: number;
  ownerId: string;
  ownerName: string;
  sectionsTotal: number;
  sectionsDrafted: number;
  placeholdersTotal: number;
  placeholdersPopulated: number;
  documentsTotal: number;
  documentsReady: number;
  complianceTotal: number;
  complianceCompliant: number;
  compliancePartial: number;
  approvalsTotal: number;
  approvalsComplete: number;
  createdAt: string;
  updatedAt: string;
  sections: TenderPackSection[];
  readinessBreakdown: ReadinessBreakdown;
  readinessWarnings: string[];
  advisoryActions: string[];
}

// ─── ACTIVITY EVENT ────────────────────────────────────────

export type ActivityCategory = "workspace" | "pack" | "placeholder" | "required_document" | "compliance" | "gate" | "signal" | "split_pack" | "submission_email" | "review" | "crm_sync_mock";
export type EventSeverity = "info" | "warning" | "high" | "critical";

export interface TenderActivityEvent {
  id: string;
  tenderWorkspaceId: string;
  eventType: string;
  title?: string;
  description: string;
  category?: ActivityCategory;
  userId: string;
  userName: string;
  role?: string;
  timestamp: string;
  relatedPack?: string;
  relatedModule?: string;
  severity?: EventSeverity;
  mock?: boolean;
  notes?: string;
}

// ─── AUDIT ENTRY ───────────────────────────────────────────

export type AuditCategory = "TENDER" | "PACK" | "PLACEHOLDER" | "DOCUMENT" | "COMPLIANCE" | "GATE" | "SIGNAL" | "SPLIT_OUTPUT" | "SUBMISSION" | "CRM_SYNC" | "SYSTEM";

export interface TenderAuditEntry {
  id: string;
  tenderWorkspaceId: string;
  action: string;
  eventCode?: string;
  eventName?: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  category?: AuditCategory;
  userId: string;
  userName: string;
  role?: string;
  timestamp: string;
  details: string;
  beforeState?: string;
  afterState?: string;
  severity?: EventSeverity;
  mock?: boolean;
  traceId?: string;
  notes?: string;
}

export const ACTIVITY_CATEGORIES: { value: ActivityCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "workspace", label: "Workspace" },
  { value: "pack", label: "Pack" },
  { value: "placeholder", label: "Placeholder" },
  { value: "required_document", label: "Required Document" },
  { value: "compliance", label: "Compliance" },
  { value: "gate", label: "Gate" },
  { value: "signal", label: "Readiness Signal" },
  { value: "split_pack", label: "Split Pack" },
  { value: "submission_email", label: "Submission Email" },
  { value: "review", label: "Review" },
  { value: "crm_sync_mock", label: "CRM Sync" },
];

export const AUDIT_CATEGORIES: { value: AuditCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "TENDER", label: "Tender" },
  { value: "PACK", label: "Pack" },
  { value: "PLACEHOLDER", label: "Placeholder" },
  { value: "DOCUMENT", label: "Document" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "GATE", label: "Gate" },
  { value: "SIGNAL", label: "Readiness Signal" },
  { value: "SPLIT_OUTPUT", label: "Split Output" },
  { value: "SUBMISSION", label: "Submission" },
  { value: "CRM_SYNC", label: "CRM Sync" },
  { value: "SYSTEM", label: "System" },
];

export const SEVERITY_OPTIONS: { value: EventSeverity | "all"; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function getSeverityColor(s?: EventSeverity): string {
  if (s === "critical") return "text-red-700 bg-red-50 border-red-200";
  if (s === "high") return "text-orange-700 bg-orange-50 border-orange-200";
  if (s === "warning") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

export function getActivityCategoryLabel(c?: ActivityCategory): string {
  if (!c) return "General";
  return ACTIVITY_CATEGORIES.find(x => x.value === c)?.label || c;
}

export function getAuditCategoryLabel(c?: AuditCategory): string {
  if (!c) return "General";
  return AUDIT_CATEGORIES.find(x => x.value === c)?.label || c;
}

// TENDER DOCUMENT LIBRARY

export type TenderDocumentCategory = "Source" | "Supporting" | "Generated" | "Submission" | "Archived";
export type TenderDocumentStatus =
  | "Uploaded"
  | "Pending Review"
  | "Reviewed"
  | "Missing"
  | "Expired"
  | "Needs Update"
  | "Superseded"
  | "Final"
  | "Submitted";
export type TenderStageRelevance =
  | "Identified"
  | "Qualification"
  | "Bid / No-Bid"
  | "Pricing"
  | "Solutioning"
  | "Tender Drafting"
  | "Proposal Drafting"
  | "Review"
  | "Approval"
  | "Submission"
  | "Award"
  | "Post Submission";

export interface TenderDocument {
  id: string;
  tender_id: string;
  document_name: string;
  document_category: TenderDocumentCategory;
  document_type: string;
  file_url: string;
  storage_path: string;
  version: string;
  status: TenderDocumentStatus;
  stage_relevance: TenderStageRelevance[];
  owner: string;
  uploaded_by: string;
  uploaded_at: string;
  received_date: string;
  expiry_date: string;
  required_for_submission: boolean;
  linked_requirement_id: string;
  linked_proposal_section: string;
  source_channel: string;
  buyer_reference_number: string;
  notes: string;
  // ── Additive Tender Knowledge Base metadata (all optional; persisted in the
  //    existing documents JSONB list, no schema change). ──
  /** Orchestration source role (e.g. "RFQ", "SOW", "commercial_proposal"). */
  source_role?: string;
  /** Whether this document is included in orchestration (default treated as true). */
  orchestration_included?: boolean;
  /** Extraction readiness state (e.g. "uploaded", "ready_for_extraction"). */
  extraction_readiness?: string;
  /** Marks the primary RFQ/RFP/SOW for later extraction. */
  primary_source?: boolean;
}

export const TENDER_DOCUMENT_CATEGORIES: TenderDocumentCategory[] = ["Source", "Supporting", "Generated", "Submission", "Archived"];
export const TENDER_DOCUMENT_STATUSES: TenderDocumentStatus[] = ["Uploaded", "Pending Review", "Reviewed", "Missing", "Expired", "Needs Update", "Superseded", "Final", "Submitted"];
export const TENDER_STAGE_RELEVANCE: TenderStageRelevance[] = ["Identified", "Qualification", "Bid / No-Bid", "Pricing", "Solutioning", "Tender Drafting", "Proposal Drafting", "Review", "Approval", "Submission", "Award", "Post Submission"];
export const TENDER_STAGE_RELEVANCE_OPTIONS: TenderStageRelevance[] = TENDER_STAGE_RELEVANCE.filter(stage => stage !== "Proposal Drafting");

export const TENDER_DOCUMENT_TYPE_OPTIONS = [
  "RFP / RFQ",
  "TOR / SOW",
  "BOQ / Pricing Template",
  "Submission Instructions",
  "Contract Draft",
  "SLA / KPI Appendix",
  "Technical Requirements",
  "Commercial Terms",
  "Clarification Addendum",
  "Official Buyer Response",
  "Company Profile",
  "Commercial Registration",
  "VAT Certificate",
  "ISO Certificate",
  "License",
  "Insurance Certificate",
  "Fleet List",
  "Warehouse Profile",
  "SOP",
  "HSE Policy",
  "Case Study",
  "Client Reference",
  "Org Chart",
  "CV",
  "Authorization Letter",
  "Compliance Matrix",
  "Clarification Log",
  "Technical Proposal",
  "Commercial Proposal",
  "Pricing Sheet",
  "Review Pack",
  "Signed Form",
  "Bond / Guarantee",
  "Portal Receipt",
  "Submission Package",
  "Other",
];

export function getTenderDocumentStatusColor(s: TenderDocumentStatus): string {
  return ({
    Uploaded: "text-blue-700 bg-blue-50 border-blue-200",
    "Pending Review": "text-amber-700 bg-amber-50 border-amber-200",
    Reviewed: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Missing: "text-red-700 bg-red-50 border-red-200",
    Expired: "text-red-700 bg-red-50 border-red-200",
    "Needs Update": "text-amber-700 bg-amber-50 border-amber-200",
    Superseded: "text-slate-600 bg-slate-50 border-slate-200",
    Final: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Submitted: "text-[#075eea] bg-[#075eea]/10 border-[#075eea]/20",
  })[s];
}

export function isTenderDocumentExpired(doc: TenderDocument, at = new Date()): boolean {
  if (!doc.expiry_date) return false;
  return new Date(doc.expiry_date).getTime() < new Date(at.toDateString()).getTime();
}

export function stageLabelFromInternalStage(stage: string): TenderStageRelevance {
  const stageKey = stage.trim();
  if (TENDER_STAGE_RELEVANCE.includes(stageKey as TenderStageRelevance)) {
    return stageKey as TenderStageRelevance;
  }

  const normalizedStageKey = stageKey.toLowerCase();
  return ({
    identified: "Identified",
    qualification: "Qualification",
    bid_no_bid: "Bid / No-Bid",
    "bid / no-bid": "Bid / No-Bid",
    "bid / no bid": "Bid / No-Bid",
    "bid/no-bid": "Bid / No-Bid",
    solution_design: "Solutioning",
    "solution design": "Solutioning",
    pnl_pricing: "Pricing",
    "p&l / pricing": "Pricing",
    "p&l pricing": "Pricing",
    tender_drafting: "Tender Drafting",
    "tender drafting": "Tender Drafting",
    internal_review: "Review",
    "internal review": "Review",
    approval_matrix: "Approval",
    "approval matrix": "Approval",
    final_approved: "Approval",
    "final approved": "Approval",
    submitted: "Submission",
    clarification: "Post Submission",
    technical_review: "Post Submission",
    "technical review": "Post Submission",
    commercial_review: "Post Submission",
    "commercial review": "Post Submission",
    client_evaluation: "Post Submission",
    "client evaluation": "Post Submission",
    negotiation: "Post Submission",
    awarded: "Award",
    lost_withdrawn: "Post Submission",
    "lost / withdrawn": "Post Submission",
    "lost withdrawn": "Post Submission",
  } as Record<string, TenderStageRelevance>)[normalizedStageKey] ?? "Identified";
}

export function displayTenderDocumentStageRelevance(stage: TenderStageRelevance): string {
  return stage === "Proposal Drafting" ? "Tender Drafting" : stage;
}

export function canonicalTenderDocumentStageRelevance(stage: TenderStageRelevance): TenderStageRelevance {
  return stage === "Proposal Drafting" ? "Tender Drafting" : stage;
}

export function tenderDocumentMatchesStage(doc: TenderDocument, stage: string): boolean {
  const relevance = stageLabelFromInternalStage(stage);
  if (relevance === "Tender Drafting") {
    return doc.stage_relevance.includes("Tender Drafting") || doc.stage_relevance.includes("Proposal Drafting");
  }
  return doc.stage_relevance.includes(relevance);
}

export function documentsForTenderStage(docs: TenderDocument[], stage: string): TenderDocument[] {
  return docs.filter(doc => tenderDocumentMatchesStage(doc, stage));
}

// Internal (non-exported): return shape of summarizeTenderDocuments.
interface TenderDocumentSummary {
  total: number;
  source: number;
  supporting: number;
  generated: number;
  submission: number;
  archived: number;
  required: number;
  ready: number;
  reviewed: number;
  submitted: number;
  missing: number;
  expired: number;
  needsUpdate: number;
  issues: number;
}

export function summarizeTenderDocuments(docs: TenderDocument[]): TenderDocumentSummary {
  const summary: TenderDocumentSummary = {
    total: docs.length,
    source: 0,
    supporting: 0,
    generated: 0,
    submission: 0,
    archived: 0,
    required: 0,
    ready: 0,
    reviewed: 0,
    submitted: 0,
    missing: 0,
    expired: 0,
    needsUpdate: 0,
    issues: 0,
  };

  for (const doc of docs) {
    if (doc.document_category === "Source") summary.source += 1;
    if (doc.document_category === "Supporting") summary.supporting += 1;
    if (doc.document_category === "Generated") summary.generated += 1;
    if (doc.document_category === "Submission") summary.submission += 1;
    if (doc.document_category === "Archived") summary.archived += 1;
    if (doc.required_for_submission) summary.required += 1;
    if (doc.status === "Submitted" || doc.status === "Reviewed" || doc.status === "Final") summary.ready += 1;
    if (doc.status === "Reviewed" || doc.status === "Final") summary.reviewed += 1;
    if (doc.status === "Submitted") summary.submitted += 1;
    if (doc.status === "Missing") summary.missing += 1;
    if (doc.status === "Needs Update") summary.needsUpdate += 1;

    const expired = doc.status === "Expired" || isTenderDocumentExpired(doc);
    if (expired) summary.expired += 1;
    if (doc.status === "Missing" || doc.status === "Needs Update" || expired) summary.issues += 1;
  }

  return summary;
}

// ─── TENDER PLACEHOLDER ────────────────────────────────────

export type PlaceholderStatus = "missing" | "drafted" | "needs_evidence" | "in_review" | "approved";
export type PlaceholderCategory = "company_data" | "legal_registration" | "certification" | "safety_performance" | "fleet_operations" | "commercial" | "submission" | "governance";
export type EvidenceStatus = "not_required" | "required" | "attached_mock" | "missing";

export interface TenderPlaceholder {
  id: string;
  placeholderKey: string;
  label: string;
  packId: string;
  packName: string;
  sectionId: string;
  sectionTitle: string;
  category: PlaceholderCategory;
  owner: string;
  currentValue: string;
  status: PlaceholderStatus;
  source: string;
  evidenceStatus: EvidenceStatus;
  lastUpdated: string;
  approvedBy: string | null;
  wouldBlockInProduction: boolean;
  notes: string;
}

export const PLACEHOLDER_CATEGORIES: { value: PlaceholderCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "company_data", label: "Company Data" },
  { value: "legal_registration", label: "Legal / Registration" },
  { value: "certification", label: "Certification" },
  { value: "safety_performance", label: "Safety Performance" },
  { value: "fleet_operations", label: "Fleet / Operations" },
  { value: "commercial", label: "Commercial" },
  { value: "submission", label: "Submission" },
  { value: "governance", label: "Governance" },
];

export function getPlaceholderStatusLabel(s: PlaceholderStatus): string {
  return ({ missing: "Missing", drafted: "Drafted", needs_evidence: "Needs Evidence", in_review: "In Review", approved: "Approved" })[s];
}
export function getPlaceholderStatusColor(s: PlaceholderStatus): string {
  return ({ missing: "text-red-700 bg-red-50 border-red-200", drafted: "text-blue-700 bg-blue-50 border-blue-200", needs_evidence: "text-amber-700 bg-amber-50 border-amber-200", in_review: "text-[#075eea] bg-[#075eea]/10 border-[#075eea]/20", approved: "text-emerald-700 bg-emerald-50 border-emerald-200" })[s];
}
export function getCategoryLabel(c: PlaceholderCategory): string {
  return ({ company_data: "Company Data", legal_registration: "Legal / Registration", certification: "Certification", safety_performance: "Safety Performance", fleet_operations: "Fleet / Operations", commercial: "Commercial", submission: "Submission", governance: "Governance" })[c];
}
export function getEvidenceStatusLabel(e: EvidenceStatus): string {
  return ({ not_required: "Not Required", required: "Required", attached_mock: "Attached", missing: "Missing" })[e];
}

// ─── TENDER REQUIRED DOCUMENT ──────────────────────────────

export type RequiredDocStatus = "awaiting" | "uploaded" | "draft" | "in_review" | "approved" | "signed" | "stamped" | "ready" | "rejected" | "superseded" | "submitted_mock";
export type FileRequirementStatus = "not_required" | "missing" | "uploaded_mock" | "ready_mock";
export type RequiredDocCategory = "pricing_obk" | "bid_statement" | "transition" | "continuous_improvement" | "compliance_pack" | "legal_registration" | "insurance" | "certification" | "fleet_operations" | "hse" | "final_output";

export interface TenderRequiredDocument {
  id: string;
  documentName: string;
  packId: string;
  packName: string;
  category: RequiredDocCategory;
  owner: string;
  status: RequiredDocStatus;
  nativeRequired: boolean;
  signedPdfRequired: boolean;
  stampRequired: boolean;
  nativeStatus: FileRequirementStatus;
  signedPdfStatus: FileRequirementStatus;
  evidenceStatus: FileRequirementStatus;
  version: number;
  includedInOutput: boolean;
  wouldBlockInProduction: boolean;
  lastUpdated: string;
  notes: string;
}

/**
 * W04-C4 — required-document completion, derived only from a recorded set.
 *
 * The tender workspace previously computed this from a hardcoded 14-item list
 * of document names, fuzzy-matched on the FIRST WORD of each name, divided by a
 * literal `14`, and presented the result as progress. None of that denominator
 * belonged to the tender being viewed. This replaces it:
 *
 *   - if no requirement set is recorded, `percent` is null and `note` says so —
 *     "not recorded" is not "0% complete";
 *   - otherwise the denominator is the recorded set and the numerator is the
 *     entries that set itself marks satisfied (or that a named uploaded
 *     document matches in full, not on a first-word prefix).
 */
export interface RequiredDocumentsProgress {
  /** null ⇒ nothing is recorded to measure against; render no percentage. */
  percent: number | null;
  note: string;
  satisfied: number;
  total: number;
}

const SATISFIED_REQUIRED_DOC_STATUSES: ReadonlySet<RequiredDocStatus> = new Set<RequiredDocStatus>([
  "uploaded", "approved", "signed", "stamped", "ready",
]);

/**
 * TCW-T2 (P1): row shape of `type_details.submission_readiness.
 * required_documents[]` — the canonical register T1 is introducing. This type
 * mirrors the contract pinned in DESIGN-PINS P1; only the fields this
 * derivation reads are required here.
 */
export interface SubmissionReadinessRequiredDocument {
  id: string;
  document_name: string;
  status: "missing" | "in_progress" | "uploaded" | "approved" | "na";
  linked_document_id?: string;
  owner?: string;
  due_date?: string;
  notes?: string;
  updated_at?: string;
  updated_by?: string;
}

/** Register rows the P1 contract marks satisfied by their own status. */
const SATISFIED_REGISTER_STATUSES: ReadonlySet<SubmissionReadinessRequiredDocument["status"]> = new Set([
  "uploaded", "approved",
]);

type RequiredDocumentInput = TenderRequiredDocument | SubmissionReadinessRequiredDocument;

function isRegisterRow(doc: RequiredDocumentInput): doc is SubmissionReadinessRequiredDocument {
  return typeof (doc as SubmissionReadinessRequiredDocument).document_name === "string";
}

function requiredDocumentName(doc: RequiredDocumentInput): string {
  return (isRegisterRow(doc) ? doc.document_name : doc.documentName) ?? "";
}

export function buildRequiredDocumentsProgress(input: {
  /**
   * The recorded requirement set: either the legacy pack-derived rows or the
   * P1 `submission_readiness.required_documents` register rows (TCW-T2).
   */
  requiredDocuments: RequiredDocumentInput[];
  /** Whether a required-document set was actually read for this tender. */
  requiredDocumentsAssessed: boolean;
  uploadedDocumentNames: string[];
  /**
   * TCW-T2 (P1): ids of the tender's uploaded documents, for
   * `linked_document_id` matching. Optional — name matching still applies.
   */
  uploadedDocumentIds?: string[];
}): RequiredDocumentsProgress {
  const recorded = Array.isArray(input.requiredDocuments) ? input.requiredDocuments : [];
  // P1: register rows marked "na" are declared not applicable — they belong in
  // neither the numerator nor the denominator.
  const required = recorded.filter(doc => !(isRegisterRow(doc) && doc.status === "na"));

  if (!input.requiredDocumentsAssessed || required.length === 0) {
    return {
      percent: null,
      note: input.requiredDocumentsAssessed
        ? "No required documents are recorded for this tender, so there is nothing to measure completion against."
        : "The required-document list is not recorded for this tender, so no completion percentage can be derived.",
      satisfied: 0,
      total: 0,
    };
  }

  const uploaded = input.uploadedDocumentNames
    .map(n => (n ?? "").toLowerCase().trim())
    .filter(Boolean);
  const uploadedIds = new Set((input.uploadedDocumentIds ?? []).filter(Boolean));

  const satisfied = required.filter(doc => {
    if (isRegisterRow(doc)) {
      if (SATISFIED_REGISTER_STATUSES.has(doc.status)) return true;
      // P1: linked_document_id matching — an explicit link to an uploaded
      // document satisfies the requirement.
      if (doc.linked_document_id && uploadedIds.has(doc.linked_document_id)) return true;
    } else if (SATISFIED_REQUIRED_DOC_STATUSES.has(doc.status)) {
      return true;
    }
    // Full-name matching only (the entire recorded name must appear in the
    // uploaded document's name) — never first-word / prefix fuzzy matching.
    const name = requiredDocumentName(doc).toLowerCase().trim();
    return name.length > 0 && uploaded.some(n => n.includes(name));
  }).length;

  return {
    percent: Math.max(0, Math.min(100, Math.round((satisfied / required.length) * 100))),
    note: `${satisfied} of ${required.length} recorded required documents are accounted for.`,
    satisfied,
    total: required.length,
  };
}

/**
 * TCW-T2 (P1 loaded-flag truth): pure derivation for the two workspace
 * assessment flags, so the read layer and tests share one rule.
 *
 * - `requiredDocumentsAssessed` is true ONLY when the required-document
 *   collection was actually loaded for this tender — a loader that never ran
 *   (the pre-T1 `loaded:false` stub) must not present its empty array as an
 *   assessed-empty set.
 * - `riskInputsAssessed` requires BOTH risk inputs (compliance matrix and
 *   required-document set) to have been loaded; the risk verdict derives from
 *   both, so either one missing means "not assessed", never "green".
 *
 * Integration TODO (T1): route the real loaders' loaded flags through this
 * helper when assembling the workspace bundle.
 */
export function deriveTenderAssessmentFlags(input: {
  complianceItemsLoaded: boolean;
  requiredDocumentsLoaded: boolean;
}): { riskInputsAssessed: boolean; requiredDocumentsAssessed: boolean } {
  return {
    riskInputsAssessed: input.complianceItemsLoaded && input.requiredDocumentsLoaded,
    requiredDocumentsAssessed: input.requiredDocumentsLoaded,
  };
}

export const REQUIRED_DOC_CATEGORIES: { value: RequiredDocCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "pricing_obk", label: "Pricing / OBK" },
  { value: "bid_statement", label: "Bid Statement" },
  { value: "transition", label: "Transition" },
  { value: "continuous_improvement", label: "Continuous Improvement" },
  { value: "compliance_pack", label: "Compliance Pack" },
  { value: "legal_registration", label: "Legal / Registration" },
  { value: "insurance", label: "Insurance" },
  { value: "certification", label: "Certification" },
  { value: "fleet_operations", label: "Fleet / Operations" },
  { value: "hse", label: "HSE" },
  { value: "final_output", label: "Final Output" },
];

export function getDocStatusLabel(s: RequiredDocStatus): string {
  return ({ awaiting: "Awaiting", uploaded: "Uploaded", draft: "Draft", in_review: "In Review", approved: "Approved", signed: "Signed", stamped: "Stamped", ready: "Ready", rejected: "Rejected", superseded: "Superseded", submitted_mock: "Submitted" })[s];
}
export function getDocStatusColor(s: RequiredDocStatus): string {
  return ({ awaiting: "text-red-700 bg-red-50 border-red-200", uploaded: "text-blue-700 bg-blue-50 border-blue-200", draft: "text-slate-700 bg-slate-50 border-slate-200", in_review: "text-[#075eea] bg-[#075eea]/10 border-[#075eea]/20", approved: "text-emerald-700 bg-emerald-50 border-emerald-200", signed: "text-emerald-700 bg-emerald-50 border-emerald-200", stamped: "text-emerald-700 bg-emerald-50 border-emerald-200", ready: "text-emerald-700 bg-emerald-50 border-emerald-200", rejected: "text-red-700 bg-red-50 border-red-200", superseded: "text-slate-500 bg-slate-50 border-slate-200", submitted_mock: "text-blue-700 bg-blue-50 border-blue-200" })[s];
}
export function getDocCategoryLabel(c: RequiredDocCategory): string {
  return ({ pricing_obk: "Pricing / OBK", bid_statement: "Bid Statement", transition: "Transition", continuous_improvement: "Continuous Improvement", compliance_pack: "Compliance Pack", legal_registration: "Legal / Registration", insurance: "Insurance", certification: "Certification", fleet_operations: "Fleet / Operations", hse: "HSE", final_output: "Final Output" })[c];
}
export function getFileReqLabel(s: FileRequirementStatus): string {
  return ({ not_required: "Not Required", missing: "Missing", uploaded_mock: "Uploaded", ready_mock: "Ready" })[s];
}
export function getFileReqColor(s: FileRequirementStatus): string {
  return ({ not_required: "", missing: "text-red-700 bg-red-50 border-red-200", uploaded_mock: "text-blue-700 bg-blue-50 border-blue-200", ready_mock: "text-emerald-700 bg-emerald-50 border-emerald-200" })[s];
}

// ─── TENDER COMPLIANCE ITEM ────────────────────────────────

export type ComplianceStatus = "not_reviewed" | "compliant" | "partial" | "non_compliant" | "clarification_required" | "accepted_risk_mock";
export type ComplianceRisk = "low" | "medium" | "high" | "critical";
export type ComplianceCategory = "scope" | "vehicle_specifications" | "driver_requirements" | "safety_hse" | "adr_gdp" | "management_standards" | "insurance" | "kpi_pl_consequences" | "pricing_obk" | "bid_validity" | "performance_guarantee" | "transition" | "continuous_improvement" | "legal_terms" | "submission_format";

export interface TenderComplianceItem {
  id: string;
  reference: string;
  requirement: string;
  packId: string;
  packName: string;
  category: ComplianceCategory;
  status: ComplianceStatus;
  evidence: string;
  owner: string;
  riskLevel: ComplianceRisk;
  legalReviewRequired: boolean;
  commercialImpact: string;
  operationalImpact: string;
  clarificationNeeded: boolean;
  wouldBlockInProduction: boolean;
  lastUpdated: string;
  notes: string;
}

export const COMPLIANCE_CATEGORIES: { value: ComplianceCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "scope", label: "Scope" },
  { value: "vehicle_specifications", label: "Vehicle Specifications" },
  { value: "driver_requirements", label: "Driver Requirements" },
  { value: "safety_hse", label: "Safety / HSE" },
  { value: "adr_gdp", label: "ADR / GDP" },
  { value: "management_standards", label: "Management Standards" },
  { value: "insurance", label: "Insurance" },
  { value: "kpi_pl_consequences", label: "KPI / PL Consequences" },
  { value: "pricing_obk", label: "Pricing / OBK" },
  { value: "bid_validity", label: "Bid Validity" },
  { value: "performance_guarantee", label: "Performance Guarantee" },
  { value: "transition", label: "Transition" },
  { value: "continuous_improvement", label: "Continuous Improvement" },
  { value: "legal_terms", label: "Legal Terms" },
  { value: "submission_format", label: "Submission Format" },
];

export const COMPLIANCE_RISK_LEVELS: { value: ComplianceRisk | "all"; label: string }[] = [
  { value: "all", label: "All Risk Levels" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function getComplianceStatusLabel(s: ComplianceStatus): string {
  return ({ not_reviewed: "Not Reviewed", compliant: "Compliant", partial: "Partial", non_compliant: "Non-Compliant", clarification_required: "Clarification Required", accepted_risk_mock: "Accepted Risk" })[s];
}
export function getComplianceStatusColor(s: ComplianceStatus): string {
  return ({ not_reviewed: "text-slate-600 bg-slate-50 border-slate-200", compliant: "text-emerald-700 bg-emerald-50 border-emerald-200", partial: "text-amber-700 bg-amber-50 border-amber-200", non_compliant: "text-red-700 bg-red-50 border-red-200", clarification_required: "text-amber-700 bg-amber-50 border-amber-200", accepted_risk_mock: "text-[#075eea] bg-[#075eea]/10 border-[#075eea]/20" })[s];
}
export function getComplianceCategoryLabel(c: ComplianceCategory): string {
  return ({ scope: "Scope", vehicle_specifications: "Vehicle Specifications", driver_requirements: "Driver Requirements", safety_hse: "Safety / HSE", adr_gdp: "ADR / GDP", management_standards: "Management Standards", insurance: "Insurance", kpi_pl_consequences: "KPI / PL Consequences", pricing_obk: "Pricing / OBK", bid_validity: "Bid Validity", performance_guarantee: "Performance Guarantee", transition: "Transition", continuous_improvement: "Continuous Improvement", legal_terms: "Legal Terms", submission_format: "Submission Format" })[c];
}
export function getRiskLabel(r: ComplianceRisk): string {
  return ({ low: "Low", medium: "Medium", high: "High", critical: "Critical" })[r];
}
export function getRiskColor(r: ComplianceRisk): string {
  return ({ low: "text-emerald-700 bg-emerald-50 border-emerald-200", medium: "text-amber-700 bg-amber-50 border-amber-200", high: "text-red-600 bg-red-50 border-red-200", critical: "text-red-800 bg-red-100 border-red-300 font-semibold" })[r];
}

// ─── TENDER WORKSPACE (assembled by the Supabase read layer) ─

/**
 * W04-C4: a risk verdict is only a verdict when the data it derives from was
 * actually read. `not_assessed` is the honest fourth value for the case where
 * the compliance / required-document collections were never loaded — it must
 * never be collapsed into "green" (which reads to a human as "On Track").
 */
export type TenderRiskLevel = "green" | "amber" | "red" | "not_assessed";

export interface TenderWorkspace {
  tender: Tender;
  tenderType: string;
  readinessScore: number;
  riskLevel: TenderRiskLevel;
  /** W04-C4: false ⇒ `riskLevel` is `not_assessed`; render no verdict. */
  riskInputsAssessed: boolean;
  /** W04-C4: false ⇒ no required-document set is recorded; show no percentage. */
  requiredDocumentsAssessed: boolean;
  crmSyncStatus: "not_synced" | "synced" | "sync_failed" | "conflict" | "simulated";
  submissionModel: "single_pack" | "multi_pack";
  /**
   * W04-T08-A: raw `commercial_tickets.crm_pipeline_stage`, verbatim (null when
   * the column is unset). `tender.crmPipelineStage` is a normalized display
   * value that falls back to "prospecting"; that fallback must never be shown
   * as the saved stage.
   */
  crmPipelineStageRaw: string | null;
  packs: TenderPack[];
  placeholders: TenderPlaceholder[];
  requiredDocuments: TenderRequiredDocument[];
  documents: TenderDocument[];
  complianceItems: TenderComplianceItem[];
  activityEvents: TenderActivityEvent[];
  auditEntries: TenderAuditEntry[];
  splitChecks?: TenderSplitCheck[];
  packOutputs?: TenderPackOutput[];
  submissionEmails?: TenderSubmissionEmail[];
}

// ─── SPLIT PACK GENERATOR TYPES ────────────────────────────

// Internal (non-exported) unions referenced by the exported interfaces and
// label helpers below.
type SplitCheckStatus = "pass" | "warning" | "fail" | "would_block" | "not_checked" | "mock_bypassed";
type SplitCheckCategory = "internal_notes" | "cross_references" | "placeholders" | "required_documents" | "compliance" | "submission_gates" | "output_format" | "submittable_flag" | "final_review";
type PackOutputStatus = "draft_mock" | "generated_mock" | "generated_with_warnings" | "would_fail_production" | "superseded_mock";

export interface TenderSplitCheck {
  id: string;
  checkName: string;
  description: string;
  category: SplitCheckCategory;
  sourcePackId: string;
  targetPackId: string;
  status: SplitCheckStatus;
  severity: "low" | "medium" | "high" | "critical";
  wouldBlockInProduction: boolean;
  mockResolution: string;
  notes: string;
}

export interface TenderPackOutput {
  id: string;
  outputName: string;
  tenderPackId: string;
  packName: string;
  sourcePackId: string;
  outputType: string;
  format: string;
  version: string;
  status: PackOutputStatus;
  generatedBy: string;
  generatedAt: string;
  watermark: string;
  isTestOutput: boolean;
  wouldBeSubmittableInProduction: boolean;
  readinessWarningsCount: number;
  notes: string;
}

export function getSplitCheckStatusLabel(s: SplitCheckStatus): string {
  return ({ pass: "Pass", warning: "Warning", fail: "Flagged", would_block: "Review Recommended", not_checked: "Not Checked", mock_bypassed: "Overridden" })[s];
}
export function getSplitCheckStatusColor(s: SplitCheckStatus): string {
  return ({ pass: "text-emerald-700 bg-emerald-50 border-emerald-200", warning: "text-amber-700 bg-amber-50 border-amber-200", fail: "text-red-700 bg-red-50 border-red-200", would_block: "text-red-700 bg-red-50 border-red-200", not_checked: "text-gray-600 bg-gray-50 border-gray-200", mock_bypassed: "text-blue-700 bg-blue-50 border-blue-200" })[s];
}
export function getSplitCheckCategoryLabel(c: SplitCheckCategory): string {
  return ({ internal_notes: "Internal Notes", cross_references: "Cross References", placeholders: "Placeholders", required_documents: "Required Documents", compliance: "Compliance", submission_gates: "Submission Gates", output_format: "Output Format", submittable_flag: "Submittable Flag", final_review: "Final Review" })[c];
}
export function getPackOutputStatusLabel(s: PackOutputStatus): string {
  return ({ draft_mock: "Draft", generated_mock: "Generated", generated_with_warnings: "Generated With Warnings", would_fail_production: "Requires Correction", superseded_mock: "Superseded" })[s];
}
export function getPackOutputStatusColor(s: PackOutputStatus): string {
  return ({ draft_mock: "text-slate-600 bg-slate-50 border-slate-200", generated_mock: "text-emerald-700 bg-emerald-50 border-emerald-200", generated_with_warnings: "text-amber-700 bg-amber-50 border-amber-200", would_fail_production: "text-red-700 bg-red-50 border-red-200", superseded_mock: "text-slate-500 bg-slate-50 border-slate-200" })[s];
}

// ─── SUBMISSION EMAIL REVIEW TYPES ─────────────────────────

// Internal (non-exported) unions referenced by the exported interface and
// label helpers below.
type SubmissionEmailStatus = "draft_mock" | "ready_mock" | "simulated_submitted" | "simulated_with_warnings" | "would_fail_production";
export type SubmissionEmailType = "bulk_submission" | "pgp_submission" | "test_bundle";
type AttachmentStatus = "ready_mock" | "missing" | "included_mock" | "warning";

// Internal (non-exported): referenced by TenderSubmissionEmail only.
interface TenderSubmissionAttachment {
  id: string;
  fileName: string;
  documentType: string;
  format: string;
  required: boolean;
  included: boolean;
  status: AttachmentStatus;
  sizeMb: number;
  notes: string;
}

export interface TenderSubmissionEmail {
  id: string;
  tenderPackId: string;
  packName: string;
  emailType: SubmissionEmailType;
  to: string;
  ccExternal: string;
  ccInternal: string;
  subject: string;
  body: string;
  attachments: TenderSubmissionAttachment[];
  attachmentSizeMb: number;
  status: SubmissionEmailStatus;
  simulated: boolean;
  submittedBy: string;
  submittedAt: string | null;
  crmSyncStatus: string;
  warningsCount: number;
  notes: string;
}

export function getEmailStatusLabel(s: SubmissionEmailStatus): string {
  return ({ draft_mock: "Draft", ready_mock: "Ready", simulated_submitted: "Recorded", simulated_with_warnings: "Recorded With Warnings", would_fail_production: "Requires Correction" })[s];
}
export function getEmailStatusColor(s: SubmissionEmailStatus): string {
  return ({ draft_mock: "text-slate-600 bg-slate-50 border-slate-200", ready_mock: "text-blue-700 bg-blue-50 border-blue-200", simulated_submitted: "text-emerald-700 bg-emerald-50 border-emerald-200", simulated_with_warnings: "text-amber-700 bg-amber-50 border-amber-200", would_fail_production: "text-red-700 bg-red-50 border-red-200" })[s];
}
export function getEmailTypeLabel(t: SubmissionEmailType): string {
  return ({ bulk_submission: "Bulk Submission", pgp_submission: "PGP Submission", test_bundle: "Combined Bundle" })[t];
}
export function getAttachmentStatusLabel(s: AttachmentStatus): string {
  return ({ ready_mock: "Ready", missing: "Missing", included_mock: "Included", warning: "Warning" })[s];
}
export function getAttachmentStatusColor(s: AttachmentStatus): string {
  return ({ ready_mock: "text-emerald-700 bg-emerald-50 border-emerald-200", missing: "text-red-700 bg-red-50 border-red-200", included_mock: "text-blue-700 bg-blue-50 border-blue-200", warning: "text-amber-700 bg-amber-50 border-amber-200" })[s];
}

// ─── PACK / SECTION LABEL HELPERS ──────────────────────────

export function getPackStatusLabel(status: TenderPackStatus): string {
  const labels: Record<TenderPackStatus, string> = {
    not_started: "Not Started",
    drafting: "Drafting",
    in_review: "In Review",
    blocked_mock: "Review Hold",
    ready_for_approval: "Ready for Approval",
    approved_for_submission: "Approved for Submission",
    submitted_mock: "Submitted",
    superseded: "Superseded",
    withdrawn: "Withdrawn",
    archived: "Archived",
  };
  return labels[status] ?? status;
}

export function getPackTypeLabel(type: TenderPackType): string {
  const labels: Record<TenderPackType, string> = {
    internal_master: "Internal Master",
    external_submission: "External Submission Pack",
    technical: "Technical Pack",
    commercial: "Commercial Pack",
    compliance: "Compliance Pack",
    clarification_response: "Clarification Response",
    contract_conversion: "Contract Conversion Pack",
  };
  return labels[type] ?? type;
}

export function getSectionStatusLabel(status: PackSectionStatus): string {
  const labels: Record<PackSectionStatus, string> = {
    not_started: "Not Started", drafting: "Drafting", in_review: "In Review",
    approved: "Approved", needs_revision: "Needs Revision",
  };
  return labels[status] ?? status;
}

export function getSectionStatusColor(status: PackSectionStatus): string {
  const colors: Record<PackSectionStatus, string> = {
    not_started: "text-gray-600 bg-gray-50 border-gray-200",
    drafting: "text-blue-700 bg-blue-50 border-blue-200",
    in_review: "text-amber-700 bg-amber-50 border-amber-200",
    approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
    needs_revision: "text-red-700 bg-red-50 border-red-200",
  };
  return colors[status] ?? "";
}

export function getSectionApprovalLabel(state: PackSectionApproval): string {
  const labels: Record<PackSectionApproval, string> = {
    not_reviewed: "Not Reviewed", mock_reviewed: "Reviewed",
    future_approval_required: "Approval Required",
  };
  return labels[state] ?? state;
}
