/**
 * Document Template API Routes — Sprint 1
 * CRUD for doc_templates, doc_template_versions.
 * Blocks are read-only here; use /api/blocks for block management.
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const templateRoutes = Router();
templateRoutes.use(requireAuth);

// ─── GET /api/templates ───────────────────────────────────
templateRoutes.get('/templates', async (req, res, next) => {
  try {
    const { data: tplRows, error: tplErr } = await supabaseAdmin
      .from('doc_templates')
      .select('*')
      .order('name');
    if (tplErr) throw { status: 500, message: tplErr.message };

    const { data: verRows, error: verErr } = await supabaseAdmin
      .from('doc_template_versions')
      .select('*')
      .order('version_number');
    if (verErr) throw { status: 500, message: verErr.message };

    const versions = verRows ?? [];
    const templates = (tplRows ?? []).map((t: any) => ({
      ...t,
      versions: versions.filter((v: any) => v.template_id === t.id),
    }));
    res.json({ data: templates });
  } catch (err) { next(err); }
});

// ─── POST /api/templates ──────────────────────────────────
const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  doc_type: z.enum(['quote', 'proposal', 'sla', 'msa', 'service_order_transport', 'service_order_warehouse']),
  description: z.string().default(''),
  default_branding_profile_id: z.string().uuid().nullable().optional(),
  default_locale: z.enum(['en', 'ar', 'bilingual']).default('en'),
});

templateRoutes.post('/templates', validateBody(createTemplateSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;

    const { data: tpl, error: tplErr } = await supabaseAdmin
      .from('doc_templates')
      .insert({
        name: body.name,
        doc_type: body.doc_type,
        description: body.description,
        default_branding_profile_id: body.default_branding_profile_id ?? null,
        default_locale: body.default_locale,
        status: 'draft',
        created_by: req.authUser?.userId || null,
      })
      .select()
      .single();
    if (tplErr) throw { status: 500, message: tplErr.message };

    const { data: ver, error: verErr } = await supabaseAdmin
      .from('doc_template_versions')
      .insert({
        template_id: tpl.id,
        version_number: 1,
        recipe: [],
        layout: {
          cover_page: true,
          cover_style: 'hero_image',
          section_spacing: 'normal',
          page_break_between_sections: false,
          annexure_section: false,
          toc_auto: false,
        },
        published_at: null,
        created_by: req.authUser?.userId || null,
      })
      .select()
      .single();
    if (verErr) throw { status: 500, message: verErr.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'template.create',
      entityType: 'doc_templates',
      entityId: tpl.id,
      after: { name: body.name, doc_type: body.doc_type },
      source: 'human',
    });

    res.status(201).json({ data: { ...tpl, versions: [ver] } });
  } catch (err) { next(err); }
});

// ─── PUT /api/templates/:id ───────────────────────────────
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  default_branding_profile_id: z.string().uuid().nullable().optional(),
  default_locale: z.enum(['en', 'ar', 'bilingual']).optional(),
});

templateRoutes.put('/templates/:id', validateBody(updateTemplateSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;

    const { data, error } = await supabaseAdmin
      .from('doc_templates')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };
    if (!data) throw { status: 404, message: 'Template not found', code: 'NOT_FOUND' };

    await writeAuditLog({
      actor: req.authUser,
      action: 'template.update',
      entityType: 'doc_templates',
      entityId: req.params.id,
      after: body,
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});

// ─── POST /api/templates/:id/versions ────────────────────
const addVersionSchema = z.object({
  recipe: z.array(z.any()).default([]),
  layout: z.record(z.string(), z.any()).default(() => ({})),
});

templateRoutes.post('/templates/:id/versions', validateBody(addVersionSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;

    const { data: existing } = await supabaseAdmin
      .from('doc_template_versions')
      .select('version_number')
      .eq('template_id', req.params.id)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersion = ((existing?.[0]?.version_number) ?? 0) + 1;

    const { data, error } = await supabaseAdmin
      .from('doc_template_versions')
      .insert({
        template_id: req.params.id,
        version_number: nextVersion,
        recipe: body.recipe,
        layout: body.layout,
        published_at: null,
        created_by: req.authUser?.userId || null,
      })
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await supabaseAdmin
      .from('doc_templates')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    await writeAuditLog({
      actor: req.authUser,
      action: 'template.add_version',
      entityType: 'doc_template_versions',
      entityId: data.id,
      after: { version_number: nextVersion, template_id: req.params.id },
      source: 'human',
    });

    res.status(201).json({ data });
  } catch (err) { next(err); }
});

// ─── PUT /api/templates/:id/versions/:versionId/publish ──
templateRoutes.put('/templates/:id/versions/:versionId/publish', async (req, res, next) => {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('doc_template_versions')
      .update({ published_at: now })
      .eq('id', req.params.versionId)
      .eq('template_id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };
    if (!data) throw { status: 404, message: 'Template version not found', code: 'NOT_FOUND' };

    await supabaseAdmin
      .from('doc_templates')
      .update({ status: 'published', updated_at: now })
      .eq('id', req.params.id);

    await writeAuditLog({
      actor: req.authUser,
      action: 'template.publish',
      entityType: 'doc_template_versions',
      entityId: req.params.versionId,
      after: { published_at: now },
      source: 'human',
    });

    res.json({ data });
  } catch (err) { next(err); }
});
