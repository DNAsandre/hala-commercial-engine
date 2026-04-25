/**
 * Customer API Routes — Sprint 2 update
 * 
 * GET  /api/customers       — list all (requires auth)
 * GET  /api/customers/:id   — get single (requires auth)
 * PATCH /api/customers/:id  — update (requires auth, audit with real identity)
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';
import { validateBody, rejectEmptyBody, stripDangerousFields } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const customerRoutes = Router();

// All customer routes require authentication
customerRoutes.use(requireAuth);

// ─── GET /api/customers ──────────────────────────────────
customerRoutes.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/customers/:id ──────────────────────────────
customerRoutes.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/customers/:id ────────────────────────────
const customerPatchSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  group: z.string().optional(),
  status: z.enum(['active', 'inactive', 'prospect', 'churned']).optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  industry: z.string().optional(),
  account_owner: z.string().optional(),
  service_type: z.string().optional(),
  grade: z.string().optional(),
  facility: z.string().optional(),
  contract_expiry: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  dso: z.number().nonnegative().optional(),
  payment_status: z.string().optional(),
}).strict();

customerRoutes.patch('/:id',
  rejectEmptyBody,
  validateBody(customerPatchSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const updates = stripDangerousFields((req as any).validatedBody);

      const { data: before } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (!before) {
        res.status(404).json({ error: 'Customer not found', code: 'NOT_FOUND' });
        return;
      }

      const { data: after, error } = await supabaseAdmin
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      // Audit with real identity
      await writeAuditLog({
        actor: req.authUser,
        action: 'customer.updated',
        entityType: 'customer',
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
