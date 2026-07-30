/**
 * BlockEditor.tsx
 * ───────────────
 * FPS-016 — Maps block render_key to the correct editor component.
 *
 * render_key values come from doc_block_library seed data.
 * Unknown block types render a safe fallback, never crash.
 *
 * Source-truth safety: All editors write to doc_instances.blocks only.
 */

import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";
import type { BrandingProfile } from "@/lib/final-pack-preview";
import CoverEditor from "./blocks/CoverEditor";
import NarrativeEditor from "./blocks/NarrativeEditor";
import PricingEditor from "./blocks/PricingEditor";
import SlaEditor from "./blocks/SlaEditor";
import SignatureEditor from "./blocks/SignatureEditor";
import PageBreakBlock from "./blocks/PageBreakBlock";
import TocBlock from "./blocks/TocBlock";
import CustomTextEditor from "./blocks/CustomTextEditor";

interface BlockEditorProps {
  block: OutputBlock;
  blocks: OutputBlock[];
  onContentChange: (content: Partial<BlockContent>) => void;
  /** Resolved branding (FPS-009 Cover Designer — for hero/logo/watermark assets). */
  branding?: BrandingProfile;
  /** Template default cover style (FPS-009). */
  coverStyleDefault?: string;
}

/**
 * Render the correct editor for a block based on render_key.
 *
 * render_key values (from doc_block_library seed):
 *   cover_hero, confidentiality, narrative, scope_list, facility_gallery,
 *   terms, signature_dual, closing, pricing_table_single, pricing_table_multi,
 *   quote_pricing_vat, scope_table, totals_words, party_details, toc_auto,
 *   legal_clauses, annexure_config, annexure_sla, annexure_rate_card,
 *   annexure_comms, page_break, custom_text
 */
export default function BlockEditor({ block, blocks, onContentChange, branding, coverStyleDefault }: BlockEditorProps) {
  const key = block.render_key;

  // ── Cover Designer (FPS-009) — full style/asset panel for cover_hero ──
  if (key === "cover_hero") {
    return (
      <CoverEditor
        block={block}
        onContentChange={onContentChange}
        branding={branding}
        coverStyleDefault={coverStyleDefault}
        showCoverDesign
      />
    );
  }

  // ── Other variable blocks (facility, party) — plain field editor ──
  if (key === "facility_gallery" || key === "party_details") {
    return <CoverEditor block={block} onContentChange={onContentChange} />;
  }

  // ── Narrative / WYSIWYG blocks ──
  if (
    key === "narrative" ||
    key === "scope_list" ||
    key === "closing" ||
    key === "confidentiality" ||
    key === "terms" ||
    key === "legal_clauses" ||
    key === "annexure_config" ||
    key === "annexure_comms" ||
    key === "scope_table"
  ) {
    return <NarrativeEditor block={block} onContentChange={onContentChange} />;
  }

  // ── Pricing blocks ──
  if (
    key === "pricing_table_single" ||
    key === "pricing_table_multi" ||
    key === "quote_pricing_vat" ||
    key === "annexure_rate_card" ||
    key === "totals_words"
  ) {
    return <PricingEditor block={block} onContentChange={onContentChange} />;
  }

  // ── SLA matrix ──
  if (key === "annexure_sla") {
    return <SlaEditor block={block} onContentChange={onContentChange} />;
  }

  // ── TOC (auto-generated, read-only) ──
  if (key === "toc_auto") {
    return <TocBlock block={block} blocks={blocks} />;
  }

  // ── Signature ──
  if (key === "signature_dual") {
    return <SignatureEditor block={block} onContentChange={onContentChange} />;
  }

  // ── Page break ──
  if (key === "page_break") {
    return <PageBreakBlock />;
  }

  // ── Custom text ──
  if (key === "custom_text") {
    return <CustomTextEditor block={block} onContentChange={onContentChange} />;
  }

  // ── Fallback — never crash ──
  return (
    <div className="text-xs text-muted-foreground italic py-2">
      No editor available for block type: <code>{key}</code> ({block.editor_mode})
    </div>
  );
}
