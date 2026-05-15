/**
 * GHL Service — Server-Side GoHighLevel API Client
 *
 * Production-grade API client for the GHL Private Integration.
 * Handles Contacts, Opportunities, and Businesses with:
 *   - Bearer token auth (from process.env.GHL_PRIVATE_TOKEN)
 *   - API version header (2021-07-28)
 *   - 5s timeout per request
 *   - Exponential backoff retry (3 attempts)
 *   - Rate-limit awareness
 *
 * Base URL: https://services.leadconnectorhq.com
 * Docs: https://marketplace.gohighlevel.com/docs/
 *
 * SECURITY: This module runs SERVER-SIDE ONLY. Never import in client/.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

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
  businessId?: string;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  assignedTo: string;
  status: string;          // open, won, lost, abandoned
  source: string;
  contactId: string;
  contact?: GHLContact;
  dateAdded: string;
  dateUpdated: string;
  lastStatusChangeAt: string;
  businessId?: string;
}

export interface GHLBusiness {
  id: string;
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  description: string;
  locationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number }[];
  locationId: string;
}

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = process.env.GHL_API_VERSION || '2023-02-21';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;
const RATE_LIMIT_DELAY_MS = 100;  // min delay between calls

function getToken(): string {
  const token = process.env.GHL_PRIVATE_TOKEN;
  if (!token) {
    throw new Error('[GHL] GHL_PRIVATE_TOKEN not configured in .env');
  }
  return token;
}

function getLocationId(): string {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error('[GHL] GHL_LOCATION_ID not configured in .env');
  }
  return locationId;
}

// ─── CORE HTTP CLIENT ───────────────────────────────────────────────────────

interface GHLRequestOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, string>;
  body?: Record<string, any> | null;
}

/**
 * Core GHL API call with retry, timeout, and rate-limit handling.
 */
async function ghlFetch<T = any>(options: GHLRequestOptions): Promise<T> {
  const { endpoint, method = 'GET', params, body } = options;
  const token = getToken();

  const url = new URL(`${GHL_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url.toString(), fetchOptions);
      clearTimeout(timeoutId);

      // Rate limit — wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 10000;
        console.warn(`[GHL] Rate limited (429). Waiting ${waitMs}ms before retry.`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const msg = `GHL API ${method} ${endpoint} → ${response.status}: ${errorBody}`;
        // Don't retry 4xx errors (except 429 handled above)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(msg);
        }
        lastError = new Error(msg);
        continue; // Retry 5xx
      }

      // Rate-limit courtesy delay
      await sleep(RATE_LIMIT_DELAY_MS);

      const data = await response.json();
      return data as T;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = new Error(`GHL API ${method} ${endpoint} timed out after ${TIMEOUT_MS}ms`);
      } else if (err.message?.includes('GHL API')) {
        // Already a formatted error — don't retry client errors
        throw err;
      } else {
        lastError = err;
      }
    }
  }

  throw lastError || new Error(`GHL API ${options.endpoint} failed after ${MAX_RETRIES} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── CONTACTS ───────────────────────────────────────────────────────────────

export async function getContact(contactId: string): Promise<GHLContact> {
  const data = await ghlFetch<{ contact: any }>({
    endpoint: `/contacts/${contactId}`,
  });
  return mapContact(data.contact);
}

export async function searchContacts(
  query?: string,
  limit = 20,
): Promise<GHLContact[]> {
  const locationId = getLocationId();
  const params: Record<string, string> = { locationId, limit: String(limit) };
  if (query) params.query = query;

  const data = await ghlFetch<{ contacts: any[] }>({
    endpoint: '/contacts/',
    params,
  });
  return (data.contacts ?? []).map(mapContact);
}

export async function createContact(payload: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
}): Promise<GHLContact> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ contact: any }>({
    endpoint: '/contacts/',
    method: 'POST',
    body: { ...payload, locationId },
  });
  return mapContact(data.contact);
}

export async function updateContact(
  contactId: string,
  payload: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName: string;
    tags: string[];
  }>,
): Promise<GHLContact> {
  const data = await ghlFetch<{ contact: any }>({
    endpoint: `/contacts/${contactId}`,
    method: 'PUT',
    body: payload,
  });
  return mapContact(data.contact);
}

// ─── OPPORTUNITIES ──────────────────────────────────────────────────────────

export async function getOpportunity(opportunityId: string): Promise<GHLOpportunity> {
  const data = await ghlFetch<{ opportunity: any }>({
    endpoint: `/opportunities/${opportunityId}`,
  });
  return mapOpportunity(data.opportunity);
}

export async function searchOpportunities(
  pipelineId: string,
  query?: string,
): Promise<GHLOpportunity[]> {
  const locationId = getLocationId();
  const params: Record<string, string> = {
    location_id: locationId,
    pipeline_id: pipelineId,
  };
  if (query) params.q = query;

  const data = await ghlFetch<{ opportunities: any[] }>({
    endpoint: '/opportunities/search',
    params,
  });
  return (data.opportunities ?? []).map(mapOpportunity);
}

export async function createOpportunity(payload: {
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
    endpoint: '/opportunities/',
    method: 'POST',
    body: { ...payload, locationId },
  });
  return mapOpportunity(data.opportunity);
}

export async function updateOpportunity(
  opportunityId: string,
  payload: Partial<{
    name: string;
    pipelineStageId: string;
    monetaryValue: number;
    status: string;
    assignedTo: string;
  }>,
): Promise<GHLOpportunity> {
  const data = await ghlFetch<{ opportunity: any }>({
    endpoint: `/opportunities/${opportunityId}`,
    method: 'PUT',
    body: payload,
  });
  return mapOpportunity(data.opportunity);
}

// ─── BUSINESSES ─────────────────────────────────────────────────────────────

export async function getBusiness(businessId: string): Promise<GHLBusiness> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ business: any }>({
    endpoint: `/businesses/${businessId}`,
    params: { locationId },
  });
  return mapBusiness(data.business);
}

export async function listBusinesses(): Promise<GHLBusiness[]> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ businesses: any[] }>({
    endpoint: '/businesses/',
    params: { locationId },
  });
  return (data.businesses ?? []).map(mapBusiness);
}

export async function createBusiness(payload: {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  description?: string;
}): Promise<GHLBusiness> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ business: any }>({
    endpoint: '/businesses/',
    method: 'POST',
    body: { ...payload, locationId },
  });
  return mapBusiness(data.business);
}

export async function updateBusiness(
  businessId: string,
  payload: Partial<{
    name: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    description: string;
  }>,
): Promise<GHLBusiness> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ business: any }>({
    endpoint: `/businesses/${businessId}`,
    method: 'PUT',
    body: payload,
    params: { locationId },
  });
  return mapBusiness(data.business);
}

// ─── PIPELINES ──────────────────────────────────────────────────────────────

export async function getPipelines(): Promise<GHLPipeline[]> {
  const locationId = getLocationId();
  const data = await ghlFetch<{ pipelines: any[] }>({
    endpoint: '/opportunities/pipelines',
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

// ─── CONNECTION TEST ────────────────────────────────────────────────────────

/**
 * Tests the GHL Private Integration token by fetching contacts with limit=1.
 * Returns { ok, latencyMs, message }.
 */
export async function testConnection(): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    const locationId = getLocationId();
    await ghlFetch({
      endpoint: '/contacts/',
      params: { locationId, limit: '1' },
    });
    return {
      ok: true,
      latencyMs: Date.now() - start,
      message: 'GHL Private Integration connected successfully',
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: err.message || 'Connection failed',
    };
  }
}

// ─── MAPPERS ────────────────────────────────────────────────────────────────

/**
 * Map raw webhook payload data to a typed GHLContact.
 * Exported for use by the webhook handler.
 */
export function mapContactFromWebhook(raw: any): GHLContact {
  return mapContact(raw);
}

/**
 * Map raw webhook payload data to a typed GHLOpportunity.
 * Exported for use by the webhook handler.
 */
export function mapOpportunityFromWebhook(raw: any): GHLOpportunity {
  return mapOpportunity(raw);
}

function mapContact(raw: any): GHLContact {
  return {
    id: raw.id ?? '',
    firstName: raw.firstName ?? raw.first_name ?? '',
    lastName: raw.lastName ?? raw.last_name ?? '',
    name: raw.name ?? raw.contactName ?? `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim(),
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    companyName: raw.companyName ?? raw.company_name ?? '',
    tags: raw.tags ?? [],
    source: raw.source ?? '',
    dateAdded: raw.dateAdded ?? raw.date_added ?? '',
    dateUpdated: raw.dateUpdated ?? raw.date_updated ?? '',
    locationId: raw.locationId ?? raw.location_id ?? '',
    customFields: raw.customFields ?? raw.custom_fields ?? [],
    businessId: raw.businessId ?? raw.business_id ?? undefined,
  };
}

function mapOpportunity(raw: any): GHLOpportunity {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    monetaryValue: Number(raw.monetaryValue ?? raw.monetary_value ?? 0),
    pipelineId: raw.pipelineId ?? raw.pipeline_id ?? '',
    pipelineStageId: raw.pipelineStageId ?? raw.pipeline_stage_id ?? '',
    assignedTo: raw.assignedTo ?? raw.assigned_to ?? '',
    status: raw.status ?? 'open',
    source: raw.source ?? '',
    contactId: raw.contactId ?? raw.contact_id ?? '',
    contact: raw.contact ? mapContact(raw.contact) : undefined,
    dateAdded: raw.dateAdded ?? raw.date_added ?? '',
    dateUpdated: raw.dateUpdated ?? raw.date_updated ?? '',
    lastStatusChangeAt: raw.lastStatusChangeAt ?? raw.last_status_change_at ?? '',
    businessId: raw.businessId ?? raw.business_id ?? undefined,
  };
}

function mapBusiness(raw: any): GHLBusiness {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    website: raw.website ?? '',
    address: raw.address ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    country: raw.country ?? '',
    postalCode: raw.postalCode ?? raw.postal_code ?? '',
    description: raw.description ?? '',
    locationId: raw.locationId ?? raw.location_id ?? '',
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    updatedAt: raw.updatedAt ?? raw.updated_at ?? '',
  };
}
