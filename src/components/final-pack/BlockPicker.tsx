/**
 * BlockPicker.tsx
 * ───────────────
 * FPS-016 — Block picker modal for adding new blocks from the library.
 *
 * Fetches blocks from doc_block_library (real data, not hardcoded).
 * Allows adding: custom text, page break, and any library block.
 *
 * Source-truth safety: Reads doc_block_library only.
 */

import { useState, useEffect } from "react";
import { Plus, X, FileText, SeparatorHorizontal, Type, Library, Languages } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { OutputBlock } from "@/lib/final-pack-loader";
import { makeBlockProvenance } from "@/lib/final-pack-snapshot-contract";
import { useCustomBlocks } from "@/hooks/useCustomBlocks";
import { customBlockToOutputBlock } from "@/lib/reusable-block-mapping";

/** Blocks the user adds in the composer are manual insertions (FPS-002). */
const MANUAL_ADDED_PROVENANCE = () =>
  makeBlockProvenance("manual", { creation_method: "blank" });

interface BlockPickerProps {
  onAddBlock: (block: OutputBlock) => void;
  existingBlockKeys: string[];
}

interface LibraryBlock {
  id: string;
  block_key: string;
  family: string;
  display_name: string;
  editor_mode: string;
  render_key: string;
  default_content: string;
  schema_config: Record<string, unknown>;
  permissions: Record<string, unknown>;
}

export default function BlockPicker({ onAddBlock, existingBlockKeys }: BlockPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"standard" | "reusable">("standard");
  const [libraryBlocks, setLibraryBlocks] = useState<LibraryBlock[]>([]);
  const [loading, setLoading] = useState(false);

  // Reusable custom blocks (FPS-003). Non-blocking: failures never disable the picker.
  const { blocks: reusableBlocks, loading: reusableLoading, error: reusableError, refresh: refreshReusable } =
    useCustomBlocks();

  // Fetch library blocks on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function fetchBlocks() {
      setLoading(true);
      const { data } = await supabase
        .from("doc_block_library")
        .select("id, block_key, family, display_name, editor_mode, render_key, default_content, schema_config, permissions")
        .order("family")
        .order("display_name");

      if (!cancelled && data) {
        setLibraryBlocks(data as LibraryBlock[]);
      }
      setLoading(false);
    }

    fetchBlocks();
    return () => { cancelled = true; };
  }, [open]);

  // Refresh reusable blocks each time the picker opens (pick up newly-saved blocks).
  useEffect(() => {
    if (open) refreshReusable();
  }, [open, refreshReusable]);

  const handleAddLibraryBlock = (lib: LibraryBlock) => {
    const newBlock: OutputBlock = {
      id: `${lib.block_key}-added-${Date.now()}`,
      block_key: lib.block_key,
      render_key: lib.render_key,
      display_name: lib.display_name,
      family: lib.family,
      editor_mode: lib.editor_mode,
      visible: true,
      order: 0, // Will be re-numbered by addBlock
      required: false,
      content: {
        html: lib.default_content || "",
        source_status: "default",
      },
      default_content: lib.default_content || "",
      schema_config: lib.schema_config || {},
      permissions: lib.permissions || {},
      provenance: MANUAL_ADDED_PROVENANCE(),
    };
    onAddBlock(newBlock);
    setOpen(false);
  };

  const handleAddCustomText = () => {
    const newBlock: OutputBlock = {
      id: `custom_text-${Date.now()}`,
      block_key: "custom_text",
      render_key: "custom_text",
      display_name: "Custom Text Block",
      family: "commercial",
      editor_mode: "wysiwyg",
      visible: true,
      order: 0,
      required: false,
      content: {
        html: "",
        source_status: "default",
      },
      default_content: "",
      schema_config: {},
      permissions: {},
      provenance: MANUAL_ADDED_PROVENANCE(),
    };
    onAddBlock(newBlock);
    setOpen(false);
  };

  const handleAddPageBreak = () => {
    const newBlock: OutputBlock = {
      id: `page_break-${Date.now()}`,
      block_key: "page_break",
      render_key: "page_break",
      display_name: "Page Break",
      family: "asset",
      editor_mode: "readonly",
      visible: true,
      order: 0,
      required: false,
      content: { source_status: "default" },
      default_content: "",
      schema_config: {},
      permissions: {},
      // FPS-010 — label the insertion intent for traceability (never a gate).
      provenance: makeBlockProvenance("manual", { creation_method: "page_break_insert" }),
    };
    onAddBlock(newBlock);
    setOpen(false);
  };

  // Insert a reusable block as an editable COPY (reusable_library provenance).
  const handleAddReusable = (cbId: string) => {
    const cb = reusableBlocks.find((b) => b.id === cbId);
    if (!cb) return;
    onAddBlock(customBlockToOutputBlock(cb));
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Add Block
      </button>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-medium text-foreground">Add Block</span>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Quick add */}
      <div className="px-4 py-3 space-y-1.5 border-b border-border">
        <button
          onClick={handleAddCustomText}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left text-sm"
        >
          <Type className="h-4 w-4 text-muted-foreground" />
          Custom Text Block
        </button>
        <button
          onClick={handleAddPageBreak}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left text-sm"
        >
          <SeparatorHorizontal className="h-4 w-4 text-muted-foreground" />
          Page Break
        </button>
      </div>

      {/* Tabs: Standard library vs Reusable blocks */}
      <div className="flex items-center gap-1 px-3 pt-2.5">
        <button
          onClick={() => setTab("standard")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            tab === "standard"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Standard
        </button>
        <button
          onClick={() => setTab("reusable")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            tab === "reusable"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Library className="h-3.5 w-3.5" />
          Reusable{reusableBlocks.length > 0 ? ` (${reusableBlocks.length})` : ""}
        </button>
      </div>

      {/* Standard library blocks */}
      {tab === "standard" && (
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1">
          {loading && (
            <p className="text-xs text-muted-foreground py-2">Loading block library…</p>
          )}
          {!loading && libraryBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No blocks in library</p>
          )}
          {libraryBlocks.map((lib) => (
            <button
              key={lib.id}
              onClick={() => handleAddLibraryBlock(lib)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left text-sm"
            >
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{lib.display_name}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {lib.family}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Reusable custom blocks (advisory-only states; never blocks the picker) */}
      {tab === "reusable" && (
        <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-1">
          {reusableLoading && (
            <p className="text-xs text-muted-foreground py-2">Loading reusable blocks…</p>
          )}
          {reusableError && !reusableLoading && (
            <p className="text-xs text-amber-600 py-2">
              Couldn’t load reusable blocks — you can still add standard blocks.
            </p>
          )}
          {!reusableLoading && !reusableError && reusableBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No reusable blocks yet. Use “Save as reusable” on a block to add one.
            </p>
          )}
          {reusableBlocks.map((cb) => (
            <button
              key={cb.id}
              onClick={() => handleAddReusable(cb.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left text-sm"
            >
              <Library className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{cb.name}</span>
              {cb.content_ar && (
                <Languages className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">{cb.category}</span>
                {cb.status && cb.status !== "published" && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-accent text-muted-foreground">
                    {cb.status}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
