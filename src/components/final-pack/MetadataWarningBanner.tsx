/**
 * MetadataWarningBanner.tsx
 * ─────────────────────────
 * FPS-002-11 — Advisory-only metadata notes.
 *
 * Surfaces traceability gaps (missing branding, legacy template version,
 * unknown block origins, legacy source snapshot) as gentle, ignorable notes.
 *
 * CRITICAL (no-prison doctrine):
 * - These are advisory ONLY. They never disable editing, preview, or export.
 * - No "must resolve", no "cannot proceed", no modal, no coupling to export.
 * - Uses neutral/info tone, not red error language.
 */

import { useState, useMemo } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import type { FinalPackInstance } from "@/hooks/useFinalPackInstance";
import { normalizeInstanceMetadata } from "@/lib/normalize-final-pack-snapshot";

interface MetadataWarningBannerProps {
  instance: FinalPackInstance;
}

export default function MetadataWarningBanner({ instance }: MetadataWarningBannerProps) {
  const [collapsed, setCollapsed] = useState(true);

  const notes = useMemo(() => {
    const meta = normalizeInstanceMetadata({
      source_mode: instance.source_snapshot?.source_mode,
      source_kind: instance.source_snapshot?.source_kind,
      creation_method: instance.source_snapshot?.creation_method,
      linked_entity_type: instance.source_snapshot?.linked_entity_type,
      linked_entity_id: instance.source_snapshot?.linked_entity_id,
      template_version_id: instance.source_snapshot?.template_version_id,
      branding_profile_id: instance.branding_profile_id,
      template_class: instance.template_class,
      blocks: instance.blocks,
      source_snapshot: instance.source_snapshot,
    });

    const out: string[] = [];

    if (!meta.branding_profile_id) {
      out.push("Branding not set yet — a default profile will be used until you choose one.");
    }
    if (meta.template_version_legacy && meta.source_mode !== "standalone") {
      out.push("Template version for this document is legacy/unknown (traceability only).");
    }
    if (meta.provenance_summary.unknown > 0) {
      const n = meta.provenance_summary.unknown;
      out.push(`${n} ${n === 1 ? "block has" : "blocks have"} unknown origin (legacy) — for traceability only.`);
    }
    if (meta.source_mode_legacy) {
      out.push("This document predates source-mode tracking; treated as connected.");
    }

    return out;
  }, [instance]);

  if (notes.length === 0) return null;

  return (
    <div className="fps-warning-banner">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-xs font-medium text-foreground">
            {notes.length} traceability {notes.length === 1 ? "note" : "notes"}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-1">
          {notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
