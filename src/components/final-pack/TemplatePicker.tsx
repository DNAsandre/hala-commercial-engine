/**
 * TemplatePicker.tsx
 * ──────────────────
 * FPS-001-07 — Choose an existing template for standalone document creation.
 *
 * Lists templates from doc_templates (published preferred). On selection it
 * builds a standalone template source, dispatches it, persists the instance,
 * and hands off to the shared composer. No connected source required.
 *
 * Source-truth safety: reads doc_templates only; never mutates templates.
 */

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, AlertTriangle, LayoutTemplate, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { loadDocumentPack } from "@/lib/load-document-pack";
import type { DocumentIntent } from "@/lib/document-source";
import { useFinalPackInstance, type FinalPackInstance } from "@/hooks/useFinalPackInstance";

interface TemplatePickerProps {
  onInstanceReady: (instance: FinalPackInstance) => void;
  onBack: () => void;
}

interface TemplateRow {
  id: string;
  name: string;
  doc_type: string;
  status: string;
  description: string;
}

/** Map a template doc_type to a document intent (carried into pack_type). */
function docTypeToIntent(docType: string): DocumentIntent {
  switch (docType) {
    case "quote": return "quotation";
    case "proposal": return "combined_proposal";
    case "sla": return "sla";
    case "msa": return "msa";
    default: return "custom_pack";
  }
}

export default function TemplatePicker({ onInstanceReady, onBack }: TemplatePickerProps) {
  const { createInstance, error } = useFinalPackInstance();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  // W04-T09 — a failed template read is not "no templates".
  const [readError, setReadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setReadError(null);
      const { data, error: readErr } = await supabase
        .from("doc_templates")
        .select("id, name, doc_type, status, description")
        .order("status", { ascending: true })
        .order("name", { ascending: true });
      if (cancelled) return;
      if (readErr) {
        setTemplates([]);
        setReadError(readErr.message);
        setLoading(false);
        return;
      }
      // Prefer published, but never hide usable templates (advisory only).
      const rows = (data || []) as TemplateRow[];
      rows.sort((a, b) => (a.status === "published" ? -1 : 1) - (b.status === "published" ? -1 : 1));
      setTemplates(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSelect = useCallback(
    async (tpl: TemplateRow) => {
      setCreatingId(tpl.id);
      setCreateError(null);
      try {
        const snapshot = await loadDocumentPack({
          mode: "standalone",
          kind: "template",
          creation: "template",
          packType: docTypeToIntent(tpl.doc_type),
          templateId: tpl.id,
        });
        if (snapshot.error) {
          console.error("[TemplatePicker] Loader error:", snapshot.error);
          setCreateError(`Could not start a document from "${tpl.name}": ${snapshot.error}`);
          return;
        }
        const instance = await createInstance(null, snapshot);
        if (instance) onInstanceReady(instance);
      } catch (err) {
        console.error("[TemplatePicker] Create failed:", err);
        setCreateError(
          err instanceof Error ? err.message : "Could not start a document from this template.",
        );
      } finally {
        setCreatingId(null);
      }
    },
    [createInstance, onInstanceReady],
  );

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Start From Template</h2>
          <p className="text-sm text-muted-foreground">
            Choose a template to create a standalone document.
          </p>
        </div>

        {(error || createError) && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{createError || error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : readError ? (
          /* Read failed — distinct from "there are none". */
          <div className="text-center space-y-3 py-8">
            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Templates could not be loaded — {readError}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
            >
              Retry
            </button>
          </div>
        ) : templates.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No templates found.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelect(tpl)}
                disabled={creatingId !== null}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-accent/60">
                    <LayoutTemplate className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{tpl.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                        {tpl.status}
                      </span>
                    </div>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {tpl.description}
                      </p>
                    )}
                  </div>
                </div>
                {creatingId === tpl.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
