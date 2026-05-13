/**
 * useTenderWorkspaceData.ts
 * ─────────────────────────
 * SUPA-006: React hook that loads the full Tender Workspace bundle
 * from Supabase and provides it to components.
 *
 * Replaces direct calls to getTenderWorkspaceById() from tender-workspace-data.ts.
 * No silent fallback to in-memory mock data.
 */

import { useState, useEffect } from 'react';
import {
  fetchTenderWorkspaceBundleFromSupabase,
  bundleToTenderWorkspace,
  type TenderWorkspaceBundle,
} from '@/lib/supabase-tender-data';
import type { TenderWorkspace } from '@/lib/tender-workspace-data';

export type TenderDataStatus = 'loading' | 'loaded' | 'error' | 'empty';

export interface UseTenderWorkspaceDataResult {
  /** Full workspace assembled from Supabase bundle */
  ws: TenderWorkspace | null;
  /** Raw bundle for component-level data access */
  bundle: TenderWorkspaceBundle | null;
  /** Current loading status */
  status: TenderDataStatus;
  /** Error message if status === 'error' */
  errorMessage: string;
  /** Trigger a reload */
  reload: () => void;
}

export function useTenderWorkspaceData(tenderId: string): UseTenderWorkspaceDataResult {
  const [bundle, setBundle] = useState<TenderWorkspaceBundle | null>(null);
  const [ws, setWs] = useState<TenderWorkspace | null>(null);
  const [status, setStatus] = useState<TenderDataStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!tenderId) {
      setStatus('empty');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    fetchTenderWorkspaceBundleFromSupabase(tenderId)
      .then(result => {
        if (cancelled) return;
        if (!result.tender) {
          setBundle(result);
          setWs(null);
          setStatus('empty');
        } else {
          setBundle(result);
          setWs(bundleToTenderWorkspace(result));
          setStatus('loaded');
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-006] Failed to load tender workspace data:', err);
        setErrorMessage(err?.message || 'Unknown error');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [tenderId, reloadKey]);

  return {
    ws,
    bundle,
    status,
    errorMessage,
    reload: () => setReloadKey(k => k + 1),
  };
}
