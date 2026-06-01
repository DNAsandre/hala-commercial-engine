/**
 * ECR v1 - Existing Customer Rating.
 *
 * This module keeps the deterministic scoring types and helpers, but it does
 * not ship bundled customer/rule/sample data. ECR configuration and snapshots
 * must come from a database-backed source before scores can appear in the app.
 */

export type SourceMode = "manual" | "spreadsheet" | "connector";
export type RuleSetStatus = "draft" | "active" | "archived" | "locked";
export type Grade = "A" | "B" | "C" | "D";
export type MetricUnit = "%" | "days" | "number" | "band";
export type ConnectorType = "finance" | "ops" | "tableau" | "crm" | "custom";
export type ConnectorStatus = "enabled" | "disabled";

export interface EcrMetric {
  id: string;
  metricKey: string;
  displayName: string;
  description: string;
  unit: MetricUnit;
  minValue: number;
  maxValue: number;
  defaultWeight: number;
  defaultSourceMode: SourceMode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EcrRuleSet {
  id: string;
  versionNumber: number;
  name: string;
  description: string;
  status: RuleSetStatus;
  createdBy: string;
  createdAt: string;
}

export interface EcrRuleWeight {
  id: string;
  ruleSetId: string;
  metricId: string;
  weight: number;
  createdAt: string;
}

export interface EcrInputSnapshot {
  id: string;
  customerId: string;
  periodStart: string;
  periodEnd: string;
  createdBy: string;
  createdAt: string;
}

export interface EcrInputValue {
  id: string;
  snapshotId: string;
  metricId: string;
  value: number;
  sourceMode: SourceMode;
  sourceReference: string;
  capturedBy: string;
  capturedAt: string;
}

export interface EcrScore {
  id: string;
  customerId: string;
  snapshotId: string;
  ruleSetId: string;
  totalScore: number;
  grade: Grade;
  confidenceScore: number;
  breakdown?: EcrScoreBreakdown[] | null;
  computedAt: string;
  computedBySystem: boolean;
}

export interface EcrScoreBreakdown {
  metricKey: string;
  displayName: string;
  value: number;
  weight: number;
  weightedScore: number;
  unit: MetricUnit;
}

export interface EcrConnector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  readOnly: boolean;
  configJson: Record<string, string>;
  createdAt: string;
}

export interface EcrMetricMapping {
  id: string;
  metricId: string;
  connectorId: string;
  externalFieldName: string;
  transformationLogic: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}

export interface EcrAuditTrailEntry {
  id: string;
  customerId: string;
  previousGrade: Grade | null;
  newGrade: Grade;
  reason: string;
  timestamp: string;
}

export const mockMetrics: EcrMetric[] = [];
export const mockRuleSets: EcrRuleSet[] = [];
export const mockRuleWeights: EcrRuleWeight[] = [];
export const mockEcrAuditTrail: EcrAuditTrailEntry[] = [];
export const mockSnapshots: EcrInputSnapshot[] = [];
export const mockInputValues: EcrInputValue[] = [];
export const mockConnectors: EcrConnector[] = [];
export const mockMetricMappings: EcrMetricMapping[] = [];
export const mockScores: EcrScore[] = [];
export const ecrCustomerNames: Record<string, string> = {};

function calculateGrade(score: number): Grade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function normalizeMetricValue(metric: EcrMetric, value: number): number {
  if (metric.maxValue === metric.minValue) return 0;
  const clamped = Math.max(metric.minValue, Math.min(metric.maxValue, value));
  return ((clamped - metric.minValue) / (metric.maxValue - metric.minValue)) * 100;
}

function calculateConfidence(metrics: EcrMetric[], values: EcrInputValue[], weights: EcrRuleWeight[]): number {
  const activeMetricIds = new Set(metrics.filter((metric) => metric.active).map((metric) => metric.id));
  const weightedMetricIds = new Set(weights.filter((weight) => weight.weight > 0).map((weight) => weight.metricId));
  const requiredMetricIds = [...activeMetricIds].filter((id) => weightedMetricIds.has(id));
  if (requiredMetricIds.length === 0) return 0;

  const capturedMetricIds = new Set(values.map((value) => value.metricId));
  const capturedCount = requiredMetricIds.filter((id) => capturedMetricIds.has(id)).length;
  return Math.round((capturedCount / requiredMetricIds.length) * 100);
}

export function computeEcrScore(
  snapshotId: string,
  ruleSetId: string,
  metrics: EcrMetric[] = mockMetrics,
  ruleWeights: EcrRuleWeight[] = mockRuleWeights,
  inputValues: EcrInputValue[] = mockInputValues,
): { totalScore: number; grade: Grade; confidenceScore: number; breakdown: EcrScoreBreakdown[] } {
  const snapshotValues = inputValues.filter((value) => value.snapshotId === snapshotId);
  const weights = ruleWeights.filter((weight) => weight.ruleSetId === ruleSetId);
  const activeMetrics = metrics.filter((metric) => metric.active);
  const totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);

  if (totalWeight <= 0 || activeMetrics.length === 0) {
    return { totalScore: 0, grade: "D", confidenceScore: 0, breakdown: [] };
  }

  let totalScore = 0;
  const breakdown: EcrScoreBreakdown[] = [];

  for (const weight of weights) {
    const metric = activeMetrics.find((candidate) => candidate.id === weight.metricId);
    const value = snapshotValues.find((candidate) => candidate.metricId === weight.metricId);
    if (!metric || !value || weight.weight <= 0) continue;

    const normalized = normalizeMetricValue(metric, value.value);
    const weightedScore = (normalized * weight.weight) / totalWeight;
    const roundedScore = Math.round(weightedScore * 100) / 100;
    totalScore += roundedScore;

    breakdown.push({
      metricKey: metric.metricKey,
      displayName: metric.displayName,
      value: value.value,
      weight: weight.weight,
      weightedScore: roundedScore,
      unit: metric.unit,
    });
  }

  const roundedTotal = Math.round(totalScore * 100) / 100;
  return {
    totalScore: roundedTotal,
    grade: calculateGrade(roundedTotal),
    confidenceScore: calculateConfidence(activeMetrics, snapshotValues, weights),
    breakdown,
  };
}

export function getActiveRuleSet(): EcrRuleSet | undefined {
  return mockRuleSets.find((ruleSet) => ruleSet.status === "active");
}

export function getRuleSetWeights(ruleSetId: string): EcrRuleWeight[] {
  return mockRuleWeights.filter((weight) => weight.ruleSetId === ruleSetId);
}

export function getTotalWeight(ruleSetId: string): number {
  return getRuleSetWeights(ruleSetId).reduce((sum, weight) => sum + weight.weight, 0);
}

export function getCustomerSnapshots(customerId: string): EcrInputSnapshot[] {
  return mockSnapshots.filter((snapshot) => snapshot.customerId === customerId);
}

export function getSnapshotValues(snapshotId: string): EcrInputValue[] {
  return mockInputValues.filter((value) => value.snapshotId === snapshotId);
}

export function getCustomerScores(customerId: string): EcrScore[] {
  return mockScores.filter((score) => score.customerId === customerId);
}

export function getLatestScore(customerId: string): EcrScore | undefined {
  return getCustomerScores(customerId).sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime())[0];
}

export function getGradeColor(grade: Grade): string {
  switch (grade) {
    case "A": return "text-emerald-600";
    case "B": return "text-blue-600";
    case "C": return "text-amber-600";
    case "D": return "text-red-600";
  }
}

export function getGradeBg(grade: Grade): string {
  switch (grade) {
    case "A": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "B": return "bg-blue-100 text-blue-700 border-blue-200";
    case "C": return "bg-amber-100 text-amber-700 border-amber-200";
    case "D": return "bg-red-100 text-red-700 border-red-200";
  }
}

export function getSourceModeLabel(mode: SourceMode): string {
  switch (mode) {
    case "manual": return "Manual Entry";
    case "spreadsheet": return "Spreadsheet Upload";
    case "connector": return "Connector";
  }
}

export function getSourceModeColor(mode: SourceMode): string {
  switch (mode) {
    case "manual": return "bg-slate-100 text-slate-700";
    case "spreadsheet": return "bg-blue-100 text-blue-700";
    case "connector": return "bg-purple-100 text-purple-700";
  }
}

export function getEcrCustomerIdByName(storeName: string): string | undefined {
  for (const [ecrId, ecrName] of Object.entries(ecrCustomerNames)) {
    if (ecrName === storeName || storeName.startsWith(ecrName) || storeName.toLowerCase().includes(ecrName.toLowerCase())) {
      return ecrId;
    }
  }
  return undefined;
}

export function getEcrScoreByCustomerName(storeName: string): EcrScore | undefined {
  const ecrId = getEcrCustomerIdByName(storeName);
  return ecrId ? getLatestScore(ecrId) : undefined;
}

export function getEcrHistory(customerId: string): EcrAuditTrailEntry[] {
  return mockEcrAuditTrail
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function calculateECR(customerId: string): EcrScore | undefined {
  const latestSnapshot = getCustomerSnapshots(customerId)
    .sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime())[0];
  const activeRuleSet = getActiveRuleSet();
  if (!latestSnapshot || !activeRuleSet) return undefined;

  const { totalScore, grade, confidenceScore, breakdown } = computeEcrScore(latestSnapshot.id, activeRuleSet.id);
  return {
    id: `dynamic-score-${latestSnapshot.id}-${activeRuleSet.id}`,
    customerId,
    snapshotId: latestSnapshot.id,
    ruleSetId: activeRuleSet.id,
    totalScore,
    grade,
    confidenceScore,
    breakdown,
    computedAt: new Date().toISOString(),
    computedBySystem: true,
  };
}
