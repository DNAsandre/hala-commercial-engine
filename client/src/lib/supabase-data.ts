/**
 * Supabase Data Access Layer
 * Replaces in-memory mock data with live Supabase queries.
 * 
 * Column naming: Supabase uses snake_case, frontend uses camelCase.
 * This layer handles the mapping transparently.
 */

import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
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

export async function fetchUsers(): Promise<User[]> {
  const { data, error } = await supabase.from("users").select("*");
  if (error) { console.error("fetchUsers error:", error); return []; }
  return data || [];
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
  if (error) { console.error("fetchCustomers error:", error); return []; }
  return (data || []).map(mapCustomer);
}

export async function fetchCustomerById(id: string): Promise<Customer | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapCustomer(data);
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase.from("workspaces").select("*").order("updated_at", { ascending: false });
  if (error) { console.error("fetchWorkspaces error:", error); return []; }
  return (data || []).map(mapWorkspace);
}

export async function fetchWorkspaceById(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase.from("workspaces").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapWorkspace(data);
}

export async function fetchWorkspacesByCustomer(customerId: string): Promise<Workspace[]> {
  const { data, error } = await supabase.from("workspaces").select("*").eq("customer_id", customerId);
  if (error) { console.error("fetchWorkspacesByCustomer error:", error); return []; }
  return (data || []).map(mapWorkspace);
}

export async function fetchQuotes(): Promise<Quote[]> {
  const { data, error } = await supabase.from("quotes").select("*").order("created_at", { ascending: false });
  if (error) { console.error("fetchQuotes error:", error); return []; }
  return (data || []).map(mapQuote);
}

export async function fetchQuotesByWorkspace(workspaceId: string): Promise<Quote[]> {
  const { data, error } = await supabase.from("quotes").select("*").eq("workspace_id", workspaceId);
  if (error) return [];
  return (data || []).map(mapQuote);
}

export async function fetchProposals(): Promise<Proposal[]> {
  const { data, error } = await supabase.from("proposals").select("*").order("created_at", { ascending: false });
  if (error) { console.error("fetchProposals error:", error); return []; }
  return (data || []).map(mapProposal);
}

export async function fetchProposalsByWorkspace(workspaceId: string): Promise<Proposal[]> {
  const { data, error } = await supabase.from("proposals").select("*").eq("workspace_id", workspaceId);
  if (error) return [];
  return (data || []).map(mapProposal);
}

export async function fetchApprovalRecords(): Promise<ApprovalRecord[]> {
  const { data, error } = await supabase.from("approval_records").select("*").order("timestamp", { ascending: false });
  if (error) { console.error("fetchApprovalRecords error:", error); return []; }
  return (data || []).map(mapApprovalRecord);
}

export async function fetchSignals(): Promise<Signal[]> {
  const { data, error } = await supabase.from("signals").select("*").order("created_at", { ascending: false });
  if (error) { console.error("fetchSignals error:", error); return []; }
  return (data || []).map(mapSignal);
}

export async function fetchPolicyGates(): Promise<PolicyGate[]> {
  const { data, error } = await supabase.from("policy_gates").select("*");
  if (error) { console.error("fetchPolicyGates error:", error); return []; }
  return (data || []).map(mapPolicyGate);
}

export async function fetchPnLModels(): Promise<PnLModel[]> {
  const { data, error } = await supabase.from("pnl_models").select("*");
  if (error) return [];
  return (data || []).map(mapPnLModel);
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
  if (error) return [];
  return (data || []).map(mapHandoverTask);
}

export async function fetchCRMSyncEvents(): Promise<CRMSyncEvent[]> {
  const { data, error } = await supabase.from("crm_sync_events").select("*").order("timestamp", { ascending: false });
  if (error) return [];
  return (data || []).map(mapCRMSyncEvent);
}

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from("audit_log").select("*").order("timestamp", { ascending: false });
  if (error) return [];
  return (data || []).map(mapAuditEntry);
}

// ============================================================
// MUTATE FUNCTIONS (Create / Update / Delete)
// ============================================================

export async function createCustomer(customer: Customer): Promise<Customer | null> {
  const row = customerToRow(customer);
  row.created_at = new Date().toISOString();
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("customers").insert(row).select().single();
  if (error) { console.error("createCustomer error:", error); return null; }
  return mapCustomer(data);
}

export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | null> {
  const row = customerToRow(updates);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("customers").update(row).eq("id", id).select().single();
  if (error) { console.error("updateCustomer error:", error); return null; }
  return mapCustomer(data);
}

export async function createWorkspace(workspace: Workspace): Promise<Workspace | null> {
  const row = workspaceToRow(workspace);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("workspaces").insert(row).select().single();
  if (error) { console.error("createWorkspace error:", error); return null; }
  return mapWorkspace(data);
}

export async function updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace | null> {
  const row = workspaceToRow(updates);
  const { data, error } = await supabase.from("workspaces").update(row).eq("id", id).select().single();
  if (error) { console.error("updateWorkspace error:", error); return null; }
  return mapWorkspace(data);
}

export async function createQuote(quote: Quote): Promise<Quote | null> {
  const row = quoteToRow(quote);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("quotes").insert(row).select().single();
  if (error) { console.error("createQuote error:", error); return null; }
  return mapQuote(data);
}

export async function updateQuote(id: string, updates: Partial<Quote>): Promise<Quote | null> {
  const row = quoteToRow(updates);
  const { data, error } = await supabase.from("quotes").update(row).eq("id", id).select().single();
  if (error) { console.error("updateQuote error:", error); return null; }
  return mapQuote(data);
}

export async function createProposal(proposal: Proposal): Promise<Proposal | null> {
  const row = proposalToRow(proposal);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("proposals").insert(row).select().single();
  if (error) { console.error("createProposal error:", error); return null; }
  return mapProposal(data);
}

export async function updateProposal(id: string, updates: Partial<Proposal>): Promise<Proposal | null> {
  const row = proposalToRow(updates);
  const { data, error } = await supabase.from("proposals").update(row).eq("id", id).select().single();
  if (error) { console.error("updateProposal error:", error); return null; }
  return mapProposal(data);
}

export async function createApprovalRecord(record: ApprovalRecord): Promise<ApprovalRecord | null> {
  const row = approvalToRow(record);
  row.timestamp = new Date().toISOString();
  const { data, error } = await supabase.from("approval_records").insert(row).select().single();
  if (error) { console.error("createApprovalRecord error:", error); return null; }
  return mapApprovalRecord(data);
}

export async function updateApprovalRecord(id: string, updates: Partial<ApprovalRecord>): Promise<ApprovalRecord | null> {
  const row = approvalToRow(updates);
  const { data, error } = await supabase.from("approval_records").update(row).eq("id", id).select().single();
  if (error) { console.error("updateApprovalRecord error:", error); return null; }
  return mapApprovalRecord(data);
}

export async function createSignal(signal: Omit<Signal, "id">): Promise<Signal | null> {
  const row: any = {
    id: `s-${Date.now()}`,
    workspace_id: signal.workspaceId,
    type: signal.type,
    severity: signal.severity,
    message: signal.message,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("signals").insert(row).select().single();
  if (error) { console.error("createSignal error:", error); return null; }
  return mapSignal(data);
}

export async function updatePolicyGate(id: string, updates: Partial<PolicyGate>): Promise<PolicyGate | null> {
  const row: Record<string, any> = {};
  if (updates.mode !== undefined) row.mode = updates.mode;
  if (updates.overridable !== undefined) row.overridable = updates.overridable;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description;
  const { data, error } = await supabase.from("policy_gates").update(row).eq("id", id).select().single();
  if (error) { console.error("updatePolicyGate error:", error); return null; }
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
  if (error) { console.error("createPnLModel error:", error); return null; }
  return mapPnLModel(data);
}

export async function createHandoverTask(task: HandoverTask): Promise<HandoverTask | null> {
  const row = handoverToRow(task);
  row.created_at = new Date().toISOString();
  const { data, error } = await supabase.from("handover_tasks").insert(row).select().single();
  if (error) { console.error("createHandoverTask error:", error); return null; }
  return mapHandoverTask(data);
}

export async function updateHandoverTask(id: string, updates: Partial<HandoverTask>): Promise<HandoverTask | null> {
  const row = handoverToRow(updates);
  const { data, error } = await supabase.from("handover_tasks").update(row).eq("id", id).select().single();
  if (error) { console.error("updateHandoverTask error:", error); return null; }
  return mapHandoverTask(data);
}

export async function createAuditEntry(entry: AuditEntry): Promise<AuditEntry | null> {
  const row = auditToRow(entry);
  row.timestamp = new Date().toISOString();
  const { data, error } = await supabase.from("audit_log").insert(row).select().single();
  if (error) { console.error("createAuditEntry error:", error); return null; }
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
  if (error) { console.error("createCRMSyncEvent error:", error); return null; }
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
  if (error) { console.error("fetchContactsByCustomer error:", error); return []; }
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
  if (error) { console.error("createContact error:", error); return null; }
  return mapCustomerContact(data);
}

/** Update a contact */
export async function updateContact(id: string, updates: Partial<CustomerContact>): Promise<CustomerContact | null> {
  const row = contactToRow(updates);
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("customer_contacts").update(row).eq("id", id).select().single();
  if (error) { console.error("updateContact error:", error); return null; }
  return mapCustomerContact(data);
}

/** Delete a contact */
export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await supabase.from("customer_contacts").delete().eq("id", id);
  if (error) { console.error("deleteContact error:", error); return false; }
  return true;
}

/** Set a contact as primary (and unset all others for the same customer) */
export async function setPrimaryContact(contactId: string, customerId: string): Promise<boolean> {
  // Unset all primary flags for this customer
  await supabase.from("customer_contacts").update({ is_primary: false }).eq("customer_id", customerId);
  // Set the target as primary
  const { error } = await supabase.from("customer_contacts").update({ is_primary: true }).eq("id", contactId);
  if (error) { console.error("setPrimaryContact error:", error); return false; }
  return true;
}
