/**
 * useTemplates.ts
 * ───────────────
 * FPS-005 — Template authoring hook (doc_templates + doc_template_versions).
 *
 * Create / clone / version / publish / retire / save-as-template. Append-only
 * versions. NON-BLOCKING: failures surface an error but never gate documents
 * or exports. Respects live CHECK constraints:
 *   status   ∈ {draft, published, archived}   (retire → 'archived')
 *   doc_type ∈ {quote, proposal, sla, msa, tender, renewal, report}
 *
 * Inserts do NOT select-after-insert (avoids read-back stalls); ids + timestamps
 * are generated locally.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type TemplateStatus = "draft" | "published" | "archived";
export type TemplateDocType =
  | "quote" | "proposal" | "sla" | "msa" | "tender" | "renewal" | "report";
export type TemplateClass = "customer_facing" | "internal" | "certificate";
export type TemplateScope = "hala_global" | "workspace" | "personal";

export const TEMPLATE_DOC_TYPES: TemplateDocType[] = [
  "quote", "proposal", "sla", "msa", "tender", "renewal", "report",
];

/** A recipe entry — matches the live doc_template_versions.recipe shape. */
export interface RecipeEntry {
  block_key: string;
  order: number;
  required: boolean;
  default_content_override: string | null;
  config_override: Record<string, unknown>;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  recipe: RecipeEntry[];
  layout: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  doc_type: string;
  status: string;
  template_class: string;
  scope: string;
  default_branding_profile_id: string | null;
  default_locale: string;
  description: string;
  updated_at: string;
  latest_version_number: number;
}

export interface CreateTemplateInput {
  name: string;
  doc_type: TemplateDocType | string;
  description?: string;
  template_class?: TemplateClass | string;
  scope?: TemplateScope | string;
  default_branding_profile_id?: string | null;
  default_locale?: string;
  recipe?: RecipeEntry[];
  layout?: Record<string, unknown>;
  status?: TemplateStatus;
  created_by?: string;
}

export interface UseTemplatesReturn {
  templates: TemplateSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getVersions: (templateId: string) => Promise<TemplateVersion[]>;
  createTemplate: (input: CreateTemplateInput) => Promise<TemplateSummary | null>;
  cloneTemplate: (templateId: string, newName?: string) => Promise<TemplateSummary | null>;
  saveRecipeVersion: (
    templateId: string,
    recipe: RecipeEntry[],
    layout?: Record<string, unknown>,
  ) => Promise<TemplateVersion | null>;
  setStatus: (templateId: string, status: TemplateStatus, updatedBy?: string) => Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function newTemplateId(): string {
  return `tpl-${crypto.randomUUID()}`;
}
function newVersionId(): string {
  return `tplv-${crypto.randomUUID()}`;
}

function normalizeSummary(t: any, latest: number): TemplateSummary {
  return {
    id: String(t.id),
    name: t.name ?? "Untitled template",
    doc_type: t.doc_type ?? "proposal",
    status: t.status ?? "draft",
    template_class: t.template_class ?? "customer_facing",
    scope: t.scope ?? "workspace",
    default_branding_profile_id: t.default_branding_profile_id ?? null,
    default_locale: t.default_locale ?? "en",
    description: t.description ?? "",
    updated_at: t.updated_at ?? "",
    latest_version_number: latest,
  };
}

// ═══════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: tErr } = await supabase
        .from("doc_templates")
        .select(
          "id,name,doc_type,status,template_class,scope,default_branding_profile_id,default_locale,description,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(300);
      if (tErr) {
        setError(tErr.message);
        setTemplates([]);
        return;
      }
      // Latest version_number per template (single read; computed in JS).
      const { data: vers } = await supabase
        .from("doc_template_versions")
        .select("template_id,version_number");
      const latest = new Map<string, number>();
      for (const v of vers ?? []) {
        const cur = latest.get(v.template_id) ?? 0;
        if ((v.version_number ?? 0) > cur) latest.set(v.template_id, v.version_number);
      }
      setTemplates((rows ?? []).map((t) => normalizeSummary(t, latest.get(t.id) ?? 1)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getVersions = useCallback(async (templateId: string): Promise<TemplateVersion[]> => {
    const { data, error: vErr } = await supabase
      .from("doc_template_versions")
      .select("id,template_id,version_number,recipe,layout,published_at,created_at")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false });
    if (vErr || !data) return [];
    return data.map((v: any) => ({
      id: v.id,
      template_id: v.template_id,
      version_number: v.version_number ?? 1,
      recipe: Array.isArray(v.recipe) ? v.recipe : [],
      layout: v.layout ?? {},
      published_at: v.published_at ?? null,
      created_at: v.created_at ?? "",
    }));
  }, []);

  const createTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<TemplateSummary | null> => {
      try {
        const id = newTemplateId();
        const nowIso = new Date().toISOString();
        const templateRow = {
          id,
          name: (input.name || "").trim() || "Untitled template",
          doc_type: input.doc_type || "proposal",
          status: input.status || "draft",
          default_branding_profile_id: input.default_branding_profile_id ?? null,
          default_locale: input.default_locale || "en",
          description: input.description ?? "",
          template_class: input.template_class || "customer_facing",
          scope: input.scope || "workspace",
          created_by: input.created_by || "User",
          updated_by: input.created_by || "User",
        };
        const { error: tErr } = await supabase.from("doc_templates").insert(templateRow);
        if (tErr) {
          setError(tErr.message);
          return null;
        }
        // First version (v1).
        const versionRow = {
          id: newVersionId(),
          template_id: id,
          version_number: 1,
          recipe: input.recipe ?? [],
          layout: input.layout ?? {},
          published_at: input.status === "published" ? nowIso : null,
          created_by: input.created_by || "User",
        };
        const { error: vErr } = await supabase.from("doc_template_versions").insert(versionRow);
        if (vErr) {
          setError(vErr.message);
          // Template row exists but version failed — surface, don't crash.
        }
        const summary = normalizeSummary({ ...templateRow, updated_at: nowIso }, 1);
        setTemplates((prev) => [summary, ...prev]);
        return summary;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create template");
        return null;
      }
    },
    [],
  );

  const cloneTemplate = useCallback(
    async (templateId: string, newName?: string): Promise<TemplateSummary | null> => {
      const source = templates.find((t) => t.id === templateId);
      const versions = await getVersions(templateId);
      const latest = versions[0]; // versions ordered desc
      return createTemplate({
        name: newName || `${source?.name ?? "Template"} (Copy)`,
        doc_type: source?.doc_type ?? "proposal",
        description: source?.description ?? "",
        template_class: source?.template_class,
        scope: source?.scope,
        default_branding_profile_id: source?.default_branding_profile_id ?? null,
        default_locale: source?.default_locale,
        recipe: latest?.recipe ?? [],
        layout: latest?.layout ?? {},
        status: "draft",
      });
    },
    [templates, getVersions, createTemplate],
  );

  const saveRecipeVersion = useCallback(
    async (
      templateId: string,
      recipe: RecipeEntry[],
      layout?: Record<string, unknown>,
    ): Promise<TemplateVersion | null> => {
      try {
        const versions = await getVersions(templateId);
        const nextNumber = (versions[0]?.version_number ?? 0) + 1;
        const nowIso = new Date().toISOString();
        const versionRow = {
          id: newVersionId(),
          template_id: templateId,
          version_number: nextNumber,
          recipe,
          layout: layout ?? versions[0]?.layout ?? {},
          published_at: null,
          created_by: "User",
        };
        const { error: vErr } = await supabase.from("doc_template_versions").insert(versionRow);
        if (vErr) {
          setError(vErr.message);
          return null;
        }
        await supabase
          .from("doc_templates")
          .update({ updated_at: nowIso, updated_by: "User" })
          .eq("id", templateId);
        await refresh();
        return {
          id: versionRow.id,
          template_id: templateId,
          version_number: nextNumber,
          recipe,
          layout: versionRow.layout,
          published_at: null,
          created_at: nowIso,
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save version");
        return null;
      }
    },
    [getVersions, refresh],
  );

  const setStatus = useCallback(
    async (templateId: string, status: TemplateStatus, updatedBy?: string): Promise<boolean> => {
      const { error: sErr } = await supabase
        .from("doc_templates")
        .update({ status, updated_at: new Date().toISOString(), updated_by: updatedBy || "User" })
        .eq("id", templateId);
      if (sErr) {
        setError(sErr.message);
        return false;
      }
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, status } : t)),
      );
      return true;
    },
    [],
  );

  return {
    templates,
    loading,
    error,
    refresh,
    getVersions,
    createTemplate,
    cloneTemplate,
    saveRecipeVersion,
    setStatus,
  };
}
