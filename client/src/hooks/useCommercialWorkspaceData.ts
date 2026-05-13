/**
 * useCommercialWorkspaceData.ts
 * ─────────────────────────────
 * SUPA-003: React hook that loads the full Commercial Workspace bundle
 * from Supabase and provides it to components.
 *
 * Replaces direct imports from commercial-workspace-data.ts.
 * No silent fallback to in-memory mock data.
 */

import { useState, useEffect } from 'react';
import {
  fetchCommercialWorkspaceBundle,
  type CommercialWorkspaceBundle,
} from '@/lib/supabase-commercial-data';

export type CommercialDataStatus = 'loading' | 'loaded' | 'error' | 'empty';

export interface UseCommercialWorkspaceDataResult {
  /** Full workspace bundle from Supabase */
  bundle: CommercialWorkspaceBundle | null;
  /** Current loading status */
  status: CommercialDataStatus;
  /** Error message if status === 'error' */
  errorMessage: string;
  /** Reload the bundle */
  reload: () => void;
}

export function useCommercialWorkspaceData(workspaceId: string): UseCommercialWorkspaceDataResult {
  const [bundle, setBundle] = useState<CommercialWorkspaceBundle | null>(null);
  const [status, setStatus] = useState<CommercialDataStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!workspaceId) {
      setStatus('empty');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    fetchCommercialWorkspaceBundle(workspaceId)
      .then(result => {
        if (cancelled) return;
        if (result.scenarios.length === 0) {
          // Supabase returned no data for this workspace
          setBundle(result);
          setStatus('empty');
        } else {
          setBundle(result);
          setStatus('loaded');
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-003] Failed to load commercial workspace data:', err);
        setErrorMessage(err?.message || 'Unknown error');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [workspaceId, reloadKey]);

  return {
    bundle,
    status,
    errorMessage,
    reload: () => setReloadKey(k => k + 1),
  };
}
