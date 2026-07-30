/**
 * useBrandingProfiles.ts
 * ──────────────────────
 * FPS-025 — Hook to fetch branding profiles from doc_branding_profiles.
 *
 * Source-truth safety: Reads doc_branding_profiles only. No writes.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { BrandingProfile } from "@/lib/final-pack-preview";

export interface UseBrandingProfilesReturn {
  profiles: BrandingProfile[];
  loading: boolean;
  error: string | null;
}

export function useBrandingProfiles(): UseBrandingProfilesReturn {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("doc_branding_profiles")
        .select("id, name, primary_color, secondary_color, accent_color, font_family, font_heading, logo_url, footer_format, header_style, cover_hero_urls, watermark_url")
        .order("name");

      if (cancelled) return;

      if (err) {
        console.error("[FPS] Failed to load branding profiles:", err);
        setError(err.message);
        setLoading(false);
        return;
      }

      // Parse footer_format if it's a string; normalize cover_hero_urls to string[] (FPS-009).
      const parsed = (data || []).map((row: Record<string, unknown>) => {
        let hero: string[] = [];
        const raw = row.cover_hero_urls;
        if (Array.isArray(raw)) hero = raw.filter((u): u is string => typeof u === "string");
        else if (typeof raw === "string" && raw.trim()) {
          try {
            const j = JSON.parse(raw);
            if (Array.isArray(j)) hero = j.filter((u): u is string => typeof u === "string");
          } catch {
            /* malformed → empty, advisory only */
          }
        }
        return {
          ...row,
          cover_hero_urls: hero,
          watermark_url: (row.watermark_url as string | null) ?? null,
          footer_format:
            typeof row.footer_format === "string"
              ? JSON.parse(row.footer_format as string)
              : row.footer_format || {
                  show_ref: true,
                  show_date: true,
                  show_completed_by: false,
                  show_page_numbers: true,
                  custom_text: "",
                },
        };
      }) as BrandingProfile[];

      setProfiles(parsed);
      setLoading(false);
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { profiles, loading, error };
}
