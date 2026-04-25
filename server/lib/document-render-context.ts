/**
 * Document Render Context — Sprint 6
 * Fetches real data and builds structured sections for PDF generation.
 * Supports: quote, proposal, sla
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

  // Fetch workspace + customer
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
    subtitle: `${q.service_type || 'Services'} — ${customerName}`,
    documentNumber: q.quote_number || `Q-V${q.version_number || q.version}`,
    customerName,
    generatedDate: date,
    footer: `Hala Commercial Engine — Quote ${q.quote_number} — Confidential`,
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
      { type: 'spacer' },
      { type: 'heading', text: 'Volume Assumptions' },
      { type: 'label-value', label: 'Monthly Volume', value: `${q.monthly_volume || 0} ${q.volume_unit || 'pallets'}` },
      { type: 'label-value', label: 'Validity', value: `${q.validity_days || 30} days` },
      ...(q.assumptions ? [{ type: 'spacer' }, { type: 'heading', text: 'Assumptions' }, { type: 'text', text: q.assumptions }] : []),
      ...(q.exclusions ? [{ type: 'heading', text: 'Exclusions' }, { type: 'text', text: q.exclusions }] : []),
      ...(q.notes ? [{ type: 'heading', text: 'Notes' }, { type: 'text', text: q.notes }] : []),
    ],
  };
}

async function buildProposalContext(sourceId: string, customerName: string, date: string): Promise<RenderContext> {
  const { data: p } = await supabaseAdmin.from('proposals').select('*').eq('id', sourceId).single();
  if (!p) throw { status: 404, message: 'Proposal not found', code: 'NOT_FOUND' };
  const snap = p.pricing_snapshot || {};

  return {
    title: p.title || 'Commercial Proposal',
    subtitle: `${snap.service_type || 'Services'} — ${customerName}`,
    documentNumber: p.proposal_number || `P-V${p.version_number || p.version}`,
    customerName,
    generatedDate: date,
    footer: `Hala Commercial Engine — Proposal ${p.proposal_number} — Confidential`,
    sourceData: p,
    sections: [
      { type: 'heading', text: 'Proposal Details' },
      { type: 'label-value', label: 'Proposal Number', value: p.proposal_number },
      { type: 'label-value', label: 'Version', value: `${p.version_number || p.version}` },
      { type: 'label-value', label: 'Status', value: p.status },
      { type: 'label-value', label: 'Linked Quote', value: snap.quote_number || p.linked_quote_id || '—' },
      { type: 'label-value', label: 'Customer', value: customerName },
      ...(p.executive_summary ? [{ type: 'spacer' }, { type: 'heading', text: 'Executive Summary' }, { type: 'text', text: p.executive_summary }] : []),
      ...(p.service_summary ? [{ type: 'heading', text: 'Service Summary' }, { type: 'text', text: p.service_summary }] : []),
      ...(p.scope_description ? [{ type: 'heading', text: 'Scope of Services' }, { type: 'text', text: p.scope_description }] : []),
      { type: 'spacer' },
      { type: 'heading', text: 'Pricing Summary (from Quote)' },
      { type: 'label-value', label: 'Annual Revenue', value: `${snap.currency || 'SAR'} ${(snap.annual_revenue || 0).toLocaleString()}` },
      { type: 'label-value', label: 'Monthly Revenue', value: `${snap.currency || 'SAR'} ${(snap.monthly_revenue || 0).toLocaleString()}` },
      { type: 'label-value', label: 'Estimated Cost', value: `${snap.currency || 'SAR'} ${(snap.estimated_cost || 0).toLocaleString()}` },
      { type: 'label-value', label: 'Gross Profit', value: `${snap.gp_percent || 0}%` },
      { type: 'badge', text: 'Pricing sourced from linked quote — not editable in proposal' },
      ...(p.assumptions ? [{ type: 'spacer' }, { type: 'heading', text: 'Assumptions' }, { type: 'text', text: p.assumptions }] : []),
      ...(p.exclusions ? [{ type: 'heading', text: 'Exclusions' }, { type: 'text', text: p.exclusions }] : []),
      ...(p.indicative_sla_disclaimer ? [{ type: 'spacer' }, { type: 'badge', text: p.indicative_sla_disclaimer }] : []),
      ...(p.negotiation_notes ? [{ type: 'spacer' }, { type: 'heading', text: 'Negotiation Notes' }, { type: 'text', text: p.negotiation_notes }] : []),
    ],
  };
}

async function buildSlaContext(sourceId: string, customerName: string, date: string): Promise<RenderContext> {
  const { data: s } = await supabaseAdmin.from('slas').select('*').eq('id', sourceId).single();
  if (!s) throw { status: 404, message: 'SLA not found', code: 'NOT_FOUND' };
  const kpis: any[] = Array.isArray(s.kpi_rows) ? s.kpi_rows : [];

  return {
    title: s.title || 'Service Level Agreement',
    subtitle: customerName,
    documentNumber: s.sla_number || `SLA-V${s.version_number}`,
    customerName,
    generatedDate: date,
    footer: `Hala Commercial Engine — SLA ${s.sla_number} — Confidential`,
    sourceData: s,
    sections: [
      { type: 'heading', text: 'SLA Overview' },
      { type: 'label-value', label: 'SLA Number', value: s.sla_number },
      { type: 'label-value', label: 'Version', value: `${s.version_number}` },
      { type: 'label-value', label: 'Status', value: s.status },
      { type: 'label-value', label: 'Effective Date', value: s.effective_date || 'TBD' },
      { type: 'label-value', label: 'Review Date', value: s.review_date || 'TBD' },
      { type: 'label-value', label: 'Linked Proposal', value: s.linked_proposal_id || '—' },
      ...(s.service_scope ? [{ type: 'spacer' }, { type: 'heading', text: 'Service Scope' }, { type: 'text', text: s.service_scope }] : []),
      ...(kpis.length > 0 ? [
        { type: 'spacer' },
        { type: 'heading', text: `Key Performance Indicators (${kpis.length})` },
        { type: 'kpi-table', columns: ['KPI', 'Target', 'Method', 'Frequency', 'Owner', 'Penalty'],
          rows: kpis.map((k: any) => ({ KPI: k.name, Target: k.target, Method: k.method, Frequency: k.frequency, Owner: k.owner, Penalty: k.penalty_applies ? 'Yes' : 'No' })) },
      ] : []),
      ...(s.measurement_methods ? [{ type: 'spacer' }, { type: 'heading', text: 'Measurement Methods' }, { type: 'text', text: s.measurement_methods }] : []),
      ...(s.penalty_terms ? [{ type: 'heading', text: 'Penalty Terms' }, { type: 'text', text: s.penalty_terms }] : []),
      ...(s.exclusions ? [{ type: 'heading', text: 'Exclusions' }, { type: 'text', text: s.exclusions }] : []),
      ...(s.customer_responsibilities ? [{ type: 'spacer' }, { type: 'heading', text: 'Customer Responsibilities' }, { type: 'text', text: s.customer_responsibilities }] : []),
      ...(s.operational_notes ? [{ type: 'heading', text: 'Operational Notes' }, { type: 'text', text: s.operational_notes }] : []),
    ],
  };
}
