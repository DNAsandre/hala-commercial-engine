/**
 * Workspace API Routes — Sprint 2 update
 * 
 * GET  /api/workspaces       — list (requires auth, optional filters)
 * GET  /api/workspaces/:id   — get single (requires auth)
 * PATCH /api/workspaces/:id  — update (requires auth, audit with real identity)
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody, rejectEmptyBody, stripDangerousFields } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const workspaceRoutes = Router();

// All workspace routes require authentication
workspaceRoutes.use(requireAuth);

// ─── GET /api/workspaces ─────────────────────────────────
workspaceRoutes.get('/', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    const typeFilter = req.query.type as string | undefined;
    if (typeFilter && ['commercial', 'tender', 'renewal'].includes(typeFilter)) {
      query = query.eq('type', typeFilter);
    }

    const stageFilter = req.query.stage as string | undefined;
    if (stageFilter) {
      query = query.eq('stage', stageFilter);
    }

    const { data, error } = await query;
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/workspaces/:id ─────────────────────────────
workspaceRoutes.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/workspaces/:id ───────────────────────────
const workspacePatchSchema = z.object({
  title: z.string().min(1).optional(),
  stage: z.string().optional(),
  type: z.enum(['commercial', 'tender', 'renewal']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.string().optional(),
  assigned_to: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
}).strict();

workspaceRoutes.patch('/:id',
  rejectEmptyBody,
  validateBody(workspacePatchSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const updates = stripDangerousFields((req as any).validatedBody);

      const { data: before } = await supabaseAdmin
        .from('workspaces')
        .select('*')
        .eq('id', id)
        .single();

      if (!before) {
        res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
        return;
      }

      const { data: after, error } = await supabaseAdmin
        .from('workspaces')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'workspace.updated',
        entityType: 'workspace',
        entityId: id,
        before,
        after,
        source: 'human',
      });

      res.json({ data: after });
    } catch (err) {
      next(err);
    }
  }
);
