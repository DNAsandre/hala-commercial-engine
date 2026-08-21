/**
 * tender-submission-readiness.test.ts — TCW-T1 (Tender Functional Closure Wave).
 *
 * Guards the P1 Submission Readiness register write layer:
 *   - `updateTenderSubmissionReadinessData` (full-section writer) and the three
 *     per-item operations (`updatePlaceholderStatus` / `updateRequiredDocStatus`
 *     / `updateComplianceStatus`) write ONLY
 *     `type_details.submission_readiness` through the guarded store, exact
 *     tender id, `updated_at` revision-protected, read-back confirmed.
 *   - Per-item operations target EXACTLY one row by exact id; a wrong id is an
 *     honest failure with zero writes; sibling rows/sections/type_details keys
 *     are byte-preserved.
 *   - Zero-row updates are failures. Stale revisions refuse non-destructively.
 *   - P3: the audit append is awaited; failure → success:true +
 *     status 'saved_with_audit_warning' (primary already saved).
 *
 * MOCK CONTRACT (house standard, bot-admin.test.ts / intake-save.test.ts): the
 * stub records table, operation, payload, filters and the exact `select`
 * projection reaching the database, and ENFORCES projections — only requested
 * columns come back. Extension for this suite: the commercial_tickets row is
 * STATEFUL and the update stub ENFORCES the `.eq('updated_at', …)` predicate
 * exactly like PostgREST (a mismatched token matches zero rows), so the
 * optimistic-lock behaviour under test is real, not simulated by fiat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface RecordedCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  payload: Record<string, any> | null;
  filters: Array<[string, unknown]>;
  projection: string | null;
  terminal: 'list' | 'maybeSingle' | null;
}

const calls: RecordedCall[] = [];

const state = {
  /** Current stored commercial_tickets row (the database truth). */
  row: null as Record<string, any> | null,
  readError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  /** Force the update to match no row regardless of token (RLS-style block). */
  updateMatchesNothing: false,
  insertError: null as { message: string } | null,
  insertMatchesNothing: false,
  /**
   * When set, the update stub applies the patch but then CORRUPTS the stored
   * row through this function before returning it — simulating a database that
   * acknowledged the write yet stored something else. Exercises the writer's
   * read-back comparison.
   */
  corruptStoredRowAfterUpdate: null as ((row: Record<string, any>) => Record<string, any>) | null,
  revCounter: 0,
};

/** ENFORCED projection: only requested columns come back; `*` passes through. */
function projectRows(data: unknown, projection: string | null): unknown {
  if (data === null || data === undefined || !projection) return data;
  const wanted = projection.split(',').map(c => c.trim()).filter(Boolean);
  if (wanted.some(c => c.startsWith('*'))) return data;
  const pick = (row: Record<string, any>) =>
    Object.fromEntries(wanted.filter(c => c in row).map(c => [c, row[c]]));
  return Array.isArray(data) ? (data as Array<Record<string, any>>).map(pick) : pick(data as Record<string, any>);
}

function nextRevision(): string {
  return `rev-${++state.revCounter}`;
}

function makeBuilder(table: string) {
  const call: RecordedCall = { table, op: 'select', payload: null, filters: [], projection: null, terminal: null };
  calls.push(call);

  const settle = () => {
    if (call.op === 'insert') {
      if (state.insertError) return { data: null, error: state.insertError };
      if (state.insertMatchesNothing) return { data: null, error: null };
      return { data: projectRows({ id: 'audit-row-1', ...(call.payload ?? {}) }, call.projection), error: null };
    }
    if (call.op === 'update') {
      if (state.updateError) return { data: null, error: state.updateError };
      if (state.updateMatchesNothing || !state.row) return { data: null, error: null };
      // PostgREST semantics: EVERY .eq() must match the stored row or zero rows update.
      const tokenFilter = call.filters.find(([column]) => column === 'updated_at');
      if (tokenFilter && tokenFilter[1] !== state.row.updated_at) return { data: null, error: null };
      const idFilter = call.filters.find(([column]) => column === 'id');
      if (idFilter && idFilter[1] !== state.row.id) return { data: null, error: null };
      state.row = { ...state.row, ...(call.payload ?? {}), updated_at: nextRevision() };
      if (state.corruptStoredRowAfterUpdate) state.row = state.corruptStoredRowAfterUpdate(state.row);
      return { data: projectRows(state.row, call.projection), error: null };
    }
    // select
    if (state.readError) return { data: null, error: state.readError };
    if (table === 'commercial_ticket_audit') return { data: projectRows([], call.projection), error: null };
    return { data: projectRows(state.row, call.projection), error: null };
  };

  const builder: any = {
    select: (cols?: string) => { call.projection = cols ?? '*'; return builder; },
    insert: (payload: Record<string, any>) => { call.op = 'insert'; call.payload = payload; return builder; },
    update: (patch: Record<string, any>) => { call.op = 'update'; call.payload = patch; return builder; },
    eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder; },
    order: () => { call.terminal = 'list'; return Promise.resolve(settle()); },
    maybeSingle: () => { call.terminal = 'maybeSingle'; return Promise.resolve(settle()); },
    then: (onFulfilled: any, onRejected?: any) => {
      call.terminal = call.terminal ?? 'list';
      return Promise.resolve(settle()).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

vi.mock('./supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

vi.mock('./auth-state', () => ({
  getCurrentUser: () => ({ id: 'session-user-7', name: 'Session Operator', email: '', role: 'admin', region: '' }),
}));

import {
  updateComplianceStatus,
  updatePlaceholderStatus,
  updateRequiredDocStatus,
  updateTenderSubmissionReadinessData,
} from './supabase-tender-actions';

const TENDER_ID = 'c9f00000-0000-4000-8000-00000000tcw1';
const REV = 'rev-base';

/** A stored register with rows in every section plus sibling data to preserve. */
function storedRegister() {
  return {
    // Unknown facet-level key: must survive every register write verbatim.
    facet_note: 'human annotation',
    placeholders: [
      { id: 'ph-1', label: 'Bid validity period', status: 'pending', value: '', owner: 'Amin', notes: '', updated_at: '2026-08-19T09:00:00Z', updated_by: 'Amin' },
      { id: 'ph-2', label: 'Bank guarantee reference', status: 'in_progress', value: 'draft-ref', updated_at: '2026-08-19T09:00:00Z', updated_by: 'Amin' },
    ],
    required_documents: [
      { id: 'rd-1', document_name: 'Commercial registration', status: 'missing', linked_document_id: '', updated_at: '2026-08-19T09:00:00Z', updated_by: 'Amin' },
    ],
    compliance_items: [
      { id: 'ci-1', requirement: 'ADR-certified drivers', status: 'pending', evidence: '', source_reference: 'RFQ §4.2', updated_at: '2026-08-19T09:00:00Z', updated_by: 'Amin' },
      // Malformed sibling row (no id): unreachable for item ops, but an
      // unrelated save must never destroy it.
      { requirement: 'legacy row without id', status: 'pending' },
    ],
  };
}

function storedRow(overrides: Record<string, any> = {}) {
  return {
    id: TENDER_ID,
    ticket_type: 'tender',
    active: true,
    updated_at: REV,
    ticket_title: 'TCW UAT Tender',
    type_details: {
      sow_data: { scope_summary: 'unrelated facet — must survive' },
      submission_readiness: storedRegister(),
    },
    ...overrides,
  };
}

const updateCalls = () => calls.filter(c => c.table === 'commercial_tickets' && c.op === 'update');
const auditInserts = () => calls.filter(c => c.table === 'commercial_ticket_audit' && c.op === 'insert');
const storedFacet = () => (state.row!.type_details as Record<string, any>).submission_readiness as Record<string, any>;

beforeEach(() => {
  calls.length = 0;
  state.row = storedRow();
  state.readError = null;
  state.updateError = null;
  state.updateMatchesNothing = false;
  state.insertError = null;
  state.insertMatchesNothing = false;
  state.corruptStoredRowAfterUpdate = null;
  state.revCounter = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────
// updateTenderSubmissionReadinessData — full-section writer (P1)
// ─────────────────────────────────────────────────────────────

describe('updateTenderSubmissionReadinessData — section writer', () => {
  it('replaces ONE section, preserves sibling sections, unknown facet keys and other type_details keys, and confirms by read-back', async () => {
    const rows = [
      { id: 'rd-1', document_name: 'Commercial registration', status: 'uploaded', linked_document_id: 'doc-9', updated_at: '2026-08-20T10:00:00Z', updated_by: 'Amin' },
      { id: 'rd-2', document_name: 'VAT certificate', status: 'missing' },
    ];

    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'required_documents', rows, 'UAT row add');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const update = updateCalls()[0];
    expect(update).toBeDefined();
    // Exact identity + revision guard reached the database.
    expect(update.filters).toEqual([
      ['id', TENDER_ID],
      ['ticket_type', 'tender'],
      ['active', true],
      ['updated_at', REV],
    ]);

    const writtenDetails = update.payload!.type_details as Record<string, any>;
    // Other type_details keys preserved.
    expect(writtenDetails.sow_data).toEqual({ scope_summary: 'unrelated facet — must survive' });
    const writtenFacet = writtenDetails.submission_readiness as Record<string, any>;
    // Sibling sections + unknown facet key byte-preserved.
    expect(writtenFacet.facet_note).toBe('human annotation');
    expect(writtenFacet.placeholders).toEqual(storedRegister().placeholders);
    expect(writtenFacet.compliance_items).toEqual(storedRegister().compliance_items);
    // The written section: caller rows, with missing stamps filled in.
    expect(writtenFacet.required_documents).toHaveLength(2);
    expect(writtenFacet.required_documents[0]).toMatchObject({ id: 'rd-1', status: 'uploaded', updated_by: 'Amin', updated_at: '2026-08-20T10:00:00Z' });
    expect(writtenFacet.required_documents[1]).toMatchObject({ id: 'rd-2', status: 'missing', updated_by: 'Session Operator' });
    expect(writtenFacet.required_documents[1].updated_at).toBeTruthy();

    // Stored truth moved (the mock applied the update to the row).
    expect(storedFacet().required_documents.map((r: any) => r.id)).toEqual(['rd-1', 'rd-2']);
  });

  it('refuses an unknown section, duplicate ids, a missing name field and an out-of-union status — before any write', async () => {
    const bad: Array<[string, any[]]> = [
      ['duplicate id "rd-1"', [{ id: 'rd-1', document_name: 'A', status: 'missing' }, { id: 'rd-1', document_name: 'B', status: 'missing' }]],
      ['has no document name', [{ id: 'rd-9', document_name: '', status: 'missing' }]],
      ['not one of', [{ id: 'rd-9', document_name: 'X', status: 'totally_bogus' }]],
      ['has no id', [{ document_name: 'X', status: 'missing' }]],
    ];
    for (const [needle, rows] of bad) {
      calls.length = 0;
      const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'required_documents', rows);
      expect(result.success, needle).toBe(false);
      expect(result.error, needle).toContain(needle);
      expect(updateCalls(), needle).toHaveLength(0);
    }

    const unknownSection = await updateTenderSubmissionReadinessData(TENDER_ID, 'not_a_section' as any, []);
    expect(unknownSection.success).toBe(false);
    expect(unknownSection.error).toContain('Unknown submission readiness section');
  });

  it('zero-row update = FAILURE with an honest reason (a resolved request is not proof)', async () => {
    state.updateMatchesNothing = true;

    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'placeholders', [
      { id: 'ph-1', label: 'Bid validity period', status: 'approved' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('affected no row');
    // The stored register is unchanged.
    expect(storedFacet().placeholders[0].status).toBe('pending');
    // No audit row was attempted for an unconfirmed save.
    expect(auditInserts()).toHaveLength(0);
  });

  it("stale expectedRevision → status 'stale', NON-destructive: no update reaches the database", async () => {
    const result = await updateTenderSubmissionReadinessData(
      TENDER_ID,
      'placeholders',
      [{ id: 'ph-1', label: 'Bid validity period', status: 'approved' }],
      { expectedRevision: 'rev-someone-elses-read' },
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('stale');
    expect(result.error).toContain('retry');
    expect(updateCalls()).toHaveLength(0);
    expect(storedFacet().placeholders[0].status).toBe('pending');
  });

  it("audit append failure → success:true with status 'saved_with_audit_warning' and the real reason (primary already saved)", async () => {
    state.insertError = { message: 'new row violates row-level security policy for table "commercial_ticket_audit"' };

    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'placeholders', [
      { id: 'ph-1', label: 'Bid validity period', status: 'approved' },
    ]);

    expect(result.success).toBe(true);
    expect(result.status).toBe('saved_with_audit_warning');
    expect(result.auditWarning).toContain('audit entry was not recorded');
    expect(result.auditWarning).toContain('row-level security');
    // The primary write really happened.
    expect(storedFacet().placeholders[0].status).toBe('approved');
  });

  it('an unconfirmed audit insert (zero rows back) is also surfaced as the audit warning', async () => {
    state.insertMatchesNothing = true;

    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'placeholders', [
      { id: 'ph-1', label: 'Bid validity period', status: 'approved' },
    ]);

    expect(result.success).toBe(true);
    expect(result.status).toBe('saved_with_audit_warning');
    expect(result.auditWarning).toContain('no stored row');
  });

  it('appends a confirmed pipe-format audit note with the session actor after a clean save', async () => {
    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'compliance_items', [
      { id: 'ci-1', requirement: 'ADR-certified drivers', status: 'compliant' },
    ]);

    expect(result).toEqual({ success: true });
    const insert = auditInserts()[0];
    expect(insert).toBeDefined();
    expect(insert.payload!.ticket_id).toBe(TENDER_ID);
    expect(insert.payload!.field_changed).toBe('submission_readiness.compliance_items');
    expect(insert.payload!.user_name).toBe('Session Operator');
    expect(insert.payload!.notes).toContain('Submission readiness updated | compliance_items | 1 rows');
    // The stored id is selected back — confirmation, not fire-and-forget.
    expect(insert.projection).toBe('id');
  });
});

// ─────────────────────────────────────────────────────────────
// Per-item operations — exact id targeting (P1)
// ─────────────────────────────────────────────────────────────

describe('updatePlaceholderStatus — one row by exact id', () => {
  it('mutates ONLY the target row (status + value + stamp) and preserves every sibling byte', async () => {
    const result = await updatePlaceholderStatus(TENDER_ID, 'ph-2', 'Bank guarantee reference', 'in_progress', 'approved', 'BG-2026-114');

    expect(result).toEqual({ success: true });

    const update = updateCalls()[0];
    const facet = (update.payload!.type_details as Record<string, any>).submission_readiness;
    const [ph1, ph2] = facet.placeholders;
    // Sibling row untouched, byte-for-byte.
    expect(ph1).toEqual(storedRegister().placeholders[0]);
    // Target row: exactly the requested change + honest stamp.
    expect(ph2).toMatchObject({ id: 'ph-2', status: 'approved', value: 'BG-2026-114', updated_by: 'Session Operator' });
    expect(ph2.updated_at).not.toBe('2026-08-19T09:00:00Z');
    // Sibling sections + unknown facet key + other type_details keys preserved.
    expect(facet.required_documents).toEqual(storedRegister().required_documents);
    expect(facet.compliance_items).toEqual(storedRegister().compliance_items);
    expect(facet.facet_note).toBe('human annotation');
    expect((update.payload!.type_details as Record<string, any>).sow_data).toEqual({ scope_summary: 'unrelated facet — must survive' });
  });

  it('a wrong id is an HONEST failure naming the id — and nothing is written', async () => {
    const result = await updatePlaceholderStatus(TENDER_ID, 'ph-does-not-exist', 'Ghost', 'pending', 'approved');

    expect(result.success).toBe(false);
    expect(result.error).toContain('ph-does-not-exist');
    expect(result.error).toContain('Nothing was changed');
    expect(updateCalls()).toHaveLength(0);
    expect(storedFacet().placeholders.map((r: any) => r.status)).toEqual(['pending', 'in_progress']);
  });

  it('refuses a status outside the placeholder union before any read or write', async () => {
    const result = await updatePlaceholderStatus(TENDER_ID, 'ph-1', 'Bid validity period', 'pending', 'drafted');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not a valid Placeholder status');
    expect(result.error).toContain('pending, in_progress, approved, na');
    expect(calls).toHaveLength(0);
  });

  it("stale expectedRevision refuses non-destructively with status 'stale'", async () => {
    const result = await updatePlaceholderStatus(
      TENDER_ID, 'ph-1', 'Bid validity period', 'pending', 'approved', undefined,
      { expectedRevision: 'rev-old-tab' },
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('stale');
    expect(updateCalls()).toHaveLength(0);
    expect(storedFacet().placeholders[0].status).toBe('pending');
  });
});

describe('updateRequiredDocStatus — one row by exact id', () => {
  it('happy path: payload + read-back confirmed', async () => {
    const result = await updateRequiredDocStatus(TENDER_ID, 'rd-1', 'Commercial registration', 'missing', 'uploaded');

    expect(result).toEqual({ success: true });
    expect(storedFacet().required_documents[0]).toMatchObject({ id: 'rd-1', status: 'uploaded', updated_by: 'Session Operator' });

    const insert = auditInserts()[0];
    expect(insert.payload!.notes).toContain('Required document status changed | Commercial registration | missing → uploaded');
  });

  it('zero-row update = failure, register untouched', async () => {
    state.updateMatchesNothing = true;

    const result = await updateRequiredDocStatus(TENDER_ID, 'rd-1', 'Commercial registration', 'missing', 'uploaded');

    expect(result.success).toBe(false);
    expect(result.error).toContain('affected no row');
    expect(storedFacet().required_documents[0].status).toBe('missing');
  });

  it('wrong id: honest failure, sibling rows untouched, no write', async () => {
    const result = await updateRequiredDocStatus(TENDER_ID, 'rd-404', 'Ghost doc', 'missing', 'uploaded');

    expect(result.success).toBe(false);
    expect(result.error).toContain('rd-404');
    expect(updateCalls()).toHaveLength(0);
  });
});

describe('updateComplianceStatus — one row by exact id', () => {
  it('sets status + evidence on the target row only; the malformed legacy sibling row survives verbatim', async () => {
    const result = await updateComplianceStatus(
      TENDER_ID, 'ci-1', 'ADR-certified drivers', 'pending', 'compliant', 'ADR cert #7731 attached',
    );

    expect(result).toEqual({ success: true });

    const facetRows = storedFacet().compliance_items;
    expect(facetRows[0]).toMatchObject({ id: 'ci-1', status: 'compliant', evidence: 'ADR cert #7731 attached' });
    // The id-less legacy row was neither destroyed nor "repaired".
    expect(facetRows[1]).toEqual({ requirement: 'legacy row without id', status: 'pending' });
  });

  it('refuses a status outside the compliance union with the allowed list', async () => {
    const result = await updateComplianceStatus(TENDER_ID, 'ci-1', 'ADR-certified drivers', 'pending', 'approved');

    expect(result.success).toBe(false);
    expect(result.error).toContain('pending, in_review, compliant, non_compliant, na');
    expect(calls).toHaveLength(0);
  });

  it('read-back mismatch (database acknowledged but stored something else) = honest failure, not success', async () => {
    // The update resolves with a row, but the stored facet does NOT carry the
    // requested change — the writer's read-back comparison must refuse to call
    // that success.
    state.corruptStoredRowAfterUpdate = row => ({
      ...row,
      type_details: {
        ...(row.type_details as Record<string, any>),
        submission_readiness: {
          ...storedRegister(),
          compliance_items: [{ id: 'ci-1', requirement: 'ADR-certified drivers', status: 'pending', updated_at: 't', updated_by: 'u' }],
        },
      },
    });

    const result = await updateComplianceStatus(TENDER_ID, 'ci-1', 'ADR-certified drivers', 'pending', 'compliant');

    expect(result.success).toBe(false);
    expect(result.error).toContain('read back differently');
    // No audit entry is appended for an unconfirmed save.
    expect(auditInserts()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// Register writes when no facet exists yet
// ─────────────────────────────────────────────────────────────

describe('first write on a tender without the facet', () => {
  it('creates type_details.submission_readiness without clobbering existing type_details keys', async () => {
    state.row = storedRow({ type_details: { sow_data: { scope_summary: 'keep me' } } });

    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'placeholders', [
      { id: 'ph-new', label: 'Signature authority', status: 'pending' },
    ]);

    expect(result.success).toBe(true);
    const details = state.row!.type_details as Record<string, any>;
    expect(details.sow_data).toEqual({ scope_summary: 'keep me' });
    expect(details.submission_readiness.placeholders[0]).toMatchObject({ id: 'ph-new', status: 'pending' });
  });

  it('a per-item op on a tender with NO register rows reports the honest empty-register failure', async () => {
    state.row = storedRow({ type_details: {} });

    const result = await updatePlaceholderStatus(TENDER_ID, 'ph-1', 'Bid validity period', 'pending', 'approved');

    expect(result.success).toBe(false);
    expect(result.error).toContain('0 recorded');
    expect(updateCalls()).toHaveLength(0);
  });

  it('tender not found = honest failure, no write attempted', async () => {
    state.row = null;

    const result = await updateTenderSubmissionReadinessData(TENDER_ID, 'placeholders', [
      { id: 'ph-1', label: 'X', status: 'pending' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(updateCalls()).toHaveLength(0);
  });
});
