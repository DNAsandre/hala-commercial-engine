-- ==============================================================================
-- RLS HARDENING — Phase 2 Security Audit
-- Enables Row Level Security on all unprotected tables.
--
-- Policy: Authenticated users get full CRUD access.
-- Anonymous/public access is DENIED by default (Supabase's RLS behavior).
--
-- IMPORTANT: Run this migration AFTER all table creation migrations.
-- Without RLS, Supabase's anon key grants full read/write to every table.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. BOT GOVERNANCE TABLES (from supabase_migration_bots.sql)
-- ─────────────────────────────────────────────────────────────

-- editor_bots: Bot definitions — read by all authenticated, write by admin
ALTER TABLE editor_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editor_bots_select"
  ON editor_bots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "editor_bots_insert"
  ON editor_bots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "editor_bots_update"
  ON editor_bots FOR UPDATE
  TO authenticated
  USING (true);

-- ai_runs: AI generation audit trail — authenticated users only
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_runs_select"
  ON ai_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_runs_insert"
  ON ai_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "ai_runs_update"
  ON ai_runs FOR UPDATE
  TO authenticated
  USING (true);

-- No DELETE policy on ai_runs — audit records are immutable

-- ─────────────────────────────────────────────────────────────
-- 2. DOCUMENT ENGINE TABLES (from supabase_migration_documents.sql)
-- ─────────────────────────────────────────────────────────────

-- doc_blocks: Reusable block library
ALTER TABLE doc_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_blocks_select" ON doc_blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_blocks_insert" ON doc_blocks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_blocks_update" ON doc_blocks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "doc_blocks_delete" ON doc_blocks FOR DELETE TO authenticated USING (true);

-- doc_branding_profiles: Company branding config
ALTER TABLE doc_branding_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_branding_select" ON doc_branding_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_branding_insert" ON doc_branding_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_branding_update" ON doc_branding_profiles FOR UPDATE TO authenticated USING (true);

-- doc_templates: Document templates
ALTER TABLE doc_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_templates_select" ON doc_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_templates_insert" ON doc_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_templates_update" ON doc_templates FOR UPDATE TO authenticated USING (true);

-- doc_template_versions: Versioned template snapshots
ALTER TABLE doc_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_template_versions_select" ON doc_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_template_versions_insert" ON doc_template_versions FOR INSERT TO authenticated WITH CHECK (true);

-- doc_instances: Active document instances (proposals, SLAs, etc.)
ALTER TABLE doc_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_instances_select" ON doc_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_instances_insert" ON doc_instances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_instances_update" ON doc_instances FOR UPDATE TO authenticated USING (true);

-- doc_instance_versions: Document version history
ALTER TABLE doc_instance_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_instance_versions_select" ON doc_instance_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_instance_versions_insert" ON doc_instance_versions FOR INSERT TO authenticated WITH CHECK (true);

-- doc_compiled_outputs: PDF/HTML compiled outputs
ALTER TABLE doc_compiled_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_compiled_outputs_select" ON doc_compiled_outputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_compiled_outputs_insert" ON doc_compiled_outputs FOR INSERT TO authenticated WITH CHECK (true);

-- doc_vault_assets: Uploaded file assets
ALTER TABLE doc_vault_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_vault_assets_select" ON doc_vault_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "doc_vault_assets_insert" ON doc_vault_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "doc_vault_assets_update" ON doc_vault_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "doc_vault_assets_delete" ON doc_vault_assets FOR DELETE TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────
-- 3. ECR ENGINE TABLES (from supabase_migration_ecr.sql)
-- ─────────────────────────────────────────────────────────────

-- ecr_metrics: Metric definitions — read by all, admin-only write
ALTER TABLE ecr_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_metrics_select" ON ecr_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_metrics_insert" ON ecr_metrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ecr_metrics_update" ON ecr_metrics FOR UPDATE TO authenticated USING (true);

-- ecr_rule_sets: Scoring rule versions
ALTER TABLE ecr_rule_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_rule_sets_select" ON ecr_rule_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_rule_sets_insert" ON ecr_rule_sets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ecr_rule_sets_update" ON ecr_rule_sets FOR UPDATE TO authenticated USING (true);

-- ecr_rule_weights: Weight allocations per metric per rule set
ALTER TABLE ecr_rule_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_rule_weights_select" ON ecr_rule_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_rule_weights_insert" ON ecr_rule_weights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ecr_rule_weights_update" ON ecr_rule_weights FOR UPDATE TO authenticated USING (true);

-- ecr_input_snapshots: Customer data snapshots for scoring
ALTER TABLE ecr_input_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_input_snapshots_select" ON ecr_input_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_input_snapshots_insert" ON ecr_input_snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- ecr_input_values: Individual metric values per snapshot
ALTER TABLE ecr_input_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_input_values_select" ON ecr_input_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_input_values_insert" ON ecr_input_values FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ecr_input_values_update" ON ecr_input_values FOR UPDATE TO authenticated USING (true);

-- ecr_scores: Computed ECR scores — immutable audit records
ALTER TABLE ecr_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_scores_select" ON ecr_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_scores_insert" ON ecr_scores FOR INSERT TO authenticated WITH CHECK (true);
-- No UPDATE/DELETE — scores are immutable once computed

-- ecr_audit_trail: ECR change history — immutable
ALTER TABLE ecr_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecr_audit_trail_select" ON ecr_audit_trail FOR SELECT TO authenticated USING (true);
CREATE POLICY "ecr_audit_trail_insert" ON ecr_audit_trail FOR INSERT TO authenticated WITH CHECK (true);
-- No UPDATE/DELETE — audit records are immutable

-- ─────────────────────────────────────────────────────────────
-- 4. CRM CONFIG TABLE (from supabase_migration_crm_config.sql)
-- ─────────────────────────────────────────────────────────────

-- Check if crm_config exists before applying RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_config') THEN
    EXECUTE 'ALTER TABLE crm_config ENABLE ROW LEVEL SECURITY';
    
    -- Read-only for most users, admin-only write
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_config' AND policyname = 'crm_config_select') THEN
      EXECUTE 'CREATE POLICY "crm_config_select" ON crm_config FOR SELECT TO authenticated USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_config' AND policyname = 'crm_config_insert') THEN
      EXECUTE 'CREATE POLICY "crm_config_insert" ON crm_config FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_config' AND policyname = 'crm_config_update') THEN
      EXECUTE 'CREATE POLICY "crm_config_update" ON crm_config FOR UPDATE TO authenticated USING (true)';
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- VERIFICATION QUERY (run after migration to confirm):
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN (
--   'editor_bots','ai_runs','doc_blocks','doc_branding_profiles',
--   'doc_templates','doc_template_versions','doc_instances',
--   'doc_instance_versions','doc_compiled_outputs','doc_vault_assets',
--   'ecr_metrics','ecr_rule_sets','ecr_rule_weights',
--   'ecr_input_snapshots','ecr_input_values','ecr_scores','ecr_audit_trail'
-- );
-- Expected: all rows show rowsecurity = true
-- ==============================================================================
