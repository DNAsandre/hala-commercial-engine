-- ============================================================
-- Sprint 7: Document Versioning Enhancement
-- ============================================================
-- Run in Supabase SQL Editor (Hala Commercial engine)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_documents' AND column_name='supersedes_document_id') THEN
    ALTER TABLE generated_documents ADD COLUMN supersedes_document_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_documents' AND column_name='last_downloaded_at') THEN
    ALTER TABLE generated_documents ADD COLUMN last_downloaded_at TIMESTAMPTZ;
  END IF;
END $$;
