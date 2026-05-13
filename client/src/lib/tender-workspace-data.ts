/**
 * Tender Workspace Data — Type definitions + legacy mock data
 *
 * SUPA-008: Types, labels, and UI helpers in this file are actively used.
 * Mock data arrays (sections, packs, placeholders, activity, audit) below
 * are DEAD CODE — retained for reference only. All reads now go through
 * supabase-tender-data.ts and all writes through supabase-tender-actions.ts.
 *
 * DO NOT add new mock data. New features should persist via Supabase.
 */

import { getTenderById, type Tender } from "./tender-engine";

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

export interface ReadinessBreakdown {
  sections: number;
  placeholders: number;
  required_documents: number;
  compliance: number;
  mock_gates: number;
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
  mockWarnings: string[];
  mockActions: string[];
}

// ─── MOCK GATE ─────────────────────────────────────────────

export type MockGateStatus =
  | "not_started"
  | "pass"
  | "warning"
  | "fail"
  | "would_block"
  | "mock_bypassed"
  | "not_applicable";

export type GateSeverity = "low" | "medium" | "high" | "critical";
export type GateCategory = "placeholder" | "required_document" | "compliance" | "commercial" | "legal" | "submission_format" | "internal_control" | "final_review";
export type GateEnforcement = "mock_only" | "warn_future" | "would_enforce_production";
export type GateRuntime = "development_marker" | "warning_only" | "soft_simulation";

export interface TenderMockGate {
  id: string;
  tenderWorkspaceId: string;
  tenderPackId: string | null;
  gateCode: string;
  gateName: string;
  gateDescription: string;
  status: MockGateStatus;
  severity: GateSeverity;
  category: GateCategory;
  enforcementMode: GateEnforcement;
  runtimeMode: GateRuntime;
  doctrineRequired: boolean;
  isMock: boolean;
  wouldBlock: boolean;
  wouldBlockReason: string;
  allowTestBypass: boolean;
  linkedSignal: string;
  ownerId: string | null;
  ownerName: string | null;
  evaluatedAt: string | null;
  notes: string;
}

export const GATE_CATEGORIES: { value: GateCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "placeholder", label: "Placeholder" },
  { value: "required_document", label: "Required Document" },
  { value: "compliance", label: "Compliance" },
  { value: "commercial", label: "Commercial" },
  { value: "legal", label: "Legal" },
  { value: "submission_format", label: "Submission Format" },
  { value: "internal_control", label: "Internal Control" },
  { value: "final_review", label: "Final Review" },
];

export const GATE_SEVERITIES: { value: GateSeverity | "all"; label: string }[] = [
  { value: "all", label: "All Severities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function getGateSeverityColor(s: GateSeverity): string {
  return ({ low: "text-emerald-700 bg-emerald-50 border-emerald-200", medium: "text-amber-700 bg-amber-50 border-amber-200", high: "text-red-600 bg-red-50 border-red-200", critical: "text-red-800 bg-red-100 border-red-300 font-semibold" })[s];
}
export function getGateCategoryLabel(c: GateCategory): string {
  return ({ placeholder: "Placeholder", required_document: "Required Document", compliance: "Compliance", commercial: "Commercial", legal: "Legal", submission_format: "Submission Format", internal_control: "Internal Control", final_review: "Final Review" })[c];
}
export function getGateEnforcementLabel(e: GateEnforcement): string {
  return ({ mock_only: "Mock Only", warn_future: "Warn (Future)", would_enforce_production: "Would Enforce in Production" })[e];
}
export function getGateRuntimeLabel(r: GateRuntime): string {
  return ({ development_marker: "Development Marker", warning_only: "Warning Only", soft_simulation: "Soft Simulation" })[r];
}
export function getGateStatusColor(s: MockGateStatus): string {
  return ({ not_started: "text-gray-600 bg-gray-50 border-gray-200", pass: "text-emerald-700 bg-emerald-50 border-emerald-200", warning: "text-amber-700 bg-amber-50 border-amber-200", fail: "text-red-700 bg-red-50 border-red-200", would_block: "text-red-700 bg-red-50 border-red-200", mock_bypassed: "text-blue-700 bg-blue-50 border-blue-200", not_applicable: "text-slate-500 bg-slate-50 border-slate-200" })[s];
}

// ─── ACTIVITY EVENT ────────────────────────────────────────

export type ActivityCategory = "workspace" | "pack" | "placeholder" | "required_document" | "compliance" | "gate" | "split_pack" | "submission_email" | "review" | "crm_sync_mock";
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

export type AuditCategory = "TENDER" | "PACK" | "PLACEHOLDER" | "DOCUMENT" | "COMPLIANCE" | "GATE" | "SPLIT_OUTPUT" | "SUBMISSION" | "CRM_SYNC" | "SYSTEM";

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
  { value: "split_pack", label: "Split Pack" },
  { value: "submission_email", label: "Submission Email" },
  { value: "review", label: "Review" },
  { value: "crm_sync_mock", label: "CRM Sync (Mock)" },
];

export const AUDIT_CATEGORIES: { value: AuditCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "TENDER", label: "Tender" },
  { value: "PACK", label: "Pack" },
  { value: "PLACEHOLDER", label: "Placeholder" },
  { value: "DOCUMENT", label: "Document" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "GATE", label: "Gate" },
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
  return ({ missing: "text-red-700 bg-red-50 border-red-200", drafted: "text-blue-700 bg-blue-50 border-blue-200", needs_evidence: "text-amber-700 bg-amber-50 border-amber-200", in_review: "text-violet-700 bg-violet-50 border-violet-200", approved: "text-emerald-700 bg-emerald-50 border-emerald-200" })[s];
}
export function getCategoryLabel(c: PlaceholderCategory): string {
  return ({ company_data: "Company Data", legal_registration: "Legal / Registration", certification: "Certification", safety_performance: "Safety Performance", fleet_operations: "Fleet / Operations", commercial: "Commercial", submission: "Submission", governance: "Governance" })[c];
}
export function getEvidenceStatusLabel(e: EvidenceStatus): string {
  return ({ not_required: "Not Required", required: "Required", attached_mock: "Attached (Mock)", missing: "Missing" })[e];
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
  return ({ awaiting: "Awaiting", uploaded: "Uploaded", draft: "Draft", in_review: "In Review", approved: "Approved", signed: "Signed", stamped: "Stamped", ready: "Ready", rejected: "Rejected", superseded: "Superseded", submitted_mock: "Submitted (Mock)" })[s];
}
export function getDocStatusColor(s: RequiredDocStatus): string {
  return ({ awaiting: "text-red-700 bg-red-50 border-red-200", uploaded: "text-blue-700 bg-blue-50 border-blue-200", draft: "text-slate-700 bg-slate-50 border-slate-200", in_review: "text-violet-700 bg-violet-50 border-violet-200", approved: "text-emerald-700 bg-emerald-50 border-emerald-200", signed: "text-emerald-700 bg-emerald-50 border-emerald-200", stamped: "text-emerald-700 bg-emerald-50 border-emerald-200", ready: "text-emerald-700 bg-emerald-50 border-emerald-200", rejected: "text-red-700 bg-red-50 border-red-200", superseded: "text-slate-500 bg-slate-50 border-slate-200", submitted_mock: "text-blue-700 bg-blue-50 border-blue-200" })[s];
}
export function getDocCategoryLabel(c: RequiredDocCategory): string {
  return ({ pricing_obk: "Pricing / OBK", bid_statement: "Bid Statement", transition: "Transition", continuous_improvement: "Continuous Improvement", compliance_pack: "Compliance Pack", legal_registration: "Legal / Registration", insurance: "Insurance", certification: "Certification", fleet_operations: "Fleet / Operations", hse: "HSE", final_output: "Final Output" })[c];
}
export function getFileReqLabel(s: FileRequirementStatus): string {
  return ({ not_required: "Not Required", missing: "Missing", uploaded_mock: "Uploaded (Mock)", ready_mock: "Ready (Mock)" })[s];
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
  return ({ not_reviewed: "Not Reviewed", compliant: "Compliant", partial: "Partial", non_compliant: "Non-Compliant", clarification_required: "Clarification Required", accepted_risk_mock: "Accepted Risk (Mock)" })[s];
}
export function getComplianceStatusColor(s: ComplianceStatus): string {
  return ({ not_reviewed: "text-slate-600 bg-slate-50 border-slate-200", compliant: "text-emerald-700 bg-emerald-50 border-emerald-200", partial: "text-amber-700 bg-amber-50 border-amber-200", non_compliant: "text-red-700 bg-red-50 border-red-200", clarification_required: "text-amber-700 bg-amber-50 border-amber-200", accepted_risk_mock: "text-violet-700 bg-violet-50 border-violet-200" })[s];
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

export interface TenderWorkspace {
  tender: Tender;
  tenderType: string;
  readinessScore: number;
  riskLevel: "green" | "amber" | "red";
  crmSyncStatus: "not_synced" | "synced" | "sync_failed" | "conflict" | "simulated";
  submissionModel: "single_pack" | "multi_pack";
  packs: TenderPack[];
  placeholders: TenderPlaceholder[];
  requiredDocuments: TenderRequiredDocument[];
  complianceItems: TenderComplianceItem[];
  mockGates: TenderMockGate[];
  activityEvents: TenderActivityEvent[];
  auditEntries: TenderAuditEntry[];
  splitChecks?: TenderSplitCheck[];
  packOutputs?: TenderPackOutput[];
  submissionEmails?: TenderSubmissionEmail[];
}

// ─── SPLIT PACK GENERATOR TYPES ────────────────────────────

export type SplitCheckStatus = "pass" | "warning" | "fail" | "would_block" | "not_checked" | "mock_bypassed";
export type SplitCheckCategory = "internal_notes" | "cross_references" | "placeholders" | "required_documents" | "compliance" | "submission_gates" | "output_format" | "submittable_flag" | "final_review";
export type PackOutputStatus = "draft_mock" | "generated_mock" | "generated_with_warnings" | "would_fail_production" | "superseded_mock";

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
  mockWarningsCount: number;
  notes: string;
}

export function getSplitCheckStatusLabel(s: SplitCheckStatus): string {
  return ({ pass: "Pass", warning: "Warning", fail: "Fail", would_block: "Would Block", not_checked: "Not Checked", mock_bypassed: "Mock Bypassed" })[s];
}
export function getSplitCheckStatusColor(s: SplitCheckStatus): string {
  return ({ pass: "text-emerald-700 bg-emerald-50 border-emerald-200", warning: "text-amber-700 bg-amber-50 border-amber-200", fail: "text-red-700 bg-red-50 border-red-200", would_block: "text-red-700 bg-red-50 border-red-200", not_checked: "text-gray-600 bg-gray-50 border-gray-200", mock_bypassed: "text-blue-700 bg-blue-50 border-blue-200" })[s];
}
export function getSplitCheckCategoryLabel(c: SplitCheckCategory): string {
  return ({ internal_notes: "Internal Notes", cross_references: "Cross References", placeholders: "Placeholders", required_documents: "Required Documents", compliance: "Compliance", submission_gates: "Submission Gates", output_format: "Output Format", submittable_flag: "Submittable Flag", final_review: "Final Review" })[c];
}
export function getPackOutputStatusLabel(s: PackOutputStatus): string {
  return ({ draft_mock: "Draft (Mock)", generated_mock: "Generated (Mock)", generated_with_warnings: "Generated With Warnings", would_fail_production: "Would Fail Production", superseded_mock: "Superseded (Mock)" })[s];
}
export function getPackOutputStatusColor(s: PackOutputStatus): string {
  return ({ draft_mock: "text-slate-600 bg-slate-50 border-slate-200", generated_mock: "text-emerald-700 bg-emerald-50 border-emerald-200", generated_with_warnings: "text-amber-700 bg-amber-50 border-amber-200", would_fail_production: "text-red-700 bg-red-50 border-red-200", superseded_mock: "text-slate-500 bg-slate-50 border-slate-200" })[s];
}

// ─── SUBMISSION EMAIL SIMULATOR TYPES ──────────────────────

export type SubmissionEmailStatus = "draft_mock" | "ready_mock" | "simulated_submitted" | "simulated_with_warnings" | "would_fail_production";
export type SubmissionEmailType = "bulk_submission" | "pgp_submission" | "test_bundle";
export type AttachmentStatus = "ready_mock" | "missing" | "included_mock" | "warning";

export interface TenderSubmissionAttachment {
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
  return ({ draft_mock: "Draft (Mock)", ready_mock: "Ready (Mock)", simulated_submitted: "Simulated Submitted", simulated_with_warnings: "Simulated With Warnings", would_fail_production: "Would Fail Production" })[s];
}
export function getEmailStatusColor(s: SubmissionEmailStatus): string {
  return ({ draft_mock: "text-slate-600 bg-slate-50 border-slate-200", ready_mock: "text-blue-700 bg-blue-50 border-blue-200", simulated_submitted: "text-emerald-700 bg-emerald-50 border-emerald-200", simulated_with_warnings: "text-amber-700 bg-amber-50 border-amber-200", would_fail_production: "text-red-700 bg-red-50 border-red-200" })[s];
}
export function getEmailTypeLabel(t: SubmissionEmailType): string {
  return ({ bulk_submission: "Bulk Submission", pgp_submission: "PGP Submission", test_bundle: "Test Bundle" })[t];
}
export function getAttachmentStatusLabel(s: AttachmentStatus): string {
  return ({ ready_mock: "Ready (Mock)", missing: "Missing", included_mock: "Included (Mock)", warning: "Warning" })[s];
}
export function getAttachmentStatusColor(s: AttachmentStatus): string {
  return ({ ready_mock: "text-emerald-700 bg-emerald-50 border-emerald-200", missing: "text-red-700 bg-red-50 border-red-200", included_mock: "text-blue-700 bg-blue-50 border-blue-200", warning: "text-amber-700 bg-amber-50 border-amber-200" })[s];
}

const LINDE_TENDER_ID = "tn-linde-001";

export const lindeTender: Tender = {
  id: LINDE_TENDER_ID,
  linkedWorkspaceId: null,
  customerId: "c-linde",
  customerName: "Linde SIGAS",
  title: "Linde SIGAS Transportation Tender",
  submissionDeadline: "2026-05-07",
  estimatedValue: 55600000,
  targetGpPercent: 21,
  probabilityPercent: 55,
  assignedOwner: "Amin Al-Halabi",
  assignedTeamMembers: ["Amin Al-Halabi", "Ra'ed", "Finance", "Legal", "Operations"],
  status: "preparing_submission",
  source: "Direct",
  region: "East",
  createdAt: "2026-03-15",
  updatedAt: "2026-04-28",
  daysInStatus: 12,
  notes: "Multi-pack transport tender. Internal master + Bulk + PGP external child packs.",
  crmSynced: false,
};

// ─── PACK SECTIONS ─────────────────────────────────────────

const masterSections: TenderPackSection[] = [
  { id: "ms-1", packId: "tp-linde-master", title: "Master document control", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-25", approvalState: "mock_reviewed" },
  { id: "ms-2", packId: "tp-linde-master", title: "Placeholder conventions", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-20", approvalState: "mock_reviewed" },
  { id: "ms-3", packId: "tp-linde-master", title: "Source content notes", owner: "Ra'ed", status: "drafting", missingPlaceholders: 3, lastUpdated: "2026-04-27", approvalState: "not_reviewed" },
  { id: "ms-4", packId: "tp-linde-master", title: "Bulk tender working content", owner: "Ra'ed", status: "in_review", missingPlaceholders: 5, lastUpdated: "2026-04-28", approvalState: "not_reviewed" },
  { id: "ms-5", packId: "tp-linde-master", title: "PGP tender working content", owner: "Ra'ed", status: "drafting", missingPlaceholders: 6, lastUpdated: "2026-04-28", approvalState: "not_reviewed" },
  { id: "ms-6", packId: "tp-linde-master", title: "Splitting instructions", owner: "Amin Al-Halabi", status: "drafting", missingPlaceholders: 2, lastUpdated: "2026-04-26", approvalState: "not_reviewed" },
  { id: "ms-7", packId: "tp-linde-master", title: "Pre-submission checklist", owner: "Amin Al-Halabi", status: "not_started", missingPlaceholders: 4, lastUpdated: "2026-04-15", approvalState: "not_reviewed" },
  { id: "ms-8", packId: "tp-linde-master", title: "Internal archive notes", owner: "Ra'ed", status: "not_started", missingPlaceholders: 2, lastUpdated: "2026-04-10", approvalState: "not_reviewed" },
];

const bulkSections: TenderPackSection[] = [
  { id: "bs-1", packId: "tp-linde-bulk", title: "Letter of submission", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-26", approvalState: "mock_reviewed" },
  { id: "bs-2", packId: "tp-linde-bulk", title: "Executive summary", owner: "Ra'ed", status: "in_review", missingPlaceholders: 1, lastUpdated: "2026-04-28", approvalState: "not_reviewed" },
  { id: "bs-3", packId: "tp-linde-bulk", title: "Understanding the requirement", owner: "Ra'ed", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-24", approvalState: "mock_reviewed" },
  { id: "bs-4", packId: "tp-linde-bulk", title: "Company capability and track record", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-22", approvalState: "mock_reviewed" },
  { id: "bs-5", packId: "tp-linde-bulk", title: "Operational approach — ADR Class 2 cryogenic transport", owner: "Ra'ed", status: "drafting", missingPlaceholders: 2, lastUpdated: "2026-04-28", approvalState: "not_reviewed" },
  { id: "bs-6", packId: "tp-linde-bulk", title: "Fleet plan and vehicle specifications", owner: "Ra'ed", status: "in_review", missingPlaceholders: 0, lastUpdated: "2026-04-27", approvalState: "not_reviewed" },
  { id: "bs-7", packId: "tp-linde-bulk", title: "HSE management and compliance", owner: "Ra'ed", status: "drafting", missingPlaceholders: 1, lastUpdated: "2026-04-27", approvalState: "not_reviewed" },
  { id: "bs-8", packId: "tp-linde-bulk", title: "Quality and continuous improvement", owner: "Ra'ed", status: "not_started", missingPlaceholders: 3, lastUpdated: "2026-04-15", approvalState: "not_reviewed" },
  { id: "bs-9", packId: "tp-linde-bulk", title: "Transition approach", owner: "Ra'ed", status: "drafting", missingPlaceholders: 2, lastUpdated: "2026-04-26", approvalState: "not_reviewed" },
  { id: "bs-10", packId: "tp-linde-bulk", title: "Governance and performance management", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-23", approvalState: "mock_reviewed" },
  { id: "bs-11", packId: "tp-linde-bulk", title: "Commercial approach", owner: "Amin Al-Halabi", status: "needs_revision", missingPlaceholders: 1, lastUpdated: "2026-04-28", approvalState: "future_approval_required" },
  { id: "bs-12", packId: "tp-linde-bulk", title: "Compliance matrix", owner: "Ra'ed", status: "not_started", missingPlaceholders: 0, lastUpdated: "2026-04-10", approvalState: "not_reviewed" },
  { id: "bs-13", packId: "tp-linde-bulk", title: "Document insert slots — Bulk pack", owner: "Ra'ed", status: "not_started", missingPlaceholders: 0, lastUpdated: "2026-04-10", approvalState: "not_reviewed" },
];

const pgpSections: TenderPackSection[] = [
  { id: "ps-1", packId: "tp-linde-pgp", title: "Letter of submission", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-26", approvalState: "mock_reviewed" },
  { id: "ps-2", packId: "tp-linde-pgp", title: "Executive summary", owner: "Ra'ed", status: "drafting", missingPlaceholders: 2, lastUpdated: "2026-04-28", approvalState: "not_reviewed" },
  { id: "ps-3", packId: "tp-linde-pgp", title: "Understanding the requirement", owner: "Ra'ed", status: "in_review", missingPlaceholders: 0, lastUpdated: "2026-04-27", approvalState: "not_reviewed" },
  { id: "ps-4", packId: "tp-linde-pgp", title: "Company capability and track record", owner: "Amin Al-Halabi", status: "approved", missingPlaceholders: 0, lastUpdated: "2026-04-22", approvalState: "mock_reviewed" },
  { id: "ps-5", packId: "tp-linde-pgp", title: "Operational approach — multi-city packaged-gas distribution", owner: "Ra'ed", status: "drafting", missingPlaceholders: 3, lastUpdated: "2026-04-28", approvalState: "not_reviewed" },
  { id: "ps-6", packId: "tp-linde-pgp", title: "Fleet plan and vehicle specifications", owner: "Ra'ed", status: "drafting", missingPlaceholders: 1, lastUpdated: "2026-04-27", approvalState: "not_reviewed" },
  { id: "ps-7", packId: "tp-linde-pgp", title: "HSE management, GDP and compliance", owner: "Ra'ed", status: "not_started", missingPlaceholders: 2, lastUpdated: "2026-04-15", approvalState: "not_reviewed" },
  { id: "ps-8", packId: "tp-linde-pgp", title: "Quality and continuous improvement", owner: "Ra'ed", status: "not_started", missingPlaceholders: 3, lastUpdated: "2026-04-10", approvalState: "not_reviewed" },
  { id: "ps-9", packId: "tp-linde-pgp", title: "Transition approach", owner: "Ra'ed", status: "drafting", missingPlaceholders: 2, lastUpdated: "2026-04-26", approvalState: "not_reviewed" },
  { id: "ps-10", packId: "tp-linde-pgp", title: "Governance and performance management", owner: "Amin Al-Halabi", status: "in_review", missingPlaceholders: 0, lastUpdated: "2026-04-25", approvalState: "not_reviewed" },
  { id: "ps-11", packId: "tp-linde-pgp", title: "Commercial approach", owner: "Amin Al-Halabi", status: "needs_revision", missingPlaceholders: 2, lastUpdated: "2026-04-28", approvalState: "future_approval_required" },
  { id: "ps-12", packId: "tp-linde-pgp", title: "Compliance matrix", owner: "Ra'ed", status: "not_started", missingPlaceholders: 0, lastUpdated: "2026-04-10", approvalState: "not_reviewed" },
  { id: "ps-13", packId: "tp-linde-pgp", title: "Document insert slots — PGP pack", owner: "Ra'ed", status: "not_started", missingPlaceholders: 0, lastUpdated: "2026-04-10", approvalState: "not_reviewed" },
];

// ─── LINDE PACKS (with sections + readiness) ───────────────

const lindePacks: TenderPack[] = [
  {
    id: "tp-linde-master", tenderWorkspaceId: LINDE_TENDER_ID, packName: "Internal Master Pack",
    packType: "internal_master", isMaster: true, isExternalSubmittable: false,
    status: "drafting", readinessScore: 70, version: 1,
    ownerId: "u-amin", ownerName: "Amin Al-Halabi",
    sectionsTotal: 8, sectionsDrafted: 4, placeholdersTotal: 62, placeholdersPopulated: 44,
    documentsTotal: 8, documentsReady: 5, complianceTotal: 18, complianceCompliant: 12,
    compliancePartial: 6, approvalsTotal: 5, approvalsComplete: 2,
    createdAt: "2026-03-16", updatedAt: "2026-04-28",
    sections: masterSections,
    readinessBreakdown: { sections: 80, placeholders: 65, required_documents: 40, compliance: 50, mock_gates: 30, outputs: 20 },
    mockWarnings: ["Internal only — not for external submission", "Mock Gate: Production would prevent external submission"],
    mockActions: ["Open Pack Builder", "Run Mock Split Check", "Generate Test Output", "Review Mock Gates"],
  },
  {
    id: "tp-linde-bulk", tenderWorkspaceId: LINDE_TENDER_ID, packName: "Bulk Transportation Pack",
    packType: "external_submission", isMaster: false, isExternalSubmittable: true,
    status: "drafting", readinessScore: 72, version: 1,
    ownerId: "u-raed", ownerName: "Ra'ed",
    sectionsTotal: 13, sectionsDrafted: 9, placeholdersTotal: 48, placeholdersPopulated: 42,
    documentsTotal: 6, documentsReady: 4, complianceTotal: 16, complianceCompliant: 11,
    compliancePartial: 5, approvalsTotal: 5, approvalsComplete: 3,
    createdAt: "2026-03-18", updatedAt: "2026-04-28",
    sections: bulkSections,
    readinessBreakdown: { sections: 75, placeholders: 70, required_documents: 60, compliance: 68, mock_gates: 45, outputs: 25 },
    mockWarnings: [],
    mockActions: ["Open Pack Builder", "Run Mock Split Check", "Generate Test Output", "Review Mock Gates"],
  },
  {
    id: "tp-linde-pgp", tenderWorkspaceId: LINDE_TENDER_ID, packName: "PGP Transportation Pack",
    packType: "external_submission", isMaster: false, isExternalSubmittable: true,
    status: "drafting", readinessScore: 65, version: 1,
    ownerId: "u-raed", ownerName: "Ra'ed",
    sectionsTotal: 13, sectionsDrafted: 7, placeholdersTotal: 51, placeholdersPopulated: 39,
    documentsTotal: 6, documentsReady: 3, complianceTotal: 16, complianceCompliant: 10,
    compliancePartial: 6, approvalsTotal: 5, approvalsComplete: 2,
    createdAt: "2026-03-18", updatedAt: "2026-04-28",
    sections: pgpSections,
    readinessBreakdown: { sections: 70, placeholders: 62, required_documents: 55, compliance: 60, mock_gates: 40, outputs: 20 },
    mockWarnings: [],
    mockActions: ["Open Pack Builder", "Run Mock Split Check", "Generate Test Output", "Review Mock Gates"],
  },
];

const lindeMockGates: TenderMockGate[] = [
  { id: "mg-001", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "PLACEHOLDER_COMPLETE", gateName: "All required placeholders populated", gateDescription: "Every submission-critical placeholder must have a value before production submission.", status: "would_block", severity: "critical", category: "placeholder", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "5 placeholders still missing values", allowTestBypass: true, linkedSignal: "Placeholder Register", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-002", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: "tp-linde-bulk", gateCode: "OBK_SIGNED", gateName: "OBK signed/stamped and native Excel ready", gateDescription: "Both native Excel and signed/stamped PDF versions of the OBK must be uploaded and approved.", status: "would_block", severity: "critical", category: "required_document", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "OBK signed/stamped PDF not yet available", allowTestBypass: true, linkedSignal: "Required Documents", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: "2026-04-28T14:00:00Z", notes: "Commercial artifact — blocks evaluation." },
  { id: "mg-003", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: "tp-linde-bulk", gateCode: "BID_STATEMENT_SIGNED", gateName: "Bid Statement signed/stamped", gateDescription: "The bid statement must be signed and stamped by an authorized signatory.", status: "would_block", severity: "high", category: "required_document", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "Signed/stamped PDF not uploaded", allowTestBypass: true, linkedSignal: "Required Documents", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-004", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: "tp-linde-bulk", gateCode: "TRANSITION_PLAN", gateName: "Transition Plan populated and reviewed", gateDescription: "The transition plan must be fully drafted and reviewed by operations before submission.", status: "warning", severity: "medium", category: "required_document", enforcementMode: "warn_future", runtimeMode: "warning_only", doctrineRequired: false, isMock: true, wouldBlock: true, wouldBlockReason: "Transition plan still in draft", allowTestBypass: true, linkedSignal: "Required Documents", ownerId: "u-raed", ownerName: "Ra'ed", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-005", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "CI_PROPOSAL_FORM", gateName: "Continuous Improvement Proposal Form populated", gateDescription: "The CI proposal form must be populated with relevant KPI improvement commitments.", status: "warning", severity: "medium", category: "required_document", enforcementMode: "warn_future", runtimeMode: "warning_only", doctrineRequired: false, isMock: true, wouldBlock: false, wouldBlockReason: "", allowTestBypass: true, linkedSignal: "Required Documents", ownerId: "u-raed", ownerName: "Ra'ed", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-006", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "COMPLIANCE_PACK", gateName: "Compliance Pack collated", gateDescription: "All compliance documents (ISO, ADR, insurance, CR, VAT) must be collated and current.", status: "warning", severity: "high", category: "compliance", enforcementMode: "warn_future", runtimeMode: "warning_only", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "Compliance pack not yet collated", allowTestBypass: true, linkedSignal: "Required Documents + Compliance Matrix", ownerId: "u-raed", ownerName: "Ra'ed", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-007", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "PROPOSAL_COVER_SIGNED", gateName: "Proposal cover signed/stamped", gateDescription: "The proposal cover letter must be signed and stamped by an authorized signatory.", status: "would_block", severity: "high", category: "required_document", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "Cover letter not yet signed", allowTestBypass: true, linkedSignal: "Required Documents", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-008", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "NO_CROSS_REFS", gateName: "No cross-references to wrong pack", gateDescription: "External packs must not reference internal master content or the other external pack.", status: "would_block", severity: "high", category: "internal_control", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "Cross-reference scan not yet run", allowTestBypass: true, linkedSignal: "Compliance Matrix", ownerId: "u-raed", ownerName: "Ra'ed", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-009", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "NO_INTERNAL_NOTES", gateName: "Internal notes removed from external packs", gateDescription: "Internal notes, draft comments, and working instructions must be removed from external submission packs.", status: "pass", severity: "high", category: "internal_control", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: false, wouldBlockReason: "", allowTestBypass: true, linkedSignal: "", ownerId: "u-raed", ownerName: "Ra'ed", evaluatedAt: "2026-04-28T14:00:00Z", notes: "Scan completed — no internal notes found." },
  { id: "mg-010", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "EMAIL_RECIPIENTS", gateName: "Email recipients verified", gateDescription: "Submission email recipients must be verified and confirmed before sending.", status: "not_started", severity: "medium", category: "submission_format", enforcementMode: "would_enforce_production", runtimeMode: "development_marker", doctrineRequired: false, isMock: true, wouldBlock: true, wouldBlockReason: "Recipients not yet verified", allowTestBypass: true, linkedSignal: "", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: null, notes: "" },
  { id: "mg-011", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "ATTACHMENT_SIZE", gateName: "Attachment size checked", gateDescription: "Email attachment size must be within limits specified by client.", status: "pass", severity: "low", category: "submission_format", enforcementMode: "mock_only", runtimeMode: "development_marker", doctrineRequired: false, isMock: true, wouldBlock: false, wouldBlockReason: "", allowTestBypass: true, linkedSignal: "", ownerId: null, ownerName: null, evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
  { id: "mg-012", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "FINAL_READ", gateName: "Final read-through completed", gateDescription: "A final human read-through must be completed and confirmed before submission.", status: "not_started", severity: "medium", category: "final_review", enforcementMode: "would_enforce_production", runtimeMode: "development_marker", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "Read-through not yet completed", allowTestBypass: true, linkedSignal: "", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: null, notes: "" },
  { id: "mg-013", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: "tp-linde-master", gateCode: "MASTER_NOT_EXTERNAL", gateName: "Internal master pack not externally submitted", gateDescription: "The internal master pack must never be included in external submission emails.", status: "pass", severity: "critical", category: "internal_control", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: false, wouldBlockReason: "", allowTestBypass: true, linkedSignal: "Pack Config", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: "2026-04-28T14:00:00Z", notes: "Master pack correctly flagged as internal-only." },
  { id: "mg-014", tenderWorkspaceId: LINDE_TENDER_ID, tenderPackId: null, gateCode: "SEPARATE_EMAILS", gateName: "Separate Bulk and PGP email threads required", gateDescription: "Bulk and PGP submission packs must be sent in separate email threads to the correct recipients.", status: "would_block", severity: "high", category: "submission_format", enforcementMode: "would_enforce_production", runtimeMode: "soft_simulation", doctrineRequired: true, isMock: true, wouldBlock: true, wouldBlockReason: "Split-pack email delivery not yet configured", allowTestBypass: true, linkedSignal: "Compliance Matrix", ownerId: "u-amin", ownerName: "Amin Al-Halabi", evaluatedAt: "2026-04-28T14:00:00Z", notes: "" },
];

const lindeActivityEvents: TenderActivityEvent[] = [
  { id: "act-001", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "workspace_created", title: "Tender Workspace Created", description: "Tender workspace created for Linde SIGAS Transportation Tender", category: "workspace", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-03-15T09:00:00Z", severity: "info", mock: true },
  { id: "act-002", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "pack_created", title: "Internal Master Pack Created", description: "Internal Master Pack created — source pack for split output", category: "pack", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-03-16T10:30:00Z", relatedPack: "Internal Master Pack", severity: "info", mock: true },
  { id: "act-003", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "pack_created", title: "Bulk Transportation Pack Created", description: "Bulk Transportation Pack created — external submission pack", category: "pack", userId: "u-raed", userName: "Ra'ed", role: "Operations", timestamp: "2026-03-18T08:15:00Z", relatedPack: "Bulk Transportation Pack", severity: "info", mock: true },
  { id: "act-004", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "pack_created", title: "PGP Transportation Pack Created", description: "PGP Transportation Pack created — external submission pack", category: "pack", userId: "u-raed", userName: "Ra'ed", role: "Operations", timestamp: "2026-03-18T08:20:00Z", relatedPack: "PGP Transportation Pack", severity: "info", mock: true },
  { id: "act-005", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "gate_evaluated", title: "Mock Gates Evaluated", description: "Mock gates evaluated — 10 gates would block in production", category: "gate", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T14:00:00Z", relatedModule: "Submission Gates", severity: "warning", mock: true },
];

const lindeAuditEntries: TenderAuditEntry[] = [
  { id: "aud-001", tenderWorkspaceId: LINDE_TENDER_ID, action: "TENDER_CREATED", eventCode: "TND-CRT", eventName: "Tender Workspace Created", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "TENDER", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-03-15T09:00:00Z", details: "Tender workspace created. Type: Multi-Pack Transport Tender. Customer: Linde SIGAS.", beforeState: "—", afterState: "Created", severity: "info", mock: true, traceId: "trc-001" },
  { id: "aud-002", tenderWorkspaceId: LINDE_TENDER_ID, action: "PACK_CREATED", eventCode: "PCK-CRT", eventName: "Internal Master Pack Created", entityType: "tender_pack", entityId: "tp-linde-master", entityName: "Internal Master Pack", category: "PACK", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-03-16T10:30:00Z", details: "Internal Master Pack created. is_external_submittable: false.", beforeState: "—", afterState: "Drafting", severity: "info", mock: true, traceId: "trc-002" },
  { id: "aud-003", tenderWorkspaceId: LINDE_TENDER_ID, action: "PACK_CREATED", eventCode: "PCK-CRT", eventName: "Bulk Transportation Pack Created", entityType: "tender_pack", entityId: "tp-linde-bulk", entityName: "Bulk Transportation Pack", category: "PACK", userId: "u-raed", userName: "Ra'ed", role: "Operations", timestamp: "2026-03-18T08:15:00Z", details: "Bulk Transportation Pack created. is_external_submittable: true.", beforeState: "—", afterState: "Drafting", severity: "info", mock: true, traceId: "trc-003" },
  { id: "aud-004", tenderWorkspaceId: LINDE_TENDER_ID, action: "PACK_CREATED", eventCode: "PCK-CRT", eventName: "PGP Transportation Pack Created", entityType: "tender_pack", entityId: "tp-linde-pgp", entityName: "PGP Transportation Pack", category: "PACK", userId: "u-raed", userName: "Ra'ed", role: "Operations", timestamp: "2026-03-18T08:20:00Z", details: "PGP Transportation Pack created. is_external_submittable: true.", beforeState: "—", afterState: "Drafting", severity: "info", mock: true, traceId: "trc-004" },
  { id: "aud-005", tenderWorkspaceId: LINDE_TENDER_ID, action: "MOCK_GATE_EVALUATED", eventCode: "GTE-EVL", eventName: "Submission Gates Evaluated", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "GATE", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T14:00:00Z", details: "Mock submission gates evaluated. 10 gates would block production submission. No enforcement active.", beforeState: "Not Evaluated", afterState: "10 Would Block", severity: "warning", mock: true, traceId: "trc-005" },
];

// ─── MOCK PLACEHOLDERS ─────────────────────────────────────

const lindePlaceholders: TenderPlaceholder[] = [
  { id: "ph-01", placeholderKey: "[INSERT SUBMISSION DATE]", label: "Submission Date", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-1", sectionTitle: "Letter of submission", category: "submission", owner: "Amin Al-Halabi", currentValue: "", status: "missing", source: "", evidenceStatus: "not_required", lastUpdated: "2026-04-28", approvedBy: null, wouldBlockInProduction: true, notes: "Must match portal submission date." },
  { id: "ph-02", placeholderKey: "[INSERT CR NUMBER]", label: "Commercial Registration Number", packId: "tp-linde-master", packName: "Internal Master Pack", sectionId: "ms-1", sectionTitle: "Master document control", category: "legal_registration", owner: "Amin Al-Halabi", currentValue: "2050123456", status: "approved", source: "CR Certificate", evidenceStatus: "attached_mock", lastUpdated: "2026-04-20", approvedBy: "Amin Al-Halabi", wouldBlockInProduction: true, notes: "" },
  { id: "ph-03", placeholderKey: "[INSERT VAT NUMBER]", label: "VAT Registration Number", packId: "tp-linde-master", packName: "Internal Master Pack", sectionId: "ms-1", sectionTitle: "Master document control", category: "legal_registration", owner: "Amin Al-Halabi", currentValue: "310234567890003", status: "approved", source: "ZATCA Certificate", evidenceStatus: "attached_mock", lastUpdated: "2026-04-20", approvedBy: "Amin Al-Halabi", wouldBlockInProduction: true, notes: "" },
  { id: "ph-04", placeholderKey: "[INSERT NITAQAT BAND]", label: "Nitaqat Band", packId: "tp-linde-master", packName: "Internal Master Pack", sectionId: "ms-1", sectionTitle: "Master document control", category: "company_data", owner: "Ra'ed", currentValue: "Platinum", status: "drafted", source: "HR records", evidenceStatus: "required", lastUpdated: "2026-04-25", approvedBy: null, wouldBlockInProduction: true, notes: "Needs evidence certificate from HRSD portal." },
  { id: "ph-05", placeholderKey: "[INSERT ISO 9001 CERTIFICATION NUMBER]", label: "ISO 9001 Cert Number", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-7", sectionTitle: "HSE management and compliance", category: "certification", owner: "Ra'ed", currentValue: "QMS-2024-00187", status: "in_review", source: "BSI Certificate", evidenceStatus: "attached_mock", lastUpdated: "2026-04-27", approvedBy: null, wouldBlockInProduction: true, notes: "Pending verification of expiry date." },
  { id: "ph-06", placeholderKey: "[INSERT ISO 14001 CERTIFICATION NUMBER]", label: "ISO 14001 Cert Number", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-7", sectionTitle: "HSE management and compliance", category: "certification", owner: "Ra'ed", currentValue: "", status: "needs_evidence", source: "", evidenceStatus: "missing", lastUpdated: "2026-04-15", approvedBy: null, wouldBlockInProduction: true, notes: "Certificate scan required." },
  { id: "ph-07", placeholderKey: "[INSERT ISO 45001 / OHSAS CERTIFICATION NUMBER]", label: "ISO 45001 Cert Number", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-7", sectionTitle: "HSE management and compliance", category: "certification", owner: "Ra'ed", currentValue: "", status: "missing", source: "", evidenceStatus: "missing", lastUpdated: "2026-04-10", approvedBy: null, wouldBlockInProduction: true, notes: "Awaiting certificate from HSE team." },
  { id: "ph-08", placeholderKey: "[INSERT TOTAL FLEET COUNT BY CATEGORY]", label: "Total Fleet Count", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-6", sectionTitle: "Fleet plan and vehicle specifications", category: "fleet_operations", owner: "Ra'ed", currentValue: "47 cryogenic tankers, 12 tube trailers", status: "drafted", source: "Fleet register", evidenceStatus: "required", lastUpdated: "2026-04-27", approvedBy: null, wouldBlockInProduction: false, notes: "" },
  { id: "ph-09", placeholderKey: "[INSERT NUMBER OF DRIVERS]", label: "Number of Drivers", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-6", sectionTitle: "Fleet plan and vehicle specifications", category: "fleet_operations", owner: "Ra'ed", currentValue: "124", status: "drafted", source: "HR records", evidenceStatus: "not_required", lastUpdated: "2026-04-27", approvedBy: null, wouldBlockInProduction: false, notes: "" },
  { id: "ph-10", placeholderKey: "[INSERT 12-MONTH OTIF %]", label: "12-Month OTIF %", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-10", sectionTitle: "Governance and performance management", category: "safety_performance", owner: "Ra'ed", currentValue: "96.2%", status: "in_review", source: "KPI dashboard", evidenceStatus: "attached_mock", lastUpdated: "2026-04-28", approvedBy: null, wouldBlockInProduction: true, notes: "" },
  { id: "ph-11", placeholderKey: "[INSERT 12-MONTH LTIFR FIGURE]", label: "12-Month LTIFR", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-7", sectionTitle: "HSE management and compliance", category: "safety_performance", owner: "Ra'ed", currentValue: "", status: "missing", source: "", evidenceStatus: "required", lastUpdated: "2026-04-10", approvedBy: null, wouldBlockInProduction: true, notes: "HSE team must provide audited figure." },
  { id: "ph-12", placeholderKey: "[INSERT 12-MONTH TRIR FIGURE]", label: "12-Month TRIR", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", sectionId: "ps-7", sectionTitle: "HSE management, GDP and compliance", category: "safety_performance", owner: "Ra'ed", currentValue: "", status: "missing", source: "", evidenceStatus: "required", lastUpdated: "2026-04-10", approvedBy: null, wouldBlockInProduction: true, notes: "Shared with Bulk — same figure required." },
  { id: "ph-13", placeholderKey: "[INSERT 12-MONTH TOTAL KM]", label: "12-Month Total KM", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", sectionId: "ps-6", sectionTitle: "Fleet plan and vehicle specifications", category: "fleet_operations", owner: "Ra'ed", currentValue: "8,450,000 km", status: "drafted", source: "Telematics export", evidenceStatus: "required", lastUpdated: "2026-04-26", approvedBy: null, wouldBlockInProduction: false, notes: "" },
  { id: "ph-14", placeholderKey: "[INSERT REFERENCE CONTRACT 1]", label: "Reference Contract 1", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-4", sectionTitle: "Company capability and track record", category: "company_data", owner: "Amin Al-Halabi", currentValue: "SABIC Jubail — 5yr logistics contract (2021–2026)", status: "approved", source: "Contract records", evidenceStatus: "attached_mock", lastUpdated: "2026-04-22", approvedBy: "Amin Al-Halabi", wouldBlockInProduction: true, notes: "" },
  { id: "ph-15", placeholderKey: "[INSERT REFERENCE CONTRACT 2]", label: "Reference Contract 2", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", sectionId: "ps-4", sectionTitle: "Company capability and track record", category: "company_data", owner: "Amin Al-Halabi", currentValue: "Aramco VAS — transport services (2020–2025)", status: "approved", source: "Contract records", evidenceStatus: "attached_mock", lastUpdated: "2026-04-22", approvedBy: "Amin Al-Halabi", wouldBlockInProduction: true, notes: "" },
  { id: "ph-16", placeholderKey: "[INSERT GOVERNANCE TEAM NAME]", label: "Governance Team Name", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", sectionId: "ps-10", sectionTitle: "Governance and performance management", category: "governance", owner: "Amin Al-Halabi", currentValue: "", status: "missing", source: "", evidenceStatus: "not_required", lastUpdated: "2026-04-15", approvedBy: null, wouldBlockInProduction: false, notes: "Pending org chart finalization." },
  { id: "ph-17", placeholderKey: "[INSERT OEM MODEL]", label: "OEM Tanker Model", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", sectionId: "bs-6", sectionTitle: "Fleet plan and vehicle specifications", category: "fleet_operations", owner: "Ra'ed", currentValue: "MAN TGS 26.440 6x4", status: "drafted", source: "Fleet records", evidenceStatus: "not_required", lastUpdated: "2026-04-27", approvedBy: null, wouldBlockInProduction: false, notes: "" },
  { id: "ph-18", placeholderKey: "[INSERT PERFORMANCE GUARANTEE CONFIRMATION]", label: "Performance Guarantee Confirmation", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", sectionId: "ps-11", sectionTitle: "Commercial approach", category: "commercial", owner: "Amin Al-Halabi", currentValue: "", status: "needs_evidence", source: "", evidenceStatus: "missing", lastUpdated: "2026-04-20", approvedBy: null, wouldBlockInProduction: true, notes: "Finance must confirm performance bond structure." },
];

// ─── MOCK REQUIRED DOCUMENTS ───────────────────────────────

const lindeRequiredDocuments: TenderRequiredDocument[] = [
  { id: "rd-01", documentName: "Internal Master Working DOCX", packId: "tp-linde-master", packName: "Internal Master Pack", category: "final_output", owner: "Amin Al-Halabi", status: "draft", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "not_required", version: 3, includedInOutput: false, wouldBlockInProduction: false, lastUpdated: "2026-04-28", notes: "Internal working document — not submitted externally." },
  { id: "rd-02", documentName: "Bulk Final Tender Pack PDF", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "final_output", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: true, signedPdfRequired: true, stampRequired: true, nativeStatus: "missing", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "Final compiled PDF for Bulk submission. Cannot be generated until all sections approved." },
  { id: "rd-03", documentName: "Bulk OBK Native Excel", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "pricing_obk", owner: "Amin Al-Halabi", status: "in_review", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "uploaded_mock", version: 2, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-27", notes: "Native Excel required for commercial evaluation. OBK Control artifact." },
  { id: "rd-04", documentName: "Bulk OBK Signed/Stamped PDF", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "pricing_obk", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: false, signedPdfRequired: true, stampRequired: true, nativeStatus: "not_required", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-25", notes: "Signed and stamped by authorized signatory. Native Excel + signed/stamped PDF required for production submission." },
  { id: "rd-05", documentName: "Bulk Bid Statement Signed/Stamped PDF", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "bid_statement", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: false, signedPdfRequired: true, stampRequired: true, nativeStatus: "not_required", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-20", notes: "Must be signed and stamped by authorized signatory." },
  { id: "rd-06", documentName: "Bulk Transition Plan", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "transition", owner: "Ra'ed", status: "draft", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "not_required", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-26", notes: "" },
  { id: "rd-07", documentName: "Bulk Continuous Improvement Proposal Form", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "continuous_improvement", owner: "Ra'ed", status: "draft", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "not_required", version: 1, includedInOutput: true, wouldBlockInProduction: false, lastUpdated: "2026-04-26", notes: "" },
  { id: "rd-08", documentName: "Bulk Compliance Pack", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "compliance_pack", owner: "Ra'ed", status: "awaiting", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "missing", signedPdfStatus: "not_required", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-15", notes: "Aggregated compliance evidence bundle." },
  { id: "rd-09", documentName: "PGP Final Tender Pack PDF", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "final_output", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: true, signedPdfRequired: true, stampRequired: true, nativeStatus: "missing", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "Final compiled PDF for PGP submission." },
  { id: "rd-10", documentName: "PGP OBK Native Excel", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "pricing_obk", owner: "Amin Al-Halabi", status: "draft", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "uploaded_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-26", notes: "OBK Control artifact — native Excel for PGP pricing." },
  { id: "rd-11", documentName: "PGP OBK Signed/Stamped PDF", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "pricing_obk", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: false, signedPdfRequired: true, stampRequired: true, nativeStatus: "not_required", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-20", notes: "Native Excel + signed/stamped PDF required for production submission." },
  { id: "rd-12", documentName: "PGP Bid Statement Signed/Stamped PDF", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "bid_statement", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: false, signedPdfRequired: true, stampRequired: true, nativeStatus: "not_required", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-18", notes: "Must be signed and stamped by authorized signatory." },
  { id: "rd-13", documentName: "PGP Transition Plan", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "transition", owner: "Ra'ed", status: "in_review", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "not_required", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-27", notes: "" },
  { id: "rd-14", documentName: "PGP Continuous Improvement Proposal Form", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "continuous_improvement", owner: "Ra'ed", status: "draft", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "uploaded_mock", signedPdfStatus: "not_required", evidenceStatus: "not_required", version: 1, includedInOutput: true, wouldBlockInProduction: false, lastUpdated: "2026-04-25", notes: "" },
  { id: "rd-15", documentName: "PGP Compliance Pack", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "compliance_pack", owner: "Ra'ed", status: "awaiting", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "missing", signedPdfStatus: "not_required", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-10", notes: "" },
  { id: "rd-16", documentName: "Commercial Registration Certificate", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "legal_registration", owner: "Amin Al-Halabi", status: "ready", nativeRequired: false, signedPdfRequired: true, stampRequired: false, nativeStatus: "not_required", signedPdfStatus: "ready_mock", evidenceStatus: "ready_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-20", notes: "Shared across Bulk + PGP packs." },
  { id: "rd-17", documentName: "VAT Certificate", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "legal_registration", owner: "Amin Al-Halabi", status: "ready", nativeRequired: false, signedPdfRequired: true, stampRequired: false, nativeStatus: "not_required", signedPdfStatus: "ready_mock", evidenceStatus: "ready_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-20", notes: "ZATCA certificate." },
  { id: "rd-18", documentName: "ISO 9001 / 14001 / 45001 Certificates", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "certification", owner: "Ra'ed", status: "in_review", nativeRequired: false, signedPdfRequired: true, stampRequired: false, nativeStatus: "not_required", signedPdfStatus: "uploaded_mock", evidenceStatus: "uploaded_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-27", notes: "Bundle of 3 ISO certificates. Expiry dates must be verified." },
  { id: "rd-19", documentName: "Insurance Certificates", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "insurance", owner: "Ra'ed", status: "approved", nativeRequired: false, signedPdfRequired: true, stampRequired: false, nativeStatus: "not_required", signedPdfStatus: "ready_mock", evidenceStatus: "ready_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-22", notes: "Motor + cargo + liability insurance bundle." },
  { id: "rd-20", documentName: "ADR Class 2 Certifications", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "hse", owner: "Ra'ed", status: "approved", nativeRequired: false, signedPdfRequired: true, stampRequired: false, nativeStatus: "not_required", signedPdfStatus: "ready_mock", evidenceStatus: "ready_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-22", notes: "ADR dangerous goods transport certification for cryogenic tankers." },
  { id: "rd-21", documentName: "Reference Credentials", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "fleet_operations", owner: "Amin Al-Halabi", status: "ready", nativeRequired: true, signedPdfRequired: false, stampRequired: false, nativeStatus: "ready_mock", signedPdfStatus: "not_required", evidenceStatus: "ready_mock", version: 1, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-22", notes: "SABIC + Aramco reference letters and contracts." },
  { id: "rd-22", documentName: "Performance Guarantee Confirmation", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "pricing_obk", owner: "Amin Al-Halabi", status: "awaiting", nativeRequired: true, signedPdfRequired: true, stampRequired: true, nativeStatus: "missing", signedPdfStatus: "missing", evidenceStatus: "missing", version: 0, includedInOutput: true, wouldBlockInProduction: true, lastUpdated: "2026-04-15", notes: "Finance must confirm performance bond structure before submission." },
];

// ─── MOCK COMPLIANCE ITEMS ─────────────────────────────────

const lindeComplianceItems: TenderComplianceItem[] = [
  { id: "ci-01", reference: "RFQ-3.1", requirement: "Scope: cryogenic gases and gaseous hydrogen distribution across KSA", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "scope", status: "compliant", evidence: "Attached Mock", owner: "Amin Al-Halabi", riskLevel: "low", legalReviewRequired: false, commercialImpact: "Core scope — full alignment required", operationalImpact: "Fleet must cover cryogenic + gaseous", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-25", notes: "" },
  { id: "ci-02", reference: "RFQ-3.2", requirement: "Two-hub model: Dammam primary, Jeddah secondary", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "scope", status: "compliant", evidence: "Attached Mock", owner: "Ra'ed", riskLevel: "low", legalReviewRequired: false, commercialImpact: "Hub costs included in pricing", operationalImpact: "Operations team confirmed hub availability", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-25", notes: "" },
  { id: "ci-03", reference: "RFQ-4.1", requirement: "18 x 4x2 tractors provided for cryogenic trailer operation", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "vehicle_specifications", status: "partial", evidence: "Pending", owner: "Ra'ed", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "Fleet CAPEX may require adjustment", operationalImpact: "14 available, 4 on order — delivery Q3 2026", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-27", notes: "4 tractors on order, expected delivery before contract start." },
  { id: "ci-04", reference: "RFQ-4.2", requirement: "4 x 6x4 rigid tankers provided for gaseous deliveries", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "vehicle_specifications", status: "partial", evidence: "Pending", owner: "Ra'ed", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "Rigid tanker spec requires OEM confirmation", operationalImpact: "2 available, 2 under procurement", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-27", notes: "" },
  { id: "ci-05", reference: "RFQ-5.1", requirement: "ADR Class 2 driver discipline and training compliance", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "adr_gdp", status: "compliant", evidence: "Attached Mock", owner: "Ra'ed", riskLevel: "low", legalReviewRequired: false, commercialImpact: "None", operationalImpact: "All assigned drivers ADR certified", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-22", notes: "" },
  { id: "ci-06", reference: "RFQ-6.1", requirement: "Linde-owned cryogenic trailer maintenance boundary acknowledged", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "legal_terms", status: "clarification_required", evidence: "Client Clarification Needed", owner: "Amin Al-Halabi", riskLevel: "high", legalReviewRequired: true, commercialImpact: "Maintenance cost boundary affects margin", operationalImpact: "Need to confirm which maintenance items fall on Hala vs Linde", clarificationNeeded: true, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "Formal clarification submitted to Linde procurement. Awaiting response." },
  { id: "ci-07", reference: "RFQ-7.1", requirement: "Schedule 5 KPI regime acknowledged and accepted", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "kpi_pl_consequences", status: "compliant", evidence: "Attached Mock", owner: "Amin Al-Halabi", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "KPI penalties capped at 5% monthly invoice", operationalImpact: "Operations must track OTIF, safety, fleet availability", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-25", notes: "" },
  { id: "ci-08", reference: "RFQ-7.2", requirement: "Schedule 6 PL consequences acknowledged", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "kpi_pl_consequences", status: "partial", evidence: "Pending", owner: "Amin Al-Halabi", riskLevel: "high", legalReviewRequired: true, commercialImpact: "Uncapped liability clause requires legal review", operationalImpact: "Insurance coverage must align", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "Legal team reviewing liability cap position." },
  { id: "ci-09", reference: "RFQ-8.1", requirement: "OBK pricing file completed and submitted", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "pricing_obk", status: "non_compliant", evidence: "Required", owner: "Amin Al-Halabi", riskLevel: "critical", legalReviewRequired: false, commercialImpact: "Cannot submit without completed OBK", operationalImpact: "None", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "OBK native Excel in review but signed/stamped version not yet available." },
  { id: "ci-10", reference: "RFQ-9.1", requirement: "180-day bid validity period acknowledged", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "bid_validity", status: "compliant", evidence: "Attached Mock", owner: "Amin Al-Halabi", riskLevel: "low", legalReviewRequired: false, commercialImpact: "Pricing locked for 180 days", operationalImpact: "None", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-20", notes: "" },
  { id: "ci-11", reference: "RFQ-10.1", requirement: "10% performance guarantee bond provided", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "performance_guarantee", status: "clarification_required", evidence: "Client Clarification Needed", owner: "Amin Al-Halabi", riskLevel: "high", legalReviewRequired: true, commercialImpact: "Bond cost impacts margin by ~0.3%", operationalImpact: "None", clarificationNeeded: true, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "Finance confirming bond structure with bank." },
  { id: "ci-12", reference: "RFQ-3.3", requirement: "Multi-city packaged-gas distribution scope acknowledged", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "scope", status: "compliant", evidence: "Attached Mock", owner: "Amin Al-Halabi", riskLevel: "low", legalReviewRequired: false, commercialImpact: "PGP pricing covers all listed cities", operationalImpact: "Route planning confirmed", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-25", notes: "" },
  { id: "ci-13", reference: "RFQ-4.3", requirement: "PGP vehicle / helper model reviewed and accepted", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "vehicle_specifications", status: "compliant", evidence: "Attached Mock", owner: "Ra'ed", riskLevel: "low", legalReviewRequired: false, commercialImpact: "Helper costs included", operationalImpact: "Vehicle + helper model confirmed", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-25", notes: "" },
  { id: "ci-14", reference: "RFQ-5.2", requirement: "PGP GDP / safety handling requirements reviewed", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "adr_gdp", status: "partial", evidence: "Pending", owner: "Ra'ed", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "GDP training costs not yet budgeted", operationalImpact: "GDP training program under development", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-27", notes: "GDP handling SOP being drafted." },
  { id: "ci-15", reference: "RFQ-11.1", requirement: "PGP transition approach documented", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "transition", status: "not_reviewed", evidence: "Not Required", owner: "Ra'ed", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "Transition mobilization costs", operationalImpact: "60-day transition window required", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-15", notes: "" },
  { id: "ci-16", reference: "RFQ-12.1", requirement: "PGP continuous improvement proposal required", packId: "tp-linde-pgp", packName: "PGP Transportation Pack", category: "continuous_improvement", status: "not_reviewed", evidence: "Not Required", owner: "Ra'ed", riskLevel: "low", legalReviewRequired: false, commercialImpact: "None", operationalImpact: "CI plan needed", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-15", notes: "" },
  { id: "ci-17", reference: "RFQ-13.1", requirement: "Insurance certificates covering motor, cargo, and liability", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "insurance", status: "compliant", evidence: "Attached Mock", owner: "Ra'ed", riskLevel: "low", legalReviewRequired: false, commercialImpact: "Premium included in overhead", operationalImpact: "None", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-22", notes: "" },
  { id: "ci-18", reference: "RFQ-13.2", requirement: "Commercial Registration valid and matching entity", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "management_standards", status: "compliant", evidence: "Attached Mock", owner: "Amin Al-Halabi", riskLevel: "low", legalReviewRequired: false, commercialImpact: "None", operationalImpact: "None", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-20", notes: "" },
  { id: "ci-19", reference: "RFQ-13.3", requirement: "ISO 9001 / 14001 / 45001 certificates current", packId: "tp-linde-bulk", packName: "Bulk Transportation Pack", category: "management_standards", status: "clarification_required", evidence: "Client Clarification Needed", owner: "Ra'ed", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "None", operationalImpact: "ISO 45001 certificate expiry needs confirmation", clarificationNeeded: true, wouldBlockInProduction: true, lastUpdated: "2026-04-27", notes: "ISO 45001 expiry date unclear — BSI confirmation requested." },
  { id: "ci-20", reference: "RFQ-14.1", requirement: "Separate submission emails for Bulk and PGP packs", packId: "tp-linde-master", packName: "Internal Master Pack", category: "submission_format", status: "non_compliant", evidence: "Required", owner: "Amin Al-Halabi", riskLevel: "critical", legalReviewRequired: false, commercialImpact: "Incorrect submission format = disqualification risk", operationalImpact: "None", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-28", notes: "Submission process not yet configured for split-pack email delivery." },
  { id: "ci-21", reference: "RFQ-14.2", requirement: "Internal master pack must NOT be submitted externally", packId: "tp-linde-master", packName: "Internal Master Pack", category: "submission_format", status: "accepted_risk_mock", evidence: "Not Required", owner: "Amin Al-Halabi", riskLevel: "low", legalReviewRequired: false, commercialImpact: "None", operationalImpact: "None", clarificationNeeded: false, wouldBlockInProduction: false, lastUpdated: "2026-04-20", notes: "Master pack flagged as internal-only in pack config." },
  { id: "ci-22", reference: "RFQ-14.3", requirement: "Cross-pack references must be removed before submission", packId: "tp-linde-master", packName: "Internal Master Pack", category: "submission_format", status: "not_reviewed", evidence: "Not Required", owner: "Ra'ed", riskLevel: "medium", legalReviewRequired: false, commercialImpact: "None", operationalImpact: "QA review required before final output", clarificationNeeded: false, wouldBlockInProduction: true, lastUpdated: "2026-04-15", notes: "" },
];

// ─── WORKSPACE STORE ───────────────────────────────────────

const lindeWorkspace: TenderWorkspace = {
  tender: lindeTender,
  tenderType: "Multi-Pack Transport Tender",
  readinessScore: 68,
  riskLevel: "amber",
  crmSyncStatus: "simulated",
  submissionModel: "multi_pack",
  packs: lindePacks,
  placeholders: lindePlaceholders,
  requiredDocuments: lindeRequiredDocuments,
  complianceItems: lindeComplianceItems,
  mockGates: lindeMockGates,
  activityEvents: [...lindeActivityEvents,
    { id: "act-006", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "placeholders_scanned", title: "Placeholders Scanned", description: "Placeholder register scanned — 5 missing, 2 need evidence", category: "placeholder", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T15:00:00Z", relatedModule: "Placeholders", severity: "warning", mock: true },
    { id: "act-007", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "required_documents_scanned", title: "Required Documents Scanned", description: "Required documents scanned — 8 awaiting, 3 in review, 14 would block production", category: "required_document", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T16:00:00Z", relatedModule: "Required Documents", severity: "warning", mock: true },
    { id: "act-008", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "compliance_matrix_scanned", title: "Compliance Matrix Scanned", description: "Compliance matrix scanned — 2 non-compliant, 4 partial, 3 clarification required, 2 critical risk", category: "compliance", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T17:00:00Z", relatedModule: "Compliance Matrix", severity: "high", mock: true },
    { id: "act-009", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "submission_gates_scanned", title: "Submission Gates Evaluated", description: "Submission gates evaluated — 3 pass, 3 warning, 6 would block, 2 not started. 8 would block production.", category: "gate", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T18:00:00Z", relatedModule: "Submission Gates", severity: "warning", mock: true },
    { id: "act-010", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "placeholder_flagged", title: "Missing Placeholder Flagged", description: "LTIFR placeholder flagged as missing — HSE team must provide audited figure", category: "placeholder", userId: "u-raed", userName: "Ra'ed", role: "Operations", timestamp: "2026-04-28T18:30:00Z", relatedPack: "Bulk Transportation Pack", severity: "critical", mock: true },
    { id: "act-011", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "document_flagged", title: "OBK Document Flagged", description: "Bulk OBK Signed/Stamped PDF flagged — signed copy not yet available", category: "required_document", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T19:00:00Z", relatedPack: "Bulk Transportation Pack", severity: "critical", mock: true },
    { id: "act-012", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "compliance_gap_flagged", title: "Compliance Gap Flagged", description: "OBK pricing file non-compliant — cannot submit without completed OBK", category: "compliance", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T19:30:00Z", relatedPack: "Bulk Transportation Pack", severity: "critical", mock: true },
    { id: "act-013", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "mock_gate_bypass", title: "Mock Gate Bypass Used", description: "Mock bypass used for 'All required placeholders populated' gate — testing continues", category: "gate", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T09:00:00Z", relatedModule: "Submission Gates", severity: "warning", mock: true },
    { id: "act-014", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "split_check_run", title: "Split Check Run", description: "Split check run for Internal Master → Bulk. 5 checks would block production output.", category: "split_pack", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T10:00:00Z", relatedPack: "Bulk Transportation Pack", severity: "warning", mock: true },
    { id: "act-015", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "test_output_generated", title: "Test Output Generated", description: "Bulk test output generated — TEST OUTPUT — NOT FOR CLIENT SUBMISSION", category: "split_pack", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T10:30:00Z", relatedPack: "Bulk Transportation Pack", severity: "info", mock: true },
    { id: "act-016", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "submission_email_prepared", title: "Submission Email Prepared", description: "Bulk submission email prepared — 2 required attachments missing", category: "submission_email", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T11:00:00Z", relatedPack: "Bulk Transportation Pack", severity: "warning", mock: true },
    { id: "act-017", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "submission_simulated", title: "Submission Simulated", description: "Bulk submission simulated — no external email sent", category: "submission_email", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T11:30:00Z", relatedPack: "Bulk Transportation Pack", severity: "info", mock: true },
    { id: "act-018", tenderWorkspaceId: LINDE_TENDER_ID, eventType: "crm_sync_simulated", title: "CRM Sync Simulated", description: "CRM sync simulation complete — no external CRM was updated", category: "crm_sync_mock", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T12:00:00Z", severity: "info", mock: true },
  ],
  auditEntries: [...lindeAuditEntries,
    { id: "aud-006", tenderWorkspaceId: LINDE_TENDER_ID, action: "PLACEHOLDERS_SCANNED", eventCode: "PLH-SCN", eventName: "Placeholder Register Scanned", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "PLACEHOLDER", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T15:00:00Z", details: "Placeholder register scanned. 18 total, 5 missing, 2 needs evidence. 12 would block production.", beforeState: "Not Scanned", afterState: "5 Missing", severity: "warning", mock: true, traceId: "trc-006" },
    { id: "aud-007", tenderWorkspaceId: LINDE_TENDER_ID, action: "REQUIRED_DOCUMENTS_SCANNED", eventCode: "DOC-SCN", eventName: "Required Documents Scanned", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "DOCUMENT", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T16:00:00Z", details: "Required documents register scanned. 22 total, 8 awaiting, 3 in review. 14 would block production.", beforeState: "Not Scanned", afterState: "8 Awaiting", severity: "warning", mock: true, traceId: "trc-007" },
    { id: "aud-008", tenderWorkspaceId: LINDE_TENDER_ID, action: "COMPLIANCE_MATRIX_SCANNED", eventCode: "CMP-SCN", eventName: "Compliance Matrix Scanned", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "COMPLIANCE", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T17:00:00Z", details: "Compliance matrix scanned. 22 items, 8 compliant, 4 partial, 2 non-compliant, 3 clarification required. 12 would block production.", beforeState: "Not Scanned", afterState: "2 Non-Compliant", severity: "high", mock: true, traceId: "trc-008" },
    { id: "aud-009", tenderWorkspaceId: LINDE_TENDER_ID, action: "SUBMISSION_GATES_SCANNED", eventCode: "GTE-SCN", eventName: "Submission Gates Re-Evaluated", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "GATE", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-28T18:00:00Z", details: "Submission gates evaluated. 14 total, 3 pass, 3 warning, 6 would block, 2 not started. 8 would block production.", beforeState: "10 Would Block", afterState: "6 Would Block", severity: "warning", mock: true, traceId: "trc-009" },
    { id: "aud-010", tenderWorkspaceId: LINDE_TENDER_ID, action: "MOCK_GATE_BYPASS_USED", eventCode: "GTE-BYP", eventName: "Mock Gate Bypass Used", entityType: "mock_gate", entityId: "mg-001", entityName: "All required placeholders populated", category: "GATE", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T09:00:00Z", details: "Mock bypass activated for placeholder gate. Testing continues without enforcement.", beforeState: "Would Block", afterState: "Mock Bypassed", severity: "warning", mock: true, traceId: "trc-010" },
    { id: "aud-011", tenderWorkspaceId: LINDE_TENDER_ID, action: "SPLIT_CHECK_RUN", eventCode: "SPL-CHK", eventName: "Split Check Executed", entityType: "split_output", entityId: "tp-linde-bulk", entityName: "Bulk Transportation Pack", category: "SPLIT_OUTPUT", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T10:00:00Z", details: "Split check run for Internal Master → Bulk. 4 pass, 2 warning, 5 would block, 1 not checked.", beforeState: "Not Checked", afterState: "5 Would Block", severity: "warning", mock: true, traceId: "trc-011" },
    { id: "aud-012", tenderWorkspaceId: LINDE_TENDER_ID, action: "TEST_OUTPUT_GENERATED", eventCode: "OUT-GEN", eventName: "Test Output Generated", entityType: "pack_output", entityId: "tp-linde-bulk", entityName: "Bulk Tender Pack — TEST OUTPUT", category: "SPLIT_OUTPUT", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T10:30:00Z", details: "Mock test output generated. Watermark: TEST OUTPUT — NOT FOR CLIENT SUBMISSION.", beforeState: "—", afterState: "Generated With Warnings", severity: "info", mock: true, traceId: "trc-012" },
    { id: "aud-013", tenderWorkspaceId: LINDE_TENDER_ID, action: "SUBMISSION_EMAIL_PREPARED", eventCode: "SUB-PRE", eventName: "Submission Email Prepared", entityType: "submission_email", entityId: "tp-linde-bulk", entityName: "Bulk Submission Email", category: "SUBMISSION", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T11:00:00Z", details: "Bulk submission email prepared. 2 required attachments missing.", beforeState: "—", afterState: "Draft (Mock)", severity: "warning", mock: true, traceId: "trc-013" },
    { id: "aud-014", tenderWorkspaceId: LINDE_TENDER_ID, action: "SUBMISSION_SIMULATED", eventCode: "SUB-SIM", eventName: "Submission Simulated", entityType: "submission_email", entityId: "tp-linde-bulk", entityName: "Bulk Submission Email", category: "SUBMISSION", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T11:30:00Z", details: "Bulk submission simulated. No external email sent.", beforeState: "Draft (Mock)", afterState: "Simulated With Warnings", severity: "info", mock: true, traceId: "trc-014" },
    { id: "aud-015", tenderWorkspaceId: LINDE_TENDER_ID, action: "CRM_SYNC_SIMULATED", eventCode: "CRM-SIM", eventName: "CRM Sync Simulated", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "CRM_SYNC", userId: "u-amin", userName: "Amin Al-Halabi", role: "Tender Lead", timestamp: "2026-04-29T12:00:00Z", details: "CRM sync simulation complete. No external CRM was updated.", beforeState: "Not Synced", afterState: "Simulated", severity: "info", mock: true, traceId: "trc-015" },
    { id: "aud-016", tenderWorkspaceId: LINDE_TENDER_ID, action: "PRODUCTION_BLOCK_SIMULATED", eventCode: "PRD-BLK", eventName: "Production Block Simulated", entityType: "tender_workspace", entityId: LINDE_TENDER_ID, entityName: "Linde SIGAS Transportation Tender", category: "SYSTEM", userId: "u-system", userName: "System", role: "System", timestamp: "2026-04-29T12:30:00Z", details: "Production block simulation: 10 gates, 12 placeholders, 14 documents would block production. No enforcement active.", beforeState: "—", afterState: "Simulated", severity: "high", mock: true, traceId: "trc-016" },
  ],
};

const tenderWorkspaces: TenderWorkspace[] = [lindeWorkspace];

// ─── RISK SUMMARY HELPERS ──────────────────────────────────

export interface TenderRiskSummary {
  tenderId: string;
  tenderTitle: string;
  customerName: string;
  readinessScore: number;
  riskLevel: "green" | "amber" | "red";
  packCount: number;
  packLabel: string;
  missingPlaceholders: number;
  missingDocuments: number;
  complianceGaps: number;
  gatesWouldBlock: number;
  criticalGates: number;
  nextAction: string;
  deadline: string;
  daysToDeadline: number;
  developmentMode: true;
}

export interface TenderExecutionSignal {
  tenderId: string;
  tenderTitle: string;
  customerName: string;
  deadline: string;
  daysToDeadline: number;
  riskColor: "red" | "amber" | "green";
  riskReason: string;
  nextAction: string;
  signalType: "gate" | "placeholder" | "document" | "compliance" | "deadline" | "readiness";
  developmentMode: true;
}

export function getTenderRiskSummary(tenderId: string): TenderRiskSummary | null {
  const ws = tenderWorkspaces.find(w => w.tender.id === tenderId);
  if (!ws) return null;

  const t = ws.tender;
  const missingPh = ws.placeholders.filter(p => p.status === "missing" || p.status === "needs_evidence").length;
  const missingDocs = ws.requiredDocuments.filter(d => d.status === "awaiting" || d.nativeStatus === "missing" || d.signedPdfStatus === "missing").length;
  const compGaps = ws.complianceItems.filter(c => c.status === "non_compliant" || c.status === "partial" || c.status === "clarification_required").length;
  const gatesBlock = ws.mockGates.filter(g => g.wouldBlock).length;
  const critGates = ws.mockGates.filter(g => g.severity === "critical").length;
  const daysLeft = Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  let risk: "green" | "amber" | "red" = "green";
  if (gatesBlock > 5 || missingDocs > 5 || critGates > 0 || compGaps > 5) risk = "red";
  else if (gatesBlock > 0 || missingDocs > 0 || missingPh > 0 || compGaps > 0) risk = "amber";

  let nextAction = "Review tender workspace";
  if (critGates > 0) nextAction = "Review critical submission gates";
  else if (missingDocs > 5) nextAction = "Complete missing required documents";
  else if (compGaps > 3) nextAction = "Resolve compliance gaps";
  else if (missingPh > 3) nextAction = "Populate missing placeholders";
  else if (gatesBlock > 0) nextAction = "Review submission gates";

  const packLabel = ws.packs.length > 1
    ? ws.packs.map(p => p.packType === "internal_master" ? "Master" : p.packName.split(" ")[0]).join(" + ")
    : ws.packs.length === 1 ? ws.packs[0].packName : "No packs";

  return {
    tenderId: t.id,
    tenderTitle: t.title,
    customerName: t.customerName,
    readinessScore: ws.readinessScore,
    riskLevel: risk,
    packCount: ws.packs.length,
    packLabel,
    missingPlaceholders: missingPh,
    missingDocuments: missingDocs,
    complianceGaps: compGaps,
    gatesWouldBlock: gatesBlock,
    criticalGates: critGates,
    nextAction,
    deadline: t.submissionDeadline,
    daysToDeadline: daysLeft,
    developmentMode: true,
  };
}

export function getTenderExecutionSignals(tenderId: string): TenderExecutionSignal[] {
  const summary = getTenderRiskSummary(tenderId);
  if (!summary) return [];

  const signals: TenderExecutionSignal[] = [];
  const base = { tenderId: summary.tenderId, tenderTitle: summary.tenderTitle, customerName: summary.customerName, deadline: summary.deadline, daysToDeadline: summary.daysToDeadline, developmentMode: true as const };

  if (summary.gatesWouldBlock > 0) signals.push({ ...base, riskColor: summary.gatesWouldBlock > 5 ? "red" : "amber", riskReason: `${summary.gatesWouldBlock} mock gates would block production`, nextAction: "Review Submission Gates", signalType: "gate" });
  if (summary.missingDocuments > 0) signals.push({ ...base, riskColor: summary.missingDocuments > 5 ? "red" : "amber", riskReason: `${summary.missingDocuments} required documents incomplete`, nextAction: "Complete Required Documents", signalType: "document" });
  if (summary.complianceGaps > 0) signals.push({ ...base, riskColor: summary.complianceGaps > 3 ? "red" : "amber", riskReason: `${summary.complianceGaps} compliance gaps (partial/non-compliant/clarification)`, nextAction: "Resolve Compliance Matrix", signalType: "compliance" });
  if (summary.missingPlaceholders > 0) signals.push({ ...base, riskColor: summary.missingPlaceholders > 3 ? "red" : "amber", riskReason: `${summary.missingPlaceholders} placeholders missing or need evidence`, nextAction: "Populate Placeholders", signalType: "placeholder" });
  if (summary.daysToDeadline <= 14 && summary.daysToDeadline > 0) signals.push({ ...base, riskColor: summary.daysToDeadline <= 7 ? "red" : "amber", riskReason: `${summary.daysToDeadline} days to submission deadline`, nextAction: "Prioritize Submission Prep", signalType: "deadline" });
  if (summary.readinessScore < 50) signals.push({ ...base, riskColor: "amber", riskReason: `Readiness ${summary.readinessScore}% — below threshold`, nextAction: "Increase Workspace Readiness", signalType: "readiness" });

  return signals;
}

export function getAllTenderExecutionSignals(): TenderExecutionSignal[] {
  return tenderWorkspaces.flatMap(ws => getTenderExecutionSignals(ws.tender.id));
}

/**
 * Get a TenderWorkspace by tender ID.
 * First checks the dedicated workspace store, then falls back
 * to wrapping an existing tender-engine Tender with defaults.
 */
export function getTenderWorkspaceById(tenderId: string): TenderWorkspace | null {
  // Check dedicated workspaces first
  const ws = tenderWorkspaces.find(w => w.tender.id === tenderId);
  if (ws) return ws;

  // Fallback: wrap any existing tender in a basic workspace shell
  const tender = getTenderById(tenderId);
  if (!tender) return null;

  return {
    tender,
    tenderType: "Standard Tender",
    readinessScore: 0,
    riskLevel: "amber",
    crmSyncStatus: "not_synced",
    submissionModel: "single_pack",
    packs: [],
    placeholders: [],
    requiredDocuments: [],
    complianceItems: [],
    mockGates: [],
    activityEvents: [
      {
        id: `act-fallback-${tender.id}`,
        tenderWorkspaceId: tender.id,
        eventType: "workspace_created",
        description: `Tender workspace opened for ${tender.title}`,
        userId: "u-system",
        userName: "System",
        timestamp: tender.createdAt + "T00:00:00Z",
      },
    ],
    auditEntries: [
      {
        id: `aud-fallback-${tender.id}`,
        tenderWorkspaceId: tender.id,
        action: "TENDER_CREATED",
        entityType: "tender_workspace",
        entityId: tender.id,
        userId: "u-system",
        userName: "System",
        timestamp: tender.createdAt + "T00:00:00Z",
        details: `Tender workspace created. Customer: ${tender.customerName}.`,
      },
    ],
  };
}

/**
 * Get the Linde SIGAS tender ID for use in navigation/testing.
 */
export function getLindeTenderId(): string {
  return LINDE_TENDER_ID;
}

export function getPackStatusLabel(status: TenderPackStatus): string {
  const labels: Record<TenderPackStatus, string> = {
    not_started: "Not Started",
    drafting: "Drafting",
    in_review: "In Review",
    blocked_mock: "Blocked (Mock)",
    ready_for_approval: "Ready for Approval",
    approved_for_submission: "Approved for Submission",
    submitted_mock: "Submitted (Mock)",
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

export function getGateStatusLabel(status: MockGateStatus): string {
  const labels: Record<MockGateStatus, string> = {
    not_started: "Not Started",
    pass: "Pass",
    warning: "Warning",
    fail: "Fail",
    would_block: "Would Block in Production",
    mock_bypassed: "Mock Bypassed",
    not_applicable: "N/A",
  };
  return labels[status] ?? status;
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
    not_reviewed: "Not Reviewed", mock_reviewed: "Mock Reviewed",
    future_approval_required: "Future Approval Required",
  };
  return labels[state] ?? state;
}
