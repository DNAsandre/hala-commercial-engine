/**
 * useFinalPackInstance.ts
 * ──────────────────────
 * FPS-014 — Hook for creating, saving, loading, and auto-saving doc_instances
 * for Final Pack Studio.
 *
 * Source-truth safety:
 * - WRITES only to doc_instances (pack_type, source_snapshot, blocks, status)
 * - NEVER writes to commercial_tickets
 * - Uses upsert to prevent duplicate rows on rapid saves
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { BlockSnapshot, OutputBlock, PackType } from "@/lib/final-pack-loader";
import { CONNECTED_TICKET_DEFAULTS } from "@/lib/document-source";
import { DEFAULT_TEMPLATE_CLASS } from "@/lib/final-pack-snapshot-contract";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface FinalPackInstance {
  id: string;
  tender_id: string;
  pack_type: PackType;
  status: "draft" | "compiled" | "exported";
  blocks: OutputBlock[];
  source_snapshot: SourceSnapshotPayload;
  /** Stored in doc_instances.customer_name */
  customer_name: string;
  /** Computed title — not a DB column, derived from snapshot */
  display_title: string;
  /** Persisted branding profile id (FPS-002); null falls back to default */
  branding_profile_id: string | null;
  /** Governance class — advisory only (FPS-002) */
  template_class: string;
  created_at: string;
  updated_at: string;
}

export interface SourceSnapshotPayload {
  _hash: string;
  _original_blocks: OutputBlock[];
  snapshot_at: string;
  pricing_scenario_id: string | null;
  tender_title: string;
  customer_name: string;
  template_id: string;
  template_name: string;
  source_data: Record<string, unknown>;
  // ── Source-mode mirror (Option 1: real columns are source of truth;
  //    these are mirrored here for snapshot portability) ──
  source_mode?: string;
  source_kind?: string;
  creation_method?: string;
  linked_entity_type?: string;
  linked_entity_id?: string | null;
  template_version_id?: string | null;
  branding_profile_id?: string | null;
  template_class?: string;
  /** Frozen template layout config (FPS-004). */
  layout?: Record<string, unknown> | null;
  /** Frozen template volume config rows (FPS-006). */
  volumes?: unknown[];
}

export interface UseFinalPackInstanceReturn {
  /** Current instance (null if not loaded) */
  instance: FinalPackInstance | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** True when auto-save is pending */
  saving: boolean;
  /**
   * Create a new instance from a loader/adapter snapshot.
   * `linkedEntityId` is the connected source id (tender) or null for standalone.
   * Source-mode fields are read from the snapshot; when absent, connected
   * commercial-ticket defaults apply (preserves existing behavior).
   */
  createInstance: (
    linkedEntityId: string | null,
    snapshot: BlockSnapshot,
  ) => Promise<FinalPackInstance | null>;
  /** Load an existing instance by ID */
  loadInstance: (instanceId: string) => Promise<void>;
  /** Save current instance state */
  saveInstance: () => Promise<void>;
  /** Update blocks (triggers auto-save) */
  updateBlocks: (blocks: OutputBlock[]) => void;
  /** Update status */
  updateStatus: (status: FinalPackInstance["status"]) => void;
  /** Persist the selected branding profile id on the instance (FPS-002) */
  updateBranding: (brandingProfileId: string) => Promise<void>;
  /** List existing FPS instances for a tender (connected picker) */
  listInstances: (tenderId: string) => Promise<FinalPackInstance[]>;
  /** List all FPS instances (connected + standalone) for Resume Existing */
  listAllInstances: () => Promise<FinalPackInstance[]>;
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const AUTO_SAVE_DEBOUNCE_MS = 2000;

// ═══════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════

export function useFinalPackInstance(): UseFinalPackInstanceReturn {
  const [instance, setInstance] = useState<FinalPackInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instanceRef = useRef<FinalPackInstance | null>(null);

  // Keep ref in sync
  useEffect(() => {
    instanceRef.current = instance;
  }, [instance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // ── Create new instance ──────────────────────────────
  const createInstance = useCallback(
    async (
      linkedEntityId: string | null,
      snapshot: BlockSnapshot,
    ): Promise<FinalPackInstance | null> => {
      setLoading(true);
      setError(null);

      try {
        const displayTitle = snapshot.customer_name
          ? `${snapshot.customer_name} — ${snapshot.template_name}`
          : snapshot.template_name || snapshot.tender_title || "Untitled Document";

        // ── Resolve source-mode metadata (defaults preserve connected behavior) ──
        const sourceMode = snapshot.source_mode ?? CONNECTED_TICKET_DEFAULTS.source_mode;
        const sourceKind = snapshot.source_kind ?? CONNECTED_TICKET_DEFAULTS.source_kind;
        const creationMethod =
          snapshot.creation_method ?? CONNECTED_TICKET_DEFAULTS.creation_method;
        const linkedEntityType =
          snapshot.linked_entity_type ??
          (linkedEntityId ? CONNECTED_TICKET_DEFAULTS.linked_entity_type : "custom_document");
        const linkedId =
          snapshot.linked_entity_id !== undefined
            ? snapshot.linked_entity_id
            : linkedEntityId;
        // Preserve legacy behavior: connected snapshots have no template_version_id,
        // so fall back to template_id (as before). Standalone snapshots set it explicitly
        // (null for blank, real version id for template-based).
        const templateVersionId =
          snapshot.template_version_id !== undefined
            ? snapshot.template_version_id
            : snapshot.template_id;

        const templateClass = DEFAULT_TEMPLATE_CLASS;
        const nowIso = new Date().toISOString();

        const sourceSnapshot: SourceSnapshotPayload = {
          _hash: snapshot.source_hash,
          _original_blocks: snapshot.blocks,
          snapshot_at: snapshot.snapshot_at,
          pricing_scenario_id: snapshot.pricing_scenario_id,
          tender_title: snapshot.tender_title,
          customer_name: snapshot.customer_name,
          template_id: snapshot.template_id,
          template_name: snapshot.template_name,
          source_data: snapshot.source_data,
          // Mirror source-mode values for snapshot portability
          source_mode: sourceMode,
          source_kind: sourceKind,
          creation_method: creationMethod,
          linked_entity_type: linkedEntityType,
          linked_entity_id: linkedId,
          template_version_id: templateVersionId,
          branding_profile_id: null,
          template_class: templateClass,
          layout: snapshot.layout ?? null,
          volumes: snapshot.volumes ?? [],
        };

        // doc_instances.id is text PK with no default — must generate explicitly
        const instanceId = crypto.randomUUID();

        const row = {
          id: instanceId,
          doc_type: "final_pack",
          template_version_id: templateVersionId,
          status: "draft" as const,
          linked_entity_type: linkedEntityType,
          linked_entity_id: linkedId,
          customer_name: snapshot.customer_name,
          pack_type: snapshot.pack_type,
          source_mode: sourceMode,
          source_kind: sourceKind,
          creation_method: creationMethod,
          branding_profile_id: null,
          template_class: templateClass,
          last_edited_at: nowIso,
          // Set updated_at explicitly so the DB value matches the local instance
          // (we don't select-after-insert). FPS-007 optimistic concurrency keys
          // off updated_at, so DB and client must agree on the first save.
          updated_at: nowIso,
          source_snapshot: sourceSnapshot,
          blocks: snapshot.blocks,
          created_by: "User",
        };

        // Insert WITHOUT select-after-insert. The select round-trip can stall
        // on read-back RLS; we already hold the id and timestamps locally, so
        // there is nothing to fetch back. A hard timeout guarantees the UI can
        // never hang (no-prison doctrine).
        const insertPromise = supabase.from("doc_instances").insert(row);
        const timeout = new Promise<{ error: { message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ error: { message: "Insert timed out — please retry." } }),
            20000,
          ),
        );
        const { error: insertErr } = (await Promise.race([insertPromise, timeout])) as {
          error: { message: string } | null;
        };

        if (insertErr) {
          console.error("[FPS] createInstance insert failed:", insertErr.message);
          setError(`Failed to create instance: ${insertErr.message}`);
          return null;
        }

        const newInstance: FinalPackInstance = {
          id: instanceId,
          tender_id: linkedId ?? "",
          pack_type: snapshot.pack_type,
          status: "draft",
          blocks: snapshot.blocks,
          source_snapshot: sourceSnapshot,
          display_title: displayTitle,
          customer_name: snapshot.customer_name,
          branding_profile_id: null,
          template_class: templateClass,
          created_at: nowIso,
          updated_at: nowIso,
        };

        setInstance(newInstance);
        return newInstance;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── Load existing instance ───────────────────────────
  const loadInstance = useCallback(async (instanceId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: loadErr } = await supabase
        .from("doc_instances")
        .select("*")
        .eq("id", instanceId)
        .maybeSingle();

      if (loadErr) {
        setError(`Failed to load instance: ${loadErr.message}`);
        return;
      }
      if (!data) {
        setError(`Instance ${instanceId} not found`);
        return;
      }

      const ss = data.source_snapshot || {};
      const loaded: FinalPackInstance = {
        id: data.id,
        tender_id: data.linked_entity_id || "",
        pack_type: data.pack_type || "combined_proposal",
        status: data.status || "draft",
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
        source_snapshot: ss as SourceSnapshotPayload,
        display_title: `${data.customer_name || ""} — ${ss.template_name || data.doc_type || ""}`,
        customer_name: data.customer_name || "",
        branding_profile_id: data.branding_profile_id ?? ss.branding_profile_id ?? null,
        template_class: data.template_class ?? ss.template_class ?? "customer_facing",
        created_at: data.created_at || "",
        updated_at: data.updated_at || "",
      };

      setInstance(loaded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Save instance (update by ID) ──────────────────────
  // Only updates columns that exist in doc_instances schema:
  // blocks, status, source_snapshot, customer_name, updated_at
  const saveInstance = useCallback(async () => {
    const current = instanceRef.current;
    if (!current) return;

    setSaving(true);
    try {
      const { error: saveErr } = await supabase
        .from("doc_instances")
        .update({
          blocks: current.blocks,
          status: current.status,
          source_snapshot: current.source_snapshot,
          customer_name: current.customer_name,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

      if (saveErr) {
        console.error("[FPS] Save failed:", saveErr.message);
      }
    } catch (err) {
      console.error("[FPS] Save error:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Debounced auto-save trigger ──────────────────────
  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveInstance();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [saveInstance]);

  // ── Update blocks (triggers auto-save) ───────────────
  const updateBlocks = useCallback(
    (blocks: OutputBlock[]) => {
      setInstance((prev) => {
        if (!prev) return prev;
        return { ...prev, blocks };
      });
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  // ── Update status ────────────────────────────────────
  const updateStatus = useCallback(
    (status: FinalPackInstance["status"]) => {
      setInstance((prev) => {
        if (!prev) return prev;
        return { ...prev, status };
      });
      scheduleAutoSave();
    },
    [scheduleAutoSave],
  );

  // ── Persist selected branding profile (FPS-002) ──
  // branding_profile_id is the real column (source of truth); also mirrored
  // into source_snapshot for portability. Branding never gates export.
  const updateBranding = useCallback(
    async (brandingProfileId: string) => {
      const current = instanceRef.current;
      if (!current) return;

      const nextSnapshot: SourceSnapshotPayload = {
        ...current.source_snapshot,
        branding_profile_id: brandingProfileId,
      };

      setInstance((prev) =>
        prev
          ? { ...prev, branding_profile_id: brandingProfileId, source_snapshot: nextSnapshot }
          : prev,
      );

      const { error: brandErr } = await supabase
        .from("doc_instances")
        .update({
          branding_profile_id: brandingProfileId,
          source_snapshot: nextSnapshot,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

      if (brandErr) {
        console.error("[FPS] Failed to persist branding:", brandErr.message);
      }
    },
    [],
  );

  // ── List FPS instances for a tender ──────────────────
  // Discriminator: pack_type IS NOT NULL (FPS sets pack_type, DocumentComposer does not)
  const listInstances = useCallback(
    async (tenderId: string): Promise<FinalPackInstance[]> => {
      const { data, error: listErr } = await supabase
        .from("doc_instances")
        .select("*")
        .eq("linked_entity_type", "tender")
        .eq("linked_entity_id", tenderId)
        .not("pack_type", "is", null)
        .order("updated_at", { ascending: false });

      if (listErr || !data) return [];

      return data.map(mapRowToInstance);
    },
    [],
  );

  // ── List ALL FPS instances (connected + standalone) for Resume Existing ──
  // Discriminator: doc_type = 'final_pack' (set by createInstance for both modes).
  const listAllInstances = useCallback(
    async (): Promise<FinalPackInstance[]> => {
      const { data, error: listErr } = await supabase
        .from("doc_instances")
        .select("*")
        .eq("doc_type", "final_pack")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (listErr || !data) return [];
      return data.map(mapRowToInstance);
    },
    [],
  );

  return {
    instance,
    loading,
    error,
    saving,
    createInstance,
    loadInstance,
    saveInstance,
    updateBlocks,
    updateStatus,
    updateBranding,
    listInstances,
    listAllInstances,
  };
}

// ═══════════════════════════════════════════════════════════
// Row → FinalPackInstance mapper (shared by list helpers)
// ═══════════════════════════════════════════════════════════

function mapRowToInstance(row: any): FinalPackInstance {
  const ss = row.source_snapshot || {};
  return {
    id: row.id,
    tender_id: row.linked_entity_id || "",
    pack_type: row.pack_type || "combined_proposal",
    status: row.status || "draft",
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    source_snapshot: ss as SourceSnapshotPayload,
    display_title: `${row.customer_name || ""} — ${ss.template_name || row.doc_type || ""}`,
    customer_name: row.customer_name || "",
    branding_profile_id: row.branding_profile_id ?? ss.branding_profile_id ?? null,
    template_class: row.template_class ?? ss.template_class ?? "customer_facing",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}
