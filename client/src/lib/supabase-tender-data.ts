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
  TenderComplianceItem,
  TenderMockGate,
  TenderActivityEvent,
  TenderAuditEntry,
  TenderSplitCheck,
  TenderPackOutput,
  TenderSubmissionEmail,
  TenderWorkspace,
  TenderPackStatus,
  TenderPackType,
  MockGateStatus,
  GateSeverity,
  GateCategory,
  GateEnforcement,
  GateRuntime,
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

// ─── Bundle type ────────────────────────────────────────────

export interface TenderWorkspaceBundle {
  tender: Tender | null;
  packs: TenderPack[];
  placeholders: TenderPlaceholder[];
  requiredDocuments: TenderRequiredDocument[];
  complianceItems: TenderComplianceItem[];
  mockGates: TenderMockGate[];
  activityEvents: TenderActivityEvent[];
  auditEntries: TenderAuditEntry[];
  splitChecks: TenderSplitCheck[];
  packOutputs: TenderPackOutput[];
  submissionEmails: TenderSubmissionEmail[];
  /** Derived workspace-level fields from pack row (first pack meta) */
  tenderType: string;
  readinessScore: number;
  riskLevel: 'green' | 'amber' | 'red';
  crmSyncStatus: 'not_synced' | 'synced' | 'sync_failed' | 'conflict' | 'simulated';
  submissionModel: 'single_pack' | 'multi_pack';
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
    ? { sections: 0, placeholders: 0, required_documents: 0, compliance: 0, mock_gates: 0, outputs: 0 }
    : { sections: 0, placeholders: 0, required_documents: 0, compliance: 0, mock_gates: 0, outputs: 0 };
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
    mockWarnings: Array.isArray(row.mock_warnings) ? row.mock_warnings : [],
    mockActions: Array.isArray(row.mock_actions) ? row.mock_actions : [],
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

function mapGate(row: any): TenderMockGate {
  return {
    id: row.id,
    tenderWorkspaceId: row.tender_workspace_id ?? '',
    tenderPackId: row.pack_id ?? null,
    gateCode: row.gate_code ?? '',
    gateName: row.name ?? '',
    gateDescription: row.gate_description ?? '',
    status: (row.status ?? 'not_started') as MockGateStatus,
    severity: (row.severity ?? 'medium') as GateSeverity,
    category: (row.category ?? 'placeholder') as GateCategory,
    enforcementMode: (row.enforcement_mode ?? 'mock_only') as GateEnforcement,
    runtimeMode: (row.runtime_mode ?? 'development_marker') as GateRuntime,
    doctrineRequired: row.doctrine ?? false,
    isMock: row.is_mock ?? true,
    wouldBlock: row.would_block ?? false,
    wouldBlockReason: row.would_block_reason ?? '',
    allowTestBypass: row.allow_test_bypass ?? true,
    linkedSignal: row.linked_signal ?? '',
    ownerId: row.owner_id ?? null,
    ownerName: row.owner_name ?? null,
    evaluatedAt: row.evaluated_at ?? null,
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
    mock: row.mock ?? true,
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
    mock: row.mock ?? true,
    traceId: row.trace_id ?? undefined,
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
    status: (row.phase ?? 'identified') as Tender['status'],
    source: (row.source ?? 'Direct') as Tender['source'],
    region: (row.region ?? 'East') as Tender['region'],
    createdAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : '',
    daysInStatus: row.days_in_status ?? 0,
    notes: row.notes ?? '',
    crmSynced: row.crm_synced ?? false,
  };
}

// ─── Fetch functions ─────────────────────────────────────────

async function fetchTenderHeader(tenderId: string): Promise<Tender | null> {
  const { data, error } = await supabase.from('tenders').select('*').eq('id', tenderId).maybeSingle();
  if (error) { console.warn('[SUPA-006] fetchTenderHeader error:', error.message); return null; }
  return data ? mapTender(data) : null;
}

async function fetchTenderPacks(tenderId: string): Promise<{ packs: TenderPack[]; sections: TenderPackSection[] }> {
  const { data: packRows, error: packErr } = await supabase.from('tender_packs').select('*').eq('tender_workspace_id', tenderId);
  if (packErr) { console.warn('[SUPA-006] fetchTenderPacks error:', packErr.message); return { packs: [], sections: [] }; }
  if (!packRows?.length) return { packs: [], sections: [] };

  const packIds = packRows.map(p => p.id);
  const { data: sectionRows, error: secErr } = await supabase.from('tender_pack_sections').select('*').in('pack_id', packIds);
  if (secErr) { console.warn('[SUPA-006] fetchTenderPackSections error:', secErr.message); }

  const sections = (sectionRows ?? []).map(mapSection);
  const packs = packRows.map(r => mapPack(r, sections));
  return { packs, sections };
}

async function fetchTenderPlaceholders(tenderId: string, packIds: string[]): Promise<TenderPlaceholder[]> {
  if (!packIds.length) return [];
  const { data, error } = await supabase.from('tender_placeholders').select('*').in('pack_id', packIds);
  if (error) { console.warn('[SUPA-006] fetchTenderPlaceholders error:', error.message); return []; }
  return (data ?? []).map(mapPlaceholder);
}

async function fetchTenderRequiredDocuments(packIds: string[]): Promise<TenderRequiredDocument[]> {
  if (!packIds.length) return [];
  const { data, error } = await supabase.from('tender_required_documents').select('*').in('pack_id', packIds);
  if (error) { console.warn('[SUPA-006] fetchTenderRequiredDocuments error:', error.message); return []; }
  return (data ?? []).map(mapRequiredDocument);
}

async function fetchTenderComplianceItems(packIds: string[]): Promise<TenderComplianceItem[]> {
  if (!packIds.length) return [];
  const { data, error } = await supabase.from('tender_compliance_items').select('*').in('pack_id', packIds);
  if (error) { console.warn('[SUPA-006] fetchTenderComplianceItems error:', error.message); return []; }
  return (data ?? []).map(mapComplianceItem);
}

async function fetchTenderGates(tenderId: string): Promise<TenderMockGate[]> {
  const { data, error } = await supabase.from('tender_submission_gates').select('*');
  if (error) { console.warn('[SUPA-006] fetchTenderGates error:', error.message); return []; }
  // Filter by workspace_id if the column exists; otherwise return all gates linked to our pack ids
  return (data ?? [])
    .filter(r => r.tender_workspace_id === tenderId || r.tender_workspace_id === null || r.tender_workspace_id === '')
    .map(r => ({ ...r, tender_workspace_id: tenderId }))
    .map(mapGate);
}

async function fetchTenderActivityEvents(tenderId: string): Promise<TenderActivityEvent[]> {
  const { data, error } = await supabase.from('tender_activity_events').select('*').eq('workspace_id', tenderId).order('timestamp', { ascending: false });
  if (error) { console.warn('[SUPA-006] fetchTenderActivityEvents error:', error.message); return []; }
  return (data ?? []).map(mapActivityEvent);
}

async function fetchTenderAuditEntries(tenderId: string): Promise<TenderAuditEntry[]> {
  const { data, error } = await supabase.from('tender_audit_events').select('*').eq('workspace_id', tenderId).order('timestamp', { ascending: false });
  if (error) { console.warn('[SUPA-006] fetchTenderAuditEntries error:', error.message); return []; }
  return (data ?? []).map(mapAuditEntry);
}

async function fetchTenderSplitChecks(tenderId: string): Promise<TenderSplitCheck[]> {
  const { data, error } = await supabase.from('tender_split_checks').select('*').eq('tender_workspace_id', tenderId);
  if (error) { console.warn('[SUPA-006] fetchTenderSplitChecks error:', error.message); return []; }
  return (data ?? []).map(row => ({
    id: row.id,
    checkName: row.check_name ?? '',
    description: row.description ?? '',
    category: row.category ?? 'cross_references',
    sourcePackId: row.source_pack_id ?? '',
    targetPackId: row.target_pack_id ?? '',
    status: row.status ?? 'not_checked',
    severity: row.severity ?? 'medium',
    wouldBlockInProduction: row.would_block_in_production ?? false,
    mockResolution: row.mock_resolution ?? '',
    notes: row.notes ?? '',
  }));
}

async function fetchTenderPackOutputs(tenderId: string): Promise<TenderPackOutput[]> {
  const { data, error } = await supabase.from('tender_pack_outputs').select('*').eq('tender_workspace_id', tenderId);
  if (error) { console.warn('[SUPA-006] fetchTenderPackOutputs error:', error.message); return []; }
  return (data ?? []).map(row => ({
    id: row.id,
    outputName: row.output_name ?? '',
    tenderPackId: row.tender_pack_id ?? '',
    packName: row.pack_name ?? '',
    sourcePackId: row.source_pack_id ?? '',
    outputType: row.output_type ?? '',
    format: row.format ?? 'PDF',
    version: row.version ?? 'v1',
    status: row.status ?? 'draft_mock',
    generatedBy: row.generated_by ?? '',
    generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : '',
    watermark: row.watermark ?? '',
    isTestOutput: row.is_test_output ?? true,
    wouldBeSubmittableInProduction: row.would_be_submittable_in_production ?? false,
    mockWarningsCount: row.mock_warnings_count ?? 0,
    notes: row.notes ?? '',
  }));
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
  mockWarningsCount: number;
  notes: string;
}): Promise<boolean> {
  const { error } = await supabase.from('tender_pack_outputs').insert({
    id: output.id,
    tender_workspace_id: output.tenderId,
    tender_pack_id: output.tenderPackId,
    pack_name: output.packName,
    source_pack_id: output.sourcePackId,
    output_name: `${output.packName} — TEST OUTPUT`,
    output_type: output.outputType,
    format: output.format,
    version: output.version,
    status: output.status,
    generated_by: output.generatedBy,
    generated_at: output.generatedAt,
    watermark: output.watermark,
    is_test_output: output.isTestOutput,
    would_be_submittable_in_production: output.wouldBeSubmittableInProduction,
    mock_warnings_count: output.mockWarningsCount,
    notes: output.notes,
  });
  if (error) {
    console.warn('[SUPA-006] insertTenderPackOutput error:', error.message);
    return false;
  }
  return true;
}

async function fetchTenderSubmissionEmails(tenderId: string): Promise<TenderSubmissionEmail[]> {
  const { data, error } = await supabase.from('tender_submission_emails').select('*').eq('tender_workspace_id', tenderId);
  if (error) { console.warn('[SUPA-006] fetchTenderSubmissionEmails error:', error.message); return []; }
  // Also fetch attachments for each email
  const emails = data ?? [];
  const emailIds = emails.map((e: any) => e.id);
  let attachments: any[] = [];
  if (emailIds.length > 0) {
    const { data: attData } = await supabase.from('tender_submission_email_attachments').select('*').in('email_id', emailIds);
    attachments = attData ?? [];
  }
  return emails.map((row: any) => ({
    id: row.id,
    tenderPackId: row.tender_pack_id ?? '',
    packName: row.pack_name ?? '',
    emailType: row.email_type ?? 'bulk_submission',
    to: row.to_address ?? '',
    ccExternal: row.cc_external ?? '',
    ccInternal: row.cc_internal ?? '',
    subject: row.subject ?? '',
    body: row.body ?? '',
    attachments: attachments.filter((a: any) => a.email_id === row.id).map((a: any) => ({
      id: a.id,
      fileName: a.file_name ?? '',
      documentType: a.document_type ?? '',
      format: a.format ?? 'PDF',
      required: a.required ?? false,
      included: a.included ?? false,
      status: a.status ?? 'missing',
      sizeMb: Number(a.size_mb ?? 0),
      notes: a.notes ?? '',
    })),
    attachmentSizeMb: Number(row.attachment_size_mb ?? 0),
    status: row.status ?? 'draft_mock',
    simulated: row.simulated ?? false,
    submittedBy: row.submitted_by ?? '',
    submittedAt: row.submitted_at ?? null,
    crmSyncStatus: row.crm_sync_status ?? 'not_synced',
    warningsCount: row.warnings_count ?? 0,
    notes: row.notes ?? '',
  }));
}

// ─── Bundle orchestrator ──────────────────────────────────────

export async function fetchTenderWorkspaceBundleFromSupabase(tenderId: string): Promise<TenderWorkspaceBundle> {
  console.log(`[SUPA-006] Loading tender workspace bundle for: ${tenderId}`);

  const [tender, { packs, sections: _sections }, activityEvents, auditEntries] = await Promise.all([
    fetchTenderHeader(tenderId),
    fetchTenderPacks(tenderId),
    fetchTenderActivityEvents(tenderId),
    fetchTenderAuditEntries(tenderId),
  ]);

  const packIds = packs.map(p => p.id);

  const [placeholders, requiredDocuments, complianceItems, mockGates, splitChecks, packOutputs, submissionEmails] = await Promise.all([
    fetchTenderPlaceholders(tenderId, packIds),
    fetchTenderRequiredDocuments(packIds),
    fetchTenderComplianceItems(packIds),
    fetchTenderGates(tenderId),
    fetchTenderSplitChecks(tenderId),
    fetchTenderPackOutputs(tenderId),
    fetchTenderSubmissionEmails(tenderId),
  ]);

  // Derive workspace-level fields from pack metadata (first pack with the fields)
  const anyPack = packs[0] as any;
  const tenderType = (anyPack as any)?.tenderType ?? 'Multi-Pack Transport Tender';
  const readinessScore = packs.length > 0
    ? Math.round(packs.reduce((s, p) => s + p.readinessScore, 0) / packs.length)
    : 0;
  const wouldBlockCount = mockGates.filter(g => g.wouldBlock).length;
  const riskLevel: 'green' | 'amber' | 'red' = wouldBlockCount > 5 ? 'red' : wouldBlockCount > 0 ? 'amber' : 'green';

  console.log(`[SUPA-006] Bundle loaded: ${packs.length} packs, ${placeholders.length} placeholders, ${requiredDocuments.length} docs, ${complianceItems.length} compliance, ${mockGates.length} gates, ${activityEvents.length} activity, ${auditEntries.length} audit`);

  return {
    tender,
    packs,
    placeholders,
    requiredDocuments,
    complianceItems,
    mockGates,
    activityEvents,
    auditEntries,
    splitChecks,
    packOutputs,
    submissionEmails,
    tenderType,
    readinessScore,
    riskLevel,
    crmSyncStatus: 'simulated',
    submissionModel: packs.length > 1 ? 'multi_pack' : 'single_pack',
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
    crmSyncStatus: bundle.crmSyncStatus,
    submissionModel: bundle.submissionModel,
    packs: bundle.packs,
    placeholders: bundle.placeholders,
    requiredDocuments: bundle.requiredDocuments,
    complianceItems: bundle.complianceItems,
    mockGates: bundle.mockGates,
    activityEvents: bundle.activityEvents,
    auditEntries: bundle.auditEntries,
    // Extended fields — available when bundle is Supabase-backed
    splitChecks: (bundle as any).splitChecks ?? [],
    packOutputs: (bundle as any).packOutputs ?? [],
    submissionEmails: (bundle as any).submissionEmails ?? [],
  };
}
