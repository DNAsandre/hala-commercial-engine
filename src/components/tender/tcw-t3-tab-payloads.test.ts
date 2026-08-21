/**
 * tcw-t3-tab-payloads.test.ts — TCW-T3 (Tender Functional Closure Wave).
 *
 * PAYLOAD DISCIPLINE for the stage 3–4 tabs: every tab's exported patch
 * builder emits ONLY that tab's own facet keys, and the tab-shaped write
 * (real writer + builder output + threaded revision token) reaches the
 * database as a guarded patch-merge that preserves every sibling key the tab
 * did not send. This is the defect class that silently reverted sibling tabs
 * before the wave (whole-facet page-load spreads — TOP-GAP 1).
 *
 * GUARD (lane-run, named): "GUARD: buildHopPatch emits ONLY the hop key".
 * Re-introduce a whole-facet spread / sibling key in buildHopPatch and this
 * test fails by name; restore and it passes.
 *
 * MOCK CONTRACT (house standard, tender-facet-writers.test.ts): records
 * table / op / payload / filters / projection, ENFORCES projections, and the
 * stateful commercial_tickets row enforces the `.eq('updated_at', …)`
 * predicate exactly like PostgREST.
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

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

vi.mock('@/lib/auth-state', () => ({
  getCurrentUser: () => ({ id: 'session-user-7', name: 'Session Operator', email: '', role: 'admin', region: '' }),
}));

import {
  updateTenderBidNoBidData,
  updateTenderSolutionDesignData,
} from '@/lib/supabase-tender-actions';
import { runTenderTabSave } from './IdentifiedStageShared';
import { buildBidDecisionPatch } from './BidDecisionTab';
import { buildWinStrategyPatch } from './WinStrategyTab';
import { buildResourceCommitmentPatch } from './ResourceCommitmentTab';
import { buildDecisionRecordPatch } from './DecisionRecordTab';
import { buildSolutionConfigurationPatch } from './SolutionConfigurationTab';
import { buildHopPatch } from './HOPOperationsModelTab';
import { buildHamPatch } from './HAMManpowerModelTab';
import { buildHipPatch } from './HIPSystemsIPModelTab';
import { buildScopeMatrixPatch } from './ScopeMatrixTab';
import { buildSlaKpiPatch } from './SLAKPIModelTab';
import { buildAssumptionsDependenciesPatch } from './AssumptionsDependenciesTab';

const TENDER_ID = 'c9f00000-0000-4000-8000-0000000000t3';
const REV = 'rev-base';

function storedRow(overrides: Record<string, any> = {}) {
  return {
    id: TENDER_ID,
    ticket_type: 'tender',
    active: true,
    updated_at: REV,
    ticket_title: 'TCW T3 Tender',
    crm_pipeline_stage: 'qualified',
    internal_stage: 'solution_design',
    type_details: {},
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
  state.insertError = null;
  state.insertMatchesNothing = false;
  state.revCounter = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// ─────────────────────────────────────────────────────────────
// Builders emit ONLY their own keys
// ─────────────────────────────────────────────────────────────

const rec = { readiness: 'Not Assessed' as const, notes: '' };

describe('bid/no-bid tab builders — own keys only (P2b tab key map)', () => {
  it('buildBidDecisionPatch → exactly {decision, decision_checklist, recommendation}', () => {
    const patch = buildBidDecisionPatch({ decision: 'Bid' } as any, [{ question: 'q' }] as any, { next_step: 'Hold' } as any);
    expect(Object.keys(patch).sort()).toEqual(['decision', 'decision_checklist', 'recommendation']);
  });

  it('buildWinStrategyPatch → exactly {win_strategy}', () => {
    expect(Object.keys(buildWinStrategyPatch({ rationale: {}, win_themes: [], differentiators: [], evaluation_alignment: [] } as any)))
      .toEqual(['win_strategy']);
  });

  it('buildResourceCommitmentPatch → exactly {resource_commitment}', () => {
    expect(Object.keys(buildResourceCommitmentPatch([] as any, {} as any, [] as any, {} as any)))
      .toEqual(['resource_commitment']);
  });

  it('buildDecisionRecordPatch → exactly {decision_record} with if_bid/if_no_bid nested', () => {
    const patch = buildDecisionRecordPatch({ decision: 'Bid' } as any, { a: 1 } as any, { b: 2 } as any, [] as any);
    expect(Object.keys(patch)).toEqual(['decision_record']);
    expect(Object.keys(patch.decision_record).sort()).toEqual(['evidence', 'formal', 'if_bid', 'if_no_bid']);
  });
});

describe('solution design tab builders — own keys only (P2b tab key map)', () => {
  it('GUARD: buildHopPatch emits ONLY the hop key (whole-facet spreads are forbidden)', () => {
    const patch = buildHopPatch({ storage_required: 'Yes' } as any, { lanes: [] } as any, [], rec);
    expect(Object.keys(patch)).toEqual(['hop']);
    expect(Object.keys(patch.hop).sort()).toEqual(['operational_flow', 'recommendation', 'transport', 'warehouse']);
  });

  it('buildSolutionConfigurationPatch → exactly {configuration}', () => {
    expect(Object.keys(buildSolutionConfigurationPatch({ selected_modules: 'HOP' } as any))).toEqual(['configuration']);
  });

  it('buildHamPatch → exactly {ham}', () => {
    expect(Object.keys(buildHamPatch([] as any, {} as any, {} as any, [] as any, rec))).toEqual(['ham']);
  });

  it('buildHipPatch → exactly {hip}', () => {
    expect(Object.keys(buildHipPatch([], {} as any, [] as any, [] as any, rec))).toEqual(['hip']);
  });

  it('buildScopeMatrixPatch → exactly {scope_matrix}', () => {
    expect(Object.keys(buildScopeMatrixPatch([] as any))).toEqual(['scope_matrix']);
  });

  it('buildSlaKpiPatch → exactly {sla_kpi}', () => {
    expect(Object.keys(buildSlaKpiPatch([] as any, {} as any, rec))).toEqual(['sla_kpi']);
  });

  it('buildAssumptionsDependenciesPatch → exactly {assumptions_dependencies}', () => {
    expect(Object.keys(buildAssumptionsDependenciesPatch([] as any, [] as any, [] as any, [] as any, rec)))
      .toEqual(['assumptions_dependencies']);
  });
});

// ─────────────────────────────────────────────────────────────
// The tab-shaped write against the real writer + stateful mock
// ─────────────────────────────────────────────────────────────

describe('tab-shaped saves through the real writers', () => {
  it('HOP save (builder + expectedRevision) patches ONLY hop; stored configuration/ham and other type_details keys survive', async () => {
    state.row = storedRow({
      type_details: {
        pricing: { pnl_snapshot: { note: 'sibling facet — must survive' } },
        solution_design_data: {
          configuration: { selected_modules: 'HOP + HAM', kept: true },
          ham: { staffing: [{ role: 'Supervisor' }] },
        },
      },
    });

    const result = await updateTenderSolutionDesignData(
      TENDER_ID,
      buildHopPatch({ storage_required: 'Yes' } as any, { lanes: [] } as any, [], rec),
      { expectedRevision: REV, reason: 'HOP Operations Model saved' },
    );

    expect(result.success).toBe(true);
    const update = updateCalls()[0];
    expect(update.filters).toEqual([
      ['id', TENDER_ID],
      ['ticket_type', 'tender'],
      ['active', true],
      ['updated_at', REV],
    ]);
    const details = update.payload!.type_details as Record<string, any>;
    expect(Object.keys(details.solution_design_data).sort()).toEqual(['configuration', 'ham', 'hop']);
    expect(details.solution_design_data.configuration).toEqual({ selected_modules: 'HOP + HAM', kept: true });
    expect(details.solution_design_data.ham).toEqual({ staffing: [{ role: 'Supervisor' }] });
    expect(details.pricing).toEqual({ pnl_snapshot: { note: 'sibling facet — must survive' } });
  });

  it('Win Strategy save patches ONLY win_strategy; a stored decision from the Bid Decision tab survives', async () => {
    state.row = storedRow({
      type_details: {
        bid_no_bid_data: { decision: { decision: 'Bid', kept: true } },
      },
    });

    const result = await updateTenderBidNoBidData(
      TENDER_ID,
      buildWinStrategyPatch({ rationale: { why_bid: 'strategic' }, win_themes: [], differentiators: [], evaluation_alignment: [] } as any),
      { expectedRevision: REV, reason: 'Win Strategy tab saved' },
    );

    expect(result.success).toBe(true);
    const details = updateCalls()[0].payload!.type_details as Record<string, any>;
    expect(Object.keys(details.bid_no_bid_data).sort()).toEqual(['decision', 'win_strategy']);
    expect(details.bid_no_bid_data.decision).toEqual({ decision: 'Bid', kept: true });
  });

  it("a stale UI token refuses non-destructively and the tab's onSaved (onConfirmed) never fires", async () => {
    state.row = storedRow({
      type_details: { solution_design_data: { hop: { warehouse: { stored: true } } } },
    });
    const onConfirmed = vi.fn();
    const onStale = vi.fn();

    const outcome = await runTenderTabSave({
      write: expectedRevision =>
        updateTenderSolutionDesignData(TENDER_ID, buildHopPatch({ changed: true } as any, {} as any, [], rec), {
          expectedRevision,
          reason: 'HOP Operations Model saved',
        }),
      revisionToken: 'rev-another-sessions-read',
      staleRetryArmed: { current: false },
      labels: { saved: 'HOP Operations Model saved', failed: 'Save failed' },
      onConfirmed,
      onStale,
      announce: () => {},
    });

    expect(outcome.kind).toBe('stale');
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onStale).toHaveBeenCalledTimes(1);
    // Nothing reached the database; the stored facet is untouched.
    expect(updateCalls()).toHaveLength(0);
    expect((state.row!.type_details as Record<string, any>).solution_design_data.hop).toEqual({ warehouse: { stored: true } });
  });

  it('an audit-append failure surfaces as the amber confirmed-save outcome and onSaved still fires', async () => {
    state.insertError = { message: 'permission denied for table commercial_ticket_audit' };
    const onConfirmed = vi.fn();
    const announced: Array<{ toastKind: string; description?: string }> = [];

    const outcome = await runTenderTabSave({
      write: expectedRevision =>
        updateTenderSolutionDesignData(TENDER_ID, buildScopeMatrixPatch([{ scope_item: 'Storage' }] as any), {
          expectedRevision,
          reason: 'Scope Matrix saved',
        }),
      revisionToken: REV,
      staleRetryArmed: { current: false },
      labels: { saved: 'Scope Matrix saved', failed: 'Save failed' },
      onConfirmed,
      announce: o => { announced.push(o); },
    });

    expect(outcome.kind).toBe('saved_with_audit_warning');
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(announced[0].toastKind).toBe('warning');
    expect(announced[0].description).toContain('permission denied');
    // The primary write really landed.
    expect((state.row!.type_details as Record<string, any>).solution_design_data.scope_matrix)
      .toEqual({ rows: [{ scope_item: 'Storage' }] });
  });
});
