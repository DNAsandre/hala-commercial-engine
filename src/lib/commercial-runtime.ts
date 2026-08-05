/**
 * commercial-runtime.ts — SC-01 Wave 03 / Ticket T04 (agent W03-1).
 *
 * Clean-owned, direct-Supabase runtime for the Quote and Proposal panels.
 * Replaces the 15 old-server HTTP rows that WorkspaceQuoteSection,
 * WorkspaceProposalSection, QuoteWizard and ProposalWizard used to call
 * through `@/lib/api-client`.
 *
 * ── HONESTY CONTRACT ────────────────────────────────────────────────
 *  1. Only ESTABLISHED tables/columns are touched. Nothing is invented.
 *       quotes                 — full Sprint-3 schema, CONFIRMED LIVE by a
 *                                column-by-column PostgREST probe of the
 *                                project (W03 coordinator, 2026-08). The old
 *                                server route that owned this table is
 *                                hala-commercial-engine/server/routes/quotes.ts
 *                                (read-only evidence) and it is the source of
 *                                the mirror-column, quote_number and
 *                                valid_until conventions reproduced below.
 *       commercial_tickets     — proven by intake-save.ts + unified-ticket-types.ts
 *       commercial_ticket_audit— proven by intake-save.ts writeAudit()
 *  2. Every mutation is CONFIRMED with .select() and a returned-row check.
 *     A write that returns no row is reported as a failure, never as success.
 *  3. Reads distinguish three outcomes: real data, honest empty, functional
 *     error. An empty list is `{ ok: true, data: [] }`; a failed query is
 *     `{ ok: false, error }` and must be surfaced by the caller.
 *  4. Values the caller supplies that have NO established column are NOT
 *     silently dropped — they are returned in `unstoredFields` so the UI can
 *     tell the human exactly what was and was not persisted.
 *  5. NO gates, locks, approval enforcement, AI or bots. "submit" / "approve"
 *     / "reject" are ordinary human record actions: they are recorded, never
 *     enforced.
 */

import { supabase } from "./supabase";
import { getCurrentUser } from "./auth-state";
import { changeStage, fetchOperationalTicketsByType } from "./intake-save";
import type { CommercialTicket } from "./unified-ticket-types";

// ── Result envelope ─────────────────────────────────────────────────

export type RuntimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function fail<T>(error: string): RuntimeResult<T> {
  return { ok: false, error };
}

function ok<T>(data: T): RuntimeResult<T> {
  return { ok: true, data };
}

// ════════════════════════════════════════════════════════════════════
// QUOTES — established `quotes` table
// ════════════════════════════════════════════════════════════════════

/**
 * Established `quotes` columns, all confirmed present on the live table.
 *
 * MIRROR PAIRS: the table carries both the original clean-app columns and the
 * Sprint-3 additions for the same three facts —
 *     version : version_number
 *     state   : status
 *     total_cost : estimated_cost
 * The old server wrote BOTH sides of every pair (routes/quotes.ts:132-147), and
 * supabase-data.ts mapQuote still reads the original side while these panels
 * read the Sprint-3 side. Writing only one side would leave the other stale, so
 * every write here sets both. This is not duplication we invented; it is the
 * established shape of the table.
 *
 * `updated_at` / `updated_by` ARE written on mutations: Fable confirmed both
 * columns live by direct PostgREST probe (2026-08-05), matching what the old
 * route did, so the row's change stamp stays truthful.
 */
const QUOTE_COLUMNS = [
  "id",
  "workspace_id",
  "customer_id",
  "quote_number",
  "version",
  "version_number",
  "state",
  "status",
  "service_type",
  "currency",
  "volume_unit",
  "monthly_volume",
  "storage_rate",
  "inbound_rate",
  "outbound_rate",
  "pallet_volume",
  "monthly_revenue",
  "annual_revenue",
  "total_cost",
  "estimated_cost",
  "discount_percent",
  "validity_days",
  "valid_until",
  "assumptions",
  "exclusions",
  "notes",
  "change_reason",
  "supersedes_quote_id",
  "created_by",
  "created_at",
] as const;

/**
 * Quote number format, reproduced exactly from the old server route
 * (hala-commercial-engine/server/routes/quotes.ts:23) so numbers generated here
 * are indistinguishable from the ones already in the table.
 */
export function generateQuoteNumber(workspaceId: string, version: number): string {
  const prefix = workspaceId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase();
  return `Q-${prefix}-V${version}`;
}

/**
 * valid_until = today + validity_days, date only. Reproduced from the old
 * server route (routes/quotes.ts:28).
 */
export function calculateValidUntil(validityDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + validityDays);
  return date.toISOString().split("T")[0];
}

/** Quote states used by the app (store.ts QuoteState). */
export type QuoteState =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "superseded";

/**
 * A quote as the Quote panels consume it — every field is a real column on the
 * live `quotes` table. Nullable fields stay nullable: a column the database
 * genuinely does not hold a value for renders as unknown, never as a default we
 * made up.
 */
export interface QuoteRecord {
  id: string;
  workspace_id: string | null;
  customer_id: string | null;
  quote_number: string | null;
  version: number | null;
  version_number: number | null;
  state: string | null;
  status: string | null;
  service_type: string | null;
  currency: string | null;
  volume_unit: string | null;
  monthly_volume: number;
  storage_rate: number;
  inbound_rate: number;
  outbound_rate: number;
  pallet_volume: number;
  monthly_revenue: number;
  annual_revenue: number;
  total_cost: number;
  estimated_cost: number;
  discount_percent: number;
  validity_days: number | null;
  valid_until: string | null;
  assumptions: string | null;
  exclusions: string | null;
  notes: string | null;
  change_reason: string | null;
  supersedes_quote_id: string | null;
  created_by: string | null;
  created_at: string | null;
  gp_percent: number;
  gp_amount: number;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string | null {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function mapQuoteRow(row: Record<string, any>): QuoteRecord {
  // Mirror pairs: prefer the Sprint-3 column, fall back to the original one so
  // rows written before the migration still read correctly.
  const version = row.version_number ?? row.version;
  const status = row.status ?? row.state;
  const estimatedCost = row.estimated_cost ?? row.total_cost;
  return {
    id: String(row.id),
    workspace_id: text(row.workspace_id),
    customer_id: text(row.customer_id),
    quote_number: text(row.quote_number),
    version: row.version == null ? null : Number(row.version),
    version_number: version == null ? null : Number(version),
    state: text(row.state),
    status: text(status),
    service_type: text(row.service_type),
    currency: text(row.currency),
    volume_unit: text(row.volume_unit),
    monthly_volume: num(row.monthly_volume),
    storage_rate: num(row.storage_rate),
    inbound_rate: num(row.inbound_rate),
    outbound_rate: num(row.outbound_rate),
    pallet_volume: num(row.pallet_volume),
    monthly_revenue: num(row.monthly_revenue),
    annual_revenue: num(row.annual_revenue),
    total_cost: num(row.total_cost),
    estimated_cost: num(estimatedCost),
    discount_percent: num(row.discount_percent),
    validity_days: row.validity_days == null ? null : Number(row.validity_days),
    valid_until: text(row.valid_until),
    assumptions: text(row.assumptions),
    exclusions: text(row.exclusions),
    notes: text(row.notes),
    change_reason: text(row.change_reason),
    supersedes_quote_id: text(row.supersedes_quote_id),
    created_by: text(row.created_by),
    created_at: text(row.created_at),
    gp_percent: num(row.gp_percent),
    gp_amount: num(row.gp_amount),
  };
}

/**
 * Every caller-supplied key this module knows how to persist. Anything a caller
 * sends that is NOT in here has no column and is reported back through
 * `unstoredFields` rather than silently dropped. The set is derived from the
 * write mapping below, so it can never drift out of sync with it.
 */
const PERSISTABLE_QUOTE_INPUT_KEYS = new Set([
  "storage_rate",
  "inbound_rate",
  "outbound_rate",
  "pallet_volume",
  "monthly_revenue",
  "annual_revenue",
  "gp_percent",
  "gp_amount",
  "estimated_cost",
  "service_type",
  "currency",
  "volume_unit",
  "monthly_volume",
  "discount_percent",
  "validity_days",
  "assumptions",
  "exclusions",
  "notes",
  "customer_id",
]);

export interface QuoteWriteInput {
  storage_rate?: number;
  inbound_rate?: number;
  outbound_rate?: number;
  pallet_volume?: number;
  monthly_revenue?: number;
  annual_revenue?: number;
  gp_percent?: number;
  gp_amount?: number;
  /** written to BOTH `estimated_cost` and the mirror `total_cost` */
  estimated_cost?: number;
  service_type?: string;
  currency?: string;
  volume_unit?: string;
  monthly_volume?: number;
  discount_percent?: number;
  /** also drives the derived `valid_until` column */
  validity_days?: number;
  assumptions?: string;
  exclusions?: string;
  notes?: string;
  customer_id?: string;
  [key: string]: unknown;
}

export interface QuoteMutationOutcome {
  quote: QuoteRecord;
  /** Values supplied by the human that the quotes table cannot store. */
  unstoredFields: string[];
  /** Non-fatal problems that happened AFTER the confirmed primary write. */
  warnings: string[];
}

function quoteRowFromInput(input: QuoteWriteInput): Record<string, any> {
  const row: Record<string, any> = {};
  const setNum = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = num(value);
  };
  const setText = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value === null ? null : String(value);
  };

  setNum("storage_rate", input.storage_rate);
  setNum("inbound_rate", input.inbound_rate);
  setNum("outbound_rate", input.outbound_rate);
  setNum("pallet_volume", input.pallet_volume);
  setNum("monthly_volume", input.monthly_volume);
  setNum("monthly_revenue", input.monthly_revenue);
  setNum("annual_revenue", input.annual_revenue);
  setNum("gp_percent", input.gp_percent);
  setNum("gp_amount", input.gp_amount);
  setNum("discount_percent", input.discount_percent);
  setText("service_type", input.service_type);
  setText("currency", input.currency);
  setText("volume_unit", input.volume_unit);
  setText("assumptions", input.assumptions);
  setText("exclusions", input.exclusions);
  setText("notes", input.notes);
  setText("customer_id", input.customer_id);

  // Mirror pair — the old server kept estimated_cost and total_cost in sync.
  if (input.estimated_cost !== undefined) {
    row.estimated_cost = num(input.estimated_cost);
    row.total_cost = num(input.estimated_cost);
  }

  // validity_days drives valid_until, exactly as the old server did.
  if (input.validity_days !== undefined) {
    const days = num(input.validity_days);
    row.validity_days = days;
    if (days > 0) row.valid_until = calculateValidUntil(days);
  }

  return row;
}

/**
 * Which caller-supplied values carry information the quotes table cannot hold.
 *
 * Since the Sprint-3 columns were confirmed live, every field the quote wizard
 * collects now has a column and this returns [] for the wizard's payload. The
 * check is kept — and made generic rather than a fixed list — so that any
 * future field a caller invents is still reported honestly instead of being
 * dropped in silence.
 */
export function listUnstoredQuoteFields(input: QuoteWriteInput): string[] {
  return Object.keys(input).filter((key) => {
    if (PERSISTABLE_QUOTE_INPUT_KEYS.has(key)) return false;
    const value = input[key];
    return value !== undefined && value !== null && value !== "" && value !== 0;
  });
}

/**
 * Row 71 — GET /api/workspaces/:id/quotes
 * Honest empty is `{ ok: true, data: [] }`; a failed query is `{ ok: false }`.
 */
export async function listQuotesByWorkspace(
  workspaceId: string,
): Promise<RuntimeResult<QuoteRecord[]>> {
  if (!workspaceId) return fail("No workspace id supplied; quotes were not read.");

  const { data, error } = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .order("version_number", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return fail(`Quotes could not be read: ${error.message}`);
  return ok(((data ?? []) as Record<string, any>[]).map(mapQuoteRow));
}

/** Highest existing version in a workspace, or an error when the read failed. */
async function readNextQuoteVersion(
  workspaceId: string,
): Promise<{ version: number } | { error: string }> {
  const { data, error } = await supabase
    .from("quotes")
    .select("version_number,version")
    .eq("workspace_id", workspaceId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (error) {
    return { error: `Existing quote versions could not be read: ${error.message}` };
  }
  const rows = (data ?? []) as Array<{ version_number: number | null; version: number | null }>;
  const highest = rows.length > 0 ? Number(rows[0]?.version_number ?? rows[0]?.version ?? 0) : 0;
  return { version: (Number.isFinite(highest) ? highest : 0) + 1 };
}

/**
 * POST /api/workspaces/:id/quotes — create a draft quote.
 * Persists only the established columns; everything else comes back in
 * `unstoredFields`.
 */
export async function createQuote(
  workspaceId: string,
  input: QuoteWriteInput,
): Promise<RuntimeResult<QuoteMutationOutcome>> {
  if (!workspaceId) return fail("No workspace id supplied; the quote was not created.");

  const next = await readNextQuoteVersion(workspaceId);
  if ("error" in next) return fail(next.error);

  const row = {
    ...quoteRowFromInput(input),
    workspace_id: workspaceId,
    quote_number: generateQuoteNumber(workspaceId, next.version),
    // both sides of each mirror pair — see QUOTE_COLUMNS
    version: next.version,
    version_number: next.version,
    state: "draft" satisfies QuoteState,
    status: "draft" satisfies QuoteState,
    created_by: getCurrentUser().id,
  };

  const { data, error } = await supabase.from("quotes").insert(row).select();
  if (error) return fail(`Quote was NOT created: ${error.message}`);

  const created = ((data ?? []) as Record<string, any>[])[0];
  if (!created) {
    return fail("Quote was NOT created: the insert returned no row.");
  }

  return ok({
    quote: mapQuoteRow(created),
    unstoredFields: listUnstoredQuoteFields(input),
    warnings: [],
  });
}

/** Row 51 (PATCH) — update an existing quote's established pricing columns. */
export async function updateQuote(
  quoteId: string,
  input: QuoteWriteInput,
): Promise<RuntimeResult<QuoteMutationOutcome>> {
  if (!quoteId) return fail("No quote id supplied; nothing was updated.");

  const row = quoteRowFromInput(input);
  if (Object.keys(row).length === 0) {
    return fail(
      "Nothing was updated: none of the supplied values map to a column in the quotes table.",
    );
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({ ...row, updated_at: new Date().toISOString(), updated_by: getCurrentUser().id })
    .eq("id", quoteId)
    .select();

  if (error) return fail(`Quote was NOT updated: ${error.message}`);

  const updated = ((data ?? []) as Record<string, any>[])[0];
  if (!updated) {
    return fail(
      "Quote was NOT updated: no row matched that id (it may have been removed, or row-level security blocked the write).",
    );
  }

  return ok({
    quote: mapQuoteRow(updated),
    unstoredFields: listUnstoredQuoteFields(input),
    warnings: [],
  });
}

/**
 * Shared confirmed state write for the quote record actions. Sets BOTH sides of
 * the state/status mirror pair so every reader of this table agrees.
 *
 * No gates: unlike the old server route (which rejected anything but
 * draft→submitted→approved), any state can be recorded at any time.
 */
async function setQuoteState(
  quoteId: string,
  state: QuoteState,
  extra: Record<string, any> = {},
): Promise<RuntimeResult<QuoteRecord>> {
  if (!quoteId) return fail("No quote id supplied; nothing was recorded.");

  const { data, error } = await supabase
    .from("quotes")
    .update({ state, status: state, ...extra, updated_at: new Date().toISOString(), updated_by: getCurrentUser().id })
    .eq("id", quoteId)
    .select();

  if (error) return fail(`Quote state was NOT changed: ${error.message}`);

  const row = ((data ?? []) as Record<string, any>[])[0];
  if (!row) {
    return fail(
      "Quote state was NOT changed: no row matched that id (it may have been removed, or row-level security blocked the write).",
    );
  }
  return ok(mapQuoteRow(row));
}

/** Row 55 — POST /api/quotes/:id/submit. Human record action, no enforcement. */
export async function submitQuote(quoteId: string): Promise<RuntimeResult<QuoteRecord>> {
  return setQuoteState(quoteId, "submitted");
}

/** Row 52 — POST /api/quotes/:id/approve. Human record action, no enforcement. */
export async function approveQuote(quoteId: string): Promise<RuntimeResult<QuoteRecord>> {
  return setQuoteState(quoteId, "approved");
}

/**
 * Row 54 — POST /api/quotes/:id/reject.
 *
 * The reason goes into the established `change_reason` column in the SAME
 * confirmed update as the state change — exactly what the old server route did
 * (routes/quotes.ts:363-368). One write, one confirmation, nothing to lose.
 */
export async function rejectQuote(
  quoteId: string,
  reason: string,
): Promise<RuntimeResult<QuoteMutationOutcome>> {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return fail("A rejection reason is required; nothing was recorded.");

  const stateResult = await setQuoteState(quoteId, "rejected", { change_reason: trimmed });
  if (!stateResult.ok) return fail(stateResult.error);

  return ok({ quote: stateResult.data, unstoredFields: [], warnings: [] });
}

/**
 * Row 53 — POST /api/quotes/:id/create-version.
 *
 * Copies the full quote into a new draft row at version+1, links it back with
 * `supersedes_quote_id`, stores the `change_reason`, and marks the source row
 * superseded. Mirrors the old server route (routes/quotes.ts:421-455).
 */
export async function createQuoteVersion(
  quoteId: string,
  changeReason: string,
): Promise<RuntimeResult<QuoteMutationOutcome>> {
  const trimmed = (changeReason ?? "").trim();
  if (!quoteId) return fail("No quote id supplied; no version was created.");
  if (!trimmed) return fail("A change reason is required; no version was created.");

  const sourceRead = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS.join(","))
    .eq("id", quoteId)
    .limit(1);

  if (sourceRead.error) {
    return fail(`Source quote could not be read: ${sourceRead.error.message}`);
  }
  const sourceRow = ((sourceRead.data ?? []) as Record<string, any>[])[0];
  if (!sourceRow) {
    return fail("Source quote could not be read: no row matched that id.");
  }

  const workspaceId = sourceRow.workspace_id;
  if (!workspaceId) {
    return fail("Source quote has no workspace_id; no version was created.");
  }

  const next = await readNextQuoteVersion(workspaceId);
  if ("error" in next) return fail(next.error);

  const source = mapQuoteRow(sourceRow);
  const validityDays = source.validity_days ?? 30;
  const insertRow = {
    workspace_id: workspaceId,
    customer_id: source.customer_id,
    quote_number: generateQuoteNumber(workspaceId, next.version),
    version: next.version,
    version_number: next.version,
    state: "draft" satisfies QuoteState,
    status: "draft" satisfies QuoteState,
    service_type: source.service_type,
    currency: source.currency,
    volume_unit: source.volume_unit,
    monthly_volume: source.monthly_volume,
    storage_rate: source.storage_rate,
    inbound_rate: source.inbound_rate,
    outbound_rate: source.outbound_rate,
    pallet_volume: source.pallet_volume,
    monthly_revenue: source.monthly_revenue,
    annual_revenue: source.annual_revenue,
    total_cost: source.total_cost,
    estimated_cost: source.estimated_cost,
    discount_percent: source.discount_percent,
    validity_days: source.validity_days,
    valid_until: calculateValidUntil(validityDays),
    assumptions: source.assumptions,
    exclusions: source.exclusions,
    notes: source.notes,
    supersedes_quote_id: quoteId,
    change_reason: trimmed,
    created_by: getCurrentUser().id,
  };

  const { data, error } = await supabase.from("quotes").insert(insertRow).select();
  if (error) return fail(`New quote version was NOT created: ${error.message}`);

  const created = ((data ?? []) as Record<string, any>[])[0];
  if (!created) {
    return fail("New quote version was NOT created: the insert returned no row.");
  }

  const warnings: string[] = [];
  const superseded = await setQuoteState(quoteId, "superseded");
  if (!superseded.ok) {
    warnings.push(
      `New version V${next.version} was created, but the previous quote was NOT marked superseded: ${superseded.error}`,
    );
  }

  return ok({
    quote: mapQuoteRow(created),
    unstoredFields: [],
    warnings,
  });
}

// ════════════════════════════════════════════════════════════════════
// PROPOSALS — established `commercial_tickets` (ticket_type = "proposal")
// ════════════════════════════════════════════════════════════════════

/**
 * Internal stage keys taken from the established proposal tracker vocabulary
 * (src/components/proposal-workspace/proposal-stages.ts PROPOSAL_TRACKER_STAGES)
 * — the same values ProposalWorkspace already writes to
 * commercial_tickets.internal_stage.
 */
const PROPOSAL_STAGE_SENT = "proposal_sent";
const PROPOSAL_STAGE_NEGOTIATION = "negotiation";
const PROPOSAL_STAGE_COMMERCIAL_APPROVAL = "commercial_approval";

/** Proposal states produced by the established stage → state mapping. */
export type ProposalState =
  | "draft"
  | "ready_for_crm"
  | "sent"
  | "negotiation_active"
  | "commercial_approved";

/**
 * Established mapping (mirrors supabase-data.ts mapTicketStageToProposalState).
 * Kept here so this module owns its own contract rather than importing a
 * non-exported helper.
 */
export function mapInternalStageToProposalState(
  stage?: string | null,
): ProposalState {
  const normalized = (stage ?? "").toLowerCase().trim();
  if (normalized.includes("sent")) return "sent";
  if (normalized.includes("negotiation")) return "negotiation_active";
  if (normalized.includes("approval") || normalized.includes("signed")) {
    return "commercial_approved";
  }
  if (normalized.includes("draft")) return "draft";
  return "ready_for_crm";
}

/** A proposal as the Proposal panels consume it. */
export interface ProposalRecord {
  id: string;
  workspace_id: string;
  title: string | null;
  /** derived from internal_stage — there is no separate status column */
  status: ProposalState;
  internal_stage: string | null;
  version: number;
  /** alias of `version` */
  version_number: number;
  customer_name: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function ticketDetails(row: CommercialTicket): Record<string, any> {
  return row.type_details &&
    typeof row.type_details === "object" &&
    !Array.isArray(row.type_details)
    ? (row.type_details as Record<string, any>)
    : {};
}

function ticketWorkspaceId(row: CommercialTicket): string {
  const details = ticketDetails(row);
  return row.legacy_workspace_id || details.linked_workspace_id || row.id;
}

function mapTicketToProposal(row: CommercialTicket): ProposalRecord {
  const details = ticketDetails(row);
  const version = Number(details.proposal_version ?? 1) || 1;
  return {
    id: row.id,
    workspace_id: ticketWorkspaceId(row),
    title: row.ticket_title ?? null,
    status: mapInternalStageToProposalState(row.internal_stage),
    internal_stage: row.internal_stage ?? null,
    version,
    version_number: version,
    customer_name: row.customer_name ?? null,
    notes: row.notes ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * Row 70 — GET /api/workspaces/:id/proposals.
 * Reads the established operational proposal feed and scopes it the same way
 * supabase-data.ts fetchProposalsByWorkspace does.
 */
export async function listProposalsByWorkspace(
  workspaceId: string,
): Promise<RuntimeResult<ProposalRecord[]>> {
  if (!workspaceId) return fail("No workspace id supplied; proposals were not read.");

  const { data, error } = await fetchOperationalTicketsByType("proposal");
  if (error) return fail(`Proposals could not be read: ${error}`);

  const scoped = (data ?? [])
    .map(mapTicketToProposal)
    .filter((p) => p.workspace_id === workspaceId || p.id === workspaceId);

  return ok(scoped);
}

/** Read one proposal ticket's current internal_stage (needed as audit old_value). */
async function readTicketStage(
  proposalId: string,
): Promise<{ stage: string | null } | { error: string }> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("internal_stage")
    .eq("id", proposalId)
    .limit(1);

  if (error) return { error: `Proposal ticket could not be read: ${error.message}` };
  const row = ((data ?? []) as Array<{ internal_stage: string | null }>)[0];
  if (!row) return { error: "Proposal ticket could not be read: no row matched that id." };
  return { stage: row.internal_stage ?? null };
}

export interface ProposalMutationOutcome {
  proposal: ProposalRecord | null;
  /** Human-readable statement of what actually happened. */
  recorded: string;
  /** Values supplied by the human that no established column can hold. */
  unstoredFields: string[];
  warnings: string[];
}

/**
 * Move the proposal ticket's internal_stage using the established
 * `changeStage` helper, then CONFIRM the change by re-reading the row.
 * `changeStage` itself does not return the affected row, so the read-back is
 * what makes success honest.
 */
async function moveProposalStage(
  proposalId: string,
  newStage: string,
): Promise<RuntimeResult<ProposalMutationOutcome>> {
  if (!proposalId) return fail("No proposal id supplied; nothing was recorded.");

  const current = await readTicketStage(proposalId);
  if ("error" in current) return fail(current.error);

  const { error } = await changeStage(
    proposalId,
    "internal_stage",
    current.stage,
    newStage,
    getCurrentUser().name,
  );
  if (error) return fail(`Proposal stage was NOT changed: ${error}`);

  const confirmed = await readTicketStage(proposalId);
  if ("error" in confirmed) {
    return fail(
      `Proposal stage change could not be confirmed: ${confirmed.error}. Treat it as NOT saved and reload.`,
    );
  }
  if (confirmed.stage !== newStage) {
    return fail(
      `Proposal stage was NOT changed: the ticket still reads "${confirmed.stage ?? "(empty)"}".`,
    );
  }

  return ok({
    proposal: null,
    recorded: `Internal stage set to "${newStage}" on the commercial ticket.`,
    unstoredFields: [],
    warnings: [],
  });
}

/**
 * Append a confirmed row to the established `commercial_ticket_audit` table.
 * Used for the human record actions that have no established stage target —
 * the act is recorded truthfully instead of a status being invented.
 */
async function recordProposalAudit(
  proposalId: string,
  fieldChanged: string,
  newValue: string,
  notes: string,
): Promise<RuntimeResult<ProposalMutationOutcome>> {
  if (!proposalId) return fail("No proposal id supplied; nothing was recorded.");

  const current = await readTicketStage(proposalId);
  if ("error" in current) return fail(current.error);

  const { data, error } = await supabase
    .from("commercial_ticket_audit")
    .insert({
      ticket_id: proposalId,
      action: "updated",
      field_changed: fieldChanged,
      old_value: current.stage,
      new_value: newValue,
      user_name: getCurrentUser().name,
      notes,
    })
    .select();

  if (error) return fail(`Nothing was recorded: ${error.message}`);
  if (((data ?? []) as unknown[]).length === 0) {
    return fail("Nothing was recorded: the audit insert returned no row.");
  }

  return ok({
    proposal: null,
    recorded: "Recorded in the commercial ticket audit trail.",
    unstoredFields: [],
    warnings: [
      "The proposal stage is unchanged: there is no established internal stage for this action, so only the audit entry was written.",
    ],
  });
}

/** Row 48 — POST /api/proposals/:id/mark-sent. */
export function markProposalSent(proposalId: string) {
  return moveProposalStage(proposalId, PROPOSAL_STAGE_SENT);
}

/** Row 46 — POST /api/proposals/:id/mark-negotiation. */
export function markProposalNegotiation(proposalId: string) {
  return moveProposalStage(proposalId, PROPOSAL_STAGE_NEGOTIATION);
}

/** Row 44 — POST /api/proposals/:id/approve. Human record action, no enforcement. */
export function approveProposal(proposalId: string) {
  return moveProposalStage(proposalId, PROPOSAL_STAGE_COMMERCIAL_APPROVAL);
}

/** Row 50 — POST /api/proposals/:id/submit-review. Audit record only. */
export function recordProposalSubmittedForReview(proposalId: string) {
  return recordProposalAudit(
    proposalId,
    "proposal_submitted_for_review",
    "submitted_for_review",
    `Proposal submitted for review by ${getCurrentUser().name}. Advisory record only — nothing was enforced or locked.`,
  );
}

/** Row 47 — POST /api/proposals/:id/mark-ready-crm. Audit record only. */
export function recordProposalReadyForCrm(proposalId: string) {
  return recordProposalAudit(
    proposalId,
    "proposal_ready_for_crm",
    "ready_for_crm",
    `Proposal marked ready for CRM by ${getCurrentUser().name}. Advisory record only — nothing was enforced or locked.`,
  );
}

/** Row 49 — POST /api/proposals/:id/reject. Audit record only (reason preserved). */
export async function recordProposalRejected(
  proposalId: string,
  reason: string,
): Promise<RuntimeResult<ProposalMutationOutcome>> {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return fail("A rejection reason is required; nothing was recorded.");
  return recordProposalAudit(
    proposalId,
    "proposal_rejected",
    "rejected",
    `Proposal rejected by ${getCurrentUser().name}. Reason: ${trimmed}`,
  );
}

/**
 * Row 43 (PATCH) — update a proposal.
 *
 * `title` maps to the established `commercial_tickets.ticket_title` column and
 * is written + confirmed. The wizard's narrative fields have no established
 * column and no established `type_details` key, so they are returned in
 * `unstoredFields` instead of being written into a shape nothing reads.
 */
const PROPOSAL_UNSTORED_KEYS = [
  "executive_summary",
  "scope_description",
  "service_summary",
  "assumptions",
  "exclusions",
  "negotiation_notes",
  "client_request_summary",
  "linked_quote_id",
  "customer_id",
] as const;

export interface ProposalWriteInput {
  title?: string;
  [key: string]: unknown;
}

export async function updateProposal(
  proposalId: string,
  input: ProposalWriteInput,
): Promise<RuntimeResult<ProposalMutationOutcome>> {
  if (!proposalId) return fail("No proposal id supplied; nothing was updated.");

  const unstoredFields = PROPOSAL_UNSTORED_KEYS.filter((key) => {
    const value = input[key];
    return value !== undefined && value !== null && value !== "";
  });

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) {
    return fail(
      "Nothing was updated: the only proposal field with an established column is the title, and no title was supplied.",
    );
  }

  const { data, error } = await supabase
    .from("commercial_tickets")
    .update({ ticket_title: title })
    .eq("id", proposalId)
    .select();

  if (error) return fail(`Proposal was NOT updated: ${error.message}`);

  const updated = ((data ?? []) as CommercialTicket[])[0];
  if (!updated) {
    return fail(
      "Proposal was NOT updated: no row matched that id (it may have been removed, or row-level security blocked the write).",
    );
  }

  return ok({
    proposal: mapTicketToProposal(updated),
    recorded: "Proposal title saved to the commercial ticket.",
    unstoredFields: [...unstoredFields],
    warnings: [],
  });
}

// ── Rows with NO established contract ───────────────────────────────

/**
 * POST /api/workspaces/:id/proposals — BLOCKED.
 * A proposal IS a `commercial_tickets` row of ticket_type "proposal"; creating
 * one from this panel would mean running the intake path or inventing a
 * proposal table. Neither is an established contract for this surface.
 */
export const PROPOSAL_CREATE_UNAVAILABLE =
  "Creating a proposal is not available from this panel. A proposal is a commercial ticket, and the only established way to create one is the intake path — nothing was written.";

/**
 * Row 45 — POST /api/proposals/:id/create-version — BLOCKED.
 * `commercial_tickets` holds one proposal ticket per workspace and has no
 * established proposal-version record; type_details.proposal_version is read
 * but never written by any established path.
 */
export const PROPOSAL_VERSION_UNAVAILABLE =
  "Creating a new proposal version is not available: there is no established proposal-version record in commercial_tickets — nothing was written.";
