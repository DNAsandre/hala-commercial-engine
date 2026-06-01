/**
 * Tender data lineage guard.
 *
 * Tender commercial truth must be traceable to an approved source import.
 * Rows without lineage are quarantined from business-facing UI.
 */

export type TenderLineageRow = {
  source_file?: string | null;
  source_sheet?: string | null;
  source_row?: number | string | null;
  import_batch_id?: string | null;
  truth_status?: string | null;
  data_confidence_status?: string | null;
  metadata?: Record<string, unknown> | null;
};

const VERIFIED_TRUTH_STATUSES = new Set([
  "verified",
  "verified_import",
  "verified_snapshot",
  "workbook_import",
]);

const REJECTED_TRUTH_STATUSES = new Set([
  "mock",
  "demo",
  "sample",
  "seed",
  "seeded",
  "unverified",
  "unverified_seed",
  "development_mock",
  "quarantined",
]);

export function hasVerifiedTenderLineage(row: TenderLineageRow): boolean {
  const truthStatus = row.truth_status?.toLowerCase().trim();
  const confidenceStatus = row.data_confidence_status?.toLowerCase().trim();

  if (truthStatus && REJECTED_TRUTH_STATUSES.has(truthStatus)) return false;
  if (confidenceStatus && REJECTED_TRUTH_STATUSES.has(confidenceStatus)) return false;
  if (truthStatus && VERIFIED_TRUTH_STATUSES.has(truthStatus)) return true;

  const metadata = row.metadata ?? {};
  const metadataSourceFile = typeof metadata.source_file === "string" ? metadata.source_file : "";
  const metadataSourceSheet = typeof metadata.source_sheet === "string" ? metadata.source_sheet : "";
  const metadataImportBatch = typeof metadata.import_batch_id === "string" ? metadata.import_batch_id : "";

  return Boolean(
    (row.source_file && row.source_sheet && row.source_row != null) ||
    (row.source_file && row.import_batch_id) ||
    (metadataSourceFile && metadataSourceSheet) ||
    metadataImportBatch
  );
}

export function splitVerifiedTenderRows<T extends TenderLineageRow>(rows: T[]): {
  verified: T[];
  quarantined: T[];
} {
  const verified: T[] = [];
  const quarantined: T[] = [];

  for (const row of rows) {
    if (hasVerifiedTenderLineage(row)) verified.push(row);
    else quarantined.push(row);
  }

  return { verified, quarantined };
}
