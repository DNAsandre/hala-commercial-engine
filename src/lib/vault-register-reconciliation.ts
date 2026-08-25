/**
 * vault-register-reconciliation.ts — PADW T06d (PDS-14), ADR treatment
 * "vault-vs-register reconciliation view / relink action".
 *
 * A tender upload writes THREE records (storage object → generated_documents
 * vault row → type_details.documents register entry). When step 3 fails the
 * customer file exists in the vault but appears in NO UI surface: the library
 * reads the register only, and the old toast said "check the library" — a
 * dead end. This module finds those stored-but-unlinked vault rows by exact
 * ids and builds the exact register entry a relink writes.
 *
 * Read-only against generated_documents; the relink write goes through the
 * EXISTING guarded register writer (addTenderDocument — exact-id dedup,
 * revision token, read-back, audit).
 */
import { supabase } from "./supabase";
import type { TenderDocument } from "./tender-workspace-data";

export interface VaultOnlyDocument {
  id: string;
  fileName: string;
  documentType: string;
  storagePath: string | null;
  status: string;
  createdAt: string;
}

/**
 * Vault rows recorded for THIS tender (exact source linkage) whose ids are
 * absent from the tender's document register. Archived vault rows are
 * excluded — they were removed deliberately.
 */
export async function listVaultOnlyTenderDocuments(
  tenderId: string,
  registerIds: readonly string[],
): Promise<{ documents: VaultOnlyDocument[]; error: string | null }> {
  const { data, error } = await supabase
    .from("generated_documents")
    .select("id, file_name, document_type, storage_path, status, created_at")
    .eq("source_type", "tender")
    .eq("source_id", tenderId);

  if (error) {
    // A failed read is NOT "no orphans" — the caller must say so.
    return { documents: [], error: error.message };
  }

  const known = new Set(registerIds);
  const documents = (data ?? [])
    .filter((row) => row.id && !known.has(row.id) && row.status !== "archived")
    .map((row) => ({
      id: String(row.id),
      fileName: String(row.file_name ?? "Unnamed file"),
      documentType: String(row.document_type ?? "Supporting"),
      storagePath: (row.storage_path as string | null) ?? null,
      status: String(row.status ?? "generated"),
      createdAt: String(row.created_at ?? ""),
    }));
  return { documents, error: null };
}

/**
 * The exact register entry a relink writes — same id as the vault row, so
 * the register and vault reconcile on one identity. Category defaults to
 * "Supporting"; the human can reclassify afterwards like any register row.
 */
export function buildRelinkRegisterEntry(
  tenderId: string,
  vaultDoc: VaultOnlyDocument,
): TenderDocument {
  const now = new Date().toISOString();
  return {
    id: vaultDoc.id,
    tender_id: tenderId,
    document_name: vaultDoc.fileName,
    document_category: "Supporting",
    document_type: vaultDoc.documentType || "Supporting Document",
    file_url: "",
    storage_path: vaultDoc.storagePath ?? "",
    version: "1",
    status: "Uploaded",
    stage_relevance: [],
    owner: "",
    uploaded_by: "",
    uploaded_at: vaultDoc.createdAt || now,
    received_date: vaultDoc.createdAt || now,
    expiry_date: "",
    required_for_submission: false,
    linked_requirement_id: "",
    linked_proposal_section: "",
    source_channel: "Vault relink",
    buyer_reference_number: "",
    notes: "Relinked from the document vault (stored file existed without a register entry).",
  };
}
