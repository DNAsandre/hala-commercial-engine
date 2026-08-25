/**
 * provenance-sidecar.test.ts — PADW T04 (design pin P4/P9, ADR-04).
 *
 * Guards the sidecar's non-destructive contract:
 *   - patch-merge ONLY the type_details.provenance facet — every other
 *     type_details key survives byte-identically (same object references);
 *   - merge at ENTRY-KEY granularity — stored entries not in the request
 *     are preserved;
 *   - guarded-writer semantics: exact id + ticket_type + active + revision
 *     token on the UPDATE, zero-row disambiguation, read-back verification;
 *   - stale → 'stale' with ZERO writes;
 *   - P9 tracker immunity: the update payload is exactly { type_details } and
 *     never carries crm_pipeline_stage / internal_stage;
 *   - actor + injected clock stamped into every entry.
 *
 * MOCK CONTRACT (house standard, tender-facet-writers.test.ts): records
 * table / op / payload / filters and ENFORCES every `.eq(...)` predicate
 * exactly like PostgREST against a stateful commercial_tickets row.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PROVENANCE_FACET_KEY,
  buildProvenanceKey,
  createSupabaseProvenanceTicketStore,
  readProvenance,
  recordProvenance,
  type ProvenanceEntryInput,
  type ProvenanceSidecarDeps,
} from './provenance-sidecar';

interface RecordedCall {
  table: string;
  op: 'select' | 'update';
  payload: Record<string, any> | null;
  filters: Array<[string, unknown]>;
}

const calls: RecordedCall[] = [];

const state = {
  row: null as Record<string, any> | null,
  /** When non-empty, each read consumes the next queued row instead of state.row. */
  readQueue: [] as Array<Record<string, any> | null>,
  readError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updateMatchesNothing: false,
  /** Simulates storage corrupting one stored entry (read-back mismatch). */
  corruptEntryKey: null as string | null,
  revCounter: 0,
};

function makeBuilder(table: string) {
  const call: RecordedCall = { table, op: 'select', payload: null, filters: [] };
  calls.push(call);

  const settle = () => {
    if (call.op === 'update') {
      if (state.updateError) return { data: null, error: state.updateError };
      if (state.updateMatchesNothing || !state.row) return { data: null, error: null };
      for (const [column, value] of call.filters) {
        if (column in state.row && state.row[column] !== value) return { data: null, error: null };
      }
      state.row = { ...state.row, ...(call.payload ?? {}), updated_at: `rev-${++state.revCounter}` };
      if (state.corruptEntryKey) {
        const facet = (state.row.type_details as Record<string, any>)?.[PROVENANCE_FACET_KEY];
        if (facet?.[state.corruptEntryKey]) {
          facet[state.corruptEntryKey] = { ...facet[state.corruptEntryKey], excerpt: 'CORRUPTED BY STORAGE' };
        }
      }
      return { data: state.row, error: null };
    }
    if (state.readError) return { data: null, error: state.readError };
    const row = state.readQueue.length ? state.readQueue.shift()! : state.row;
    if (!row) return { data: null, error: null };
    for (const [column, value] of call.filters) {
      if (column in row && row[column] !== value) return { data: null, error: null };
    }
    return { data: row, error: null };
  };

  const builder: any = {
    select: () => builder,
    update: (patch: Record<string, any>) => { call.op = 'update'; call.payload = patch; return builder; },
    eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder; },
    maybeSingle: () => Promise.resolve(settle()),
  };
  return builder;
}

const client = { from: (table: string) => makeBuilder(table) } as unknown as SupabaseClient<any>;

const FIXED_NOW = '2026-08-24T10:15:00.000Z';
const ACTOR = 'amin.operator';

function makeDeps(): ProvenanceSidecarDeps {
  return { store: createSupabaseProvenanceTicketStore(client), now: () => FIXED_NOW };
}

const TENDER_ID = 'c9f00000-0000-4000-8000-0000padwt041';
const PROPOSAL_ID = 'c9f00000-0000-4000-8000-0000padwt042';
const REV = 'rev-base';

function tenderRow(overrides: Record<string, any> = {}) {
  return {
    id: TENDER_ID,
    ticket_type: 'tender',
    active: true,
    updated_at: REV,
    ticket_title: 'PADW T04 Tender',
    crm_pipeline_stage: 'qualified',
    internal_stage: 'solution_design',
    type_details: {
      // Business facets the sidecar must NEVER touch.
      pricing: { summary: { note: 'business value — must survive byte-identically' } },
      submission_readiness: { placeholders: [{ id: 'ph-1', label: 'Bond', status: 'pending' }] },
    },
    ...overrides,
  };
}

function proposalRow(overrides: Record<string, any> = {}) {
  return {
    id: PROPOSAL_ID,
    ticket_type: 'proposal',
    active: true,
    updated_at: REV,
    crm_pipeline_stage: 'proposal_sent',
    internal_stage: 'drafting',
    type_details: {
      proposal_workspace: { stages: { pnl_pricing: { note: 'business value — must survive' } } },
    },
    ...overrides,
  };
}

const FIELD_ID = 't:pricing.scenarios.rows[].revenue';
const ROW_KEY = buildProvenanceKey(FIELD_ID, 'a1b2c3d4e5f60718');

function entry(overrides: Partial<ProvenanceEntryInput> = {}): ProvenanceEntryInput {
  return {
    key: ROW_KEY,
    document_id: 'doc-42',
    page_section: 'p. 12 §4.2',
    excerpt: 'Monthly volume: 1,500 pallets',
    extraction_ref: 'run-7/item-3',
    confidence: 0.92,
    ...overrides,
  };
}

const updateCalls = () => calls.filter((c) => c.table === 'commercial_tickets' && c.op === 'update');

beforeEach(() => {
  calls.length = 0;
  state.row = tenderRow();
  state.readQueue = [];
  state.readError = null;
  state.updateError = null;
  state.updateMatchesNothing = false;
  state.corruptEntryKey = null;
  state.revCounter = 0;
});

describe('buildProvenanceKey', () => {
  it('a plain field id passes through unchanged', () => {
    expect(buildProvenanceKey(FIELD_ID)).toBe(FIELD_ID);
  });

  it('a fingerprint is appended with "#" (repeated-row key, pin P5)', () => {
    expect(buildProvenanceKey(FIELD_ID, 'ff00ff00ff00ff00')).toBe(`${FIELD_ID}#ff00ff00ff00ff00`);
  });
});

describe('recordProvenance — saved path', () => {
  it("saves for a tender: guarded filters, actor + injected clock stamped, revision returned", async () => {
    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('saved');
    expect(result.revision).toBe('rev-1');

    // Exact identity + ticket_type + active + in-call revision token reached the database.
    const update = updateCalls()[0];
    expect(update.filters).toEqual([
      ['id', TENDER_ID],
      ['ticket_type', 'tender'],
      ['active', true],
      ['updated_at', REV],
    ]);

    // The stored entry carries the caller details plus the writer stamps.
    expect(result.entries?.[ROW_KEY]).toEqual({
      document_id: 'doc-42',
      page_section: 'p. 12 §4.2',
      excerpt: 'Monthly volume: 1,500 pallets',
      extraction_ref: 'run-7/item-3',
      confidence: 0.92,
      recorded_at: FIXED_NOW,
      actor: ACTOR,
    });
  });

  it('works identically for a proposal ticket (ticket_type parameterized)', async () => {
    state.row = proposalRow();

    const result = await recordProvenance(makeDeps(), {
      ticketId: PROPOSAL_ID,
      processKind: 'proposal',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [{ key: 'p:pnl_pricing.pnlVersions[].name', document_id: 'doc-9' }],
    });

    expect(result.status).toBe('saved');
    expect(updateCalls()[0].filters).toEqual([
      ['id', PROPOSAL_ID],
      ['ticket_type', 'proposal'],
      ['active', true],
      ['updated_at', REV],
    ]);
    expect(result.entries?.['p:pnl_pricing.pnlVersions[].name']).toEqual({
      document_id: 'doc-9',
      recorded_at: FIXED_NOW,
      actor: ACTOR,
    });
    // The proposal's business facet survives untouched.
    const details = updateCalls()[0].payload!.type_details as Record<string, any>;
    expect(details.proposal_workspace).toEqual({ stages: { pnl_pricing: { note: 'business value — must survive' } } });
  });

  it('preserves every OTHER type_details facet byte-identically (same object references)', async () => {
    const original = tenderRow();
    state.row = original;
    const originalDetails = original.type_details as Record<string, any>;
    const pricingJson = JSON.stringify(originalDetails.pricing);
    const readinessJson = JSON.stringify(originalDetails.submission_readiness);

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });
    expect(result.status).toBe('saved');

    const written = updateCalls()[0].payload!.type_details as Record<string, any>;
    // Byte-identical: the sidecar carries the EXACT stored objects over.
    expect(written.pricing).toBe(originalDetails.pricing);
    expect(written.submission_readiness).toBe(originalDetails.submission_readiness);
    expect(JSON.stringify(written.pricing)).toBe(pricingJson);
    expect(JSON.stringify(written.submission_readiness)).toBe(readinessJson);
    // The ONLY structural difference is the provenance facet.
    expect(Object.keys(written).sort()).toEqual(
      [...Object.keys(originalDetails), PROVENANCE_FACET_KEY].sort(),
    );
  });

  it('merges at ENTRY-KEY granularity: other entries preserved, same key replaced, sibling fingerprints kept', async () => {
    const untouched = { excerpt: 'kept', recorded_at: '2026-08-01T00:00:00.000Z', actor: 'earlier.run' };
    const siblingRow = { excerpt: 'row f1', recorded_at: '2026-08-01T00:00:00.000Z', actor: 'earlier.run' };
    state.row = tenderRow({
      type_details: {
        pricing: { summary: { note: 'survives' } },
        [PROVENANCE_FACET_KEY]: {
          't:overview.title': { excerpt: 'old title source', recorded_at: '2026-08-01T00:00:00.000Z', actor: 'earlier.run' },
          't:overview.customer': untouched,
          [buildProvenanceKey(FIELD_ID, 'f1f1f1f1f1f1f1f1')]: siblingRow,
        },
      },
    });

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [
        { key: 't:overview.title', excerpt: 'new title source' },
        { key: buildProvenanceKey(FIELD_ID, 'f2f2f2f2f2f2f2f2'), excerpt: 'row f2' },
      ],
    });
    expect(result.status).toBe('saved');

    const facet = (updateCalls()[0].payload!.type_details as Record<string, any>)[PROVENANCE_FACET_KEY];
    // Entries not in this request survive verbatim.
    expect(facet['t:overview.customer']).toBe(untouched);
    expect(facet[buildProvenanceKey(FIELD_ID, 'f1f1f1f1f1f1f1f1')]).toBe(siblingRow);
    // The addressed key is replaced with the freshly stamped entry.
    expect(facet['t:overview.title']).toEqual({ excerpt: 'new title source', recorded_at: FIXED_NOW, actor: ACTOR });
    // The new sibling fingerprint is added alongside, not instead.
    expect(facet[buildProvenanceKey(FIELD_ID, 'f2f2f2f2f2f2f2f2')]).toEqual({ excerpt: 'row f2', recorded_at: FIXED_NOW, actor: ACTOR });
  });

  it('P9 tracker immunity: the payload is EXACTLY { type_details } and never names either tracker', async () => {
    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });
    expect(result.status).toBe('saved');

    const update = updateCalls()[0];
    expect(Object.keys(update.payload!)).toEqual(['type_details']);
    const payloadJson = JSON.stringify(update.payload);
    expect(payloadJson).not.toContain('crm_pipeline_stage');
    expect(payloadJson).not.toContain('internal_stage');
    // The stored trackers are untouched after the save.
    expect(state.row!.crm_pipeline_stage).toBe('qualified');
    expect(state.row!.internal_stage).toBe('solution_design');
  });
});

describe('recordProvenance — stale and zero-row disambiguation', () => {
  it("a stale expectedRevision refuses with 'stale' and ZERO writes", async () => {
    state.row = tenderRow({ updated_at: 'rev-moved' });

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('stale');
    expect(result.revision).toBe('rev-moved');
    expect(result.error).toContain('retry');
    expect(updateCalls()).toHaveLength(0);
    expect((state.row!.type_details as Record<string, any>)[PROVENANCE_FACET_KEY]).toBeUndefined();
  });

  it("zero-row update + vanished row → 'not_found'", async () => {
    state.updateMatchesNothing = true;
    state.readQueue = [tenderRow(), null];

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('not_found');
    expect(result.error).toContain('not found');
  });

  it("zero-row update + moved revision → 'stale' with the current token", async () => {
    state.updateMatchesNothing = true;
    state.readQueue = [tenderRow(), tenderRow({ updated_at: 'rev-moved' })];

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('stale');
    expect(result.revision).toBe('rev-moved');
    expect(result.error).toContain('retry');
  });

  it("zero-row update + unchanged revision → honest 'failed' (affected no row)", async () => {
    state.updateMatchesNothing = true;
    state.readQueue = [tenderRow(), tenderRow()];

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('affected no row');
  });

  it('a database update error surfaces verbatim as failed', async () => {
    state.updateError = { message: 'permission denied for table commercial_tickets' };

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('permission denied');
  });
});

describe('recordProvenance — read-back verification', () => {
  it("a stored entry that does not match what was written → 'failed', never a silent 'saved'", async () => {
    state.corruptEntryKey = ROW_KEY;

    const result = await recordProvenance(makeDeps(), {
      ticketId: TENDER_ID,
      processKind: 'tender',
      expectedRevision: REV,
      actor: ACTOR,
      entries: [entry()],
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('read-back mismatch');
    expect(result.error).toContain(ROW_KEY);
  });
});

describe('recordProvenance — refusals before any client call', () => {
  const base = {
    ticketId: TENDER_ID,
    processKind: 'tender' as const,
    expectedRevision: REV,
    actor: ACTOR,
  };

  it('an empty entries list is refused', async () => {
    const result = await recordProvenance(makeDeps(), { ...base, entries: [] });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('at least one entry');
    expect(calls).toHaveLength(0);
  });

  it('a blank entry key is refused', async () => {
    const result = await recordProvenance(makeDeps(), { ...base, entries: [entry({ key: '   ' })] });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('non-empty key');
    expect(calls).toHaveLength(0);
  });

  it('duplicate keys in one request are refused (ambiguous merge)', async () => {
    const result = await recordProvenance(makeDeps(), { ...base, entries: [entry(), entry()] });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('duplicate key');
    expect(calls).toHaveLength(0);
  });

  it('a blank actor is refused — every entry must be attributable', async () => {
    const result = await recordProvenance(makeDeps(), { ...base, actor: ' ', entries: [entry()] });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('acting user');
    expect(calls).toHaveLength(0);
  });

  it('a non-numeric confidence is refused', async () => {
    const result = await recordProvenance(makeDeps(), {
      ...base,
      entries: [entry({ confidence: Number.NaN })],
    });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('confidence');
    expect(calls).toHaveLength(0);
  });
});

describe('readProvenance', () => {
  it('returns the stored entries verbatim plus the revision token', async () => {
    const stored = { [ROW_KEY]: { excerpt: 'stored', recorded_at: FIXED_NOW, actor: ACTOR } };
    state.row = tenderRow({
      type_details: { pricing: { summary: {} }, [PROVENANCE_FACET_KEY]: stored },
    });

    const result = await readProvenance(makeDeps(), TENDER_ID, 'tender');

    expect(result.status).toBe('found');
    expect(result.entries).toBe(stored);
    expect(result.revision).toBe(REV);
  });

  it('a ticket without the facet reads as found with zero entries', async () => {
    const result = await readProvenance(makeDeps(), TENDER_ID, 'tender');
    expect(result.status).toBe('found');
    expect(result.entries).toEqual({});
    expect(result.revision).toBe(REV);
  });

  it('reads for a proposal filter on ticket_type=proposal', async () => {
    state.row = proposalRow();
    const result = await readProvenance(makeDeps(), PROPOSAL_ID, 'proposal');
    expect(result.status).toBe('found');
    expect(calls[0].filters).toEqual([
      ['id', PROPOSAL_ID],
      ['ticket_type', 'proposal'],
      ['active', true],
    ]);
  });

  it("an unknown ticket id → 'not_found'", async () => {
    const result = await readProvenance(makeDeps(), 'c9f00000-0000-4000-8000-0000not0here', 'tender');
    expect(result.status).toBe('not_found');
  });

  it("a database read error → 'failed' with the honest message", async () => {
    state.readError = { message: 'connection reset' };
    const result = await readProvenance(makeDeps(), TENDER_ID, 'tender');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('connection reset');
  });
});
