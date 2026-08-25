/**
 * BrandingSelector.tsx
 * ────────────────────
 * FPS-025 — Dropdown for branding profile selection.
 *
 * Fetches profiles from doc_branding_profiles (real data, not hardcoded).
 * Selection changes preview immediately.
 *
 * Source-truth safety: Reads doc_branding_profiles. No writes.
 */

import { Palette } from "lucide-react";
import { useBrandingProfiles } from "@/hooks/useBrandingProfiles";
import type { BrandingProfile } from "@/lib/final-pack-preview";

interface BrandingSelectorProps {
  selectedId: string | null;
  onSelect: (profile: BrandingProfile) => void;
}

export default function BrandingSelector({ selectedId, onSelect }: BrandingSelectorProps) {
  const { profiles, loading, error } = useBrandingProfiles();

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Palette className="h-3.5 w-3.5" />
        <span>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-700" title={error}>
        <Palette className="h-3.5 w-3.5" />
        <span>Branding unavailable</span>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Palette className="h-3.5 w-3.5" />
        <span>No branding profiles</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Palette className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={selectedId || profiles[0]?.id || ""}
        onChange={(e) => {
          const profile = profiles.find((p) => p.id === e.target.value);
          if (profile) onSelect(profile);
        }}
        className="text-xs bg-transparent border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {/* Color preview swatch */}
      {selectedId && (() => {
        const sel = profiles.find((p) => p.id === selectedId);
        if (!sel) return null;
        return (
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 rounded-sm border border-border" style={{ background: sel.primary_color }} title="Primary" />
            <div className="w-3 h-3 rounded-sm border border-border" style={{ background: sel.accent_color }} title="Accent" />
          </div>
        );
      })()}
    </div>
  );
}
