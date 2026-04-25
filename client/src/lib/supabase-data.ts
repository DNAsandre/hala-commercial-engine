/**
 * Supabase Data Access Layer
 * Replaces in-memory mock data with live Supabase queries.
 * 
 * Column naming: Supabase uses snake_case, frontend uses camelCase.
 * This layer handles the mapping transparently.
 */

import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
import { handleSupabaseError, setFetchError, clearFetchError } from "@/lib/supabase-error";
import { optimisticUpdate } from "@/lib/optimistic-lock";
import type {
  User, Customer, Workspace, Quote, Proposal, ApprovalRecord,
  Signal, PolicyGate, PnLModel, HandoverTask, CRMSyncEvent, AuditEntry,
} from "./store";

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

function mapProposal(row: any): Proposal {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    version: row.version,
    state: row.state,
    title: row.title,
    createdAt: row.created_at,
    sections: typeof row.sections === "string" ? JSON.parse(row.sections) : (row.sections || []),
  };
}

function proposalToRow(p: Partial<Proposal>): Record<string, any> {
  const row: Record<string, any> = {};
  if (p.id !== undefined) row.id = p.id;
  if (p.workspaceId !== undefined) row.workspace_id = p.workspaceId;
  if (p.version !== undefined) row.version = p.version;
  if (p.state !== undefined) row.state = p.state;
  if (p.title !== undefined) row.title = p.title;
  if (p.sections !== undefined) row.sections = JSON.stringify(p.sections);
  return row;
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
 *
 * Usage:
 *   return safeFetchList('fetchCustomers', data, error, row => mapCustomer(row));
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

export async function fetchWorkspaceById(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase.from("workspaces").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapWorkspace(data);
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
  const { data, error } = await supabase.from("proposals").select("*").order("created_at", { ascending: false });
  return safeFetchList('fetchProposals', data, error, mapProposal, { silent: true });
}

export async function fetchProposalsByWorkspace(workspaceId: string): Promise<Proposal[]> {
  const { data, error } = await supabase.from("proposals").select("*").eq("workspace_id", workspaceId);
  return safeFetchList('fetchProposalsByWorkspace', data, error, mapProposal);
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
  const { data, error } = await supabase.from("pnl_models").select("*").eq("workspace_id", workspaceId).order("version", { ascending: false }).limit(1).single();
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
// MUTATE FUNCTIONS (Create / Update / Delete)
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

export async function createProposal(proposal: Proposal): Promise<Proposal | null> {
  const row = proposalToRow(proposal);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("proposals").insert(row).select().single();
  if (error) { handleSupabaseError('createProposal', error, { silent: true }); return null; }
  return mapProposal(data);
}

export async function updateProposal(id: string, updates: Partial<Proposal>, expectedUpdatedAt?: string): Promise<Proposal | null> {
  const row = proposalToRow(updates);
  const data = await optimisticUpdate("proposals", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapProposal(data);
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

export async function updatePolicyGate(id: string, updates: Partial<PolicyGate>, expectedUpdatedAt?: string): Promise<PolicyGate | null> {
  const row: Record<string, any> = {};
  if (updates.mode !== undefined) row.mode = updates.mode;
  if (updates.overridable !== undefined) row.overridable = updates.overridable;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description;
  const data = await optimisticUpdate("policy_gates", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapPolicyGate(data);
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

function contactToRow(c: Partial<CustomerContact>): Record<string, any> {
  const row: Record<string, any> = {};
  if (c.id !== undefined) row.id = c.id;
  if (c.customerId !== undefined) row.customer_id = c.customerId;
  if (c.fullName !== undefined) row.full_name = c.fullName;
  if (c.jobTitle !== undefined) row.job_title = c.jobTitle;
  if (c.email !== undefined) row.email = c.email;
  if (c.phone !== undefined) row.phone = c.phone;
  if (c.isPrimary !== undefined) row.is_primary = c.isPrimary;
  if (c.notes !== undefined) row.notes = c.notes;
  return row;
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

/** Fetch the primary contact for a customer */
export async function fetchPrimaryContact(customerId: string): Promise<CustomerContact | null> {
  const { data, error } = await supabase
    .from("customer_contacts")
    .select("*")
    .eq("customer_id", customerId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapCustomerContact(data);
}

/** Create a new contact */
export async function createContact(contact: Omit<CustomerContact, "createdAt" | "updatedAt">): Promise<CustomerContact | null> {
  const row = contactToRow(contact);
  row.created_at = new Date().toISOString();
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("customer_contacts").insert(row).select().single();
  if (error) { handleSupabaseError('createContact', error, { silent: true }); return null; }
  return mapCustomerContact(data);
}

/** Update a contact */
export async function updateContact(id: string, updates: Partial<CustomerContact>, expectedUpdatedAt?: string): Promise<CustomerContact | null> {
  const row = contactToRow(updates);
  const data = await optimisticUpdate("customer_contacts", id, row, expectedUpdatedAt);
  if (!data) return null;
  return mapCustomerContact(data);
}

/** Delete a contact */
export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase.from("customer_contacts").delete().eq("id", id);
  if (error) { handleSupabaseError('deleteContact', error, { silent: true }); return false; }
  return true;
}

/** Set a contact as primary (and unset all others for the same customer) */
export async function setPrimaryContact(contactId: string, customerId: string): Promise<boolean> {
  // Unset all primary flags for this customer
  await supabase.from("customer_contacts").update({ is_primary: false }).eq("customer_id", customerId);
  // Set the target as primary
  const { error } = await supabase.from("customer_contacts").update({ is_primary: true }).eq("id", contactId);
  if (error) { handleSupabaseError('setPrimaryContact', error, { silent: true }); return false; }
  return true;
}

// ============================================================
// TENDERS — Supabase data layer
// DB schema uses: phase (=status), owner (=assignedOwner),
//                 workspace_id (=linkedWorkspaceId)
// ============================================================

import type { Tender } from "./tender-engine";

function mapTender(row: any): Tender {
  return {
    id:                  row.id,
    linkedWorkspaceId:   row.workspace_id ?? null,
    customerId:          row.customer_id ?? "",
    customerName:        row.customer_name ?? "",
    title:               row.title ?? "",
    submissionDeadline:  row.submission_deadline
                           ? String(row.submission_deadline).slice(0, 10)
                           : "",
    estimatedValue:      Number(row.estimated_value) || 0,
    targetGpPercent:     Number(row.target_gp_percent) || 0,
    probabilityPercent:  Number(row.probability_percent) || 0,
    assignedOwner:       row.owner ?? "",
    assignedTeamMembers: Array.isArray(row.assigned_team_members)
                           ? row.assigned_team_members
                           : [],
    status:              (row.phase ?? "identified") as Tender["status"],
    source:              (row.source ?? "Direct") as Tender["source"],
    region:              (row.region ?? "East") as Tender["region"],
    notes:               row.notes ?? "",
    daysInStatus:        Number(row.days_in_status) || 0,
    crmSynced:           Boolean(row.crm_synced),
    createdAt:           row.created_at
                           ? String(row.created_at).slice(0, 10)
                           : new Date().toISOString().slice(0, 10),
    updatedAt:           row.updated_at
                           ? String(row.updated_at).slice(0, 10)
                           : new Date().toISOString().slice(0, 10),
  };
}

export async function fetchTenders(): Promise<Tender[]> {
  const { data, error } = await supabase
    .from("tenders")
    .select("*")
    .order("created_at", { ascending: false });
  return safeFetchList('fetchTenders', data, error, mapTender, { silent: true });
}

export async function fetchTenderById(id: string): Promise<Tender | null> {
  const { data, error } = await supabase
    .from("tenders").select("*").eq("id", id).maybeSingle();
  if (error) { handleSupabaseError("fetchTenderById", error, { silent: true }); return null; }
  return data ? mapTender(data) : null;
}

export async function fetchTendersByCustomer(customerId: string): Promise<Tender[]> {
  const { data, error } = await supabase
    .from("tenders").select("*").eq("customer_id", customerId);
  return safeFetchList('fetchTendersByCustomer', data, error, mapTender, { silent: true });
}

export async function upsertTender(tender: Tender): Promise<void> {
  const row = {
    id:                    tender.id,
    reference:             tender.id.toUpperCase(),
    title:                 tender.title,
    customer_id:           tender.customerId,
    customer_name:         tender.customerName,
    region:                tender.region,
    phase:                 tender.status,
    submission_deadline:   tender.submissionDeadline || null,
    estimated_value:       tender.estimatedValue,
    owner:                 tender.assignedOwner,
    notes:                 tender.notes,
    workspace_id:          tender.linkedWorkspaceId ?? null,
    target_gp_percent:     tender.targetGpPercent,
    probability_percent:   tender.probabilityPercent,
    assigned_team_members: tender.assignedTeamMembers,
    source:                tender.source,
    days_in_status:        tender.daysInStatus,
    crm_synced:            tender.crmSynced ?? false,
    updated_at:            new Date().toISOString(),
  };
  const { error } = await supabase.from("tenders").upsert(row, { onConflict: "id" });
  if (error) handleSupabaseError("upsertTender", error, {});
}

// ============================================================
// RENEWAL WORKSPACES — Supabase data layer
// ============================================================

import type { RenewalWorkspace, ContractBaseline } from "./renewal-engine";

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
  const { data, error } = await supabase
    .from("renewal_workspaces")
    .select("*")
    .order("created_at", { ascending: false });
  return safeFetchList('fetchRenewalWorkspaces', data, error, mapRenewalWorkspace, { silent: true });
}

export async function upsertRenewalWorkspace(rw: RenewalWorkspace): Promise<void> {
  const row = {
    id:                 rw.id,
    customer_id:        rw.customerId,
    customer_name:      rw.customerName,
    baseline_id:        rw.baselineId,
    renewal_cycle_name: rw.renewalCycleName,
    target_start_date:  rw.targetStartDate || null,
    target_end_date:    rw.targetEndDate || null,
    status:             rw.status,
    renewal_decision:   rw.renewalDecision,
    owner_user_id:      rw.ownerUserId,
    owner_name:         rw.ownerName,
    updated_at:         new Date().toISOString(),
  };
  const { error } = await supabase
    .from("renewal_workspaces").upsert(row, { onConflict: "id" });
  if (error) handleSupabaseError("upsertRenewalWorkspace", error, {});
}

export async function fetchContractBaselines(): Promise<ContractBaseline[]> {
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

import type {
  EcrMetric, EcrRuleSet, EcrRuleWeight, EcrInputSnapshot,
  EcrInputValue, EcrScore, EcrScoreBreakdown, EcrAuditTrailEntry,
  Grade,
} from "./ecr";

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
    grade: row.grade as Grade,
    confidenceScore: Number(row.confidence_score),
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

// ── ECR Fetchers ─────────────────────────────────────────────

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
// DOCUMENT COMPOSER — Supabase data layer
// ============================================================

import type {
  DocBlock, BrandingProfile, DocTemplate, TemplateVersion,
  DocInstance, DocInstanceVersion, CompiledDocument, VaultAsset,
  BlockFamily, BlockEditorMode, BlockPermissions, BlockSchema,
  LayoutConfig, RecipeBlock, InstanceBlock, Bindings,
  FooterFormat, DocType, TemplateStatus, DocInstanceStatus,
  LinkedEntityType, CompileStatus, VaultAssetStatus,
} from "./document-composer";

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

// ── Document Fetchers ────────────────────────────────────────

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
// BOT GOVERNANCE — Supabase data layer
// ============================================================

import type { EditorBot, AIRun, AIRunStatus } from "./ai-runs";

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

// ── Bot Fetchers ─────────────────────────────────────────────

export async function fetchEditorBots(): Promise<EditorBot[]> {
  const { data, error } = await supabase.from("editor_bots").select("*").order("name");
  return safeFetchList('fetchEditorBots', data, error, mapEditorBot, { silent: true });
}

export async function createEditorBot(bot: Omit<EditorBot, "id"> & { id?: string }): Promise<EditorBot | null> {
  const row: Record<string, any> = {
    id: bot.id || `ebot-${crypto.randomUUID().substring(0, 8)}`,
    name: bot.name,
    bot_type: bot.bot_type,
    provider: bot.provider,
    model: bot.model,
    system_prompt: bot.system_prompt,
    knowledge_base_refs: bot.knowledge_base_refs,
    allowed_doc_types: bot.allowed_doc_types,
    allowed_block_types: bot.allowed_block_types,
    enabled: bot.enabled,
    description: bot.description,
    icon: bot.icon,
  };
  const { data, error } = await supabase.from("editor_bots").insert(row).select().single();
  if (error) { handleSupabaseError("createEditorBot", error, { silent: true }); return null; }
  return mapEditorBot(data);
}

export async function updateEditorBot(botId: string, updates: Partial<EditorBot>): Promise<EditorBot | null> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.bot_type !== undefined) row.bot_type = updates.bot_type;
  if (updates.provider !== undefined) row.provider = updates.provider;
  if (updates.model !== undefined) row.model = updates.model;
  if (updates.system_prompt !== undefined) row.system_prompt = updates.system_prompt;
  if (updates.knowledge_base_refs !== undefined) row.knowledge_base_refs = updates.knowledge_base_refs;
  if (updates.allowed_doc_types !== undefined) row.allowed_doc_types = updates.allowed_doc_types;
  if (updates.allowed_block_types !== undefined) row.allowed_block_types = updates.allowed_block_types;
  if (updates.enabled !== undefined) row.enabled = updates.enabled;
  if (updates.description !== undefined) row.description = updates.description;
  if (updates.icon !== undefined) row.icon = updates.icon;

  const { data, error } = await supabase.from("editor_bots").update(row).eq("id", botId).select().single();
  if (error) { handleSupabaseError("updateEditorBot", error, { silent: true }); return null; }
  return mapEditorBot(data);
}

export async function deleteEditorBot(botId: string): Promise<boolean> {
  const { error } = await supabase.from("editor_bots").delete().eq("id", botId);
  if (error) { handleSupabaseError("deleteEditorBot", error, { silent: true }); return false; }
  return true;
}

// ── AI Run Fetchers ──────────────────────────────────────────

export async function fetchAIRuns(docInstanceId?: string): Promise<AIRun[]> {
  let query = supabase.from("ai_runs").select("*").order("created_at", { ascending: false });
  if (docInstanceId) query = query.eq("doc_instance_id", docInstanceId);
  const { data, error } = await query;
  return safeFetchList('fetchAIRuns', data, error, mapAIRun, { silent: true });
}

export async function insertAIRun(run: AIRun): Promise<AIRun | null> {
  const row: Record<string, any> = {
    id: run.id,
    doc_instance_id: run.doc_instance_id,
    workspace_id: run.workspace_id,
    bot_id: run.bot_id,
    bot_name: run.bot_name,
    bot_type: run.bot_type,
    target_scope: run.target_scope,
    target_block_ids: run.target_block_ids,
    input_prompt: run.input_prompt,
    input_transcript_ref: run.input_transcript_ref,
    output_text: run.output_text,
    status: run.status,
    provider: run.provider,
    model: run.model,
    run_mode: run.run_mode,
    created_by: run.created_by,
    created_at: run.created_at,
    applied_at: run.applied_at,
  };
  const { data, error } = await supabase.from("ai_runs").insert(row).select().single();
  if (error) { handleSupabaseError("insertAIRun", error, { silent: true }); return null; }
  return mapAIRun(data);
}

export async function updateAIRunStatus(runId: string, status: AIRunStatus, appliedAt?: string): Promise<boolean> {
  const row: Record<string, any> = { status };
  if (appliedAt) row.applied_at = appliedAt;
  const { error } = await supabase.from("ai_runs").update(row).eq("id", runId);
  if (error) { handleSupabaseError("updateAIRunStatus", error, { silent: true }); return false; }
  return true;
}



