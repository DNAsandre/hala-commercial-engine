/**
 * normalize-final-pack-snapshot.ts
 * ────────────────────────────────
 * FPS-002-05 / FPS-002-10 — Safe normalization for old and new instances.
 *
 * Lets legacy connected instances, new connected instances, and standalone
 * instances all load safely by resolving metadata with safe defaults and
 * marking missing/legacy values without pretending they are known.
 *
 * CRITICAL:
 * - Never mutates the stored row or source_snapshot (no auto-rewrite).
 * - Never blocks editing/preview/export.
 * - Returns derived/normalized values for UI + advisories only.
 */

import type { OutputBlock } from "./final-pack-loader";
import type { BlockProvenance } from "./document-source";
import { UNKNOWN_LEGACY_PROVENANCE } from "./document-source";
import {
  summarizeProvenance,
  DEFAULT_TEMPLATE_CLASS,
  type ProvenanceSummary,
} from "./final-pack-snapshot-contract";

export interface NormalizedInstanceMetadata {
  source_mode: string;
  source_kind: string;
  creation_method: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  template_id: string | null;
  template_version_id: string | null;
  branding_profile_id: string | null;
  template_class: string;
  /** True when source_mode was not stored (pre-FPS-001 row). */
  source_mode_legacy: boolean;
  /** True when template version traceability is missing/legacy. */
  template_version_legacy: boolean;
  provenance_summary: ProvenanceSummary;
}

interface InstanceLike {
  source_mode?: string | null;
  source_kind?: string | null;
  creation_method?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  template_version_id?: string | null;
  branding_profile_id?: string | null;
  template_class?: string | null;
  blocks?: OutputBlock[] | null;
  // Accept any snapshot shape (legacy or current) — read defensively.
  source_snapshot?: any;
}

/**
 * Resolve instance metadata from row columns first, then source_snapshot
 * mirror, then safe defaults. Columns are the source of truth (Option 1).
 */
export function normalizeInstanceMetadata(row: InstanceLike): NormalizedInstanceMetadata {
  const ss = row.source_snapshot || {};

  const sourceModeRaw = row.source_mode ?? ss.source_mode ?? null;
  const sourceKindRaw = row.source_kind ?? ss.source_kind ?? null;
  const creationRaw = row.creation_method ?? ss.creation_method ?? null;

  const templateVersionId =
    row.template_version_id ?? ss.template_version_id ?? null;
  const templateId = ss.template_id ?? null;

  const blocks = Array.isArray(row.blocks) ? row.blocks : [];

  // Connected legacy rows pre-date version traceability: they stored the
  // template id in template_version_id. Flag (advisory) when they match.
  const templateVersionLegacy =
    !templateVersionId || (!!templateId && templateVersionId === templateId);

  return {
    source_mode: sourceModeRaw ?? "connected",
    source_kind: sourceKindRaw ?? "commercial_ticket",
    creation_method: creationRaw ?? "connected_source",
    linked_entity_type: row.linked_entity_type ?? ss.linked_entity_type ?? null,
    linked_entity_id: row.linked_entity_id ?? ss.linked_entity_id ?? null,
    template_id: templateId,
    template_version_id: templateVersionId,
    branding_profile_id: row.branding_profile_id ?? ss.branding_profile_id ?? null,
    template_class: row.template_class ?? ss.template_class ?? DEFAULT_TEMPLATE_CLASS,
    source_mode_legacy: sourceModeRaw == null,
    template_version_legacy: templateVersionLegacy,
    provenance_summary: summarizeProvenance(blocks),
  };
}

/**
 * Return a copy of blocks where any block missing provenance is labeled
 * unknown_legacy. IN-MEMORY ONLY — do NOT persist the result back as a bulk
 * rewrite (FPS-002-10 guardrail). Use for display/advisory; per-block edits
 * may persist their own provenance through the normal save path.
 */
export function withResolvedProvenance(blocks: OutputBlock[]): OutputBlock[] {
  return blocks.map((b) =>
    b.provenance ? b : { ...b, provenance: legacyProvenance() },
  );
}

function legacyProvenance(): BlockProvenance {
  return { ...UNKNOWN_LEGACY_PROVENANCE };
}
