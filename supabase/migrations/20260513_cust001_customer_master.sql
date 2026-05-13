-- =========================================================
-- CUST-001: Customer Master Foundation
-- Sprint: CUST-001 — Safe Additive Only
-- Purpose: Unified customer truth for warehouse, revenue,
--          closed-won, and tender pipelines.
-- =========================================================

-- 1. customer_master
CREATE TABLE IF NOT EXISTS customer_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  customer_type TEXT DEFAULT 'warehouse',       -- warehouse | transport | both | unknown
  region TEXT,
  country TEXT DEFAULT 'Saudi Arabia',
  status TEXT DEFAULT 'active',                 -- active | inactive | prospect
  source_confidence TEXT DEFAULT 'snapshot',     -- verified | snapshot | assumed
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. customer_aliases
CREATE TABLE IF NOT EXISTS customer_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customer_master(id),
  alias_name TEXT NOT NULL,
  source_table TEXT NOT NULL,                   -- e.g. commercial_opportunities
  source_field TEXT DEFAULT 'customer_name',
  source_record_id TEXT,
  confidence_status TEXT DEFAULT 'auto_matched', -- auto_matched | manual_verified | needs_review
  match_reason TEXT,
  needs_review BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. customer_source_links
CREATE TABLE IF NOT EXISTS customer_source_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer_master(id),
  source_system TEXT NOT NULL,                  -- excel_import | tender_mvp | crm (future)
  source_table TEXT NOT NULL,                   -- e.g. commercial_opportunities
  source_record_id TEXT,
  source_name TEXT,
  source_type TEXT DEFAULT 'warehouse',         -- warehouse | transport | revenue | closed_won
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: read-only for authenticated
ALTER TABLE customer_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_source_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_master_read' AND tablename = 'customer_master') THEN
    CREATE POLICY customer_master_read ON customer_master FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_aliases_read' AND tablename = 'customer_aliases') THEN
    CREATE POLICY customer_aliases_read ON customer_aliases FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customer_source_links_read' AND tablename = 'customer_source_links') THEN
    CREATE POLICY customer_source_links_read ON customer_source_links FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- =========================================================
-- SEED: Extract distinct customers from operational data
-- =========================================================

-- Insert distinct customer names from commercial_opportunities
INSERT INTO customer_master (canonical_name, display_name, customer_type, source_confidence, notes)
SELECT DISTINCT ON (LOWER(TRIM(customer_name)))
  LOWER(TRIM(customer_name)),
  TRIM(customer_name),
  'warehouse',
  'snapshot',
  'Auto-extracted from commercial_opportunities'
FROM commercial_opportunities
WHERE customer_name IS NOT NULL AND TRIM(customer_name) <> ''
ON CONFLICT DO NOTHING;

-- Insert distinct account names from closed_won_deals (if different)
INSERT INTO customer_master (canonical_name, display_name, customer_type, source_confidence, notes)
SELECT DISTINCT ON (LOWER(TRIM(account_name)))
  LOWER(TRIM(account_name)),
  TRIM(account_name),
  'warehouse',
  'snapshot',
  'Auto-extracted from closed_won_deals'
FROM closed_won_deals
WHERE account_name IS NOT NULL AND TRIM(account_name) <> ''
  AND LOWER(TRIM(account_name)) NOT IN (SELECT canonical_name FROM customer_master)
ON CONFLICT DO NOTHING;

-- Insert distinct customer names from revenue actuals (if different)
INSERT INTO customer_master (canonical_name, display_name, customer_type, source_confidence, notes)
SELECT DISTINCT ON (LOWER(TRIM(customer_name)))
  LOWER(TRIM(customer_name)),
  TRIM(customer_name),
  'warehouse',
  'snapshot',
  'Auto-extracted from warehouse_revenue_actuals'
FROM warehouse_revenue_actuals
WHERE customer_name IS NOT NULL AND TRIM(customer_name) <> ''
  AND LOWER(TRIM(customer_name)) NOT IN (SELECT canonical_name FROM customer_master)
ON CONFLICT DO NOTHING;

-- =========================================================
-- ALIASES: Create aliases linking back to source tables
-- =========================================================

-- Aliases from commercial_opportunities
INSERT INTO customer_aliases (customer_id, alias_name, source_table, source_field, confidence_status, match_reason)
SELECT DISTINCT
  cm.id,
  TRIM(co.customer_name),
  'commercial_opportunities',
  'customer_name',
  'auto_matched',
  'Exact canonical match from commercial_opportunities'
FROM commercial_opportunities co
JOIN customer_master cm ON cm.canonical_name = LOWER(TRIM(co.customer_name))
WHERE co.customer_name IS NOT NULL AND TRIM(co.customer_name) <> '';

-- Aliases from closed_won_deals
INSERT INTO customer_aliases (customer_id, alias_name, source_table, source_field, confidence_status, match_reason)
SELECT DISTINCT
  cm.id,
  TRIM(cw.account_name),
  'closed_won_deals',
  'account_name',
  'auto_matched',
  'Exact canonical match from closed_won_deals'
FROM closed_won_deals cw
JOIN customer_master cm ON cm.canonical_name = LOWER(TRIM(cw.account_name))
WHERE cw.account_name IS NOT NULL AND TRIM(cw.account_name) <> '';

-- Aliases from revenue actuals
INSERT INTO customer_aliases (customer_id, alias_name, source_table, source_field, confidence_status, match_reason)
SELECT DISTINCT
  cm.id,
  TRIM(ra.customer_name),
  'warehouse_revenue_actuals',
  'customer_name',
  'auto_matched',
  'Exact canonical match from warehouse_revenue_actuals'
FROM warehouse_revenue_actuals ra
JOIN customer_master cm ON cm.canonical_name = LOWER(TRIM(ra.customer_name))
WHERE ra.customer_name IS NOT NULL AND TRIM(ra.customer_name) <> '';

-- =========================================================
-- FLAG LIKELY DUPLICATES FOR REVIEW
-- =========================================================

-- Flag "Kuehne & Nagel" / "KN" / "KN-Hample" variants
UPDATE customer_aliases SET needs_review = true, confidence_status = 'needs_review',
  match_reason = 'Possible duplicate: Kuehne & Nagel / KN variant'
WHERE LOWER(alias_name) LIKE '%kuehne%' OR LOWER(alias_name) LIKE '%nagel%'
   OR LOWER(alias_name) = 'kn' OR LOWER(alias_name) LIKE 'kn-%' OR LOWER(alias_name) LIKE 'kn %';

-- Flag "Tejoury" variants
UPDATE customer_aliases SET needs_review = true, confidence_status = 'needs_review',
  match_reason = 'Possible duplicate: Tejoury variant'
WHERE LOWER(alias_name) LIKE '%tejoury%';

-- Flag "Linde" / "Linde SIGAS" variants
UPDATE customer_aliases SET needs_review = true, confidence_status = 'needs_review',
  match_reason = 'Possible duplicate: Linde / Linde SIGAS — DO NOT auto-merge (tender data protected)'
WHERE LOWER(alias_name) LIKE '%linde%';

-- Flag "PSA" / "BDP" variants
UPDATE customer_aliases SET needs_review = true, confidence_status = 'needs_review',
  match_reason = 'Possible duplicate: PSA-BDP variant'
WHERE LOWER(alias_name) LIKE '%psa%' OR LOWER(alias_name) LIKE '%bdp%';

-- Also flag parent customer_master rows
UPDATE customer_master SET source_confidence = 'needs_review'
WHERE id IN (SELECT DISTINCT customer_id FROM customer_aliases WHERE needs_review = true);
