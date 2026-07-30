/**
 * standalone-template-source.ts
 * ─────────────────────────────
 * FPS-001-05 — Standalone template adapter.
 *
 * Creates a document from an existing template WITHOUT any connected source.
 * Reads doc_templates + doc_template_versions + doc_block_library and builds
 * editable blocks from the template recipe using each block's default content.
 *
 * Source-truth safety:
 * - Reads template/library tables only. Never reads commercial_tickets.
 * - Never MUTATES templates while creating an instance.
 * - Returns the same BlockSnapshot shape as the connected adapter.
 * - No customer-specific values are injected (template default content only).
 */

import { supabase } from "../supabase";
import type { BlockSnapshot, OutputBlock, PackType } from "../final-pack-loader";
import type { DocumentSource } from "../document-source";
import { makeBlockProvenance } from "../final-pack-snapshot-contract";
import { resolveTemplateVariables, type TemplateVariableValues } from "../template-variables";

interface RecipeEntry {
  block_key: string;
  order: number;
  required: boolean;
  default_content_override: string | null;
  config_override: Record<string, unknown>;
}

interface BlockLibraryRow {
  id: string;
  block_key: string;
  family: string;
  display_name: string;
  editor_mode: string;
  render_key: string;
  default_content: string;
  schema_config: Record<string, unknown>;
  permissions: Record<string, unknown>;
}

function errorSnapshot(
  source: DocumentSource,
  templateId: string,
  error: string,
): BlockSnapshot {
  return {
    blocks: [],
    tender_id: "",
    tender_title: "Not available",
    customer_name: "",
    pack_type: (source.packType ?? "custom_pack") as PackType,
    template_id: templateId,
    template_name: "",
    source_hash: "",
    pricing_scenario_id: null,
    snapshot_at: new Date().toISOString(),
    source_data: {},
    warnings: [],
    error,
    source_mode: "standalone",
    source_kind: "template",
    creation_method: "template",
    linked_entity_type: "custom_document",
    linked_entity_id: null,
    template_version_id: null,
  };
}

/**
 * Build a standalone document snapshot from an existing template.
 */
export async function loadStandaloneTemplatePack(
  source: DocumentSource,
): Promise<BlockSnapshot> {
  const templateId = source.templateId ?? "";
  const warnings: string[] = [];

  if (!templateId) {
    return errorSnapshot(source, templateId, "No templateId provided for template source");
  }

  // ── 1. Resolve template version (pinned id if provided, else latest) ──
  let versionQuery = supabase
    .from("doc_template_versions")
    .select("id, template_id, recipe, version_number, layout");

  versionQuery = source.templateVersionId
    ? versionQuery.eq("id", source.templateVersionId)
    : versionQuery.eq("template_id", templateId).order("version_number", { ascending: false });

  const { data: templateVersion, error: tvErr } = await versionQuery.limit(1).maybeSingle();

  if (tvErr || !templateVersion) {
    return errorSnapshot(
      source,
      templateId,
      `Template version not found for ${templateId}: ${tvErr?.message || "no rows"}`,
    );
  }

  const recipe: RecipeEntry[] = Array.isArray(templateVersion.recipe)
    ? (templateVersion.recipe as RecipeEntry[])
    : [];

  if (recipe.length === 0) {
    return errorSnapshot(source, templateId, "Template recipe is empty");
  }

  // ── 2. Fetch block library definitions for the recipe ──
  const blockKeys = recipe.map((r) => r.block_key);
  const { data: blockDefs, error: blErr } = await supabase
    .from("doc_block_library")
    .select("id, block_key, family, display_name, editor_mode, render_key, default_content, schema_config, permissions")
    .in("block_key", blockKeys);

  if (blErr) {
    return errorSnapshot(source, templateId, `Block library error: ${blErr.message}`);
  }

  const blockMap = new Map<string, BlockLibraryRow>();
  for (const def of (blockDefs ?? [])) {
    blockMap.set(def.block_key, def as BlockLibraryRow);
  }

  // ── 3. Fetch template name ──
  const { data: templateRow } = await supabase
    .from("doc_templates")
    .select("name")
    .eq("id", templateId)
    .maybeSingle();
  const templateName = templateRow?.name || templateId;

  // ── 3b. Load configured volumes for this version (FPS-006; empty if none) ──
  const { data: volumeRows } = await supabase
    .from("doc_template_volumes")
    .select("volume_key, volume_name, block_keys, sort_order, description")
    .eq("template_version_id", templateVersion.id)
    .order("sort_order", { ascending: true });

  // ── 4. Build editable blocks from recipe (default content only) ──
  // Resolve known template variables from the provided metadata. Missing
  // variables are left visible (advisory) — never invented, never block export.
  const variableValues: TemplateVariableValues = {
    customer_name: source.customerName,
    prepared_for: source.customerName,
    reference_number: source.refNumber,
    quotation_number: source.refNumber,
    document_title: source.title,
    proposal_title: source.title,
    document_date: new Date().toLocaleDateString("en-GB"),
    prepared_by: "Hala Supply Chain Services",
  };

  const blocks: OutputBlock[] = [];
  for (const entry of recipe) {
    const def = blockMap.get(entry.block_key);
    if (!def) {
      warnings.push(`Block definition not found for key: ${entry.block_key}`);
      continue;
    }
    const rawHtml = entry.default_content_override || def.default_content || "";
    const html = resolveTemplateVariables(rawHtml, variableValues);
    blocks.push({
      id: `${entry.block_key}-${entry.order}`,
      block_key: entry.block_key,
      render_key: def.render_key,
      display_name: def.display_name,
      family: def.family,
      editor_mode: def.editor_mode,
      visible: true,
      order: entry.order,
      required: entry.required,
      content: {
        html,
        source_status: "default",
      },
      default_content: html,
      schema_config: def.schema_config || {},
      permissions: def.permissions || {},
      provenance: makeBlockProvenance("template", {
        origin_ref: {
          template_id: templateId,
          template_version_id: templateVersion.id,
          block_library_id: def.id,
        },
        source_mode: "standalone",
        source_kind: "template",
        creation_method: "template",
      }),
    });
  }

  return {
    blocks,
    tender_id: "",
    tender_title: source.title?.trim() || templateName,
    customer_name: source.customerName?.trim() || "",
    pack_type: (source.packType ?? "custom_pack") as PackType,
    template_id: templateId,
    template_name: templateName,
    source_hash: "",
    pricing_scenario_id: null,
    snapshot_at: new Date().toISOString(),
    source_data: {},
    warnings,
    // ── Snapshot Contract ──
    source_mode: "standalone",
    source_kind: "template",
    creation_method: "template",
    linked_entity_type: "custom_document",
    linked_entity_id: null,
    template_version_id: templateVersion.id,
    layout: (templateVersion.layout as Record<string, unknown>) ?? null,
    volumes: volumeRows ?? [],
  };
}
