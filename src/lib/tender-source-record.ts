import {
  projectTenderLifecycleMemory,
  projectTenderStageTruth,
  type TenderLifecycleMemory,
  type TenderStageTruth,
} from './tender-stage-source-truth';

export type TenderSourceOrigin =
  | 'manual'
  | 'extracted_suggestion'
  | 'accepted_ai_drafting'
  | 'import'
  | 'system_migration';

export type TenderSaveStatus =
  | 'saved'
  | 'saved_with_audit_warning'
  | 'stale'
  | 'not_found'
  | 'invalid_identity'
  | 'invalid_change'
  | 'failed';

export type JsonObject = Record<string, unknown>;

export interface TenderSourceRow extends JsonObject {
  id: string;
  ticket_type: string;
  active: boolean;
  updated_at: string;
  type_details?: unknown;
}

export interface TenderSourceAuditRecord extends JsonObject {
  id: string;
  ticket_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  user_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface TenderSourceAuditWrite {
  tenderId: string;
  action: 'updated' | 'stage_changed';
  changedFieldPaths: string[];
  previousRevision: string;
  newRevision: string;
  actorId: string;
  actorName: string;
  origin: TenderSourceOrigin;
  evidenceIds: string[];
  suggestionIds: string[];
  note?: string;
}

export interface TenderSourceUpdateResult {
  status: 'saved' | 'stale' | 'not_found' | 'failed';
  row?: TenderSourceRow;
  error?: string;
}

export interface TenderSourceRecordStore {
  readActiveTender(tenderId: string): Promise<TenderSourceRow | null>;
  updateActiveTender(args: {
    tenderId: string;
    expectedRevision: string;
    patch: JsonObject;
  }): Promise<TenderSourceUpdateResult>;
  insertAudit(event: TenderSourceAuditWrite): Promise<{ id?: string; error?: string }>;
  listAudit(tenderId: string): Promise<TenderSourceAuditRecord[]>;
}

export interface TenderSourceRevision {
  token: string;
  updatedAt: string;
}

export interface TenderSourceAggregate {
  identity: {
    sourceRecordId: string;
    sourceRecordType: 'tender';
    title: string | null;
    customerId: string | null;
    customerName: string | null;
    owner: string | null;
  };
  processState: {
    internalStage: string | null;
    crmPipelineStage: string | null;
  };
  customerContext: {
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    company: string | null;
    region: string | null;
    industry: string | null;
  };
  stageData: TenderStageTruth;
  commercialData: {
    estimatedValue: number | null;
    targetGpPercent: number | null;
    probabilityPercent: number | null;
    pricing: unknown;
  };
  documents: unknown[];
  evidenceLinks: unknown[];
  drafting: JsonObject;
  lifecycleMemory: TenderLifecycleMemory;
  audit: TenderSourceAuditRecord[];
  revision: TenderSourceRevision;
  typeDetails: JsonObject;
}

export interface SaveTenderSourceRecordInput {
  tenderId: string;
  expectedRevision?: string;
  columnPatch?: JsonObject;
  typeDetailsPatch?: JsonObject;
  changedFieldPaths?: string[];
  actor: { id: string; name: string };
  origin: TenderSourceOrigin;
  evidenceIds?: string[];
  suggestionIds?: string[];
  note?: string;
  recordAudit?: boolean;
}

export interface TenderSaveAttempt {
  columnPatch: JsonObject;
  typeDetailsPatch: JsonObject;
  changedFieldPaths: string[];
}

export interface SaveTenderSourceRecordResult {
  success: boolean;
  status: TenderSaveStatus;
  aggregate?: TenderSourceAggregate;
  previousRevision?: TenderSourceRevision;
  newRevision?: TenderSourceRevision;
  attemptedChanges: TenderSaveAttempt;
  auditRecorded: boolean;
  auditId?: string;
  warning?: string;
  error?: string;
}

const MUTABLE_TENDER_COLUMNS = new Set([
  'ticket_title',
  'customer_name',
  'customer_id',
  'contact_name',
  'contact_email',
  'contact_phone',
  'company',
  'owner',
  'team_members',
  'region',
  'industry',
  'crm_pipeline_stage',
  'internal_stage',
  'estimated_value',
  'target_gp_percent',
  'probability_percent',
  'target_date',
  'notes',
]);

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectOrEmpty(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function evidenceFrom(details: JsonObject): unknown[] {
  const extraction = objectOrEmpty(details.extraction);
  return arrayOrEmpty(extraction.evidence);
}

function isActiveTenderRow(row: TenderSourceRow, requestedId: string): boolean {
  return row.id === requestedId && row.ticket_type === 'tender' && row.active === true;
}

function revisionFrom(row: TenderSourceRow): TenderSourceRevision {
  return { token: row.updated_at, updatedAt: row.updated_at };
}

function deriveChangedPaths(columnPatch: JsonObject, typeDetailsPatch: JsonObject): string[] {
  return [
    ...Object.keys(columnPatch),
    ...Object.keys(typeDetailsPatch).map((key) => `type_details.${key}`),
  ];
}

function validateColumnPatch(columnPatch: JsonObject): string | null {
  const unsupported = Object.keys(columnPatch).filter((key) => !MUTABLE_TENDER_COLUMNS.has(key));
  return unsupported.length ? `Unsupported Tender column change: ${unsupported.join(', ')}` : null;
}

function auditActionFor(paths: string[]): 'updated' | 'stage_changed' {
  return paths.some((path) => path === 'internal_stage' || path === 'crm_pipeline_stage')
    ? 'stage_changed'
    : 'updated';
}

export function mergeTenderTypeDetails(current: unknown, patch: JsonObject): JsonObject {
  return { ...objectOrEmpty(current), ...patch };
}

// ─────────────────────────────────────────────────────────────
// Submission Readiness register — TCW-T1, design pin P1.
//
// The three registers (placeholders / required documents / compliance items)
// live in ONE canonical facet: `type_details.submission_readiness` on the
// tender's commercial_tickets row. No child tables. Rows are written only
// through supabase-tender-actions.ts (updateTenderSubmissionReadinessData and
// the three per-item status operations), all through the guarded
// saveTenderSourceRecord store.
//
// Everything here is pure and network-free so both the write layer and the
// read layer share one contract.
// ─────────────────────────────────────────────────────────────

export const SUBMISSION_READINESS_FACET_KEY = 'submission_readiness';

export const SUBMISSION_READINESS_SECTION_KEYS = [
  'placeholders',
  'required_documents',
  'compliance_items',
] as const;
export type SubmissionReadinessSectionKey = (typeof SUBMISSION_READINESS_SECTION_KEYS)[number];

export const SUBMISSION_PLACEHOLDER_STATUSES = ['pending', 'in_progress', 'approved', 'na'] as const;
export type SubmissionPlaceholderStatus = (typeof SUBMISSION_PLACEHOLDER_STATUSES)[number];

export const SUBMISSION_REQUIRED_DOCUMENT_STATUSES = ['missing', 'in_progress', 'uploaded', 'approved', 'na'] as const;
export type SubmissionRequiredDocumentStatus = (typeof SUBMISSION_REQUIRED_DOCUMENT_STATUSES)[number];

export const SUBMISSION_COMPLIANCE_STATUSES = ['pending', 'in_review', 'compliant', 'non_compliant', 'na'] as const;
export type SubmissionComplianceStatus = (typeof SUBMISSION_COMPLIANCE_STATUSES)[number];

export interface SubmissionReadinessPlaceholder extends JsonObject {
  id: string;
  label: string;
  status: SubmissionPlaceholderStatus;
  value?: string;
  owner?: string;
  notes?: string;
  updated_at: string;
  updated_by: string;
}

export interface SubmissionReadinessRequiredDocument extends JsonObject {
  id: string;
  document_name: string;
  status: SubmissionRequiredDocumentStatus;
  /** Exact id of an uploaded tender document satisfying this requirement (full-id matching only — never fuzzy). */
  linked_document_id?: string;
  owner?: string;
  due_date?: string;
  notes?: string;
  updated_at: string;
  updated_by: string;
}

export interface SubmissionReadinessComplianceItem extends JsonObject {
  id: string;
  requirement: string;
  status: SubmissionComplianceStatus;
  evidence?: string;
  source_reference?: string;
  owner?: string;
  notes?: string;
  updated_at: string;
  updated_by: string;
}

export interface SubmissionReadinessFacet extends JsonObject {
  placeholders: SubmissionReadinessPlaceholder[];
  required_documents: SubmissionReadinessRequiredDocument[];
  compliance_items: SubmissionReadinessComplianceItem[];
}

interface SubmissionReadinessSectionContract {
  /** The row field that names the item to a human. */
  nameField: 'label' | 'document_name' | 'requirement';
  nameLabel: string;
  statuses: readonly string[];
  /** Status a structurally valid stored row falls back to when its status is absent. */
  defaultStatus: string;
}

export const SUBMISSION_READINESS_SECTION_CONTRACTS: Record<SubmissionReadinessSectionKey, SubmissionReadinessSectionContract> = {
  placeholders: {
    nameField: 'label',
    nameLabel: 'label',
    statuses: SUBMISSION_PLACEHOLDER_STATUSES,
    defaultStatus: 'pending',
  },
  required_documents: {
    nameField: 'document_name',
    nameLabel: 'document name',
    statuses: SUBMISSION_REQUIRED_DOCUMENT_STATUSES,
    defaultStatus: 'missing',
  },
  compliance_items: {
    nameField: 'requirement',
    nameLabel: 'requirement',
    statuses: SUBMISSION_COMPLIANCE_STATUSES,
    defaultStatus: 'pending',
  },
};

export function isSubmissionReadinessSectionKey(value: unknown): value is SubmissionReadinessSectionKey {
  return typeof value === 'string' && (SUBMISSION_READINESS_SECTION_KEYS as readonly string[]).includes(value);
}

function normalizeRegisterRow(raw: unknown, section: SubmissionReadinessSectionKey): JsonObject | null {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : null;
  if (!id) return null;
  const contract = SUBMISSION_READINESS_SECTION_CONTRACTS[section];
  const name = typeof raw[contract.nameField] === 'string' ? (raw[contract.nameField] as string) : '';
  // A stored status outside the section union is preserved verbatim (reads never
  // silently rewrite stored data); the WRITE layer refuses to store such values.
  const status = typeof raw.status === 'string' && raw.status.trim() ? raw.status : contract.defaultStatus;
  return {
    ...raw,
    id,
    [contract.nameField]: name,
    status,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : '',
    updated_by: typeof raw.updated_by === 'string' ? raw.updated_by : '',
  };
}

function normalizeRegisterSection(value: unknown, section: SubmissionReadinessSectionKey): JsonObject[] {
  return arrayOrEmpty(value)
    .map((row) => normalizeRegisterRow(row, section))
    .filter((row): row is JsonObject => row !== null);
}

/**
 * Read-side normalizer. Structurally invalid rows (no object / no id) are
 * dropped from the NORMALIZED view only — the write layer never round-trips a
 * normalized facet back into storage; it patches the raw stored facet, so a
 * malformed sibling row is never destroyed by an unrelated save.
 * Unknown facet-level keys and unknown row-level keys are preserved.
 */
export function normalizeSubmissionReadinessFacet(value: unknown): SubmissionReadinessFacet {
  const raw = objectOrEmpty(value);
  return {
    ...raw,
    placeholders: normalizeRegisterSection(raw.placeholders, 'placeholders') as unknown as SubmissionReadinessPlaceholder[],
    required_documents: normalizeRegisterSection(raw.required_documents, 'required_documents') as unknown as SubmissionReadinessRequiredDocument[],
    compliance_items: normalizeRegisterSection(raw.compliance_items, 'compliance_items') as unknown as SubmissionReadinessComplianceItem[],
  };
}

export function isValidSubmissionReadinessStatus(section: SubmissionReadinessSectionKey, status: unknown): boolean {
  return typeof status === 'string' && SUBMISSION_READINESS_SECTION_CONTRACTS[section].statuses.includes(status);
}

/**
 * Write-side validation for a full-section replacement. Returns the honest
 * refusal reason, or null when the rows are storable. Requirements: an array of
 * objects, each with a unique non-empty string id, a non-empty name field, and
 * a status inside the section's union.
 */
export function validateSubmissionReadinessRows(
  section: SubmissionReadinessSectionKey,
  rows: unknown,
): string | null {
  if (!Array.isArray(rows)) {
    return `Submission readiness ${section} must be an array of rows.`;
  }
  const contract = SUBMISSION_READINESS_SECTION_CONTRACTS[section];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isObject(row)) return `Submission readiness ${section} row ${i + 1} is not an object.`;
    const id = row.id;
    if (typeof id !== 'string' || !id.trim()) return `Submission readiness ${section} row ${i + 1} has no id. Every register row needs a stable id.`;
    if (seen.has(id)) return `Submission readiness ${section} contains duplicate id "${id}". Row ids must be unique so per-item updates target exactly one row.`;
    seen.add(id);
    const name = row[contract.nameField];
    if (typeof name !== 'string' || !name.trim()) {
      return `Submission readiness ${section} row "${id}" has no ${contract.nameLabel}.`;
    }
    if (!isValidSubmissionReadinessStatus(section, row.status)) {
      return `Submission readiness ${section} row "${id}" has status "${String(row.status)}" which is not one of: ${contract.statuses.join(', ')}.`;
    }
  }
  return null;
}

export function buildTenderSourceAggregate(
  row: TenderSourceRow,
  audit: TenderSourceAuditRecord[] = [],
): TenderSourceAggregate {
  if (!isActiveTenderRow(row, row.id)) {
    throw new Error('Tender aggregate requires an active commercial_tickets Tender row.');
  }

  const typeDetails = objectOrEmpty(row.type_details);
  return {
    identity: {
      sourceRecordId: row.id,
      sourceRecordType: 'tender',
      title: textOrNull(row.ticket_title),
      customerId: textOrNull(row.customer_id),
      customerName: textOrNull(row.customer_name),
      owner: textOrNull(row.owner),
    },
    processState: {
      internalStage: textOrNull(row.internal_stage),
      crmPipelineStage: textOrNull(row.crm_pipeline_stage),
    },
    customerContext: {
      contactName: textOrNull(row.contact_name),
      contactEmail: textOrNull(row.contact_email),
      contactPhone: textOrNull(row.contact_phone),
      company: textOrNull(row.company),
      region: textOrNull(row.region),
      industry: textOrNull(row.industry),
    },
    stageData: projectTenderStageTruth(typeDetails),
    commercialData: {
      estimatedValue: numberOrNull(row.estimated_value),
      targetGpPercent: numberOrNull(row.target_gp_percent),
      probabilityPercent: numberOrNull(row.probability_percent),
      pricing: typeDetails.pricing ?? null,
    },
    documents: arrayOrEmpty(typeDetails.documents),
    evidenceLinks: evidenceFrom(typeDetails),
    drafting: objectOrEmpty(typeDetails.tender_drafting),
    lifecycleMemory: projectTenderLifecycleMemory(typeDetails),
    audit,
    revision: revisionFrom(row),
    typeDetails,
  };
}

export async function readTenderSourceAggregate(
  store: TenderSourceRecordStore,
  tenderId: string,
): Promise<TenderSourceAggregate | null> {
  if (!tenderId.trim()) return null;
  const row = await store.readActiveTender(tenderId);
  if (!row || !isActiveTenderRow(row, tenderId)) return null;
  const audit = await store.listAudit(tenderId);
  return buildTenderSourceAggregate(row, audit);
}

export async function saveTenderSourceRecord(
  store: TenderSourceRecordStore,
  input: SaveTenderSourceRecordInput,
): Promise<SaveTenderSourceRecordResult> {
  const columnPatch = input.columnPatch ?? {};
  const typeDetailsPatch = input.typeDetailsPatch ?? {};
  const changedFieldPaths = input.changedFieldPaths?.length
    ? [...new Set(input.changedFieldPaths)]
    : deriveChangedPaths(columnPatch, typeDetailsPatch);
  const attemptedChanges = { columnPatch, typeDetailsPatch, changedFieldPaths };

  const invalidColumn = validateColumnPatch(columnPatch);
  if (invalidColumn || changedFieldPaths.length === 0) {
    return {
      success: false,
      status: 'invalid_change',
      attemptedChanges,
      auditRecorded: false,
      error: invalidColumn ?? 'At least one changed Tender field path is required.',
    };
  }

  let currentRow: TenderSourceRow | null;
  try {
    currentRow = await store.readActiveTender(input.tenderId);
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      attemptedChanges,
      auditRecorded: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (!currentRow) {
    return {
      success: false,
      status: 'not_found',
      attemptedChanges,
      auditRecorded: false,
      error: 'Active Tender not found. The attempted values remain available for retry.',
    };
  }
  if (!isActiveTenderRow(currentRow, input.tenderId)) {
    return {
      success: false,
      status: 'invalid_identity',
      attemptedChanges,
      auditRecorded: false,
      error: 'The requested record is not the active Tender identity.',
    };
  }

  const previousRevision = revisionFrom(currentRow);
  const expectedRevision = input.expectedRevision ?? previousRevision.token;
  if (expectedRevision !== previousRevision.token) {
    return {
      success: false,
      status: 'stale',
      aggregate: buildTenderSourceAggregate(currentRow),
      previousRevision,
      newRevision: previousRevision,
      attemptedChanges,
      auditRecorded: false,
      warning: 'Tender changed after this edit began. Review the current value and retry without losing your entry.',
    };
  }

  const patch: JsonObject = { ...columnPatch };
  if (Object.keys(typeDetailsPatch).length) {
    patch.type_details = mergeTenderTypeDetails(currentRow.type_details, typeDetailsPatch);
  }

  let update: TenderSourceUpdateResult;
  try {
    update = await store.updateActiveTender({
      tenderId: input.tenderId,
      expectedRevision,
      patch,
    });
  } catch (error) {
    update = { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }

  if (update.status !== 'saved' || !update.row) {
    const latest = update.row && isActiveTenderRow(update.row, input.tenderId)
      ? buildTenderSourceAggregate(update.row)
      : undefined;
    return {
      success: false,
      status: update.status,
      aggregate: latest,
      previousRevision,
      newRevision: latest?.revision,
      attemptedChanges,
      auditRecorded: false,
      warning: update.status === 'stale'
        ? 'Tender changed before save completed. Review the current value and retry without losing your entry.'
        : undefined,
      error: update.error,
    };
  }

  const newRevision = revisionFrom(update.row);
  if (input.recordAudit === false) {
    return {
      success: true,
      status: 'saved',
      aggregate: buildTenderSourceAggregate(update.row),
      previousRevision,
      newRevision,
      attemptedChanges,
      auditRecorded: false,
    };
  }

  let audit: { id?: string; error?: string };
  try {
    audit = await store.insertAudit({
      tenderId: input.tenderId,
      action: auditActionFor(changedFieldPaths),
      changedFieldPaths,
      previousRevision: previousRevision.token,
      newRevision: newRevision.token,
      actorId: input.actor.id,
      actorName: input.actor.name,
      origin: input.origin,
      evidenceIds: input.evidenceIds ?? [],
      suggestionIds: input.suggestionIds ?? [],
      note: input.note,
    });
  } catch (error) {
    audit = { error: error instanceof Error ? error.message : String(error) };
  }

  if (audit.error) {
    return {
      success: true,
      status: 'saved_with_audit_warning',
      aggregate: buildTenderSourceAggregate(update.row),
      previousRevision,
      newRevision,
      attemptedChanges,
      auditRecorded: false,
      warning: `Tender saved, but the audit entry could not be recorded: ${audit.error}`,
    };
  }

  let aggregate: TenderSourceAggregate | null = null;
  try {
    aggregate = await readTenderSourceAggregate(store, input.tenderId);
  } catch {
    // The source and audit writes already succeeded; return the saved row so the UI does not invite a duplicate retry.
  }
  return {
    success: true,
    status: 'saved',
    aggregate: aggregate ?? buildTenderSourceAggregate(update.row),
    previousRevision,
    newRevision,
    attemptedChanges,
    auditRecorded: true,
    auditId: audit.id,
  };
}
