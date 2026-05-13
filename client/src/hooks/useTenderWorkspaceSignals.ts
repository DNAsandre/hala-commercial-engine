/**
 * useTenderWorkspaceSignals.ts
 * ─────────────────────────────
 * SUPA-007: React hook that loads Tender Workspace signal summary
 * from Supabase for executive dashboard surfaces.
 *
 * Sources from Supabase-backed signal layer (supabase-tender-signals.ts).
 * Type-only imports from tender-workspace-data.ts (labels/helpers only).
 */

import { useState, useEffect } from 'react';
import {
  getTenderWorkspaceSignalSummaryFromSupabase,
  getAllTenderWorkspaceSignalsFromSupabase,
  getTenderDashboardSignalSummaryFromSupabase,
  type TenderSignalSummary,
} from '@/lib/supabase-tender-signals';

export type SignalStatus = 'loading' | 'loaded' | 'error' | 'empty';

// ─── Single tender signal hook ───────────────────────────────

export interface UseTenderSignalSummaryResult {
  signal: TenderSignalSummary | null;
  status: SignalStatus;
  errorMessage: string;
  reload: () => void;
}

export function useTenderSignalSummary(tenderId: string): UseTenderSignalSummaryResult {
  const [signal, setSignal] = useState<TenderSignalSummary | null>(null);
  const [status, setStatus] = useState<SignalStatus>('loading');
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

    getTenderWorkspaceSignalSummaryFromSupabase(tenderId)
      .then(result => {
        if (cancelled) return;
        setSignal(result);
        setStatus(result ? 'loaded' : 'empty');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-007] Failed to load tender signal summary:', err);
        setErrorMessage(err?.message || 'Unknown error');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [tenderId, reloadKey]);

  return {
    signal,
    status,
    errorMessage,
    reload: () => setReloadKey(k => k + 1),
  };
}

// ─── All tenders signal hook ────────────────────────────────

export interface UseAllTenderSignalsResult {
  signals: TenderSignalSummary[];
  status: SignalStatus;
  errorMessage: string;
  reload: () => void;
}

export function useAllTenderSignals(): UseAllTenderSignalsResult {
  const [signals, setSignals] = useState<TenderSignalSummary[]>([]);
  const [status, setStatus] = useState<SignalStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    getAllTenderWorkspaceSignalsFromSupabase()
      .then(result => {
        if (cancelled) return;
        setSignals(result);
        setStatus('loaded');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-007] Failed to load all tender signals:', err);
        setErrorMessage(err?.message || 'Unknown error');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  return {
    signals,
    status,
    errorMessage,
    reload: () => setReloadKey(k => k + 1),
  };
}

// ─── Dashboard summary hook ──────────────────────────────

export interface UseDashboardSignalSummaryResult {
  signals: TenderSignalSummary[];
  totalTenders: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
  status: SignalStatus;
  errorMessage: string;
  reload: () => void;
}

export function useDashboardSignalSummary(): UseDashboardSignalSummaryResult {
  const [result, setResult] = useState<{
    signals: TenderSignalSummary[];
    totalTenders: number;
    greenCount: number;
    amberCount: number;
    redCount: number;
  }>({ signals: [], totalTenders: 0, greenCount: 0, amberCount: 0, redCount: 0 });
  const [status, setStatus] = useState<SignalStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorMessage('');

    getTenderDashboardSignalSummaryFromSupabase()
      .then(data => {
        if (cancelled) return;
        setResult(data);
        setStatus('loaded');
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[SUPA-007] Failed to load dashboard signal summary:', err);
        setErrorMessage(err?.message || 'Unknown error');
        setStatus('error');
      });

    return () => { cancelled = true; };
  }, [reloadKey]);

  return {
    ...result,
    status,
    errorMessage,
    reload: () => setReloadKey(k => k + 1),
  };
}
