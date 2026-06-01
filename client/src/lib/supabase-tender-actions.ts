/**
 * supabase-tender-actions.ts
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * SUPA-008: Tender Workspace Action Write Layer
 *
 * Every write function:
 *   1. Performs the canonical commercial_tickets update
 *   2. Appends a commercial_ticket_audit row
 *   4. Returns { success, error? }
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

// â”€â”€â”€ Result type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ActionResult {
  success: boolean;
  error?: string;
}

// â”€â”€â”€ Internal helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function uid(): string {
  return crypto.randomUUID().slice(0, 12);
}

function now(): string {
  return new Date().toISOString();
}

function actor() {
  const u = getCurrentUser();
  return { userId: u?.id ?? '', userName: u?.name ?? 'System' };
}

function disabledLegacyTenderChildWrite(area: string): ActionResult {
  return {
    success: false,
    error: `${area} is disabled until it is rebuilt on verified commercial_tickets lineage. Legacy tender child tables must not be repopulated.`,
  };
}

function auditActionFor(fieldChanged: string): 'updated' | 'stage_changed' {
  return fieldChanged.includes('stage') || fieldChanged.includes('phase') ? 'stage_changed' : 'updated';
}

async function writeCanonicalTenderAudit(params: {
  tenderId: string;
  fieldChanged: string;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { userName } = actor();
  const { error } = await supabase.from('commercial_ticket_audit').insert({
    ticket_id: params.tenderId,
    action: auditActionFor(params.fieldChanged),
    field_changed: params.fieldChanged,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    user_name: userName,
    notes: params.notes ?? null,
  });

  if (error) console.warn('[SUPA-008] Canonical tender audit insert failed:', error.message);
}

async function updateCanonicalTenderTicket(
  tenderId: string,
  patch: Record<string, any>,
): Promise<{ handled: boolean; error?: string }> {
  const existing = await supabase
    .from('commercial_tickets')
    .select('id')
    .eq('id', tenderId)
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .maybeSingle();

  if (existing.error) return { handled: false, error: existing.error.message };
  if (!existing.data) {
    return {
      handled: true,
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }

  const { error } = await supabase
    .from('commercial_tickets')
    .update({ ...patch, updated_at: now() })
    .eq('id', tenderId);

  return error ? { handled: true, error: error.message } : { handled: true };
}

async function mergeCanonicalTenderDetails(
  tenderId: string,
  detailsPatch: Record<string, any>,
  ticketPatch: Record<string, any> = {},
): Promise<{ handled: boolean; error?: string }> {
  const existing = await supabase
    .from('commercial_tickets')
    .select('id,type_details')
    .eq('id', tenderId)
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .maybeSingle();

  if (existing.error) return { handled: false, error: existing.error.message };
  if (!existing.data) {
    return {
      handled: true,
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }

  const currentDetails =
    existing.data.type_details && typeof existing.data.type_details === 'object' && !Array.isArray(existing.data.type_details)
      ? existing.data.type_details
      : {};

  const { error } = await supabase
    .from('commercial_tickets')
    .update({
      ...ticketPatch,
      type_details: { ...currentDetails, ...detailsPatch },
      updated_at: now(),
    })
    .eq('id', tenderId);

  return error ? { handled: true, error: error.message } : { handled: true };
}

async function updateTenderDocumentList(
  tenderId: string,
  updater: (documents: TenderDocument[]) => TenderDocument[],
): Promise<{ handled: boolean; error?: string; before: TenderDocument[]; after: TenderDocument[] }> {
  const existing = await supabase
    .from('commercial_tickets')
    .select('id,type_details')
    .eq('id', tenderId)
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .maybeSingle();

  if (existing.error) return { handled: false, error: existing.error.message, before: [], after: [] };
  if (!existing.data) {
    return {
      handled: true,
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
      before: [],
      after: [],
    };
  }

  const currentDetails =
    existing.data.type_details && typeof existing.data.type_details === 'object' && !Array.isArray(existing.data.type_details)
      ? existing.data.type_details
      : {};
  const before = Array.isArray((currentDetails as any).documents) ? (currentDetails as any).documents as TenderDocument[] : [];
  const after = updater(before);

  const { error } = await supabase
    .from('commercial_tickets')
    .update({
      type_details: { ...currentDetails, documents: after },
      updated_at: now(),
    })
    .eq('id', tenderId);

  return error ? { handled: true, error: error.message, before, after } : { handled: true, before, after };
}

async function _insertActivityEvent(params: {
  tenderId: string;
  actionType: string;
  actionLabel: string;
  title: string;
  description: string;
  category?: string;
  severity?: string;
  previousValue?: string;
  newValue?: string;
  gateCode?: string;
  reason?: string;
  relatedPack?: string;
  relatedModule?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await writeCanonicalTenderAudit({
    tenderId: params.tenderId,
    fieldChanged: params.actionType,
    oldValue: params.previousValue ?? null,
    newValue: params.newValue ?? null,
    notes: [params.title, params.description, params.reason ? `Reason: ${params.reason}` : null]
      .filter(Boolean)
      .join(' | '),
  });
}

async function _insertAuditEvent(params: {
  tenderId: string;
  action: string;
  eventCode: string;
  eventName: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  category?: string;
  severity?: string;
  previousValue?: string;
  newValue?: string;
  gateCode?: string;
  reason?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  void params;
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
  const canonical = await updateCanonicalTenderTicket(tenderId, { internal_stage: newPhase });
  if (canonical.error) return { success: false, error: canonical.error };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'stage_change',
      actionLabel: `Stage moved to ${newPhase}`,
      title: 'Tender Stage Change',
      description: `Phase changed from "${previousPhase}" to "${newPhase}". ${reason}`.trim(),
      category: 'lifecycle',
      severity: 'info',
      previousValue: previousPhase,
      newValue: newPhase,
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'stage_change',
      eventCode: 'SUPA008-STAGE',
      eventName: 'Tender Stage Change',
      entityType: 'tender',
      entityId: tenderId,
      previousValue: previousPhase,
      newValue: newPhase,
      reason,
      category: 'lifecycle',
    }),
  ]);

  return { success: true };
}

/**
 * 1b. Update CRM Pipeline Stage (TND-003)
 *
 * Writes ONLY to commercial_tickets.crm_pipeline_stage.
 * Does NOT touch internal_stage.
 * These are completely independent fields â€” do not auto-sync.
 */
export async function updateTenderCrmStage(
  tenderId: string,
  previousStage: string,
  newStage: string,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await updateCanonicalTenderTicket(tenderId, { crm_pipeline_stage: newStage });
  if (canonical.error) return { success: false, error: canonical.error };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'crm_stage_change',
      actionLabel: `CRM Pipeline moved to ${newStage}`,
      title: 'CRM Pipeline Stage Change',
      description: `CRM Pipeline stage changed from "${previousStage}" to "${newStage}". ${reason}`.trim(),
      category: 'lifecycle',
      severity: 'info',
      previousValue: previousStage,
      newValue: newStage,
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'crm_stage_change',
      eventCode: 'TND003-CRM',
      eventName: 'CRM Pipeline Stage Change',
      entityType: 'tender',
      entityId: tenderId,
      previousValue: previousStage,
      newValue: newStage,
      reason,
      category: 'lifecycle',
    }),
  ]);

  return { success: true };
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
  if (canonical.error) return { success: false, error: canonical.error };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'probability_change',
      actionLabel: `Win probability updated to ${newProbability}%`,
      title: 'Win Probability Updated',
      description: `Initial win probability changed from ${previousProbability}% to ${newProbability}%. ${reason}`.trim(),
      category: 'signal',
      severity: 'info',
      previousValue: String(previousProbability),
      newValue: String(newProbability),
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'probability_change',
      eventCode: 'TND015-PROB',
      eventName: 'Win Probability Update',
      entityType: 'tender',
      entityId: tenderId,
      previousValue: String(previousProbability),
      newValue: String(newProbability),
      reason,
      category: 'signal',
    }),
  ]);

  return { success: true };
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
  if (canonical.error) return { success: false, error: canonical.error };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'team_assignment_change',
      actionLabel: `Team updated â€” ${owner} + ${teamMembers.length} members`,
      title: 'Tender Team Updated',
      description: `Ownership assigned to "${owner}". Team members: ${teamMembers.join(', ') || 'none'}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'team_assignment_change',
      eventCode: 'TND015-TEAM',
      eventName: 'Tender Team Assignment',
      entityType: 'tender',
      entityId: tenderId,
      entityName: owner,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
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
  if (canonical.error) return { success: false, error: canonical.error };

  const summary = [
    fields.executionRegions.length ? `Regions: ${fields.executionRegions.join(', ')}` : null,
    fields.targetSites.length ? `Sites: ${fields.targetSites.map(s => s.name).join(', ')}` : null,
    fields.executionType ? `Type: ${fields.executionType}` : null,
    fields.geographicComplexity ? `Complexity: ${fields.geographicComplexity}` : null,
    fields.siteCount ? `Site count: ${fields.siteCount}` : null,
  ].filter(Boolean).join(' Â· ') || 'Execution scope cleared';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'execution_scope_update',
      actionLabel: `Execution scope updated`,
      title: 'Tender Execution Scope Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'execution_scope_update',
      eventCode: 'TND016-EXEC',
      eventName: 'Execution Scope Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1f. Update tender Scope of Work data (structured SOW capture)
 *
 * Persists the full sow_data JSONB into type_details.sow_data.
 * Does NOT auto-create scope/SLA snapshots.
 * Does NOT mutate PDF Studio documents or composer blocks.
 * Snapshot creation requires an explicit future user action.
 */
export async function updateTenderSowData(
  tenderId: string,
  sowData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { sow_data: sowData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const serviceLines = Array.isArray(sowData.service_lines) ? sowData.service_lines : [];
  const summary = [
    serviceLines.length ? `${serviceLines.length} service lines` : null,
    sowData.scope_summary ? 'Summary captured' : null,
    Array.isArray(sowData.sla_kpis) && sowData.sla_kpis.length ? `${sowData.sla_kpis.length} KPIs` : null,
    Array.isArray(sowData.sites) && sowData.sites.length ? `${sowData.sites.length} sites` : null,
  ].filter(Boolean).join(' Â· ') || 'Scope of Work updated';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'sow_update',
      actionLabel: 'Scope of Work updated',
      title: 'Scope of Work Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'sow_update',
      eventCode: 'TND017-SOW',
      eventName: 'Scope of Work Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1g. Update tender Customer Fit Qualification data
 *
 * Persists structured customer fit qualification into type_details.customer_fit_data.
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, PDF Studio, or any other type_details key.
 */
export async function updateTenderCustomerFitData(
  tenderId: string,
  customerFitData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { customer_fit_data: customerFitData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const dims = Array.isArray(customerFitData.dimensions) ? customerFitData.dimensions : [];
  const assessed = dims.filter((d: any) => d.assessment && d.assessment !== 'Not Assessed').length;
  const summary = [
    assessed > 0 ? `${assessed}/${dims.length} dimensions assessed` : null,
    customerFitData.recommendation?.outcome && customerFitData.recommendation.outcome !== 'Not decided'
      ? `Recommendation: ${customerFitData.recommendation.outcome}` : null,
    Array.isArray(customerFitData.evidence) && customerFitData.evidence.length
      ? `${customerFitData.evidence.length} evidence items` : null,
    Array.isArray(customerFitData.gaps) && customerFitData.gaps.length
      ? `${customerFitData.gaps.length} gaps` : null,
  ].filter(Boolean).join(' · ') || 'Customer Fit Qualification updated';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'customer_fit_update',
      actionLabel: 'Customer Fit Qualification updated',
      title: 'Customer Fit Qualification Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'customer_fit_update',
      eventCode: 'TND018-CFQ',
      eventName: 'Customer Fit Qualification Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1h. Update tender SOW Qualification data
 *
 * Persists structured SOW qualification into type_details.sow_qualification_data.
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, customer_fit_data, PDF Studio, or any other type_details key.
 */
export async function updateTenderSowQualificationData(
  tenderId: string,
  sowQualificationData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { sow_qualification_data: sowQualificationData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const matrix = Array.isArray(sowQualificationData.coverage_matrix) ? sowQualificationData.coverage_matrix : [];
  const assessed = matrix.filter((r: any) => r.status && r.status !== 'Not Assessed').length;
  const clarifications = Array.isArray(sowQualificationData.clarifications) ? sowQualificationData.clarifications.length : 0;
  const summary = [
    assessed > 0 ? `${assessed}/${matrix.length} areas assessed` : null,
    clarifications > 0 ? `${clarifications} clarification questions` : null,
    sowQualificationData.outcome?.recommendation && sowQualificationData.outcome.recommendation !== 'Not decided'
      ? `Recommendation: ${sowQualificationData.outcome.recommendation}` : null,
  ].filter(Boolean).join(' · ') || 'SOW Qualification updated';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'sow_qualification_update',
      actionLabel: 'SOW Qualification updated',
      title: 'SOW Qualification Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'sow_qualification_update',
      eventCode: 'TND019-SOW',
      eventName: 'SOW Qualification Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1i. Update tender Technical Qualification data
 *
 * Persists structured technical qualification into type_details.technical_qualification_data.
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, customer_fit_data, sow_qualification_data, PDF Studio, or any other type_details key.
 */
export async function updateTenderTechnicalQualificationData(
  tenderId: string,
  technicalQualificationData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { technical_qualification_data: technicalQualificationData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const caps = Array.isArray(technicalQualificationData.capability_assessment) ? technicalQualificationData.capability_assessment : [];
  const assessed = caps.filter((r: any) => r.fit && r.fit !== 'Not Assessed').length;
  const gaps = Array.isArray(technicalQualificationData.gaps) ? technicalQualificationData.gaps.length : 0;
  const clarifications = Array.isArray(technicalQualificationData.clarifications) ? technicalQualificationData.clarifications.length : 0;
  const summary = [
    assessed > 0 ? `${assessed}/${caps.length} capabilities assessed` : null,
    gaps > 0 ? `${gaps} technical gaps` : null,
    clarifications > 0 ? `${clarifications} clarifications` : null,
    technicalQualificationData.recommendation?.outcome && technicalQualificationData.recommendation.outcome !== 'Not decided'
      ? `Recommendation: ${technicalQualificationData.recommendation.outcome}` : null,
  ].filter(Boolean).join(' · ') || 'Technical Qualification updated';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'technical_qualification_update',
      actionLabel: 'Technical Qualification updated',
      title: 'Technical Qualification Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'technical_qualification_update',
      eventCode: 'TND020-TECH',
      eventName: 'Technical Qualification Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1j. Update tender Risk Snapshot data
 *
 * Persists structured risk snapshot into type_details.risk_snapshot_data.
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, customer_fit_data, sow_qualification_data,
 * technical_qualification_data, PDF Studio, or any other type_details key.
 */
export async function updateTenderRiskSnapshotData(
  tenderId: string,
  riskSnapshotData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { risk_snapshot_data: riskSnapshotData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const register = Array.isArray(riskSnapshotData.register) ? riskSnapshotData.register : [];
  const critical = register.filter((r: any) => r.severity === 'Critical').length;
  const high = register.filter((r: any) => r.severity === 'High').length;
  const bidBlockers = register.filter((r: any) => r.bid_blocker).length;
  const summary = [
    register.length > 0 ? `${register.length} risks` : null,
    critical > 0 ? `${critical} critical` : null,
    high > 0 ? `${high} high` : null,
    bidBlockers > 0 ? `${bidBlockers} bid blockers` : null,
    riskSnapshotData.recommendation?.outcome && riskSnapshotData.recommendation.outcome !== 'Not decided'
      ? `Recommendation: ${riskSnapshotData.recommendation.outcome}` : null,
  ].filter(Boolean).join(' · ') || 'Risk Snapshot updated';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'risk_snapshot_update',
      actionLabel: 'Risk Snapshot updated',
      title: 'Risk Snapshot Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'risk_snapshot_update',
      eventCode: 'TND021-RISK',
      eventName: 'Risk Snapshot Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1k. Update tender Bid / No-Bid data
 *
 * Persists structured bid/no-bid decision data into type_details.bid_no_bid_data.
 * Uses MERGE behavior — only patches bid_no_bid_data without overwriting other keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, qualification data, risk data, PDF Studio, or any other type_details key.
 */
export async function updateTenderBidNoBidData(
  tenderId: string,
  bidNoBidData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { bid_no_bid_data: bidNoBidData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const decision = bidNoBidData.decision?.decision || bidNoBidData.decision_record?.decision || '';
  const summary = [
    decision && decision !== 'Not Decided' ? `Decision: ${decision}` : null,
    bidNoBidData.recommendation?.next_step && bidNoBidData.recommendation.next_step !== 'Not Decided'
      ? `Next: ${bidNoBidData.recommendation.next_step}` : null,
    Array.isArray(bidNoBidData.win_strategy?.win_themes) && bidNoBidData.win_strategy.win_themes.length > 0
      ? `${bidNoBidData.win_strategy.win_themes.length} win themes` : null,
  ].filter(Boolean).join(' · ') || 'Bid / No-Bid data updated';

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'bid_no_bid_update',
      actionLabel: 'Bid / No-Bid updated',
      title: 'Bid / No-Bid Updated',
      description: `${summary}. ${reason}`.trim(),
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'bid_no_bid_update',
      eventCode: 'TND022-BNB',
      eventName: 'Bid / No-Bid Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}


/**
 * 1l. Update tender Solution Design data
 *
 * Persists structured solution design data into type_details.solution_design_data.
 * Uses MERGE behavior — only patches solution_design_data without overwriting other keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch sow_data, qualification data, risk data, bid_no_bid_data, PDF Studio,
 * or any other type_details key.
 */
export async function updateTenderSolutionDesignData(
  tenderId: string,
  solutionDesignData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const canonical = await mergeCanonicalTenderDetails(
    tenderId,
    { solution_design_data: solutionDesignData },
  );
  if (canonical.error) return { success: false, error: canonical.error };

  const tabKeys = ['hop', 'ham', 'hip', 'scope_matrix', 'sla_kpi', 'assumptions_dependencies'];
  const savedTabs = tabKeys.filter(k => solutionDesignData[k] && typeof solutionDesignData[k] === 'object').length;
  const summary = `Solution Design updated (${savedTabs}/${tabKeys.length} sections). ${reason}`.trim();

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'solution_design_update',
      actionLabel: 'Solution Design updated',
      title: 'Solution Design Updated',
      description: summary,
      category: 'action',
      severity: 'info',
      reason,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'solution_design_update',
      eventCode: 'TND023-SOL',
      eventName: 'Solution Design Update',
      entityType: 'tender',
      entityId: tenderId,
      reason,
      category: 'action',
    }),
  ]);

  return { success: true };
}

/**
 * 1m. Update tender P&L / Pricing data
 *
 * Persists one section inside type_details.pricing.
 * Uses MERGE behavior - only patches the requested pricing section without
 * overwriting other pricing tabs or any non-pricing type_details keys.
 *
 * Does NOT move tender stage. Does NOT change CRM stage.
 * Does NOT touch solution design, qualification data, documents, PDF Studio,
 * or any document/composer records.
 */
export async function updateTenderPricingData(
  tenderId: string,
  section: TenderPricingSectionKey,
  sectionData: Record<string, any>,
  reason: string = '',
): Promise<ActionResult> {
  const existing = await supabase
    .from('commercial_tickets')
    .select('id,type_details')
    .eq('id', tenderId)
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .maybeSingle();

  if (existing.error) return { success: false, error: existing.error.message };
  if (!existing.data) {
    return {
      success: false,
      error: 'Canonical tender ticket not found in commercial_tickets. Legacy tenders writes are disabled.',
    };
  }

  const currentDetails =
    existing.data.type_details && typeof existing.data.type_details === 'object' && !Array.isArray(existing.data.type_details)
      ? existing.data.type_details
      : {};
  const currentPricing = normalizeTenderPricingData((currentDetails as any).pricing);
  const nextPricing = {
    ...currentPricing,
    [section]: sectionData,
  };

  const { error } = await supabase
    .from('commercial_tickets')
    .update({
      type_details: { ...currentDetails, pricing: nextPricing },
      updated_at: now(),
    })
    .eq('id', tenderId);

  if (error) return { success: false, error: error.message };

  const summary = summarizePricingSection(section, sectionData);
  await writeCanonicalTenderAudit({
    tenderId,
    fieldChanged: `pricing.${section}`,
    newValue: summary,
    notes: `P&L / Pricing updated | ${section}${reason ? ` | ${reason}` : ''}`,
  });

  return { success: true };
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
 * PDF Studio, doc_instances, or any prior-stage data.
 */
export async function updateTenderDraftingData(
  tenderId: string,
  section: string,
  sectionData: any,
  reason: string = '',
): Promise<ActionResult> {
  const existing = await supabase
    .from('commercial_tickets')
    .select('id,type_details')
    .eq('id', tenderId)
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .maybeSingle();

  if (existing.error) return { success: false, error: existing.error.message };
  if (!existing.data) return { success: false, error: 'Tender not found.' };

  const currentDetails =
    existing.data.type_details && typeof existing.data.type_details === 'object' && !Array.isArray(existing.data.type_details)
      ? existing.data.type_details
      : {};
  const currentDrafting = (currentDetails as any).tender_drafting ?? {};
  const nextDrafting = { ...currentDrafting, [section]: sectionData };

  const { error } = await supabase
    .from('commercial_tickets')
    .update({
      type_details: { ...currentDetails, tender_drafting: nextDrafting },
      updated_at: now(),
    })
    .eq('id', tenderId);

  if (error) return { success: false, error: error.message };

  await writeCanonicalTenderAudit({
    tenderId,
    fieldChanged: `tender_drafting.${section}`,
    newValue: `${section} updated`,
    notes: `Tender Drafting updated | ${section}${reason ? ` | ${reason}` : ''}`,
  });

  return { success: true };
}


export async function addTenderDocument(
  tenderId: string,
  document: TenderDocument,
): Promise<ActionResult> {
  const canonical = await updateTenderDocumentList(tenderId, documents => {
    const withoutDuplicate = documents.filter(doc => doc.id !== document.id);
    return [...withoutDuplicate, document];
  });
  if (canonical.error) return { success: false, error: canonical.error };

  await writeCanonicalTenderAudit({
    tenderId,
    fieldChanged: 'documents',
    oldValue: String(canonical.before.length),
    newValue: String(canonical.after.length),
    notes: `Document uploaded | ${document.document_name} | ${document.document_category}`,
  });

  return { success: true };
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
  if (canonical.error) return { success: false, error: canonical.error };

  await writeCanonicalTenderAudit({
    tenderId,
    fieldChanged: 'documents',
    oldValue: documentId,
    newValue: documentName || documentId,
    notes: `Document metadata updated | ${documentName || documentId}`,
  });

  return { success: true };
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
  if (canonical.error) return { success: false, error: canonical.error };

  await writeCanonicalTenderAudit({
    tenderId,
    fieldChanged: 'documents.status',
    oldValue: previousStatus,
    newValue: status,
    notes: `Document status changed | ${documentName || documentId}`,
  });

  return { success: true };
}

export async function markTenderDocumentSuperseded(
  tenderId: string,
  documentId: string,
): Promise<ActionResult> {
  return changeTenderDocumentStatus(tenderId, documentId, 'Superseded');
}


/**
 * 2. Update pack status
 */
export async function updatePackStatus(
  tenderId: string,
  packId: string,
  packName: string,
  previousStatus: string,
  newStatus: string,
): Promise<ActionResult> {
  void tenderId; void packId; void packName; void previousStatus; void newStatus;
  return disabledLegacyTenderChildWrite('Tender pack status updates');
}

/**
 * 3. Update placeholder status
 */
export async function updatePlaceholderStatus(
  tenderId: string,
  placeholderId: string,
  label: string,
  previousStatus: string,
  newStatus: string,
  newValue?: string,
): Promise<ActionResult> {
  void tenderId; void placeholderId; void label; void previousStatus; void newStatus; void newValue;
  return disabledLegacyTenderChildWrite('Tender placeholder updates');
}

/**
 * 4. Update required document status
 */
export async function updateRequiredDocStatus(
  tenderId: string,
  docId: string,
  docName: string,
  previousStatus: string,
  newStatus: string,
): Promise<ActionResult> {
  void tenderId; void docId; void docName; void previousStatus; void newStatus;
  return disabledLegacyTenderChildWrite('Tender required document updates');
}

/**
 * 5. Update compliance item status
 */
export async function updateComplianceStatus(
  tenderId: string,
  itemId: string,
  requirement: string,
  previousStatus: string,
  newStatus: string,
  evidence?: string,
): Promise<ActionResult> {
  void tenderId; void itemId; void requirement; void previousStatus; void newStatus; void evidence;
  return disabledLegacyTenderChildWrite('Tender compliance item updates');
}

/**
 * 6. Update gate status (pass/warn/fail/mock_bypassed)
 */
export async function updateGateStatus(
  tenderId: string,
  gateId: string,
  gateName: string,
  previousStatus: string,
  newStatus: string,
  reason: string = '',
): Promise<ActionResult> {
  void tenderId; void gateId; void gateName; void previousStatus; void newStatus; void reason;
  return disabledLegacyTenderChildWrite('Tender submission gate updates');
}

/**
 * 7. Log advisory override (event-only, no production enforcement)
 */
export async function logMockBypass(
  tenderId: string,
  gateId: string,
  gateName: string,
  reason: string = 'Advisory override activated',
): Promise<ActionResult> {
  void tenderId; void gateId; void gateName; void reason;
  return disabledLegacyTenderChildWrite('Tender advisory overrides');
}

/**
 * 8. Create activity note (activity-only, no audit)
 */
export async function createActivityNote(
  tenderId: string,
  title: string,
  description: string,
): Promise<ActionResult> {
  await _insertActivityEvent({
    tenderId,
    actionType: 'note',
    actionLabel: title,
    title,
    description,
    category: 'note',
    severity: 'info',
  });

  return { success: true };
}

/**
 * 9. Submission simulation disabled
 */
export async function logEmailSimulation(
  tenderId: string,
  emailType: string,
  packName: string,
): Promise<ActionResult> {
  console.warn('[SUPA-008] logEmailSimulation disabled. No submission event was written.', { tenderId, emailType, packName });
  return { success: false, error: 'Submission simulation is disabled until a verified submission workflow exists.' };
}
