/**
 * supabase-tender-actions.test.ts — SC-01 Wave 04 / ticket T08-A (agent W04-T08-A).
 *
 * Contract under test — manual stage movement from /tenders/:id:
 *   - persistence   → the write lands on commercial_tickets, on the row in the
 *                     URL, in the established column (internal_stage /
 *                     crm_pipeline_stage), and success is reported only after a
 *                     row actually came back
 *   - independence  → moving one tracker never touches the other's column
 *   - truthful fail → a failing write reports failure and leaves the record
 *                     alone; a resolved request is not accepted as proof
 *
 * Every assertion is against what reached the database — the payload handed to
 * .update() and the filters handed to .eq() — not against a return value alone.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENDER_ID = 'a1200000-0000-4000-8000-000000000002';
const REVISION = '2026-07-13T21:00:43.304184+00:00';

interface UpdateCall {
  table: string;
  patch: Record<string, any>;
  filters: Array<[string, unknown]>;
  projection: string | null;
}

const sb = {
  /** current stored row, as the database would return it */
  row: null as Record<string, any> | null,
  readError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  /** when true, .update() matches no row (stale revision / RLS block) */
  updateMatchesNothing: false,
  insertError: null as { message: string } | null,
  /** when true, .insert() resolves without error but returns no stored row */
  insertMatchesNothing: false,
  updateCalls: [] as UpdateCall[],
  selectCalls: [] as Array<{ table: string; projection: string | null; filters: Array<[string, unknown]> }>,
  inserts: [] as Array<{ table: string; row: Record<string, any>; projection: string | null }>,
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

vi.mock('./supabase', () => ({
  supabase: {
    from(table: string) {
      let mode: 'select' | 'update' | 'insert' = 'select';
      let projection: string | null = null;
      let patch: Record<string, any> = {};
      let insertRow: Record<string, any> = {};
      const filters: Array<[string, unknown]> = [];

      const settle = () => {
        if (mode === 'insert') {
          sb.inserts.push({ table, row: insertRow, projection });
          if (sb.insertError) return { data: null, error: sb.insertError };
          if (sb.insertMatchesNothing) return { data: null, error: null };
          return { data: applyProjection(projection, { id: 'audit-row-1' }), error: null };
        }
        if (mode === 'update') {
          sb.updateCalls.push({ table, patch, filters: [...filters], projection });
          if (sb.updateError) return { data: null, error: sb.updateError };
          if (sb.updateMatchesNothing) return { data: null, error: null };
          // A real update returns the row AS STORED after the write.
          sb.row = { ...(sb.row ?? {}), ...patch };
          return { data: applyProjection(projection, sb.row), error: null };
        }
        sb.selectCalls.push({ table, projection, filters: [...filters] });
        if (sb.readError) return { data: null, error: sb.readError };
        if (table === 'commercial_ticket_audit') return { data: applyProjection(projection, []), error: null };
        return { data: applyProjection(projection, sb.row), error: null };
      };

      const builder: any = {
        select: (p?: string) => { projection = p ?? '*'; return builder; },
        update: (p: Record<string, any>) => { mode = 'update'; patch = p; return builder; },
        insert: (r: Record<string, any>) => { mode = 'insert'; insertRow = r; return builder; },
        eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
        order: () => Promise.resolve(settle()),
        maybeSingle: () => Promise.resolve(settle()),
        then: (resolve: any, reject: any) => Promise.resolve(settle()).then(resolve, reject),
      };
      return builder;
    },
  },
}));

vi.mock('./auth-state', () => ({
  getCurrentUser: () => ({ id: 'user-1', name: 'UAT Operator' }),
}));

function storedRow(overrides: Record<string, any> = {}) {
  return {
    id: TENDER_ID,
    ticket_type: 'tender',
    active: true,
    updated_at: REVISION,
    ticket_title: '[HALA-UAT-ARV2][W2-S002] Fifteen Stage Tender Test',
    crm_pipeline_stage: 'qualified',
    internal_stage: 'clarification',
    type_details: {},
    ...overrides,
  };
}

let actions: typeof import('./supabase-tender-actions');

beforeEach(async () => {
  sb.row = storedRow();
  sb.readError = null;
  sb.updateError = null;
  sb.updateMatchesNothing = false;
  sb.insertError = null;
  sb.insertMatchesNothing = false;
  sb.updateCalls = [];
  sb.selectCalls = [];
  sb.inserts = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  actions = await import('./supabase-tender-actions');
});

describe('updateTenderPhase — internal tender process tracker', () => {
  it('writes internal_stage on the requested row and touches no other stage column', async () => {
    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation', 'Manual internal Tender stage change');

    expect(result).toEqual({ success: true });

    const update = sb.updateCalls.find(c => c.table === 'commercial_tickets');
    expect(update).toBeDefined();
    // What reached the database:
    expect(update!.patch).toEqual({ internal_stage: 'negotiation' });
    expect(update!.patch).not.toHaveProperty('crm_pipeline_stage');
    expect(update!.filters).toEqual([
      ['id', TENDER_ID],
      ['ticket_type', 'tender'],
      ['active', true],
      ['updated_at', REVISION],
    ]);
    // Stored truth moved; the CRM column did not.
    expect(sb.row!.internal_stage).toBe('negotiation');
    expect(sb.row!.crm_pipeline_stage).toBe('qualified');
  });

  it('rejects an unknown stage before any write is attempted', async () => {
    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'not_a_stage');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown Tender stage');
    expect(sb.updateCalls).toHaveLength(0);
    expect(sb.row!.internal_stage).toBe('clarification');
  });

  it('permits every one of the fifteen internal stages — no readiness or approval condition', async () => {
    const stages = [
      'identified', 'qualification', 'bid_no_bid', 'solution_design', 'pnl_pricing',
      'tender_drafting', 'internal_review', 'approval_matrix', 'final_approved',
      'submitted', 'clarification', 'client_evaluation', 'negotiation', 'awarded', 'lost_withdrawn',
    ];
    for (const stage of stages) {
      sb.row = storedRow({ internal_stage: 'identified' });
      sb.updateCalls = [];
      const result = await actions.updateTenderPhase(TENDER_ID, 'identified', stage);
      expect(result, `stage ${stage} must be reachable`).toEqual({ success: true });
      expect(sb.updateCalls[0].patch).toEqual({ internal_stage: stage });
    }
  });

  it('reports failure — and changes nothing — when the update errors', async () => {
    sb.updateError = { message: 'permission denied for table commercial_tickets' };

    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation');

    expect(result.success).toBe(false);
    expect(result.error).toContain('permission denied');
    expect(sb.row!.internal_stage).toBe('clarification');
  });

  it('reports failure when the update resolves but matches no row (a resolved request is not proof)', async () => {
    sb.updateMatchesNothing = true;

    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(sb.row!.internal_stage).toBe('clarification');
  });

  it('reports failure when the tender row is not visible', async () => {
    sb.row = null;

    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(sb.updateCalls).toHaveLength(0);
  });

  it('reports failure when the read fails', async () => {
    sb.readError = { message: 'network error' };

    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation');

    expect(result.success).toBe(false);
    expect(result.error).toContain('network error');
    expect(sb.updateCalls).toHaveLength(0);
  });
});

describe('archiveTenderDocument — canonical document truth', () => {
  it('performs zero writes when the document id is not present', async () => {
    sb.row = storedRow({ type_details: { documents: [] } });

    const result = await actions.archiveTenderDocument(TENDER_ID, 'missing-doc');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not recorded');
    expect(sb.updateCalls).toHaveLength(0);
    expect(sb.inserts).toHaveLength(0);
  });

  it('archives the exact document and preserves its other metadata', async () => {
    const document = {
      id: 'doc-1',
      tender_id: TENDER_ID,
      document_name: 'Scope.pdf',
      document_category: 'Source',
      status: 'Reviewed',
    };
    sb.row = storedRow({ type_details: { documents: [document] } });

    const result = await actions.archiveTenderDocument(TENDER_ID, 'doc-1');

    expect(result.success).toBe(true);
    const update = sb.updateCalls.find(call => call.table === 'commercial_tickets');
    expect(update?.patch.type_details.documents).toEqual([
      { ...document, document_category: 'Archived' },
    ]);
  });
});

describe('updateTenderCrmStage — CRM pipeline tracker', () => {
  it('writes crm_pipeline_stage on the requested row and touches no other stage column', async () => {
    const result = await actions.updateTenderCrmStage(TENDER_ID, 'qualified', 'proposal_sent', 'Manual CRM stage move');

    expect(result).toEqual({ success: true });

    const update = sb.updateCalls.find(c => c.table === 'commercial_tickets');
    expect(update!.patch).toEqual({ crm_pipeline_stage: 'proposal_sent' });
    expect(update!.patch).not.toHaveProperty('internal_stage');
    expect(update!.filters[0]).toEqual(['id', TENDER_ID]);

    expect(sb.row!.crm_pipeline_stage).toBe('proposal_sent');
    expect(sb.row!.internal_stage).toBe('clarification');
  });

  it('reports failure — and leaves the stored CRM stage alone — when the update errors', async () => {
    sb.updateError = { message: 'update failed' };

    const result = await actions.updateTenderCrmStage(TENDER_ID, 'qualified', 'proposal_sent');

    expect(result.success).toBe(false);
    expect(sb.row!.crm_pipeline_stage).toBe('qualified');
  });
});

/**
 * W04-C4 — createActivityNote.
 *
 * The activity note has no canonical ticket write behind it: the
 * commercial_ticket_audit row IS the note. The old implementation called a
 * fire-and-forget insert (never awaited, failures console.warn'd only) and then
 * returned `{ success: true }` with no condition, while the UI printed
 * "Persisted to Supabase". That is a success message with zero persistence
 * evidence.
 */
describe('createActivityNote — success means a stored row', () => {
  it('writes the note to commercial_ticket_audit, scoped to the requested tender', async () => {
    const result = await actions.createActivityNote(TENDER_ID, 'Site visit', 'Met the buyer on site');

    expect(result).toEqual({ success: true });

    const insert = sb.inserts.find(i => i.table === 'commercial_ticket_audit');
    expect(insert).toBeDefined();
    // What actually reached the database:
    expect(insert!.row.ticket_id).toBe(TENDER_ID);
    expect(insert!.row.field_changed).toBe('note');
    expect(insert!.row.notes).toBe('Site visit | Met the buyer on site');
    expect(insert!.row.user_name).toBe('UAT Operator');
  });

  it('asks the database for the stored id — a resolved request is not the proof', async () => {
    await actions.createActivityNote(TENDER_ID, 'Note', '');

    const insert = sb.inserts.find(i => i.table === 'commercial_ticket_audit');
    // The projection reaching the database. Without it the mock (which honours
    // projections) would hand back nothing, and the fire-and-forget version of
    // this function asked for nothing at all.
    expect(insert!.projection).toBe('id');
  });

  it('reports FAILURE when the insert errors — no fake success', async () => {
    sb.insertError = { message: 'new row violates row-level security policy for table commercial_ticket_audit' };

    const result = await actions.createActivityNote(TENDER_ID, 'Blocked note', 'body');

    expect(result.success).toBe(false);
    expect(result.error).toContain('row-level security');
    expect(result.error).toContain('Not saved');
  });

  it('reports FAILURE when the insert resolves but no stored row comes back', async () => {
    sb.insertMatchesNothing = true;

    const result = await actions.createActivityNote(TENDER_ID, 'Silent note', 'body');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not confirmed saved');
  });

  it('omits an empty description instead of leaving a trailing separator', async () => {
    await actions.createActivityNote(TENDER_ID, 'Title only', '');

    const insert = sb.inserts.find(i => i.table === 'commercial_ticket_audit');
    expect(insert!.row.notes).toBe('Title only');
  });
});

/**
 * TCW-T1 (P3) — the activity/audit append behind every stage & field write is
 * now AWAITED and confirmed. A failed append never blocks the already-saved
 * primary write, but it is never silent: the result says
 * 'saved_with_audit_warning' with the real reason.
 */
describe('audit honesty on stage writes — P3', () => {
  it("a failed audit insert → success:true with status 'saved_with_audit_warning' and the reason", async () => {
    sb.insertError = { message: 'permission denied for table commercial_ticket_audit' };

    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation');

    expect(result.success).toBe(true);
    expect(result.status).toBe('saved_with_audit_warning');
    expect(result.auditWarning).toContain('audit entry was not recorded');
    expect(result.auditWarning).toContain('permission denied');
    // The primary write really landed.
    expect(sb.row!.internal_stage).toBe('negotiation');
  });

  it('an audit insert that resolves without a stored row is also surfaced, not silenced', async () => {
    sb.insertMatchesNothing = true;

    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation');

    expect(result.success).toBe(true);
    expect(result.status).toBe('saved_with_audit_warning');
    expect(result.auditWarning).toContain('no stored row');
  });

  it('a clean save appends a confirmed pipe-format activity row (id selected back) and reports plain success', async () => {
    const result = await actions.updateTenderPhase(TENDER_ID, 'clarification', 'negotiation', 'stage move');

    expect(result).toEqual({ success: true });
    const insert = sb.inserts.find(i => i.table === 'commercial_ticket_audit');
    expect(insert).toBeDefined();
    expect(insert!.projection).toBe('id');
    expect(insert!.row.notes).toContain('Tender Stage Change | Phase changed from "clarification" to "negotiation". stage move | Reason: stage move');
    expect(insert!.row.user_name).toBe('UAT Operator');
  });
});

describe('the two trackers are independently sourced', () => {
  it('a CRM move followed by an internal move leaves both columns at their own values', async () => {
    await actions.updateTenderCrmStage(TENDER_ID, 'qualified', 'shortlisted');
    await actions.updateTenderPhase(TENDER_ID, 'clarification', 'awarded');

    expect(sb.row!.crm_pipeline_stage).toBe('shortlisted');
    expect(sb.row!.internal_stage).toBe('awarded');

    const patches = sb.updateCalls.filter(c => c.table === 'commercial_tickets').map(c => c.patch);
    expect(patches).toEqual([
      { crm_pipeline_stage: 'shortlisted' },
      { internal_stage: 'awarded' },
    ]);
  });
});
