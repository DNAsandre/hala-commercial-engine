-- ============================================================
-- RPT-002: Customer Review Pack Model
-- Read-only MBR/QBR review packs for internal leadership use.
-- Not for external distribution without Finance/Commercial review.
-- No CRM. No gates. No writes from UI.
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_review_packs (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id                 text NOT NULL,
  review_type                 text NOT NULL DEFAULT 'MBR',
  review_period               text NOT NULL DEFAULT '',
  review_title                text NOT NULL DEFAULT '',
  generated_at                timestamptz NOT NULL DEFAULT now(),
  generated_by                text NOT NULL DEFAULT 'system',
  source_batch_ids            text[] DEFAULT '{}',
  source_truth_summary        jsonb DEFAULT '{}'::jsonb,
  assumptions_summary         jsonb DEFAULT '{}'::jsonb,
  customer_confidence_summary jsonb DEFAULT '{}'::jsonb,
  report_status               text NOT NULL DEFAULT 'draft',
  report_sections             jsonb DEFAULT '{}'::jsonb,
  notes                       text NOT NULL DEFAULT '',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crp_customer   ON customer_review_packs(customer_id);
CREATE INDEX IF NOT EXISTS idx_crp_type       ON customer_review_packs(review_type);
CREATE INDEX IF NOT EXISTS idx_crp_period     ON customer_review_packs(review_period);
CREATE INDEX IF NOT EXISTS idx_crp_status     ON customer_review_packs(report_status);

-- RLS — read-only
ALTER TABLE customer_review_packs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_review_packs' AND policyname = 'customer_review_packs_read_all'
  ) THEN
    CREATE POLICY customer_review_packs_read_all ON customer_review_packs FOR SELECT USING (true);
  END IF;
END $$;
