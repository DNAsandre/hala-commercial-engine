/**
 * VersionHistoryPanel.tsx
 * ───────────────────────
 * FPS-007-07 — View previous document versions and restore/copy from one.
 *
 * Read-only inspection of past versions. Restore requires an explicit click +
 * confirmation. Never locks the current document, never gates export. If
 * history fails to load, the composer keeps working.
 */

import { useEffect, useState } from "react";
import { X, History, RotateCcw, Loader2, FileText } from "lucide-react";
import { useInstanceVersions, type InstanceVersion } from "@/hooks/useInstanceVersions";
import type { OutputBlock } from "@/lib/final-pack-loader";
import { useModalDialog } from "@/hooks/useModalDialog";

interface VersionHistoryPanelProps {
  instanceId: string;
  onRestore: (version: InstanceVersion) => void | Promise<void>;
  onClose: () => void;
}

/**
 * W04-C4: the `catch` here never fired. `toLocaleString` on an unparseable date
 * does not throw — it RETURNS the string "Invalid Date", which was rendered on
 * every version row. Guard on the timestamp instead.
 */
export function fmt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

export default function VersionHistoryPanel({ instanceId, onRestore, onClose }: VersionHistoryPanelProps) {
  const { versions, loading, error, refresh } = useInstanceVersions(instanceId);
  const [selected, setSelected] = useState<InstanceVersion | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useModalDialog(onClose);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Document version history" tabIndex={-1} className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Version history</h2>
          </div>
          <button onClick={onClose} aria-label="Close version history" className="p-1 rounded hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-[1fr_1.1fr] gap-0 flex-1 overflow-hidden">
          {/* Version list */}
          <div className="border-r border-border overflow-y-auto p-3 space-y-1">
            {loading && <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
            {/* Failed read ≠ empty history — three distinct states. */}
            {!loading && error && (
              <div className="px-2 py-3 space-y-2 text-center">
                <p className="text-xs text-amber-600">Version history could not be read — {error}</p>
                <button
                  onClick={() => { void refresh(); }}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                >
                  Try again
                </button>
              </div>
            )}
            {!loading && !error && versions.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No versions yet — they appear as you edit.</p>
            )}
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => { setSelected(v); setConfirming(false); }}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                  selected?.id === v.id ? "border-primary/50 bg-accent/40" : "border-border hover:bg-accent/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">v{v.version_number}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{v.blocks.length} blocks</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {fmt(v.created_at)}{v.created_by ? ` · ${v.created_by}` : ""}
                </div>
                {v.change_reason && <div className="text-[10px] text-muted-foreground italic">{v.change_reason}</div>}
              </button>
            ))}
          </div>

          {/* Selected version detail (read-only) */}
          <div className="overflow-y-auto p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Select a version to inspect.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Version {selected.version_number}</h3>
                  <p className="text-xs text-muted-foreground">{fmt(selected.created_at)} · {selected.blocks.length} blocks</p>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {selected.blocks.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{b.display_name || b.block_key}</span>
                      {!b.visible && <span className="text-[9px] px-1 rounded bg-accent">hidden</span>}
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-border">
                  {!confirming ? (
                    <button
                      onClick={() => setConfirming(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore this version
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-600">Replace current blocks with v{selected.version_number}?</span>
                      <button
                        onClick={() => { void onRestore(selected); }}
                        className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                      >
                        Confirm restore
                      </button>
                      <button onClick={() => setConfirming(false)} className="px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
