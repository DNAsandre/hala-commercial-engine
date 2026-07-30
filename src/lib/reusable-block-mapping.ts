/**
 * reusable-block-mapping.ts
 * ─────────────────────────
 * FPS-003-07 / FPS-003-08 — Map a reusable doc_custom_blocks record into a
 * composer OutputBlock (an editable COPY), with reusable_library provenance.
 *
 * Rules (no-prison):
 * - Always produce a safe, editable block — never throw, never block export.
 * - Prefer EN content; fall back to AR; fall back to empty editable block.
 * - Unknown/odd shapes still become an editable custom_text block.
 * - The inserted block is a COPY: no live binding back to the library record.
 */

import type { OutputBlock } from "./final-pack-loader";
import { makeBlockProvenance } from "./final-pack-snapshot-contract";
import type { CustomBlock } from "@/hooks/useCustomBlocks";

/**
 * Build an editable composer block from a reusable custom block.
 * @param capturedBy optional user identifier for provenance
 */
export function customBlockToOutputBlock(
  cb: CustomBlock,
  capturedBy?: string,
): OutputBlock {
  // Prefer English content; fall back to Arabic; else empty (still editable).
  const html = (cb.content_en && cb.content_en.trim())
    ? cb.content_en
    : (cb.content_ar && cb.content_ar.trim())
      ? cb.content_ar
      : "";

  return {
    // Unique copy id — never reuse the library record id as the block id.
    id: `reusable-${cb.id}-${Date.now()}`,
    // Map to the safe, always-editable custom_text renderer (renders via the
    // shared HTML block path → previews + exports correctly).
    block_key: "custom_text",
    render_key: "custom_text",
    display_name: cb.name || "Reusable Block",
    family: cb.category || "commercial",
    editor_mode: "wysiwyg",
    visible: true,
    order: 0, // re-numbered by addBlock
    required: false,
    content: {
      html,
      source_status: "default",
    },
    default_content: html,
    schema_config: {},
    permissions: {},
    provenance: makeBlockProvenance("reusable_library", {
      origin_ref: { custom_block_id: cb.id },
      creation_method: "reusable_pack",
      captured_by: capturedBy,
      notes: cb.content_ar && !cb.content_en ? "Arabic content used (no EN)" : undefined,
    }),
  };
}
