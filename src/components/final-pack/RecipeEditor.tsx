/**
 * RecipeEditor.tsx
 * ────────────────
 * FPS-005-07/08 — Edit a template's block recipe and save it as a NEW version.
 *
 * Reuses the existing block library. Append-only: saving creates a new
 * doc_template_versions row; existing versions and existing documents are
 * never mutated. No required-block gates, no export coupling.
 */

import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, X, Save, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  useTemplates,
  type RecipeEntry,
  type TemplateVersion,
} from "@/hooks/useTemplates";

interface RecipeEditorProps {
  templateId: string;
  templateName: string;
  baseVersion: TemplateVersion | null;
  onClose: () => void;
  onSaved?: (version: TemplateVersion) => void;
}

interface LibBlock {
  block_key: string;
  display_name: string;
  family: string;
}

export default function RecipeEditor({
  templateId,
  templateName,
  baseVersion,
  onClose,
  onSaved,
}: RecipeEditorProps) {
  const { saveRecipeVersion, error: templatesError } = useTemplates();
  // W04-C4: a failed version insert used to end the interaction silently — the
  // spinner stopped, the dialog stayed open, and nothing said the recipe was
  // not stored.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<RecipeEntry[]>(
    () => (baseVersion?.recipe ?? []).map((r, i) => ({ ...r, order: i + 1 })),
  );
  const [library, setLibrary] = useState<LibBlock[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("doc_block_library")
        .select("block_key, display_name, family")
        .order("family")
        .order("display_name");
      if (!cancelled && data) setLibrary(data as LibBlock[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= recipe.length) return;
    const next = [...recipe];
    [next[i], next[j]] = [next[j], next[i]];
    setRecipe(next.map((r, k) => ({ ...r, order: k + 1 })));
  };

  const remove = (i: number) => {
    setRecipe(recipe.filter((_, k) => k !== i).map((r, k) => ({ ...r, order: k + 1 })));
  };

  const addBlock = (lib: LibBlock) => {
    setRecipe([
      ...recipe,
      {
        block_key: lib.block_key,
        order: recipe.length + 1,
        required: false,
        default_content_override: null,
        config_override: {},
      },
    ]);
    setPicking(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const version = await saveRecipeVersion(templateId, recipe, baseVersion?.layout);
    setSaving(false);
    if (version) {
      setDone(true);
      onSaved?.(version);
      setTimeout(onClose, 900);
      return;
    }
    setSaveError(
      templatesError
        ? `This recipe version was not stored — ${templatesError}`
        : "This recipe version was not stored. Nothing was saved; your edits are still in this dialog.",
    );
  };

  const displayName = (key: string) =>
    library.find((l) => l.block_key === key)?.display_name || key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Edit recipe — {templateName}</h2>
            <p className="text-xs text-muted-foreground">
              Saving creates a new version. Existing versions and documents are untouched.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-2 overflow-y-auto flex-1">
          {recipe.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Empty recipe — add blocks below.
            </p>
          )}
          {recipe.map((entry, i) => (
            <div
              key={`${entry.block_key}-${i}`}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card"
            >
              <span className="text-xs text-muted-foreground w-5">{entry.order}</span>
              <span className="flex-1 text-sm text-foreground truncate">
                {displayName(entry.block_key)}
              </span>
              <span className="text-[10px] text-muted-foreground">{entry.block_key}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0}
                className="p-1 rounded hover:bg-accent disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === recipe.length - 1}
                className="p-1 rounded hover:bg-accent disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(i)}
                className="p-1 rounded hover:bg-accent text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Add block */}
          {!picking ? (
            <button
              onClick={() => setPicking(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add block
            </button>
          ) : (
            <div className="border border-border rounded-md max-h-48 overflow-y-auto">
              {library.map((lib) => (
                <button
                  key={lib.block_key}
                  onClick={() => addBlock(lib)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 text-left text-sm"
                >
                  <span className="flex-1 truncate">{lib.display_name}</span>
                  <span className="text-[10px] text-muted-foreground">{lib.family}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* W04-C4: a failed version write is visible, and does not look like a save. */}
        {saveError && (
          <div className="mx-5 mb-2 px-3 py-2 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-xs">
            {saveError}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {done ? "Saved new version" : "Save as new version"}
          </button>
        </div>
      </div>
    </div>
  );
}
