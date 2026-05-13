/**
 * supabase-tender-signals.ts
 * ──────────────────────────
 * SUPA-007: Tender Signal Read Layer — Supabase-backed
 *
 * Replaces getTenderRiskSummary() and getAllTenderExecutionSignals() from
 * tender-workspace-data.ts (which source from static frontend arrays).
 *
 * All signals are derived from live Supabase data via fetchTenderWorkspaceBundle.
 * Source of truth: Supabase tender_* tables, NOT runtime mock stores.
 *
 * Type-only imports from tender-workspace-data.ts (labels/helpers only).
 * No writes. No real submission. No CRM sync. No hard gates.
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
  gatesWouldBlockCount: number;
  criticalGateCount: number;
  splitCheckWarningCount: number;
  submissionEmailStatus: string;
  nextAction: string;
  riskLevel: 'green' | 'amber' | 'red';
  developmentMode: true;
  source: 'Supabase-backed mock data';
}

// ─── Single-tender signal summary ─────────────────────────────

export async function getTenderWorkspaceSignalSummaryFromSupabase(
  tenderId: string
): Promise<TenderSignalSummary | null> {
  const bundle = await fetchTenderWorkspaceBundleFromSupabase(tenderId);
  if (!bundle.tender) return null;

  const { tender, packs, placeholders, requiredDocuments, complianceItems, mockGates, splitChecks, submissionEmails } = bundle;

  // Pack count
  const packCount = packs.length;

  // Placeholder counts
  const placeholderMissingCount = placeholders.filter(
    p => p.status === 'missing' || p.status === 'needs_evidence'
  ).length;

  // Required document counts — native OR signed missing counts as awaiting
  const requiredDocumentsAwaitingCount = requiredDocuments.filter(
    d =>
      d.status === 'awaiting' ||
      d.nativeStatus === 'missing' ||
      d.signedPdfStatus === 'missing'
  ).length;

  // Compliance gap counts
  const complianceGapCount = complianceItems.filter(
    c =>
      c.status === 'non_compliant' ||
      c.status === 'partial' ||
      c.status === 'clarification_required'
  ).length;

  // Gate counts
  const gatesWouldBlockCount = mockGates.filter(g => g.wouldBlock).length;
  const criticalGateCount = mockGates.filter(g => g.severity === 'critical').length;

  // Split check warnings (status = warning or would_block)
  const splitCheckWarningCount = splitChecks.filter(
    c => c.status === 'warning' || c.status === 'would_block'
  ).length;

  // Submission email status — latest email status or 'none'
  const latestEmail = submissionEmails[0];
  const submissionEmailStatus = latestEmail?.status ?? 'none';

  // Risk level
  let riskLevel: 'green' | 'amber' | 'red' = 'green';
  if (gatesWouldBlockCount > 5 || requiredDocumentsAwaitingCount > 5 || criticalGateCount > 0 || complianceGapCount > 5) {
    riskLevel = 'red';
  } else if (gatesWouldBlockCount > 0 || requiredDocumentsAwaitingCount > 0 || placeholderMissingCount > 0 || complianceGapCount > 0) {
    riskLevel = 'amber';
  }

  // Next action logic
  let nextAction = 'Review tender workspace';
  if (criticalGateCount > 0) nextAction = 'Review critical submission gates';
  else if (requiredDocumentsAwaitingCount > 5) nextAction = 'Complete missing required documents';
  else if (complianceGapCount > 3) nextAction = 'Resolve compliance gaps';
  else if (placeholderMissingCount > 3) nextAction = 'Populate missing placeholders';
  else if (gatesWouldBlockCount > 0) nextAction = 'Review submission gates';

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
    gatesWouldBlockCount,
    criticalGateCount,
    splitCheckWarningCount,
    submissionEmailStatus,
    nextAction,
    riskLevel,
    developmentMode: true,
    source: 'Supabase-backed mock data',
  };
}

// ─── All tenders signal summary ─────────────────────────────

export async function getAllTenderWorkspaceSignalsFromSupabase(): Promise<TenderSignalSummary[]> {
  // Fetch all tender IDs from Supabase
  const { data: tenderRows, error } = await supabase.from('tenders').select('id');
  if (error) {
    console.warn('[SUPA-007] getAllTenderWorkspaceSignalsFromSupabase error:', error.message);
    return [];
  }
  const tenderIds = (tenderRows ?? []).map((r: any) => r.id as string);
  if (!tenderIds.length) return [];

  // Fetch summaries in parallel
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
// Used for UI chip wiring that expects TenderRiskSummary shape

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
    gatesWouldBlock: sig.gatesWouldBlockCount,
    criticalGates: sig.criticalGateCount,
    nextAction: sig.nextAction,
    deadline: '2026-06-15',
    daysToDeadline: daysLeft,
    developmentMode: true,
  };
}
