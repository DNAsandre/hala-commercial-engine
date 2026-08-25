/**
 * tender-field-patch.ts — PADW T03t (design pin P3): Tender path-level patch persistence.
 *
 * `applyTenderFieldPatch` is the clean-owned path-level patch API for the Tender
 * process (ADR-02 class of risk, applied to Tender facets): callers address
 * individual leaves by canonical field id (pin P1), and ONLY those leaves are
 * written — every unaddressed sibling at every object AND array level is
 * preserved exactly as stored.
 *
 * Pure-core + injected deps (pin P3): the manifest arrives as a parameter and
 * the persistence layer is the existing exported Tender source-record store
 * (`saveTenderSourceRecord`), so this module needs no manifest data file and no
 * live client at build time. Every write goes through the store's guarded save:
 * exact id, ticket_type='tender', active=true, expectedRevision token, audit
 * row, and honest outcome statuses. After a confirmed save, each patched value
 * is read back from the stored record and verified; a mismatch is reported as
 * 'failed', never as silent success.
 *
 * Repeated rows (pin P5): a patch addresses a row per `[]` segment by source
 * fingerprint. A stored row matches when its `_source_fingerprint` equals the
 * supplied fingerprint, or — at the deepest `[]` segment, where the field's
 * RowIdentitySpec applies — when the injected `computeRowFingerprint` of the
 * stored row equals it (so replay updates a manually created row instead of
 * duplicating it). No match ⇒ a new row is appended carrying the fingerprint
 * under `_source_fingerprint`. The real fingerprint module is T04-owned; this
 * module only declares the signature and receives the function as a dep.
 *
 * TRACKER IMMUNITY (pin P9): this module contains NO code path that writes
 * `crm_pipeline_stage` or `internal_stage`. It never constructs a column patch
 * (all writes are `type_details` facet patches), and any fieldId whose
 * persistence path is rooted at either tracker column is refused before any
 * read or write.
 */
import type {
  FieldDescriptor,
  ProcessManifest,
  RowIdentitySpec,
} from './destination-manifest/manifest-types';
import {
  saveTenderSourceRecord,
  type JsonObject,
  type TenderSourceOrigin,
  type TenderSourceRecordStore,
} from './tender-source-record';

// ─────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────

/** P5 signature (structural copy — the real module is T04-owned `src/lib/row-fingerprint.ts`). */
export type ComputeRowFingerprint = (row: JsonObject, spec: RowIdentitySpec) => string;

export interface TenderFieldPatchDeps {
  /** The existing exported Tender source-record store (guarded facet writes). */
  store: TenderSourceRecordStore;
  /** Injected P5 fingerprint function; integration wires the real T04 module. */
  computeRowFingerprint: ComputeRowFingerprint;
}

export interface TenderFieldPatch {
  /** Canonical field id from the Tender manifest (pin P1), e.g. "t:pricing.scenarios.rows[].revenue". */
  fieldId: string;
  /** The leaf value to store (for a path ending in "[]", the whole row object). */
  value: unknown;
  /** One source fingerprint per "[]" segment in the field's persistencePath, outermost first. */
  rowFingerprints?: readonly string[];
}

export interface TenderFieldPatchRequest {
  ticketId: string;
  /** Revision token the caller read before editing (stale token ⇒ non-destructive refusal). */
  expectedRevision: string;
  actor: { id: string; name: string };
  patches: readonly TenderFieldPatch[];
  /** Audit origin; defaults to 'manual' (no AI activation in this build). */
  origin?: TenderSourceOrigin;
  evidenceIds?: string[];
  suggestionIds?: string[];
  note?: string;
}

export type TenderFieldPatchStatus =
  | 'saved'
  | 'stale'
  | 'not_found'
  | 'failed'
  | 'saved_with_audit_warning';

export interface TenderFacetPatchOutcome {
  /** Top-level type_details facet key this group of patches wrote. */
  facet: string;
  fieldIds: string[];
  status: TenderFieldPatchStatus;
  /** Revision token after this facet's confirmed write (retry token for the caller). */
  newRevision?: string;
  warning?: string;
  error?: string;
}

export interface TenderFieldPatchOutcome {
  /** Worst per-facet status (failed > not_found > stale > saved_with_audit_warning > saved). */
  status: TenderFieldPatchStatus;
  /** One outcome per addressed facet, in first-appearance order. Facets apply atomically and independently. */
  facets: TenderFacetPatchOutcome[];
  /** Latest confirmed revision token across successful facet writes. */
  newRevision?: string;
  warning?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Internals — path parsing and validation (no I/O)
// ─────────────────────────────────────────────────────────────

/** Pin P9: no code in this wave may move either tracker. Guarded here in addition to manifest validation. */
const FORBIDDEN_ROOT_KEYS = new Set(['crm_pipeline_stage', 'internal_stage']);

/** Fingerprint key appended rows carry so extraction replay updates instead of duplicating. */
export const ROW_SOURCE_FINGERPRINT_KEY = '_source_fingerprint';

interface PathSegment {
  key: string;
  isArray: boolean;
}

interface ResolvedPatch {
  patch: TenderFieldPatch;
  descriptor: FieldDescriptor;
  segments: PathSegment[];
  fingerprints: readonly string[];
  /** Identity contract for each "[]" level, outermost first. */
  levelSpecs: readonly RowIdentitySpec[];
  /** Index (among fingerprints) of the deepest "[]" segment; -1 when the path has none. */
  lastFingerprintIndex: number;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function objectOrEmpty(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function parsePersistencePath(path: string): PathSegment[] | null {
  const parts = path.split('.');
  const segments: PathSegment[] = [];
  for (const part of parts) {
    const isArray = part.endsWith('[]');
    const key = isArray ? part.slice(0, -2) : part;
    if (!key.trim() || key.includes('[') || key.includes(']')) return null;
    segments.push({ key, isArray });
  }
  return segments.length ? segments : null;
}

/**
 * Resolves every patch against the manifest BEFORE any read or write. Any
 * resolution problem refuses the whole request with the exact offending id —
 * never a partial silent success.
 */
function resolvePatches(
  manifest: ProcessManifest,
  patches: readonly TenderFieldPatch[],
): { resolved: ResolvedPatch[] } | { error: string } {
  const byId = new Map(manifest.fields.map((field) => [field.id, field]));
  const resolved: ResolvedPatch[] = [];
  for (const patch of patches) {
    const descriptor = byId.get(patch.fieldId);
    if (!descriptor) {
      return { error: `Unknown fieldId "${patch.fieldId}" — it is not in the ${manifest.process} manifest. No patch was applied.` };
    }
    const segments = parsePersistencePath(descriptor.persistencePath);
    if (!segments) {
      return { error: `Field "${patch.fieldId}" has an unusable persistencePath "${descriptor.persistencePath}". No patch was applied.` };
    }
    if (FORBIDDEN_ROOT_KEYS.has(segments[0].key)) {
      return { error: `Field "${patch.fieldId}" paths into "${segments[0].key}". This module never writes crm_pipeline_stage or internal_stage (tracker immunity). No patch was applied.` };
    }
    const fingerprints = patch.rowFingerprints ?? [];
    const arrayCount = segments.filter((segment) => segment.isArray).length;
    if (fingerprints.length !== arrayCount) {
      return { error: `Field "${patch.fieldId}" addresses ${arrayCount} repeated level(s) but ${fingerprints.length} row fingerprint(s) were supplied. No patch was applied.` };
    }
    if (fingerprints.some((fingerprint) => typeof fingerprint !== 'string' || !fingerprint.trim())) {
      return { error: `Field "${patch.fieldId}" was given an empty row fingerprint. No patch was applied.` };
    }
    const levelSpecs: RowIdentitySpec[] = [];
    let walked = '';
    let arrayIndex = 0;
    for (const segment of segments) {
      walked = walked ? `${walked}.${segment.key}${segment.isArray ? '[]' : ''}` : `${segment.key}${segment.isArray ? '[]' : ''}`;
      if (!segment.isArray) continue;
      const collectionDescriptor = manifest.fields.find(
        (field) => field.persistencePath === walked && field.rowIdentity,
      );
      const isDeepest = arrayIndex === arrayCount - 1;
      const spec = collectionDescriptor?.rowIdentity ?? (isDeepest ? descriptor.rowIdentity : undefined);
      if (!spec) {
        return { error: `Field "${patch.fieldId}" has no row identity for repeated level "${walked}". No patch was applied.` };
      }
      levelSpecs.push(spec);
      arrayIndex += 1;
    }
    const endsWithArray = segments[segments.length - 1].isArray;
    const primitiveCollection = descriptor.type === 'array'
      && descriptor.rowIdentity?.fingerprintFields.includes('value');
    if (endsWithArray && !isObject(patch.value) && !primitiveCollection) {
      return { error: `Field "${patch.fieldId}" addresses a whole repeated row, so its value must be an object. No patch was applied.` };
    }
    resolved.push({
      patch,
      descriptor,
      segments,
      fingerprints,
      levelSpecs,
      lastFingerprintIndex: arrayCount - 1,
    });
  }
  return { resolved };
}

// ─────────────────────────────────────────────────────────────
// Internals — copy-on-write deep set + read-back (no I/O)
// ─────────────────────────────────────────────────────────────

function matchRowIndex(
  rows: readonly unknown[],
  fingerprint: string,
  spec: RowIdentitySpec | undefined,
  compute: ComputeRowFingerprint,
): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isObject(row) && row[ROW_SOURCE_FINGERPRINT_KEY] === fingerprint) return i;
  }
  if (spec) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const fingerprintRow = isObject(row) ? row : { value: row };
        if (compute(fingerprintRow, spec) === fingerprint) return i;
      } catch {
        // A row the fingerprint function cannot process simply does not match.
      }
    }
  }
  return -1;
}

/** Object rows carry a stored fingerprint; primitive collection values remain primitive. */
function wholeRowValue(value: unknown, fingerprint: string): unknown {
  return isObject(value)
    ? { ...value, [ROW_SOURCE_FINGERPRINT_KEY]: fingerprint }
    : value;
}

/**
 * Copy-on-write deep set: rebuilds ONLY the addressed branch; every unaddressed
 * sibling keeps its original reference (object and array levels alike).
 */
function setAddressedLeaf(
  container: unknown,
  segments: readonly PathSegment[],
  resolved: ResolvedPatch,
  fingerprintIndex: number,
  compute: ComputeRowFingerprint,
): JsonObject {
  const [segment, ...rest] = segments;
  const base = objectOrEmpty(container);
  if (!segment.isArray) {
    if (rest.length === 0) return { ...base, [segment.key]: resolved.patch.value };
    return {
      ...base,
      [segment.key]: setAddressedLeaf(base[segment.key], rest, resolved, fingerprintIndex, compute),
    };
  }
  const currentRows = Array.isArray(base[segment.key]) ? (base[segment.key] as unknown[]) : [];
  const fingerprint = resolved.fingerprints[fingerprintIndex];
  const index = matchRowIndex(
    currentRows,
    fingerprint,
    resolved.levelSpecs[fingerprintIndex],
    compute,
  );
  const rows = [...currentRows];
  if (rest.length === 0) {
    const row = wholeRowValue(resolved.patch.value, fingerprint);
    if (index >= 0) rows[index] = row;
    else rows.push(row);
  } else if (index >= 0) {
    rows[index] = setAddressedLeaf(rows[index], rest, resolved, fingerprintIndex + 1, compute);
  } else {
    rows.push(
      setAddressedLeaf({ [ROW_SOURCE_FINGERPRINT_KEY]: fingerprint }, rest, resolved, fingerprintIndex + 1, compute),
    );
  }
  return { ...base, [segment.key]: rows };
}

function readAddressedLeaf(
  container: unknown,
  segments: readonly PathSegment[],
  resolved: ResolvedPatch,
  fingerprintIndex: number,
  compute: ComputeRowFingerprint,
): { found: boolean; value?: unknown } {
  const [segment, ...rest] = segments;
  if (!isObject(container)) return { found: false };
  if (!segment.isArray) {
    if (rest.length === 0) {
      return segment.key in container ? { found: true, value: container[segment.key] } : { found: false };
    }
    return readAddressedLeaf(container[segment.key], rest, resolved, fingerprintIndex, compute);
  }
  const rows = container[segment.key];
  if (!Array.isArray(rows)) return { found: false };
  const fingerprint = resolved.fingerprints[fingerprintIndex];
  const index = matchRowIndex(
    rows,
    fingerprint,
    resolved.levelSpecs[fingerprintIndex],
    compute,
  );
  if (index < 0) return { found: false };
  if (rest.length === 0) return { found: true, value: rows[index] };
  return readAddressedLeaf(rows[index], rest, resolved, fingerprintIndex + 1, compute);
}

function deepEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEquals(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every((key) => key in b && deepEquals(a[key], b[key]));
  }
  return false;
}

/** The value read-back must find for a patch (whole-row patches carry their fingerprint). */
function expectedStoredValue(resolved: ResolvedPatch): unknown {
  const last = resolved.segments[resolved.segments.length - 1];
  return last.isArray
    ? wholeRowValue(resolved.patch.value, resolved.fingerprints[resolved.lastFingerprintIndex])
    : resolved.patch.value;
}

// ─────────────────────────────────────────────────────────────
// Facet application (read-current → deep-set → guarded write → read-back)
// ─────────────────────────────────────────────────────────────

const STALE_MESSAGE =
  'Tender changed after this edit began. Review the current value and retry without losing your entry.';

async function applyFacetGroup(
  deps: TenderFieldPatchDeps,
  req: TenderFieldPatchRequest,
  facet: string,
  group: ResolvedPatch[],
  expectedRevision: string,
): Promise<TenderFacetPatchOutcome> {
  const base = { facet, fieldIds: group.map((resolved) => resolved.patch.fieldId) };

  let row;
  try {
    row = await deps.store.readActiveTender(req.ticketId);
  } catch (error) {
    return { ...base, status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  if (!row) {
    return { ...base, status: 'not_found', error: 'Active Tender not found. No change was applied to this facet.' };
  }
  if (row.id !== req.ticketId || row.ticket_type !== 'tender' || row.active !== true) {
    return { ...base, status: 'not_found', error: 'The requested record is not the active Tender identity. No change was applied to this facet.' };
  }
  if (row.updated_at !== expectedRevision) {
    return { ...base, status: 'stale', error: STALE_MESSAGE };
  }

  // Deep-set ONLY the addressed leaves into the stored facet (copy-on-write).
  let working = objectOrEmpty(row.type_details);
  for (const resolved of group) {
    working = setAddressedLeaf(working, resolved.segments, resolved, 0, deps.computeRowFingerprint);
  }

  const result = await saveTenderSourceRecord(deps.store, {
    tenderId: req.ticketId,
    expectedRevision,
    typeDetailsPatch: { [facet]: working[facet] },
    changedFieldPaths: group.map((resolved) => `type_details.${resolved.descriptor.persistencePath}`),
    actor: req.actor,
    origin: req.origin ?? 'manual',
    evidenceIds: req.evidenceIds,
    suggestionIds: req.suggestionIds,
    note: req.note,
  });

  if (!result.success) {
    const status: TenderFieldPatchStatus =
      result.status === 'stale' ? 'stale'
        : result.status === 'not_found' || result.status === 'invalid_identity' ? 'not_found'
          : 'failed';
    return {
      ...base,
      status,
      newRevision: result.newRevision?.token,
      warning: result.warning,
      error: result.error ?? result.warning ?? `Tender facet save refused (${result.status}).`,
    };
  }

  // Read-back verification: every patched value must be present in the stored record.
  const storedDetails = objectOrEmpty(result.aggregate?.typeDetails);
  for (const resolved of group) {
    const readBack = readAddressedLeaf(storedDetails, resolved.segments, resolved, 0, deps.computeRowFingerprint);
    if (!readBack.found || !deepEquals(readBack.value, expectedStoredValue(resolved))) {
      return {
        ...base,
        status: 'failed',
        newRevision: result.newRevision?.token,
        error: `Read-back verification failed for "${resolved.patch.fieldId}": the stored value does not match the requested value. The write was attempted — review the current record before retrying.`,
      };
    }
  }

  if (result.status === 'saved_with_audit_warning') {
    return { ...base, status: 'saved_with_audit_warning', newRevision: result.newRevision?.token, warning: result.warning };
  }
  return { ...base, status: 'saved', newRevision: result.newRevision?.token };
}

// ─────────────────────────────────────────────────────────────
// Public API (pin P3)
// ─────────────────────────────────────────────────────────────

const STATUS_SEVERITY: Record<TenderFieldPatchStatus, number> = {
  failed: 4,
  not_found: 3,
  stale: 2,
  saved_with_audit_warning: 1,
  saved: 0,
};

function worstStatus(facets: readonly TenderFacetPatchOutcome[]): TenderFieldPatchStatus {
  let worst: TenderFieldPatchStatus = 'saved';
  for (const facet of facets) {
    if (STATUS_SEVERITY[facet.status] > STATUS_SEVERITY[worst]) worst = facet.status;
  }
  return worst;
}

function joined(parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length ? kept.join(' | ') : undefined;
}

function requestRefusal(error: string): TenderFieldPatchOutcome {
  return { status: 'failed', facets: [], error };
}

/**
 * Applies path-level field patches to ONE active Tender. Patches are grouped by
 * top-level `type_details` facet; each facet applies atomically through the
 * guarded source-record save (exact id, ticket_type='tender', active=true,
 * expectedRevision) with read-back verification, and reports its own outcome.
 */
export async function applyTenderFieldPatch(
  manifest: ProcessManifest,
  deps: TenderFieldPatchDeps,
  req: TenderFieldPatchRequest,
): Promise<TenderFieldPatchOutcome> {
  if (!req.ticketId?.trim()) {
    return requestRefusal('A Tender ticket id is required. No patch was applied.');
  }
  if (!req.expectedRevision?.trim()) {
    return requestRefusal('The revision token read before editing is required. No patch was applied.');
  }
  if (!req.patches.length) {
    return requestRefusal('At least one field patch is required. No patch was applied.');
  }

  const resolution = resolvePatches(manifest, req.patches);
  if ('error' in resolution) return requestRefusal(resolution.error);

  const groups = new Map<string, ResolvedPatch[]>();
  for (const resolved of resolution.resolved) {
    const facet = resolved.segments[0].key;
    const group = groups.get(facet);
    if (group) group.push(resolved);
    else groups.set(facet, [resolved]);
  }

  const facets: TenderFacetPatchOutcome[] = [];
  let currentRevision = req.expectedRevision;
  let latestConfirmedRevision: string | undefined;
  for (const [facet, group] of groups) {
    const outcome = await applyFacetGroup(deps, req, facet, group, currentRevision);
    facets.push(outcome);
    if (outcome.newRevision && (outcome.status === 'saved' || outcome.status === 'saved_with_audit_warning')) {
      currentRevision = outcome.newRevision;
      latestConfirmedRevision = outcome.newRevision;
    }
  }

  return {
    status: worstStatus(facets),
    facets,
    newRevision: latestConfirmedRevision,
    warning: joined(facets.map((facet) => facet.warning)),
    error: joined(facets.map((facet) => (facet.error ? `${facet.facet}: ${facet.error}` : undefined))),
  };
}
