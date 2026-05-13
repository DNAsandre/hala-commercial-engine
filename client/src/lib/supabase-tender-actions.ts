/**
 * supabase-tender-actions.ts
 * ──────────────────────────
 * SUPA-008: Tender Workspace Action Write Layer
 *
 * Every write function:
 *   1. Performs the Supabase update/insert
 *   2. Appends a tender_activity_events row
 *   3. Appends a tender_audit_events row
 *   4. Returns { success, error? }
 *
 * No production enforcement. No real email. No CRM sync.
 * Mock-mode flag is always TRUE.
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth-state';

// ─── Result type ─────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Internal helpers ────────────────────────────────────────

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
  const { userId, userName } = actor();
  const { error } = await supabase.from('tender_activity_events').insert({
    id: `tae-${uid()}`,
    workspace_id: params.tenderId,
    action_type: params.actionType,
    action_label: params.actionLabel,
    title: params.title,
    description: params.description,
    event_type: params.actionType,
    category: params.category ?? 'action',
    severity: params.severity ?? 'info',
    previous_value: params.previousValue ?? null,
    new_value: params.newValue ?? null,
    gate_code: params.gateCode ?? null,
    reason: params.reason ?? null,
    related_pack: params.relatedPack ?? '',
    related_module: params.relatedModule ?? '',
    metadata: params.metadata ?? {},
    mock_mode: true,
    mock: true,
    user_id: userId,
    user_name: userName,
    actor: userName,
    action: params.actionLabel,
    detail: params.description,
    timestamp: now(),
  });
  if (error) console.warn('[SUPA-008] Activity event insert failed:', error.message);
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
  const { userId, userName } = actor();
  const traceId = `tr-${uid()}`;
  const { error } = await supabase.from('tender_audit_events').insert({
    id: `tau-${uid()}`,
    workspace_id: params.tenderId,
    action: params.action,
    event_code: params.eventCode,
    event_name: params.eventName,
    entity_type: params.entityType,
    entity_id: params.entityId,
    entity_name: params.entityName ?? '',
    category: params.category ?? 'action',
    severity: params.severity ?? 'info',
    previous_value: params.previousValue ?? null,
    new_value: params.newValue ?? null,
    before_state: params.previousValue ?? '',
    after_state: params.newValue ?? '',
    gate_code: params.gateCode ?? null,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
    mock_mode: true,
    mock: true,
    user_id: userId,
    user_name: userName,
    actor: userName,
    detail: `${params.eventName}: ${params.previousValue ?? ''} → ${params.newValue ?? ''}`,
    trace_id: traceId,
    timestamp: now(),
  });
  if (error) console.warn('[SUPA-008] Audit event insert failed:', error.message);
}

// ─── Public write functions ──────────────────────────────────

/**
 * 1. Update tender phase (stage movement)
 */
export async function updateTenderPhase(
  tenderId: string,
  previousPhase: string,
  newPhase: string,
  reason: string = '',
): Promise<ActionResult> {
  // Update tenders table
  const { error } = await supabase
    .from('tenders')
    .update({ phase: newPhase, updated_at: now() })
    .eq('id', tenderId);

  if (error) return { success: false, error: error.message };

  // Insert stage history
  await supabase.from('tender_stage_history').insert({
    id: `tsh-${uid()}`,
    tender_workspace_id: tenderId,
    previous_phase: previousPhase,
    new_phase: newPhase,
    reason,
    mock_mode: true,
    user_id: actor().userId,
    user_name: actor().userName,
    created_at: now(),
  }).then(r => { if (r.error) console.warn('[SUPA-008] Stage history insert failed:', r.error.message); });

  // Activity + Audit
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
 * 2. Update pack status
 */
export async function updatePackStatus(
  tenderId: string,
  packId: string,
  packName: string,
  previousStatus: string,
  newStatus: string,
): Promise<ActionResult> {
  const { error } = await supabase
    .from('tender_packs')
    .update({ status: newStatus, updated_at: now() })
    .eq('id', packId);

  if (error) return { success: false, error: error.message };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'pack_status_change',
      actionLabel: `Pack "${packName}" → ${newStatus}`,
      title: 'Pack Status Update',
      description: `Pack "${packName}" status changed from "${previousStatus}" to "${newStatus}".`,
      category: 'pack',
      previousValue: previousStatus,
      newValue: newStatus,
      relatedPack: packName,
    }),
    _insertAuditEvent({
      tenderId,
      action: 'pack_status_change',
      eventCode: 'SUPA008-PACK',
      eventName: 'Pack Status Change',
      entityType: 'tender_pack',
      entityId: packId,
      entityName: packName,
      previousValue: previousStatus,
      newValue: newStatus,
      category: 'pack',
    }),
  ]);

  return { success: true };
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
  const updates: Record<string, any> = { status: newStatus, last_updated: now() };
  if (newValue !== undefined) updates.value = newValue;

  const { error } = await supabase
    .from('tender_placeholders')
    .update(updates)
    .eq('id', placeholderId);

  if (error) return { success: false, error: error.message };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'placeholder_status_change',
      actionLabel: `Placeholder "${label}" → ${newStatus}`,
      title: 'Placeholder Update',
      description: `Placeholder "${label}" changed from "${previousStatus}" to "${newStatus}".`,
      category: 'placeholder',
      previousValue: previousStatus,
      newValue: newStatus,
      relatedModule: 'placeholders',
    }),
    _insertAuditEvent({
      tenderId,
      action: 'placeholder_status_change',
      eventCode: 'SUPA008-PH',
      eventName: 'Placeholder Status Change',
      entityType: 'tender_placeholder',
      entityId: placeholderId,
      entityName: label,
      previousValue: previousStatus,
      newValue: newStatus,
      category: 'placeholder',
    }),
  ]);

  return { success: true };
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
  const { error } = await supabase
    .from('tender_required_documents')
    .update({ status: newStatus, last_updated: now() })
    .eq('id', docId);

  if (error) return { success: false, error: error.message };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'doc_status_change',
      actionLabel: `Doc "${docName}" → ${newStatus}`,
      title: 'Document Status Update',
      description: `Required document "${docName}" changed from "${previousStatus}" to "${newStatus}".`,
      category: 'document',
      previousValue: previousStatus,
      newValue: newStatus,
      relatedModule: 'required_documents',
    }),
    _insertAuditEvent({
      tenderId,
      action: 'doc_status_change',
      eventCode: 'SUPA008-DOC',
      eventName: 'Document Status Change',
      entityType: 'tender_required_document',
      entityId: docId,
      entityName: docName,
      previousValue: previousStatus,
      newValue: newStatus,
      category: 'document',
    }),
  ]);

  return { success: true };
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
  const updates: Record<string, any> = { status: newStatus, last_updated: now() };
  if (evidence !== undefined) updates.evidence = evidence;

  const { error } = await supabase
    .from('tender_compliance_items')
    .update(updates)
    .eq('id', itemId);

  if (error) return { success: false, error: error.message };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'compliance_status_change',
      actionLabel: `Compliance "${requirement.slice(0, 40)}" → ${newStatus}`,
      title: 'Compliance Update',
      description: `Compliance item "${requirement}" changed from "${previousStatus}" to "${newStatus}".`,
      category: 'compliance',
      previousValue: previousStatus,
      newValue: newStatus,
      relatedModule: 'compliance',
    }),
    _insertAuditEvent({
      tenderId,
      action: 'compliance_status_change',
      eventCode: 'SUPA008-COMP',
      eventName: 'Compliance Status Change',
      entityType: 'tender_compliance_item',
      entityId: itemId,
      entityName: requirement,
      previousValue: previousStatus,
      newValue: newStatus,
      category: 'compliance',
    }),
  ]);

  return { success: true };
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
  const { error } = await supabase
    .from('tender_submission_gates')
    .update({ status: newStatus, evaluated_at: now() })
    .eq('id', gateId);

  if (error) return { success: false, error: error.message };

  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'gate_status_change',
      actionLabel: `Gate "${gateName}" → ${newStatus}`,
      title: 'Gate Status Update',
      description: `Submission gate "${gateName}" changed from "${previousStatus}" to "${newStatus}". ${reason}`.trim(),
      category: 'gate',
      severity: newStatus === 'would_block' || newStatus === 'fail' ? 'warning' : 'info',
      previousValue: previousStatus,
      newValue: newStatus,
      gateCode: gateId,
      reason,
      relatedModule: 'submission_gates',
    }),
    _insertAuditEvent({
      tenderId,
      action: 'gate_status_change',
      eventCode: 'SUPA008-GATE',
      eventName: 'Gate Status Change',
      entityType: 'tender_submission_gate',
      entityId: gateId,
      entityName: gateName,
      previousValue: previousStatus,
      newValue: newStatus,
      gateCode: gateId,
      reason,
      category: 'gate',
    }),
  ]);

  return { success: true };
}

/**
 * 7. Log mock bypass (event-only, no entity update)
 */
export async function logMockBypass(
  tenderId: string,
  gateId: string,
  gateName: string,
  reason: string = 'Testing bypass activated',
): Promise<ActionResult> {
  // Also update the gate status to mock_bypassed
  const result = await updateGateStatus(tenderId, gateId, gateName, 'would_block', 'mock_bypassed', reason);
  if (!result.success) return result;

  // Additional bypass-specific activity event
  await _insertActivityEvent({
    tenderId,
    actionType: 'mock_bypass',
    actionLabel: `Mock bypass: "${gateName}"`,
    title: 'Mock Bypass Activated',
    description: `Gate "${gateName}" bypassed for testing. No production enforcement applied. Reason: ${reason}`,
    category: 'gate',
    severity: 'warning',
    gateCode: gateId,
    reason,
    relatedModule: 'submission_gates',
  });

  return { success: true };
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
 * 9. Log email simulation event
 */
export async function logEmailSimulation(
  tenderId: string,
  emailType: string,
  packName: string,
): Promise<ActionResult> {
  await Promise.all([
    _insertActivityEvent({
      tenderId,
      actionType: 'email_simulation',
      actionLabel: `Email simulated: ${emailType} for ${packName}`,
      title: 'Submission Email Simulation',
      description: `Mock submission email "${emailType}" simulated for pack "${packName}". No real email sent.`,
      category: 'submission',
      severity: 'info',
      relatedPack: packName,
      relatedModule: 'email_simulator',
    }),
    _insertAuditEvent({
      tenderId,
      action: 'email_simulation',
      eventCode: 'SUPA008-EMAIL',
      eventName: 'Email Simulation',
      entityType: 'submission_email',
      entityId: `sim-${uid()}`,
      entityName: `${emailType} — ${packName}`,
      category: 'submission',
    }),
  ]);

  return { success: true };
}
