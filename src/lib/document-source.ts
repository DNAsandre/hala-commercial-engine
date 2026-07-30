/**
 * document-source.ts
 * ──────────────────
 * FPS-001-01 — Shared source-mode vocabulary for FinalPackStudio.
 *
 * These four concepts are kept DELIBERATELY DISTINCT (truthpack §9, v1.2):
 *
 *   source_mode      → is the document connected to a live business source, or not?
 *   source_kind      → where did the DATA come from? (origin only — NOT document shape)
 *   document_intent  → what is the document meant to be? (carried by pack_type)
 *   creation_method  → how was the instance started?
 *
 * A standalone "tender/proposal/SLA-style" document is a document_intent choice.
 * It does NOT imply a connected tender/proposal/SLA record exists.
 *
 * This module defines types only. No UI, no adapters, no schema, no export logic.
 */

import type { PackType } from "./final-pack-loader";

// ═══════════════════════════════════════════════════════════
// source_mode — connected vs standalone
// ═══════════════════════════════════════════════════════════

export type SourceMode = "connected" | "standalone";

// ═══════════════════════════════════════════════════════════
// source_kind — where the DATA came from (origin, not shape)
// ═══════════════════════════════════════════════════════════

export type SourceKind =
  | "commercial_ticket"
  | "proposal_engine"
  | "sla_engine"
  | "manual"
  | "template"
  | "duplicate"
  | "reusable_library";

// ═══════════════════════════════════════════════════════════
// creation_method — how the instance was started
// ═══════════════════════════════════════════════════════════

export type CreationMethod =
  | "connected_source"
  | "blank"
  | "template"
  | "duplicate"
  | "reusable_pack";

// ═══════════════════════════════════════════════════════════
// document_intent — what the document is meant to be
// (carried by pack_type; extends the 5 connected pack types
//  with standalone-only intents)
// ═══════════════════════════════════════════════════════════

export type DocumentIntent = PackType | "custom_pdf" | "custom_pack";

// ═══════════════════════════════════════════════════════════
// linked_entity_type — what (if anything) the instance is linked to
// ═══════════════════════════════════════════════════════════

export type LinkedEntityType = "tender" | "standalone" | "custom_document";

// ═══════════════════════════════════════════════════════════
// DocumentSource — the request passed to loadDocumentPack()
// ═══════════════════════════════════════════════════════════

/**
 * Describes how to build a document, regardless of origin.
 * The dispatcher (loadDocumentPack) uses `mode` + `kind` to select an adapter.
 * Every adapter returns the SAME BlockSnapshot shape.
 */
export interface DocumentSource {
  /** Connected vs standalone */
  mode: SourceMode;
  /** Where the data comes from */
  kind: SourceKind;
  /** How the instance is being started */
  creation: CreationMethod;
  /** What the document is meant to be (carried into pack_type) */
  packType: DocumentIntent;

  // ── Connected source (commercial ticket / tender) ──
  /** Connected source id (commercial_tickets.id). Also used for backward compat. */
  tenderId?: string;
  /** Optional pricing scenario id for connected pricing blocks. */
  scenarioId?: string;

  // ── Template source ──
  /** Template id (doc_templates.id) */
  templateId?: string;
  /** Actual template version id (doc_template_versions.id) where known */
  templateVersionId?: string;

  // ── Generic / future ──
  /** Generic source id for future connected kinds (proposal/SLA engine) */
  sourceId?: string;
  /** Instance id to duplicate from (FPS-001 placeholder; implemented later) */
  duplicateFromInstanceId?: string;

  // ── Optional standalone display metadata (all advisory, never required) ──
  /** Optional document title for blank/standalone documents */
  title?: string;
  /** Optional display/customer name */
  customerName?: string;
  /** Optional reference number */
  refNumber?: string;
}

// ═══════════════════════════════════════════════════════════
// Block provenance (FPS-002) — traceability LABEL, never a lock
// ═══════════════════════════════════════════════════════════

/**
 * Where a block came from. This is metadata only. Provenance must NEVER
 * disable editing, reordering, hide/show, adding/removing, or export, and
 * must never force approval, source refresh, or drift resolution.
 */
export type BlockProvenanceOrigin =
  | "commercial_ticket"
  | "template"
  | "reusable_library"
  | "manual"
  | "duplicated"
  | "ai_preview_future"
  | "unknown_legacy";

export interface BlockProvenanceRef {
  source_id?: string;
  template_id?: string;
  template_version_id?: string;
  block_library_id?: string;
  custom_block_id?: string;
  original_instance_id?: string;
  original_block_id?: string;
}

export interface BlockProvenance {
  origin: BlockProvenanceOrigin;
  origin_ref?: BlockProvenanceRef;
  source_mode?: SourceMode;
  source_kind?: string;
  creation_method?: string;
  captured_at?: string;
  captured_by?: string;
  /** When this block was duplicated from another (origin === "duplicated"). Advisory. */
  duplicated_at?: string;
  notes?: string;
}

/** Provenance for blocks loaded from documents created before provenance existed. */
export const UNKNOWN_LEGACY_PROVENANCE: BlockProvenance = {
  origin: "unknown_legacy",
};

// ═══════════════════════════════════════════════════════════
// Defaults — used to preserve connected behavior when fields absent
// ═══════════════════════════════════════════════════════════

/**
 * Source-mode defaults that classify a row as the legacy connected
 * commercial-ticket pack. Used by createInstance when a snapshot carries
 * no explicit source-mode fields (backward compatibility).
 */
export const CONNECTED_TICKET_DEFAULTS = {
  source_mode: "connected" as SourceMode,
  source_kind: "commercial_ticket" as SourceKind,
  creation_method: "connected_source" as CreationMethod,
  linked_entity_type: "tender" as LinkedEntityType,
};
