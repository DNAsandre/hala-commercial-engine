/**
 * orchestration-write-guard.test.ts — TCW-T1 (Tender Functional Closure Wave).
 *
 * Guards P2c: `writeOrchestrationState` (exercised through the public
 * createOrchestrationPackage API) carries the `updated_at` revision token it
 * just read into the UPDATE (`.eq('updated_at', token)`). A row changed by a
 * concurrent writer between the read and the update matches ZERO rows and the
 * call returns an honest stale/conflict error — never success, never a silent
 * last-write-wins over the other writer's data. A zero-row update whose
 * revision did NOT move is reported as the RLS-style block it is.
 *
 * No other orchestration behaviour is asserted to have changed: sibling
 * type_details buckets are still preserved verbatim and the review-only surface
 * stays review-only.
 *
 * MOCK CONTRACT (house standard, bot-admin.test.ts): records table / op /
 * payload / filters / projection, ENFORCES projections, and the stateful
 * update stub enforces every `.eq()` predicate exactly like PostgREST.
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
  /** One-shot hooks run AFTER each commercial_tickets select settles (FIFO; null = no-op). */
  selectHooks: [] as Array<(() => void) | null>,
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
      // Orchestration audit inserts are best-effort; always succeed here.
      return { data: projectRows({ id: 'audit-row-1', ...(call.payload ?? {}) }, call.projection), error: null };
    }
    if (call.op === 'update') {
      const asShape = (row: Record<string, any> | null) => {
        const projected = row ? projectRows(row, call.projection) : null;
        // PostgREST returns a LIST for a bare .select() terminal.
        return call.terminal === 'maybeSingle' ? projected : (projected ? [projected] : []);
      };
      if (state.updateError) return { data: null, error: state.updateError };
      if (state.updateMatchesNothing || !state.row) return { data: asShape(null), error: null };
      const tokenFilter = call.filters.find(([column]) => column === 'updated_at');
      if (tokenFilter && tokenFilter[1] !== state.row.updated_at) return { data: asShape(null), error: null };
      const idFilter = call.filters.find(([column]) => column === 'id');
      if (idFilter && idFilter[1] !== state.row.id) return { data: asShape(null), error: null };
      state.row = { ...state.row, ...(call.payload ?? {}), updated_at: `rev-${++state.revCounter}` };
      return { data: asShape(state.row), error: null };
    }
    // select
    const result = (() => {
      if (state.readError) return { data: null, error: state.readError };
      if (table === 'commercial_ticket_audit') return { data: projectRows([], call.projection), error: null };
      return { data: projectRows(state.row, call.projection), error: null };
    })();
    if (table === 'commercial_tickets') {
      const hook = state.selectHooks.shift();
      if (hook) hook();
    }
    return result;
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

import { createOrchestrationPackage } from './orchestration';

const TENDER_ID = 'c9f00000-0000-4000-8000-00000000tcw3';
const REV = 'rev-base';

function storedRow(overrides: Record<string, any> = {}) {
  return {
    id: TENDER_ID,
    ticket_type: 'tender',
    active: true,
    updated_at: REV,
    type_details: {
      sow_data: { scope_summary: 'must survive the orchestration merge' },
    },
    ...overrides,
  };
}

const updateCalls = () => calls.filter(c => c.table === 'commercial_tickets' && c.op === 'update');

beforeEach(() => {
  calls.length = 0;
  state.row = storedRow();
  state.readError = null;
  state.updateError = null;
  state.updateMatchesNothing = false;
  state.selectHooks = [];
  state.revCounter = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('writeOrchestrationState — updated_at revision guard (P2c)', () => {
  it('the UPDATE carries the exact revision token that was read, and succeeds when it still matches', async () => {
    const result = await createOrchestrationPackage(TENDER_ID, { package_name: 'Guard check pack' });

    expect(result.success).toBe(true);
    expect(result.data?.package_name).toBe('Guard check pack');

    const update = updateCalls()[0];
    expect(update).toBeDefined();
    expect(update.filters).toContainEqual(['id', TENDER_ID]);
    // The guard predicate reached the database.
    expect(update.filters).toContainEqual(['updated_at', REV]);
    // Sibling type_details buckets preserved verbatim (unchanged behaviour).
    const details = update.payload!.type_details as Record<string, any>;
    expect(details.sow_data).toEqual({ scope_summary: 'must survive the orchestration merge' });
    expect(details.orchestration.packages).toHaveLength(1);
  });

  it('a concurrent edit between the read and the update → zero rows → honest stale error, NOT success, nothing overwritten', async () => {
    // The concurrent writer lands right after writeOrchestrationState's own
    // read (the second commercial_tickets select) settles.
    state.selectHooks = [null, () => {
      state.row = {
        ...state.row!,
        updated_at: 'rev-moved-by-concurrent-writer',
        type_details: { ...(state.row!.type_details as Record<string, any>), concurrent_edit: { by: 'someone else' } },
      };
    }];

    const result = await createOrchestrationPackage(TENDER_ID, { package_name: 'Losing pack' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('changed while this orchestration write was in flight');
    expect(result.error).toContain('Nothing was overwritten');

    // The update was attempted with the OLD token — and matched nothing.
    const update = updateCalls()[0];
    expect(update.filters).toContainEqual(['updated_at', REV]);
    // The concurrent writer's data is intact: no silent last-write-wins.
    const details = state.row!.type_details as Record<string, any>;
    expect(details.concurrent_edit).toEqual({ by: 'someone else' });
    expect(details.orchestration).toBeUndefined();
    expect(state.row!.updated_at).toBe('rev-moved-by-concurrent-writer');
  });

  it('a zero-row update whose revision did NOT move is reported as a possible RLS block, not as stale', async () => {
    state.updateMatchesNothing = true;

    const result = await createOrchestrationPackage(TENDER_ID, { package_name: 'Blocked pack' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no rows affected');
    expect(result.error).toContain('RLS');
    expect((state.row!.type_details as Record<string, any>).orchestration).toBeUndefined();
  });

  it('a row without an updated_at token is refused rather than written unguarded', async () => {
    state.row = storedRow({ updated_at: '' });

    const result = await createOrchestrationPackage(TENDER_ID, { package_name: 'Unguarded pack' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('refusing an unguarded orchestration write');
    expect(updateCalls()).toHaveLength(0);
  });

  it('a failing initial read is an error, never a write', async () => {
    state.readError = { message: 'permission denied for table commercial_tickets' };

    const result = await createOrchestrationPackage(TENDER_ID, { package_name: 'Unreadable pack' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(updateCalls()).toHaveLength(0);
  });
});
