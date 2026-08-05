/**
 * proposal-workspace-state.test.ts — SC-01 Wave 04 / T08-B correction pass.
 *
 * These are the decisions that used to live inside pages/ProposalWorkspace.tsx
 * as inline JSX expressions. There is no jsdom in this package, so component
 * rendering cannot be asserted; the decisions were extracted so the RULE can
 * be asserted even though the markup cannot.
 *
 * Each block names the defect it locks down.
 */

import { describe, expect, it } from 'vitest';
import {
  resolveWorkspaceReadState,
  readCustomerRisk,
  filterSupportingDocs,
  formatRecordedDate,
} from './proposal-workspace-state';

describe('resolveWorkspaceReadState — defect B: a read failure is not a missing record', () => {
  it('reports loading while any read is still in flight', () => {
    expect(resolveWorkspaceReadState({ loading: true, workspace: null, errors: [] }))
      .toEqual({ kind: 'loading' });
  });

  it('reports loading even when an error is already present — the page must not flash "not found"', () => {
    expect(resolveWorkspaceReadState({ loading: true, workspace: null, errors: ['boom'] }))
      .toEqual({ kind: 'loading' });
  });

  it('reports not_found ONLY when the read finished, returned nothing, and reported no error', () => {
    expect(resolveWorkspaceReadState({ loading: false, workspace: null, errors: [null, undefined, ''] }))
      .toEqual({ kind: 'not_found' });
  });

  it('reports read_failed with the reason when the hook surfaced an error', () => {
    expect(resolveWorkspaceReadState({
      loading: false,
      workspace: null,
      errors: ['Request timed out after 8000ms'],
    })).toEqual({ kind: 'read_failed', reason: 'Request timed out after 8000ms' });
  });

  it('reports read_failed when the fetcher swallowed the error and only recorded it out-of-band', () => {
    // fetchProposalWorkspaceById returns null on a PostgREST/RLS failure and
    // records the message through setFetchError. That channel must still make
    // the difference visible to the human.
    const state = resolveWorkspaceReadState({
      loading: false,
      workspace: null,
      errors: [null, 'permission denied for table commercial_tickets'],
    });
    expect(state).toEqual({
      kind: 'read_failed',
      reason: 'permission denied for table commercial_tickets',
    });
    expect(state.kind).not.toBe('not_found');
  });

  it('reports loaded when a record came back, regardless of unrelated error noise', () => {
    expect(resolveWorkspaceReadState({
      loading: false,
      workspace: { id: 'a1100000-0000-4000-8000-000000000040' },
      errors: ['an unrelated earlier failure'],
    })).toEqual({ kind: 'loaded' });
  });
});

describe('readCustomerRisk — defect A: no verdict from a value that was never read', () => {
  it('returns no verdict at all when there is no customer record', () => {
    expect(readCustomerRisk(null)).toEqual({
      paymentRisk: null,
      dsoDays: null,
      dsoBand: null,
      verdict: null,
      tone: 'neutral',
    });
  });

  it('does NOT produce "healthy" from an absent payment status', () => {
    // The removed defect: the page built { paymentStatus: 'Good', dso: 0 } as
    // an object literal and rendered "Healthy customer profile" + "0 days".
    const readout = readCustomerRisk({ dso: null, paymentStatus: null });
    expect(readout.verdict).toBeNull();
    expect(readout.dsoDays).toBeNull();
    expect(readout.tone).toBe('neutral');
  });

  it('withholds the verdict when payment status is stored but DSO is not', () => {
    const readout = readCustomerRisk({ dso: null, paymentStatus: 'Good' });
    expect(readout.paymentRisk).toBe('Low');
    expect(readout.dsoBand).toBeNull();
    expect(readout.verdict).toBeNull();
  });

  it('withholds the verdict when DSO is stored but payment status is not', () => {
    const readout = readCustomerRisk({ dso: 12, paymentStatus: null });
    expect(readout.dsoDays).toBe(12);
    expect(readout.dsoBand).toBe('Healthy');
    expect(readout.verdict).toBeNull();
  });

  it('reports a healthy verdict only when BOTH values are actually stored', () => {
    expect(readCustomerRisk({ dso: 21, paymentStatus: 'Good' })).toEqual({
      paymentRisk: 'Low',
      dsoDays: 21,
      dsoBand: 'Healthy',
      verdict: 'Recorded payment behaviour is healthy',
      tone: 'green',
    });
  });

  it('escalates on a stored bad payment status', () => {
    const readout = readCustomerRisk({ dso: 20, paymentStatus: 'Bad' });
    expect(readout.paymentRisk).toBe('High');
    expect(readout.tone).toBe('red');
  });

  it('escalates on a stored critical DSO even when payment status is good', () => {
    const readout = readCustomerRisk({ dso: 95, paymentStatus: 'Good' });
    expect(readout.dsoBand).toBe('Critical');
    expect(readout.tone).toBe('red');
  });

  it('treats a real stored DSO of 0 as data, not as absence', () => {
    const readout = readCustomerRisk({ dso: 0, paymentStatus: 'Acceptable' });
    expect(readout.dsoDays).toBe(0);
    expect(readout.dsoBand).toBe('Healthy');
    expect(readout.tone).toBe('amber'); // driven by the payment status, not the DSO
  });

  it('ignores a non-finite DSO rather than rendering NaN days', () => {
    expect(readCustomerRisk({ dso: Number.NaN, paymentStatus: 'Good' }).dsoDays).toBeNull();
  });

  it('does not invent a risk band from an unrecognised payment status', () => {
    // The removed code mapped ANY value that was not "Good"/"Acceptable" to
    // "High", so an empty string read as a high-risk customer.
    expect(readCustomerRisk({ dso: 10, paymentStatus: '' }).paymentRisk).toBeNull();
    expect(readCustomerRisk({ dso: 10, paymentStatus: 'unknown' }).paymentRisk).toBeNull();
  });
});

describe('filterSupportingDocs — defect D: one figure per meaning', () => {
  const docs = [
    { id: '1', category: 'Insurance' },
    { id: '2', category: 'Trade License' },
    { id: '3', category: 'Insurance' },
  ];

  it('returns every doc for the "all" selection', () => {
    expect(filterSupportingDocs(docs, 'all')).toHaveLength(3);
  });

  it('returns only the selected category', () => {
    expect(filterSupportingDocs(docs, 'Insurance').map(d => d.id)).toEqual(['1', '3']);
  });

  it('gives the counter and the list the SAME set — the count cannot exceed what renders', () => {
    const rendered = filterSupportingDocs(docs, 'Trade License');
    expect(rendered.length).toBe(1);
    // The pre-filter length was the old counter; it must no longer be the figure shown.
    expect(rendered.length).not.toBe(docs.length);
  });

  it('returns an empty list, not everything, for a category with no documents', () => {
    expect(filterSupportingDocs(docs, 'Bank Guarantee')).toEqual([]);
  });

  it('does not mutate the source list', () => {
    const copy = filterSupportingDocs(docs, 'all');
    copy.pop();
    expect(docs).toHaveLength(3);
  });
});

describe('formatRecordedDate — defect F: "Invalid Date" must never reach the screen', () => {
  it('formats a real ISO timestamp', () => {
    expect(formatRecordedDate('2026-06-22T10:00:00.000Z')).toBe(
      new Date('2026-06-22T10:00:00.000Z').toLocaleDateString(),
    );
  });

  it('returns null for an unparseable value instead of the string "Invalid Date"', () => {
    // toLocaleDateString RETURNS "Invalid Date" rather than throwing, which is
    // why the previous try/catch around it was not a guard.
    expect(new Date('not-a-date').toLocaleDateString()).toBe('Invalid Date');
    expect(formatRecordedDate('not-a-date')).toBeNull();
  });

  it('returns null for absent values', () => {
    expect(formatRecordedDate(null)).toBeNull();
    expect(formatRecordedDate(undefined)).toBeNull();
    expect(formatRecordedDate('')).toBeNull();
  });

  it('never returns the literal "Invalid Date" for any junk input', () => {
    for (const junk of ['', '   ', 'yesterday', {}, [], Number.NaN, new Date('x')]) {
      expect(formatRecordedDate(junk as unknown)).not.toBe('Invalid Date');
    }
  });

  it('supports a datetime style for audit rows', () => {
    const iso = '2026-06-22T10:00:00.000Z';
    expect(formatRecordedDate(iso, 'datetime')).toBe(new Date(iso).toLocaleString());
  });
});
