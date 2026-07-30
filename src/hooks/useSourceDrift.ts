/**
 * useSourceDrift.ts
 * ─────────────────
 * FPS-031 — Source drift detection hook.
 *
 * Compares current tender source hash against the frozen snapshot hash.
 * Uses the shared stableJsonStringify helper to avoid false positives from
 * JSON key reordering.
 *
 * Source-truth safety:
 * - READS commercial_tickets.type_details for comparison (read only)
 * - Does NOT write to commercial_tickets
 * - Refresh writes to doc_instances.blocks only
 *
 * Do not auto-refresh. Do not silently update.
 * Do not disable export when drift detected.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { stableJsonStringify } from "@/lib/stable-json";

export interface UseSourceDriftReturn {
  /** Whether the source has changed since the snapshot */
  drifted: boolean;
  /** Loading state for drift check */
  checking: boolean;
  /** Trigger a re-check */
  recheck: () => void;
  /** Current source hash (null if not yet checked) */
  currentHash: string | null;
}

/**
 * @param tenderId - The tender to check source drift for
 * @param snapshotHash - The hash stored in doc_instances.source_snapshot._hash
 */
export function useSourceDrift(
  tenderId: string | undefined,
  snapshotHash: string | null,
): UseSourceDriftReturn {
  const [drifted, setDrifted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null>(null);

  const checkDrift = useCallback(async () => {
    if (!tenderId || !snapshotHash) {
      setDrifted(false);
      return;
    }

    setChecking(true);

    try {
      // Read current tender source — READ ONLY
      const { data, error } = await supabase
        .from("commercial_tickets")
        .select("type_details")
        .eq("id", tenderId)
        .maybeSingle();

      if (error || !data) {
        console.error("[FPS Drift] Failed to read tender source:", error);
        setDrifted(false);
        setChecking(false);
        return;
      }

      // Compute hash with stable JSON stringify to avoid key-order drift.
      const sourceString = stableJsonStringify(data.type_details || {});
      const hash = await computeHash(sourceString);

      setCurrentHash(hash);
      setDrifted(hash !== snapshotHash);
    } catch (err) {
      console.error("[FPS Drift] Error checking drift:", err);
      setDrifted(false);
    } finally {
      setChecking(false);
    }
  }, [tenderId, snapshotHash]);

  // Check on mount and when dependencies change
  useEffect(() => {
    checkDrift();
  }, [checkDrift]);

  return {
    drifted,
    checking,
    recheck: checkDrift,
    currentHash,
  };
}

/**
 * Compute SHA-256 hash of a string.
 * Uses Web Crypto API (available in all modern browsers).
 */
async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
