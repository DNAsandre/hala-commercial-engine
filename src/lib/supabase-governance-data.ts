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
 * DOCTRINE: policy gates are advisory by default until production enforcement
 * is explicitly approved. The legacy mock_only column is kept only for schema
 * compatibility and must not be used to create fake business truth.
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

/**
 * SC-01 Wave 04 — outcome of a governance read.
 *
 * The bare `fetch*` helpers below return `[]` for BOTH "nothing recorded" and
 * "the read failed", which let the Governance Console render a broken read as
 * a confident "0 gates configured". The `*Result` variants keep the same
 * queries but report which of the three things actually happened, so the
 * console can show three visibly different states.
 *
 * `empty` means "no rows were visible to this account" — never "the table is
 * empty", because row-level security can hide rows from the current client.
 */
export type GovernanceRead<T> =
  | { status: "loaded"; rows: T[] }
  | { status: "empty"; rows: [] }
  | { status: "error"; rows: []; error: string };

function classifyGovernanceRead<T>(
  data: T[] | null,
  error: { message?: string } | null,
): GovernanceRead<T> {
  if (error) {
    return { status: "error", rows: [], error: error.message || "Unknown Supabase error" };
  }
  const rows = data ?? [];
  if (rows.length === 0) return { status: "empty", rows: [] };
  return { status: "loaded", rows };
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
export async function fetchPolicyGatesResult(): Promise<GovernanceRead<SupabasePolicyGate>> {
  const { data, error } = await supabase
    .from('governance_policy_gates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) console.warn('[SUPA-009] Failed to fetch policy gates:', error.message);
  return classifyGovernanceRead(data as SupabasePolicyGate[] | null, error);
}

export async function fetchPolicyGates(): Promise<SupabasePolicyGate[]> {
  return (await fetchPolicyGatesResult()).rows;
}

/**
 * Policy-gate configuration writes are EXCLUDED — refusal, not a stub.
 *
 * SC-01 Wave 02 boundary (SX-011), reaffirmed by the Wave 06 architect
 * correction #3 (2026-08-18): writes to gate mode, overridable state or gate
 * configuration are excluded from this build. Zero writes, zero audit entries,
 * no version bump — the refusal is returned honestly for the caller to
 * display, and the stored gate records remain visible as advisory display
 * (A-26). Reads (fetchPolicyGates, fetchGovernanceAuditLog) remain real.
 */
export async function updatePolicyGateConfig(
  gateId: string,
  updates: { mode?: GateMode; overridable?: boolean },
  reason: string = "Admin Console change",
): Promise<ActionResult> {
  void gateId; void updates; void reason;
  return {
    success: false,
    error:
      "Policy-gate configuration writes are excluded from this build (Wave 06 architect correction #3; SX-011). " +
      "Nothing was changed — stored gate records are advisory display only.",
  };
}

// ─── Governance Audit Log ────────────────────────────────────

/**
 * Fetch governance audit log entries, most recent first.
 */
export async function fetchGovernanceAuditLogResult(
  limit: number = 200,
): Promise<GovernanceRead<SupabaseGovernanceAuditEntry>> {
  const { data, error } = await supabase
    .from('governance_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) console.warn('[SUPA-009] Failed to fetch governance audit log:', error.message);
  return classifyGovernanceRead(data as SupabaseGovernanceAuditEntry[] | null, error);
}

export async function fetchGovernanceAuditLog(limit: number = 200): Promise<SupabaseGovernanceAuditEntry[]> {
  return (await fetchGovernanceAuditLogResult(limit)).rows;
}

/**
 * Insert a governance audit log entry.
 * Keeps legacy mock_only false. Advisory behavior is controlled by gate mode,
 * not by creating mock business records.
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
    mock_only: false,
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
 * SC-01 Wave 06 (T14, manifest row A-35) — classified tender-config read.
 *
 * Same query the legacy helper ran, but the outcome is reported instead of
 * being collapsed to `[]`: the Tender Config tab must render a failed read,
 * a zero-row read and real rows as three visibly different screens. The live
 * table exists with 4 rows (tgc-tender_templates, tgc-tender_gate_rules,
 * tgc-tender_compliance_categories, tgc-tender_role_matrix; probed
 * 2026-08-18) — this read is the display's ONLY source; nothing is hardcoded.
 */
export async function fetchTenderGovernanceConfigResult(): Promise<GovernanceRead<GovernanceConfigEntry>> {
  const { data, error } = await supabase
    .from('tender_governance_config')
    .select('*')
    .order('config_key');

  if (error) console.warn('[SUPA-009] Failed to fetch tender governance config:', error.message);
  return classifyGovernanceRead(data as GovernanceConfigEntry[] | null, error);
}

export async function fetchTenderGovernanceConfig(): Promise<GovernanceConfigEntry[]> {
  return (await fetchTenderGovernanceConfigResult()).rows;
}

/**
 * Tender governance config writes are EXCLUDED — refusal, not a stub.
 * SC-01 Wave 02 boundary (SX-011); the Wave 06 Tender Config tab is an
 * advisory read-only view (A-35) and never calls this.
 */
export async function upsertTenderGovernanceConfig(
  configKey: string,
  configValue: any,
  category: string = "",
  description: string = "",
): Promise<ActionResult> {
  void configKey; void configValue; void category; void description;
  return {
    success: false,
    error:
      "Governance configuration writes are excluded from this build (SX-011). " +
      "Nothing was changed — stored configuration is advisory display only.",
  };
}

// ─── Commercial Governance Config ────────────────────────────

/**
 * Fetch all commercial governance config entries.
 */
export async function fetchCommercialGovernanceConfigResult(): Promise<GovernanceRead<GovernanceConfigEntry>> {
  const { data, error } = await supabase
    .from('commercial_governance_config')
    .select('*')
    .order('config_key');

  if (error) console.warn('[SUPA-009] Failed to fetch commercial governance config:', error.message);
  return classifyGovernanceRead(data as GovernanceConfigEntry[] | null, error);
}

export async function fetchCommercialGovernanceConfig(): Promise<GovernanceConfigEntry[]> {
  return (await fetchCommercialGovernanceConfigResult()).rows;
}

/**
 * Commercial governance config writes are EXCLUDED — refusal, not a stub.
 * SC-01 Wave 02 boundary (SX-011): zero writes; honest refusal.
 */
export async function upsertCommercialGovernanceConfig(
  configKey: string,
  configValue: any,
  category: string = "",
  description: string = "",
): Promise<ActionResult> {
  void configKey; void configValue; void category; void description;
  return {
    success: false,
    error:
      "Governance configuration writes are excluded from this build (SX-011). " +
      "Nothing was changed — stored configuration is advisory display only.",
  };
}
