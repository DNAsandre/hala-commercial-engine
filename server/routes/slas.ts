/**
 * SLA + contract status API routes.
 *
 * Canonical SLA records now live in commercial_tickets with ticket_type = 'sla'.
 * Legacy slas table writes are disabled.
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { validateBody } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

const APPROVE_ROLES = ['admin', 'manager'];

export const slaRoutes = Router();
slaRoutes.use(requireAuth);

function legacySlaWriteDisabled(_req: any, res: any): void {
  res.status(409).json({
    error: 'Legacy slas table writes are disabled. Use unified commercial_tickets intake and SLA workspace routing.',
    code: 'LEGACY_SLA_WRITE_DISABLED',
  });
}

function slaStatusFromTicket(stage?: string | null): string {
  const normalized = (stage || '').toLowerCase();
  if (normalized.includes('active') || normalized.includes('approved') || normalized.includes('signed')) return 'approved';
  if (normalized.includes('review')) return 'under_review';
  if (normalized.includes('expired')) return 'superseded';
  return 'draft';
}

function commercialTicketToSla(row: any): any {
  const details = row.type_details && typeof row.type_details === 'object' ? row.type_details : {};
  return {
    id: row.id,
    workspace_id: row.legacy_workspace_id || details.linked_workspace_id || row.id,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    linked_proposal_id: details.parent_ticket_id || null,
    sla_number: null,
    version_number: Number(details.sla_version ?? 1),
    status: slaStatusFromTicket(row.internal_stage),
    title: row.ticket_title,
    service_scope: details.service_scope || null,
    kpi_rows: Array.isArray(details.kpi_rows) ? details.kpi_rows : [],
    measurement_methods: details.measurement_methods || null,
    penalty_terms: details.penalty_terms || null,
    exclusions: details.exclusions || null,
    customer_responsibilities: details.customer_responsibilities || null,
    operational_notes: details.operational_notes || row.notes || null,
    effective_date: details.effective_date || row.target_date || null,
    review_date: details.review_date || null,
    source_table: 'commercial_tickets',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

slaRoutes.get('/slas', async (_req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('commercial_tickets').select('*')
      .eq('ticket_type', 'sla')
      .eq('active', true)
      .neq('lineage_status', 'rejected')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: (rows || []).map(commercialTicketToSla), count: rows?.length || 0 });
  } catch (err) {
    next(err);
  }
});

slaRoutes.get('/workspaces/:workspaceId/slas', async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('commercial_tickets').select('*')
      .eq('ticket_type', 'sla')
      .eq('active', true)
      .neq('lineage_status', 'rejected')
      .order('updated_at', { ascending: false });
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

    const data = (rows || [])
      .map(commercialTicketToSla)
      .filter((s: any) => s.workspace_id === req.params.workspaceId || s.id === req.params.workspaceId);

    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

slaRoutes.get('/slas/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('commercial_tickets').select('*')
      .eq('id', req.params.id)
      .eq('ticket_type', 'sla')
      .eq('active', true)
      .neq('lineage_status', 'rejected')
      .maybeSingle();
    if (error || !data) {
      res.status(404).json({ error: 'SLA not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ data: commercialTicketToSla(data) });
  } catch (err) {
    next(err);
  }
});

slaRoutes.post('/workspaces/:workspaceId/slas', legacySlaWriteDisabled);
slaRoutes.patch('/slas/:id', legacySlaWriteDisabled);
slaRoutes.post('/slas/:id/submit', legacySlaWriteDisabled);
slaRoutes.post('/slas/:id/mark-operational-review', legacySlaWriteDisabled);
slaRoutes.post('/slas/:id/approve', legacySlaWriteDisabled);
slaRoutes.post('/slas/:id/reject', legacySlaWriteDisabled);
slaRoutes.post('/slas/:id/create-version', legacySlaWriteDisabled);

slaRoutes.get('/workspaces/:workspaceId/contract-status', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin
      .from('contract_status')
      .select('*')
      .eq('workspace_id', req.params.workspaceId)
      .single();
    res.json({ data: data || null });
  } catch (err) {
    next(err);
  }
});

const contractSchema = z.object({
  contract_status: z.string().optional(),
  contract_sent_at: z.string().optional(),
  contract_signed_at: z.string().optional(),
  contract_reference: z.string().optional(),
  notes: z.string().optional(),
}).strict();

slaRoutes.patch('/workspaces/:workspaceId/contract-status', requireRole(APPROVE_ROLES), validateBody(contractSchema), async (req, res, next) => {
  try {
    const wsId = req.params.workspaceId;
    const body = (req as any).validatedBody;
    body.updated_by = req.authUser?.userId;
    body.updated_at = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('contract_status')
      .select('*')
      .eq('workspace_id', wsId)
      .single();

    let after: any;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('contract_status')
        .update(body)
        .eq('workspace_id', wsId)
        .select()
        .single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      after = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('contract_status')
        .insert({ workspace_id: wsId, ...body })
        .select()
        .single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      after = data;
    }

    await writeAuditLog({
      actor: req.authUser,
      action: 'contract.status_updated',
      entityType: 'contract_status',
      entityId: wsId,
      before: existing,
      after,
      source: 'human',
    });
    res.json({ data: after });
  } catch (err) {
    next(err);
  }
});
