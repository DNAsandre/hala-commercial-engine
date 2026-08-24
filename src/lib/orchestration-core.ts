/**
 * orchestration-core.ts
 * ─────────────────────
 * Document PACKAGE primitives (PURE; network-free).
 *
 * PADW T05 (ADR-03 Ticket 4) removed the obsolete Tender AI Orchestration
 * Review surface: the suggestion store, the bucket-level field-path registry
 * (incl. its UNKNOWN paths), the dry-run apply service, and the review UI are
 * gone. What remains here is ONLY the document-package data shape that the
 * Tender Knowledge Base (tender-knowledge-base.ts, Wave 3) reuses to group
 * source documents. Nothing here reads or writes any tender field.
 */

// ═══════════════════════════════════════════════════════════
// Status vocabularies
// ═══════════════════════════════════════════════════════════

export const PACKAGE_STATUSES = [
  "draft",
  "ready",
  "processing",
  "completed",
  "failed",
  "archived",
] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export const ORCHESTRATION_MODES = [
  "manual_upload",
  "codex_test_harness",
  "api_package",
  "future_bulk_upload",
] as const;
export type OrchestrationMode = (typeof ORCHESTRATION_MODES)[number];

// ═══════════════════════════════════════════════════════════
// Data shape
// ═══════════════════════════════════════════════════════════

export interface OrchestrationPackage {
  id: string;
  tender_id: string;
  package_name: string;
  package_type?: string;
  document_ids: string[];
  status: PackageStatus;
  orchestration_mode?: OrchestrationMode;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════
// Pure builder — injectable id + clock so callers are deterministic in tests
// ═══════════════════════════════════════════════════════════

/** Injectable id + clock so builders are deterministic in tests. */
export interface CoreDeps {
  newId: () => string;
  now: () => string;
}

export const defaultDeps: CoreDeps = {
  newId: () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}`),
  now: () => new Date().toISOString(),
};

export interface NewPackageInput {
  tender_id: string;
  package_name: string;
  package_type?: string;
  document_ids?: string[];
  orchestration_mode?: OrchestrationMode;
  created_by?: string;
  status?: PackageStatus;
  notes?: string;
}

export function buildPackage(input: NewPackageInput, deps: CoreDeps = defaultDeps): OrchestrationPackage {
  return {
    id: deps.newId(),
    tender_id: input.tender_id,
    package_name: input.package_name,
    package_type: input.package_type,
    document_ids: Array.isArray(input.document_ids) ? input.document_ids : [],
    status: input.status ?? "draft",
    orchestration_mode: input.orchestration_mode,
    created_by: input.created_by,
    created_at: deps.now(),
    notes: input.notes,
  };
}
