/**
 * final-pack-layout.ts
 * ────────────────────
 * FPS-004-02 — Layout config normalizer.
 *
 * Turns a template's (possibly missing/malformed) layout JSONB into a safe,
 * fully-populated config the preview/export path can use without crashing or
 * blocking. Live shape (confirmed 2026-06-22): cover_page, cover_style,
 * section_spacing, page_break_between_sections, annexure_section, toc_auto.
 *
 * Hard rule: this NEVER throws and NEVER blocks export. Bad input → defaults.
 */

export type SectionSpacing = "compact" | "normal" | "spacious";

export interface FinalPackLayoutConfig {
  cover_page: boolean;
  cover_style: string;
  section_spacing: SectionSpacing;
  page_break_between_sections: boolean;
  annexure_section: boolean;
  /** Whether a TOC block should auto-generate entries from visible blocks. */
  toc_auto: boolean;
}

export const DEFAULT_LAYOUT: FinalPackLayoutConfig = {
  cover_page: true,
  cover_style: "hero_image",
  section_spacing: "normal",
  page_break_between_sections: false,
  annexure_section: false,
  // Default to auto — harmless when no TOC block is present, and matches the
  // common case where a TOC block implies it should be generated.
  toc_auto: true,
};

/** Coerce a JSON boolean / "true" / "false" string into a boolean. */
function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

const SPACINGS: SectionSpacing[] = ["compact", "normal", "spacious"];

/**
 * Normalize an unknown layout value into a safe FinalPackLayoutConfig.
 * Missing layout → defaults. Malformed layout → defaults. Extra keys ignored.
 */
export function normalizeFinalPackLayout(layout: unknown): FinalPackLayoutConfig {
  const l =
    layout && typeof layout === "object" && !Array.isArray(layout)
      ? (layout as Record<string, unknown>)
      : {};

  const spacing = SPACINGS.includes(l.section_spacing as SectionSpacing)
    ? (l.section_spacing as SectionSpacing)
    : DEFAULT_LAYOUT.section_spacing;

  return {
    cover_page: asBool(l.cover_page, DEFAULT_LAYOUT.cover_page),
    cover_style:
      typeof l.cover_style === "string" && l.cover_style.trim()
        ? l.cover_style
        : DEFAULT_LAYOUT.cover_style,
    section_spacing: spacing,
    page_break_between_sections: asBool(
      l.page_break_between_sections,
      DEFAULT_LAYOUT.page_break_between_sections,
    ),
    annexure_section: asBool(l.annexure_section, DEFAULT_LAYOUT.annexure_section),
    toc_auto: asBool(l.toc_auto, DEFAULT_LAYOUT.toc_auto),
  };
}
