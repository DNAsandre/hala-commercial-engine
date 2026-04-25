-- ============================================================
-- MIGRATION v3 — Extend existing tenders table + create renewals
-- Project: kositquaqmuousalmoar (Hala Commercial engine)
--
-- Existing columns we REUSE (with mapping):
--   phase           → our "status"
--   owner           → our "assigned_owner"
--   workspace_id    → our "linked_workspace_id"
--   reference       → tender reference code (e.g. TN-001)
--
-- Columns we ADD:
--   target_gp_percent, probability_percent,
--   assigned_team_members, source, days_in_status, crm_synced
-- ============================================================

-- ─── 1. Patch tenders table with missing columns ─────────────

-- Give 'reference' a default so existing rows and inserts don't break
ALTER TABLE tenders ALTER COLUMN reference SET DEFAULT '';

-- Give 'phase' a default (maps to our "status")
ALTER TABLE tenders ALTER COLUMN phase SET DEFAULT 'identified';

-- Add columns we need that don't exist yet
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS target_gp_percent   NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS probability_percent  NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS assigned_team_members JSONB NOT NULL DEFAULT '[]';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS source               TEXT NOT NULL DEFAULT 'Direct';
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS days_in_status       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS crm_synced           BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. RLS policies ─────────────────────────────────────────

ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read tenders" ON tenders;
DROP POLICY IF EXISTS "Authenticated users can insert tenders" ON tenders;
DROP POLICY IF EXISTS "Authenticated users can update tenders" ON tenders;

CREATE POLICY "Authenticated users can read tenders"
  ON tenders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert tenders"
  ON tenders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update tenders"
  ON tenders FOR UPDATE USING (auth.role() = 'authenticated');

-- ─── 3. Seed tenders (using correct column names) ────────────
-- Mapping: phase=status, owner=assignedOwner, workspace_id=linkedWorkspaceId
-- reference = uppercase ID (TN-001 etc.)

INSERT INTO tenders (
  id, reference, title, customer_id, customer_name,
  region, phase, submission_deadline, estimated_value,
  owner, notes, workspace_id,
  target_gp_percent, probability_percent, assigned_team_members,
  source, days_in_status, crm_synced,
  created_at, updated_at
)
VALUES
  ('tn-001','TN-001','Ma''aden Jubail Expansion — Logistics RFP',          'c2','Ma''aden',         'East',   'preparing_submission','2026-05-20',3400000, 'Ra''ed', 'Linked to workspace w1. Technical draft in progress.',        'w1', 22,60,'["Ra''ed","Yazan","Finance"]',           'CRM',      8, FALSE, now(), now()),
  ('tn-002','TN-002','SABIC National Warehousing Services Tender',          'c1','SABIC',             'East',   'identified',          '2026-06-01',15000000,'Ra''ed', 'Large strategic tender. Committee formation pending.',        NULL,25,45,'["Ra''ed","Albert","Yazan","Finance","Legal"]','Direct', 14,FALSE, now(), now()),
  ('tn-003','TN-003','Aramco Dhahran VAS Expansion Tender',                 'c1','Aramco Services',   'East',   'submitted',           '2026-04-30',12000000,'Ra''ed', 'Submitted on time. Awaiting evaluation committee review.',    'w6', 28,75,'["Ra''ed","Hano","Finance"]',            'CRM',       5,FALSE, now(), now()),
  ('tn-004','TN-004','Almarai Riyadh Phase 2 — Cold Chain Tender',          'c3','Almarai',           'Central','commercial_review',   '2026-04-15',8500000, 'Hano',   'High-value strategic account. Technical analysis complete.',  'w5', 30,70,'["Hano","Yazan","Finance"]',             'CRM',       5,FALSE, now(), now()),
  ('tn-005','TN-005','Nestlé Jeddah Cold Chain Partnership',                'c8','Nestlé KSA',        'West',   'technical_review',    '2026-05-01',6200000, 'Hano',   'Evaluation ongoing. Shortlisted with 2 competitors.',        NULL, 26,55,'["Hano","Albert"]',                     'Referral', 12,FALSE, now(), now()),
  ('tn-006','TN-006','Sadara Contract Renewal Tender 2025',                  'c4','Sadara Chemical',  'East',   'negotiation',         '2026-05-28',2800000, 'Albert', 'Renewal tender. Strong relationship. High probability.',      'w2', 24,85,'["Albert","Ra''ed"]',                   'CRM',       3,FALSE, now(), now()),
  ('tn-007','TN-007','Almarai Dammam Distribution Center',                  'c3','Almarai',           'East',   'awarded',             '2025-12-15',4500000, 'Hano',   'Won. Contract signed. Handover initiated.',                  NULL, 27, 0,'["Hano","Yazan"]',                      'Direct',   58,TRUE,  now(), now()),
  ('tn-008','TN-008','Unilever Riyadh Expansion RFP',                       'c6','Unilever Arabia',   'Central','lost',                '2025-11-30',3200000, 'Albert', 'Lost to competitor. Price was 12% higher.',                  NULL, 20, 0,'["Albert"]',                            'CRM',      73,TRUE,  now(), now())
ON CONFLICT (id) DO UPDATE SET
  reference             = EXCLUDED.reference,
  title                 = EXCLUDED.title,
  customer_id           = EXCLUDED.customer_id,
  customer_name         = EXCLUDED.customer_name,
  region                = EXCLUDED.region,
  phase                 = EXCLUDED.phase,
  submission_deadline   = EXCLUDED.submission_deadline,
  estimated_value       = EXCLUDED.estimated_value,
  owner                 = EXCLUDED.owner,
  notes                 = EXCLUDED.notes,
  workspace_id          = EXCLUDED.workspace_id,
  target_gp_percent     = EXCLUDED.target_gp_percent,
  probability_percent   = EXCLUDED.probability_percent,
  assigned_team_members = EXCLUDED.assigned_team_members,
  source                = EXCLUDED.source,
  days_in_status        = EXCLUDED.days_in_status,
  crm_synced            = EXCLUDED.crm_synced,
  updated_at            = now();

-- ─── 4. Create renewal_workspaces ────────────────────────────

CREATE TABLE IF NOT EXISTS renewal_workspaces (
  id                   TEXT PRIMARY KEY,
  customer_id          TEXT NOT NULL DEFAULT '',
  customer_name        TEXT NOT NULL DEFAULT '',
  baseline_id          TEXT NOT NULL DEFAULT '',
  renewal_cycle_name   TEXT NOT NULL DEFAULT '',
  target_start_date    DATE,
  target_end_date      DATE,
  status               TEXT NOT NULL DEFAULT 'draft',
  renewal_decision     TEXT NOT NULL DEFAULT 'pending',
  owner_user_id        TEXT NOT NULL DEFAULT '',
  owner_name           TEXT NOT NULL DEFAULT '',
  notes                TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE renewal_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read renewal_workspaces" ON renewal_workspaces;
DROP POLICY IF EXISTS "Authenticated users can insert renewal_workspaces" ON renewal_workspaces;
DROP POLICY IF EXISTS "Authenticated users can update renewal_workspaces" ON renewal_workspaces;

CREATE POLICY "Authenticated users can read renewal_workspaces"
  ON renewal_workspaces FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert renewal_workspaces"
  ON renewal_workspaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update renewal_workspaces"
  ON renewal_workspaces FOR UPDATE USING (auth.role() = 'authenticated');

-- ─── 5. Create contract_baselines ────────────────────────────

CREATE TABLE IF NOT EXISTS contract_baselines (
  id                    TEXT PRIMARY KEY,
  customer_id           TEXT NOT NULL DEFAULT '',
  customer_name         TEXT NOT NULL DEFAULT '',
  opportunity_id        TEXT,
  baseline_name         TEXT NOT NULL DEFAULT '',
  baseline_start_date   DATE,
  baseline_end_date     DATE,
  status                TEXT NOT NULL DEFAULT 'active',
  proposal_version_id   TEXT,
  sla_version_id        TEXT,
  pricing_snapshot      JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT NOT NULL DEFAULT ''
);

ALTER TABLE contract_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read contract_baselines" ON contract_baselines;
DROP POLICY IF EXISTS "Authenticated users can insert contract_baselines" ON contract_baselines;
DROP POLICY IF EXISTS "Authenticated users can update contract_baselines" ON contract_baselines;

CREATE POLICY "Authenticated users can read contract_baselines"
  ON contract_baselines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert contract_baselines"
  ON contract_baselines FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update contract_baselines"
  ON contract_baselines FOR UPDATE USING (auth.role() = 'authenticated');

-- ─── 6. Verify ───────────────────────────────────────────────
SELECT id, reference, customer_name, phase, estimated_value
FROM tenders
ORDER BY id;
