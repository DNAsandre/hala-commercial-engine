-- ============================================================
-- RPT-001: Monthly Commercial Report Model
-- Read-only report snapshots for leadership review.
-- No external distribution. No CRM. No gates. No writes from UI.
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_commercial_reports (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_period           text NOT NULL DEFAULT '',
  report_month            integer NOT NULL DEFAULT 1,
  report_year             integer NOT NULL DEFAULT 2026,
  report_title            text NOT NULL DEFAULT '',
  generated_at            timestamptz NOT NULL DEFAULT now(),
  source_batch_ids        text[] DEFAULT '{}',
  report_status           text NOT NULL DEFAULT 'draft',
  source_truth_summary    jsonb DEFAULT '{}'::jsonb,
  assumptions_summary     jsonb DEFAULT '{}'::jsonb,
  formula_parity_summary  jsonb DEFAULT '{}'::jsonb,
  report_sections         jsonb DEFAULT '{}'::jsonb,
  generated_by            text NOT NULL DEFAULT 'system',
  notes                   text NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rpt_period ON monthly_commercial_reports(report_period);
CREATE INDEX IF NOT EXISTS idx_rpt_year   ON monthly_commercial_reports(report_year);
CREATE INDEX IF NOT EXISTS idx_rpt_status ON monthly_commercial_reports(report_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rpt_period_unique ON monthly_commercial_reports(report_period);

-- RLS
ALTER TABLE monthly_commercial_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'monthly_commercial_reports' AND policyname = 'monthly_commercial_reports_read_all'
  ) THEN
    CREATE POLICY monthly_commercial_reports_read_all ON monthly_commercial_reports FOR SELECT USING (true);
  END IF;
END $$;
