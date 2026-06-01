-- ============================================================
-- AI Provider Secrets — Secure Storage (Write-Only from Client)
-- ============================================================
-- Stores API keys in a separate table that clients can WRITE to
-- but NEVER READ from. Only service_role (Edge Functions) can read.
-- This keeps the raw key invisible to anyone inspecting the browser.

-- Drop the vault-based functions (vault encryption permissions don't work via RPC)
DROP FUNCTION IF EXISTS store_provider_secret(TEXT, TEXT);
DROP FUNCTION IF EXISTS remove_provider_secret(TEXT);
DROP FUNCTION IF EXISTS get_provider_secret(TEXT);

-- Create the secrets table
CREATE TABLE IF NOT EXISTS ai_provider_secrets (
  provider_id TEXT PRIMARY KEY REFERENCES ai_providers(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  key_last4 TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT DEFAULT ''
);

-- RLS: Write-only for authenticated users, read-only for service_role
ALTER TABLE ai_provider_secrets ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT and UPDATE but NEVER SELECT
CREATE POLICY "auth_insert_secrets"
  ON ai_provider_secrets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_secrets"
  ON ai_provider_secrets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role has full access (Edge Functions use this to read the key)
CREATE POLICY "service_full_secrets"
  ON ai_provider_secrets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── RPC: Store a provider API key ───
-- Uses SECURITY DEFINER so it can update both tables atomically.
-- The key is stored in ai_provider_secrets (not readable by client).
-- Only metadata goes into ai_providers.config.
CREATE OR REPLACE FUNCTION store_provider_secret(
  p_provider_id TEXT,
  p_secret_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last4 TEXT;
BEGIN
  v_last4 := RIGHT(p_secret_key, 4);

  -- Upsert into secrets table
  INSERT INTO ai_provider_secrets (provider_id, encrypted_key, key_last4, updated_at)
  VALUES (p_provider_id, p_secret_key, v_last4, now())
  ON CONFLICT (provider_id)
  DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key,
                key_last4 = EXCLUDED.key_last4,
                updated_at = now();

  -- Update provider config metadata (NEVER the actual key)
  UPDATE ai_providers
  SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
        'api_key_configured', true,
        'api_key_last4', v_last4
      ),
      updated_at = now()
  WHERE id = p_provider_id;

  RETURN jsonb_build_object('success', true, 'last4', v_last4);
END;
$$;

-- ─── RPC: Remove a provider API key ───
CREATE OR REPLACE FUNCTION remove_provider_secret(p_provider_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM ai_provider_secrets WHERE provider_id = p_provider_id;

  UPDATE ai_providers
  SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
        'api_key_configured', false,
        'api_key_last4', ''
      ),
      updated_at = now()
  WHERE id = p_provider_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── RPC: Read a provider secret (service_role only) ───
-- Called by Edge Functions to get the key for AI calls.
CREATE OR REPLACE FUNCTION get_provider_secret(p_provider_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: only server-side functions can read API keys';
  END IF;

  SELECT encrypted_key INTO v_key
  FROM ai_provider_secrets
  WHERE provider_id = p_provider_id;

  RETURN v_key;
END;
$$;

GRANT EXECUTE ON FUNCTION store_provider_secret TO authenticated;
GRANT EXECUTE ON FUNCTION remove_provider_secret TO authenticated;
GRANT EXECUTE ON FUNCTION get_provider_secret TO service_role;
