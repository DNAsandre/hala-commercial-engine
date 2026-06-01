/**
 * Commercial workspace action guard.
 *
 * Legacy mock workflow actions used to write development markers into Supabase. That
 * violates the current source-of-truth doctrine, so these functions now keep
 * the public API stable while refusing to persist unverified business records.
 */

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

const ADVISORY_ACTION_DISABLED =
  "Advisory workflow action disabled. No Supabase write was performed. Build a verified workflow table before persisting this action.";

function disabledAction(..._args: unknown[]): ActionResult {
  return { success: false, error: ADVISORY_ACTION_DISABLED };
}

export async function logCommercialActivity(params: ActivityWriteParams): Promise<ActionResult> {
  return disabledAction(params);
}

export async function logCommercialAudit(params: AuditWriteParams): Promise<ActionResult> {
  return disabledAction(params);
}

export async function logMockAction(
  activity: ActivityWriteParams,
  audit: AuditWriteParams,
): Promise<ActionResult> {
  return disabledAction(activity, audit);
}

export async function markEscalationReviewedMock(
  escalationId: string,
  workspaceId: string,
  escalationName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(escalationId, workspaceId, escalationName, actor);
}

export async function markEscalationBypassMock(
  escalationId: string,
  workspaceId: string,
  escalationName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(escalationId, workspaceId, escalationName, actor);
}

export async function markPnlReviewedMock(
  scenarioId: string,
  workspaceId: string,
  scenarioName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(scenarioId, workspaceId, scenarioName, actor);
}

export async function markProposalReviewedMock(
  proposalId: string,
  workspaceId: string,
  proposalName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(proposalId, workspaceId, proposalName, actor);
}

export async function requestSlaOpsReviewMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(slaId, workspaceId, slaName, actor);
}

export async function requestSlaLegalReviewMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(slaId, workspaceId, slaName, actor);
}

export async function markSlaReviewedMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(slaId, workspaceId, slaName, actor);
}

export async function markPricingLineReviewedMock(
  lineId: string,
  workspaceId: string,
  serviceName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return disabledAction(lineId, workspaceId, serviceName, actor);
}
