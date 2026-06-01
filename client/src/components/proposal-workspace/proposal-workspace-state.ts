/**
 * Proposal Workspace — Centralized state types and defaults.
 * Used by stages 1-4 (Qualified → P&L) and beyond.
 */

// ══════════════════════════════════════════════════════
// STAGE 1 — QUALIFIED
// ══════════════════════════════════════════════════════

export interface QualificationSummary {
  opportunityName: string;
  customer: string;
  region: string;
  industry: string;
  serviceType: string;
  estimatedRevenue: number;
  estimatedPallets: number;
  expectedCloseDate: string;
  crmRef: string;
  leadSource: string;
  qualificationConfidence: number; // 0-100
}

export interface CustomerFit {
  icpFit: "strong" | "moderate" | "weak" | "";
  strategicFit: "strong" | "moderate" | "weak" | "";
  regionFit: "strong" | "moderate" | "weak" | "";
  capabilityFit: "strong" | "moderate" | "weak" | "";
  relationshipStrength: "strong" | "moderate" | "weak" | "";
  competitorPresence: "none" | "low" | "high" | "incumbent" | "";
  fitScore: "green" | "amber" | "red" | "";
  // Competitive Intelligence Pipeline
  scrapperBotSent: boolean;
  aiResearchDone: boolean;
  competitiveAnalysisDone: boolean;
  strategicFindings: string;
}

export interface OpportunityBrief {
  customerNeed: string;
  whyNow: string;
  scopeSummary: string;
  keyStakeholders: string;
  decisionTimeline: string;
  knownConstraints: string;
}

export interface RequiredInfoItem {
  label: string;
  key: string;
  complete: boolean;
  notes: string;
}

export const DEFAULT_REQUIRED_INFO: RequiredInfoItem[] = [
  { label: "Customer Volumes", key: "volumes", complete: false, notes: "" },
  { label: "Site Info", key: "site_info", complete: false, notes: "" },
  { label: "Required Services", key: "services", complete: false, notes: "" },
  { label: "Budget Insight", key: "budget", complete: false, notes: "" },
  { label: "Deadline", key: "deadline", complete: false, notes: "" },
  { label: "Customer Requirements Doc", key: "requirements", complete: false, notes: "" },
  { label: "Internal Owner Assigned", key: "owner", complete: false, notes: "" },
];

// ══════════════════════════════════════════════════════
// STAGE 2 — DISCOVERY
// ══════════════════════════════════════════════════════

export interface MeetingNote {
  id: string;
  date: string;
  attendees: string;
  notes: string;
  keyDecisions: string;
  openQuestions: string;
  nextActions: string;
}

export interface CustomerNeeds {
  warehousing: string;
  transport: string;
  vas: string;
  reporting: string;
  compliance: string;
  slaExpectations: string;
}

export interface CurrentPain {
  currentProvider: string;
  costPain: string;
  servicePain: string;
  speedPain: string;
  compliancePain: string;
}

export interface VolumesLanesStorage {
  skuCount: string;
  inbound: string;
  outbound: string;
  pallets: string;
  locations: string;
  laneMatrix: string;
  tempZones: string;
  peakSeasonality: string;
}

export interface RisksAssumptions {
  unknowns: string;
  dataGaps: string;
  customerUncertainty: string;
  capacityAssumptions: string;
  commercialAssumptions: string;
}

// ══════════════════════════════════════════════════════
// STAGE 3 — SOLUTION DESIGN
// ══════════════════════════════════════════════════════

export interface WarehouseModel {
  storageType: string;
  facilityType: string;
  capacityEstimate: string;
  handlingAssumptions: string;
  tempZones: string;
  laborAssumptions: string;
}

export interface TransportModel {
  laneStructure: string;
  vehicleTypes: string;
  frequency: string;
  sla: string;
  routeComplexity: string;
  vendorRequirements: string;
}

export interface VasHandling {
  labeling: string;
  kitting: string;
  packaging: string;
  returns: string;
  compliance: string;
  specializedHandling: string;
}

export interface ServiceScope {
  included: string;
  excluded: string;
  customerResponsibilities: string;
  halaResponsibilities: string;
  kpiScope: string;
}

export interface OperationalFeasibility {
  capacityFit: "fit" | "tight" | "gap" | "";
  equipmentFit: "fit" | "tight" | "gap" | "";
  regionFit: "fit" | "tight" | "gap" | "";
  opsComments: string;
  riskFlags: string;
}

// ══════════════════════════════════════════════════════
// STAGE 4 — P&L / PRICING
// ══════════════════════════════════════════════════════

export interface PnlLine {
  label: string;
  amount: number;
}

export interface PnlVersion {
  id: string;
  name: string;
  createdAt: string;
  revenue: PnlLine[];
  costs: PnlLine[];
  overheadPercent: number;
  notes: string;
  isApproved: boolean;
}

export interface CostInput {
  category: string;
  description: string;
  amount: number;
  source: string;
  verified: boolean;
}

export interface PricingLine {
  service: string;
  unit: string;
  rate: number;
  quantity: number;
  frequency: string;
  total: number;
}

export interface MarginScenario {
  name: string;
  revenue: number;
  cost: number;
  gp: number;
  gpPercent: number;
  notes: string;
}

export interface ApprovalSignal {
  type: "warning" | "info" | "critical";
  message: string;
  recommendation: string;
}

// ══════════════════════════════════════════════════════
// FULL WORKSPACE STATE
// ══════════════════════════════════════════════════════

export interface ProposalWorkspaceData {
  // Stage 1
  qualificationSummary: QualificationSummary;
  customerFit: CustomerFit;
  opportunityBrief: OpportunityBrief;
  requiredInfo: RequiredInfoItem[];

  // Stage 2
  meetingNotes: MeetingNote[];
  customerNeeds: CustomerNeeds;
  currentPain: CurrentPain;
  volumesLanes: VolumesLanesStorage;
  risksAssumptions: RisksAssumptions;

  // Stage 3
  warehouseModel: WarehouseModel;
  transportModel: TransportModel;
  vasHandling: VasHandling;
  serviceScope: ServiceScope;
  operationalFeasibility: OperationalFeasibility;

  // Stage 4
  pnlVersions: PnlVersion[];
  activePnlVersion: string; // version id
  costInputs: CostInput[];
  pricingLines: PricingLine[];
  marginScenarios: MarginScenario[];
}

export function createDefaultWorkspaceData(): ProposalWorkspaceData {
  return {
    qualificationSummary: {
      opportunityName: "", customer: "", region: "", industry: "",
      serviceType: "", estimatedRevenue: 0, estimatedPallets: 0,
      expectedCloseDate: "", crmRef: "", leadSource: "",
      qualificationConfidence: 0,
    },
    customerFit: {
      icpFit: "", strategicFit: "", regionFit: "",
      capabilityFit: "", relationshipStrength: "",
      competitorPresence: "", fitScore: "",
      scrapperBotSent: false, aiResearchDone: false,
      competitiveAnalysisDone: false, strategicFindings: "",
    },
    opportunityBrief: {
      customerNeed: "", whyNow: "", scopeSummary: "",
      keyStakeholders: "", decisionTimeline: "", knownConstraints: "",
    },
    requiredInfo: [...DEFAULT_REQUIRED_INFO],
    meetingNotes: [],
    customerNeeds: {
      warehousing: "", transport: "", vas: "",
      reporting: "", compliance: "", slaExpectations: "",
    },
    currentPain: {
      currentProvider: "", costPain: "", servicePain: "",
      speedPain: "", compliancePain: "",
    },
    volumesLanes: {
      skuCount: "", inbound: "", outbound: "", pallets: "",
      locations: "", laneMatrix: "", tempZones: "", peakSeasonality: "",
    },
    risksAssumptions: {
      unknowns: "", dataGaps: "", customerUncertainty: "",
      capacityAssumptions: "", commercialAssumptions: "",
    },
    warehouseModel: {
      storageType: "", facilityType: "", capacityEstimate: "",
      handlingAssumptions: "", tempZones: "", laborAssumptions: "",
    },
    transportModel: {
      laneStructure: "", vehicleTypes: "", frequency: "",
      sla: "", routeComplexity: "", vendorRequirements: "",
    },
    vasHandling: {
      labeling: "", kitting: "", packaging: "",
      returns: "", compliance: "", specializedHandling: "",
    },
    serviceScope: {
      included: "", excluded: "", customerResponsibilities: "",
      halaResponsibilities: "", kpiScope: "",
    },
    operationalFeasibility: {
      capacityFit: "", equipmentFit: "", regionFit: "",
      opsComments: "", riskFlags: "",
    },
    pnlVersions: [],
    activePnlVersion: "",
    costInputs: [],
    pricingLines: [],
    marginScenarios: [
      { name: "Base Case", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Aggressive", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Defensive", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Strategic", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
      { name: "Customer Target", revenue: 0, cost: 0, gp: 0, gpPercent: 0, notes: "" },
    ],
  };
}

// ══════════════════════════════════════════════════════
// READINESS SCORES (advisory only)
// ══════════════════════════════════════════════════════

export function calcQualificationReadiness(d: ProposalWorkspaceData): number {
  const qs = d.qualificationSummary;
  const cf = d.customerFit;
  const ob = d.opportunityBrief;
  const ri = d.requiredInfo;
  let score = 0, total = 0;
  // Summary fields
  const sFields = [qs.opportunityName, qs.customer, qs.region, qs.serviceType, qs.expectedCloseDate];
  sFields.forEach(f => { total++; if (f) score++; });
  if (qs.estimatedRevenue > 0) score++; total++;
  // Fit
  [cf.icpFit, cf.strategicFit, cf.regionFit, cf.capabilityFit].forEach(f => { total++; if (f) score++; });
  // Brief
  [ob.customerNeed, ob.scopeSummary].forEach(f => { total++; if (f) score++; });
  // Required info
  ri.forEach(r => { total++; if (r.complete) score++; });
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcDiscoveryCompleteness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  // Meeting notes
  total++; if (d.meetingNotes.length > 0) score++;
  // Needs
  const cn = d.customerNeeds;
  [cn.warehousing, cn.transport].forEach(f => { total++; if (f) score++; });
  // Volumes
  const vl = d.volumesLanes;
  [vl.pallets, vl.skuCount, vl.inbound, vl.outbound].forEach(f => { total++; if (f) score++; });
  // Pain
  const cp = d.currentPain;
  [cp.currentProvider, cp.costPain].forEach(f => { total++; if (f) score++; });
  // Risks
  total++; if (d.risksAssumptions.unknowns || d.risksAssumptions.dataGaps) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcSolutionReadiness(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  const wm = d.warehouseModel;
  [wm.storageType, wm.capacityEstimate].forEach(f => { total++; if (f) score++; });
  const tm = d.transportModel;
  [tm.laneStructure, tm.vehicleTypes].forEach(f => { total++; if (f) score++; });
  const ss = d.serviceScope;
  [ss.included, ss.excluded].forEach(f => { total++; if (f) score++; });
  const of2 = d.operationalFeasibility;
  [of2.capacityFit, of2.equipmentFit].forEach(f => { total++; if (f) score++; });
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function calcPricingConfidence(d: ProposalWorkspaceData): number {
  let score = 0, total = 0;
  total++; if (d.pnlVersions.length > 0) score++;
  total++; if (d.costInputs.length > 0) score++;
  total++; if (d.pricingLines.length > 0) score++;
  total++; if (d.costInputs.filter(c => c.verified).length > 0) score++;
  total++; if (d.pnlVersions.some(v => v.isApproved)) score++;
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

// ══════════════════════════════════════════════════════
// SIGNAL ENGINE (soft advisory)
// ══════════════════════════════════════════════════════

export interface WorkspaceSignal {
  stage: string;
  type: "warning" | "info" | "critical";
  message: string;
  recommendation: string;
}

export function generateSignals(d: ProposalWorkspaceData): WorkspaceSignal[] {
  const signals: WorkspaceSignal[] = [];
  // Qualification
  if (!d.qualificationSummary.customer) signals.push({ stage: "qualified", type: "warning", message: "Missing customer name", recommendation: "Add customer to Qualification Summary" });
  if (d.qualificationSummary.qualificationConfidence < 30 && d.qualificationSummary.qualificationConfidence > 0) signals.push({ stage: "qualified", type: "warning", message: "Low qualification confidence", recommendation: "Review customer fit and required info before proceeding" });
  if (d.requiredInfo.filter(r => r.complete).length < 3) signals.push({ stage: "qualified", type: "info", message: "Required info incomplete", recommendation: "Gather missing information items" });
  // Discovery
  if (d.meetingNotes.length === 0) signals.push({ stage: "discovery", type: "info", message: "No meeting notes captured", recommendation: "Record customer discovery meetings" });
  if (!d.volumesLanes.pallets && !d.volumesLanes.skuCount) signals.push({ stage: "discovery", type: "warning", message: "Missing volume data", recommendation: "Capture pallet/SKU volumes for solution design" });
  // Solution
  if (!d.serviceScope.included) signals.push({ stage: "solution_design", type: "info", message: "Scope not defined", recommendation: "Define included/excluded services" });
  if (d.operationalFeasibility.capacityFit === "gap") signals.push({ stage: "solution_design", type: "critical", message: "Capacity gap identified", recommendation: "Escalate to operations before pricing" });
  // P&L
  if (d.pnlVersions.length === 0) signals.push({ stage: "pnl_pricing", type: "info", message: "No P&L version created", recommendation: "Create initial P&L to establish commercial baseline" });
  if (d.costInputs.some(c => !c.verified)) signals.push({ stage: "pnl_pricing", type: "warning", message: "Unverified cost inputs", recommendation: "Verify external quotes and cost assumptions" });
  const approved = d.pnlVersions.find(v => v.isApproved);
  if (approved) {
    const totalRev = approved.revenue.reduce((s, l) => s + l.amount, 0);
    const totalCost = approved.costs.reduce((s, l) => s + l.amount, 0);
    const gpPct = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
    if (gpPct < 10) signals.push({ stage: "pnl_pricing", type: "critical", message: `GP% at ${gpPct.toFixed(1)}% — critically low`, recommendation: "Review pricing or escalate for approval" });
    else if (gpPct < 22) signals.push({ stage: "pnl_pricing", type: "warning", message: `GP% at ${gpPct.toFixed(1)}% — below target`, recommendation: "Consider margin improvement or director approval" });
  }
  return signals;
}

// ══════════════════════════════════════════════════════
// AUDIT TRAIL — Proposal workspace activity logging
// ══════════════════════════════════════════════════════

export interface ProposalAuditEntry {
  id: string;
  workspaceId: string;
  timestamp: string;
  action: string;
  stage: string;
  tab: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  user: string;
  details: string;
}

// In-memory audit log only.
// Persistence belongs in Supabase after an approved schema/API path exists.
let _auditLog: ProposalAuditEntry[] = [];

export function getProposalAuditLog(workspaceId: string): ProposalAuditEntry[] {
  return _auditLog.filter(e => e.workspaceId === workspaceId);
}

export function logProposalAudit(entry: Omit<ProposalAuditEntry, "id" | "timestamp" | "user">) {
  const full: ProposalAuditEntry = {
    ...entry,
    id: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    user: "Unknown user",
  };
  _auditLog.unshift(full);
  // Keep last 500 entries per workspace
  const wsEntries = _auditLog.filter(e => e.workspaceId === entry.workspaceId);
  if (wsEntries.length > 500) {
    const cutoff = wsEntries[499].timestamp;
    _auditLog = _auditLog.filter(e => e.workspaceId !== entry.workspaceId || e.timestamp >= cutoff);
  }
}

// Diff helper: detect which fields changed between old and new data
export function logDataChange(
  workspaceId: string,
  stage: string,
  tab: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
) {
  for (const key of Object.keys(newData)) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (typeof newVal === "object" && newVal !== null) continue; // Skip nested objects — log at leaf level
    if (oldVal !== newVal && (oldVal || newVal)) {
      logProposalAudit({
        workspaceId, action: "field_update", stage, tab,
        field: key,
        oldValue: String(oldVal ?? ""),
        newValue: String(newVal ?? ""),
        details: `${key} updated`,
      });
    }
  }
}
