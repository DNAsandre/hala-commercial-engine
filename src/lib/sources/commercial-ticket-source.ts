/**
 * commercial-ticket-source.ts
 * ───────────────────────────
 * FPS-001-03 — Connected adapter.
 *
 * Thin wrapper around the EXISTING connected loader (loadTenderPack).
 * It preserves the current connected commercial-ticket/tender behavior
 * exactly, then stamps source-mode metadata onto the returned snapshot.
 *
 * Source-truth safety:
 * - Delegates entirely to loadTenderPack (READ ONLY on commercial_tickets).
 * - Does NOT change resolver / pricing / clause logic.
 * - Does NOT write to commercial_tickets.
 */

import { loadTenderPack, type BlockSnapshot, type PackType } from "../final-pack-loader";
import type { DocumentSource } from "../document-source";

/**
 * Build a connected document snapshot from a commercial ticket / tender.
 * Behaviorally identical to calling loadTenderPack directly, plus source-mode tags.
 */
export async function loadCommercialTicketPack(
  source: DocumentSource,
): Promise<BlockSnapshot> {
  const tenderId = source.tenderId ?? source.sourceId ?? "";

  if (!tenderId) {
    // Safe error snapshot via the loader's own error path.
    return loadTenderPack("", source.packType as PackType, source.scenarioId);
  }

  const snapshot = await loadTenderPack(
    tenderId,
    source.packType as PackType,
    source.scenarioId,
  );

  // Stamp source-mode metadata (traceability only — never gates).
  return {
    ...snapshot,
    source_mode: "connected",
    source_kind: "commercial_ticket",
    creation_method: "connected_source",
    linked_entity_type: "tender",
    linked_entity_id: tenderId,
    template_version_id: snapshot.template_version_id ?? null,
  };
}
