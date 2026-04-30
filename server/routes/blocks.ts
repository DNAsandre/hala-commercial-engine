/**
 * Document Blocks API Routes — Sprint 3 (full CRUD)
 * Read + Write endpoints for doc_blocks.
 * Blocks created here become available in TemplateDesigner block picker.
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const blockRoutes = Router();
blockRoutes.use(requireAuth);

// ─── GET /api/blocks ──────────────────────────────────────
blockRoutes.get('/blocks', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('doc_blocks')
      .select('*')
      .order('family')
      .order('block_key');
    if (error) throw { status: 500, message: error.message };
    res.json({ data: data ?? [] });
  } catch (err) { next(err); }
});

// ─── GET /api/blocks/:id ──────────────────────────────────
blockRoutes.get('/blocks/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('doc_blocks')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) throw { status: 404, message: 'Block not found', code: 'NOT_FOUND' };
    res.json({ data });
  } catch (err) { next(err); }
});

// ─── POST /api/blocks ─────────────────────────────────────
const createBlockSchema = z.object({
  block_key: z.string().min(2).max(100).regex(/^[a-z0-9._]+$/, 'Block key must be lowercase alphanumeric with dots/underscores'),
  display_name: z.string().min(1).max(200),
  family: z.enum(['commercial', 'data_bound', 'legal', 'annexure', 'asset']),
  editor_mode: z.enum(['wysiwyg', 'form', 'readonly', 'clause']),
  description: z.string().default(''),
  default_content: z.string().default('<p>Block content goes here...</p>'),
  render_key: z.string().default(''),
  permissions: z.object({
    editable_in_draft: z.boolean().default(true),
    editable_in_canon: z.boolean().default(false),
    ai_allowed: z.boolean().default(true),
    lockable: z.boolean().default(true),
  }).default({ editable_in_draft: true, editable_in_canon: false, ai_allowed: true, lockable: true }),
  schema: z.object({
    variable_slots: z.array(z.string()).default([]),
    config: z.record(z.string(), z.string()).default({}),
  }).default({ variable_slots: [], config: {} }),
});

blockRoutes.post('/blocks', validateBody(createBlockSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const now = new Date().toISOString();

    // Check block_key uniqueness
    const { data: existing } = await supabaseAdmin
      .from('doc_blocks')
      .select('id')
      .eq('block_key', body.block_key)
      .maybeSingle();
    if (existing) {
      throw { status: 409, message: `Block key "${body.block_key}" already exists`, code: 'DUPLICATE_KEY' };
    }

    // Auto-generate render_key from block_key if not provided
    const render_key = body.render_key || body.block_key.replace(/\./g, '_');

    const { data: block, error } = await supabaseAdmin
      .from('doc_blocks')
      .insert({
        block_key: body.block_key,
        display_name: body.display_name,
        family: body.family,
        editor_mode: body.editor_mode,
        description: body.description,
        default_content: body.default_content,
        render_key,
        permissions: body.permissions,
        schema: body.schema,
        created_by: req.authUser?.userId || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_block.create',
      entityType: 'doc_blocks',
      entityId: block.id,
      after: { block_key: body.block_key, display_name: body.display_name, family: body.family },
      source: 'human',
    });

    res.status(201).json({ data: block });
  } catch (err) { next(err); }
});

// ─── PUT /api/blocks/:id ──────────────────────────────────
const updateBlockSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  family: z.enum(['commercial', 'data_bound', 'legal', 'annexure', 'asset']).optional(),
  editor_mode: z.enum(['wysiwyg', 'form', 'readonly', 'clause']).optional(),
  description: z.string().optional(),
  default_content: z.string().optional(),
  render_key: z.string().optional(),
  permissions: z.object({
    editable_in_draft: z.boolean().optional(),
    editable_in_canon: z.boolean().optional(),
    ai_allowed: z.boolean().optional(),
    lockable: z.boolean().optional(),
  }).optional(),
  schema: z.object({
    variable_slots: z.array(z.string()).optional(),
    config: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

blockRoutes.put('/blocks/:id', validateBody(updateBlockSchema), async (req, res, next) => {
  try {
    const body = (req as any).validatedBody;
    const now = new Date().toISOString();

    // Fetch current to build before snapshot
    const { data: before, error: fetchErr } = await supabaseAdmin
      .from('doc_blocks')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fetchErr || !before) throw { status: 404, message: 'Block not found', code: 'NOT_FOUND' };

    // Merge permissions & schema with existing values (partial update)
    const mergedPermissions = body.permissions
      ? { ...before.permissions, ...body.permissions }
      : undefined;
    const mergedSchema = body.schema
      ? {
          variable_slots: body.schema.variable_slots ?? before.schema?.variable_slots ?? [],
          config: body.schema.config ?? before.schema?.config ?? {},
        }
      : undefined;

    const updatePayload: Record<string, any> = { updated_at: now };
    if (body.display_name !== undefined) updatePayload.display_name = body.display_name;
    if (body.family !== undefined) updatePayload.family = body.family;
    if (body.editor_mode !== undefined) updatePayload.editor_mode = body.editor_mode;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.default_content !== undefined) updatePayload.default_content = body.default_content;
    if (body.render_key !== undefined) updatePayload.render_key = body.render_key;
    if (mergedPermissions) updatePayload.permissions = mergedPermissions;
    if (mergedSchema) updatePayload.schema = mergedSchema;

    const { data: block, error } = await supabaseAdmin
      .from('doc_blocks')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_block.update',
      entityType: 'doc_blocks',
      entityId: req.params.id,
      before: { display_name: before.display_name, family: before.family },
      after: updatePayload,
      source: 'human',
    });

    res.json({ data: block });
  } catch (err) { next(err); }
});

// ─── DELETE /api/blocks/:id ───────────────────────────────
blockRoutes.delete('/blocks/:id', async (req, res, next) => {
  try {
    // Fetch before deleting for audit
    const { data: before } = await supabaseAdmin
      .from('doc_blocks')
      .select('block_key, display_name')
      .eq('id', req.params.id)
      .single();
    if (!before) throw { status: 404, message: 'Block not found', code: 'NOT_FOUND' };

    const { error } = await supabaseAdmin
      .from('doc_blocks')
      .delete()
      .eq('id', req.params.id);
    if (error) throw { status: 500, message: error.message };

    await writeAuditLog({
      actor: req.authUser,
      action: 'doc_block.delete',
      entityType: 'doc_blocks',
      entityId: req.params.id,
      before: { block_key: before.block_key, display_name: before.display_name },
      source: 'human',
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});
