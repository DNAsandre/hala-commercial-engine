/**
 * final-pack-preview-truth.test.ts — PADW T06b acceptance pins.
 *
 * Pins the preview/render-side truth repairs from the PDF Studio audit:
 *
 *   PDS-02  clause-bearing blocks render the actual Clause Library content
 *           (EN + AR where present) — never the seeded meta-boilerplate —
 *           and an empty clause set is an honest empty state;
 *   PDS-03  "{{recipient_name}}" (and friends) resolve from the block's own
 *           variables in the rendered HTML; unknown variables stay VISIBLE;
 *   PDS-16  source_status === "not_captured" short-circuits BEFORE any
 *           default_content fallback, and template prose that still renders
 *           is visibly labeled as template text (pin P7);
 *   PDS-41  findUnresolvedVariablesInBlocks reports blocks that would print
 *           a literal token (the WarningBanner feed).
 *
 * (The PDS-01 render half — customer-only pricing columns — is pinned in the
 * T06a lane beside the loader's customer-facing projection.)
 */
import { describe, expect, it, vi } from "vitest";

// DOMPurify pass-through double (house pattern from final-pack-fidelity.test.ts):
// in the node test environment the default export is the un-instantiated
// factory, so the real code under test runs against this pass-through.
vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

import type { OutputBlock } from "./final-pack-loader";
import { buildPreviewHTML, DEFAULT_BRANDING } from "./final-pack-preview";
import { findUnresolvedVariablesInBlocks } from "./template-variables";

function block(partial: Partial<OutputBlock> & Pick<OutputBlock, "id" | "block_key" | "render_key">): OutputBlock {
  return {
    display_name: partial.display_name ?? partial.render_key,
    family: "commercial",
    editor_mode: "wysiwyg",
    visible: true,
    order: 1,
    required: false,
    content: { source_status: "populated" },
    default_content: "",
    schema_config: {},
    permissions: {},
    ...partial,
  } as OutputBlock;
}

function render(blocks: OutputBlock[]): string {
  return buildPreviewHTML({
    blocks,
    branding: DEFAULT_BRANDING,
    exportMode: "final",
    customerName: "Truth Customer",
    refNumber: "REF-1",
    date: "24/08/2026",
  });
}

// ═════════════════════════════════════════════════════════════
// PDS-02 — clause rendering
// ═════════════════════════════════════════════════════════════

describe("PDS-02 — clause-bearing blocks render the clause library", () => {
  it("renders EN clause content (and AR with dir=rtl) instead of the seeded boilerplate", () => {
    const html = render([
      block({
        id: "legal-1",
        block_key: "legal.clauses.locked",
        render_key: "legal_clauses",
        display_name: "Terms & Conditions",
        content: {
          source_status: "populated",
          clauses: [
            { id: "c1", name: "Liability", category: "legal", content_en: "<p>Liability is limited to fees paid.</p>", content_ar: "<p>تحدد المسؤولية بالرسوم المدفوعة.</p>" },
            { id: "c2", name: "Governing Law", category: "legal", content_en: "<p>Saudi law governs.</p>", content_ar: "" },
          ],
        },
        default_content: "<p>Terms are loaded from the Clause Library. Add specific clauses via the Template Builder.</p>",
      }),
    ]);

    expect(html).toContain("Liability is limited to fees paid.");
    expect(html).toContain("Saudi law governs.");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("تحدد المسؤولية بالرسوم المدفوعة.");
    // The seeded meta-boilerplate never renders when clauses are resolved.
    expect(html).not.toContain("Add specific clauses via the Template Builder");
  });

  it("an empty clause set is an honest empty state, not the boilerplate", () => {
    const html = render([
      block({
        id: "legal-1",
        block_key: "legal.clauses.locked",
        render_key: "legal_clauses",
        content: { source_status: "not_captured", clauses: [] },
        default_content: "<p>Terms are loaded from the Clause Library.</p>",
      }),
    ]);
    expect(html).toContain("No published clauses in the Clause Library yet.");
    expect(html).not.toContain("Terms are loaded from the Clause Library.");
  });

  it("human-authored html on a clause block wins over the clause auto-render", () => {
    const html = render([
      block({
        id: "legal-1",
        block_key: "legal.clauses.locked",
        render_key: "legal_clauses",
        content: {
          source_status: "populated",
          html: "<p>Negotiated terms typed by the human.</p>",
          clauses: [{ id: "c1", name: "Liability", category: "legal", content_en: "<p>Library clause</p>", content_ar: "" }],
        },
      }),
    ]);
    expect(html).toContain("Negotiated terms typed by the human.");
    expect(html).not.toContain("Library clause");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-03 — variable interpolation in rendered HTML
// ═════════════════════════════════════════════════════════════

describe("PDS-03 — block variables resolve in rendered HTML", () => {
  it("resolves {{recipient_name}} from the block's variables", () => {
    const html = render([
      block({
        id: "conf-1",
        block_key: "confidentiality.locked",
        render_key: "confidentiality",
        content: {
          source_status: "populated",
          variables: { company_name: "Hala Supply Chain Services", recipient_name: "Truth Customer" },
        },
        default_content: "<p>This document is intended solely for {{recipient_name}} and {{company_name}}.</p>",
      }),
    ]);
    expect(html).toContain("intended solely for Truth Customer");
    expect(html).not.toContain("{{recipient_name}}");
  });

  it("unknown variables stay VISIBLE — never invented, never stripped", () => {
    const html = render([
      block({
        id: "n-1",
        block_key: "intro.narrative",
        render_key: "narrative",
        content: { source_status: "populated", html: "<p>Dear {{undeclared_token}},</p>" },
      }),
    ]);
    expect(html).toContain("{{undeclared_token}}");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-16 — honesty ordering (pin P7)
// ═════════════════════════════════════════════════════════════

describe("PDS-16 — not_captured beats default_content", () => {
  it("a not_captured block renders the honest empty state, never the seeded prose", () => {
    const html = render([
      block({
        id: "n-1",
        block_key: "intro.narrative",
        render_key: "narrative",
        content: { source_status: "not_captured" },
        default_content: "<p>We are pleased to present this proposal…</p>",
      }),
    ]);
    expect(html).toContain("Content not captured yet.");
    expect(html).not.toContain("pleased to present");
  });

  it("default prose that legitimately renders carries the visible template-text label", () => {
    const html = render([
      block({
        id: "n-1",
        block_key: "intro.narrative",
        render_key: "narrative",
        content: { source_status: "default" },
        default_content: "<p>Standard company introduction.</p>",
      }),
    ]);
    expect(html).toContain("Standard company introduction.");
    expect(html).toContain("fps-template-note");
    expect(html).toContain("Template text");
  });

  it("authored content renders unlabeled", () => {
    const html = render([
      block({
        id: "n-1",
        block_key: "intro.narrative",
        render_key: "narrative",
        content: { source_status: "populated", html: "<p>Drafted by the human.</p>" },
        default_content: "<p>Seeded default.</p>",
      }),
    ]);
    expect(html).toContain("Drafted by the human.");
    expect(html).not.toContain('<p class="fps-template-note">');
    expect(html).not.toContain("Seeded default.");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-41 — unresolved-variable scan (WarningBanner feed)
// ═════════════════════════════════════════════════════════════

describe("PDS-41 — findUnresolvedVariablesInBlocks", () => {
  it("reports blocks whose rendered output would contain a literal token", () => {
    const blocks = [
      block({
        id: "conf-1",
        block_key: "confidentiality.locked",
        render_key: "confidentiality",
        display_name: "Confidentiality",
        content: { source_status: "populated", variables: { company_name: "Hala" } },
        default_content: "<p>{{company_name}} — for {{recipient_name}} only.</p>",
      }),
      block({
        id: "ok-1",
        block_key: "intro.narrative",
        render_key: "narrative",
        content: { source_status: "populated", html: "<p>No tokens here.</p>" },
      }),
    ];
    const findings = findUnresolvedVariablesInBlocks(blocks);
    expect(findings).toEqual([
      { blockId: "conf-1", blockName: "Confidentiality", variables: ["recipient_name"] },
    ]);
  });

  it("ignores hidden blocks", () => {
    const findings = findUnresolvedVariablesInBlocks([
      block({
        id: "hidden-1",
        block_key: "intro.narrative",
        render_key: "narrative",
        visible: false,
        content: { source_status: "populated", html: "<p>{{token}}</p>" },
      }),
    ]);
    expect(findings).toEqual([]);
  });
});
