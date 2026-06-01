-- CMD-001: Customer Master Compatibility Columns + Safe Pipeline Linkage
-- Date: 2026-05-17
-- Revised: 2026-05-21
--
-- Purpose:
--   Keep the Customer Command Centre compatible with customer metrics fields
--   without inserting invented customer records or fake financial estimates.
--
-- Doctrine:
--   - NULL = unknown / not captured yet.
--   - 0 = explicitly confirmed zero.
--   - No hardcoded customers.
--   - No realistic estimates.
--   - Customer records must originate from verified imports, governed intake,
--     or human-approved SQL.
--
-- Safe to run manually in Supabase SQL Editor.

-- Add optional compatibility columns. No fake defaults.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dso INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_expiry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_value_2025 NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS expected_monthly_revenue NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS revenue_2023 NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS revenue_2024 NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS revenue_2025 NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pallet_contracted INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pallet_occupied INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pallet_potential INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rate_per_pallet NUMERIC;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Link existing opportunity rows to existing customer rows only.
-- This does not create customers. It only joins records already present.
UPDATE commercial_opportunities co
SET customer_id = c.id
FROM customers c
WHERE LOWER(TRIM(co.customer_name)) = LOWER(TRIM(c.name))
  AND co.customer_id IS DISTINCT FROM c.id;
