/**
 * useInstanceVersions.ts
 * ──────────────────────
 * FPS-007-05/06 — Append-only document version history (doc_instance_versions).
 *
 * Versions are for restore/traceability. NON-BLOCKING: a failed version write
 * never blocks the save, the edit, or the export. Versioning is never an
 * approval gate.
 */

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { OutputBlock } from "@/lib/final-pack-loader";

export interface InstanceVersion {
  id: string;
  doc_instance_id: string;
  version_number: number;
  blocks: OutputBlock[];
  source_snapshot: Record<string, unknown>;
  created_by: string;
  created_at: string;
  change_reason: string | null;
}

function normalize(row: any): InstanceVersion {
  return {
    id: row.id,
    doc_instance_id: row.doc_instance_id,
    version_number: row.version_number ?? 1,
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    source_snapshot: row.source_snapshot ?? {},
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    change_reason: row.change_reason ?? null,
  };
}

export interface UseInstanceVersionsReturn {
  versions: InstanceVersion[];
  loading: boolean;
  /** Non-null only when the history read FAILED (≠ "no versions yet"). */
  error: string | null;
  refresh: () => Promise<void>;
  /** Append a version row. Returns the new version number, or null on failure. */
  append: (
    blocks: OutputBlock[],
    sourceSnapshot: Record<string, unknown>,
    createdBy?: string,
    changeReason?: string,
  ) => Promise<number | null>;
}

export function useInstanceVersions(instanceId: string | null): UseInstanceVersionsReturn {
  const [versions, setVersions] = useState<InstanceVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!instanceId) { setVersions([]); setError(null); return; }
    setLoading(true);
    try {
      // Explicit ORDER BY — history order is never left to the server default.
      const { data, error: readErr } = await supabase
        .from("doc_instance_versions")
        .select("id,doc_instance_id,version_number,blocks,source_snapshot,created_by,created_at,change_reason")
        .eq("doc_instance_id", instanceId)
        .order("version_number", { ascending: false })
        .limit(100);
      if (readErr) {
        // A failed read must not render as "no versions yet".
        setVersions([]);
        setError(readErr.message);
        return;
      }
      setVersions((data ?? []).map(normalize));
      setError(null);
    } catch (err) {
      setVersions([]);
      setError(err instanceof Error ? err.message : "Could not read version history.");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  const append = useCallback(
    async (
      blocks: OutputBlock[],
      sourceSnapshot: Record<string, unknown>,
      createdBy?: string,
      changeReason?: string,
    ): Promise<number | null> => {
      if (!instanceId) return null;
      try {
        const { data: maxRows } = await supabase
          .from("doc_instance_versions")
          .select("version_number")
          .eq("doc_instance_id", instanceId)
          .order("version_number", { ascending: false })
          .limit(1);
        const next = (maxRows?.[0]?.version_number ?? 0) + 1;
        // id defaults to gen_random_uuid(); no select-after-insert.
        const { error } = await supabase.from("doc_instance_versions").insert({
          doc_instance_id: instanceId,
          version_number: next,
          blocks,
          source_snapshot: sourceSnapshot ?? {},
          created_by: createdBy ?? "User",
          change_reason: changeReason ?? null,
        });
        if (error) {
          console.error("[FPS] version append failed (non-blocking):", error.message);
          return null;
        }
        return next;
      } catch (err) {
        console.error("[FPS] version append error (non-blocking):", err);
        return null;
      }
    },
    [instanceId],
  );

  return { versions, loading, error, refresh, append };
}
