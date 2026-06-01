-- ============================================================
-- Allow authenticated users to read API keys for direct provider calls
-- This is needed when edge functions are not deployed.
-- Once edge functions are deployed, this policy can be removed.
-- ============================================================

-- Allow authenticated users to SELECT (read) from ai_provider_secrets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_provider_secrets' AND policyname = 'auth_select_secrets') THEN
    CREATE POLICY "auth_select_secrets"
      ON ai_provider_secrets FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
