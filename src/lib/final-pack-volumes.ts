/**
 * final-pack-volumes.ts
 * ─────────────────────
 * FPS-006-03 — Volume config normalizer.
 *
 * Turns raw doc_template_volumes rows into a safe, sorted list the UI/export
 * can use. NEVER throws, NEVER required: missing/malformed config → empty array
 * (the document simply has no volumes and exports normally as one full doc).
 *
 * Live row shape: { id, template_version_id, volume_name, volume_key,
 * sort_order, block_keys (jsonb string[]), description }.
 */

export interface FinalPackVolume {
  volume_key: string;
  volume_title: string;
  block_keys: string[];
  sort_order: number;
  description: string;
}

export function normalizeFinalPackVolumes(input: unknown): FinalPackVolume[] {
  if (!Array.isArray(input)) return [];
  const out: FinalPackVolume[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    const volume_key = typeof v.volume_key === "string" ? v.volume_key : "";
    if (!volume_key) continue; // a volume with no key is unusable — skip safely
    const block_keys = Array.isArray(v.block_keys)
      ? (v.block_keys.filter((k) => typeof k === "string") as string[])
      : [];
    out.push({
      volume_key,
      volume_title:
        (typeof v.volume_name === "string" && v.volume_name) ||
        (typeof v.volume_title === "string" && v.volume_title) ||
        volume_key,
      block_keys,
      sort_order: typeof v.sort_order === "number" ? v.sort_order : 0,
      description: typeof v.description === "string" ? v.description : "",
    });
  }
  return out.sort((a, b) => a.sort_order - b.sort_order);
}
