-- ============================================================
-- Bot Chaining — Add chain_config to ai_bot_versions
-- ============================================================
-- Allows bots to be chained together in a pipeline.
-- chain_config: { next_bot_id, prompt_user, chain_label }

ALTER TABLE ai_bot_versions ADD COLUMN IF NOT EXISTS chain_config JSONB DEFAULT '{}';
