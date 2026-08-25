/**
 * PricingEditor.tsx
 * ─────────────────
 * FPS-019 — Editable pricing table with permanent source-copy label.
 *
 * CRITICAL SOURCE-TRUTH SAFETY:
 * - This component writes ONLY to doc_instances.blocks
 * - This component NEVER calls .update() / .upsert() / .delete() on commercial_tickets
 * - The source-copy label is permanent. Not dismissible. Not a warning. Not a gate.
 * - No lock icons.
 *
 * Do not write to commercial_tickets.
 * Do not add lock icons.
 * Do not show "resolve in Hala first".
 * Do not generate fake pricing.
 */

import { useCallback } from "react";
import type { OutputBlock, BlockContent, PricingOutputRow } from "@/lib/final-pack-loader";

interface PricingEditorProps {
  block: OutputBlock;
  onContentChange: (content: Partial<BlockContent>) => void;
}

export default function PricingEditor({ block, onContentChange }: PricingEditorProps) {
  const rows = block.content.pricing_rows || [];
  const variables = block.content.variables;

  // ── For totals block (variables-based) ──
  if (variables && block.render_key === "totals_words") {
    return (
      <TotalsEditor
        variables={variables}
        onVariablesChange={(vars) =>
          onContentChange({ variables: vars, source_status: "populated" })
        }
      />
    );
  }

  // ── Pricing table ──
  const handleCellChange = useCallback(
    (rowIndex: number, field: keyof PricingOutputRow, value: string) => {
      const updated = rows.map((r, i) =>
        i === rowIndex ? { ...r, [field]: value } : r,
      );
      onContentChange({ pricing_rows: updated, source_status: "populated" });
    },
    [rows, onContentChange],
  );

  return (
    <div className="space-y-3">
      {/* Source-copy label — PERMANENT, NOT DISMISSIBLE */}
      <div className="fps-source-label">
        <span>📋</span>
        <span>Output copy — source pricing is managed in Hala Pricing stage</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pricing scenarios captured yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">Scenario</th>
                <th className="text-left px-2 py-1.5 text-xs font-medium text-muted-foreground">Type</th>
                {/* PADW T06a (PDS-01 seam): the output copy is customer-facing —
                    internal Cost / GP % / Recommended / Notes columns removed. */}
                <th className="text-right px-2 py-1.5 text-xs font-medium text-muted-foreground">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id || i} className="border-b border-border/50">
                  <td className="px-1 py-1">
                    <EditableCell value={row.scenario_name} onChange={(v) => handleCellChange(i, "scenario_name", v)} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell value={row.scenario_type} onChange={(v) => handleCellChange(i, "scenario_type", v)} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell value={row.revenue} onChange={(v) => handleCellChange(i, "revenue", v)} align="right" />
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

// ─── Totals sub-editor ─────────────────────────────────

function TotalsEditor({
  variables,
  onVariablesChange,
}: {
  variables: Record<string, string>;
  onVariablesChange: (vars: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="fps-source-label">
        <span>📋</span>
        <span>Output copy — source pricing is managed in Hala Pricing stage</span>
      </div>
      <div className="space-y-2">
        {Object.entries(variables).map(([key, value]) => (
          <div key={key} className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground w-32 flex-shrink-0">
              {key.replace(/_/g, " ")}
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) =>
                onVariablesChange({ ...variables, [key]: e.target.value })
              }
              className="flex-1 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Editable cell ─────────────────────────────────────

function EditableCell({
  value,
  onChange,
  align = "left",
}: {
  value: string;
  onChange: (v: string) => void;
  align?: "left" | "right" | "center";
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-2 py-1 text-sm border-0 bg-transparent text-foreground focus:outline-none focus:bg-accent/30 rounded transition-colors text-${align}`}
    />
  );
}
