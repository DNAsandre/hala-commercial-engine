/**
 * supabase-commercial-actions.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.8).
 *
 * Commercial workspace review actions. Every action:
 *   1. Resolves the canonical proposal ticket in commercial_tickets.
 *   2. Appends a commercial_ticket_audit row recording who did what.
 *   3. Returns { success:true } ONLY when the row was actually written;
 *      any failure comes back as { success:false, error } — never a
 *      pretended success.
 *
 * No gates, no enforcement, no stage mutation: these are audit-recorded
 * human review acknowledgements.
 */

import { supabase } from "./supabase";

export interface ActionActor {
  name: string;
  role: string;
}

// Internal (non-exported) parameter/result shapes — callers use them
// structurally.
interface ActivityWriteParams {
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

interface AuditWriteParams {
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

interface ActionResult {
  success: boolean;
  error?: string;
}

/**
 * Resolve the canonical commercial_tickets row id for a workspace id
 * (which may be the ticket id itself or a legacy workspace id).
 */
async function resolveTicketId(workspaceId: string): Promise<string | null> {
  const byId = await supabase
    .from("commercial_tickets")
    .select("id")
    .eq("id", workspaceId)
    .eq("active", true)
    .limit(1);
  if (!byId.error && byId.data && byId.data.length > 0) return byId.data[0].id;

  const byLegacy = await supabase
    .from("commercial_tickets")
    .select("id")
    .eq("legacy_workspace_id", workspaceId)
    .eq("active", true)
    .limit(1);
  if (!byLegacy.error && byLegacy.data && byLegacy.data.length > 0) return byLegacy.data[0].id;

  return null;
}

/**
 * Append a review-action audit row for the workspace's canonical ticket.
 * Same commercial_ticket_audit field mapping as the established tender
 * action write layer.
 */
async function writeReviewAudit(params: {
  workspaceId: string;
  fieldChanged: string;
  actor: ActionActor;
  notes: string;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<ActionResult> {
  const ticketId = await resolveTicketId(params.workspaceId);
  if (!ticketId) {
    return {
      success: false,
      error: "Canonical ticket not found in commercial_tickets for this workspace. Action was not recorded.",
    };
  }

  const { error } = await supabase.from("commercial_ticket_audit").insert({
    ticket_id: ticketId,
    action: "updated",
    field_changed: params.fieldChanged,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    user_name: params.actor.name,
    notes: params.notes,
  });

  if (error) {
    return { success: false, error: `Audit write failed: ${error.message}` };
  }
  return { success: true };
}

export async function logMockAction(
  activity: ActivityWriteParams,
  audit: AuditWriteParams,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId: audit.workspaceId || activity.workspaceId,
    fieldChanged: audit.eventCode || activity.eventType,
    actor: audit.actor || activity.actor,
    notes: [audit.eventName, audit.description || activity.description, audit.notes]
      .filter(Boolean)
      .join(" — "),
    oldValue: audit.beforeState ?? null,
    newValue: audit.afterState ?? null,
  });
}

export async function markProposalReviewedMock(
  proposalId: string,
  workspaceId: string,
  proposalName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "proposal_review",
    actor,
    notes: `Proposal "${proposalName}" (${proposalId}) marked reviewed by ${actor.name} (${actor.role}).`,
    newValue: "reviewed",
  });
}

export async function markSlaReviewedMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "sla_review",
    actor,
    notes: `SLA "${slaName}" (${slaId}) marked reviewed by ${actor.name} (${actor.role}).`,
    newValue: "reviewed",
  });
}

export async function requestSlaOpsReviewMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "sla_ops_review_request",
    actor,
    notes: `Operations review requested for SLA "${slaName}" (${slaId}) by ${actor.name} (${actor.role}).`,
    newValue: "ops_review_requested",
  });
}

export async function requestSlaLegalReviewMock(
  slaId: string,
  workspaceId: string,
  slaName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "sla_legal_review_request",
    actor,
    notes: `Legal review requested for SLA "${slaName}" (${slaId}) by ${actor.name} (${actor.role}).`,
    newValue: "legal_review_requested",
  });
}

export async function markPricingLineReviewedMock(
  lineId: string,
  workspaceId: string,
  serviceName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "pricing_line_review",
    actor,
    notes: `Pricing line "${serviceName}" (${lineId}) marked reviewed by ${actor.name} (${actor.role}).`,
    newValue: "reviewed",
  });
}

export async function markPnlReviewedMock(
  scenarioId: string,
  workspaceId: string,
  scenarioName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "pnl_review",
    actor,
    notes: `P&L scenario "${scenarioName}" (${scenarioId}) marked reviewed by ${actor.name} (${actor.role}).`,
    newValue: "reviewed",
  });
}

export async function markEscalationReviewedMock(
  escalationId: string,
  workspaceId: string,
  escalationName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "escalation_review",
    actor,
    notes: `Escalation "${escalationName}" (${escalationId}) marked reviewed by ${actor.name} (${actor.role}).`,
    newValue: "reviewed",
  });
}

export async function markEscalationBypassMock(
  escalationId: string,
  workspaceId: string,
  escalationName: string,
  actor: ActionActor,
): Promise<ActionResult> {
  return writeReviewAudit({
    workspaceId,
    fieldChanged: "escalation_bypass_note",
    actor,
    notes: `Advisory bypass noted for escalation "${escalationName}" (${escalationId}) by ${actor.name} (${actor.role}). Advisory record only — nothing was enforced or unlocked.`,
    newValue: "bypass_noted",
  });
}
