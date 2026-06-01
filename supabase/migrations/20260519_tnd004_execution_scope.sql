-- ════════════════════════════════════════════════════════════════
-- TND-004: Tender Execution Scope — Operational Geography Fields
-- Run: 2026-05-19
-- Author: Antigravity / Hala Commercial Engine
--
-- Adds 6 structured operational geography fields to the tenders table.
-- These capture WHERE and HOW a tender will be executed,
-- separate from CRM region (business geography).
--
-- This data is manually captured from RFQ / SOW / tender documents.
-- It later drives: Solution Design, Pricing, Resource Planning,
-- Approval Matrix, PDF Studio, Submission Packs, Mobilization.
--
-- SAFE: All ADD COLUMN IF NOT EXISTS. Re-runnable.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE tenders
  ADD COLUMN IF NOT EXISTS execution_regions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_sites JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS geographic_complexity TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS site_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_notes TEXT DEFAULT '';

-- NOTE: The existing tenders.region column (CRM region) is PRESERVED.
-- It remains as customer metadata / business geography.
-- The new execution_* fields represent operational delivery geography.
