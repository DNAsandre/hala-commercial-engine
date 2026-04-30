/**
 * SLA + Contract Status API Routes — Sprint 5
 * SLA must link to proposal (which links to quote). No free-form SLAs.
 * Contract status is informational tracking only.
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../lib/auth.js';

const APPROVE_ROLES = ['admin', 'manager'];
const MUTATE_ROLES = ['admin', 'manager', 'sales'];
import { validateBody, rejectEmptyBody, stripDangerousFields } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const slaRoutes = Router();
slaRoutes.use(requireAuth);

function genSlaNumber(wsId: string, ver: number) {
  return `SLA-${wsId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}-V${ver}`;
}

// ─── GET /api/slas (all SLAs across workspaces) ───────────
slaRoutes.get('/slas', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('slas').select('*')
      .order('updated_at', { ascending: false }).limit(200);
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) { next(err); }
});

// ─── GET /api/workspaces/:workspaceId/slas ────────────────
slaRoutes.get('/workspaces/:workspaceId/slas', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('slas').select('*')
      .eq('workspace_id', req.params.workspaceId).order('version_number', { ascending: false });
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) { next(err); }
});

// ─── GET /api/slas/:id ────────────────────────────────────
slaRoutes.get('/slas/:id', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('slas').select('*').eq('id', req.params.id).single();
    if (!data) { res.status(404).json({ error: 'SLA not found', code: 'NOT_FOUND' }); return; }
    res.json({ data });
  } catch (err) { next(err); }
});

// ─── POST /api/workspaces/:workspaceId/slas ───────────────
const createSchema = z.object({
  linked_proposal_id: z.string().min(1, 'Proposal is required'),
  title: z.string().default(''),
  service_scope: z.string().default(''),
  kpi_rows: z.array(z.object({
    name: z.string(), target: z.string(), method: z.string().default(''),
    frequency: z.string().default(''), owner: z.string().default(''),
    penalty_applies: z.boolean().default(false),
  })).default([]),
  measurement_methods: z.string().default(''),
  penalty_terms: z.string().default(''),
  exclusions: z.string().default(''),
  customer_responsibilities: z.string().default(''),
  operational_notes: z.string().default(''),
  effective_date: z.string().optional(),
  review_date: z.string().optional(),
  customer_id: z.string().optional(),
});

slaRoutes.post('/workspaces/:workspaceId/slas',
  validateBody(createSchema),
  async (req, res, next) => {
    try {
      const wsId = req.params.workspaceId;
      const body = (req as any).validatedBody;

      // Fetch linked proposal — must belong to same workspace
      const { data: proposal } = await supabaseAdmin.from('proposals').select('*').eq('id', body.linked_proposal_id).eq('workspace_id', wsId).single();
      if (!proposal) { res.status(400).json({ error: 'Linked proposal not found in this workspace', code: 'PROPOSAL_NOT_FOUND' }); return; }

      // Next version
      const { data: existing } = await supabaseAdmin.from('slas').select('version_number')
        .eq('workspace_id', wsId).order('version_number', { ascending: false }).limit(1);
      const nextVer = (existing?.[0]?.version_number || 0) + 1;

      const row = {
        workspace_id: wsId,
        customer_id: body.customer_id || proposal.customer_id,
        linked_quote_id: proposal.linked_quote_id,
        linked_quote_version: proposal.linked_quote_version,
        linked_proposal_id: proposal.id,
        linked_proposal_version: proposal.version_number || proposal.version,
        sla_number: genSlaNumber(wsId, nextVer),
        version_number: nextVer,
        status: 'draft',
        title: body.title || `SLA — ${proposal.title || 'Services'}`,
        service_scope: body.service_scope,
        kpi_rows: body.kpi_rows,
        measurement_methods: body.measurement_methods,
        penalty_terms: body.penalty_terms,
        exclusions: body.exclusions || proposal.exclusions || '',
        customer_responsibilities: body.customer_responsibilities,
        operational_notes: body.operational_notes,
        effective_date: body.effective_date || null,
        review_date: body.review_date || null,
        created_by: req.authUser?.userId,
        updated_by: req.authUser?.userId,
      };

      const { data, error } = await supabaseAdmin.from('slas').insert(row).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      await writeAuditLog({ actor: req.authUser, action: 'sla.created', entityType: 'sla', entityId: data.id, after: data, source: 'human' });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/slas/:id ──────────────────────────────────
const updateSchema = z.object({
  title: z.string().optional(),
  service_scope: z.string().optional(),
  kpi_rows: z.array(z.object({
    name: z.string(), target: z.string(), method: z.string().default(''),
    frequency: z.string().default(''), owner: z.string().default(''),
    penalty_applies: z.boolean().default(false),
  })).optional(),
  measurement_methods: z.string().optional(),
  penalty_terms: z.string().optional(),
  exclusions: z.string().optional(),
  customer_responsibilities: z.string().optional(),
  operational_notes: z.string().optional(),
  effective_date: z.string().optional(),
  review_date: z.string().optional(),
}).strict();

slaRoutes.patch('/slas/:id', rejectEmptyBody, validateBody(updateSchema), async (req, res, next) => {
  try {
    const id = req.params.id;
    const updates = stripDangerousFields((req as any).validatedBody);
    const { data: before } = await supabaseAdmin.from('slas').select('*').eq('id', id).single();
    if (!before) { res.status(404).json({ error: 'SLA not found', code: 'NOT_FOUND' }); return; }
    if (before.status !== 'draft') { res.status(400).json({ error: 'Only draft SLAs can be edited. Create a new version.', code: 'NOT_DRAFT' }); return; }
    updates.updated_by = req.authUser?.userId;
    updates.updated_at = new Date().toISOString();
    const { data: after, error } = await supabaseAdmin.from('slas').update(updates).eq('id', id).select().single();
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    await writeAuditLog({ actor: req.authUser, action: 'sla.updated', entityType: 'sla', entityId: id, before, after, source: 'human' });
    res.json({ data: after });
  } catch (err) { next(err); }
});

// ─── Status transitions ──────────────────────────────────
function slaStatus(action: string, from: string[], to: string, needReason = false) {
  return async (req: any, res: any, next: any) => {
    try {
      const id = req.params.id;
      if (needReason && (!req.body?.reason || !req.body.reason.trim())) { res.status(400).json({ error: 'Reason required', code: 'VALIDATION' }); return; }
      const { data: before } = await supabaseAdmin.from('slas').select('*').eq('id', id).single();
      if (!before) { res.status(404).json({ error: 'SLA not found', code: 'NOT_FOUND' }); return; }
      if (!from.includes(before.status)) { res.status(400).json({ error: `Cannot ${action} from '${before.status}'`, code: 'INVALID_STATUS' }); return; }
      const upd: any = { status: to, updated_by: req.authUser?.userId, updated_at: new Date().toISOString() };
      if (needReason) upd.change_reason = req.body.reason;
      const { data: after, error } = await supabaseAdmin.from('slas').update(upd).eq('id', id).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      await writeAuditLog({ actor: req.authUser, action: `sla.${action}`, entityType: 'sla', entityId: id, before, after, source: 'human' });
      res.json({ data: after });
    } catch (err) { next(err); }
  };
}

slaRoutes.post('/slas/:id/submit', slaStatus('submitted', ['draft'], 'submitted'));
slaRoutes.post('/slas/:id/mark-operational-review', requireRole(APPROVE_ROLES), slaStatus('operational_review', ['draft', 'submitted'], 'operational_review'));
slaRoutes.post('/slas/:id/approve', requireRole(APPROVE_ROLES), slaStatus('approved', ['submitted', 'operational_review'], 'approved'));
slaRoutes.post('/slas/:id/reject', requireRole(APPROVE_ROLES), slaStatus('rejected', ['submitted', 'operational_review'], 'rejected', true));

// ─── POST /api/slas/:id/create-version ────────────────────
slaRoutes.post('/slas/:id/create-version', validateBody(z.object({ change_reason: z.string().min(1) }).strict()), async (req, res, next) => {
  try {
    const id = req.params.id;
    const { change_reason } = (req as any).validatedBody;
    const { data: orig } = await supabaseAdmin.from('slas').select('*').eq('id', id).single();
    if (!orig) { res.status(404).json({ error: 'SLA not found', code: 'NOT_FOUND' }); return; }
    await supabaseAdmin.from('slas').update({ status: 'superseded', updated_at: new Date().toISOString() }).eq('id', id);
    const { data: allV } = await supabaseAdmin.from('slas').select('version_number').eq('workspace_id', orig.workspace_id).order('version_number', { ascending: false }).limit(1);
    const nextVer = (allV?.[0]?.version_number || 0) + 1;
    const row = {
      workspace_id: orig.workspace_id, customer_id: orig.customer_id,
      linked_quote_id: orig.linked_quote_id, linked_quote_version: orig.linked_quote_version,
      linked_proposal_id: orig.linked_proposal_id, linked_proposal_version: orig.linked_proposal_version,
      sla_number: genSlaNumber(orig.workspace_id, nextVer), version_number: nextVer,
      status: 'draft', title: orig.title, service_scope: orig.service_scope,
      kpi_rows: orig.kpi_rows, measurement_methods: orig.measurement_methods,
      penalty_terms: orig.penalty_terms, exclusions: orig.exclusions,
      customer_responsibilities: orig.customer_responsibilities, operational_notes: orig.operational_notes,
      effective_date: orig.effective_date, review_date: orig.review_date,
      supersedes_sla_id: id, change_reason,
      created_by: req.authUser?.userId, updated_by: req.authUser?.userId,
    };
    const { data: newSla, error } = await supabaseAdmin.from('slas').insert(row).select().single();
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    await writeAuditLog({ actor: req.authUser, action: 'sla.version_created', entityType: 'sla', entityId: newSla.id, before: orig, after: newSla, source: 'human' });
    res.status(201).json({ data: newSla });
  } catch (err) { next(err); }
});

// ─── Contract Status ──────────────────────────────────────
slaRoutes.get('/workspaces/:workspaceId/contract-status', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('contract_status').select('*').eq('workspace_id', req.params.workspaceId).single();
    res.json({ data: data || { workspace_id: req.params.workspaceId, contract_status: 'not_ready', notes: '' } });
  } catch (err) { next(err); }
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

    const { data: existing } = await supabaseAdmin.from('contract_status').select('*').eq('workspace_id', wsId).single();
    let after: any;
    if (existing) {
      const { data, error } = await supabaseAdmin.from('contract_status').update(body).eq('workspace_id', wsId).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      after = data;
    } else {
      const { data, error } = await supabaseAdmin.from('contract_status').insert({ workspace_id: wsId, ...body }).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      after = data;
    }
    await writeAuditLog({ actor: req.authUser, action: 'contract.status_updated', entityType: 'contract_status', entityId: wsId, before: existing, after, source: 'human' });
    res.json({ data: after });
  } catch (err) { next(err); }
});
