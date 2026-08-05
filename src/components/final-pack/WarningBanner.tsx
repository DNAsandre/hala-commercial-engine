/**
 * WarningBanner.tsx
 * ─────────────────
 * FPS-026 — Non-blocking informational warning banner.
 *
 * Scans blocks for conditions and shows warnings.
 * Warnings are SIGNALS. They NEVER disable export.
 * Collapsible but not dismissible (re-evaluates on changes).
 *
 * Source-truth safety: Read-only block analysis. No database writes.
 *
 * Do not disable export buttons.
 * Do not use "must resolve", "cannot proceed", "export denied".
 * Do not read can_export_to_pdf_studio.
 */

import { useState, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import type { OutputBlock } from "@/lib/final-pack-loader";

interface WarningBannerProps {
  blocks: OutputBlock[];
  /**
   * W04-C4: FPS-006 volume scope. When a volume is selected the notes must
   * describe THAT volume — the counts previously covered the whole document,
   * so a banner could report notes about blocks the selected volume does not
   * contain (and miss none of its own).
   */
  volumeBlockKeys?: string[] | null;
  volumeTitle?: string | null;
}

interface Warning {
  id: string;
  icon: "info" | "attention";
  message: string;
}

/**
 * The blocks the banner speaks about. Filtering only — no reorder, no mutation.
 * An empty/absent key list means "no volume selected" = the whole document.
 */
export function scopeBlocksToVolume(
  blocks: OutputBlock[],
  volumeBlockKeys?: string[] | null,
): OutputBlock[] {
  const all = Array.isArray(blocks) ? blocks : [];
  if (!volumeBlockKeys || volumeBlockKeys.length === 0) return all;
  const allowed = new Set(volumeBlockKeys);
  return all.filter((b) => allowed.has(b.block_key));
}

export default function WarningBanner({ blocks, volumeBlockKeys, volumeTitle }: WarningBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const scoped = useMemo(
    () => scopeBlocksToVolume(blocks, volumeBlockKeys),
    [blocks, volumeBlockKeys],
  );
  const warnings = useMemo(() => computeWarnings(scoped), [scoped]);
  const scopeLabel =
    volumeBlockKeys && volumeBlockKeys.length > 0
      ? ` · ${volumeTitle || "selected volume"}`
      : "";

  if (warnings.length === 0) return null;

  return (
    <div className="fps-warning-banner">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-foreground">
            {warnings.length} {warnings.length === 1 ? "note" : "notes"}{scopeLabel}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-1">
          {warnings.map((w) => (
            <div key={w.id} className="flex items-start gap-2 text-xs text-muted-foreground">
              {w.icon === "attention" ? (
                <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
              )}
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Warning computation — pure function
// ═══════════════════════════════════════════════════════════

export function computeWarnings(blocks: OutputBlock[]): Warning[] {
  const warnings: Warning[] = [];

  // 1. Hidden blocks
  const hiddenCount = blocks.filter((b) => !b.visible).length;
  if (hiddenCount > 0) {
    warnings.push({
      id: "hidden",
      icon: "info",
      message: `${hiddenCount} ${hiddenCount === 1 ? "block is" : "blocks are"} hidden and will not appear in export`,
    });
  }

  // 2. Not-captured blocks
  const notCaptured = blocks.filter(
    (b) => b.visible && b.content.source_status === "not_captured",
  );
  if (notCaptured.length > 0) {
    warnings.push({
      id: "not-captured",
      icon: "attention",
      message: `${notCaptured.length} ${notCaptured.length === 1 ? "block has" : "blocks have"} no content captured yet`,
    });
  }

  // 3. Empty pricing
  const emptyPricing = blocks.filter(
    (b) =>
      b.visible &&
      (b.render_key === "pricing_table_single" ||
        b.render_key === "pricing_table_multi" ||
        b.render_key === "quote_pricing_vat") &&
      (!b.content.pricing_rows || b.content.pricing_rows.length === 0),
  );
  if (emptyPricing.length > 0) {
    warnings.push({
      id: "empty-pricing",
      icon: "attention",
      message: "Pricing block has no pricing scenarios captured",
    });
  }

  // 4. Empty SLA
  const emptySla = blocks.filter(
    (b) =>
      b.visible &&
      b.render_key === "annexure_sla" &&
      (!b.content.sla_rows || b.content.sla_rows.length === 0),
  );
  if (emptySla.length > 0) {
    warnings.push({
      id: "empty-sla",
      icon: "attention",
      message: "SLA block has no KPI data captured",
    });
  }

  // 5. Default-only content (visible blocks with only default content)
  const defaultOnly = blocks.filter(
    (b) => b.visible && b.content.source_status === "default" && !b.content.html && !b.content.variables,
  );
  if (defaultOnly.length > 0) {
    warnings.push({
      id: "default-only",
      icon: "info",
      message: `${defaultOnly.length} ${defaultOnly.length === 1 ? "block is" : "blocks are"} showing default content only`,
    });
  }

  return warnings;
}
