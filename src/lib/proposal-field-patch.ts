/**
 * PADW T03p — Proposal path-level patch persistence (ADR-02 closure).
 *
 * The existing per-stage saver (`saveProposalStageData` in
 * proposal-workspace-persistence.ts) REPLACES the whole stage `data` envelope.
 * That is correct for the human workbench, which always submits the complete
 * stage, but unsafe for a caller that holds only extracted fields: omitted
 * sibling groups and leaves would be erased (ADR-02 in
 * docs/ai-destination-readiness/TENDER-PROPOSAL-AI-DESTINATION-READINESS-AUDIT.md).
 *
 * `applyProposalFieldPatch` fixes this WITHOUT touching the existing writer:
 * per stage envelope it reads the CURRENT stored stage data from one exact
 * snapshot (id + ticket_type='proposal' + active=true, with revision), deep-sets
 * ONLY the explicitly addressed leaves into that current data, and hands the
 * merged COMPLETE envelope to the existing per-stage save contract (exact id,
 * process ticket type, active-row targeting, revision token, read-back, audit).
 * Every unaddressed sibling — object groups and array rows alike — is preserved
 * byte-for-byte because it travels through the saver unchanged.
 *
 * Design pins honoured (Fable-owned, .padw-evidence/DESIGN-PINS.md):
 *  - P1: field ids are `p:<persistencePath>` rooted at
 *        commercial_tickets.type_details.proposal_workspace.
 *  - P3: pure core + injected deps (snapshot loader, stage saver, fingerprint
 *        fn are all mockable); typed outcomes; honest audit-warning status.
 *  - P5: repeated rows are addressed by the injected row fingerprint
 *        (update-vs-append, `_source_fingerprint` stamped on rows this module
 *        creates or upserts).
 *  - P8: no gates, no AI, no schema change — JSONB facet writes only.
 *  - P9: tracker immunity — no patch may reach `crm_pipeline_stage` or
 *        `internal_stage` (hard-guarded here AND structurally impossible,
 *        because the only write surface is a stage envelope saver).
 */

import type {
  FieldDescriptor,
  ProcessManifest,
  RowIdentitySpec,
} from "./destination-manifest/manifest-types";
import type {
  ProposalCommercialApprovalStageData,
  ProposalContractSignedStageData,
  ProposalDiscoveryStageData,
  ProposalDraftingStageData,
  ProposalGoLiveStageData,
  ProposalNegotiationStageData,
  ProposalPnlPricingStageData,
  ProposalQualifiedStageData,
  ProposalQuoteStageData,
  ProposalSentStageData,
  ProposalSolutionDesignStageData,
  ProposalStageSaveOptions,
  ProposalStageSaveResult,
  ProposalWorkspaceSnapshot,
} from "./proposal-workspace-persistence";
import {
  loadProposalWorkspaceSnapshot,
  saveProposalCommercialApprovalStageData,
  saveProposalContractSignedStageData,
  saveProposalDiscoveryStageData,
  saveProposalDraftingStageData,
  saveProposalGoLiveStageData,
  saveProposalNegotiationStageData,
  saveProposalPnlPricingStageData,
  saveProposalQualifiedStageData,
  saveProposalQuoteStageData,
  saveProposalSentStageData,
  saveProposalSolutionDesignStageData,
} from "./proposal-workspace-persistence";
import { stableJsonStringify } from "./stable-json";

// ─────────────────────────────────────────────────────────────────────────────
// Stage envelope registry (mirrors the definitions in
// proposal-workspace-persistence.ts — key = stored envelope key under
// type_details.proposal_workspace, prop = ProposalWorkspaceSnapshot property).
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalStageEnvelopeKey =
  | "qualified"
  | "discovery"
  | "solution_design"
  | "pnl_pricing"
  | "quote"
  | "proposal_drafting"
  | "proposal_sent"
  | "negotiation"
  | "commercial_approval"
  | "contract_signed"
  | "go_live";

type StageSnapshotProp = Exclude<keyof ProposalWorkspaceSnapshot, "ticketFound" | "revision">;

const STAGE_SNAPSHOT_PROP: Record<ProposalStageEnvelopeKey, StageSnapshotProp> = {
  qualified: "qualified",
  discovery: "discovery",
  solution_design: "solutionDesign",
  pnl_pricing: "pnlPricing",
  quote: "quote",
  proposal_drafting: "proposalDrafting",
  proposal_sent: "proposalSent",
  negotiation: "negotiation",
  commercial_approval: "commercialApproval",
  contract_signed: "contractSigned",
  go_live: "goLive",
};

/** P9 — no path may ever reach either tracker column, at any depth. */
const FORBIDDEN_SEGMENTS = new Set(["crm_pipeline_stage", "internal_stage"]);

/** Deep-set hygiene — these object keys are never legitimate field names. */
const UNSAFE_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/** Bookkeeping leaf stamped on rows this module creates or upserts (P5). */
const SOURCE_FINGERPRINT_KEY = "_source_fingerprint";

// ─────────────────────────────────────────────────────────────────────────────
// Public API surface (pin P3)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposalFieldPatchItem {
  /** Canonical id per P1, e.g. "p:pnl_pricing.commercialTerms.paymentTerms". */
  fieldId: string;
  /**
   * The value to store. For a path ending in "[]" this is the row object to
   * upsert; otherwise it is the leaf value. `null` clears; `undefined` is
   * rejected so absence is always an explicit decision.
   */
  value: unknown;
  /**
   * One entry per "[]" segment in the persistencePath, outermost first. Each
   * entry carries the identity-field values fingerprinted for that row level
   * (P5). When the path ENDS with "[]" the final entry may be omitted — the
   * row identity is then computed from `value` itself.
   */
  rowKeys?: ReadonlyArray<Record<string, unknown>>;
}

export interface ProposalFieldPatchRequest {
  ticketId: string;
  /**
   * The commercial_tickets.updated_at the caller last read. Checked against
   * the first snapshot read; after each confirmed stage save the chain
   * advances to the revision that save returned.
   */
  expectedRevision?: string | null;
  /** The human-attributable actor recorded in commercial_ticket_audit. */
  actor: string;
  patches: ReadonlyArray<ProposalFieldPatchItem>;
}

export type ProposalPatchStatus =
  | "saved"
  | "saved_with_audit_warning"
  | "stale"
  | "not_found"
  | "failed";

export interface ProposalStagePatchOutcome {
  stageKey: ProposalStageEnvelopeKey;
  status: ProposalPatchStatus;
  /** The canonical field ids this stage's patch group addressed. */
  fieldIds: string[];
  /** Populated only after a confirmed save. */
  savedAt: string | null;
  revision: string | null;
  auditWritten: boolean;
  auditWarning?: string;
  message?: string;
}

export interface ProposalFieldPatchOutcome {
  /**
   * Most severe stage status (not_found > failed > stale >
   * saved_with_audit_warning > saved). "failed" with an empty `stages` array
   * means the request was rejected before any read or write.
   */
  status: ProposalPatchStatus;
  ticketId: string;
  stages: ProposalStagePatchOutcome[];
  /** Populated when the request never reached a stage write. */
  message?: string;
}

export interface ProposalFieldPatchDeps {
  /**
   * ONE exact read of the full proposal workspace with its revision — wraps
   * the exported loadProposalWorkspaceSnapshot.
   */
  loadSnapshot: (proposalId: string) => Promise<ProposalWorkspaceSnapshot>;
  /**
   * The existing per-stage save contract — exact ticket id, revision token,
   * read-back verification and audit row. It deliberately does not hide a
   * human-created ticket behind legacy type/status labels. MUST receive the
   * COMPLETE merged envelope.
   */
  saveStage: (
    stageKey: ProposalStageEnvelopeKey,
    proposalId: string,
    data: Record<string, unknown>,
    options: ProposalStageSaveOptions,
  ) => Promise<ProposalStageSaveResult>;
  /**
   * P5 row fingerprint. Integration wires src/lib/row-fingerprint.ts (T04);
   * tests may inject a structural stand-in with the same signature.
   */
  computeRowFingerprint: (row: Record<string, unknown>, spec: RowIdentitySpec) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal path model
// ─────────────────────────────────────────────────────────────────────────────

interface PathSegment {
  name: string;
  isArray: boolean;
}

interface ResolvedPatch {
  fieldId: string;
  descriptor: FieldDescriptor;
  stageKey: ProposalStageEnvelopeKey;
  /** Segments INSIDE the stage envelope data (the stage segment removed). */
  segments: PathSegment[];
  value: unknown;
  /** One identity entry per "[]" level; the terminal level may be null when identity comes from the value. */
  rowKeys: Array<Record<string, unknown> | null>;
  /** Identity spec per "[]" level, outermost first. */
  levelSpecs: RowIdentitySpec[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function jsonEquals(a: unknown, b: unknown): boolean {
  return stableJsonStringify(a) === stableJsonStringify(b);
}

function parsePath(path: string): PathSegment[] | string {
  if (!path.trim()) return "the persistence path is empty";
  const segments: PathSegment[] = [];
  for (const raw of path.split(".")) {
    const isArray = raw.endsWith("[]");
    const name = isArray ? raw.slice(0, -2) : raw;
    if (!name.trim()) return `the persistence path "${path}" has an empty segment`;
    if (FORBIDDEN_SEGMENTS.has(name)) {
      return `the path reaches the protected tracker column "${name}" — patches may never move either tracker`;
    }
    if (UNSAFE_SEGMENTS.has(name)) {
      return `the path segment "${name}" is not a legal field name`;
    }
    segments.push({ name, isArray });
  }
  return segments;
}

/**
 * Identity spec for one "[]" level (outermost first):
 *  1. a manifest descriptor whose persistencePath IS the collection path and
 *     declares rowIdentity (e.g. "pnl_pricing.pnlVersions[]") wins;
 *  2. else, for the DEEPEST level, the leaf descriptor's own rowIdentity;
 *  3. else the sorted keys of the supplied rowKeys entry (deterministic, and
 *     recorded here so the independent audit can weigh the fallback).
 */
function resolveLevelSpec(
  manifest: ProcessManifest,
  descriptor: FieldDescriptor,
  collectionPath: string,
  isDeepestLevel: boolean,
  rowKeysEntry: Record<string, unknown> | null,
): RowIdentitySpec | string {
  const collectionDescriptor = manifest.fields.find(
    (f) => f.persistencePath === collectionPath && f.rowIdentity,
  );
  if (collectionDescriptor?.rowIdentity) return collectionDescriptor.rowIdentity;
  if (isDeepestLevel && descriptor.rowIdentity) return descriptor.rowIdentity;
  if (rowKeysEntry && Object.keys(rowKeysEntry).length > 0) {
    return { fingerprintFields: Object.keys(rowKeysEntry).sort() };
  }
  return `no row identity is declared for the repeated level "${collectionPath}"`;
}

function resolvePatch(
  manifest: ProcessManifest,
  patch: ProposalFieldPatchItem,
): ResolvedPatch | { error: string } {
  const fieldId = typeof patch.fieldId === "string" ? patch.fieldId.trim() : "";
  if (!fieldId) return { error: "A patch is missing its fieldId, so nothing was written." };
  const fail = (why: string) => ({ error: `Field "${fieldId}": ${why}. Nothing was written.` });

  if (!fieldId.startsWith("p:")) return fail(`ids must start with "p:"`);
  const descriptor = manifest.fields.find((f) => f.id === fieldId);
  if (!descriptor) return fail("this id is not in the proposal manifest");
  if (descriptor.process !== "proposal") return fail("the descriptor is not a proposal field");

  const parsed = parsePath(descriptor.persistencePath);
  if (typeof parsed === "string") return fail(parsed);
  const [stageSegment, ...segments] = parsed;
  if (stageSegment.isArray || !(stageSegment.name in STAGE_SNAPSHOT_PROP)) {
    return fail(`"${stageSegment.name}" is not a known proposal stage envelope`);
  }
  const stageKey = stageSegment.name as ProposalStageEnvelopeKey;
  if (segments.length === 0) {
    return fail("the path must address a field inside the stage envelope, not the envelope itself");
  }

  if (patch.value === undefined) {
    return fail("a value is required — use null to clear a field explicitly");
  }

  const arraySegments = segments.filter((s) => s.isArray);
  const endsWithArray = segments[segments.length - 1].isArray;
  const suppliedRowKeys = patch.rowKeys ?? [];
  const minRowKeys = endsWithArray ? arraySegments.length - 1 : arraySegments.length;
  if (suppliedRowKeys.length < minRowKeys || suppliedRowKeys.length > arraySegments.length) {
    return fail(
      `the path has ${arraySegments.length} repeated level(s) but ${suppliedRowKeys.length} rowKeys entr${suppliedRowKeys.length === 1 ? "y was" : "ies were"} supplied`,
    );
  }
  if (endsWithArray && !isPlainRecord(patch.value)) {
    return fail("a path ending in [] upserts a row, so the value must be a row object");
  }

  const rowKeys: Array<Record<string, unknown> | null> = [];
  const levelSpecs: RowIdentitySpec[] = [];
  let walked = stageSegment.name;
  let level = 0;
  for (const segment of segments) {
    walked += `.${segment.name}${segment.isArray ? "[]" : ""}`;
    if (!segment.isArray) continue;
    const entry = level < suppliedRowKeys.length ? suppliedRowKeys[level] : null;
    if (entry !== null && (!isPlainRecord(entry) || Object.keys(entry).length === 0)) {
      return fail(`rowKeys entry ${level + 1} must be an object with at least one identity field`);
    }
    const isDeepest = level === arraySegments.length - 1;
    if (entry === null && !(isDeepest && endsWithArray)) {
      return fail(`rowKeys entry ${level + 1} is required to address this repeated level`);
    }
    const identitySource = entry ?? (patch.value as Record<string, unknown>);
    const spec = resolveLevelSpec(manifest, descriptor, walked, isDeepest, identitySource);
    if (typeof spec === "string") return fail(spec);
    rowKeys.push(entry);
    levelSpecs.push(spec);
    level += 1;
  }

  let value: unknown;
  try {
    value = deepClone(patch.value);
  } catch {
    return fail("the value is not JSON-serializable");
  }

  return { fieldId, descriptor, stageKey, segments, value, rowKeys, levelSpecs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep-set of ONE addressed leaf into the CURRENT stage envelope
// ─────────────────────────────────────────────────────────────────────────────

function matchRowIndex(
  rows: unknown[],
  fingerprint: string,
  spec: RowIdentitySpec,
  computeRowFingerprint: ProposalFieldPatchDeps["computeRowFingerprint"],
): number {
  const stamped = rows.findIndex(
    (row) => isPlainRecord(row) && row[SOURCE_FINGERPRINT_KEY] === fingerprint,
  );
  if (stamped >= 0) return stamped;
  return rows.findIndex(
    (row) => isPlainRecord(row) && computeRowFingerprint(row, spec) === fingerprint,
  );
}

/**
 * Mutates the (already deep-cloned) envelope: sets only the addressed leaf,
 * creating missing containers, matching repeated rows by fingerprint
 * (update-vs-append), and touching no unaddressed sibling. Returns an error
 * string on a structural conflict; null on success.
 */
function applyOnePatch(
  envelope: Record<string, unknown>,
  patch: ResolvedPatch,
  computeRowFingerprint: ProposalFieldPatchDeps["computeRowFingerprint"],
): string | null {
  let cursor: Record<string, unknown> = envelope;
  let arrayLevel = 0;

  for (let i = 0; i < patch.segments.length; i++) {
    const segment = patch.segments[i];
    const isLast = i === patch.segments.length - 1;

    if (!segment.isArray) {
      if (isLast) {
        cursor[segment.name] = patch.value;
        return null;
      }
      const existing = cursor[segment.name];
      if (existing === undefined || existing === null) {
        const created: Record<string, unknown> = {};
        cursor[segment.name] = created;
        cursor = created;
      } else if (isPlainRecord(existing)) {
        cursor = existing;
      } else {
        return `Field "${patch.fieldId}": the stored value at "${segment.name}" is not an object, so the leaf cannot be set without destroying it. Nothing was written for this stage.`;
      }
      continue;
    }

    const spec = patch.levelSpecs[arrayLevel];
    const keyEntry = patch.rowKeys[arrayLevel] ?? (patch.value as Record<string, unknown>);
    const fingerprint = computeRowFingerprint(keyEntry, spec);
    arrayLevel += 1;

    const existing = cursor[segment.name];
    let rows: unknown[];
    if (existing === undefined || existing === null) {
      rows = [];
      cursor[segment.name] = rows;
    } else if (Array.isArray(existing)) {
      rows = existing;
    } else {
      return `Field "${patch.fieldId}": the stored value at "${segment.name}" is not an array, so no row can be addressed. Nothing was written for this stage.`;
    }

    const index = matchRowIndex(rows, fingerprint, spec, computeRowFingerprint);

    if (isLast) {
      // Terminal "[]": upsert the row itself — merge only the supplied leaves
      // into the matched row, stamp the source fingerprint (P5).
      const incoming = patch.value as Record<string, unknown>;
      if (index >= 0) {
        const target = rows[index];
        if (!isPlainRecord(target)) {
          return `Field "${patch.fieldId}": the matched row is not an object. Nothing was written for this stage.`;
        }
        rows[index] = { ...target, ...incoming, [SOURCE_FINGERPRINT_KEY]: fingerprint };
      } else {
        rows.push({ ...incoming, [SOURCE_FINGERPRINT_KEY]: fingerprint });
      }
      return null;
    }

    // Traversal "[]": descend into the matched row; append a new identity-
    // seeded row (stamped, P5) only when no row matches.
    if (index >= 0) {
      const target = rows[index];
      if (!isPlainRecord(target)) {
        return `Field "${patch.fieldId}": the matched row at "${segment.name}" is not an object. Nothing was written for this stage.`;
      }
      cursor = target;
    } else {
      const created: Record<string, unknown> = {
        ...deepClone(keyEntry),
        [SOURCE_FINGERPRINT_KEY]: fingerprint,
      };
      rows.push(created);
      cursor = created;
    }
  }

  return null;
}

/**
 * Read the addressed leaf back out of the STORED stage data. Returns an error
 * string when the patched value is not verifiably present; null when it is.
 */
function verifyPatchStored(
  stored: Record<string, unknown>,
  patch: ResolvedPatch,
  computeRowFingerprint: ProposalFieldPatchDeps["computeRowFingerprint"],
): string | null {
  const missing = `Field "${patch.fieldId}": the saved row was read back, but the patched value is not present in stored truth.`;
  let cursor: unknown = stored;
  let arrayLevel = 0;

  for (let i = 0; i < patch.segments.length; i++) {
    const segment = patch.segments[i];
    const isLast = i === patch.segments.length - 1;

    if (!segment.isArray) {
      if (!isPlainRecord(cursor)) return missing;
      if (isLast) {
        return jsonEquals(cursor[segment.name], patch.value)
          ? null
          : `Field "${patch.fieldId}": the stored value did not match the patched value after the save.`;
      }
      cursor = cursor[segment.name];
      continue;
    }

    if (!isPlainRecord(cursor)) return missing;
    const rows = cursor[segment.name];
    if (!Array.isArray(rows)) return missing;
    const spec = patch.levelSpecs[arrayLevel];
    const keyEntry = patch.rowKeys[arrayLevel] ?? (patch.value as Record<string, unknown>);
    const fingerprint = computeRowFingerprint(keyEntry, spec);
    arrayLevel += 1;
    const index = matchRowIndex(rows, fingerprint, spec, computeRowFingerprint);
    if (index < 0) return missing;

    if (isLast) {
      const row = rows[index];
      if (!isPlainRecord(row)) return missing;
      const incoming = patch.value as Record<string, unknown>;
      for (const key of Object.keys(incoming)) {
        if (!jsonEquals(row[key], incoming[key])) {
          return `Field "${patch.fieldId}": the stored row leaf "${key}" did not match the patched value after the save.`;
        }
      }
      return null;
    }
    cursor = rows[index];
  }

  return missing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-stage read-modify-write (the ADR-02 fix)
// ─────────────────────────────────────────────────────────────────────────────

function stageOutcome(
  stageKey: ProposalStageEnvelopeKey,
  group: ResolvedPatch[],
  status: ProposalPatchStatus,
  message?: string,
): ProposalStagePatchOutcome {
  return {
    stageKey,
    status,
    fieldIds: group.map((p) => p.fieldId),
    savedAt: null,
    revision: null,
    auditWritten: false,
    ...(message ? { message } : {}),
  };
}

function currentStageData(
  snapshot: ProposalWorkspaceSnapshot,
  stageKey: ProposalStageEnvelopeKey,
): Record<string, unknown> {
  const result = snapshot[STAGE_SNAPSHOT_PROP[stageKey]] as { savedData: object | null };
  const saved = result?.savedData;
  return isPlainRecord(saved) ? deepClone(saved) : {};
}

function isStaleMessage(message: string): boolean {
  return /changed after the workspace loaded|changed while it was being saved/i.test(message);
}

async function patchOneStage(
  deps: ProposalFieldPatchDeps,
  ticketId: string,
  stageKey: ProposalStageEnvelopeKey,
  group: ResolvedPatch[],
  expectedRevision: string | null,
  actor: string,
): Promise<ProposalStagePatchOutcome> {
  let snapshot: ProposalWorkspaceSnapshot;
  try {
    snapshot = await deps.loadSnapshot(ticketId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return stageOutcome(stageKey, group, "failed", `The workspace could not be read (${message}), so nothing was written.`);
  }
  if (!snapshot.ticketFound) {
    return stageOutcome(stageKey, group, "not_found", "The proposal ticket was not found, so nothing was written.");
  }
  if (expectedRevision !== null && snapshot.revision !== expectedRevision) {
    return stageOutcome(
      stageKey,
      group,
      "stale",
      "This proposal changed after the patch was prepared. Reload before patching so another person's work is not overwritten.",
    );
  }

  // Read-modify-write: start from the stage's CURRENT stored data so every
  // unaddressed sibling group, leaf, and row rides through the whole-envelope
  // saver untouched. This is the ADR-02 fix.
  const envelope = currentStageData(snapshot, stageKey);
  for (const patch of group) {
    const applyError = applyOnePatch(envelope, patch, deps.computeRowFingerprint);
    if (applyError) return stageOutcome(stageKey, group, "failed", applyError);
  }

  let saveResult: ProposalStageSaveResult;
  try {
    saveResult = await deps.saveStage(stageKey, ticketId, envelope, {
      expectedRevision: snapshot.revision,
      actorName: actor,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isStaleMessage(message)) return stageOutcome(stageKey, group, "stale", message);
    if (/was not found/i.test(message)) return stageOutcome(stageKey, group, "not_found", message);
    return stageOutcome(stageKey, group, "failed", message);
  }

  // Success is only reported from stored truth: re-read and verify every
  // patched value in the read-back.
  let verifySnapshot: ProposalWorkspaceSnapshot;
  try {
    verifySnapshot = await deps.loadSnapshot(ticketId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return stageOutcome(
      stageKey,
      group,
      "failed",
      `The stage save reported success, but the read-back failed (${message}), so the patch is not verified.`,
    );
  }
  if (!verifySnapshot.ticketFound) {
    return stageOutcome(stageKey, group, "failed", "The stage save reported success, but the ticket could not be read back, so the patch is not verified.");
  }
  const storedStage = currentStageData(verifySnapshot, stageKey);
  for (const patch of group) {
    const verifyError = verifyPatchStored(storedStage, patch, deps.computeRowFingerprint);
    if (verifyError) return stageOutcome(stageKey, group, "failed", verifyError);
  }

  return {
    stageKey,
    status: saveResult.auditWritten ? "saved" : "saved_with_audit_warning",
    fieldIds: group.map((p) => p.fieldId),
    savedAt: saveResult.savedAt,
    revision: saveResult.revision,
    auditWritten: saveResult.auditWritten,
    ...(saveResult.auditWarning ? { auditWarning: saveResult.auditWarning } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_SEVERITY: Record<ProposalPatchStatus, number> = {
  saved: 0,
  saved_with_audit_warning: 1,
  stale: 2,
  failed: 3,
  not_found: 4,
};

function aggregateStatus(stages: ProposalStagePatchOutcome[]): ProposalPatchStatus {
  let worst: ProposalPatchStatus = "saved";
  for (const stage of stages) {
    if (STATUS_SEVERITY[stage.status] > STATUS_SEVERITY[worst]) worst = stage.status;
  }
  return worst;
}

export async function applyProposalFieldPatch(
  manifest: ProcessManifest,
  deps: ProposalFieldPatchDeps,
  req: ProposalFieldPatchRequest,
): Promise<ProposalFieldPatchOutcome> {
  const ticketId = typeof req.ticketId === "string" ? req.ticketId.trim() : "";
  const rejected = (message: string): ProposalFieldPatchOutcome => ({
    status: "failed",
    ticketId,
    stages: [],
    message,
  });

  if (!ticketId) return rejected("A proposal ticket id is required, so nothing was written.");
  if (manifest.process !== "proposal") {
    return rejected(`This patcher serves the proposal manifest only (received "${manifest.process}"), so nothing was written.`);
  }
  if (!req.patches || req.patches.length === 0) {
    return rejected("No patches were supplied, so nothing was written.");
  }

  // Resolve EVERY fieldId before any read or write — a half-valid batch must
  // not half-apply.
  const resolvedPatches: ResolvedPatch[] = [];
  for (const patch of req.patches) {
    const resolved = resolvePatch(manifest, patch);
    if ("error" in resolved) return rejected(resolved.error);
    resolvedPatches.push(resolved);
  }

  // Group by stage envelope, preserving first-appearance order.
  const groups = new Map<ProposalStageEnvelopeKey, ResolvedPatch[]>();
  for (const patch of resolvedPatches) {
    const group = groups.get(patch.stageKey);
    if (group) group.push(patch);
    else groups.set(patch.stageKey, [patch]);
  }

  const stages: ProposalStagePatchOutcome[] = [];
  let expectedRevision: string | null = req.expectedRevision ?? null;
  let halted: ProposalStagePatchOutcome | null = null;

  for (const [stageKey, group] of groups) {
    if (halted) {
      stages.push(stageOutcome(
        stageKey,
        group,
        halted.status,
        `Not attempted: the "${halted.stageKey}" stage patch did not persist, so later stages were not written.`,
      ));
      continue;
    }
    const outcome = await patchOneStage(deps, ticketId, stageKey, group, expectedRevision, req.actor);
    stages.push(outcome);
    if (outcome.status === "saved" || outcome.status === "saved_with_audit_warning") {
      expectedRevision = outcome.revision;
    } else {
      halted = outcome;
    }
  }

  return { status: aggregateStatus(stages), ticketId, stages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Production deps — wrap the EXISTING exported snapshot load + stage savers.
// The fingerprint fn stays injected (module ownership: T04, pin P5).
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_SAVERS: Record<
  ProposalStageEnvelopeKey,
  (proposalId: string, data: unknown, options?: ProposalStageSaveOptions) => Promise<ProposalStageSaveResult>
> = {
  qualified: (id, data, options) => saveProposalQualifiedStageData(id, data as ProposalQualifiedStageData, options),
  discovery: (id, data, options) => saveProposalDiscoveryStageData(id, data as ProposalDiscoveryStageData, options),
  solution_design: (id, data, options) => saveProposalSolutionDesignStageData(id, data as ProposalSolutionDesignStageData, options),
  pnl_pricing: (id, data, options) => saveProposalPnlPricingStageData(id, data as ProposalPnlPricingStageData, options),
  quote: (id, data, options) => saveProposalQuoteStageData(id, data as ProposalQuoteStageData, options),
  proposal_drafting: (id, data, options) => saveProposalDraftingStageData(id, data as ProposalDraftingStageData, options),
  proposal_sent: (id, data, options) => saveProposalSentStageData(id, data as ProposalSentStageData, options),
  negotiation: (id, data, options) => saveProposalNegotiationStageData(id, data as ProposalNegotiationStageData, options),
  commercial_approval: (id, data, options) => saveProposalCommercialApprovalStageData(id, data as ProposalCommercialApprovalStageData, options),
  contract_signed: (id, data, options) => saveProposalContractSignedStageData(id, data as ProposalContractSignedStageData, options),
  go_live: (id, data, options) => saveProposalGoLiveStageData(id, data as ProposalGoLiveStageData, options),
};

export function createProposalFieldPatchDeps(
  computeRowFingerprint: ProposalFieldPatchDeps["computeRowFingerprint"],
): ProposalFieldPatchDeps {
  return {
    loadSnapshot: loadProposalWorkspaceSnapshot,
    saveStage: (stageKey, proposalId, data, options) =>
      STAGE_SAVERS[stageKey](proposalId, data, options),
    computeRowFingerprint,
  };
}
