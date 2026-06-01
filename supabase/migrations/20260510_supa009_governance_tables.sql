-- SUPA-009: Governance Policy Gates + Audit Log
-- Date: 2026-05-10
--
-- Schema only. No governance gates, audit rows, users, approvals, or business
-- events are seeded here. Governance configuration must be created through the
-- governed admin workflow or a human-reviewed migration.

CREATE TABLE IF NOT EXISTS governance_policy_gates (
  id                       text PRIMARY KEY,
  gate_name                text NOT NULL,
  description              text DEFAULT '',
  mode                     text DEFAULT 'warn',
  overridable              boolean DEFAULT true,
  scope                    jsonb DEFAULT '{"regions":"all","businessUnits":"all"}'::jsonb,
  rule_version             integer DEFAULT 1,
  rule_version_history     jsonb DEFAULT '[]'::jsonb,
  mock_only                boolean DEFAULT false,
  visible                  boolean DEFAULT true,
  sort_order               integer DEFAULT 0,
  tooltip_text             text DEFAULT '',
  future_enforcement_note  text DEFAULT '',
  override_label           text DEFAULT '',
  requires_reason          boolean DEFAULT false,
  metadata                 jsonb DEFAULT '{}'::jsonb,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  updated_by               text DEFAULT ''
);

CREATE TABLE IF NOT EXISTS governance_audit_log (
  id            text PRIMARY KEY,
  category      text NOT NULL,
  action        text NOT NULL,
  entity_type   text DEFAULT '',
  entity_id     text DEFAULT '',
  user_id       text DEFAULT '',
  user_name     text DEFAULT '',
  details       text DEFAULT '',
  metadata      jsonb DEFAULT '{}'::jsonb,
  mock_only     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gal_category ON governance_audit_log(category);
CREATE INDEX IF NOT EXISTS idx_gal_created ON governance_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_gpg_mode ON governance_policy_gates(mode);

ALTER TABLE governance_policy_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_policy_gates'
      AND policyname = 'gpg_read_auth'
  ) THEN
    CREATE POLICY gpg_read_auth
      ON governance_policy_gates
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_policy_gates'
      AND policyname = 'gpg_write_auth'
  ) THEN
    CREATE POLICY gpg_write_auth
      ON governance_policy_gates
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_audit_log'
      AND policyname = 'gal_read_auth'
  ) THEN
    CREATE POLICY gal_read_auth
      ON governance_audit_log
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_audit_log'
      AND policyname = 'gal_insert_auth'
  ) THEN
    CREATE POLICY gal_insert_auth
      ON governance_audit_log
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
