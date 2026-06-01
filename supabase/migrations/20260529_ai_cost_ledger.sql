-- ============================================================
-- AI Cost Ledger — Create ai_usage_logs + cost tracking columns
-- ============================================================
-- Creates the base table (from 009_ai_providers.sql) if it doesn't exist
-- Then adds cost_usd, bot_id, bot_name for the cost ledger

-- ── Base table ──
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text,
  provider text NOT NULL,
  model text NOT NULL,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  latency_ms int,
  workspace_id text,
  action text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  cost_usd numeric DEFAULT 0,
  bot_id text,
  bot_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_usage_logs' AND policyname = 'ai_usage_logs_read') THEN
    CREATE POLICY "ai_usage_logs_read" ON ai_usage_logs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_usage_logs' AND policyname = 'ai_usage_logs_insert') THEN
    CREATE POLICY "ai_usage_logs_insert" ON ai_usage_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON ai_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_bot ON ai_usage_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_cost ON ai_usage_logs(cost_usd);

-- ── Also ensure ai_providers table exists ──
CREATE TABLE IF NOT EXISTS ai_providers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  model_default text NOT NULL,
  models text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_providers' AND policyname = 'ai_providers_read') THEN
    CREATE POLICY "ai_providers_read" ON ai_providers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_providers' AND policyname = 'ai_providers_admin') THEN
    CREATE POLICY "ai_providers_admin" ON ai_providers FOR ALL USING (true);
  END IF;
END $$;

-- Seed default providers (skip if already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM ai_providers WHERE name = 'openai') THEN
    INSERT INTO ai_providers (id, name, display_name, model_default, models, enabled, config)
    VALUES (
      'aip-openai-001', 'openai', 'OpenAI', 'gpt-4o',
      ARRAY['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      true, '{"max_tokens": 4096, "endpoint": "openai-generate"}'::jsonb
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ai_providers WHERE name = 'google') THEN
    INSERT INTO ai_providers (id, name, display_name, model_default, models, enabled, config)
    VALUES (
      'aip-google-001', 'google', 'Google AI (Gemini)', 'gemini-1.5-pro',
      ARRAY['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
      true, '{"max_tokens": 4096, "endpoint": "google-generate"}'::jsonb
    );
  END IF;
END $$;
