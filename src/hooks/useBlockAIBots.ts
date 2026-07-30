/**
 * useBlockAIBots.ts
 * ─────────────────
 * FPS-008-04 — React hook over the read-only Block AI Microbot discovery service.
 *
 * Discovers FinalPackStudio sparkle-menu bots from Bot Builder for the current
 * editing context (block type / document intent / source mode). This hook does
 * NOTHING but discover + shape — no AI calls, no bot runs, no UI, no preview.
 *
 * Non-blocking by construction: failures/empties yield EMPTY_DISCOVERY and never
 * surface as gates. Re-runs whenever the editing context changes; `refresh()`
 * re-queries live Bot Builder so a toggle there reflects without a reload.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  discoverBlockAIBots,
  EMPTY_DISCOVERY,
  type BotDiscoveryContext,
  type BotDiscoveryResult,
} from "@/lib/final-pack-bots";

export interface UseBlockAIBotsReturn {
  result: BotDiscoveryResult;
  loading: boolean;
  error: string | null;
  /** Re-query live Bot Builder (reflects enable/disable toggles). */
  refresh: () => Promise<void>;
}

export function useBlockAIBots(context: BotDiscoveryContext = {}): UseBlockAIBotsReturn {
  const [result, setResult] = useState<BotDiscoveryResult>(EMPTY_DISCOVERY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable key so the effect only re-runs when a relevant filter changes.
  const key = `${context.blockType ?? ""}|${context.documentIntent ?? ""}|${context.sourceMode ?? ""}`;
  const ctxRef = useRef(context);
  ctxRef.current = context;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await discoverBlockAIBots(ctxRef.current);
      setResult(r);
    } catch (err) {
      // discoverBlockAIBots already swallows, but stay defensive.
      setError(err instanceof Error ? err.message : "Bot discovery failed");
      setResult(EMPTY_DISCOVERY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, run]);

  return { result, loading, error, refresh: run };
}
