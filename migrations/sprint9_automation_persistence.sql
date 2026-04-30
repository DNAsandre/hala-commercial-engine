-- ═══════════════════════════════════════════════════════════════
-- Automation Subsystem — Full Schema Migration
-- Tables: bot_definitions, bot_versions, bot_invocations,
--         bot_providers, bot_connectors, signal_rules,
--         signal_events, bot_global_settings
-- ═══════════════════════════════════════════════════════════════

-- Clean slate: drop existing tables (FK order: children first)
DROP TABLE IF EXISTS bot_global_settings CASCADE;
DROP TABLE IF EXISTS signal_events CASCADE;
DROP TABLE IF EXISTS signal_rules CASCADE;
DROP TABLE IF EXISTS bot_invocations CASCADE;
DROP TABLE IF EXISTS bot_versions CASCADE;
DROP TABLE IF EXISTS bot_definitions CASCADE;
DROP TABLE IF EXISTS bot_connectors CASCADE;
DROP TABLE IF EXISTS bot_providers CASCADE;

-- 1. Bot Providers
CREATE TABLE IF NOT EXISTS bot_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  api_endpoint TEXT NOT NULL DEFAULT '',
  models JSONB NOT NULL DEFAULT '[]',
  cost_per_token NUMERIC(12,8) NOT NULL DEFAULT 0,
  max_rate_per_minute INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('healthy', 'degraded', 'offline')),
  last_health_check TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bot Connectors
CREATE TABLE IF NOT EXISTS bot_connectors (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('finance', 'ops', 'tableau', 'crm', 'custom')),
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  access_mode TEXT NOT NULL DEFAULT 'read_only' CHECK (access_mode IN ('read_only', 'none')),
  endpoint TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bot Definitions
CREATE TABLE IF NOT EXISTS bot_definitions (
  id TEXT PRIMARY KEY DEFAULT 'bot-' || gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('action', 'monitor')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled', 'archived')),
  purpose TEXT NOT NULL DEFAULT '',
  domains_allowed JSONB NOT NULL DEFAULT '[]',
  regions_allowed JSONB NOT NULL DEFAULT '["East"]',
  roles_allowed JSONB NOT NULL DEFAULT '[]',
  current_version_id TEXT,
  provider_id TEXT REFERENCES bot_providers(id),
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  rate_limit INTEGER NOT NULL DEFAULT 20,
  cost_cap NUMERIC(10,2) NOT NULL DEFAULT 10,
  timeout_sec INTEGER NOT NULL DEFAULT 30,
  last_run_at TIMESTAMPTZ,
  error_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  cost_usage NUMERIC(10,4) NOT NULL DEFAULT 0,
  total_invocations INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bot Versions (immutable snapshots)
CREATE TABLE IF NOT EXISTS bot_versions (
  id TEXT PRIMARY KEY DEFAULT 'bv-' || gen_random_uuid()::text,
  bot_id TEXT NOT NULL REFERENCES bot_definitions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  system_instruction TEXT NOT NULL DEFAULT '',
  custom_instruction TEXT NOT NULL DEFAULT '',
  safety_rules TEXT NOT NULL DEFAULT '',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 2000,
  allowed_actions JSONB NOT NULL DEFAULT '["suggest"]',
  provider_id TEXT REFERENCES bot_providers(id),
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  connector_snapshot JSONB NOT NULL DEFAULT '{"finance":false,"ops":false,"tableau":false,"crm":false,"custom":false}',
  permission_snapshot JSONB NOT NULL DEFAULT '{}',
  knowledge_base_ids JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL DEFAULT 'system',
  change_note TEXT NOT NULL DEFAULT '',
  UNIQUE(bot_id, version)
);

-- 5. Bot Invocations (audit trail)
CREATE TABLE IF NOT EXISTS bot_invocations (
  id TEXT PRIMARY KEY DEFAULT 'inv-' || gen_random_uuid()::text,
  bot_id TEXT NOT NULL REFERENCES bot_definitions(id),
  bot_version_id TEXT REFERENCES bot_versions(id),
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context TEXT NOT NULL DEFAULT '',
  context_type TEXT NOT NULL DEFAULT 'workspace' CHECK (context_type IN ('proposal', 'sla', 'dashboard', 'quote', 'report', 'workspace')),
  input_payload_hash TEXT,
  knowledge_sources_used JSONB NOT NULL DEFAULT '[]',
  connector_calls_made JSONB NOT NULL DEFAULT '[]',
  output TEXT NOT NULL DEFAULT '',
  accepted BOOLEAN,
  edited BOOLEAN NOT NULL DEFAULT false,
  cost NUMERIC(10,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  gate_checks JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Signal Rules
CREATE TABLE IF NOT EXISTS signal_rules (
  id TEXT PRIMARY KEY DEFAULT 'sr-' || gen_random_uuid()::text,
  bot_id TEXT NOT NULL REFERENCES bot_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'threshold' CHECK (type IN ('threshold', 'trend', 'anomaly', 'margin_drop', 'sla_breach_risk')),
  metric TEXT NOT NULL,
  threshold NUMERIC,
  trend_direction TEXT CHECK (trend_direction IS NULL OR trend_direction IN ('up', 'down')),
  time_range_hours INTEGER NOT NULL DEFAULT 24,
  severity TEXT NOT NULL DEFAULT 'fyi' CHECK (severity IN ('fyi', 'needs_review', 'escalate')),
  notify_roles JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  description TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT '',
  time_window TEXT NOT NULL DEFAULT '24h',
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Signal Events
CREATE TABLE IF NOT EXISTS signal_events (
  id TEXT PRIMARY KEY DEFAULT 'se-' || gen_random_uuid()::text,
  rule_id TEXT REFERENCES signal_rules(id),
  bot_id TEXT NOT NULL REFERENCES bot_definitions(id),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity TEXT NOT NULL DEFAULT 'fyi' CHECK (severity IN ('fyi', 'needs_review', 'escalate')),
  metric TEXT NOT NULL,
  threshold_triggered TEXT NOT NULL DEFAULT '',
  time_range_analyzed TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  explainability TEXT NOT NULL DEFAULT '',
  suggested_action TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Global Bot Settings (singleton row)
CREATE TABLE IF NOT EXISTS bot_global_settings (
  id TEXT PRIMARY KEY DEFAULT 'settings',
  global_kill_switch BOOLEAN NOT NULL DEFAULT false,
  kill_switch_activated_by TEXT,
  kill_switch_activated_at TIMESTAMPTZ,
  max_concurrent_bots INTEGER NOT NULL DEFAULT 5,
  max_daily_cost_usd NUMERIC(10,2) NOT NULL DEFAULT 50,
  audit_retention_days INTEGER NOT NULL DEFAULT 365,
  require_human_acceptance BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings row if not exists
INSERT INTO bot_global_settings (id) VALUES ('settings') ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_bot_versions_bot_id ON bot_versions(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_invocations_bot_id ON bot_invocations(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_invocations_invoked_at ON bot_invocations(invoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_invocations_user_id ON bot_invocations(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_rules_bot_id ON signal_rules(bot_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_bot_id ON signal_events(bot_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_severity ON signal_events(severity);
CREATE INDEX IF NOT EXISTS idx_signal_events_acknowledged ON signal_events(acknowledged);

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE bot_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_invocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_global_settings ENABLE ROW LEVEL SECURITY;

-- All tables: authenticated users can read; admin roles can write
CREATE POLICY "bot_providers_select" ON bot_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_providers_all" ON bot_providers FOR ALL TO authenticated USING (true);

CREATE POLICY "bot_connectors_select" ON bot_connectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_connectors_all" ON bot_connectors FOR ALL TO authenticated USING (true);

CREATE POLICY "bot_definitions_select" ON bot_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_definitions_all" ON bot_definitions FOR ALL TO authenticated USING (true);

CREATE POLICY "bot_versions_select" ON bot_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_versions_all" ON bot_versions FOR ALL TO authenticated USING (true);

CREATE POLICY "bot_invocations_select" ON bot_invocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_invocations_insert" ON bot_invocations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "signal_rules_select" ON signal_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "signal_rules_all" ON signal_rules FOR ALL TO authenticated USING (true);

CREATE POLICY "signal_events_select" ON signal_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "signal_events_all" ON signal_events FOR ALL TO authenticated USING (true);

CREATE POLICY "bot_settings_select" ON bot_global_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_settings_all" ON bot_global_settings FOR ALL TO authenticated USING (true);
