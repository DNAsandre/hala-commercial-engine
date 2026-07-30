/**
 * CoverEditor.tsx
 * ───────────────
 * FPS-017 — Form-based editor for variable-driven blocks (facility, party).
 * FPS-009 — Cover Designer panel for the cover_hero block: style, branding
 * assets (logo/hero/watermark), toggles, and alignment.
 *
 * All cover-design choices are stored additively in block.content.cover_config
 * (per-document). The template's layout.cover_style is the default; a block
 * override here wins. Missing assets/config fall back safely — never a gate.
 *
 * Source-truth safety: Writes to doc_instances.blocks only (content.variables +
 * content.cover_config). Never mutates templates, branding profiles, or source.
 */

import { useCallback, useEffect, useState } from "react";
import type { OutputBlock, BlockContent, CoverConfig } from "@/lib/final-pack-loader";
import type { BrandingProfile } from "@/lib/final-pack-preview";
import { uploadCoverImage, uploadCoverPdf, resolveAssetUrl, isStoragePath } from "@/lib/cover-asset-storage";

interface CoverEditorProps {
  block: OutputBlock;
  onContentChange: (content: Partial<BlockContent>) => void;
  /** FPS-009 — resolved branding (hero/logo/watermark availability). */
  branding?: BrandingProfile;
  /** FPS-009 — template default cover style (shown as the fallback). */
  coverStyleDefault?: string;
  /** FPS-009 — render the Cover Design panel (cover_hero only). */
  showCoverDesign?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title", subtitle: "Subtitle", customer_name: "Customer Name",
  ref_number: "Reference Number", date: "Date", company_name: "Company Name",
  recipient_name: "Recipient Name", facility_name: "Facility Name", location: "Location",
  hala_signatory: "Hala Signatory", hala_title: "Hala Title", client_signatory: "Client Signatory",
  client_title: "Client Title", hala_company: "Hala Company", client_company: "Client Company",
  first_party_name: "First Party Name", first_party_cr: "First Party CR",
  first_party_address: "First Party Address", second_party_name: "Second Party Name",
  second_party_cr: "Second Party CR", second_party_address: "Second Party Address",
  total_amount: "Total Amount", total_in_words: "Total in Words", currency: "Currency",
};

const STYLE_OPTIONS = [
  { value: "", label: "Use template default" },
  { value: "hero_image", label: "Hero image" },
  { value: "branded", label: "Branded" },
  { value: "minimal", label: "Minimal" },
  { value: "wave", label: "Wave" },
];

export default function CoverEditor({
  block, onContentChange, branding, coverStyleDefault, showCoverDesign,
}: CoverEditorProps) {
  const variables = block.content.variables || {};
  const entries = Object.entries(variables);
  const cfg: CoverConfig = block.content.cover_config || {};
  const heroUrls = branding?.cover_hero_urls ?? [];
  const hasLogo = !!(branding?.logo_url || "").trim();
  const hasWatermark = !!(branding?.watermark_url || "").trim();

  const handleChange = useCallback(
    (key: string, value: string) => {
      onContentChange({ variables: { ...variables, [key]: value }, source_status: "populated" });
    },
    [variables, onContentChange],
  );

  const updateCfg = useCallback(
    (patch: Partial<CoverConfig>) => {
      onContentChange({ cover_config: { ...cfg, ...patch }, source_status: "populated" });
    },
    [cfg, onContentChange],
  );

  // FPS-009-2C: upload a per-document cover image (stored as a storage path in
  // cover_config.hero_url; signed at render time). Advisory on failure.
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const heroIsUpload = isStoragePath(cfg.hero_url);
  const [uploadThumb, setUploadThumb] = useState("");
  useEffect(() => {
    let cancelled = false;
    if (heroIsUpload && cfg.hero_url) resolveAssetUrl(cfg.hero_url).then((u) => { if (!cancelled) setUploadThumb(u); });
    else setUploadThumb("");
    return () => { cancelled = true; };
  }, [cfg.hero_url, heroIsUpload]);

  const handleDocUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setUploading(true);
    const res = await uploadCoverImage(file, `doc/${block.id}`);
    setUploading(false);
    if (res.ok && res.path) updateCfg({ hero_url: res.path, show_hero: true });
    else setUploadError(res.error || "Upload failed");
  }, [block.id, updateCfg]);

  // FPS-013 — cover mode (native | image | imported_pdf) + imported PDF upload.
  const coverMode = cfg.cover_mode || "native";
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePdfUpload = useCallback(async (file: File) => {
    setPdfError(null);
    setPdfUploading(true);
    const res = await uploadCoverPdf(file, `doc/${block.id}`);
    setPdfUploading(false);
    if (res.ok && res.path) {
      updateCfg({
        cover_mode: "imported_pdf",
        imported_pdf_path: res.path,
        imported_pdf_file_name: file.name,
        imported_pdf_page: 1,
        imported_pdf_static: true,
      });
    } else {
      setPdfError(res.error || "Upload failed");
    }
  }, [block.id, updateCfg]);

  const removeImportedPdf = useCallback(() => {
    updateCfg({
      cover_mode: "native",
      imported_pdf_path: undefined,
      imported_pdf_file_name: undefined,
      imported_pdf_page: undefined,
      imported_pdf_static: undefined,
    });
  }, [updateCfg]);

  // Toggle defaults: text on; watermark off; hero on (only renders if asset present).
  const showLogo = cfg.show_logo !== false;
  const showSubtitle = cfg.show_subtitle !== false;
  const showMeta = cfg.show_meta !== false;
  const showHero = cfg.show_hero !== false;
  const showWatermark = cfg.show_watermark === true;
  const effectiveStyle = cfg.cover_style || coverStyleDefault || "hero_image";

  return (
    <div className="space-y-4">
      {/* ── FPS-009 Cover Design panel ── */}
      {showCoverDesign && (
        <div className="rounded-md border border-violet-400/40 bg-violet-500/5 p-3 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            🎨 <span>Cover Design</span>
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">
              Effective style: <span className="font-medium">{effectiveStyle}</span>
            </span>
          </div>

          {/* FPS-013 — Cover mode */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Cover mode</label>
            <div className="flex gap-1">
              {([
                ["native", "Native cover"],
                ["image", "Image cover"],
                ["imported_pdf", "Imported PDF"],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateCfg({ cover_mode: val })}
                  className={`flex-1 rounded border px-2 py-1 text-[11px] ${
                    coverMode === val
                      ? "border-violet-500 bg-violet-500/10 text-violet-700"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* FPS-013 — Imported PDF cover */}
          {coverMode === "imported_pdf" && (
            <div className="rounded border border-violet-400/40 bg-violet-500/5 p-2 space-y-2">
              {cfg.imported_pdf_path ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] text-foreground min-w-0">
                    <span className="rounded bg-red-700 px-1 py-0.5 text-[9px] font-bold text-white">PDF</span>
                    <span className="truncate">{cfg.imported_pdf_file_name || "Imported cover.pdf"}</span>
                  </span>
                  <button type="button" onClick={removeImportedPdf} className="text-[11px] text-red-500 hover:underline flex-shrink-0">
                    Remove
                  </button>
                </div>
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent">
                {pdfUploading ? "Uploading…" : cfg.imported_pdf_path ? "Replace PDF cover" : "Upload PDF cover"}
                <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={pdfUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.currentTarget.value = ""; }} />
              </label>
              {pdfError && <p className="text-[11px] text-amber-600">{pdfError}</p>}
              <p className="text-[10px] text-muted-foreground">
                Imported PDF cover is used as a static first page. It is not editable. Native cover
                settings below are ignored for export while this mode is active.
              </p>
            </div>
          )}

          {/* Style */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Cover style</label>
            <select
              value={cfg.cover_style ?? ""}
              onChange={(e) => updateCfg({ cover_style: e.target.value || undefined })}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {STYLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}{o.value === "" && coverStyleDefault ? ` (${coverStyleDefault})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Alignment */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Alignment</label>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => updateCfg({ align: a })}
                  className={`flex-1 rounded border px-2 py-1 text-[11px] capitalize ${
                    (cfg.align || "center") === a
                      ? "border-violet-500 bg-violet-500/10 text-violet-700"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Hero image: pick from branding OR upload one for this document (FPS-009-2C) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Hero image</label>
            {!heroIsUpload && heroUrls.length > 0 && (
              <select
                value={cfg.hero_url ?? ""}
                onChange={(e) => updateCfg({ hero_url: e.target.value || undefined })}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Default (first available)</option>
                {heroUrls.map((u, i) => (
                  <option key={u} value={u}>{`Image ${i + 1}`}</option>
                ))}
              </select>
            )}
            {!heroIsUpload && heroUrls.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No hero images in the selected branding profile — upload one for this document below, or
                the cover falls back to the branded gradient.
              </p>
            )}

            {/* Per-document upload */}
            {heroIsUpload ? (
              <div className="rounded border border-violet-400/40 bg-violet-500/5 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-foreground">📤 Uploaded image (this document)</span>
                  <button
                    type="button"
                    onClick={() => updateCfg({ hero_url: undefined })}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                {uploadThumb && (
                  <img src={uploadThumb} alt="" className="mt-1 h-14 w-auto max-w-[160px] rounded border border-border object-contain bg-card"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent">
                {uploading ? "Uploading…" : "Upload image for this document"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); e.currentTarget.value = ""; }} />
              </label>
            )}
            {uploadError && <p className="text-[11px] text-amber-600">{uploadError}</p>}
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-1.5">
            <Toggle label="Logo" checked={showLogo} disabled={!hasLogo}
              hint={hasLogo ? undefined : "no logo in branding"}
              onChange={(v) => updateCfg({ show_logo: v })} />
            <Toggle label="Subtitle" checked={showSubtitle}
              onChange={(v) => updateCfg({ show_subtitle: v })} />
            <Toggle label="Meta (ref/date)" checked={showMeta}
              onChange={(v) => updateCfg({ show_meta: v })} />
            <Toggle label="Hero image" checked={showHero}
              onChange={(v) => updateCfg({ show_hero: v })} />
            <Toggle label="Watermark" checked={showWatermark} disabled={!hasWatermark}
              hint={hasWatermark ? undefined : "no watermark in branding"}
              onChange={(v) => updateCfg({ show_watermark: v })} />
          </div>
        </div>
      )}

      {/* ── Variable fields ── */}
      {entries.length === 0 ? (
        !showCoverDesign && (
          <p className="text-xs text-muted-foreground italic">No editable fields for this block.</p>
        )
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label htmlFor={`fps-field-${block.id}-${key}`} className="text-xs font-medium text-muted-foreground">
                {FIELD_LABELS[key] || key}
              </label>
              <input
                id={`fps-field-${block.id}-${key}`}
                type="text"
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label, checked, onChange, disabled, hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex items-center gap-1.5 text-[11px] ${disabled ? "opacity-50" : "cursor-pointer"}`}
      title={hint}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5"
      />
      <span className="text-foreground">{label}</span>
      {hint && <span className="text-[10px] text-muted-foreground">({hint})</span>}
    </label>
  );
}
