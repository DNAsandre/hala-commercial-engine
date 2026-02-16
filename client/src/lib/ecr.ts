/**
 * ECR v1 — Existing Customer Rating
 * Deterministic scoring engine. No AI computes or alters scores.
 * AI may only explain results. Human judgment remains sovereign.
 */

// ─── TYPES ───────────────────────────────────────────────────

export type SourceMode = 'manual' | 'spreadsheet' | 'connector';
export type RuleSetStatus = 'draft' | 'active' | 'archived';
export type Grade = 'A' | 'B' | 'C' | 'D';
export type MetricUnit = '%' | 'days' | 'number' | 'band';
export type ConnectorType = 'finance' | 'ops' | 'tableau' | 'crm' | 'custom';
export type ConnectorStatus = 'enabled' | 'disabled';

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

// ─── MOCK DATA ───────────────────────────────────────────────

export const mockMetrics: EcrMetric[] = [
  {
    id: 'met-1', metricKey: 'gp_percent', displayName: 'Gross Profit %',
    description: 'Average gross profit percentage across all active deals with this customer',
    unit: '%', minValue: 0, maxValue: 100, defaultWeight: 25,
    defaultSourceMode: 'manual', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-2', metricKey: 'revenue_growth', displayName: 'Revenue Growth YoY',
    description: 'Year-over-year revenue growth rate with this customer',
    unit: '%', minValue: -100, maxValue: 500, defaultWeight: 15,
    defaultSourceMode: 'spreadsheet', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-3', metricKey: 'dso_days', displayName: 'Days Sales Outstanding',
    description: 'Average number of days to collect payment from this customer',
    unit: 'days', minValue: 0, maxValue: 365, defaultWeight: 15,
    defaultSourceMode: 'manual', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-4', metricKey: 'contract_tenure', displayName: 'Contract Tenure',
    description: 'Number of years as an active customer',
    unit: 'number', minValue: 0, maxValue: 50, defaultWeight: 10,
    defaultSourceMode: 'manual', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-5', metricKey: 'sla_compliance', displayName: 'SLA Compliance Rate',
    description: 'Percentage of SLA targets met by Hala for this customer',
    unit: '%', minValue: 0, maxValue: 100, defaultWeight: 10,
    defaultSourceMode: 'spreadsheet', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-6', metricKey: 'volume_utilization', displayName: 'Volume Utilization',
    description: 'Percentage of contracted capacity actually utilized by the customer',
    unit: '%', minValue: 0, maxValue: 100, defaultWeight: 10,
    defaultSourceMode: 'connector', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-7', metricKey: 'dispute_rate', displayName: 'Dispute Rate',
    description: 'Percentage of invoices disputed by the customer',
    unit: '%', minValue: 0, maxValue: 100, defaultWeight: 10,
    defaultSourceMode: 'manual', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-8', metricKey: 'strategic_value', displayName: 'Strategic Value Band',
    description: 'Qualitative assessment of strategic importance (1=Low, 5=Critical)',
    unit: 'band', minValue: 1, maxValue: 5, defaultWeight: 5,
    defaultSourceMode: 'manual', active: true,
    createdAt: '2025-01-15T00:00:00Z', updatedAt: '2025-03-01T00:00:00Z',
  },
  {
    id: 'met-9', metricKey: 'credit_risk_score', displayName: 'Credit Risk Score',
    description: 'External credit risk rating normalized to 0-100 scale',
    unit: 'number', minValue: 0, maxValue: 100, defaultWeight: 0,
    defaultSourceMode: 'connector', active: false,
    createdAt: '2025-02-01T00:00:00Z', updatedAt: '2025-02-01T00:00:00Z',
  },
];

export const mockRuleSets: EcrRuleSet[] = [
  {
    id: 'rs-1', versionNumber: 1, name: 'ECR Standard v1',
    description: 'Initial ECR rule set — equal weight across core financial and operational metrics',
    status: 'archived', createdBy: 'Amin Al-Rashid', createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: 'rs-2', versionNumber: 2, name: 'ECR Standard v2',
    description: 'Revised weights — increased GP% and revenue growth emphasis, reduced tenure weight',
    status: 'active', createdBy: 'Amin Al-Rashid', createdAt: '2025-02-20T00:00:00Z',
  },
  {
    id: 'rs-3', versionNumber: 3, name: 'ECR Enhanced v3 (Draft)',
    description: 'Experimental — adds credit risk score and rebalances strategic value',
    status: 'draft', createdBy: 'Amin Al-Rashid', createdAt: '2025-03-10T00:00:00Z',
  },
];

export const mockRuleWeights: EcrRuleWeight[] = [
  // v2 (active) weights — must total 100
  { id: 'rw-1', ruleSetId: 'rs-2', metricId: 'met-1', weight: 25, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-2', ruleSetId: 'rs-2', metricId: 'met-2', weight: 15, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-3', ruleSetId: 'rs-2', metricId: 'met-3', weight: 15, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-4', ruleSetId: 'rs-2', metricId: 'met-4', weight: 10, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-5', ruleSetId: 'rs-2', metricId: 'met-5', weight: 10, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-6', ruleSetId: 'rs-2', metricId: 'met-6', weight: 10, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-7', ruleSetId: 'rs-2', metricId: 'met-7', weight: 10, createdAt: '2025-02-20T00:00:00Z' },
  { id: 'rw-8', ruleSetId: 'rs-2', metricId: 'met-8', weight: 5, createdAt: '2025-02-20T00:00:00Z' },
  // v1 (archived) weights
  { id: 'rw-9', ruleSetId: 'rs-1', metricId: 'met-1', weight: 20, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-10', ruleSetId: 'rs-1', metricId: 'met-2', weight: 15, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-11', ruleSetId: 'rs-1', metricId: 'met-3', weight: 15, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-12', ruleSetId: 'rs-1', metricId: 'met-4', weight: 15, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-13', ruleSetId: 'rs-1', metricId: 'met-5', weight: 10, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-14', ruleSetId: 'rs-1', metricId: 'met-6', weight: 10, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-15', ruleSetId: 'rs-1', metricId: 'met-7', weight: 10, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'rw-16', ruleSetId: 'rs-1', metricId: 'met-8', weight: 5, createdAt: '2025-01-15T00:00:00Z' },
  // v3 (draft) weights — intentionally incomplete (85%)
  { id: 'rw-17', ruleSetId: 'rs-3', metricId: 'met-1', weight: 20, createdAt: '2025-03-10T00:00:00Z' },
  { id: 'rw-18', ruleSetId: 'rs-3', metricId: 'met-2', weight: 15, createdAt: '2025-03-10T00:00:00Z' },
  { id: 'rw-19', ruleSetId: 'rs-3', metricId: 'met-3', weight: 15, createdAt: '2025-03-10T00:00:00Z' },
  { id: 'rw-20', ruleSetId: 'rs-3', metricId: 'met-4', weight: 5, createdAt: '2025-03-10T00:00:00Z' },
  { id: 'rw-21', ruleSetId: 'rs-3', metricId: 'met-5', weight: 10, createdAt: '2025-03-10T00:00:00Z' },
  { id: 'rw-22', ruleSetId: 'rs-3', metricId: 'met-6', weight: 10, createdAt: '2025-03-10T00:00:00Z' },
  { id: 'rw-23', ruleSetId: 'rs-3', metricId: 'met-7', weight: 10, createdAt: '2025-03-10T00:00:00Z' },
];

// Customers reference from existing store — we'll use customer IDs from there
// Snapshot data for several customers

export const mockSnapshots: EcrInputSnapshot[] = [
  { id: 'snap-1', customerId: 'cust-sabic', periodStart: '2025-01-01', periodEnd: '2025-03-31', createdBy: 'Amin Al-Rashid', createdAt: '2025-04-01T08:00:00Z' },
  { id: 'snap-2', customerId: 'cust-alrajhi', periodStart: '2025-01-01', periodEnd: '2025-03-31', createdBy: 'Amin Al-Rashid', createdAt: '2025-04-01T08:30:00Z' },
  { id: 'snap-3', customerId: 'cust-maaden', periodStart: '2025-01-01', periodEnd: '2025-03-31', createdBy: 'Ahmed Nasser', createdAt: '2025-04-01T09:00:00Z' },
  { id: 'snap-4', customerId: 'cust-nestle', periodStart: '2025-01-01', periodEnd: '2025-03-31', createdBy: 'Ahmed Nasser', createdAt: '2025-04-01T09:30:00Z' },
  { id: 'snap-5', customerId: 'cust-almarai', periodStart: '2025-01-01', periodEnd: '2025-03-31', createdBy: 'Amin Al-Rashid', createdAt: '2025-04-01T10:00:00Z' },
  // Historical snapshots for SABIC
  { id: 'snap-6', customerId: 'cust-sabic', periodStart: '2024-10-01', periodEnd: '2024-12-31', createdBy: 'Amin Al-Rashid', createdAt: '2025-01-02T08:00:00Z' },
  { id: 'snap-7', customerId: 'cust-sabic', periodStart: '2024-07-01', periodEnd: '2024-09-30', createdBy: 'Amin Al-Rashid', createdAt: '2024-10-02T08:00:00Z' },
];

export const mockInputValues: EcrInputValue[] = [
  // SABIC Q1 2025 (snap-1)
  { id: 'iv-1', snapshotId: 'snap-1', metricId: 'met-1', value: 28.5, sourceMode: 'manual', sourceReference: 'Q1 Finance Review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-2', snapshotId: 'snap-1', metricId: 'met-2', value: 12.3, sourceMode: 'spreadsheet', sourceReference: 'sabic-revenue-2025.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-3', snapshotId: 'snap-1', metricId: 'met-3', value: 32, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-4', snapshotId: 'snap-1', metricId: 'met-4', value: 8, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-5', snapshotId: 'snap-1', metricId: 'met-5', value: 96.2, sourceMode: 'spreadsheet', sourceReference: 'sla-compliance-q1.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-6', snapshotId: 'snap-1', metricId: 'met-6', value: 87.5, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-7', snapshotId: 'snap-1', metricId: 'met-7', value: 2.1, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },
  { id: 'iv-8', snapshotId: 'snap-1', metricId: 'met-8', value: 5, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:10:00Z' },

  // Al-Rajhi Q1 2025 (snap-2)
  { id: 'iv-9', snapshotId: 'snap-2', metricId: 'met-1', value: 8.5, sourceMode: 'manual', sourceReference: 'Q1 Finance Review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-10', snapshotId: 'snap-2', metricId: 'met-2', value: -5.2, sourceMode: 'spreadsheet', sourceReference: 'alrajhi-revenue-2025.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-11', snapshotId: 'snap-2', metricId: 'met-3', value: 68, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-12', snapshotId: 'snap-2', metricId: 'met-4', value: 3, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-13', snapshotId: 'snap-2', metricId: 'met-5', value: 78.5, sourceMode: 'manual', sourceReference: 'Ops report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-14', snapshotId: 'snap-2', metricId: 'met-6', value: 45.0, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-15', snapshotId: 'snap-2', metricId: 'met-7', value: 12.5, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },
  { id: 'iv-16', snapshotId: 'snap-2', metricId: 'met-8', value: 2, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T08:30:00Z' },

  // Ma'aden Q1 2025 (snap-3)
  { id: 'iv-17', snapshotId: 'snap-3', metricId: 'met-1', value: 19.7, sourceMode: 'manual', sourceReference: 'Q1 Finance Review', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-18', snapshotId: 'snap-3', metricId: 'met-2', value: 8.1, sourceMode: 'spreadsheet', sourceReference: 'maaden-revenue-2025.xlsx', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-19', snapshotId: 'snap-3', metricId: 'met-3', value: 42, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-20', snapshotId: 'snap-3', metricId: 'met-4', value: 5, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-21', snapshotId: 'snap-3', metricId: 'met-5', value: 91.0, sourceMode: 'spreadsheet', sourceReference: 'sla-compliance-q1.xlsx', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-22', snapshotId: 'snap-3', metricId: 'met-6', value: 72.0, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-23', snapshotId: 'snap-3', metricId: 'met-7', value: 5.5, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },
  { id: 'iv-24', snapshotId: 'snap-3', metricId: 'met-8', value: 4, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:00:00Z' },

  // Nestlé Q1 2025 (snap-4)
  { id: 'iv-25', snapshotId: 'snap-4', metricId: 'met-1', value: 24.1, sourceMode: 'manual', sourceReference: 'Q1 Finance Review', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-26', snapshotId: 'snap-4', metricId: 'met-2', value: 3.5, sourceMode: 'spreadsheet', sourceReference: 'nestle-revenue-2025.xlsx', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-27', snapshotId: 'snap-4', metricId: 'met-3', value: 38, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-28', snapshotId: 'snap-4', metricId: 'met-4', value: 6, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-29', snapshotId: 'snap-4', metricId: 'met-5', value: 94.0, sourceMode: 'spreadsheet', sourceReference: 'sla-compliance-q1.xlsx', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-30', snapshotId: 'snap-4', metricId: 'met-6', value: 81.0, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-31', snapshotId: 'snap-4', metricId: 'met-7', value: 3.2, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },
  { id: 'iv-32', snapshotId: 'snap-4', metricId: 'met-8', value: 3, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Ahmed Nasser', capturedAt: '2025-04-01T09:30:00Z' },

  // Almarai Q1 2025 (snap-5)
  { id: 'iv-33', snapshotId: 'snap-5', metricId: 'met-1', value: 31.2, sourceMode: 'manual', sourceReference: 'Q1 Finance Review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-34', snapshotId: 'snap-5', metricId: 'met-2', value: 18.7, sourceMode: 'spreadsheet', sourceReference: 'almarai-revenue-2025.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-35', snapshotId: 'snap-5', metricId: 'met-3', value: 25, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-36', snapshotId: 'snap-5', metricId: 'met-4', value: 12, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-37', snapshotId: 'snap-5', metricId: 'met-5', value: 98.5, sourceMode: 'spreadsheet', sourceReference: 'sla-compliance-q1.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-38', snapshotId: 'snap-5', metricId: 'met-6', value: 92.0, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-39', snapshotId: 'snap-5', metricId: 'met-7', value: 1.0, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },
  { id: 'iv-40', snapshotId: 'snap-5', metricId: 'met-8', value: 5, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-04-01T10:00:00Z' },

  // SABIC Q4 2024 (snap-6)
  { id: 'iv-41', snapshotId: 'snap-6', metricId: 'met-1', value: 26.8, sourceMode: 'manual', sourceReference: 'Q4 Finance Review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-42', snapshotId: 'snap-6', metricId: 'met-2', value: 10.5, sourceMode: 'spreadsheet', sourceReference: 'sabic-revenue-q4.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-43', snapshotId: 'snap-6', metricId: 'met-3', value: 35, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-44', snapshotId: 'snap-6', metricId: 'met-4', value: 7.75, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-45', snapshotId: 'snap-6', metricId: 'met-5', value: 95.0, sourceMode: 'spreadsheet', sourceReference: 'sla-compliance-q4.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-46', snapshotId: 'snap-6', metricId: 'met-6', value: 85.0, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-47', snapshotId: 'snap-6', metricId: 'met-7', value: 2.5, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },
  { id: 'iv-48', snapshotId: 'snap-6', metricId: 'met-8', value: 5, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Amin Al-Rashid', capturedAt: '2025-01-02T08:10:00Z' },

  // SABIC Q3 2024 (snap-7)
  { id: 'iv-49', snapshotId: 'snap-7', metricId: 'met-1', value: 25.1, sourceMode: 'manual', sourceReference: 'Q3 Finance Review', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-50', snapshotId: 'snap-7', metricId: 'met-2', value: 8.9, sourceMode: 'spreadsheet', sourceReference: 'sabic-revenue-q3.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-51', snapshotId: 'snap-7', metricId: 'met-3', value: 38, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-52', snapshotId: 'snap-7', metricId: 'met-4', value: 7.5, sourceMode: 'manual', sourceReference: 'CRM record', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-53', snapshotId: 'snap-7', metricId: 'met-5', value: 93.5, sourceMode: 'spreadsheet', sourceReference: 'sla-compliance-q3.xlsx', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-54', snapshotId: 'snap-7', metricId: 'met-6', value: 82.0, sourceMode: 'manual', sourceReference: 'Ops dashboard', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-55', snapshotId: 'snap-7', metricId: 'met-7', value: 3.0, sourceMode: 'manual', sourceReference: 'Finance team report', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
  { id: 'iv-56', snapshotId: 'snap-7', metricId: 'met-8', value: 4, sourceMode: 'manual', sourceReference: 'Strategic review', capturedBy: 'Amin Al-Rashid', capturedAt: '2024-10-02T08:10:00Z' },
];

export const mockConnectors: EcrConnector[] = [
  { id: 'econ-1', name: 'Finance System (SAP)', type: 'finance', status: 'disabled', readOnly: true, configJson: { host: 'sap.hala.sa', port: '443' }, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'econ-2', name: 'Operations (WMS)', type: 'ops', status: 'disabled', readOnly: true, configJson: { host: 'wms.hala.sa', port: '443' }, createdAt: '2025-01-15T00:00:00Z' },
  { id: 'econ-3', name: 'Tableau Analytics', type: 'tableau', status: 'disabled', readOnly: true, configJson: { host: 'tableau.hala.sa', site: 'hala-main' }, createdAt: '2025-02-01T00:00:00Z' },
  { id: 'econ-4', name: 'Zoho CRM', type: 'crm', status: 'disabled', readOnly: true, configJson: { host: 'crm.zoho.com', org: 'hala-logistics' }, createdAt: '2025-02-01T00:00:00Z' },
];

export const mockMetricMappings: EcrMetricMapping[] = [
  { id: 'mm-1', metricId: 'met-1', connectorId: 'econ-1', externalFieldName: 'GROSS_PROFIT_PCT', transformationLogic: { type: 'direct' }, active: false, createdAt: '2025-02-01T00:00:00Z' },
  { id: 'mm-2', metricId: 'met-3', connectorId: 'econ-1', externalFieldName: 'DSO_DAYS', transformationLogic: { type: 'direct' }, active: false, createdAt: '2025-02-01T00:00:00Z' },
  { id: 'mm-3', metricId: 'met-6', connectorId: 'econ-2', externalFieldName: 'CAPACITY_UTIL_PCT', transformationLogic: { type: 'direct' }, active: false, createdAt: '2025-02-01T00:00:00Z' },
  { id: 'mm-4', metricId: 'met-5', connectorId: 'econ-3', externalFieldName: 'SLA_COMPLIANCE_VIEW', transformationLogic: { type: 'tableau_extract', view: 'SLA Dashboard' }, active: false, createdAt: '2025-02-01T00:00:00Z' },
];

// ─── SCORING ENGINE (Deterministic — No AI) ─────────────────

/**
 * Normalize a raw metric value to a 0-100 scale based on metric definition.
 * This is purely arithmetic — no AI involved.
 */
function normalizeValue(metric: EcrMetric, rawValue: number): number {
  const { minValue, maxValue, unit, metricKey } = metric;

  // Inverse metrics: lower is better (DSO, dispute rate)
  const inverseMetrics = ['dso_days', 'dispute_rate'];
  const isInverse = inverseMetrics.includes(metricKey);

  // Band metrics: direct mapping (1-5 → 0-100)
  if (unit === 'band') {
    return Math.min(100, Math.max(0, ((rawValue - minValue) / (maxValue - minValue)) * 100));
  }

  // Clamp value to valid range
  const clamped = Math.min(maxValue, Math.max(minValue, rawValue));

  if (isInverse) {
    // Lower is better: 0 days DSO = 100, maxValue days = 0
    return Math.max(0, ((maxValue - clamped) / (maxValue - minValue)) * 100);
  }

  // Higher is better
  return Math.max(0, ((clamped - minValue) / (maxValue - minValue)) * 100);
}

/**
 * Calculate grade from total score.
 * A: 80-100, B: 60-79, C: 40-59, D: 0-39
 */
function calculateGrade(score: number): Grade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Calculate confidence score based on data completeness.
 * 100% = all metrics have values, lower if some are missing.
 */
function calculateConfidence(
  activeMetrics: EcrMetric[],
  values: EcrInputValue[],
  weights: EcrRuleWeight[]
): number {
  const weightedMetricIds = weights.map(w => w.metricId);
  const activeWeightedMetrics = activeMetrics.filter(m => weightedMetricIds.includes(m.id));
  if (activeWeightedMetrics.length === 0) return 0;

  const coveredCount = activeWeightedMetrics.filter(m =>
    values.some(v => v.metricId === m.id)
  ).length;

  return Math.round((coveredCount / activeWeightedMetrics.length) * 100);
}

/**
 * Compute ECR score — DETERMINISTIC.
 * score = Σ (normalized_value × weight / 100)
 */
export function computeEcrScore(
  snapshotId: string,
  ruleSetId: string,
  metrics: EcrMetric[] = mockMetrics,
  weights: EcrRuleWeight[] = mockRuleWeights,
  values: EcrInputValue[] = mockInputValues
): { totalScore: number; grade: Grade; confidenceScore: number; breakdown: EcrScoreBreakdown[] } {
  const ruleWeights = weights.filter(w => w.ruleSetId === ruleSetId);
  const snapshotValues = values.filter(v => v.snapshotId === snapshotId);
  const activeMetrics = metrics.filter(m => m.active);

  const breakdown: EcrScoreBreakdown[] = [];
  let totalScore = 0;

  for (const rw of ruleWeights) {
    const metric = activeMetrics.find(m => m.id === rw.metricId);
    if (!metric) continue;

    const inputValue = snapshotValues.find(v => v.metricId === rw.metricId);
    const rawValue = inputValue?.value ?? 0;
    const normalized = normalizeValue(metric, rawValue);
    const weightedScore = (normalized * rw.weight) / 100;

    breakdown.push({
      metricKey: metric.metricKey,
      displayName: metric.displayName,
      value: rawValue,
      weight: rw.weight,
      weightedScore: Math.round(weightedScore * 100) / 100,
      unit: metric.unit,
    });

    totalScore += weightedScore;
  }

  totalScore = Math.round(totalScore * 100) / 100;
  const grade = calculateGrade(totalScore);
  const confidenceScore = calculateConfidence(activeMetrics, snapshotValues, ruleWeights);

  return { totalScore, grade, confidenceScore, breakdown };
}

// Pre-computed scores for mock data
export const mockScores: EcrScore[] = (() => {
  const results: EcrScore[] = [];
  const customerSnapshots = [
    { snapshotId: 'snap-1', customerId: 'cust-sabic' },
    { snapshotId: 'snap-2', customerId: 'cust-alrajhi' },
    { snapshotId: 'snap-3', customerId: 'cust-maaden' },
    { snapshotId: 'snap-4', customerId: 'cust-nestle' },
    { snapshotId: 'snap-5', customerId: 'cust-almarai' },
    { snapshotId: 'snap-6', customerId: 'cust-sabic' },
    { snapshotId: 'snap-7', customerId: 'cust-sabic' },
  ];

  const snapshot = mockSnapshots;
  for (const cs of customerSnapshots) {
    const snap = snapshot.find(s => s.id === cs.snapshotId);
    if (!snap) continue;
    const { totalScore, grade, confidenceScore } = computeEcrScore(cs.snapshotId, 'rs-2');
    results.push({
      id: `score-${cs.snapshotId}`,
      customerId: cs.customerId,
      snapshotId: cs.snapshotId,
      ruleSetId: 'rs-2',
      totalScore,
      grade,
      confidenceScore,
      computedAt: snap.createdAt,
      computedBySystem: true,
    });
  }

  return results;
})();

// ─── HELPER FUNCTIONS ────────────────────────────────────────

export function getActiveRuleSet(): EcrRuleSet | undefined {
  return mockRuleSets.find(rs => rs.status === 'active');
}

export function getRuleSetWeights(ruleSetId: string): EcrRuleWeight[] {
  return mockRuleWeights.filter(w => w.ruleSetId === ruleSetId);
}

export function getTotalWeight(ruleSetId: string): number {
  return getRuleSetWeights(ruleSetId).reduce((sum, w) => sum + w.weight, 0);
}

export function getCustomerSnapshots(customerId: string): EcrInputSnapshot[] {
  return mockSnapshots.filter(s => s.customerId === customerId);
}

export function getSnapshotValues(snapshotId: string): EcrInputValue[] {
  return mockInputValues.filter(v => v.snapshotId === snapshotId);
}

export function getCustomerScores(customerId: string): EcrScore[] {
  return mockScores.filter(s => s.customerId === customerId);
}

export function getLatestScore(customerId: string): EcrScore | undefined {
  const scores = getCustomerScores(customerId);
  return scores.sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime())[0];
}

export function getGradeColor(grade: Grade): string {
  switch (grade) {
    case 'A': return 'text-emerald-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-amber-600';
    case 'D': return 'text-red-600';
  }
}

export function getGradeBg(grade: Grade): string {
  switch (grade) {
    case 'A': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'C': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'D': return 'bg-red-100 text-red-700 border-red-200';
  }
}

export function getSourceModeLabel(mode: SourceMode): string {
  switch (mode) {
    case 'manual': return 'Manual Entry';
    case 'spreadsheet': return 'Spreadsheet Upload';
    case 'connector': return 'Connector (Future)';
  }
}

export function getSourceModeColor(mode: SourceMode): string {
  switch (mode) {
    case 'manual': return 'bg-slate-100 text-slate-700';
    case 'spreadsheet': return 'bg-blue-100 text-blue-700';
    case 'connector': return 'bg-purple-100 text-purple-700';
  }
}

// Customer name lookup (matches existing store)
export const ecrCustomerNames: Record<string, string> = {
  'cust-sabic': 'SABIC',
  'cust-alrajhi': 'Al-Rajhi Steel',
  'cust-maaden': "Ma'aden",
  'cust-nestle': 'Nestlé',
  'cust-almarai': 'Almarai',
};

// Reverse lookup: store customer name → ECR customer ID
// Handles partial matches (e.g. "Nestlé KSA" matches "Nestlé")
export function getEcrCustomerIdByName(storeName: string): string | undefined {
  // Direct match first
  for (const [ecrId, ecrName] of Object.entries(ecrCustomerNames)) {
    if (ecrName === storeName || storeName.startsWith(ecrName) || ecrName.startsWith(storeName)) {
      return ecrId;
    }
  }
  // Fuzzy: check if the store name contains the ECR name or vice-versa
  for (const [ecrId, ecrName] of Object.entries(ecrCustomerNames)) {
    if (storeName.toLowerCase().includes(ecrName.toLowerCase()) || ecrName.toLowerCase().includes(storeName.toLowerCase())) {
      return ecrId;
    }
  }
  return undefined;
}

// Convenience: get the latest ECR score for a store customer by name
export function getEcrScoreByCustomerName(storeName: string): EcrScore | undefined {
  const ecrId = getEcrCustomerIdByName(storeName);
  if (!ecrId) return undefined;
  return getLatestScore(ecrId);
}
