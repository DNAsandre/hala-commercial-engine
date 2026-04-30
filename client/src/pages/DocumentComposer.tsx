/**
 * Document Composer — Sprint 2
 * Block-by-block editor for document instances.
 *
 * Routes:
 *   /workspaces/:workspaceId/compose/:docType  — create or resolve instance from workspace
 *   /compose/:docInstanceId/edit               — edit existing instance directly
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Save, FileDown, Eye, Loader2, Lock,
  Bold, Italic, List, ListOrdered, Heading2, CheckCircle,
  AlertTriangle, RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { substituteVariables, buildVariableContext, extractVariableKeys } from "@/lib/variable-resolver";
import { useWorkspace } from "@/hooks/useSupabase";
import { useDocTemplates, useDocBlocks, useDocBrandingProfiles } from "@/hooks/useSupabase";
import {
  blockLibrary, docTemplates, brandingProfiles,
  DOC_TYPE_CONFIG, BLOCK_FAMILY_CONFIG,
  type DocType, type InstanceBlock,
} from "@/lib/document-composer";

// ─── Helpers ─────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (id: string) => UUID_RE.test(id);

interface ComposerInstance {
  id: string;
  doc_type: DocType;
  customer_name: string;
  workspace_name: string | null;
  workspace_id: string | null;
  title: string;
  status: "draft" | "canon";
  branding_profile_id: string | null;
  current_version_id: string | null;
  is_compiled: boolean;
}

interface LocalBlock {
  block_key: string;
  order: number;
  content: string;
  is_locked: boolean;
  is_ai_generated: boolean;
  config: Record<string, string>;
  display_name: string;
  family: string;
  editor_mode: "wysiwyg" | "form" | "readonly" | "clause";
  required: boolean;
}

function hydrateBlocks(rawBlocks: InstanceBlock[], liveBlocks: typeof blockLibrary): LocalBlock[] {
  return rawBlocks.map(b => {
    const def = liveBlocks.find(lb => lb.block_key === b.block_key) ||
                blockLibrary.find(lb => lb.block_key === b.block_key);
    return {
      ...b,
      display_name: def?.display_name ?? b.block_key,
      family: def?.family ?? "commercial",
      editor_mode: def?.editor_mode ?? "wysiwyg",
      required: false,
      config: (b.config ?? {}) as Record<string, string>,
    };
  });
}

// ─── Toolbar ─────────────────────────────────────────────

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn = "px-1.5 py-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-30";
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-gray-50/80">
      <button
        className={`${btn} ${editor.isActive("bold") ? "bg-gray-200" : ""}`}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        title="Bold"
      >
        <Bold size={12} />
      </button>
      <button
        className={`${btn} ${editor.isActive("italic") ? "bg-gray-200" : ""}`}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        title="Italic"
      >
        <Italic size={12} />
      </button>
      <div className="w-px h-4 bg-gray-300 mx-1" />
      <button
        className={`${btn} ${editor.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""}`}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
        title="Heading"
      >
        <Heading2 size={12} />
      </button>
      <button
        className={`${btn} ${editor.isActive("bulletList") ? "bg-gray-200" : ""}`}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        title="Bullet list"
      >
        <List size={12} />
      </button>
      <button
        className={`${btn} ${editor.isActive("orderedList") ? "bg-gray-200" : ""}`}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        title="Numbered list"
      >
        <ListOrdered size={12} />
      </button>
    </div>
  );
}

// ─── Block row in left sidebar ────────────────────────────

function BlockRow({
  block,
  active,
  onClick,
}: {
  block: LocalBlock;
  active: boolean;
  onClick: () => void;
}) {
  const familyCfg = BLOCK_FAMILY_CONFIG[block.family as keyof typeof BLOCK_FAMILY_CONFIG];
  const isReadonly = block.editor_mode === "readonly";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-md transition-colors ${
        active
          ? "bg-[#1B2A4A]/10 border border-[#1B2A4A]/20"
          : "hover:bg-gray-100 border border-transparent"
      }`}
    >
      <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${familyCfg?.bg ?? "bg-gray-100"} border ${familyCfg?.bg ?? ""}`}
           style={{ backgroundColor: familyCfg ? undefined : "#e5e7eb" }} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-gray-800 truncate">{block.display_name}</span>
          {block.required && <span className="text-[9px] text-red-500">*</span>}
          {block.is_locked && <Lock size={9} className="text-amber-600 shrink-0" />}
        </div>
        <span className={`text-[9px] ${familyCfg?.color ?? "text-gray-400"}`}>
          {isReadonly ? "Auto-bound" : block.editor_mode}
        </span>
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────

export default function DocumentComposer() {
  const [, wsParams] = useRoute("/workspaces/:workspaceId/compose/:docType");
  const [, instParams] = useRoute("/compose/:docInstanceId/edit");
  const [, navigate] = useLocation();

  const workspaceId = wsParams?.workspaceId ?? "";
  const docTypeParam = wsParams?.docType as DocType | undefined;
  const directInstanceId = instParams?.docInstanceId ?? "";

  // Data hooks — live fallback to seed
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: liveTemplates } = useDocTemplates();
  const { data: liveBlocks } = useDocBlocks();
  const { data: liveBranding } = useDocBrandingProfiles();

  const activeTemplates = useMemo(
    () => (liveTemplates.length > 0 ? liveTemplates : docTemplates),
    [liveTemplates]
  );
  const activeBlocks = useMemo(
    () => (liveBlocks.length > 0 ? liveBlocks : blockLibrary),
    [liveBlocks]
  );
  const activeBranding = useMemo(
    () => (liveBranding.length > 0 ? liveBranding : brandingProfiles),
    [liveBranding]
  );

  // Instance + editor state
  const [instance, setInstance] = useState<ComposerInstance | null>(null);
  const [localBlocks, setLocalBlocks] = useState<LocalBlock[]>([]);
  const [activeBlockKey, setActiveBlockKey] = useState<string | null>(null);
  const [selectedBrandingId, setSelectedBrandingId] = useState<string>("");
  const [isDirty, setIsDirty] = useState(false);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);

  // Track whether we've set initial editor content for the current block
  const editorInitRef = useRef<string>("");

  // ── TipTap editor ──────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Write here..." }),
    ],
    content: "",
    onUpdate: ({ editor: e }) => {
      if (!activeBlockKey) return;
      const html = e.getHTML();
      setLocalBlocks(prev =>
        prev.map(b => b.block_key === activeBlockKey ? { ...b, content: html } : b)
      );
      setIsDirty(true);
    },
  });

  // Sync editor content when active block changes
  useEffect(() => {
    if (!editor || !activeBlockKey) return;
    const block = localBlocks.find(b => b.block_key === activeBlockKey);
    if (!block) return;
    if (editorInitRef.current === activeBlockKey) return; // already loaded
    editorInitRef.current = activeBlockKey;
    editor.commands.setContent(block.content || "");
  }, [activeBlockKey, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve / create instance ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setResolving(true);
      setResolveError(null);

      try {
        if (directInstanceId) {
          const { data: inst } = await api.docInstances.get(directInstanceId);
          if (cancelled) return;

          const currentVer = (inst.versions ?? [])
            .slice()
            .sort((a: any, b: any) => b.version_number - a.version_number)[0];
          const rawBlocks: InstanceBlock[] = currentVer?.blocks ?? [];

          setInstance({
            id: inst.id,
            doc_type: inst.doc_type,
            customer_name: inst.customer_name ?? "",
            workspace_name: inst.workspace_name ?? null,
            workspace_id: inst.workspace_id ?? null,
            title: inst.title ?? inst.doc_type,
            status: inst.status ?? "draft",
            branding_profile_id: inst.branding_profile_id ?? null,
            current_version_id: inst.current_version_id ?? null,
            is_compiled: inst.is_compiled ?? false,
          });
          const hydrated = hydrateBlocks(rawBlocks, activeBlocks);
          setLocalBlocks(hydrated);
          setSelectedBrandingId(inst.branding_profile_id ?? "");
          if (hydrated.length > 0) {
            setActiveBlockKey(hydrated[0].block_key);
            editorInitRef.current = "";
          }
          return;
        }

        if (!workspaceId || !docTypeParam) return;

        // Check for existing instance for this workspace + docType
        const { data: existingList } = await api.docInstances.list({
          workspace_id: workspaceId,
          doc_type: docTypeParam,
        });
        if (cancelled) return;

        if (existingList && existingList.length > 0) {
          const inst = existingList[0];
          const currentVer = (inst.versions ?? [])
            .slice()
            .sort((a: any, b: any) => b.version_number - a.version_number)[0];
          const rawBlocks: InstanceBlock[] = currentVer?.blocks ?? [];

          setInstance({
            id: inst.id,
            doc_type: inst.doc_type,
            customer_name: inst.customer_name ?? "",
            workspace_name: inst.workspace_name ?? null,
            workspace_id: inst.workspace_id ?? null,
            title: inst.title ?? inst.doc_type,
            status: inst.status ?? "draft",
            branding_profile_id: inst.branding_profile_id ?? null,
            current_version_id: inst.current_version_id ?? null,
            is_compiled: inst.is_compiled ?? false,
          });
          const hydrated = hydrateBlocks(rawBlocks, activeBlocks);
          setLocalBlocks(hydrated);
          setSelectedBrandingId(inst.branding_profile_id ?? "");
          if (hydrated.length > 0) {
            setActiveBlockKey(hydrated[0].block_key);
            editorInitRef.current = "";
          }
          return;
        }

        // Create new instance from published template
        const template = activeTemplates.find(
          t => t.doc_type === docTypeParam && t.status === "published"
        );
        if (!template) throw new Error(`No published template for "${docTypeParam}"`);

        const latestVer = template.versions.reduce(
          (max, v) => v.version_number > max.version_number ? v : max,
          template.versions[0]
        );
        if (!latestVer) throw new Error("Template has no versions");

        const customerName = (workspace as any)?.customerName ??
          (workspace as any)?.customer_name ?? "";
        const workspaceName = (workspace as any)?.name ?? "";

        const varCtx = buildVariableContext({
          customerName,
          workspaceName,
          date: new Date().toISOString().split("T")[0],
        });

        const initialBlocks: InstanceBlock[] = latestVer.recipe.map(r => {
          const def = activeBlocks.find(b => b.block_key === r.block_key);
          const raw = r.default_content_override ?? def?.default_content ?? "";
          return {
            block_key: r.block_key,
            order: r.order,
            content: substituteVariables(raw, varCtx),
            is_locked: false,
            is_ai_generated: false,
            config: { ...(r.config_override ?? {}) } as Record<string, string>,
          };
        });

        const { data: newInst } = await api.docInstances.create({
          doc_type: docTypeParam,
          template_version_id: isUUID(latestVer.id) ? latestVer.id : null,
          customer_id: isUUID((workspace as any)?.customerId ?? "") ? (workspace as any).customerId : null,
          customer_name: customerName,
          workspace_id: isUUID(workspaceId) ? workspaceId : null,
          workspace_name: workspaceName,
          title: `${customerName} — ${DOC_TYPE_CONFIG[docTypeParam]?.label ?? docTypeParam}`,
          branding_profile_id: isUUID(template.default_branding_profile_id) ? template.default_branding_profile_id : null,
          initial_blocks: initialBlocks,
        });
        if (cancelled) return;

        setInstance({
          id: newInst.id,
          doc_type: newInst.doc_type,
          customer_name: newInst.customer_name ?? "",
          workspace_name: newInst.workspace_name ?? null,
          workspace_id: newInst.workspace_id ?? null,
          title: newInst.title ?? newInst.doc_type,
          status: "draft",
          branding_profile_id: newInst.branding_profile_id ?? null,
          current_version_id: newInst.current_version_id ?? null,
          is_compiled: false,
        });
        const hydrated = hydrateBlocks(initialBlocks, activeBlocks);
        setLocalBlocks(hydrated);
        setSelectedBrandingId(template.default_branding_profile_id ?? "");
        if (hydrated.length > 0) {
          setActiveBlockKey(hydrated[0].block_key);
          editorInitRef.current = "";
        }
      } catch (err: any) {
        if (!cancelled) setResolveError(err.message ?? "Failed to load document");
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    // Wait for workspace to load before resolving if we need it
    if (directInstanceId || (workspaceId && (workspace !== undefined || docTypeParam))) {
      resolve();
    } else if (!workspaceId && !directInstanceId) {
      setResolving(false);
      setResolveError("Missing workspace or document instance ID");
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    directInstanceId,
    workspaceId,
    docTypeParam,
    (workspace as any)?.id,
    activeTemplates.length,
    activeBlocks.length,
  ]);

  // ── Save version ───────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!instance) return;
    setIsSaving(true);
    try {
      const blocks = localBlocks.map(b => ({
        block_key: b.block_key,
        order: b.order,
        content: b.content,
        is_locked: b.is_locked,
        is_ai_generated: b.is_ai_generated,
        config: b.config,
      }));
      await api.docInstances.saveVersion(instance.id, blocks);

      // Also persist branding selection if changed
      if (selectedBrandingId && isUUID(selectedBrandingId) &&
          selectedBrandingId !== instance.branding_profile_id) {
        await api.docInstances.update(instance.id, { branding_profile_id: selectedBrandingId });
        setInstance(prev => prev ? { ...prev, branding_profile_id: selectedBrandingId } : prev);
      }

      setIsDirty(false);
      toast.success("Draft saved");
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [instance, localBlocks, selectedBrandingId]);

  // ── Compile PDF ────────────────────────────────────────
  const handleCompile = useCallback(async () => {
    if (!instance) return;
    setIsCompiling(true);

    // Auto-save first
    try {
      const blocks = localBlocks.map(b => ({
        block_key: b.block_key,
        order: b.order,
        content: b.content,
        is_locked: b.is_locked,
        is_ai_generated: b.is_ai_generated,
        config: b.config,
      }));
      await api.docInstances.saveVersion(instance.id, blocks);
    } catch {
      // non-blocking — proceed to compile anyway
    }

    try {
      const { data: compiled } = await api.docInstances.compile(instance.id, {
        branding_profile_id: isUUID(selectedBrandingId) ? selectedBrandingId : null,
        title: instance.title,
        variables: {
          customer_name: instance.customer_name,
          workspace_name: instance.workspace_name ?? "",
        },
      });

      setInstance(prev => prev ? { ...prev, is_compiled: true } : prev);
      setIsDirty(false);

      if (compiled.download_url) {
        const a = document.createElement("a");
        a.href = compiled.download_url;
        a.download = `${instance.customer_name || "document"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success("PDF compiled and downloading");
      } else {
        toast.success("PDF compiled successfully");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Compile failed");
    } finally {
      setIsCompiling(false);
    }
  }, [instance, localBlocks, selectedBrandingId]);

  // ── Navigate to OutputStudio ───────────────────────────
  const handlePreview = useCallback(() => {
    if (!instance) return;
    const wsParam = workspaceId ? `?from=workspace&workspaceId=${workspaceId}` : "";
    navigate(`/composer/${instance.id}/view${wsParam}`);
  }, [instance, workspaceId, navigate]);

  // ── Back navigation ────────────────────────────────────
  const backUrl = workspaceId ? `/workspaces/${workspaceId}?tab=documents` : "/documents";
  const backLabel = workspaceId ? "Back to Workspace" : "Back to Documents";

  // ── Active block def ───────────────────────────────────
  const activeBlock = useMemo(
    () => localBlocks.find(b => b.block_key === activeBlockKey) ?? null,
    [localBlocks, activeBlockKey]
  );

  // ── Variable health ────────────────────────────────────
  const variableHealth = useMemo(() => {
    const allContent = localBlocks.map(b => b.content).join(" ");
    const missing = extractVariableKeys(allContent).filter(k => k.length > 0);
    return { missing, hasUnresolved: missing.length > 0 };
  }, [localBlocks]);

  // ─── Loading ───────────────────────────────────────────
  if (resolving) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1B2A4A]/40 mx-auto" />
          <p className="text-sm text-gray-400">Preparing document composer...</p>
        </div>
      </div>
    );
  }

  if (resolveError || !instance) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
          <p className="text-sm font-medium text-gray-700">
            {resolveError ?? "Document not found"}
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(backUrl)}>
            <ArrowLeft size={14} className="mr-1.5" /> {backLabel}
          </Button>
        </div>
      </div>
    );
  }

  const docTypeConfig = DOC_TYPE_CONFIG[instance.doc_type];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-white">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" className="text-xs h-7 shrink-0" onClick={() => navigate(backUrl)}>
            <ArrowLeft size={13} className="mr-1" /> {backLabel}
          </Button>
          <div className="h-4 w-px bg-gray-200 shrink-0" />
          <Badge className="bg-[#1B2A4A]/10 text-[#1B2A4A] border-0 text-[10px] shrink-0">
            {docTypeConfig?.label ?? instance.doc_type}
          </Badge>
          <span className="text-sm font-semibold text-[#1B2A4A] truncate">{instance.customer_name}</span>
          {instance.workspace_name && (
            <span className="text-xs text-gray-400 truncate hidden md:block">— {instance.workspace_name}</span>
          )}
          {isDirty && (
            <span className="text-[10px] text-amber-600 font-medium shrink-0">● Unsaved</span>
          )}
          {instance.status === "canon" && (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] shrink-0">
              <Lock size={9} className="mr-1" /> Canon
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {variableHealth.hasUnresolved && (
            <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px] hidden sm:flex">
              <AlertTriangle size={9} className="mr-1" />
              {variableHealth.missing.length} unresolved
            </Badge>
          )}
          <Button
            variant="outline" size="sm" className="text-xs h-7"
            onClick={handleSave} disabled={isSaving || !isDirty}
          >
            {isSaving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
            Save
          </Button>
          <Button
            variant="outline" size="sm" className="text-xs h-7"
            onClick={handlePreview} disabled={!instance}
          >
            <Eye size={12} className="mr-1" /> Preview
          </Button>
          <Button
            size="sm" className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs h-7"
            onClick={handleCompile} disabled={isCompiling}
          >
            {isCompiling
              ? <><Loader2 size={12} className="animate-spin mr-1" /> Compiling...</>
              : <><FileDown size={12} className="mr-1" /> Compile PDF</>}
          </Button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Block list */}
        <div className="w-56 shrink-0 border-r border-gray-200 overflow-y-auto bg-gray-50/40">
          <div className="p-2 space-y-0.5">
            <p className="text-[9px] text-gray-400 uppercase font-semibold px-2 pt-1 pb-1.5 tracking-wider">
              Blocks ({localBlocks.length})
            </p>
            {localBlocks.length === 0 ? (
              <div className="text-center py-6 px-2">
                <p className="text-[11px] text-gray-400">No blocks in this template</p>
              </div>
            ) : (
              localBlocks.map(block => (
                <BlockRow
                  key={block.block_key}
                  block={block}
                  active={block.block_key === activeBlockKey}
                  onClick={() => {
                    editorInitRef.current = ""; // force editor reload
                    setActiveBlockKey(block.block_key);
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Center — Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeBlock ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-400">Select a block to edit</p>
              </div>
            </div>
          ) : (
            <>
              {/* Block header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1B2A4A]">{activeBlock.display_name}</span>
                  <Badge variant="outline" className="text-[9px] h-4 border-gray-200 text-gray-500">
                    {activeBlock.editor_mode}
                  </Badge>
                  {activeBlock.family && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 ${BLOCK_FAMILY_CONFIG[activeBlock.family as keyof typeof BLOCK_FAMILY_CONFIG]?.color ?? "text-gray-500"} ${BLOCK_FAMILY_CONFIG[activeBlock.family as keyof typeof BLOCK_FAMILY_CONFIG]?.bg ?? ""} border-0`}
                    >
                      {activeBlock.family}
                    </Badge>
                  )}
                </div>
                {activeBlock.is_locked && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    <Lock size={9} className="mr-1" /> Locked
                  </Badge>
                )}
              </div>

              {/* Editor area */}
              <div className="flex-1 overflow-y-auto">
                {activeBlock.editor_mode === "readonly" ? (
                  <div className="p-6">
                    <div
                      className="prose prose-sm max-w-none text-gray-600 text-[12px] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: activeBlock.content }}
                    />
                    <p className="text-[10px] text-gray-400 mt-4 italic">
                      This block is auto-bound to live data and cannot be edited.
                    </p>
                  </div>
                ) : activeBlock.is_locked ? (
                  <div className="p-6">
                    <div
                      className="prose prose-sm max-w-none text-gray-700 text-[12px] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: activeBlock.content }}
                    />
                    <p className="text-[10px] text-amber-600 mt-4 italic">
                      This block is locked and cannot be edited in the current status.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <EditorToolbar editor={editor} />
                    <div className="flex-1 overflow-y-auto">
                      <EditorContent
                        editor={editor}
                        className="h-full [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-6 [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h2]:text-base [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-[#1B2A4A] [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-4 [&_.ProseMirror_li]:mb-1 [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right — Metadata panel */}
        <div className="w-56 shrink-0 border-l border-gray-200 overflow-y-auto bg-gray-50/40">
          <div className="p-3 space-y-4">

            {/* Document info */}
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-2">Document</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-700">{docTypeConfig?.label ?? instance.doc_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium text-gray-700 truncate max-w-[100px]">{instance.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge className={`text-[9px] h-4 ${instance.status === "canon" ? "bg-[#1B2A4A]/10 text-[#1B2A4A]" : "bg-gray-100 text-gray-600"} border-0`}>
                    {instance.status}
                  </Badge>
                </div>
                {instance.is_compiled && (
                  <div className="flex items-center gap-1 text-emerald-700">
                    <CheckCircle size={10} />
                    <span className="text-[10px]">PDF compiled</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200" />

            {/* Branding */}
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-2">Branding</p>
              <Select
                value={selectedBrandingId || "__none__"}
                onValueChange={v => {
                  setSelectedBrandingId(v === "__none__" ? "" : v);
                  setIsDirty(true);
                }}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Default</SelectItem>
                  {activeBranding.map(bp => (
                    <SelectItem key={bp.id} value={bp.id}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full border border-gray-300"
                             style={{ backgroundColor: bp.primary_color }} />
                        <span className="text-[11px]">{bp.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-gray-200" />

            {/* Variable health */}
            <div>
              <p className="text-[9px] text-gray-400 uppercase font-semibold tracking-wider mb-2">Variables</p>
              {variableHealth.hasUnresolved ? (
                <div className="space-y-1">
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={9} /> {variableHealth.missing.length} unresolved
                  </p>
                  {variableHealth.missing.slice(0, 5).map(k => (
                    <div key={k} className="text-[9px] font-mono text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 truncate">
                      {`{{${k}}}`}
                    </div>
                  ))}
                  {variableHealth.missing.length > 5 && (
                    <p className="text-[9px] text-gray-400">+{variableHealth.missing.length - 5} more</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle size={10} />
                  <span className="text-[10px]">All resolved</span>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200" />

            {/* Quick actions */}
            <div className="space-y-1.5">
              <Button
                variant="outline" size="sm"
                className="w-full text-[11px] h-7 justify-start"
                onClick={handleSave} disabled={isSaving || !isDirty}
              >
                {isSaving
                  ? <Loader2 size={11} className="animate-spin mr-1.5" />
                  : <Save size={11} className="mr-1.5" />}
                Save draft
              </Button>
              <Button
                variant="outline" size="sm"
                className="w-full text-[11px] h-7 justify-start"
                onClick={handlePreview}
              >
                <Eye size={11} className="mr-1.5" /> Preview
              </Button>
              <Button
                size="sm"
                className="w-full text-[11px] h-7 justify-start bg-[#1B2A4A] hover:bg-[#2A3F6A]"
                onClick={handleCompile} disabled={isCompiling}
              >
                {isCompiling
                  ? <Loader2 size={11} className="animate-spin mr-1.5" />
                  : <FileDown size={11} className="mr-1.5" />}
                {isCompiling ? "Compiling…" : "Compile PDF"}
              </Button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
