/**
 * GHL Mapper — Field Mapping Between GHL and Hala Data Shapes
 *
 * Translates GHL API entities to Hala database records and vice versa.
 * Used by both the webhook handler (inbound) and the sync API (outbound).
 *
 * SECURITY: This module runs SERVER-SIDE ONLY.
 */

import type { GHLContact, GHLOpportunity, GHLBusiness } from './ghl-service.js';

// ─── HALA TYPES (database shapes) ───────────────────────────────────────────

export interface HalaCustomer {
  id?: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  city: string;
  country: string;
  website: string;
  address: string;
  ghlContactId: string | null;
  ghlBusinessId: string | null;
}

export interface HalaWorkspace {
  id?: string;
  title: string;
  customerId: string;
  customerName: string;
  stage: string;
  estimatedValue: number;
  owner: string;
  source: string;
  status: string;
  ghlOpportunityId: string | null;
  ghlContactId: string | null;
  ghlBusinessId: string | null;
  ghlPipelineId: string | null;
  ghlPipelineStageId: string | null;
}

// ─── STAGE MAPPING ──────────────────────────────────────────────────────────
// Maps Hala workspace stages ↔ GHL pipeline stage names.
// These are display-name matches. Actual GHL stage IDs are resolved at runtime
// by matching against the pipeline's stage list.

export const HALA_TO_GHL_STAGE: Record<string, string> = {
  prospecting:          'New Lead',
  qualified:            'Qualified',
  quoting:              'Quote Sent',
  solution_design:      'Solution Design',
  proposal_active:      'Proposal Active',
  negotiation:          'Negotiation',
  commercial_approved:  'Approved',
  sla_drafting:         'SLA Draft',
  contract_sent:        'Contract Sent',
  closed_won:           'Won',
  contract_signed:      'Signed',
  go_live:              'Active',
  closed_lost:          'Closed Lost',
};

// Reverse map: GHL stage name → Hala stage key
export const GHL_TO_HALA_STAGE: Record<string, string> = Object.fromEntries(
  Object.entries(HALA_TO_GHL_STAGE).map(([k, v]) => [v.toLowerCase(), k]),
);

/**
 * Resolve a GHL stage name to a Hala workspace stage key.
 * Falls back to 'prospecting' if no match is found.
 */
export function resolveHalaStage(ghlStageName: string): string {
  return GHL_TO_HALA_STAGE[ghlStageName.toLowerCase()] ?? 'prospecting';
}

/**
 * Resolve a Hala stage key to a GHL stage display name.
 * Falls back to 'New Lead' if no match is found.
 */
export function resolveGhlStageName(halaStage: string): string {
  return HALA_TO_GHL_STAGE[halaStage] ?? 'New Lead';
}

// ─── GHL → HALA MAPPERS (Inbound) ──────────────────────────────────────────

/**
 * Map a GHL Contact to a Hala Customer record.
 */
export function ghlContactToHalaCustomer(contact: GHLContact): HalaCustomer {
  return {
    name: contact.companyName || contact.name || `${contact.firstName} ${contact.lastName}`.trim(),
    contactEmail: contact.email,
    contactPhone: contact.phone,
    industry: '',  // GHL doesn't have a native industry field
    city: '',
    country: '',
    website: '',
    address: '',
    ghlContactId: contact.id,
    ghlBusinessId: contact.businessId ?? null,
  };
}

/**
 * Map a GHL Business to a Hala Customer record.
 * Businesses provide richer company-level data than contacts.
 */
export function ghlBusinessToHalaCustomer(business: GHLBusiness): HalaCustomer {
  return {
    name: business.name,
    contactEmail: business.email,
    contactPhone: business.phone,
    industry: '',
    city: business.city,
    country: business.country,
    website: business.website,
    address: business.address,
    ghlContactId: null,
    ghlBusinessId: business.id,
  };
}

/**
 * Map a GHL Opportunity to a Hala Workspace record.
 * Requires a customerId (resolved from the entity map or created inline).
 */
export function ghlOpportunityToHalaWorkspace(
  opp: GHLOpportunity,
  customerId: string,
  customerName: string,
  ghlStageName?: string,
): HalaWorkspace {
  const stageName = ghlStageName ?? '';
  return {
    title: opp.name,
    customerId,
    customerName,
    stage: resolveHalaStage(stageName),
    estimatedValue: opp.monetaryValue,
    owner: opp.assignedTo || '',
    source: opp.source || 'GHL CRM',
    status: mapGhlStatusToHala(opp.status),
    ghlOpportunityId: opp.id,
    ghlContactId: opp.contactId || null,
    ghlBusinessId: opp.businessId ?? null,
    ghlPipelineId: opp.pipelineId || null,
    ghlPipelineStageId: opp.pipelineStageId || null,
  };
}

// ─── HALA → GHL MAPPERS (Outbound) ─────────────────────────────────────────

/**
 * Map a Hala Customer to a GHL Contact creation payload.
 */
export function halaCustomerToGhlContact(customer: HalaCustomer): {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  companyName?: string;
} {
  // Split customer name into first/last
  const parts = (customer.name || '').split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  return {
    firstName,
    lastName,
    email: customer.contactEmail || undefined,
    phone: customer.contactPhone || undefined,
    companyName: customer.name || undefined,
  };
}

/**
 * Map a Hala Workspace to a GHL Opportunity creation payload.
 * Requires a GHL contactId (resolved from entity map).
 */
export function halaWorkspaceToGhlOpportunity(
  workspace: HalaWorkspace,
  ghlContactId: string,
  pipelineId: string,
  pipelineStageId: string,
): {
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  contactId: string;
  monetaryValue: number;
  status: string;
} {
  return {
    pipelineId,
    pipelineStageId,
    name: workspace.title,
    contactId: ghlContactId,
    monetaryValue: workspace.estimatedValue || 0,
    status: mapHalaStatusToGhl(workspace.status),
  };
}

/**
 * Map a Hala Customer to a GHL Business creation payload.
 */
export function halaCustomerToGhlBusiness(customer: HalaCustomer): {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
} {
  return {
    name: customer.name,
    phone: customer.contactPhone || undefined,
    email: customer.contactEmail || undefined,
    website: customer.website || undefined,
    address: customer.address || undefined,
    city: customer.city || undefined,
    country: customer.country || undefined,
  };
}

// ─── STATUS MAPPERS ─────────────────────────────────────────────────────────

function mapGhlStatusToHala(ghlStatus: string): string {
  switch (ghlStatus?.toLowerCase()) {
    case 'open':       return 'active';
    case 'won':        return 'won';
    case 'lost':       return 'lost';
    case 'abandoned':  return 'abandoned';
    default:           return 'active';
  }
}

function mapHalaStatusToGhl(halaStatus: string): string {
  switch (halaStatus?.toLowerCase()) {
    case 'active':     return 'open';
    case 'won':        return 'won';
    case 'lost':       return 'lost';
    case 'abandoned':  return 'abandoned';
    default:           return 'open';
  }
}
