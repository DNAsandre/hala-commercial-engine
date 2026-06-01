-- TND-005: Quarantine unverified tender seed/demo records
--
-- DO NOT let a bot run this automatically.
-- Human DBA/app owner should review, then run manually in Supabase SQL editor.
--
-- Purpose:
-- - Add explicit lineage/truth columns to tender records.
-- - Mark existing tenders with no approved import lineage as quarantined.
-- - Preserve records for forensic review instead of deleting evidence.

ALTER TABLE tenders
  ADD COLUMN IF NOT EXISTS source_file TEXT,
  ADD COLUMN IF NOT EXISTS source_sheet TEXT,
  ADD COLUMN IF NOT EXISTS source_row INTEGER,
  ADD COLUMN IF NOT EXISTS import_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS truth_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

UPDATE tenders
SET
  truth_status = 'quarantined',
  quarantined_at = COALESCE(quarantined_at, NOW()),
  quarantine_reason = COALESCE(
    quarantine_reason,
    'No approved Rolling Profitability workbook lineage. Hidden from business UI until source_file/source_sheet/source_row/import_batch_id are verified.'
  )
WHERE
  truth_status IS DISTINCT FROM 'verified_import'
  AND truth_status IS DISTINCT FROM 'verified_snapshot'
  AND (
    source_file IS NULL
    OR source_sheet IS NULL
    OR source_row IS NULL
    OR import_batch_id IS NULL
  );

-- Human verification path:
-- 1. Re-import real tender records from approved source files only.
-- 2. Populate source_file, source_sheet, source_row, import_batch_id.
-- 3. Set truth_status = 'verified_import' only after checking against the workbook/source document.
