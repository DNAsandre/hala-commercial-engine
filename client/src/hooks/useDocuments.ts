/**
 * useDocuments — Supabase-backed document hooks
 * Wave 1 persistence hardening: replaces in-memory docInstances reads.
 *
 * Tables: doc_instances, doc_instance_versions, compiled_documents, vault_assets
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { DocType, DocInstanceStatus } from "@/lib/document-composer";
import { handleSupabaseError } from "@/lib/supabase-error";

// ============================================================
// DB ROW TYPES (match Supabase table schemas)
// ============================================================
export interface DbDocInstance {
  id: string;
  doc_type: string;
  template_version_id: string | null;
  status: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  current_version_id: string | null;
  title: string | null;
  branding_profile_id: string | null;
  is_compiled: boolean;
  compiled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbDocInstanceVersion {
  id: string;
  doc_instance_id: string;
  version_number: number;
  blocks: string; // JSON string
  bindings: string; // JSON string
  created_by: string;
  created_at: string;
}

export interface DbCompiledDocument {
  id: string;
  doc_instance_id: string | null;
  doc_instance_version_id: string | null;
  title: string;
  doc_type: string;
  customer_id: string | null;
  customer_name: string | null;
  workspace_id: string | null;
  compiled_html: string;
  compiled_by: string;
  compiled_at: string;
  status: string;
}

export interface DbVaultAsset {
  id: string;
  doc_instance_id: string | null;
  doc_instance_version_id: string | null;
  compiled_document_id: string | null;
  title: string;
  doc_type: string;
  customer_id: string | null;
  customer_name: string | null;
  workspace_id: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

// ============================================================
// HYDRATED TYPES (in-memory shape with parsed JSON)
// ============================================================
export interface HydratedDocInstance {
  id: string;
  doc_type: DocType;
  template_version_id: string | null;
  status: DocInstanceStatus;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  customer_id: string;
  customer_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  current_version_id: string | null;
  title: string;
  branding_profile_id: string | null;
  is_compiled: boolean;
  compiled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Hydrated from doc_instance_versions
  versions: HydratedDocVersion[];
}

export interface HydratedDocVersion {
  id: string;
  doc_instance_id: string;
  version_number: number;
  blocks: any[];
  bindings: any;
  created_by: string;
  created_at: string;
}

// ============================================================
// GENERIC QUERY HOOK
// ============================================================
interface UseQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useDocQuery<T>(
  fetcher: () => Promise<T>,
  defaultValue: T,
  deps: any[] = []
): UseQueryResult<T> {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || "Failed to fetch");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, refetch: load };
}

// ============================================================
// FETCH FUNCTIONS
// ============================================================

/** Fetch all doc instances with their versions hydrated */
async function fetchDocInstances(filters?: { doc_type?: string; customer_id?: string; workspace_id?: string }): Promise<HydratedDocInstance[]> {
  let query = supabase.from("doc_instances").select("*").order("updated_at", { ascending: false });
  if (filters?.doc_type) query = query.eq("doc_type", filters.doc_type);
  if (filters?.customer_id) query = query.eq("customer_id", filters.customer_id);
  if (filters?.workspace_id) query = query.eq("workspace_id", filters.workspace_id);

  const { data: instances, error } = await query;
  if (error) { handleSupabaseError('fetchDocInstances', error, { silent: true }); return []; }
  if (!instances || instances.length === 0) return [];

  // Fetch all versions for these instances in one query
  const instanceIds = instances.map((i: any) => i.id);
  const { data: versions, error: vErr } = await supabase
    .from("doc_instance_versions")
    .select("*")
    .in("doc_instance_id", instanceIds)
    .order("version_number", { ascending: true });
  if (vErr) console.error("fetchDocInstanceVersions error:", vErr);

  const versionMap = new Map<string, HydratedDocVersion[]>();
  for (const v of (versions || [])) {
    const parsed: HydratedDocVersion = {
      id: v.id,
      doc_instance_id: v.doc_instance_id,
      version_number: v.version_number,
      blocks: typeof v.blocks === "string" ? JSON.parse(v.blocks) : (v.blocks || []),
      bindings: typeof v.bindings === "string" ? JSON.parse(v.bindings) : (v.bindings || {}),
      created_by: v.created_by,
      created_at: v.created_at,
    };
    if (!versionMap.has(v.doc_instance_id)) versionMap.set(v.doc_instance_id, []);
    versionMap.get(v.doc_instance_id)!.push(parsed);
  }

  return instances.map((i: any) => ({
    id: i.id,
    doc_type: i.doc_type as DocType,
    template_version_id: i.template_version_id,
    status: i.status as DocInstanceStatus,
    linked_entity_type: i.linked_entity_type,
    linked_entity_id: i.linked_entity_id,
    customer_id: i.customer_id || "",
    customer_name: i.customer_name || "",
    workspace_id: i.workspace_id,
    workspace_name: i.workspace_name,
    current_version_id: i.current_version_id,
    title: i.title || i.doc_type,
    branding_profile_id: i.branding_profile_id,
    is_compiled: i.is_compiled || false,
    compiled_at: i.compiled_at,
    created_by: i.created_by,
    created_at: i.created_at,
    updated_at: i.updated_at,
    versions: versionMap.get(i.id) || [],
  }));
}

/** Fetch a single doc instance by ID with versions */
async function fetchDocInstanceById(id: string): Promise<HydratedDocInstance | null> {
  const { data: instance, error } = await supabase
    .from("doc_instances")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !instance) { handleSupabaseError('fetchDocInstanceById_error:', { message: String(error) }); return null; }

  const { data: versions, error: vErr } = await supabase
    .from("doc_instance_versions")
    .select("*")
    .eq("doc_instance_id", id)
    .order("version_number", { ascending: true });
  if (vErr) console.error("fetchDocInstanceVersions error:", vErr);

  const parsedVersions: HydratedDocVersion[] = (versions || []).map((v: any) => ({
    id: v.id,
    doc_instance_id: v.doc_instance_id,
    version_number: v.version_number,
    blocks: typeof v.blocks === "string" ? JSON.parse(v.blocks) : (v.blocks || []),
    bindings: typeof v.bindings === "string" ? JSON.parse(v.bindings) : (v.bindings || {}),
    created_by: v.created_by,
    created_at: v.created_at,
  }));

  return {
    id: instance.id,
    doc_type: instance.doc_type as DocType,
    template_version_id: instance.template_version_id,
    status: instance.status as DocInstanceStatus,
    linked_entity_type: instance.linked_entity_type,
    linked_entity_id: instance.linked_entity_id,
    customer_id: instance.customer_id || "",
    customer_name: instance.customer_name || "",
    workspace_id: instance.workspace_id,
    workspace_name: instance.workspace_name,
    current_version_id: instance.current_version_id,
    title: instance.title || instance.doc_type,
    branding_profile_id: instance.branding_profile_id,
    is_compiled: instance.is_compiled || false,
    compiled_at: instance.compiled_at,
    created_by: instance.created_by,
    created_at: instance.created_at,
    updated_at: instance.updated_at,
    versions: parsedVersions,
  };
}

/** Fetch compiled documents, optionally filtered */
async function fetchCompiledDocuments(docInstanceId?: string): Promise<DbCompiledDocument[]> {
  let query = supabase.from("compiled_documents").select("*").order("compiled_at", { ascending: false });
  if (docInstanceId) query = query.eq("doc_instance_id", docInstanceId);
  const { data, error } = await query;
  if (error) { handleSupabaseError('fetchCompiledDocuments', error, { silent: true }); return []; }
  return (data || []) as DbCompiledDocument[];
}

/** Fetch vault assets, optionally filtered */
async function fetchVaultAssets(docInstanceId?: string): Promise<DbVaultAsset[]> {
  let query = supabase.from("vault_assets").select("*").order("created_at", { ascending: false });
  if (docInstanceId) query = query.eq("doc_instance_id", docInstanceId);
  const { data, error } = await query;
  if (error) { handleSupabaseError('fetchVaultAssets', error, { silent: true }); return []; }
  return (data || []) as DbVaultAsset[];
}

/** Check if a doc instance exists by linked entity */
async function findDocInstanceByLinkedEntity(
  docType: string,
  linkedEntityType: string,
  linkedEntityId: string
): Promise<HydratedDocInstance | null> {
  const { data, error } = await supabase
    .from("doc_instances")
    .select("*")
    .eq("doc_type", docType)
    .eq("linked_entity_type", linkedEntityType)
    .eq("linked_entity_id", linkedEntityId)
    .maybeSingle();
  if (error || !data) return null;

  // Fetch versions
  const { data: versions } = await supabase
    .from("doc_instance_versions")
    .select("*")
    .eq("doc_instance_id", data.id)
    .order("version_number", { ascending: true });

  const parsedVersions: HydratedDocVersion[] = (versions || []).map((v: any) => ({
    id: v.id,
    doc_instance_id: v.doc_instance_id,
    version_number: v.version_number,
    blocks: typeof v.blocks === "string" ? JSON.parse(v.blocks) : (v.blocks || []),
    bindings: typeof v.bindings === "string" ? JSON.parse(v.bindings) : (v.bindings || {}),
    created_by: v.created_by,
    created_at: v.created_at,
  }));

  return {
    id: data.id,
    doc_type: data.doc_type as DocType,
    template_version_id: data.template_version_id,
    status: data.status as DocInstanceStatus,
    linked_entity_type: data.linked_entity_type,
    linked_entity_id: data.linked_entity_id,
    customer_id: data.customer_id || "",
    customer_name: data.customer_name || "",
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name,
    current_version_id: data.current_version_id,
    title: data.title || data.doc_type,
    branding_profile_id: data.branding_profile_id,
    is_compiled: data.is_compiled || false,
    compiled_at: data.compiled_at,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    versions: parsedVersions,
  };
}

/** Find doc instance by customer + doc_type (fallback) */
async function findDocInstanceByCustomer(
  docType: string,
  customerId: string
): Promise<HydratedDocInstance | null> {
  const { data, error } = await supabase
    .from("doc_instances")
    .select("*")
    .eq("doc_type", docType)
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const { data: versions } = await supabase
    .from("doc_instance_versions")
    .select("*")
    .eq("doc_instance_id", data.id)
    .order("version_number", { ascending: true });

  const parsedVersions: HydratedDocVersion[] = (versions || []).map((v: any) => ({
    id: v.id,
    doc_instance_id: v.doc_instance_id,
    version_number: v.version_number,
    blocks: typeof v.blocks === "string" ? JSON.parse(v.blocks) : (v.blocks || []),
    bindings: typeof v.bindings === "string" ? JSON.parse(v.bindings) : (v.bindings || {}),
    created_by: v.created_by,
    created_at: v.created_at,
  }));

  return {
    id: data.id,
    doc_type: data.doc_type as DocType,
    template_version_id: data.template_version_id,
    status: data.status as DocInstanceStatus,
    linked_entity_type: data.linked_entity_type,
    linked_entity_id: data.linked_entity_id,
    customer_id: data.customer_id || "",
    customer_name: data.customer_name || "",
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name,
    current_version_id: data.current_version_id,
    title: data.title || data.doc_type,
    branding_profile_id: data.branding_profile_id,
    is_compiled: data.is_compiled || false,
    compiled_at: data.compiled_at,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    versions: parsedVersions,
  };
}

// ============================================================
// REACT HOOKS
// ============================================================

/** All doc instances (optionally filtered) */
export function useDocInstances(filters?: { doc_type?: string; customer_id?: string; workspace_id?: string }): UseQueryResult<HydratedDocInstance[]> {
  const filterKey = JSON.stringify(filters || {});
  return useDocQuery(
    () => fetchDocInstances(filters),
    [],
    [filterKey]
  );
}

/** Single doc instance by ID */
export function useDocInstance(id: string | undefined | null): UseQueryResult<HydratedDocInstance | null> {
  return useDocQuery(
    () => id ? fetchDocInstanceById(id) : Promise.resolve(null),
    null,
    [id || ""]
  );
}

/** Compiled documents for a doc instance */
export function useCompiledDocuments(docInstanceId?: string): UseQueryResult<DbCompiledDocument[]> {
  return useDocQuery(
    () => fetchCompiledDocuments(docInstanceId),
    [],
    [docInstanceId || ""]
  );
}

/** Vault assets for a doc instance */
export function useVaultAssets(docInstanceId?: string): UseQueryResult<DbVaultAsset[]> {
  return useDocQuery(
    () => fetchVaultAssets(docInstanceId),
    [],
    [docInstanceId || ""]
  );
}

// ============================================================
// IMPERATIVE FUNCTIONS (for resolveOrCreate pattern)
// ============================================================

export { fetchDocInstances, fetchDocInstanceById, fetchCompiledDocuments, fetchVaultAssets, findDocInstanceByLinkedEntity, findDocInstanceByCustomer };
