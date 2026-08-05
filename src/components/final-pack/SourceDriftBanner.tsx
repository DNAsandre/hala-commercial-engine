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
  onRefreshFromSource: () => void;
  onRecheck: () => void;
  /** Set when the check could not be performed at all (W04-T09). */
  error?: string | null;
}

export default function SourceDriftBanner({
  drifted,
  checking,
  onRefreshFromSource,
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
            Could not check the tender source for changes — {error} Your document is unaffected.
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
          Tender source has changed since this pack was created.
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
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh from source
        </button>
      </div>
    </div>
  );
}
