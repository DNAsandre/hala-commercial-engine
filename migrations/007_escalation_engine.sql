-- ============================================================
-- Sprint 7 — Escalation Engine Tables
-- Migration: 007_escalation_engine.sql
-- ============================================================

-- 1) escalation_rules — Defines what triggers escalation
CREATE TABLE IF NOT EXISTS escalation_rules (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type text NOT NULL DEFAULT 'workspace',
  trigger_type text NOT NULL,
  name text NOT NULL,
  description text,
  threshold jsonb DEFAULT '{}',
  severity text NOT NULL DEFAULT 'red',
  auto_escalate boolean DEFAULT true,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2) escalation_events — Actual triggered escalations
CREATE TABLE IF NOT EXISTS escalation_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type text NOT NULL DEFAULT 'workspace',
  entity_id text NOT NULL,
  workspace_id text,
  severity text NOT NULL DEFAULT 'red',
  rule_id text,
  trigger_type text NOT NULL,
  trigger_reason text NOT NULL,
  status text DEFAULT 'open',
  assigned_to text,
  assigned_to_name text,
  triggered_by text,
  triggered_by_name text,
  metadata jsonb,
  resolution_reason text,
  resolved_by text,
  resolved_by_name text,
  created_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

-- 3) escalation_tasks — Task tracking for escalation follow-ups
CREATE TABLE IF NOT EXISTS escalation_tasks (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  escalation_id text REFERENCES escalation_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to text,
  assigned_to_name text,
  due_date timestamptz,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_escalation_events_workspace ON escalation_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_escalation_events_status ON escalation_events(status);
CREATE INDEX IF NOT EXISTS idx_escalation_events_entity ON escalation_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_escalation_tasks_escalation ON escalation_tasks(escalation_id);

-- ============================================================
-- Seed 5 default escalation rules
-- ============================================================

INSERT INTO escalation_rules (id, entity_type, trigger_type, name, description, threshold, severity, auto_escalate, active) VALUES
  ('er-margin-breach', 'workspace', 'margin_breach', 'Margin Below Authority Threshold', 'Triggers when workspace GP% falls below 10% (CEO/CFO authority required)', '{"gpPercentCritical": 10, "gpPercentWarning": 22}', 'red', true, true),
  ('er-delta-breach', 'workspace', 'delta_breach', 'SLA vs P&L Delta Breach', 'Triggers when SLA terms deviate critically from approved P&L snapshot', '{"gpDeltaCritical": 5, "revenueDeltaCritical": 15}', 'red', true, true),
  ('er-stage-override', 'workspace', 'stage_override', 'Stage Forced Override', 'Triggers when an admin forces a stage transition or pricing lock override', '{}', 'amber', true, true),
  ('er-score-red', 'customer', 'score_red', 'Customer Score Falls to Red', 'Triggers when customer ECR grade drops to D or F', '{"minGrade": "C"}', 'red', true, true),
  ('er-renewal-risk', 'renewal', 'renewal_risk', 'Renewal Risk Above Threshold', 'Triggers when renewal gate evaluation produces a block result', '{"blockedGateCount": 1}', 'red', true, true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies — permissive for authenticated users
CREATE POLICY "escalation_rules_select" ON escalation_rules FOR SELECT USING (true);
CREATE POLICY "escalation_rules_all" ON escalation_rules FOR ALL USING (true);
CREATE POLICY "escalation_events_select" ON escalation_events FOR SELECT USING (true);
CREATE POLICY "escalation_events_all" ON escalation_events FOR ALL USING (true);
CREATE POLICY "escalation_tasks_select" ON escalation_tasks FOR SELECT USING (true);
CREATE POLICY "escalation_tasks_all" ON escalation_tasks FOR ALL USING (true);
