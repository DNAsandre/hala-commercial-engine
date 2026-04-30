/**
 * Branding Profiles API Routes — Sprint 1
 * CRUD for doc_branding_profiles.
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const brandingRoutes = Router();
brandingRoutes.use(requireAuth);

const footerFormatSchema = z.object({
  show_ref: z.boolean().default(true),
  show_date: z.boolean().default(true),
  show_completed_by: z.boolean().default(true),
  show_page_numbers: z.boolean().default(true),
  custom_text: z.string().default(''),
});

const brandingBodySchema = z.object({
  name: z.string().min(1).max(200),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').default('#1a2744'),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').default('#2a4a7f'),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').default('#c9a84c'),
  font_family: z.string().default('IBM Plex Sans'),
  font_heading: z.string().default('Source Serif 4'),
  logo_url: z.string().nullable().optional(),
  cover_hero_urls: z.array(z.string()).default([]),
  footer_format: footerFormatSchema.default(() => ({ show_ref: true, show_date: true, show_completed_by: true, show_page_numbers: true, custom_text: '' })),
  watermark_url: z.string().nullable().optional(),
  header_style: z.enum(['full', 'minimal', 'branded']).default('full'),
});

// ─── GET /api/branding ────────────────────────────────────
brandingRoutes.get('/branding', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('doc_branding_profiles')
      .select('*')
      .order('name');
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

// ─── POST /api/branding ───────────────────────────────────
brandingRoutes.post('/branding', validateBody(brandingBodySchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;

    const { data, error } = await supabaseAdmin
      .from('doc_branding_profiles')
      .insert({ ...body, created_by: req.authUser?.userId || null })
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'branding.create',
      entityType: 'doc_branding_profiles',
      entityId: data.id,
      after: { name: body.name },
      source: 'human',
    });

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ─── PUT /api/branding/:id ────────────────────────────────
brandingRoutes.put('/branding/:id', validateBody(brandingBodySchema.partial()), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;

    const { data, error } = await supabaseAdmin
      .from('doc_branding_profiles')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };
    if (!data) throw { status: 404, message: 'Branding profile not found', code: 'NOT_FOUND' };

    await writeAuditLog({
      actor: req.authUser,
      action: 'branding.update',
      entityType: 'doc_branding_profiles',
      entityId: req.params.id,
      after: { name: body.name },
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ─── DELETE /api/branding/:id ─────────────────────────────
brandingRoutes.delete('/branding/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('doc_branding_profiles')
      .delete()
      .eq('id', req.params.id);
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'branding.delete',
      entityType: 'doc_branding_profiles',
      entityId: req.params.id,
      source: 'human',
    });

    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});
