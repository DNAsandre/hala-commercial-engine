/**
 * Unified Commercial Ticket Types
 *
 * TypeScript interfaces mapping exactly to the `commercial_tickets` and
 * `commercial_ticket_audit` Supabase tables (Rev 4 schema).
 *
 * Doctrine:
 *   - null = unknown / not captured yet
 *   - 0 = explicitly confirmed zero
 *   - Empty string is NOT truth
 *   - No mock data, no hardcoded records
 */

// ── Enums ──────────────────────────────────────────────────────

export type UnifiedTicketType = "proposal" | "tender" | "renewal" | "sla";

export type SourceType =
  | "crm_opportunity"
  | "approved_excel"
  | "uploaded_document"
  | "manual_verified"
  | "customer_request"
  | "renewal_trigger"
  | "contract_trigger";

export type LineageStatus = "unverified" | "needs_review" | "verified" | "rejected";

export type AuditAction =
  | "created"
  | "updated"
  | "stage_changed"
  | "lineage_verified"
  | "lineage_rejected"
  | "quarantined"
  | "promoted"
  | "deactivated";

export const DEFAULT_CRM_PIPELINE_STAGE = "Prospecting";

export const DEFAULT_INTERNAL_STAGE: Record<UnifiedTicketType, string> = {
  proposal: "Qualified",
  tender: "Identified",
  renewal: "Identified",
  sla: "Draft",
};

// ── Main Ticket Interface ──────────────────────────────────────

export interface CommercialTicket {
  id: string;

  // Type
  ticket_type: UnifiedTicketType;

  // Identity (all nullable — no fake defaults)
  ticket_title: string | null;
  customer_name: string | null;
  customer_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;

  // Ownership
  owner: string | null;
  team_members: string[];
  region: string | null;
  industry: string | null;

  // Pipeline placement
  crm_pipeline_stage: string | null;
  internal_stage: string | null;

  // Commercial values — null = unknown, 0 = confirmed zero
  estimated_value: number | null;
  target_gp_percent: number | null;
  probability_percent: number | null;

  // Timeline
  target_date: string | null;

  // Notes
  notes: string | null;

  // Type-specific details (JSONB)
  type_details: ProposalDetails | TenderDetails | RenewalDetails | SlaDetails | Record<string, unknown>;

  // Source / lineage
  source_type: SourceType | null;
  source_reference: string | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row_id: string | null;
  source_document_id: string | null;

  // Lineage verification
  lineage_status: LineageStatus;
  lineage_notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  quarantined_reason: string | null;

  // Intake origin
  created_from_intake: boolean;

  // Legacy links
  legacy_workspace_id: string | null;
  legacy_opportunity_id: string | null;
  legacy_tender_id: string | null;

  // Lifecycle
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Type-Specific Detail Interfaces ────────────────────────────

export interface ProposalDetails {
  discovery_status?: string | null;
  pricing_status?: string | null;
  go_live_date?: string | null;
  proposal_version?: number | null;
  linked_workspace_id?: string | null;
}

export interface TenderDetails {
  tender_ref?: string | null;
  submission_deadline?: string | null;
  execution_regions?: string[] | null;
  target_sites?: string[] | null;
  execution_type?: string | null;
  geographic_complexity?: string | null;
  linked_workspace_id?: string | null;
}

export interface RenewalDetails {
  current_contract_id?: string | null;
  current_contract_expiry?: string | null;
  renewal_window_days?: number | null;
  renewal_risk?: string | null;
  existing_service_type?: string | null;
  linked_workspace_id?: string | null;
}

export interface SlaDetails {
  parent_ticket_id?: string | null;
  standalone_reason?: string | null;   // required if no parent_ticket_id
  sla_type?: string | null;
  service_scope?: string | null;
  operational_owner?: string | null;
  effective_date?: string | null;
  linked_workspace_id?: string | null;
}

// ── Audit Trail Interface ──────────────────────────────────────

export interface CommercialTicketAudit {
  id: string;
  ticket_id: string;
  action: AuditAction;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  user_name: string | null;
  notes: string | null;
  created_at: string;
}

// ── Display Helpers ────────────────────────────────────────────

export const TICKET_TYPE_CONFIG: Record<UnifiedTicketType, {
  label: string;
  color: string;
  bg: string;
  icon: string;
}> = {
  proposal: { label: "Proposal", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: "📋" },
  tender:   { label: "Tender",   color: "text-[#075eea]", bg: "bg-[#075eea]/10 border-[#075eea]/20", icon: "📑" },
  renewal:  { label: "Renewal",  color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "🔄" },
  sla:      { label: "SLA",      color: "text-teal-700", bg: "bg-teal-50 border-teal-200", icon: "📊" },
};

export const LINEAGE_STATUS_CONFIG: Record<LineageStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  unverified:   { label: "Unverified",   color: "text-gray-600",   bg: "bg-gray-100" },
  needs_review: { label: "Needs Review", color: "text-amber-600",  bg: "bg-amber-100" },
  verified:     { label: "Verified",     color: "text-emerald-600", bg: "bg-emerald-100" },
  rejected:     { label: "Rejected",     color: "text-red-600",    bg: "bg-red-100" },
};

export const SOURCE_TYPE_CONFIG: Record<SourceType, { label: string }> = {
  crm_opportunity:    { label: "CRM Opportunity" },
  approved_excel:     { label: "Approved Excel Import" },
  uploaded_document:  { label: "Uploaded Document" },
  manual_verified:    { label: "Manual (Verified)" },
  customer_request:   { label: "Customer Request" },
  renewal_trigger:    { label: "Renewal Trigger" },
  contract_trigger:   { label: "Contract Trigger" },
};

// ── Lineage Guard Helpers ──────────────────────────────────────

/** Check if a ticket is verified and should appear in operational views */
export function isVerified(ticket: CommercialTicket): boolean {
  return ticket.lineage_status === "verified" && ticket.active;
}

/** Check if a ticket is quarantined (not verified) */
export function isQuarantined(ticket: CommercialTicket): boolean {
  return ticket.lineage_status !== "verified" && ticket.active;
}

/** Check if a ticket is deactivated (soft-deleted) */
export function isDeactivated(ticket: CommercialTicket): boolean {
  return !ticket.active;
}

/** Split tickets into verified (for operational views) and quarantined */
export function splitByLineage(tickets: CommercialTicket[]): {
  verified: CommercialTicket[];
  quarantined: CommercialTicket[];
  deactivated: CommercialTicket[];
} {
  const verified: CommercialTicket[] = [];
  const quarantined: CommercialTicket[] = [];
  const deactivated: CommercialTicket[] = [];

  for (const t of tickets) {
    if (!t.active) deactivated.push(t);
    else if (t.lineage_status === "verified") verified.push(t);
    else quarantined.push(t);
  }

  return { verified, quarantined, deactivated };
}

// ── Display Value Helpers ──────────────────────────────────────
// Doctrine: null = "Not captured yet", 0 = "SAR 0"

export function displayValue(val: number | null): string {
  if (val === null) return "Not captured yet";
  if (val === 0) return "SAR 0";
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

export function displayPercent(val: number | null): string {
  if (val === null) return "Not captured yet";
  return `${val.toFixed(1)}%`;
}

export function displayText(val: string | null): string {
  if (val === null || val.trim() === "") return "Not available";
  return val;
}
