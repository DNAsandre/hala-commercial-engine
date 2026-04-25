/**
 * Audit logging helper — Sprint 2 update.
 * 
 * Now maps to the REAL audit_log table columns:
 *   id, entity_type, entity_id, action, user_id, user_name, timestamp, details
 * 
 * Writes real actor identity from the auth middleware.
 * Best-effort — NEVER blocks the user action on failure.
 */

import { supabaseAdmin } from './supabase.js';
import type { AuthenticatedUser } from './auth.js';

export interface AuditEntry {
  /** Authenticated user from middleware (preferred) */
  actor?: AuthenticatedUser;
  /** Fallback actor ID if no auth user */
  actorId?: string;
  /** Fallback actor name */
  actorName?: string;
  /** What happened */
  action: string;
  /** Entity type (customer, workspace, escalation, etc.) */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** State before change */
  before?: Record<string, any> | null;
  /** State after change */
  after?: Record<string, any> | null;
  /** Who/what triggered this: human, system, bot */
  source?: 'human' | 'system' | 'bot' | 'api';
}

/**
 * Write an audit log entry. Best-effort — never throws.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    // Resolve actor identity — prefer auth user, fall back to explicit IDs
    const userId = entry.actor?.userId || entry.actorId || 'unknown';
    const userName = entry.actor?.name || entry.actorName || 'Unknown';

    // Build details object with before/after + source
    const details: Record<string, any> = {};
    if (entry.before) details.before = entry.before;
    if (entry.after) details.after = entry.after;
    if (entry.source) details.source = entry.source;
    if (entry.actor?.role) details.actor_role = entry.actor.role;
    if (entry.actor?.region) details.actor_region = entry.actor.region;

    const row = {
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      user_id: userId,
      user_name: userName,
      timestamp: new Date().toISOString(),
      details: Object.keys(details).length > 0 ? JSON.stringify(details) : null,
    };

    const { error } = await supabaseAdmin
      .from('audit_log')
      .insert(row);

    if (error) {
      console.warn('[AUDIT] Failed to write audit log:', error.message);
    }
  } catch (err: any) {
    console.warn('[AUDIT] Unexpected error writing audit log:', err.message);
  }
}
