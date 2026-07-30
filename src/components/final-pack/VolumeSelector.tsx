/**
 * VolumeSelector.tsx
 * ──────────────────
 * FPS-006-05 — Choose "All" (full document) or a single volume to preview/export.
 *
 * Renders nothing when there are no configured volumes (feature stays invisible
 * and the normal full-document flow is unchanged). Selecting a volume never
 * mutates the document — it only drives the render/export filter.
 */

import { Layers } from "lucide-react";
import type { FinalPackVolume } from "@/lib/final-pack-volumes";
import type { OutputBlock } from "@/lib/final-pack-loader";

interface VolumeSelectorProps {
  volumes: FinalPackVolume[];
  selectedKey: string | null; // null = All
  onSelect: (key: string | null) => void;
  blocks: OutputBlock[];
}

export default function VolumeSelector({ volumes, selectedKey, onSelect, blocks }: VolumeSelectorProps) {
  if (!volumes || volumes.length === 0) return null;

  const countFor = (v: FinalPackVolume) => {
    const allowed = new Set(v.block_keys);
    return blocks.filter((b) => b.visible && allowed.has(b.block_key)).length;
  };

  return (
    <div className="flex items-center gap-1.5">
      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={selectedKey ?? "__all__"}
        onChange={(e) => onSelect(e.target.value === "__all__" ? null : e.target.value)}
        className="text-xs bg-transparent border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        title="Preview / export the full document or a single volume"
      >
        <option value="__all__">All ({blocks.filter((b) => b.visible).length})</option>
        {volumes.map((v) => (
          <option key={v.volume_key} value={v.volume_key}>
            {v.volume_title} ({countFor(v)})
          </option>
        ))}
      </select>
    </div>
  );
}
