-- ============================================================
-- DOC-001: Document Vault
-- Artifact governance for Commercial OS documents.
--
-- Doctrine:
--   - Schema only. No seeded document records.
--   - Source files remain the system of record.
--   - Vault entries must come from explicit uploads, verified imports,
--     or human-reviewed migrations with source lineage.
--   - No fake defaults for business fields.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_vault (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type         text,
  document_title        text,
  related_entity_type   text,
  related_entity_id     text,
  source_batch_id       text,
  source_system         text,
  source_file_name      text,
  storage_reference     text,
  version_number        integer,
  version_status        text,
  truth_status          text,
  confidence_tier       integer,
  source_lineage        text,
  generated_at          timestamptz,
  created_by            text,
  notes                 text,
  active                boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dv_type     ON document_vault(document_type);
CREATE INDEX IF NOT EXISTS idx_dv_entity   ON document_vault(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_dv_batch    ON document_vault(source_batch_id);
CREATE INDEX IF NOT EXISTS idx_dv_status   ON document_vault(version_status);

ALTER TABLE document_vault ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_vault'
      AND policyname = 'document_vault_read_all'
  ) THEN
    CREATE POLICY document_vault_read_all
      ON document_vault
      FOR SELECT
      USING (true);
  END IF;
END $$;
