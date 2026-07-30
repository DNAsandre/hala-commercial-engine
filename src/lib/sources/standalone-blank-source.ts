/**
 * standalone-blank-source.ts
 * ──────────────────────────
 * FPS-001-04 — Standalone blank adapter.
 *
 * Creates a minimal, fully editable document with NO connected source:
 * no tender, no proposal, no CRM, no SLA, no commercial ticket.
 *
 * Source-truth safety:
 * - Reads nothing from commercial_tickets.
 * - Injects NO sample customer data (no KAFD/Badael/SITE/Tahakom).
 * - Returns the same BlockSnapshot shape as the connected adapter.
 */

import type { BlockSnapshot, OutputBlock, PackType } from "../final-pack-loader";
import type { DocumentSource } from "../document-source";
import { makeBlockProvenance } from "../final-pack-snapshot-contract";

/** Build an editable custom-text block (mirrors BlockPicker's construction). */
function customTextBlock(
  idSuffix: string,
  displayName: string,
  html: string,
  order: number,
): OutputBlock {
  return {
    id: `custom_text-${idSuffix}`,
    block_key: "custom_text",
    render_key: "custom_text",
    display_name: displayName,
    family: "commercial",
    editor_mode: "wysiwyg",
    visible: true,
    order,
    required: false,
    content: {
      html,
      source_status: "default",
    },
    default_content: "",
    schema_config: {},
    permissions: {},
    provenance: makeBlockProvenance("manual", {
      source_mode: "standalone",
      source_kind: "manual",
      creation_method: "blank",
    }),
  };
}

/**
 * Build a blank standalone document snapshot.
 * The user can add/edit/reorder more blocks via the shared BlockPicker.
 */
export function loadStandaloneBlankPack(source: DocumentSource): BlockSnapshot {
  const title = (source.title || "").trim();
  const customerName = (source.customerName || "").trim();

  const blocks: OutputBlock[] = [
    customTextBlock(
      "title",
      "Document Title",
      title ? `<h1>${title}</h1>` : "<h1>Untitled Document</h1>",
      1,
    ),
    customTextBlock(
      "body",
      "Body",
      "<p>Start writing your document here.</p>",
      2,
    ),
  ];

  const nowIso = new Date().toISOString();

  return {
    blocks,
    tender_id: "",
    tender_title: title || "Untitled Document",
    customer_name: customerName,
    pack_type: (source.packType ?? "custom_pdf") as PackType,
    template_id: "",
    template_name: "Blank Document",
    source_hash: "",
    pricing_scenario_id: null,
    snapshot_at: nowIso,
    source_data: {},
    warnings: [],
    // ── Snapshot Contract ──
    source_mode: "standalone",
    source_kind: "manual",
    creation_method: "blank",
    linked_entity_type: "custom_document",
    linked_entity_id: null,
    template_version_id: null,
  };
}
