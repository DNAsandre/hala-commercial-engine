/**
 * store.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.11).
 *
 * Data models, pure formatters, and label helpers. This module performs no
 * data transport of its own; live records come from lib/supabase-data.ts.
 *
 * The legacy in-memory collections exported at the bottom (auditLog,
 * workspaces, customers) are genuinely empty typed arrays retained only for
 * legacy import compatibility. They are never populated.
 */

// ============================================================
// TYPES & ENUMS
// ============================================================

export type UserRole = "salesman" | "regional_sales_head" | "regional_ops_head" | "director" | "ceo_cfo" | "admin";
export type Region = "East" | "Central" | "West" | "Global";
export type WorkspaceStage = "qualified" | "solution_design" | "quoting" | "proposal_active" | "negotiation" | "commercial_approved" | "sla_drafting" | "contract_ready" | "contract_sent" | "contract_signed" | "handover" | "go_live" | "closed_lost";
export type CRMStage = "prospecting" | "qualified" | "proposal_sent" | "shortlisted" | "contract_negotiation" | "closed_won" | "contract_signed" | "actual_go_live" | "closed_lost" | "discontinued";
export type WorkspaceType = "commercial" | "tender" | "renewal";
export type TenderWorkspaceStage = "draft" | "in_preparation" | "submitted" | "under_evaluation" | "won" | "lost" | "withdrawn";
export type GateMode = "enforce" | "warn" | "off";

// Internal (non-exported) supporting unions referenced by the exported
// interfaces below. Kept identical to the legacy definitions.
type QuoteState = "draft" | "submitted" | "approved" | "rejected" | "superseded";
type ProposalState = "draft" | "ready_for_crm" | "sent" | "negotiation_active" | "commercial_approved";
type ApprovalState = "not_required" | "pending" | "partially_approved" | "fully_approved" | "rejected" | "override_approved";
type RAGStatus = "red" | "amber" | "green";
type CustomerGrade = "A" | "B" | "C" | "D" | "F" | "TBA";
type ServiceType = "WH" | "TP" | "WH & TP" | "VAS" | "F&C";
type CustomerStatus = "Active" | "Closed" | "Terminated" | "Inactive";

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
  auth_id?: string;
  department?: string;
  office?: string;
  status?: "active" | "inactive";
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
// ADVISORY BUSINESS LOGIC (computation only — no enforcement)
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

// ============================================================
// STAGE / MILESTONE CATALOGUES
// ============================================================

export const WORKSPACE_STAGES: { value: WorkspaceStage; label: string; color: string }[] = [
  { value: "qualified", label: "Qualified", color: "bg-blue-100 text-blue-800" },
  { value: "solution_design", label: "Solution Design", color: "bg-[#075eea]/15 text-[#064fc4]" },
  { value: "quoting", label: "Quoting", color: "bg-[#075eea]/15 text-[#064fc4]" },
  { value: "proposal_active", label: "Proposal Active", color: "bg-[#075eea]/15 text-[#064fc4]" },
  { value: "negotiation", label: "Negotiation", color: "bg-amber-100 text-amber-800" },
  { value: "commercial_approved", label: "Commercial Approved", color: "bg-emerald-100 text-emerald-800" },
  { value: "sla_drafting", label: "SLA Drafting", color: "bg-teal-100 text-teal-800" },
  { value: "contract_ready", label: "Contract Ready", color: "bg-cyan-100 text-cyan-800" },
  { value: "contract_sent", label: "Contract Sent", color: "bg-sky-100 text-sky-800" },
  { value: "contract_signed", label: "Contract Signed", color: "bg-green-100 text-green-800" },
  { value: "handover", label: "Handover", color: "bg-lime-100 text-lime-800" },
  { value: "go_live", label: "Go-Live", color: "bg-green-200 text-green-900" },
];

export const TENDER_WORKSPACE_STAGES: { value: TenderWorkspaceStage; label: string; color: string }[] = [
  { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-700" },
  { value: "in_preparation", label: "In Preparation", color: "bg-blue-100 text-blue-700" },
  { value: "submitted", label: "Submitted", color: "bg-[#075eea]/15 text-[#075eea]" },
  { value: "under_evaluation", label: "Under Evaluation", color: "bg-amber-100 text-amber-700" },
  { value: "won", label: "Won", color: "bg-emerald-100 text-emerald-700" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-700" },
  { value: "withdrawn", label: "Withdrawn", color: "bg-gray-100 text-gray-500" },
];

// Renewal workspaces reuse the commercial stage set (internal only).
const RENEWAL_WORKSPACE_STAGES = WORKSPACE_STAGES;

// ═══════════════════════════════════════════════════════════════
// COMMERCIAL MILESTONES — Decision-domain lifecycle strip (9 stages)
// ═══════════════════════════════════════════════════════════════
export const COMMERCIAL_MILESTONES: { value: string; label: string; color: string }[] = [
  { value: "qualified",           label: "Qualified",           color: "bg-blue-100 text-blue-800" },
  { value: "solution_design",     label: "Solution Design",     color: "bg-[#075eea]/15 text-[#064fc4]" },
  { value: "quoting",             label: "Quoting",             color: "bg-[#075eea]/15 text-[#064fc4]" },
  { value: "proposal_active",     label: "Proposal Active",     color: "bg-[#075eea]/15 text-[#064fc4]" },
  { value: "negotiation",         label: "Negotiation",         color: "bg-amber-100 text-amber-800" },
  { value: "commercial_approved", label: "Commercial Approved", color: "bg-emerald-100 text-emerald-800" },
  { value: "contract_signed",     label: "Contract Signed",     color: "bg-green-100 text-green-800" },
  { value: "go_live",             label: "Go-Live",             color: "bg-green-200 text-green-900" },
  { value: "closed_lost",         label: "Closed Lost",         color: "bg-red-100 text-red-700" },
];

// Map WorkspaceStage values → COMMERCIAL_MILESTONES for display
export function mapToCommercialMilestone(stage: string): string {
  const map: Record<string, string> = {
    "qualified":           "qualified",
    "solution_design":     "solution_design",
    "quoting":             "quoting",
    "proposal_active":     "proposal_active",
    "negotiation":         "negotiation",
    "commercial_approved": "commercial_approved",
    // Old intermediate stages collapse into nearest milestone
    "sla_drafting":        "commercial_approved",
    "contract_ready":      "contract_signed",
    "contract_sent":       "contract_signed",
    "contract_signed":     "contract_signed",
    "handover":            "go_live",
    "go_live":             "go_live",
    "closed_lost":         "closed_lost",
  };
  return map[stage] || stage;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT SUB-LIFECYCLES — Object-level truth layers
// ═══════════════════════════════════════════════════════════════

type QuoteSubState = "draft" | "submitted_for_approval" | "approved" | "rejected" | "superseded";
export const QUOTE_STATES: { value: QuoteSubState; label: string; color: string }[] = [
  { value: "draft",                    label: "Draft",                   color: "bg-slate-100 text-slate-700" },
  { value: "submitted_for_approval",   label: "Submitted for Approval",  color: "bg-blue-100 text-blue-700" },
  { value: "approved",                 label: "Approved",                color: "bg-emerald-100 text-emerald-700" },
  { value: "rejected",                 label: "Rejected",                color: "bg-red-100 text-red-700" },
  { value: "superseded",               label: "Superseded",              color: "bg-gray-100 text-gray-500" },
];

type ProposalSubState = "draft" | "ready_for_crm" | "sent" | "negotiation_active" | "commercial_approval_pending" | "commercial_approved" | "rejected" | "superseded" | "closed";
export const PROPOSAL_STATES: { value: ProposalSubState; label: string; color: string }[] = [
  { value: "draft",                          label: "Draft",                       color: "bg-slate-100 text-slate-700" },
  { value: "ready_for_crm",                  label: "Ready for CRM",               color: "bg-cyan-100 text-cyan-700" },
  { value: "sent",                           label: "Sent",                        color: "bg-blue-100 text-blue-700" },
  { value: "negotiation_active",             label: "Negotiation Active",          color: "bg-amber-100 text-amber-700" },
  { value: "commercial_approval_pending",    label: "Approval Pending",            color: "bg-orange-100 text-orange-700" },
  { value: "commercial_approved",            label: "Commercial Approved",         color: "bg-emerald-100 text-emerald-700" },
  { value: "rejected",                       label: "Rejected",                    color: "bg-red-100 text-red-700" },
  { value: "superseded",                     label: "Superseded",                  color: "bg-gray-100 text-gray-500" },
  { value: "closed",                         label: "Closed",                      color: "bg-gray-100 text-gray-500" },
];

type SlaSubState = "not_started" | "draft" | "operational_review" | "submitted_for_approval" | "approved" | "rejected" | "superseded";
export const SLA_STATES: { value: SlaSubState; label: string; color: string }[] = [
  { value: "not_started",               label: "Not Started",               color: "bg-gray-50 text-gray-400" },
  { value: "draft",                      label: "Draft",                     color: "bg-slate-100 text-slate-700" },
  { value: "operational_review",         label: "Operational Review",        color: "bg-blue-100 text-blue-700" },
  { value: "submitted_for_approval",     label: "Submitted for Approval",    color: "bg-amber-100 text-amber-700" },
  { value: "approved",                   label: "Approved",                  color: "bg-emerald-100 text-emerald-700" },
  { value: "rejected",                   label: "Rejected",                  color: "bg-red-100 text-red-700" },
  { value: "superseded",                 label: "Superseded",                color: "bg-gray-100 text-gray-500" },
];

type HandoverSubState = "not_started" | "initiated" | "legal_complete" | "finance_setup_complete" | "operations_briefed" | "client_portal_setup" | "training_complete" | "go_live_scheduled" | "completed";
export const HANDOVER_STATES: { value: HandoverSubState; label: string; color: string }[] = [
  { value: "not_started",               label: "Not Started",             color: "bg-gray-50 text-gray-400" },
  { value: "initiated",                 label: "Initiated",               color: "bg-blue-100 text-blue-700" },
  { value: "legal_complete",            label: "Legal Complete",           color: "bg-[#075eea]/15 text-[#075eea]" },
  { value: "finance_setup_complete",    label: "Finance Setup",           color: "bg-[#075eea]/15 text-[#075eea]" },
  { value: "operations_briefed",        label: "Ops Briefed",             color: "bg-[#075eea]/15 text-[#075eea]" },
  { value: "client_portal_setup",       label: "Portal Setup",            color: "bg-cyan-100 text-cyan-700" },
  { value: "training_complete",         label: "Training Complete",       color: "bg-teal-100 text-teal-700" },
  { value: "go_live_scheduled",         label: "Go-Live Scheduled",       color: "bg-lime-100 text-lime-700" },
  { value: "completed",                 label: "Completed",               color: "bg-emerald-100 text-emerald-700" },
];

// Helper: derive sub-lifecycle display state from existing workspace data
export function deriveSubLifecycleStates(ws: Workspace, quotes: any[], proposals: any[], slas: any[]) {
  const latestQuote = quotes.length > 0 ? quotes[quotes.length - 1] : null;
  const latestProposal = proposals.length > 0 ? proposals[proposals.length - 1] : null;
  const latestSla = slas.length > 0 ? slas[slas.length - 1] : null;

  // Derive quote sub-state
  let quoteState: QuoteSubState | null = null;
  if (latestQuote) {
    const qState = latestQuote.state || latestQuote.status;
    if (qState === "draft") quoteState = "draft";
    else if (qState === "submitted") quoteState = "submitted_for_approval";
    else if (qState === "approved") quoteState = "approved";
    else if (qState === "rejected") quoteState = "rejected";
    else if (qState === "superseded") quoteState = "superseded";
    else quoteState = "draft";
  }

  // Derive proposal sub-state
  let proposalState: ProposalSubState | null = null;
  if (latestProposal) {
    const pState = latestProposal.state || latestProposal.status;
    if (pState === "draft") proposalState = "draft";
    else if (pState === "sent") proposalState = "sent";
    else if (pState === "commercial_approved") proposalState = "commercial_approved";
    else if (pState === "rejected") proposalState = "rejected";
    else proposalState = "draft";
  }

  // Derive SLA sub-state from workspace stage
  let slaState: SlaSubState = "not_started";
  if (latestSla) {
    const sState = latestSla.status || latestSla.state;
    if (sState === "draft") slaState = "draft";
    else if (sState === "under_review") slaState = "operational_review";
    else if (sState === "active" || sState === "approved") slaState = "approved";
    else slaState = "draft";
  } else {
    // Infer from workspace stage
    const milestoneIdx = COMMERCIAL_MILESTONES.findIndex(m => m.value === mapToCommercialMilestone(ws.stage));
    const contractingIdx = COMMERCIAL_MILESTONES.findIndex(m => m.value === "contracting");
    if (milestoneIdx >= contractingIdx && contractingIdx >= 0) slaState = "draft";
  }

  // Derive handover sub-state
  let handoverState: HandoverSubState = "not_started";
  const ms = mapToCommercialMilestone(ws.stage);
  if (ms === "handover_active") handoverState = "initiated";
  else if (ms === "go_live") handoverState = "completed";

  return { quoteState, proposalState, slaState, handoverState };
}

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
    case "tender": return "bg-[#075eea]/15 text-[#075eea] border-[#075eea]/20";
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

// ============================================================
// LEGACY-EMPTY COLLECTIONS
// ============================================================
// These arrays are legacy-empty by design: they exist only so legacy import
// sites keep resolving. They are never seeded and never mutated by this app.
// All live data comes from Supabase via lib/supabase-data.ts.

export const auditLog: AuditEntry[] = [];

export const workspaces: Workspace[] = [];

export const customers: Customer[] = [];
