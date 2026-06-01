/**
 * Proposal API routes.
 *
 * Canonical proposal records now live in commercial_tickets with
 * ticket_type = 'proposal'. Legacy proposal table writes are disabled.
 */
import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../lib/auth.js';

export const proposalRoutes = Router();
proposalRoutes.use(requireAuth);

function legacyProposalWriteDisabled(_req: any, res: any): void {
  res.status(409).json({
    error: 'Legacy proposals table writes are disabled. Use unified commercial_tickets intake and proposal workspace routing.',
    code: 'LEGACY_PROPOSAL_WRITE_DISABLED',
  });
}

function proposalStatusFromTicket(stage?: string | null): string {
  const normalized = (stage || '').toLowerCase();
  if (normalized.includes('sent')) return 'sent';
  if (normalized.includes('negotiation')) return 'negotiation_active';
  if (normalized.includes('approval') || normalized.includes('signed')) return 'approved';
  if (normalized.includes('draft')) return 'draft';
  return 'ready_for_crm';
}

function commercialTicketToProposal(row: any): any {
  const details = row.type_details && typeof row.type_details === 'object' ? row.type_details : {};
  const version = Number(details.proposal_version ?? 1);
  const status = proposalStatusFromTicket(row.internal_stage);

  return {
    id: row.id,
    workspace_id: row.legacy_workspace_id || details.linked_workspace_id || row.id,
    customer_id: row.customer_id,
    proposal_number: null,
    version,
    version_number: version,
    status,
    state: status,
    title: row.ticket_title,
    pricing_snapshot: details.pricing_snapshot || {
      currency: 'SAR',
      annual_revenue: row.estimated_value,
      gp_percent: row.target_gp_percent,
    },
    executive_summary: details.executive_summary || null,
    scope_description: details.scope_description || null,
    service_summary: details.service_summary || null,
    assumptions: details.assumptions || null,
    exclusions: details.exclusions || null,
    negotiation_notes: details.negotiation_notes || row.notes || null,
    client_request_summary: details.client_request_summary || null,
    source_table: 'commercial_tickets',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

proposalRoutes.get('/workspaces/:workspaceId/proposals', async (req, res, next) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('commercial_tickets').select('*')
      .eq('ticket_type', 'proposal')
      .eq('active', true)
      .neq('lineage_status', 'rejected')
      .order('created_at', { ascending: false });
    if (error) throw { status: 500, message: error.message, code: 'DB_ERROR' };

    const data = (rows || [])
      .map(commercialTicketToProposal)
      .filter((p: any) => p.workspace_id === req.params.workspaceId || p.id === req.params.workspaceId);

    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

proposalRoutes.get('/proposals/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('commercial_tickets').select('*')
      .eq('id', req.params.id)
      .eq('ticket_type', 'proposal')
      .eq('active', true)
      .neq('lineage_status', 'rejected')
      .maybeSingle();
    if (error || !data) {
      res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' });
      return;
    }

    res.json({ data: commercialTicketToProposal(data) });
  } catch (err) {
    next(err);
  }
});

proposalRoutes.post('/workspaces/:workspaceId/proposals', legacyProposalWriteDisabled);
proposalRoutes.patch('/proposals/:id', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/submit-review', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/mark-ready-crm', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/mark-sent', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/mark-negotiation', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/approve', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/reject', legacyProposalWriteDisabled);
proposalRoutes.post('/proposals/:id/create-version', legacyProposalWriteDisabled);
