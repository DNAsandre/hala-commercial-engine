-- ============================================================
-- TND-003: Add crm_pipeline_stage to tenders table
-- Sprint 1 — Dual Tracker Architecture
-- ============================================================
-- Separates the CRM parent pipeline position from the internal
-- tender process stage. tenders.phase remains the internal stage.
-- tenders.crm_pipeline_stage is the new CRM-layer field.
-- ============================================================

ALTER TABLE tenders
  ADD COLUMN IF NOT EXISTS crm_pipeline_stage TEXT NOT NULL DEFAULT 'prospecting';

-- Backfill heuristic: map existing internal phase → likely CRM stage
UPDATE tenders SET crm_pipeline_stage = CASE
  WHEN phase IN ('awarded')                                   THEN 'closed_won'
  WHEN phase IN ('lost', 'withdrawn')                         THEN 'closed_lost'
  WHEN phase IN ('negotiation')                               THEN 'contract_negotiation'
  WHEN phase IN ('submitted', 'clarification',
                 'technical_review', 'commercial_review')     THEN 'shortlisted'
  WHEN phase IN ('tender_drafting', 'internal_review',
                 'approval_matrix', 'approved',
                 'preparing_submission')                      THEN 'proposal_sent'
  WHEN phase IN ('bid_no_bid', 'solution_design',
                 'pnl_pricing', 'qualification_review')       THEN 'qualified'
  ELSE 'prospecting'
END
WHERE crm_pipeline_stage = 'prospecting';

CREATE INDEX IF NOT EXISTS idx_tenders_crm_pipeline_stage
  ON tenders (crm_pipeline_stage);
