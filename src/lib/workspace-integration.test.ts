/**
 * workspace-integration.test.ts — SC-01 Wave 04 / T08-B correction pass.
 *
 * Contract under test — supporting-document persistence (defect G):
 *   - a submitted request is NOT proof of persistence; every write is awaited
 *     and confirmed from the row the database returned
 *   - an INSERT/UPDATE that matches zero rows returns { error: null } with an
 *     empty row set — that is a failure here, not a success
 *   - the local session record only changes after confirmation, so the human
 *     is never shown a state that was not stored
 *
 * The Supabase mock records the payload, the projection and the filters that
 * actually reach the database, and honours `select` projections. `ECHO` makes
 * it return the row that was written, which is how a confirmed write is
 * simulated without inventing an id the code did not generate.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type MockResult = { data: unknown; error: { message: string } | null } | 'ECHO';

interface RecordedCall {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload: any;
  projection: string | null;
  filters: Array<[string, unknown]>;
}

const sb = {
  calls: [] as RecordedCall[],
  /** key: `${table}:${op}` → result */
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
      const call: RecordedCall = { table, op: 'select', payload: undefined, projection: null, filters: [] };
      sb.calls.push(call);
      const settle = () => {
        const configured = sb.results[`${table}:${call.op}`] ?? { data: null, error: null };
        if (configured === 'ECHO') {
          // The database hands back what was written, merged with the filter
          // for updates (an update payload carries no id of its own).
          const filterFields = Object.fromEntries(call.filters);
          const row = { ...filterFields, ...(call.payload ?? {}) };
          return { data: applyProjection(call.projection, row), error: null };
        }
        return {
          data: configured.error ? null : applyProjection(call.projection, configured.data),
          error: configured.error,
        };
      };
      const builder: any = {
        select: (projection?: string) => { call.projection = projection ?? '*'; return builder; },
        insert: (payload: unknown) => { call.op = 'insert'; call.payload = payload; return builder; },
        update: (payload: unknown) => { call.op = 'update'; call.payload = payload; return builder; },
        eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder; },
        in: () => builder,
        order: () => Promise.resolve(settle()),
        maybeSingle: () => Promise.resolve(settle()),
        then: (resolve: any, reject: any) => Promise.resolve(settle()).then(resolve, reject),
      };
      return builder;
    },
  },
}));

vi.mock('@/lib/auth-state', () => ({
  getCurrentUser: () => ({
    id: 'u-1',
    name: 'Amin Al-Halabi',
    email: 'amin@example.com',
    role: 'admin',
    region: 'Central',
  }),
}));

import {
  uploadSupportingDoc,
  archiveSupportingDoc,
  restoreSupportingDoc,
  getSupportingDocs,
} from './workspace-integration';

const WORKSPACE_ID = 'a1100000-0000-4000-8000-000000000040';

/** Only the writes, in order — `getSupportingDocs` also issues a read. */
function writeCalls() {
  return sb.calls.filter(c => c.op === 'insert' || c.op === 'update');
}

/** Register one document and confirm it, returning its id. */
async function seedConfirmedDoc(name: string): Promise<string> {
  sb.results['generated_documents:insert'] = 'ECHO';
  const result = await uploadSupportingDoc({
    workspaceId: WORKSPACE_ID,
    name,
    fileName: `${name}.pdf`,
    category: 'Other',
  });
  if (!result.ok || !result.doc) throw new Error('seed failed');
  return result.doc.id;
}

beforeAll(async () => {
  // Trip the one-time generated_documents refresh for this workspace up front
  // and let it settle, so later assertions see only the writes under test.
  sb.results['generated_documents:select'] = { data: [], error: null };
  getSupportingDocs(WORKSPACE_ID);
  await Promise.resolve();
  await Promise.resolve();
});

beforeEach(() => {
  sb.calls = [];
  sb.results = { 'generated_documents:select': { data: [], error: null } };
});

describe('uploadSupportingDoc — defect G: success waits for the confirmed row', () => {
  it('returns a promise, so a caller cannot announce success before it settles', () => {
    sb.results['generated_documents:insert'] = 'ECHO';
    const returned = uploadSupportingDoc({
      workspaceId: WORKSPACE_ID, name: 'Y', fileName: 'y.pdf', category: 'Other',
    });
    expect(typeof (returned as Promise<unknown>).then).toBe('function');
    return returned;
  });

  it('sends the metadata row to generated_documents and reads the stored row back', async () => {
    sb.results['generated_documents:insert'] = 'ECHO';
    const result = await uploadSupportingDoc({
      workspaceId: WORKSPACE_ID,
      name: 'Trade License 2026',
      fileName: 'trade-license-2026.pdf',
      category: 'Trade License',
      isRequired: true,
    });

    const insert = writeCalls()[0];
    expect(insert.table).toBe('generated_documents');
    expect(insert.op).toBe('insert');
    expect(insert.payload.workspace_id).toBe(WORKSPACE_ID);
    expect(insert.payload.document_type).toBe('Trade License');
    expect(insert.payload.file_name).toBe('trade-license-2026.pdf');
    expect(insert.payload.generated_by).toBe('u-1');
    // No file content is attached by this entry point, and none is claimed.
    expect(insert.payload.storage_path).toBe('');
    expect(insert.payload.file_size).toBe(0);
    // The write is confirmed from the returned row, not from `{ error: null }`.
    expect(insert.projection).toBe('id,file_name,status');

    expect(result.ok).toBe(true);
    expect(result.doc?.id).toBe(insert.payload.id);
    expect(getSupportingDocs(WORKSPACE_ID).some(d => d.id === insert.payload.id)).toBe(true);
  });

  it('treats a 200 with an empty row set as NOT saved and rolls the session record back', async () => {
    sb.results['generated_documents:insert'] = { data: null, error: null };
    const before = getSupportingDocs(WORKSPACE_ID).length;

    const result = await uploadSupportingDoc({
      workspaceId: WORKSPACE_ID,
      name: 'Insurance 2026',
      fileName: 'insurance-2026.pdf',
      category: 'Insurance',
    });

    expect(result.ok).toBe(false);
    expect(result.doc).toBeNull();
    expect(result.message).toContain('no stored row');
    expect(getSupportingDocs(WORKSPACE_ID).length).toBe(before);
    expect(getSupportingDocs(WORKSPACE_ID).some(d => d.name === 'Insurance 2026')).toBe(false);
  });

  it('rejects a returned row whose id is not the row we inserted', async () => {
    sb.results['generated_documents:insert'] = {
      data: { id: 'some-other-row', file_name: 'a.pdf', status: 'generated' },
      error: null,
    };
    const result = await uploadSupportingDoc({
      workspaceId: WORKSPACE_ID, name: 'Mismatch', fileName: 'a.pdf', category: 'Other',
    });

    expect(result.ok).toBe(false);
    expect(result.doc).toBeNull();
    expect(getSupportingDocs(WORKSPACE_ID).some(d => d.name === 'Mismatch')).toBe(false);
  });

  it('surfaces the database error message and stores nothing', async () => {
    sb.results['generated_documents:insert'] = {
      data: null,
      error: { message: 'new row violates row-level security policy' },
    };
    const before = getSupportingDocs(WORKSPACE_ID).length;

    const result = await uploadSupportingDoc({
      workspaceId: WORKSPACE_ID, name: 'X', fileName: 'x.pdf', category: 'Other',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('new row violates row-level security policy');
    expect(getSupportingDocs(WORKSPACE_ID).length).toBe(before);
  });
});

describe('archive / restore — defect G: no visible state change without a confirmed row', () => {
  it('issues no write at all for a document that is not loaded', async () => {
    const result = await archiveSupportingDoc('not-a-loaded-doc');
    expect(result.ok).toBe(false);
    expect(writeCalls()).toHaveLength(0);
  });

  it('updates generated_documents filtered by the exact document id and reads the status back', async () => {
    const docId = await seedConfirmedDoc('archive-target');
    sb.calls = [];
    sb.results['generated_documents:update'] = 'ECHO';

    const result = await archiveSupportingDoc(docId);

    const update = writeCalls()[0];
    expect(update.table).toBe('generated_documents');
    expect(update.op).toBe('update');
    expect(update.payload).toEqual({ status: 'archived' });
    expect(update.filters).toEqual([['id', docId]]);
    expect(update.projection).toBe('id,status');

    expect(result.ok).toBe(true);
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('archived');
  });

  it('leaves the local status UNCHANGED when the update matched zero rows', async () => {
    const docId = await seedConfirmedDoc('zero-row-target');
    sb.calls = [];
    sb.results['generated_documents:update'] = { data: null, error: null };

    const result = await archiveSupportingDoc(docId);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('nothing was stored');
    // The badge must not flip: the document is still active in the session.
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('active');
  });

  it('rejects a stored status that came back different from the one requested', async () => {
    const docId = await seedConfirmedDoc('mismatch-target');
    sb.calls = [];
    sb.results['generated_documents:update'] = {
      data: { id: docId, status: 'generated' },
      error: null,
    };

    const result = await archiveSupportingDoc(docId);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('stored "generated" instead of "archived"');
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('active');
  });

  it('surfaces the database error and does not change the local status', async () => {
    const docId = await seedConfirmedDoc('error-target');
    sb.calls = [];
    sb.results['generated_documents:update'] = {
      data: null, error: { message: 'permission denied for table generated_documents' },
    };

    const result = await archiveSupportingDoc(docId);

    expect(result.ok).toBe(false);
    expect(result.message).toBe('permission denied for table generated_documents');
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('active');
  });

  it('restores only after the stored status is confirmed back to generated', async () => {
    const docId = await seedConfirmedDoc('restore-target');
    sb.results['generated_documents:update'] = 'ECHO';
    await archiveSupportingDoc(docId);
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('archived');

    sb.calls = [];
    const restored = await restoreSupportingDoc(docId);

    const update = writeCalls()[0];
    expect(update.payload).toEqual({ status: 'generated' });
    expect(update.filters).toEqual([['id', docId]]);
    expect(restored.ok).toBe(true);
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('active');
  });

  it('leaves an archived document archived when the restore is not confirmed', async () => {
    const docId = await seedConfirmedDoc('restore-fail-target');
    sb.results['generated_documents:update'] = 'ECHO';
    await archiveSupportingDoc(docId);

    sb.calls = [];
    sb.results['generated_documents:update'] = { data: null, error: null };
    const restored = await restoreSupportingDoc(docId);

    expect(restored.ok).toBe(false);
    expect(getSupportingDocs(WORKSPACE_ID, true).find(d => d.id === docId)?.status).toBe('archived');
  });
});
