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

import { RefreshCw, Info, Loader2 } from "lucide-react";

interface SourceDriftBannerProps {
  drifted: boolean;
  checking: boolean;
  onRefreshFromSource: () => void;
  onRecheck: () => void;
}

export default function SourceDriftBanner({
  drifted,
  checking,
  onRefreshFromSource,
  onRecheck,
}: SourceDriftBannerProps) {
  if (checking) {
    return (
      <div className="fps-drift-banner">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 flex-shrink-0" />
        <span className="text-xs">Checking for source changes…</span>
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
