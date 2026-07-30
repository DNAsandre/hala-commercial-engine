/**
 * supabase-commercial-data.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.9).
 *
 * Commercial workspace data boundary over commercial_tickets.
 *
 * What is real in this build:
 *  - The workspace ticket itself (commercial_tickets, proposal path).
 *  - Activity / audit events (commercial_ticket_audit rows for the ticket).
 *
 * The legacy quote/P&L/proposal/SLA child surfaces were prototype tables and
 * are not canonical business truth; those bundle sections are returned as
 * explicit empty collections until a verified source exists. Nothing is
 * fabricated to fill them.
 */

import { supabase } from "./supabase";
import { handleSupabaseError } from "@/lib/supabase-error";
import { fetchOperationalTicketsByType } from "./intake-save";
import type { CommercialTicket } from "./unified-ticket-types";
import type {
  CommercialActivityEvent,
  CommercialAuditEvent,
  CommercialMockEscalation,
  CommercialNegotiationRound,
  CommercialProposalVersion,
  CommercialSlaDraft,
  CommercialSlaKpi,
  CommercialSlaPromiseGap,
  CommercialSlaSection,
  QuoteScenario,
} from "./commercial-workspace-data";

// ============================================================
// LOCAL STRUCTURAL TYPES
// ============================================================
// These mirror the panel-owned types (components/commercial/*) verbatim so
// the bundle stays assignable to panel props. They are intentionally not
// exported: the components remain the canonical owners of these shapes.

type ServiceCategory = "Storage" | "Inbound Handling" | "Outbound Handling" | "Value Added Services" | "Transport Add-On" | "Special Handling" | "Dedicated Manpower" | "Admin / Reporting";
type CostOwner = "Operations" | "Finance" | "Transport" | "Warehouse" | "HSE" | "Projects";
type LineRiskLevel = "Low" | "Medium" | "High" | "Critical";
type LineReviewStatus = "Draft Mock" | "Needs Ops Input" | "Needs Finance Input" | "Reviewed Mock" | "Risk Flagged";

interface QuotePricingLine {
  id: string;
  scenarioId: string;
  serviceCategory: ServiceCategory;
  serviceName: string;
  description: string;
  unit: string;
  volume: number;
  sellingRate: number;
  revenue: number;
  costRate: number;
  cost: number;
  grossProfit: number;
  gpPercent: number;
  costOwner: CostOwner;
  sellingOwner: string;
  assumption: string;
  riskLevel: LineRiskLevel;
  riskReason: string;
  reviewStatus: LineReviewStatus;
  notes: string;
}

type PnlConfidence = "Missing" | "Draft Mock" | "Needs Finance Input" | "Needs Ops Input" | "Needs Finance + Ops Input" | "Ready for Review Mock" | "Reviewed Mock";
type AuthoritySeverity = "green" | "amber" | "red" | "critical";

interface QuotePnlSnapshot {
  scenarioId: string;
  revenue: number;
  warehouseCost: number;
  transportCost: number;
  laborCost: number;
  specialHandlingCost: number;
  adminReportingCost: number;
  riskReserve: number;
  totalCost: number;
  grossProfit: number;
  gpPercent: number;
  pnlConfidence: PnlConfidence;
  missingInputs: string[];
  inputOwners: { owner: string; item: string }[];
  assumptions: string[];
  notes: string;
  lastReviewed: string;
  reviewedBy: string;
}

interface MarginAuthoritySignal {
  scenarioId: string;
  gpPercent: number;
  thresholdBand: string;
  authorityLevel: string;
  requiredRolesFuture: string[];
  severity: AuthoritySeverity;
  reason: string;
  wouldRequireApproval: boolean;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  runtimeMode: string;
  notes: string;
}

type ScoreGrade = "A" | "B" | "C" | "D" | "F";
type IcpFit = "Strong ICP Fit" | "Moderate ICP Fit" | "Weak ICP Fit" | "Not ICP Fit";
type DiscountSuitability = "Eligible" | "Limited" | "Not Recommended" | "Commercial Director Review Future";
type PursuitRecommendation = "Fight" | "Protect" | "Monitor" | "Reprice" | "Walk Away" | "Replace / Exit Later";
type OverrideStatus = "No Override" | "Mock Review Only" | "Future Commercial Director Override Required";

interface CommercialCustomerScore {
  customerName: string;
  workspaceId: string;
  overallGrade: ScoreGrade;
  overallScore: number;
  financialStrength: { score: number; grade: ScoreGrade; reason: string };
  operationalBehavior: { score: number; grade: ScoreGrade; reason: string };
  strategicFit: { score: number; grade: ScoreGrade; reason: string };
  commercialFit: { score: number; grade: ScoreGrade; reason: string };
  icpFit: IcpFit;
  paymentStatus: string;
  dsoDays: number;
  discountSuitability: DiscountSuitability;
  pursuitRecommendation: PursuitRecommendation;
  riskReasons: string[];
  positiveReasons: string[];
  overrideStatus: OverrideStatus;
  overrideAllowedFutureRole: string;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

type CapacityFitStatus = "Strong Fit" | "Acceptable Fit" | "Constrained" | "High Risk" | "Mock Escalated";
type CapacityRiskLevel = "Low" | "Medium" | "High" | "Critical";

interface WarehouseConstraint {
  label: string;
  value: string;
  status: "ok" | "warning" | "risk";
}

interface CommercialCapacityFit {
  scenarioId: string;
  workspaceId: string;
  customerName: string;
  requiredPalletPositions: number;
  availablePalletPositions: number;
  effectiveRequiredPositions: number;
  utilizationBefore: number;
  utilizationAfter: number;
  utilizationTarget: number;
  capacityFitScore: number;
  capacityFitStatus: CapacityFitStatus;
  riskLevel: CapacityRiskLevel;
  constraints: WarehouseConstraint[];
  riskReasons: string[];
  positiveReasons: string[];
  promiseGaps: string[];
  opsOwner: string;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

type PostureValue = "Aggressive" | "Balanced" | "Hold Ground" | "Reprice" | "Walk Away";
type PostureSeverity = "Low" | "Medium" | "High" | "Critical";

interface CommercialPricingPosture {
  scenarioId: string;
  posture: PostureValue;
  recommendation: string;
  decisionOwner: string;
  severity: PostureSeverity;
  rationale: string;
  pressureSignals: string[];
  supportingSignals: string[];
  riskSignals: string[];
  recommendedActions: string[];
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  runtimeMode: string;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

type BudgetImpactTiming = "This Month" | "This Quarter" | "Next Quarter" | "Next Year" | "Unknown";
type RealizationConfidence = "Low" | "Medium" | "High" | "Mock Reviewed";

interface TimelineStage {
  stage: string;
  date: string;
  status: "done" | "current" | "upcoming" | "at_risk";
}

interface CommercialRevenueRealization {
  scenarioId: string;
  budgetImpactTiming: BudgetImpactTiming;
  realizationConfidence: RealizationConfidence;
  timeline: TimelineStage[];
  delayRisks: string[];
  accelerationOpportunities: string[];
  owner: string;
  wouldEscalate: boolean;
  mockEscalationCreated: boolean;
  notes: string;
}

// ============================================================
// BUNDLE TYPES
// ============================================================

export interface SlaBundleForDraft {
  draft: CommercialSlaDraft;
  sections: CommercialSlaSection[];
  kpis: CommercialSlaKpi[];
  promiseGaps: CommercialSlaPromiseGap[];
}

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

function emptyBundle(): CommercialWorkspaceBundle {
  return {
    scenarios: [],
    pricingLines: [],
    pnlSnapshots: {},
    marginSignals: {},
    customerScore: null,
    capacityFits: {},
    pricingPostures: {},
    revenueRealization: {},
    escalations: {},
    proposals: [],
    negotiations: [],
    slaBundles: [],
    activityEvents: [],
    auditEvents: [],
    supabaseBacked: false,
  };
}

// ============================================================
// TICKET RESOLUTION + AUDIT MAPPING
// ============================================================

function getTicketDetails(row: CommercialTicket): Record<string, any> {
  return row.type_details && typeof row.type_details === "object" && !Array.isArray(row.type_details)
    ? row.type_details as Record<string, any>
    : {};
}

function ticketMatchesWorkspaceId(ticket: CommercialTicket, workspaceId: string): boolean {
  const details = getTicketDetails(ticket);
  return (
    ticket.id === workspaceId ||
    ticket.legacy_workspace_id === workspaceId ||
    details.linked_workspace_id === workspaceId
  );
}

function mapAuditRowToActivity(row: any, workspaceId: string): CommercialActivityEvent {
  return {
    id: row.id,
    workspaceId,
    eventType: row.field_changed ?? row.action ?? "",
    title: row.field_changed ?? row.action ?? "Ticket audit",
    description: row.notes ?? "",
    category: "Workspace",
    actor: row.user_name ?? "",
    role: "",
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    relatedArtifact: "",
    relatedModule: "",
    relatedScenarioId: "",
    severity: "Info",
    mock: false,
    notes: "",
  };
}

function mapAuditRowToAuditEvent(row: any, workspaceId: string): CommercialAuditEvent {
  return {
    id: row.id,
    workspaceId,
    eventCode: row.field_changed ?? "",
    eventName: row.field_changed ?? row.action ?? "",
    description: row.notes ?? "",
    category: "SYSTEM",
    actor: row.user_name ?? "",
    role: "",
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    entityType: "commercial_ticket",
    entityName: row.ticket_id ?? "",
    beforeState: row.old_value ?? "",
    afterState: row.new_value ?? "",
    mock: false,
    severity: "Info",
    traceId: "",
    notes: "",
  };
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Load the commercial workspace bundle for a workspace id.
 *
 * Real reads: the proposal ticket (commercial_tickets via the established
 * operational read path) and its commercial_ticket_audit rows. Sections with
 * no verified source (scenarios, pricing lines, P&L snapshots, SLA drafts,
 * escalations, panel signals) come back as explicit empty collections.
 * Read failures throw — the caller's error state renders, not a fake bundle.
 */
export async function fetchCommercialWorkspaceBundle(workspaceId: string): Promise<CommercialWorkspaceBundle> {
  const { data, error } = await fetchOperationalTicketsByType("proposal");
  if (error) {
    throw new Error(`Failed to load commercial workspace: ${error}`);
  }

  const ticket = data.find(t => ticketMatchesWorkspaceId(t, workspaceId));
  if (!ticket) {
    // No matching ticket — an honest empty bundle, not an invented workspace.
    return emptyBundle();
  }

  const bundle = emptyBundle();
  bundle.supabaseBacked = true;

  const audit = await supabase
    .from("commercial_ticket_audit")
    .select("*")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: false });

  if (audit.error) {
    handleSupabaseError("fetchCommercialWorkspaceBundle:audit", audit.error, { silent: true });
  } else {
    bundle.activityEvents = (audit.data ?? []).map(row => mapAuditRowToActivity(row, workspaceId));
    bundle.auditEvents = (audit.data ?? []).map(row => mapAuditRowToAuditEvent(row, workspaceId));
  }

  return bundle;
}

export function getPricingLinesForScenarioFromBundle(
  bundle: CommercialWorkspaceBundle,
  scenarioId: string,
): QuotePricingLine[] {
  return bundle.pricingLines.filter((line) => line.scenarioId === scenarioId);
}
