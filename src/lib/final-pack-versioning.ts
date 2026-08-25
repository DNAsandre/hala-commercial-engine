import type { InstanceVersion } from "@/hooks/useInstanceVersions";
import type { OutputBlock } from "./final-pack-loader";
import type { SourceSnapshotPayload } from "@/hooks/useFinalPackInstance";

export interface VersionRestorePatch {
  blocks: OutputBlock[];
  source_snapshot: SourceSnapshotPayload;
  branding_profile_id: string | null;
  updated_at: string;
  last_edited_at: string;
}

/** Restore the complete versioned document state, not only its block array. */
export function buildVersionRestorePatch(
  version: InstanceVersion,
  updatedAt: string,
): VersionRestorePatch {
  const sourceSnapshot = version.source_snapshot as unknown as SourceSnapshotPayload;
  return {
    blocks: version.blocks,
    source_snapshot: sourceSnapshot,
    branding_profile_id: sourceSnapshot.branding_profile_id ?? null,
    updated_at: updatedAt,
    last_edited_at: updatedAt,
  };
}
