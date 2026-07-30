/**
 * SaveBlockDialog.tsx
 * ───────────────────
 * FPS-003-06 — Save the current document block as a reusable custom block.
 *
 * Prefills content from the selected block. Saving NEVER mutates the current
 * document block and NEVER blocks export — a failure shows an advisory only.
 */

import { useMemo, useState } from "react";
import { X, Loader2, Library, Check, AlertTriangle } from "lucide-react";
import type { OutputBlock } from "@/lib/final-pack-loader";
import {
  useCustomBlocks,
  type CustomBlockScope,
  type CustomBlockStatus,
} from "@/hooks/useCustomBlocks";

interface SaveBlockDialogProps {
  block: OutputBlock;
  createdBy?: string;
  onClose: () => void;
}

/** Best-effort extraction of editable HTML/text from any block shape. */
function extractContent(block: OutputBlock): string {
  const c = block.content;
  if (c.html && c.html.trim()) return c.html;
  if (c.variables && Object.keys(c.variables).length > 0) {
    return Object.entries(c.variables)
      .map(([k, v]) => `<p><strong>${k.replace(/_/g, " ")}:</strong> ${v}</p>`)
      .join("");
  }
  return block.default_content || "";
}

const SCOPES: { value: CustomBlockScope; label: string }[] = [
  { value: "workspace", label: "Workspace" },
  { value: "personal", label: "Personal" },
  { value: "hala_global", label: "Hala Global" },
];

const STATUSES: { value: CustomBlockStatus; label: string }[] = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "retired", label: "Retired" },
];

export default function SaveBlockDialog({ block, createdBy, onClose }: SaveBlockDialogProps) {
  const { create } = useCustomBlocks();

  const initialContent = useMemo(() => extractContent(block), [block]);

  const [name, setName] = useState(block.display_name || "Reusable Block");
  const [category, setCategory] = useState(block.family || "commercial");
  const [scope, setScope] = useState<CustomBlockScope>("workspace");
  const [status, setStatus] = useState<CustomBlockStatus>("published");
  const [contentEn, setContentEn] = useState(initialContent);
  const [contentAr, setContentAr] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await create({
        name,
        block_type: "narrative",
        content_en: contentEn,
        content_ar: contentAr || undefined,
        category,
        scope,
        status,
        tags: tags
          ? tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        created_by: createdBy,
      });
      if (!result) {
        setError("Couldn’t save the reusable block. Your document is unaffected — you can keep working.");
        return;
      }
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Save as reusable block</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            This saves a copy to your reusable library. The current document block stays exactly as it is.
          </p>

          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Category">
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
            <Field label="Scope">
              <select value={scope} onChange={(e) => setScope(e.target.value as CustomBlockScope)} className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as CustomBlockStatus)} className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Content (EN)">
            <textarea
              value={contentEn}
              onChange={(e) => setContentEn(e.target.value)}
              rows={5}
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs"
            />
          </Field>

          <Field label="Content (AR) — optional">
            <textarea
              value={contentAr}
              onChange={(e) => setContentAr(e.target.value)}
              rows={3}
              dir="rtl"
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs"
            />
          </Field>

          <Field label="Tags — optional (comma separated)">
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="pricing, intro, sla"
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-600 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {done && <Check className="h-3.5 w-3.5" />}
            {done ? "Saved" : "Save to library"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
