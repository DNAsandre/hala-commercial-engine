-- ==============================================================================
-- GHL CRM INTEGRATION — Bi-Directional Sync Schema
-- GoHighLevel Private Integration (Contacts, Opportunities, Businesses)
--
-- Design: ID-first entity mapping. Every row in ghl_entity_map carries all
-- available GHL IDs (contact, opportunity, business) so that updates always
-- resolve to the correct entity regardless of email changes or duplicates.
-- ==============================================================================

-- ─── 1. GHL SYNC CONFIGURATION ──────────────────────────────────────────────
-- Singleton config row. The actual GHL_PRIVATE_TOKEN lives in .env, NEVER here.

CREATE TABLE IF NOT EXISTS ghl_sync_config (
    id                      TEXT PRIMARY KEY DEFAULT 'default',
    location_id             TEXT NOT NULL DEFAULT '',
    private_token_configured BOOLEAN DEFAULT FALSE,
    default_pipeline_id     TEXT,
    default_pipeline_name   TEXT,
    sync_enabled            BOOLEAN DEFAULT FALSE,
    sync_direction          TEXT CHECK (sync_direction IN ('inbound','outbound','bidirectional'))
                            DEFAULT 'bidirectional',
    webhook_url             TEXT,
    last_health_check_at    TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the singleton config row
INSERT INTO ghl_sync_config (id, location_id, sync_enabled)
VALUES ('default', '', false)
ON CONFLICT (id) DO NOTHING;


-- ─── 2. GHL ENTITY MAP ─────────────────────────────────────────────────────
-- Core ID mapping between GHL entities and Hala entities.
-- Each row represents one GHL entity mapped to one Hala entity.
-- Cross-reference IDs are always captured for linkage.

CREATE TABLE IF NOT EXISTS ghl_entity_map (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- GHL side: which entity type and its ID
    ghl_entity_type     TEXT NOT NULL CHECK (ghl_entity_type IN ('contact', 'opportunity', 'business')),
    ghl_entity_id       TEXT NOT NULL,

    -- Hala side: which entity type and its ID
    hala_entity_type    TEXT NOT NULL CHECK (hala_entity_type IN ('customer', 'workspace')),
    hala_entity_id      TEXT NOT NULL,

    -- Cross-reference GHL IDs (always populated when available)
    -- An opportunity row will also store its contact_id and business_id
    ghl_contact_id      TEXT,
    ghl_opportunity_id  TEXT,
    ghl_business_id     TEXT,

    -- Sync state
    sync_status         TEXT CHECK (sync_status IN ('active', 'pending', 'error', 'deleted'))
                        DEFAULT 'active',
    last_synced_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Flexible metadata (tags, custom fields, pipeline stage, etc.)
    metadata            JSONB DEFAULT '{}',

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Each GHL entity can only map to one Hala entity
    UNIQUE(ghl_entity_type, ghl_entity_id)
);

-- Index for reverse lookups (Hala → GHL)
CREATE INDEX IF NOT EXISTS idx_ghl_entity_map_hala
    ON ghl_entity_map (hala_entity_type, hala_entity_id);

-- Index for cross-reference lookups
CREATE INDEX IF NOT EXISTS idx_ghl_entity_map_contact_id
    ON ghl_entity_map (ghl_contact_id) WHERE ghl_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ghl_entity_map_opportunity_id
    ON ghl_entity_map (ghl_opportunity_id) WHERE ghl_opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ghl_entity_map_business_id
    ON ghl_entity_map (ghl_business_id) WHERE ghl_business_id IS NOT NULL;


-- ─── 3. GHL SYNC LOG ───────────────────────────────────────────────────────
-- Audit trail of every inbound (webhook) and outbound (push) sync event.
-- Used for idempotency checks, debugging, and sync health monitoring.

CREATE TABLE IF NOT EXISTS ghl_sync_log (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- Direction and event classification
    direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    event_type          TEXT NOT NULL,           -- e.g. 'OpportunityCreate', 'ContactUpdate'

    -- Entity references
    ghl_entity_type     TEXT,                    -- 'contact', 'opportunity', 'business'
    ghl_entity_id       TEXT,
    hala_entity_type    TEXT,                    -- 'customer', 'workspace'
    hala_entity_id      TEXT,

    -- Processing state
    status              TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'skipped'))
                        DEFAULT 'pending',

    -- Payloads for debugging
    request_payload     JSONB,
    response_payload    JSONB,
    error               TEXT,

    -- Idempotency
    idempotency_key     TEXT,
    webhook_id          TEXT,                    -- GHL's webhookId for dedup

    -- Timestamps
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

-- Index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_idempotency
    ON ghl_sync_log (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Index for webhook dedup
CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_webhook_id
    ON ghl_sync_log (webhook_id) WHERE webhook_id IS NOT NULL;

-- Index for status monitoring
CREATE INDEX IF NOT EXISTS idx_ghl_sync_log_status
    ON ghl_sync_log (status, direction, created_at DESC);
