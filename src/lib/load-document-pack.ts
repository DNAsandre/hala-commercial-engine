/**
 * load-document-pack.ts
 * ─────────────────────
 * FPS-001-02 — Source adapter dispatcher.
 *
 * Single entry point that routes a DocumentSource to the correct adapter.
 * Every adapter returns the SAME BlockSnapshot shape, so the composer never
 * needs to know which adapter produced the snapshot.
 *
 * Routing:
 *   connected / commercial_ticket → connected adapter (wraps loadTenderPack)
 *   standalone / manual (blank)   → standalone blank adapter
 *   standalone / template         → standalone template adapter
 *
 * Unknown source kinds return a safe error snapshot. The dispatcher NEVER
 * silently falls back to the commercial-ticket source.
 */

import type { BlockSnapshot, PackType } from "./final-pack-loader";
import type { DocumentSource } from "./document-source";
import { loadCommercialTicketPack } from "./sources/commercial-ticket-source";
import { loadStandaloneBlankPack } from "./sources/standalone-blank-source";
import { loadStandaloneTemplatePack } from "./sources/standalone-template-source";

function safeErrorSnapshot(source: DocumentSource, error: string): BlockSnapshot {
  return {
    blocks: [],
    tender_id: source.tenderId ?? "",
    tender_title: "Not available",
    customer_name: "",
    pack_type: (source.packType ?? "custom_pdf") as PackType,
    template_id: source.templateId ?? "",
    template_name: "",
    source_hash: "",
    pricing_scenario_id: null,
    snapshot_at: new Date().toISOString(),
    source_data: {},
    warnings: [],
    error,
    source_mode: source.mode,
    source_kind: source.kind,
    creation_method: source.creation,
  };
}

/**
 * Dispatch a document source to its adapter and return a BlockSnapshot.
 */
export async function loadDocumentPack(source: DocumentSource): Promise<BlockSnapshot> {
  // Connected sources
  if (source.mode === "connected") {
    if (source.kind === "commercial_ticket") {
      return loadCommercialTicketPack(source);
    }
    return safeErrorSnapshot(
      source,
      `No connected adapter for source_kind "${source.kind}"`,
    );
  }

  // Standalone sources
  if (source.mode === "standalone") {
    switch (source.kind) {
      case "manual":
        return loadStandaloneBlankPack(source);
      case "template":
        return loadStandaloneTemplatePack(source);
      default:
        return safeErrorSnapshot(
          source,
          `No standalone adapter for source_kind "${source.kind}"`,
        );
    }
  }

  return safeErrorSnapshot(source, `Unknown source_mode "${source.mode}"`);
}
