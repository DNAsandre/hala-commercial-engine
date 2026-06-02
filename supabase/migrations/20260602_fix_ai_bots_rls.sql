-- ============================================================
-- FIX: ai_bots + ai_bot_versions RLS policies
-- ============================================================
-- The original policies required auth.role() = 'authenticated',
-- but the app uses the Supabase anon key. This caused all bot
-- inserts/updates to silently fail, resulting in blank bots
-- that only existed in the in-memory mock array.
--
-- Fix: Match the pattern used by ai_providers (USING (true)).
-- ============================================================

-- Drop the broken policies
DROP POLICY IF EXISTS "auth_read_ai_bots" ON ai_bots;
DROP POLICY IF EXISTS "auth_write_ai_bots" ON ai_bots;
DROP POLICY IF EXISTS "service_ai_bots" ON ai_bots;

DROP POLICY IF EXISTS "auth_read_ai_bot_versions" ON ai_bot_versions;
DROP POLICY IF EXISTS "auth_write_ai_bot_versions" ON ai_bot_versions;
DROP POLICY IF EXISTS "service_ai_bot_versions" ON ai_bot_versions;

-- Create open policies matching ai_providers pattern
CREATE POLICY "ai_bots_read" ON ai_bots FOR SELECT USING (true);
CREATE POLICY "ai_bots_write" ON ai_bots FOR ALL USING (true);
CREATE POLICY "ai_bot_versions_read" ON ai_bot_versions FOR SELECT USING (true);
CREATE POLICY "ai_bot_versions_write" ON ai_bot_versions FOR ALL USING (true);
