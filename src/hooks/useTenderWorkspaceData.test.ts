/**
 * useTenderWorkspaceData.test.ts — SC-01 Wave 04 / ticket T08-A (agent W04-T08-A).
 *
 * The route /tenders/:id renders the SAME component instance when the id
 * changes, so anything the hook still holds from the previous tender would be
 * rendered under the new tender's URL. These cover the two pure pieces of that
 * contract without a DOM:
 *   - identity   → loaded state is only ever handed out for the id it was
 *                  loaded for
 *   - honesty    → the four bundle outcomes stay four distinct statuses
 */

import { describe, expect, it } from 'vitest';
import { selectTenderWorkspaceView, statusFromBundle, type LoadedTenderState } from './useTenderWorkspaceData';
import type { TenderWorkspaceBundle } from '@/lib/supabase-tender-data';
import type { TenderWorkspace } from '@/lib/tender-workspace-data';

const TENDER_A = 'a1200000-0000-4000-8000-000000000001';
const TENDER_B = 'a1200000-0000-4000-8000-000000000002';

function loadedState(tenderId: string): LoadedTenderState {
  const ws = {
    tender: { id: tenderId, customerName: `customer of ${tenderId}` },
    crmPipelineStageRaw: 'qualified',
  } as unknown as TenderWorkspace;
  return {
    tenderId,
    bundle: { requestedTenderId: tenderId, loadState: { kind: 'loaded' } } as TenderWorkspaceBundle,
    ws,
    status: 'loaded',
    errorMessage: '',
  };
}

describe('selectTenderWorkspaceView — identity does not leak between tenders', () => {
  it('hands out the workspace for the tender it was loaded for', () => {
    const view = selectTenderWorkspaceView(loadedState(TENDER_A), TENDER_A);
    expect(view.status).toBe('loaded');
    expect(view.ws?.tender.id).toBe(TENDER_A);
  });

  it('refuses to hand tender A data out under tender B — it reports loading instead', () => {
    const view = selectTenderWorkspaceView(loadedState(TENDER_A), TENDER_B);
    expect(view.ws).toBeNull();
    expect(view.bundle).toBeNull();
    expect(view.status).toBe('loading');
  });

  it('does not leak an error message across identities either', () => {
    const errored: LoadedTenderState = {
      tenderId: TENDER_A,
      bundle: null as unknown as TenderWorkspaceBundle,
      ws: null,
      status: 'error',
      errorMessage: 'permission denied',
    };
    expect(selectTenderWorkspaceView(errored, TENDER_B).errorMessage).toBe('');
    expect(selectTenderWorkspaceView(errored, TENDER_A).errorMessage).toBe('permission denied');
  });

  it('reports loading before anything has been loaded', () => {
    expect(selectTenderWorkspaceView(null, TENDER_A).status).toBe('loading');
  });
});

describe('statusFromBundle — loading, empty, isolated and error stay distinguishable', () => {
  const base = { requestedTenderId: TENDER_A } as TenderWorkspaceBundle;

  it('maps a loaded bundle with a tender to "loaded"', () => {
    expect(statusFromBundle({ ...base, loadState: { kind: 'loaded' }, tender: {} as any })).toEqual({
      status: 'loaded',
      errorMessage: '',
    });
  });

  it('maps an absent row to "empty" and keeps the explanation', () => {
    const out = statusFromBundle({ ...base, loadState: { kind: 'not_found', message: 'no active row visible' }, tender: null } as TenderWorkspaceBundle);
    expect(out.status).toBe('empty');
    expect(out.errorMessage).toBe('no active row visible');
  });

  it('maps a read failure to "error", never to "empty"', () => {
    const out = statusFromBundle({ ...base, loadState: { kind: 'error', message: 'permission denied' }, tender: null } as TenderWorkspaceBundle);
    expect(out.status).toBe('error');
    expect(out.status).not.toBe('empty');
    expect(out.errorMessage).toBe('permission denied');
  });

  it('maps a skipped read to "isolated", never to "empty"', () => {
    const out = statusFromBundle({ ...base, loadState: { kind: 'isolated', message: 'no read was attempted' }, tender: null } as TenderWorkspaceBundle);
    expect(out.status).toBe('isolated');
    expect(out.status).not.toBe('empty');
    expect(out.errorMessage).toBe('no read was attempted');
  });

  it('does not report success for a "loaded" bundle that carries no tender', () => {
    const out = statusFromBundle({ ...base, loadState: { kind: 'loaded' }, tender: null } as TenderWorkspaceBundle);
    expect(out.status).toBe('error');
  });
});
