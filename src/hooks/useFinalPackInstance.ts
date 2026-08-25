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

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-state";
import type { BlockSnapshot, OutputBlock, PackType } from "@/lib/final-pack-loader";
import {
  CONNECTED_TICKET_DEFAULTS,
  connectedSourceIdentity,
  type ConnectedRecordKind,
} from "@/lib/document-source";
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
  /** List existing FPS instances for one connected Tender or Proposal source. */
  listInstances: (
    linkedEntityId: string,
    sourceKind?: ConnectedRecordKind,
  ) => Promise<InstanceListResult>;
  /** List all FPS instances (connected + standalone) for Resume Existing */
  listAllInstances: () => Promise<InstanceListResult>;
}

/**
 * Result of a list read. `error` is non-null ONLY when the read failed —
 * an empty `instances` array with `error: null` means "really none".
 * W04-T09: these two states used to be indistinguishable ([] was returned for
 * both), so a failed read rendered as "No documents yet".
 */
export interface InstanceListResult {
  instances: FinalPackInstance[];
  error: string | null;
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════

export function useFinalPackInstance(): UseFinalPackInstanceReturn {
  const [instance, setInstance] = useState<FinalPackInstance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          // TCW integration (P4): the real session actor, never a fabricated
          // literal. Signed-out fallback is auth-state's own honest value.
          created_by: getCurrentUser().name || "Unauthenticated",
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
        let { error: insertErr } = (await Promise.race([insertPromise, timeout])) as {
          error: { message: string } | null;
        };

        // A timed-out request may still have landed. The id was minted before
        // the insert, so read that exact row before inviting a retry that would
        // create a second document.
        if (insertErr?.message.startsWith("Insert timed out")) {
          const { data: landed } = await supabase
            .from("doc_instances")
            .select("id")
            .eq("id", instanceId)
            .maybeSingle();
          if (landed?.id === instanceId) insertErr = null;
        }

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
        display_title: formatInstanceDisplayTitle(data.customer_name, ss, data.doc_type),
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

  // ── List FPS instances for one connected source ──────
  const listInstances = useCallback(
    (
      linkedEntityId: string,
      sourceKind: ConnectedRecordKind = "tender",
    ): Promise<InstanceListResult> => fetchLinkedInstances(linkedEntityId, sourceKind),
    [],
  );

  // ── List ALL FPS instances (connected + standalone) for Resume Existing ──
  const listAllInstances = useCallback(
    (): Promise<InstanceListResult> => fetchAllFinalPackInstances(),
    [],
  );

  return {
    instance,
    loading,
    error,
    createInstance,
    loadInstance,
    listInstances,
    listAllInstances,
  };
}

// ═══════════════════════════════════════════════════════════
// List reads (exported so the query itself is directly testable)
// ═══════════════════════════════════════════════════════════

/**
 * FPS instances for one tender.
 * Discriminator: pack_type IS NOT NULL (FPS sets pack_type; the legacy
 * composer did not). Ordered newest-edited first by an explicit ORDER BY.
 */
export async function fetchTenderInstances(tenderId: string): Promise<InstanceListResult> {
  return fetchLinkedInstances(tenderId, "tender");
}

/**
 * PDS-18: route-specific instance listing uses the same persisted identity as
 * creation. Proposal rows therefore no longer live in or query the tender
 * namespace.
 */
export async function fetchLinkedInstances(
  linkedEntityId: string,
  sourceKind: ConnectedRecordKind,
): Promise<InstanceListResult> {
  const identity = connectedSourceIdentity(sourceKind);
  const canonical = await queryLinkedInstances(linkedEntityId, identity.linked_entity_type);
  if (sourceKind !== "proposal") return canonical;

  // Proposal packs created before PDS-18 were stored under the tender label.
  // Keep those exact-id rows discoverable without rewriting history; all new
  // rows use the canonical proposal label above.
  const legacy = await queryLinkedInstances(linkedEntityId, "tender");
  const merged = new Map<string, FinalPackInstance>();
  [...canonical.instances, ...legacy.instances].forEach((instance) => merged.set(instance.id, instance));
  const errors = [canonical.error, legacy.error].filter(Boolean);
  return {
    instances: Array.from(merged.values()).sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

async function queryLinkedInstances(
  linkedEntityId: string,
  linkedEntityType: "tender" | "proposal",
): Promise<InstanceListResult> {
  const { data, error } = await supabase
    .from("doc_instances")
    .select("*")
    .eq("linked_entity_type", linkedEntityType)
    .eq("linked_entity_id", linkedEntityId)
    .not("pack_type", "is", null)
    .order("updated_at", { ascending: false });

  if (error) return { instances: [], error: error.message };
  return { instances: (data ?? []).map(mapRowToInstance), error: null };
}

/**
 * All FPS instances (connected + standalone) for "Resume Existing".
 * Discriminator: doc_type = 'final_pack' (set by createInstance in both modes).
 */
export async function fetchAllFinalPackInstances(): Promise<InstanceListResult> {
  const { data, error } = await supabase
    .from("doc_instances")
    .select("*")
    .eq("doc_type", "final_pack")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return { instances: [], error: error.message };
  return { instances: (data ?? []).map(mapRowToInstance), error: null };
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
    display_title: formatInstanceDisplayTitle(row.customer_name, ss, row.doc_type),
    customer_name: row.customer_name || "",
    branding_profile_id: row.branding_profile_id ?? ss.branding_profile_id ?? null,
    template_class: row.template_class ?? ss.template_class ?? "customer_facing",
    created_at: row.created_at || "",
    updated_at: row.updated_at || "",
  };
}

export function formatInstanceDisplayTitle(
  customerName: unknown,
  sourceSnapshot: Record<string, unknown>,
  docType: unknown,
): string {
  const subject = typeof customerName === "string" && customerName.trim()
    ? customerName.trim()
    : typeof sourceSnapshot.tender_title === "string" && sourceSnapshot.tender_title.trim()
      ? sourceSnapshot.tender_title.trim()
      : "Untitled document";
  const template = typeof sourceSnapshot.template_name === "string" && sourceSnapshot.template_name.trim()
    ? sourceSnapshot.template_name.trim()
    : typeof docType === "string" && docType.trim()
      ? docType.trim()
      : "Document";
  return `${subject} — ${template}`;
}
