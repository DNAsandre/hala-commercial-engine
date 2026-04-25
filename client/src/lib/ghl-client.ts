/**
 * GHL Client — GoHighLevel / DNA Supersystems API Integration
 * 
 * All API calls are proxied through a Supabase Edge Function to keep
 * the API key server-side. If no Edge Function is deployed yet, the
 * client falls back to direct calls using a VITE env variable (dev only).
 * 
 * Base URL: https://services.leadconnectorhq.com
 * Auth: Bearer token + Version header
 * Docs: https://marketplace.gohighlevel.com/docs/
 */

import { supabase } from "./supabase";

// ─── TYPES ───────────────────────────────────────────────────

export interface GHLContact {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  tags: string[];
  source: string;
  dateAdded: string;
  dateUpdated: string;
  locationId: string;
  customFields: Record<string, any>[];
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
  locationId: string;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  assignedTo: string;
  status: string;
  source: string;
  contactId: string;
  contact?: GHLContact;
  dateAdded: string;
  dateUpdated: string;
  lastStatusChangeAt: string;
}

export interface CRMConfig {
  id: string;
  provider: string;
  providerLabel: string;
  baseUrl: string;
  locationId: string;
  apiVersion: string;
  syncEnabled: boolean;
  syncDirection: string;
  defaultPipelineId: string | null;
  defaultPipelineName: string | null;
  lastSyncAt: string | null;
}

export interface CRMContactMap {
  id: string;
  halaCustomerId: string;
  halaCustomerName: string;
  ghlContactId: string;
  ghlContactName: string;
  ghlEmail: string;
  ghlPhone: string;
  lastSyncedAt: string;
  syncStatus: string;
}

export interface CRMOpportunityMap {
  id: string;
  halaWorkspaceId: string;
  halaWorkspaceName: string;
  ghlOpportunityId: string;
  ghlPipelineId: string;
  ghlStageId: string;
  ghlStageName: string;
  monetaryValue: number;
  lastSyncedAt: string;
  syncStatus: string;
}

// ─── CONFIG ──────────────────────────────────────────────────

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

function getLocationId(): string {
  // Location ID is safe to expose (it's not a secret)
  return (import.meta as any).env?.VITE_GHL_LOCATION_ID || "ZpMhA08Xv6SGhvupvrvm";
}

// ─── RAW API CALLER ──────────────────────────────────────────

interface GHLRequestOptions {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, string>;
  body?: Record<string, any> | null;
}

/**
 * Core GHL API call. All requests go through the Edge Function proxy
 * to keep the API key server-side.
 * 
 * SECURITY: No client-side API key fallback. If the Edge Function
 * is not deployed, the call fails with a clear error.
 */
async function ghlFetch<T = any>(options: GHLRequestOptions): Promise<T> {
  const { endpoint, method = "GET", params, body } = options;

  // All traffic goes through the Edge Function proxy
  const { data, error } = await supabase.functions.invoke("ghl-proxy", {
    body: { endpoint, method, params, body },
  });

  if (error) {
    throw new Error(
      `GHL proxy error: ${error.message}. Ensure the ghl-proxy Edge Function is deployed.`
    );
  }

  if (!data) {
    throw new Error("GHL proxy returned empty response");
  }

  // Check for upstream GHL errors forwarded by the proxy
  if (data.error) {
    throw new Error(`GHL API error: ${data.error}`);
  }

  return data as T;
}

// ─── CONTACTS ────────────────────────────────────────────────

export async function fetchGHLContacts(
  query?: string,
  limit = 20
): Promise<GHLContact[]> {
  const locationId = getLocationId();
  const params: Record<string, string> = { locationId, limit: String(limit) };
  if (query) params.query = query;

  const data = await ghlFetch<{ contacts: any[] }>({
    endpoint: "/contacts/",
    params,
  });

  return (data.contacts ?? []).map(mapGHLContact);
}

export async function fetchGHLContact(contactId: string): Promise<GHLContact> {
  const data = await ghlFetch<{ contact: any }>({
    endpoint: `/contacts/${contactId}`,
  });
  return mapGHLContact(data.contact);
}

export async function createGHLContact(payload: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
}): Promise<GHLContact> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ contact: any }>({
    endpoint: "/contacts/",
    method: "POST",
    body: { ...payload, locationId },
  });
  return mapGHLContact(data.contact);
}

export async function updateGHLContact(
  contactId: string,
  payload: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName: string;
    tags: string[];
  }>
): Promise<GHLContact> {
  const data = await ghlFetch<{ contact: any }>({
    endpoint: `/contacts/${contactId}`,
    method: "PUT",
    body: payload,
  });
  return mapGHLContact(data.contact);
}

// ─── PIPELINES ───────────────────────────────────────────────

export async function fetchGHLPipelines(): Promise<GHLPipeline[]> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ pipelines: any[] }>({
    endpoint: "/opportunities/pipelines",
    params: { locationId },
  });

  return (data.pipelines ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    locationId: p.locationId ?? locationId,
    stages: (p.stages ?? []).map((s: any, i: number) => ({
      id: s.id,
      name: s.name,
      position: s.position ?? i,
    })),
  }));
}

// ─── OPPORTUNITIES ───────────────────────────────────────────

export async function fetchGHLOpportunities(
  pipelineId: string,
  query?: string
): Promise<GHLOpportunity[]> {
  const locationId = getLocationId();
  const params: Record<string, string> = {
    location_id: locationId,
    pipeline_id: pipelineId,
  };
  if (query) params.q = query;

  const data = await ghlFetch<{ opportunities: any[] }>({
    endpoint: "/opportunities/search",
    params,
  });

  return (data.opportunities ?? []).map(mapGHLOpportunity);
}

export async function createGHLOpportunity(payload: {
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  contactId: string;
  monetaryValue?: number;
  assignedTo?: string;
  status?: string;
}): Promise<GHLOpportunity> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ opportunity: any }>({
    endpoint: "/opportunities/",
    method: "POST",
    body: { ...payload, locationId },
  });
  return mapGHLOpportunity(data.opportunity);
}

export async function updateGHLOpportunity(
  opportunityId: string,
  payload: Partial<{
    name: string;
    pipelineStageId: string;
    monetaryValue: number;
    status: string;
    assignedTo: string;
  }>
): Promise<GHLOpportunity> {
  const data = await ghlFetch<{ opportunity: any }>({
    endpoint: `/opportunities/${opportunityId}`,
    method: "PUT",
    body: payload,
  });
  return mapGHLOpportunity(data.opportunity);
}

// ─── MAPPERS ─────────────────────────────────────────────────

function mapGHLContact(raw: any): GHLContact {
  return {
    id: raw.id ?? "",
    firstName: raw.firstName ?? raw.first_name ?? "",
    lastName: raw.lastName ?? raw.last_name ?? "",
    name: raw.name ?? raw.contactName ?? `${raw.firstName ?? ""} ${raw.lastName ?? ""}`.trim(),
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    companyName: raw.companyName ?? raw.company_name ?? "",
    tags: raw.tags ?? [],
    source: raw.source ?? "",
    dateAdded: raw.dateAdded ?? raw.date_added ?? "",
    dateUpdated: raw.dateUpdated ?? raw.date_updated ?? "",
    locationId: raw.locationId ?? raw.location_id ?? "",
    customFields: raw.customFields ?? raw.custom_fields ?? [],
  };
}

function mapGHLOpportunity(raw: any): GHLOpportunity {
  return {
    id: raw.id ?? "",
    name: raw.name ?? "",
    monetaryValue: Number(raw.monetaryValue ?? raw.monetary_value ?? 0),
    pipelineId: raw.pipelineId ?? raw.pipeline_id ?? "",
    pipelineStageId: raw.pipelineStageId ?? raw.pipeline_stage_id ?? "",
    assignedTo: raw.assignedTo ?? raw.assigned_to ?? "",
    status: raw.status ?? "open",
    source: raw.source ?? "",
    contactId: raw.contactId ?? raw.contact_id ?? "",
    contact: raw.contact ? mapGHLContact(raw.contact) : undefined,
    dateAdded: raw.dateAdded ?? raw.date_added ?? "",
    dateUpdated: raw.dateUpdated ?? raw.date_updated ?? "",
    lastStatusChangeAt: raw.lastStatusChangeAt ?? raw.last_status_change_at ?? "",
  };
}

// ─── SUPABASE CRM CONFIG HELPERS ─────────────────────────────

export async function fetchCRMConfig(): Promise<CRMConfig | null> {
  const { data, error } = await supabase
    .from("crm_config")
    .select("*")
    .eq("id", "default")
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    provider: data.provider,
    providerLabel: data.provider_label,
    baseUrl: data.base_url,
    locationId: data.location_id,
    apiVersion: data.api_version,
    syncEnabled: data.sync_enabled,
    syncDirection: data.sync_direction,
    defaultPipelineId: data.default_pipeline_id,
    defaultPipelineName: data.default_pipeline_name,
    lastSyncAt: data.last_sync_at,
  };
}

export async function updateCRMConfig(
  updates: Partial<{
    locationId: string;
    syncEnabled: boolean;
    syncDirection: string;
    defaultPipelineId: string;
    defaultPipelineName: string;
  }>
): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.locationId !== undefined) row.location_id = updates.locationId;
  if (updates.syncEnabled !== undefined) row.sync_enabled = updates.syncEnabled;
  if (updates.syncDirection !== undefined) row.sync_direction = updates.syncDirection;
  if (updates.defaultPipelineId !== undefined) row.default_pipeline_id = updates.defaultPipelineId;
  if (updates.defaultPipelineName !== undefined) row.default_pipeline_name = updates.defaultPipelineName;

  const { error } = await supabase.from("crm_config").update(row).eq("id", "default");
  if (error) console.error("[CRM Config] Update failed:", error);
}

export async function fetchContactMaps(): Promise<CRMContactMap[]> {
  const { data, error } = await supabase
    .from("crm_contact_map")
    .select("*")
    .order("last_synced_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    halaCustomerId: row.hala_customer_id,
    halaCustomerName: row.hala_customer_name ?? "",
    ghlContactId: row.ghl_contact_id,
    ghlContactName: row.ghl_contact_name ?? "",
    ghlEmail: row.ghl_email ?? "",
    ghlPhone: row.ghl_phone ?? "",
    lastSyncedAt: row.last_synced_at ?? "",
    syncStatus: row.sync_status ?? "synced",
  }));
}

export async function fetchOpportunityMaps(): Promise<CRMOpportunityMap[]> {
  const { data, error } = await supabase
    .from("crm_opportunity_map")
    .select("*")
    .order("last_synced_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    halaWorkspaceId: row.hala_workspace_id,
    halaWorkspaceName: row.hala_workspace_name ?? "",
    ghlOpportunityId: row.ghl_opportunity_id,
    ghlPipelineId: row.ghl_pipeline_id ?? "",
    ghlStageId: row.ghl_stage_id ?? "",
    ghlStageName: row.ghl_stage_name ?? "",
    monetaryValue: Number(row.monetary_value ?? 0),
    lastSyncedAt: row.last_synced_at ?? "",
    syncStatus: row.sync_status ?? "synced",
  }));
}

export async function upsertContactMap(map: {
  halaCustomerId: string;
  halaCustomerName: string;
  ghlContactId: string;
  ghlContactName: string;
  ghlEmail?: string;
  ghlPhone?: string;
}): Promise<void> {
  const row = {
    hala_customer_id: map.halaCustomerId,
    hala_customer_name: map.halaCustomerName,
    ghl_contact_id: map.ghlContactId,
    ghl_contact_name: map.ghlContactName,
    ghl_email: map.ghlEmail ?? "",
    ghl_phone: map.ghlPhone ?? "",
    last_synced_at: new Date().toISOString(),
    sync_status: "synced",
  };
  const { error } = await supabase.from("crm_contact_map").upsert(row, {
    onConflict: "hala_customer_id,ghl_contact_id",
  });
  if (error) console.error("[CRM] Contact map upsert failed:", error);
}

export async function upsertOpportunityMap(map: {
  halaWorkspaceId: string;
  halaWorkspaceName: string;
  ghlOpportunityId: string;
  ghlPipelineId: string;
  ghlStageId: string;
  ghlStageName: string;
  monetaryValue?: number;
}): Promise<void> {
  const row = {
    hala_workspace_id: map.halaWorkspaceId,
    hala_workspace_name: map.halaWorkspaceName,
    ghl_opportunity_id: map.ghlOpportunityId,
    ghl_pipeline_id: map.ghlPipelineId,
    ghl_stage_id: map.ghlStageId,
    ghl_stage_name: map.ghlStageName,
    monetary_value: map.monetaryValue ?? 0,
    last_synced_at: new Date().toISOString(),
    sync_status: "synced",
  };
  const { error } = await supabase.from("crm_opportunity_map").upsert(row, {
    onConflict: "hala_workspace_id,ghl_opportunity_id",
  });
  if (error) console.error("[CRM] Opportunity map upsert failed:", error);
}
