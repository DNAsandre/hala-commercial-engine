/**
 * BlockAISparkleMenu.tsx
 * ──────────────────────
 * FPS-008-06 — Category / microbot dropdown for a single editable block.
 *
 * Pure presentational dropdown. It lists the discovered Bot Builder microbots
 * (grouped by category) for THIS block's type. It does NOT call AI, run a bot,
 * preview, or mutate the block — selecting a bot only raises onSelect; runtime
 * invocation is wired in a later sprint step (FPS-008-09).
 *
 * Everything is advisory: empty discovery shows a friendly note, never a gate.
 * Unavailable bots (no runnable version in Bot Builder) are shown disabled with
 * the reason, never hidden silently.
 */

import { useEffect, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import type { BotDiscoveryResult, DiscoveredBot } from "@/lib/final-pack-bots";

interface BlockAISparkleMenuProps {
  result: BotDiscoveryResult;
  loading?: boolean;
  /** Raised when a runnable bot is chosen. Runtime is NOT wired here yet. */
  onSelect: (bot: DiscoveredBot) => void;
  onClose: () => void;
}

export default function BlockAISparkleMenu({
  result,
  loading,
  onSelect,
  onClose,
}: BlockAISparkleMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (advisory; never traps focus).
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-9 z-30 w-72 rounded-md border border-border bg-popover shadow-lg"
      role="menu"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <span className="flex-1 text-xs font-medium text-foreground">AI assistants</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="max-h-80 overflow-y-auto py-1">
        {loading ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Loading assistants…</p>
        ) : result.totalBots === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No AI assistants are enabled for this block type.
          </p>
        ) : (
          result.categories.map((cat) => (
            <div key={cat.category} className="px-1 py-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {cat.category}
              </div>
              {cat.bots.map((bot) => (
                <button
                  key={bot.id}
                  role="menuitem"
                  disabled={!bot.available}
                  onClick={() => bot.available && onSelect(bot)}
                  title={bot.available ? bot.description || bot.display_name : bot.unavailable_reason}
                  className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-violet-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {bot.display_name}
                    </span>
                    {bot.available
                      ? bot.description && (
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {bot.description}
                          </span>
                        )
                      : (
                          <span className="block truncate text-[11px] text-amber-600">
                            {bot.unavailable_reason || "Unavailable"}
                          </span>
                        )}
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Advisory footer — selecting does not run anything yet */}
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        Preview-only · controlled in Bot Builder
      </div>
    </div>
  );
}
