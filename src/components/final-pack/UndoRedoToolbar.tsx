/**
 * UndoRedoToolbar.tsx
 * ───────────────────
 * FPS-030 — Undo/redo buttons + reset dropdown.
 *
 * Source-truth safety: Same as FPS-029. No direct DB writes.
 * Do not add undo/redo for export actions.
 */

import { useState } from "react";
import { Undo2, Redo2, RotateCcw, ChevronDown } from "lucide-react";

interface UndoRedoToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetBlock: () => void;
  onResetAll: () => void;
}

export default function UndoRedoToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetBlock,
  onResetAll,
}: UndoRedoToolbarProps) {
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"block" | "all" | null>(null);

  const handleResetBlock = () => {
    setConfirmAction("block");
    setResetOpen(false);
  };

  const handleResetAll = () => {
    setConfirmAction("all");
    setResetOpen(false);
  };

  const confirmReset = () => {
    if (confirmAction === "block") onResetBlock();
    if (confirmAction === "all") onResetAll();
    setConfirmAction(null);
  };

  return (
    <div className="flex items-center gap-1 relative">
      {/* Undo */}
      <button
        onClick={onUndo}
        className={`p-1.5 rounded transition-colors ${
          canUndo
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground/40 cursor-default"
        }`}
        title="Undo"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>

      {/* Redo */}
      <button
        onClick={onRedo}
        className={`p-1.5 rounded transition-colors ${
          canRedo
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground/40 cursor-default"
        }`}
        title="Redo"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      {/* Reset dropdown */}
      <div className="relative">
        <button
          onClick={() => setResetOpen(!resetOpen)}
          className="inline-flex items-center gap-0.5 p-1.5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Reset from source"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5" />
        </button>

        {resetOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setResetOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border border-border bg-card shadow-lg py-1">
              <button
                onClick={handleResetBlock}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
              >
                Reset selected block from source
              </button>
              <button
                onClick={handleResetAll}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
              >
                Reset full pack from source
              </button>
            </div>
          </>
        )}
      </div>

      {/* Confirmation dialog — recovery safety, not a gate */}
      {confirmAction && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setConfirmAction(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-lg border border-border bg-card shadow-xl p-4">
            <p className="text-sm font-medium text-foreground mb-2">
              {confirmAction === "block"
                ? "Reset this block from source?"
                : "Reset full pack from source?"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {confirmAction === "block"
                ? "This will restore content from the original snapshot. Your edits on this block will be lost."
                : "This will restore all source-bound blocks from the original snapshot. Custom blocks will be preserved. Your edits on source blocks will be lost."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
