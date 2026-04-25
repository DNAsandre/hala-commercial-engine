/**
 * Escalation API Routes — Sprint 2 update
 * 
 * GET   /api/escalations              — list (requires auth)
 * GET   /api/escalations/open-count   — count (requires auth)
 * PATCH /api/escalations/:id/acknowledge — acknowledge (requires auth)
 * PATCH /api/escalations/:id/resolve     — resolve (requires auth)
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const escalationRoutes = Router();

// All escalation routes require authentication
escalationRoutes.use(requireAuth);

// ─── GET /api/escalations ────────────────────────────────
escalationRoutes.get('/', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('escalation_events')
      .select('*')
      .order('created_at', { ascending: false });

    const statusFilter = req.query.status as string | undefined;
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/escalations/open-count ─────────────────────
escalationRoutes.get('/open-count', async (_req, res, next) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('escalation_events')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'pending']);

    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ count: count || 0 });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/escalations/:id/acknowledge ──────────────
const acknowledgeSchema = z.object({
  notes: z.string().optional(),
}).strict();

escalationRoutes.patch('/:id/acknowledge',
  validateBody(acknowledgeSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;

      const { data: before } = await supabaseAdmin
        .from('escalation_events')
        .select('*')
        .eq('id', id)
        .single();

      if (!before) {
        res.status(404).json({ error: 'Escalation not found', code: 'NOT_FOUND' });
        return;
      }

      const updates: Record<string, any> = {
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: req.authUser?.name || 'Unknown',
      };
      if ((req as any).validatedBody?.notes) {
        updates.notes = (req as any).validatedBody.notes;
      }

      const { data: after, error } = await supabaseAdmin
        .from('escalation_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'escalation.acknowledged',
        entityType: 'escalation',
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

// ─── PATCH /api/escalations/:id/resolve ──────────────────
const resolveSchema = z.object({
  resolution_notes: z.string().optional(),
}).strict();

escalationRoutes.patch('/:id/resolve',
  validateBody(resolveSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;

      const { data: before } = await supabaseAdmin
        .from('escalation_events')
        .select('*')
        .eq('id', id)
        .single();

      if (!before) {
        res.status(404).json({ error: 'Escalation not found', code: 'NOT_FOUND' });
        return;
      }

      const updates: Record<string, any> = {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: req.authUser?.name || 'Unknown',
      };
      if ((req as any).validatedBody?.resolution_notes) {
        updates.resolution_notes = (req as any).validatedBody.resolution_notes;
      }

      const { data: after, error } = await supabaseAdmin
        .from('escalation_events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'escalation.resolved',
        entityType: 'escalation',
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
