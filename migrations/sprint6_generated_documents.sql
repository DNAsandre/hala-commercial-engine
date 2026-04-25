-- ============================================================
-- Sprint 6: Generated Documents Metadata + Storage Setup
-- ============================================================
-- Run in Supabase SQL Editor (Hala Commercial engine)
-- ============================================================

CREATE TABLE IF NOT EXISTS generated_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  customer_id TEXT,
  document_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version INTEGER,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT DEFAULT 'application/pdf',
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'generated',
  generated_by TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  version_number INTEGER DEFAULT 1,
  checksum TEXT,
  notes TEXT DEFAULT '',
  supersedes_document_id UUID,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gendocs_select_auth" ON generated_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "gendocs_insert_auth" ON generated_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gendocs_update_auth" ON generated_documents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gendocs_service" ON generated_documents FOR ALL TO service_role USING (true);

-- Create storage bucket (run via Supabase Dashboard > Storage if this fails)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
-- ON CONFLICT (id) DO NOTHING;
