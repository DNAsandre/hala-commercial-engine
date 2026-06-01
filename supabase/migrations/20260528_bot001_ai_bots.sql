-- ============================================================
-- AI Bots & Bot Versions
-- ============================================================
-- Persistence layer for the Bot Builder / Bot Registry.
-- Replaces the in-memory mockBots[] / mockBotVersions[] arrays.
-- Provider references link to the existing ai_providers table.

CREATE TABLE IF NOT EXISTS ai_bots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  display_name TEXT,
  type TEXT NOT NULL DEFAULT 'action' CHECK (type IN ('action', 'monitor')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled', 'archived')),
  purpose TEXT DEFAULT '',
  domains_allowed TEXT[] DEFAULT '{}',
  regions_allowed TEXT[] DEFAULT '{}',
  roles_allowed TEXT[] DEFAULT '{}',
  current_version_id TEXT,
  provider_id TEXT,
  model TEXT,
  rate_limit INTEGER DEFAULT 20,
  cost_cap NUMERIC DEFAULT 10,
  timeout_sec INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS ai_bot_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bot_id TEXT NOT NULL REFERENCES ai_bots(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  system_instruction TEXT DEFAULT '',
  custom_instruction TEXT DEFAULT '',
  safety_rules TEXT DEFAULT '',
  temperature NUMERIC DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2000,
  allowed_actions TEXT[] DEFAULT '{}',
  provider_id TEXT,
  model TEXT,
  connector_snapshot JSONB DEFAULT '{}',
  permission_snapshot JSONB DEFAULT '{}',
  knowledge_base_ids TEXT[] DEFAULT '{}',
  change_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

-- Index for fast version lookup by bot
CREATE INDEX IF NOT EXISTS idx_ai_bot_versions_bot_id ON ai_bot_versions(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_bots_status ON ai_bots(status);

-- RLS: authenticated users can read/write, service_role has full access
ALTER TABLE ai_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bot_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_ai_bots" ON ai_bots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_ai_bots" ON ai_bots FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_ai_bots" ON ai_bots FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "auth_read_ai_bot_versions" ON ai_bot_versions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_ai_bot_versions" ON ai_bot_versions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_ai_bot_versions" ON ai_bot_versions FOR ALL USING (auth.role() = 'service_role');
