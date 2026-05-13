/**
 * supabase-commercial-actions.ts
 * ──────────────────────────────
 * SUPA-004: Supabase-backed controlled mock action writes.
 *
 * All mock action persistence goes through this module.
 * No raw Supabase writes in components.
 *
 * Rules:
 * - All writes set mock = true
 * - No real approvals, workflows, CRM, or document generation
 * - Returns { success, error } so components can toast accordingly
 * - RLS: development-permissive
 */

import { supabase } from './supabase';

// ─── TYPES ─────────────────────────────────────────────────

export interface ActionActor {
  name: string;
  role: string;
}

export interface ActivityWriteParams {
  workspaceId: string;
  eventType: string;
  title: string;
  description: string;
  category: string;
  actor: ActionActor;
  severity?: string;
  relatedArtifact?: string;
  relatedModule?: string;
  relatedScenarioId?: string;
  notes?: string;
}

export interface AuditWriteParams {
  workspaceId: string;
  eventCode: string;
  eventName: string;
  description: string;
  category: string;
  actor: ActionActor;
  entityType: string;
  entityName: string;
  beforeState?: string;
  afterState?: string;
  severity?: string;
  notes?: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── ID / TRACE GENERATORS ────────────────────────────────

function generateEventId(prefix: 'act' | 'aud'): string {
  return `${prefix}-usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

function generateTraceId(): string {
  return `TRACE-COM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

// ─── CORE WRITE FUNCTIONS ──────────────────────────────────

export async function logCommercialActivity(params: ActivityWriteParams): Promise<ActionResult> {
  const row = {
    id: generateEventId('act'),
    workspace_id: params.workspaceId,
    event_type: params.eventType,
    title: params.title,
    description: params.description,
    category: params.category,
    actor: params.actor.name,
    role: params.actor.role,
    timestamp: new Date().toISOString(),
    severity: params.severity ?? 'Info',
    related_artifact: params.relatedArtifact ?? '',
    related_module: params.relatedModule ?? '',
    related_scenario_id: params.relatedScenarioId ?? '',
    mock: true,
    notes: params.notes ?? '',
  };

  const { error } = await supabase.from('commercial_activity_events').insert(row);
  if (error) {
    console.error('[SUPA-004] logCommercialActivity failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function logCommercialAudit(params: AuditWriteParams): Promise<ActionResult> {
  const row = {
    id: generateEventId('aud'),
    workspace_id: params.workspaceId,
    event_code: params.eventCode,
    event_name: params.eventName,
    description: params.description,
    category: params.category,
    actor: params.actor.name,
    role: params.actor.role,
    timestamp: new Date().toISOString(),
    entity_type: params.entityType,
    entity_name: params.entityName,
    before_state: params.beforeState ?? '',
    after_state: params.afterState ?? '',
    mock: true,
    severity: params.severity ?? 'Info',
    trace_id: generateTraceId(),
    notes: params.notes ?? '',
  };

  const { error } = await supabase.from('commercial_audit_events').insert(row);
  if (error) {
    console.error('[SUPA-004] logCommercialAudit failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Convenience: log both activity + audit in parallel.
 * Returns success only if both succeed.
 */
export async function logMockAction(
  activity: ActivityWriteParams,
  audit: AuditWriteParams
): Promise<ActionResult> {
  const [actResult, audResult] = await Promise.all([
    logCommercialActivity(activity),
    logCommercialAudit(audit),
  ]);

  if (!actResult.success || !audResult.success) {
    const errors = [actResult.error, audResult.error].filter(Boolean).join('; ');
    return { success: false, error: errors };
  }
  return { success: true };
}

// ─── ENTITY STATUS UPDATES ────────────────────────────────

/**
 * Mark a mock escalation as reviewed.
 * Updates status + logs activity/audit.
 */
export async function markEscalationReviewedMock(
  escalationId: string,
  workspaceId: string,
  escalationName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  const { error } = await supabase
    .from('commercial_mock_escalations')
    .update({ current_status: 'Reviewed Mock' })
    .eq('id', escalationId);

  if (error) {
    console.error('[SUPA-004] markEscalationReviewedMock failed:', error.message);
    return { success: false, error: error.message };
  }

  return logMockAction(
    {
      workspaceId, eventType: 'escalation_reviewed_mock', title: 'Mock escalation marked reviewed',
      description: `Escalation "${escalationName}" marked as reviewed. No production approval triggered.`,
      category: 'Escalation', actor, severity: 'Info',
      relatedArtifact: escalationName, relatedModule: 'Mock Escalation',
    },
    {
      workspaceId, eventCode: 'ESCALATION_REVIEWED_MOCK', eventName: 'Escalation Reviewed Mock',
      description: `Mock escalation reviewed: ${escalationName}`,
      category: 'ESCALATION', actor, entityType: 'Mock Escalation', entityName: escalationName,
      beforeState: 'Open Mock', afterState: 'Reviewed Mock', severity: 'Info',
    },
  );
}

/**
 * Mark a mock escalation as testing bypass.
 */
export async function markEscalationBypassMock(
  escalationId: string,
  workspaceId: string,
  escalationName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  const { error } = await supabase
    .from('commercial_mock_escalations')
    .update({ current_status: 'Testing Bypass' })
    .eq('id', escalationId);

  if (error) {
    console.error('[SUPA-004] markEscalationBypassMock failed:', error.message);
    return { success: false, error: error.message };
  }

  return logMockAction(
    {
      workspaceId, eventType: 'testing_bypass_mock', title: 'Testing bypass used',
      description: `Escalation "${escalationName}" bypassed for testing. No enforcement applied.`,
      category: 'Escalation', actor, severity: 'Info',
      relatedArtifact: escalationName, relatedModule: 'Mock Escalation',
    },
    {
      workspaceId, eventCode: 'TESTING_BYPASS_MOCK', eventName: 'Testing Bypass Used',
      description: `Testing bypass for: ${escalationName}`,
      category: 'ESCALATION', actor, entityType: 'Mock Escalation', entityName: escalationName,
      beforeState: 'Open Mock', afterState: 'Testing Bypass', severity: 'Info',
    },
  );
}

/**
 * Mark P&L snapshot as reviewed (mock).
 */
export async function markPnlReviewedMock(
  scenarioId: string,
  workspaceId: string,
  scenarioName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  // Update reviewed fields if they exist
  await supabase
    .from('commercial_pnl_snapshots')
    .update({ last_reviewed: new Date().toISOString(), reviewed_by: actor.name })
    .eq('scenario_id', scenarioId);

  return logMockAction(
    {
      workspaceId, eventType: 'pnl_reviewed_mock', title: 'P&L snapshot reviewed (mock)',
      description: `P&L for "${scenarioName}" reviewed. No production approval triggered.`,
      category: 'P&L', actor, severity: 'Info',
      relatedArtifact: scenarioName, relatedModule: 'P&L Snapshot', relatedScenarioId: scenarioId,
    },
    {
      workspaceId, eventCode: 'PNL_REVIEWED_MOCK', eventName: 'P&L Reviewed Mock',
      description: `P&L reviewed for ${scenarioName}`,
      category: 'PNL', actor, entityType: 'P&L Snapshot', entityName: scenarioName,
      beforeState: 'Draft Mock', afterState: 'Mock Reviewed', severity: 'Info',
    },
  );
}

/**
 * Mark proposal as reviewed (mock).
 */
export async function markProposalReviewedMock(
  proposalId: string,
  workspaceId: string,
  proposalName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  await supabase
    .from('commercial_proposal_versions')
    .update({ review_status: 'Mock Reviewed', last_updated: new Date().toISOString() })
    .eq('id', proposalId);

  return logMockAction(
    {
      workspaceId, eventType: 'proposal_reviewed_mock', title: 'Proposal reviewed (mock)',
      description: `Proposal "${proposalName}" reviewed. No production approval triggered.`,
      category: 'Proposal', actor, severity: 'Info',
      relatedArtifact: proposalName, relatedModule: 'Proposal Control',
    },
    {
      workspaceId, eventCode: 'PROPOSAL_REVIEWED_MOCK', eventName: 'Proposal Reviewed Mock',
      description: `Proposal reviewed: ${proposalName}`,
      category: 'PROPOSAL', actor, entityType: 'Proposal', entityName: proposalName,
      beforeState: 'Not Reviewed', afterState: 'Mock Reviewed', severity: 'Info',
    },
  );
}

/**
 * Request Ops Review for SLA (mock).
 */
export async function requestSlaOpsReviewMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  await supabase
    .from('commercial_sla_drafts')
    .update({ ops_review: 'Ops Review Requested Mock', last_updated: new Date().toISOString() })
    .eq('id', slaId);

  return logMockAction(
    {
      workspaceId, eventType: 'sla_ops_review_requested_mock', title: 'Ops Review Requested (mock)',
      description: `Ops Review for "${slaName}" requested (mock). No real workflow triggered.`,
      category: 'SLA', actor, severity: 'Info',
      relatedArtifact: slaName, relatedModule: 'SLA Control',
    },
    {
      workspaceId, eventCode: 'SLA_OPS_REVIEW_REQUESTED_MOCK', eventName: 'Ops Review Requested Mock',
      description: `Ops Review requested for ${slaName}`,
      category: 'SLA', actor, entityType: 'SLA', entityName: slaName,
      beforeState: 'Not Reviewed', afterState: 'Ops Review Requested Mock', severity: 'Info',
    },
  );
}

/**
 * Request Legal Review for SLA (mock).
 */
export async function requestSlaLegalReviewMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  await supabase
    .from('commercial_sla_drafts')
    .update({ legal_review: 'Legal Review Requested Mock', last_updated: new Date().toISOString() })
    .eq('id', slaId);

  return logMockAction(
    {
      workspaceId, eventType: 'sla_legal_review_requested_mock', title: 'Legal Review Requested (mock)',
      description: `Legal Review for "${slaName}" requested (mock). No real workflow triggered.`,
      category: 'SLA', actor, severity: 'Info',
      relatedArtifact: slaName, relatedModule: 'SLA Control',
    },
    {
      workspaceId, eventCode: 'SLA_LEGAL_REVIEW_REQUESTED_MOCK', eventName: 'Legal Review Requested Mock',
      description: `Legal Review requested for ${slaName}`,
      category: 'SLA', actor, entityType: 'SLA', entityName: slaName,
      beforeState: 'Not Reviewed', afterState: 'Legal Review Requested Mock', severity: 'Info',
    },
  );
}

/**
 * Mark overall SLA as reviewed (mock).
 */
export async function markSlaReviewedMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  await supabase
    .from('commercial_sla_drafts')
    .update({ status: 'Mock Reviewed', last_updated: new Date().toISOString() })
    .eq('id', slaId);

  return logMockAction(
    {
      workspaceId, eventType: 'sla_reviewed_mock', title: 'SLA Reviewed (mock)',
      description: `SLA "${slaName}" marked as reviewed (mock). No real workflow triggered.`,
      category: 'SLA', actor, severity: 'Info',
      relatedArtifact: slaName, relatedModule: 'SLA Control',
    },
    {
      workspaceId, eventCode: 'SLA_REVIEWED_MOCK', eventName: 'SLA Reviewed Mock',
      description: `SLA completed for ${slaName}`,
      category: 'SLA', actor, entityType: 'SLA', entityName: slaName,
      beforeState: 'Draft', afterState: 'Mock Reviewed', severity: 'Info',
    },
  );
}

/**
 * Mark pricing line as reviewed (mock).
 */
export async function markPricingLineReviewedMock(
  lineId: string,
  workspaceId: string,
  serviceName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  const { error } = await supabase
    .from('commercial_pricing_lines')
    .update({ review_status: 'Reviewed Mock' })
    .eq('id', lineId);

  if (error) {
    console.error('[SUPA-004] markPricingLineReviewedMock failed:', error.message);
    return { success: false, error: error.message };
  }

  return logMockAction(
    {
      workspaceId, eventType: 'pricing_line_reviewed_mock', title: 'Pricing Line Reviewed Mock',
      description: `Pricing line "${serviceName}" marked as reviewed. No production approval.`,
      category: 'Pricing', actor, severity: 'Info',
      relatedArtifact: serviceName, relatedModule: 'Pricing Lines',
    },
    {
      workspaceId, eventCode: 'PRICING_LINE_REVIEWED_MOCK', eventName: 'Pricing Line Reviewed Mock',
      description: `Pricing line reviewed: ${serviceName}`,
      category: 'PRICING', actor, entityType: 'Pricing Line', entityName: serviceName,
      beforeState: 'Draft Mock', afterState: 'Reviewed Mock', severity: 'Info',
    },
  );
}
