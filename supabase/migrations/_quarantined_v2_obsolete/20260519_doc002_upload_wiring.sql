-- ============================================================
-- DOC-002: Supporting Documents Upload Wiring
-- Fixes route to use commercial_v2_documents instead of the
-- non-existent generated_documents table.
-- Also relaxes parent_id to text (tender IDs are strings like "tn-002")
-- ============================================================

-- Relax parent_id to text so string tender IDs work
ALTER TABLE commercial_v2_documents
  ALTER COLUMN parent_id TYPE text;

-- Add tender as valid parent type (was already in CHECK constraint)
-- The CHECK constraint already includes 'tender' via the IN list

-- Add RLS INSERT policy so the app-layer upload route can write
-- (Read policy v2_documents_read_all already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'commercial_v2_documents'
    AND policyname = 'v2_documents_insert'
    AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY v2_documents_insert ON commercial_v2_documents
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;