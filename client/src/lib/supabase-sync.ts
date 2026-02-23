/**
 * Supabase Sync Layer
 * 
 * Fires after in-memory mutations succeed in the engine files
 * (stage-transition.ts, tender-engine.ts, etc.) to persist changes
 * to Supabase. This keeps the existing business logic intact while
 * ensuring all data is durably stored.
 * 
 * Pattern: engine mutates in-memory → sync layer persists to DB
 */

import { supabase } from "./supabase";

// ============================================================
// WORKSPACE SYNC
// ============================================================

export async function syncWorkspaceStage(
  workspaceId: string,
  stage: string,
  daysInStage: number = 0
): Promise<void> {
  const { error } = await supabase
    .from("workspaces")
    .update({ stage, days_in_stage: daysInStage, updated_at: new Date().toISOString() })
    .eq("id", workspaceId);
  if (error) console.error("syncWorkspaceStage error:", error);
}

export async function syncWorkspaceUpdate(
  workspaceId: string,
  updates: Record<string, any>
): Promise<void> {
  // Convert camelCase to snake_case for common fields
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  const mapping: Record<string, string> = {
    stage: "stage",
    daysInStage: "days_in_stage",
    ragStatus: "rag_status",
    approvalState: "approval_state",
    notes: "notes",
    estimatedValue: "estimated_value",
    palletVolume: "pallet_volume",
    gpPercent: "gp_percent",
    owner: "owner",
    region: "region",
    title: "title",
    tenderStage: "tender_stage",
    probabilityPercent: "probability_percent",
    wonLostReason: "won_lost_reason",
    convertedToWorkspaceId: "converted_to_workspace_id",
  };
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = mapping[key] || key;
    row[dbKey] = val;
  }
  const { error } = await supabase.from("workspaces").update(row).eq("id", workspaceId);
  if (error) console.error("syncWorkspaceUpdate error:", error);
}

// ============================================================
// CUSTOMER SYNC
// ============================================================

export async function syncCustomerUpdate(
  customerId: string,
  updates: Record<string, any>
): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  const mapping: Record<string, string> = {
    name: "name",
    code: "code",
    group: "group",
    status: "status",
    city: "city",
    region: "region",
    industry: "industry",
    accountOwner: "account_owner",
    serviceType: "service_type",
    grade: "grade",
    facility: "facility",
    contractExpiry: "contract_expiry",
    contractValue2025: "contract_value_2025",
    expectedMonthlyRevenue: "expected_monthly_revenue",
    dso: "dso",
    paymentStatus: "payment_status",
    contactName: "contact_name",
    contactEmail: "contact_email",
    contactPhone: "contact_phone",
  };
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = mapping[key] || key;
    row[dbKey] = val;
  }
  const { error } = await supabase.from("customers").update(row).eq("id", customerId);
  if (error) console.error("syncCustomerUpdate error:", error);
}

export async function syncCustomerCreate(customer: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {
    id: customer.id,
    code: customer.code || "",
    name: customer.name,
    group: customer.group || "",
    status: customer.status || "Active",
    city: customer.city || "",
    region: customer.region || "East",
    industry: customer.industry || "",
    account_owner: customer.accountOwner || "",
    service_type: customer.serviceType || "Warehousing",
    grade: customer.grade || "TBA",
    facility: customer.facility || "",
    contract_expiry: customer.contractExpiry || "",
    contract_value_2025: customer.contractValue2025 || 0,
    expected_monthly_revenue: customer.expectedMonthlyRevenue || 0,
    dso: customer.dso || 0,
    payment_status: customer.paymentStatus || "Current",
    contact_name: customer.contactName || "",
    contact_email: customer.contactEmail || "",
    contact_phone: customer.contactPhone || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("customers").insert(row);
  if (error) console.error("syncCustomerCreate error:", error);
}

// ============================================================
// TENDER SYNC
// ============================================================

export async function syncTenderCreate(tender: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {
    id: tender.id,
    linked_workspace_id: tender.linkedWorkspaceId || null,
    customer_id: tender.customerId,
    customer_name: tender.customerName,
    title: tender.title,
    submission_deadline: tender.submissionDeadline,
    estimated_value: tender.estimatedValue,
    target_gp_percent: tender.targetGpPercent,
    probability_percent: tender.probabilityPercent,
    assigned_owner: tender.assignedOwner,
    assigned_team_members: JSON.stringify(tender.assignedTeamMembers || []),
    status: tender.status,
    source: tender.source,
    region: tender.region,
    notes: tender.notes || "",
    days_in_status: tender.daysInStatus || 0,
    created_at: tender.createdAt || new Date().toISOString().slice(0, 10),
    updated_at: tender.updatedAt || new Date().toISOString().slice(0, 10),
  };
  const { error } = await supabase.from("tenders").insert(row);
  if (error) console.error("syncTenderCreate error:", error);
}

export async function syncTenderUpdate(
  tenderId: string,
  updates: Record<string, any>
): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString().slice(0, 10) };
  const mapping: Record<string, string> = {
    status: "status",
    daysInStatus: "days_in_status",
    notes: "notes",
    probabilityPercent: "probability_percent",
    wonLostReason: "won_lost_reason",
    assignedOwner: "assigned_owner",
    estimatedValue: "estimated_value",
    targetGpPercent: "target_gp_percent",
    submissionDeadline: "submission_deadline",
  };
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = mapping[key] || key;
    row[dbKey] = val;
  }
  const { error } = await supabase.from("tenders").update(row).eq("id", tenderId);
  if (error) console.error("syncTenderUpdate error:", error);
}

// ============================================================
// AUDIT LOG SYNC
// ============================================================

export async function syncAuditEntry(entry: Record<string, any>): Promise<void> {
  const row = {
    id: entry.id,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    user_id: entry.userId || "u1",
    user_name: entry.userName || "Amin Al-Rashid",
    timestamp: entry.timestamp || new Date().toISOString(),
    details: entry.details || "",
  };
  const { error } = await supabase.from("audit_log").insert(row);
  if (error) console.error("syncAuditEntry error:", error);
}

// ============================================================
// APPROVAL RECORD SYNC
// ============================================================

export async function syncApprovalCreate(record: Record<string, any>): Promise<void> {
  const row = {
    id: record.id,
    entity_type: record.entityType,
    entity_id: record.entityId,
    workspace_id: record.workspaceId,
    approver_role: record.approverRole,
    approver_name: record.approverName,
    decision: record.decision,
    reason: record.reason || "",
    timestamp: record.timestamp || new Date().toISOString(),
    is_override: record.isOverride || false,
  };
  const { error } = await supabase.from("approval_records").insert(row);
  if (error) console.error("syncApprovalCreate error:", error);
}

// ============================================================
// QUOTE SYNC
// ============================================================

export async function syncQuoteCreate(quote: Record<string, any>): Promise<void> {
  const row = {
    id: quote.id,
    workspace_id: quote.workspaceId,
    version: quote.version,
    state: quote.state,
    storage_rate: quote.storageRate,
    inbound_rate: quote.inboundRate,
    outbound_rate: quote.outboundRate,
    pallet_volume: quote.palletVolume,
    monthly_revenue: quote.monthlyRevenue,
    annual_revenue: quote.annualRevenue,
    total_cost: quote.totalCost,
    gp_percent: quote.gpPercent,
    gp_amount: quote.gpAmount,
    created_at: quote.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from("quotes").insert(row);
  if (error) console.error("syncQuoteCreate error:", error);
}

export async function syncQuoteUpdate(quoteId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {};
  const mapping: Record<string, string> = {
    state: "state",
    storageRate: "storage_rate",
    inboundRate: "inbound_rate",
    outboundRate: "outbound_rate",
    palletVolume: "pallet_volume",
    monthlyRevenue: "monthly_revenue",
    annualRevenue: "annual_revenue",
    totalCost: "total_cost",
    gpPercent: "gp_percent",
    gpAmount: "gp_amount",
  };
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = mapping[key] || key;
    row[dbKey] = val;
  }
  const { error } = await supabase.from("quotes").update(row).eq("id", quoteId);
  if (error) console.error("syncQuoteUpdate error:", error);
}

// ============================================================
// PROPOSAL SYNC
// ============================================================

export async function syncProposalCreate(proposal: Record<string, any>): Promise<void> {
  const row = {
    id: proposal.id,
    workspace_id: proposal.workspaceId,
    version: proposal.version,
    state: proposal.state,
    title: proposal.title,
    sections: JSON.stringify(proposal.sections || []),
    created_at: proposal.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from("proposals").insert(row);
  if (error) console.error("syncProposalCreate error:", error);
}

export async function syncProposalUpdate(proposalId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.state !== undefined) row.state = updates.state;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.sections !== undefined) row.sections = JSON.stringify(updates.sections);
  const { error } = await supabase.from("proposals").update(row).eq("id", proposalId);
  if (error) console.error("syncProposalUpdate error:", error);
}

// ============================================================
// SIGNAL SYNC
// ============================================================

export async function syncSignalCreate(signal: Record<string, any>): Promise<void> {
  const row = {
    id: signal.id,
    workspace_id: signal.workspaceId,
    type: signal.type,
    severity: signal.severity,
    message: signal.message,
    created_at: signal.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from("signals").insert(row);
  if (error) console.error("syncSignalCreate error:", error);
}

// ============================================================
// HANDOVER TASK SYNC
// ============================================================

export async function syncHandoverTaskCreate(task: Record<string, any>): Promise<void> {
  const row = {
    id: task.id,
    workspace_id: task.workspaceId,
    department: task.department,
    task: task.task,
    status: task.status,
    assigned_to: task.assignedTo || "",
    due_date: task.dueDate || "",
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("handover_tasks").insert(row);
  if (error) console.error("syncHandoverTaskCreate error:", error);
}

export async function syncHandoverTaskUpdate(taskId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.assignedTo !== undefined) row.assigned_to = updates.assignedTo;
  if (updates.dueDate !== undefined) row.due_date = updates.dueDate;
  const { error } = await supabase.from("handover_tasks").update(row).eq("id", taskId);
  if (error) console.error("syncHandoverTaskUpdate error:", error);
}

// ============================================================
// POLICY GATE SYNC
// ============================================================

export async function syncPolicyGateUpdate(gateId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.mode !== undefined) row.mode = updates.mode;
  if (updates.overridable !== undefined) row.overridable = updates.overridable;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.description !== undefined) row.description = updates.description;
  const { error } = await supabase.from("policy_gates").update(row).eq("id", gateId);
  if (error) console.error("syncPolicyGateUpdate error:", error);
}

// ============================================================
// CRM SYNC EVENT
// ============================================================

export async function syncCRMSyncEvent(event: Record<string, any>): Promise<void> {
  const row = {
    id: event.id,
    direction: event.direction,
    entity: event.entity,
    zoho_id: event.zohoId || "",
    status: event.status,
    timestamp: event.timestamp || new Date().toISOString(),
    details: event.details || "",
  };
  const { error } = await supabase.from("crm_sync_events").insert(row);
  if (error) console.error("syncCRMSyncEvent error:", error);
}
