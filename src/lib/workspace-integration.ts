/**
 * workspace-integration.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.5).
 *
 * Supporting-document records persist to the Supabase generated_documents
 * table (established upload wiring). The session registry below is populated
 * ONLY from those rows and from real user actions in this session — it is
 * never seeded.
 *
 * Renewal-cycle persistence has no established source in this build
 * (Renewals is an approved honest placeholder), so the cycle-mutation
 * entry points fail explicitly instead of pretending to succeed.
 */

import { getCurrentUser } from "./auth-state";
import { supabase } from "./supabase";
import { handleSupabaseError } from "@/lib/supabase-error";

// ─── FEATURE FLAG ───────────────────────────────────────────

const featureFlags = {
  workspaceIntegrationV1: true,
};

export function isWorkspaceIntegrationEnabled(): boolean {
  return featureFlags.workspaceIntegrationV1;
}

// ─── CONTRACT CYCLE ─────────────────────────────────────────

// Internal (non-exported) union referenced by ContractCycle.
type CycleStatus =
  | "draft"
  | "active"
  | "expiring"
  | "renewal_window"
  | "renewal_in_progress"
  | "closed";

export interface ContractCycle {
  id: string;
  workspaceId: string;
  cycleNumber: number;
  status: CycleStatus;
  startDate?: string;
  endDate?: string; // expiry
  renewalWindowDays: number;
  renewalOwnerId?: string;
  renewalOwnerName?: string;
  linkedSlaVersionId?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * HONEST UNAVAILABLE: renewal-cycle records have no established persistence
 * source in this build. Throws so callers surface the failure instead of
 * showing a success that was never stored.
 */
export function updateRenewalOwner(cycleId: string, ownerId: string, ownerName: string): void {
  void cycleId;
  void ownerId;
  void ownerName;
  throw new Error("Renewal cycle updates are not available in this build: renewal-cycle persistence has no established source.");
}

/** Compute days to expiry */
export function getDaysToExpiry(endDate?: string): number | null {
  if (!endDate) return null;
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** Check if within renewal window */
export function isInRenewalWindow(cycle: ContractCycle): boolean {
  if (!cycle.endDate) return false;
  const daysLeft = getDaysToExpiry(cycle.endDate);
  if (daysLeft === null) return false;
  return daysLeft > 0 && daysLeft <= cycle.renewalWindowDays;
}

// ─── SUPPORTING DOCS ────────────────────────────────────────

export type SupportDocCategory =
  | "Insurance"
  | "Trade License"
  | "Tax Certificate"
  | "Bank Guarantee"
  | "Power of Attorney"
  | "Technical Specs"
  | "Compliance Certificate"
  | "Other";

export const SUPPORT_DOC_CATEGORIES: SupportDocCategory[] = [
  "Insurance",
  "Trade License",
  "Tax Certificate",
  "Bank Guarantee",
  "Power of Attorney",
  "Technical Specs",
  "Compliance Certificate",
  "Other",
];

export interface SupportingDoc {
  id: string;
  workspaceId: string;
  name: string;
  fileName: string;
  category: SupportDocCategory;
  isRequiredForContractReady: boolean;
  linkedCycleId?: string;
  version: number;
  status: "active" | "archived" | "deleted";
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

// Session registry: filled only from generated_documents reads and real
// session actions. Never seeded.
const supportingDocs: SupportingDoc[] = [];
const loadedWorkspaces = new Set<string>();

function isSupportCategory(value: unknown): value is SupportDocCategory {
  return SUPPORT_DOC_CATEGORIES.includes(value as SupportDocCategory);
}

function mapRowToSupportingDoc(row: any): SupportingDoc {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.file_name ?? "",
    fileName: row.file_name ?? "",
    category: isSupportCategory(row.document_type) ? row.document_type : "Other",
    // No persisted column exists for this flag; it is session-scoped.
    isRequiredForContractReady: false,
    linkedCycleId: undefined,
    version: row.version_number || 1,
    status: row.status === "archived" ? "archived" : "active",
    uploadedBy: row.generated_by ?? "",
    uploadedAt: row.generated_at ?? row.created_at ?? "",
    notes: row.notes || undefined,
  };
}

function refreshSupportingDocs(workspaceId: string): void {
  void supabase
    .from("generated_documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("document_type", SUPPORT_DOC_CATEGORIES)
    .order("generated_at", { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        handleSupabaseError("getSupportingDocs", error, { silent: true });
        return;
      }
      // Replace this workspace's slice with the live rows, preserving the
      // session-scoped flags of records already present.
      const sessionFlags = new Map(
        supportingDocs
          .filter(d => d.workspaceId === workspaceId)
          .map(d => [d.id, { required: d.isRequiredForContractReady, cycle: d.linkedCycleId }] as const),
      );
      for (let i = supportingDocs.length - 1; i >= 0; i--) {
        if (supportingDocs[i].workspaceId === workspaceId) supportingDocs.splice(i, 1);
      }
      for (const row of data ?? []) {
        const doc = mapRowToSupportingDoc(row);
        const flags = sessionFlags.get(doc.id);
        if (flags) {
          doc.isRequiredForContractReady = flags.required;
          doc.linkedCycleId = flags.cycle;
        }
        supportingDocs.push(doc);
      }
    });
}

/** Get supporting docs for a workspace (from generated_documents). */
export function getSupportingDocs(workspaceId: string, includeArchived = false): SupportingDoc[] {
  if (!loadedWorkspaces.has(workspaceId)) {
    loadedWorkspaces.add(workspaceId);
    refreshSupportingDocs(workspaceId);
  }
  return supportingDocs.filter(d =>
    d.workspaceId === workspaceId &&
    (includeArchived || d.status === "active")
  );
}

/**
 * Register a supporting document record. Persists a metadata row to
 * generated_documents (no file content is attached by this entry point, and
 * none is claimed — storage_path stays empty). If the insert fails the
 * session record is removed and the error is surfaced.
 */
export function uploadSupportingDoc(input: {
  workspaceId: string;
  name: string;
  fileName: string;
  category: SupportDocCategory;
  isRequired?: boolean;
  linkedCycleId?: string;
  notes?: string;
}): SupportingDoc {
  const id = crypto.randomUUID();
  const doc: SupportingDoc = {
    id,
    workspaceId: input.workspaceId,
    name: input.name,
    fileName: input.fileName,
    category: input.category,
    isRequiredForContractReady: input.isRequired ?? false,
    linkedCycleId: input.linkedCycleId,
    version: 1,
    status: "active",
    uploadedBy: getCurrentUser().name,
    uploadedAt: new Date().toISOString(),
    notes: input.notes,
  };
  supportingDocs.push(doc);

  void supabase
    .from("generated_documents")
    .insert({
      id,
      workspace_id: input.workspaceId,
      customer_id: null,
      document_type: input.category,
      source_type: "ticket",
      source_id: input.workspaceId,
      source_version: 1,
      file_name: input.fileName,
      file_size: 0,
      mime_type: "application/octet-stream",
      storage_path: "",
      status: "generated",
      version_number: 1,
      generated_by: getCurrentUser().id || "system",
      notes: input.notes || "",
    })
    .then(({ error }) => {
      if (error) {
        // Roll the session record back — nothing was persisted.
        const idx = supportingDocs.findIndex(d => d.id === id);
        if (idx >= 0) supportingDocs.splice(idx, 1);
        handleSupabaseError("uploadSupportingDoc", error, { silent: false });
      }
    });

  return doc;
}

/**
 * Toggle the "required for contract ready" flag. This flag has no persisted
 * column in generated_documents, so it is session-scoped by design.
 */
export function toggleRequiredForContract(docId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.isRequiredForContractReady = !doc.isRequiredForContractReady;
  return doc;
}

/**
 * HONEST UNAVAILABLE: renewal-cycle linkage has no established persistence
 * source in this build. Throws so callers surface the failure instead of
 * showing a success that was never stored.
 */
export function linkDocToCycle(docId: string, cycleId: string): SupportingDoc | null {
  void docId;
  void cycleId;
  throw new Error("Linking documents to renewal cycles is not available in this build: renewal-cycle persistence has no established source.");
}

function persistSupportDocStatus(docId: string, status: "generated" | "archived"): void {
  void supabase
    .from("generated_documents")
    .update({ status })
    .eq("id", docId)
    .then(({ error }) => {
      if (error) handleSupabaseError("supportingDocStatusUpdate", error, { silent: true });
    });
}

/** Archive a supporting doc (persists archived status). */
export function archiveSupportingDoc(docId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "archived";
  persistSupportDocStatus(docId, "archived");
  return doc;
}

/** Restore a supporting doc (persists active status). */
export function restoreSupportingDoc(docId: string): SupportingDoc | null {
  const doc = supportingDocs.find(d => d.id === docId);
  if (!doc) return null;
  doc.status = "active";
  persistSupportDocStatus(docId, "generated");
  return doc;
}

// ─── TEAM MEMBERS (for renewal owner dropdown) ──────────────
// Derived from the real authenticated user only — no invented people.
export const teamMembers = [
  { id: getCurrentUser().id, name: getCurrentUser().name, role: getCurrentUser().role },
];
