-- ==============================================================================
-- CRM CONFIG — GHL / DNA Supersystems Integration
-- Stores connection config (NOT the API key — that goes in Supabase secrets)
-- ==============================================================================

DROP TABLE IF EXISTS crm_config CASCADE;
DROP TABLE IF EXISTS crm_contact_map CASCADE;
DROP TABLE IF EXISTS crm_opportunity_map CASCADE;

-- 1. CRM Configuration
CREATE TABLE crm_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    provider TEXT NOT NULL DEFAULT 'ghl',
    provider_label TEXT DEFAULT 'DNA Supersystems',
    base_url TEXT NOT NULL DEFAULT 'https://services.leadconnectorhq.com',
    location_id TEXT NOT NULL DEFAULT '',
    api_version TEXT DEFAULT '2021-07-28',
    sync_enabled BOOLEAN DEFAULT FALSE,
    sync_direction TEXT CHECK (sync_direction IN ('inbound','outbound','bidirectional')) DEFAULT 'bidirectional',
    default_pipeline_id TEXT,
    default_pipeline_name TEXT,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Contact Mapping (Hala customer_id <-> GHL contact_id)
CREATE TABLE crm_contact_map (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    hala_customer_id TEXT NOT NULL,
    hala_customer_name TEXT,
    ghl_contact_id TEXT NOT NULL,
    ghl_contact_name TEXT,
    ghl_email TEXT,
    ghl_phone TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT CHECK (sync_status IN ('synced','pending','error')) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hala_customer_id, ghl_contact_id)
);

-- 3. Opportunity Mapping (Hala workspace_id <-> GHL opportunity_id)
CREATE TABLE crm_opportunity_map (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    hala_workspace_id TEXT NOT NULL,
    hala_workspace_name TEXT,
    ghl_opportunity_id TEXT NOT NULL,
    ghl_pipeline_id TEXT,
    ghl_stage_id TEXT,
    ghl_stage_name TEXT,
    monetary_value NUMERIC,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT CHECK (sync_status IN ('synced','pending','error')) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hala_workspace_id, ghl_opportunity_id)
);

-- Seed default config row
INSERT INTO crm_config (id, provider, provider_label, base_url, location_id, sync_enabled)
VALUES ('default', 'ghl', 'DNA Supersystems', 'https://services.leadconnectorhq.com', '', false)
ON CONFLICT (id) DO NOTHING;
