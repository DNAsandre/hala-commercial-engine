/**
 * supabase-tender-signals.ts
 * ──────────────────────────
 * SUPA-007: Tender Signal Read Layer — Supabase-backed
 *
 * Derives advisory signals from live Supabase data.
 * ALL signals are informational only — flag → explain → recommend.
 * Nothing blocks. Nothing locks. Everything is overridable.
 *
 * Doctrine: signal-only. No gates. No enforcement. No prisons.
 */

import { supabase } from './supabase';
import { fetchTenderWorkspaceBundleFromSupabase } from './supabase-tender-data';
import type { TenderRiskSummary, TenderExecutionSignal } from './tender-workspace-data';

// ─── Derived signal types ─────────────────────────────────────

export interface TenderSignalSummary {
  tenderId: string;
  tenderTitle: string;
  customerName: string;
  tenderValue: number;
  readinessScore: number;
  packCount: number;
  placeholderMissingCount: number;
  requiredDocumentsAwaitingCount: number;
  complianceGapCount: number;
  /** @deprecated use readinessSignalCount */
  gatesWouldBlockCount: number;
  /** Signals flagged for review — advisory only, never blocking */
  readinessSignalCount: number;
  criticalSignalCount: number;
  splitCheckWarningCount: number;
  submissionEmailStatus: string;
  nextAction: string;
  riskLevel: 'green' | 'amber' | 'red';
  developmentMode: boolean;
  source: string;
}

// ─── Single-tender signal summary ─────────────────────────────

export async function getTenderWorkspaceSignalSummaryFromSupabase(
  tenderId: string
): Promise<TenderSignalSummary | null> {
  const bundle = await fetchTenderWorkspaceBundleFromSupabase(tenderId);
  if (!bundle.tender) return null;

  const { tender, packs, placeholders, requiredDocuments, complianceItems, mockGates, splitChecks, submissionEmails } = bundle;

  const packCount = packs.length;

  const placeholderMissingCount = placeholders.filter(
    p => p.status === 'missing' || p.status === 'needs_evidence'
  ).length;

  const requiredDocumentsAwaitingCount = requiredDocuments.filter(
    d =>
      d.status === 'awaiting' ||
      d.nativeStatus === 'missing' ||
      d.signedPdfStatus === 'missing'
  ).length;

  const complianceGapCount = complianceItems.filter(
    c =>
      c.status === 'non_compliant' ||
      c.status === 'partial' ||
      c.status === 'clarification_required'
  ).length;

  // Advisory signals — items flagged for review, never blocking
  const readinessSignalCount = mockGates.filter(g => g.needsReview === true || g.wouldBlock === true).length;
  const criticalSignalCount = mockGates.filter(g => g.severity === 'critical').length;

  const splitCheckWarningCount = splitChecks.filter(
    c => c.status === 'warning' || c.status === 'would_block'
  ).length;

  const latestEmail = submissionEmails[0];
  const submissionEmailStatus = latestEmail?.status ?? 'none';

  // Risk level — advisory signal, not enforcement
  let riskLevel: 'green' | 'amber' | 'red' = 'green';
  if (readinessSignalCount > 5 || requiredDocumentsAwaitingCount > 5 || criticalSignalCount > 0 || complianceGapCount > 5) {
    riskLevel = 'red';
  } else if (readinessSignalCount > 0 || requiredDocumentsAwaitingCount > 0 || placeholderMissingCount > 0 || complianceGapCount > 0) {
    riskLevel = 'amber';
  }

  // Next action — recommendation, not requirement
  let nextAction = 'Review tender workspace';
  if (criticalSignalCount > 0) nextAction = 'Review critical readiness signals';
  else if (requiredDocumentsAwaitingCount > 5) nextAction = 'Complete missing required documents';
  else if (complianceGapCount > 3) nextAction = 'Resolve compliance gaps';
  else if (placeholderMissingCount > 3) nextAction = 'Populate missing placeholders';
  else if (readinessSignalCount > 0) nextAction = 'Review submission readiness signals';

  return {
    tenderId: tender.id,
    tenderTitle: tender.title,
    customerName: tender.customerName,
    tenderValue: tender.estimatedValue,
    readinessScore: bundle.readinessScore,
    packCount,
    placeholderMissingCount,
    requiredDocumentsAwaitingCount,
    complianceGapCount,
    gatesWouldBlockCount: readinessSignalCount, // backward-compat alias
    readinessSignalCount,
    criticalSignalCount,
    splitCheckWarningCount,
    submissionEmailStatus,
    nextAction,
    riskLevel,
    developmentMode: false,
    source: 'Supabase commercial_tickets',
  };
}

// ─── All tenders signal summary ─────────────────────────────

export async function getAllTenderWorkspaceSignalsFromSupabase(): Promise<TenderSignalSummary[]> {
  const { data: tenderRows, error } = await supabase
    .from('commercial_tickets')
    .select('id')
    .eq('ticket_type', 'tender')
    .eq('active', true)
    .neq('lineage_status', 'rejected');
  if (error) {
    console.warn('[SUPA-007] getAllTenderWorkspaceSignalsFromSupabase error:', error.message);
    return [];
  }
  const tenderIds = (tenderRows ?? []).map((r: any) => r.id as string);
  if (!tenderIds.length) return [];

  const results = await Promise.all(
    tenderIds.map(id => getTenderWorkspaceSignalSummaryFromSupabase(id))
  );
  return results.filter((r): r is TenderSignalSummary => r !== null);
}

// ─── Dashboard-specific summary ─────────────────────────────

export async function getTenderDashboardSignalSummaryFromSupabase(): Promise<{
  signals: TenderSignalSummary[];
  totalTenders: number;
  greenCount: number;
  amberCount: number;
  redCount: number;
}> {
  const signals = await getAllTenderWorkspaceSignalsFromSupabase();
  return {
    signals,
    totalTenders: signals.length,
    greenCount: signals.filter(s => s.riskLevel === 'green').length,
    amberCount: signals.filter(s => s.riskLevel === 'amber').length,
    redCount: signals.filter(s => s.riskLevel === 'red').length,
  };
}

// ─── Convert TenderSignalSummary → TenderRiskSummary ──────────

export function signalSummaryToRiskSummary(sig: TenderSignalSummary): TenderRiskSummary {
  const daysLeft = Math.ceil(
    (new Date('2026-06-15').getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return {
    tenderId: sig.tenderId,
    tenderTitle: sig.tenderTitle,
    customerName: sig.customerName,
    readinessScore: sig.readinessScore,
    riskLevel: sig.riskLevel,
    packCount: sig.packCount,
    packLabel: `${sig.packCount} pack${sig.packCount !== 1 ? 's' : ''}`,
    missingPlaceholders: sig.placeholderMissingCount,
    missingDocuments: sig.requiredDocumentsAwaitingCount,
    complianceGaps: sig.complianceGapCount,
    gatesWouldBlock: sig.readinessSignalCount,
    criticalGates: sig.criticalSignalCount,
    nextAction: sig.nextAction,
    deadline: '2026-06-15',
    daysToDeadline: daysLeft,
    developmentMode: true,
  };
}
