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

import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
import { handleSupabaseError } from "./supabase-error";
import { optimisticSyncUpdate } from "./optimistic-lock";

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
  if (error) handleSupabaseError('syncWorkspaceStage', error, { entityId: workspaceId });
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
  await optimisticSyncUpdate("workspaces", workspaceId, row, 'syncWorkspaceUpdate');
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
  await optimisticSyncUpdate("customers", customerId, row, 'syncCustomerUpdate');
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
  const { error } = await supabase.from("customers").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncCustomerCreate', error, { entityId: customer.id });
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
  const { error } = await supabase.from("tenders").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncTenderCreate', error, { entityId: tender.id });
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
  await optimisticSyncUpdate("tenders", tenderId, row, 'syncTenderUpdate');
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
    user_id: entry.userId || getCurrentUser().id,
    user_name: entry.userName || getCurrentUser().name,
    timestamp: entry.timestamp || new Date().toISOString(),
    details: entry.details || "",
  };
  const { error } = await supabase.from("audit_log").upsert(row, { onConflict: 'id', ignoreDuplicates: true });
  if (error) handleSupabaseError('syncAuditEntry', error, { entityId: entry.id });
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
  const { error } = await supabase.from("approval_records").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncApprovalCreate', error, { entityId: record.id });
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
  const { error } = await supabase.from("quotes").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncQuoteCreate', error, { entityId: quote.id });
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
  await optimisticSyncUpdate("quotes", quoteId, row, 'syncQuoteUpdate');
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
  const { error } = await supabase.from("proposals").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncProposalCreate', error, { entityId: proposal.id });
}

export async function syncProposalUpdate(proposalId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.state !== undefined) row.state = updates.state;
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.sections !== undefined) row.sections = JSON.stringify(updates.sections);
  await optimisticSyncUpdate("proposals", proposalId, row, 'syncProposalUpdate');
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
  const { error } = await supabase.from("signals").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncSignalCreate', error, { entityId: signal.id });
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
  const { error } = await supabase.from("handover_tasks").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncHandoverTaskCreate', error, { entityId: task.id });
}

export async function syncHandoverTaskUpdate(taskId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = {};
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.assignedTo !== undefined) row.assigned_to = updates.assignedTo;
  if (updates.dueDate !== undefined) row.due_date = updates.dueDate;
  await optimisticSyncUpdate("handover_tasks", taskId, row, 'syncHandoverTaskUpdate');
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
  await optimisticSyncUpdate("policy_gates", gateId, row, 'syncPolicyGateUpdate');
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
  const { error } = await supabase.from("crm_sync_events").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncCRMSyncEvent', error, { entityId: event.id });
}


// ============================================================
// DOCUMENT INSTANCE SYNC
// ============================================================

export async function syncDocInstanceCreate(instance: Record<string, any>): Promise<void> {
  const row = {
    id: instance.id,
    doc_type: instance.doc_type,
    template_version_id: instance.template_version_id || null,
    status: instance.status || 'draft',
    linked_entity_type: instance.linked_entity_type || null,
    linked_entity_id: instance.linked_entity_id || null,
    customer_id: instance.customer_id || null,
    customer_name: instance.customer_name || null,
    workspace_id: instance.workspace_id || null,
    workspace_name: instance.workspace_name || null,
    current_version_id: instance.current_version_id || null,
    title: instance.title || instance.doc_type,
    branding_profile_id: instance.branding_profile_id || null,
    is_compiled: instance.is_compiled || false,
    compiled_at: instance.compiled_at || null,
    created_by: instance.created_by || getCurrentUser().name,
    created_at: instance.created_at || new Date().toISOString(),
    updated_at: instance.updated_at || new Date().toISOString(),
  };
  const { error } = await supabase.from("doc_instances").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncDocInstanceCreate', error, { entityId: instance.id });
}

export async function syncDocInstanceUpdate(instanceId: string, updates: Record<string, any>): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  const mapping: Record<string, string> = {
    status: "status",
    title: "title",
    current_version_id: "current_version_id",
    branding_profile_id: "branding_profile_id",
    is_compiled: "is_compiled",
    compiled_at: "compiled_at",
  };
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = mapping[key] || key;
    row[dbKey] = val;
  }
  await optimisticSyncUpdate("doc_instances", instanceId, row, 'syncDocInstanceUpdate');
}

// ============================================================
// DOCUMENT INSTANCE VERSION SYNC
// ============================================================

export async function syncDocInstanceVersionCreate(version: Record<string, any>): Promise<void> {
  const row = {
    id: version.id,
    doc_instance_id: version.doc_instance_id,
    version_number: version.version_number || 1,
    blocks: JSON.stringify(version.blocks || []),
    bindings: JSON.stringify(version.bindings || {}),
    created_by: version.created_by || getCurrentUser().name,
    created_at: version.created_at || new Date().toISOString(),
  };
  const { error } = await supabase.from("doc_instance_versions").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncDocInstanceVersionCreate', error, { entityId: version.id });
}

// ============================================================
// COMPILED DOCUMENT SYNC
// ============================================================

export async function syncCompiledDocCreate(doc: Record<string, any>): Promise<void> {
  const row = {
    id: doc.id,
    doc_instance_id: doc.doc_instance_id || null,
    doc_instance_version_id: doc.doc_instance_version_id || null,
    title: doc.title || "",
    doc_type: doc.doc_type || "",
    customer_id: doc.customer_id || null,
    customer_name: doc.customer_name || null,
    workspace_id: doc.workspace_id || null,
    compiled_html: doc.compiled_html || "",
    compiled_by: doc.compiled_by || getCurrentUser().name,
    compiled_at: doc.compiled_at || new Date().toISOString(),
    status: doc.status || "final",
  };
  const { error } = await supabase.from("compiled_documents").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncCompiledDocCreate', error, { entityId: doc.id });
}

// ============================================================
// VAULT ASSET SYNC
// ============================================================

export async function syncVaultAssetCreate(asset: Record<string, any>): Promise<void> {
  const row = {
    id: asset.id,
    doc_instance_id: asset.doc_instance_id || null,
    doc_instance_version_id: asset.doc_instance_version_id || null,
    compiled_document_id: asset.compiled_document_id || null,
    title: asset.title || "",
    doc_type: asset.doc_type || "",
    customer_id: asset.customer_id || null,
    customer_name: asset.customer_name || null,
    workspace_id: asset.workspace_id || null,
    status: asset.status || "final",
    created_by: asset.created_by || getCurrentUser().name,
    created_at: asset.created_at || new Date().toISOString(),
  };
  const { error } = await supabase.from("vault_assets").upsert(row, { onConflict: 'id' });
  if (error) handleSupabaseError('syncVaultAssetCreate', error, { entityId: asset.id });
}

// ============================================================
// DOC INSTANCE DELETE
// ============================================================

export async function syncDocInstanceDelete(instanceId: string): Promise<boolean> {
  try {
    // Delete versions first (child records)
    const { error: vError } = await supabase
      .from("doc_instance_versions")
      .delete()
      .eq("doc_instance_id", instanceId);
    if (vError) handleSupabaseError('syncDocInstanceDelete:versions', vError, { entityId: instanceId });

    // Delete compiled documents
    const { error: cError } = await supabase
      .from("compiled_documents")
      .delete()
      .eq("doc_instance_id", instanceId);
    if (cError) handleSupabaseError('syncDocInstanceDelete:compiled', cError, { entityId: instanceId });

    // Delete the instance itself
    const { error } = await supabase
      .from("doc_instances")
      .delete()
      .eq("id", instanceId);
    if (error) {
      handleSupabaseError('syncDocInstanceDelete', error, { entityId: instanceId });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
