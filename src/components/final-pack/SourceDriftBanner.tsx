/**
 * SourceDriftBanner.tsx
 * ─────────────────────
 * FPS-031 — Source drift detection banner.
 *
 * Shown when tender source has changed since the pack was created.
 * Refresh is EXPLICIT. Never silent. Never automatic.
 * Banner does NOT disable export.
 *
 * Source-truth safety:
 * - Display only — no writes from this component
 * - Refresh action is triggered via callback (parent handles the write)
 *
 * Do not auto-refresh. Do not silently update.
 * Do not disable export when drift detected.
 */

import { RefreshCw, Info, Loader2, AlertTriangle } from "lucide-react";

interface SourceDriftBannerProps {
  drifted: boolean;
  checking: boolean;
  /**
   * PADW T06b (PDS-05): this action RESTORES the frozen creation-time
   * snapshot (discarding edits to source-bound blocks). It was previously
   * labeled "Refresh from source", which it never was — the label now says
   * what the button does.
   */
  onRefreshFromSource: () => void;
  /**
   * PADW T06b (PDS-05): the REAL refresh — re-runs the source load against
   * the CURRENT tender/proposal record and rebuilds the snapshot + hash.
   * Optional until the studio callsite wires it (integration seam).
   */
  onRebuildFromSource?: () => void;
  onRecheck: () => void;
  /** Set when the check could not be performed at all (W04-T09). */
  error?: string | null;
}

export default function SourceDriftBanner({
  drifted,
  checking,
  onRefreshFromSource,
  onRebuildFromSource,
  onRecheck,
  error,
}: SourceDriftBannerProps) {
  if (checking) {
    return (
      <div className="fps-drift-banner">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 flex-shrink-0" />
        <span className="text-xs">Checking for source changes…</span>
      </div>
    );
  }

  // A failed check is NOT "no changes" — say so, and offer the retry.
  if (error) {
    return (
      <div className="fps-drift-banner">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-xs">
            Could not check the linked source record for changes — {error} Your document is unaffected.
          </span>
        </div>
        <button
          onClick={onRecheck}
          className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Try the source check again"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!drifted) return null;

  return (
    <div className="fps-drift-banner">
      <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
      <div className="flex-1">
        <span className="text-xs">
          The linked source record has changed since this pack was created.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onRecheck}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Re-check for changes"
        >
          Re-check
        </button>
        <button
          onClick={onRefreshFromSource}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Restore this document's blocks to the snapshot taken when it was created. Does NOT read the current source; edits to source-bound blocks are discarded."
        >
          Restore original snapshot
        </button>
        {onRebuildFromSource && (
          <button
            onClick={onRebuildFromSource}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            title="Re-read the current record and rebuild source-bound blocks from it. Your custom blocks are kept."
          >
            <RefreshCw className="h-3 w-3" />
            Rebuild from current source
          </button>
        )}
      </div>
    </div>
  );
}
