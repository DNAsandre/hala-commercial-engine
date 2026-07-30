/**
 * final-pack-snapshot-contract.ts
 * ───────────────────────────────
 * FPS-002-04 / FPS-002-06 — Source Snapshot Contract + Block Provenance.
 *
 * Defines the standard shape every source adapter returns and that is stored
 * (mirrored) in doc_instances.source_snapshot. This is a DATA CONTRACT for
 * traceability and stability — it is NOT a validation gate.
 *
 * Hard rule: missing optional fields are always safe. No field here may ever
 * block editing, preview, or export. (Truthpack §8, §13, §14.)
 *
 * Block provenance types live in document-source.ts (the vocabulary home) and
 * are re-exported here for convenience.
 */

import type {
  SourceMode,
  SourceKind,
  CreationMethod,
  DocumentIntent,
  LinkedEntityType,
  BlockProvenance,
  BlockProvenanceOrigin,
} from "./document-source";

export type {
  BlockProvenance,
  BlockProvenanceOrigin,
} from "./document-source";

// ═══════════════════════════════════════════════════════════
// Source Snapshot Contract
// ═══════════════════════════════════════════════════════════

/** Per-origin block counts, for quick audit/advisory without walking blocks. */
export interface ProvenanceSummary {
  total: number;
  by_origin: Partial<Record<BlockProvenanceOrigin, number>>;
  /** Number of blocks with no provenance / unknown_legacy. */
  unknown: number;
}

/**
 * The canonical snapshot shape. Adapters populate what they know; everything
 * except `blocks` is effectively optional in practice and must degrade safely.
 */
export interface FinalPackSnapshotContract {
  source_mode?: SourceMode;
  source_kind?: SourceKind | string;
  creation_method?: CreationMethod | string;
  /** Document intent — carried by pack_type. */
  document_intent?: DocumentIntent | string;
  source_id?: string | null;
  linked_entity_type?: LinkedEntityType | string;
  linked_entity_id?: string | null;
  template_id?: string;
  template_version_id?: string | null;
  branding_profile_id?: string | null;
  /** Governance class — advisory only. Defaults to customer_facing. */
  template_class?: string;
  /** Source hash / fingerprint where applicable (empty for blank/manual). */
  source_hash?: string;
  /** Layout snapshot placeholder — honored later (FPS-004), never a gate. */
  layout_snapshot?: Record<string, unknown> | null;
  created_at?: string;
  created_by?: string;
  block_count?: number;
  provenance_summary?: ProvenanceSummary;
}

export const DEFAULT_TEMPLATE_CLASS = "customer_facing";

// ═══════════════════════════════════════════════════════════
// Provenance helpers
// ═══════════════════════════════════════════════════════════

/** Build a block provenance object (all fields advisory). */
export function makeBlockProvenance(
  origin: BlockProvenanceOrigin,
  opts: Omit<BlockProvenance, "origin"> = {},
): BlockProvenance {
  return {
    origin,
    captured_at: opts.captured_at ?? new Date().toISOString(),
    ...opts,
  };
}

/** Summarize provenance across a block list (missing → unknown). */
export function summarizeProvenance(
  blocks: Array<{ provenance?: BlockProvenance }>,
): ProvenanceSummary {
  const by_origin: Partial<Record<BlockProvenanceOrigin, number>> = {};
  let unknown = 0;
  for (const b of blocks) {
    const origin = b.provenance?.origin;
    if (!origin || origin === "unknown_legacy") {
      unknown += 1;
      by_origin.unknown_legacy = (by_origin.unknown_legacy ?? 0) + 1;
      continue;
    }
    by_origin[origin] = (by_origin[origin] ?? 0) + 1;
  }
  return { total: blocks.length, by_origin, unknown };
}
