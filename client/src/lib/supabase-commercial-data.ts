/**
 * supabase-commercial-data.ts
 * ──────────────────────────────
 * SUPA-003: Supabase-backed read layer for Commercial Workspace v2.
 *
 * This module replaces commercial-workspace-data.ts as the PRIMARY
 * source of truth for the Commercial Workspace detail page.
 *
 * RLS: Development-permissive. Production hardening required later.
 */

import { supabase } from './supabase';

// Re-export types from component files (canonical type definitions)
import type { QuotePricingLine } from '@/components/commercial/CommercialPricingLinesTable';
import type { QuotePnlSnapshot, MarginAuthoritySignal } from '@/components/commercial/CommercialPnlAuthorityPanels';
import type { CommercialCustomerScore } from '@/components/commercial/CommercialCustomerScorePanel';
import type { CommercialCapacityFit, WarehouseConstraint } from '@/components/commercial/CommercialCapacityFitPanel';
import type { CommercialPricingPosture, PostureValue, PostureSeverity } from '@/components/commercial/CommercialPricingPosturePanel';
import type { CommercialRevenueRealization } from '@/components/commercial/CommercialRevenueRealizationPanel';
import type {
  QuoteScenario, QuoteScenarioStatus, PricingPosture,
  CustomerScore, CapacityFit, RevenueTiming,
  CommercialMockEscalation,
  CommercialProposalVersion,
  CommercialNegotiationRound,
  CommercialSlaDraft,
  CommercialSlaSection,
  CommercialSlaKpi,
  CommercialSlaPromiseGap,
  CommercialActivityEvent,
  CommercialAuditEvent,
} from './commercial-workspace-data';

// ─── JSON HELPERS ──────────────────────────────────────────

function safeJsonArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function safeJsonObj(val: any): any {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
  return {};
}

// ─── ROW → FRONTEND MAPPERS ──────────────────────────────────

function mapQuoteScenario(row: any): QuoteScenario {
  return {
    id: row.id,
    name: row.name,
    version: row.version ?? 'v0.1',
    status: (row.status ?? 'draft_scenario') as QuoteScenarioStatus,
    revenue: Number(row.revenue ?? 0),
    cost: Number(row.cost ?? 0),
    gpPercent: Number(row.gp_percent ?? 0),
    pricingPosture: (row.pricing_posture ?? 'Balanced') as PricingPosture,
    customerScore: (row.customer_score ?? 'C') as CustomerScore,
    capacityFit: (row.capacity_fit ?? 'Pending') as CapacityFit,
    revenueTiming: (row.revenue_timing ?? 'Next Quarter') as RevenueTiming,
    mockEscalation: row.mock_escalation ?? '',
    owner: row.owner ?? '',
    notes: row.notes ?? '',
  };
}

function mapPricingLine(row: any): QuotePricingLine {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    serviceCategory: row.service_category,
    serviceName: row.service_name,
    description: row.description ?? '',
    unit: row.unit ?? '',
    volume: Number(row.volume ?? 0),
    sellingRate: Number(row.selling_rate ?? 0),
    revenue: Number(row.revenue ?? 0),
    costRate: Number(row.cost_rate ?? 0),
    cost: Number(row.cost ?? 0),
    grossProfit: Number(row.gross_profit ?? 0),
    gpPercent: Number(row.gp_percent ?? 0),
    costOwner: row.cost_owner ?? '',
    sellingOwner: row.selling_owner ?? '',
    assumption: row.assumption ?? '',
    riskLevel: row.risk_level ?? 'Low',
    riskReason: row.risk_reason ?? '',
    reviewStatus: row.review_status ?? 'Draft Mock',
    notes: row.notes ?? '',
  };
}

function mapPnlSnapshot(row: any): QuotePnlSnapshot {
  return {
    scenarioId: row.scenario_id,
    revenue: Number(row.revenue ?? 0),
    warehouseCost: Number(row.warehouse_cost ?? 0),
    transportCost: Number(row.transport_cost ?? 0),
    laborCost: Number(row.labor_cost ?? 0),
    specialHandlingCost: Number(row.special_handling_cost ?? 0),
    adminReportingCost: Number(row.admin_reporting_cost ?? 0),
    riskReserve: Number(row.risk_reserve ?? 0),
    totalCost: Number(row.total_cost ?? 0),
    grossProfit: Number(row.gross_profit ?? 0),
    gpPercent: Number(row.gp_percent ?? 0),
    pnlConfidence: (row.pnl_confidence ?? 'Draft Mock') as any,
    missingInputs: safeJsonArray(row.missing_inputs),
    inputOwners: safeJsonArray(row.input_owners),
    assumptions: safeJsonArray(row.assumptions),
    notes: row.notes ?? '',
    lastReviewed: row.last_reviewed ?? '',
    reviewedBy: row.reviewed_by ?? '',
  };
}

function mapCustomerScore(row: any): CommercialCustomerScore {
  const fs = safeJsonObj(row.financial_strength);
  const ob = safeJsonObj(row.operational_behavior);
  const sf = safeJsonObj(row.strategic_fit);
  const cf = safeJsonObj(row.commercial_fit);
  const grade = row.overall_grade ?? 'TBA';

  return {
    customerName: '',  // filled by caller context
    workspaceId: row.workspace_id ?? '',
    overallGrade: grade as any,
    overallScore: Number(row.overall_score ?? 0),
    financialStrength: { score: fs.score ?? 0, grade: (fs.rating?.charAt(0) ?? grade) as any, reason: (fs.factors ?? []).join(', ') },
    operationalBehavior: { score: ob.score ?? 0, grade: (ob.rating?.charAt(0) ?? grade) as any, reason: (ob.factors ?? []).join(', ') },
    strategicFit: { score: sf.score ?? 0, grade: (sf.rating?.charAt(0) ?? grade) as any, reason: (sf.factors ?? []).join(', ') },
    commercialFit: { score: cf.score ?? 0, grade: (cf.rating?.charAt(0) ?? grade) as any, reason: (cf.factors ?? []).join(', ') },
    icpFit: 'Weak ICP Fit' as any,
    paymentStatus: 'Bad Payer',
    dsoDays: 68,
    discountSuitability: 'Not Recommended' as any,
    pursuitRecommendation: 'Monitor' as any,
    riskReasons: (fs.factors ?? []).concat(ob.factors ?? []),
    positiveReasons: (sf.factors ?? []),
    overrideStatus: row.override_grade ? 'Mock Review Only' as any : 'No Override' as any,
    overrideAllowedFutureRole: 'Commercial Director',
    wouldEscalate: grade === 'D' || grade === 'F',
    mockEscalationCreated: false,
    lastReviewed: '',
    reviewedBy: '',
    notes: row.notes ?? '',
  };
}

function mapCapacityFit(row: any): CommercialCapacityFit {
  const constraintsRaw = safeJsonArray(row.constraints);
  const constraints: WarehouseConstraint[] = constraintsRaw.map((c: any, i: number) => {
    if (typeof c === 'string') return { label: `Constraint ${i + 1}`, value: c, status: 'warning' as const };
    return c;
  });

  return {
    scenarioId: row.scenario_id,
    workspaceId: '',
    customerName: '',
    requiredPalletPositions: Number(row.required_positions ?? 0),
    availablePalletPositions: Number(row.capacity_before ?? 0),
    effectiveRequiredPositions: Math.round(Number(row.required_positions ?? 0) * 1.1),
    utilizationBefore: Number(row.utilization_before ?? 0),
    utilizationAfter: Number(row.utilization_after ?? 0),
    utilizationTarget: 85,
    capacityFitScore: row.fit_status === 'Acceptable' ? 72 : row.fit_status === 'Constrained' ? 55 : 40,
    capacityFitStatus: (row.fit_status === 'Acceptable' ? 'Acceptable Fit' : row.fit_status === 'Constrained' ? 'Constrained' : 'High Risk') as any,
    riskLevel: row.fit_status === 'Constrained' ? 'Medium' as any : row.fit_status === 'Acceptable' ? 'Low' as any : 'High' as any,
    constraints,
    riskReasons: constraintsRaw.filter((c: any) => typeof c === 'string'),
    positiveReasons: [],
    promiseGaps: safeJsonArray(row.promise_gaps).filter((g: any) => typeof g === 'string'),
    opsOwner: row.ops_owner ?? '',
    wouldEscalate: false,
    mockEscalationCreated: false,
    allowTestBypass: true,
    lastReviewed: '',
    reviewedBy: '',
    notes: row.notes ?? '',
  };
}

function mapRevenueRealization(row: any): CommercialRevenueRealization {
  return {
    scenarioId: row.scenario_id,
    budgetImpactTiming: row.timing ?? 'Next Quarter',
    realizationConfidence: Number(row.month1_percent ?? 0) >= 60 ? 'High' : Number(row.month1_percent ?? 0) >= 30 ? 'Medium' : 'Low',
    timeline: [],  // Timeline stages are derived UI-only, not stored
    delayRisks: safeJsonArray(row.risk_factors),
    accelerationOpportunities: [],
    owner: '',
    wouldEscalate: false,
    mockEscalationCreated: false,
    notes: row.notes ?? '',
  };
}

function mapMockEscalation(row: any): CommercialMockEscalation {
  return {
    id: row.id,
    workspaceId: '',
    scenarioId: row.scenario_id,
    escalationCode: `ESC-${(row.type ?? '').toUpperCase().replace(/\s/g, '-')}-${(row.severity ?? 'M').charAt(0)}`,
    signalSource: (row.type ?? '') as any,
    signalName: row.type ?? '',
    severity: (row.severity ?? 'Medium') as any,
    status: row.current_status === 'Open' ? 'Open Mock' as any : (row.current_status ?? 'Open Mock') as any,
    owner: row.required_authority ?? '',
    futureRequiredRoles: [row.required_authority ?? ''].filter(Boolean),
    triggerReason: row.signal ?? '',
    commercialImpact: '',
    recommendedAction: '',
    linkedControls: [],
    wouldEscalate: row.severity === 'Critical' || row.severity === 'High',
    wouldRequireApproval: row.severity === 'Critical' || row.severity === 'High',
    mockEscalationCreated: true,
    allowTestBypass: row.bypass_available ?? true,
    runtimeMode: 'Development Marker',
    createdAt: row.created_at ?? '',
    lastReviewed: '',
    reviewedBy: '',
    notes: '',
  };
}

function mapProposalVersion(row: any): CommercialProposalVersion {
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? '',
    proposalName: row.proposal_name ?? '',
    version: row.version ?? 'v0.1',
    linkedQuoteScenarioId: row.scenario_id ?? '',
    linkedQuoteScenarioName: row.linked_quote_scenario_name ?? '',
    status: (row.status ?? 'Drafting') as any,
    proposalType: (row.proposal_type ?? 'Internal Draft') as any,
    clientFacingMock: row.client_facing_mock ?? row.client_facing ?? false,
    revenue: Number(row.revenue ?? 0),
    gpPercent: Number(row.gp_percent ?? 0),
    marginDeltaFromQuote: Number(row.margin_delta_from_quote ?? 0),
    owner: row.owner ?? '',
    reviewStatus: (row.review_status ?? 'Not Reviewed') as any,
    futureGateStatus: (row.future_gate_status ?? row.future_gate ?? 'No Gate') as any,
    mockEscalationStatus: row.mock_escalation_status ?? '',
    issuedAtMock: row.issued_at_mock ?? '',
    lastUpdated: row.last_updated ?? '',
    notes: row.notes ?? '',
  };
}

function mapNegotiationRound(row: any): CommercialNegotiationRound {
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? '',
    proposalVersionId: row.proposal_version_id ?? '',
    roundNumber: Number(row.round_number ?? 1),
    clientAsk: row.client_ask ?? '',
    halaResponse: row.hala_response ?? '',
    pricingChange: row.pricing_change ?? '',
    marginChange: row.margin_change ?? '',
    concessionReason: row.concession_reason ?? '',
    approvalImpact: row.approval_impact ?? '',
    status: (row.status ?? 'Open') as any,
    owner: row.owner ?? '',
    lastUpdated: row.last_updated ?? '',
    notes: row.notes ?? '',
  };
}

function mapSlaDraft(row: any): CommercialSlaDraft {
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? '',
    slaName: row.sla_name ?? '',
    version: row.version ?? 'v0.1',
    linkedProposalId: row.linked_proposal_id ?? '',
    linkedProposalName: row.linked_proposal_name ?? '',
    linkedQuoteScenarioId: row.linked_quote_scenario_id ?? row.linked_scenario ?? '',
    linkedQuoteScenarioName: row.linked_quote_scenario_name ?? '',
    status: (row.status ?? 'Draft Mock') as any,
    slaType: (row.sla_type ?? 'Emergency Storage SLA') as any,
    clientFacingMock: row.client_facing_mock ?? false,
    pricingLockStatus: (row.pricing_lock_status ?? 'Not Locked') as any,
    commercialTermsStatus: (row.commercial_terms_status ?? 'Missing') as any,
    opsReviewStatus: (row.ops_review_status ?? row.ops_review ?? 'Not Reviewed') as any,
    legalReviewStatus: (row.legal_review_status ?? row.legal_review ?? 'Not Reviewed') as any,
    kpiReadiness: Number(row.kpi_readiness ?? 0),
    responsibilityReadiness: Number(row.responsibility_readiness ?? 0),
    escalationMatrixStatus: row.escalation_matrix_status ?? 'Not Reviewed',
    promiseGapCount: Number(row.promise_gap_count ?? 0),
    riskLevel: row.risk_level ?? 'Medium',
    futureGateStatus: (row.future_gate_status ?? 'No Gate') as any,
    mockEscalationStatus: row.mock_escalation_status ?? '',
    owner: row.owner ?? '',
    lastUpdated: row.last_updated ?? '',
    notes: row.notes ?? '',
  };
}

function mapSlaSectionsFromJson(slaId: string, raw: any): CommercialSlaSection[] {
  return safeJsonArray(raw).map((s: any) => ({
    id: s.id ?? '',
    slaId,
    sectionName: s.title ?? s.sectionName ?? '',
    category: (s.category ?? s.title ?? 'Service Scope') as any,
    status: s.status ?? 'Draft Mock',
    owner: s.owner ?? '',
    readiness: Number(s.readiness ?? 50),
    riskLevel: s.riskLevel ?? s.risk ?? 'Medium',
    notes: s.notes ?? '',
  }));
}

function mapSlaKpisFromJson(slaId: string, raw: any): CommercialSlaKpi[] {
  return safeJsonArray(raw).map((k: any) => ({
    id: k.id ?? '',
    slaId,
    kpiName: k.name ?? k.kpiName ?? '',
    target: k.target ?? '',
    measurementMethod: k.method ?? k.measurementMethod ?? '',
    owner: k.owner ?? '',
    readiness: Number(k.readiness ?? 50),
    riskLevel: k.risk ?? k.riskLevel ?? 'Medium',
    notes: k.notes ?? '',
  }));
}

function mapSlaPromiseGapsFromJson(slaId: string, raw: any): CommercialSlaPromiseGap[] {
  return safeJsonArray(raw).map((g: any) => ({
    id: g.id ?? '',
    slaId,
    promise: g.promise ?? '',
    operationalReality: g.reality ?? g.operationalReality ?? '',
    impact: g.impact ?? '',
    owner: g.owner ?? '',
    severity: g.severity ?? 'Medium',
    recommendedAction: g.action ?? g.recommendedAction ?? '',
    wouldEscalateInProduction: g.severity === 'Critical' || g.severity === 'High',
    mockEscalationCreated: g.severity === 'Critical' || g.severity === 'High',
    notes: g.notes ?? '',
  }));
}

function mapActivityEvent(row: any): CommercialActivityEvent {
  return {
    id: row.id ?? '',
    workspaceId: row.workspace_id ?? '',
    eventType: row.event_type ?? row.category ?? '',
    title: row.title ?? row.action ?? '',
    description: row.description ?? row.detail ?? '',
    category: (row.category ?? 'Workspace') as any,
    actor: row.actor ?? '',
    role: row.role ?? '',
    timestamp: row.timestamp ?? '',
    relatedArtifact: row.related_artifact ?? '',
    relatedModule: row.related_module ?? '',
    relatedScenarioId: row.related_scenario_id ?? '',
    severity: (row.severity ?? 'Info') as any,
    mock: row.mock ?? true,
    notes: '',
  };
}

function mapAuditEvent(row: any): CommercialAuditEvent {
  return {
    id: row.id ?? '',
    workspaceId: row.workspace_id ?? '',
    eventCode: row.event_code ?? '',
    eventName: row.event_name ?? row.action ?? '',
    description: row.description ?? row.detail ?? '',
    category: (row.category ?? 'SYSTEM') as any,
    actor: row.actor ?? '',
    role: row.role ?? '',
    timestamp: row.timestamp ?? '',
    entityType: row.entity_type ?? '',
    entityName: row.entity_name ?? row.entity_id ?? '',
    beforeState: row.before_state ?? '',
    afterState: row.after_state ?? '',
    mock: row.mock ?? true,
    severity: (row.severity ?? 'Info') as any,
    traceId: row.trace_id ?? '',
    notes: '',
  };
}

// ─── SUPABASE FETCH FUNCTIONS ──────────────────────────────

export async function fetchCommercialQuoteScenarios(workspaceId: string): Promise<QuoteScenario[]> {
  const { data, error } = await supabase
    .from('commercial_quote_scenarios')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at');
  if (error) { console.warn('[SUPA-003] fetchCommercialQuoteScenarios:', error.message); return []; }
  return (data ?? []).map(mapQuoteScenario);
}

export async function fetchCommercialPricingLines(scenarioIds: string[]): Promise<QuotePricingLine[]> {
  if (!scenarioIds.length) return [];
  const { data, error } = await supabase
    .from('commercial_pricing_lines')
    .select('*')
    .in('scenario_id', scenarioIds);
  if (error) { console.warn('[SUPA-003] fetchCommercialPricingLines:', error.message); return []; }
  return (data ?? []).map(mapPricingLine);
}

export async function fetchCommercialPnlSnapshots(scenarioIds: string[]): Promise<Record<string, QuotePnlSnapshot>> {
  if (!scenarioIds.length) return {};
  const { data, error } = await supabase
    .from('commercial_pnl_snapshots')
    .select('*')
    .in('scenario_id', scenarioIds);
  if (error) { console.warn('[SUPA-003] fetchCommercialPnlSnapshots:', error.message); return {}; }
  const result: Record<string, QuotePnlSnapshot> = {};
  for (const row of data ?? []) result[row.scenario_id] = mapPnlSnapshot(row);
  return result;
}

export async function fetchCommercialCustomerScore(workspaceId: string): Promise<CommercialCustomerScore | null> {
  const { data, error } = await supabase
    .from('commercial_customer_scores')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error) { console.warn('[SUPA-003] fetchCommercialCustomerScore:', error.message); return null; }
  return data ? mapCustomerScore(data) : null;
}

export async function fetchCommercialCapacityFits(scenarioIds: string[]): Promise<Record<string, CommercialCapacityFit>> {
  if (!scenarioIds.length) return {};
  const { data, error } = await supabase
    .from('commercial_capacity_fits')
    .select('*')
    .in('scenario_id', scenarioIds);
  if (error) { console.warn('[SUPA-003] fetchCommercialCapacityFits:', error.message); return {}; }
  const result: Record<string, CommercialCapacityFit> = {};
  for (const row of data ?? []) result[row.scenario_id] = mapCapacityFit(row);
  return result;
}

export async function fetchCommercialRevenueRealization(scenarioIds: string[]): Promise<Record<string, CommercialRevenueRealization>> {
  if (!scenarioIds.length) return {};
  const { data, error } = await supabase
    .from('commercial_revenue_realization')
    .select('*')
    .in('scenario_id', scenarioIds);
  if (error) { console.warn('[SUPA-003] fetchCommercialRevenueRealization:', error.message); return {}; }
  const result: Record<string, CommercialRevenueRealization> = {};
  for (const row of data ?? []) result[row.scenario_id] = mapRevenueRealization(row);
  return result;
}

export async function fetchCommercialMockEscalations(scenarioIds: string[]): Promise<Record<string, CommercialMockEscalation[]>> {
  if (!scenarioIds.length) return {};
  const { data, error } = await supabase
    .from('commercial_mock_escalations')
    .select('*')
    .in('scenario_id', scenarioIds);
  if (error) { console.warn('[SUPA-003] fetchCommercialMockEscalations:', error.message); return {}; }
  const result: Record<string, CommercialMockEscalation[]> = {};
  for (const row of data ?? []) {
    const sid = row.scenario_id;
    if (!result[sid]) result[sid] = [];
    result[sid].push(mapMockEscalation(row));
  }
  return result;
}

export async function fetchCommercialProposals(workspaceId: string): Promise<CommercialProposalVersion[]> {
  const { data, error } = await supabase
    .from('commercial_proposal_versions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at');
  if (error) { console.warn('[SUPA-003B] fetchCommercialProposals:', error.message); return []; }
  return (data ?? []).map(mapProposalVersion);
}

export async function fetchCommercialNegotiations(workspaceId: string): Promise<CommercialNegotiationRound[]> {
  const { data, error } = await supabase
    .from('commercial_negotiation_rounds')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('round_number');
  if (error) { console.warn('[SUPA-003B] fetchCommercialNegotiations:', error.message); return []; }
  return (data ?? []).map(mapNegotiationRound);
}

export interface SlaBundleForDraft {
  draft: CommercialSlaDraft;
  sections: CommercialSlaSection[];
  kpis: CommercialSlaKpi[];
  promiseGaps: CommercialSlaPromiseGap[];
}

export async function fetchCommercialSlaDrafts(workspaceId: string): Promise<SlaBundleForDraft[]> {
  const { data, error } = await supabase
    .from('commercial_sla_drafts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at');
  if (error) { console.warn('[SUPA-003B] fetchCommercialSlaDrafts:', error.message); return []; }
  return (data ?? []).map(row => {
    const draft = mapSlaDraft(row);
    return {
      draft,
      sections: mapSlaSectionsFromJson(draft.id, row.sections),
      kpis: mapSlaKpisFromJson(draft.id, row.kpis),
      promiseGaps: mapSlaPromiseGapsFromJson(draft.id, row.promise_gaps),
    };
  });
}

export async function fetchCommercialActivityEvents(workspaceId: string): Promise<CommercialActivityEvent[]> {
  const { data, error } = await supabase
    .from('commercial_activity_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('timestamp', { ascending: false });
  if (error) { console.warn('[SUPA-003] fetchCommercialActivityEvents:', error.message); return []; }
  return (data ?? []).map(mapActivityEvent);
}

export async function fetchCommercialAuditEvents(workspaceId: string): Promise<CommercialAuditEvent[]> {
  const { data, error } = await supabase
    .from('commercial_audit_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('timestamp', { ascending: false });
  if (error) { console.warn('[SUPA-003] fetchCommercialAuditEvents:', error.message); return []; }
  return (data ?? []).map(mapAuditEvent);
}

// ─── DERIVED / COMPUTED (from Supabase data) ────────────────

export function deriveMarginAuthoritySignal(scenario: QuoteScenario): MarginAuthoritySignal {
  const gp = scenario.gpPercent;
  let severity: 'critical' | 'amber' | 'green' = 'green';
  let band = 'GP >= 22%';
  let authority = 'Local Authority';
  let roles: string[] = [];
  let reason = `GP at ${gp}% is within local authority.`;

  if (gp < 10) {
    severity = 'critical'; band = 'GP < 10%'; authority = 'CEO / CFO Escalation';
    roles = ['CEO', 'CFO', 'Commercial Director'];
    reason = `GP at ${gp}% is below 10% threshold — would require CEO/CFO approval in production.`;
  } else if (gp < 22) {
    severity = 'amber'; band = 'GP < 22%'; authority = 'Commercial / Ops Review';
    roles = ['Commercial Director', 'Ops Manager'];
    reason = `GP at ${gp}% is near 22% threshold — future Commercial/Ops review would be required.`;
  }

  return {
    scenarioId: scenario.id, gpPercent: gp, thresholdBand: band, authorityLevel: authority,
    requiredRolesFuture: roles, severity, reason,
    wouldRequireApproval: gp < 22, wouldEscalate: gp < 10,
    mockEscalationCreated: gp < 10, allowTestBypass: true,
    runtimeMode: 'Development Marker', notes: '',
  };
}

export function derivePricingPosture(scenario: QuoteScenario): CommercialPricingPosture {
  const gp = scenario.gpPercent;
  let posture: PostureValue = 'Balanced';
  let severity: PostureSeverity = 'Medium';
  let recommendation = 'Protect price and confirm Ops capacity';

  if (gp < 6) {
    posture = 'Walk Away'; severity = 'Critical';
    recommendation = 'Walk away or reprice significantly';
  } else if (gp < 10) {
    posture = 'Reprice'; severity = 'High';
    recommendation = 'Reprice before proposal';
  } else if (gp >= 22) {
    severity = 'Low';
    recommendation = 'Price is within target. Proceed.';
  }

  return {
    scenarioId: scenario.id, posture, recommendation,
    decisionOwner: severity === 'Critical' ? 'Commercial Director / CEO-CFO Future Review' : 'Commercial / Ops',
    severity,
    rationale: `GP ${gp}% with posture ${posture}.`,
    pressureSignals: [], supportingSignals: [], riskSignals: [],
    recommendedActions: [recommendation],
    wouldEscalate: gp < 10, mockEscalationCreated: gp < 10, allowTestBypass: true,
    runtimeMode: 'Development Marker', lastReviewed: '', reviewedBy: '', notes: '',
  };
}

// ─── ORCHESTRATOR: FULL WORKSPACE BUNDLE ────────────────────

export interface CommercialWorkspaceBundle {
  scenarios: QuoteScenario[];
  pricingLines: QuotePricingLine[];
  pnlSnapshots: Record<string, QuotePnlSnapshot>;
  marginSignals: Record<string, MarginAuthoritySignal>;
  customerScore: CommercialCustomerScore | null;
  capacityFits: Record<string, CommercialCapacityFit>;
  pricingPostures: Record<string, CommercialPricingPosture>;
  revenueRealization: Record<string, CommercialRevenueRealization>;
  escalations: Record<string, CommercialMockEscalation[]>;
  proposals: CommercialProposalVersion[];
  negotiations: CommercialNegotiationRound[];
  slaBundles: SlaBundleForDraft[];
  activityEvents: CommercialActivityEvent[];
  auditEvents: CommercialAuditEvent[];
  supabaseBacked: boolean;
}

export async function fetchCommercialWorkspaceBundle(workspaceId: string): Promise<CommercialWorkspaceBundle> {
  console.info(`[SUPA-003] Loading commercial workspace bundle from Supabase for ${workspaceId}`);

  const scenarios = await fetchCommercialQuoteScenarios(workspaceId);
  const scenarioIds = scenarios.map(s => s.id);

  const [
    pricingLines, pnlSnapshots, customerScore, capacityFits,
    revenueRealization, escalations, proposals, negotiations,
    slaBundles, activityEvents, auditEvents,
  ] = await Promise.all([
    fetchCommercialPricingLines(scenarioIds),
    fetchCommercialPnlSnapshots(scenarioIds),
    fetchCommercialCustomerScore(workspaceId),
    fetchCommercialCapacityFits(scenarioIds),
    fetchCommercialRevenueRealization(scenarioIds),
    fetchCommercialMockEscalations(scenarioIds),
    fetchCommercialProposals(workspaceId),
    fetchCommercialNegotiations(workspaceId),
    fetchCommercialSlaDrafts(workspaceId),
    fetchCommercialActivityEvents(workspaceId),
    fetchCommercialAuditEvents(workspaceId),
  ]);

  // Derive computed signals from scenarios
  const marginSignals: Record<string, MarginAuthoritySignal> = {};
  const pricingPostures: Record<string, CommercialPricingPosture> = {};
  for (const s of scenarios) {
    marginSignals[s.id] = deriveMarginAuthoritySignal(s);
    pricingPostures[s.id] = derivePricingPosture(s);
  }

  console.info(`[SUPA-003B] Bundle loaded: ${scenarios.length} scenarios, ${pricingLines.length} lines, ${proposals.length} proposals, ${slaBundles.length} SLA drafts, ${activityEvents.length} activities, ${auditEvents.length} audits`);

  return {
    scenarios, pricingLines, pnlSnapshots, marginSignals, customerScore,
    capacityFits, pricingPostures, revenueRealization, escalations,
    proposals, negotiations, slaBundles,
    activityEvents, auditEvents, supabaseBacked: true,
  };
}

export function getPricingLinesForScenarioFromBundle(bundle: CommercialWorkspaceBundle, scenarioId: string): QuotePricingLine[] {
  return bundle.pricingLines.filter(l => l.scenarioId === scenarioId);
}
