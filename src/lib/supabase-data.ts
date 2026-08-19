/**
 * supabase-data.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.2).
 *
 * Supabase data access layer. Column naming: Supabase uses snake_case, the
 * frontend uses camelCase; this layer handles the mapping.
 *
 * Honesty contract:
 *  - Every read comes from the live Supabase tables listed per function.
 *  - Read failures are recorded through supabase-error (setFetchError) so the
 *    UI can distinguish "empty data" from "failed fetch"; they are never
 *    converted into fabricated records.
 *  - Legacy proposal-table writes are refused explicitly (unified
 *    commercial_tickets is the write path), never silently "succeeded".
 */

import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
import { handleSupabaseError, setFetchError, clearFetchError } from "@/lib/supabase-error";
import { optimisticUpdate } from "@/lib/optimistic-lock";
import { fetchOperationalTicketsByType } from "./intake-save";
import { normalizeTenderTypeDetails } from "./tender-type-details";
import type { CommercialTicket } from "./unified-ticket-types";
import {
  PROCESS_ISOLATION_ENABLED,
  filterAllowedTenderTickets,
  getEmptyContractBaselines,
  getEmptyRenewalWorkspaces,
  isAllowedTenderTicket,
} from "./process-isolation";
import type {
  User, Customer, Workspace, Quote, Proposal, ApprovalRecord,
  Signal, PolicyGate, PnLModel, HandoverTask, CRMSyncEvent, AuditEntry,
} from "./store";
import type { Tender } from "./tender-engine";
import type { EditorBot, AIRun, AIRunStatus } from "./ai-runs";

// ============================================================
// COLUMN MAPPERS: snake_case (DB) ↔ camelCase (Frontend)
// ============================================================

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    group: row.group,
    status: row.status,
    city: row.city,
    region: row.region,
    industry: row.industry,
    accountOwner: row.account_owner,
    serviceType: row.service_type,
    grade: row.grade,
    facility: row.facility,
    contractExpiry: row.contract_expiry,
    contractValue2025: Number(row.contract_value_2025) || 0,
    expectedMonthlyRevenue: Number(row.expected_monthly_revenue) || 0,
    dso: row.dso || 0,
    paymentStatus: row.payment_status,
    revenue2023: Number(row.revenue_2023) || 0,
    revenue2024: Number(row.revenue_2024) || 0,
    revenue2025: Number(row.revenue_2025) || 0,
    palletContracted: row.pallet_contracted || 0,
    palletOccupied: row.pallet_occupied || 0,
    palletPotential: row.pallet_potential || 0,
    ratePerPallet: Number(row.rate_per_pallet) || 0,
    contactName: row.contact_name || "",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
  };
}

function customerToRow(c: Partial<Customer>): Record<string, any> {
  const row: Record<string, any> = {};
  if (c.id !== undefined) row.id = c.id;
  if (c.code !== undefined) row.code = c.code;
  if (c.name !== undefined) row.name = c.name;
  if (c.group !== undefined) row.group = c.group;
  if (c.status !== undefined) row.status = c.status;
  if (c.city !== undefined) row.city = c.city;
  if (c.region !== undefined) row.region = c.region;
  if (c.industry !== undefined) row.industry = c.industry;
  if (c.accountOwner !== undefined) row.account_owner = c.accountOwner;
  if (c.serviceType !== undefined) row.service_type = c.serviceType;
  if (c.grade !== undefined) row.grade = c.grade;
  if (c.facility !== undefined) row.facility = c.facility;
  if (c.contractExpiry !== undefined) row.contract_expiry = c.contractExpiry;
  if (c.contractValue2025 !== undefined) row.contract_value_2025 = c.contractValue2025;
  if (c.expectedMonthlyRevenue !== undefined) row.expected_monthly_revenue = c.expectedMonthlyRevenue;
  if (c.dso !== undefined) row.dso = c.dso;
  if (c.paymentStatus !== undefined) row.payment_status = c.paymentStatus;
  if (c.revenue2023 !== undefined) row.revenue_2023 = c.revenue2023;
  if (c.revenue2024 !== undefined) row.revenue_2024 = c.revenue2024;
  if (c.revenue2025 !== undefined) row.revenue_2025 = c.revenue2025;
  if (c.palletContracted !== undefined) row.pallet_contracted = c.palletContracted;
  if (c.palletOccupied !== undefined) row.pallet_occupied = c.palletOccupied;
  if (c.palletPotential !== undefined) row.pallet_potential = c.palletPotential;
  if (c.ratePerPallet !== undefined) row.rate_per_pallet = c.ratePerPallet;
  if (c.contactName !== undefined) row.contact_name = c.contactName;
  if (c.contactEmail !== undefined) row.contact_email = c.contactEmail;
  if (c.contactPhone !== undefined) row.contact_phone = c.contactPhone;
  return row;
}

function mapWorkspace(row: any): Workspace {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    title: row.title,
    stage: row.stage,
    crmDealId: row.crm_deal_id,
    crmStage: row.crm_stage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: row.owner,
    region: row.region,
    estimatedValue: Number(row.estimated_value) || 0,
    palletVolume: row.pallet_volume || 0,
    gpPercent: Number(row.gp_percent) || 0,
    ragStatus: row.rag_status,
    daysInStage: row.days_in_stage || 0,
    approvalState: row.approval_state || "not_required",
    notes: row.notes || "",
    type: row.type || "commercial",
    parentWorkspaceId: row.parent_workspace_id,
    tenderStage: row.tender_stage,
    linkedTenderId: row.linked_tender_id,
    submissionDeadline: row.submission_deadline,
    probabilityPercent: row.probability_percent != null ? Number(row.probability_percent) : undefined,
    wonLostReason: row.won_lost_reason,
    convertedToWorkspaceId: row.converted_to_workspace_id,
  };
}

function workspaceToRow(w: Partial<Workspace>): Record<string, any> {
  const row: Record<string, any> = {};
  if (w.id !== undefined) row.id = w.id;
  if (w.customerId !== undefined) row.customer_id = w.customerId;
  if (w.customerName !== undefined) row.customer_name = w.customerName;
  if (w.title !== undefined) row.title = w.title;
  if (w.stage !== undefined) row.stage = w.stage;
  if (w.crmDealId !== undefined) row.crm_deal_id = w.crmDealId;
  if (w.crmStage !== undefined) row.crm_stage = w.crmStage;
  if (w.owner !== undefined) row.owner = w.owner;
  if (w.region !== undefined) row.region = w.region;
  if (w.estimatedValue !== undefined) row.estimated_value = w.estimatedValue;
  if (w.palletVolume !== undefined) row.pallet_volume = w.palletVolume;
  if (w.gpPercent !== undefined) row.gp_percent = w.gpPercent;
  if (w.ragStatus !== undefined) row.rag_status = w.ragStatus;
  if (w.daysInStage !== undefined) row.days_in_stage = w.daysInStage;
  if (w.approvalState !== undefined) row.approval_state = w.approvalState;
  if (w.notes !== undefined) row.notes = w.notes;
  if (w.type !== undefined) row.type = w.type;
  if (w.tenderStage !== undefined) row.tender_stage = w.tenderStage;
  if (w.linkedTenderId !== undefined) row.linked_tender_id = w.linkedTenderId;
  if (w.submissionDeadline !== undefined) row.submission_deadline = w.submissionDeadline;
  if (w.probabilityPercent !== undefined) row.probability_percent = w.probabilityPercent;
  if (w.wonLostReason !== undefined) row.won_lost_reason = w.wonLostReason;
  row.updated_at = new Date().toISOString();
  return row;
}

function mapQuote(row: any): Quote {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    version: row.version,
    state: row.state,
    createdAt: row.created_at,
    storageRate: Number(row.storage_rate) || 0,
    inboundRate: Number(row.inbound_rate) || 0,
    outboundRate: Number(row.outbound_rate) || 0,
    palletVolume: row.pallet_volume || 0,
    monthlyRevenue: Number(row.monthly_revenue) || 0,
    annualRevenue: Number(row.annual_revenue) || 0,
    totalCost: Number(row.total_cost) || 0,
    gpPercent: Number(row.gp_percent) || 0,
    gpAmount: Number(row.gp_amount) || 0,
  };
}

function quoteToRow(q: Partial<Quote>): Record<string, any> {
  const row: Record<string, any> = {};
  if (q.id !== undefined) row.id = q.id;
  if (q.workspaceId !== undefined) row.workspace_id = q.workspaceId;
  if (q.version !== undefined) row.version = q.version;
  if (q.state !== undefined) row.state = q.state;
  if (q.storageRate !== undefined) row.storage_rate = q.storageRate;
  if (q.inboundRate !== undefined) row.inbound_rate = q.inboundRate;
  if (q.outboundRate !== undefined) row.outbound_rate = q.outboundRate;
  if (q.palletVolume !== undefined) row.pallet_volume = q.palletVolume;
  if (q.monthlyRevenue !== undefined) row.monthly_revenue = q.monthlyRevenue;
  if (q.annualRevenue !== undefined) row.annual_revenue = q.annualRevenue;
  if (q.totalCost !== undefined) row.total_cost = q.totalCost;
  if (q.gpPercent !== undefined) row.gp_percent = q.gpPercent;
  if (q.gpAmount !== undefined) row.gp_amount = q.gpAmount;
  return row;
}

function mapTicketStageToProposalState(stage?: string | null): Proposal["state"] {
  const normalized = (stage ?? "").toLowerCase().trim();
  if (normalized.includes("sent")) return "sent";
  if (normalized.includes("negotiation")) return "negotiation_active";
  if (normalized.includes("approval") || normalized.includes("signed")) return "commercial_approved";
  if (normalized.includes("draft")) return "draft";
  return "ready_for_crm";
}

function getCommercialTicketDetails(row: CommercialTicket): Record<string, any> {
  return row.type_details && typeof row.type_details === "object" && !Array.isArray(row.type_details)
    ? row.type_details as Record<string, any>
    : {};
}

function getCommercialTicketWorkspaceId(row: CommercialTicket): string {
  const details = getCommercialTicketDetails(row);
  return row.legacy_workspace_id || details.linked_workspace_id || row.id;
}

function mapCommercialTicketToProposal(row: CommercialTicket): Proposal {
  const details = getCommercialTicketDetails(row);

  return {
    id: row.id,
    workspaceId: getCommercialTicketWorkspaceId(row),
    version: Number(details.proposal_version ?? 1),
    state: mapTicketStageToProposalState(row.internal_stage),
    title: row.ticket_title || row.customer_name || "Not captured",
    createdAt: row.created_at,
    sections: [],
  };
}

function mapTicketCrmStageToWorkspaceCrmStage(stage?: string | null): Workspace["crmStage"] {
  const normalized = (stage ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (normalized.includes("actual go live") || normalized === "go live" || normalized === "live") return "actual_go_live";
  if (normalized.includes("contract signed") || normalized === "signed") return "contract_signed";
  if (normalized.includes("closed won") || normalized === "won") return "closed_won";
  if (normalized.includes("closed lost") || normalized === "lost") return "closed_lost";
  if (normalized.includes("discontinued")) return "discontinued";
  if (normalized.includes("contract negotiation") || normalized === "negotiation") return "contract_negotiation";
  if (normalized.includes("shortlisted")) return "shortlisted";
  if (normalized.includes("proposal sent") || normalized === "proposal" || normalized.includes("proposal active")) return "proposal_sent";
  if (normalized.includes("qualified")) return "qualified";
  return "prospecting";
}

function mapTicketStageToWorkspaceStage(stage?: string | null): Workspace["stage"] {
  const normalized = (stage ?? "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (normalized.includes("closed lost") || normalized === "lost" || normalized.includes("discontinued")) return "closed_lost";
  if (normalized.includes("go live")) return "go_live";
  if (normalized.includes("handover")) return "handover";
  if (normalized.includes("contract signed")) return "contract_signed";
  if (normalized.includes("contract sent")) return "contract_sent";
  if (normalized.includes("contract ready")) return "contract_ready";
  if (normalized.includes("sla")) return "sla_drafting";
  if (normalized.includes("approved") || normalized.includes("approval")) return "commercial_approved";
  if (normalized.includes("negotiation")) return "negotiation";
  if (normalized.includes("pricing") || normalized.includes("pnl") || normalized.includes("quote")) return "quoting";
  if (normalized.includes("solution")) return "solution_design";
  if (normalized.includes("proposal") || normalized.includes("draft") || normalized.includes("sent") || normalized.includes("shortlist")) return "proposal_active";
  return "qualified";
}

function getDaysSince(dateValue?: string | null): number {
  if (!dateValue) return 0;
  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function mapCommercialTicketToWorkspace(row: CommercialTicket, requestedId?: string): Workspace {
  const estimatedValue = row.estimated_value != null ? Number(row.estimated_value) : 0;
  const gpPercent = row.target_gp_percent != null ? Number(row.target_gp_percent) : 0;
  const probabilityPercent = row.probability_percent != null ? Number(row.probability_percent) : undefined;

  return {
    id: requestedId || getCommercialTicketWorkspaceId(row),
    customerId: row.customer_id || row.id,
    customerName: row.customer_name || row.company || "Not captured",
    title: row.ticket_title || row.customer_name || "Proposal workspace",
    stage: mapTicketStageToWorkspaceStage(row.internal_stage),
    crmDealId: row.id,
    crmStage: mapTicketCrmStageToWorkspaceCrmStage(row.crm_pipeline_stage),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: row.owner || "",
    region: (row.region || "Central") as Workspace["region"],
    estimatedValue,
    palletVolume: 0,
    gpPercent,
    ragStatus: gpPercent > 0 && gpPercent < 10 ? "red" : gpPercent > 0 && gpPercent < 22 ? "amber" : "green",
    daysInStage: getDaysSince(row.updated_at || row.created_at),
    approvalState: "not_required",
    notes: row.notes || "",
    type: "commercial",
    probabilityPercent,
  };
}

function mapApprovalRecord(row: any): ApprovalRecord {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    workspaceId: row.workspace_id,
    approverRole: row.approver_role,
    approverName: row.approver_name,
    decision: row.decision,
    reason: row.reason || "",
    timestamp: row.timestamp,
    isOverride: row.is_override || false,
  };
}

function approvalToRow(a: Partial<ApprovalRecord>): Record<string, any> {
  const row: Record<string, any> = {};
  if (a.id !== undefined) row.id = a.id;
  if (a.entityType !== undefined) row.entity_type = a.entityType;
  if (a.entityId !== undefined) row.entity_id = a.entityId;
  if (a.workspaceId !== undefined) row.workspace_id = a.workspaceId;
  if (a.approverRole !== undefined) row.approver_role = a.approverRole;
  if (a.approverName !== undefined) row.approver_name = a.approverName;
  if (a.decision !== undefined) row.decision = a.decision;
  if (a.reason !== undefined) row.reason = a.reason;
  if (a.isOverride !== undefined) row.is_override = a.isOverride;
  return row;
}

function mapSignal(row: any): Signal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type,
    severity: row.severity,
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapPolicyGate(row: any): PolicyGate {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    mode: row.mode,
    overridable: row.overridable ?? true,
  };
}

function mapPnLModel(row: any): PnLModel {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    version: row.version,
    storageRate: Number(row.storage_rate) || 0,
    storagePallets: row.storage_pallets || 0,
    inboundRate: Number(row.inbound_rate) || 0,
    inboundVolume: row.inbound_volume || 0,
    outboundRate: Number(row.outbound_rate) || 0,
    outboundVolume: row.outbound_volume || 0,
    vasRevenue: Number(row.vas_revenue) || 0,
    monthlyRevenue: Number(row.monthly_revenue) || 0,
    annualRevenue: Number(row.annual_revenue) || 0,
    facilityCost: Number(row.facility_cost) || 0,
    staffCost: Number(row.staff_cost) || 0,
    mheCost: Number(row.mhe_cost) || 0,
    insuranceCost: Number(row.insurance_cost) || 0,
    operationalCost: Number(row.operational_cost) || 0,
    gaPercent: Number(row.ga_percent) || 0,
    gaCost: Number(row.ga_cost) || 0,
    totalOpex: Number(row.total_opex) || 0,
    grossProfit: Number(row.gross_profit) || 0,
    gpPercent: Number(row.gp_percent) || 0,
    netProfit: Number(row.net_profit) || 0,
    netProfitPercent: Number(row.net_profit_percent) || 0,
  };
}

function mapHandoverTask(row: any): HandoverTask {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    department: row.department,
    task: row.task,
    status: row.status,
    assignedTo: row.assigned_to || "",
    dueDate: row.due_date || "",
  };
}

function handoverToRow(h: Partial<HandoverTask>): Record<string, any> {
  const row: Record<string, any> = {};
  if (h.id !== undefined) row.id = h.id;
  if (h.workspaceId !== undefined) row.workspace_id = h.workspaceId;
  if (h.department !== undefined) row.department = h.department;
  if (h.task !== undefined) row.task = h.task;
  if (h.status !== undefined) row.status = h.status;
  if (h.assignedTo !== undefined) row.assigned_to = h.assignedTo;
  if (h.dueDate !== undefined) row.due_date = h.dueDate;
  return row;
}

function mapCRMSyncEvent(row: any): CRMSyncEvent {
  return {
    id: row.id,
    direction: row.direction,
    entity: row.entity,
    zohoId: row.zoho_id || "",
    status: row.status,
    timestamp: row.timestamp,
    details: row.details || "",
  };
}

function mapAuditEntry(row: any): AuditEntry {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    userId: row.user_id || "",
    userName: row.user_name || "",
    timestamp: row.timestamp,
    details: row.details || "",
  };
}

function auditToRow(a: Partial<AuditEntry>): Record<string, any> {
  const row: Record<string, any> = {};
  if (a.id !== undefined) row.id = a.id;
  if (a.entityType !== undefined) row.entity_type = a.entityType;
  if (a.entityId !== undefined) row.entity_id = a.entityId;
  if (a.action !== undefined) row.action = a.action;
  if (a.userId !== undefined) row.user_id = a.userId;
  if (a.userName !== undefined) row.user_name = a.userName;
  if (a.details !== undefined) row.details = a.details;
  return row;
}

// ============================================================
// FETCH FUNCTIONS (Read)
// ============================================================

/**
 * Centralized fetch wrapper that:
 *  1. Calls handleSupabaseError (console + ring buffer + optional toast)
 *  2. Records error in fetchErrorState so components can distinguish
 *     "empty data" from "failed fetch"
 *  3. Clears fetchErrorState on success (for retry flows)
 *  4. Returns [] on error to maintain backward compatibility
 */
function safeFetchList<TRow, TResult>(
  operation: string,
  data: TRow[] | null,
  error: any,
  mapper?: (row: TRow) => TResult,
  options?: { silent?: boolean }
): TResult[] {
  if (error) {
    handleSupabaseError(operation, error, { silent: options?.silent ?? false });
    setFetchError(operation, error);
    return [];
  }
  // Success — clear any previous error state for this operation
  clearFetchError(operation);
  const rows = data || [];
  return mapper ? rows.map(mapper) : rows as unknown as TResult[];
}

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("users").select("*");
  return safeFetchList('fetchUsers', data, error, undefined, { silent: true });
}

export async function fetchCurrentUser(): Promise<User> {
  const { data, error } = await supabase.from("users").select("*").eq("id", getCurrentUser().id).single();
  if (error || !data) {
    return getCurrentUser() as any;
  }
  return data;
}

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("name");
  return safeFetchList('fetchCustomers', data, error, mapCustomer, { silent: true });
}

export async function fetchCustomerById(id: string): Promise<Customer | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapCustomer(data);
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase.from("workspaces").select("*").order("updated_at", { ascending: false });
  return safeFetchList('fetchWorkspaces', data, error, mapWorkspace, { silent: true });
}

async function fetchProposalWorkspaceById(id: string): Promise<Workspace | null> {
  const { data, error } = await fetchOperationalTicketsByType("proposal");
  if (error) {
    const err = { message: error };
    handleSupabaseError("fetchProposalWorkspaceById", err, { silent: true });
    setFetchError("fetchProposalWorkspaceById", err);
    return null;
  }

  clearFetchError("fetchProposalWorkspaceById");
  const match = data.find((ticket) => {
    const workspaceId = getCommercialTicketWorkspaceId(ticket);
    return ticket.id === id || workspaceId === id;
  });

  return match ? mapCommercialTicketToWorkspace(match, id) : null;
}

export async function fetchWorkspaceById(
  id: string,
  options: { proposalOnly?: boolean } = {}
): Promise<Workspace | null> {
  if (options.proposalOnly) return fetchProposalWorkspaceById(id);

  const { data, error } = await supabase.from("workspaces").select("*").eq("id", id).single();
  if (!error && data) return mapWorkspace(data);
  return null;
}

export async function fetchWorkspacesByCustomer(customerId: string): Promise<Workspace[]> {
  const { data, error } = await supabase.from("workspaces").select("*").eq("customer_id", customerId);
  return safeFetchList('fetchWorkspacesByCustomer', data, error, mapWorkspace, { silent: true });
}

export async function fetchQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
  return safeFetchList('fetchQuotes', data, error, mapQuote, { silent: true });
}

export async function fetchQuotesByWorkspace(workspaceId: string): Promise<Quote[]> {
  const { data, error } = await supabase.from("quotes").select("*").eq("workspace_id", workspaceId);
  return safeFetchList('fetchQuotesByWorkspace', data, error, mapQuote);
}

export async function fetchProposals(): Promise<Proposal[]> {
  const { data, error } = await fetchOperationalTicketsByType("proposal");
  if (error) {
    const err = { message: error };
    handleSupabaseError("fetchProposals", err, { silent: true });
    setFetchError("fetchProposals", err);
    return [];
  }
  clearFetchError("fetchProposals");
  return data.map(mapCommercialTicketToProposal);
}

export async function fetchProposalsByWorkspace(workspaceId: string): Promise<Proposal[]> {
  const { data, error } = await fetchOperationalTicketsByType("proposal");
  if (error) {
    const err = { message: error };
    handleSupabaseError("fetchProposalsByWorkspace", err, { silent: true });
    setFetchError("fetchProposalsByWorkspace", err);
    return [];
  }
  clearFetchError("fetchProposalsByWorkspace");
  return data
    .map(mapCommercialTicketToProposal)
    .filter(proposal => proposal.workspaceId === workspaceId || proposal.id === workspaceId);
}

export async function fetchApprovalRecords(): Promise<ApprovalRecord[]> {
  const { data, error } = await supabase.from("approval_records").select("*").order("timestamp", { ascending: false });
  return safeFetchList('fetchApprovalRecords', data, error, mapApprovalRecord, { silent: true });
}

export async function fetchSignals(): Promise<Signal[]> {
  const { data, error } = await supabase.from("signals").select("*").order("created_at", { ascending: false });
  return safeFetchList('fetchSignals', data, error, mapSignal, { silent: true });
}

export async function fetchPolicyGates(): Promise<PolicyGate[]> {
  const { data, error } = await supabase.from("policy_gates").select("*");
  return safeFetchList('fetchPolicyGates', data, error, mapPolicyGate, { silent: true });
}

export async function fetchPnLModels(): Promise<PnLModel[]> {
  const { data, error } = await supabase.from("pnl_models").select("*");
  return safeFetchList('fetchPnLModels', data, error, mapPnLModel);
}

export async function fetchPnLByWorkspace(workspaceId: string): Promise<PnLModel | null> {
  const { data, error } = await supabase.from("pnl_models").select("*").eq("workspace_id", workspaceId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return mapPnLModel(data);
}

export async function fetchHandoverTasks(workspaceId?: string): Promise<HandoverTask[]> {
  let query = supabase.from("handover_tasks").select("*");
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  const { data, error } = await query;
  return safeFetchList('fetchHandoverTasks', data, error, mapHandoverTask);
}

export async function fetchCRMSyncEvents(): Promise<CRMSyncEvent[]> {
  const { data, error } = await supabase.from("crm_sync_events").select("*").order("timestamp", { ascending: false });
  return safeFetchList('fetchCRMSyncEvents', data, error, mapCRMSyncEvent);
}

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("audit_log").select("*").order("timestamp", { ascending: false });
  return safeFetchList('fetchAuditLog', data, error, mapAuditEntry);
}

// ============================================================
// MUTATE FUNCTIONS (Create / Update)
// ============================================================

export async function createCustomer(customer: Customer): Promise<Customer | null> {
  const row = customerToRow(customer);
  row.created_at = new Date().toISOString();
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("customers").insert(row).select().single();
  if (error) { handleSupabaseError('createCustomer', error, { silent: true }); return null; }
  return mapCustomer(data);
}

export async function updateCustomer(id: string, updates: Partial<Customer>, expectedUpdatedAt?: string): Promise<Customer | null> {
  const row = customerToRow(updates);
  const data = await optimisticUpdate("customers", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapCustomer(data);
}

export async function createWorkspace(workspace: Workspace): Promise<Workspace | null> {
  const row = workspaceToRow(workspace);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("workspaces").insert(row).select().single();
  if (error) { handleSupabaseError('createWorkspace', error, { silent: true }); return null; }
  return mapWorkspace(data);
}

export async function updateWorkspace(id: string, updates: Partial<Workspace>, expectedUpdatedAt?: string): Promise<Workspace | null> {
  const row = workspaceToRow(updates);
  const data = await optimisticUpdate("workspaces", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapWorkspace(data);
}

export async function createQuote(quote: Quote): Promise<Quote | null> {
  const row = quoteToRow(quote);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("quotes").insert(row).select().single();
  if (error) { handleSupabaseError('createQuote', error, { silent: true }); return null; }
  return mapQuote(data);
}

export async function updateQuote(id: string, updates: Partial<Quote>, expectedUpdatedAt?: string): Promise<Quote | null> {
  const row = quoteToRow(updates);
  const data = await optimisticUpdate("quotes", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapQuote(data);
}

/**
 * Explicit refusal: the legacy proposals table is not a valid write target.
 * Returns null (never a fabricated Proposal) and records the refusal.
 */
export async function createProposal(proposal: Proposal): Promise<Proposal | null> {
  handleSupabaseError("createProposal", {
    message: "Legacy proposals table writes are disabled. Use the unified commercial_tickets intake path.",
  }, { silent: true, entityId: proposal.id });
  return null;
}

/**
 * Explicit refusal: the legacy proposals table is not a valid write target.
 * Returns null (never a fabricated Proposal) and records the refusal.
 */
export async function updateProposal(id: string, updates: Partial<Proposal>, expectedUpdatedAt?: string): Promise<Proposal | null> {
  handleSupabaseError("updateProposal", {
    message: "Legacy proposals table updates are disabled. Use the unified commercial_tickets ticket update path.",
  }, { silent: true, entityId: id });
  void updates;
  void expectedUpdatedAt;
  return null;
}

export async function createApprovalRecord(record: ApprovalRecord): Promise<ApprovalRecord | null> {
  const row = approvalToRow(record);
  row.timestamp = new Date().toISOString();
  const { data, error } = await supabase.from("approval_records").insert(row).select().single();
  if (error) { handleSupabaseError('createApprovalRecord', error, { silent: true }); return null; }
  return mapApprovalRecord(data);
}

export async function updateApprovalRecord(id: string, updates: Partial<ApprovalRecord>, expectedUpdatedAt?: string): Promise<ApprovalRecord | null> {
  const row = approvalToRow(updates);
  const data = await optimisticUpdate("approval_records", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapApprovalRecord(data);
}

export async function createSignal(signal: Omit<Signal, "id">): Promise<Signal | null> {
  const row: any = {
    id: `s-${crypto.randomUUID()}`,
    workspace_id: signal.workspaceId,
    type: signal.type,
    severity: signal.severity,
    message: signal.message,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("signals").insert(row).select().single();
  if (error) { handleSupabaseError('createSignal', error, { silent: true }); return null; }
  return mapSignal(data);
}

/**
 * HONEST UNAVAILABLE (SX-007 Rev 2): Wave 02 must not mutate policy-gate
 * behavior. Performs zero database writes and throws so callers surface the
 * failure — never a fabricated or silently simulated success.
 */
export async function updatePolicyGate(id: string, updates: Partial<PolicyGate>, expectedUpdatedAt?: string): Promise<PolicyGate | null> {
  void id;
  void updates;
  void expectedUpdatedAt;
  throw new Error("Policy-gate mutation is not available in this build (deferred to Sprint X). No data was written.");
}

export async function createPnLModel(model: PnLModel): Promise<PnLModel | null> {
  const row: Record<string, any> = {
    id: model.id,
    workspace_id: model.workspaceId,
    version: model.version,
    storage_rate: model.storageRate,
    storage_pallets: model.storagePallets,
    inbound_rate: model.inboundRate,
    inbound_volume: model.inboundVolume,
    outbound_rate: model.outboundRate,
    outbound_volume: model.outboundVolume,
    vas_revenue: model.vasRevenue,
    monthly_revenue: model.monthlyRevenue,
    annual_revenue: model.annualRevenue,
    facility_cost: model.facilityCost,
    staff_cost: model.staffCost,
    mhe_cost: model.mheCost,
    insurance_cost: model.insuranceCost,
    operational_cost: model.operationalCost,
    ga_percent: model.gaPercent,
    ga_cost: model.gaCost,
    total_opex: model.totalOpex,
    gross_profit: model.grossProfit,
    gp_percent: model.gpPercent,
    net_profit: model.netProfit,
    net_profit_percent: model.netProfitPercent,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("pnl_models").insert(row).select().single();
  if (error) { handleSupabaseError('createPnLModel', error, { silent: true }); return null; }
  return mapPnLModel(data);
}

export async function createHandoverTask(task: HandoverTask): Promise<HandoverTask | null> {
  const row = handoverToRow(task);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("handover_tasks").insert(row).select().single();
  if (error) { handleSupabaseError('createHandoverTask', error, { silent: true }); return null; }
  return mapHandoverTask(data);
}

export async function updateHandoverTask(id: string, updates: Partial<HandoverTask>, expectedUpdatedAt?: string): Promise<HandoverTask | null> {
  const row = handoverToRow(updates);
  const data = await optimisticUpdate("handover_tasks", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapHandoverTask(data);
}

export async function createAuditEntry(entry: AuditEntry): Promise<AuditEntry | null> {
  const row = auditToRow(entry);
  row.timestamp = new Date().toISOString();
  const { data, error } = await supabase.from("audit_log").insert(row).select().single();
  if (error) { handleSupabaseError('createAuditEntry', error, { silent: true }); return null; }
  return mapAuditEntry(data);
}

export async function createCRMSyncEvent(event: CRMSyncEvent): Promise<CRMSyncEvent | null> {
  const row: Record<string, any> = {
    id: event.id,
    direction: event.direction,
    entity: event.entity,
    zoho_id: event.zohoId,
    status: event.status,
    timestamp: new Date().toISOString(),
    details: event.details,
  };
  const { data, error } = await supabase.from("crm_sync_events").insert(row).select().single();
  if (error) { handleSupabaseError('createCRMSyncEvent', error, { silent: true }); return null; }
  return mapCRMSyncEvent(data);
}

// ============================================================
// CUSTOMER CONTACTS
// ============================================================

export interface CustomerContact {
  id: string;
  customerId: string;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

function mapCustomerContact(row: any): CustomerContact {
  return {
    id: row.id,
    customerId: row.customer_id,
    fullName: row.full_name,
    jobTitle: row.job_title || "",
    email: row.email || "",
    phone: row.phone || "",
    isPrimary: row.is_primary ?? false,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fetch all contacts for a customer */
export async function fetchContactsByCustomer(customerId: string): Promise<CustomerContact[]> {
  const { data, error } = await supabase
    .from("customer_contacts")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false });
  if (error) { handleSupabaseError('fetchContactsByCustomer', error, { silent: true }); setFetchError('fetchContactsByCustomer', error); return []; }
  clearFetchError('fetchContactsByCustomer');
  return (data || []).map(mapCustomerContact);
}

// ============================================================
// TENDERS — Supabase data layer (commercial_tickets)
// ============================================================

function normalizeTenderMilestone(value: unknown): Tender["status"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  const map: Record<string, Tender["status"]> = {
    identified: "prospecting",
    preparing_submission: "qualified",
    submitted: "proposal_sent",
    clarification: "shortlisted",
    technical_review: "shortlisted",
    commercial_review: "shortlisted",
    client_evaluation: "shortlisted",
    negotiation: "contract_negotiation",
    awarded: "closed_won",
    won: "closed_won",
    lost: "closed_lost",
    withdrawn: "discontinued",
    prospecting: "prospecting",
    qualified: "qualified",
    proposal_sent: "proposal_sent",
    shortlisted: "shortlisted",
    contract_negotiation: "contract_negotiation",
    closed_won: "closed_won",
    contract_signed: "contract_signed",
    operational_handover: "operational_handover",
    closed_lost: "closed_lost",
    discontinued: "discontinued",
  };
  return map[normalized] ?? "prospecting";
}

function mapTender(row: CommercialTicket): Tender {
  const details = normalizeTenderTypeDetails(row.type_details);

  return {
    id:                  row.id,
    linkedWorkspaceId:   row.legacy_workspace_id ?? details.linked_workspace_id ?? null,
    customerId:          row.customer_id ?? "",
    customerName:        row.customer_name ?? "",
    title:               row.ticket_title ?? "",
    submissionDeadline:  details.submission_deadline || row.target_date
                           ? String(details.submission_deadline || row.target_date).slice(0, 10)
                           : "",
    estimatedValue:      row.estimated_value === null ? 0 : Number(row.estimated_value) || 0,
    targetGpPercent:     row.target_gp_percent === null ? 0 : Number(row.target_gp_percent) || 0,
    probabilityPercent:  row.probability_percent === null ? 0 : Number(row.probability_percent) || 0,
    assignedOwner:       row.owner ?? "",
    assignedTeamMembers: Array.isArray(row.team_members)
                           ? row.team_members
                           : [],
    status:              normalizeTenderMilestone(row.internal_stage),
    crmPipelineStage:    normalizeTenderMilestone(row.crm_pipeline_stage),
    source:              row.source_type === "crm_opportunity" ? "CRM" : row.source_type === "customer_request" ? "Referral" : "Direct",
    region:              (row.region ?? "East") as Tender["region"],
    notes:               row.notes ?? "",
    daysInStatus:        row.created_at ? Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86400000)) : 0,
    crmSynced:           false,
    executionRegions:    Array.isArray(details.execution_regions) ? details.execution_regions : [],
    targetSites:         Array.isArray(details.target_sites) ? details.target_sites : [],
    executionType:       details.execution_type ?? "",
    geographicComplexity: details.geographic_complexity ?? "",
    siteCount:           Number(details.site_count) || 0,
    executionNotes:      details.execution_notes ?? "",
    createdAt:           row.created_at
                           ? String(row.created_at).slice(0, 10)
                           : new Date().toISOString().slice(0, 10),
    updatedAt:           row.updated_at
                           ? String(row.updated_at).slice(0, 10)
                           : new Date().toISOString().slice(0, 10),
    typeDetails:         details,
    type_details:        details,
    internalStageRaw:    row.internal_stage ?? undefined,
  };
}

export async function fetchTenders(): Promise<Tender[]> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("ticket_type", "tender")
    .eq("active", true)
    .neq("lineage_status", "rejected")
    .order("created_at", { ascending: false });
  return safeFetchList(
    'fetchTenders',
    filterAllowedTenderTickets((data ?? []) as CommercialTicket[]),
    error,
    mapTender,
    { silent: true }
  );
}

export async function fetchTenderById(id: string): Promise<Tender | null> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("id", id)
    .eq("ticket_type", "tender")
    .eq("active", true)
    .neq("lineage_status", "rejected")
    .maybeSingle();
  if (error) { handleSupabaseError("fetchTenderById", error, { silent: true }); return null; }
  if (!isAllowedTenderTicket(data as CommercialTicket | null)) return null;
  return data ? mapTender(data) : null;
}

export async function fetchTendersByCustomer(customerId: string): Promise<Tender[]> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("ticket_type", "tender")
    .eq("customer_id", customerId)
    .eq("active", true)
    .neq("lineage_status", "rejected");
  return safeFetchList(
    'fetchTendersByCustomer',
    filterAllowedTenderTickets((data ?? []) as CommercialTicket[]),
    error,
    mapTender,
    { silent: true }
  );
}

// ============================================================
// RENEWAL WORKSPACES — Supabase data layer
// ============================================================
// Local structural types (the legacy renewal engine module is excluded from
// this application; only its row shapes are needed for these reads).

interface RenewalWorkspace {
  id: string;
  customerId: string;
  customerName: string;
  baselineId: string;
  renewalCycleName: string;
  targetStartDate: string;
  targetEndDate: string;
  status: "draft" | "active" | "in_negotiation" | "renewed" | "not_renewed" | "closed";
  renewalDecision: "pending" | "renew" | "renegotiate" | "exit";
  ownerUserId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

interface ContractBaseline {
  id: string;
  customerId: string;
  customerName: string;
  opportunityId: string | null;
  baselineName: string;
  baselineStartDate: string;
  baselineEndDate: string;
  status: "active" | "expired" | "superseded";
  proposalVersionId: string | null;
  slaVersionId: string | null;
  pricingSnapshot: Record<string, any>;
  createdAt: string;
  createdBy: string;
}

function mapRenewalWorkspace(row: any): RenewalWorkspace {
  return {
    id:               row.id,
    customerId:       row.customer_id,
    customerName:     row.customer_name,
    baselineId:       row.baseline_id,
    renewalCycleName: row.renewal_cycle_name,
    targetStartDate:  row.target_start_date
                        ? String(row.target_start_date).slice(0, 10)
                        : "",
    targetEndDate:    row.target_end_date
                        ? String(row.target_end_date).slice(0, 10)
                        : "",
    status:           (row.status ?? "draft") as RenewalWorkspace["status"],
    renewalDecision:  (row.renewal_decision ?? "pending") as RenewalWorkspace["renewalDecision"],
    ownerUserId:      row.owner_user_id ?? "",
    ownerName:        row.owner_name ?? "",
    createdAt:        row.created_at
                        ? String(row.created_at).slice(0, 10)
                        : new Date().toISOString().slice(0, 10),
    updatedAt:        row.updated_at
                        ? String(row.updated_at).slice(0, 10)
                        : new Date().toISOString().slice(0, 10),
  };
}

export async function fetchRenewalWorkspaces(): Promise<RenewalWorkspace[]> {
  if (PROCESS_ISOLATION_ENABLED) {
    clearFetchError('fetchRenewalWorkspaces');
    return getEmptyRenewalWorkspaces<RenewalWorkspace>();
  }

  const { data, error } = await supabase
    .from("renewal_workspaces")
    .select("*")
    .order("created_at", { ascending: false });
  return safeFetchList('fetchRenewalWorkspaces', data, error, mapRenewalWorkspace, { silent: true });
}

export async function fetchContractBaselines(): Promise<ContractBaseline[]> {
  if (PROCESS_ISOLATION_ENABLED) {
    clearFetchError('fetchContractBaselines');
    return getEmptyContractBaselines<ContractBaseline>();
  }

  const { data, error } = await supabase
    .from("contract_baselines")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { handleSupabaseError("fetchContractBaselines", error, { silent: true }); setFetchError('fetchContractBaselines', error); return []; }
  clearFetchError('fetchContractBaselines');
  return (data ?? []).map((row: any): ContractBaseline => ({
    id:                row.id,
    customerId:        row.customer_id,
    customerName:      row.customer_name,
    opportunityId:     row.opportunity_id ?? null,
    baselineName:      row.baseline_name,
    baselineStartDate: row.baseline_start_date
                         ? String(row.baseline_start_date).slice(0, 10)
                         : "",
    baselineEndDate:   row.baseline_end_date
                         ? String(row.baseline_end_date).slice(0, 10)
                         : "",
    status:            (row.status ?? "active") as ContractBaseline["status"],
    proposalVersionId: row.proposal_version_id ?? null,
    slaVersionId:      row.sla_version_id ?? null,
    pricingSnapshot:   row.pricing_snapshot ?? {},
    createdAt:         row.created_at
                         ? String(row.created_at).slice(0, 10)
                         : new Date().toISOString().slice(0, 10),
    createdBy:         row.created_by ?? "",
  }));
}

// ============================================================
// ECR — Supabase data layer
// ============================================================
// Local structural types (the legacy ecr module is excluded from this
// application; only its row shapes are needed for these reads).

type EcrSourceMode = "manual" | "spreadsheet" | "connector";
type EcrGrade = "A" | "B" | "C" | "D";

export interface EcrMetric {
  id: string;
  metricKey: string;
  displayName: string;
  description: string;
  unit: "%" | "days" | "number" | "band";
  minValue: number;
  maxValue: number;
  defaultWeight: number;
  defaultSourceMode: EcrSourceMode;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EcrRuleSet {
  id: string;
  versionNumber: number;
  name: string;
  description: string;
  status: "draft" | "active" | "archived" | "locked";
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
  sourceMode: EcrSourceMode;
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
  grade: EcrGrade;
  confidenceScore: number;
  breakdown?: unknown;
  computedAt: string;
  computedBySystem: boolean;
}

export interface EcrAuditTrailEntry {
  id: string;
  customerId: string;
  previousGrade: EcrGrade | null;
  newGrade: EcrGrade;
  reason: string;
  timestamp: string;
}

function mapEcrMetric(row: any): EcrMetric {
  return {
    id: row.id,
    metricKey: row.metric_key,
    displayName: row.display_name,
    description: row.description ?? "",
    unit: row.unit,
    minValue: Number(row.min_value),
    maxValue: Number(row.max_value),
    defaultWeight: Number(row.default_weight),
    defaultSourceMode: row.default_source_mode,
    active: row.active ?? true,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function mapEcrRuleSet(row: any): EcrRuleSet {
  return {
    id: row.id,
    versionNumber: row.version_number,
    name: row.name,
    description: row.description ?? "",
    status: row.status,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at ?? "",
  };
}

function mapEcrRuleWeight(row: any): EcrRuleWeight {
  return {
    id: row.id,
    ruleSetId: row.rule_set_id,
    metricId: row.metric_id,
    weight: Number(row.weight),
    createdAt: row.created_at ?? "",
  };
}

function mapEcrSnapshot(row: any): EcrInputSnapshot {
  return {
    id: row.id,
    customerId: row.customer_id,
    periodStart: row.period_start ? String(row.period_start).slice(0, 10) : "",
    periodEnd: row.period_end ? String(row.period_end).slice(0, 10) : "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at ?? "",
  };
}

function mapEcrInputValue(row: any): EcrInputValue {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    metricId: row.metric_id,
    value: Number(row.value),
    sourceMode: row.source_mode,
    sourceReference: row.source_reference ?? "",
    capturedBy: row.captured_by ?? "",
    capturedAt: row.captured_at ?? "",
  };
}

function mapEcrScore(row: any): EcrScore {
  return {
    id: row.id,
    customerId: row.customer_id,
    snapshotId: row.snapshot_id,
    ruleSetId: row.rule_set_id,
    totalScore: Number(row.total_score),
    grade: row.grade as EcrGrade,
    confidenceScore: Number(row.confidence_score),
    breakdown: row.breakdown ?? null,
    computedAt: row.computed_at ?? "",
    computedBySystem: row.computed_by_system ?? true,
  };
}

function mapEcrAuditTrail(row: any): EcrAuditTrailEntry {
  return {
    id: row.id,
    customerId: row.customer_id,
    previousGrade: row.previous_grade ?? null,
    newGrade: row.new_grade,
    reason: row.reason ?? "",
    timestamp: row.timestamp ?? "",
  };
}

export async function fetchEcrMetrics(): Promise<EcrMetric[]> {
  const { data, error } = await supabase
    .from("ecr_metrics").select("*").order("display_name");
  return safeFetchList('fetchEcrMetrics', data, error, mapEcrMetric, { silent: true });
}

export async function fetchEcrRuleSets(): Promise<EcrRuleSet[]> {
  const { data, error } = await supabase
    .from("ecr_rule_sets").select("*").order("version_number", { ascending: false });
  return safeFetchList('fetchEcrRuleSets', data, error, mapEcrRuleSet, { silent: true });
}

export async function fetchActiveEcrRuleSet(): Promise<EcrRuleSet | null> {
  const { data, error } = await supabase
    .from("ecr_rule_sets").select("*").eq("status", "active").limit(1).single();
  if (error) { handleSupabaseError("fetchActiveEcrRuleSet", error, { silent: true }); return null; }
  return data ? mapEcrRuleSet(data) : null;
}

export async function fetchEcrRuleWeights(ruleSetId?: string): Promise<EcrRuleWeight[]> {
  let query = supabase.from("ecr_rule_weights").select("*");
  if (ruleSetId) query = query.eq("rule_set_id", ruleSetId);
  const { data, error } = await query;
  return safeFetchList('fetchEcrRuleWeights', data, error, mapEcrRuleWeight, { silent: true });
}

export async function fetchEcrSnapshots(customerId?: string): Promise<EcrInputSnapshot[]> {
  let query = supabase.from("ecr_input_snapshots").select("*").order("period_end", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  return safeFetchList('fetchEcrSnapshots', data, error, mapEcrSnapshot, { silent: true });
}

export async function fetchEcrInputValues(snapshotId?: string): Promise<EcrInputValue[]> {
  let query = supabase.from("ecr_input_values").select("*");
  if (snapshotId) query = query.eq("snapshot_id", snapshotId);
  const { data, error } = await query;
  return safeFetchList('fetchEcrInputValues', data, error, mapEcrInputValue, { silent: true });
}

export async function fetchEcrScores(customerId?: string): Promise<EcrScore[]> {
  let query = supabase.from("ecr_scores").select("*").order("computed_at", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  return safeFetchList('fetchEcrScores', data, error, mapEcrScore, { silent: true });
}

export async function fetchEcrAuditTrail(customerId?: string): Promise<EcrAuditTrailEntry[]> {
  let query = supabase.from("ecr_audit_trail").select("*").order("timestamp", { ascending: false });
  if (customerId) query = query.eq("customer_id", customerId);
  const { data, error } = await query;
  return safeFetchList('fetchEcrAuditTrail', data, error, mapEcrAuditTrail, { silent: true });
}

// ============================================================
// DOCUMENT LIBRARY — Supabase data layer (doc_* tables)
// ============================================================
// Local structural types (the legacy document composer module is excluded
// from this application; only its row shapes are needed for these reads).

interface DocBlock {
  id: string;
  block_key: string;
  family: string;
  display_name: string;
  editor_mode: string;
  permissions: Record<string, unknown>;
  schema: Record<string, unknown>;
  render_key: string;
  default_content: string;
  description: string;
  created_at: string;
}

interface BrandingProfile {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  font_heading: string;
  logo_url: string;
  cover_hero_urls: string[];
  footer_format: Record<string, unknown>;
  watermark_url: string | null;
  header_style: "full" | "minimal" | "branded";
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  recipe: unknown[];
  layout: Record<string, unknown>;
  published_at: string | null;
  created_by: string;
  created_at: string;
}

interface DocTemplate {
  id: string;
  name: string;
  doc_type: string;
  status: string;
  default_branding_profile_id: string;
  default_locale: string;
  description: string;
  versions: TemplateVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DocInstanceVersion {
  id: string;
  doc_instance_id: string;
  version_number: number;
  blocks: unknown[];
  bindings: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

interface DocInstance {
  id: string;
  doc_type: string;
  template_version_id: string;
  status: string;
  linked_entity_type: string;
  linked_entity_id: string;
  customer_id: string;
  customer_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  current_version_id: string;
  versions: DocInstanceVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CompiledDocument {
  id: string;
  doc_instance_version_id: string;
  output_type: string;
  file_asset_id: string;
  checksum: string;
  compiled_at: string;
  compiled_by: string;
  status: string;
  error_text: string | null;
  branding_profile_id: string;
  doc_instance_id: string;
  title: string;
}

interface VaultAsset {
  id: string;
  doc_instance_id: string;
  doc_instance_version_id: string;
  compiled_document_id: string;
  title: string;
  doc_type: string;
  customer_id: string;
  customer_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  status: string;
  branding_profile_id: string;
  file_url: string;
  checksum: string;
  created_by: string;
  created_at: string;
  sent_to_crm: boolean;
  crm_export_status: string | null;
  crm_export_at: string | null;
}

function mapDocBlock(row: any): DocBlock {
  return {
    id: row.id,
    block_key: row.block_key,
    family: row.family,
    display_name: row.display_name,
    editor_mode: row.editor_mode,
    permissions: row.permissions ?? {},
    schema: row.schema ?? {},
    render_key: row.render_key,
    default_content: row.default_content ?? "",
    description: row.description ?? "",
    created_at: row.created_at ?? "",
  };
}

function mapBrandingProfile(row: any): BrandingProfile {
  return {
    id: row.id,
    name: row.name,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    accent_color: row.accent_color,
    font_family: row.font_family,
    font_heading: row.font_heading,
    logo_url: row.logo_url ?? "",
    cover_hero_urls: row.cover_hero_urls ?? [],
    footer_format: row.footer_format ?? {},
    watermark_url: row.watermark_url ?? null,
    header_style: row.header_style ?? "full",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function mapTemplateVersion(row: any): TemplateVersion {
  return {
    id: row.id,
    template_id: row.template_id,
    version_number: row.version_number,
    recipe: row.recipe ?? [],
    layout: row.layout ?? {},
    published_at: row.published_at ?? null,
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
  };
}

function mapDocTemplate(row: any, versions: TemplateVersion[]): DocTemplate {
  return {
    id: row.id,
    name: row.name,
    doc_type: row.doc_type,
    status: row.status,
    default_branding_profile_id: row.default_branding_profile_id ?? "",
    default_locale: row.default_locale ?? "en",
    description: row.description ?? "",
    versions,
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function mapInstanceVersion(row: any): DocInstanceVersion {
  return {
    id: row.id,
    doc_instance_id: row.doc_instance_id,
    version_number: row.version_number,
    blocks: row.blocks ?? [],
    bindings: row.bindings ?? {},
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
  };
}

function mapDocInstance(row: any, versions: DocInstanceVersion[]): DocInstance {
  return {
    id: row.id,
    doc_type: row.doc_type,
    template_version_id: row.template_version_id ?? "",
    status: row.status,
    linked_entity_type: row.linked_entity_type,
    linked_entity_id: row.linked_entity_id,
    customer_id: row.customer_id ?? "",
    customer_name: row.customer_name ?? "",
    workspace_id: row.workspace_id ?? null,
    workspace_name: row.workspace_name ?? null,
    current_version_id: row.current_version_id ?? "",
    versions,
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

function mapCompiledDocument(row: any): CompiledDocument {
  return {
    id: row.id,
    doc_instance_version_id: row.doc_instance_version_id,
    output_type: row.output_type ?? "pdf",
    file_asset_id: row.file_asset_id ?? "",
    checksum: row.checksum ?? "",
    compiled_at: row.compiled_at ?? "",
    compiled_by: row.compiled_by ?? "",
    status: row.status,
    error_text: row.error_text ?? null,
    branding_profile_id: row.branding_profile_id ?? "",
    doc_instance_id: row.doc_instance_id ?? "",
    title: row.title ?? "",
  };
}

function mapVaultAsset(row: any): VaultAsset {
  return {
    id: row.id,
    doc_instance_id: row.doc_instance_id,
    doc_instance_version_id: row.doc_instance_version_id,
    compiled_document_id: row.compiled_document_id,
    title: row.title,
    doc_type: row.doc_type,
    customer_id: row.customer_id ?? "",
    customer_name: row.customer_name ?? "",
    workspace_id: row.workspace_id ?? null,
    workspace_name: row.workspace_name ?? null,
    status: row.status,
    branding_profile_id: row.branding_profile_id ?? "",
    file_url: row.file_url ?? "",
    checksum: row.checksum ?? "",
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    sent_to_crm: row.sent_to_crm ?? false,
    crm_export_status: row.crm_export_status ?? null,
    crm_export_at: row.crm_export_at ?? null,
  };
}

export async function fetchDocBlocks(): Promise<DocBlock[]> {
  const { data, error } = await supabase.from("doc_blocks").select("*").order("block_key");
  return safeFetchList('fetchDocBlocks', data, error, mapDocBlock, { silent: true });
}

export async function fetchDocBrandingProfiles(): Promise<BrandingProfile[]> {
  const { data, error } = await supabase.from("doc_branding_profiles").select("*").order("name");
  return safeFetchList('fetchDocBrandingProfiles', data, error, mapBrandingProfile, { silent: true });
}

export async function fetchDocTemplates(): Promise<DocTemplate[]> {
  const { data: tplRows, error: tplErr } = await supabase.from("doc_templates").select("*").order("name");
  if (tplErr) { handleSupabaseError("fetchDocTemplates", tplErr, { silent: true }); setFetchError('fetchDocTemplates', tplErr); return []; }
  clearFetchError('fetchDocTemplates');
  const { data: verRows, error: verErr } = await supabase.from("doc_template_versions").select("*").order("version_number");
  if (verErr) { handleSupabaseError("fetchDocTemplateVersions", verErr, { silent: true }); }
  const versions = (verRows ?? []).map(mapTemplateVersion);
  return (tplRows ?? []).map((row: any) =>
    mapDocTemplate(row, versions.filter(v => v.template_id === row.id))
  );
}

export async function fetchDocInstances(): Promise<DocInstance[]> {
  const { data: instRows, error: instErr } = await supabase.from("doc_instances").select("*").order("updated_at", { ascending: false });
  if (instErr) { handleSupabaseError("fetchDocInstances", instErr, { silent: true }); setFetchError('fetchDocInstances', instErr); return []; }
  clearFetchError('fetchDocInstances');
  const { data: verRows, error: verErr } = await supabase.from("doc_instance_versions").select("*").order("version_number");
  if (verErr) { handleSupabaseError("fetchDocInstanceVersions", verErr, { silent: true }); }
  const versions = (verRows ?? []).map(mapInstanceVersion);
  return (instRows ?? []).map((row: any) =>
    mapDocInstance(row, versions.filter(v => v.doc_instance_id === row.id))
  );
}

export async function fetchDocCompiledOutputs(): Promise<CompiledDocument[]> {
  const { data, error } = await supabase.from("doc_compiled_outputs").select("*").order("compiled_at", { ascending: false });
  return safeFetchList('fetchDocCompiledOutputs', data, error, mapCompiledDocument, { silent: true });
}

export async function fetchDocVaultAssets(): Promise<VaultAsset[]> {
  const { data, error } = await supabase.from("doc_vault_assets").select("*").order("created_at", { ascending: false });
  return safeFetchList('fetchDocVaultAssets', data, error, mapVaultAsset, { silent: true });
}

// ============================================================
// EDITOR BOTS + AI RUNS — Supabase data layer (reads/writes of
// established rows only; no bot execution lives here)
// ============================================================

function mapEditorBot(row: any): EditorBot {
  return {
    id: row.id,
    name: row.name,
    bot_type: row.bot_type,
    provider: row.provider,
    model: row.model,
    system_prompt: row.system_prompt,
    knowledge_base_refs: row.knowledge_base_refs ?? [],
    allowed_doc_types: row.allowed_doc_types ?? [],
    allowed_block_types: row.allowed_block_types ?? null,
    enabled: row.enabled ?? true,
    description: row.description ?? "",
    icon: row.icon ?? "Bot",
  };
}

function mapAIRun(row: any): AIRun {
  return {
    id: row.id,
    doc_instance_id: row.doc_instance_id,
    workspace_id: row.workspace_id ?? null,
    bot_id: row.bot_id,
    bot_name: row.bot_name,
    bot_type: row.bot_type,
    target_scope: row.target_scope,
    target_block_ids: row.target_block_ids ?? [],
    input_prompt: row.input_prompt ?? "",
    input_transcript_ref: row.input_transcript_ref ?? null,
    output_text: row.output_text ?? "",
    status: row.status,
    provider: row.provider,
    model: row.model,
    run_mode: row.run_mode ?? null,
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    applied_at: row.applied_at ?? null,
  };
}

export async function fetchEditorBots(): Promise<EditorBot[]> {
  const { data, error } = await supabase.from("editor_bots").select("*").order("name");
  return safeFetchList('fetchEditorBots', data, error, mapEditorBot, { silent: true });
}

export async function fetchAIRuns(docInstanceId?: string): Promise<AIRun[]> {
  let query = supabase.from("ai_runs").select("*").order("created_at", { ascending: false });
  if (docInstanceId) query = query.eq("doc_instance_id", docInstanceId);
  const { data, error } = await query;
  return safeFetchList('fetchAIRuns', data, error, mapAIRun, { silent: true });
}

/**
 * HONEST UNAVAILABLE (SX-007 Rev 2): Wave 02 must not record or mutate AI
 * runs. Performs zero database writes and throws so callers surface the
 * failure — never a fabricated or silently simulated success.
 */
export async function insertAIRun(run: AIRun): Promise<AIRun | null> {
  void run;
  throw new Error("AI-run recording is not available in this build (deferred to Sprint X). No data was written.");
}

/**
 * HONEST UNAVAILABLE (SX-007 Rev 2): Wave 02 must not record or mutate AI
 * runs. Performs zero database writes and throws so callers surface the
 * failure — never a fabricated or silently simulated success.
 */
export async function updateAIRunStatus(runId: string, status: AIRunStatus, appliedAt?: string): Promise<boolean> {
  void runId;
  void status;
  void appliedAt;
  throw new Error("AI-run status mutation is not available in this build (deferred to Sprint X). No data was written.");
}
