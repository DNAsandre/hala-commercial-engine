/**
 * row-fingerprint.test.ts — PADW T04 (design pin P5, ADR-05).
 *
 * Guards the replay-idempotency contract: the same source item must map to
 * the same fingerprint across extraction replays (spec order, whitespace,
 * casing and string/number drift must not change it), while rows that differ
 * in a declared identity leaf must map to different fingerprints.
 */
import { describe, expect, it } from 'vitest';
import type { RowIdentitySpec } from './destination-manifest/manifest-types';
import { FINGERPRINT_FIELD, computeRowFingerprint } from './row-fingerprint';

const SPEC: RowIdentitySpec = { fingerprintFields: ['description', 'unit', 'qty'] };

const ROW = { description: 'Ambient storage — Riyadh DC', unit: 'pallet', qty: 1500 };

describe('computeRowFingerprint — determinism (replay contract)', () => {
  it('the same row hashed twice yields the same fingerprint', () => {
    expect(computeRowFingerprint(ROW, SPEC)).toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('a structurally-equal clone (JSON round-trip) yields the same fingerprint', () => {
    const clone = JSON.parse(JSON.stringify(ROW));
    expect(computeRowFingerprint(clone, SPEC)).toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('spec declaration order never changes the fingerprint', () => {
    const reversed: RowIdentitySpec = { fingerprintFields: ['qty', 'unit', 'description'] };
    expect(computeRowFingerprint(ROW, reversed)).toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('duplicate field names in a spec are de-duplicated, not double-counted', () => {
    const duplicated: RowIdentitySpec = { fingerprintFields: ['qty', 'qty', 'unit', 'description'] };
    expect(computeRowFingerprint(ROW, duplicated)).toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('row properties OUTSIDE the declared identity leaves do not affect the fingerprint', () => {
    const decorated = { ...ROW, id: `${Date.now()}-local`, notes: 'manual annotation', [FINGERPRINT_FIELD]: 'stale' };
    expect(computeRowFingerprint(decorated, SPEC)).toBe(computeRowFingerprint(ROW, SPEC));
  });
});

describe('computeRowFingerprint — normalization', () => {
  it('whitespace and casing drift map to the same fingerprint', () => {
    const noisy = { description: '  Ambient   STORAGE — Riyadh\tDC ', unit: ' PALLET ', qty: 1500 };
    expect(computeRowFingerprint(noisy, SPEC)).toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('the number 1500 and the string "1500" normalize identically (documented coercion)', () => {
    expect(computeRowFingerprint({ ...ROW, qty: '1500' }, SPEC)).toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('null, undefined and a missing property all mean "absent"', () => {
    const withNull = { description: 'x', unit: null, qty: 3 };
    const withUndefined = { description: 'x', unit: undefined, qty: 3 };
    const missing = { description: 'x', qty: 3 };
    expect(computeRowFingerprint(withNull, SPEC)).toBe(computeRowFingerprint(missing, SPEC));
    expect(computeRowFingerprint(withUndefined, SPEC)).toBe(computeRowFingerprint(missing, SPEC));
  });

  it('-0 normalizes to 0', () => {
    expect(computeRowFingerprint({ ...ROW, qty: -0 }, SPEC)).toBe(computeRowFingerprint({ ...ROW, qty: 0 }, SPEC));
  });

  it('a dot path resolves a nested identity leaf', () => {
    const nestedSpec: RowIdentitySpec = { fingerprintFields: ['description', 'rate.value'] };
    const a = { description: 'lane', rate: { value: 42 } };
    const b = { description: 'lane', rate: { value: 42 }, extra: true };
    const c = { description: 'lane', rate: { value: 43 } };
    expect(computeRowFingerprint(a, nestedSpec)).toBe(computeRowFingerprint(b, nestedSpec));
    expect(computeRowFingerprint(a, nestedSpec)).not.toBe(computeRowFingerprint(c, nestedSpec));
  });
});

describe('computeRowFingerprint — distinctness and collision honesty', () => {
  it('rows differing in a declared leaf get different fingerprints', () => {
    expect(computeRowFingerprint({ ...ROW, qty: 1501 }, SPEC)).not.toBe(computeRowFingerprint(ROW, SPEC));
    expect(computeRowFingerprint({ ...ROW, description: 'Chilled storage — Riyadh DC' }, SPEC))
      .not.toBe(computeRowFingerprint(ROW, SPEC));
    expect(computeRowFingerprint({ ...ROW, unit: 'cbm' }, SPEC)).not.toBe(computeRowFingerprint(ROW, SPEC));
  });

  it('boolean leaves distinguish true from false', () => {
    const spec: RowIdentitySpec = { fingerprintFields: ['name', 'billable'] };
    expect(computeRowFingerprint({ name: 'x', billable: true }, spec))
      .not.toBe(computeRowFingerprint({ name: 'x', billable: false }, spec));
  });

  it('field boundaries cannot shift: {ab, c} never collides with {a, bc}', () => {
    const spec: RowIdentitySpec = { fingerprintFields: ['description', 'unit'] };
    expect(computeRowFingerprint({ description: 'ab', unit: 'c' }, spec))
      .not.toBe(computeRowFingerprint({ description: 'a', unit: 'bc' }, spec));
  });

  it('values that mimic the internal encoding punctuation cannot collide across fields', () => {
    const spec: RowIdentitySpec = { fingerprintFields: ['description', 'unit'] };
    expect(computeRowFingerprint({ description: '3:x', unit: '' }, spec))
      .not.toBe(computeRowFingerprint({ description: '3', unit: ':x' }, spec));
  });

  it('HONEST COLLISION: rows identical in every declared leaf share a fingerprint by design', () => {
    // This is the update-not-duplicate contract — the fingerprint identifies
    // the SOURCE ITEM, not the local row object. Specs must declare the
    // leaves that genuinely distinguish real items.
    const a = { ...ROW, id: 'local-1', notes: 'first import' };
    const b = { ...ROW, id: 'local-2', notes: 'replayed import' };
    expect(computeRowFingerprint(a, SPEC)).toBe(computeRowFingerprint(b, SPEC));
  });
});

describe('computeRowFingerprint — output format and refusals', () => {
  it('returns 16 lowercase hex characters', () => {
    expect(computeRowFingerprint(ROW, SPEC)).toMatch(/^[0-9a-f]{16}$/);
    expect(computeRowFingerprint({}, SPEC)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('an empty fingerprintFields spec is refused (it would collide every row)', () => {
    expect(() => computeRowFingerprint(ROW, { fingerprintFields: [] })).toThrow(/at least one leaf/);
  });

  it('exports the canonical fingerprint row property name', () => {
    expect(FINGERPRINT_FIELD).toBe('_source_fingerprint');
  });
});
