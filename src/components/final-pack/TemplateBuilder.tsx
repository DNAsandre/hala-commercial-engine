/**
 * TemplateBuilder.tsx
 * ───────────────────
 * FPS-005 — Template Authoring surface inside FinalPackStudio (NOT a separate
 * product, NOT the deleted legacy Template Builder page).
 *
 * List / create / clone / publish / retire templates and edit recipes (which
 * create new versions). Everything is advisory — template status never gates
 * any existing document or export.
 */

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Plus, Copy, Loader2, FileStack, CheckCircle2, Archive, PencilLine,
} from "lucide-react";
import {
  useTemplates,
  TEMPLATE_DOC_TYPES,
  type TemplateSummary,
  type TemplateVersion,
  type TemplateClass,
  type TemplateScope,
  type TemplateDocType,
} from "@/hooks/useTemplates";
import { useModalDialog } from "@/hooks/useModalDialog";
import RecipeEditor from "./RecipeEditor";

interface TemplateBuilderProps {
  onBack: () => void;
  createdBy?: string;
}

const CLASSES: TemplateClass[] = ["customer_facing", "internal", "certificate"];
const SCOPES: TemplateScope[] = ["workspace", "personal", "hala_global"];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    published: "bg-emerald-500/10 text-emerald-600",
    draft: "bg-amber-500/10 text-amber-600",
    archived: "bg-gray-500/10 text-gray-500",
  };
  return map[status] || "bg-accent text-muted-foreground";
}

export default function TemplateBuilder({ onBack, createdBy }: TemplateBuilderProps) {
  const {
    templates, loading, error, refresh,
    createTemplate, cloneTemplate, setStatus, getVersions, getLastOperationError,
  } = useTemplates();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(false);

  const selected = templates.find((t) => t.id === selectedId) || null;

  const loadVersions = useCallback(async (id: string) => {
    setVersions(await getVersions(id));
  }, [getVersions]);

  useEffect(() => {
    if (selectedId) loadVersions(selectedId);
  }, [selectedId, loadVersions]);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Template
          </button>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground">Template Library</h2>
          <p className="text-sm text-muted-foreground">
            Create, clone, edit, and version reusable templates. Status is advisory — it never blocks any document.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-600 text-xs">
            Couldn’t load some templates — existing documents are unaffected.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
          {/* List */}
          <div className="space-y-2">
            {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
            {!loading && templates.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No templates yet. Create one.</p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedId(t.id); setEditingRecipe(false); }}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedId === t.id ? "border-primary/50 bg-accent/40" : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileStack className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${statusBadge(t.status)}`}>{t.status}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.doc_type} · v{t.latest_version_number} · {t.template_class}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="rounded-lg border border-border bg-card p-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Select a template to view details.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{selected.name}</h3>
                  {selected.description && <p className="text-xs text-muted-foreground mt-0.5">{selected.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded ${statusBadge(selected.status)}`}>{selected.status}</span>
                    <span className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{selected.doc_type}</span>
                    <span className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{selected.template_class}</span>
                    <span className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{selected.scope}</span>
                  </div>
                </div>

                {/* Versions */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Versions</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {versions.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">v{v.version_number}</span>
                        <span>{Array.isArray(v.recipe) ? v.recipe.length : 0} blocks</span>
                        {v.published_at && <span className="text-emerald-600">published</span>}
                      </div>
                    ))}
                    {versions.length === 0 && <p className="text-xs text-muted-foreground">No versions.</p>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => setEditingRecipe(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent"
                  >
                    <PencilLine className="h-3.5 w-3.5" /> Edit recipe
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => { setBusy(true); const c = await cloneTemplate(selected.id); setBusy(false); if (c) setSelectedId(c.id); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent disabled:opacity-50"
                  >
                    <Copy className="h-3.5 w-3.5" /> Clone
                  </button>
                  {selected.status !== "published" && (
                    <button
                      disabled={busy}
                      onClick={async () => { setBusy(true); await setStatus(selected.id, "published", createdBy); setBusy(false); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Publish
                    </button>
                  )}
                  {selected.status !== "archived" && (
                    <button
                      disabled={busy}
                      onClick={async () => { setBusy(true); await setStatus(selected.id, "archived", createdBy); setBusy(false); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <Archive className="h-3.5 w-3.5" /> Retire
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateTemplateForm
          createdBy={createdBy}
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            const t = await createTemplate(input);
            if (t) {
              setShowCreate(false);
              setSelectedId(t.id);
              refresh();
              return { ok: true as const };
            }
            return { ok: false as const, error: getLastOperationError() || "The template was not created." };
          }}
        />
      )}

      {/* Recipe editor */}
      {editingRecipe && selected && (
        <RecipeEditor
          templateId={selected.id}
          templateName={selected.name}
          baseVersion={versions[0] ?? null}
          onClose={() => setEditingRecipe(false)}
          onSaved={() => loadVersions(selected.id)}
        />
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════
// Create form
// ═══════════════════════════════════════════════════════════

function CreateTemplateForm({
  createdBy, onClose, onCreate,
}: {
  createdBy?: string;
  onClose: () => void;
  onCreate: (input: {
    name: string; doc_type: TemplateDocType; description: string;
    template_class: TemplateClass; scope: TemplateScope; created_by?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<TemplateDocType>("proposal");
  const [cls, setCls] = useState<TemplateClass>("customer_facing");
  const [scope, setScope] = useState<TemplateScope>("workspace");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const dialogRef = useModalDialog(onClose);

  const input = "w-full px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Create template" tabIndex={-1} className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">New template</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium">Name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="My template" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium">Doc type</span>
              <select className={input} value={docType} onChange={(e) => setDocType(e.target.value as TemplateDocType)}>
                {TEMPLATE_DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Class</span>
              <select className={input} value={cls} onChange={(e) => setCls(e.target.value as TemplateClass)}>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Scope</span>
              <select className={input} value={scope} onChange={(e) => setScope(e.target.value as TemplateScope)}>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium">Description — optional</span>
            <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {createError && <p className="text-xs text-destructive">{createError}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setCreateError(null);
              const result = await onCreate({ name, doc_type: docType, description, template_class: cls, scope, created_by: createdBy });
              if (!result.ok) setCreateError(result.error);
              setBusy(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}
