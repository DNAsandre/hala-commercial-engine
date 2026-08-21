/**
 * tender-facet-writers.test.ts — TCW-T1 (Tender Functional Closure Wave).
 *
 * Guards the P2 write-layer corrections on supabase-tender-actions.ts:
 *   - P2a/P2b: the 7 whole-facet writers (sow_data, customer_fit_data,
 *     sow_qualification_data, technical_qualification_data, risk_snapshot_data,
 *     bid_no_bid_data, solution_design_data) are PATCH-MERGE — the stored facet
 *     is read first and `{ ...currentFacet, ...patch }` is written; a tab sends
 *     ONLY its own keys and can never clobber a sibling tab's keys or any other
 *     type_details key. `expectedRevision` refusal is non-destructive.
 *     The legacy string third argument (reason) still compiles and works.
 *   - P2d: updateTenderCrmStage refuses values the read layer cannot restore.
 *   - P3: the audit append is awaited; failure surfaces as
 *     status 'saved_with_audit_warning' on a still-successful save.
 *   - P4: updateBlockReviewStatus records the SESSION user as reviewer by
 *     default — never the literal "System".
 *
 * MOCK CONTRACT (house standard, bot-admin.test.ts): records table / op /
 * payload / filters / projection and ENFORCES projections. The
 * commercial_tickets row is stateful and the update stub enforces the
 * `.eq('updated_at', …)` predicate exactly like PostgREST.
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
  row: null as Record<string, any> | null,
  readError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  updateMatchesNothing: false,
  insertError: null as { message: string } | null,
  insertMatchesNothing: false,
  revCounter: 0,
};

function projectRows(data: unknown, projection: string | null): unknown {
  if (data === null || data === undefined || !projection) return data;
  const wanted = projection.split(',').map(c => c.trim()).filter(Boolean);
  if (wanted.some(c => c.startsWith('*'))) return data;
  const pick = (row: Record<string, any>) =>
    Object.fromEntries(wanted.filter(c => c in row).map(c => [c, row[c]]));
  return Array.isArray(data) ? (data as Array<Record<string, any>>).map(pick) : pick(data as Record<string, any>);
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
      const tokenFilter = call.filters.find(([column]) => column === 'updated_at');
      if (tokenFilter && tokenFilter[1] !== state.row.updated_at) return { data: null, error: null };
      const idFilter = call.filters.find(([column]) => column === 'id');
      if (idFilter && idFilter[1] !== state.row.id) return { data: null, error: null };
      state.row = { ...state.row, ...(call.payload ?? {}), updated_at: `rev-${++state.revCounter}` };
      return { data: projectRows(state.row, call.projection), error: null };
    }
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
  updateBlockReviewStatus,
  updateTenderBidNoBidData,
  updateTenderCrmStage,
  updateTenderCustomerFitData,
  updateTenderPricingData,
  updateTenderRiskSnapshotData,
  updateTenderSolutionDesignData,
  updateTenderSowData,
  updateTenderSowQualificationData,
  updateTenderTechnicalQualificationData,
} from './supabase-tender-actions';

const TENDER_ID = 'c9f00000-0000-4000-8000-00000000tcw2';
const REV = 'rev-base';

function storedRow(overrides: Record<string, any> = {}) {
  return {
    id: TENDER_ID,
    ticket_type: 'tender',
    active: true,
    updated_at: REV,
    ticket_title: 'TCW UAT Tender',
    crm_pipeline_stage: 'qualified',
    internal_stage: 'solution_design',
    type_details: {
      // Sibling type_details key every facet write must preserve.
      pricing: { summary: { note: 'unrelated pricing — must survive' } },
    },
    ...overrides,
  };
}

const updateCalls = () => calls.filter(c => c.table === 'commercial_tickets' && c.op === 'update');
const auditInserts = () => calls.filter(c => c.table === 'commercial_ticket_audit' && c.op === 'insert');

beforeEach(() => {
  calls.length = 0;
  state.row = storedRow();
  state.readError = null;
  state.updateError = null;
  state.updateMatchesNothing = false;
  state.insertError = null;
  state.insertMatchesNothing = false;
  state.revCounter = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────
// P2a/P2b — the 7 whole-facet writers are PATCH-MERGE
// ─────────────────────────────────────────────────────────────

const SEVEN_WRITERS: Array<{
  name: string;
  facet: string;
  fn: (tenderId: string, patch: Record<string, any>, reasonOrOpts?: any) => Promise<any>;
}> = [
  { name: 'updateTenderSowData', facet: 'sow_data', fn: updateTenderSowData },
  { name: 'updateTenderCustomerFitData', facet: 'customer_fit_data', fn: updateTenderCustomerFitData },
  { name: 'updateTenderSowQualificationData', facet: 'sow_qualification_data', fn: updateTenderSowQualificationData },
  { name: 'updateTenderTechnicalQualificationData', facet: 'technical_qualification_data', fn: updateTenderTechnicalQualificationData },
  { name: 'updateTenderRiskSnapshotData', facet: 'risk_snapshot_data', fn: updateTenderRiskSnapshotData },
  { name: 'updateTenderBidNoBidData', facet: 'bid_no_bid_data', fn: updateTenderBidNoBidData },
  { name: 'updateTenderSolutionDesignData', facet: 'solution_design_data', fn: updateTenderSolutionDesignData },
];

describe('the 7 facet writers — patch-merge, never whole-replace (P2b)', () => {
  for (const writer of SEVEN_WRITERS) {
    it(`${writer.name}: preserves sibling keys inside ${writer.facet} AND other type_details keys`, async () => {
      state.row = storedRow({
        type_details: {
          pricing: { summary: { note: 'unrelated pricing — must survive' } },
          [writer.facet]: {
            other_tab_key: { kept: true, detail: 'another tab wrote me' },
            my_tab_key: { old: true },
          },
        },
      });

      const result = await writer.fn(TENDER_ID, { my_tab_key: { fresh: 'value' } }, 'patch-merge check');

      expect(result.success, writer.name).toBe(true);

      const update = updateCalls()[0];
      expect(update, writer.name).toBeDefined();
      // Exact identity + in-call revision token reached the database.
      expect(update.filters, writer.name).toEqual([
        ['id', TENDER_ID],
        ['ticket_type', 'tender'],
        ['active', true],
        ['updated_at', REV],
      ]);

      const details = update.payload!.type_details as Record<string, any>;
      // The facet was MERGED: the other tab's key survives, mine is replaced.
      expect(details[writer.facet], writer.name).toEqual({
        other_tab_key: { kept: true, detail: 'another tab wrote me' },
        my_tab_key: { fresh: 'value' },
      });
      // Sibling type_details keys survive.
      expect(details.pricing, writer.name).toEqual({ summary: { note: 'unrelated pricing — must survive' } });
    });
  }

  it('the legacy string third argument (reason) still works and lands in the audit note', async () => {
    const result = await updateTenderSowData(TENDER_ID, { scope_summary: 'captured' }, 'Manual SOW capture');

    expect(result).toEqual({ success: true });
    const insert = auditInserts()[0];
    expect(insert.payload!.notes).toContain('Reason: Manual SOW capture');
    expect(insert.payload!.user_name).toBe('Session Operator');
  });

  it("opts.expectedRevision stale → status 'stale', non-destructive: no update reaches the database", async () => {
    const result = await updateTenderBidNoBidData(
      TENDER_ID,
      { win_strategy: { win_themes: ['price'] } },
      { expectedRevision: 'rev-another-tabs-read', reason: 'stale check' },
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('stale');
    expect(result.error).toContain('retry');
    expect(updateCalls()).toHaveLength(0);
    expect((state.row!.type_details as Record<string, any>).bid_no_bid_data).toBeUndefined();
  });

  it('a matching opts.expectedRevision writes normally', async () => {
    const result = await updateTenderRiskSnapshotData(
      TENDER_ID,
      { register: [{ id: 'r1', severity: 'High' }] },
      { expectedRevision: REV },
    );

    expect(result.success).toBe(true);
    expect(updateCalls()[0].filters).toContainEqual(['updated_at', REV]);
  });

  it('zero-row update = honest failure, stored facet untouched', async () => {
    state.updateMatchesNothing = true;

    const result = await updateTenderCustomerFitData(TENDER_ID, { dimensions: [] });

    expect(result.success).toBe(false);
    expect(result.error).toContain('affected no row');
    expect((state.row!.type_details as Record<string, any>).customer_fit_data).toBeUndefined();
    expect(auditInserts()).toHaveLength(0);
  });

  it('an empty patch is refused before any write', async () => {
    const result = await updateTenderSolutionDesignData(TENDER_ID, {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty');
    expect(updateCalls()).toHaveLength(0);
  });

  it("P3: audit append failure → success:true, status 'saved_with_audit_warning', primary saved", async () => {
    state.insertError = { message: 'permission denied for table commercial_ticket_audit' };

    const result = await updateTenderTechnicalQualificationData(TENDER_ID, { gaps: [] });

    expect(result.success).toBe(true);
    expect(result.status).toBe('saved_with_audit_warning');
    expect(result.auditWarning).toContain('permission denied');
    // Primary write really landed.
    expect((state.row!.type_details as Record<string, any>).technical_qualification_data).toEqual({ gaps: [] });
  });
});

// ─────────────────────────────────────────────────────────────
// Section-merge writers — expectedRevision pass-through (P2a)
// ─────────────────────────────────────────────────────────────

describe('updateTenderPricingData — expectedRevision pass-through', () => {
  it('threads the caller token into the guarded update', async () => {
    const result = await updateTenderPricingData(TENDER_ID, 'cost_inputs', { total: 100 }, 'priced', REV);

    expect(result.success).toBe(true);
    expect(updateCalls()[0].filters).toContainEqual(['updated_at', REV]);
    // Section-merge: the requested section carries exactly the written data.
    const pricing = (updateCalls()[0].payload!.type_details as Record<string, any>).pricing;
    expect(pricing.cost_inputs).toEqual({ total: 100 });
  });

  it("a stale caller token refuses with status 'stale' and writes nothing", async () => {
    const result = await updateTenderPricingData(TENDER_ID, 'cost_inputs', { total: 100 }, 'priced', 'rev-stale');

    expect(result.success).toBe(false);
    expect(result.status).toBe('stale');
    expect(updateCalls()).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// P2d — CRM stage round-trip validation
// ─────────────────────────────────────────────────────────────

describe('updateTenderCrmStage — refuses non-round-trippable values (P2d)', () => {
  it('refuses a spaced legacy spelling with the honest reason — before any read or write', async () => {
    const result = await updateTenderCrmStage(TENDER_ID, 'qualified', 'proposal sent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot restore');
    expect(result.error).toContain('proposal_sent');
    expect(calls).toHaveLength(0);
    expect(state.row!.crm_pipeline_stage).toBe('qualified');
  });

  it('refuses an unknown stage key', async () => {
    const result = await updateTenderCrmStage(TENDER_ID, 'qualified', 'not_a_stage');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not_a_stage');
    expect(calls).toHaveLength(0);
  });

  it('writes a restorable stage key normally', async () => {
    const result = await updateTenderCrmStage(TENDER_ID, 'qualified', 'actual_go_live');

    expect(result.success).toBe(true);
    expect(updateCalls()[0].payload).toEqual({ crm_pipeline_stage: 'actual_go_live' });
    expect(state.row!.crm_pipeline_stage).toBe('actual_go_live');
  });
});

// ─────────────────────────────────────────────────────────────
// P4 — reviewer defaults to the session user
// ─────────────────────────────────────────────────────────────

describe('updateBlockReviewStatus — actor truth (P4)', () => {
  const BLOCKS = [
    { id: 'blk-1', title: 'Executive summary' },
    { id: 'blk-2', title: 'Pricing narrative' },
  ];

  beforeEach(() => {
    state.row = storedRow({
      type_details: { tender_drafting: { proposal_blocks: BLOCKS, toc: ['keep'] } },
    });
  });

  it('records the SESSION user as reviewer when no name is given — never "System"', async () => {
    const result = await updateBlockReviewStatus(TENDER_ID, 'blk-2', 'ops', 'Approved', 'looks good');

    expect(result.success).toBe(true);
    const blocks = (updateCalls()[0].payload!.type_details as Record<string, any>).tender_drafting.proposal_blocks;
    const target = blocks.find((b: any) => b.id === 'blk-2');
    expect(target.ops_reviewer).toBe('Session Operator');
    expect(target.ops_status).toBe('Approved');
    expect(target.ops_reviewer).not.toBe('System');
    // Sibling block untouched.
    expect(blocks.find((b: any) => b.id === 'blk-1')).toEqual(BLOCKS[0]);
  });

  it('an explicitly provided reviewer name is used verbatim', async () => {
    await updateBlockReviewStatus(TENDER_ID, 'blk-1', 'finance', 'Rejected', 'numbers off', 'Named Reviewer');

    const blocks = (updateCalls()[0].payload!.type_details as Record<string, any>).tender_drafting.proposal_blocks;
    expect(blocks.find((b: any) => b.id === 'blk-1').finance_reviewer).toBe('Named Reviewer');
  });
});
