/**
 * Commercial Workspace Mock Data — CW-001 through CW-007
 * Extracted from CommercialQuoteControlTab.tsx to keep the component focused on UI.
 * Development mode only — no real pricing, no backend, no CRM sync.
 */
import { type QuotePricingLine } from "@/components/commercial/CommercialPricingLinesTable";
import { type QuotePnlSnapshot, type MarginAuthoritySignal } from "@/components/commercial/CommercialPnlAuthorityPanels";
import { type CommercialCustomerScore } from "@/components/commercial/CommercialCustomerScorePanel";
import { type CommercialCapacityFit, type WarehouseConstraint } from "@/components/commercial/CommercialCapacityFitPanel";
import { type CommercialPricingPosture } from "@/components/commercial/CommercialPricingPosturePanel";
import { type CommercialRevenueRealization, type TimelineStage } from "@/components/commercial/CommercialRevenueRealizationPanel";

// ─── TYPES ─────────────────────────────────────────────────

export type QuoteScenarioStatus =
  | "not_started"
  | "draft_scenario"
  | "pnl_basis_added"
  | "ready_for_review_mock"
  | "margin_risk_flagged"
  | "mock_reviewed"
  | "client_facing_draft_mock"
  | "superseded_mock";

export type PricingPosture = "Reprice" | "Walk Away / Reprice" | "Balanced" | "Aggressive" | "Premium";
export type CustomerScore = "A" | "B" | "C" | "D";
export type CapacityFit = "Available" | "Acceptable" | "Constrained" | "Critical";
export type RevenueTiming = "This Quarter" | "Next Quarter" | "This Year" | "Beyond";

export interface QuoteScenario {
  id: string;
  name: string;
  version: string;
  status: QuoteScenarioStatus;
  revenue: number;
  cost: number;
  gpPercent: number;
  pricingPosture: PricingPosture;
  customerScore: CustomerScore;
  capacityFit: CapacityFit;
  revenueTiming: RevenueTiming;
  mockEscalation: string;
  owner: string;
  notes: string;
}

// ─── MOCK DATA ─────────────────────────────────────────────

export const MOCK_SCENARIOS: QuoteScenario[] = [
  {
    id: "qs-a",
    name: "Option A — Standard Tariff",
    version: "v0.1",
    status: "draft_scenario",
    revenue: 1200000,
    cost: 1098000,
    gpPercent: 8.5,
    pricingPosture: "Reprice",
    customerScore: "C",
    capacityFit: "Constrained",
    revenueTiming: "Next Quarter",
    mockEscalation: "Red margin signal — CEO/CFO future approval required",
    owner: "Amin Al-Rashid",
    notes: "Standard tariff applied to emergency storage scope. GP below threshold.",
  },
  {
    id: "qs-b",
    name: "Option B — Aggressive Entry Price",
    version: "v0.1",
    status: "margin_risk_flagged",
    revenue: 1080000,
    cost: 1020000,
    gpPercent: 5.6,
    pricingPosture: "Walk Away / Reprice",
    customerScore: "C",
    capacityFit: "Constrained",
    revenueTiming: "Next Quarter",
    mockEscalation: "CEO/CFO future approval required — GP critically below threshold",
    owner: "Amin Al-Rashid",
    notes: "Aggressive entry price to secure initial volume. Margin risk flagged.",
  },
  {
    id: "qs-c",
    name: "Option C — Premium Fast Implementation",
    version: "v0.1",
    status: "ready_for_review_mock",
    revenue: 1380000,
    cost: 1080000,
    gpPercent: 21.7,
    pricingPosture: "Balanced",
    customerScore: "C",
    capacityFit: "Acceptable",
    revenueTiming: "This Quarter",
    mockEscalation: "Future commercial review required — near authority threshold",
    owner: "Amin Al-Rashid",
    notes: "Premium pricing with expedited implementation. GP near threshold.",
  },
];

// ─── MOCK PRICING LINES (CW-002) ──────────────────────────

export const MOCK_PRICING_LINES: QuotePricingLine[] = [
  // ── Option A — Standard Tariff (Rev 1,200,000 / Cost 1,098,000 / GP 8.5%) ──
  { id: "pl-a1", scenarioId: "qs-a", serviceCategory: "Storage", serviceName: "Ambient Pallet Storage", description: "Standard ambient storage at Jubail 1 facility, 400 pallets", unit: "plt/mo", volume: 4800, sellingRate: 180, revenue: 864000, costRate: 169.50, cost: 813600, grossProfit: 50400, gpPercent: 5.8, costOwner: "Warehouse", sellingOwner: "Commercial", assumption: "400 pallets constant occupancy assumed for 12 months", riskLevel: "High", riskReason: "Storage margin is thin — minimal buffer for cost overruns", reviewStatus: "Needs Ops Input", notes: "Core storage line drives majority of revenue" },
  { id: "pl-a2", scenarioId: "qs-a", serviceCategory: "Inbound Handling", serviceName: "Inbound Handling", description: "Standard inbound receiving and putaway", unit: "mvt", volume: 7200, sellingRate: 12, revenue: 86400, costRate: 10, cost: 72000, grossProfit: 14400, gpPercent: 16.7, costOwner: "Operations", sellingOwner: "Commercial", assumption: "600 movements/month avg based on client forecast", riskLevel: "Low", riskReason: "", reviewStatus: "Draft Mock", notes: "" },
  { id: "pl-a3", scenarioId: "qs-a", serviceCategory: "Outbound Handling", serviceName: "Outbound Handling", description: "Standard outbound pick, pack, and dispatch", unit: "mvt", volume: 6600, sellingRate: 14, revenue: 92400, costRate: 11.50, cost: 75900, grossProfit: 16500, gpPercent: 17.9, costOwner: "Operations", sellingOwner: "Commercial", assumption: "550 movements/month avg", riskLevel: "Low", riskReason: "", reviewStatus: "Draft Mock", notes: "" },
  { id: "pl-a4", scenarioId: "qs-a", serviceCategory: "Value Added Services", serviceName: "Value Added Services", description: "Labeling, re-palletizing, and quality checks", unit: "unit", volume: 2400, sellingRate: 25, revenue: 60000, costRate: 20, cost: 48000, grossProfit: 12000, gpPercent: 20.0, costOwner: "Operations", sellingOwner: "Commercial", assumption: "200 VAS units/month", riskLevel: "Low", riskReason: "", reviewStatus: "Reviewed Mock", notes: "" },
  { id: "pl-a5", scenarioId: "qs-a", serviceCategory: "Admin / Reporting", serviceName: "Admin & Reporting", description: "Monthly reporting, inventory reconciliation, admin overhead", unit: "month", volume: 12, sellingRate: 6000, revenue: 72000, costRate: 5500, cost: 66000, grossProfit: 6000, gpPercent: 8.3, costOwner: "Finance", sellingOwner: "Commercial", assumption: "Fixed monthly admin fee", riskLevel: "Medium", riskReason: "Admin cost may increase if scope expands", reviewStatus: "Needs Finance Input", notes: "" },
  { id: "pl-a6", scenarioId: "qs-a", serviceCategory: "Special Handling", serviceName: "Special Handling Buffer", description: "Emergency handling, overtime, and hazmat surcharge buffer", unit: "event", volume: 600, sellingRate: 42, revenue: 25200, costRate: 37.50, cost: 22500, grossProfit: 2700, gpPercent: 10.7, costOwner: "Operations", sellingOwner: "Commercial", assumption: "50 events/month estimated", riskLevel: "Medium", riskReason: "Actual special handling demand is uncertain", reviewStatus: "Needs Ops Input", notes: "" },

  // ── Option B — Aggressive Entry (Rev 1,080,000 / Cost 1,019,520 / GP 5.6%) ──
  { id: "pl-b1", scenarioId: "qs-b", serviceCategory: "Storage", serviceName: "Ambient Pallet Storage", description: "Discounted storage rate to win entry volume", unit: "plt/mo", volume: 4800, sellingRate: 165, revenue: 792000, costRate: 160, cost: 768000, grossProfit: 24000, gpPercent: 3.0, costOwner: "Warehouse", sellingOwner: "Commercial", assumption: "400 pallets — aggressive rate to secure footprint", riskLevel: "High", riskReason: "Storage rate barely covers cost — no buffer for cost increases", reviewStatus: "Risk Flagged", notes: "Below standard tariff" },
  { id: "pl-b2", scenarioId: "qs-b", serviceCategory: "Inbound Handling", serviceName: "Inbound Handling", description: "Reduced inbound rate for entry pricing", unit: "mvt", volume: 7200, sellingRate: 10.50, revenue: 75600, costRate: 9.50, cost: 68400, grossProfit: 7200, gpPercent: 9.5, costOwner: "Operations", sellingOwner: "Commercial", assumption: "600 movements/month — tight margin", riskLevel: "Medium", riskReason: "Near breakeven if volumes drop", reviewStatus: "Draft Mock", notes: "" },
  { id: "pl-b3", scenarioId: "qs-b", serviceCategory: "Outbound Handling", serviceName: "Outbound Handling", description: "Reduced outbound rate", unit: "mvt", volume: 6600, sellingRate: 11.50, revenue: 75900, costRate: 10.50, cost: 69300, grossProfit: 6600, gpPercent: 8.7, costOwner: "Operations", sellingOwner: "Commercial", assumption: "550 movements/month", riskLevel: "Medium", riskReason: "Tight margin on handling", reviewStatus: "Draft Mock", notes: "" },
  { id: "pl-b4", scenarioId: "qs-b", serviceCategory: "Value Added Services", serviceName: "Value Added Services", description: "Basic VAS package", unit: "unit", volume: 2400, sellingRate: 18, revenue: 43200, costRate: 14, cost: 33600, grossProfit: 9600, gpPercent: 22.2, costOwner: "Operations", sellingOwner: "Commercial", assumption: "200 units/month — only profitable line", riskLevel: "Low", riskReason: "", reviewStatus: "Reviewed Mock", notes: "Best margin line in this scenario" },
  { id: "pl-b5", scenarioId: "qs-b", serviceCategory: "Admin / Reporting", serviceName: "Admin & Reporting", description: "Reduced admin fee — below cost", unit: "month", volume: 12, sellingRate: 3800, revenue: 45600, costRate: 4200, cost: 50400, grossProfit: -4800, gpPercent: -10.5, costOwner: "Finance", sellingOwner: "Commercial", assumption: "Admin subsidized to win deal", riskLevel: "Critical", riskReason: "Selling below cost — would require CFO approval in production", reviewStatus: "Risk Flagged", notes: "Negative margin line" },
  { id: "pl-b6", scenarioId: "qs-b", serviceCategory: "Transport Add-On", serviceName: "Transport Add-On", description: "Local delivery runs included in bundle", unit: "trip", volume: 1200, sellingRate: 39.75, revenue: 47700, costRate: 24.85, cost: 29820, grossProfit: 17880, gpPercent: 37.5, costOwner: "Transport", sellingOwner: "Commercial", assumption: "100 trips/month — transport margin subsidizes other lines", riskLevel: "Low", riskReason: "", reviewStatus: "Draft Mock", notes: "Healthy margin — offsets admin loss" },

  // ── Option C — Premium Fast Implementation (Rev 1,380,000 / Cost 1,080,540 / GP 21.7%) ──
  { id: "pl-c1", scenarioId: "qs-c", serviceCategory: "Storage", serviceName: "Premium Pallet Storage", description: "Premium rate with priority allocation and guaranteed space", unit: "plt/mo", volume: 4800, sellingRate: 210, revenue: 1008000, costRate: 165, cost: 792000, grossProfit: 216000, gpPercent: 21.4, costOwner: "Warehouse", sellingOwner: "Commercial", assumption: "400 pallets — premium rate justified by fast implementation", riskLevel: "Low", riskReason: "", reviewStatus: "Reviewed Mock", notes: "Strong margin from premium positioning" },
  { id: "pl-c2", scenarioId: "qs-c", serviceCategory: "Inbound Handling", serviceName: "Inbound Handling", description: "Standard inbound with priority processing", unit: "mvt", volume: 7200, sellingRate: 15, revenue: 108000, costRate: 10, cost: 72000, grossProfit: 36000, gpPercent: 33.3, costOwner: "Operations", sellingOwner: "Commercial", assumption: "600 movements/month — priority surcharge applied", riskLevel: "Low", riskReason: "", reviewStatus: "Reviewed Mock", notes: "" },
  { id: "pl-c3", scenarioId: "qs-c", serviceCategory: "Outbound Handling", serviceName: "Outbound Handling", description: "Priority outbound with same-day dispatch option", unit: "mvt", volume: 6600, sellingRate: 16, revenue: 105600, costRate: 11, cost: 72600, grossProfit: 33000, gpPercent: 31.3, costOwner: "Operations", sellingOwner: "Commercial", assumption: "550 movements/month", riskLevel: "Low", riskReason: "", reviewStatus: "Draft Mock", notes: "" },
  { id: "pl-c4", scenarioId: "qs-c", serviceCategory: "Value Added Services", serviceName: "Enhanced VAS Package", description: "Full VAS including kitting, labeling, QC, and returns processing", unit: "unit", volume: 2400, sellingRate: 22, revenue: 52800, costRate: 18, cost: 43200, grossProfit: 9600, gpPercent: 18.2, costOwner: "Operations", sellingOwner: "Commercial", assumption: "200 units/month — expanded scope", riskLevel: "Medium", riskReason: "Enhanced scope may require additional headcount", reviewStatus: "Needs Ops Input", notes: "" },
  { id: "pl-c5", scenarioId: "qs-c", serviceCategory: "Dedicated Manpower", serviceName: "Dedicated Team", description: "2 dedicated warehouse staff for Al-Rajhi operations", unit: "man-mo", volume: 24, sellingRate: 2500, revenue: 60000, costRate: 2400, cost: 57600, grossProfit: 2400, gpPercent: 4.0, costOwner: "Operations", sellingOwner: "Commercial", assumption: "2 FTEs for 12 months — tight margin on manpower", riskLevel: "High", riskReason: "Manpower cost may increase with overtime/turnover", reviewStatus: "Needs Ops Input", notes: "" },
  { id: "pl-c6", scenarioId: "qs-c", serviceCategory: "Special Handling", serviceName: "Fast Implementation Premium", description: "Expedited setup, system config, training, and go-live support", unit: "month", volume: 12, sellingRate: 3800, revenue: 45600, costRate: 3595, cost: 43140, grossProfit: 2460, gpPercent: 5.4, costOwner: "Projects", sellingOwner: "Commercial", assumption: "12-month amortized implementation fee", riskLevel: "Medium", riskReason: "Implementation scope creep risk", reviewStatus: "Needs Finance Input", notes: "" },
];

export function getPricingLinesForScenario(scenarioId: string): QuotePricingLine[] {
  return MOCK_PRICING_LINES.filter(l => l.scenarioId === scenarioId);
}

// ─── MOCK P&L SNAPSHOTS (CW-003) ──────────────────────────

export const MOCK_PNL_SNAPSHOTS: Record<string, QuotePnlSnapshot> = {
  "qs-a": {
    scenarioId: "qs-a", revenue: 1200000, warehouseCost: 813600, transportCost: 0, laborCost: 147900, specialHandlingCost: 22500, adminReportingCost: 66000, riskReserve: 48000, totalCost: 1098000, grossProfit: 102000, gpPercent: 8.5,
    pnlConfidence: "Needs Finance + Ops Input",
    missingInputs: ["Warehouse cost confirmation", "Handling labor rate validation", "Risk reserve methodology"],
    inputOwners: [
      { owner: "Finance", item: "Confirm cost allocation and risk reserve methodology" },
      { owner: "Operations", item: "Confirm capacity and handling labor assumptions" },
      { owner: "Warehouse", item: "Confirm special handling cost base" },
    ],
    assumptions: ["400 pallets constant occupancy for 12 months", "Handling volumes based on client forecast", "Risk reserve at 4% of revenue", "No transport add-on in this scenario"],
    notes: "P&L basis is credible but needs Finance and Ops sign-off before production use.",
    lastReviewed: "", reviewedBy: "",
  },
  "qs-b": {
    scenarioId: "qs-b", revenue: 1080000, warehouseCost: 768000, transportCost: 29820, laborCost: 137700, specialHandlingCost: 0, adminReportingCost: 50400, riskReserve: 33600, totalCost: 1019520, grossProfit: 60480, gpPercent: 5.6,
    pnlConfidence: "Needs Finance + Ops Input",
    missingInputs: ["Aggressive pricing justification", "Transport cost confirmation", "Admin subsidy approval"],
    inputOwners: [
      { owner: "Finance", item: "Justify admin-below-cost subsidy and validate GP tolerance" },
      { owner: "Operations", item: "Confirm handling rate is sustainable at reduced tariff" },
      { owner: "Transport", item: "Confirm ad hoc movement cost base" },
    ],
    assumptions: ["Entry pricing to secure footprint", "Admin subsidized to win deal", "Transport margin offsets other losses", "Risk reserve at 3.1% of revenue"],
    notes: "Aggressive scenario — multiple lines near or below cost. Would require CEO/CFO approval in production.",
    lastReviewed: "", reviewedBy: "",
  },
  "qs-c": {
    scenarioId: "qs-c", revenue: 1380000, warehouseCost: 792000, transportCost: 0, laborCost: 144600, specialHandlingCost: 43140, adminReportingCost: 0, riskReserve: 100800, totalCost: 1080540, grossProfit: 299460, gpPercent: 21.7,
    pnlConfidence: "Ready for Review Mock",
    missingInputs: ["Implementation scope finalization"],
    inputOwners: [
      { owner: "Operations", item: "Confirm dedicated manpower cost and VAS scope" },
      { owner: "Projects", item: "Finalize implementation scope and amortization" },
    ],
    assumptions: ["Premium rate justified by fast implementation", "2 dedicated FTEs for 12 months", "Implementation fee amortized over 12 months", "Risk reserve at 7.3% of revenue"],
    notes: "Near 22% threshold — future Commercial/Ops review would apply.",
    lastReviewed: "2026-02-10", reviewedBy: "Ra'ed Al-Harbi",
  },
};

// ─── MOCK CUSTOMER SCORE (CW-004) ──────────────────────────

export const MOCK_CUSTOMER_SCORE: CommercialCustomerScore = {
  customerName: "Al-Rajhi Steel", workspaceId: "w4",
  overallGrade: "C", overallScore: 62,
  financialStrength: { score: 55, grade: "C", reason: "DSO at 68 days, payment watchlisted, moderate credit exposure" },
  operationalBehavior: { score: 58, grade: "C", reason: "Emergency storage requests indicate reactive planning" },
  strategicFit: { score: 72, grade: "B", reason: "Industrial steel sector — strategic for Jubail corridor" },
  commercialFit: { score: 60, grade: "C", reason: "Low-margin scope, constrained capacity fit" },
  icpFit: "Moderate ICP Fit",
  paymentStatus: "Watchlist / Mixed",
  dsoDays: 68,
  discountSuitability: "Not Recommended",
  pursuitRecommendation: "Reprice",
  riskReasons: [
    "DSO above preferred range (68d vs 45d target)",
    "Margin already below threshold",
    "Emergency storage pressure — reactive demand pattern",
    "Capacity fit constrained at Jubail 1",
    "Discount request not recommended",
  ],
  positiveReasons: [
    "Known customer — existing relationship",
    "Strategic industrial sector (steel/metals)",
    "Potential relationship value if repriced",
    "Could support pipeline diversification in East region",
  ],
  overrideStatus: "Mock Review Only",
  overrideAllowedFutureRole: "Commercial Director",
  wouldEscalate: true,
  mockEscalationCreated: true,
  lastReviewed: "", reviewedBy: "",
  notes: "Grade C customer with Reprice posture. Discount not supported.",
};

// ─── MOCK CAPACITY FIT DATA (CW-005) ───────────────────────

export const WAREHOUSE_CONSTRAINTS_BASE: WarehouseConstraint[] = [
  { label: "Stackability", value: "Limited stackability", status: "warning" },
  { label: "Height Restriction", value: "Applies to selected SKUs", status: "warning" },
  { label: "Compatibility", value: "Keep away from incompatible products", status: "warning" },
  { label: "Special Handling", value: "Required", status: "risk" },
  { label: "IBC / Oversized", value: "Some items > 1 position", status: "warning" },
  { label: "Gate Throughput", value: "45-min target; special handling may exceed", status: "warning" },
  { label: "QC Staging", value: "Constrained during rush", status: "warning" },
  { label: "Put-away", value: "Requires LFS discipline", status: "warning" },
  { label: "Manpower", value: "Shift planning needed", status: "warning" },
  { label: "Shift Coverage", value: "QC risk on extended shifts", status: "risk" },
  { label: "LFS Discipline", value: "Watchlist / requires supervision", status: "risk" },
];

export const MOCK_CAPACITY_FIT: Record<string, CommercialCapacityFit> = {
  "qs-a": {
    scenarioId: "qs-a", workspaceId: "w4", customerName: "Al-Rajhi Steel",
    requiredPalletPositions: 400, availablePalletPositions: 520, effectiveRequiredPositions: 475,
    utilizationBefore: 82, utilizationAfter: 88, utilizationTarget: 85,
    capacityFitScore: 58, capacityFitStatus: "Constrained", riskLevel: "High",
    constraints: WAREHOUSE_CONSTRAINTS_BASE,
    riskReasons: [
      "Effective positions (475) exceed raw requirement (400) due to special handling",
      "Utilization after (88%) exceeds 85% target",
      "QC staging constrained during peak",
      "LFS discipline on watchlist",
    ],
    positiveReasons: [
      "Available positions (520) nominally cover raw demand",
      "Established warehouse layout supports standard pallets",
    ],
    promiseGaps: [
      "Raw pallet count says 400, effective required is 475 due to special handling",
      "Special handling may exceed standard 45-min inbound target",
      "QC coverage may not support rush periods without planning",
      "LFS discipline must be maintained to avoid manual put-away risk",
    ],
    opsOwner: "Ali Al-Fahad · Jubail 1",
    wouldEscalate: true, mockEscalationCreated: true, allowTestBypass: true,
    lastReviewed: "", reviewedBy: "",
    notes: "Constrained — special handling pressure drives effective capacity up.",
  },
  "qs-b": {
    scenarioId: "qs-b", workspaceId: "w4", customerName: "Al-Rajhi Steel",
    requiredPalletPositions: 400, availablePalletPositions: 520, effectiveRequiredPositions: 500,
    utilizationBefore: 82, utilizationAfter: 90, utilizationTarget: 85,
    capacityFitScore: 46, capacityFitStatus: "High Risk", riskLevel: "Critical",
    constraints: WAREHOUSE_CONSTRAINTS_BASE.map(c =>
      c.label === "QC Staging" ? { ...c, value: "Critical during rush windows", status: "risk" as const } :
      c.label === "Manpower" ? { ...c, value: "Insufficient for aggressive timeline", status: "risk" as const } : c
    ),
    riskReasons: [
      "Effective positions (500) near limit of available (520)",
      "Utilization after (90%) well above 85% target",
      "Discounted price does not compensate for handling complexity",
      "QC and manpower constraints critical at aggressive volumes",
      "LFS discipline and shift coverage at risk",
    ],
    positiveReasons: [
      "Raw pallet count (400) within nominal range",
    ],
    promiseGaps: [
      "Raw pallet count says 400, effective required is 500 — near capacity ceiling",
      "Special handling at discounted rate creates ops pressure",
      "QC coverage cannot support aggressive entry without overtime",
      "LFS discipline must be enforced to prevent warehouse disorder",
    ],
    opsOwner: "Ali Al-Fahad · Jubail 1",
    wouldEscalate: true, mockEscalationCreated: true, allowTestBypass: true,
    lastReviewed: "", reviewedBy: "",
    notes: "High risk — aggressive pricing with constrained capacity is commercially dangerous.",
  },
  "qs-c": {
    scenarioId: "qs-c", workspaceId: "w4", customerName: "Al-Rajhi Steel",
    requiredPalletPositions: 400, availablePalletPositions: 650, effectiveRequiredPositions: 430,
    utilizationBefore: 78, utilizationAfter: 84, utilizationTarget: 85,
    capacityFitScore: 72, capacityFitStatus: "Acceptable Fit", riskLevel: "Medium",
    constraints: WAREHOUSE_CONSTRAINTS_BASE.map(c =>
      c.label === "QC Staging" ? { ...c, value: "Manageable with planning", status: "ok" as const } :
      c.label === "Manpower" ? { ...c, value: "Covered with shift planning", status: "ok" as const } :
      c.label === "Put-away" ? { ...c, value: "Planned LFS compliance", status: "ok" as const } : c
    ),
    riskReasons: [
      "Special handling still applies to some SKUs",
      "LFS watchlist status requires ongoing supervision",
    ],
    positiveReasons: [
      "Premium implementation allows proper planning",
      "Available positions (650) comfortably cover effective need (430)",
      "Utilization after (84%) within target range",
      "QC and manpower covered with shift planning",
    ],
    promiseGaps: [
      "QC coverage must be confirmed for fast implementation timeline",
    ],
    opsOwner: "Ali Al-Fahad · Jubail 1",
    wouldEscalate: false, mockEscalationCreated: false, allowTestBypass: true,
    lastReviewed: "", reviewedBy: "",
    notes: "Acceptable — premium rate and planning improve capacity outlook.",
  },
};

export const MOCK_MARGIN_SIGNALS: Record<string, MarginAuthoritySignal> = {
  "qs-a": {
    scenarioId: "qs-a", gpPercent: 8.5, thresholdBand: "GP < 10%", authorityLevel: "CEO / CFO Escalation",
    requiredRolesFuture: ["CEO", "CFO", "Commercial Director"],
    severity: "critical", reason: "GP at 8.5% is below 10% threshold — would require CEO/CFO approval in production.",
    wouldRequireApproval: true, wouldEscalate: true, mockEscalationCreated: true, allowTestBypass: true,
    runtimeMode: "Development Marker", notes: "Red signal — mock escalation only.",
  },
  "qs-b": {
    scenarioId: "qs-b", gpPercent: 5.6, thresholdBand: "GP < 10%", authorityLevel: "CEO / CFO Escalation",
    requiredRolesFuture: ["CEO", "CFO", "Commercial Director"],
    severity: "critical", reason: "GP at 5.6% is critically below 10% threshold — aggressive discounting and weak GP would require CEO/CFO approval.",
    wouldRequireApproval: true, wouldEscalate: true, mockEscalationCreated: true, allowTestBypass: true,
    runtimeMode: "Development Marker", notes: "Critical red signal — multiple lines at or below cost.",
  },
  "qs-c": {
    scenarioId: "qs-c", gpPercent: 21.7, thresholdBand: "GP < 22%", authorityLevel: "Commercial / Ops Review",
    requiredRolesFuture: ["Commercial Director", "Ops Manager"],
    severity: "amber", reason: "GP at 21.7% is near 22% threshold — future Commercial/Ops review would be required.",
    wouldRequireApproval: true, wouldEscalate: false, mockEscalationCreated: false, allowTestBypass: true,
    runtimeMode: "Development Marker", notes: "Near threshold — mock warning only.",
  },
};

// ─── MOCK PRICING POSTURE (CW-006) ─────────────────────────

export const MOCK_PRICING_POSTURE: Record<string, CommercialPricingPosture> = {
  "qs-a": {
    scenarioId: "qs-a", posture: "Reprice", recommendation: "Reprice before proposal",
    decisionOwner: "Commercial Director", severity: "High",
    rationale: "GP 8.5%, customer on payment watchlist, capacity constrained — standard tariff does not produce safe margin.",
    pressureSignals: ["Low GP", "Payment Watchlist", "Capacity Constrained"],
    supportingSignals: ["Known customer", "Urgent need"],
    riskSignals: ["Margin below threshold", "DSO above target"],
    recommendedActions: ["Reprice storage line", "Confirm Ops cost base", "Avoid additional discount", "Review with Commercial Director mock"],
    wouldEscalate: true, mockEscalationCreated: true, allowTestBypass: true,
    runtimeMode: "Development Marker", lastReviewed: "", reviewedBy: "",
    notes: "High risk — reprice before issuing proposal.",
  },
  "qs-b": {
    scenarioId: "qs-b", posture: "Walk Away", recommendation: "Walk away or reprice significantly",
    decisionOwner: "Commercial Director / CEO-CFO Future Review", severity: "Critical",
    rationale: "GP 5.6%, critical low margin, weak customer score, constrained capacity — aggressive pricing is commercially dangerous.",
    pressureSignals: ["Critical Low GP", "Payment Watchlist", "Capacity High Risk", "Revenue Delayed"],
    supportingSignals: [],
    riskSignals: ["Margin critically below threshold", "Admin line below cost", "DSO above target", "Capacity near ceiling"],
    recommendedActions: ["Do not offer further discount", "Reprice before proposal", "Escalate mock review", "Consider walk-away position"],
    wouldEscalate: true, mockEscalationCreated: true, allowTestBypass: true,
    runtimeMode: "Development Marker", lastReviewed: "", reviewedBy: "",
    notes: "Critical — walk away or reprice significantly.",
  },
  "qs-c": {
    scenarioId: "qs-c", posture: "Balanced", recommendation: "Protect price and confirm Ops capacity",
    decisionOwner: "Commercial / Ops", severity: "Medium",
    rationale: "GP 21.7% near 22% threshold, better capacity fit, faster realization possible — balanced posture with amber review.",
    pressureSignals: ["Near Threshold", "Ops Review Needed"],
    supportingSignals: ["Premium implementation", "Acceptable capacity", "This-quarter impact"],
    riskSignals: ["Near authority threshold"],
    recommendedActions: ["Confirm Ops capacity", "Protect price", "Prepare client-facing quote preview mock"],
    wouldEscalate: false, mockEscalationCreated: false, allowTestBypass: true,
    runtimeMode: "Development Marker", lastReviewed: "", reviewedBy: "",
    notes: "Balanced — protect price, confirm capacity.",
  },
};

// ─── MOCK REVENUE REALIZATION (CW-006) ─────────────────────

const TL_A: TimelineStage[] = [
  { stage: "Quote Scenario", date: "Created", status: "done" },
  { stage: "Proposal Draft", date: "Pending", status: "current" },
  { stage: "Client Verbal Acceptance", date: "TBD", status: "upcoming" },
  { stage: "PO Issued", date: "TBD", status: "at_risk" },
  { stage: "Contract Signed", date: "TBD", status: "upcoming" },
  { stage: "Onboarding Started", date: "TBD", status: "upcoming" },
  { stage: "Stock Movement", date: "TBD", status: "upcoming" },
  { stage: "First Billing", date: "Est. Q3 2026", status: "upcoming" },
  { stage: "Revenue Recognized", date: "Est. Q3 2026", status: "upcoming" },
];

const TL_B: TimelineStage[] = [
  { stage: "Quote Scenario", date: "Created", status: "done" },
  { stage: "Proposal Draft", date: "Blocked — reprice", status: "at_risk" },
  { stage: "Client Verbal Acceptance", date: "TBD", status: "upcoming" },
  { stage: "PO Issued", date: "TBD", status: "at_risk" },
  { stage: "Contract Signed", date: "TBD", status: "upcoming" },
  { stage: "Onboarding Started", date: "TBD", status: "upcoming" },
  { stage: "Stock Movement", date: "TBD", status: "upcoming" },
  { stage: "First Billing", date: "Est. Q4 2026", status: "upcoming" },
  { stage: "Revenue Recognized", date: "Est. Q4 2026", status: "at_risk" },
];

const TL_C: TimelineStage[] = [
  { stage: "Quote Scenario", date: "Created", status: "done" },
  { stage: "Proposal Draft", date: "Ready", status: "done" },
  { stage: "Client Verbal Acceptance", date: "Expected soon", status: "current" },
  { stage: "PO Issued", date: "Est. 2 weeks", status: "upcoming" },
  { stage: "Contract Signed", date: "Est. 3 weeks", status: "upcoming" },
  { stage: "Onboarding Started", date: "Est. 4 weeks", status: "upcoming" },
  { stage: "Stock Movement", date: "Est. 5 weeks", status: "upcoming" },
  { stage: "First Billing", date: "Est. Q2 2026", status: "upcoming" },
  { stage: "Revenue Recognized", date: "Est. Q2 2026", status: "upcoming" },
];

export const MOCK_REVENUE_REALIZATION: Record<string, CommercialRevenueRealization> = {
  "qs-a": {
    scenarioId: "qs-a", budgetImpactTiming: "Next Quarter", realizationConfidence: "Medium",
    timeline: TL_A,
    delayRisks: ["PO timing uncertain", "Emergency storage start may be operationally constrained", "Billing depends on stock movement"],
    accelerationOpportunities: [],
    owner: "Sales Owner / Finance",
    wouldEscalate: false, mockEscalationCreated: false,
    notes: "Standard timeline — next quarter budget impact.",
  },
  "qs-b": {
    scenarioId: "qs-b", budgetImpactTiming: "Next Quarter", realizationConfidence: "Low",
    timeline: TL_B,
    delayRisks: ["Low margin may require executive review", "Customer payment risk", "Onboarding may not convert to billing quickly"],
    accelerationOpportunities: [],
    owner: "Commercial Director / Finance",
    wouldEscalate: false, mockEscalationCreated: false,
    notes: "Delayed realization — low confidence due to margin and payment risk.",
  },
  "qs-c": {
    scenarioId: "qs-c", budgetImpactTiming: "This Quarter", realizationConfidence: "High",
    timeline: TL_C,
    delayRisks: ["Contract timing", "Onboarding dependency"],
    accelerationOpportunities: ["Fast implementation premium", "Capacity acceptable with planning", "Customer urgent need"],
    owner: "Sales Owner / Ops",
    wouldEscalate: false, mockEscalationCreated: false,
    notes: "This-quarter impact — high confidence with fast implementation.",
  },
};

// ─── MOCK ESCALATION ENGINE (CW-007) ───────────────────────

export type EscalationSeverity = "Low" | "Medium" | "High" | "Critical";
export type EscalationStatus = "Open Mock" | "Amber Review" | "Reviewed Mock" | "Testing Bypass Used" | "No Escalation" | "Future Approval Required";
export type SignalSource = "Margin Authority" | "Customer Score" | "Capacity Fit" | "Pricing Posture" | "Revenue Realization" | "P&L Confidence";

export interface CommercialMockEscalation {
  id: string;
  workspaceId: string;
  scenarioId: string;
  escalationCode: string;
  signalSource: SignalSource;
  signalName: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  owner: string;
  futureRequiredRoles: string[];
  triggerReason: string;
  commercialImpact: string;
  recommendedAction: string;
  linkedControls: string[];
  wouldEscalate: boolean;
  wouldRequireApproval: boolean;
  mockEscalationCreated: boolean;
  allowTestBypass: boolean;
  runtimeMode: string;
  createdAt: string;
  lastReviewed: string;
  reviewedBy: string;
  notes: string;
}

export const MOCK_ESCALATIONS: Record<string, CommercialMockEscalation[]> = {
  "qs-a": [
    {
      id: "esc-a1", workspaceId: "w4", scenarioId: "qs-a", escalationCode: "ESC-MARGIN-001",
      signalSource: "Margin Authority", signalName: "Margin Authority Escalation",
      severity: "Critical", status: "Open Mock",
      owner: "Commercial Director", futureRequiredRoles: ["CEO", "CFO", "Commercial Director"],
      triggerReason: "GP 8.5% below 10% future CEO/CFO threshold",
      commercialImpact: "Quote cannot progress to client-facing in production without executive sign-off",
      recommendedAction: "Reprice storage line to improve GP above 10% threshold",
      linkedControls: ["P&L", "Margin"], wouldEscalate: true, wouldRequireApproval: true,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "Red signal — GP below CEO/CFO threshold.",
    },
    {
      id: "esc-a2", workspaceId: "w4", scenarioId: "qs-a", escalationCode: "ESC-CUST-001",
      signalSource: "Customer Score", signalName: "Customer + Discount Warning",
      severity: "High", status: "Open Mock",
      owner: "Commercial Director", futureRequiredRoles: ["Commercial Director"],
      triggerReason: "Customer grade C, DSO 68 days, discount not recommended",
      commercialImpact: "Customer payment risk may erode already thin margin",
      recommendedAction: "Do not apply additional discount; monitor payment behavior",
      linkedControls: ["ECR"], wouldEscalate: true, wouldRequireApproval: false,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "High — customer watchlist + no discount.",
    },
    {
      id: "esc-a3", workspaceId: "w4", scenarioId: "qs-a", escalationCode: "ESC-CAP-001",
      signalSource: "Capacity Fit", signalName: "Capacity Constraint Escalation",
      severity: "High", status: "Open Mock",
      owner: "Operations / Commercial Director", futureRequiredRoles: ["Operations Manager", "Commercial Director"],
      triggerReason: "Effective required positions exceed raw demand; utilization after exceeds 85% target",
      commercialImpact: "Quoted volumes may not be operationally deliverable without planning",
      recommendedAction: "Confirm Ops capacity and shift coverage before proposal",
      linkedControls: ["Capacity"], wouldEscalate: true, wouldRequireApproval: false,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "High — capacity constrained at Jubail 1.",
    },
  ],
  "qs-b": [
    {
      id: "esc-b1", workspaceId: "w4", scenarioId: "qs-b", escalationCode: "ESC-MARGIN-002",
      signalSource: "Margin Authority", signalName: "Critical Low Margin Escalation",
      severity: "Critical", status: "Open Mock",
      owner: "Commercial Director", futureRequiredRoles: ["CEO", "CFO"],
      triggerReason: "GP 5.6% with aggressive discounting — admin line below cost",
      commercialImpact: "Deal is commercially unviable without repricing; executive block in production",
      recommendedAction: "Reprice or walk away — do not offer further discount",
      linkedControls: ["P&L", "Margin"], wouldEscalate: true, wouldRequireApproval: true,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "Critical — GP dangerously low.",
    },
    {
      id: "esc-b2", workspaceId: "w4", scenarioId: "qs-b", escalationCode: "ESC-POSTURE-001",
      signalSource: "Pricing Posture", signalName: "Walk Away / Reprice Escalation",
      severity: "Critical", status: "Open Mock",
      owner: "Commercial Director", futureRequiredRoles: ["CEO", "CFO", "Commercial Director"],
      triggerReason: "Walk Away posture: low GP, weak customer score, capacity high risk",
      commercialImpact: "Pursuing this deal at current terms destroys commercial value",
      recommendedAction: "Consider walk-away position or significant reprice",
      linkedControls: ["Pricing Posture", "Margin", "ECR"], wouldEscalate: true, wouldRequireApproval: true,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "Critical — walk away or reprice.",
    },
    {
      id: "esc-b3", workspaceId: "w4", scenarioId: "qs-b", escalationCode: "ESC-CAP-002",
      signalSource: "Capacity Fit", signalName: "Capacity High Risk Escalation",
      severity: "Critical", status: "Open Mock",
      owner: "Operations / Commercial Director", futureRequiredRoles: ["Operations Manager", "Commercial Director"],
      triggerReason: "Discounted price does not compensate for constrained capacity and handling complexity",
      commercialImpact: "Operational delivery risk at aggressive pricing; potential SLA failures",
      recommendedAction: "Do not proceed without Ops capacity confirmation and repricing",
      linkedControls: ["Capacity", "Pricing Posture"], wouldEscalate: true, wouldRequireApproval: false,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "Critical — capacity near ceiling at discounted rate.",
    },
    {
      id: "esc-b4", workspaceId: "w4", scenarioId: "qs-b", escalationCode: "ESC-REV-001",
      signalSource: "Revenue Realization", signalName: "Revenue Timing Warning",
      severity: "High", status: "Open Mock",
      owner: "Commercial Director / Finance", futureRequiredRoles: ["Commercial Director", "Finance"],
      triggerReason: "Executive review and onboarding risk may delay revenue realization",
      commercialImpact: "Budget impact delayed; low confidence in realization timeline",
      recommendedAction: "Factor delayed revenue into commercial decision",
      linkedControls: ["Revenue Timing"], wouldEscalate: true, wouldRequireApproval: false,
      mockEscalationCreated: true, allowTestBypass: true, runtimeMode: "Development Marker",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "High — revenue timing at risk.",
    },
  ],
  "qs-c": [
    {
      id: "esc-c1", workspaceId: "w4", scenarioId: "qs-c", escalationCode: "ESC-MARGIN-003",
      signalSource: "Margin Authority", signalName: "Near Threshold Review",
      severity: "Medium", status: "Amber Review",
      owner: "Commercial / Ops", futureRequiredRoles: ["Commercial Director", "Ops Manager"],
      triggerReason: "GP 21.7% near 22% threshold",
      commercialImpact: "Future Commercial/Ops review would be required before approval",
      recommendedAction: "Protect price; do not reduce further",
      linkedControls: ["Margin"], wouldEscalate: false, wouldRequireApproval: true,
      mockEscalationCreated: false, allowTestBypass: true, runtimeMode: "Warning Only",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "Amber — near threshold, not critical.",
    },
    {
      id: "esc-c2", workspaceId: "w4", scenarioId: "qs-c", escalationCode: "ESC-CAP-003",
      signalSource: "Capacity Fit", signalName: "Capacity Planning Review",
      severity: "Medium", status: "Amber Review",
      owner: "Operations", futureRequiredRoles: ["Operations Manager"],
      triggerReason: "Acceptable capacity with planning confirmation needed",
      commercialImpact: "Ops confirmation required to validate delivery commitment",
      recommendedAction: "Confirm Ops capacity and shift planning",
      linkedControls: ["Capacity"], wouldEscalate: false, wouldRequireApproval: false,
      mockEscalationCreated: false, allowTestBypass: true, runtimeMode: "Warning Only",
      createdAt: "2026-05-02", lastReviewed: "", reviewedBy: "",
      notes: "Amber — acceptable with planning.",
    },
  ],
};

export function getEscalationsForScenario(scenarioId: string): CommercialMockEscalation[] {
  return MOCK_ESCALATIONS[scenarioId] || [];
}

export function getEscalationSummary(scenarioId: string) {
  const escs = getEscalationsForScenario(scenarioId);
  return {
    total: escs.length,
    critical: escs.filter(e => e.severity === "Critical").length,
    high: escs.filter(e => e.severity === "High").length,
    medium: escs.filter(e => e.severity === "Medium").length,
    mockCreated: escs.filter(e => e.mockEscalationCreated).length,
    bypassAvailable: escs.filter(e => e.allowTestBypass).length,
    hasRed: escs.some(e => e.severity === "Critical" || e.severity === "High"),
  };
}

// ─── PROPOSAL CONTROL (CW-008) ─────────────────────────────

export type ProposalStatus = "Not Started" | "Drafting" | "Linked to Quote Scenario" | "Client-Facing Draft Mock" | "Negotiation Round Active" | "Revised Mock" | "Mock Reviewed" | "Superseded Mock";
export type ProposalType = "Standard Proposal" | "Revised Proposal" | "Negotiation Response" | "Internal Draft" | "Client-Facing Mock";
export type ProposalReviewStatus = "Not Reviewed" | "Needs Commercial Review" | "Needs Finance Review" | "Needs Ops Review" | "Mock Reviewed" | "Future Approval Required";
export type ProposalGateStatus = "No Gate" | "Future Gate Warning" | "Would Require Review in Production" | "Mock Bypass Available";
export type NegotiationStatus = "Open" | "Responded Mock" | "Awaiting Client" | "Revised Proposal Needed" | "Closed Mock";

export interface CommercialProposalVersion {
  id: string;
  workspaceId: string;
  proposalName: string;
  version: string;
  linkedQuoteScenarioId: string;
  linkedQuoteScenarioName: string;
  status: ProposalStatus;
  proposalType: ProposalType;
  clientFacingMock: boolean;
  revenue: number;
  gpPercent: number;
  marginDeltaFromQuote: number;
  owner: string;
  reviewStatus: ProposalReviewStatus;
  futureGateStatus: ProposalGateStatus;
  mockEscalationStatus: string;
  issuedAtMock: string;
  lastUpdated: string;
  notes: string;
}

export interface CommercialNegotiationRound {
  id: string;
  workspaceId: string;
  proposalVersionId: string;
  roundNumber: number;
  clientAsk: string;
  halaResponse: string;
  pricingChange: string;
  marginChange: string;
  concessionReason: string;
  approvalImpact: string;
  status: NegotiationStatus;
  owner: string;
  lastUpdated: string;
  notes: string;
}

export const MOCK_PROPOSALS: CommercialProposalVersion[] = [
  {
    id: "prop-v01", workspaceId: "w4", proposalName: "Al-Rajhi Emergency Storage Proposal", version: "v0.1",
    linkedQuoteScenarioId: "qs-a", linkedQuoteScenarioName: "Option A — Standard Tariff",
    status: "Drafting", proposalType: "Internal Draft", clientFacingMock: false,
    revenue: 1200000, gpPercent: 8.5, marginDeltaFromQuote: 0,
    owner: "Amin Al-Rashid", reviewStatus: "Needs Commercial Review",
    futureGateStatus: "Would Require Review in Production",
    mockEscalationStatus: "Red — Margin below threshold",
    issuedAtMock: "", lastUpdated: "2026-05-02",
    notes: "Low GP and customer score require review before client-facing proposal in production.",
  },
  {
    id: "prop-v02", workspaceId: "w4", proposalName: "Al-Rajhi Emergency Storage Proposal", version: "v0.2",
    linkedQuoteScenarioId: "qs-c", linkedQuoteScenarioName: "Option C — Premium Fast Implementation",
    status: "Client-Facing Draft Mock", proposalType: "Client-Facing Mock", clientFacingMock: true,
    revenue: 1380000, gpPercent: 21.7, marginDeltaFromQuote: 0,
    owner: "Amin Al-Rashid", reviewStatus: "Needs Ops Review",
    futureGateStatus: "Future Gate Warning",
    mockEscalationStatus: "Amber — Near threshold",
    issuedAtMock: "2026-05-02", lastUpdated: "2026-05-02",
    notes: "Better option but near margin threshold. Ops capacity confirmation needed.",
  },
  {
    id: "prop-v03", workspaceId: "w4", proposalName: "Al-Rajhi Emergency Storage Proposal", version: "v0.3",
    linkedQuoteScenarioId: "qs-b", linkedQuoteScenarioName: "Option B — Aggressive Entry Price",
    status: "Negotiation Round Active", proposalType: "Negotiation Response", clientFacingMock: true,
    revenue: 1080000, gpPercent: 5.6, marginDeltaFromQuote: -2.9,
    owner: "Amin Al-Rashid", reviewStatus: "Future Approval Required",
    futureGateStatus: "Would Require Review in Production",
    mockEscalationStatus: "Critical — Executive review required",
    issuedAtMock: "2026-05-02", lastUpdated: "2026-05-02",
    notes: "Client requested lower price; production would require executive review.",
  },
];

export const MOCK_NEGOTIATIONS: CommercialNegotiationRound[] = [
  {
    id: "neg-r1", workspaceId: "w4", proposalVersionId: "prop-v01", roundNumber: 1,
    clientAsk: "Emergency storage availability and fast start for 4,800 pallets",
    halaResponse: "Standard tariff with emergency surcharge; 4-6 week onboarding",
    pricingChange: "None", marginChange: "0%",
    concessionReason: "N/A — initial request",
    approvalImpact: "None — standard terms",
    status: "Responded Mock", owner: "Amin Al-Rashid",
    lastUpdated: "2026-05-01",
    notes: "Client accepted scope but requested pricing review.",
  },
  {
    id: "neg-r2", workspaceId: "w4", proposalVersionId: "prop-v03", roundNumber: 2,
    clientAsk: "Discount on storage rate — SAR 169.50 too high for emergency allocation",
    halaResponse: "Revised to aggressive entry pricing with reduced storage rate; GP drops to 5.6%",
    pricingChange: "Storage rate reduced from SAR 180 to SAR 155/plt/mo",
    marginChange: "-2.9% GP (8.5% → 5.6%)",
    concessionReason: "Client price sensitivity; competitor pressure on storage rates",
    approvalImpact: "Red: future production would require CEO/CFO sign-off",
    status: "Revised Proposal Needed", owner: "Amin Al-Rashid",
    lastUpdated: "2026-05-02",
    notes: "GP critically low. Reprice or walk away recommended.",
  },
  {
    id: "neg-r3", workspaceId: "w4", proposalVersionId: "prop-v02", roundNumber: 3,
    clientAsk: "Fast implementation with premium service; accept higher rate if onboarding < 3 weeks",
    halaResponse: "Premium fast implementation proposal at SAR 210/plt/mo; GP 21.7% — near threshold but commercially viable",
    pricingChange: "Premium rate applied (SAR 210 vs SAR 180 standard)",
    marginChange: "+13.2% GP (8.5% → 21.7%)",
    concessionReason: "N/A — client accepts premium for speed",
    approvalImpact: "Amber: Commercial/Ops review recommended",
    status: "Awaiting Client", owner: "Amin Al-Rashid",
    lastUpdated: "2026-05-02",
    notes: "Best commercial outcome. Client reviewing internally.",
  },
];

export function getProposalsForWorkspace(workspaceId: string): CommercialProposalVersion[] {
  return MOCK_PROPOSALS.filter(p => p.workspaceId === workspaceId);
}

export function getNegotiationsForProposal(proposalId: string): CommercialNegotiationRound[] {
  return MOCK_NEGOTIATIONS.filter(n => n.proposalVersionId === proposalId);
}

export function getLinkedQuoteForProposal(proposal: CommercialProposalVersion) {
  const scenario = MOCK_SCENARIOS.find(s => s.id === proposal.linkedQuoteScenarioId);
  if (!scenario) return null;
  return {
    name: scenario.name,
    gpPercent: scenario.gpPercent,
    pricingPosture: scenario.pricingPosture,
    capacityFit: scenario.capacityFit,
    customerScore: scenario.customerScore,
    revenueTiming: scenario.revenueTiming,
    mockEscalation: scenario.mockEscalation,
  };
}

// ─── SLA CONTROL (CW-009) ──────────────────────────────────

export type SlaStatus = "Not Started" | "Draft Mock" | "Linked to Commercial Terms Mock" | "Pricing Lock Warning" | "Ops Review Needed" | "Legal Review Needed" | "Mock Reviewed" | "Ready for Future Contracting";
export type SlaType = "Warehousing SLA" | "Emergency Storage SLA" | "Transport Add-On SLA" | "Master Service SLA" | "Client-Facing Mock" | "Internal Draft";
export type PricingLockStatus = "Not Locked" | "Mock Linked" | "Pricing Lock Warning" | "Future Lock Required" | "Mock Reviewed";
export type CommercialTermsStatus = "Missing" | "Draft Mock" | "Linked to Proposal Mock" | "Future Approval Required" | "Mock Reviewed";
export type SlaReviewStatus = "Not Reviewed" | "Needs Ops Review" | "Needs Legal Review" | "Needs Commercial Review" | "Mock Reviewed" | "Future Approval Required";
export type SlaGateStatus = "No Gate" | "Future Gate Warning" | "Would Require Review in Production" | "Mock Bypass Available";
export type SectionCategory = "Service Scope" | "Operating Hours" | "KPIs" | "Reporting" | "Escalation Matrix" | "Responsibilities" | "Commercial Terms" | "Legal Terms" | "Handover" | "Exclusions";

export interface CommercialSlaDraft {
  id: string;
  workspaceId: string;
  slaName: string;
  version: string;
  linkedProposalId: string;
  linkedProposalName: string;
  linkedQuoteScenarioId: string;
  linkedQuoteScenarioName: string;
  status: SlaStatus;
  slaType: SlaType;
  clientFacingMock: boolean;
  pricingLockStatus: PricingLockStatus;
  commercialTermsStatus: CommercialTermsStatus;
  opsReviewStatus: SlaReviewStatus;
  legalReviewStatus: SlaReviewStatus;
  kpiReadiness: number;
  responsibilityReadiness: number;
  escalationMatrixStatus: string;
  promiseGapCount: number;
  riskLevel: string;
  futureGateStatus: SlaGateStatus;
  mockEscalationStatus: string;
  owner: string;
  lastUpdated: string;
  notes: string;
}

export interface CommercialSlaSection {
  id: string;
  slaId: string;
  sectionName: string;
  category: SectionCategory;
  status: string;
  owner: string;
  readiness: number;
  riskLevel: string;
  notes: string;
}

export interface CommercialSlaKpi {
  id: string;
  slaId: string;
  kpiName: string;
  target: string;
  measurementMethod: string;
  owner: string;
  readiness: number;
  riskLevel: string;
  notes: string;
}

export interface CommercialSlaPromiseGap {
  id: string;
  slaId: string;
  promise: string;
  operationalReality: string;
  impact: string;
  owner: string;
  severity: string;
  recommendedAction: string;
  wouldEscalateInProduction: boolean;
  mockEscalationCreated: boolean;
  notes: string;
}

export const MOCK_SLA_DRAFTS: CommercialSlaDraft[] = [
  {
    id: "sla-v01", workspaceId: "w4", slaName: "Al-Rajhi Emergency Storage SLA", version: "v0.1",
    linkedProposalId: "prop-v01", linkedProposalName: "Proposal v0.1 — Internal Draft",
    linkedQuoteScenarioId: "qs-a", linkedQuoteScenarioName: "Option A — Standard Tariff",
    status: "Pricing Lock Warning", slaType: "Emergency Storage SLA", clientFacingMock: false,
    pricingLockStatus: "Not Locked", commercialTermsStatus: "Linked to Proposal Mock",
    opsReviewStatus: "Needs Ops Review", legalReviewStatus: "Not Reviewed",
    kpiReadiness: 45, responsibilityReadiness: 55, escalationMatrixStatus: "Draft Mock",
    promiseGapCount: 3, riskLevel: "High", futureGateStatus: "Would Require Review in Production",
    mockEscalationStatus: "Red — Pricing not locked",
    owner: "Amin Al-Rashid", lastUpdated: "2026-05-02",
    notes: "SLA should not be client-facing until pricing and ops assumptions are reviewed.",
  },
  {
    id: "sla-v02", workspaceId: "w4", slaName: "Al-Rajhi Emergency Storage SLA", version: "v0.2",
    linkedProposalId: "prop-v02", linkedProposalName: "Proposal v0.2 — Client-Facing Draft Mock",
    linkedQuoteScenarioId: "qs-c", linkedQuoteScenarioName: "Option C — Premium Fast Implementation",
    status: "Linked to Commercial Terms Mock", slaType: "Emergency Storage SLA", clientFacingMock: true,
    pricingLockStatus: "Mock Linked", commercialTermsStatus: "Linked to Proposal Mock",
    opsReviewStatus: "Needs Ops Review", legalReviewStatus: "Needs Legal Review",
    kpiReadiness: 72, responsibilityReadiness: 70, escalationMatrixStatus: "Draft Mock",
    promiseGapCount: 1, riskLevel: "Medium", futureGateStatus: "Future Gate Warning",
    mockEscalationStatus: "Amber — Ops/Legal review pending",
    owner: "Amin Al-Rashid", lastUpdated: "2026-05-02",
    notes: "Better SLA basis but still needs Ops/Legal review.",
  },
  {
    id: "sla-v03", workspaceId: "w4", slaName: "Al-Rajhi Emergency Storage SLA", version: "v0.3",
    linkedProposalId: "prop-v03", linkedProposalName: "Proposal v0.3 — Negotiation Response Mock",
    linkedQuoteScenarioId: "qs-b", linkedQuoteScenarioName: "Option B — Aggressive Entry Price",
    status: "Ops Review Needed", slaType: "Emergency Storage SLA", clientFacingMock: true,
    pricingLockStatus: "Future Lock Required", commercialTermsStatus: "Future Approval Required",
    opsReviewStatus: "Needs Ops Review", legalReviewStatus: "Needs Legal Review",
    kpiReadiness: 35, responsibilityReadiness: 40, escalationMatrixStatus: "Not Reviewed",
    promiseGapCount: 4, riskLevel: "Critical", futureGateStatus: "Would Require Review in Production",
    mockEscalationStatus: "Critical — Executive review required",
    owner: "Amin Al-Rashid", lastUpdated: "2026-05-02",
    notes: "Production would require executive/commercial/legal review before SLA finalization.",
  },
];

export const MOCK_SLA_SECTIONS: CommercialSlaSection[] = [
  { id: "sec-1", slaId: "sla-v01", sectionName: "Service Scope", category: "Service Scope", status: "Draft Mock", owner: "Commercial", readiness: 60, riskLevel: "Medium", notes: "Emergency storage scope defined but not finalized." },
  { id: "sec-2", slaId: "sla-v01", sectionName: "Operating Hours", category: "Operating Hours", status: "Draft Mock", owner: "Operations", readiness: 50, riskLevel: "Medium", notes: "24/7 assumed but shift coverage not confirmed." },
  { id: "sec-3", slaId: "sla-v01", sectionName: "KPI Framework", category: "KPIs", status: "Draft Mock", owner: "Commercial / Ops", readiness: 45, riskLevel: "High", notes: "KPIs drafted but targets need Ops validation." },
  { id: "sec-4", slaId: "sla-v01", sectionName: "Reporting Cadence", category: "Reporting", status: "Draft Mock", owner: "Commercial", readiness: 55, riskLevel: "Low", notes: "Monthly reporting with weekly flash updates." },
  { id: "sec-5", slaId: "sla-v01", sectionName: "Escalation Matrix", category: "Escalation Matrix", status: "Draft Mock", owner: "Commercial / Ops", readiness: 40, riskLevel: "High", notes: "Internal escalation paths drafted; client-facing matrix not started." },
  { id: "sec-6", slaId: "sla-v01", sectionName: "Responsibilities", category: "Responsibilities", status: "Draft Mock", owner: "Commercial", readiness: 55, riskLevel: "Medium", notes: "Hala vs client responsibility split defined in outline." },
  { id: "sec-7", slaId: "sla-v01", sectionName: "Commercial Terms", category: "Commercial Terms", status: "Pricing Lock Warning", owner: "Commercial / Finance", readiness: 30, riskLevel: "Critical", notes: "Pricing not locked; SLA cannot reference fixed service commitment." },
  { id: "sec-8", slaId: "sla-v01", sectionName: "Legal Terms", category: "Legal Terms", status: "Not Started", owner: "Legal", readiness: 10, riskLevel: "High", notes: "No legal review yet." },
  { id: "sec-9", slaId: "sla-v01", sectionName: "Handover / Onboarding", category: "Handover", status: "Draft Mock", owner: "Operations", readiness: 45, riskLevel: "Medium", notes: "4-6 week onboarding timeline drafted." },
  { id: "sec-10", slaId: "sla-v01", sectionName: "Exclusions", category: "Exclusions", status: "Draft Mock", owner: "Commercial / Legal", readiness: 50, riskLevel: "Low", notes: "Standard exclusions drafted." },
];

export const MOCK_SLA_KPIS: CommercialSlaKpi[] = [
  { id: "kpi-1", slaId: "sla-v01", kpiName: "Inbound Receiving", target: "< 4 hours from truck arrival", measurementMethod: "WMS timestamp", owner: "Operations", readiness: 60, riskLevel: "Medium", notes: "Standard for ambient; special handling may extend." },
  { id: "kpi-2", slaId: "sla-v01", kpiName: "Put-Away Completion", target: "Same-day for standard SKUs", measurementMethod: "WMS put-away event", owner: "Operations", readiness: 50, riskLevel: "High", notes: "LFS discipline required to avoid manual put-away risk." },
  { id: "kpi-3", slaId: "sla-v01", kpiName: "Inventory Accuracy", target: "> 99.5%", measurementMethod: "Cycle count reconciliation", owner: "Operations", readiness: 70, riskLevel: "Low", notes: "Standard Hala target." },
  { id: "kpi-4", slaId: "sla-v01", kpiName: "Order Dispatch Readiness", target: "< 24 hours from order release", measurementMethod: "WMS dispatch event", owner: "Operations", readiness: 45, riskLevel: "Medium", notes: "Emergency surcharge may apply for expedited." },
  { id: "kpi-5", slaId: "sla-v01", kpiName: "Reporting Cadence", target: "Monthly report + weekly flash", measurementMethod: "Report delivery confirmation", owner: "Commercial", readiness: 65, riskLevel: "Low", notes: "Template exists." },
  { id: "kpi-6", slaId: "sla-v01", kpiName: "Customer Escalation Response", target: "< 2 hours for critical", measurementMethod: "Ticket timestamp", owner: "Operations / Commercial", readiness: 40, riskLevel: "High", notes: "Shift coverage must be confirmed before committing." },
  { id: "kpi-7", slaId: "sla-v01", kpiName: "First Billing Readiness", target: "Within 30 days of go-live", measurementMethod: "Finance billing trigger", owner: "Finance / Commercial", readiness: 30, riskLevel: "High", notes: "Pricing lock required before billing setup." },
];

export const MOCK_SLA_PROMISE_GAPS: CommercialSlaPromiseGap[] = [
  {
    id: "gap-1", slaId: "sla-v01",
    promise: "Standard inbound receiving < 4 hours",
    operationalReality: "Special handling and QC for emergency steel may take 6-8 hours",
    impact: "KPI breach risk on day 1 if SLA commits to standard timeline",
    owner: "Operations", severity: "High",
    recommendedAction: "Add special handling exception to SLA or revise KPI target",
    wouldEscalateInProduction: true, mockEscalationCreated: true,
    notes: "Confirm actual handling time before client-facing SLA.",
  },
  {
    id: "gap-2", slaId: "sla-v01",
    promise: "400 pallet positions allocated",
    operationalReality: "Effective required positions with stacking/height constraints may be 450-480",
    impact: "Capacity shortfall could force overflow or external allocation",
    owner: "Operations / Commercial", severity: "High",
    recommendedAction: "Validate effective position requirement; adjust SLA scope or pricing",
    wouldEscalateInProduction: true, mockEscalationCreated: true,
    notes: "Capacity Fit panel flagged this gap.",
  },
  {
    id: "gap-3", slaId: "sla-v01",
    promise: "Pricing not locked but SLA terms imply fixed service commitment",
    operationalReality: "Pricing may change after negotiation round; SLA terms would need revision",
    impact: "Commercial risk — SLA may commit Hala to terms that erode margin",
    owner: "Commercial / Finance", severity: "Critical",
    recommendedAction: "Lock pricing before finalizing SLA service scope",
    wouldEscalateInProduction: true, mockEscalationCreated: true,
    notes: "Core doctrine: SLA must reflect locked pricing.",
  },
  {
    id: "gap-4", slaId: "sla-v03",
    promise: "Fast implementation with premium service — onboarding < 3 weeks",
    operationalReality: "QC/shift confirmation and warehouse setup typically require 4-6 weeks",
    impact: "Onboarding timeline breach; client expectations may not be met",
    owner: "Operations", severity: "High",
    recommendedAction: "Confirm Ops capacity for fast-track or revise SLA commitment",
    wouldEscalateInProduction: true, mockEscalationCreated: true,
    notes: "Premium fast implementation requires special Ops allocation.",
  },
  {
    id: "gap-5", slaId: "sla-v03",
    promise: "LFS system integration for automated put-away",
    operationalReality: "LFS discipline required; manual put-away risk if system is not configured",
    impact: "Put-away KPI breach; manual intervention increases cost",
    owner: "Operations / IT", severity: "Medium",
    recommendedAction: "Confirm LFS configuration before committing automated KPI targets",
    wouldEscalateInProduction: false, mockEscalationCreated: false,
    notes: "Standard risk but should be confirmed pre-SLA.",
  },
  {
    id: "gap-6", slaId: "sla-v02",
    promise: "Premium service with < 3 week onboarding",
    operationalReality: "Ops capacity for fast-track onboarding not confirmed; standard is 4-6 weeks",
    impact: "Client expectation mismatch if onboarding takes standard timeline",
    owner: "Operations", severity: "Medium",
    recommendedAction: "Confirm Ops allocation before SLA commitment",
    wouldEscalateInProduction: false, mockEscalationCreated: false,
    notes: "Premium fast implementation requires special allocation.",
  },
  {
    id: "gap-7", slaId: "sla-v03",
    promise: "Aggressive pricing implies standard service level",
    operationalReality: "Low GP (5.6%) limits operational investment; service quality may be at risk",
    impact: "SLA promises standard service but margin does not support premium delivery",
    owner: "Commercial / Finance", severity: "High",
    recommendedAction: "Revise SLA service scope to match pricing level or reprice",
    wouldEscalateInProduction: true, mockEscalationCreated: true,
    notes: "Core risk: SLA cannot promise premium at discount pricing.",
  },
  {
    id: "gap-8", slaId: "sla-v03",
    promise: "24/7 escalation support for critical issues",
    operationalReality: "Shift coverage at aggressive pricing may not include overnight support",
    impact: "Escalation response KPI breach outside business hours",
    owner: "Operations", severity: "High",
    recommendedAction: "Confirm shift coverage or add exclusion for after-hours escalation",
    wouldEscalateInProduction: true, mockEscalationCreated: true,
    notes: "Aggressive pricing does not fund 24/7 operations coverage.",
  },
];

export function getSlaDraftsForWorkspace(workspaceId: string): CommercialSlaDraft[] {
  return MOCK_SLA_DRAFTS.filter(s => s.workspaceId === workspaceId);
}

export function getSlaSections(slaId: string): CommercialSlaSection[] {
  return MOCK_SLA_SECTIONS.filter(s => s.slaId === slaId);
}

export function getSlaKpis(slaId: string): CommercialSlaKpi[] {
  return MOCK_SLA_KPIS.filter(k => k.slaId === slaId);
}

export function getSlaPromiseGaps(slaId: string): CommercialSlaPromiseGap[] {
  return MOCK_SLA_PROMISE_GAPS.filter(g => g.slaId === slaId);
}

export function getLinkedCommercialBasis(sla: CommercialSlaDraft) {
  const proposal = MOCK_PROPOSALS.find(p => p.id === sla.linkedProposalId);
  const scenario = MOCK_SCENARIOS.find(s => s.id === sla.linkedQuoteScenarioId);
  if (!proposal || !scenario) return null;
  return {
    proposalName: proposal.proposalName + " " + proposal.version,
    proposalStatus: proposal.status,
    quoteName: scenario.name,
    quoteGpPercent: scenario.gpPercent,
    pricingPosture: scenario.pricingPosture,
    capacityFit: scenario.capacityFit,
    customerScore: scenario.customerScore,
    marginAuthority: scenario.gpPercent < 10 ? "CEO/CFO Required" : scenario.gpPercent < 22 ? "Commercial Director" : "Standard",
    pnlConfidence: scenario.gpPercent < 10 ? "Low" : scenario.gpPercent < 22 ? "Medium" : "High",
  };
}

// ─── ACTIVITY + AUDIT (CW-010) ─────────────────────────────

export type ActivityCategory = "Workspace" | "Quote" | "Pricing" | "P&L" | "Margin" | "Customer Score" | "Capacity" | "Pricing Posture" | "Revenue Timing" | "Escalation" | "Proposal" | "Negotiation" | "SLA" | "Review" | "CRM Mock";
export type AuditCategory = "WORKSPACE" | "QUOTE" | "PRICING" | "PNL" | "MARGIN" | "CUSTOMER_SCORE" | "CAPACITY" | "PRICING_POSTURE" | "REVENUE_TIMING" | "ESCALATION" | "PROPOSAL" | "NEGOTIATION" | "SLA" | "CRM_SYNC" | "SYSTEM";
export type EventSeverity = "Info" | "Warning" | "High" | "Critical";

export interface CommercialActivityEvent {
  id: string; workspaceId: string; eventType: string; title: string; description: string;
  category: ActivityCategory; actor: string; role: string; timestamp: string;
  relatedArtifact: string; relatedModule: string; relatedScenarioId: string;
  severity: EventSeverity; mock: boolean; notes: string;
}

export interface CommercialAuditEvent {
  id: string; workspaceId: string; eventCode: string; eventName: string; description: string;
  category: AuditCategory; actor: string; role: string; timestamp: string;
  entityType: string; entityName: string; beforeState: string; afterState: string;
  mock: boolean; severity: EventSeverity; traceId: string; notes: string;
}

export const MOCK_ACTIVITY_EVENTS: CommercialActivityEvent[] = [
  { id:"act-01",workspaceId:"w4",eventType:"workspace_opened",title:"Commercial workspace opened",description:"Al-Rajhi Emergency Storage workspace opened for quoting.",category:"Workspace",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T08:30:00Z",relatedArtifact:"",relatedModule:"Workspace",relatedScenarioId:"",severity:"Info",mock:true,notes:"" },
  { id:"act-02",workspaceId:"w4",eventType:"quote_control_opened",title:"Quote Control opened",description:"Quote Control tab accessed. 3 scenarios available.",category:"Quote",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T08:35:00Z",relatedArtifact:"",relatedModule:"Quote Control",relatedScenarioId:"",severity:"Info",mock:true,notes:"" },
  { id:"act-03",workspaceId:"w4",eventType:"scenario_selected",title:"Option A — Standard Tariff selected",description:"Standard tariff scenario selected for review. GP 8.5%.",category:"Quote",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T08:40:00Z",relatedArtifact:"Option A",relatedModule:"Quote Control",relatedScenarioId:"qs-a",severity:"Info",mock:true,notes:"" },
  { id:"act-04",workspaceId:"w4",eventType:"pricing_lines_viewed",title:"Pricing lines reviewed",description:"7 pricing lines reviewed for Option A. Storage rate SAR 169.50/plt/mo.",category:"Pricing",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T09:00:00Z",relatedArtifact:"Option A",relatedModule:"Pricing Lines",relatedScenarioId:"qs-a",severity:"Info",mock:true,notes:"" },
  { id:"act-05",workspaceId:"w4",eventType:"low_margin_flagged",title:"Low-margin line flagged",description:"Storage line GP 5.2% — below 10% threshold. CEO/CFO review would be required.",category:"Margin",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T09:05:00Z",relatedArtifact:"Option A — Storage",relatedModule:"Pricing Lines",relatedScenarioId:"qs-a",severity:"High",mock:true,notes:"" },
  { id:"act-06",workspaceId:"w4",eventType:"pnl_reviewed",title:"P&L snapshot reviewed",description:"P&L snapshot for Option A reviewed. Revenue SAR 1.20M, GP 8.5%.",category:"P&L",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T09:15:00Z",relatedArtifact:"Option A",relatedModule:"P&L Snapshot",relatedScenarioId:"qs-a",severity:"Info",mock:true,notes:"" },
  { id:"act-07",workspaceId:"w4",eventType:"margin_authority_evaluated",title:"Margin authority evaluated",description:"GP 8.5% below 10% threshold. CEO/CFO approval authority required.",category:"Margin",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T09:20:00Z",relatedArtifact:"Option A",relatedModule:"Margin Authority",relatedScenarioId:"qs-a",severity:"High",mock:true,notes:"" },
  { id:"act-08",workspaceId:"w4",eventType:"customer_score_reviewed",title:"Customer score reviewed",description:"Al-Rajhi Steel ECR grade: C-. Financial strength 45, operational behavior 38.",category:"Customer Score",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T10:00:00Z",relatedArtifact:"Al-Rajhi Steel",relatedModule:"Customer Score",relatedScenarioId:"qs-a",severity:"Warning",mock:true,notes:"" },
  { id:"act-09",workspaceId:"w4",eventType:"discount_warning",title:"Customer discount warning",description:"Customer grade C- — discount suitability: Not Recommended.",category:"Customer Score",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T10:05:00Z",relatedArtifact:"Al-Rajhi Steel",relatedModule:"Customer Score",relatedScenarioId:"qs-a",severity:"Warning",mock:true,notes:"" },
  { id:"act-10",workspaceId:"w4",eventType:"capacity_reviewed",title:"Capacity fit reviewed",description:"Warehouse capacity 78% utilized. Stacking constraint flagged.",category:"Capacity",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T10:30:00Z",relatedArtifact:"Option A",relatedModule:"Capacity Fit",relatedScenarioId:"qs-a",severity:"Warning",mock:true,notes:"" },
  { id:"act-11",workspaceId:"w4",eventType:"promise_gap_flagged",title:"Capacity promise gap flagged",description:"400 pallet positions may need 450-480 effective positions with constraints.",category:"Capacity",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T10:35:00Z",relatedArtifact:"Option A",relatedModule:"Capacity Fit",relatedScenarioId:"qs-a",severity:"High",mock:true,notes:"" },
  { id:"act-12",workspaceId:"w4",eventType:"option_b_reviewed",title:"Option B — Aggressive Entry reviewed",description:"Aggressive pricing scenario reviewed. GP 5.6% — critical margin risk.",category:"Quote",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T08:00:00Z",relatedArtifact:"Option B",relatedModule:"Quote Control",relatedScenarioId:"qs-b",severity:"Critical",mock:true,notes:"" },
  { id:"act-13",workspaceId:"w4",eventType:"pricing_posture_reviewed",title:"Pricing posture reviewed",description:"Posture: Hold Ground. Strategic value insufficient for aggressive entry.",category:"Pricing Posture",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T09:00:00Z",relatedArtifact:"Option A",relatedModule:"Pricing Posture",relatedScenarioId:"qs-a",severity:"Info",mock:true,notes:"" },
  { id:"act-14",workspaceId:"w4",eventType:"revenue_timing_reviewed",title:"Revenue timing reviewed",description:"Revenue realization: This Quarter. DSO 68 days — payment risk.",category:"Revenue Timing",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T09:30:00Z",relatedArtifact:"Option A",relatedModule:"Revenue Realization",relatedScenarioId:"qs-a",severity:"Warning",mock:true,notes:"" },
  { id:"act-15",workspaceId:"w4",eventType:"escalation_created",title:"Mock escalation created",description:"Red: Margin below threshold for Option A. Escalation to CEO/CFO.",category:"Escalation",actor:"System",role:"Mock Engine",timestamp:"2026-04-29T10:00:00Z",relatedArtifact:"Option A",relatedModule:"Mock Escalation",relatedScenarioId:"qs-a",severity:"High",mock:true,notes:"" },
  { id:"act-16",workspaceId:"w4",eventType:"testing_bypass",title:"Testing bypass used",description:"Mock escalation reviewed. Continue for testing — no enforcement applied.",category:"Escalation",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T10:15:00Z",relatedArtifact:"Option A",relatedModule:"Mock Escalation",relatedScenarioId:"qs-a",severity:"Info",mock:true,notes:"" },
  { id:"act-17",workspaceId:"w4",eventType:"proposal_created",title:"Proposal v0.1 created",description:"Internal draft proposal created linked to Option A — Standard Tariff.",category:"Proposal",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-30T08:00:00Z",relatedArtifact:"Proposal v0.1",relatedModule:"Proposal Control",relatedScenarioId:"qs-a",severity:"Info",mock:true,notes:"" },
  { id:"act-18",workspaceId:"w4",eventType:"option_c_reviewed",title:"Option C — Premium reviewed",description:"Premium fast implementation scenario reviewed. GP 21.7%.",category:"Quote",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-30T09:00:00Z",relatedArtifact:"Option C",relatedModule:"Quote Control",relatedScenarioId:"qs-c",severity:"Info",mock:true,notes:"" },
  { id:"act-19",workspaceId:"w4",eventType:"proposal_negotiation",title:"Negotiation round 2 logged",description:"Client asked for discount on storage rate. GP drops to 5.6%.",category:"Negotiation",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-01T08:00:00Z",relatedArtifact:"Proposal v0.3",relatedModule:"Proposal Control",relatedScenarioId:"qs-b",severity:"Critical",mock:true,notes:"" },
  { id:"act-20",workspaceId:"w4",eventType:"sla_pricing_lock",title:"SLA pricing lock warning",description:"SLA v0.1 pricing not locked. Future gate: must lock before client-facing SLA.",category:"SLA",actor:"System",role:"Mock Engine",timestamp:"2026-05-02T08:00:00Z",relatedArtifact:"SLA v0.1",relatedModule:"SLA Control",relatedScenarioId:"qs-a",severity:"High",mock:true,notes:"" },
  { id:"act-21",workspaceId:"w4",eventType:"sla_critical_reviewed",title:"SLA v0.3 critical risk reviewed",description:"Critical SLA risk for aggressive pricing. Executive review would be required.",category:"SLA",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-02T09:00:00Z",relatedArtifact:"SLA v0.3",relatedModule:"SLA Control",relatedScenarioId:"qs-b",severity:"Critical",mock:true,notes:"" },
  { id:"act-22",workspaceId:"w4",eventType:"sla_promise_gap",title:"SLA promise gap flagged",description:"Inbound receiving SLA < 4h vs operational reality 6-8h for special handling.",category:"SLA",actor:"System",role:"Mock Engine",timestamp:"2026-05-02T09:15:00Z",relatedArtifact:"SLA v0.1",relatedModule:"SLA Control",relatedScenarioId:"qs-a",severity:"High",mock:true,notes:"" },
  { id:"act-23",workspaceId:"w4",eventType:"crm_status_viewed",title:"CRM status viewed",description:"CRM Sync: Mock / Not Connected. No real CRM integration active.",category:"CRM Mock",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-02T10:00:00Z",relatedArtifact:"",relatedModule:"CRM",relatedScenarioId:"",severity:"Info",mock:true,notes:"" },
  { id:"act-24",workspaceId:"w4",eventType:"proposal_v03_reviewed",title:"Proposal v0.3 negotiation response reviewed",description:"Negotiation response for aggressive pricing reviewed. Executive review needed.",category:"Proposal",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-02T11:00:00Z",relatedArtifact:"Proposal v0.3",relatedModule:"Proposal Control",relatedScenarioId:"qs-b",severity:"Critical",mock:true,notes:"" },
];

export const MOCK_AUDIT_EVENTS: CommercialAuditEvent[] = [
  { id:"aud-01",workspaceId:"w4",eventCode:"WORKSPACE_OPENED_MOCK",eventName:"Workspace Opened",description:"Commercial workspace opened for Al-Rajhi Emergency Storage.",category:"WORKSPACE",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T08:30:00Z",entityType:"Workspace",entityName:"Al-Rajhi Emergency Storage",beforeState:"—",afterState:"Open",mock:true,severity:"Info",traceId:"tr-001",notes:"" },
  { id:"aud-02",workspaceId:"w4",eventCode:"QUOTE_CONTROL_OPENED",eventName:"Quote Control Opened",description:"Quote Control tab accessed.",category:"QUOTE",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T08:35:00Z",entityType:"Quote Control",entityName:"Commercial Workspace",beforeState:"—",afterState:"Opened",mock:true,severity:"Info",traceId:"tr-002",notes:"" },
  { id:"aud-03",workspaceId:"w4",eventCode:"QUOTE_SCENARIO_SELECTED",eventName:"Scenario Selected",description:"Option A — Standard Tariff selected. GP 8.5%.",category:"QUOTE",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T08:40:00Z",entityType:"Quote Scenario",entityName:"Option A — Standard Tariff",beforeState:"None",afterState:"Selected",mock:true,severity:"Info",traceId:"tr-003",notes:"" },
  { id:"aud-04",workspaceId:"w4",eventCode:"PRICING_LINES_VIEWED",eventName:"Pricing Lines Viewed",description:"7 pricing lines reviewed for Option A.",category:"PRICING",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T09:00:00Z",entityType:"Pricing Lines",entityName:"Option A Pricing",beforeState:"—",afterState:"Viewed",mock:true,severity:"Info",traceId:"tr-004",notes:"" },
  { id:"aud-05",workspaceId:"w4",eventCode:"LOW_MARGIN_LINE_FLAGGED",eventName:"Low Margin Flagged",description:"Storage line GP 5.2% below 10% threshold.",category:"MARGIN",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T09:05:00Z",entityType:"Pricing Line",entityName:"Storage — Base Rate",beforeState:"5.2% GP",afterState:"Flagged",mock:true,severity:"High",traceId:"tr-005",notes:"CEO/CFO review would be required." },
  { id:"aud-06",workspaceId:"w4",eventCode:"PNL_SNAPSHOT_VIEWED",eventName:"P&L Snapshot Viewed",description:"P&L snapshot for Option A. Revenue SAR 1.20M, GP 8.5%.",category:"PNL",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T09:15:00Z",entityType:"P&L Snapshot",entityName:"Option A P&L",beforeState:"—",afterState:"Viewed",mock:true,severity:"Info",traceId:"tr-006",notes:"" },
  { id:"aud-07",workspaceId:"w4",eventCode:"MARGIN_AUTHORITY_EVALUATED",eventName:"Margin Authority Evaluated",description:"GP 8.5% requires CEO/CFO approval authority.",category:"MARGIN",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T09:20:00Z",entityType:"Margin Authority",entityName:"Option A",beforeState:"8.5% GP",afterState:"CEO/CFO Required",mock:true,severity:"High",traceId:"tr-007",notes:"" },
  { id:"aud-08",workspaceId:"w4",eventCode:"CUSTOMER_SCORE_REVIEWED",eventName:"Customer Score Reviewed",description:"Al-Rajhi Steel ECR grade C-. Pursuit: Qualified.",category:"CUSTOMER_SCORE",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T10:00:00Z",entityType:"Customer Score",entityName:"Al-Rajhi Steel",beforeState:"—",afterState:"C- Grade",mock:true,severity:"Warning",traceId:"tr-008",notes:"" },
  { id:"aud-09",workspaceId:"w4",eventCode:"CAPACITY_FIT_REVIEWED",eventName:"Capacity Fit Reviewed",description:"Warehouse capacity 78% utilized. Constraints flagged.",category:"CAPACITY",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-28T10:30:00Z",entityType:"Capacity Fit",entityName:"Option A",beforeState:"—",afterState:"78% Utilized",mock:true,severity:"Warning",traceId:"tr-009",notes:"" },
  { id:"aud-10",workspaceId:"w4",eventCode:"PROMISE_GAP_FLAGGED",eventName:"Promise Gap Flagged",description:"400 pallet positions may need 450-480 effective.",category:"CAPACITY",actor:"System",role:"Mock Engine",timestamp:"2026-04-28T10:35:00Z",entityType:"Promise Gap",entityName:"Pallet Position Gap",beforeState:"400 plt",afterState:"450-480 required",mock:true,severity:"High",traceId:"tr-010",notes:"" },
  { id:"aud-11",workspaceId:"w4",eventCode:"PRICING_POSTURE_REVIEWED",eventName:"Pricing Posture Reviewed",description:"Posture: Hold Ground for Option A.",category:"PRICING_POSTURE",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T09:00:00Z",entityType:"Pricing Posture",entityName:"Option A",beforeState:"—",afterState:"Hold Ground",mock:true,severity:"Info",traceId:"tr-011",notes:"" },
  { id:"aud-12",workspaceId:"w4",eventCode:"REVENUE_TIMING_REVIEWED",eventName:"Revenue Timing Reviewed",description:"Revenue realization: This Quarter. DSO 68 days.",category:"REVENUE_TIMING",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T09:30:00Z",entityType:"Revenue Timing",entityName:"Option A",beforeState:"—",afterState:"This Quarter",mock:true,severity:"Warning",traceId:"tr-012",notes:"" },
  { id:"aud-13",workspaceId:"w4",eventCode:"MOCK_ESCALATION_CREATED",eventName:"Mock Escalation Created",description:"Red: Margin below threshold. Escalation to CEO/CFO.",category:"ESCALATION",actor:"System",role:"Mock Engine",timestamp:"2026-04-29T10:00:00Z",entityType:"Mock Escalation",entityName:"Option A Margin",beforeState:"No Escalation",afterState:"Red — CEO/CFO",mock:true,severity:"High",traceId:"tr-013",notes:"" },
  { id:"aud-14",workspaceId:"w4",eventCode:"TESTING_BYPASS_USED",eventName:"Testing Bypass Used",description:"Mock escalation reviewed. Continue for testing.",category:"ESCALATION",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-29T10:15:00Z",entityType:"Mock Escalation",entityName:"Option A Bypass",beforeState:"Red",afterState:"Bypass — Testing",mock:true,severity:"Info",traceId:"tr-014",notes:"" },
  { id:"aud-15",workspaceId:"w4",eventCode:"PROPOSAL_VERSION_SELECTED",eventName:"Proposal Version Created",description:"Proposal v0.1 internal draft created. Linked to Option A.",category:"PROPOSAL",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-04-30T08:00:00Z",entityType:"Proposal",entityName:"Proposal v0.1",beforeState:"None",afterState:"Drafting",mock:true,severity:"Info",traceId:"tr-015",notes:"" },
  { id:"aud-16",workspaceId:"w4",eventCode:"NEGOTIATION_ROUND_LOGGED",eventName:"Negotiation Round Logged",description:"Round 2: Client discount request. GP 8.5% → 5.6%.",category:"NEGOTIATION",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-01T08:00:00Z",entityType:"Negotiation",entityName:"Round 2",beforeState:"8.5% GP",afterState:"5.6% GP",mock:true,severity:"Critical",traceId:"tr-016",notes:"" },
  { id:"aud-17",workspaceId:"w4",eventCode:"SLA_DRAFT_SELECTED",eventName:"SLA Draft Selected",description:"SLA v0.1 selected for review.",category:"SLA",actor:"Amin Al-Rashid",role:"Commercial Director",timestamp:"2026-05-02T08:00:00Z",entityType:"SLA",entityName:"SLA v0.1",beforeState:"—",afterState:"Selected",mock:true,severity:"Info",traceId:"tr-017",notes:"" },
  { id:"aud-18",workspaceId:"w4",eventCode:"SLA_PRICING_LOCK_WARNING_SHOWN",eventName:"SLA Pricing Lock Warning",description:"SLA v0.1 pricing not locked. Future gate shown.",category:"SLA",actor:"System",role:"Mock Engine",timestamp:"2026-05-02T08:05:00Z",entityType:"SLA",entityName:"SLA v0.1",beforeState:"Not Locked",afterState:"Warning Shown",mock:true,severity:"High",traceId:"tr-018",notes:"" },
  { id:"aud-19",workspaceId:"w4",eventCode:"SLA_PROMISE_GAP_FLAGGED",eventName:"SLA Promise Gap Flagged",description:"Inbound receiving SLA < 4h vs reality 6-8h.",category:"SLA",actor:"System",role:"Mock Engine",timestamp:"2026-05-02T09:15:00Z",entityType:"Promise Gap",entityName:"Inbound Receiving",beforeState:"< 4h target",afterState:"6-8h actual",mock:true,severity:"High",traceId:"tr-019",notes:"" },
  { id:"aud-20",workspaceId:"w4",eventCode:"CRM_SYNC_NOT_CONNECTED",eventName:"CRM Sync Status",description:"CRM Sync: Mock / Not Connected.",category:"CRM_SYNC",actor:"System",role:"System",timestamp:"2026-05-02T10:00:00Z",entityType:"CRM",entityName:"CRM Integration",beforeState:"—",afterState:"Not Connected",mock:true,severity:"Info",traceId:"tr-020",notes:"" },
];

export function getActivityForWorkspace(workspaceId: string): CommercialActivityEvent[] {
  return MOCK_ACTIVITY_EVENTS.filter(e => e.workspaceId === workspaceId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getAuditForWorkspace(workspaceId: string): CommercialAuditEvent[] {
  return MOCK_AUDIT_EVENTS.filter(e => e.workspaceId === workspaceId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ─── CW-011: COMMERCIAL WORKSPACE SIGNAL HELPERS ────────────

export type CommercialRiskLevel = "Low" | "Medium" | "High" | "Critical";

export interface CommercialWorkspaceSignalSummary {
  workspaceId: string;
  workspaceName: string;
  customerName: string;
  stage: string;
  value: number;
  gpPercent: number;
  riskLevel: CommercialRiskLevel;
  quoteStatus: string;
  proposalStatus: string;
  slaStatus: string;
  marginRisk: CommercialRiskLevel;
  customerRisk: string;
  capacityRisk: string;
  mockEscalationCount: number;
  criticalEscalationCount: number;
  proposalReviewNeeded: boolean;
  slaReviewNeeded: boolean;
  revenueTiming: string;
  nextAction: string;
  crmStatus: string;
  developmentMode: true;
}

export interface CommercialExecutionSignal {
  workspaceId: string;
  workspaceName: string;
  customerName: string;
  stage: string;
  riskColor: "red" | "amber" | "green";
  riskReason: string;
  nextAction: string;
  signalType: string;
  developmentMode: true;
}

/**
 * Build a signal summary for a given workspace.
 * Al-Rajhi (w4) returns rich data from CW-001–CW-010 mock stores.
 * Returns null for workspaces without enriched data.
 */
export function getCommercialWorkspaceSignalSummary(workspaceId: string): CommercialWorkspaceSignalSummary | null {
  if (workspaceId !== "w4") return null;

  const primaryScenario = MOCK_SCENARIOS[0]; // Option A — primary active scenario
  const customerScore = MOCK_CUSTOMER_SCORE;
  const capacityFit = MOCK_CAPACITY_FIT["qs-a"];
  const proposals = getProposalsForWorkspace("w4");
  const slaDrafts = getSlaDraftsForWorkspace("w4");
  const revenueRealization = MOCK_REVENUE_REALIZATION["qs-a"];

  // Count escalations across all scenarios
  const allEscalations = Object.values(MOCK_ESCALATIONS).flat();
  const totalEscalations = allEscalations.length;
  const criticalEscalations = allEscalations.filter(e => e.severity === "Critical").length;

  // Determine margin risk
  let marginRisk: CommercialRiskLevel = "Low";
  if (primaryScenario.gpPercent < 10) marginRisk = "Critical";
  else if (primaryScenario.gpPercent < 15) marginRisk = "High";
  else if (primaryScenario.gpPercent < 22) marginRisk = "Medium";

  // Overall risk level
  let riskLevel: CommercialRiskLevel = "Low";
  if (marginRisk === "Critical" || criticalEscalations > 0) riskLevel = "Critical";
  else if (marginRisk === "High" || totalEscalations > 3) riskLevel = "High";
  else if (marginRisk === "Medium") riskLevel = "Medium";

  // Quote status
  const quoteStatus = `${MOCK_SCENARIOS.length} scenarios active`;

  // Proposal status
  const proposalReviewNeeded = proposals.some(
    p => p.reviewStatus === "Needs Commercial Review" || p.reviewStatus === "Needs Finance Review" || p.reviewStatus === "Needs Ops Review" || p.reviewStatus === "Future Approval Required"
  );
  const proposalStatus = `${proposals.length} versions — ${proposals.filter(p => p.clientFacingMock).length} client-facing`;

  // SLA status
  const slaReviewNeeded = slaDrafts.some(
    s => (s.opsReviewStatus !== "Mock Reviewed" && s.opsReviewStatus !== "Not Reviewed") || (s.legalReviewStatus !== "Mock Reviewed" && s.legalReviewStatus !== "Not Reviewed")
  );
  const slaStatus = `${slaDrafts.length} drafts — ${slaDrafts.filter(s => s.riskLevel === "Critical" || s.riskLevel === "High").length} high-risk`;

  // Next action
  let nextAction = "Review mock escalation and reprice quote";
  if (marginRisk === "Critical") nextAction = "Review mock escalation and reprice quote";
  else if (proposalReviewNeeded) nextAction = "Review proposal before client-facing";
  else if (slaReviewNeeded) nextAction = "Complete Ops/Legal SLA review";

  return {
    workspaceId: "w4",
    workspaceName: "Al-Rajhi Emergency Storage",
    customerName: "Al-Rajhi Steel",
    stage: "quoting",
    value: primaryScenario.revenue,
    gpPercent: primaryScenario.gpPercent,
    riskLevel,
    quoteStatus,
    proposalStatus,
    slaStatus,
    marginRisk,
    customerRisk: customerScore.overallGrade,
    capacityRisk: capacityFit.capacityFitStatus,
    mockEscalationCount: totalEscalations,
    criticalEscalationCount: criticalEscalations,
    proposalReviewNeeded,
    slaReviewNeeded,
    revenueTiming: revenueRealization.budgetImpactTiming,
    nextAction,
    crmStatus: "Mock / Not Connected",
    developmentMode: true,
  };
}

/**
 * Derive individual execution signals for a workspace.
 * Returns an array of typed signals suitable for Dashboard/Pipeline chips.
 */
export function getCommercialWorkspaceSignals(workspaceId: string): CommercialExecutionSignal[] {
  const summary = getCommercialWorkspaceSignalSummary(workspaceId);
  if (!summary) return [];

  const base = {
    workspaceId: summary.workspaceId,
    workspaceName: summary.workspaceName,
    customerName: summary.customerName,
    stage: summary.stage,
    developmentMode: true as const,
  };

  const signals: CommercialExecutionSignal[] = [];

  // Margin risk
  if (summary.marginRisk === "Critical") {
    signals.push({ ...base, riskColor: "red", riskReason: `GP ${summary.gpPercent}% — critical margin risk`, nextAction: "Reprice quote to improve GP above 10%", signalType: "margin" });
  } else if (summary.marginRisk === "High" || summary.marginRisk === "Medium") {
    signals.push({ ...base, riskColor: "amber", riskReason: `GP ${summary.gpPercent}% — near margin threshold`, nextAction: "Protect price; do not reduce further", signalType: "margin" });
  }

  // Customer score risk
  if (summary.customerRisk === "C" || summary.customerRisk === "D") {
    signals.push({ ...base, riskColor: summary.customerRisk === "D" ? "red" : "amber", riskReason: `Customer ECR grade ${summary.customerRisk} — discount not recommended`, nextAction: "Monitor payment behavior; no additional discount", signalType: "customer" });
  }

  // Capacity risk
  if (summary.capacityRisk === "Constrained" || summary.capacityRisk === "High Risk" || summary.capacityRisk === "Critical") {
    signals.push({ ...base, riskColor: summary.capacityRisk === "Constrained" ? "amber" : "red", riskReason: `Capacity ${summary.capacityRisk.toLowerCase()} — promise gaps flagged`, nextAction: "Confirm Ops capacity before proposal", signalType: "capacity" });
  }

  // Mock escalations
  if (summary.criticalEscalationCount > 0) {
    signals.push({ ...base, riskColor: "red", riskReason: `${summary.mockEscalationCount} mock escalations (${summary.criticalEscalationCount} critical)`, nextAction: "Review mock escalations", signalType: "escalation" });
  } else if (summary.mockEscalationCount > 0) {
    signals.push({ ...base, riskColor: "amber", riskReason: `${summary.mockEscalationCount} mock escalations active`, nextAction: "Review mock escalations", signalType: "escalation" });
  }

  // Proposal review
  if (summary.proposalReviewNeeded) {
    signals.push({ ...base, riskColor: "amber", riskReason: `Proposal review needed — ${summary.proposalStatus}`, nextAction: "Complete proposal review before client-facing", signalType: "proposal" });
  }

  // SLA review
  if (summary.slaReviewNeeded) {
    signals.push({ ...base, riskColor: "amber", riskReason: `SLA review needed — ${summary.slaStatus}`, nextAction: "Complete Ops/Legal SLA review", signalType: "sla" });
  }

  // Revenue timing delay
  if (summary.revenueTiming === "Next Quarter" || summary.revenueTiming === "Beyond") {
    signals.push({ ...base, riskColor: "amber", riskReason: `Revenue timing: ${summary.revenueTiming}`, nextAction: "Factor delayed revenue into commercial decision", signalType: "revenue" });
  }

  return signals;
}

/**
 * Get all commercial execution signals across all enriched workspaces.
 * Currently only Al-Rajhi (w4) has deep CW data.
 */
export function getAllCommercialWorkspaceSignals(): CommercialExecutionSignal[] {
  // Only w4 has enriched CW-001 through CW-010 data
  return getCommercialWorkspaceSignals("w4");
}
