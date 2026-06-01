/**
 * Commercial workspace data boundary.
 *
 * Legacy quote/P&L/proposal/SLA/activity tables were prototype surfaces and
 * are not canonical business truth. Until those child modules are rebuilt
 * against commercial_tickets with lineage, this compatibility layer exposes
 * empty data instead of leaking unverified records into operational views.
 */

import type { QuotePricingLine } from "@/components/commercial/CommercialPricingLinesTable";
import type { QuotePnlSnapshot, MarginAuthoritySignal } from "@/components/commercial/CommercialPnlAuthorityPanels";
import type { CommercialCustomerScore } from "@/components/commercial/CommercialCustomerScorePanel";
import type { CommercialCapacityFit } from "@/components/commercial/CommercialCapacityFitPanel";
import type {
  CommercialPricingPosture,
  PostureSeverity,
  PostureValue,
} from "@/components/commercial/CommercialPricingPosturePanel";
import type { CommercialRevenueRealization } from "@/components/commercial/CommercialRevenueRealizationPanel";
import type {
  CapacityFit,
  CommercialActivityEvent,
  CommercialAuditEvent,
  CommercialMockEscalation,
  CommercialNegotiationRound,
  CommercialProposalVersion,
  CommercialSlaDraft,
  CommercialSlaKpi,
  CommercialSlaPromiseGap,
  CommercialSlaSection,
  CustomerScore,
  PricingPosture,
  QuoteScenario,
  RevenueTiming,
} from "./commercial-workspace-data";

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

export async function fetchCommercialQuoteScenarios(workspaceId: string): Promise<QuoteScenario[]> {
  void workspaceId;
  return [];
}

export async function fetchCommercialPricingLines(scenarioIds: string[]): Promise<QuotePricingLine[]> {
  void scenarioIds;
  return [];
}

export async function fetchCommercialPnlSnapshots(scenarioIds: string[]): Promise<Record<string, QuotePnlSnapshot>> {
  void scenarioIds;
  return {};
}

export async function fetchCommercialCustomerScore(workspaceId: string): Promise<CommercialCustomerScore | null> {
  void workspaceId;
  return null;
}

export async function fetchCommercialCapacityFits(scenarioIds: string[]): Promise<Record<string, CommercialCapacityFit>> {
  void scenarioIds;
  return {};
}

export async function fetchCommercialRevenueRealization(
  scenarioIds: string[],
): Promise<Record<string, CommercialRevenueRealization>> {
  void scenarioIds;
  return {};
}

export async function fetchCommercialMockEscalations(
  scenarioIds: string[],
): Promise<Record<string, CommercialMockEscalation[]>> {
  void scenarioIds;
  return {};
}

export async function fetchCommercialProposals(workspaceId: string): Promise<CommercialProposalVersion[]> {
  void workspaceId;
  return [];
}

export async function fetchCommercialNegotiations(workspaceId: string): Promise<CommercialNegotiationRound[]> {
  void workspaceId;
  return [];
}

export async function fetchCommercialSlaDrafts(workspaceId: string): Promise<SlaBundleForDraft[]> {
  void workspaceId;
  return [];
}

export async function fetchCommercialActivityEvents(workspaceId: string): Promise<CommercialActivityEvent[]> {
  void workspaceId;
  return [];
}

export async function fetchCommercialAuditEvents(workspaceId: string): Promise<CommercialAuditEvent[]> {
  void workspaceId;
  return [];
}

export function deriveMarginAuthoritySignal(scenario: QuoteScenario): MarginAuthoritySignal {
  const gp = scenario.gpPercent;
  let severity: "critical" | "amber" | "green" = "green";
  let thresholdBand = "GP >= 22%";
  let authorityLevel = "Local Authority";
  let requiredRolesFuture: string[] = [];
  let reason = `GP at ${gp}% is within local authority.`;

  if (gp < 10) {
    severity = "critical";
    thresholdBand = "GP < 10%";
    authorityLevel = "Executive escalation";
    requiredRolesFuture = ["CEO", "CFO", "Commercial Director"];
    reason = `GP at ${gp}% is below the 10% threshold.`;
  } else if (gp < 22) {
    severity = "amber";
    thresholdBand = "GP < 22%";
    authorityLevel = "Commercial / Ops Review";
    requiredRolesFuture = ["Commercial Director", "Ops Manager"];
    reason = `GP at ${gp}% is below the 22% target threshold.`;
  }

  return {
    scenarioId: scenario.id,
    gpPercent: gp,
    thresholdBand,
    authorityLevel,
    requiredRolesFuture,
    severity,
    reason,
    wouldRequireApproval: gp < 22,
    wouldEscalate: gp < 10,
    mockEscalationCreated: false,
    allowTestBypass: true,
    runtimeMode: "Advisory",
    notes: "",
  };
}

export function derivePricingPosture(scenario: QuoteScenario): CommercialPricingPosture {
  const gp = scenario.gpPercent;
  let posture: PostureValue = "Balanced";
  let severity: PostureSeverity = "Medium";
  let recommendation = "Protect price and confirm operational capacity.";

  if (gp < 6) {
    posture = "Walk Away";
    severity = "Critical";
    recommendation = "Do not progress without repricing and executive review.";
  } else if (gp < 10) {
    posture = "Reprice";
    severity = "High";
    recommendation = "Reprice before proposal progression.";
  } else if (gp >= 22) {
    severity = "Low";
    recommendation = "Commercially within target, subject to verified inputs.";
  }

  return {
    scenarioId: scenario.id,
    posture,
    recommendation,
    decisionOwner: severity === "Critical" ? "Commercial Director / Executive Review" : "Commercial / Ops",
    severity,
    rationale: `GP ${gp}% with posture ${posture}.`,
    pressureSignals: [],
    supportingSignals: [],
    riskSignals: [],
    recommendedActions: [recommendation],
    wouldEscalate: gp < 10,
    mockEscalationCreated: false,
    allowTestBypass: true,
    runtimeMode: "Advisory",
    lastReviewed: "",
    reviewedBy: "",
    notes: "",
  };
}

export async function fetchCommercialWorkspaceBundle(workspaceId: string): Promise<CommercialWorkspaceBundle> {
  void workspaceId;
  return emptyBundle();
}

export function getPricingLinesForScenarioFromBundle(
  bundle: CommercialWorkspaceBundle,
  scenarioId: string,
): QuotePricingLine[] {
  return bundle.pricingLines.filter((line) => line.scenarioId === scenarioId);
}

export type {
  CapacityFit,
  CustomerScore,
  PricingPosture,
  RevenueTiming,
};
