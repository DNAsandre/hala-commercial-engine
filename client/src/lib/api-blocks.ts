/**
 * Block API Client — Sprint 3
 * CRUD operations for document blocks via /api/blocks endpoints.
 */

import { api } from './api-client';

// Re-use the shared request helper from api-client
const BASE = '/api/blocks';

async function request<T>(url: string, opts?: RequestInit): Promise<{ data: T }> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface CreateBlockInput {
  block_key: string;
  display_name: string;
  family: 'commercial' | 'data_bound' | 'legal' | 'annexure' | 'asset';
  editor_mode: 'wysiwyg' | 'form' | 'readonly' | 'clause';
  description?: string;
  default_content?: string;
  render_key?: string;
  permissions?: {
    editable_in_draft?: boolean;
    editable_in_canon?: boolean;
    ai_allowed?: boolean;
    lockable?: boolean;
  };
  schema?: {
    variable_slots?: string[];
    config?: Record<string, string>;
  };
}

export interface UpdateBlockInput {
  display_name?: string;
  family?: 'commercial' | 'data_bound' | 'legal' | 'annexure' | 'asset';
  editor_mode?: 'wysiwyg' | 'form' | 'readonly' | 'clause';
  description?: string;
  default_content?: string;
  render_key?: string;
  permissions?: {
    editable_in_draft?: boolean;
    editable_in_canon?: boolean;
    ai_allowed?: boolean;
    lockable?: boolean;
  };
  schema?: {
    variable_slots?: string[];
    config?: Record<string, string>;
  };
}

export const blocksApi = {
  /** List all blocks */
  list: () => request<any[]>(BASE),

  /** Get single block by ID */
  get: (id: string) => request<any>(`${BASE}/${id}`),

  /** Create a new block */
  create: (data: CreateBlockInput) =>
    request<any>(BASE, { method: 'POST', body: JSON.stringify(data) }),

  /** Update an existing block */
  update: (id: string, data: UpdateBlockInput) =>
    request<any>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Delete a block */
  delete: (id: string) =>
    request<any>(`${BASE}/${id}`, { method: 'DELETE' }),
};
