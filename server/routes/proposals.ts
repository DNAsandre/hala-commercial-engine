/**
 * Proposal API Routes — Sprint 4
 * Proposals must link to a quote. No free-form proposals.
 * All routes require auth. All mutations audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireRole } from '../lib/auth.js';

const APPROVE_ROLES = ['admin', 'manager'];
const MUTATE_ROLES = ['admin', 'manager', 'sales'];
import { validateBody, rejectEmptyBody, stripDangerousFields } from '../lib/validate.js';
import { writeAuditLog } from '../lib/audit.js';

export const proposalRoutes = Router();
proposalRoutes.use(requireAuth);

function genProposalNumber(wsId: string, ver: number) {
  return `P-${wsId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()}-V${ver}`;
}

// ─── GET /api/workspaces/:workspaceId/proposals ──────────
proposalRoutes.get('/workspaces/:workspaceId/proposals', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('proposals').select('*')
      .eq('workspace_id', req.params.workspaceId)
      .order('version_number', { ascending: false });
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
    res.json({ data: data || [], count: data?.length || 0 });
  } catch (err) { next(err); }
});

// ─── GET /api/proposals/:id ──────────────────────────────
proposalRoutes.get('/proposals/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('proposals').select('*').eq('id', req.params.id).single();
    if (error || !data) { res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' }); return; }
    res.json({ data });
  } catch (err) { next(err); }
});

// ─── POST /api/workspaces/:workspaceId/proposals ─────────
const createSchema = z.object({
  linked_quote_id: z.string().min(1, 'Quote is required'),
  title: z.string().min(1).default(''),
  executive_summary: z.string().default(''),
  scope_description: z.string().default(''),
  service_summary: z.string().default(''),
  assumptions: z.string().default(''),
  exclusions: z.string().default(''),
  negotiation_notes: z.string().default(''),
  client_request_summary: z.string().default(''),
  customer_id: z.string().optional(),
});

proposalRoutes.post('/workspaces/:workspaceId/proposals',
  validateBody(createSchema),
  async (req, res, next) => {
    try {
      const wsId = req.params.workspaceId;
      const body = (req as any).validatedBody;

      // Fetch linked quote — mandatory + must belong to same workspace
      const { data: quote } = await supabaseAdmin
        .from('quotes').select('*').eq('id', body.linked_quote_id).eq('workspace_id', wsId).single();
      if (!quote) {
        res.status(400).json({ error: 'Linked quote not found in this workspace', code: 'QUOTE_NOT_FOUND' });
        return;
      }

      // Build pricing snapshot from quote (read-only copy)
      const pricingSnapshot = {
        quote_id: quote.id,
        quote_number: quote.quote_number,
        quote_version: quote.version_number || quote.version,
        quote_status: quote.status,
        storage_rate: quote.storage_rate,
        inbound_rate: quote.inbound_rate,
        outbound_rate: quote.outbound_rate,
        pallet_volume: quote.pallet_volume,
        monthly_revenue: quote.monthly_revenue,
        annual_revenue: quote.annual_revenue,
        estimated_cost: quote.estimated_cost || quote.total_cost,
        gp_amount: quote.gp_amount,
        gp_percent: quote.gp_percent,
        currency: quote.currency,
        service_type: quote.service_type,
      };

      // SLA disclaimer — check both new slas table and legacy doc_instances
      const { count: slaCount } = await supabaseAdmin
        .from('slas').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId);
      const { count: legacySlaCount } = await supabaseAdmin
        .from('doc_instances').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('doc_type', 'sla');
      const hasSla = (slaCount || 0) > 0 || (legacySlaCount || 0) > 0;
      const disclaimer = !hasSla
        ? 'Service levels are indicative and subject to final SLA agreement.'
        : '';

      // Next version
      const { data: existing } = await supabaseAdmin
        .from('proposals').select('version_number')
        .eq('workspace_id', wsId)
        .order('version_number', { ascending: false }).limit(1);
      const nextVer = (existing?.[0]?.version_number || 0) + 1;

      const row = {
        workspace_id: wsId,
        customer_id: body.customer_id || quote.customer_id || null,
        proposal_number: genProposalNumber(wsId, nextVer),
        version: nextVer,
        version_number: nextVer,
        status: 'draft',
        state: 'draft',
        linked_quote_id: quote.id,
        linked_quote_version: quote.version_number || quote.version,
        title: body.title || `Proposal for ${quote.service_type} services`,
        executive_summary: body.executive_summary,
        scope_description: body.scope_description,
        service_summary: body.service_summary,
        pricing_snapshot: pricingSnapshot,
        assumptions: body.assumptions || quote.assumptions || '',
        exclusions: body.exclusions || quote.exclusions || '',
        indicative_sla_disclaimer: disclaimer,
        negotiation_notes: body.negotiation_notes,
        client_request_summary: body.client_request_summary,
        created_by: req.authUser?.userId || 'unknown',
        updated_by: req.authUser?.userId || 'unknown',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('proposals').insert(row).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

      await writeAuditLog({
        actor: req.authUser, action: 'proposal.created',
        entityType: 'proposal', entityId: data.id, after: data, source: 'human',
      });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  }
);

// ─── PATCH /api/proposals/:id ────────────────────────────
const updateSchema = z.object({
  title: z.string().optional(),
  executive_summary: z.string().optional(),
  scope_description: z.string().optional(),
  service_summary: z.string().optional(),
  assumptions: z.string().optional(),
  exclusions: z.string().optional(),
  negotiation_notes: z.string().optional(),
  client_request_summary: z.string().optional(),
}).strict();

proposalRoutes.patch('/proposals/:id',
  rejectEmptyBody, validateBody(updateSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const updates = stripDangerousFields((req as any).validatedBody);
      const { data: before } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single();
      if (!before) { res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' }); return; }
      if (before.status !== 'draft') {
        res.status(400).json({ error: 'Only draft proposals can be edited. Create a new version.', code: 'NOT_DRAFT' });
        return;
      }
      updates.updated_by = req.authUser?.userId;
      updates.updated_at = new Date().toISOString();
      const { data: after, error } = await supabaseAdmin.from('proposals').update(updates).eq('id', id).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      await writeAuditLog({ actor: req.authUser, action: 'proposal.updated', entityType: 'proposal', entityId: id, before, after, source: 'human' });
      res.json({ data: after });
    } catch (err) { next(err); }
  }
);

// ─── Status transitions (no gates) ──────────────────────
function statusRoute(action: string, fromStatuses: string[], toStatus: string, requireReason = false) {
  const schema = requireReason
    ? z.object({ reason: z.string().min(1, 'Reason required') }).strict()
    : z.object({}).strict().optional();

  return async (req: any, res: any, next: any) => {
    try {
      const id = req.params.id;
      if (requireReason) {
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success) { res.status(400).json({ error: 'Reason required', code: 'VALIDATION' }); return; }
      }
      const { data: before } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single();
      if (!before) { res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' }); return; }
      if (!fromStatuses.includes(before.status)) {
        res.status(400).json({ error: `Cannot ${action} from status '${before.status}'`, code: 'INVALID_STATUS' }); return;
      }
      const upd: any = { status: toStatus, state: toStatus, updated_by: req.authUser?.userId, updated_at: new Date().toISOString() };
      if (requireReason && req.body?.reason) upd.change_reason = req.body.reason;
      const { data: after, error } = await supabaseAdmin.from('proposals').update(upd).eq('id', id).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      await writeAuditLog({ actor: req.authUser, action: `proposal.${action}`, entityType: 'proposal', entityId: id, before, after, source: 'human' });
      res.json({ data: after });
    } catch (err) { next(err); }
  };
}

proposalRoutes.post('/proposals/:id/submit-review', statusRoute('submitted_review', ['draft'], 'ready_for_review'));
proposalRoutes.post('/proposals/:id/mark-ready-crm', requireRole(APPROVE_ROLES), statusRoute('marked_ready_crm', ['ready_for_review'], 'ready_for_crm'));
proposalRoutes.post('/proposals/:id/mark-sent', requireRole(APPROVE_ROLES), statusRoute('marked_sent', ['ready_for_crm'], 'sent'));
proposalRoutes.post('/proposals/:id/mark-negotiation', statusRoute('marked_negotiation', ['sent'], 'negotiation_active'));
proposalRoutes.post('/proposals/:id/approve', requireRole(APPROVE_ROLES), statusRoute('approved', ['sent', 'negotiation_active', 'ready_for_review'], 'approved'));
proposalRoutes.post('/proposals/:id/reject', requireRole(APPROVE_ROLES), statusRoute('rejected', ['sent', 'negotiation_active', 'ready_for_review', 'ready_for_crm'], 'rejected', true));

// ─── POST /api/proposals/:id/create-version ──────────────
const versionSchema = z.object({ change_reason: z.string().min(1) }).strict();

proposalRoutes.post('/proposals/:id/create-version',
  validateBody(versionSchema),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { change_reason } = (req as any).validatedBody;
      const { data: orig } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single();
      if (!orig) { res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' }); return; }
      if (orig.status === 'draft') { res.status(400).json({ error: 'Draft proposals cannot be versioned. Edit the draft directly.', code: 'DRAFT_VERSION_BLOCKED' }); return; }

      await supabaseAdmin.from('proposals').update({ status: 'superseded', state: 'superseded', updated_at: new Date().toISOString() }).eq('id', id);

      const { data: allV } = await supabaseAdmin.from('proposals').select('version_number')
        .eq('workspace_id', orig.workspace_id).order('version_number', { ascending: false }).limit(1);
      const nextVer = (allV?.[0]?.version_number || 0) + 1;

      const row = {
        workspace_id: orig.workspace_id, customer_id: orig.customer_id,
        proposal_number: genProposalNumber(orig.workspace_id, nextVer),
        version: nextVer, version_number: nextVer,
        status: 'draft', state: 'draft',
        linked_quote_id: orig.linked_quote_id, linked_quote_version: orig.linked_quote_version,
        title: orig.title, executive_summary: orig.executive_summary,
        scope_description: orig.scope_description, service_summary: orig.service_summary,
        pricing_snapshot: orig.pricing_snapshot,
        assumptions: orig.assumptions, exclusions: orig.exclusions,
        indicative_sla_disclaimer: orig.indicative_sla_disclaimer,
        negotiation_notes: orig.negotiation_notes, client_request_summary: orig.client_request_summary,
        change_reason, supersedes_proposal_id: id,
        created_by: req.authUser?.userId, updated_by: req.authUser?.userId,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };

      const { data: newP, error } = await supabaseAdmin.from('proposals').insert(row).select().single();
      if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };
      await writeAuditLog({ actor: req.authUser, action: 'proposal.version_created', entityType: 'proposal', entityId: newP.id, before: orig, after: newP, source: 'human' });
      res.status(201).json({ data: newP });
    } catch (err) { next(err); }
  }
);
