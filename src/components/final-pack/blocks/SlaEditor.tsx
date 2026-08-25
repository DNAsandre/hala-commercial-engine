/**
 * SlaEditor.tsx
 * ─────────────
 * FPS-020 — Editable SLA matrix with permanent source-copy label.
 *
 * CRITICAL SOURCE-TRUTH SAFETY:
 * - Writes ONLY to doc_instances.blocks
 * - NEVER calls .update() / .upsert() / .delete() on commercial_tickets
 * - Source-copy label is permanent. Not dismissible.
 * - No lock icons.
 */

import { useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { OutputBlock, BlockContent, SlaOutputRow } from "@/lib/final-pack-loader";

interface SlaEditorProps {
  block: OutputBlock;
  onContentChange: (content: Partial<BlockContent>) => void;
}

export default function SlaEditor({ block, onContentChange }: SlaEditorProps) {
  const rows = block.content.sla_rows || [];

  const handleCellChange = useCallback(
    (rowIndex: number, field: keyof SlaOutputRow, value: string) => {
      const updated = rows.map((r, i) =>
        i === rowIndex ? { ...r, [field]: value } : r,
      );
      onContentChange({ sla_rows: updated, source_status: "populated" });
    },
    [rows, onContentChange],
  );

  const addRow = useCallback(() => {
    const next: SlaOutputRow = { kpi: "New KPI", target: "", measurement: "", penalty: "" };
    onContentChange({ sla_rows: [...rows, next], source_status: "populated" });
  }, [rows, onContentChange]);

  const removeRow = useCallback((rowIndex: number) => {
    onContentChange({ sla_rows: rows.filter((_, index) => index !== rowIndex), source_status: "populated" });
  }, [rows, onContentChange]);

  return (
    <div className="space-y-3">
      {/* Source-copy label — PERMANENT, NOT DISMISSIBLE */}
      <div className="fps-source-label">
        <span>📋</span>
        <span>Output copy — source SLA is managed in Hala Solution Design</span>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent">
          <Plus className="h-3.5 w-3.5" /> Add SLA row
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No SLA/KPI data captured yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">KPI</th>
                <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">Target</th>
                <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">Measurement</th>
                <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">Penalty</th>
                <th className="w-10"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.kpi}
                      onChange={(e) => handleCellChange(i, "kpi", e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent text-foreground focus:outline-none focus:bg-accent/30 rounded transition-colors"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.target}
                      onChange={(e) => handleCellChange(i, "target", e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent text-foreground focus:outline-none focus:bg-accent/30 rounded transition-colors"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.measurement}
                      onChange={(e) => handleCellChange(i, "measurement", e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent text-foreground focus:outline-none focus:bg-accent/30 rounded transition-colors"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.penalty}
                      onChange={(e) => handleCellChange(i, "penalty", e.target.value)}
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent text-foreground focus:outline-none focus:bg-accent/30 rounded transition-colors"
                    />
                  </td>
                  <td className="px-1 py-1 text-right">
                    <button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={`Remove SLA row ${i + 1}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
