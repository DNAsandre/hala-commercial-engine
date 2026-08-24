/**
 * supabase-tender-actions.ts
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * SUPA-008: Tender Workspace Action Write Layer
 *
 * Write functions:
 *   1. Perform the canonical commercial_tickets update through
 *      saveTenderSourceRecord — read-back confirmed, guarded by an `updated_at`
 *      optimistic token — and report success only once a stored row came back.
 *   2. Append a commercial_ticket_audit row.
 *
 *      TCW-T1 (design pin P3) — the append is AWAITED and confirmed after the
 *      primary write. A failed or unconfirmed audit append never blocks or
 *      reverts the primary save, but it is never silent either: the result
 *      carries status 'saved_with_audit_warning' plus the real reason, so the
 *      caller can render "Saved — audit entry not recorded: <reason>" instead
 *      of plain success.
 *
 *      `createActivityNote` is stricter, because there the audit row IS the
 *      whole payload: an unconfirmed insert is a plain failure.
 *   3. Return { success, error?, status?, auditWarning? }.
 *
 * No production enforcement. No real email. No CRM sync.
 * Legacy tender child tables are read-only/disabled to prevent mock data drift.
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth-state';
import type { TenderDocument } from './tender-workspace-data';
import {
  normalizeTenderPricingData,
  summarizePricingSection,
  type TenderPricingSectionKey,
} from './tender-pricing-types';
import { createSupabaseTenderSourceRecordStore } from './supabase-tender-source-record';
import {
  readTenderSourceAggregate,
  saveTenderSourceRecord,
  isSubmissionReadinessSectionKey,
  isValidSubmissionReadinessStatus,
  validateSubmissionReadinessRows,
  SUBMISSION_READINESS_FACET_KEY,
  SUBMISSION_READINESS_SECTION_CONTRACTS,
  type SubmissionReadinessSectionKey,
  type TenderSaveStatus,
  type TenderSourceAggregate,
} from './tender-source-record';
import { isTenderInternalStageKey } from './tender-stage-source-truth';
import { isRestorableCrmPipelineStage, RESTORABLE_CRM_PIPELINE_STAGES } from './supabase-tender-data';

// â”€â”€â”€ Result type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ActionResult {
  success: boolean;
  error?: string;
  /**
   * TCW-T1: the save-layer outcome, included when it adds information beyond
   * success/error — 'stale' (concurrent edit; retry non-destructively) and
   * 'saved_with_audit_warning' (primary saved; audit append not recorded).
   */
  status?: TenderSaveStatus;
  /**
   * P3: present iff the primary write is confirmed but the audit append is not.
   * `success` stays true — audit history is advisory, never a gate.
   */
  auditWarning?: string;
}

/**
 * TCW-T1 (P2a/P2b): options for the facet writers. For backward compatibility
 * the writers also accept a plain string in this position (the legacy `reason`
 * argument) until T3 moves the call sites to the object form.
 */
export interface TenderFacetWriteOpts {
  /** The `updated_at` revision the caller read; stale → non-destructive refusal. */
  expectedRevision?: string;
  /** Override the audited actor name (defaults to the session user). */
  actorName?: string;
  /** Free-text reason recorded in the audit note. */
  reason?: string;
}

function resolveWriteOpts(reasonOrOpts: string | TenderFacetWriteOpts | undefined): Required<Pick<TenderFacetWriteOpts, 'reason'>> & Omit<TenderFacetWriteOpts, 'reason'> {
  if (typeof reasonOrOpts === 'string') return { reason: reasonOrOpts };
  return { reason: reasonOrOpts?.reason ?? '', expectedRevision: reasonOrOpts?.expectedRevision, actorName: reasonOrOpts?.actorName };
}

// â”€â”€â”€ Internal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * P4 — actor truth. `getCurrentUser()` is total: signed-out callers receive the
 * auth-state module's own honest literal ("Unauthenticated"), never a
 * fabricated "System"/"admin".
 */
function actor() {
  const u = getCurrentUser();
  return { userId: u?.id ?? 'anonymous', userName: u?.name ?? 'Unauthenticated' };
}

const tenderSourceRecordStore = createSupabaseTenderSourceRecordStore(supabase);

function disabledLegacyTenderChildWrite(area: string): ActionResult {
  return {
    success: false,
    error: `${area} is disabled until it is rebuilt on verified commercial_tickets lineage. Legacy tender child tables must not be repopulated.`,
  };
}

function auditActionFor(fieldChanged: string): 'updated' | 'stage_changed' {
  return fieldChanged.includes('stage') || fieldChanged.includes('phase') ? 'stage_changed' : 'updated';
}

interface CanonicalTenderAuditParams {
  tenderId: string;
  fieldChanged: string;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
  /** P4: defaults to the session user; an explicit name is used verbatim. */
  actorName?: string;
}

/** The exact row shape both the awaited and the confirmed-note path insert. */
function buildCanonicalTenderAuditRow(params: CanonicalTenderAuditParams): Record<string, any> {
  const { userName } = actor();
  return {
    ticket_id: params.tenderId,
    action: auditActionFor(params.fieldChanged),
    field_changed: params.fieldChanged,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    user_name: params.actorName?.trim() ? params.actorName : userName,
    notes: params.notes ?? null,
  };
}

type AuditAppendOutcome = { recorded: true } | { recorded: false; reason: string };

/**
 * P3 — awaited, confirmed audit append. Runs ONLY after the primary write is
 * confirmed. The stored id is selected back; an error, a zero-row insert, or a
 * timeout is reported as an honest reason for the caller's
 * 'saved_with_audit_warning' — never as silence, and never as a blocker for
 * the already-saved primary write.
 */
async function appendConfirmedTenderAudit(params: CanonicalTenderAuditParams): Promise<AuditAppendOutcome> {
  const timeoutMs = 8000;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<AuditAppendOutcome>(resolve => {
    timeoutHandle = setTimeout(
      () => resolve({
        recorded: false,
        reason: `the audit append did not respond within ${timeoutMs / 1000}s; the audit row may or may not exist`,
      }),
      timeoutMs,
    );
  });

  const insert = (async (): Promise<AuditAppendOutcome> => {
    try {
      const { data, error } = await supabase
        .from('commercial_ticket_audit')
        .insert(buildCanonicalTenderAuditRow(params))
        .select('id')
        .maybeSingle();
      if (error) return { recorded: false, reason: error.message };
      if (!data || !(data as any).id) {
        return { recorded: false, reason: 'commercial_ticket_audit returned no stored row (possible RLS block)' };
      }
      return { recorded: true };
    } catch (error) {
      return { recorded: false, reason: error instanceof Error ? error.message : String(error) };
    }
  })();

  const outcome = await Promise.race([insert, timeout]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  return outcome;
}

/**
 * P3 — translate a confirmed primary save + audit outcome into the ActionResult
 * the caller renders. Audit failure never blocks the primary save.
 */
function savedWithAuditOutcome(audit: AuditAppendOutcome): ActionResult {
  return audit.recorded
    ? { success: true }
    : {
        success: true,
        status: 'saved_with_audit_warning',
        auditWarning: `Saved, but the audit entry was not recorded: ${audit.reason}`,
      };
}

/**
 * W04-C4 — confirmed audit append.
 *
 * Used where the audit row is not a side note but the ENTIRE payload of the
 * user's action (an activity note). The insert is awaited and the stored id is
 * selected back, so success is a statement about the database rather than about
 * a request having been issued.
 */
async function writeCanonicalTenderAuditConfirmed(
  params: CanonicalTenderAuditParams,
): Promise<ActionResult> {
  const { data, error } = await supabase
    .from('commercial_ticket_audit')
    .insert(buildCanonicalTenderAuditRow(params))
    .select('id')
    .maybeSingle();

  if (error) {
    return { success: false, error: `Not saved to commercial_ticket_audit: ${error.message}` };
  }
  if (!data || !(data as any).id) {
    return {
      success: false,
      error:
        'The request completed but commercial_ticket_audit returned no stored row, so the note is not confirmed saved. It may have been blocked by row-level security.',
    };
  }
  return { success: true };
}

interface CanonicalWriteOutcome {
  handled: boolean;
  error?: string;
  /** The save-layer status (e.g. 'stale') so callers can offer a non-destructive retry. */
  status?: TenderSaveStatus;
  /** The confirmed post-write aggregate — the read-back the caller compares against. */
  aggregate?: TenderSourceAggregate;
}

function saveActor(actorName?: string): { id: string; name: string } {
  const currentActor = actor();
  return { id: currentActor.userId, name: actorName?.trim() ? actorName : currentActor.userName };
}

async function updateCanonicalTenderTicket(
  tenderId: string,
  patch: Record<string, any>,
): Promise<CanonicalWriteOutcome> {
  const result = await saveTenderSourceRecord(tenderSourceRecordStore, {
    tenderId,
    columnPatch: patch,
    actor: saveActor(),
    origin: 'manual',
    recordAudit: false,
  });

  if (result.status === 'not_found' || result.status === 'invalid_identity') {
    return {
      handled: true,
      status: result.status,
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }
  return result.success
    ? { handled: true, status: result.status, aggregate: result.aggregate }
    : { handled: true, status: result.status, error: result.warning ?? result.error ?? 'Tender save failed.' };
}

async function mergeCanonicalTenderDetails(
  tenderId: string,
  detailsPatch: Record<string, any>,
  ticketPatch: Record<string, any> = {},
): Promise<CanonicalWriteOutcome> {
  const result = await saveTenderSourceRecord(tenderSourceRecordStore, {
    tenderId,
    columnPatch: ticketPatch,
    typeDetailsPatch: detailsPatch,
    actor: saveActor(),
    origin: 'manual',
    recordAudit: false,
  });

  if (result.status === 'not_found' || result.status === 'invalid_identity') {
    return {
      handled: true,
      status: result.status,
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }
  return result.success
    ? { handled: true, status: result.status, aggregate: result.aggregate }
    : { handled: true, status: result.status, error: result.warning ?? result.error ?? 'Tender save failed.' };
}

async function mergeCanonicalTenderFacet(
  tenderId: string,
  facet: string,
  section: string,
  sectionData: unknown,
  normalizeFacet: (value: unknown) => Record<string, any> = value =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {},
  expectedRevision?: string,
  actorName?: string,
): Promise<CanonicalWriteOutcome> {
  let aggregate;
  try {
    aggregate = await readTenderSourceAggregate(tenderSourceRecordStore, tenderId);
  } catch (error) {
    return { handled: true, status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }

  if (!aggregate) {
    return {
      handled: true,
      status: 'not_found',
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }

  const currentFacet = normalizeFacet(aggregate.typeDetails[facet]);
  const result = await saveTenderSourceRecord(tenderSourceRecordStore, {
    tenderId,
    expectedRevision: expectedRevision ?? aggregate.revision.token,
    typeDetailsPatch: {
      [facet]: {
        ...currentFacet,
        [section]: sectionData,
      },
    },
    changedFieldPaths: [`type_details.${facet}.${section}`],
    actor: saveActor(actorName),
    origin: 'manual',
    recordAudit: false,
  });

  return result.success
    ? { handled: true, status: result.status, aggregate: result.aggregate }
    : { handled: true, status: result.status, error: result.warning ?? result.error ?? 'Tender save failed.' };
}

/**
 * TCW-T1 (P2a/P2b) — whole-facet PATCH-MERGE. The stored facet is read first
 * and the caller's patch is spread over it: `{ ...currentFacet, ...patch }`.
 * A tab therefore sends ONLY its own keys and can never clobber a sibling
 * tab's keys inside the same facet, nor any other type_details key.
 */
async function patchCanonicalTenderFacet(
  tenderId: string,
  facet: string,
  patch: Record<string, any>,
  opts: { expectedRevision?: string; actorName?: string } = {},
): Promise<CanonicalWriteOutcome> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
    return { handled: true, status: 'invalid_change', error: `A non-empty ${facet} patch object is required.` };
  }

  let aggregate;
  try {
    aggregate = await readTenderSourceAggregate(tenderSourceRecordStore, tenderId);
  } catch (error) {
    return { handled: true, status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }

  if (!aggregate) {
    return {
      handled: true,
      status: 'not_found',
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }

  const rawFacet = aggregate.typeDetails[facet];
  const currentFacet = rawFacet && typeof rawFacet === 'object' && !Array.isArray(rawFacet)
    ? rawFacet as Record<string, any>
    : {};

  const result = await saveTenderSourceRecord(tenderSourceRecordStore, {
    tenderId,
    expectedRevision: opts.expectedRevision ?? aggregate.revision.token,
    typeDetailsPatch: {
      [facet]: { ...currentFacet, ...patch },
    },
    changedFieldPaths: Object.keys(patch).map(key => `type_details.${facet}.${key}`),
    actor: saveActor(opts.actorName),
    origin: 'manual',
    recordAudit: false,
  });

  return result.success
    ? { handled: true, status: result.status, aggregate: result.aggregate }
    : { handled: true, status: result.status, error: result.warning ?? result.error ?? 'Tender save failed.' };
}

async function updateTenderDocumentList(
  tenderId: string,
  updater: (documents: TenderDocument[]) => TenderDocument[] | null,
): Promise<{ handled: boolean; error?: string; status?: TenderSaveStatus; before: TenderDocument[]; after: TenderDocument[] }> {
  let aggregate;
  try {
    aggregate = await readTenderSourceAggregate(tenderSourceRecordStore, tenderId);
  } catch (error) {
    return {
      handled: true,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      before: [],
      after: [],
    };
  }

  if (!aggregate) {
    return {
      handled: true,
      status: 'not_found',
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
      before: [],
      after: [],
    };
  }

  const before = Array.isArray(aggregate.typeDetails.documents)
    ? aggregate.typeDetails.documents as TenderDocument[]
    : [];
  const after = updater(before);
  if (after === null) {
    return {
      handled: true,
      status: 'not_found',
      error: 'The document is not recorded on this tender. Nothing was changed.',
      before,
      after: before,
    };
  }
  const result = await saveTenderSourceRecord(tenderSourceRecordStore, {
    tenderId,
    expectedRevision: aggregate.revision.token,
    typeDetailsPatch: { documents: after },
    changedFieldPaths: ['type_details.documents'],
    actor: saveActor(),
    origin: 'manual',
    recordAudit: false,
  });

  return result.success
    ? { handled: true, status: result.status, before, after }
    : { handled: true, status: result.status, error: result.warning ?? result.error ?? 'Tender save failed.', before, after };
}

/**
 * P3 — the human-readable activity entry every writer appends AFTER its primary
 * write is confirmed. Same pipe-format notes shape the Activity tab has always
 * rendered ("Title | description | Reason: …"). The append is awaited and its
 * outcome is returned so the caller reports 'saved_with_audit_warning' when the
 * history row is missing. (Replaces the fire-and-forget `_insertActivityEvent`
 * and the deleted no-op `_insertAuditEvent`.)
 */
async function appendActivityAudit(params: {
  tenderId: string;
  actionType: string;
  title: string;
  description: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  actorName?: string;
}): Promise<AuditAppendOutcome> {
  return appendConfirmedTenderAudit({
    tenderId: params.tenderId,
    fieldChanged: params.actionType,
    oldValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    actorName: params.actorName,
    notes: [params.title, params.description, params.reason ? `Reason: ${params.reason}` : null]
      .filter(Boolean)
      .join(' | '),
  });
}

// â”€â”€â”€ Public write functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * 1. Update tender phase (stage movement)
 */
export async function updateTenderPhase(
  tenderId: string,
  previousPhase: string,
  newPhase: string,
  reason: string = '',
): Promise<ActionResult> {
  if (!isTenderInternalStageKey(newPhase)) {
    return { success: false, error: `Unknown Tender stage: ${newPhase}` };
  }
  const canonical = await updateCanonicalTenderTicket(tenderId, { internal_stage: newPhase });
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'stage_change',
    title: 'Tender Stage Change',
    description: `Phase changed from "${previousPhase}" to "${newPhase}". ${reason}`.trim(),
    previousValue: previousPhase,
    newValue: newPhase,
    reason,
  }));
}

/**
 * 1b. Update CRM Pipeline Stage (TND-003)
 *
 * Writes ONLY to commercial_tickets.crm_pipeline_stage.
 * Does NOT touch internal_stage.
 * These are completely independent fields â€” do not auto-sync.
 *
 * TCW-T1 (P2d): the value is validated against the read layer's round-trip
 * (`isRestorableCrmPipelineStage`) BEFORE any write. Persisting a key the read
 * layer coerces to a different stage would produce a "successful" save the
 * workspace then displays as another stage — that is refused with the honest
 * reason instead.
 */
export async function updateTenderCrmStage(
  tenderId: string,
  previousStage: string,
  newStage: string,
  reason: string = '',
): Promise<ActionResult> {
  if (!isRestorableCrmPipelineStage(newStage)) {
    return {
      success: false,
      error:
        `CRM pipeline stage "${newStage}" was not saved: the read layer cannot restore that value, so the workspace ` +
        `would reload it as a different stage than the one stored. Storable stages: ${RESTORABLE_CRM_PIPELINE_STAGES.join(', ')}.`,
    };
  }

  const canonical = await updateCanonicalTenderTicket(tenderId, { crm_pipeline_stage: newStage });
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'crm_stage_change',
    title: 'CRM Pipeline Stage Change',
    description: `CRM Pipeline stage changed from "${previousStage}" to "${newStage}". ${reason}`.trim(),
    previousValue: previousStage,
    newValue: newStage,
    reason,
  }));
}

/**
 * 1c. Update tender probability (initial win probability estimate)
 */
export async function updateTenderProbability(
  tenderId: string,
  previousProbability: number,
  newProbability: number,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await updateCanonicalTenderTicket(tenderId, { probability_percent: newProbability });
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'probability_change',
    title: 'Win Probability Updated',
    description: `Initial win probability changed from ${previousProbability}% to ${newProbability}%. ${reason}`.trim(),
    previousValue: String(previousProbability),
    newValue: String(newProbability),
    reason,
  }));
}

/**
 * 1d. Update tender assigned team members
 */
export async function updateTenderTeamMembers(
  tenderId: string,
  owner: string,
  teamMembers: string[],
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await updateCanonicalTenderTicket(tenderId, { owner, team_members: teamMembers });
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'team_assignment_change',
    title: 'Tender Team Updated',
    description: `Ownership assigned to "${owner}". Team members: ${teamMembers.join(', ') || 'none'}. ${reason}`.trim(),
    reason,
  }));
}


/**
 * 1e. Update tender execution scope (operational delivery geography)
 *
 * Persists all 6 execution scope fields atomically:
 * - execution_regions, target_sites, execution_type,
 * - geographic_complexity, site_count, execution_notes
 *
 * This data is manually captured from RFQ / SOW / tender documents.
 * It is separate from CRM region (business geography).
 */
export async function updateTenderExecutionScope(
  tenderId: string,
  fields: {
    executionRegions: string[];
    targetSites: { name: string; type: string }[];
    executionType: string;
    geographicComplexity: string;
    siteCount: number;
    executionNotes: string;
  },
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    {
      execution_regions: fields.executionRegions,
      target_sites: fields.targetSites,
      execution_type: fields.executionType,
      geographic_complexity: fields.geographicComplexity,
      site_count: fields.siteCount,
      execution_notes: fields.executionNotes,
    },
    { notes: fields.executionNotes },
  );
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const summary = [
    fields.executionRegions.length ? `Regions: ${fields.executionRegions.join(', ')}` : null,
    fields.targetSites.length ? `Sites: ${fields.targetSites.map(s => s.name).join(', ')}` : null,
    fields.executionType ? `Type: ${fields.executionType}` : null,
    fields.geographicComplexity ? `Complexity: ${fields.geographicComplexity}` : null,
    fields.siteCount ? `Site count: ${fields.siteCount}` : null,
  ].filter(Boolean).join(' Â· ') || 'Execution scope cleared';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'execution_scope_update',
    title: 'Tender Execution Scope Updated',
    description: `${summary}. ${reason}`.trim(),
    reason,
  }));
}


/**
 * 1f. Update tender Scope of Work data (structured SOW capture)
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.sow_data — the stored facet is
 * read first and `{ ...currentFacet, ...patch }` is written, so the caller
 * sends only the keys it owns and never whole-replaces the facet. The third
 * argument accepts the legacy reason string OR TenderFacetWriteOpts
 * ({ expectedRevision, actorName?, reason? }).
 *
 * Does NOT auto-create scope/SLA snapshots.
 * Does NOT mutate discontinued document tooling or composer blocks.
 * Snapshot creation requires an explicit future user action.
 */
export async function updateTenderSowData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'sow_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const serviceLines = Array.isArray(patch.service_lines) ? patch.service_lines : [];
  const summary = [
    serviceLines.length ? `${serviceLines.length} service lines` : null,
    patch.scope_summary ? 'Summary captured' : null,
    Array.isArray(patch.sla_kpis) && patch.sla_kpis.length ? `${patch.sla_kpis.length} KPIs` : null,
    Array.isArray(patch.sites) && patch.sites.length ? `${patch.sites.length} sites` : null,
  ].filter(Boolean).join(' Â· ') || 'Scope of Work updated';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'sow_update',
    title: 'Scope of Work Updated',
    description: `${summary}. ${opts.reason}`.trim(),
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}


/**
 * 1g. Update tender Customer Fit Qualification data
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.customer_fit_data (see
 * updateTenderSowData for the shared contract).
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, document-output tooling, or any other type_details key.
 */
export async function updateTenderCustomerFitData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'customer_fit_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const dims = Array.isArray(patch.dimensions) ? patch.dimensions : [];
  const assessed = dims.filter((d: any) => d.assessment && d.assessment !== 'Not Assessed').length;
  const summary = [
    assessed > 0 ? `${assessed}/${dims.length} dimensions assessed` : null,
    patch.recommendation?.outcome && patch.recommendation.outcome !== 'Not decided'
      ? `Recommendation: ${patch.recommendation.outcome}` : null,
    Array.isArray(patch.evidence) && patch.evidence.length
      ? `${patch.evidence.length} evidence items` : null,
    Array.isArray(patch.gaps) && patch.gaps.length
      ? `${patch.gaps.length} gaps` : null,
  ].filter(Boolean).join(' · ') || 'Customer Fit Qualification updated';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'customer_fit_update',
    title: 'Customer Fit Qualification Updated',
    description: `${summary}. ${opts.reason}`.trim(),
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}


/**
 * 1h. Update tender SOW Qualification data
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.sow_qualification_data (see
 * updateTenderSowData for the shared contract).
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, customer_fit_data, document-output tooling, or any other type_details key.
 */
export async function updateTenderSowQualificationData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'sow_qualification_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const matrix = Array.isArray(patch.coverage_matrix) ? patch.coverage_matrix : [];
  const assessed = matrix.filter((r: any) => r.status && r.status !== 'Not Assessed').length;
  const clarifications = Array.isArray(patch.clarifications) ? patch.clarifications.length : 0;
  const summary = [
    assessed > 0 ? `${assessed}/${matrix.length} areas assessed` : null,
    clarifications > 0 ? `${clarifications} clarification questions` : null,
    patch.outcome?.recommendation && patch.outcome.recommendation !== 'Not decided'
      ? `Recommendation: ${patch.outcome.recommendation}` : null,
  ].filter(Boolean).join(' · ') || 'SOW Qualification updated';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'sow_qualification_update',
    title: 'SOW Qualification Updated',
    description: `${summary}. ${opts.reason}`.trim(),
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}


/**
 * 1i. Update tender Technical Qualification data
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.technical_qualification_data
 * (see updateTenderSowData for the shared contract).
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, customer_fit_data, sow_qualification_data, document-output tooling, or any other type_details key.
 */
export async function updateTenderTechnicalQualificationData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'technical_qualification_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const caps = Array.isArray(patch.capability_assessment) ? patch.capability_assessment : [];
  const assessed = caps.filter((r: any) => r.fit && r.fit !== 'Not Assessed').length;
  const gaps = Array.isArray(patch.gaps) ? patch.gaps.length : 0;
  const clarifications = Array.isArray(patch.clarifications) ? patch.clarifications.length : 0;
  const summary = [
    assessed > 0 ? `${assessed}/${caps.length} capabilities assessed` : null,
    gaps > 0 ? `${gaps} technical gaps` : null,
    clarifications > 0 ? `${clarifications} clarifications` : null,
    patch.recommendation?.outcome && patch.recommendation.outcome !== 'Not decided'
      ? `Recommendation: ${patch.recommendation.outcome}` : null,
  ].filter(Boolean).join(' · ') || 'Technical Qualification updated';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'technical_qualification_update',
    title: 'Technical Qualification Updated',
    description: `${summary}. ${opts.reason}`.trim(),
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}


/**
 * 1j. Update tender Risk Snapshot data
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.risk_snapshot_data (see
 * updateTenderSowData for the shared contract).
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, customer_fit_data, sow_qualification_data,
 * technical_qualification_data, document-output tooling, or any other type_details key.
 */
export async function updateTenderRiskSnapshotData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'risk_snapshot_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const register = Array.isArray(patch.register) ? patch.register : [];
  const critical = register.filter((r: any) => r.severity === 'Critical').length;
  const high = register.filter((r: any) => r.severity === 'High').length;
  const bidBlockers = register.filter((r: any) => r.bid_blocker).length;
  const summary = [
    register.length > 0 ? `${register.length} risks` : null,
    critical > 0 ? `${critical} critical` : null,
    high > 0 ? `${high} high` : null,
    bidBlockers > 0 ? `${bidBlockers} bid blockers` : null,
    patch.recommendation?.outcome && patch.recommendation.outcome !== 'Not decided'
      ? `Recommendation: ${patch.recommendation.outcome}` : null,
  ].filter(Boolean).join(' · ') || 'Risk Snapshot updated';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'risk_snapshot_update',
    title: 'Risk Snapshot Updated',
    description: `${summary}. ${opts.reason}`.trim(),
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}


/**
 * 1k. Update tender Bid / No-Bid data
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.bid_no_bid_data (see
 * updateTenderSowData for the shared contract). Tab key map: decision +
 * decision_checklist + recommendation | win_strategy | resource_commitment |
 * decision_record — each tab sends ONLY its own keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, qualification data, risk data, document-output tooling, or any other type_details key.
 */
export async function updateTenderBidNoBidData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'bid_no_bid_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const decision = patch.decision?.decision || patch.decision_record?.decision || '';
  const summary = [
    decision && decision !== 'Not Decided' ? `Decision: ${decision}` : null,
    patch.recommendation?.next_step && patch.recommendation.next_step !== 'Not Decided'
      ? `Next: ${patch.recommendation.next_step}` : null,
    Array.isArray(patch.win_strategy?.win_themes) && patch.win_strategy.win_themes.length > 0
      ? `${patch.win_strategy.win_themes.length} win themes` : null,
  ].filter(Boolean).join(' · ') || 'Bid / No-Bid data updated';

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'bid_no_bid_update',
    title: 'Bid / No-Bid Updated',
    description: `${summary}. ${opts.reason}`.trim(),
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}


/**
 * 1l. Update tender Solution Design data
 *
 * TCW-T1 (P2b): PATCH-MERGE into type_details.solution_design_data (see
 * updateTenderSowData for the shared contract). Tab key map: configuration |
 * hop | ham | hip | scope_matrix | sla_kpi | assumptions_dependencies — each
 * tab sends ONLY its own keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, qualification data, risk data, bid_no_bid_data, document-output tooling,
 * or any other type_details key.
 */
export async function updateTenderSolutionDesignData(
  tenderId: string,
  patch: Record<string, any>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  const canonical = await patchCanonicalTenderFacet(tenderId, 'solution_design_data', patch, opts);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const patchedKeys = Object.keys(patch);
  const summary = `Solution Design updated (${patchedKeys.join(', ') || 'no sections'}). ${opts.reason}`.trim();

  return savedWithAuditOutcome(await appendActivityAudit({
    tenderId,
    actionType: 'solution_design_update',
    title: 'Solution Design Updated',
    description: summary,
    reason: opts.reason,
    actorName: opts.actorName,
  }));
}

/**
 * 1m. Update tender P&L / Pricing data
 *
 * Persists one section inside type_details.pricing.
 * Uses MERGE behavior - only patches the requested pricing section without
 * overwriting other pricing tabs or any non-pricing type_details keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch solution design, qualification data, documents, document-output tooling,
 * or any document/composer records.
 */
export async function updateTenderPricingData(
  tenderId: string,
  section: TenderPricingSectionKey,
  sectionData: Record<string, any>,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(
    tenderId,
    'pricing',
    section,
    sectionData,
    value => normalizeTenderPricingData(value) as unknown as Record<string, any>,
    expectedRevision,
  );
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  const summary = summarizePricingSection(section, sectionData);
  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `pricing.${section}`,
    newValue: summary,
    notes: `P&L / Pricing updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * 1n. Update tender Tender Drafting data
 *
 * Persists one section inside type_details.tender_drafting.
 * Uses MERGE behavior — only patches the requested section without
 * overwriting other tender_drafting tabs or any non-drafting type_details keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch pricing, solution design, qualification data, documents,
 * document-output tooling, doc_instances, or any prior-stage data.
 */
export async function updateTenderDraftingData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(
    tenderId,
    'tender_drafting',
    section,
    sectionData,
    undefined,
    expectedRevision,
  );
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderDraftingData] Successfully updated tender_drafting.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `tender_drafting.${section}`,
    newValue: `${section} updated`,
    notes: `Tender Drafting updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

export async function updateTenderApprovalMatrixData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'approval_matrix', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `approval_matrix.${section}`,
    newValue: `${section} updated`,
    notes: `Approval Matrix updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

export async function updateTenderFinalApprovedData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'final_approved', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `final_approved.${section}`,
    newValue: `${section} updated`,
    notes: `Final approval facts updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * Update submission-stage data (type_details.submission.{section}).
 * Sections: submission_record, submitted_version, crm_sync
 */
export async function updateTenderSubmissionData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'submission', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderSubmissionData] Successfully updated submission.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `submission.${section}`,
    newValue: `${section} updated`,
    notes: `Submission data updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * Update identified-stage data (type_details.identified.{section}).
 * Sections: intake_file_audit, document_review, compliance_matrix_notes, clarification_log
 *
 * Does NOT move tender stage. Does NOT touch qualification, clarification, client evaluation,
 * pricing, drafting, submission, negotiation, awarded, or lost/withdrawn buckets.
 */
export async function updateTenderIdentifiedData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'identified', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `identified.${section}`,
    newValue: `${section} updated`,
    notes: `Identified stage updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * Update client evaluation data (type_details.client_evaluation.{section}).
 * Sections: request_log, client_clarifications, bafo, margin_impact, evaluation_status
 */
export async function updateTenderClientEvaluationData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'client_evaluation', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderClientEvaluationData] Successfully updated client_evaluation.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `client_evaluation.${section}`,
    newValue: `${section} updated`,
    notes: `Client evaluation updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * Update clarification stage data (type_details.clarification.{section}).
 * Sections: qa_log, response, margin_impact, status
 *
 * Completely isolated from client_evaluation — separate data bucket.
 * Does NOT move tender stage. Does NOT touch any other type_details key.
 */
export async function updateTenderClarificationData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'clarification', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderClarificationData] Successfully updated clarification.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `clarification.${section}`,
    newValue: `${section} updated`,
    notes: `Clarification updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * Update negotiation data (type_details.negotiation_data.{section}).
 * Sections: negotiation_log, requested_changes, margin_impact, revised_terms
 */
export async function updateTenderNegotiationData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'negotiation_data', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderNegotiationData] Successfully updated negotiation_data.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `negotiation_data.${section}`,
    newValue: `${section} updated`,
    notes: `Negotiation updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

/**
 * Update awarded stage data (type_details.awarded_data.{section}).
 * Sections: award_notice, contract_prep, sla_prep, handover
 */
export async function updateTenderAwardedData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'awarded_data', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderAwardedData] Updated awarded_data.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `awarded_data.${section}`,
    newValue: `${section} updated`,
    notes: `Award stage updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

export async function updateTenderLostWithdrawnData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
  expectedRevision?: string,
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderFacet(tenderId, 'lost_withdrawn_data', section, sectionData, undefined, expectedRevision);
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  console.log(`[updateTenderLostWithdrawnData] Updated lost_withdrawn_data.${section} for tender ${tenderId}`);

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `lost_withdrawn_data.${section}`,
    newValue: `${section} updated`,
    notes: `Lost/Withdrawn stage updated | ${section}${reason ? ` | ${reason}` : ''}`,
  }));
}

export async function addTenderDocument(
  tenderId: string,
  document: TenderDocument,
): Promise<ActionResult> {
  const canonical = await updateTenderDocumentList(tenderId, documents => {
    const withoutDuplicate = documents.filter(doc => doc.id !== document.id);
    return [...withoutDuplicate, document];
  });
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: 'documents',
    oldValue: String(canonical.before.length),
    newValue: String(canonical.after.length),
    notes: `Document uploaded | ${document.document_name} | ${document.document_category}`,
  }));
}

export async function updateTenderDocumentMetadata(
  tenderId: string,
  documentId: string,
  patch: Partial<TenderDocument>,
): Promise<ActionResult> {
  let documentName = '';
  const canonical = await updateTenderDocumentList(tenderId, documents => documents.map(doc => {
    if (doc.id !== documentId) return doc;
    documentName = patch.document_name ?? doc.document_name;
    return { ...doc, ...patch, id: doc.id, tender_id: doc.tender_id || tenderId };
  }));
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: 'documents',
    oldValue: documentId,
    newValue: documentName || documentId,
    notes: `Document metadata updated | ${documentName || documentId}`,
  }));
}

export async function changeTenderDocumentStatus(
  tenderId: string,
  documentId: string,
  status: TenderDocument['status'],
): Promise<ActionResult> {
  let previousStatus = '';
  let documentName = '';
  const canonical = await updateTenderDocumentList(tenderId, documents => documents.map(doc => {
    if (doc.id !== documentId) return doc;
    previousStatus = doc.status;
    documentName = doc.document_name;
    return { ...doc, status };
  }));
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: 'documents.status',
    oldValue: previousStatus,
    newValue: status,
    notes: `Document status changed | ${documentName || documentId}`,
  }));
}

export async function markTenderDocumentSuperseded(
  tenderId: string,
  documentId: string,
): Promise<ActionResult> {
  return changeTenderDocumentStatus(tenderId, documentId, 'Superseded');
}

/**
 * Archive one document from the Tender library. The row stays recoverable in
 * the canonical documents list; ordinary Tender views omit Archived entries.
 */
export async function archiveTenderDocument(
  tenderId: string,
  documentId: string,
): Promise<ActionResult> {
  let documentName = '';
  const canonical = await updateTenderDocumentList(tenderId, documents => {
    const existing = documents.find(doc => doc.id === documentId);
    if (!existing) return null;
    documentName = existing.document_name;
    return documents.map(doc => doc.id === documentId
      ? { ...doc, document_category: 'Archived' as const }
      : doc);
  });
  if (canonical.error) return { success: false, status: canonical.status, error: canonical.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: 'documents.category',
    oldValue: 'active',
    newValue: 'Archived',
    notes: `Document archived | ${documentName || documentId}`,
  }));
}


// ─── Submission Readiness register (TCW-T1, design pin P1) ────
//
// The three registers live in ONE canonical facet on the tender row:
// `type_details.submission_readiness` with sections `placeholders[]`,
// `required_documents[]`, `compliance_items[]`. Full-row CRUD goes through the
// section writer below; the three per-item status operations mutate exactly ONE
// row by its exact id. Everything goes through the guarded store
// (saveTenderSourceRecord) with `updated_at` revision protection, is read-back
// confirmed, and reports a zero-row update as an honest failure.
// The register is INFORMATIONAL: nothing here gates stage movement.

interface SubmissionReadinessReadForWrite {
  ok: boolean;
  status?: TenderSaveStatus;
  error?: string;
  aggregate?: TenderSourceAggregate;
  /** The stored facet VERBATIM — sibling sections and unknown keys byte-preserved on write. */
  rawFacet: Record<string, any>;
  rawRows: (section: SubmissionReadinessSectionKey) => any[];
}

async function readSubmissionReadinessForWrite(tenderId: string): Promise<SubmissionReadinessReadForWrite> {
  const empty = { rawFacet: {}, rawRows: () => [] as any[] };
  let aggregate;
  try {
    aggregate = await readTenderSourceAggregate(tenderSourceRecordStore, tenderId);
  } catch (error) {
    return { ok: false, status: 'failed', error: error instanceof Error ? error.message : String(error), ...empty };
  }
  if (!aggregate) {
    return {
      ok: false,
      status: 'not_found',
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
      ...empty,
    };
  }
  const raw = aggregate.typeDetails[SUBMISSION_READINESS_FACET_KEY];
  const rawFacet = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, any> : {};
  return {
    ok: true,
    aggregate,
    rawFacet,
    rawRows: section => (Array.isArray(rawFacet[section]) ? rawFacet[section] as any[] : []),
  };
}

/**
 * Write one section of the facet and CONFIRM the stored rows before reporting
 * success: every written row must come back (by exact id) with the same status
 * and name field, and no extra rows may appear.
 */
async function persistSubmissionReadinessSection(args: {
  tenderId: string;
  section: SubmissionReadinessSectionKey;
  nextRows: Record<string, any>[];
  rawFacet: Record<string, any>;
  expectedRevision: string;
  actorName?: string;
}): Promise<{ ok: true } | { ok: false; status?: TenderSaveStatus; error: string }> {
  const result = await saveTenderSourceRecord(tenderSourceRecordStore, {
    tenderId: args.tenderId,
    expectedRevision: args.expectedRevision,
    typeDetailsPatch: {
      [SUBMISSION_READINESS_FACET_KEY]: { ...args.rawFacet, [args.section]: args.nextRows },
    },
    changedFieldPaths: [`type_details.${SUBMISSION_READINESS_FACET_KEY}.${args.section}`],
    actor: saveActor(args.actorName),
    origin: 'manual',
    recordAudit: false,
  });

  if (!result.success) {
    return { ok: false, status: result.status, error: result.warning ?? result.error ?? 'Tender save failed.' };
  }

  // Read-back comparison against the CONFIRMED stored row the update returned.
  const storedFacetRaw = result.aggregate?.typeDetails?.[SUBMISSION_READINESS_FACET_KEY];
  const storedFacet = storedFacetRaw && typeof storedFacetRaw === 'object' && !Array.isArray(storedFacetRaw)
    ? storedFacetRaw as Record<string, any>
    : {};
  const storedRows: any[] = Array.isArray(storedFacet[args.section]) ? storedFacet[args.section] : [];
  const nameField = SUBMISSION_READINESS_SECTION_CONTRACTS[args.section].nameField;

  const mismatch = storedRows.length !== args.nextRows.length
    || args.nextRows.some(written => {
      const stored = storedRows.find(row => row && typeof row === 'object' && row.id === written.id);
      return !stored || stored.status !== written.status || stored[nameField] !== written[nameField];
    });
  if (mismatch) {
    return {
      ok: false,
      status: 'failed',
      error: `The save completed but the stored ${args.section} read back differently than what was written. Reload before retrying.`,
    };
  }
  return { ok: true };
}

/**
 * 3a. Submission Readiness — full-section writer (P1).
 *
 * Replaces the rows of ONE section (`placeholders` | `required_documents` |
 * `compliance_items`) inside type_details.submission_readiness. Sibling
 * sections and every other type_details key are preserved verbatim. Rows are
 * validated (unique non-empty ids, name field, status inside the section's
 * union) and stamped with updated_at / updated_by where the caller did not
 * provide them. Read-back confirmed; zero-row update = honest failure;
 * `expectedRevision` refusal is non-destructive ('stale').
 */
export async function updateTenderSubmissionReadinessData(
  tenderId: string,
  section: SubmissionReadinessSectionKey,
  sectionRows: Array<Record<string, any>>,
  reasonOrOpts: string | TenderFacetWriteOpts = '',
): Promise<ActionResult> {
  const opts = resolveWriteOpts(reasonOrOpts);
  if (!isSubmissionReadinessSectionKey(section)) {
    return { success: false, error: `Unknown submission readiness section: ${String(section)}.` };
  }
  const invalid = validateSubmissionReadinessRows(section, sectionRows);
  if (invalid) return { success: false, error: invalid };

  const read = await readSubmissionReadinessForWrite(tenderId);
  if (!read.ok || !read.aggregate) return { success: false, status: read.status, error: read.error };

  const { userName } = actor();
  const stampedBy = opts.actorName?.trim() ? opts.actorName : userName;
  const nowIso = new Date().toISOString();
  const nextRows = sectionRows.map(row => ({
    ...row,
    updated_at: typeof row.updated_at === 'string' && row.updated_at.trim() ? row.updated_at : nowIso,
    updated_by: typeof row.updated_by === 'string' && row.updated_by.trim() ? row.updated_by : stampedBy,
  }));

  const write = await persistSubmissionReadinessSection({
    tenderId,
    section,
    nextRows,
    rawFacet: read.rawFacet,
    expectedRevision: opts.expectedRevision ?? read.aggregate.revision.token,
    actorName: opts.actorName,
  });
  if (!write.ok) return { success: false, status: write.status, error: write.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `${SUBMISSION_READINESS_FACET_KEY}.${section}`,
    newValue: `${nextRows.length} rows`,
    actorName: opts.actorName,
    notes: `Submission readiness updated | ${section} | ${nextRows.length} rows${opts.reason ? ` | ${opts.reason}` : ''}`,
  }));
}

/**
 * Shared per-item mutation: exactly ONE row, targeted by exact id. A missing id
 * is an honest failure and nothing is written; sibling rows are byte-preserved.
 */
async function updateSubmissionReadinessItem(args: {
  tenderId: string;
  section: SubmissionReadinessSectionKey;
  itemId: string;
  newStatus: string;
  previousStatus: string;
  itemName: string;
  extraFields?: Record<string, any>;
  opts?: TenderFacetWriteOpts;
  auditNoun: string;
}): Promise<ActionResult> {
  const { tenderId, section, itemId, newStatus } = args;
  const opts = args.opts ?? {};
  if (typeof itemId !== 'string' || !itemId.trim()) {
    return { success: false, error: `A ${args.auditNoun} id is required — updates target exactly one register row.` };
  }
  if (!isValidSubmissionReadinessStatus(section, newStatus)) {
    const allowed = SUBMISSION_READINESS_SECTION_CONTRACTS[section].statuses.join(', ');
    return { success: false, error: `Status "${newStatus}" is not a valid ${args.auditNoun} status. Allowed: ${allowed}.` };
  }

  const read = await readSubmissionReadinessForWrite(tenderId);
  if (!read.ok || !read.aggregate) return { success: false, status: read.status, error: read.error };

  const rawRows = read.rawRows(section);
  const target = rawRows.find(row => row && typeof row === 'object' && row.id === itemId);
  if (!target) {
    return {
      success: false,
      error: `No ${args.auditNoun} with id "${itemId}" exists in this tender's ${section} register (${rawRows.length} recorded). Nothing was changed.`,
    };
  }

  const { userName } = actor();
  const stampedBy = opts.actorName?.trim() ? opts.actorName : userName;
  const nextRows = rawRows.map(row =>
    row && typeof row === 'object' && row.id === itemId
      ? { ...row, status: newStatus, ...(args.extraFields ?? {}), updated_at: new Date().toISOString(), updated_by: stampedBy }
      : row,
  );

  const write = await persistSubmissionReadinessSection({
    tenderId,
    section,
    nextRows,
    rawFacet: read.rawFacet,
    expectedRevision: opts.expectedRevision ?? read.aggregate.revision.token,
    actorName: opts.actorName,
  });
  if (!write.ok) return { success: false, status: write.status, error: write.error };

  return savedWithAuditOutcome(await appendConfirmedTenderAudit({
    tenderId,
    fieldChanged: `${SUBMISSION_READINESS_FACET_KEY}.${section}`,
    oldValue: args.previousStatus || null,
    newValue: newStatus,
    actorName: opts.actorName,
    notes: `${args.auditNoun} status changed | ${args.itemName || itemId} | ${args.previousStatus || 'unknown'} → ${newStatus}`,
  }));
}

/**
 * 3. Update placeholder status (P1 — canonical submission_readiness register).
 */
export async function updatePlaceholderStatus(
  tenderId: string,
  placeholderId: string,
  label: string,
  previousStatus: string,
  newStatus: string,
  newValue?: string,
  opts?: TenderFacetWriteOpts,
): Promise<ActionResult> {
  return updateSubmissionReadinessItem({
    tenderId,
    section: 'placeholders',
    itemId: placeholderId,
    newStatus,
    previousStatus,
    itemName: label,
    extraFields: newValue !== undefined ? { value: newValue } : undefined,
    opts,
    auditNoun: 'Placeholder',
  });
}

/**
 * 4. Update required document status (P1 — canonical submission_readiness register).
 */
export async function updateRequiredDocStatus(
  tenderId: string,
  docId: string,
  docName: string,
  previousStatus: string,
  newStatus: string,
  opts?: TenderFacetWriteOpts,
): Promise<ActionResult> {
  return updateSubmissionReadinessItem({
    tenderId,
    section: 'required_documents',
    itemId: docId,
    newStatus,
    previousStatus,
    itemName: docName,
    opts,
    auditNoun: 'Required document',
  });
}

/**
 * 5. Update compliance item status (P1 — canonical submission_readiness register).
 */
export async function updateComplianceStatus(
  tenderId: string,
  itemId: string,
  requirement: string,
  previousStatus: string,
  newStatus: string,
  evidence?: string,
  opts?: TenderFacetWriteOpts,
): Promise<ActionResult> {
  return updateSubmissionReadinessItem({
    tenderId,
    section: 'compliance_items',
    itemId,
    newStatus,
    previousStatus,
    itemName: requirement,
    extraFields: evidence !== undefined ? { evidence } : undefined,
    opts,
    auditNoun: 'Compliance item',
  });
}

/**
 * 8. Create activity note.
 *
 * W04-C4: this used to call the fire-and-forget `_insertActivityEvent` and then
 * return `{ success: true }` unconditionally, while the UI printed "Persisted
 * to Supabase". The commercial_ticket_audit row IS the note — there is no other
 * write — so an unconfirmed insert meant the note simply did not exist while the
 * user was told it did. The insert is now awaited and read back.
 */
export async function createActivityNote(
  tenderId: string,
  title: string,
  description: string,
): Promise<ActionResult> {
  return writeCanonicalTenderAuditConfirmed({
    tenderId,
    fieldChanged: 'note',
    oldValue: null,
    newValue: null,
    // Same notes shape _insertActivityEvent produced, so stored rows are unchanged.
    notes: [title, description].filter(Boolean).join(' | '),
  });
}

/**
 * 10. Internal Review — Update block review status per department
 *
 * Fetches the current proposal_blocks array, patches the target block's
 * department-specific review fields, and writes back via updateTenderDraftingData.
 *
 * Does NOT move tender stage. Does NOT touch any other type_details key.
 */
export async function updateBlockReviewStatus(
  tenderId: string,
  blockId: string,
  department: "ops" | "finance" | "legal",
  status: "Pending" | "Approved" | "Rejected",
  comment: string,
  reviewerName?: string,
): Promise<ActionResult> {
  // P4 — actor truth: the recorded reviewer defaults to the SESSION user, never
  // a fabricated "System". A signed-out session records the auth-state module's
  // own honest literal.
  const reviewer = reviewerName?.trim() ? reviewerName : actor().userName;

  let aggregate;
  try {
    aggregate = await readTenderSourceAggregate(tenderSourceRecordStore, tenderId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!aggregate) return { success: false, error: 'Tender not found.' };

  const currentDrafting = (aggregate.typeDetails.tender_drafting as Record<string, any> | undefined) ?? {};
  const blocks = Array.isArray(currentDrafting.proposal_blocks) ? currentDrafting.proposal_blocks : [];

  const updatedBlocks = blocks.map((b: any) => {
    if (b.id !== blockId) return b;
    return {
      ...b,
      [`${department}_status`]: status,
      [`${department}_comment`]: comment,
      [`${department}_reviewer`]: reviewer,
      [`${department}_reviewed_at`]: new Date().toISOString(),
    };
  });

  return updateTenderDraftingData(
    tenderId,
    "proposal_blocks",
    updatedBlocks,
    `${department} review: ${status} on block ${blockId}`,
    aggregate.revision.token,
  );
}


/**
 * 11. Internal Review — Save AI-generated review flags to blocks
 *
 * Distributes parsed AI flags to the correct blocks based on block_id.
 * Replaces existing flags from the same department (idempotent re-runs).
 */
export async function saveBlockAIFlags(
  tenderId: string,
  department: "ops" | "finance" | "legal",
  flags: Array<{ block_id: string; severity: string; issue: string; recommendation?: string; type?: string; source_field?: string; source_value?: string; block_value?: string }>,
  botId: string,
  /** New: per-block quality scores from the AI */
  blockScores?: Array<{ block_id: string; quality_score: number; score_rationale: string }>,
): Promise<ActionResult> {
  let aggregate;
  try {
    aggregate = await readTenderSourceAggregate(tenderSourceRecordStore, tenderId);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!aggregate) return { success: false, error: 'Tender not found.' };

  const currentDrafting = (aggregate.typeDetails.tender_drafting as Record<string, any> | undefined) ?? {};
  const blocks = Array.isArray(currentDrafting.proposal_blocks) ? currentDrafting.proposal_blocks : [];

  const updatedBlocks = blocks.map((b: any) => {
    const blockFlags = flags
      .filter(f => f.block_id === b.id)
      .map(f => ({
        id: `flag-${crypto.randomUUID().substring(0, 8)}`,
        department,
        bot_id: botId,
        block_id: f.block_id,
        severity: f.severity,
        type: f.type || 'general',
        issue: f.issue,
        recommendation: f.recommendation || '',
        source_field: f.source_field || '',
        source_value: f.source_value || '',
        block_value: f.block_value || '',
        created_at: new Date().toISOString(),
      }));

    // Merge quality score if available
    const scoreEntry = blockScores?.find(s => s.block_id === b.id);
    const existingScores = b.quality_scores && typeof b.quality_scores === 'object' ? b.quality_scores : {};
    const updatedScores = scoreEntry
      ? { ...existingScores, [department]: { score: scoreEntry.quality_score, rationale: scoreEntry.score_rationale, updated_at: new Date().toISOString() } }
      : existingScores;

    const existingFlags = Array.isArray(b.ai_flags) ? b.ai_flags : [];
    // Remove old flags from same department, add new ones (idempotent re-run)
    const cleaned = existingFlags.filter((f: any) => f.department !== department);
    return {
      ...b,
      ai_flags: [...cleaned, ...blockFlags],
      quality_scores: updatedScores,
    };
  });

  return updateTenderDraftingData(
    tenderId,
    "proposal_blocks",
    updatedBlocks,
    `AI ${department} review flags + quality scores saved`,
    aggregate.revision.token,
  );
}
