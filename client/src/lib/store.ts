// Hala Commercial Engine — Data Store
// Swiss Precision Instrument Design
// All data models, mock data, and business logic

import { nanoid } from "nanoid";

// ============================================================
// TYPES & ENUMS
// ============================================================

export type UserRole = "salesman" | "regional_sales_head" | "regional_ops_head" | "director" | "ceo_cfo" | "admin";
export type Region = "East" | "Central" | "West";
export type WorkspaceStage = "qualified" | "solution_design" | "quoting" | "proposal_active" | "negotiation" | "commercial_approved" | "sla_drafting" | "contract_ready" | "contract_sent" | "contract_signed" | "handover" | "go_live";
export type QuoteState = "draft" | "submitted" | "approved" | "rejected" | "superseded";
export type ProposalState = "draft" | "ready_for_crm" | "sent" | "negotiation_active" | "commercial_approved";
export type SLAState = "draft" | "operational_review" | "submitted" | "approved" | "superseded";
export type TenderPhase = "qualification" | "drafting" | "approval" | "submitted" | "won" | "lost";
export type ApprovalState = "not_required" | "pending" | "partially_approved" | "fully_approved" | "rejected" | "override_approved";
export type HandoverState = "initiated" | "legal_complete" | "finance_setup" | "ops_briefed" | "client_portal" | "training" | "go_live_scheduled" | "completed";
export type GateMode = "enforce" | "warn" | "off";
export type RAGStatus = "red" | "amber" | "green";
export type CustomerGrade = "A" | "B" | "C" | "D" | "F" | "TBA";
export type ServiceType = "WH" | "TP" | "WH & TP" | "VAS" | "F&C";
export type CustomerStatus = "Active" | "Closed" | "Terminated" | "Inactive";
export type CRMStage = "prospecting" | "qualified" | "proposal_sent" | "shortlisted" | "contract_negotiation" | "closed_won" | "contract_signed" | "go_live";
export type WorkspaceType = "commercial" | "tender" | "renewal";
export type TenderWorkspaceStage = "draft" | "in_preparation" | "submitted" | "under_evaluation" | "won" | "lost" | "withdrawn";

// ============================================================
// INTERFACES
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  region: Region;
  avatar?: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  group: string;
  status: CustomerStatus;
  city: string;
  region: Region;
  industry: string;
  accountOwner: string;
  serviceType: ServiceType;
  grade: CustomerGrade;
  facility: string;
  contractExpiry: string;
  contractValue2025: number;
  expectedMonthlyRevenue: number;
  dso: number;
  paymentStatus: "Good" | "Acceptable" | "Bad";
  revenue2023: number;
  revenue2024: number;
  revenue2025: number;
  palletContracted: number;
  palletOccupied: number;
  palletPotential: number;
  ratePerPallet: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export interface Workspace {
  id: string;
  customerId: string;
  customerName: string;
  title: string;
  stage: WorkspaceStage;
  crmDealId?: string;
  crmStage?: CRMStage;
  createdAt: string;
  updatedAt: string;
  owner: string;
  region: Region;
  estimatedValue: number;
  palletVolume: number;
  gpPercent: number;
  ragStatus: RAGStatus;
  daysInStage: number;
  approvalState: ApprovalState;
  notes: string;
  // Workspace Unification v1 — additive fields
  type?: WorkspaceType; // defaults to "commercial" if undefined
  parentWorkspaceId?: string; // for renewal workspaces linked to original
  tenderStage?: TenderWorkspaceStage; // only used when type === "tender"
  linkedTenderId?: string; // links to tender-engine Tender record
  submissionDeadline?: string; // tender deadline
  probabilityPercent?: number; // tender win probability
  wonLostReason?: string; // reason for Won/Lost terminal states
  convertedToWorkspaceId?: string; // when tender Won → converted to commercial
}

export interface Quote {
  id: string;
  workspaceId: string;
  version: number;
  state: QuoteState;
  createdAt: string;
  storageRate: number;
  inboundRate: number;
  outboundRate: number;
  palletVolume: number;
  monthlyRevenue: number;
  annualRevenue: number;
  totalCost: number;
  gpPercent: number;
  gpAmount: number;
}

export interface Proposal {
  id: string;
  workspaceId: string;
  version: number;
  state: ProposalState;
  title: string;
  createdAt: string;
  sections: string[];
}

export interface ApprovalRecord {
  id: string;
  entityType: "quote" | "proposal" | "tender";
  entityId: string;
  workspaceId: string;
  approverRole: UserRole;
  approverName: string;
  decision: "approved" | "rejected" | "pending";
  reason: string;
  timestamp: string;
  isOverride: boolean;
}

export interface AuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

export interface Signal {
  id: string;
  workspaceId: string;
  type: string;
  severity: RAGStatus;
  message: string;
  createdAt: string;
}

export interface PolicyGate {
  id: string;
  name: string;
  description: string;
  mode: GateMode;
  overridable: boolean;
}

export interface PnLModel {
  id: string;
  workspaceId: string;
  version: number;
  // Revenue
  storageRate: number;
  storagePallets: number;
  inboundRate: number;
  inboundVolume: number;
  outboundRate: number;
  outboundVolume: number;
  vasRevenue: number;
  monthlyRevenue: number;
  annualRevenue: number;
  // Costs
  facilityCost: number;
  staffCost: number;
  mheCost: number;
  insuranceCost: number;
  operationalCost: number;
  gaPercent: number;
  gaCost: number;
  totalOpex: number;
  // Results
  grossProfit: number;
  gpPercent: number;
  netProfit: number;
  netProfitPercent: number;
}

export interface HandoverTask {
  id: string;
  workspaceId: string;
  department: "sales" | "legal" | "finance" | "operations";
  task: string;
  status: "pending" | "in_progress" | "completed";
  assignedTo: string;
  dueDate: string;
}

export interface CRMSyncEvent {
  id: string;
  direction: "inbound" | "outbound";
  entity: string;
  zohoId: string;
  status: "success" | "failed" | "pending";
  timestamp: string;
  details: string;
}

// ============================================================
// MOCK DATA
// ============================================================

export const currentUser: User = {
  id: "u1",
  name: "Amin Al-Rashid",
  email: "amin@halascs.com",
  role: "admin",
  region: "East",
};

export const users: User[] = [
  currentUser,
  { id: "u2", name: "Ra'ed Al-Harbi", role: "regional_sales_head", email: "raed@halascs.com", region: "East" },
  { id: "u3", name: "Albert Fernandez", role: "salesman", email: "albert@halascs.com", region: "East" },
  { id: "u4", name: "Hano Kim", role: "salesman", email: "hano@halascs.com", region: "Central" },
  { id: "u5", name: "Yazan Khalil", role: "regional_ops_head", email: "yazan@halascs.com", region: "East" },
  { id: "u6", name: "Mohammed Al-Qahtani", role: "director", email: "mohammed@halascs.com", region: "East" },
  { id: "u7", name: "Tariq Nasser", role: "ceo_cfo", email: "tariq@halascs.com", region: "East" },
];

export const customers: Customer[] = [
  { id: "c1", code: "D365-001", name: "SABIC", group: "SABIC", status: "Active", city: "Jubail", region: "East", industry: "Petrochemical", accountOwner: "Ra'ed", serviceType: "WH", grade: "A", facility: "Jubail 1", contractExpiry: "2026-06-30", contractValue2025: 5200000, expectedMonthlyRevenue: 433333, dso: 35, paymentStatus: "Good", revenue2023: 4800000, revenue2024: 5100000, revenue2025: 2600000, palletContracted: 2500, palletOccupied: 2200, palletPotential: 3000, ratePerPallet: 40, contactName: "Ahmed Al-Sabic", contactEmail: "ahmed@sabic.com", contactPhone: "+966-13-555-0001" },
  { id: "c2", code: "D365-002", name: "Ma'aden", group: "Ma'aden", status: "Active", city: "Jubail", region: "East", industry: "Mining", accountOwner: "Ra'ed", serviceType: "WH & TP", grade: "B", facility: "Jubail 1", contractExpiry: "2026-03-31", contractValue2025: 3400000, expectedMonthlyRevenue: 283333, dso: 42, paymentStatus: "Good", revenue2023: 3100000, revenue2024: 3300000, revenue2025: 1700000, palletContracted: 1800, palletOccupied: 1500, palletPotential: 2200, ratePerPallet: 38, contactName: "Khalid Al-Maaden", contactEmail: "khalid@maaden.com", contactPhone: "+966-13-555-0002" },
  { id: "c3", code: "D365-003", name: "Almarai", group: "Almarai", status: "Active", city: "Riyadh", region: "Central", industry: "FMCG", accountOwner: "Hano", serviceType: "WH & TP", grade: "A", facility: "RUH Sulai", contractExpiry: "2026-12-31", contractValue2025: 8500000, expectedMonthlyRevenue: 708333, dso: 28, paymentStatus: "Good", revenue2023: 7200000, revenue2024: 8000000, revenue2025: 4250000, palletContracted: 4000, palletOccupied: 3800, palletPotential: 5000, ratePerPallet: 42, contactName: "Faisal Al-Marai", contactEmail: "faisal@almarai.com", contactPhone: "+966-11-555-0003" },
  { id: "c4", code: "D365-004", name: "Sadara Chemical", group: "Sadara", status: "Active", city: "Jubail", region: "East", industry: "Petrochemical", accountOwner: "Albert", serviceType: "WH", grade: "B", facility: "Jubail 1", contractExpiry: "2025-09-30", contractValue2025: 2800000, expectedMonthlyRevenue: 233333, dso: 45, paymentStatus: "Acceptable", revenue2023: 2500000, revenue2024: 2700000, revenue2025: 1400000, palletContracted: 1200, palletOccupied: 1050, palletPotential: 1500, ratePerPallet: 39, contactName: "Omar Sadara", contactEmail: "omar@sadara.com", contactPhone: "+966-13-555-0004" },
  { id: "c5", code: "D365-005", name: "Nestlé KSA", group: "Nestlé", status: "Active", city: "Jeddah", region: "West", industry: "FMCG", accountOwner: "Hano", serviceType: "WH & TP", grade: "A", facility: "JED Modon 3", contractExpiry: "2027-03-31", contractValue2025: 6200000, expectedMonthlyRevenue: 516667, dso: 30, paymentStatus: "Good", revenue2023: 5500000, revenue2024: 5900000, revenue2025: 3100000, palletContracted: 3200, palletOccupied: 3000, palletPotential: 4000, ratePerPallet: 41, contactName: "Sarah Nestlé", contactEmail: "sarah@nestle.com", contactPhone: "+966-12-555-0005" },
  { id: "c6", code: "D365-006", name: "Unilever Arabia", group: "Unilever", status: "Active", city: "Dammam", region: "East", industry: "FMCG", accountOwner: "Albert", serviceType: "WH", grade: "C", facility: "DMM Nahda", contractExpiry: "2025-06-30", contractValue2025: 1800000, expectedMonthlyRevenue: 150000, dso: 55, paymentStatus: "Acceptable", revenue2023: 1900000, revenue2024: 1850000, revenue2025: 900000, palletContracted: 900, palletOccupied: 700, palletPotential: 1200, ratePerPallet: 36, contactName: "Lina Unilever", contactEmail: "lina@unilever.com", contactPhone: "+966-13-555-0006" },
  { id: "c7", code: "D365-007", name: "Aramco Services", group: "Aramco", status: "Active", city: "Dhahran", region: "East", industry: "Energy", accountOwner: "Ra'ed", serviceType: "WH & TP", grade: "A", facility: "DMM Nahda", contractExpiry: "2027-12-31", contractValue2025: 12000000, expectedMonthlyRevenue: 1000000, dso: 25, paymentStatus: "Good", revenue2023: 10500000, revenue2024: 11200000, revenue2025: 6000000, palletContracted: 5500, palletOccupied: 5200, palletPotential: 7000, ratePerPallet: 45, contactName: "Hassan Aramco", contactEmail: "hassan@aramco.com", contactPhone: "+966-13-555-0007" },
  { id: "c8", code: "D365-008", name: "Siemens KSA", group: "Siemens", status: "Active", city: "Riyadh", region: "Central", industry: "Manufacturing/Industrial", accountOwner: "Hano", serviceType: "WH", grade: "C", facility: "RUH Sulai", contractExpiry: "2025-12-31", contractValue2025: 1500000, expectedMonthlyRevenue: 125000, dso: 48, paymentStatus: "Acceptable", revenue2023: 1400000, revenue2024: 1450000, revenue2025: 750000, palletContracted: 600, palletOccupied: 480, palletPotential: 800, ratePerPallet: 37, contactName: "Klaus Siemens", contactEmail: "klaus@siemens.com", contactPhone: "+966-11-555-0008" },
  { id: "c9", code: "D365-009", name: "Al-Rajhi Steel", group: "Al-Rajhi", status: "Active", city: "Jubail", region: "East", industry: "Manufacturing/Industrial", accountOwner: "Albert", serviceType: "WH", grade: "D", facility: "Jubail 1", contractExpiry: "2025-04-30", contractValue2025: 800000, expectedMonthlyRevenue: 66667, dso: 68, paymentStatus: "Bad", revenue2023: 900000, revenue2024: 850000, revenue2025: 400000, palletContracted: 400, palletOccupied: 280, palletPotential: 500, ratePerPallet: 34, contactName: "Majid Al-Rajhi", contactEmail: "majid@alrajhisteel.com", contactPhone: "+966-13-555-0009" },
  { id: "c10", code: "D365-010", name: "Bayer Middle East", group: "Bayer", status: "Active", city: "Jeddah", region: "West", industry: "Healthcare", accountOwner: "Hano", serviceType: "WH & TP", grade: "B", facility: "JED Modon 3", contractExpiry: "2026-09-30", contractValue2025: 4100000, expectedMonthlyRevenue: 341667, dso: 32, paymentStatus: "Good", revenue2023: 3800000, revenue2024: 4000000, revenue2025: 2050000, palletContracted: 2000, palletOccupied: 1850, palletPotential: 2500, ratePerPallet: 43, contactName: "Anna Bayer", contactEmail: "anna@bayer.com", contactPhone: "+966-12-555-0010" },
  { id: "c11", code: "D365-011", name: "Tasnee", group: "Tasnee", status: "Active", city: "Jubail", region: "East", industry: "Petrochemical", accountOwner: "Ra'ed", serviceType: "WH", grade: "B", facility: "Jubail 1", contractExpiry: "2026-08-31", contractValue2025: 2900000, expectedMonthlyRevenue: 241667, dso: 38, paymentStatus: "Good", revenue2023: 2600000, revenue2024: 2800000, revenue2025: 1450000, palletContracted: 1400, palletOccupied: 1250, palletPotential: 1800, ratePerPallet: 39, contactName: "Nasser Tasnee", contactEmail: "nasser@tasnee.com", contactPhone: "+966-13-555-0011" },
  { id: "c12", code: "D365-012", name: "Panda Retail", group: "Savola", status: "Terminated", city: "Jeddah", region: "West", industry: "FMCG/Retail", accountOwner: "Hano", serviceType: "WH & TP", grade: "F", facility: "JED Modon 3", contractExpiry: "2024-12-31", contractValue2025: 0, expectedMonthlyRevenue: 0, dso: 90, paymentStatus: "Bad", revenue2023: 2200000, revenue2024: 1100000, revenue2025: 0, palletContracted: 0, palletOccupied: 0, palletPotential: 0, ratePerPallet: 0, contactName: "Yusuf Panda", contactEmail: "yusuf@panda.com", contactPhone: "+966-12-555-0012" },
];

export const workspaces: Workspace[] = [
  { id: "w1", customerId: "c2", customerName: "Ma'aden", title: "Ma'aden Jubail Expansion 2500PP", stage: "quoting", crmDealId: "ZH-4521", crmStage: "qualified", createdAt: "2025-12-15", updatedAt: "2026-02-10", owner: "Ra'ed", region: "East", estimatedValue: 3400000, palletVolume: 2500, gpPercent: 19.7, ragStatus: "amber", daysInStage: 12, approvalState: "not_required", notes: "Client requesting expanded capacity in Jubail. P&L under review." },
  { id: "w2", customerId: "c4", customerName: "Sadara Chemical", title: "Sadara Contract Renewal 2025", stage: "negotiation", crmDealId: "ZH-4498", crmStage: "contract_negotiation", createdAt: "2025-11-01", updatedAt: "2026-02-14", owner: "Albert", region: "East", estimatedValue: 2800000, palletVolume: 1200, gpPercent: 24.5, ragStatus: "green", daysInStage: 5, approvalState: "fully_approved", notes: "Renewal negotiation in progress. Client wants 3-year term." },
  { id: "w3", customerId: "c6", customerName: "Unilever Arabia", title: "Unilever Dammam New SOW", stage: "proposal_active", crmDealId: "ZH-4555", crmStage: "proposal_sent", createdAt: "2026-01-10", updatedAt: "2026-02-12", owner: "Albert", region: "East", estimatedValue: 1800000, palletVolume: 900, gpPercent: 15.2, ragStatus: "amber", daysInStage: 8, approvalState: "pending", notes: "Proposal sent. Awaiting client feedback. GP% below target." },
  { id: "w4", customerId: "c9", customerName: "Al-Rajhi Steel", title: "Al-Rajhi Emergency Storage", stage: "qualified", crmDealId: "ZH-4580", crmStage: "qualified", createdAt: "2026-02-01", updatedAt: "2026-02-15", owner: "Albert", region: "East", estimatedValue: 800000, palletVolume: 400, gpPercent: 8.5, ragStatus: "red", daysInStage: 15, approvalState: "not_required", notes: "Low margin deal. Client has payment issues. Needs CEO review." },
  { id: "w5", customerId: "c3", customerName: "Almarai", title: "Almarai Riyadh Phase 2", stage: "solution_design", crmDealId: "ZH-4590", crmStage: "qualified", createdAt: "2026-02-05", updatedAt: "2026-02-16", owner: "Hano", region: "Central", estimatedValue: 8500000, palletVolume: 4000, gpPercent: 32.1, ragStatus: "green", daysInStage: 3, approvalState: "not_required", notes: "Major expansion opportunity. High margin, strategic account." },
  { id: "w6", customerId: "c7", customerName: "Aramco Services", title: "Aramco Dhahran VAS Expansion", stage: "commercial_approved", crmDealId: "ZH-4410", crmStage: "shortlisted", createdAt: "2025-10-15", updatedAt: "2026-02-08", owner: "Ra'ed", region: "East", estimatedValue: 12000000, palletVolume: 5500, gpPercent: 28.3, ragStatus: "green", daysInStage: 2, approvalState: "fully_approved", notes: "Approved. Moving to SLA drafting." },
  { id: "w7", customerId: "c5", customerName: "Nestlé KSA", title: "Nestlé Jeddah Cold Chain", stage: "sla_drafting", crmDealId: "ZH-4450", crmStage: "shortlisted", createdAt: "2025-09-20", updatedAt: "2026-02-11", owner: "Hano", region: "West", estimatedValue: 6200000, palletVolume: 3200, gpPercent: 26.8, ragStatus: "green", daysInStage: 6, approvalState: "fully_approved", notes: "SLA being drafted. Cold chain requirements complex." },
  { id: "w8", customerId: "c10", customerName: "Bayer Middle East", title: "Bayer Pharma Logistics", stage: "contract_sent", crmDealId: "ZH-4380", crmStage: "contract_negotiation", createdAt: "2025-08-10", updatedAt: "2026-02-09", owner: "Hano", region: "West", estimatedValue: 4100000, palletVolume: 2000, gpPercent: 31.2, ragStatus: "green", daysInStage: 7, approvalState: "fully_approved", notes: "Contract sent to client. Awaiting signature." },
  // ─── TENDER WORKSPACES (type: "tender") ─────────────────────
  { id: "wt-001", customerId: "c2", customerName: "Ma'aden", title: "Ma'aden Jubail Expansion — Logistics RFP", stage: "qualified", createdAt: "2026-01-15", updatedAt: "2026-02-14", owner: "Ra'ed", region: "East", estimatedValue: 3400000, palletVolume: 2500, gpPercent: 22, ragStatus: "amber", daysInStage: 8, approvalState: "not_required", notes: "Linked to workspace w1. Technical draft in progress.", type: "tender", tenderStage: "in_preparation", linkedTenderId: "tn-001", submissionDeadline: "2026-03-20", probabilityPercent: 60 },
  { id: "wt-002", customerId: "c1", customerName: "SABIC", title: "SABIC National Warehousing Services Tender", stage: "qualified", createdAt: "2026-02-01", updatedAt: "2026-02-15", owner: "Ra'ed", region: "East", estimatedValue: 15000000, palletVolume: 5000, gpPercent: 25, ragStatus: "green", daysInStage: 14, approvalState: "not_required", notes: "Large strategic tender. Committee formation pending.", type: "tender", tenderStage: "draft", linkedTenderId: "tn-002", submissionDeadline: "2026-04-01", probabilityPercent: 45 },
  { id: "wt-003", customerId: "c7", customerName: "Aramco Services", title: "Aramco Dhahran VAS Expansion Tender", stage: "qualified", createdAt: "2025-12-20", updatedAt: "2026-02-10", owner: "Ra'ed", region: "East", estimatedValue: 12000000, palletVolume: 5500, gpPercent: 28, ragStatus: "green", daysInStage: 5, approvalState: "not_required", notes: "Submitted on time. Awaiting evaluation committee review.", type: "tender", tenderStage: "submitted", linkedTenderId: "tn-003", submissionDeadline: "2026-03-10", probabilityPercent: 75 },
  { id: "wt-004", customerId: "c3", customerName: "Almarai", title: "Almarai Riyadh Phase 2 — Cold Chain Tender", stage: "qualified", createdAt: "2026-01-20", updatedAt: "2026-02-16", owner: "Hano", region: "Central", estimatedValue: 8500000, palletVolume: 4000, gpPercent: 30, ragStatus: "green", daysInStage: 5, approvalState: "not_required", notes: "High-value strategic account. Technical analysis complete.", type: "tender", tenderStage: "in_preparation", linkedTenderId: "tn-004", submissionDeadline: "2026-04-15", probabilityPercent: 70 },
  { id: "wt-005", customerId: "c5", customerName: "Nestlé KSA", title: "Nestlé Jeddah Cold Chain Partnership", stage: "qualified", createdAt: "2025-11-15", updatedAt: "2026-02-12", owner: "Hano", region: "West", estimatedValue: 6200000, palletVolume: 3200, gpPercent: 26, ragStatus: "amber", daysInStage: 12, approvalState: "not_required", notes: "Evaluation ongoing. Shortlisted with 2 competitors.", type: "tender", tenderStage: "under_evaluation", linkedTenderId: "tn-005", submissionDeadline: "2026-05-01", probabilityPercent: 55 },
  { id: "wt-006", customerId: "c4", customerName: "Sadara Chemical", title: "Sadara Contract Renewal Tender 2025", stage: "qualified", createdAt: "2025-10-15", updatedAt: "2026-02-14", owner: "Albert", region: "East", estimatedValue: 2800000, palletVolume: 1200, gpPercent: 24, ragStatus: "green", daysInStage: 3, approvalState: "not_required", notes: "Renewal tender. Strong relationship. High probability.", type: "tender", tenderStage: "under_evaluation", linkedTenderId: "tn-006", submissionDeadline: "2026-02-28", probabilityPercent: 85 },
  { id: "wt-007", customerId: "c3", customerName: "Almarai", title: "Almarai Dammam Distribution Center", stage: "qualified", createdAt: "2025-08-01", updatedAt: "2025-12-20", owner: "Hano", region: "East", estimatedValue: 4500000, palletVolume: 2000, gpPercent: 27, ragStatus: "green", daysInStage: 58, approvalState: "not_required", notes: "Won. Contract signed. Handover initiated.", type: "tender", tenderStage: "won", linkedTenderId: "tn-007", submissionDeadline: "2025-12-15", probabilityPercent: 100 },
  { id: "wt-008", customerId: "c6", customerName: "Unilever Arabia", title: "Unilever Riyadh Expansion RFP", stage: "qualified", createdAt: "2025-07-15", updatedAt: "2025-12-05", owner: "Albert", region: "Central", estimatedValue: 3200000, palletVolume: 900, gpPercent: 20, ragStatus: "red", daysInStage: 73, approvalState: "not_required", notes: "Lost to competitor. Price was 12% higher.", type: "tender", tenderStage: "lost", linkedTenderId: "tn-008", submissionDeadline: "2025-11-30", probabilityPercent: 0, wonLostReason: "Lost to competitor. Price was 12% higher." },
];

export const quotes: Quote[] = [
  { id: "q1", workspaceId: "w1", version: 1, state: "draft", createdAt: "2026-02-10", storageRate: 40, inboundRate: 7, outboundRate: 7, palletVolume: 2500, monthlyRevenue: 23360, annualRevenue: 280320, totalCost: 225071, gpPercent: 19.7, gpAmount: 55249 },
  { id: "q2", workspaceId: "w2", version: 2, state: "approved", createdAt: "2026-01-20", storageRate: 39, inboundRate: 7, outboundRate: 7, palletVolume: 1200, monthlyRevenue: 18500, annualRevenue: 222000, totalCost: 167610, gpPercent: 24.5, gpAmount: 54390 },
  { id: "q3", workspaceId: "w3", version: 1, state: "submitted", createdAt: "2026-02-05", storageRate: 36, inboundRate: 6, outboundRate: 6, palletVolume: 900, monthlyRevenue: 12800, annualRevenue: 153600, totalCost: 130253, gpPercent: 15.2, gpAmount: 23347 },
];

export const proposals: Proposal[] = [
  { id: "p1", workspaceId: "w3", version: 1, state: "sent", title: "Unilever Arabia — Warehousing Solution", createdAt: "2026-02-08", sections: ["Executive Summary", "Scope of Work", "Pricing", "SLA Framework", "Terms & Conditions"] },
  { id: "p2", workspaceId: "w6", version: 3, state: "commercial_approved", title: "Aramco Services — VAS Expansion Proposal", createdAt: "2026-01-15", sections: ["Executive Summary", "Solution Design", "VAS Catalog", "Pricing", "Implementation Timeline", "SLA Framework"] },
];

export const approvalRecords: ApprovalRecord[] = [
  { id: "a1", entityType: "quote", entityId: "q2", workspaceId: "w2", approverRole: "regional_sales_head", approverName: "Ra'ed Al-Harbi", decision: "approved", reason: "Margin acceptable for renewal", timestamp: "2026-01-22T10:30:00Z", isOverride: false },
  { id: "a2", entityType: "quote", entityId: "q2", workspaceId: "w2", approverRole: "regional_ops_head", approverName: "Yazan Khalil", decision: "approved", reason: "Capacity confirmed — space available", timestamp: "2026-01-22T14:15:00Z", isOverride: false },
  { id: "a3", entityType: "quote", entityId: "q3", workspaceId: "w3", approverRole: "regional_sales_head", approverName: "Ra'ed Al-Harbi", decision: "pending", reason: "", timestamp: "2026-02-06T09:00:00Z", isOverride: false },
  { id: "a4", entityType: "proposal", entityId: "p2", workspaceId: "w6", approverRole: "director", approverName: "Mohammed Al-Qahtani", decision: "approved", reason: "Strategic account. Full support.", timestamp: "2026-01-18T16:45:00Z", isOverride: false },
];

export const signals: Signal[] = [
  { id: "s1", workspaceId: "w1", type: "margin_warning", severity: "amber", message: "GP% at 19.7% — below 22% threshold. Director approval will be required.", createdAt: "2026-02-10" },
  { id: "s2", workspaceId: "w4", type: "margin_critical", severity: "red", message: "GP% at 8.5% — below 10%. CEO/CFO approval required. Client has payment issues (DSO: 68 days).", createdAt: "2026-02-15" },
  { id: "s3", workspaceId: "w3", type: "stage_aging", severity: "amber", message: "Workspace in 'Proposal Active' for 8 days. Follow up recommended.", createdAt: "2026-02-12" },
  { id: "s4", workspaceId: "w4", type: "payment_risk", severity: "red", message: "Customer Al-Rajhi Steel has DSO of 68 days and 'Bad' payment status.", createdAt: "2026-02-15" },
  { id: "s5", workspaceId: "w5", type: "high_value", severity: "green", message: "High-value opportunity: SAR 8.5M estimated. GP% 32.1% — excellent margin.", createdAt: "2026-02-05" },
  { id: "s6", workspaceId: "w8", type: "contract_pending", severity: "green", message: "Contract sent 7 days ago. Normal timeline for pharma clients.", createdAt: "2026-02-09" },
];

export const policyGates: PolicyGate[] = [
  { id: "pg1", name: "Commercial Approval Gate", description: "Requires approval based on GP% and pallet volume thresholds", mode: "enforce", overridable: true },
  { id: "pg2", name: "Discount/Margin Gate", description: "Warns when pricing falls below minimum margin thresholds", mode: "warn", overridable: true },
  { id: "pg3", name: "Proposal Indicative Language Gate", description: "Flags non-committal or indicative language in proposals", mode: "warn", overridable: true },
  { id: "pg4", name: "SLA Creation Gate", description: "Requires commercial approval before SLA can be drafted", mode: "enforce", overridable: true },
  { id: "pg5", name: "Contract Readiness Gate", description: "Checks all required documents exist before contract stage", mode: "enforce", overridable: false },
  { id: "pg6", name: "Tender Committee Gate", description: "Requires tender committee review before submission", mode: "enforce", overridable: false },
  { id: "pg7", name: "Operational Feasibility Gate", description: "Requires ops confirmation of space and capacity", mode: "enforce", overridable: true },
  { id: "pg8", name: "CRM Stage Conflict Gate", description: "Flags when CRM stage and workspace stage disagree", mode: "warn", overridable: true },
];

export const crmSyncEvents: CRMSyncEvent[] = [
  { id: "crm1", direction: "inbound", entity: "Deal", zohoId: "ZH-4580", status: "success", timestamp: "2026-02-15T08:30:00Z", details: "New deal synced → Workspace w4 created" },
  { id: "crm2", direction: "outbound", entity: "Deal Stage", zohoId: "ZH-4555", status: "success", timestamp: "2026-02-12T14:00:00Z", details: "Stage updated to 'Proposal Sent'" },
  { id: "crm3", direction: "inbound", entity: "Deal", zohoId: "ZH-4590", status: "success", timestamp: "2026-02-05T09:15:00Z", details: "New deal synced → Workspace w5 created" },
  { id: "crm4", direction: "outbound", entity: "Attachment", zohoId: "ZH-4555", status: "pending", timestamp: "2026-02-12T14:05:00Z", details: "Proposal PDF queued for upload to CRM" },
];

export const auditLog: AuditEntry[] = [
  { id: "al1", entityType: "workspace", entityId: "w1", action: "created", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2025-12-15T10:00:00Z", details: "Workspace created from CRM deal ZH-4521" },
  { id: "al2", entityType: "quote", entityId: "q1", action: "created", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-02-10T11:30:00Z", details: "Quote v1 created for Ma'aden Jubail Expansion" },
  { id: "al3", entityType: "workspace", entityId: "w2", action: "stage_changed", userId: "u3", userName: "Albert Fernandez", timestamp: "2026-02-14T09:00:00Z", details: "Stage changed from 'Proposal Active' to 'Negotiation'" },
  { id: "al4", entityType: "quote", entityId: "q2", action: "approved", userId: "u2", userName: "Ra'ed Al-Harbi", timestamp: "2026-01-22T10:30:00Z", details: "Quote v2 approved by Regional Sales Head" },
  { id: "al5", entityType: "proposal", entityId: "p2", action: "approved", userId: "u6", userName: "Mohammed Al-Qahtani", timestamp: "2026-01-18T16:45:00Z", details: "Proposal v3 approved by Director — 'Strategic account. Full support.'" },
];

// ============================================================
// BUSINESS LOGIC
// ============================================================

export function getApprovalRequirements(gpPercent: number, palletVolume: number): { role: UserRole; type: "approval" | "feasibility" }[] {
  const reqs: { role: UserRole; type: "approval" | "feasibility" }[] = [];
  
  // Always needs salesman + regional sales head
  reqs.push({ role: "salesman", type: "approval" });
  reqs.push({ role: "regional_sales_head", type: "approval" });
  
  // Volume check
  if (palletVolume > 300) {
    // Directors needed for volume > 300
    // (already covered by GP% rules below for most cases)
  }
  
  // GP% based
  if (gpPercent > 25) {
    reqs.push({ role: "regional_ops_head", type: "feasibility" });
  } else if (gpPercent > 22) {
    reqs.push({ role: "regional_ops_head", type: "approval" });
  } else if (gpPercent >= 10) {
    reqs.push({ role: "regional_ops_head", type: "approval" });
    reqs.push({ role: "director", type: "approval" });
  } else {
    reqs.push({ role: "regional_ops_head", type: "approval" });
    reqs.push({ role: "director", type: "approval" });
    reqs.push({ role: "ceo_cfo", type: "approval" });
  }
  
  return reqs;
}

export function calculateECR(dso: number, contractValue: number, gpPercent: number, growthScore: number, acquisitionScore: number): { score: number; grade: CustomerGrade } {
  // DSO (30%)
  let dsoScore = 0;
  if (dso <= 30) dsoScore = 1.0;
  else if (dso <= 45) dsoScore = 0.5;
  else dsoScore = 0.0;
  
  // Contract Value (30%)
  let cvScore = 0;
  if (contractValue > 2000000) cvScore = 1.0;
  else if (contractValue > 1000000) cvScore = 0.7;
  else if (contractValue > 500000) cvScore = 0.3;
  else if (contractValue > 100000) cvScore = 0.2;
  else cvScore = 0.0;
  
  // GP% (20%)
  let gpScore = 0;
  if (gpPercent > 20) gpScore = 1.0;
  else if (gpPercent >= 10) gpScore = 0.5;
  else gpScore = 0.2;
  
  const totalScore = (dsoScore * 0.30) + (cvScore * 0.30) + (gpScore * 0.20) + (growthScore * 0.10) + (acquisitionScore * 0.10);
  const percentage = totalScore * 100;
  
  let grade: CustomerGrade;
  if (percentage >= 90) grade = "A";
  else if (percentage >= 80) grade = "B";
  else if (percentage >= 70) grade = "C";
  else if (percentage >= 60) grade = "D";
  else grade = "F";
  
  return { score: percentage, grade };
}

export function calculatePnL(storageRate: number, pallets: number, inboundRate: number, inboundVol: number, outboundRate: number, outboundVol: number, vasRevenue: number, totalCost: number): { monthlyRevenue: number; annualRevenue: number; gpPercent: number; grossProfit: number } {
  const storageRevenue = storageRate * pallets * 30;
  const inboundRevenue = inboundRate * inboundVol;
  const outboundRevenue = outboundRate * outboundVol;
  const monthlyRevenue = storageRevenue + inboundRevenue + outboundRevenue + vasRevenue;
  const annualRevenue = monthlyRevenue * 12;
  const grossProfit = annualRevenue - totalCost;
  const gpPercent = annualRevenue > 0 ? (grossProfit / annualRevenue) * 100 : 0;
  
  return { monthlyRevenue, annualRevenue, gpPercent, grossProfit };
}

export const WORKSPACE_STAGES: { value: WorkspaceStage; label: string; color: string }[] = [
  { value: "qualified", label: "Qualified", color: "bg-blue-100 text-blue-800" },
  { value: "solution_design", label: "Solution Design", color: "bg-indigo-100 text-indigo-800" },
  { value: "quoting", label: "Quoting", color: "bg-violet-100 text-violet-800" },
  { value: "proposal_active", label: "Proposal Active", color: "bg-purple-100 text-purple-800" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-100 text-amber-800" },
  { value: "commercial_approved", label: "Commercial Approved", color: "bg-emerald-100 text-emerald-800" },
  { value: "sla_drafting", label: "SLA Drafting", color: "bg-teal-100 text-teal-800" },
  { value: "contract_ready", label: "Contract Ready", color: "bg-cyan-100 text-cyan-800" },
  { value: "contract_sent", label: "Contract Sent", color: "bg-sky-100 text-sky-800" },
  { value: "contract_signed", label: "Contract Signed", color: "bg-green-100 text-green-800" },
  { value: "handover", label: "Handover", color: "bg-lime-100 text-lime-800" },
  { value: "go_live", label: "Go-Live", color: "bg-green-200 text-green-900" },
];

// Tender workspace stages
export const TENDER_WORKSPACE_STAGES: { value: TenderWorkspaceStage; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-700" },
  { value: "in_preparation", label: "In Preparation", color: "bg-blue-100 text-blue-700" },
  { value: "submitted", label: "Submitted", color: "bg-violet-100 text-violet-700" },
  { value: "under_evaluation", label: "Under Evaluation", color: "bg-amber-100 text-amber-700" },
  { value: "won", label: "Won", color: "bg-emerald-100 text-emerald-700" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
  { value: "withdrawn", label: "Withdrawn", color: "bg-gray-100 text-gray-500" },
];

// Renewal workspace stages (reuses commercial stages but starts from negotiation)
export const RENEWAL_WORKSPACE_STAGES = WORKSPACE_STAGES;

// Dynamic stage engine — returns correct stages for workspace type
export function getStagesForType(type?: WorkspaceType): { value: string; label: string; color: string }[] {
  switch (type) {
    case "tender": return TENDER_WORKSPACE_STAGES;
    case "renewal": return RENEWAL_WORKSPACE_STAGES;
    default: return WORKSPACE_STAGES;
  }
}

export function getWorkspaceType(ws: Workspace): WorkspaceType {
  return ws.type ?? "commercial";
}

export function getEffectiveStage(ws: Workspace): string {
  if (ws.type === "tender" && ws.tenderStage) return ws.tenderStage;
  return ws.stage;
}

export function getEffectiveStageLabel(ws: Workspace): string {
  const stage = getEffectiveStage(ws);
  const stages = getStagesForType(getWorkspaceType(ws));
  return stages.find(s => s.value === stage)?.label ?? stage;
}

export function getEffectiveStageColor(ws: Workspace): string {
  const stage = getEffectiveStage(ws);
  const stages = getStagesForType(getWorkspaceType(ws));
  return stages.find(s => s.value === stage)?.color ?? "";
}

export function getWorkspaceTypeLabel(type?: WorkspaceType): string {
  switch (type) {
    case "tender": return "Tender";
    case "renewal": return "Renewal";
    default: return "Commercial";
  }
}

export function getWorkspaceTypeBadgeColor(type?: WorkspaceType): string {
  switch (type) {
    case "tender": return "bg-violet-100 text-violet-700 border-violet-200";
    case "renewal": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

export function getStageLabel(stage: WorkspaceStage): string {
  return WORKSPACE_STAGES.find(s => s.value === stage)?.label ?? stage;
}

export function getStageColor(stage: WorkspaceStage): string {
  return WORKSPACE_STAGES.find(s => s.value === stage)?.color ?? "";
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    salesman: "Salesman",
    regional_sales_head: "Regional Sales Head",
    regional_ops_head: "Regional Ops Head",
    director: "Director",
    ceo_cfo: "CEO / CFO",
    admin: "Admin",
  };
  return labels[role];
}

export function formatSAR(amount: number): string {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// @deprecated — DEAD CODE: Dashboard.tsx already uses Supabase hooks directly.
// Kept for reference only. Will be removed in Wave 4 cleanup.
export function getDashboardStats() {
  const activeWorkspaces = workspaces.filter(w => w.stage !== "go_live");
  const totalPipelineValue = activeWorkspaces.reduce((sum, w) => sum + w.estimatedValue, 0);
  const avgGP = activeWorkspaces.reduce((sum, w) => sum + w.gpPercent, 0) / activeWorkspaces.length;
  const redSignals = signals.filter(s => s.severity === "red").length;
  const amberSignals = signals.filter(s => s.severity === "amber").length;
  const pendingApprovals = approvalRecords.filter(a => a.decision === "pending").length;
  
  const activeCustomers = customers.filter(c => c.status === "Active").length;
  const totalRevenue2025 = customers.reduce((sum, c) => sum + c.revenue2025, 0);
  
  const expiringContracts = customers.filter(c => {
    if (!c.contractExpiry) return false;
    const expiry = new Date(c.contractExpiry);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 90;
  });
  
  const stageDistribution = WORKSPACE_STAGES.map(s => ({
    stage: s.label,
    count: workspaces.filter(w => w.stage === s.value).length,
    value: workspaces.filter(w => w.stage === s.value).reduce((sum, w) => sum + w.estimatedValue, 0),
  })).filter(s => s.count > 0);
  
  const gradeDistribution = (["A", "B", "C", "D", "F"] as CustomerGrade[]).map(g => ({
    grade: g,
    count: customers.filter(c => c.grade === g).length,
    revenue: customers.filter(c => c.grade === g).reduce((sum, c) => sum + c.revenue2025, 0),
  }));
  
  return {
    activeWorkspaces: activeWorkspaces.length,
    totalPipelineValue,
    avgGP,
    redSignals,
    amberSignals,
    pendingApprovals,
    activeCustomers,
    totalRevenue2025,
    expiringContracts,
    stageDistribution,
    gradeDistribution,
  };
}
