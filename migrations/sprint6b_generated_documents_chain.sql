-- ============================================================
-- Sprint 6b: Add missing columns to generated_documents
-- ============================================================
-- Corrective migration for tables created before these columns
-- were added to sprint6_generated_documents.sql.
-- Safe to re-run (IF NOT EXISTS guards).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_documents' AND column_name = 'supersedes_document_id'
  ) THEN
    ALTER TABLE generated_documents ADD COLUMN supersedes_document_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_documents' AND column_name = 'last_downloaded_at'
  ) THEN
    ALTER TABLE generated_documents ADD COLUMN last_downloaded_at TIMESTAMPTZ;
  END IF;
END $$;
