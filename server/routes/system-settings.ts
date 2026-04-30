/**
 * System Settings — GET/PUT /api/system-settings
 * Singleton row pattern: one row, id='global', JSONB settings column.
 * Persists organization name, currency, region, fiscal year, feature flags, branding.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export const systemSettingsRoutes = Router();

const DEFAULTS = {
  org_name: 'Hala Supply Chain Solutions',
  default_currency: 'SAR',
  default_region: 'East',
  fiscal_year_start: 'jan',
  logo_url: 'https://halascs.com/logo.png',
  pdf_footer: 'Hala Supply Chain Solutions — Confidential',
  primary_color: '#1B2A4A',
  accent_color: '#2563EB',
  feature_ai_authoring: true,
  feature_auto_crm_sync: true,
  feature_email_notifications: false,
  feature_audit_export: true,
  feature_dark_mode: false,
};

// GET /api/system-settings
systemSettingsRoutes.get('/system-settings', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();

    if (error) {
      // Table might not exist yet — return defaults
      console.warn('[system-settings] Read error (table may not exist):', error.message);
      return res.json({ data: { id: 'global', settings: DEFAULTS } });
    }

    res.json({ data: data ?? { id: 'global', settings: DEFAULTS } });
  } catch (err) { next(err); }
});

// PUT /api/system-settings
systemSettingsRoutes.put('/system-settings', async (req, res, next) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Request body must be a settings object' });
    }

    // Upsert: try update first, then insert
    const { data: existing } = await supabaseAdmin
      .from('system_settings')
      .select('id')
      .eq('id', 'global')
      .maybeSingle();

    let result;
    if (existing) {
      result = await supabaseAdmin
        .from('system_settings')
        .update({ settings, updated_at: new Date().toISOString() })
        .eq('id', 'global')
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from('system_settings')
        .insert({ id: 'global', settings, updated_at: new Date().toISOString() })
        .select()
        .single();
    }

    if (result.error) {
      // Table might not exist — return success with local echo
      console.warn('[system-settings] Write error (table may not exist):', result.error.message);
      return res.json({ data: { id: 'global', settings }, warning: 'Settings not persisted — run migration to create system_settings table' });
    }

    res.json({ data: result.data });
  } catch (err) { next(err); }
});
