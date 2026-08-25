/**
 * provenance-sidecar.ts — PADW T04, design pin P4, ADR-04.
 *
 * Field-level source lineage for BOTH ticket types (tender and proposal),
 * stored in ONE JSONB facet on the process's own commercial_tickets row:
 *
 *   type_details.provenance = {
 *     [fieldId | `${fieldId}#${fingerprint}`]: {
 *       document_id?, page_section?, excerpt?, extraction_ref?, confidence?,
 *       recorded_at, actor,
 *     }
 *   }
 *
 * The sidecar is strictly NON-DESTRUCTIVE:
 *   - it patch-merges ONLY the `provenance` facet — every other type_details
 *     key is carried over untouched (same object references);
 *   - merge is at ENTRY-KEY granularity — stored entries whose keys are not in
 *     the current request are preserved;
 *   - it NEVER writes a business value, any other facet, or any other column
 *     (in particular never `crm_pipeline_stage` / `internal_stage`) — the
 *     update payload is exactly `{ type_details }`;
 *   - business values therefore stay fully human-editable; the lineage lives
 *     beside them, never over them.
 *
 * Writer semantics mirror the guarded tender source store
 * (supabase-tender-source-record.ts): exact id + ticket_type + active=true +
 * revision token on the UPDATE itself, zero-row disambiguation via re-read,
 * and read-back verification before any 'saved' is reported. No schema
 * migration — JSONB facet only (pin P8).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessKind } from './destination-manifest/manifest-types';

export const PROVENANCE_FACET_KEY = 'provenance';

export type JsonObject = Record<string, unknown>;

/** Source details a caller may attach to one destination field / repeated row. */
export interface ProvenanceEntryDetails {
  /** Exact id of the source document in the ticket's document register. */
  document_id?: string;
  /** Page / section locator inside the source document (e.g. "p. 12 §4.2"). */
  page_section?: string;
  /** Verbatim source quotation supporting the stored value. */
  excerpt?: string;
  /** Reference into the extraction run / suggestion that produced the value. */
  extraction_ref?: string;
  /** Extractor confidence (0..1 by convention). Informational — never a gate. */
  confidence?: number;
}

/** One stored provenance record: caller details + writer-stamped lineage. */
export interface ProvenanceEntry extends ProvenanceEntryDetails {
  recorded_at: string;
  actor: string;
}

export interface ProvenanceEntryInput extends ProvenanceEntryDetails {
  /** Canonical field id (P1), or `${fieldId}#${fingerprint}` for repeated rows (P5). */
  key: string;
}

/** Canonical provenance key for a field, optionally scoped to one repeated row. */
export function buildProvenanceKey(fieldId: string, fingerprint?: string): string {
  return fingerprint ? `${fieldId}#${fingerprint}` : fieldId;
}

// ─────────────────────────────────────────────────────────────
// Store contract + Supabase adapter (guarded writer)
// ─────────────────────────────────────────────────────────────

export interface ProvenanceTicketRow extends JsonObject {
  id: string;
  ticket_type: string;
  active: boolean;
  updated_at: string;
  type_details?: unknown;
}

export interface ProvenanceTicketUpdateResult {
  status: 'saved' | 'stale' | 'not_found' | 'failed';
  row?: ProvenanceTicketRow;
  error?: string;
}

export interface ProvenanceTicketStore {
  readActiveTicket(ticketId: string, processKind: ProcessKind): Promise<ProvenanceTicketRow | null>;
  updateActiveTicket(args: {
    ticketId: string;
    processKind: ProcessKind;
    expectedRevision: string;
    /** Full merged type_details — the ONLY column this sidecar ever writes. */
    typeDetails: JsonObject;
  }): Promise<ProvenanceTicketUpdateResult>;
}

export interface ProvenanceSidecarDeps {
  store: ProvenanceTicketStore;
  /** Injected clock (ISO 8601) for testability. Defaults to the real clock. */
  now?: () => string;
}

export function createSupabaseProvenanceTicketStore(client: SupabaseClient<any>): ProvenanceTicketStore {
  const readActiveTicket = async (ticketId: string, processKind: ProcessKind): Promise<ProvenanceTicketRow | null> => {
    const { data, error } = await client
      .from('commercial_tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('ticket_type', processKind)
      .eq('active', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? data as ProvenanceTicketRow : null;
  };

  const updateActiveTicket = async (args: {
    ticketId: string;
    processKind: ProcessKind;
    expectedRevision: string;
    typeDetails: JsonObject;
  }): Promise<ProvenanceTicketUpdateResult> => {
    const { data, error } = await client
      .from('commercial_tickets')
      .update({ type_details: args.typeDetails })
      .eq('id', args.ticketId)
      .eq('ticket_type', args.processKind)
      .eq('active', true)
      .eq('updated_at', args.expectedRevision)
      .select('*')
      .maybeSingle();

    if (error) return { status: 'failed', error: error.message };
    if (data) return { status: 'saved', row: data as ProvenanceTicketRow };

    const current = await readActiveTicket(args.ticketId, args.processKind);
    if (!current) return { status: 'not_found', error: `Active ${args.processKind} not found.` };
    if (current.updated_at !== args.expectedRevision) return { status: 'stale', row: current };
    return {
      status: 'failed',
      row: current,
      error: 'Provenance save affected no row. The entries remain available for retry.',
    };
  };

  return { readActiveTicket, updateActiveTicket };
}

// ─────────────────────────────────────────────────────────────
// Read / record API
// ─────────────────────────────────────────────────────────────

export interface ReadProvenanceResult {
  status: 'found' | 'not_found' | 'failed';
  /** Stored entries, verbatim — reads never rewrite stored data. */
  entries?: Record<string, ProvenanceEntry>;
  /** Revision token to pass as expectedRevision on a follow-up record call. */
  revision?: string;
  error?: string;
}

export interface RecordProvenanceRequest {
  ticketId: string;
  processKind: ProcessKind;
  expectedRevision: string;
  /** Operator / run identity stamped into every entry of this request. */
  actor: string;
  entries: ProvenanceEntryInput[];
}

export interface RecordProvenanceResult {
  status: 'saved' | 'stale' | 'not_found' | 'failed';
  /** Read-back-verified stored facet after a successful save. */
  entries?: Record<string, ProvenanceEntry>;
  /** New revision token after a save; the current token on 'stale'. */
  revision?: string;
  error?: string;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function objectOrEmpty(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function isActiveTicketRow(row: ProvenanceTicketRow, ticketId: string, processKind: ProcessKind): boolean {
  return row.id === ticketId && row.ticket_type === processKind && row.active === true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    return aKeys.length === Object.keys(b).length && aKeys.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function validateRequest(req: RecordProvenanceRequest): string | null {
  if (!req.ticketId.trim()) return 'Provenance record requires the exact ticket id.';
  if (!req.expectedRevision.trim()) return 'Provenance record requires the revision token the caller read.';
  if (!req.actor.trim()) return 'Provenance record requires the acting user or run identity.';
  if (!Array.isArray(req.entries) || req.entries.length === 0) {
    return 'Provenance record requires at least one entry.';
  }
  const seen = new Set<string>();
  for (const entry of req.entries) {
    if (typeof entry.key !== 'string' || !entry.key.trim()) {
      return 'Every provenance entry needs a non-empty key (canonical field id, optionally "#<fingerprint>").';
    }
    if (seen.has(entry.key)) {
      return `Provenance request contains duplicate key "${entry.key}". One request may carry each key once.`;
    }
    seen.add(entry.key);
    if (entry.confidence !== undefined && (typeof entry.confidence !== 'number' || !Number.isFinite(entry.confidence))) {
      return `Provenance entry "${entry.key}" has a non-numeric confidence.`;
    }
  }
  return null;
}

function stampEntry(input: ProvenanceEntryInput, recordedAt: string, actor: string): ProvenanceEntry {
  const { key: _key, ...details } = input;
  const entry: JsonObject = {};
  for (const [name, value] of Object.entries(details)) {
    if (value !== undefined) entry[name] = value;
  }
  entry.recorded_at = recordedAt;
  entry.actor = actor;
  return entry as unknown as ProvenanceEntry;
}

export async function readProvenance(
  deps: ProvenanceSidecarDeps,
  ticketId: string,
  processKind: ProcessKind,
): Promise<ReadProvenanceResult> {
  if (!ticketId.trim()) return { status: 'failed', error: 'Provenance read requires the exact ticket id.' };

  let row: ProvenanceTicketRow | null;
  try {
    row = await deps.store.readActiveTicket(ticketId, processKind);
  } catch (error) {
    return { status: 'failed', error: messageOf(error) };
  }
  if (!row || !isActiveTicketRow(row, ticketId, processKind)) {
    return { status: 'not_found', error: `Active ${processKind} not found.` };
  }

  const entries = objectOrEmpty(objectOrEmpty(row.type_details)[PROVENANCE_FACET_KEY]);
  return { status: 'found', entries: entries as Record<string, ProvenanceEntry>, revision: row.updated_at };
}

export async function recordProvenance(
  deps: ProvenanceSidecarDeps,
  req: RecordProvenanceRequest,
): Promise<RecordProvenanceResult> {
  const invalid = validateRequest(req);
  if (invalid) return { status: 'failed', error: invalid };

  let currentRow: ProvenanceTicketRow | null;
  try {
    currentRow = await deps.store.readActiveTicket(req.ticketId, req.processKind);
  } catch (error) {
    return { status: 'failed', error: messageOf(error) };
  }
  if (!currentRow) {
    return {
      status: 'not_found',
      error: `Active ${req.processKind} not found. The provenance entries remain available for retry.`,
    };
  }
  if (!isActiveTicketRow(currentRow, req.ticketId, req.processKind)) {
    return {
      status: 'failed',
      error: `The returned row is not the requested active ${req.processKind} identity.`,
    };
  }
  if (currentRow.updated_at !== req.expectedRevision) {
    return {
      status: 'stale',
      revision: currentRow.updated_at,
      error: `The ${req.processKind} changed after this provenance was captured. Re-read and retry — nothing was written.`,
    };
  }

  const recordedAt = (deps.now ?? (() => new Date().toISOString()))();
  const stamped: Record<string, ProvenanceEntry> = {};
  for (const input of req.entries) {
    stamped[input.key] = stampEntry(input, recordedAt, req.actor);
  }

  // Patch-merge ONLY the provenance facet: every other type_details key keeps
  // its exact stored object, and stored entries whose keys are not in this
  // request are preserved (entry-key granularity).
  const currentDetails = objectOrEmpty(currentRow.type_details);
  const currentFacet = objectOrEmpty(currentDetails[PROVENANCE_FACET_KEY]);
  const nextDetails: JsonObject = {
    ...currentDetails,
    [PROVENANCE_FACET_KEY]: { ...currentFacet, ...stamped },
  };

  let update: ProvenanceTicketUpdateResult;
  try {
    update = await deps.store.updateActiveTicket({
      ticketId: req.ticketId,
      processKind: req.processKind,
      expectedRevision: req.expectedRevision,
      typeDetails: nextDetails,
    });
  } catch (error) {
    update = { status: 'failed', error: messageOf(error) };
  }

  if (update.status !== 'saved') {
    return {
      status: update.status,
      revision: update.row?.updated_at,
      error: update.error
        ?? (update.status === 'stale'
          ? `The ${req.processKind} changed before this provenance save completed. Re-read and retry — nothing was written.`
          : undefined),
    };
  }
  const savedRow = update.row;
  if (!savedRow) {
    return {
      status: 'failed',
      error: 'Provenance save reported success without returning the stored row — treat the save as unverified.',
    };
  }

  // Read-back verification: 'saved' is reported only when every requested
  // entry is stored exactly as stamped.
  const storedFacet = objectOrEmpty(objectOrEmpty(savedRow.type_details)[PROVENANCE_FACET_KEY]);
  for (const key of Object.keys(stamped)) {
    if (!deepEqual(storedFacet[key], stamped[key])) {
      return {
        status: 'failed',
        revision: savedRow.updated_at,
        error: `Provenance read-back mismatch for "${key}". The stored entry does not match what was written — do not trust this save.`,
      };
    }
  }

  return {
    status: 'saved',
    entries: storedFacet as Record<string, ProvenanceEntry>,
    revision: savedRow.updated_at,
  };
}
