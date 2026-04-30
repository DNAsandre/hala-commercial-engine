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
    listAll: () => request<any[]>(`/api/slas`),
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

  templates: {
    list: () => request<any[]>('/api/templates'),
    create: (data: {
      name: string;
      doc_type: string;
      description?: string;
      default_branding_profile_id?: string | null;
      default_locale?: string;
    }) => request<any>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    addVersion: (id: string, recipe: any[], layout: Record<string, any>) =>
      request<any>(`/api/templates/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ recipe, layout }),
      }),
    publishVersion: (templateId: string, versionId: string) =>
      request<any>(`/api/templates/${templateId}/versions/${versionId}/publish`, { method: 'PUT' }),
  },

  branding: {
    list: () => request<any[]>('/api/branding'),
    create: (data: Record<string, any>) =>
      request<any>('/api/branding', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/api/branding/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<any>(`/api/branding/${id}`, { method: 'DELETE' }),
  },

  blocks: {
    list: () => request<any[]>('/api/blocks'),
  },

  docInstances: {
    list: (filters?: { workspace_id?: string; customer_id?: string; doc_type?: string }) => {
      const params = new URLSearchParams();
      if (filters?.workspace_id) params.set('workspace_id', filters.workspace_id);
      if (filters?.customer_id) params.set('customer_id', filters.customer_id);
      if (filters?.doc_type) params.set('doc_type', filters.doc_type);
      const qs = params.toString();
      return request<any[]>(`/api/doc-instances${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<any>(`/api/doc-instances/${id}`),
    create: (data: {
      doc_type: string;
      template_version_id?: string | null;
      customer_id?: string | null;
      customer_name?: string;
      workspace_id?: string | null;
      workspace_name?: string | null;
      title?: string;
      branding_profile_id?: string | null;
      linked_entity_type?: string | null;
      linked_entity_id?: string | null;
      initial_blocks?: any[];
    }) => request<any>('/api/doc-instances', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { title?: string; status?: string; branding_profile_id?: string | null }) =>
      request<any>(`/api/doc-instances/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    saveVersion: (id: string, blocks: any[], bindings?: Record<string, any>) =>
      request<any>(`/api/doc-instances/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ blocks, bindings: bindings ?? {} }),
      }),
    compile: (id: string, opts?: {
      branding_profile_id?: string | null;
      title?: string;
      variables?: Record<string, string>;
    }) => request<any>(`/api/doc-instances/${id}/compile`, {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    }),
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

  // ─── Bot Governance ────────────────────────────────────────
  botGovernance: {
    // Bots
    listBots: () => request<any[]>('/api/bots'),
    getBot: (id: string) => request<any>(`/api/bots/${id}`),
    createBot: (data: Record<string, any>) =>
      request<any>('/api/bots', { method: 'POST', body: JSON.stringify(data) }),
    updateBot: (id: string, data: Record<string, any>) =>
      request<any>(`/api/bots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBot: (id: string) =>
      request<any>(`/api/bots/${id}`, { method: 'DELETE' }),

    // Versions
    listVersions: (botId: string) => request<any[]>(`/api/bots/${botId}/versions`),
    createVersion: (botId: string, data: Record<string, any>) =>
      request<any>(`/api/bots/${botId}/versions`, { method: 'POST', body: JSON.stringify(data) }),

    // Providers
    listProviders: () => request<any[]>('/api/bot-providers'),
    updateProvider: (id: string, data: { enabled: boolean }) =>
      request<any>(`/api/bot-providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    checkAllHealth: () =>
      request<any[]>('/api/bot-providers/health-check', { method: 'POST' }),
    checkProviderHealth: (id: string) =>
      request<any>(`/api/bot-providers/${id}/health-check`, { method: 'POST' }),

    // Connectors
    listConnectors: () => request<any[]>('/api/bot-connectors'),
    updateConnector: (id: string, data: { enabled: boolean }) =>
      request<any>(`/api/bot-connectors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Signal Rules
    listSignalRules: () => request<any[]>('/api/signal-rules'),
    createSignalRule: (data: Record<string, any>) =>
      request<any>('/api/signal-rules', { method: 'POST', body: JSON.stringify(data) }),
    updateSignalRule: (id: string, data: Record<string, any>) =>
      request<any>(`/api/signal-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Signal Events
    listSignalEvents: (filters?: { severity?: string; acknowledged?: string }) => {
      const params = new URLSearchParams();
      if (filters?.severity) params.set('severity', filters.severity);
      if (filters?.acknowledged) params.set('acknowledged', filters.acknowledged);
      const qs = params.toString();
      return request<any[]>(`/api/signal-events${qs ? `?${qs}` : ''}`);
    },
    acknowledgeSignal: (id: string) =>
      request<any>(`/api/signal-events/${id}/acknowledge`, { method: 'PATCH' }),

    // Invocations
    listInvocations: (botId?: string) => {
      const qs = botId && botId !== 'all' ? `?bot_id=${botId}` : '';
      return request<any[]>(`/api/bot-invocations${qs}`);
    },

    // Settings
    getSettings: () => request<any>('/api/bot-settings'),
    updateSettings: (data: Record<string, any>) =>
      request<any>('/api/bot-settings', { method: 'PUT', body: JSON.stringify(data) }),

    // Invocations — server-side execution
    invoke: (botId: string, data: { context: string; context_type: string; input_payload?: string }) =>
      request<any>(`/api/bots/${botId}/invoke`, { method: 'POST', body: JSON.stringify(data) }),

    // Signal Scanner — S3-06
    runSignalScanner: () =>
      request<any>('/api/signal-scanner/run', { method: 'POST' }),

    // Block Quick Actions — S3-07
    quickAction: (data: { action: string; content: string; context_type?: string }) =>
      request<any>('/api/bots/quick-action', { method: 'POST', body: JSON.stringify(data) }),
  },

  // System Settings
  systemSettings: {
    get: () => request<any>('/api/system-settings'),
    update: (settings: Record<string, any>) =>
      request<any>('/api/system-settings', { method: 'PUT', body: JSON.stringify(settings) }),
  },

  // System Health
  systemHealth: {
    get: () => request<{ modules: Array<{ name: string; status: string; lastActivity: string; details?: string }> }>('/api/system-health'),
    integrations: () => request<{ integrations: Array<{ name: string; status: string; description: string; connectionInfo: string }> }>('/api/integration-status'),
  },

  // Handovers
  handovers: {
    list: () => request<any[]>('/api/handovers'),
    get: (id: string) => request<any>(`/api/handovers/${id}`),
    create: (data: Record<string, any>) => request<any>('/api/handovers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, any>) => request<any>(`/api/handovers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ECR Rules
  ecr: {
    getRuleSets: () => request<{ ruleSets: any[], weights: any[] }>('/api/ecr/rule-sets'),
    createRuleSet: (ruleSet: any, weights: any[]) => request<any>('/api/ecr/rule-sets', { method: 'POST', body: JSON.stringify({ ruleSet, weights }) }),
    updateRuleSet: (id: string, payload: any) => request<any>(`/api/ecr/rule-sets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
    updateWeights: (id: string, weights: any[]) => request<any>(`/api/ecr/rule-sets/${id}/weights`, { method: 'PUT', body: JSON.stringify({ weights }) }),
  },
};
