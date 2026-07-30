/**
 * TocBlock.tsx
 * ────────────
 * FPS-022 — Auto-generated table of contents.
 *
 * Read-only. Regenerates from heading blocks in current order.
 * Reflects current block order after reorder, not original snapshot order.
 */

import type { OutputBlock } from "@/lib/final-pack-loader";

interface TocBlockProps {
  block: OutputBlock;
  /** All blocks in the current document (for TOC generation) */
  blocks: OutputBlock[];
}

export default function TocBlock({ block, blocks }: TocBlockProps) {
  // Generate TOC from visible blocks that have display names
  const tocEntries = blocks
    .filter((b) => b.visible && b.id !== block.id)
    .map((b, index) => ({
      order: index + 1,
      display_name: b.display_name,
      family: b.family,
      block_key: b.block_key,
    }));

  if (tocEntries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No visible blocks to generate table of contents.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Auto-generated from document structure. Updates when blocks are reordered.
      </p>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-accent/30">
              <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground w-12">#</th>
              <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Section</th>
              <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground w-24">Type</th>
            </tr>
          </thead>
          <tbody>
            {tocEntries.map((entry) => (
              <tr key={`${entry.block_key}-${entry.order}`} className="border-t border-border/50">
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{entry.order}</td>
                <td className="px-3 py-1.5 text-sm text-foreground">{entry.display_name}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{entry.family}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
