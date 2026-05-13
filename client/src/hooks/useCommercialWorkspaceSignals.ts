import { useState, useEffect } from 'react';
import { fetchCommercialSignalSummariesFromSupabase } from '@/lib/supabase-commercial-signals';
import type { 
  CommercialExecutionSignal, 
  CommercialWorkspaceSignalSummary 
} from '@/lib/commercial-workspace-data';

export type SignalDataStatus = 'loading' | 'loaded' | 'error' | 'empty';

export interface UseAllCommercialWorkspaceSignalsResult {
  signals: CommercialExecutionSignal[];
  summaries: Record<string, CommercialWorkspaceSignalSummary>;
  status: SignalDataStatus;
  errorMessage: string;
  reload: () => void;
}

export function useAllCommercialWorkspaceSignals(): UseAllCommercialWorkspaceSignalsResult {
  const [signals, setSignals] = useState<CommercialExecutionSignal[]>([]);
  const [summaries, setSummaries] = useState<Record<string, CommercialWorkspaceSignalSummary>>({});
  const [status, setStatus] = useState<SignalDataStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    fetchCommercialSignalSummariesFromSupabase()
      .then(result => {
        if (cancelled) return;
        if (Object.keys(result.summaries).length === 0) {
          setStatus('empty');
          setSignals([]);
          setSummaries({});
        } else {
          setSignals(result.signals);
          setSummaries(result.summaries);
          setStatus('loaded');
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-005] fetchCommercialSignalSummariesFromSupabase error:', err);
        setErrorMessage(err.message || 'Unknown error');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  return { signals, summaries, status, errorMessage, reload };
}
