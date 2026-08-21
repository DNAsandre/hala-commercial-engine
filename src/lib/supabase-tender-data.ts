/**
 * supabase-tender-data.ts
 * ──────────────────────
 * SUPA-006: Tender MVP Supabase Read Layer
 *
 * Fetches all Tender Workspace data from Supabase and maps it to the
 * frontend TypeScript types defined in tender-workspace-data.ts and
 * tender-engine.ts.
 *
 * No mock data. No silent fallback. All reads are Supabase-backed.
 * Writes remain deferred (SUPA-007+).
 */

import { supabase } from './supabase';
import type { Tender } from './tender-engine';
import type {
  TenderPack,
  TenderPackSection,
  TenderPlaceholder,
  TenderRequiredDocument,
  TenderDocument,
  TenderDocumentCategory,
  TenderDocumentStatus,
  TenderStageRelevance,
  TenderComplianceItem,
  TenderActivityEvent,
  TenderAuditEntry,
  TenderSplitCheck,
  TenderPackOutput,
  TenderSubmissionEmail,
  TenderWorkspace,
  TenderRiskLevel,
  TenderPackStatus,
  TenderPackType,
  PlaceholderStatus,
  PlaceholderCategory,
  EvidenceStatus,
  RequiredDocStatus,
  FileRequirementStatus,
  RequiredDocCategory,
  ComplianceStatus,
  ComplianceRisk,
  ComplianceCategory,
  ActivityCategory,
  EventSeverity,
  AuditCategory,
  PackSectionStatus,
  PackSectionApproval,
} from './tender-workspace-data';
import {
  TENDER_DOCUMENT_CATEGORIES,
  TENDER_DOCUMENT_STATUSES,
  TENDER_STAGE_RELEVANCE,
} from './tender-workspace-data';
import { normalizeTenderPricingData } from './tender-pricing-types';
import { normalizeTenderTypeDetails } from './tender-type-details';
import { normalizeTenderInternalStage } from './tender-stage-source-truth';
import { isAllowedTenderTicket, mayTenderIdBeAllowed } from './process-isolation';
import {
  normalizeSubmissionReadinessFacet,
  SUBMISSION_READINESS_FACET_KEY,
  type SubmissionReadinessComplianceItem,
  type SubmissionReadinessFacet,
  type SubmissionReadinessPlaceholder,
  type SubmissionReadinessRequiredDocument,
} from './tender-source-record';

// ─── Bundle type ────────────────────────────────────────────

/**
 * W04-T08-A: an honest, four-way load outcome.
 *
 * Before this existed, every non-success path collapsed into `tender: null`,
 * which the workspace rendered as "No Supabase data found for tender ID: …".
 * A PostgREST/RLS failure, a record excluded by process isolation, and a
 * genuinely absent row are three different facts and must look different.
 */
export type TenderBundleLoadState =
  | { kind: 'loaded' }
  | { kind: 'not_found'; message: string }
  | { kind: 'isolated'; message: string }
  | { kind: 'error'; message: string };

/**
 * TCW-T1 (P1): the canonical Submission Readiness register, read from the SAME
 * confirmed tender row the rest of the bundle derives from
 * (`type_details.submission_readiness`). `loaded` is true ONLY when that row
 * read succeeded — never on an error path. This raw register (exact row shapes
 * and statuses, incl. 'na') is the contract T5's register tabs and T2's
 * progress derivations should consume; the legacy UI-typed arrays on the bundle
 * are a documented lossy projection kept so existing renderers compile.
 */
export interface TenderSubmissionReadinessRead {
  loaded: boolean;
  /** Present when loaded === false: why the register was not read. */
  error?: string;
  facet: SubmissionReadinessFacet;
}

export interface TenderWorkspaceBundle {
  /** The tender id this bundle was requested for. Identity anchor for the caller. */
  requestedTenderId: string;
  /** Why this bundle looks the way it does. Never infer emptiness from `tender === null`. */
  loadState: TenderBundleLoadState;
  tender: Tender | null;
  packs: TenderPack[];
  /** P1: the raw canonical register. Prefer this over the three legacy arrays below. */
  submissionReadiness: TenderSubmissionReadinessRead;
  placeholders: TenderPlaceholder[];
  requiredDocuments: TenderRequiredDocument[];
  documents: TenderDocument[];
  complianceItems: TenderComplianceItem[];
  activityEvents: TenderActivityEvent[];
  auditEntries: TenderAuditEntry[];
  splitChecks: TenderSplitCheck[];
  packOutputs: TenderPackOutput[];
  submissionEmails: TenderSubmissionEmail[];
  /** Derived workspace-level fields from pack row (first pack meta) */
  tenderType: string;
  readinessScore: number;
  /**
   * W04-C4: `not_assessed` when the collections a risk verdict derives from
   * (compliance items, required documents) were not actually read. See
   * `riskInputsAssessed`.
   */
  riskLevel: TenderRiskLevel;
  /**
   * W04-C4: true only when BOTH risk inputs were genuinely loaded. False means
   * `riskLevel` is `not_assessed` and no verdict may be rendered.
   */
  riskInputsAssessed: boolean;
  /**
   * W04-C4: true only when a required-document set was actually read for this
   * tender. False means "no requirement list is recorded" — not "0 of N done".
   */
  requiredDocumentsAssessed: boolean;
  crmSyncStatus: 'not_synced' | 'synced' | 'sync_failed' | 'conflict' | 'simulated';
  submissionModel: 'single_pack' | 'multi_pack';
  /**
   * The raw `commercial_tickets.crm_pipeline_stage` value, verbatim.
   * `normalizeCrmStage` coerces null/unknown to 'prospecting' so the strip has a
   * value to highlight; that coercion must never be presented as stored truth.
   */
  crmPipelineStageRaw: string | null;
}

function emptyTenderWorkspaceBundle(
  requestedTenderId: string,
  loadState: TenderBundleLoadState,
): TenderWorkspaceBundle {
  return {
    requestedTenderId,
    loadState,
    tender: null,
    packs: [],
    // The register was NOT read on any non-loaded path — say so, never claim
    // "loaded and empty" for a row that failed to load.
    submissionReadiness: {
      loaded: false,
      error: loadState.kind === 'loaded'
        ? 'Tender row not loaded.'
        : loadState.message,
      facet: normalizeSubmissionReadinessFacet(null),
    },
    placeholders: [],
    requiredDocuments: [],
    documents: [],
    complianceItems: [],
    activityEvents: [],
    auditEntries: [],
    splitChecks: [],
    packOutputs: [],
    submissionEmails: [],
    tenderType: '',
    readinessScore: 0,
    // W04-C4: nothing was read, so nothing was assessed. 'green' here rendered
    // as an "On Track" badge on a bundle that never loaded.
    riskLevel: 'not_assessed',
    riskInputsAssessed: false,
    requiredDocumentsAssessed: false,
    crmSyncStatus: 'not_synced',
    submissionModel: 'single_pack',
    crmPipelineStageRaw: null,
  };
}

// ─── Row mappers ─────────────────────────────────────────────

function mapSection(row: any): TenderPackSection {
  return {
    id: row.id,
    packId: row.pack_id,
    title: row.title,
    owner: row.owner ?? '',
    status: (row.status ?? 'not_started') as PackSectionStatus,
    missingPlaceholders: row.missing_placeholders ?? 0,
    lastUpdated: row.last_updated ?? '',
    approvalState: (row.approval_state ?? 'not_reviewed') as PackSectionApproval,
  };
}

function mapPack(row: any, sections: TenderPackSection[]): TenderPack {
  const packSections = sections.filter(s => s.packId === row.id);
  const rb = row.readiness_breakdown ?? row.total_readiness_percent
    ? { sections: 0, placeholders: 0, required_documents: 0, compliance: 0, readiness_signals: 0, outputs: 0 }
    : { sections: 0, placeholders: 0, required_documents: 0, compliance: 0, readiness_signals: 0, outputs: 0 };
  let readinessBreakdown = rb;
  try {
    if (row.readiness_breakdown && typeof row.readiness_breakdown === 'object') {
      readinessBreakdown = row.readiness_breakdown;
    }
  } catch { /* use default */ }

  return {
    id: row.id,
    tenderWorkspaceId: row.tender_workspace_id,
    packName: row.pack_name || row.label || '',
    packType: (row.pack_type ?? 'external_submission') as TenderPackType,
    isMaster: row.is_master ?? false,
    isExternalSubmittable: row.is_external_submittable ?? true,
    status: (row.status ?? 'drafting') as TenderPackStatus,
    readinessScore: row.readiness_score ?? row.total_readiness_percent ?? 0,
    version: row.version ?? 1,
    ownerId: row.owner_id ?? row.owner ?? '',
    ownerName: row.owner_name ?? row.owner ?? '',
    sectionsTotal: row.sections_total ?? packSections.length,
    sectionsDrafted: row.sections_drafted ?? packSections.filter(s => s.status !== 'not_started').length,
    placeholdersTotal: row.placeholders_total ?? 0,
    placeholdersPopulated: row.placeholders_populated ?? 0,
    documentsTotal: row.documents_total ?? 0,
    documentsReady: row.documents_ready ?? 0,
    complianceTotal: row.compliance_total ?? 0,
    complianceCompliant: row.compliance_compliant ?? 0,
    compliancePartial: row.compliance_partial ?? 0,
    approvalsTotal: row.approvals_total ?? 0,
    approvalsComplete: row.approvals_complete ?? 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : '',
    sections: packSections,
    readinessBreakdown,
    readinessWarnings: Array.isArray(row.mock_warnings) ? row.mock_warnings : [],
    advisoryActions: Array.isArray(row.mock_actions) ? row.mock_actions : [],
  };
}

function mapPlaceholder(row: any): TenderPlaceholder {
  return {
    id: row.id,
    placeholderKey: row.placeholder_key ?? '',
    label: row.label ?? '',
    packId: row.pack_id,
    packName: row.pack_name ?? '',
    sectionId: row.section_id ?? '',
    sectionTitle: row.section_title ?? '',
    category: (row.category ?? 'company_data') as PlaceholderCategory,
    owner: row.owner ?? '',
    currentValue: row.value ?? '',
    status: (row.status ?? (row.populated ? 'approved' : 'missing')) as PlaceholderStatus,
    source: row.source ?? '',
    evidenceStatus: (row.evidence_status ?? 'not_required') as EvidenceStatus,
    lastUpdated: row.last_updated ?? '',
    approvedBy: row.approved_by ?? null,
    wouldBlockInProduction: row.would_block_in_production ?? false,
    notes: row.notes ?? '',
  };
}

function mapRequiredDocument(row: any): TenderRequiredDocument {
  return {
    id: row.id,
    documentName: row.document_name ?? '',
    packId: row.pack_id,
    packName: row.pack_name ?? '',
    category: (row.category ?? 'final_output') as RequiredDocCategory,
    owner: row.owner ?? '',
    status: (row.status ?? 'awaiting') as RequiredDocStatus,
    nativeRequired: row.native_required ?? false,
    signedPdfRequired: row.signed_required ?? row.signed_pdf_required ?? false,
    stampRequired: row.stamp_required ?? false,
    nativeStatus: (row.native_status ?? 'missing') as FileRequirementStatus,
    signedPdfStatus: (row.signed_pdf_status ?? 'not_required') as FileRequirementStatus,
    evidenceStatus: (row.evidence_status ?? 'not_required') as FileRequirementStatus,
    version: row.version ?? 0,
    includedInOutput: row.included_in_output ?? false,
    wouldBlockInProduction: row.would_block_in_production ?? false,
    lastUpdated: row.last_updated ?? '',
    notes: row.notes ?? '',
  };
}

function mapComplianceItem(row: any): TenderComplianceItem {
  return {
    id: row.id,
    reference: row.reference ?? '',
    requirement: row.requirement ?? '',
    packId: row.pack_id,
    packName: row.pack_name ?? '',
    category: (row.category ?? 'scope') as ComplianceCategory,
    status: (row.status ?? 'not_reviewed') as ComplianceStatus,
    evidence: row.evidence ?? row.response ?? '',
    owner: row.owner ?? '',
    riskLevel: (row.risk_level ?? 'low') as ComplianceRisk,
    legalReviewRequired: row.legal_review_required ?? false,
    commercialImpact: row.commercial_impact ?? '',
    operationalImpact: row.operational_impact ?? '',
    clarificationNeeded: row.clarification_needed ?? false,
    wouldBlockInProduction: row.would_block_in_production ?? false,
    lastUpdated: row.last_updated ?? '',
    notes: row.notes ?? '',
  };
}


function mapActivityEvent(row: any): TenderActivityEvent {
  return {
    id: row.id,
    tenderWorkspaceId: row.workspace_id,
    eventType: row.event_type ?? row.action ?? '',
    title: row.title ?? '',
    description: row.description ?? row.detail ?? '',
    category: (row.category ?? undefined) as ActivityCategory | undefined,
    userId: row.user_id ?? row.actor ?? '',
    userName: row.user_name ?? row.actor ?? '',
    role: row.role ?? undefined,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date(row.timestamp).toISOString(),
    relatedPack: row.related_pack ?? undefined,
    relatedModule: row.related_module ?? undefined,
    severity: (row.severity ?? 'info') as EventSeverity,
    mock: row.mock ?? false,
    notes: undefined,
  };
}

function mapAuditEntry(row: any): TenderAuditEntry {
  return {
    id: row.id,
    tenderWorkspaceId: row.workspace_id,
    action: row.action ?? '',
    eventCode: row.event_code ?? undefined,
    eventName: row.event_name ?? undefined,
    entityType: row.entity_type ?? '',
    entityId: row.entity_id ?? '',
    entityName: row.entity_name ?? undefined,
    category: (row.category ?? undefined) as AuditCategory | undefined,
    userId: row.user_id ?? row.actor ?? '',
    userName: row.user_name ?? row.actor ?? '',
    role: row.role ?? undefined,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date(row.timestamp).toISOString(),
    details: row.detail ?? '',
    beforeState: row.before_state ?? undefined,
    afterState: row.after_state ?? undefined,
    severity: (row.severity ?? 'info') as EventSeverity,
    mock: row.mock ?? false,
    traceId: row.trace_id ?? undefined,
    notes: undefined,
  };
}

function mapTicketAuditToActivity(row: any): TenderActivityEvent {
  return {
    id: row.id,
    tenderWorkspaceId: row.ticket_id,
    eventType: row.field_changed ?? row.action ?? '',
    title: row.field_changed ?? row.action ?? 'Ticket audit',
    description: row.notes ?? '',
    category: 'workspace',
    userId: row.user_name ?? '',
    userName: row.user_name ?? '',
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    severity: 'info',
    mock: false,
    notes: undefined,
  };
}

function mapTicketAuditToAuditEntry(row: any): TenderAuditEntry {
  return {
    id: row.id,
    tenderWorkspaceId: row.ticket_id,
    action: row.action ?? '',
    eventCode: row.field_changed ?? undefined,
    eventName: row.field_changed ?? undefined,
    entityType: 'commercial_ticket',
    entityId: row.ticket_id,
    category: 'SYSTEM',
    userId: row.user_name ?? '',
    userName: row.user_name ?? '',
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    details: row.notes ?? '',
    beforeState: row.old_value ?? undefined,
    afterState: row.new_value ?? undefined,
    severity: 'info',
    mock: false,
    notes: undefined,
  };
}

function mapTender(row: any): Tender {
  return {
    id: row.id,
    linkedWorkspaceId: row.linked_workspace_id ?? null,
    customerId: row.customer_id ?? '',
    customerName: row.customer_name ?? '',
    title: row.title ?? '',
    submissionDeadline: row.submission_deadline ?? '',
    estimatedValue: row.estimated_value ?? 0,
    targetGpPercent: row.target_gp_percent ?? 0,
    probabilityPercent: row.probability_percent ?? 0,
    assignedOwner: row.assigned_owner ?? '',
    assignedTeamMembers: Array.isArray(row.assigned_team_members) ? row.assigned_team_members : [],
    /** Internal tender process stage — read from tenders.phase */
    status: (row.phase ?? '') as Tender['status'],
    /** CRM Pipeline stage — read from tenders.crm_pipeline_stage (TND-003) */
    crmPipelineStage: (row.crm_pipeline_stage ?? '') as Tender['crmPipelineStage'],
    source: (row.source ?? '') as Tender['source'],
    region: (row.region ?? '') as Tender['region'],
    // Tender Execution Scope — operational delivery geography
    executionRegions: Array.isArray(row.execution_regions) ? row.execution_regions : [],
    targetSites: Array.isArray(row.target_sites) ? row.target_sites : [],
    executionType: row.execution_type ?? '',
    geographicComplexity: row.geographic_complexity ?? '',
    siteCount: row.site_count ?? 0,
    executionNotes: row.execution_notes ?? '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : '',
    daysInStatus: row.days_in_status ?? 0,
    notes: row.notes ?? '',
    crmSynced: row.crm_synced ?? false,
  };
}

// ─── Stage normalizers (commercial_tickets → Tender types) ───

const CRM_STAGE_MAP: Record<string, Tender['crmPipelineStage']> = {
  'prospecting': 'prospecting',
  'qualified': 'qualified',
  'proposal sent': 'proposal_sent',
  'proposal_sent': 'proposal_sent',
  'shortlisted': 'shortlisted',
  'contract negotiation': 'contract_negotiation',
  'contract_negotiation': 'contract_negotiation',
  'closed won': 'closed_won',
  'closed_won': 'closed_won',
  'contract signed': 'contract_signed',
  'contract_signed': 'contract_signed',
  'operational handover': 'operational_handover',
  'operational_handover': 'operational_handover',
  'actual go live': 'actual_go_live',
  'actual_go_live': 'actual_go_live',
  'closed lost': 'closed_lost',
  'closed_lost': 'closed_lost',
  'discontinued': 'discontinued',
};

function normalizeCrmStage(value: string | null | undefined): Tender['crmPipelineStage'] {
  if (!value) return 'prospecting';
  return CRM_STAGE_MAP[value.toLowerCase().trim()] ?? 'prospecting';
}

/**
 * W04-T08-A: the CRM stage keys this read layer can restore from
 * `commercial_tickets.crm_pipeline_stage`.
 *
 * `normalizeCrmStage` silently coerces anything else to 'prospecting'. A writer
 * that persists an unrestorable key produces a successful write whose value the
 * workspace then displays as a *different* stage. Callers must check this
 * before writing rather than report a persistence that cannot be read back.
 */
export const RESTORABLE_CRM_PIPELINE_STAGES: readonly string[] = Array.from(
  new Set(Object.values(CRM_STAGE_MAP)),
).filter((v) => normalizeCrmStage(v) === v);

/**
 * SC-01 Wave 04 (Fable, integration): defined as an actual round trip rather
 * than membership of the map's *value* set. Those are not the same test — the
 * map can hold a spaced spelling ("actual go live") whose value is a valid
 * milestone while the underscored key the application actually writes is
 * absent. Membership would pass; the round trip would still break, and the
 * workspace would display a different stage than the one stored.
 */
export function isRestorableCrmPipelineStage(value: string | null | undefined): boolean {
  return typeof value === 'string' && value !== '' && normalizeCrmStage(value) === value;
}

function normalizeInternalTenderStage(value: string | null | undefined): Tender['status'] {
  // Tender.status is TenderMilestone — same union as crmPipelineStage.
  // commercial_tickets.internal_stage may carry values like "identified",
  // "qualification", "bid_no_bid" which are NOT in TenderMilestone.
  // For compatibility, map to the closest valid milestone.
  if (!value) return 'prospecting';
  const lower = value.toLowerCase().trim();
  const direct = CRM_STAGE_MAP[lower];
  if (direct) return direct;
  // Best-effort fallback for non-CRM internal stages
  if (lower === 'identified' || lower === 'new') return 'prospecting';
  if (lower === 'qualification' || lower === 'qualifying') return 'qualified';
  if (lower.includes('bid')) return 'qualified';
  // Proposal preparation / drafting — map to proposal_sent (nearest CRM milestone)
  if (lower === 'proposal_preparation' || lower === 'tender_drafting' || lower.includes('drafting')) return 'proposal_sent';
  if (lower.includes('submission') || lower.includes('preparing')) return 'proposal_sent';
  if (lower.includes('review') || lower.includes('evaluation')) return 'shortlisted';
  if (lower.includes('negotiation')) return 'contract_negotiation';
  if (lower.includes('award') || lower.includes('won')) return 'closed_won';
  if (lower.includes('lost')) return 'closed_lost';
  if (lower.includes('withdrawn') || lower.includes('cancel')) return 'discontinued';
  return 'prospecting';
}

/**
 * Maps a raw commercial_tickets.internal_stage value to the internal tender
 * process tracker cognition stage used in TenderWorkspaceDetail.
 * This is separate from TenderMilestone (CRM stage) — it drives which
 * tab set the workspace opens at.
 */
export function mapDbStageToInternalCognitionStage(internal_stage: string | null | undefined): string {
  return normalizeTenderInternalStage(internal_stage);
}

const REGION_MAP: Record<string, Tender['region']> = {
  'east': 'East',
  'central': 'Central',
  'west': 'West',
  'global': 'Global',
};

function normalizeRegion(value: string | null | undefined): Tender['region'] {
  if (!value) return 'East';
  return REGION_MAP[value.toLowerCase().trim()] ?? 'East';
}

const SOURCE_MAP: Record<string, Tender['source']> = {
  'crm': 'CRM',
  'direct': 'Direct',
  'referral': 'Referral',
};

function normalizeSource(value: string | null | undefined): Tender['source'] {
  if (!value) return 'Direct';
  return SOURCE_MAP[value.toLowerCase().trim()] ?? 'Direct';
}

function normalizeTenderDocumentCategory(value: unknown): TenderDocumentCategory {
  return TENDER_DOCUMENT_CATEGORIES.includes(value as TenderDocumentCategory) ? value as TenderDocumentCategory : 'Generated';
}

function normalizeTenderDocumentStatus(value: unknown): TenderDocumentStatus {
  return TENDER_DOCUMENT_STATUSES.includes(value as TenderDocumentStatus) ? value as TenderDocumentStatus : 'Uploaded';
}

const TENDER_STAGE_RELEVANCE_ALIASES: Record<string, TenderStageRelevance> = {
  identified: 'Identified',
  qualification: 'Qualification',
  'bid no bid': 'Bid / No-Bid',
  'bid / no bid': 'Bid / No-Bid',
  solutioning: 'Solutioning',
  'solution design': 'Solutioning',
  pricing: 'Pricing',
  'pnl pricing': 'Pricing',
  'p&l pricing': 'Pricing',
  'p&l / pricing': 'Pricing',
  'tender drafting': 'Tender Drafting',
  'proposal drafting': 'Proposal Drafting',
  review: 'Review',
  'internal review': 'Review',
  approval: 'Approval',
  'approval matrix': 'Approval',
  'final approved': 'Approval',
  submission: 'Submission',
  submitted: 'Submission',
  clarification: 'Post Submission',
  'client evaluation': 'Post Submission',
  'technical review': 'Post Submission',
  'commercial review': 'Post Submission',
  negotiation: 'Post Submission',
  'post submission': 'Post Submission',
  'lost withdrawn': 'Post Submission',
  'lost / withdrawn': 'Post Submission',
  award: 'Award',
  awarded: 'Award',
};

function normalizeStageRelevanceKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ');
}

function normalizeTenderStageRelevance(value: unknown): TenderStageRelevance[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<TenderStageRelevance>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    const stage = TENDER_STAGE_RELEVANCE.includes(trimmed as TenderStageRelevance)
      ? trimmed as TenderStageRelevance
      : TENDER_STAGE_RELEVANCE_ALIASES[normalizeStageRelevanceKey(trimmed)];
    if (stage) seen.add(stage);
  }
  return Array.from(seen);
}

function normalizeTenderDocument(raw: any, tenderId: string): TenderDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : null;
  const name = typeof raw.document_name === 'string' && raw.document_name.trim() ? raw.document_name.trim() : '';
  if (!id || !name) return null;
  return {
    id,
    tender_id: typeof raw.tender_id === 'string' && raw.tender_id ? raw.tender_id : tenderId,
    document_name: name,
    document_category: normalizeTenderDocumentCategory(raw.document_category),
    document_type: typeof raw.document_type === 'string' ? raw.document_type : '',
    file_url: typeof raw.file_url === 'string' ? raw.file_url : '',
    storage_path: typeof raw.storage_path === 'string' ? raw.storage_path : '',
    version: typeof raw.version === 'string' ? raw.version : String(raw.version ?? ''),
    status: normalizeTenderDocumentStatus(raw.status),
    stage_relevance: normalizeTenderStageRelevance(raw.stage_relevance),
    owner: typeof raw.owner === 'string' ? raw.owner : '',
    uploaded_by: typeof raw.uploaded_by === 'string' ? raw.uploaded_by : '',
    uploaded_at: typeof raw.uploaded_at === 'string' ? raw.uploaded_at : '',
    received_date: typeof raw.received_date === 'string' ? raw.received_date : '',
    expiry_date: typeof raw.expiry_date === 'string' ? raw.expiry_date : '',
    required_for_submission: Boolean(raw.required_for_submission),
    linked_requirement_id: typeof raw.linked_requirement_id === 'string' ? raw.linked_requirement_id : '',
    linked_proposal_section: typeof raw.linked_proposal_section === 'string' ? raw.linked_proposal_section : '',
    source_channel: typeof raw.source_channel === 'string' ? raw.source_channel : '',
    buyer_reference_number: typeof raw.buyer_reference_number === 'string' ? raw.buyer_reference_number : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  };
}

// ─── commercial_tickets → Tender mapper ──────────────────────

function mapCommercialTicketToTender(row: any): Tender {
  const typeDetails = normalizeTenderTypeDetails(row.type_details);
  return {
    id: row.id,
    linkedWorkspaceId: null,
    customerId: row.customer_id ?? '',
    customerName: row.customer_name ?? 'Not captured yet',
    title: row.ticket_title ?? 'Not captured yet',
    submissionDeadline: row.target_date ?? '',
    estimatedValue: Number(row.estimated_value) || 0,
    targetGpPercent: Number(row.target_gp_percent) || 0,
    probabilityPercent: Number(row.probability_percent) || 0,
    assignedOwner: row.owner ?? '',
    assignedTeamMembers: Array.isArray(row.team_members) ? row.team_members : [],
    status: normalizeInternalTenderStage(row.internal_stage),
    crmPipelineStage: normalizeCrmStage(row.crm_pipeline_stage),
    source: normalizeSource(typeDetails.source ?? row.source_type),
    region: normalizeRegion(row.region),
    executionRegions: Array.isArray(typeDetails.execution_regions) ? typeDetails.execution_regions : [],
    targetSites: Array.isArray(typeDetails.target_sites) ? typeDetails.target_sites : [],
    executionType: typeDetails.execution_type ?? '',
    geographicComplexity: typeDetails.geographic_complexity ?? '',
    siteCount: Array.isArray(typeDetails.target_sites) ? typeDetails.target_sites.length : 0,
    executionNotes: row.notes ?? '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : '',
    daysInStatus: row.created_at
      ? Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000))
      : 0,
    notes: row.notes ?? '',
    crmSynced: false,
    sowData: (typeDetails.sow_data && typeof typeDetails.sow_data === 'object') ? typeDetails.sow_data : undefined,
    customerFitData: (typeDetails.customer_fit_data && typeof typeDetails.customer_fit_data === 'object') ? typeDetails.customer_fit_data : undefined,
    sowQualificationData: (typeDetails.sow_qualification_data && typeof typeDetails.sow_qualification_data === 'object') ? typeDetails.sow_qualification_data : undefined,
    technicalQualificationData: (typeDetails.technical_qualification_data && typeof typeDetails.technical_qualification_data === 'object') ? typeDetails.technical_qualification_data : undefined,
    riskSnapshotData: (typeDetails.risk_snapshot_data && typeof typeDetails.risk_snapshot_data === 'object') ? typeDetails.risk_snapshot_data : undefined,
    bidNoBidData: (typeDetails.bid_no_bid_data && typeof typeDetails.bid_no_bid_data === 'object') ? typeDetails.bid_no_bid_data : undefined,
    solutionDesignData: (typeDetails.solution_design_data && typeof typeDetails.solution_design_data === 'object') ? typeDetails.solution_design_data : undefined,
    pricingData: normalizeTenderPricingData(typeDetails.pricing),
    tenderDraftingData: (typeDetails.tender_drafting && typeof typeDetails.tender_drafting === 'object') ? typeDetails.tender_drafting : undefined,
    typeDetails,
    type_details: typeDetails,
    internalStageRaw: row.internal_stage ?? undefined,
  };
}

// ─── Fetch functions ─────────────────────────────────────────

type TenderHeaderRead =
  | { outcome: 'loaded'; row: any; tender: Tender }
  | { outcome: 'not_found' }
  | { outcome: 'error'; message: string };

/**
 * W04-T08-A: the header read now reports failure instead of swallowing it.
 * Previously a PostgREST/RLS error was console-warned and returned as `null`,
 * which the workspace rendered as "no data found" — a read failure disguised as
 * an honest empty. It also asserts the returned row IS the requested identity.
 */
async function fetchTenderHeader(tenderId: string): Promise<TenderHeaderRead> {
  const intake = await supabase
    .from('commercial_tickets')
    .select('*')
    .eq('id', tenderId)
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .maybeSingle();

  if (intake.error) {
    console.warn('[SUPA-006] fetchTenderHeader commercial_tickets error:', intake.error.message);
    return { outcome: 'error', message: intake.error.message };
  }

  if (!intake.data) return { outcome: 'not_found' };

  if (intake.data.id !== tenderId) {
    return {
      outcome: 'error',
      message: `Tender identity mismatch: requested ${tenderId} but commercial_tickets returned ${String(intake.data.id)}.`,
    };
  }

  return { outcome: 'loaded', row: intake.data, tender: mapCommercialTicketToTender(intake.data) };
}

/**
 * Documents live in `type_details.documents` on the very row the header read
 * already returned. Reading them from that row (instead of a second query that
 * could fail independently and silently return `[]`) keeps the document context
 * bound to the same tender identity the rest of the workspace renders.
 */
function documentsFromTenderRow(row: any, tenderId: string): TenderDocument[] {
  const details = row?.type_details && typeof row.type_details === 'object' ? row.type_details as any : {};
  return Array.isArray(details.documents)
    ? details.documents.map((doc: any) => normalizeTenderDocument(doc, tenderId)).filter(Boolean) as TenderDocument[]
    : [];
}

async function fetchTenderPacks(tenderId: string): Promise<{ packs: TenderPack[]; sections: TenderPackSection[] }> {
  void tenderId;
  return { packs: [], sections: [] };
}

/**
 * TCW-T1 (P1) — the three registers are no longer stubs. They live in
 * `type_details.submission_readiness` ON THE TENDER ROW ITSELF, so reading the
 * confirmed header row IS reading the registers — no extra table, no
 * independent failure mode, and the register is bound to the same identity the
 * rest of the workspace renders. See supabase-tender-actions.ts for the write
 * side (updateTenderSubmissionReadinessData + per-item status operations).
 */
function readSubmissionReadinessFromRow(row: any): TenderSubmissionReadinessRead {
  const details = row?.type_details && typeof row.type_details === 'object' && !Array.isArray(row.type_details)
    ? row.type_details as Record<string, unknown>
    : {};
  return { loaded: true, facet: normalizeSubmissionReadinessFacet(details[SUBMISSION_READINESS_FACET_KEY]) };
}

// ─── Register → legacy UI-type projections ───────────────────
//
// The canonical register statuses are richer than the legacy UI unions, so
// these projections are LOSSY and deliberately conservative:
//   - checklist-style statuses ('na' on placeholders / required documents) map
//     to 'approved' — "no further action required" — because those types drive
//     outstanding-work counters, not verdicts;
//   - compliance is a VERDICT type: only concluded verdicts map to verdict
//     values; 'pending', 'in_review' and 'na' all render as 'not_reviewed'
//     rather than fabricating a compliance claim.
// The exact stored statuses stay available on bundle.submissionReadiness.

const PLACEHOLDER_STATUS_PROJECTION: Record<string, PlaceholderStatus> = {
  pending: 'missing',
  in_progress: 'drafted',
  approved: 'approved',
  na: 'approved',
};

const REQUIRED_DOC_STATUS_PROJECTION: Record<string, RequiredDocStatus> = {
  missing: 'awaiting',
  in_progress: 'draft',
  uploaded: 'uploaded',
  approved: 'approved',
  na: 'approved',
};

const COMPLIANCE_STATUS_PROJECTION: Record<string, ComplianceStatus> = {
  pending: 'not_reviewed',
  in_review: 'not_reviewed',
  compliant: 'compliant',
  non_compliant: 'non_compliant',
  na: 'not_reviewed',
};

function mapRegisterPlaceholderToUi(row: SubmissionReadinessPlaceholder): TenderPlaceholder {
  return {
    id: row.id,
    placeholderKey: row.id,
    label: row.label,
    packId: '',
    packName: '',
    sectionId: '',
    sectionTitle: '',
    category: 'submission',
    owner: typeof row.owner === 'string' ? row.owner : '',
    currentValue: typeof row.value === 'string' ? row.value : '',
    status: PLACEHOLDER_STATUS_PROJECTION[row.status] ?? 'missing',
    source: '',
    evidenceStatus: 'not_required',
    lastUpdated: row.updated_at,
    approvedBy: row.status === 'approved' && row.updated_by ? row.updated_by : null,
    // Advisory register — nothing here blocks anything (no-gate doctrine).
    wouldBlockInProduction: false,
    notes: typeof row.notes === 'string' ? row.notes : '',
  };
}

function mapRegisterRequiredDocumentToUi(row: SubmissionReadinessRequiredDocument): TenderRequiredDocument {
  return {
    id: row.id,
    documentName: row.document_name,
    packId: '',
    packName: '',
    category: 'final_output',
    owner: typeof row.owner === 'string' ? row.owner : '',
    status: REQUIRED_DOC_STATUS_PROJECTION[row.status] ?? 'awaiting',
    nativeRequired: false,
    signedPdfRequired: false,
    stampRequired: false,
    // The register does not record file-level requirements; claiming 'missing'
    // here would fabricate a gap the register never stated.
    nativeStatus: 'not_required',
    signedPdfStatus: 'not_required',
    evidenceStatus: 'not_required',
    version: 0,
    includedInOutput: false,
    wouldBlockInProduction: false,
    lastUpdated: row.updated_at,
    notes: typeof row.notes === 'string' ? row.notes : '',
  };
}

function mapRegisterComplianceItemToUi(row: SubmissionReadinessComplianceItem): TenderComplianceItem {
  return {
    id: row.id,
    reference: typeof row.source_reference === 'string' ? row.source_reference : '',
    requirement: row.requirement,
    packId: '',
    packName: '',
    category: 'scope',
    status: COMPLIANCE_STATUS_PROJECTION[row.status] ?? 'not_reviewed',
    evidence: typeof row.evidence === 'string' ? row.evidence : '',
    owner: typeof row.owner === 'string' ? row.owner : '',
    riskLevel: 'low',
    legalReviewRequired: false,
    commercialImpact: '',
    operationalImpact: '',
    clarificationNeeded: false,
    wouldBlockInProduction: false,
    lastUpdated: row.updated_at,
    notes: typeof row.notes === 'string' ? row.notes : '',
  };
}

/**
 * TCW-T1 (F5) — ONE audit read feeds BOTH history projections. The Activity and
 * Audit Trail collections previously issued two identical commercial_ticket_audit
 * queries for the same rows; any consumer summing the two collections was
 * double-counting a single feed. Both arrays are now projections of this single
 * deduplicated read — consumers must count ONE of them, never the sum.
 */
async function fetchTenderTicketAuditRows(tenderId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('commercial_ticket_audit')
    .select('*')
    .eq('ticket_id', tenderId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[SUPA-006] fetchTenderTicketAuditRows commercial_ticket_audit error:', error.message); return []; }
  return data ?? [];
}

async function fetchTenderSplitChecks(tenderId: string): Promise<TenderSplitCheck[]> {
  void tenderId;
  return [];
}

async function fetchTenderPackOutputs(tenderId: string): Promise<TenderPackOutput[]> {
  void tenderId;
  return [];
}

export async function insertTenderPackOutput(output: {
  id: string;
  tenderId: string;
  tenderPackId: string;
  packName: string;
  sourcePackId: string;
  outputType: string;
  format: string;
  version: string;
  status: string;
  generatedBy: string;
  generatedAt: string;
  watermark: string;
  isTestOutput: boolean;
  wouldBeSubmittableInProduction: boolean;
  readinessWarningsCount: number;
  notes: string;
}): Promise<boolean> {
  console.warn('[SUPA-006] insertTenderPackOutput disabled. Verified document lineage required before persisting outputs.', output.id);
  return false;
}

async function fetchTenderSubmissionEmails(tenderId: string): Promise<TenderSubmissionEmail[]> {
  void tenderId;
  return [];
}

// ─── Bundle orchestrator ──────────────────────────────────────

export async function fetchTenderWorkspaceBundleFromSupabase(tenderId: string): Promise<TenderWorkspaceBundle> {
  console.log(`[SUPA-006] Loading tender workspace bundle for: ${tenderId}`);

  // Option B (architect ruling): an id-only check may reject ONLY the exact
  // legacy seed ids. Every other id is fetched first — a clean-created tender
  // can only be recognised from its row's created_from_intake marker, so
  // rejecting before the read would make a human's own record unreachable.
  if (!mayTenderIdBeAllowed(tenderId)) {
    // NOT an empty result: no query was issued at all.
    return emptyTenderWorkspaceBundle(tenderId, {
      kind: 'isolated',
      message:
        'No read was attempted for this tender: the id is one of the excluded legacy seed records (src/lib/process-isolation.ts, LEGACY_SEED_TENDER_IDS). This is not evidence that the record is absent from commercial_tickets.',
    });
  }

  const [header, { packs, sections: _sections }, ticketAuditRows] = await Promise.all([
    fetchTenderHeader(tenderId),
    fetchTenderPacks(tenderId),
    fetchTenderTicketAuditRows(tenderId),
  ]);

  // F5: two projections of ONE deduplicated audit feed — never sum them.
  const activityEvents = ticketAuditRows.map(mapTicketAuditToActivity);
  const auditEntries = ticketAuditRows.map(mapTicketAuditToAuditEntry);

  if (header.outcome === 'error') {
    return emptyTenderWorkspaceBundle(tenderId, { kind: 'error', message: header.message });
  }
  if (header.outcome === 'not_found') {
    return emptyTenderWorkspaceBundle(tenderId, {
      kind: 'not_found',
      message: `No active tender row is visible for id ${tenderId} in commercial_tickets. Rows hidden by row-level security are indistinguishable from absent rows on this read.`,
    });
  }

  // Post-fetch admission (Option B): the row was read, so it can be evaluated
  // against the real filter — including the created_from_intake marker. A row
  // that fails here was genuinely read and deliberately excluded, and the
  // message says that, rather than pretending the record does not exist.
  if (!isAllowedTenderTicket(header.row)) {
    return emptyTenderWorkspaceBundle(tenderId, {
      kind: 'isolated',
      message:
        'This tender row was read from commercial_tickets but is excluded from the clean process surface by process isolation (it is neither clean-created nor on the approved allowlist). The record exists; it is deliberately not shown here.',
    });
  }

  const tender = header.tender;
  const documents = documentsFromTenderRow(header.row, tenderId);

  // P1: the registers come from the confirmed header row itself.
  const submissionReadiness = readSubmissionReadinessFromRow(header.row);
  const placeholders = submissionReadiness.facet.placeholders.map(mapRegisterPlaceholderToUi);
  const requiredDocuments = submissionReadiness.facet.required_documents.map(mapRegisterRequiredDocumentToUi);
  const complianceItems = submissionReadiness.facet.compliance_items.map(mapRegisterComplianceItemToUi);

  const [splitChecks, packOutputs, submissionEmails] = await Promise.all([
    fetchTenderSplitChecks(tenderId),
    fetchTenderPackOutputs(tenderId),
    fetchTenderSubmissionEmails(tenderId),
  ]);

  // Derive workspace-level fields from pack metadata (first pack with the fields)
  const anyPack = packs[0] as any;
  const tenderType = (anyPack as any)?.tenderType ?? '';
  const readinessScore = packs.length > 0
    ? Math.round(packs.reduce((s, p) => s + p.readinessScore, 0) / packs.length)
    : 0;
  // riskLevel derived from the RAW canonical register statuses (never from the
  // lossy UI projections) — no mock gates, and no verdict without recorded data:
  //   - the inputs count as assessed only when the register was genuinely read
  //     (same confirmed row read as the tender itself);
  //   - a read-but-EMPTY register still carries no verdict: "nothing recorded"
  //     must never render as a green "On Track";
  //   - with rows recorded, a gap is an EXPLICITLY recorded problem
  //     (compliance 'non_compliant', required document 'missing') and green
  //     means exactly "rows are recorded and none records a gap".
  const riskInputsAssessed = submissionReadiness.loaded;
  const recordedComplianceItems = submissionReadiness.facet.compliance_items;
  const recordedRequiredDocuments = submissionReadiness.facet.required_documents;
  const complianceGaps = recordedComplianceItems.filter(c => c.status === 'non_compliant').length;
  const missingDocsCount = recordedRequiredDocuments.filter(d => d.status === 'missing').length;
  const nothingRecorded = recordedComplianceItems.length === 0 && recordedRequiredDocuments.length === 0;
  const riskLevel: TenderRiskLevel = !riskInputsAssessed || nothingRecorded
    ? 'not_assessed'
    : complianceGaps > 5 || missingDocsCount > 5 ? 'red'
    : complianceGaps > 0 || missingDocsCount > 0 ? 'amber'
    : 'green';

  return {
    requestedTenderId: tenderId,
    loadState: { kind: 'loaded' },
    tender,
    packs,
    submissionReadiness,
    placeholders,
    requiredDocuments,
    documents,
    complianceItems,
    activityEvents,
    auditEntries,
    splitChecks,
    packOutputs,
    submissionEmails,
    tenderType,
    readinessScore,
    riskLevel,
    riskInputsAssessed,
    requiredDocumentsAssessed: submissionReadiness.loaded,
    crmSyncStatus: 'not_synced',
    submissionModel: packs.length > 1 ? 'multi_pack' : 'single_pack',
    crmPipelineStageRaw: typeof header.row.crm_pipeline_stage === 'string' && header.row.crm_pipeline_stage.trim()
      ? header.row.crm_pipeline_stage
      : null,
  };
}

// ─── Assemble into TenderWorkspace shape ─────────────────────

export function bundleToTenderWorkspace(bundle: TenderWorkspaceBundle): TenderWorkspace | null {
  if (!bundle.tender) return null;
  return {
    tender: bundle.tender,
    tenderType: bundle.tenderType,
    readinessScore: bundle.readinessScore,
    riskLevel: bundle.riskLevel,
    riskInputsAssessed: bundle.riskInputsAssessed,
    requiredDocumentsAssessed: bundle.requiredDocumentsAssessed,
    crmSyncStatus: bundle.crmSyncStatus,
    submissionModel: bundle.submissionModel,
    crmPipelineStageRaw: bundle.crmPipelineStageRaw,
    packs: bundle.packs,
    placeholders: bundle.placeholders,
    requiredDocuments: bundle.requiredDocuments,
    documents: bundle.documents,
    complianceItems: bundle.complianceItems,
    activityEvents: bundle.activityEvents,
    auditEntries: bundle.auditEntries,
    // Extended fields — available when bundle is Supabase-backed
    splitChecks: (bundle as any).splitChecks ?? [],
    packOutputs: (bundle as any).packOutputs ?? [],
    submissionEmails: (bundle as any).submissionEmails ?? [],
  };
}
