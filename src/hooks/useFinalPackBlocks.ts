/**
 * useFinalPackBlocks.ts
 * ─────────────────────
 * FPS-015 + FPS-029 — Block manipulation hook with undo/redo stack.
 *
 * Manages block array operations: reorder, toggle visibility,
 * update content, add, remove. All changes flow through
 * onBlocksChange for auto-save.
 *
 * FPS-029 additions:
 * - Undo/redo action stack (max 50)
 * - resetBlockFromSource(blockId) — restores single block to snapshot
 * - resetAllFromSource() — rebuilds source blocks, preserves custom
 *
 * Source-truth safety:
 * - All mutations target doc_instances.blocks only
 * - Never writes to commercial_tickets
 * - Reset reads from source_snapshot (stored in doc_instances)
 * - Does NOT re-read commercial_tickets for reset
 */

import { useCallback, useRef } from "react";
import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";

const MAX_UNDO_STACK = 50;

export interface UseFinalPackBlocksReturn {
  /** Move a block from one index to another */
  moveBlock: (fromIndex: number, toIndex: number) => void;
  /** Toggle visibility of a block */
  toggleVisibility: (blockId: string) => void;
  /** Update content for a specific block */
  updateBlockContent: (blockId: string, content: Partial<BlockContent>) => void;
  /** Add a new block at a specific position */
  addBlock: (block: OutputBlock, atIndex?: number) => void;
  /** Duplicate a block — inserts an independent copy directly below the original */
  duplicateBlock: (blockId: string) => void;
  /** Remove a block by ID (non-required blocks only) */
  removeBlock: (blockId: string) => void;
  /** Get block by ID */
  getBlock: (blockId: string) => OutputBlock | undefined;
  /** Undo last action */
  undo: () => void;
  /** Redo last undone action */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Reset a single block to its snapshot value */
  resetBlockFromSource: (blockId: string, snapshotBlocks: OutputBlock[]) => void;
  /** Reset all source-bound blocks from snapshot, preserving custom blocks */
  resetAllFromSource: (snapshotBlocks: OutputBlock[]) => void;
}

/**
 * @param blocks - Current block array from the instance
 * @param onBlocksChange - Callback to persist changes (from auto-save)
 */
export function useFinalPackBlocks(
  blocks: OutputBlock[],
  onBlocksChange: (blocks: OutputBlock[]) => void,
): UseFinalPackBlocksReturn {

  // ── Undo/redo stack ──
  const undoStackRef = useRef<OutputBlock[][]>([]);
  const redoStackRef = useRef<OutputBlock[][]>([]);

  /** Push current state to undo stack before mutation */
  const pushUndo = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO_STACK - 1)),
      blocks,
    ];
    // Any new action clears redo
    redoStackRef.current = [];
  }, [blocks]);

  /** Apply blocks change with undo tracking */
  const applyChange = useCallback(
    (updated: OutputBlock[]) => {
      pushUndo();
      onBlocksChange(updated);
    },
    [pushUndo, onBlocksChange],
  );

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current, blocks];
    onBlocksChange(previous);
  }, [blocks, onBlocksChange]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[redoStackRef.current.length - 1];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current, blocks];
    onBlocksChange(next);
  }, [blocks, onBlocksChange]);

  // ── Block operations ──

  const moveBlock = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= blocks.length) return;
      if (toIndex < 0 || toIndex >= blocks.length) return;

      const updated = [...blocks];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      const reordered = updated.map((b, i) => ({ ...b, order: i + 1 }));
      applyChange(reordered);
    },
    [blocks, applyChange],
  );

  const toggleVisibility = useCallback(
    (blockId: string) => {
      const updated = blocks.map((b) =>
        b.id === blockId ? { ...b, visible: !b.visible } : b,
      );
      applyChange(updated);
    },
    [blocks, applyChange],
  );

  const updateBlockContent = useCallback(
    (blockId: string, contentUpdate: Partial<BlockContent>) => {
      const updated = blocks.map((b) =>
        b.id === blockId
          ? { ...b, content: { ...b.content, ...contentUpdate } }
          : b,
      );
      applyChange(updated);
    },
    [blocks, applyChange],
  );

  const addBlock = useCallback(
    (block: OutputBlock, atIndex?: number) => {
      const idx = atIndex ?? blocks.length;
      const updated = [...blocks];
      updated.splice(idx, 0, block);
      const reordered = updated.map((b, i) => ({ ...b, order: i + 1 }));
      applyChange(reordered);
    },
    [blocks, applyChange],
  );

  const duplicateBlock = useCallback(
    (blockId: string) => {
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx === -1) return;
      const orig = blocks[idx];
      const nowIso = new Date().toISOString();

      // New unique id for the duplicate (independent block instance).
      const rand =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);
      const newId = `${orig.render_key}-dup-${rand}`;

      // Deep-copy content so editing the duplicate never affects the original.
      const clonedContent = JSON.parse(JSON.stringify(orig.content));

      const clone: OutputBlock = {
        ...orig,
        id: newId,
        display_name: `${orig.display_name} (Copy)`,
        required: false, // a duplicate is never a required source block
        content: clonedContent,
        provenance: {
          origin: "duplicated",
          origin_ref: { original_block_id: orig.id },
          source_mode: orig.provenance?.source_mode,
          source_kind: orig.provenance?.source_kind,
          creation_method: "duplicate",
          captured_at: nowIso,
          duplicated_at: nowIso,
        },
      };

      const updated = [...blocks];
      updated.splice(idx + 1, 0, clone); // directly below the original
      const reordered = updated.map((b, i) => ({ ...b, order: i + 1 }));
      applyChange(reordered);
    },
    [blocks, applyChange],
  );

  const removeBlock = useCallback(
    (blockId: string) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      if (block.required) return;

      const updated = blocks.filter((b) => b.id !== blockId);
      const reordered = updated.map((b, i) => ({ ...b, order: i + 1 }));
      applyChange(reordered);
    },
    [blocks, applyChange],
  );

  const getBlock = useCallback(
    (blockId: string) => blocks.find((b) => b.id === blockId),
    [blocks],
  );

  // ── Source reset operations ──

  const resetBlockFromSource = useCallback(
    (blockId: string, snapshotBlocks: OutputBlock[]) => {
      const sourceBlock = snapshotBlocks.find((sb) => sb.id === blockId);
      if (!sourceBlock) return;

      const updated = blocks.map((b) =>
        b.id === blockId
          ? { ...b, content: sourceBlock.content, visible: sourceBlock.visible }
          : b,
      );
      applyChange(updated);
    },
    [blocks, applyChange],
  );

  const resetAllFromSource = useCallback(
    (snapshotBlocks: OutputBlock[]) => {
      // Preserve custom blocks (those not in snapshot)
      const snapshotIds = new Set(snapshotBlocks.map((sb) => sb.id));
      const customBlocks = blocks.filter((b) => !snapshotIds.has(b.id));

      // Rebuild: source blocks in snapshot order + custom blocks at the end
      const restored = snapshotBlocks.map((sb, i) => ({ ...sb, order: i + 1 }));
      const withCustom = [
        ...restored,
        ...customBlocks.map((b, i) => ({ ...b, order: restored.length + i + 1 })),
      ];

      applyChange(withCustom);
    },
    [blocks, applyChange],
  );

  return {
    moveBlock,
    toggleVisibility,
    updateBlockContent,
    addBlock,
    duplicateBlock,
    removeBlock,
    getBlock,
    undo,
    redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    resetBlockFromSource,
    resetAllFromSource,
  };
}
