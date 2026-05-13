-- ════════════════════════════════════════════════════════════════
-- SUPA-002: Commercial Workspace + Tender Workspace Tables
-- Run: 2026-05-04
-- Author: Antigravity / Hala Commercial Engine
--
-- Creates tables for:
--   Commercial: quote scenarios, pricing lines, P&L snapshots,
--     customer scores, capacity fits, revenue realization,
--     mock escalations, proposal versions, SLA drafts,
--     activity events, audit events, governance config
--   Tender: packs, pack sections, placeholders, required documents,
--     compliance items, submission gates, activity events,
--     audit events, governance config
--
-- SAFE: All CREATE IF NOT EXISTS. Re-runnable.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- COMMERCIAL WORKSPACE TABLES
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  "group" TEXT,
  status TEXT,
  city TEXT,
  region TEXT,
  industry TEXT,
  account_owner TEXT,
  service_type TEXT,
  grade TEXT,
  facility TEXT,
  payment_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'commercial',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id),
  customer_name TEXT,
  region TEXT,
  phase TEXT,
  submission_deadline TEXT,
  estimated_value NUMERIC,
  target_gp_percent NUMERIC,
  probability_percent NUMERIC,
  assigned_owner TEXT,
  source TEXT,
  days_in_status INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_quote_scenarios (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  version          TEXT DEFAULT 'v0.1',
  status           TEXT DEFAULT 'draft_scenario',
  revenue          NUMERIC DEFAULT 0,
  cost             NUMERIC DEFAULT 0,
  gp_percent       NUMERIC DEFAULT 0,
  pricing_posture  TEXT,
  customer_score   TEXT,
  capacity_fit     TEXT,
  revenue_timing   TEXT,
  mock_escalation  TEXT,
  owner            TEXT,
  notes            TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_pricing_lines (
  id               TEXT PRIMARY KEY,
  scenario_id      TEXT NOT NULL REFERENCES commercial_quote_scenarios(id) ON DELETE CASCADE,
  service_category TEXT NOT NULL,
  service_name     TEXT NOT NULL,
  description      TEXT DEFAULT '',
  unit             TEXT,
  volume           INTEGER DEFAULT 0,
  selling_rate     NUMERIC DEFAULT 0,
  revenue          NUMERIC DEFAULT 0,
  cost_rate        NUMERIC DEFAULT 0,
  cost             NUMERIC DEFAULT 0,
  gross_profit     NUMERIC DEFAULT 0,
  gp_percent       NUMERIC DEFAULT 0,
  cost_owner       TEXT,
  selling_owner    TEXT,
  assumption       TEXT DEFAULT '',
  risk_level       TEXT DEFAULT 'Low',
  risk_reason      TEXT DEFAULT '',
  review_status    TEXT DEFAULT 'Draft Mock',
  notes            TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commercial_pnl_snapshots (
  id                    TEXT PRIMARY KEY,
  scenario_id           TEXT NOT NULL REFERENCES commercial_quote_scenarios(id) ON DELETE CASCADE,
  revenue               NUMERIC DEFAULT 0,
  warehouse_cost        NUMERIC DEFAULT 0,
  transport_cost        NUMERIC DEFAULT 0,
  labor_cost            NUMERIC DEFAULT 0,
  special_handling_cost  NUMERIC DEFAULT 0,
  admin_reporting_cost   NUMERIC DEFAULT 0,
  risk_reserve          NUMERIC DEFAULT 0,
  total_cost            NUMERIC DEFAULT 0,
  gross_profit          NUMERIC DEFAULT 0,
  gp_percent            NUMERIC DEFAULT 0,
  pnl_confidence        TEXT DEFAULT '',
  missing_inputs        JSONB DEFAULT '[]'::JSONB,
  input_owners          JSONB DEFAULT '[]'::JSONB,
  assumptions           JSONB DEFAULT '[]'::JSONB,
  notes                 TEXT DEFAULT '',
  last_reviewed         TEXT DEFAULT '',
  reviewed_by           TEXT DEFAULT '',
  UNIQUE(scenario_id)
);

CREATE TABLE IF NOT EXISTS commercial_customer_scores (
  id                   TEXT PRIMARY KEY,
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id          TEXT REFERENCES customers(id),
  overall_grade        TEXT DEFAULT 'TBA',
  overall_score        NUMERIC DEFAULT 0,
  financial_strength   JSONB DEFAULT '{}'::JSONB,
  operational_behavior JSONB DEFAULT '{}'::JSONB,
  strategic_fit        JSONB DEFAULT '{}'::JSONB,
  commercial_fit       JSONB DEFAULT '{}'::JSONB,
  override_grade       TEXT,
  override_reason      TEXT,
  override_by          TEXT,
  notes                TEXT DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS commercial_capacity_fits (
  id                    TEXT PRIMARY KEY,
  scenario_id           TEXT NOT NULL REFERENCES commercial_quote_scenarios(id) ON DELETE CASCADE,
  facility              TEXT DEFAULT '',
  capacity_before       INTEGER DEFAULT 0,
  required_positions    INTEGER DEFAULT 0,
  capacity_after        INTEGER DEFAULT 0,
  utilization_before    NUMERIC DEFAULT 0,
  utilization_after     NUMERIC DEFAULT 0,
  fit_status            TEXT DEFAULT 'Pending',
  constraints           JSONB DEFAULT '[]'::JSONB,
  ops_owner             TEXT DEFAULT '',
  promise_gaps          JSONB DEFAULT '[]'::JSONB,
  notes                 TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commercial_revenue_realization (
  id               TEXT PRIMARY KEY,
  scenario_id      TEXT NOT NULL REFERENCES commercial_quote_scenarios(id) ON DELETE CASCADE,
  timing           TEXT DEFAULT '',
  ramp_weeks       INTEGER DEFAULT 0,
  month1_percent   NUMERIC DEFAULT 0,
  full_run_month   INTEGER DEFAULT 1,
  risk_factors     JSONB DEFAULT '[]'::JSONB,
  notes            TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commercial_mock_escalations (
  id                  TEXT PRIMARY KEY,
  scenario_id         TEXT NOT NULL REFERENCES commercial_quote_scenarios(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  severity            TEXT DEFAULT 'Medium',
  signal              TEXT DEFAULT '',
  required_authority  TEXT DEFAULT '',
  current_status      TEXT DEFAULT 'Open',
  bypass_available    BOOLEAN DEFAULT TRUE,
  bypass_used         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_proposal_versions (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scenario_id      TEXT REFERENCES commercial_quote_scenarios(id) ON DELETE SET NULL,
  version          TEXT DEFAULT 'v1',
  status           TEXT DEFAULT 'draft_mock',
  margin_delta     TEXT DEFAULT '',
  client_facing    BOOLEAN DEFAULT FALSE,
  future_gate      TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  notes            TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commercial_sla_drafts (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version             TEXT DEFAULT 'v0.1',
  linked_scenario     TEXT DEFAULT '',
  status              TEXT DEFAULT 'Draft',
  ops_review          TEXT DEFAULT 'Not Reviewed',
  legal_review        TEXT DEFAULT 'Not Reviewed',
  promise_gap_score   TEXT DEFAULT '',
  sections            JSONB DEFAULT '[]'::JSONB,
  kpis                JSONB DEFAULT '[]'::JSONB,
  promise_gaps        JSONB DEFAULT '[]'::JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_activity_events (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  timestamp      TIMESTAMPTZ NOT NULL,
  category       TEXT DEFAULT '',
  severity       TEXT DEFAULT 'info',
  actor          TEXT DEFAULT '',
  action         TEXT DEFAULT '',
  detail         TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commercial_audit_events (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  timestamp        TIMESTAMPTZ NOT NULL,
  event_code       TEXT DEFAULT '',
  category         TEXT DEFAULT '',
  actor            TEXT DEFAULT '',
  role             TEXT DEFAULT '',
  action           TEXT DEFAULT '',
  entity_type      TEXT DEFAULT '',
  entity_id        TEXT DEFAULT '',
  detail           TEXT DEFAULT '',
  trace_id         TEXT DEFAULT '',
  immutable_hash   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS commercial_governance_config (
  id              TEXT PRIMARY KEY,
  config_key      TEXT NOT NULL UNIQUE,
  config_value    JSONB NOT NULL DEFAULT '{}'::JSONB,
  category        TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- TENDER WORKSPACE TABLES
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_packs (
  id                       TEXT PRIMARY KEY,
  tender_workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  pack_type                TEXT NOT NULL,
  label                    TEXT DEFAULT '',
  status                   TEXT DEFAULT 'not_started',
  owner                    TEXT DEFAULT '',
  readiness_breakdown      JSONB DEFAULT '{}'::JSONB,
  total_readiness_percent  INTEGER DEFAULT 0,
  notes                    TEXT DEFAULT '',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tender_pack_sections (
  id                    TEXT PRIMARY KEY,
  pack_id               TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  owner                 TEXT DEFAULT '',
  status                TEXT DEFAULT 'not_started',
  missing_placeholders  INTEGER DEFAULT 0,
  last_updated          TEXT DEFAULT '',
  approval_state        TEXT DEFAULT 'not_reviewed'
);

CREATE TABLE IF NOT EXISTS tender_placeholders (
  id           TEXT PRIMARY KEY,
  pack_id      TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  section_id   TEXT DEFAULT '',
  label        TEXT NOT NULL,
  value        TEXT DEFAULT '',
  populated    BOOLEAN DEFAULT FALSE,
  required     BOOLEAN DEFAULT TRUE,
  owner        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tender_required_documents (
  id               TEXT PRIMARY KEY,
  pack_id          TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  document_name    TEXT NOT NULL,
  status           TEXT DEFAULT 'missing',
  native_required  BOOLEAN DEFAULT FALSE,
  signed_required  BOOLEAN DEFAULT FALSE,
  stamp_required   BOOLEAN DEFAULT FALSE,
  gate_link        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tender_compliance_items (
  id            TEXT PRIMARY KEY,
  pack_id       TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  category      TEXT DEFAULT '',
  requirement   TEXT NOT NULL,
  status        TEXT DEFAULT 'not_reviewed',
  response      TEXT DEFAULT '',
  owner         TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tender_submission_gates (
  id         TEXT PRIMARY KEY,
  pack_id    TEXT NOT NULL REFERENCES tender_packs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  status     TEXT DEFAULT 'not_met',
  mode       TEXT DEFAULT 'enforce',
  doctrine   BOOLEAN DEFAULT FALSE,
  "override" BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS tender_activity_events (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  timestamp      TIMESTAMPTZ NOT NULL,
  category       TEXT DEFAULT '',
  severity       TEXT DEFAULT 'info',
  actor          TEXT DEFAULT '',
  action         TEXT DEFAULT '',
  detail         TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tender_audit_events (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  timestamp        TIMESTAMPTZ NOT NULL,
  event_code       TEXT DEFAULT '',
  category         TEXT DEFAULT '',
  actor            TEXT DEFAULT '',
  role             TEXT DEFAULT '',
  action           TEXT DEFAULT '',
  entity_type      TEXT DEFAULT '',
  entity_id        TEXT DEFAULT '',
  detail           TEXT DEFAULT '',
  trace_id         TEXT DEFAULT '',
  immutable_hash   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tender_governance_config (
  id              TEXT PRIMARY KEY,
  config_key      TEXT NOT NULL UNIQUE,
  config_value    JSONB NOT NULL DEFAULT '{}'::JSONB,
  category        TEXT DEFAULT '',
  description     TEXT DEFAULT '',
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- INDEXES for common query patterns
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cqs_workspace ON commercial_quote_scenarios(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cpl_scenario ON commercial_pricing_lines(scenario_id);
CREATE INDEX IF NOT EXISTS idx_cpnl_scenario ON commercial_pnl_snapshots(scenario_id);
CREATE INDEX IF NOT EXISTS idx_ccs_workspace ON commercial_customer_scores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ccf_scenario ON commercial_capacity_fits(scenario_id);
CREATE INDEX IF NOT EXISTS idx_crr_scenario ON commercial_revenue_realization(scenario_id);
CREATE INDEX IF NOT EXISTS idx_cme_scenario ON commercial_mock_escalations(scenario_id);
CREATE INDEX IF NOT EXISTS idx_cpv_workspace ON commercial_proposal_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_csd_workspace ON commercial_sla_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cae_workspace ON commercial_activity_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_caue_workspace ON commercial_audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_workspace ON tender_packs(tender_workspace_id);
CREATE INDEX IF NOT EXISTS idx_tps_pack ON tender_pack_sections(pack_id);
CREATE INDEX IF NOT EXISTS idx_tph_pack ON tender_placeholders(pack_id);
CREATE INDEX IF NOT EXISTS idx_trd_pack ON tender_required_documents(pack_id);
CREATE INDEX IF NOT EXISTS idx_tci_pack ON tender_compliance_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_tsg_pack ON tender_submission_gates(pack_id);
CREATE INDEX IF NOT EXISTS idx_tae_workspace ON tender_activity_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_taue_workspace ON tender_audit_events(workspace_id);


-- ────────────────────────────────────────────────────────────────
-- RLS — Permissive for now (all authenticated users)
-- Will be tightened in SUPA-007
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'commercial_quote_scenarios',
      'commercial_pricing_lines',
      'commercial_pnl_snapshots',
      'commercial_customer_scores',
      'commercial_capacity_fits',
      'commercial_revenue_realization',
      'commercial_mock_escalations',
      'commercial_proposal_versions',
      'commercial_sla_drafts',
      'commercial_activity_events',
      'commercial_audit_events',
      'commercial_governance_config',
      'tender_packs',
      'tender_pack_sections',
      'tender_placeholders',
      'tender_required_documents',
      'tender_compliance_items',
      'tender_submission_gates',
      'tender_activity_events',
      'tender_audit_events',
      'tender_governance_config'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- Drop existing policies first to make this re-runnable
    EXECUTE format('DROP POLICY IF EXISTS "auth_read_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_write_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_%1$s" ON %1$I', t);

    -- Allow all authenticated users to read
    EXECUTE format(
      'CREATE POLICY "auth_read_%1$s" ON %1$I FOR SELECT USING (auth.role() = ''authenticated'')',
      t
    );
    -- Allow all authenticated users to insert/update/delete (permissive)
    EXECUTE format(
      'CREATE POLICY "auth_write_%1$s" ON %1$I FOR ALL USING (auth.role() = ''authenticated'')',
      t
    );
    -- Allow service role full access
    EXECUTE format(
      'CREATE POLICY "service_%1$s" ON %1$I FOR ALL USING (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END;
$$;
