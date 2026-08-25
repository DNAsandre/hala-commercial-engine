/**
 * tender-field-patch.test.ts — PADW T03t acceptance tests.
 *
 * Proves the mandated persistence contract for path-level Tender patches:
 *  - only addressed leaves change; every unaddressed sibling (object AND array
 *    levels) is preserved byte-for-byte, and untouched branches keep their
 *    original object references (copy-on-write proof);
 *  - repeated rows are addressed by source fingerprint with update-vs-append
 *    semantics — replay of the same extraction NEVER duplicates a row (ADR-05);
 *  - tracker immunity (pin P9): no request can write crm_pipeline_stage or
 *    internal_stage, and the store update payload never carries either column;
 *  - exact-id + active-row + revision guard: a stale token refuses without
 *    writing; unknown field ids refuse before any read;
 *  - read-back verification: a store that drops the value yields 'failed',
 *    never silent success; an audit failure yields saved_with_audit_warning.
 */
import { describe, expect, it } from 'vitest';

import type { ProcessManifest, RowIdentitySpec } from './destination-manifest/manifest-types';
import { TENDER_MANIFEST } from './destination-manifest/tender-manifest';
import { computeRowFingerprint as computeStableRowFingerprint } from './row-fingerprint';
import {
  applyTenderFieldPatch,
  ROW_SOURCE_FINGERPRINT_KEY,
  type ComputeRowFingerprint,
  type TenderFieldPatchDeps,
} from './tender-field-patch';
import type {
  JsonObject,
  TenderSourceAuditWrite,
  TenderSourceRecordStore,
  TenderSourceRow,
  TenderSourceUpdateResult,
} from './tender-source-record';

// ─────────────────────────────────────────────────────────────
// Structural fingerprint stand-in (P5 signature; real module is T04-owned)
// ─────────────────────────────────────────────────────────────

const computeRowFingerprint: ComputeRowFingerprint = (row: JsonObject, spec: RowIdentitySpec) =>
  [...new Set(spec.fingerprintFields)]
    .sort()
    .map((field) => String((row as Record<string, unknown>)[field] ?? '').trim().toLowerCase())
    .join('|');

// ─────────────────────────────────────────────────────────────
// Test manifest (pin P1 ids; representative shapes incl. nested "[]")
// ─────────────────────────────────────────────────────────────

const MANIFEST: ProcessManifest = {
  process: 'tender',
  stages: [
    'identified', 'qualification', 'bid_no_bid', 'solution_design', 'pnl_pricing',
    'tender_drafting', 'internal_review', 'approval_matrix', 'final_approved',
    'submitted', 'clarification', 'client_evaluation', 'negotiation', 'awarded',
    'lost_withdrawn',
  ],
  fields: [
    {
      id: 't:sow_data.overview.description',
      process: 'tender', stage: 'identified', tab: 'Customer Snapshot',
      label: 'Scope overview', type: 'text', nullBehavior: 'empty_string',
      persistencePath: 'sow_data.overview.description',
      uiOwner: 'src/components/tender/ScopeOfWorkCapture.tsx',
      evidence: 'sidecar', pdfConsumer: 'not_exported',
    },
    {
      id: 't:sow_data.service_lines[].description',
      process: 'tender', stage: 'identified', tab: 'Customer Snapshot',
      label: 'Service line description', type: 'text', nullBehavior: 'empty_string',
      persistencePath: 'sow_data.service_lines[].description',
      uiOwner: 'src/components/tender/ScopeOfWorkCapture.tsx',
      rowIdentity: { fingerprintFields: ['name'] },
      evidence: 'sidecar', pdfConsumer: 'not_exported',
    },
    {
      id: 't:clarification.qa_log[]',
      process: 'tender', stage: 'clarification', tab: 'Q&A Log',
      label: 'Q&A entry', type: 'object', nullBehavior: 'omit',
      persistencePath: 'clarification.qa_log[]',
      uiOwner: 'src/components/tender/ClarificationStage.tsx',
      rowIdentity: { fingerprintFields: ['question'] },
      evidence: 'sidecar', pdfConsumer: 'not_exported',
    },
    {
      id: 't:solution_design_data.sla_kpi.kpis[].target',
      process: 'tender', stage: 'solution_design', tab: 'SLA / KPI Model',
      label: 'KPI target', type: 'text', nullBehavior: 'empty_string',
      persistencePath: 'solution_design_data.sla_kpi.kpis[].target',
      uiOwner: 'src/components/tender/SLAKPIModelTab.tsx',
      rowIdentity: { fingerprintFields: ['kpi_name'] },
      evidence: 'sidecar', pdfConsumer: ['annexure_sla'],
    },
    {
      id: 't:pricing.scenarios.selected_scenario.selected_scenario_id',
      process: 'tender', stage: 'pnl_pricing', tab: 'Pricing Scenarios',
      label: 'Selected scenario', type: 'id_ref', nullBehavior: 'null',
      persistencePath: 'pricing.scenarios.selected_scenario.selected_scenario_id',
      uiOwner: 'src/components/tender/PricingScenariosTab.tsx',
      evidence: 'sidecar', pdfConsumer: ['pricing_table_single', 'totals_words'],
    },
    // Deliberately hostile entry: proves the P9 guard refuses tracker paths
    // even if a manifest ever carried one.
    {
      id: 't:internal_stage',
      process: 'tender', stage: 'identified', tab: 'Tender Summary',
      label: 'FORBIDDEN tracker', type: 'text', nullBehavior: 'omit',
      persistencePath: 'internal_stage',
      uiOwner: 'src/pages/TenderWorkspace.tsx',
      evidence: 'none', pdfConsumer: 'not_exported',
    },
  ],
};

// ─────────────────────────────────────────────────────────────
// Stateful in-memory store (house standard: records ops, enforces
// the updated_at predicate exactly like PostgREST .eq())
// ─────────────────────────────────────────────────────────────

interface FakeStoreOptions {
  failAudit?: boolean;
  /** Evil store: silently drop this top-level type_details key on update. */
  dropFacetOnWrite?: string;
}

function seedTypeDetails(): JsonObject {
  return {
    sow_data: {
      overview: { description: 'original overview', region: 'Riyadh' },
      service_lines: [
        { id: 'legacy-1724500000000', name: 'Warehousing', description: 'legacy WH text' },
        { id: 'legacy-0.5731', name: 'Transport', description: 'legacy TR text' },
      ],
      decoy_sibling: { untouched: true },
    },
    pricing: {
      scenarios: {
        rows: [{ id: 'sc-1', scenario_name: 'Base', revenue: '1200000' }],
        selected_scenario: { selected_scenario_id: 'sc-1', note: 'keep me' },
      },
      commercial_terms: { rows: [{ term: 'Payment', value: '30 days' }] },
    },
    solution_design_data: {
      sla_kpi: {
        kpis: [
          { kpi_name: 'OTIF', target: '95%', measurement_method: 'Monthly report' },
          { kpi_name: 'Accuracy', target: '99%', measurement_method: 'Cycle count' },
        ],
        governance: { review_frequency: 'Monthly' },
      },
      hop: { model: 'untouched' },
    },
    clarification: { qa_log: [{ id: 'q-1', question: 'Existing question?', answer: 'Existing answer' }] },
    documents: [{ id: 'doc-1', name: 'RFQ.pdf' }],
  };
}

function makeStore(options: FakeStoreOptions = {}) {
  let revision = 'rev-1';
  let revisionCounter = 1;
  const row: TenderSourceRow = {
    id: 'tender-1',
    ticket_type: 'tender',
    active: true,
    updated_at: revision,
    type_details: seedTypeDetails(),
  };
  const updates: JsonObject[] = [];
  const audits: TenderSourceAuditWrite[] = [];

  const store: TenderSourceRecordStore = {
    async readActiveTender(tenderId: string) {
      if (tenderId !== row.id) return null;
      return { ...row };
    },
    async updateActiveTender(args): Promise<TenderSourceUpdateResult> {
      if (args.tenderId !== row.id) return { status: 'not_found' };
      // PostgREST-style predicate: zero rows when the token moved.
      if (args.expectedRevision !== row.updated_at) return { status: 'stale' };
      updates.push(args.patch);
      for (const [key, value] of Object.entries(args.patch)) {
        if (key === 'type_details' && options.dropFacetOnWrite) {
          const clone = { ...(value as JsonObject) };
          delete clone[options.dropFacetOnWrite];
          row.type_details = clone;
        } else {
          (row as JsonObject)[key] = value as unknown;
        }
      }
      revisionCounter += 1;
      revision = `rev-${revisionCounter}`;
      row.updated_at = revision;
      return { status: 'saved', row: { ...row } };
    },
    async insertAudit(event) {
      if (options.failAudit) return { error: 'audit insert refused (test)' };
      audits.push(event);
      return { id: `audit-${audits.length}` };
    },
    async listAudit() {
      return [];
    },
  };

  return {
    store,
    updates,
    audits,
    get row() { return row; },
    get revision() { return revision; },
  };
}

function makeDeps(store: TenderSourceRecordStore): TenderFieldPatchDeps {
  return { store, computeRowFingerprint };
}

const ACTOR = { id: 'user-1', name: 'Amin Al-Rashid' };

function details(row: TenderSourceRow): JsonObject {
  return row.type_details as JsonObject;
}

// ─────────────────────────────────────────────────────────────
// Sibling preservation (the mandated no-sibling-loss proof)
// ─────────────────────────────────────────────────────────────

describe('applyTenderFieldPatch — no sibling loss', () => {
  it('patches one nested leaf and preserves every sibling at every level', async () => {
    const fake = makeStore();
    const before = JSON.parse(JSON.stringify(details(fake.row)));

    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.overview.description', value: 'patched overview' }],
    });

    expect(outcome.status).toBe('saved');
    const after = details(fake.row);
    // Addressed leaf changed…
    expect((after.sow_data as any).overview.description).toBe('patched overview');
    // …its in-facet siblings and every other facet are byte-identical.
    before.sow_data.overview.description = 'patched overview';
    expect(after).toEqual(before);
  });

  it('unaddressed facets keep their ORIGINAL references (copy-on-write proof)', async () => {
    const fake = makeStore();
    const seededDetails = details(fake.row);
    const untouchedFacet = seededDetails.pricing;
    const untouchedSiblingInFacet = (seededDetails.sow_data as any).decoy_sibling;

    await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.overview.description', value: 'cow-proof' }],
    });

    // The store received exactly ONE update whose type_details reuses the
    // untouched branches by reference (deep-copy would break this).
    const sent = fake.updates[0].type_details as JsonObject;
    expect(sent.pricing).toBe(untouchedFacet);
    expect((sent.sow_data as any).decoy_sibling).toBe(untouchedSiblingInFacet);
  });

  it('the update payload contains ONLY type_details (never tracker columns)', async () => {
    const fake = makeStore();
    await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [
        { fieldId: 't:pricing.scenarios.selected_scenario.selected_scenario_id', value: 'sc-9' },
      ],
    });
    expect(fake.updates).toHaveLength(1);
    expect(Object.keys(fake.updates[0])).toEqual(['type_details']);
    expect(fake.updates[0]).not.toHaveProperty('internal_stage');
    expect(fake.updates[0]).not.toHaveProperty('crm_pipeline_stage');
  });

  it('array sibling rows survive a row-leaf patch byte-for-byte, legacy ids intact', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{
        fieldId: 't:sow_data.service_lines[].description',
        value: 'extracted WH description',
        rowFingerprints: [computeRowFingerprint({ name: 'Warehousing' }, { fingerprintFields: ['name'] })],
      }],
    });

    expect(outcome.status).toBe('saved');
    const lines = (details(fake.row).sow_data as any).service_lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      id: 'legacy-1724500000000',
      name: 'Warehousing',
      description: 'extracted WH description',
    });
    // The untouched legacy sibling row is byte-identical.
    expect(lines[1]).toEqual({ id: 'legacy-0.5731', name: 'Transport', description: 'legacy TR text' });
  });
});

// ─────────────────────────────────────────────────────────────
// Repeated-row idempotency (ADR-05: replay updates, never duplicates)
// ─────────────────────────────────────────────────────────────

describe('applyTenderFieldPatch — repeated-row replay', () => {
  const qaFingerprint = computeRowFingerprint(
    { question: 'What is the SLA?' },
    { fingerprintFields: ['question'] },
  );

  it('appends an unmatched row once, stamped with its source fingerprint', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{
        fieldId: 't:clarification.qa_log[]',
        value: { question: 'What is the SLA?', answer: '95% OTIF' },
        rowFingerprints: [qaFingerprint],
      }],
    });

    expect(outcome.status).toBe('saved');
    const log = (details(fake.row).clarification as any).qa_log;
    expect(log).toHaveLength(2);
    expect(log[1][ROW_SOURCE_FINGERPRINT_KEY]).toBe(qaFingerprint);
    // The pre-existing human row is untouched.
    expect(log[0]).toEqual({ id: 'q-1', question: 'Existing question?', answer: 'Existing answer' });
  });

  it('replaying the same extraction twice updates in place — zero duplicates', async () => {
    const fake = makeStore();
    const patchOf = (answer: string) => ({
      fieldId: 't:clarification.qa_log[]',
      value: { question: 'What is the SLA?', answer },
      rowFingerprints: [qaFingerprint],
    });

    const first = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1', expectedRevision: 'rev-1', actor: ACTOR, patches: [patchOf('95% OTIF')],
    });
    const second = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1', expectedRevision: first.newRevision!, actor: ACTOR, patches: [patchOf('97% OTIF (revised)')],
    });

    expect(second.status).toBe('saved');
    const log = (details(fake.row).clarification as any).qa_log;
    expect(log).toHaveLength(2); // 1 human row + 1 extracted row, after TWO replays
    expect(log[1].answer).toBe('97% OTIF (revised)');
  });

  it('replay matches a manually created row via the computed fallback (no stamp needed)', async () => {
    const fake = makeStore();
    const fingerprint = computeRowFingerprint({ kpi_name: 'OTIF' }, { fingerprintFields: ['kpi_name'] });

    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{
        fieldId: 't:solution_design_data.sla_kpi.kpis[].target',
        value: '96.5%',
        rowFingerprints: [fingerprint],
      }],
    });

    expect(outcome.status).toBe('saved');
    const kpis = (details(fake.row).solution_design_data as any).sla_kpi.kpis;
    expect(kpis).toHaveLength(2); // updated, not appended
    expect(kpis[0]).toMatchObject({ kpi_name: 'OTIF', target: '96.5%', measurement_method: 'Monthly report' });
    expect(kpis[1].target).toBe('99%');
    // Sibling section of the same facet is untouched.
    expect((details(fake.row).solution_design_data as any).sla_kpi.governance)
      .toEqual({ review_frequency: 'Monthly' });
    expect((details(fake.row).solution_design_data as any).hop).toEqual({ model: 'untouched' });
  });
});

describe('applyTenderFieldPatch — real Tender primitive collections', () => {
  it('preserves a primitive service-line value and replays without duplication', async () => {
    const fake = makeStore();
    (details(fake.row).sow_data as JsonObject).service_lines = ['Warehousing'];
    const spec = TENDER_MANIFEST.fields.find(
      (field) => field.id === 't:sow_data.service_lines[]',
    )!.rowIdentity!;
    const fingerprint = computeStableRowFingerprint({ value: 'Warehousing' }, spec);
    const deps: TenderFieldPatchDeps = {
      store: fake.store,
      computeRowFingerprint: computeStableRowFingerprint,
    };

    const first = await applyTenderFieldPatch(TENDER_MANIFEST, deps, {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{
        fieldId: 't:sow_data.service_lines[]',
        value: 'Warehousing',
        rowFingerprints: [fingerprint],
      }],
    });
    const second = await applyTenderFieldPatch(TENDER_MANIFEST, deps, {
      ticketId: 'tender-1',
      expectedRevision: first.newRevision!,
      actor: ACTOR,
      patches: [{
        fieldId: 't:sow_data.service_lines[]',
        value: '  Warehousing  ',
        rowFingerprints: [fingerprint],
      }],
    });

    expect(first.status).toBe('saved');
    expect(second.status).toBe('saved');
    expect((details(fake.row).sow_data as JsonObject).service_lines)
      .toEqual(['  Warehousing  ']);
  });

  it('matches an existing document at the outer level and appends one primitive stage label', async () => {
    const fake = makeStore();
    const document = {
      document_name: 'RFQ.pdf',
      storage_path: 'tenders/tender-1/RFQ.pdf',
      version: '1',
      notes: 'keep this human note',
      stage_relevance: ['identified'],
    };
    details(fake.row).documents = [document];
    const outerDescriptor = TENDER_MANIFEST.fields.find(
      (field) => field.id === 't:documents[]',
    )!;
    const innerDescriptor = TENDER_MANIFEST.fields.find(
      (field) => field.id === 't:documents[].stage_relevance[]',
    )!;
    const outerFingerprint = computeStableRowFingerprint(document, outerDescriptor.rowIdentity!);
    const innerFingerprint = computeStableRowFingerprint(
      { value: 'qualification' },
      innerDescriptor.rowIdentity!,
    );
    const deps: TenderFieldPatchDeps = {
      store: fake.store,
      computeRowFingerprint: computeStableRowFingerprint,
    };

    const first = await applyTenderFieldPatch(TENDER_MANIFEST, deps, {
      ticketId: 'tender-1', expectedRevision: 'rev-1', actor: ACTOR,
      patches: [{
        fieldId: 't:documents[].stage_relevance[]',
        value: 'qualification',
        rowFingerprints: [outerFingerprint, innerFingerprint],
      }],
    });
    const second = await applyTenderFieldPatch(TENDER_MANIFEST, deps, {
      ticketId: 'tender-1', expectedRevision: first.newRevision!, actor: ACTOR,
      patches: [{
        fieldId: 't:documents[].stage_relevance[]',
        value: 'qualification',
        rowFingerprints: [outerFingerprint, innerFingerprint],
      }],
    });

    expect(second.status).toBe('saved');
    expect(details(fake.row).documents).toEqual([{
      ...document,
      stage_relevance: ['identified', 'qualification'],
    }]);
  });
});

// ─────────────────────────────────────────────────────────────
// Refusals, guards, honesty
// ─────────────────────────────────────────────────────────────

describe('applyTenderFieldPatch — refusals and honest outcomes', () => {
  it('refuses tracker paths before any read or write (pin P9)', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:internal_stage', value: 'awarded' }],
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/tracker immunity/i);
    expect(fake.updates).toHaveLength(0);
    expect(fake.row.updated_at).toBe('rev-1');
  });

  it('refuses an unknown fieldId with zero writes', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:not.in.manifest', value: 1 }],
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/not in the tender manifest/i);
    expect(fake.updates).toHaveLength(0);
  });

  it('refuses a fingerprint-count mismatch with zero writes', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.service_lines[].description', value: 'x' }], // 1 [] level, 0 fingerprints
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/repeated level/i);
    expect(fake.updates).toHaveLength(0);
  });

  it('a stale revision token refuses non-destructively', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-0-stale',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.overview.description', value: 'must not land' }],
    });
    expect(outcome.status).toBe('stale');
    expect(fake.updates).toHaveLength(0);
    expect((details(fake.row).sow_data as any).overview.description).toBe('original overview');
  });

  it('an audit failure is reported as saved_with_audit_warning, never silent', async () => {
    const fake = makeStore({ failAudit: true });
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.overview.description', value: 'saved but audit warned' }],
    });
    expect(outcome.status).toBe('saved_with_audit_warning');
    expect((details(fake.row).sow_data as any).overview.description).toBe('saved but audit warned');
  });

  it('a store that drops the value fails read-back — no fabricated success', async () => {
    const fake = makeStore({ dropFacetOnWrite: 'sow_data' });
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.overview.description', value: 'never verifiable' }],
    });
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toMatch(/read-back verification failed/i);
  });

  it('a multi-facet batch chains revisions and reports per-facet outcomes', async () => {
    const fake = makeStore();
    const outcome = await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [
        { fieldId: 't:sow_data.overview.description', value: 'batch A' },
        { fieldId: 't:pricing.scenarios.selected_scenario.selected_scenario_id', value: 'sc-1b' },
      ],
    });
    expect(outcome.status).toBe('saved');
    expect(outcome.facets.map((f) => f.facet)).toEqual(['sow_data', 'pricing']);
    expect(fake.updates).toHaveLength(2);
    expect(outcome.newRevision).toBe(fake.revision);
    // Second facet write preserved the first facet's new value.
    expect((details(fake.row).sow_data as any).overview.description).toBe('batch A');
    expect((details(fake.row).pricing as any).scenarios.selected_scenario)
      .toEqual({ selected_scenario_id: 'sc-1b', note: 'keep me' });
  });

  it('audit rows carry leaf-level canonical paths', async () => {
    const fake = makeStore();
    await applyTenderFieldPatch(MANIFEST, makeDeps(fake.store), {
      ticketId: 'tender-1',
      expectedRevision: 'rev-1',
      actor: ACTOR,
      patches: [{ fieldId: 't:sow_data.overview.description', value: 'audited' }],
    });
    expect(fake.audits).toHaveLength(1);
    expect(fake.audits[0].changedFieldPaths).toEqual(['type_details.sow_data.overview.description']);
    expect(fake.audits[0].actorName).toBe('Amin Al-Rashid');
  });
});
