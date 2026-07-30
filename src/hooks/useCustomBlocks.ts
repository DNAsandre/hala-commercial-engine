/**
 * useCustomBlocks.ts
 * ──────────────────
 * FPS-003-03 — Reusable custom block hook (doc_custom_blocks).
 *
 * Lists and creates reusable blocks. Everything here is NON-BLOCKING:
 * if the table is empty or a read fails, the composer keeps working and
 * the BlockPicker still functions for standard blocks.
 *
 * Source-truth safety:
 * - Reads/writes doc_custom_blocks only (RLS: dcb_read / dcb_write, authenticated).
 * - Never writes to commercial_tickets or doc_instances.
 * - Insert does NOT select-after-insert (avoids read-back stalls); we hold the
 *   generated id + timestamps locally.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type CustomBlockStatus = "draft" | "published" | "retired";
export type CustomBlockScope = "hala_global" | "workspace" | "personal";

export interface CustomBlock {
  id: string;
  name: string;
  block_type: string;
  content_en: string;
  content_ar: string;
  category: string;
  is_global: boolean;
  status: string;
  scope: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NewCustomBlock {
  name: string;
  block_type?: string;
  content_en: string;
  content_ar?: string;
  category?: string;
  scope?: CustomBlockScope | string;
  status?: CustomBlockStatus | string;
  tags?: string[];
  created_by?: string;
}

export interface UseCustomBlocksReturn {
  blocks: CustomBlock[];
  loading: boolean;
  error: string | null;
  /** Re-fetch the reusable block list. */
  refresh: () => Promise<void>;
  /** Create a reusable block. Returns it on success, null on failure (non-blocking). */
  create: (block: NewCustomBlock) => Promise<CustomBlock | null>;
}

// ═══════════════════════════════════════════════════════════
// Normalizer — tolerate missing/legacy fields safely
// ═══════════════════════════════════════════════════════════

function normalizeRow(row: any): CustomBlock {
  return {
    id: String(row.id ?? ""),
    name: row.name ?? "Untitled block",
    block_type: row.block_type ?? "narrative",
    content_en: row.content_en ?? "",
    content_ar: row.content_ar ?? "",
    category: row.category ?? "commercial",
    is_global: row.is_global ?? false,
    status: row.status ?? "draft",
    scope: row.scope ?? "workspace",
    tags: Array.isArray(row.tags) ? row.tags : [],
    created_by: row.created_by ?? "",
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

// ═══════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════

export function useCustomBlocks(): UseCustomBlocksReturn {
  const [blocks, setBlocks] = useState<CustomBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: listErr } = await supabase
        .from("doc_custom_blocks")
        .select(
          "id,name,block_type,content_en,content_ar,category,is_global,status,scope,tags,created_by,created_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200);

      if (listErr) {
        // Non-blocking: surface the error, keep an empty list.
        setError(listErr.message);
        setBlocks([]);
        return;
      }
      setBlocks((data ?? []).map(normalizeRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reusable blocks");
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (block: NewCustomBlock): Promise<CustomBlock | null> => {
      try {
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const scope = block.scope || "workspace";

        const row = {
          id,
          name: (block.name || "").trim() || "Untitled block",
          block_type: block.block_type || "narrative",
          content_en: block.content_en ?? "",
          content_ar: block.content_ar ?? "",
          category: block.category || "commercial",
          scope,
          status: block.status || "draft",
          tags: block.tags ?? [],
          // Keep legacy is_global consistent with the richer scope model.
          is_global: scope === "hala_global",
          created_by: block.created_by || "User",
          updated_by: block.created_by || "User",
        };

        // No select-after-insert (avoids read-back stalls); use local values.
        const { error: insertErr } = await supabase.from("doc_custom_blocks").insert(row);
        if (insertErr) {
          setError(insertErr.message);
          return null;
        }

        const created = normalizeRow({ ...row, created_at: nowIso, updated_at: nowIso });
        setBlocks((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save reusable block");
        return null;
      }
    },
    [],
  );

  return { blocks, loading, error, refresh, create };
}

// ═══════════════════════════════════════════════════════════
// Mapping: reusable block → composer block (FPS-003-07/08)
// ═══════════════════════════════════════════════════════════

// (kept in a separate module to avoid importing OutputBlock types into the hook)
