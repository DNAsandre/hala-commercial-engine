-- ============================================================
-- CRM-001: Unified CRM Pipeline — Add pipeline_stage to proposals
-- ============================================================
-- Architectural shift: ONE pipeline with 10 shared stages for
-- both proposals and tenders. Each ticket type retains its own
-- internal process tracker (proposal.stage / tender checklist),
-- but the CRM pipeline position is tracked via pipeline_stage.
-- ============================================================

-- 1. Add pipeline_stage column to proposals
ALTER TABLE commercial_v2_proposals
  ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'prospecting';

-- 2. Backfill existing proposals based on outcome / internal stage
UPDATE commercial_v2_proposals SET pipeline_stage = CASE
  WHEN outcome = 'won'  THEN 'closed_won'
  WHEN outcome = 'lost' THEN 'closed_lost'
  WHEN stage IN ('negotiation', 'contract') THEN 'contract_negotiation'
  WHEN stage IN ('approval') THEN 'shortlisted'
  WHEN stage IN ('client_interest', 'design_solution', 'determine_pnl', 'prepare_proposal') THEN 'proposal_sent'
  WHEN stage IN ('qualification', 'meeting') THEN 'qualified'
  ELSE 'prospecting'
END;

-- 3. Index for pipeline queries
CREATE INDEX IF NOT EXISTS idx_proposals_pipeline_stage
  ON commercial_v2_proposals (pipeline_stage);

-- 4. Add pipeline_stage to tenders as well (alias of existing stage, for consistency)
-- Tenders already use `stage` as the pipeline stage — no change needed.
-- Just add an index if missing:
CREATE INDEX IF NOT EXISTS idx_tenders_pipeline_stage
  ON commercial_v2_tenders (stage);
