/**
 * Document render context.
 *
 * Proposal and SLA documents render from canonical commercial_tickets only.
 * Legacy proposals/slas fallbacks are intentionally removed.
 */
import { supabaseAdmin } from './supabase.js';

interface RenderContext {
  title: string;
  subtitle: string;
  documentNumber: string;
  customerName: string;
  generatedDate: string;
  sections: any[];
  footer: string;
  sourceData: any;
}

export async function buildRenderContext(
  documentType: string,
  sourceId: string,
  workspaceId: string
): Promise<RenderContext> {
  const now = new Date().toISOString().split('T')[0];
  const { data: ws } = await supabaseAdmin.from('workspaces').select('*').eq('id', workspaceId).single();
  const customerName = ws?.customer_name || ws?.customerName || 'Customer';

  if (documentType === 'quote') return buildQuoteContext(sourceId, customerName, now);
  if (documentType === 'proposal') return buildProposalContext(sourceId, customerName, now);
  if (documentType === 'sla') return buildSlaContext(sourceId, customerName, now);

  throw { status: 400, message: `Unsupported document type: ${documentType}`, code: 'INVALID_TYPE' };
}

async function buildQuoteContext(sourceId: string, customerName: string, date: string): Promise<RenderContext> {
  const { data: q } = await supabaseAdmin.from('quotes').select('*').eq('id', sourceId).single();
  if (!q) throw { status: 404, message: 'Quote not found', code: 'NOT_FOUND' };

  return {
    title: 'Commercial Quote',
    subtitle: `${q.service_type || 'Services'} - ${customerName}`,
    documentNumber: q.quote_number || `Q-V${q.version_number || q.version}`,
    customerName,
    generatedDate: date,
    footer: `Hala Commercial Engine - Quote ${q.quote_number || ''} - Confidential`,
    sourceData: q,
    sections: [
      { type: 'heading', text: 'Quote Summary' },
      { type: 'label-value', label: 'Quote Number', value: q.quote_number },
      { type: 'label-value', label: 'Version', value: `${q.version_number || q.version}` },
      { type: 'label-value', label: 'Status', value: q.status },
      { type: 'label-value', label: 'Customer', value: customerName },
      { type: 'label-value', label: 'Service Type', value: q.service_type },
      { type: 'label-value', label: 'Currency', value: q.currency || 'SAR' },
      { type: 'spacer' },
      { type: 'heading', text: 'Pricing' },
      { type: 'label-value', label: 'Storage Rate', value: `${q.currency || 'SAR'} ${q.storage_rate || 0}` },
      { type: 'label-value', label: 'Inbound Rate', value: `${q.currency || 'SAR'} ${q.inbound_rate || 0}` },
      { type: 'label-value', label: 'Outbound Rate', value: `${q.currency || 'SAR'} ${q.outbound_rate || 0}` },
      { type: 'label-value', label: 'Pallet Volume', value: `${q.pallet_volume || 0}` },
      { type: 'label-value', label: 'Monthly Revenue', value: `${q.currency || 'SAR'} ${(q.monthly_revenue || 0).toLocaleString()}` },
      { type: 'label-value', label: 'Annual Revenue', value: `${q.currency || 'SAR'} ${(q.annual_revenue || 0).toLocaleString()}` },
      { type: 'label-value', label: 'Estimated Cost', value: `${q.currency || 'SAR'} ${(q.estimated_cost || q.total_cost || 0).toLocaleString()}` },
      { type: 'label-value', label: 'Gross Profit', value: `${q.gp_percent || 0}% (${q.currency || 'SAR'} ${(q.gp_amount || 0).toLocaleString()})` },
      ...(q.assumptions ? [{ type: 'spacer' }, { type: 'heading', text: 'Assumptions' }, { type: 'text', text: q.assumptions }] : []),
      ...(q.exclusions ? [{ type: 'heading', text: 'Exclusions' }, { type: 'text', text: q.exclusions }] : []),
      ...(q.notes ? [{ type: 'heading', text: 'Notes' }, { type: 'text', text: q.notes }] : []),
    ],
  };
}

async function buildProposalContext(sourceId: string, customerName: string, date: string): Promise<RenderContext> {
  const { data: ticket } = await supabaseAdmin
    .from('commercial_tickets')
    .select('*')
    .eq('id', sourceId)
    .eq('ticket_type', 'proposal')
    .maybeSingle();

  if (!ticket) throw { status: 404, message: 'Proposal not found in commercial_tickets', code: 'NOT_FOUND' };

  const details = ticket.type_details || {};
  return {
    title: ticket.ticket_title || 'Commercial Proposal',
    subtitle: ticket.customer_name || customerName,
    documentNumber: `PROP-${String(ticket.id).slice(0, 8).toUpperCase()}`,
    customerName: ticket.customer_name || customerName,
    generatedDate: date,
    footer: 'Hala Commercial Engine - Proposal - Confidential',
    sourceData: ticket,
    sections: [
      { type: 'heading', text: 'Proposal Details' },
      { type: 'label-value', label: 'Ticket ID', value: ticket.id },
      { type: 'label-value', label: 'CRM Stage', value: ticket.crm_pipeline_stage || 'Not captured yet' },
      { type: 'label-value', label: 'Internal Stage', value: ticket.internal_stage || 'Not captured yet' },
      { type: 'label-value', label: 'Customer', value: ticket.customer_name || customerName },
      { type: 'label-value', label: 'Estimated Value', value: ticket.estimated_value == null ? 'Not captured yet' : `SAR ${Number(ticket.estimated_value).toLocaleString()}` },
      { type: 'label-value', label: 'Target GP%', value: ticket.target_gp_percent == null ? 'Not captured yet' : `${ticket.target_gp_percent}%` },
      { type: 'label-value', label: 'Probability', value: ticket.probability_percent == null ? 'Not captured yet' : `${ticket.probability_percent}%` },
      { type: 'label-value', label: 'Source Type', value: ticket.source_type || 'Not captured yet' },
      { type: 'label-value', label: 'Source Reference', value: ticket.source_reference || 'Not captured yet' },
      ...(details.discovery_status ? [{ type: 'label-value', label: 'Discovery Status', value: details.discovery_status }] : []),
      ...(details.pricing_status ? [{ type: 'label-value', label: 'Pricing Status', value: details.pricing_status }] : []),
      ...(ticket.notes ? [{ type: 'spacer' }, { type: 'heading', text: 'Notes' }, { type: 'text', text: ticket.notes }] : []),
    ],
  };
}

async function buildSlaContext(sourceId: string, customerName: string, date: string): Promise<RenderContext> {
  const { data: ticket } = await supabaseAdmin
    .from('commercial_tickets')
    .select('*')
    .eq('id', sourceId)
    .eq('ticket_type', 'sla')
    .maybeSingle();

  if (!ticket) throw { status: 404, message: 'SLA not found in commercial_tickets', code: 'NOT_FOUND' };

  const details = ticket.type_details || {};
  return {
    title: ticket.ticket_title || 'Service Level Agreement',
    subtitle: ticket.customer_name || customerName,
    documentNumber: `SLA-${String(ticket.id).slice(0, 8).toUpperCase()}`,
    customerName: ticket.customer_name || customerName,
    generatedDate: date,
    footer: 'Hala Commercial Engine - SLA - Confidential',
    sourceData: ticket,
    sections: [
      { type: 'heading', text: 'SLA Overview' },
      { type: 'label-value', label: 'Ticket ID', value: ticket.id },
      { type: 'label-value', label: 'Customer', value: ticket.customer_name || customerName },
      { type: 'label-value', label: 'CRM Stage', value: ticket.crm_pipeline_stage || 'Not captured yet' },
      { type: 'label-value', label: 'Internal Stage', value: ticket.internal_stage || 'Not captured yet' },
      { type: 'label-value', label: 'SLA Type', value: details.sla_type || 'Not captured yet' },
      { type: 'label-value', label: 'Parent Ticket', value: details.parent_ticket_id || 'Standalone / not linked' },
      { type: 'label-value', label: 'Effective Date', value: details.effective_date || ticket.target_date || 'Not captured yet' },
      ...(details.service_scope ? [{ type: 'spacer' }, { type: 'heading', text: 'Service Scope' }, { type: 'text', text: details.service_scope }] : []),
      ...(ticket.notes ? [{ type: 'heading', text: 'Notes' }, { type: 'text', text: ticket.notes }] : []),
    ],
  };
}
