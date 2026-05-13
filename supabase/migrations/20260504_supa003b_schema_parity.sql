-- ════════════════════════════════════════════════════════════════
-- SUPA-003B: Schema parity migration
-- Adds missing columns to commercial_proposal_versions,
-- commercial_sla_drafts, commercial_activity_events,
-- commercial_audit_events, and creates commercial_negotiation_rounds.
--
-- SAFE: All ADD COLUMN IF NOT EXISTS. Re-runnable.
-- ════════════════════════════════════════════════════════════════

-- ─── PROPOSAL VERSIONS: add rich fields ─────────────────────

ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS proposal_name TEXT DEFAULT '';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS linked_quote_scenario_name TEXT DEFAULT '';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS proposal_type TEXT DEFAULT 'Internal Draft';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS client_facing_mock BOOLEAN DEFAULT FALSE;
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0;
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS gp_percent NUMERIC DEFAULT 0;
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS margin_delta_from_quote NUMERIC DEFAULT 0;
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'Not Reviewed';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS future_gate_status TEXT DEFAULT 'No Gate';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS mock_escalation_status TEXT DEFAULT '';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS issued_at_mock TEXT DEFAULT '';
ALTER TABLE commercial_proposal_versions ADD COLUMN IF NOT EXISTS last_updated TEXT DEFAULT '';

-- ─── NEGOTIATION ROUNDS: new table ──────────────────────────

CREATE TABLE IF NOT EXISTS commercial_negotiation_rounds (
  id                   TEXT PRIMARY KEY,
  workspace_id         TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  proposal_version_id  TEXT NOT NULL REFERENCES commercial_proposal_versions(id) ON DELETE CASCADE,
  round_number         INTEGER DEFAULT 1,
  client_ask           TEXT DEFAULT '',
  hala_response        TEXT DEFAULT '',
  pricing_change       TEXT DEFAULT '',
  margin_change        TEXT DEFAULT '',
  concession_reason    TEXT DEFAULT '',
  approval_impact      TEXT DEFAULT '',
  status               TEXT DEFAULT 'Open',
  owner                TEXT DEFAULT '',
  last_updated         TEXT DEFAULT '',
  notes                TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_cnr_workspace ON commercial_negotiation_rounds(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cnr_proposal ON commercial_negotiation_rounds(proposal_version_id);

-- ─── SLA DRAFTS: add rich fields ────────────────────────────

ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS sla_name TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS linked_proposal_id TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS linked_proposal_name TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS linked_quote_scenario_id TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS linked_quote_scenario_name TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS sla_type TEXT DEFAULT 'Emergency Storage SLA';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS client_facing_mock BOOLEAN DEFAULT FALSE;
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS pricing_lock_status TEXT DEFAULT 'Not Locked';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS commercial_terms_status TEXT DEFAULT 'Missing';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS ops_review_status TEXT DEFAULT 'Not Reviewed';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS legal_review_status TEXT DEFAULT 'Not Reviewed';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS kpi_readiness INTEGER DEFAULT 0;
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS responsibility_readiness INTEGER DEFAULT 0;
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS escalation_matrix_status TEXT DEFAULT 'Not Reviewed';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS promise_gap_count INTEGER DEFAULT 0;
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'Medium';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS future_gate_status TEXT DEFAULT 'No Gate';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS mock_escalation_status TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS owner TEXT DEFAULT '';
ALTER TABLE commercial_sla_drafts ADD COLUMN IF NOT EXISTS last_updated TEXT DEFAULT '';

-- ─── ACTIVITY EVENTS: add rich fields ───────────────────────

ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS role TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS related_artifact TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS related_module TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS related_scenario_id TEXT DEFAULT '';
ALTER TABLE commercial_activity_events ADD COLUMN IF NOT EXISTS mock BOOLEAN DEFAULT TRUE;

-- ─── AUDIT EVENTS: add rich fields ──────────────────────────

ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS event_name TEXT DEFAULT '';
ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS entity_name TEXT DEFAULT '';
ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS before_state TEXT DEFAULT '';
ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS after_state TEXT DEFAULT '';
ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS mock BOOLEAN DEFAULT TRUE;
ALTER TABLE commercial_audit_events ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Info';

-- ─── RLS for negotiation rounds ─────────────────────────────

ALTER TABLE commercial_negotiation_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read_commercial_negotiation_rounds" ON commercial_negotiation_rounds;
DROP POLICY IF EXISTS "auth_write_commercial_negotiation_rounds" ON commercial_negotiation_rounds;
DROP POLICY IF EXISTS "service_commercial_negotiation_rounds" ON commercial_negotiation_rounds;
CREATE POLICY "auth_read_commercial_negotiation_rounds"
  ON commercial_negotiation_rounds FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_commercial_negotiation_rounds"
  ON commercial_negotiation_rounds FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_commercial_negotiation_rounds"
  ON commercial_negotiation_rounds FOR ALL USING (auth.role() = 'service_role');
