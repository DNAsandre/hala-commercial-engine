-- ============================================================
-- GP-001: GP Basis Visibility
-- Sprint: GP-001
-- Author: Claude / Antigravity
-- Date: 2026-05-13
--
-- ADDITIVE ONLY. No destructive changes. No CRM. No gates.
-- Adds GP basis classification fields to commercial_opportunities.
-- Conservative default: all deals assumed_75pct until Finance verifies.
-- ============================================================

-- ─── TASK 1: Add GP visibility columns ───────────────────────

ALTER TABLE commercial_opportunities
  ADD COLUMN IF NOT EXISTS gp_basis TEXT;

ALTER TABLE commercial_opportunities
  ADD COLUMN IF NOT EXISTS gp_margin_pct NUMERIC;

ALTER TABLE commercial_opportunities
  ADD COLUMN IF NOT EXISTS gp_confidence_status TEXT;

-- ─── TASK 2: Conservative default classification ─────────────
-- NOTE: This is VISIBILITY classification only, not finance validation.
-- All deals are assumed_75pct until Finance provides actual cost data.

-- Deals with zero or null ACV = no_revenue
UPDATE commercial_opportunities
SET
  gp_basis = 'no_revenue',
  gp_margin_pct = 0,
  gp_confidence_status = 'unknown'
WHERE (acv_annual IS NULL OR acv_annual = 0)
  AND gp_basis IS NULL;

-- All remaining deals = assumed_75pct (dangerous default)
UPDATE commercial_opportunities
SET
  gp_basis = 'assumed_75pct',
  gp_margin_pct = 25,
  gp_confidence_status = 'needs_finance_review'
WHERE gp_basis IS NULL;
