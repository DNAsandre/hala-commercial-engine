import type { CommercialTicket, UnifiedTicketType } from "./unified-ticket-types";

export const PROCESS_ISOLATION_ENABLED = true;

export const ALLOWED_TENDER_IDS = [
  "7483c493-0098-40a9-9e5f-76007bc62cd1",
] as const;

/**
 * SC-01 Wave 05 — ARCHITECT RULING, PROCESS-ISOLATION OPTION B.
 *
 * A tender created by the clean application must be immediately visible,
 * openable and editable, surviving reload and direct navigation. The
 * clean-origin marker is `commercial_tickets.created_from_intake`, which
 * `intake-save.createTicket` writes as `true` on every clean create — an
 * established column, probed live on 2026-08-05, not an invented one.
 *
 * Legacy seed records remain excluded, but ONLY by their exact captured ids
 * (the standing delete-by-exact-id doctrine applied to filtering): the three
 * `[HALA-UAT-ARV2]` seed tenders below also carry `created_from_intake=true`,
 * so the marker alone cannot distinguish them. No fuzzy, prefix, title or
 * date matching is used — an unlisted record is never treated as a seed.
 */
export const LEGACY_SEED_TENDER_IDS = [
  "a1100000-0000-4000-8000-000000000030", // [HALA-UAT-ARV2] National Distribution Tender
  "a1200000-0000-4000-8000-000000000001", // [HALA-UAT-ARV2][W2-S001] Tender Aggregate Test
  "a1200000-0000-4000-8000-000000000002", // [HALA-UAT-ARV2][W2-S002] Fifteen Stage Tender Test
] as const;

export const LEGACY_TENDER_IDS_FOR_AUDIT = [
  "tn-linde-001",
] as const;

export const ALLOWED_TENDER_NAME_ALIASES = [
  "lindi",
  "linde",
  "linde sigas",
  "linde sigas transportation tender",
] as const;

// KAFD remains available as current test data, but these values are not used
// as runtime proposal allowlist rules.
export const PROPOSAL_TEST_DATA_IDS = [
  "089447d6-6d4f-4921-9df3-92483f36233a",
] as const;

export const PROPOSAL_TEST_DATA_NAME_ALIASES = [
  "kafd",
  "king abdullah financial district",
  "kafd 3pl",
  "kafd 3pl riyadh warehouse",
  "kafd riyadh warehouse",
  "kafd riyadh warehouse transportation",
] as const;

export const PROPOSAL_CREATOR_SOURCE_TYPES = [
  "crm_opportunity",
  "approved_excel",
  "uploaded_document",
  "manual_verified",
  "customer_request",
] as const;

export const FORBIDDEN_PROCESS_SOURCES = [
  "commercial-os",
  "commercial-os-data",
  "commercial_os",
  "commercial_os_data",
  "commercial os",
  "dashboard",
  "dashboard-feed",
  "dashboard-metrics",
  "dashboard_process_feed",
  "dashboard_metrics",
  "rolling-intelligence",
  "rolling_intelligence",
  "rolling intelligence",
  "operations-signals",
  "operations_signals",
  "operations signal inbox",
  "commercial-escalations",
  "commercial_escalations",
  "escalation-engine",
  "escalation_engine",
  "global-escalations",
  "global_escalations",
  "escalation-events",
  "escalation_events",
  "escalation-tasks",
  "escalation_tasks",
  "generated-insights",
  "generated_insights",
  "generated-insight-fallback",
  "generated_insight_fallback",
  "contract-baselines",
  "contract_baselines",
  "renewal-engine",
  "renewal_engine",
  "ecr",
] as const;

export const FORBIDDEN_PROPOSAL_PLACEHOLDER_MARKERS = [
  "mock",
  "sample",
  "dummy",
  "placeholder",
  "simulated",
  "fabricated",
] as const;

export const ALLOWED_TENDER_LOCAL_INTELLIGENCE_SOURCES = [
  "tender",
  "tender_workspace",
  "type_details",
  "documents",
  "packs",
  "placeholders",
  "required_documents",
  "compliance",
  "activity",
  "audit",
  "stage_progress",
  "crm_customer",
  "crm_contact",
  "company_data",
] as const;

type TicketLike = {
  id?: unknown;
  ticket_type?: unknown;
  created_from_intake?: unknown;
  ticket_title?: unknown;
  customer_name?: unknown;
  company?: unknown;
  active?: unknown;
  source_type?: unknown;
  source_reference?: unknown;
  source_file?: unknown;
  source_sheet?: unknown;
  notes?: unknown;
  legacy_workspace_id?: unknown;
  legacy_opportunity_id?: unknown;
  legacy_tender_id?: unknown;
  source_document_id?: unknown;
  type_details?: unknown;
};

export interface EmptyRenewalState {
  enabled: false;
  renewalWorkspaces: [];
  contractBaselines: [];
  reason: string;
}

export interface EmptySlaState {
  enabled: false;
  slaRecords: [];
  contractStatuses: [];
  source: "process_isolation";
  reason: string;
}

export interface EmptyDashboardProcessSummary<TSignal = never> {
  signals: TSignal[];
  totalTenders: 0;
  greenCount: 0;
  amberCount: 0;
  redCount: 0;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasId(id: unknown, allowedIds: readonly string[]): boolean {
  return typeof id === "string" && allowedIds.includes(id);
}

function aliasesMatch(values: unknown[], aliases: readonly string[]): boolean {
  const haystack = normalizeText(values.filter(Boolean).join(" "));
  if (!haystack) return false;
  return aliases.some(alias => haystack.includes(normalizeText(alias)));
}

function ticketIdentityValues(ticket: TicketLike): unknown[] {
  return [
    ticket.ticket_title,
    ticket.customer_name,
    ticket.company,
    ticket.source_reference,
    ticket.source_file,
    ticket.notes,
    ticket.legacy_workspace_id,
    ticket.legacy_opportunity_id,
    ticket.legacy_tender_id,
    ticket.source_document_id,
    ticket.type_details && typeof ticket.type_details === "object"
      ? JSON.stringify(ticket.type_details)
      : undefined,
  ];
}

function ticketSourceValues(ticket: TicketLike): unknown[] {
  return [
    ticket.source_type,
    ticket.source_reference,
    ticket.source_file,
    ticket.source_sheet,
    ticket.source_document_id,
    ticket.notes,
    ticket.type_details && typeof ticket.type_details === "object"
      ? JSON.stringify(ticket.type_details)
      : undefined,
  ];
}

function containsForbiddenProcessSource(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const source = normalizeText(value);
  if (!source) return false;
  return FORBIDDEN_PROCESS_SOURCES.some(forbidden =>
    ` ${source} `.includes(` ${normalizeText(forbidden)} `)
  );
}

function hasForbiddenProcessSourceValues(ticket: TicketLike): boolean {
  return ticketSourceValues(ticket).some(containsForbiddenProcessSource);
}

function hasForbiddenProposalPlaceholderIdentity(ticket: TicketLike): boolean {
  const haystack = normalizeText(ticketIdentityValues(ticket).filter(Boolean).join(" "));
  if (!haystack) return false;
  return FORBIDDEN_PROPOSAL_PLACEHOLDER_MARKERS.some(marker =>
    haystack.includes(normalizeText(marker))
  );
}

function isAllowedProposalCreatorSourceType(sourceType: unknown): boolean {
  if (!sourceType) return true;
  const source = normalizeText(sourceType);
  return PROPOSAL_CREATOR_SOURCE_TYPES.some(allowed => source === normalizeText(allowed));
}

/**
 * Option B admission (architect ruling, 2026-08-05). In order:
 *  1. exact legacy-seed ids are excluded;
 *  2. the ratified explicit allowlist (Linde) is admitted;
 *  3. any tender whose ROW carries `created_from_intake === true` is admitted —
 *     this is what makes a human-created tender visible immediately;
 *  4. the historical Linde name-alias fallback is retained last, for callers
 *     holding partial rows without the marker column.
 *
 * The previous `hasNonCanonicalId` early-reject — which refused every canonical
 * UUID outside the one-entry allowlist before anything else could run — is the
 * exact behaviour the ruling removes, and it must not return.
 */
export function isAllowedTenderTicket(ticket: TicketLike | null | undefined): boolean {
  if (!PROCESS_ISOLATION_ENABLED) return true;
  if (!ticket) return false;
  if (ticket.ticket_type && ticket.ticket_type !== "tender") return false;
  if (hasId(ticket.id, LEGACY_SEED_TENDER_IDS)) return false;
  if (hasId(ticket.id, ALLOWED_TENDER_IDS)) return true;
  if (ticket.created_from_intake === true) return true;
  return aliasesMatch(ticketIdentityValues(ticket), ALLOWED_TENDER_NAME_ALIASES);
}

/**
 * Pre-fetch check for id-only callers (the tender workspace deep link). Under
 * Option B a clean-created tender can only be recognised from its ROW (the
 * marker lives on the row), so an id-only check may reject ONLY the exact
 * legacy seed ids. Everything else must be fetched and then evaluated with
 * {@link isAllowedTenderTicket} — "the allowlist may not reject a
 * clean-created tender before its row is read."
 */
export function mayTenderIdBeAllowed(id: unknown): boolean {
  if (!PROCESS_ISOLATION_ENABLED) return true;
  return !hasId(id, LEGACY_SEED_TENDER_IDS);
}

export function isAllowedProposalTicket(ticket: TicketLike | null | undefined): boolean {
  if (!PROCESS_ISOLATION_ENABLED) return true;
  if (!ticket) return false;
  if (ticket.ticket_type !== "proposal") return false;
  if (ticket.active === false) return false;
  if (!isAllowedProposalCreatorSourceType(ticket.source_type)) return false;
  if (hasForbiddenProcessSourceValues(ticket)) return false;
  if (hasForbiddenProposalPlaceholderIdentity(ticket)) return false;
  return true;
}

export function filterAllowedTenderTickets<T extends TicketLike>(tickets: T[]): T[] {
  if (!PROCESS_ISOLATION_ENABLED) return tickets;
  return tickets.filter(isAllowedTenderTicket);
}

export function filterAllowedProposalTickets<T extends TicketLike>(tickets: T[]): T[] {
  if (!PROCESS_ISOLATION_ENABLED) return tickets;
  return tickets.filter(isAllowedProposalTicket);
}

export function filterAllowedOperationalTickets<T extends TicketLike>(
  ticketType: UnifiedTicketType,
  tickets: T[]
): T[] {
  if (!PROCESS_ISOLATION_ENABLED) return tickets;
  if (ticketType === "tender") return filterAllowedTenderTickets(tickets);
  if (ticketType === "proposal") return filterAllowedProposalTickets(tickets);
  if (ticketType === "renewal" || ticketType === "sla") return [];
  return [];
}

export function isAllowedOperationalTicket(ticket: TicketLike | null | undefined): boolean {
  if (!PROCESS_ISOLATION_ENABLED) return true;
  if (!ticket) return false;
  if (ticket.ticket_type === "tender") return isAllowedTenderTicket(ticket);
  if (ticket.ticket_type === "proposal") return isAllowedProposalTicket(ticket);
  if (ticket.ticket_type === "renewal" || ticket.ticket_type === "sla") return false;
  return false;
}

export function filterAllowedOperationalTicketRows<T extends TicketLike>(tickets: T[]): T[] {
  if (!PROCESS_ISOLATION_ENABLED) return tickets;
  return tickets.filter(isAllowedOperationalTicket);
}

export function getEmptyRenewalState(): EmptyRenewalState {
  return {
    enabled: false,
    renewalWorkspaces: [],
    contractBaselines: [],
    reason: "Renewals are intentionally empty while clean Tender, Proposal, and SLA processes are isolated.",
  };
}

export function getEmptyRenewalWorkspaces<T>(): T[] {
  return [];
}

export function getEmptyContractBaselines<T>(): T[] {
  return [];
}

export function getEmptySlaState(): EmptySlaState {
  return {
    enabled: false,
    slaRecords: [],
    contractStatuses: [],
    source: "process_isolation",
    reason: "The SLA process is intentionally paused while the clean SLA workflow is isolated from disallowed process feeds and legacy output routes.",
  };
}

export function getEmptySlaRecords<T>(): T[] {
  return [];
}

export function getEmptyContractStatuses<T>(): T[] {
  return [];
}

export function isSlaProcessReadEnabled(): boolean {
  return false;
}

export function isSlaProcessWriteEnabled(): boolean {
  return false;
}

export function getSlaProcessIsolationReason(): string {
  return getEmptySlaState().reason;
}

export function getEmptyDashboardProcessSummary<TSignal>(): EmptyDashboardProcessSummary<TSignal> {
  return {
    signals: [],
    totalTenders: 0,
    greenCount: 0,
    amberCount: 0,
    redCount: 0,
  };
}

export function isForbiddenProcessSource(sourceName: string | null | undefined): boolean {
  const source = normalizeText(sourceName);
  if (!source) return false;
  return FORBIDDEN_PROCESS_SOURCES.some(forbidden => source === normalizeText(forbidden));
}

export function assertTenderLocalIntelligenceSource(sourceName: string): void {
  const source = normalizeText(sourceName);
  const allowed = ALLOWED_TENDER_LOCAL_INTELLIGENCE_SOURCES.some(
    allowedSource => source === normalizeText(allowedSource)
  );
  if (!allowed || isForbiddenProcessSource(sourceName)) {
    throw new Error(`Forbidden tender intelligence source: ${sourceName}`);
  }
}

export function isDashboardProcessFeedEnabled(): boolean {
  return false;
}

export function getDashboardProcessIsolationReason(): string {
  return "Dashboard process feeds are disconnected while clean Tender, Proposal, SLA, and Renewal processes are isolated.";
}

export function isCrmSyncHeaderReadEnabled(): boolean {
  return false;
}

export function isCrmSyncEventReadEnabled(): boolean {
  return false;
}

export function getCrmSyncHeaderIsolationReason(): string {
  return "The global CRM sync header read is disabled while clean process validation is kept free of shell-level Supabase noise.";
}
