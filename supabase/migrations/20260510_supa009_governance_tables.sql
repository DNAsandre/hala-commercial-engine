-- ════════════════════════════════════════════════════════════════
-- SUPA-009: Governance Policy Gates + Audit Log
-- Run: 2026-05-10
--
-- Creates governance_policy_gates and governance_audit_log tables.
-- Seeds 8 policy gates from the existing governance.ts config.
-- Seeds initial governance audit entries.
--
-- DOCTRINE: mock_only is ALWAYS true. No production enforcement.
-- SAFE: Additive only. Re-runnable via ON CONFLICT.
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- 1. governance_policy_gates
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS governance_policy_gates (
  id                     TEXT PRIMARY KEY,
  gate_name              TEXT NOT NULL,
  description            TEXT DEFAULT '',
  mode                   TEXT DEFAULT 'warn',
  overridable            BOOLEAN DEFAULT true,
  scope                  JSONB DEFAULT '{"regions":"all","businessUnits":"all"}'::JSONB,
  rule_version           INTEGER DEFAULT 1,
  rule_version_history   JSONB DEFAULT '[]'::JSONB,
  mock_only              BOOLEAN DEFAULT true,
  visible                BOOLEAN DEFAULT true,
  sort_order             INTEGER DEFAULT 0,
  tooltip_text           TEXT DEFAULT '',
  future_enforcement_note TEXT DEFAULT '',
  override_label         TEXT DEFAULT '',
  requires_reason_mock   BOOLEAN DEFAULT false,
  metadata               JSONB DEFAULT '{}'::JSONB,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_by             TEXT DEFAULT ''
);

-- ────────────────────────────────────────────────────────────────
-- 2. governance_audit_log
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS governance_audit_log (
  id            TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT DEFAULT '',
  entity_id     TEXT DEFAULT '',
  user_id       TEXT DEFAULT '',
  user_name     TEXT DEFAULT '',
  details       TEXT DEFAULT '',
  metadata      JSONB DEFAULT '{}'::JSONB,
  mock_only     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gal_category ON governance_audit_log(category);
CREATE INDEX IF NOT EXISTS idx_gal_created ON governance_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_gpg_mode ON governance_policy_gates(mode);

-- ────────────────────────────────────────────────────────────────
-- 3. RLS — Permissive dev policies
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'governance_policy_gates',
      'governance_audit_log'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

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

-- ────────────────────────────────────────────────────────────────
-- 4. Seed policy gates (8 gates from governance.ts)
-- ────────────────────────────────────────────────────────────────

INSERT INTO governance_policy_gates (id, gate_name, description, mode, overridable, scope, rule_version, rule_version_history, mock_only, visible, sort_order, tooltip_text, future_enforcement_note, override_label, requires_reason_mock, updated_by) VALUES
('pg1', 'Commercial Approval Gate',
  'Requires approval based on GP% and pallet volume thresholds',
  'enforce', true,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"enforce","overridable":true,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 1,
  'Advisory only — does not block testing',
  'Will enforce GP% approval matrix in production',
  'Override requires reason', false, 'System'),

('pg2', 'Discount/Margin Gate',
  'Warns when pricing falls below minimum margin thresholds',
  'warn', true,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"warn","overridable":true,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 2,
  'Advisory only — warns but does not block',
  'Will warn when margin drops below threshold',
  'Override requires reason', false, 'System'),

('pg3', 'Proposal Indicative Language Gate',
  'Flags non-committal or indicative language in proposals',
  'warn', true,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"warn","overridable":true,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 3,
  'Advisory only — flags language but does not block',
  'Will scan proposals for indicative language',
  '', false, 'System'),

('pg4', 'SLA Creation Gate',
  'Requires commercial approval before SLA can be drafted',
  'enforce', true,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"enforce","overridable":true,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 4,
  'Advisory only — does not block SLA creation in development',
  'Will require commercial approval before SLA drafting',
  'Override requires reason', false, 'System'),

('pg5', 'Contract Readiness Gate',
  'Checks all required documents exist before contract stage',
  'enforce', false,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"enforce","overridable":false,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 5,
  'Advisory only — does not block contract stage in development',
  'Will enforce document completeness before contract',
  '', false, 'System'),

('pg6', 'Tender Committee Gate',
  'Requires tender committee review before submission',
  'enforce', false,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"enforce","overridable":false,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 6,
  'Advisory only — does not block tender submission in development',
  'Will require committee sign-off before tender submission',
  '', false, 'System'),

('pg7', 'Operational Feasibility Gate',
  'Requires ops confirmation of space and capacity',
  'enforce', true,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"enforce","overridable":true,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 7,
  'Advisory only — does not block quoting in development',
  'Will require ops feasibility check before quoting',
  'Override requires reason', false, 'System'),

('pg8', 'CRM Stage Conflict Gate',
  'Flags when CRM stage and workspace stage disagree',
  'warn', true,
  '{"regions":"all","businessUnits":"all"}'::JSONB,
  1, '[{"version":1,"mode":"warn","overridable":true,"changedBy":"System","changedAt":"2026-01-01T00:00:00Z","reason":"Initial configuration"}]'::JSONB,
  true, true, 8,
  'Advisory only — warns about CRM stage mismatch',
  'Will flag CRM vs workspace stage disagreements',
  '', false, 'System')

ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 5. Seed governance audit log (initial entries)
-- ────────────────────────────────────────────────────────────────

INSERT INTO governance_audit_log (id, category, action, entity_type, entity_id, user_id, user_name, details, metadata, mock_only, created_at) VALUES
('ga1', 'admin_change', 'system_initialized', 'system', 'global', 'u1', 'Amin Al-Rashid', 'Governance Engine initialized. All 8 policy gates configured.', '{"gateCount":8}'::JSONB, true, '2026-01-01T00:00:00Z'),
('ga2', 'gate_evaluation', 'gate_blocked', 'quote', 'q3', 'u3', 'Albert Fernandez', 'Commercial Approval Gate BLOCKED: Quote q3 GP% at 15.2% — requires Director approval', '{"gateId":"pg1","gpPercent":15.2,"ruleVersion":1}'::JSONB, true, '2026-02-06T09:00:00Z'),
('ga3', 'approval_decision', 'approved', 'quote', 'q2', 'u2', 'Ra''ed Al-Harbi', 'Quote q2 approved by Regional Sales Head — Margin acceptable for renewal', '{"gpPercent":24.5,"palletVolume":1200}'::JSONB, true, '2026-01-22T10:30:00Z'),
('ga4', 'stage_control', 'stage_transition_approved', 'workspace', 'w2', 'u3', 'Albert Fernandez', 'Stage transition: proposal_active → negotiation', '{"fromStage":"proposal_active","toStage":"negotiation"}'::JSONB, true, '2026-02-14T09:00:00Z'),
('ga5', 'write_action', 'quote_created', 'quote', 'q1', 'u2', 'Ra''ed Al-Harbi', 'Quote v1 created for Ma''aden Jubail Expansion 2500PP', '{"version":1,"workspaceId":"w1"}'::JSONB, true, '2026-02-10T11:30:00Z'),
('ga6', 'versioning', 'version_locked', 'proposal', 'p2', 'u6', 'Mohammed Al-Qahtani', 'Proposal v3 locked as immutable — Aramco VAS Expansion', '{"version":3,"hasPricingSnapshot":true}'::JSONB, true, '2026-01-18T16:45:00Z'),
('ga7', 'ai_restriction', 'ai_action_blocked', 'system', 'global', 'system', 'AI Agent', 'AI attempted to modify pricing on quote q1 — BLOCKED by hard-coded restriction', '{"attemptedAction":"modify_pricing","restriction":"air3"}'::JSONB, true, '2026-02-12T08:00:00Z'),
('ga8', 'override', 'override_executed', 'quote', 'q3', 'u6', 'Mohammed Al-Qahtani', 'Override EXECUTED for Commercial Approval Gate — Reason: Strategic client, volume growth expected in Q3', '{"gateId":"pg1","ruleVersion":1}'::JSONB, true, '2026-02-07T11:00:00Z')
ON CONFLICT (id) DO NOTHING;
