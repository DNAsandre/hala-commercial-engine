/**
 * Escalation API routes.
 *
 * The live escalation source is commercial_escalations. The old
 * escalation_events/escalation_tasks tables are legacy and must not be
 * repopulated by API routes.
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const escalationRoutes = Router();
escalationRoutes.use(requireAuth);

const ACTIVE_STATUSES = ['open', 'monitoring', 'under_review'];

function normalizeStatusFilter(status?: string): string[] | null {
  if (!status) return null;
  if (status === 'acknowledged') return ['monitoring', 'under_review'];
  if (status === 'open') return ['open'];
  return [status];
}

escalationRoutes.get('/', async (req, res, next) => {
  try {
    let query = supabaseAdmin
      .from('commercial_escalations')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    const statuses = normalizeStatusFilter(req.query.status as string | undefined);
    if (statuses) query = query.in('status', statuses);

    const { data, error } = await query;
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0, source_table: 'commercial_escalations' });
  } catch (err) {
    next(err);
  }
});

escalationRoutes.get('/open-count', async (_req, res, next) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('commercial_escalations')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .in('status', ACTIVE_STATUSES);

    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ count: count || 0, source_table: 'commercial_escalations' });
  } catch (err) {
    next(err);
  }
});

const acknowledgeSchema = z.object({
  notes: z.string().optional(),
}).strict();

escalationRoutes.patch('/:id/acknowledge',
  validateBody(acknowledgeSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { data: before } = await supabaseAdmin
        .from('commercial_escalations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!before) {
        res.status(404).json({ error: 'Escalation not found', code: 'NOT_FOUND' });
        return;
      }

      const { data: after, error } = await supabaseAdmin
        .from('commercial_escalations')
        .update({ status: 'under_review', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'escalation.acknowledged',
        entityType: 'commercial_escalation',
        entityId: id,
        before,
        after,
        source: 'human',
      });

      res.json({ data: after, source_table: 'commercial_escalations' });
    } catch (err) {
      next(err);
    }
  }
);

const resolveSchema = z.object({
  resolution_notes: z.string().optional(),
}).strict();

escalationRoutes.patch('/:id/resolve',
  validateBody(resolveSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { data: before } = await supabaseAdmin
        .from('commercial_escalations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!before) {
        res.status(404).json({ error: 'Escalation not found', code: 'NOT_FOUND' });
        return;
      }

      const { data: after, error } = await supabaseAdmin
        .from('commercial_escalations')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'escalation.resolved',
        entityType: 'commercial_escalation',
        entityId: id,
        before,
        after,
        source: 'human',
      });

      res.json({ data: after, source_table: 'commercial_escalations' });
    } catch (err) {
      next(err);
    }
  }
);
