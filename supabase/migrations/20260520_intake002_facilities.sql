-- ════════════════════════════════════════════════════════════════
-- INTAKE-002: Facilities / Warehouses Reference Table
-- Date: 2026-05-20
-- Author: Antigravity / Hala Commercial Engine
--
-- Purpose:
--   Persistent, admin-managed facility list. No hardcoded AI slop.
--   Seeded with the 9 real Hala facilities.
--
-- SAFE: Re-runnable. Uses IF NOT EXISTS + ON CONFLICT.
-- DO NOT AUTO-EXECUTE. Human must run in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS facilities (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  code        text,
  region      text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facilities_active ON facilities(active);
CREATE INDEX IF NOT EXISTS idx_facilities_name   ON facilities(name);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facilities' AND policyname = 'fac_read_all') THEN
    CREATE POLICY fac_read_all ON facilities FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facilities' AND policyname = 'fac_write_auth') THEN
    CREATE POLICY fac_write_auth ON facilities FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'facilities' AND policyname = 'fac_update_auth') THEN
    CREATE POLICY fac_update_auth ON facilities FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- updated_at trigger (reuse function if exists)
CREATE OR REPLACE FUNCTION fac_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fac_updated_at ON facilities;
CREATE TRIGGER trg_fac_updated_at
  BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION fac_set_updated_at();

-- ── Seed real Hala facilities ──────────────────────────────────
INSERT INTO facilities (name, code, region, sort_order) VALUES
  ('Jubail (JUB1 + JUB2)',         'JUB',  'East',    1),
  ('Dammam Port',                  'DPT',  'East',    2),
  ('Jeddah 3A (Modon-J)',          'J3A',  'West',    3),
  ('Riyadh (Tayba)',               'RYD',  'Central', 4),
  ('Jeddah 3B (Modon-B)',          'J3B',  'West',    5),
  ('Forus',                        'FOR',  'East',    6),
  ('Dammam 2nd Industrial (TAD)',  'TAD',  'East',    7),
  ('Temp Warehouse',               'TMP',  NULL,      8),
  ('Tuwaiq',                       'TWQ',  'Central', 9)
ON CONFLICT (name) DO NOTHING;
