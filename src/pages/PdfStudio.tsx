/**
 * FinalPackStudio.tsx
 * ───────────────────
 * Main page component for Final Pack Studio.
 * Route: /tenders/:tenderId/final-pack
 *
 * Two modes:
 * 1. Pack Selector — choose pack type, create/resume instance
 * 2. Composer — Two-panel: left = block canvas, right = live preview
 *
 * Source-truth safety:
 * - This page READS from commercial_tickets (via loader)
 * - This page WRITES only to doc_instances
 * - No update/upsert/delete against commercial_tickets
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, FileText, Loader2, ChevronRight, FileStack } from "lucide-react";
import { cleanHref } from "@clean/lib/clean-routing";
// CLEAN APP: was "../styles/final-pack-tokens.css", which resolved correctly from
// pages/ but broke when the file moved to clean/pages/. Switched to the @ alias so
// it is location-independent. The stylesheet itself is Reused Shared, not copied —
// FinalPackStudio's layout depends on its .fps-* classes and --fps-* variables.
import "@/styles/final-pack-tokens.css";
import PackSelector from "@/components/final-pack/PackSelector";
import StartScreen, { type EntryChoice } from "@/components/final-pack/StartScreen";
import StandaloneBlankPanel from "@/components/final-pack/StandaloneBlankPanel";
import TemplatePicker from "@/components/final-pack/TemplatePicker";
import TemplateBuilder from "@/components/final-pack/TemplateBuilder";
import SaveAsTemplateDialog from "@/components/final-pack/SaveAsTemplateDialog";
import VolumeSelector from "@/components/final-pack/VolumeSelector";
import { normalizeFinalPackVolumes } from "@/lib/final-pack-volumes";
import BlockCanvas from "@/components/final-pack/BlockCanvas";
import BlockEditor from "@/components/final-pack/BlockEditor";
import BlockPicker from "@/components/final-pack/BlockPicker";
import PreviewPane from "@/components/final-pack/PreviewPane";
import BrandingSelector from "@/components/final-pack/BrandingSelector";
import WarningBanner from "@/components/final-pack/WarningBanner";
import MetadataWarningBanner from "@/components/final-pack/MetadataWarningBanner";
import SaveBlockDialog from "@/components/final-pack/SaveBlockDialog";
import ExportToolbar from "@/components/final-pack/ExportToolbar";
import UndoRedoToolbar from "@/components/final-pack/UndoRedoToolbar";
import SourceDriftBanner from "@/components/final-pack/SourceDriftBanner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { DEFAULT_BRANDING, type BrandingProfile } from "@/lib/final-pack-preview";
import { resolveBrandingAssets, resolveAssetUrl, isStoragePath } from "@/lib/cover-asset-storage";
import { useFinalPackInstance, type FinalPackInstance } from "@/hooks/useFinalPackInstance";
import { useFinalPackBlocks } from "@/hooks/useFinalPackBlocks";
import { useSourceDrift } from "@/hooks/useSourceDrift";
import { useBrandingProfiles } from "@/hooks/useBrandingProfiles";
import { useInstanceVersions } from "@/hooks/useInstanceVersions";
import { usePresence } from "@/hooks/usePresence";
import { useBlockAIBots } from "@/hooks/useBlockAIBots";
import VersionHistoryPanel from "@/components/final-pack/VersionHistoryPanel";
import { History, Users, AlertTriangle } from "lucide-react";
import type { OutputBlock, BlockContent } from "@/lib/final-pack-loader";

type StudioMode = "select" | "compose";

export default function FinalPackStudio() {
  const { tenderId } = useParams<{ tenderId: string }>();
  const { appUser } = useAuth();
  const [mode, setMode] = useState<StudioMode>("select");
  const [activeInstance, setActiveInstance] = useState<FinalPackInstance | null>(null);
  const [saving, setSaving] = useState(false);
  // W04-C4: an auto-save failure used to be console-only — the spinner simply
  // disappeared, which is exactly what a completed save looks like. The last
  // failure is now held in state and shown until a save actually succeeds.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingProfile>(DEFAULT_BRANDING);
  const { profiles: brandingProfiles } = useBrandingProfiles();
  // Block being saved to the reusable library (FPS-003); null = dialog closed.
  const [reusableSaveBlock, setReusableSaveBlock] = useState<OutputBlock | null>(null);
  // Save-as-template dialog (FPS-005); true = open.
  const [savingAsTemplate, setSavingAsTemplate] = useState(false);
  // Selected volume (FPS-006); null = All (full document).
  const [selectedVolumeKey, setSelectedVolumeKey] = useState<string | null>(null);
  // FPS-007 reliability state.
  const [showHistory, setShowHistory] = useState(false);
  const [conflict, setConflict] = useState(false);

  // ── FPS-010 Ticket 1 — resizable editor/preview split (persisted) ──
  // null = use the CSS default (45%). A number = preview width in px (clamped).
  const composerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const [previewWidth, setPreviewWidth] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem("fps.previewWidth"));
      return Number.isFinite(v) && v >= 320 ? v : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (previewWidth != null) localStorage.setItem("fps.previewWidth", String(Math.round(previewWidth)));
      else localStorage.removeItem("fps.previewWidth");
    } catch { /* ignore */ }
  }, [previewWidth]);

  const onResizeMove = useCallback((e: PointerEvent) => {
    if (!resizingRef.current || !composerRef.current) return;
    const rect = composerRef.current.getBoundingClientRect();
    // Preview lives on the right; its width = distance from the pointer to the
    // right edge. Clamp so both panes keep a usable minimum.
    const raw = rect.right - e.clientX;
    const max = Math.max(360, rect.width - 360); // keep >= 360px for the editor
    const next = Math.min(Math.max(raw, 320), max);
    setPreviewWidth(next);
  }, []);

  const endResize = useCallback(() => {
    resizingRef.current = false;
    document.body.classList.remove("fps-resizing");
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", endResize);
  }, [onResizeMove]);

  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.classList.add("fps-resizing");
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", endResize);
  }, [onResizeMove, endResize]);

  // Safety: always detach global listeners on unmount.
  useEffect(() => endResize, [endResize]);

  const resetSplit = useCallback(() => setPreviewWidth(null), []);

  const meId = appUser?.id || appUser?.email || "anon";
  const meName = appUser?.email || appUser?.id || "User";

  // FPS-007: version history + presence (both fully non-blocking).
  const versionsApi = useInstanceVersions(activeInstance?.id ?? null);
  const presentOthers = usePresence(
    mode === "compose" ? (activeInstance?.id ?? null) : null,
    { id: meId, name: meName },
  );

  // Refs so the stable debounced save can read the latest values.
  const lastUpdatedAtRef = useRef<string | null>(null); // optimistic-concurrency token
  const lastVersionAtRef = useRef<number>(0);            // version append throttle
  const appendVersionRef = useRef(versionsApi.append);
  const sourceSnapshotRef = useRef<Record<string, unknown>>({});
  const meNameRef = useRef(meName);
  useEffect(() => { appendVersionRef.current = versionsApi.append; }, [versionsApi.append]);
  useEffect(() => { sourceSnapshotRef.current = (activeInstance?.source_snapshot as unknown as Record<string, unknown>) ?? {}; }, [activeInstance?.source_snapshot]);
  useEffect(() => { meNameRef.current = meName; }, [meName]);

  // Debounced save — writes blocks to doc_instances, with optimistic concurrency
  // (FPS-007-08) and throttled append-only version rows (FPS-007-06).
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBlocks = useCallback(
    (instanceId: string, blocks: OutputBlock[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const newUpdatedAt = new Date().toISOString();
          let q = supabase
            .from("doc_instances")
            .update({ blocks, updated_at: newUpdatedAt, last_edited_at: newUpdatedAt })
            .eq("id", instanceId);
          // Optimistic concurrency: only overwrite if the row hasn't changed
          // since we last saw it. If unknown (first save), skip the guard.
          if (lastUpdatedAtRef.current) q = q.eq("updated_at", lastUpdatedAtRef.current);
          const { data, error } = await q.select("id");
          if (error) {
            console.error("[FPS] Auto-save error:", error.message);
            setSaveError(error.message);
            return;
          }
          if (lastUpdatedAtRef.current && (!data || data.length === 0)) {
            // Someone else saved first. Preserve local edits; warn (advisory).
            setConflict(true);
            return;
          }
          if (!data || data.length === 0) {
            // W04-C4: first save, no concurrency guard, and still no row came
            // back. The request resolved but nothing is confirmed stored.
            setSaveError(
              "The editor's save request completed but no stored row came back, so this edit is not confirmed saved.",
            );
            return;
          }
          setSaveError(null);
          lastUpdatedAtRef.current = newUpdatedAt;
          // Throttled version snapshot (>= 30s apart; never blocks the save).
          const now = Date.now();
          if (now - lastVersionAtRef.current > 30000) {
            lastVersionAtRef.current = now;
            appendVersionRef.current(blocks, sourceSnapshotRef.current, meNameRef.current);
          }
        } catch (err) {
          console.error("[FPS] Auto-save error:", err);
          setSaveError(err instanceof Error ? err.message : "Unknown auto-save error");
        } finally {
          setSaving(false);
        }
      }, 2000);
    },
    [],
  );

  // Block manipulation hook — wired to auto-save (includes undo/redo + reset)
  const {
    moveBlock,
    toggleVisibility,
    updateBlockContent,
    addBlock,
    duplicateBlock,
    removeBlock,
    undo,
    redo,
    canUndo,
    canRedo,
    resetBlockFromSource,
    resetAllFromSource,
  } = useFinalPackBlocks(
    activeInstance?.blocks || [],
    (blocks) => {
      if (activeInstance) {
        setActiveInstance((prev) => prev ? { ...prev, blocks } : prev);
        saveBlocks(activeInstance.id, blocks);
      }
    },
  );

  // Source drift detection — READ ONLY check against commercial_tickets
  const {
    drifted,
    checking: driftChecking,
    recheck: recheckDrift,
    error: driftError,
  } = useSourceDrift(tenderId, activeInstance?.source_snapshot?._hash || null);

  // FPS-008: discover Bot Builder microbots for the active document ONCE
  // (filtered per-block client-side). Read-only; never blocks editing/export.
  const { result: aiBots, loading: aiBotsLoading } = useBlockAIBots({
    documentIntent: activeInstance?.pack_type,
    sourceMode: activeInstance?.source_snapshot?.source_mode,
  });

  // FPS-009-2B/2C: resolve uploaded (private-bucket) cover assets to signed URLs
  // for RENDER only (preview + export). The editor keeps the raw stored paths.
  // Falls back to the raw branding/blocks while resolving — never blocks render.
  const [resolvedBranding, setResolvedBranding] = useState<BrandingProfile>(branding);
  useEffect(() => {
    let cancelled = false;
    resolveBrandingAssets(branding)
      .then((b) => { if (!cancelled) setResolvedBranding(b); })
      .catch(() => { if (!cancelled) setResolvedBranding(branding); });
    return () => { cancelled = true; };
  }, [branding]);

  const [resolvedBlocks, setResolvedBlocks] = useState<OutputBlock[]>(activeInstance?.blocks || []);
  useEffect(() => {
    const blocks = activeInstance?.blocks || [];
    let cancelled = false;
    (async () => {
      try {
        const out = await Promise.all(
          blocks.map(async (b) => {
            const heroVal = b.content?.cover_config?.hero_url;
            if (b.render_key === "cover_hero" && isStoragePath(heroVal)) {
              const signed = await resolveAssetUrl(heroVal);
              return { ...b, content: { ...b.content, cover_config: { ...b.content!.cover_config, hero_url: signed } } };
            }
            return b;
          }),
        );
        if (!cancelled) setResolvedBlocks(out);
      } catch {
        if (!cancelled) setResolvedBlocks(blocks);
      }
    })();
    return () => { cancelled = true; };
  }, [activeInstance?.blocks]);

  const handleInstanceReady = useCallback((instance: FinalPackInstance) => {
    setActiveInstance(instance);
    setMode("compose");
    lastUpdatedAtRef.current = instance.updated_at || null;
    lastVersionAtRef.current = 0; // allow a version snapshot on first edit
    setConflict(false);
    setSelectedVolumeKey(null);
  }, []);

  const handleBackToSelector = useCallback(() => {
    setActiveInstance(null);
    setMode("select");
  }, []);

  // FPS-007: restore a previous version (explicit user action; never automatic).
  const handleRestoreVersion = useCallback(
    (blocks: OutputBlock[], fromVersion: number) => {
      const current = activeInstance;
      if (!current) return;
      setActiveInstance((prev) => (prev ? { ...prev, blocks } : prev));
      appendVersionRef.current(blocks, sourceSnapshotRef.current, meNameRef.current, `Restored from v${fromVersion}`);
      lastVersionAtRef.current = Date.now(); // avoid double version from the save below
      saveBlocks(current.id, blocks);
      setShowHistory(false);
    },
    [activeInstance, saveBlocks],
  );

  // FPS-007-08 conflict recovery — both are explicit, neither traps the user.
  const handleReloadLatest = useCallback(async () => {
    const current = activeInstance;
    if (!current) return;
    const { data } = await supabase.from("doc_instances").select("*").eq("id", current.id).maybeSingle();
    if (data) {
      const ss = data.source_snapshot || {};
      setActiveInstance((prev) => prev ? {
        ...prev,
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
        source_snapshot: ss,
        updated_at: data.updated_at || prev.updated_at,
      } : prev);
      lastUpdatedAtRef.current = data.updated_at || null;
    }
    setConflict(false);
  }, [activeInstance]);

  const handleKeepMine = useCallback(() => {
    const current = activeInstance;
    if (!current) return;
    lastUpdatedAtRef.current = null; // overwrite unconditionally on next save
    setConflict(false);
    saveBlocks(current.id, current.blocks);
  }, [activeInstance, saveBlocks]);

  // Restore persisted branding when an instance is opened (FPS-002).
  useEffect(() => {
    if (!activeInstance || brandingProfiles.length === 0) return;
    const persistedId = activeInstance.branding_profile_id;
    const match = persistedId
      ? brandingProfiles.find((p) => p.id === persistedId)
      : undefined;
    setBranding(match ?? DEFAULT_BRANDING);
    // Only re-resolve when the instance or its persisted branding changes.
  }, [activeInstance?.id, activeInstance?.branding_profile_id, brandingProfiles]);

  // Persist branding selection on the instance (FPS-002). Never gates export.
  const handleSelectBranding = useCallback(
    (profile: BrandingProfile) => {
      setBranding(profile);
      setActiveInstance((prev) => {
        if (!prev) return prev;
        const nextSnapshot = { ...prev.source_snapshot, branding_profile_id: profile.id };
        // Fire-and-forget persistence; export remains available regardless.
        supabase
          .from("doc_instances")
          .update({
            branding_profile_id: profile.id,
            source_snapshot: nextSnapshot,
            last_edited_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", prev.id)
          .then(({ error }) => {
            if (error) console.error("[FPS] Failed to persist branding:", error.message);
          });
        return { ...prev, branding_profile_id: profile.id, source_snapshot: nextSnapshot };
      });
    },
    [],
  );

  // Editor renderer — maps each block to its editor component
  const renderEditor = useCallback(
    (block: OutputBlock, onContentChange: (c: Partial<BlockContent>) => void) => {
      return (
        <BlockEditor
          block={block}
          blocks={activeInstance?.blocks || []}
          onContentChange={onContentChange}
          branding={branding}
          coverStyleDefault={activeInstance?.source_snapshot?.layout?.cover_style as string | undefined}
        />
      );
    },
    [activeInstance?.blocks, activeInstance?.source_snapshot?.layout, branding],
  );

  // Extract cover variables for preview
  const coverBlock = activeInstance?.blocks.find(
    (b) => b.render_key === "cover_hero",
  );
  const coverVars = coverBlock?.content.variables || {};

  // FPS-006: configured volumes (empty if none) + the currently selected one.
  const volumes = normalizeFinalPackVolumes(activeInstance?.source_snapshot?.volumes);
  const selectedVolume = volumes.find((v) => v.volume_key === selectedVolumeKey) ?? null;

  // FPS-010 Ticket 2 — one ExportToolbar definition, rendered both in the sticky
  // top bar and the bottom bar. Each instance owns its own button state; there
  // is no shared side effect, so a click in one triggers exactly one export.
  const renderExportToolbar = () => {
    if (!activeInstance) return null;
    return (
      <ExportToolbar
        instanceId={activeInstance.id}
        templateId={activeInstance.source_snapshot.template_id}
        blocks={resolvedBlocks}
        branding={resolvedBranding}
        title={coverVars.title || activeInstance.display_title}
        customerName={coverVars.customer_name || activeInstance.customer_name || ""}
        refNumber={coverVars.ref_number || ""}
        date={coverVars.date || ""}
        compiledBy={appUser?.email || appUser?.id || "unknown"}
        sourceMode={activeInstance.source_snapshot.source_mode}
        sourceKind={activeInstance.source_snapshot.source_kind}
        creationMethod={activeInstance.source_snapshot.creation_method}
        templateVersionId={activeInstance.source_snapshot.template_version_id}
        templateClass={activeInstance.template_class}
        instanceLastEditedAt={activeInstance.updated_at}
        layout={activeInstance.source_snapshot.layout}
        volumeKey={selectedVolume?.volume_key ?? null}
        volumeTitle={selectedVolume?.volume_title ?? null}
        volumeBlockKeys={selectedVolume?.block_keys ?? null}
        allVolumes={volumes}
      />
    );
  };

  return (
    <div className={`flex flex-col ${mode === "compose" ? "h-screen" : "min-h-screen"}`}>
      {/* ── Top Bar ── */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
        {/* CLEAN APP: the "Back to Tender" control below was a raw <a> (full page
            reload). Raw anchors bypass wouter's <Router base="/clean">, so it
            escaped to the legacy /tenders/:id route. Converted to <Link>. */}
        {mode === "select" ? (
          tenderId ? (
            <Link
              href={cleanHref(`/tenders/${tenderId}`)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tender
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Document Studio</span>
          )
        ) : (
          <button
            onClick={handleBackToSelector}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Pack Selector
          </button>
        )}
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Final Pack Studio</h1>
        </div>
        {activeInstance && (
          <>
            <div className="h-5 w-px bg-border" />
            <span className="text-xs text-muted-foreground truncate max-w-48">
              {activeInstance.display_title}
            </span>

            {/* Branding selector — in compose mode */}
            {mode === "compose" && (
              <>
                <div className="h-5 w-px bg-border" />
                <BrandingSelector
                  selectedId={branding.id}
                  onSelect={handleSelectBranding}
                />
                {/* Volume selector (FPS-006) — only renders when volumes exist */}
                {volumes.length > 0 && (
                  <>
                    <div className="h-5 w-px bg-border" />
                    <VolumeSelector
                      volumes={volumes}
                      selectedKey={selectedVolumeKey}
                      onSelect={setSelectedVolumeKey}
                      blocks={activeInstance.blocks}
                    />
                  </>
                )}
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Undo/Redo toolbar — in compose mode */}
              {mode === "compose" && (
                <UndoRedoToolbar
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                  onResetBlock={() => {
                    // Reset first visible block as example — in practice, user selects
                    const firstBlock = activeInstance.blocks[0];
                    if (firstBlock && activeInstance.source_snapshot._original_blocks) {
                      resetBlockFromSource(firstBlock.id, activeInstance.source_snapshot._original_blocks);
                    }
                  }}
                  onResetAll={() => {
                    resetAllFromSource(activeInstance.source_snapshot._original_blocks || []);
                  }}
                />
              )}
              {/* Presence indicator (FPS-007-09) — advisory only */}
              {mode === "compose" && presentOthers.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                  title={`Also here: ${presentOthers.map((u) => u.name).join(", ")}`}
                >
                  <Users className="h-3.5 w-3.5" />
                  {presentOthers.length}
                </span>
              )}
              {/* Version history (FPS-007-07) */}
              {mode === "compose" && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="View version history"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              )}
              {/* Save as Template (FPS-005) */}
              {mode === "compose" && (
                <button
                  onClick={() => setSavingAsTemplate(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Save this document as a reusable template"
                >
                  <FileStack className="h-3.5 w-3.5" />
                  Save as Template
                </button>
              )}
              <div className="h-5 w-px bg-border" />
              {saving ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </span>
              ) : saveError ? (
                /* W04-C4: "not saved" must never look like a finished save. */
                <span
                  className="flex items-center gap-1 text-xs font-medium text-destructive"
                  title={saveError}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Not saved
                </span>
              ) : null}
              <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
                {activeInstance.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {activeInstance.blocks.length} blocks
              </span>
            </div>
          </>
        )}
      </header>

      {/* ── Content ── */}
      {/* Standalone entry (no tenderId): real StartScreen + standalone paths */}
      {mode === "select" && !tenderId && (
        <StandaloneEntry onInstanceReady={handleInstanceReady} />
      )}

      {/* Connected entry (tenderId present): unchanged PackSelector flow */}
      {mode === "select" && tenderId && (
        <PackSelector
          tenderId={tenderId}
          onInstanceReady={handleInstanceReady}
        />
      )}

      {mode === "compose" && activeInstance && (
        <>
          {/* Sticky top export bar (FPS-010 Ticket 2) — export without scrolling */}
          <div className="fps-top-export">{renderExportToolbar()}</div>

          <div
            className="fps-composer"
            ref={composerRef}
            style={previewWidth != null
              ? ({ ["--fps-preview-width" as string]: `${previewWidth}px` } as React.CSSProperties)
              : undefined}
          >
            {/* Left panel — Block canvas */}
            <div className="fps-composer-left">
              {/* Source drift banner — connected documents only (advisory) */}
              <div className="px-4 pt-3 space-y-2">
                {activeInstance.tender_id && (
                  <SourceDriftBanner
                    drifted={drifted}
                    checking={driftChecking}
                    error={driftError}
                    onRefreshFromSource={() => {
                      resetAllFromSource(activeInstance.source_snapshot._original_blocks || []);
                    }}
                    onRecheck={recheckDrift}
                  />
                )}
                {/* W04-C4: an auto-save that did not land is stated plainly,
                    with an explicit retry — it is never left as silence. */}
                {saveError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="flex-1">
                      Your last edit was <strong>not saved</strong> — {saveError} Your edits are still
                      here in the editor; nothing has been lost from this session.
                    </span>
                    <button
                      onClick={() => saveBlocks(activeInstance.id, activeInstance.blocks)}
                      className="px-2 py-0.5 rounded border border-border bg-card hover:bg-accent"
                    >
                      Retry save
                    </button>
                  </div>
                )}
                {/* W04-C4: when a volume is selected, these notes describe THAT
                    volume — they used to count the whole document. */}
                <WarningBanner
                  blocks={activeInstance.blocks}
                  volumeBlockKeys={selectedVolume?.block_keys ?? null}
                  volumeTitle={selectedVolume?.volume_title ?? null}
                />
                <MetadataWarningBanner instance={activeInstance} />
                {/* Save conflict advisory (FPS-007-08) — never blocks editing/export */}
                {conflict && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-700 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="flex-1">Another session saved changes to this document. Your edits are kept locally.</span>
                    <button onClick={handleKeepMine} className="px-2 py-0.5 rounded border border-border bg-card hover:bg-accent">Keep mine</button>
                    <button onClick={handleReloadLatest} className="px-2 py-0.5 rounded border border-border bg-card hover:bg-accent">Reload latest</button>
                  </div>
                )}
              </div>

              <BlockCanvas
                blocks={activeInstance.blocks}
                onMoveBlock={moveBlock}
                onToggleVisibility={toggleVisibility}
                onContentChange={updateBlockContent}
                onDuplicate={(block) => duplicateBlock(block.id)}
                onRemove={(block) => removeBlock(block.id)}
                onSaveReusable={(block) => setReusableSaveBlock(block)}
                renderEditor={renderEditor}
                aiBots={aiBots}
                aiBotsLoading={aiBotsLoading}
                aiDocContext={{
                  doc_instance_id: activeInstance.id,
                  document_title: coverVars.title || activeInstance.display_title || activeInstance.customer_name || "Untitled document",
                  document_intent: activeInstance.pack_type ?? null,
                  source_mode: activeInstance.source_snapshot?.source_mode ?? null,
                  source_kind: activeInstance.source_snapshot?.source_kind ?? null,
                  creation_method: activeInstance.source_snapshot?.creation_method ?? null,
                }}
              />
              <div className="px-4 pb-6">
                <BlockPicker
                  onAddBlock={addBlock}
                  existingBlockKeys={activeInstance.blocks.map((b) => b.block_key)}
                />
              </div>
            </div>

            {/* Resizable divider (FPS-010 Ticket 1) — drag to resize; double-click resets */}
            <div
              className="fps-resizer"
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize · double-click to reset"
              onPointerDown={startResize}
              onDoubleClick={resetSplit}
              data-active={resizingRef.current ? "true" : undefined}
            />

            {/* Right panel — Live preview */}
            <PreviewPane
              blocks={resolvedBlocks}
              branding={resolvedBranding}
              exportMode="draft"
              customerName={coverVars.customer_name || activeInstance.customer_name || ""}
              refNumber={coverVars.ref_number || ""}
              date={coverVars.date || ""}
              layout={activeInstance.source_snapshot.layout}
              volumeBlockKeys={selectedVolume?.block_keys ?? null}
            />
          </div>

          {/* Export toolbar — ALWAYS at bottom too, ZERO coupling to WarningBanner.
              Same definition as the sticky top bar (FPS-010 Ticket 2). */}
          {renderExportToolbar()}

          {/* Save-as-reusable dialog (FPS-003) — advisory; never blocks the document */}
          {reusableSaveBlock && (
            <SaveBlockDialog
              block={reusableSaveBlock}
              createdBy={appUser?.email || appUser?.id || "User"}
              onClose={() => setReusableSaveBlock(null)}
            />
          )}

          {/* Save current document as a template (FPS-005) */}
          {savingAsTemplate && (
            <SaveAsTemplateDialog
              blocks={activeInstance.blocks}
              packType={activeInstance.pack_type}
              defaultName={coverVars.title || activeInstance.display_title}
              customerName={coverVars.customer_name || activeInstance.customer_name || ""}
              refNumber={coverVars.ref_number || ""}
              brandingProfileId={branding.id}
              layout={activeInstance.source_snapshot.layout}
              createdBy={appUser?.email || appUser?.id || "User"}
              onClose={() => setSavingAsTemplate(false)}
            />
          )}

          {/* Version history (FPS-007-07) */}
          {showHistory && (
            <VersionHistoryPanel
              instanceId={activeInstance.id}
              onRestore={handleRestoreVersion}
              onClose={() => setShowHistory(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// StandaloneEntry — entry state machine shown at /pdf-studio (no tenderId)
// start → connected | blank | template | resume
// ═══════════════════════════════════════════════════════════

type EntryView = "start" | EntryChoice;

function StandaloneEntry({
  onInstanceReady,
}: {
  onInstanceReady: (instance: FinalPackInstance) => void;
}) {
  const [view, setView] = useState<EntryView>("start");
  const { appUser } = useAuth();
  const authoringUser = appUser?.email || appUser?.id || "User";
  const { instance, loadInstance, listAllInstances, error: instanceError } = useFinalPackInstance();
  const [resumeList, setResumeList] = useState<FinalPackInstance[]>([]);
  const [loadingResume, setLoadingResume] = useState(false);
  // Failed list read ≠ "no documents yet" (W04-T09).
  const [resumeError, setResumeError] = useState<string | null>(null);

  // When an instance is resumed (loaded), hand off to the composer.
  useEffect(() => {
    if (instance) onInstanceReady(instance);
  }, [instance, onInstanceReady]);

  // Load the resume list when entering the resume view.
  useEffect(() => {
    if (view !== "resume") return;
    let cancelled = false;
    (async () => {
      setLoadingResume(true);
      const list = await listAllInstances();
      if (!cancelled) {
        setResumeList(list.instances);
        setResumeError(list.error);
        setLoadingResume(false);
      }
    })();
    return () => { cancelled = true; };
  }, [view, listAllInstances]);

  if (view === "start") {
    return <StartScreen onChoose={(c) => setView(c)} />;
  }

  if (view === "connected") {
    return <TenderPicker onBack={() => setView("start")} />;
  }

  if (view === "blank") {
    return (
      <StandaloneBlankPanel
        onInstanceReady={onInstanceReady}
        onBack={() => setView("start")}
      />
    );
  }

  if (view === "template") {
    return (
      <TemplatePicker
        onInstanceReady={onInstanceReady}
        onBack={() => setView("start")}
      />
    );
  }

  if (view === "authoring") {
    return <TemplateBuilder onBack={() => setView("start")} createdBy={authoringUser} />;
  }

  // resume
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => setView("start")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Resume Existing Document</h2>
          <p className="text-sm text-muted-foreground">
            Reopen a document you previously created (connected or standalone).
          </p>
        </div>

        {/* Loading, real-empty and failed-read are three visibly different states. */}
        {instanceError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{instanceError}</span>
          </div>
        )}
        {loadingResume ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : resumeError ? (
          <div className="text-center space-y-3 py-8">
            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Your documents could not be listed — {resumeError}
            </p>
            <p className="text-xs text-muted-foreground">
              This is a read failure, not an empty list. Existing documents are not lost.
            </p>
            <button
              onClick={() => setView("start")}
              className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-accent"
            >
              Back to start
            </button>
          </div>
        ) : resumeList.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No documents yet. Start blank or from a template.
          </p>
        ) : (
          <div className="space-y-2">
            {resumeList.map((inst) => (
              <button
                key={inst.id}
                onClick={() => loadInstance(inst.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {inst.display_title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inst.pack_type} · {inst.status}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════
// TenderPicker — shown when /pdf-studio is opened without a tenderId
// Queries real tender data from Supabase. No fake data.
// ═══════════════════════════════════════════════════════════

function TenderPicker({ onBack }: { onBack?: () => void }) {
  const [, navigate] = useLocation();
  const [tenders, setTenders] = useState<Array<{ id: string; title: string; customer: string; stage: string }>>([]);
  const [loading, setLoading] = useState(true);
  // W04-T09 — the read error was discarded, so a failed read rendered as
  // "No tenders found in Supabase", which is a claim about the data.
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("commercial_tickets")
        .select("id, ticket_title, customer_name, internal_stage")
        .order("updated_at", { ascending: false })
        .limit(20);

      if (cancelled) return;
      if (error) {
        setTenders([]);
        setReadError(error.message);
        setLoading(false);
        return;
      }
      setReadError(null);
      setTenders(
        (data || []).map((t: any) => ({
          id: t.id,
          title: t.ticket_title || "Untitled",
          customer: t.customer_name || "Unknown",
          stage: t.internal_stage || "—",
        })),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <div className="text-center space-y-2 py-6">
          <FileText className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-lg font-semibold">Select a Tender</h2>
          <p className="text-sm text-muted-foreground">
            Choose a tender to open in Final Pack Studio.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : readError ? (
          <div className="text-center space-y-2 py-8">
            <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Tenders could not be loaded — {readError}
            </p>
            <p className="text-xs text-muted-foreground">
              This is a read failure, not an empty list.
            </p>
          </div>
        ) : tenders.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No tenders are visible to your account.
          </p>
        ) : (
          <div className="space-y-2">
            {tenders.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(cleanHref(`/tenders/${t.id}/final-pack`))}
                className="w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.customer}</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-accent text-accent-foreground">
                    {t.stage}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
