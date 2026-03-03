/**
 * useResolveDocInstance — Async Supabase-backed resolveOrCreate
 * Wave 1 persistence hardening: replaces synchronous in-memory resolveOrCreateDocInstance
 *
 * This function searches Supabase for an existing doc instance matching the
 * linked entity, then falls back to customer+doc_type. If none found, it creates
 * a new instance with the default published template and syncs to Supabase.
 */
import { supabase } from "@/lib/supabase";
import {
  type DocType, type LinkedEntityType,
  getPublishedTemplates, getPublishedTemplateVersion,
  getBlockByKey,
} from "@/lib/document-composer";
import {
  syncDocInstanceCreate, syncDocInstanceVersionCreate,
} from "@/lib/supabase-sync";
import { getCurrentUser } from "@/lib/auth-state";

export interface ResolveDocInstanceParams {
  doc_type: DocType;
  linked_entity_type: LinkedEntityType;
  linked_entity_id: string;
  customer_id: string;
  customer_name: string;
  workspace_id?: string;
  workspace_name?: string;
}

export interface ResolvedDocInstance {
  id: string;
  doc_type: string;
  status: string;
  customer_id: string;
  customer_name: string;
  workspace_id: string | null;
}

/**
 * Async version of resolveOrCreateDocInstance.
 * 1. Searches Supabase by (doc_type, linked_entity_type, linked_entity_id)
 * 2. Falls back to (doc_type, customer_id)
 * 3. If not found, creates a new instance + version in Supabase
 */
export async function resolveOrCreateDocInstanceAsync(
  params: ResolveDocInstanceParams
): Promise<ResolvedDocInstance> {
  // 1. Search by linked entity
  const { data: byLinked } = await supabase
    .from("doc_instances")
    .select("id, doc_type, status, customer_id, customer_name, workspace_id")
    .eq("doc_type", params.doc_type)
    .eq("linked_entity_type", params.linked_entity_type)
    .eq("linked_entity_id", params.linked_entity_id)
    .maybeSingle();

  if (byLinked) return byLinked as ResolvedDocInstance;

  // 2. Fallback: search by workspace + customer + doc_type
  if (params.workspace_id) {
    const { data: byWorkspace } = await supabase
      .from("doc_instances")
      .select("id, doc_type, status, customer_id, customer_name, workspace_id")
      .eq("doc_type", params.doc_type)
      .eq("workspace_id", params.workspace_id)
      .eq("customer_id", params.customer_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byWorkspace) return byWorkspace as ResolvedDocInstance;
  }

  // 3. Create new instance
  const publishedTemplates = getPublishedTemplates().filter(t => t.doc_type === params.doc_type);
  const template = publishedTemplates[0];
  if (!template) {
    throw new Error(`No published template found for doc type: ${params.doc_type}`);
  }
  const templateVersion = getPublishedTemplateVersion(template);
  if (!templateVersion) {
    throw new Error(`No published version found for template: ${template.name}`);
  }

  // Build blocks from template recipe
  const blocks = templateVersion.recipe.map(r => {
    const blockDef = getBlockByKey(r.block_key);
    return {
      block_key: r.block_key,
      order: r.order,
      content: r.default_content_override || blockDef?.default_content || "",
      is_locked: false,
      is_ai_generated: false,
      config: { ...r.config_override },
    };
  });

  const now = new Date().toISOString();
  const instanceId = `di-auto-${crypto.randomUUID()}`;
  const versionId = `div-auto-${crypto.randomUUID()}`;
  const user = getCurrentUser();
  const createdBy = user?.name || "System";

  // Sync instance to Supabase
  await syncDocInstanceCreate({
    id: instanceId,
    doc_type: params.doc_type,
    template_version_id: templateVersion.id,
    status: "draft",
    linked_entity_type: params.linked_entity_type,
    linked_entity_id: params.linked_entity_id,
    customer_id: params.customer_id,
    customer_name: params.customer_name,
    workspace_id: params.workspace_id || null,
    workspace_name: params.workspace_name || null,
    current_version_id: versionId,
    title: `${params.customer_name} — ${params.doc_type}`,
    branding_profile_id: "bp-001",
    is_compiled: false,
    created_by: createdBy,
  });

  // Sync version to Supabase (syncDocInstanceVersionCreate handles JSON.stringify internally)
  await syncDocInstanceVersionCreate({
    id: versionId,
    doc_instance_id: instanceId,
    version_number: 1,
    blocks: blocks,
    bindings: { pricing_snapshot_id: null, scope_snapshot_id: null, ecr_score_id: null, sla_snapshot_id: null },
    created_by: createdBy,
  });

  return {
    id: instanceId,
    doc_type: params.doc_type,
    status: "draft",
    customer_id: params.customer_id,
    customer_name: params.customer_name,
    workspace_id: params.workspace_id || null,
  };
}
