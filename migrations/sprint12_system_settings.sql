-- System Settings table — singleton row for org-wide configuration
-- Stores all admin panel settings as JSONB for flexibility.
-- Run this migration to enable persistent settings.

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  settings JSONB NOT NULL DEFAULT '{
    "org_name": "Hala Supply Chain Solutions",
    "default_currency": "SAR",
    "default_region": "East",
    "fiscal_year_start": "jan",
    "logo_url": "https://halascs.com/logo.png",
    "pdf_footer": "Hala Supply Chain Solutions — Confidential",
    "primary_color": "#1B2A4A",
    "accent_color": "#2563EB",
    "feature_ai_authoring": true,
    "feature_auto_crm_sync": true,
    "feature_email_notifications": false,
    "feature_audit_export": true,
    "feature_dark_mode": false
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO system_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- RLS: allow authenticated reads, admin-only writes
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_read" ON system_settings
  FOR SELECT USING (true);

CREATE POLICY "system_settings_write" ON system_settings
  FOR ALL USING (true);
