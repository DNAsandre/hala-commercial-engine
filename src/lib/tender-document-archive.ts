import {
  getPersistedDocumentStatus,
  restoreDocument,
  softDeleteDocument,
} from "@/lib/document-vault";
import { archiveTenderDocument } from "@/lib/supabase-tender-actions";

export interface TenderDocumentArchiveResult {
  success: boolean;
  error?: string;
  auditWarning?: string;
}

/**
 * Archive the optional vault row and the canonical Tender document entry.
 * Canonical-only documents remain archiveable. If the canonical write fails,
 * the vault row is restored to its exact previous status or the compensation
 * failure is returned explicitly.
 */
export async function archiveTenderDocumentRecords(
  tenderId: string,
  documentId: string,
): Promise<TenderDocumentArchiveResult> {
  const originalVaultStatus = await getPersistedDocumentStatus(documentId);
  const changedVault = originalVaultStatus !== null && originalVaultStatus !== "archived";

  if (changedVault) await softDeleteDocument(documentId);

  const canonical = await archiveTenderDocument(tenderId, documentId);
  if (canonical.success) return canonical;

  let rollbackError: string | null = null;
  if (changedVault && originalVaultStatus !== null) {
    try {
      await restoreDocument(documentId, originalVaultStatus);
    } catch (error) {
      rollbackError = error instanceof Error ? error.message : String(error);
    }
  }

  const archiveError = canonical.error || "The Tender document register did not confirm the archive.";
  return {
    success: false,
    error: rollbackError
      ? `${archiveError} The vault rollback also failed: ${rollbackError}. Reload to inspect the stored truth.`
      : archiveError,
  };
}
