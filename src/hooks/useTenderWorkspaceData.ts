/**
 * useTenderWorkspaceData.ts
 * ─────────────────────────
 * SUPA-006: React hook that loads the full Tender Workspace bundle
 * from Supabase and provides it to components.
 *
 * Replaces direct calls to getTenderWorkspaceById() from tender-workspace-data.ts.
 * No silent fallback to in-memory mock data.
 *
 * W04-T08-A additions:
 *   - the loaded bundle is stored together with the tender id it belongs to, so
 *     data from a previously viewed tender can never be handed out under a
 *     different :id in the URL;
 *   - the four load outcomes (loaded / not_found / isolated / error) are carried
 *     through instead of collapsing into "empty".
 */

import { useState, useEffect } from 'react';
import {
  fetchTenderWorkspaceBundleFromSupabase,
  bundleToTenderWorkspace,
  type TenderWorkspaceBundle,
} from '@/lib/supabase-tender-data';
import type { TenderWorkspace } from '@/lib/tender-workspace-data';

export type TenderDataStatus = 'loading' | 'loaded' | 'error' | 'empty' | 'isolated';

export interface UseTenderWorkspaceDataResult {
  /** Full workspace assembled from Supabase bundle */
  ws: TenderWorkspace | null;
  /** Raw bundle for component-level data access */
  bundle: TenderWorkspaceBundle | null;
  /** Current loading status */
  status: TenderDataStatus;
  /** Human-readable explanation for 'error', 'empty' and 'isolated' */
  errorMessage: string;
  /** Trigger a reload */
  reload: () => void;
}

/** What the hook has loaded, tagged with the identity it was loaded for. */
export interface LoadedTenderState {
  tenderId: string;
  bundle: TenderWorkspaceBundle;
  ws: TenderWorkspace | null;
  status: Exclude<TenderDataStatus, 'loading'>;
  errorMessage: string;
}

/**
 * Identity guard, extracted so it can be tested without a DOM.
 *
 * A loaded state is only usable for the tender it was loaded for. Returning
 * `loaded.ws` for a different `tenderId` would render one tender's customer,
 * owner, value, tasks and documents under another tender's URL.
 */
export function selectTenderWorkspaceView(
  loaded: LoadedTenderState | null,
  tenderId: string,
): { ws: TenderWorkspace | null; bundle: TenderWorkspaceBundle | null; status: TenderDataStatus; errorMessage: string } {
  if (!loaded || loaded.tenderId !== tenderId) {
    return { ws: null, bundle: null, status: 'loading', errorMessage: '' };
  }
  return { ws: loaded.ws, bundle: loaded.bundle, status: loaded.status, errorMessage: loaded.errorMessage };
}

/** Translate the bundle's load outcome into the hook's status contract. */
export function statusFromBundle(bundle: TenderWorkspaceBundle): {
  status: Exclude<TenderDataStatus, 'loading'>;
  errorMessage: string;
} {
  switch (bundle.loadState.kind) {
    case 'loaded':
      return bundle.tender
        ? { status: 'loaded', errorMessage: '' }
        : { status: 'error', errorMessage: 'Tender bundle reported success without a tender record.' };
    case 'isolated':
      return { status: 'isolated', errorMessage: bundle.loadState.message };
    case 'error':
      return { status: 'error', errorMessage: bundle.loadState.message };
    case 'not_found':
      return { status: 'empty', errorMessage: bundle.loadState.message };
  }
}

export function useTenderWorkspaceData(tenderId: string): UseTenderWorkspaceDataResult {
  const [loaded, setLoaded] = useState<LoadedTenderState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!tenderId) {
      setLoaded(null);
      return;
    }

    let cancelled = false;

    fetchTenderWorkspaceBundleFromSupabase(tenderId)
      .then(result => {
        if (cancelled) return;
        const { status, errorMessage } = statusFromBundle(result);
        setLoaded({
          tenderId,
          bundle: result,
          ws: status === 'loaded' ? bundleToTenderWorkspace(result) : null,
          status,
          errorMessage,
        });
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-006] Failed to load tender workspace data:', err);
        setLoaded({
          tenderId,
          bundle: null as unknown as TenderWorkspaceBundle,
          ws: null,
          status: 'error',
          errorMessage: err?.message || 'Unknown error',
        });
      });

    return () => { cancelled = true; };
  }, [tenderId, reloadKey]);

  const view = selectTenderWorkspaceView(loaded, tenderId);

  return {
    ws: view.ws,
    bundle: view.bundle,
    // An empty :id is not "still loading" — nothing was ever requested.
    status: !tenderId ? 'empty' : view.status,
    errorMessage: !tenderId ? 'No tender id was supplied in the route.' : view.errorMessage,
    reload: () => setReloadKey(k => k + 1),
  };
}
