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

describe('risk verdict — W04-C4, rebased on the P1 register (TCW-T1)', () => {
  /**
   * The verdict inputs are no longer stubs: the compliance / required-document
   * registers live in type_details.submission_readiness ON the tender row, so
   * reading the row IS reading the registers. Honesty now splits two ways:
   *   - inputs count as assessed when the row read succeeded (they were read);
   *   - but a read-and-EMPTY register still carries NO verdict — "nothing
   *     recorded" must never render as a green "On Track".
   */
  it('a loaded row with no recorded register: inputs assessed, verdict still not_assessed', async () => {
    sb.results.commercial_tickets = { data: tenderRow(), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.loadState.kind).toBe('loaded');
    expect(bundle.tender?.id).toBe(ALLOWED_ID);
    // The registers were genuinely read (from the row) and are empty…
    expect(bundle.riskInputsAssessed).toBe(true);
    expect(bundle.complianceItems).toEqual([]);
    expect(bundle.requiredDocuments).toEqual([]);
    // …so there is nothing recorded to derive a verdict from.
    expect(bundle.riskLevel).toBe('not_assessed');
    expect(bundle.riskLevel).not.toBe('green');
  });

  it('the registers are read from the tender row itself — no extra table is queried', async () => {
    sb.results.commercial_tickets = { data: tenderRow(), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    const tables = new Set(sb.calls.map(c => c.table));
    expect([...tables].sort()).toEqual(['commercial_ticket_audit', 'commercial_tickets']);
  });

  it('reports the required-document set as read (assessed) with zero rows recorded', async () => {
    sb.results.commercial_tickets = { data: tenderRow(), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    // The set was genuinely read; "nothing recorded" is expressed by the empty
    // array + buildRequiredDocumentsProgress's null-percent branch, not by a
    // false "never read" flag.
    expect(bundle.requiredDocumentsAssessed).toBe(true);
    expect(bundle.requiredDocuments).toEqual([]);
  });

  it('derives amber from an explicitly recorded compliance gap', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({
        type_details: {
          submission_readiness: {
            compliance_items: [
              { id: 'ci-1', requirement: 'ADR certified drivers', status: 'non_compliant', updated_at: 't', updated_by: 'u' },
              { id: 'ci-2', requirement: 'ISO 9001', status: 'compliant', updated_at: 't', updated_by: 'u' },
            ],
          },
        },
      }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.riskInputsAssessed).toBe(true);
    expect(bundle.riskLevel).toBe('amber');
  });

  it('derives green ONLY when rows are recorded and none records a gap', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({
        type_details: {
          submission_readiness: {
            required_documents: [
              { id: 'rd-1', document_name: 'Company registration', status: 'uploaded', updated_at: 't', updated_by: 'u' },
            ],
            compliance_items: [
              { id: 'ci-1', requirement: 'ISO 9001', status: 'compliant', updated_at: 't', updated_by: 'u' },
            ],
          },
        },
      }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.riskLevel).toBe('green');
  });

  it('a bundle that never loaded carries no verdict — and says the register was not read', async () => {
    sb.results.commercial_tickets = { data: null, error: { message: 'permission denied' } };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.loadState.kind).toBe('error');
    expect(bundle.riskLevel).toBe('not_assessed');
    expect(bundle.riskInputsAssessed).toBe(false);
    // The loaded flag stays truthful on a failed row read.
    expect(bundle.submissionReadiness.loaded).toBe(false);
    expect(bundle.submissionReadiness.error).toContain('permission denied');
    expect(bundle.requiredDocumentsAssessed).toBe(false);
  });

  it('carries the honesty flags through to the workspace the page renders', async () => {
    sb.results.commercial_tickets = { data: tenderRow(), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const ws = mod.bundleToTenderWorkspace(
      await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID),
    );

    expect(ws?.riskLevel).toBe('not_assessed');
    expect(ws?.riskInputsAssessed).toBe(true);
    expect(ws?.requiredDocumentsAssessed).toBe(true);
  });
});

describe('submission readiness register read — TCW-T1 P1', () => {
  const REGISTER = {
    placeholders: [
      { id: 'ph-1', label: 'Bid validity period', status: 'approved', value: '90 days', owner: 'Amin', updated_at: '2026-08-20T10:00:00Z', updated_by: 'Amin' },
      { id: 'ph-2', label: 'Bank guarantee ref', status: 'pending', updated_at: '2026-08-20T10:00:00Z', updated_by: 'Amin' },
    ],
    required_documents: [
      { id: 'rd-1', document_name: 'Commercial registration', status: 'missing', linked_document_id: '', updated_at: '2026-08-20T10:00:00Z', updated_by: 'Amin' },
    ],
    compliance_items: [
      { id: 'ci-1', requirement: 'GDP compliance', status: 'in_review', evidence: '', updated_at: '2026-08-20T10:00:00Z', updated_by: 'Amin' },
    ],
  };

  it('exposes the raw register rows verbatim on bundle.submissionReadiness', async () => {
    sb.results.commercial_tickets = { data: tenderRow({ type_details: { submission_readiness: REGISTER } }), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.submissionReadiness.loaded).toBe(true);
    expect(bundle.submissionReadiness.facet.placeholders.map(r => r.id)).toEqual(['ph-1', 'ph-2']);
    // Raw statuses (incl. states the legacy UI unions cannot express) survive.
    expect(bundle.submissionReadiness.facet.compliance_items[0].status).toBe('in_review');
    expect(bundle.submissionReadiness.facet.required_documents[0].status).toBe('missing');
  });

  it('projects register rows into the legacy UI arrays with their EXACT register ids', async () => {
    sb.results.commercial_tickets = { data: tenderRow({ type_details: { submission_readiness: REGISTER } }), error: null };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    // Exact ids — the id a tab passes to updatePlaceholderStatus & co. IS the register row id.
    expect(bundle.placeholders.map(p => p.id)).toEqual(['ph-1', 'ph-2']);
    expect(bundle.requiredDocuments.map(d => d.id)).toEqual(['rd-1']);
    expect(bundle.complianceItems.map(c => c.id)).toEqual(['ci-1']);
    // Documented lossy status projection (conservative for verdict types).
    expect(bundle.placeholders.find(p => p.id === 'ph-2')?.status).toBe('missing');
    expect(bundle.requiredDocuments[0].status).toBe('awaiting');
    expect(bundle.complianceItems[0].status).toBe('not_reviewed');
  });

  it('drops structurally invalid stored rows from the normalized view without failing the read', async () => {
    sb.results.commercial_tickets = {
      data: tenderRow({
        type_details: {
          submission_readiness: {
            placeholders: [
              { label: 'row without id', status: 'pending' },
              { id: 'ph-ok', label: 'Valid row', status: 'approved', updated_at: 't', updated_by: 'u' },
              'not-an-object',
            ],
          },
        },
      }),
      error: null,
    };
    sb.results.commercial_ticket_audit = { data: [], error: null };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    expect(bundle.submissionReadiness.facet.placeholders.map(r => r.id)).toEqual(['ph-ok']);
  });
});

describe('activity / audit history — F5 single deduplicated feed (TCW-T1)', () => {
  it('issues exactly ONE commercial_ticket_audit query and derives both projections from it', async () => {
    sb.results.commercial_tickets = { data: tenderRow(), error: null };
    sb.results.commercial_ticket_audit = {
      data: [
        { id: 'a-1', ticket_id: ALLOWED_ID, action: 'updated', field_changed: 'pricing.summary', notes: 'P&L / Pricing updated | summary', user_name: 'Amin', created_at: '2026-08-20T10:00:00Z' },
      ],
      error: null,
    };

    const bundle = await mod.fetchTenderWorkspaceBundleFromSupabase(ALLOWED_ID);

    const auditCalls = sb.calls.filter(c => c.table === 'commercial_ticket_audit');
    expect(auditCalls).toHaveLength(1);
    // Both collections are projections of that one feed: same rows, same ids.
    expect(bundle.activityEvents.map(e => e.id)).toEqual(['a-1']);
    expect(bundle.auditEntries.map(e => e.id)).toEqual(['a-1']);
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
