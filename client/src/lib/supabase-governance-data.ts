/**
 * supabase-governance-data.ts
 * ──────────────────────────
 * SUPA-009: Governance Config Supabase Read/Write Layer
 *
 * Reads and persists governance configuration:
 *   - Policy gates (mode, overridable, version history)
 *   - Governance audit log
 *   - Tender governance config (reference data)
 *   - Commercial governance config (reference data)
 *
 * DOCTRINE: mock_only is ALWAYS true. No production enforcement.
 * All failures return { success: false, error } — no throws.
 */

import { supabase } from './supabase';
import { getCurrentUser } from './auth-state';
import type { GateMode } from './store';

// ─── Types ───────────────────────────────────────────────────

export interface SupabasePolicyGate {
  id: string;
  gate_name: string;
  description: string;
  mode: string;
  overridable: boolean;
  scope: { regions: string | string[]; businessUnits: string | string[] };
  rule_version: number;
  rule_version_history: Array<{
    version: number;
    mode: string;
    overridable: boolean;
    changedBy: string;
    changedAt: string;
    reason: string;
  }>;
  mock_only: boolean;
  visible: boolean;
  sort_order: number;
  tooltip_text: string;
  future_enforcement_note: string;
  override_label: string;
  requires_reason_mock: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface SupabaseGovernanceAuditEntry {
  id: string;
  category: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_name: string;
  details: string;
  metadata: Record<string, any>;
  mock_only: boolean;
  created_at: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID().slice(0, 12);
}

function actor() {
  const u = getCurrentUser();
  return { userId: u?.id ?? '', userName: u?.name ?? 'System' };
}

// ─── Policy Gates ────────────────────────────────────────────

/**
 * Fetch all policy gates from Supabase, ordered by sort_order.
 */
export async function fetchPolicyGates(): Promise<SupabasePolicyGate[]> {
  const { data, error } = await supabase
    .from('governance_policy_gates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('[SUPA-009] Failed to fetch policy gates:', error.message);
    return [];
  }
  return (data ?? []) as SupabasePolicyGate[];
}

/**
 * Update a policy gate's mode and/or overridable flag.
 * Bumps rule_version and appends to version history.
 * Logs to governance_audit_log.
 */
export async function updatePolicyGateConfig(
  gateId: string,
  updates: { mode?: GateMode; overridable?: boolean },
  reason: string = 'Admin Console change',
): Promise<ActionResult> {
  // 1. Fetch current gate
  const { data: current, error: fetchErr } = await supabase
    .from('governance_policy_gates')
    .select('*')
    .eq('id', gateId)
    .single();

  if (fetchErr || !current) {
    return { success: false, error: fetchErr?.message ?? 'Gate not found' };
  }

  const gate = current as SupabasePolicyGate;
  const { userName } = actor();
  const newVersion = gate.rule_version + 1;
  const now = new Date().toISOString();

  // 2. Build new version history entry
  const historyEntry = {
    version: newVersion,
    mode: updates.mode ?? gate.mode,
    overridable: updates.overridable ?? gate.overridable,
    changedBy: userName,
    changedAt: now,
    reason,
  };

  const newHistory = [...(gate.rule_version_history || []), historyEntry];

  // 3. Update gate
  const { error: updateErr } = await supabase
    .from('governance_policy_gates')
    .update({
      mode: updates.mode ?? gate.mode,
      overridable: updates.overridable ?? gate.overridable,
      rule_version: newVersion,
      rule_version_history: newHistory,
      updated_at: now,
      updated_by: userName,
    })
    .eq('id', gateId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // 4. Log to governance audit
  await insertGovernanceAuditEntry({
    category: 'admin_change',
    action: 'gate_config_updated',
    entity_type: 'policy_gate',
    entity_id: gateId,
    details: `Gate "${gate.gate_name}" updated to v${newVersion} — Mode: ${updates.mode ?? gate.mode}, Overridable: ${updates.overridable ?? gate.overridable}. Reason: ${reason}`,
    metadata: { newVersion, updates, reason, previousMode: gate.mode, previousOverridable: gate.overridable },
  });

  return { success: true };
}

// ─── Governance Audit Log ────────────────────────────────────

/**
 * Fetch governance audit log entries, most recent first.
 */
export async function fetchGovernanceAuditLog(limit: number = 200): Promise<SupabaseGovernanceAuditEntry[]> {
  const { data, error } = await supabase
    .from('governance_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[SUPA-009] Failed to fetch governance audit log:', error.message);
    return [];
  }
  return (data ?? []) as SupabaseGovernanceAuditEntry[];
}

/**
 * Insert a governance audit log entry.
 * Always sets mock_only = true.
 */
export async function insertGovernanceAuditEntry(params: {
  category: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const { userId, userName } = actor();
  const { error } = await supabase.from('governance_audit_log').insert({
    id: `gal-${uid()}`,
    category: params.category,
    action: params.action,
    entity_type: params.entity_type ?? '',
    entity_id: params.entity_id ?? '',
    user_id: userId,
    user_name: userName,
    details: params.details ?? '',
    metadata: params.metadata ?? {},
    mock_only: true,
    created_at: new Date().toISOString(),
  });

  if (error) console.warn('[SUPA-009] Governance audit insert failed:', error.message);
}

// ─── Tender Governance Config ────────────────────────────────

export interface GovernanceConfigEntry {
  id: string;
  config_key: string;
  config_value: any;
  category: string;
  description: string;
  is_active: boolean;
  updated_at: string;
}

/**
 * Fetch all tender governance config entries.
 */
export async function fetchTenderGovernanceConfig(): Promise<GovernanceConfigEntry[]> {
  const { data, error } = await supabase
    .from('tender_governance_config')
    .select('*')
    .order('config_key');

  if (error) {
    console.warn('[SUPA-009] Failed to fetch tender governance config:', error.message);
    return [];
  }
  return (data ?? []) as GovernanceConfigEntry[];
}

/**
 * Upsert a tender governance config entry.
 */
export async function upsertTenderGovernanceConfig(
  configKey: string,
  configValue: any,
  category: string = '',
  description: string = '',
): Promise<ActionResult> {
  const { error } = await supabase
    .from('tender_governance_config')
    .upsert({
      id: `tgc-${configKey}`,
      config_key: configKey,
      config_value: configValue,
      category,
      description,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'config_key' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Commercial Governance Config ────────────────────────────

/**
 * Fetch all commercial governance config entries.
 */
export async function fetchCommercialGovernanceConfig(): Promise<GovernanceConfigEntry[]> {
  const { data, error } = await supabase
    .from('commercial_governance_config')
    .select('*')
    .order('config_key');

  if (error) {
    console.warn('[SUPA-009] Failed to fetch commercial governance config:', error.message);
    return [];
  }
  return (data ?? []) as GovernanceConfigEntry[];
}

/**
 * Upsert a commercial governance config entry.
 */
export async function upsertCommercialGovernanceConfig(
  configKey: string,
  configValue: any,
  category: string = '',
  description: string = '',
): Promise<ActionResult> {
  const { error } = await supabase
    .from('commercial_governance_config')
    .upsert({
      id: `cgc-${configKey}`,
      config_key: configKey,
      config_value: configValue,
      category,
      description,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'config_key' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
