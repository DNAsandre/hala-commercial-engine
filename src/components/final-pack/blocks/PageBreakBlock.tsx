/**
 * PageBreakBlock.tsx
 * ──────────────────
 * FPS-021 — Visual page break marker. No editor needed.
 *
 * Renders as a dashed line with "Page Break" label.
 * In PDF export, this renders as page-break-before: always.
 */

export default function PageBreakBlock() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 border-t border-dashed border-border" />
      <span className="text-xs text-muted-foreground font-medium px-2">
        Page Break
      </span>
      <div className="flex-1 border-t border-dashed border-border" />
    </div>
  );
}
