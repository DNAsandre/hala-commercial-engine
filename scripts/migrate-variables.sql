-- ============================================================
-- Wave 2: Semantic Variables — Supabase Table Creation + RLS
-- ============================================================

-- 1. variable_definitions
CREATE TABLE IF NOT EXISTS variable_definitions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  data_type TEXT NOT NULL DEFAULT 'text',
  scope TEXT NOT NULL DEFAULT 'global',
  source TEXT NOT NULL DEFAULT 'static',
  binding_path TEXT,
  default_value_json JSONB,
  allowed_in_doc_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  namespace TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE variable_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_definitions_select" ON variable_definitions FOR SELECT USING (true);
CREATE POLICY "variable_definitions_insert" ON variable_definitions FOR INSERT WITH CHECK (true);
CREATE POLICY "variable_definitions_update" ON variable_definitions FOR UPDATE USING (true);
CREATE POLICY "variable_definitions_delete" ON variable_definitions FOR DELETE USING (true);

-- 2. variable_sets
CREATE TABLE IF NOT EXISTS variable_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  template_version_id TEXT,
  variable_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE variable_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_sets_select" ON variable_sets FOR SELECT USING (true);
CREATE POLICY "variable_sets_insert" ON variable_sets FOR INSERT WITH CHECK (true);
CREATE POLICY "variable_sets_update" ON variable_sets FOR UPDATE USING (true);
CREATE POLICY "variable_sets_delete" ON variable_sets FOR DELETE USING (true);

-- 3. variable_set_items
CREATE TABLE IF NOT EXISTS variable_set_items (
  id TEXT PRIMARY KEY,
  variable_set_id TEXT NOT NULL REFERENCES variable_sets(id) ON DELETE CASCADE,
  variable_definition_id TEXT NOT NULL REFERENCES variable_definitions(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT false,
  fallback_mode TEXT NOT NULL DEFAULT 'warning'
);

ALTER TABLE variable_set_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variable_set_items_select" ON variable_set_items FOR SELECT USING (true);
CREATE POLICY "variable_set_items_insert" ON variable_set_items FOR INSERT WITH CHECK (true);
CREATE POLICY "variable_set_items_update" ON variable_set_items FOR UPDATE USING (true);
CREATE POLICY "variable_set_items_delete" ON variable_set_items FOR DELETE USING (true);

-- 4. doc_variable_overrides
CREATE TABLE IF NOT EXISTS doc_variable_overrides (
  id TEXT PRIMARY KEY,
  doc_instance_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_json JSONB,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dvo_doc_instance ON doc_variable_overrides(doc_instance_id);
CREATE INDEX IF NOT EXISTS idx_dvo_key ON doc_variable_overrides(key);

ALTER TABLE doc_variable_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_variable_overrides_select" ON doc_variable_overrides FOR SELECT USING (true);
CREATE POLICY "doc_variable_overrides_insert" ON doc_variable_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "doc_variable_overrides_update" ON doc_variable_overrides FOR UPDATE USING (true);
CREATE POLICY "doc_variable_overrides_delete" ON doc_variable_overrides FOR DELETE USING (true);
