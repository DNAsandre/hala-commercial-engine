import { describe, expect, it } from "vitest";
import { buildVersionRestorePatch } from "./final-pack-versioning";
import type { InstanceVersion } from "@/hooks/useInstanceVersions";

describe("Final Pack complete version restore", () => {
  it("restores blocks, source, layout, volumes, and branding as one payload", () => {
    const version = {
      id: "v-4",
      doc_instance_id: "doc-1",
      version_number: 4,
      blocks: [{ id: "b-1", block_key: "intro", render_key: "narrative" }],
      source_snapshot: {
        _hash: "hash-4",
        _original_blocks: [],
        snapshot_at: "2026-08-24T10:00:00.000Z",
        pricing_scenario_id: null,
        tender_title: "Tender",
        customer_name: "Customer",
        template_id: "tpl-1",
        template_name: "Proposal",
        source_data: {},
        branding_profile_id: "brand-4",
        layout: { page_size: "A4", section_spacing: "compact" },
        volumes: [{ volume_key: "technical", block_keys: ["intro"] }],
      },
      created_by: "Amin",
      created_at: "2026-08-24T10:00:00.000Z",
      change_reason: null,
    } as unknown as InstanceVersion;

    const patch = buildVersionRestorePatch(version, "2026-08-25T08:00:00.000Z");
    expect(patch.blocks).toEqual(version.blocks);
    expect(patch.source_snapshot).toEqual(version.source_snapshot);
    expect(patch.source_snapshot.layout).toEqual({ page_size: "A4", section_spacing: "compact" });
    expect(patch.source_snapshot.volumes).toEqual([{ volume_key: "technical", block_keys: ["intro"] }]);
    expect(patch.branding_profile_id).toBe("brand-4");
    expect(patch.updated_at).toBe(patch.last_edited_at);
  });
});
