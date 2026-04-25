/**
 * Frontend API Client — Sprint 2 update
 * 
 * Now attaches Supabase auth token to all API requests.
 * Handles 401 by redirecting to login.
 * 
 * Usage:
 *   import { api } from '@/lib/api-client';
 *   const customers = await api.customers.list();
 */

import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Request Helper ──────────────────────────────────────

interface ApiResponse<T> {
  data: T;
  count?: number;
  error?: string;
}

interface ApiError {
  error: string;
  code: string;
  details?: Array<{ field: string; message: string }>;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach Supabase auth token
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // If we can't get the session, proceed without token
    // The server will return 401 and we'll handle it below
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 — session expired or not logged in
  if (res.status === 401) {
    const body = await res.json().catch(() => ({ code: 'AUTH_REQUIRED' }));
    if (body.code === 'AUTH_REQUIRED' || body.code === 'AUTH_INVALID') {
      // Redirect to login
      window.location.href = '/login';
    }
    throw new Error(body.error || 'Authentication required');
  }

  if (!res.ok) {
    const body: ApiError = await res.json().catch(() => ({
      error: `HTTP ${res.status}`,
      code: 'HTTP_ERROR',
    }));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── API Namespace ───────────────────────────────────────

export const api = {
  /** Health check — does not require auth */
  health: () => fetch(`${API_BASE}/api/health`).then(r => r.json()),

  customers: {
    list: () => request<any[]>('/api/customers'),
    get: (id: string) => request<any>(`/api/customers/${id}`),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  workspaces: {
    list: (filters?: { type?: string; stage?: string }) => {
      const params = new URLSearchParams();
      if (filters?.type) params.set('type', filters.type);
      if (filters?.stage) params.set('stage', filters.stage);
      const qs = params.toString();
      return request<any[]>(`/api/workspaces${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<any>(`/api/workspaces/${id}`),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/workspaces/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  escalations: {
    list: (status?: string) => {
      const qs = status ? `?status=${status}` : '';
      return request<any[]>(`/api/escalations${qs}`);
    },
    openCount: () => request<{ count: number }>('/api/escalations/open-count'),
    acknowledge: (id: string, data?: { notes?: string }) =>
      request<any>(`/api/escalations/${id}/acknowledge`, {
        method: 'PATCH',
        body: JSON.stringify(data || {}),
      }),
    resolve: (id: string, data?: { resolution_notes?: string }) =>
      request<any>(`/api/escalations/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify(data || {}),
      }),
  },

  dashboard: {
    summary: () => request<{
      totalWorkspaces: number;
      totalCustomers: number;
      openEscalations: number;
      stageDistribution: Record<string, number>;
    }>('/api/dashboard/summary'),
  },

  quotes: {
    listByWorkspace: (workspaceId: string) =>
      request<any[]>(`/api/workspaces/${workspaceId}/quotes`),
    get: (id: string) => request<any>(`/api/quotes/${id}`),
    create: (workspaceId: string, data: Record<string, any>) =>
      request<any>(`/api/workspaces/${workspaceId}/quotes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/quotes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    submit: (id: string) =>
      request<any>(`/api/quotes/${id}/submit`, { method: 'POST' }),
    approve: (id: string) =>
      request<any>(`/api/quotes/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason: string) =>
      request<any>(`/api/quotes/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    createVersion: (id: string, changeReason: string) =>
      request<any>(`/api/quotes/${id}/create-version`, {
        method: 'POST',
        body: JSON.stringify({ change_reason: changeReason }),
      }),
  },

  proposals: {
    listByWorkspace: (workspaceId: string) =>
      request<any[]>(`/api/workspaces/${workspaceId}/proposals`),
    get: (id: string) => request<any>(`/api/proposals/${id}`),
    create: (workspaceId: string, data: Record<string, any>) =>
      request<any>(`/api/workspaces/${workspaceId}/proposals`, {
        method: 'POST', body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/proposals/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      }),
    submitReview: (id: string) =>
      request<any>(`/api/proposals/${id}/submit-review`, { method: 'POST' }),
    markReadyCRM: (id: string) =>
      request<any>(`/api/proposals/${id}/mark-ready-crm`, { method: 'POST' }),
    markSent: (id: string) =>
      request<any>(`/api/proposals/${id}/mark-sent`, { method: 'POST' }),
    markNegotiation: (id: string) =>
      request<any>(`/api/proposals/${id}/mark-negotiation`, { method: 'POST' }),
    approve: (id: string) =>
      request<any>(`/api/proposals/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason: string) =>
      request<any>(`/api/proposals/${id}/reject`, {
        method: 'POST', body: JSON.stringify({ reason }),
      }),
    createVersion: (id: string, changeReason: string) =>
      request<any>(`/api/proposals/${id}/create-version`, {
        method: 'POST', body: JSON.stringify({ change_reason: changeReason }),
      }),
  },

  slas: {
    listByWorkspace: (workspaceId: string) =>
      request<any[]>(`/api/workspaces/${workspaceId}/slas`),
    get: (id: string) => request<any>(`/api/slas/${id}`),
    create: (workspaceId: string, data: Record<string, any>) =>
      request<any>(`/api/workspaces/${workspaceId}/slas`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/slas/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    submit: (id: string) =>
      request<any>(`/api/slas/${id}/submit`, { method: 'POST' }),
    markOperationalReview: (id: string) =>
      request<any>(`/api/slas/${id}/mark-operational-review`, { method: 'POST' }),
    approve: (id: string) =>
      request<any>(`/api/slas/${id}/approve`, { method: 'POST' }),
    reject: (id: string, reason: string) =>
      request<any>(`/api/slas/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    createVersion: (id: string, changeReason: string) =>
      request<any>(`/api/slas/${id}/create-version`, { method: 'POST', body: JSON.stringify({ change_reason: changeReason }) }),
  },

  contractStatus: {
    get: (workspaceId: string) =>
      request<any>(`/api/workspaces/${workspaceId}/contract-status`),
    update: (workspaceId: string, data: Record<string, any>) =>
      request<any>(`/api/workspaces/${workspaceId}/contract-status`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  documents: {
    listByWorkspace: (workspaceId: string, filters?: Record<string, string>) => {
      const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return request<any[]>(`/api/workspaces/${workspaceId}/documents${qs}`);
    },
    listByCustomer: (customerId: string, filters?: Record<string, string>) => {
      const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return request<any[]>(`/api/customers/${customerId}/documents${qs}`);
    },
    search: (filters?: Record<string, string>) => {
      const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
      return request<any[]>(`/api/documents${qs}`);
    },
    get: (id: string) => request<any>(`/api/documents/${id}`),
    generatePdf: (data: { workspace_id: string; document_type: string; source_id: string; source_version?: number; language?: string; notes?: string }) =>
      request<any>(`/api/documents/generate-pdf`, { method: 'POST', body: JSON.stringify(data) }),
    download: (id: string) =>
      request<any>(`/api/documents/download/${id}`),
    updateStatus: (id: string, status: string) =>
      request<any>(`/api/documents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
};
