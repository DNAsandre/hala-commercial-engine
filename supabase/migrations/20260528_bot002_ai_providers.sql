-- ============================================================
-- AI Providers — Persistence Layer
-- ============================================================
-- Stores OpenAI, Google AI, and other provider configurations.
-- The ai-client.ts frontend falls back to getDefaultProviders()
-- when this table doesn't exist, but saving API keys requires it.

CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  model_default TEXT NOT NULL DEFAULT 'gpt-4o',
  models TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: authenticated users can read/write, service_role has full access
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_ai_providers" ON ai_providers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_write_ai_providers" ON ai_providers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "service_ai_providers" ON ai_providers FOR ALL USING (auth.role() = 'service_role');

-- Seed with default providers (OpenAI + Google)
INSERT INTO ai_providers (id, name, display_name, model_default, models, enabled, config)
VALUES
  ('aip-openai-001', 'openai', 'OpenAI', 'gpt-4o',
   ARRAY['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
   true, '{"max_tokens": 4096, "endpoint": "openai-generate"}'::jsonb),
  ('aip-google-001', 'google', 'Google AI (Gemini)', 'gemini-1.5-pro',
   ARRAY['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
   true, '{"max_tokens": 4096, "endpoint": "google-generate"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
