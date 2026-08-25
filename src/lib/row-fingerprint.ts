/**
 * row-fingerprint.ts — PADW T04, design pin P5 (consumed by T03), ADR-05.
 *
 * Stable source fingerprints for repeated destination rows. A repeated `[]`
 * destination declares WHICH leaves identify a source item via its manifest
 * RowIdentitySpec; this module turns those leaves into one deterministic hash
 * so extraction replay can RECOGNIZE an already-populated item and update it
 * instead of appending a duplicate (Date.now()/nanoid row ids cannot do this).
 *
 * Determinism contract:
 *   - fingerprintFields are de-duplicated and sorted — spec declaration order
 *     never changes the result;
 *   - strings are trimmed, internal whitespace collapsed, lowercased — the
 *     same source item survives OCR/manual spacing and casing drift;
 *   - numbers/booleans/bigints stringify canonically (`-0` → `"0"`), so the
 *     number 15 and the string "15" normalize identically ON PURPOSE — an
 *     extractor may deliver either for the same source cell;
 *   - null / undefined / missing all normalize to "" (absent is absent);
 *   - segments are length-prefixed before hashing, so no value can shift a
 *     field boundary and collide with a differently-split row.
 *
 * Collision honesty:
 *   - Two rows identical in every DECLARED fingerprint field share a
 *     fingerprint BY DESIGN — that is the update-not-duplicate contract. Specs
 *     must name the leaves that genuinely distinguish real source items.
 *   - The hash is 64-bit FNV-1a: non-cryptographic, and an accidental
 *     collision between rows that differ in a declared field is possible in
 *     principle (~n²/2⁶⁵). At register scale (tens to hundreds of rows) this
 *     is negligible, but it is not zero and callers must not treat the
 *     fingerprint as a security boundary.
 *   - Non-primitive leaf values (objects/arrays) are JSON-stringified verbatim
 *     (insertion-order sensitive). fingerprintFields should name primitive
 *     leaves; nested leaves are addressable with dot paths instead.
 */
import type { RowIdentitySpec } from './destination-manifest/manifest-types';

/** Row property under which callers may store the computed fingerprint. */
export const FINGERPRINT_FIELD = '_source_fingerprint';

const FNV64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x00000100000001b3n;
const U64_MASK = 0xffffffffffffffffn;

function fnv1a64Hex(payload: string): string {
  let hash = FNV64_OFFSET_BASIS;
  for (let i = 0; i < payload.length; i++) {
    hash ^= BigInt(payload.charCodeAt(i));
    hash = (hash * FNV64_PRIME) & U64_MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : String(value);
  if (typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  // Non-primitive leaf — documented uncertainty (see module header).
  return JSON.stringify(value) ?? '';
}

/**
 * Resolve a fingerprint field on the row. A literal property wins; otherwise
 * a dot path ("rate.value") walks nested objects. Anything unresolvable is
 * treated as absent — never a throw, so replay stays deterministic.
 */
function resolveField(row: Record<string, unknown>, field: string): unknown {
  if (field in row) return row[field];
  let current: unknown = row;
  for (const segment of field.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Deterministic stable fingerprint of the row's declared identity leaves.
 * Identical source item ⇒ identical fingerprint across replays; the returned
 * value is 16 lowercase hex characters.
 */
export function computeRowFingerprint(row: Record<string, unknown>, spec: RowIdentitySpec): string {
  const fields = [...new Set(spec.fingerprintFields)].sort();
  if (fields.length === 0) {
    throw new Error(
      'RowIdentitySpec.fingerprintFields must name at least one leaf — an empty spec would give every row the same fingerprint.',
    );
  }
  let payload = '';
  for (const field of fields) {
    const normalized = normalizeValue(resolveField(row, field));
    // Length prefixes make the encoding unambiguous: no value can shift a
    // field boundary into a neighbouring segment.
    payload += `${field.length}:${field}:${normalized.length}:${normalized};`;
  }
  return fnv1a64Hex(payload);
}
