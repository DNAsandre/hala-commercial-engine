/**
 * Quote API Routes — Sprint 3
 *
 * All routes require authentication.
 * No approval gates enforced — status movement is human-controlled.
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../lib/auth.js';

const APPROVE_ROLES = ['admin', 'manager'];
const MUTATE_ROLES = ['admin', 'manager', 'sales'];
import { validateBody, rejectEmptyBody, stripDangerousFields } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const quoteRoutes = Router();
quoteRoutes.use(requireAuth);

// ─── Helpers ─────────────────────────────────────────────

function generateQuoteNumber(workspaceId: string, version: number): string {
  const prefix = workspaceId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  return `Q-${prefix}-V${version}`;
}

function calculateValidUntil(validityDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + validityDays);
  return d.toISOString().split('T')[0];
}

/**
 * Server-side GP recalculation — single source of commercial truth.
 * Recalculates annual_revenue, gp_amount, and gp_percent from raw inputs.
 * Never trusts client-submitted GP values.
 */
function recalculateFinancials(data: Record<string, any>): void {
  // Annual = monthly × 12
  if (data.monthly_revenue !== undefined) {
    data.annual_revenue = data.monthly_revenue * 12;
  }
  // GP amount = annual revenue − cost
  const revenue = data.annual_revenue ?? 0;
  const cost = data.estimated_cost ?? data.total_cost ?? 0;
  data.gp_amount = revenue - cost;
  // GP % = (GP / revenue) * 100 — safe division
  data.gp_percent = revenue > 0 ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : 0;
}

// ─── GET /api/workspaces/:workspaceId/quotes ─────────────
quoteRoutes.get('/workspaces/:workspaceId/quotes', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('workspace_id', req.params.workspaceId)
      .order('version_number', { ascending: false });

    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/quotes/:id ─────────────────────────────────
quoteRoutes.get('/quotes/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/workspaces/:workspaceId/quotes ────────────
const createQuoteSchema = z.object({
  service_type: z.string().default('warehousing'),
  currency: z.string().default('SAR'),
  storage_rate: z.number().nonnegative().default(0),
  inbound_rate: z.number().nonnegative().default(0),
  outbound_rate: z.number().nonnegative().default(0),
  pallet_volume: z.number().nonnegative().default(0),
  monthly_volume: z.number().nonnegative().default(0),
  volume_unit: z.string().default('pallets'),
  monthly_revenue: z.number().nonnegative().default(0),
  annual_revenue: z.number().nonnegative().default(0),
  estimated_cost: z.number().nonnegative().default(0),
  gp_amount: z.number().default(0),
  gp_percent: z.number().default(0),
  validity_days: z.number().int().positive().default(30),
  assumptions: z.string().default(''),
  exclusions: z.string().default(''),
  notes: z.string().default(''),
  discount_percent: z.number().min(0).max(100).default(0),
  customer_id: z.string().optional(),
});

quoteRoutes.post('/workspaces/:workspaceId/quotes',
  validateBody(createQuoteSchema),
  async (req, res, next) => {
    try {
      const workspaceId = req.params.workspaceId;
      const body = (req as any).validatedBody;

      // Get next version number
      const { data: existing } = await supabaseAdmin
        .from('quotes')
        .select('version_number')
        .eq('workspace_id', workspaceId)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (existing && existing[0]?.version_number || 0) + 1;
      const quoteNumber = generateQuoteNumber(workspaceId, nextVersion);

      const row = {
        workspace_id: workspaceId,
        customer_id: body.customer_id || null,
        quote_number: quoteNumber,
        version: nextVersion,
        version_number: nextVersion,
        status: 'draft',
        state: 'draft',
        service_type: body.service_type,
        currency: body.currency,
        storage_rate: body.storage_rate,
        inbound_rate: body.inbound_rate,
        outbound_rate: body.outbound_rate,
        pallet_volume: body.pallet_volume,
        monthly_volume: body.monthly_volume,
        volume_unit: body.volume_unit,
        monthly_revenue: body.monthly_revenue,
        annual_revenue: body.monthly_revenue * 12,
        estimated_cost: body.estimated_cost,
        total_cost: body.estimated_cost,
        gp_amount: 0,
        gp_percent: 0,
        validity_days: body.validity_days,
        valid_until: calculateValidUntil(body.validity_days),
        assumptions: body.assumptions,
        exclusions: body.exclusions,
        notes: body.notes,
        discount_percent: body.discount_percent,
        created_by: req.authUser?.userId || 'unknown',
        updated_by: req.authUser?.userId || 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Server-side GP recalculation — never trust client GP
      recalculateFinancials(row);

      const { data, error } = await supabaseAdmin
        .from('quotes')
        .insert(row)
        .select()
        .single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'quote.created',
        entityType: 'quote',
        entityId: data.id,
        after: data,
        source: 'human',
      });

      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/quotes/:id ───────────────────────────────
const updateQuoteSchema = z.object({
  service_type: z.string().optional(),
  storage_rate: z.number().nonnegative().optional(),
  inbound_rate: z.number().nonnegative().optional(),
  outbound_rate: z.number().nonnegative().optional(),
  pallet_volume: z.number().nonnegative().optional(),
  monthly_volume: z.number().nonnegative().optional(),
  volume_unit: z.string().optional(),
  monthly_revenue: z.number().nonnegative().optional(),
  annual_revenue: z.number().nonnegative().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  gp_amount: z.number().optional(),
  gp_percent: z.number().optional(),
  validity_days: z.number().int().positive().optional(),
  assumptions: z.string().optional(),
  exclusions: z.string().optional(),
  notes: z.string().optional(),
  discount_percent: z.number().min(0).max(100).optional(),
}).strict();

quoteRoutes.patch('/quotes/:id',
  rejectEmptyBody,
  validateBody(updateQuoteSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const updates = stripDangerousFields((req as any).validatedBody);

      const { data: before } = await supabaseAdmin
        .from('quotes').select('*').eq('id', id).single();

      if (!before) {
        res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' });
        return;
      }

      // Only allow editing draft quotes directly
      if (before.status !== 'draft') {
        res.status(400).json({
          error: 'Only draft quotes can be edited directly. Create a new version instead.',
          code: 'QUOTE_NOT_DRAFT',
        });
        return;
      }

      // Sync total_cost with estimated_cost
      if (updates.estimated_cost !== undefined) {
        updates.total_cost = updates.estimated_cost;
      }
      updates.updated_by = req.authUser?.userId || 'unknown';
      updates.updated_at = new Date().toISOString();
      if (updates.validity_days) {
        updates.valid_until = calculateValidUntil(updates.validity_days);
      }

      // Server-side GP recalculation on partial updates
      // Merge updates with existing record to get correct revenue/cost for GP calc
      const merged = { ...before, ...updates };
      recalculateFinancials(merged);
      updates.annual_revenue = merged.annual_revenue;
      updates.gp_amount = merged.gp_amount;
      updates.gp_percent = merged.gp_percent;

      const { data: after, error } = await supabaseAdmin
        .from('quotes').update(updates).eq('id', id).select().single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'quote.updated',
        entityType: 'quote',
        entityId: id,
        before, after,
        source: 'human',
      });

      res.json({ data: after });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/quotes/:id/submit ─────────────────────────
quoteRoutes.post('/quotes/:id/submit', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { data: quote } = await supabaseAdmin
      .from('quotes').select('*').eq('id', id).single();

    if (!quote) { res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' }); return; }
    if (quote.status !== 'draft') {
      res.status(400).json({ error: 'Only draft quotes can be submitted', code: 'INVALID_STATUS' });
      return;
    }

    const { data: after, error } = await supabaseAdmin
      .from('quotes')
      .update({ status: 'submitted', state: 'submitted', updated_by: req.authUser?.userId, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();

    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

    await writeAuditLog({
      actor: req.authUser,
      action: 'quote.submitted',
      entityType: 'quote',
      entityId: id,
      before: quote, after,
      source: 'human',
    });

    res.json({ data: after });
  } catch (err) { next(err); }
});

// ─── POST /api/quotes/:id/approve ────────────────────────
quoteRoutes.post('/quotes/:id/approve', requireRole(APPROVE_ROLES), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { data: quote } = await supabaseAdmin
      .from('quotes').select('*').eq('id', id).single();

    if (!quote) { res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' }); return; }
    if (quote.status !== 'submitted') {
      res.status(400).json({ error: 'Only submitted quotes can be approved', code: 'INVALID_STATUS' });
      return;
    }

    const { data: after, error } = await supabaseAdmin
      .from('quotes')
      .update({ status: 'approved', state: 'approved', updated_by: req.authUser?.userId, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();

    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

    await writeAuditLog({
      actor: req.authUser,
      action: 'quote.approved',
      entityType: 'quote',
      entityId: id,
      before: quote, after,
      source: 'human',
    });

    res.json({ data: after });
  } catch (err) { next(err); }
});

// ─── POST /api/quotes/:id/reject ─────────────────────────
const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
}).strict();

quoteRoutes.post('/quotes/:id/reject',
  requireRole(APPROVE_ROLES), validateBody(rejectSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { reason } = (req as any).validatedBody;

      const { data: quote } = await supabaseAdmin
        .from('quotes').select('*').eq('id', id).single();

      if (!quote) { res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' }); return; }
      if (quote.status !== 'submitted') {
        res.status(400).json({ error: 'Only submitted quotes can be rejected', code: 'INVALID_STATUS' });
        return;
      }

      const { data: after, error } = await supabaseAdmin
        .from('quotes')
        .update({
          status: 'rejected', state: 'rejected',
          change_reason: reason,
          updated_by: req.authUser?.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id).select().single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'quote.rejected',
        entityType: 'quote',
        entityId: id,
        before: quote, after,
        source: 'human',
      });

      res.json({ data: after });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/quotes/:id/create-version ─────────────────
const versionSchema = z.object({
  change_reason: z.string().min(1, 'Change reason is required'),
}).strict();

quoteRoutes.post('/quotes/:id/create-version',
  requireRole(MUTATE_ROLES), validateBody(versionSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { change_reason } = (req as any).validatedBody;

      const { data: original } = await supabaseAdmin
        .from('quotes').select('*').eq('id', id).single();

      if (!original) { res.status(404).json({ error: 'Quote not found', code: 'NOT_FOUND' }); return; }

      // Mark original as superseded
      await supabaseAdmin
        .from('quotes')
        .update({ status: 'superseded', state: 'superseded', updated_at: new Date().toISOString() })
        .eq('id', id);

      // Get next version number for this workspace
      const { data: allVersions } = await supabaseAdmin
        .from('quotes')
        .select('version_number')
        .eq('workspace_id', original.workspace_id)
        .order('version_number', { ascending: false })
        .limit(1);

      const nextVersion = (allVersions && allVersions[0]?.version_number || 0) + 1;

      // Create new version copying pricing data
      const newRow = {
        workspace_id: original.workspace_id,
        customer_id: original.customer_id,
        quote_number: generateQuoteNumber(original.workspace_id, nextVersion),
        version: nextVersion,
        version_number: nextVersion,
        status: 'draft',
        state: 'draft',
        service_type: original.service_type,
        currency: original.currency,
        storage_rate: original.storage_rate,
        inbound_rate: original.inbound_rate,
        outbound_rate: original.outbound_rate,
        pallet_volume: original.pallet_volume,
        monthly_volume: original.monthly_volume,
        volume_unit: original.volume_unit,
        monthly_revenue: original.monthly_revenue,
        annual_revenue: original.annual_revenue,
        estimated_cost: original.estimated_cost,
        total_cost: original.total_cost,
        gp_amount: original.gp_amount,
        gp_percent: original.gp_percent,
        validity_days: original.validity_days,
        valid_until: calculateValidUntil(original.validity_days || 30),
        assumptions: original.assumptions,
        exclusions: original.exclusions,
        notes: original.notes,
        discount_percent: original.discount_percent,
        supersedes_quote_id: id,
        change_reason,
        created_by: req.authUser?.userId || 'unknown',
        updated_by: req.authUser?.userId || 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newQuote, error } = await supabaseAdmin
        .from('quotes').insert(newRow).select().single();

      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser,
        action: 'quote.version_created',
        entityType: 'quote',
        entityId: newQuote.id,
        before: original,
        after: newQuote,
        source: 'human',
      });

      res.status(201).json({ data: newQuote });
    } catch (err) { next(err); }
  }
);
