/**
 * ECR Evolution Patch — Human-Controlled, Manual-Only, No AI Creep
 * ================================================================
 * Part A: Evolution controls on rule sets
 * Part B: Deterministic scoring with missing metric modes + confidence
 * Part C: Manual upgrade flow with RBAC + immutable audit
 * Part D: API-style functions (request/approve/reject)
 * Part E: AI isolation enforcement for ECR
 *
 * HARD RULES:
 * - ECR scoring is deterministic (arithmetic only)
 * - AI can only explain, never compute or change scoring logic
 * - All evolution controls are Admin-configurable
 * - No automatic upgrades of in-flight renewals/proposals/SLAs. Ever.
 * - Upgrading rule version is manual and requires explicit human approval + audit.
 */

import { nanoid } from "nanoid";
import type { UserRole } from "./store";
import {
  mockRuleSets,
  mockRuleWeights,
  mockMetrics,
  mockInputValues,
  mockSnapshots,
  mockScores,
  type EcrRuleSet,
  type EcrRuleWeight,
  type EcrMetric,
  type EcrInputValue,
  type EcrScore,
  type Grade,
  type EcrScoreBreakdown,
} from "./ecr";
import { governanceAuditLog } from "./governance";

// ============================================================
// PART A — EVOLUTION CONTROLS ON RULE SETS
// ============================================================

export type MissingMetricMode = "strict" | "graceful_reweight" | "default_value";
export type DefaultValueStrategy = "zero" | "neutral" | "custom";

/**
 * Evolution controls attached to each rule set.
 * Stored alongside the rule set — configurable by Admin only.
 */
export interface EvolutionControls {
  ruleSetId: string;
  evolution_enabled: boolean;
  missing_metric_mode: MissingMetricMode;
  missing_metric_default_strategy: DefaultValueStrategy;
  missing_metric_confidence_penalty_per_metric: number;
  min_confidence_to_display_grade: number;
  manual_upgrade_required: boolean; // Must always be true in v1
}

/**
 * Default evolution controls for each rule set.
 * Stored in a map keyed by ruleSetId.
 */
export const evolutionControlsMap: Map<string, EvolutionControls> = new Map();

// Initialize defaults for existing rule sets
mockRuleSets.forEach((rs) => {
  evolutionControlsMap.set(rs.id, {
    ruleSetId: rs.id,
    evolution_enabled: false,
    missing_metric_mode: "strict",
    missing_metric_default_strategy: "neutral",
    missing_metric_confidence_penalty_per_metric: 0.05,
    min_confidence_to_display_grade: 0.5,
    manual_upgrade_required: true,
  });
});

// Enable evolution on the active rule set (rs-2) for demo
const activeControls = evolutionControlsMap.get("rs-2");
if (activeControls) {
  activeControls.evolution_enabled = true;
  activeControls.missing_metric_mode = "graceful_reweight";
}

/**
 * Get evolution controls for a rule set.
 */
export function getEvolutionControls(ruleSetId: string): EvolutionControls {
  const existing = evolutionControlsMap.get(ruleSetId);
  if (existing) return existing;
  // Return defaults if not configured
  const defaults: EvolutionControls = {
    ruleSetId,
    evolution_enabled: false,
    missing_metric_mode: "strict",
    missing_metric_default_strategy: "neutral",
    missing_metric_confidence_penalty_per_metric: 0.05,
    min_confidence_to_display_grade: 0.5,
    manual_upgrade_required: true,
  };
  evolutionControlsMap.set(ruleSetId, defaults);
  return defaults;
}

/**
 * Update evolution controls for a rule set (Admin only).
 */
export function updateEvolutionControls(
  ruleSetId: string,
  updates: Partial<Omit<EvolutionControls, "ruleSetId" | "manual_upgrade_required">>,
  userId: string,
  userName: string
): { success: boolean; error?: string } {
  const controls = getEvolutionControls(ruleSetId);

  // Apply updates (manual_upgrade_required stays true always)
  if (updates.evolution_enabled !== undefined) controls.evolution_enabled = updates.evolution_enabled;
  if (updates.missing_metric_mode !== undefined) controls.missing_metric_mode = updates.missing_metric_mode;
  if (updates.missing_metric_default_strategy !== undefined) controls.missing_metric_default_strategy = updates.missing_metric_default_strategy;
  if (updates.missing_metric_confidence_penalty_per_metric !== undefined) {
    controls.missing_metric_confidence_penalty_per_metric = Math.max(0, Math.min(1, updates.missing_metric_confidence_penalty_per_metric));
  }
  if (updates.min_confidence_to_display_grade !== undefined) {
    controls.min_confidence_to_display_grade = Math.max(0, Math.min(1, updates.min_confidence_to_display_grade));
  }

  // Audit log
  governanceAuditLog.push({
    id: nanoid(),
    category: "policy_change",
    action: "ecr_evolution_controls_updated",
    entityType: "rule_set",
    entityId: ruleSetId,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details: `Evolution controls updated for rule set ${ruleSetId}: ${JSON.stringify(updates)}`,
    metadata: { ruleSetId, updates },
  });

  return { success: true };
}

// ============================================================
// PART B — DETERMINISTIC SCORING WITH MISSING METRIC MODES
// ============================================================

export type ComputeStatus = "computed" | "blocked";

export interface EvolutionScoreResult {
  status: ComputeStatus;
  ecr_score_id?: string;
  total_score?: number;
  grade?: Grade;
  confidence_score: number;
  missing_metrics: string[];
  mode_used: MissingMetricMode;
  breakdown: EcrScoreBreakdown[];
  blocked_reason?: string;
  meets_display_threshold: boolean;
}

/**
 * Normalize a raw metric value to a 0-100 scale.
 * Purely arithmetic — no AI involved.
 */
function normalizeValue(metric: EcrMetric, rawValue: number): number {
  const { minValue, maxValue, unit, metricKey } = metric;
  const inverseMetrics = ["dso_days", "dispute_rate"];
  const isInverse = inverseMetrics.includes(metricKey);

  if (unit === "band") {
    return Math.min(100, Math.max(0, ((rawValue - minValue) / (maxValue - minValue)) * 100));
  }

  const clamped = Math.min(maxValue, Math.max(minValue, rawValue));

  if (isInverse) {
    return Math.max(0, ((maxValue - clamped) / (maxValue - minValue)) * 100);
  }

  return Math.max(0, ((clamped - minValue) / (maxValue - minValue)) * 100);
}

/**
 * Calculate grade from total score.
 */
function calculateGrade(score: number): Grade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

/**
 * Get the neutral default value for a metric (midpoint of range).
 */
function getNeutralDefault(metric: EcrMetric): number {
  return (metric.minValue + metric.maxValue) / 2;
}

/**
 * Compute ECR score with evolution rules applied.
 * DETERMINISTIC — arithmetic only, no AI.
 *
 * Implements the 3 missing metric modes:
 * 1. strict — block if any required metric is missing
 * 2. graceful_reweight — exclude missing, renormalize remaining weights to 100
 * 3. default_value — fill missing with deterministic defaults
 */
export function computeEcrWithEvolution(
  snapshotId: string,
  ruleSetId: string,
  metrics: EcrMetric[] = mockMetrics,
  weights: EcrRuleWeight[] = mockRuleWeights,
  values: EcrInputValue[] = mockInputValues
): EvolutionScoreResult {
  const controls = getEvolutionControls(ruleSetId);
  const ruleWeights = weights.filter((w) => w.ruleSetId === ruleSetId);
  const snapshotValues = values.filter((v) => v.snapshotId === snapshotId);
  const activeMetrics = metrics.filter((m) => m.active);

  // Identify missing metrics
  const missingMetrics: string[] = [];
  const presentMetrics: { metric: EcrMetric; weight: EcrRuleWeight; value: number }[] = [];

  for (const rw of ruleWeights) {
    const metric = activeMetrics.find((m) => m.id === rw.metricId);
    if (!metric) continue;

    const inputValue = snapshotValues.find((v) => v.metricId === rw.metricId);
    if (inputValue) {
      presentMetrics.push({ metric, weight: rw, value: inputValue.value });
    } else {
      missingMetrics.push(metric.metricKey);
    }
  }

  const missingCount = missingMetrics.length;
  const mode = controls.evolution_enabled ? controls.missing_metric_mode : "strict";

  // Calculate confidence: 1.0 - (missing_count * penalty_per_metric), clamped [0, 1]
  const penalty = controls.missing_metric_confidence_penalty_per_metric;
  const confidence = Math.max(0, Math.min(1, 1.0 - missingCount * penalty));
  const meetsThreshold = confidence >= controls.min_confidence_to_display_grade;

  // MODE 1: STRICT — block if any metric missing
  if (mode === "strict" && missingCount > 0) {
    return {
      status: "blocked",
      confidence_score: confidence,
      missing_metrics: missingMetrics,
      mode_used: "strict",
      breakdown: [],
      blocked_reason: `Missing metrics: ${missingMetrics.join(", ")}. Strict mode requires all metrics.`,
      meets_display_threshold: false,
    };
  }

  // MODE 2: GRACEFUL REWEIGHT — exclude missing, renormalize
  if (mode === "graceful_reweight") {
    const totalPresentWeight = presentMetrics.reduce((sum, p) => sum + p.weight.weight, 0);
    const renormFactor = totalPresentWeight > 0 ? 100 / totalPresentWeight : 0;

    const breakdown: EcrScoreBreakdown[] = [];
    let totalScore = 0;

    for (const { metric, weight, value } of presentMetrics) {
      const normalized = normalizeValue(metric, value);
      const adjustedWeight = weight.weight * renormFactor;
      const weightedScore = (normalized * adjustedWeight) / 100;

      breakdown.push({
        metricKey: metric.metricKey,
        displayName: metric.displayName,
        value,
        weight: Math.round(adjustedWeight * 100) / 100,
        weightedScore: Math.round(weightedScore * 100) / 100,
        unit: metric.unit,
      });

      totalScore += weightedScore;
    }

    totalScore = Math.round(totalScore * 100) / 100;
    const grade = calculateGrade(totalScore);
    const scoreId = `evo-score-${nanoid(6)}`;

    return {
      status: "computed",
      ecr_score_id: scoreId,
      total_score: totalScore,
      grade,
      confidence_score: Math.round(confidence * 100) / 100,
      missing_metrics: missingMetrics,
      mode_used: "graceful_reweight",
      breakdown,
      meets_display_threshold: meetsThreshold,
    };
  }

  // MODE 3: DEFAULT VALUE — fill missing with deterministic defaults
  if (mode === "default_value") {
    const breakdown: EcrScoreBreakdown[] = [];
    let totalScore = 0;

    // Process present metrics
    for (const { metric, weight, value } of presentMetrics) {
      const normalized = normalizeValue(metric, value);
      const weightedScore = (normalized * weight.weight) / 100;

      breakdown.push({
        metricKey: metric.metricKey,
        displayName: metric.displayName,
        value,
        weight: weight.weight,
        weightedScore: Math.round(weightedScore * 100) / 100,
        unit: metric.unit,
      });

      totalScore += weightedScore;
    }

    // Process missing metrics with defaults
    for (const missingKey of missingMetrics) {
      const metric = activeMetrics.find((m) => m.metricKey === missingKey);
      if (!metric) continue;
      const rw = ruleWeights.find((w) => w.metricId === metric.id);
      if (!rw) continue;

      let defaultValue: number;
      switch (controls.missing_metric_default_strategy) {
        case "zero":
          defaultValue = 0;
          break;
        case "neutral":
          defaultValue = getNeutralDefault(metric);
          break;
        case "custom":
          // In v1, custom falls back to neutral
          defaultValue = getNeutralDefault(metric);
          break;
      }

      const normalized = normalizeValue(metric, defaultValue);
      const weightedScore = (normalized * rw.weight) / 100;

      breakdown.push({
        metricKey: metric.metricKey,
        displayName: metric.displayName,
        value: defaultValue,
        weight: rw.weight,
        weightedScore: Math.round(weightedScore * 100) / 100,
        unit: metric.unit,
      });

      totalScore += weightedScore;
    }

    totalScore = Math.round(totalScore * 100) / 100;
    const grade = calculateGrade(totalScore);
    const scoreId = `evo-score-${nanoid(6)}`;

    return {
      status: "computed",
      ecr_score_id: scoreId,
      total_score: totalScore,
      grade,
      confidence_score: Math.round(confidence * 100) / 100,
      missing_metrics: missingMetrics,
      mode_used: "default_value",
      breakdown,
      meets_display_threshold: meetsThreshold,
    };
  }

  // Default: no missing metrics, standard computation
  const breakdown: EcrScoreBreakdown[] = [];
  let totalScore = 0;

  for (const { metric, weight, value } of presentMetrics) {
    const normalized = normalizeValue(metric, value);
    const weightedScore = (normalized * weight.weight) / 100;

    breakdown.push({
      metricKey: metric.metricKey,
      displayName: metric.displayName,
      value,
      weight: weight.weight,
      weightedScore: Math.round(weightedScore * 100) / 100,
      unit: metric.unit,
    });

    totalScore += weightedScore;
  }

  totalScore = Math.round(totalScore * 100) / 100;
  const grade = calculateGrade(totalScore);
  const scoreId = `evo-score-${nanoid(6)}`;

  return {
    status: "computed",
    ecr_score_id: scoreId,
    total_score: totalScore,
    grade,
    confidence_score: Math.round(confidence * 100) / 100,
    missing_metrics: missingMetrics,
    mode_used: mode,
    breakdown,
    meets_display_threshold: meetsThreshold,
  };
}

// ============================================================
// PART C — MANUAL UPGRADE FLOW (IMMUTABLE AUDIT)
// ============================================================

export type UpgradeStatus = "requested" | "approved" | "rejected";
export type UpgradeContextType = "renewal" | "proposal" | "sla";

export interface EcrRuleUpgradeEvent {
  id: string;
  context_type: UpgradeContextType;
  context_id: string;
  customer_id: string;
  customer_name: string;
  from_rule_set_id: string;
  from_rule_set_name: string;
  to_rule_set_id: string;
  to_rule_set_name: string;
  from_ecr_score_id: string;
  to_ecr_score_id: string | null;
  requested_by: string;
  requested_by_role: UserRole;
  requested_at: string;
  approved_by: string | null;
  approved_by_role: UserRole | null;
  approved_at: string | null;
  reason: string;
  approval_reason: string | null;
  rejection_reason: string | null;
  status: UpgradeStatus;
  rule_set_locked_snapshot: {
    from: { id: string; name: string; version: number; weights: Record<string, number> };
    to: { id: string; name: string; version: number; weights: Record<string, number> };
  };
  // Impact summary (computed at request time)
  impact_summary: {
    from_score: number;
    from_grade: Grade;
    to_score: number | null;
    to_grade: Grade | null;
    to_confidence: number | null;
    to_missing_metrics: string[];
    score_delta: number | null;
  };
}

// Immutable store for upgrade events
export const ecrUpgradeEvents: EcrRuleUpgradeEvent[] = [];

// Roles allowed to request upgrades
export const upgradeRequestRoles: UserRole[] = ["regional_sales_head", "director", "ceo_cfo", "admin"];

// Roles allowed to approve upgrades
export const upgradeApprovalRoles: UserRole[] = ["director", "ceo_cfo", "admin"];

/**
 * Estimate the impact of upgrading to a new rule set.
 * Returns the estimated new score, grade, confidence, and missing metrics.
 * DETERMINISTIC — no AI.
 */
export function estimateUpgradeImpact(
  customerId: string,
  fromRuleSetId: string,
  toRuleSetId: string
): {
  from_score: number;
  from_grade: Grade;
  to_score: number | null;
  to_grade: Grade | null;
  to_confidence: number | null;
  to_missing_metrics: string[];
  score_delta: number | null;
} | null {
  // Find the latest snapshot for this customer
  const customerSnapshots = mockSnapshots
    .filter((s) => s.customerId === customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (customerSnapshots.length === 0) return null;

  const latestSnapshot = customerSnapshots[0];

  // Get current score with from rule set
  const fromResult = computeEcrWithEvolution(latestSnapshot.id, fromRuleSetId);
  const fromScore = fromResult.total_score ?? 0;
  const fromGrade = fromResult.grade ?? "D";

  // Compute estimated score with to rule set
  const toResult = computeEcrWithEvolution(latestSnapshot.id, toRuleSetId);

  if (toResult.status === "blocked") {
    return {
      from_score: fromScore,
      from_grade: fromGrade,
      to_score: null,
      to_grade: null,
      to_confidence: toResult.confidence_score,
      to_missing_metrics: toResult.missing_metrics,
      score_delta: null,
    };
  }

  return {
    from_score: fromScore,
    from_grade: fromGrade,
    to_score: toResult.total_score!,
    to_grade: toResult.grade!,
    to_confidence: toResult.confidence_score,
    to_missing_metrics: toResult.missing_metrics,
    score_delta: Math.round((toResult.total_score! - fromScore) * 100) / 100,
  };
}

/**
 * Request an ECR rule version upgrade.
 * Creates an immutable upgrade event with status "requested".
 * No silent upgrades. No auto apply.
 */
export function requestUpgrade(params: {
  context_type: UpgradeContextType;
  context_id: string;
  customer_id: string;
  customer_name: string;
  from_rule_set_id: string;
  to_rule_set_id: string;
  reason: string;
  userId: string;
  userName: string;
  userRole: UserRole;
}): { success: boolean; upgrade_event_id?: string; error?: string } {
  // Validate role
  if (!upgradeRequestRoles.includes(params.userRole)) {
    return { success: false, error: `Role "${params.userRole}" is not authorized to request ECR upgrades` };
  }

  // Validate reason
  if (!params.reason || params.reason.trim().length < 10) {
    return { success: false, error: "Upgrade reason is mandatory and must be at least 10 characters" };
  }

  // Validate rule sets exist
  const fromRuleSet = mockRuleSets.find((rs) => rs.id === params.from_rule_set_id);
  const toRuleSet = mockRuleSets.find((rs) => rs.id === params.to_rule_set_id);
  if (!fromRuleSet || !toRuleSet) {
    return { success: false, error: "Invalid rule set ID(s)" };
  }

  // Check target is active
  if (toRuleSet.status !== "active") {
    return { success: false, error: `Target rule set "${toRuleSet.name}" is not active (status: ${toRuleSet.status})` };
  }

  // Check not same rule set
  if (params.from_rule_set_id === params.to_rule_set_id) {
    return { success: false, error: "Cannot upgrade to the same rule set" };
  }

  // Get current score
  const currentScore = mockScores.find(
    (s) => s.customerId === params.customer_id && s.ruleSetId === params.from_rule_set_id
  );

  // Estimate impact
  const impact = estimateUpgradeImpact(params.customer_id, params.from_rule_set_id, params.to_rule_set_id);

  // Build weight snapshots
  const fromWeights: Record<string, number> = {};
  mockRuleWeights
    .filter((w) => w.ruleSetId === params.from_rule_set_id)
    .forEach((w) => {
      const metric = mockMetrics.find((m) => m.id === w.metricId);
      if (metric) fromWeights[metric.metricKey] = w.weight;
    });

  const toWeights: Record<string, number> = {};
  mockRuleWeights
    .filter((w) => w.ruleSetId === params.to_rule_set_id)
    .forEach((w) => {
      const metric = mockMetrics.find((m) => m.id === w.metricId);
      if (metric) toWeights[metric.metricKey] = w.weight;
    });

  const event: EcrRuleUpgradeEvent = {
    id: nanoid(),
    context_type: params.context_type,
    context_id: params.context_id,
    customer_id: params.customer_id,
    customer_name: params.customer_name,
    from_rule_set_id: params.from_rule_set_id,
    from_rule_set_name: fromRuleSet.name,
    to_rule_set_id: params.to_rule_set_id,
    to_rule_set_name: toRuleSet.name,
    from_ecr_score_id: currentScore?.id || "unknown",
    to_ecr_score_id: null,
    requested_by: params.userName,
    requested_by_role: params.userRole,
    requested_at: new Date().toISOString(),
    approved_by: null,
    approved_by_role: null,
    approved_at: null,
    reason: params.reason.trim(),
    approval_reason: null,
    rejection_reason: null,
    status: "requested",
    rule_set_locked_snapshot: {
      from: { id: fromRuleSet.id, name: fromRuleSet.name, version: fromRuleSet.versionNumber, weights: fromWeights },
      to: { id: toRuleSet.id, name: toRuleSet.name, version: toRuleSet.versionNumber, weights: toWeights },
    },
    impact_summary: impact || {
      from_score: currentScore?.totalScore || 0,
      from_grade: currentScore?.grade || "D",
      to_score: null,
      to_grade: null,
      to_confidence: null,
      to_missing_metrics: [],
      score_delta: null,
    },
  };

  ecrUpgradeEvents.push(event);

  // Audit log
  governanceAuditLog.push({
    id: nanoid(),
    category: "write_action",
    action: "ecr_upgrade_requested",
    entityType: params.context_type,
    entityId: params.context_id,
    userId: params.userId,
    userName: params.userName,
    timestamp: event.requested_at,
    details: `ECR upgrade requested: ${fromRuleSet.name} → ${toRuleSet.name} for ${params.customer_name}. Reason: ${params.reason}`,
    metadata: { upgradeEventId: event.id, fromRuleSetId: params.from_rule_set_id, toRuleSetId: params.to_rule_set_id },
  });

  return { success: true, upgrade_event_id: event.id };
}

/**
 * Approve an ECR upgrade request.
 * RBAC protected. Computes new score deterministically.
 */
export function approveUpgrade(
  upgradeEventId: string,
  userId: string,
  userName: string,
  userRole: UserRole,
  approvalReason: string
): { success: boolean; to_ecr_score_id?: string; error?: string } {
  // Validate role
  if (!upgradeApprovalRoles.includes(userRole)) {
    return { success: false, error: `Role "${userRole}" is not authorized to approve ECR upgrades` };
  }

  const event = ecrUpgradeEvents.find((e) => e.id === upgradeEventId);
  if (!event) return { success: false, error: "Upgrade event not found" };
  if (event.status !== "requested") return { success: false, error: `Cannot approve: status is "${event.status}"` };

  // Cannot self-approve
  if (event.requested_by === userName) {
    return { success: false, error: "Cannot approve your own upgrade request" };
  }

  // Compute new score with target rule set
  const customerSnapshots = mockSnapshots
    .filter((s) => s.customerId === event.customer_id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (customerSnapshots.length === 0) {
    return { success: false, error: "No snapshot data available for this customer" };
  }

  const latestSnapshot = customerSnapshots[0];
  const result = computeEcrWithEvolution(latestSnapshot.id, event.to_rule_set_id);

  if (result.status === "blocked") {
    return { success: false, error: `Cannot compute new score: ${result.blocked_reason}` };
  }

  // Create new EcrScore record
  const newScore: EcrScore = {
    id: result.ecr_score_id!,
    customerId: event.customer_id,
    snapshotId: latestSnapshot.id,
    ruleSetId: event.to_rule_set_id,
    totalScore: result.total_score!,
    grade: result.grade!,
    confidenceScore: Math.round(result.confidence_score * 100),
    computedAt: new Date().toISOString(),
    computedBySystem: false, // Human-triggered
  };
  mockScores.push(newScore);

  // Update event
  event.status = "approved";
  event.approved_by = userName;
  event.approved_by_role = userRole;
  event.approved_at = new Date().toISOString();
  event.approval_reason = approvalReason;
  event.to_ecr_score_id = newScore.id;
  event.impact_summary.to_score = result.total_score!;
  event.impact_summary.to_grade = result.grade!;
  event.impact_summary.to_confidence = result.confidence_score;
  event.impact_summary.score_delta = Math.round((result.total_score! - event.impact_summary.from_score) * 100) / 100;

  // Audit log
  governanceAuditLog.push({
    id: nanoid(),
    category: "override",
    action: "ecr_upgrade_approved",
    entityType: event.context_type,
    entityId: event.context_id,
    userId,
    userName,
    timestamp: event.approved_at,
    details: `ECR upgrade APPROVED: ${event.from_rule_set_name} → ${event.to_rule_set_name} for ${event.customer_name}. Score: ${event.impact_summary.from_score} → ${result.total_score}`,
    metadata: { upgradeEventId, newScoreId: newScore.id, approvalReason },
  });

  return { success: true, to_ecr_score_id: newScore.id };
}

/**
 * Reject an ECR upgrade request.
 */
export function rejectUpgrade(
  upgradeEventId: string,
  userId: string,
  userName: string,
  userRole: UserRole,
  rejectionReason: string
): { success: boolean; error?: string } {
  if (!upgradeApprovalRoles.includes(userRole)) {
    return { success: false, error: `Role "${userRole}" is not authorized to reject ECR upgrades` };
  }

  const event = ecrUpgradeEvents.find((e) => e.id === upgradeEventId);
  if (!event) return { success: false, error: "Upgrade event not found" };
  if (event.status !== "requested") return { success: false, error: `Cannot reject: status is "${event.status}"` };

  if (!rejectionReason || rejectionReason.trim().length < 5) {
    return { success: false, error: "Rejection reason is required" };
  }

  event.status = "rejected";
  event.approved_by = userName;
  event.approved_by_role = userRole;
  event.approved_at = new Date().toISOString();
  event.rejection_reason = rejectionReason.trim();

  // Audit log
  governanceAuditLog.push({
    id: nanoid(),
    category: "override",
    action: "ecr_upgrade_rejected",
    entityType: event.context_type,
    entityId: event.context_id,
    userId,
    userName,
    timestamp: event.approved_at,
    details: `ECR upgrade REJECTED: ${event.from_rule_set_name} → ${event.to_rule_set_name} for ${event.customer_name}. Reason: ${rejectionReason}`,
    metadata: { upgradeEventId, rejectionReason },
  });

  return { success: true };
}

/**
 * Get all upgrade events, optionally filtered.
 */
export function getUpgradeEvents(filters?: {
  status?: UpgradeStatus;
  context_type?: UpgradeContextType;
  customer_id?: string;
}): EcrRuleUpgradeEvent[] {
  let events = [...ecrUpgradeEvents];
  if (filters?.status) events = events.filter((e) => e.status === filters.status);
  if (filters?.context_type) events = events.filter((e) => e.context_type === filters.context_type);
  if (filters?.customer_id) events = events.filter((e) => e.customer_id === filters.customer_id);
  return events.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
}

/**
 * Get pending upgrade requests count.
 */
export function getPendingUpgradeCount(): number {
  return ecrUpgradeEvents.filter((e) => e.status === "requested").length;
}

// ============================================================
// PART E — AI ISOLATION FOR ECR (No AI Creep)
// ============================================================

/**
 * Actions that bots/AI are BLOCKED from performing on ECR.
 */
export const ecrAiBlockedActions = [
  "edit_rule_sets",
  "change_metric_weights",
  "change_input_values",
  "request_upgrades",
  "approve_upgrades",
  "reject_upgrades",
  "activate_rule_set",
  "modify_evolution_controls",
];

/**
 * Actions that bots/AI ARE allowed to perform.
 */
export const ecrAiAllowedActions = [
  "explain_score",
  "generate_score_summary",
  "compare_rule_sets",
  "format_report",
];

/**
 * Check if an AI/bot action is allowed on ECR.
 */
export function checkEcrAiIsolation(
  origin: "user" | "bot" | "ai_service" | "system",
  action: string
): { allowed: boolean; reason: string } {
  if (origin === "user" || origin === "system") {
    return { allowed: true, reason: "Human/system origin — access granted" };
  }

  if (ecrAiBlockedActions.includes(action)) {
    governanceAuditLog.push({
      id: nanoid(),
      category: "ai_restriction",
      action: "ecr_ai_isolation_blocked",
      entityType: "system",
      entityId: "ecr",
      userId: "system",
      userName: `AI/${origin}`,
      timestamp: new Date().toISOString(),
      details: `ECR AI ISOLATION: ${origin} blocked from "${action}"`,
      metadata: { origin, action },
    });
    return { allowed: false, reason: `${origin} is blocked from "${action}" on ECR` };
  }

  if (ecrAiAllowedActions.includes(action)) {
    return { allowed: true, reason: `Action "${action}" is permitted for ${origin} (read-only/explain)` };
  }

  return { allowed: false, reason: `Unknown action "${action}" — default deny for ${origin}` };
}

// ============================================================
// SEED DATA — Demo upgrade events
// ============================================================

// Seed one historical approved upgrade for Sadara
ecrUpgradeEvents.push({
  id: "eue-1",
  context_type: "renewal",
  context_id: "rw-sadara-1",
  customer_id: "cust-sabic",
  customer_name: "SABIC",
  from_rule_set_id: "rs-1",
  from_rule_set_name: "ECR Standard v1",
  to_rule_set_id: "rs-2",
  to_rule_set_name: "ECR Standard v2",
  from_ecr_score_id: "score-snap-6",
  to_ecr_score_id: "score-snap-1",
  requested_by: "Ra'ed Al-Harbi",
  requested_by_role: "regional_sales_head",
  requested_at: "2025-03-15T10:00:00Z",
  approved_by: "Mohammed Al-Qahtani",
  approved_by_role: "director",
  approved_at: "2025-03-15T14:30:00Z",
  reason: "New rule set v2 better reflects current commercial priorities with increased GP% weighting.",
  approval_reason: "Approved — v2 alignment with strategic direction confirmed.",
  rejection_reason: null,
  status: "approved",
  rule_set_locked_snapshot: {
    from: { id: "rs-1", name: "ECR Standard v1", version: 1, weights: { gp_percent: 20, revenue_growth: 15, dso_days: 15, contract_tenure: 15, sla_compliance: 10, volume_utilization: 10, dispute_rate: 10, strategic_value: 5 } },
    to: { id: "rs-2", name: "ECR Standard v2", version: 2, weights: { gp_percent: 25, revenue_growth: 15, dso_days: 15, contract_tenure: 10, sla_compliance: 10, volume_utilization: 10, dispute_rate: 10, strategic_value: 5 } },
  },
  impact_summary: {
    from_score: 72.5,
    from_grade: "B",
    to_score: 76.8,
    to_grade: "B",
    to_confidence: 1.0,
    to_missing_metrics: [],
    score_delta: 4.3,
  },
});

// Seed one pending upgrade request for Ma'aden
ecrUpgradeEvents.push({
  id: "eue-2",
  context_type: "renewal",
  context_id: "rw-maaden-1",
  customer_id: "cust-maaden",
  customer_name: "Ma'aden",
  from_rule_set_id: "rs-2",
  from_rule_set_name: "ECR Standard v2",
  to_rule_set_id: "rs-2",
  to_rule_set_name: "ECR Standard v2",
  from_ecr_score_id: "score-snap-3",
  to_ecr_score_id: null,
  requested_by: "Ra'ed Al-Harbi",
  requested_by_role: "regional_sales_head",
  requested_at: "2026-02-10T09:00:00Z",
  approved_by: null,
  approved_by_role: null,
  approved_at: null,
  reason: "Re-score Ma'aden with latest snapshot data under current v2 rule set to get updated ECR grade for renewal negotiation.",
  approval_reason: null,
  rejection_reason: null,
  status: "requested",
  rule_set_locked_snapshot: {
    from: { id: "rs-2", name: "ECR Standard v2", version: 2, weights: { gp_percent: 25, revenue_growth: 15, dso_days: 15, contract_tenure: 10, sla_compliance: 10, volume_utilization: 10, dispute_rate: 10, strategic_value: 5 } },
    to: { id: "rs-2", name: "ECR Standard v2", version: 2, weights: { gp_percent: 25, revenue_growth: 15, dso_days: 15, contract_tenure: 10, sla_compliance: 10, volume_utilization: 10, dispute_rate: 10, strategic_value: 5 } },
  },
  impact_summary: {
    from_score: 51.2,
    from_grade: "C",
    to_score: 51.2,
    to_grade: "C",
    to_confidence: 1.0,
    to_missing_metrics: [],
    score_delta: 0,
  },
});
