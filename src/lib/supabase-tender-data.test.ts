/**
 * supabase-tender-data.test.ts — SC-01 Wave 04 / ticket T08-A (agent W04-T08-A).
 *
 * Contract under test — the tender workspace read layer (route /tenders/:id):
 *   - identity      → the bundle only ever carries the tender in the URL, and a
 *                     row whose id differs is a failure, not data
 *   - honest empty  → a genuinely absent row reports `not_found`
 *   - functional err→ a PostgREST/RLS error reports `error`, never `not_found`
 *   - isolated      → a read that was never attempted says so, and does not
 *                     claim the record is absent
 *   - two trackers  → crm_pipeline_stage and internal_stage are read from two
 *                     independent columns and neither is derived from the other
 *   - crm fidelity  → a stage key the layer cannot read back is reported as
 *                     unrestorable rather than silently shown as 'prospecting'
 *
 * The Supabase mock HONOURS THE PROJECTION and records the filters actually
 * sent, so an assertion here reflects what reaches the database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockResult = { data: unknown; error: { message: string } | null };

interface RecordedCall {
  table: string;
  projection: string | null;
  filters: Array<[string, unknown]>;
}

const sb = {
  calls: [] as RecordedCall[],
  /** table → result the mock should hand back */
  results: {} as Record<string, MockResult>,
};

function applyProjection(projection: string | null, data: unknown): unknown {
  if (!projection || projection === '*' || data === null || data === undefined) return data;
  const wanted = projection.split(',').map(c => c.trim()).filter(Boolean);
  const pick = (row: any) => {
    if (row === null || typeof row !== 'object') return row;
    const picked: Record<string, any> = {};
    for (const column of wanted) if (column in row) picked[column] = row[column];
    return picked;
  };
  return Array.isArray(data) ? data.map(pick) : pick(data);
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from(table: string) {
      const call: RecordedCall = { table, projection: null, filters: [] };
      sb.calls.push(call);
      const settle = () => {
        const result = sb.results[table] ?? { data: null, error: null };
        return {
          data: result.error ? null : applyProjection(call.projection, result.data),
          error: result.error,
        };
      };
      const builder: any = {
        select: (projection?: string) => { call.projection = projection ?? '*'; return builder; },
        eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder; },
        order: () => Promise.resolve(settle()),
        maybeSingle: () => Promise.resolve(settle()),
        then: (resolve: any, reject: any) => Promise.resolve(settle()).then(resolve, reject),
      };
      return builder;
    },
  },
}));

// The clean app's process isolation allowlist. The only id it admits is Linde.
const ALLOWED_ID = '7483c493-0098-40a9-9e5f-76007bc62cd1';
const ISOLATED_ID = 'a1200000-0000-4000-8000-000000000002';

function tenderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ALLOWED_ID,
    ticket_type: 'tender',
    active: true,
    ticket_title: 'Linde SIGAS Bulk Transportation Tender',
    customer_name: 'Linde SIGAS — Saudi Industrial Gas Co.',
    owner: 'Amin Al-Halabi',
    crm_pipeline_stage: 'proposal_sent',
    internal_stage: 'proposal_preparation',
    estimated_value: 15000000,
    target_gp_percent: 22,
    target_date: '2026-06-15',
    updated_at: '2026-07-13T21:00:43.304184+00:00',
    created_at: '2026-01-01T00:00:00+00:00',
    type_details: {},
    ...overrides,
  };
}

let mod: typeof import('./supabase-tender-data');

beforeEach(async () => {
  sb.calls = [];
  sb.results = {};
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mod = await import('./supabase-tender-data');
});

describe('fetchTenderWorkspaceBundleFromSupabase — identity scoping', () => {
  it('filters commercial_tickets on the requested id, ticket_type and active', async () => {
    sb.results.commercial_tickets = { data: tenderRow(), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.loadState.kind).toBe('loaded');
    expect(bundle.requestedTenderId).toBe(ALLOWED_ID);
    expect(bundle.tender?.id).toBe(ALLOWED_ID);

    // What actually reached the database, not what came back.
    const ticketCall = sb.calls.find(c => c.table === 'commercial_tickets');
    expect(ticketCall?.filters).toEqual([
      ['id', ALLOWED_ID],
      ['ticket_type', 'tender'],
      ['active', true],
    ]);

    // Audit reads are scoped to the same ticket id — no global/most-recent feed.
    for (const auditCall of sb.calls.filter(c => c.table === 'commercial_ticket_audit')) {
      expect(auditCall.filters).toEqual([['ticket_id', ALLOWED_ID]]);
    }
  });

  it('treats a row whose id differs from the request as a failure, not as data', async () => {
    sb.results.commercial_tickets = { data: tenderRow({ id: 'some-other-tender' }), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.tender).toBeNull();
    expect(bundle.loadState.kind).toBe('error');
    expect((bundle.loadState as any).message).toContain('identity mismatch');
  });

  it('binds documents to the requested tender id', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({
        type_details: {
          documents: [
            { id: 'doc-1', document_name: 'RFQ.pdf', stage_relevance: ['Identified'] },
          ],
        },
      }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.documents).toHaveLength(1);
    expect(bundle.documents[0].tender_id).toBe(ALLOWED_ID);
  });
});

describe('fetchTenderWorkspaceBundleFromSupabase — loading / empty / error are three different facts', () => {
  it('reports not_found when no active row is visible', async () => {
    sb.results.commercial_tickets = { data: null, error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.loadState.kind).toBe('not_found');
    expect(bundle.tender).toBeNull();
  });

  it('reports error — NOT not_found — when the read fails', async () => {
    sb.results.commercial_tickets = { data: null, error: { message: 'permission denied for table commercial_tickets' } };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.loadState.kind).toBe('error');
    expect((bundle.loadState as any).message).toContain('permission denied');
  });

  it('reports isolated, and issues no query at all, for an id outside the allowlist', async () => {
    sb.results.commercial_tickets = { data: tenderRow({ id: ISOLATED_ID }), error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ISOLATED_ID);

    expect(bundle.loadState.kind).toBe('isolated');
    expect(sb.calls).toHaveLength(0);
    // It must not assert the record is absent — it was never looked for.
    expect((bundle.loadState as any).message).toContain('not evidence that the record is absent');
  });
});

describe('two independent trackers', () => {
  it('reads CRM stage and internal stage from two separate columns', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({ crm_pipeline_stage: 'qualified', internal_stage: 'clarification' }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.crmPipelineStageRaw).toBe('qualified');
    expect(bundle.tender?.crmPipelineStage).toBe('qualified');
    expect(bundle.tender?.internalStageRaw).toBe('clarification');
    expect(mod.mapDbStageToInternalCognitionStage(bundle.tender?.internalStageRaw)).toBe('clarification');
  });

  it('changing one column does not move the other', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({ crm_pipeline_stage: 'closed_won', internal_stage: 'identified' }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.tender?.crmPipelineStage).toBe('closed_won');
    expect(mod.mapDbStageToInternalCognitionStage(bundle.tender?.internalStageRaw)).toBe('identified');
  });

  it('exposes an unset CRM column as null rather than as a saved "prospecting"', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({ crm_pipeline_stage: null, internal_stage: 'identified' }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.crmPipelineStageRaw).toBeNull();
    // The normalized display value still needs something to highlight…
    expect(bundle.tender?.crmPipelineStage).toBe('prospecting');
    // …but it must not be mistaken for the stored value.
    expect(bundle.crmPipelineStageRaw).not.toBe(bundle.tender?.crmPipelineStage);
  });
});

describe('CRM stage round-trip fidelity', () => {
  it('accepts every stage key the read layer can restore', () => {
    for (const stage of mod.RESTORABLE_CRM_PIPELINE_STAGES) {
      expect(mod.isRestorableCrmPipelineStage(stage)).toBe(true);
    }
    expect(mod.RESTORABLE_CRM_PIPELINE_STAGES).toContain('operational_handover');
  });

  it('restores actual_go_live — every stage the strip offers must survive a round trip', () => {
    // Regression guard for a real defect (found by W04-T08-A, closed by Fable in
    // integration): CrmPipelineStrip offers "actual_go_live" but the read layer's
    // CRM_STAGE_MAP had no such key, so a successful write reloaded as
    // "prospecting" under a "Persisted to Supabase" toast. Every key the human
    // can click must be readable back, or the UI reports a stage the row does
    // not hold.
    expect(mod.isRestorableCrmPipelineStage('actual_go_live')).toBe(true);
    expect(mod.RESTORABLE_CRM_PIPELINE_STAGES).toContain('actual_go_live');
  });

  it('rejects unknown / empty stage keys', () => {
    expect(mod.isRestorableCrmPipelineStage('')).toBe(false);
    expect(mod.isRestorableCrmPipelineStage(null)).toBe(false);
    expect(mod.isRestorableCrmPipelineStage('not_a_stage')).toBe(false);
  });
});

describe('bundleToTenderWorkspace', () => {
  it('carries the raw CRM column through to the workspace', async () => {
    sb.results.commercial_tickets = { data: tenderRow({ crm_pipeline_stage: 'proposal_sent' }), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);
    const ws = mod.bundleToTenderWorkspace(bundle);

    expect(ws?.crmPipelineStageRaw).toBe('proposal_sent');
    expect(ws?.tender.id).toBe(ALLOWED_ID);
  });

  it('returns null when there is no tender record', () => {
    const bundle = {
      requestedTenderId: ALLOWED_ID,
      loadState: { kind: 'not_found' as const, message: 'x' },
      tender: null,
    } as any;
    expect(mod.bundleToTenderWorkspace(bundle)).toBeNull();
  });
});
