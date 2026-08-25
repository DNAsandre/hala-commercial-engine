/**
 * useSourceDrift.ts
 * ─────────────────
 * FPS-031 — Source drift detection hook.
 *
 * Compares current tender source hash against the frozen snapshot hash.
 * Re-uses the loader's own projection + hash (buildTenderSourceData /
 * computeSourceHash), which is stable-stringified, so key reordering cannot
 * produce a false positive and the two hashes are comparable at all.
 *
 * Source-truth safety:
 * - READS commercial_tickets (same projection as the snapshot; read only)
 * - Does NOT write to commercial_tickets
 * - Refresh writes to doc_instances.blocks only
 *
 * Do not auto-refresh. Do not silently update.
 * Do not disable export when drift detected.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  TENDER_SOURCE_SELECT,
  buildTenderSourceData,
  computeSourceHash,
} from "@/lib/final-pack-loader";

export interface UseSourceDriftReturn {
  /** Whether the source has changed since the snapshot */
  drifted: boolean;
  /** Loading state for drift check */
  checking: boolean;
  /** Trigger a re-check */
  recheck: () => void;
  /** Current source hash (null if not yet checked) */
  currentHash: string | null;
  /**
   * Set when the check could NOT be performed (read failed / row missing).
   * "Could not check" must never render as "no drift" — they are different
   * facts and a human has to be able to tell them apart.
   */
  error: string | null;
}

export interface SourceDriftResult {
  /** null when the comparison could not be made */
  drifted: boolean | null;
  currentHash: string | null;
  error: string | null;
}

/**
 * Read the tender source and compare it to the frozen snapshot hash.
 *
 * W04-T09 correction: this used to hash `type_details` alone while the snapshot
 * hash is computed over the loader's projection (buildTenderSourceData). The two
 * hashes could never match, so every connected document permanently claimed
 * "Tender source has changed". Both sides now hash the SAME projection.
 */
export async function checkSourceDrift(
  tenderId: string,
  snapshotHash: string,
): Promise<SourceDriftResult> {
  try {
    // READ ONLY — same projection the snapshot hash was built from.
    const { data, error } = await supabase
      .from("commercial_tickets")
      .select(TENDER_SOURCE_SELECT)
      .eq("id", tenderId)
      .maybeSingle();

    if (error) {
      return { drifted: null, currentHash: null, error: error.message };
    }
    if (!data) {
      return {
        drifted: null,
        currentHash: null,
        error: `Source tender ${tenderId} is no longer readable.`,
      };
    }

    const hash = await computeSourceHash(buildTenderSourceData(data));
    return { drifted: hash !== snapshotHash, currentHash: hash, error: null };
  } catch (err) {
    return {
      drifted: null,
      currentHash: null,
      error: err instanceof Error ? err.message : "Source check failed.",
    };
  }
}

/**
 * @param tenderId - The commercial ticket the INSTANCE is linked to.
 *   PADW T06b (PDS-19): callers must pass the instance's own
 *   `linked_entity_id`, never a route URL param — a resumed connected
 *   document on `/pdf-studio` has no URL param, and keying the check to the
 *   route silently skipped it (indistinguishable from "checked, unchanged").
 * @param snapshotHash - The hash stored in doc_instances.source_snapshot._hash
 */
export function useSourceDrift(
  tenderId: string | undefined,
  snapshotHash: string | null,
): UseSourceDriftReturn {
  const [drifted, setDrifted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkDrift = useCallback(async () => {
    if (!tenderId || !snapshotHash) {
      // Nothing to compare against — this is not drift and not an error.
      setDrifted(false);
      setError(null);
      return;
    }

    setChecking(true);
    const result = await checkSourceDrift(tenderId, snapshotHash);
    setChecking(false);

    if (result.error || result.drifted === null) {
      // Unknown ≠ unchanged. Report it instead of showing a clean banner.
      setDrifted(false);
      setCurrentHash(null);
      setError(result.error ?? "Source check failed.");
      return;
    }

    setCurrentHash(result.currentHash);
    setDrifted(result.drifted);
    setError(null);
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
    error,
  };
}
