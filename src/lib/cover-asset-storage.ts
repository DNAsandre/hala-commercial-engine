/**
 * cover-asset-storage.ts
 * ──────────────────────
 * FPS-009-2B/2C — Cover image asset upload + sign-on-load (Option A).
 *
 * Storage model (existing infra): the ONLY bucket is `documents` (PRIVATE).
 * We upload cover images there under a `cover-assets/…` prefix and store the
 * STORAGE PATH (not a URL) in doc_branding_profiles.* and content.cover_config.
 * Because the bucket is private and the cover renderer is a pure/sync function
 * using <img src>, we RESOLVE each stored path to a fresh signed URL on load
 * (signed URLs expire ~1h, so we re-sign every render-resolution pass).
 *
 * A stored asset value can therefore be EITHER:
 *   - a raw external URL (http(s)://… or data:image/… — pasted in Phase 2A), OR
 *   - a storage path (no scheme — uploaded here).
 * resolveAssetUrl() handles both; only paths are signed.
 *
 * Never throws into the UI — upload/sign failures are advisory.
 */

import { supabase } from "@/lib/supabase";

/** Existing private bucket (no public bucket exists; do not create one here). */
const BUCKET = "documents";
const PREFIX = "cover-assets";
const SIGNED_TTL_SECONDS = 3600;

export const ALLOWED_IMAGE_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export interface CoverUploadResult {
  ok: boolean;
  /** Storage path to persist (when ok). */
  path?: string;
  /** Advisory error message (when !ok). */
  error?: string;
}

/** FPS-013 — accepted PDF mime types for the imported PDF cover. */
const PDF_MIME = new Set(["application/pdf"]);
/** Max imported-PDF size (advisory cap; covers are small). */
const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** A non-empty value that is NOT an http(s)/data URL → treat as a storage path. */
export function isStoragePath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return !/^(https?:\/\/|data:)/i.test(v);
}

/**
 * Validate + upload an image to the private bucket. Returns the storage PATH.
 * scope namespaces the asset, e.g. "branding/<id>" or "doc/<instanceId>".
 */
export async function uploadCoverImage(file: File, scope: string): Promise<CoverUploadResult> {
  try {
    const mime = (file.type || "").toLowerCase();
    const ext = ALLOWED_IMAGE_MIME[mime];
    if (!ext) {
      return { ok: false, error: "Unsupported file type — use PNG, JPG, or WebP." };
    }
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, error: "Image is larger than 8 MB." };
    }
    const safeScope = scope.replace(/[^a-zA-Z0-9/_-]/g, "_");
    const path = `${PREFIX}/${safeScope}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: mime, upsert: false });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/**
 * FPS-013 — Validate + upload an imported PDF cover to the private bucket.
 * Returns the storage PATH. PDF only; never throws. scope namespaces the asset
 * (e.g. "doc/<instanceId>"). The PDF is stored as-is and used statically — it is
 * never parsed into editable content.
 */
export async function uploadCoverPdf(file: File, scope: string): Promise<CoverUploadResult> {
  try {
    const mime = (file.type || "").toLowerCase();
    const nameIsPdf = /\.pdf$/i.test(file.name || "");
    if (!PDF_MIME.has(mime) && !nameIsPdf) {
      return { ok: false, error: "Unsupported file type — upload a PDF (.pdf)." };
    }
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, error: "PDF is larger than 25 MB." };
    }
    const safeScope = scope.replace(/[^a-zA-Z0-9/_-]/g, "_");
    const path = `${PREFIX}/${safeScope}/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) return { ok: false, error: error.message };
    return { ok: true, path };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/**
 * FPS-013 — Fetch the raw bytes of a stored asset (e.g. the imported PDF) for
 * client-side merge at export time. Resolves a storage path to a signed URL,
 * then downloads. Returns null (never throws) on any failure → caller falls back.
 */
export async function fetchAssetBytes(value: unknown): Promise<Uint8Array | null> {
  try {
    const url = await resolveAssetUrl(value);
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Resolve a stored asset value to a renderable URL.
 * - raw URL → returned as-is.
 * - storage path → signed URL (best-effort; "" if signing fails).
 * - empty/missing → "".
 */
export async function resolveAssetUrl(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  if (!isStoragePath(v)) return v; // already a URL
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(v, SIGNED_TTL_SECONDS);
    if (error || !data?.signedUrl) return "";
    return data.signedUrl;
  } catch {
    return "";
  }
}

/** Resolve all branding cover-asset fields (logo/hero[]/watermark) → signed/raw URLs. */
export async function resolveBrandingAssets<
  T extends { logo_url?: string; cover_hero_urls?: string[]; watermark_url?: string | null }
>(branding: T): Promise<T> {
  if (!branding) return branding;
  const [logo, watermark, ...heroes] = await Promise.all([
    resolveAssetUrl(branding.logo_url),
    resolveAssetUrl(branding.watermark_url),
    ...(Array.isArray(branding.cover_hero_urls) ? branding.cover_hero_urls : []).map((u) => resolveAssetUrl(u)),
  ]);
  return {
    ...branding,
    logo_url: logo,
    watermark_url: watermark || null,
    cover_hero_urls: heroes.filter(Boolean),
  };
}
