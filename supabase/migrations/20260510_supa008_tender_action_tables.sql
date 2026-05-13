-- ════════════════════════════════════════════════════════════════
-- SUPA-008: Tender Action Persistence Tables
-- Run: 2026-05-10
-- Author: Antigravity / Hala Commercial Engine
--
-- Adds tender_stage_history table and ensures activity/audit event
-- tables have all columns needed for action write persistence.
--
-- SAFE: All CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS. Re-runnable.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. NEW: tender_stage_history
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_stage_history (
  id                    TEXT PRIMARY KEY,
  tender_workspace_id   TEXT NOT NULL,
  previous_phase        TEXT,
  new_phase             TEXT NOT NULL,
  reason                TEXT DEFAULT '',
  mock_mode             BOOLEAN DEFAULT TRUE,
  user_id               TEXT DEFAULT '',
  user_name             TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tsh_workspace ON tender_stage_history(tender_workspace_id);

-- ────────────────────────────────────────────────────────────────
-- 2. Ensure tender_activity_events exists + has action columns
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_activity_events (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  action        TEXT DEFAULT '',
  actor         TEXT DEFAULT '',
  detail        TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  severity      TEXT DEFAULT 'info',
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tender_activity_events
  ADD COLUMN IF NOT EXISTS action_type      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS action_label     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS previous_value   TEXT,
  ADD COLUMN IF NOT EXISTS new_value        TEXT,
  ADD COLUMN IF NOT EXISTS mock_mode        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gate_code        TEXT,
  ADD COLUMN IF NOT EXISTS reason           TEXT,
  ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS title            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_type       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_id          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS role             TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_pack     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS related_module   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS mock             BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS description      TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tae_workspace ON tender_activity_events(workspace_id);

-- ────────────────────────────────────────────────────────────────
-- 3. Ensure tender_audit_events exists + has action columns
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tender_audit_events (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  action        TEXT DEFAULT '',
  actor         TEXT DEFAULT '',
  detail        TEXT DEFAULT '',
  entity_type   TEXT DEFAULT '',
  entity_id     TEXT DEFAULT '',
  event_code    TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  severity      TEXT DEFAULT 'info',
  role          TEXT DEFAULT '',
  trace_id      TEXT DEFAULT '',
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tender_audit_events
  ADD COLUMN IF NOT EXISTS previous_value   TEXT,
  ADD COLUMN IF NOT EXISTS new_value        TEXT,
  ADD COLUMN IF NOT EXISTS mock_mode        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gate_code        TEXT,
  ADD COLUMN IF NOT EXISTS reason           TEXT,
  ADD COLUMN IF NOT EXISTS metadata         JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS event_name       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS entity_name      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_id          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS user_name        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS before_state     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS after_state      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS mock             BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_taue_workspace ON tender_audit_events(workspace_id);

-- ────────────────────────────────────────────────────────────────
-- 4. RLS — Permissive dev policies
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'tender_stage_history',
      'tender_activity_events',
      'tender_audit_events'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- Drop existing policies to prevent conflicts if re-run
    EXECUTE format('DROP POLICY IF EXISTS "auth_read_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth_write_%1$s" ON %1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_%1$s" ON %1$I', t);

    EXECUTE format(
      'CREATE POLICY "auth_read_%1$s" ON %1$I FOR SELECT USING (auth.role() = ''authenticated'')',
      t
    );
    EXECUTE format(
      'CREATE POLICY "auth_write_%1$s" ON %1$I FOR ALL USING (auth.role() = ''authenticated'')',
      t
    );
    EXECUTE format(
      'CREATE POLICY "service_%1$s" ON %1$I FOR ALL USING (auth.role() = ''service_role'')',
      t
    );
  END LOOP;
END;
$$;
