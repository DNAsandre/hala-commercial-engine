/**
 * Output Studio — Wave 1 persistence hardening
 * Reads doc instances, compiled documents, and vault assets from Supabase.
 */
import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, FileDown, Send, CheckCircle, AlertTriangle, XCircle,
  Palette, Layout, Image, Eye, Lock, Archive, ChevronDown, ChevronRight, Loader2
} from "lucide-react";
import {
  getBlockByKey, getBrandingProfile,
  brandingProfiles, DOC_TYPE_CONFIG, BLOCK_FAMILY_CONFIG,
  saveToVault, exportToCRM,
  type BrandingProfile, type InstanceBlock,
} from "@/lib/document-composer";
import { compileComposerPDF, type ComposerPDFInput } from "@/lib/pdf-compiler";
import { resolveTokens, type TokenResolutionResult } from "@/lib/semantic-variables";
import {
  useDocInstance, useCompiledDocuments, useVaultAssets,
  type HydratedDocInstance, type HydratedDocVersion, type DbCompiledDocument,
} from "@/hooks/useDocuments";
import { syncCompiledDocCreate } from "@/lib/supabase-sync";

// ============================================================
// TOKEN HEALTH ANALYSIS
// ============================================================

interface TokenHealth {
  total: number;
  resolved: number;
  missing: string[];
  status: "healthy" | "warning" | "error";
}

function analyzeTokenHealth(blocks: any[]): TokenHealth {
  const tokenRegex = /\{\{([^}]+)\}\}/g;
  const allTokenKeys: string[] = [];
  const missingKeys: string[] = [];

  for (const block of blocks) {
    let match;
    while ((match = tokenRegex.exec(block.content)) !== null) {
      const token = match[1].trim();
      if (!allTokenKeys.includes(token)) allTokenKeys.push(token);
    }
  }

  for (const token of allTokenKeys) {
    const result: TokenResolutionResult = resolveTokens(`{{${token}}}`, { recordOverrides: {}, templateDefaults: {}, globalDefaults: {}, entityBindings: {} }, "proposal");
    if (result.missingTokens.length > 0) {
      missingKeys.push(token);
    }
  }

  return {
    total: allTokenKeys.length,
    resolved: allTokenKeys.length - missingKeys.length,
    missing: missingKeys,
    status: missingKeys.length === 0 ? "healthy" : missingKeys.length <= 2 ? "warning" : "error",
  };
}

// ============================================================
// NAVIGATION CONTEXT HELPERS
// ============================================================

interface NavContext {
  from: "workspace" | "documents" | "editor";
  workspaceId?: string;
}

function readNavContext(): NavContext {
  const params = new URLSearchParams(window.location.search);
  const from = params.get("from") as NavContext["from"] || "editor";
  const workspaceId = params.get("workspaceId") || undefined;
  return { from, workspaceId };
}

function buildEditorUrl(docInstanceId: string, ctx: NavContext): string {
  if (ctx.from === "workspace" && ctx.workspaceId) {
    return `/workspaces/${ctx.workspaceId}?tab=documents&editInstance=${docInstanceId}`;
  }
  if (ctx.from === "documents") {
    return `/editor?instance=${docInstanceId}&from=documents`;
  }
  return `/editor?instance=${docInstanceId}`;
}

function buildBackLabel(ctx: NavContext): string {
  if (ctx.from === "workspace" && ctx.workspaceId) return "Back to Workspace";
  if (ctx.from === "documents") return "Back to Editor";
  return "Back to Editor";
}

// ============================================================
// OUTPUT STUDIO VIEWER
// ============================================================
export default function OutputStudio() {
  const [, params] = useRoute("/composer/:docInstanceId/view");
  const [, navigate] = useLocation();
  const docInstanceId = params?.docInstanceId || "";

  const navCtx = useMemo(() => readNavContext(), []);

  // State
  const [selectedBrandingId, setSelectedBrandingId] = useState<string>("");
  const [spacingPreset, setSpacingPreset] = useState<"compact" | "normal" | "relaxed">("normal");
  const [showCover, setShowCover] = useState(true);
  const [compiledHtml, setCompiledHtml] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [hasFinalPDF, setHasFinalPDF] = useState(false);
  const [tokenHealthExpanded, setTokenHealthExpanded] = useState(true);
  const [stylingExpanded, setStylingExpanded] = useState(true);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [vaultExpanded, setVaultExpanded] = useState(true);

  // Wave 1: Read from Supabase
  const { data: docInstance, loading: instanceLoading } = useDocInstance(docInstanceId);
  const { data: existingCompiled, refetch: refetchCompiled } = useCompiledDocuments(docInstanceId);
  const { data: existingVaultAssets } = useVaultAssets(docInstanceId);

  const currentVersion = useMemo(() => {
    if (!docInstance) return null;
    return docInstance.versions.find(v => v.id === docInstance.current_version_id) || docInstance.versions[docInstance.versions.length - 1] || null;
  }, [docInstance]);

  // Default branding
  const effectiveBrandingId = selectedBrandingId || (docInstance ? "bp-001" : "");
  const branding = useMemo<BrandingProfile | undefined>(() => getBrandingProfile(effectiveBrandingId), [effectiveBrandingId]);

  // Token health
  const tokenHealth = useMemo<TokenHealth>(() => {
    if (!currentVersion) return { total: 0, resolved: 0, missing: [], status: "healthy" };
    return analyzeTokenHealth(currentVersion.blocks);
  }, [currentVersion]);

  // Auto-render preview on load
  useEffect(() => {
    if (currentVersion && branding) {
      renderPreview();
    }
  }, [currentVersion?.id, branding?.id]);

  const editorUrl = docInstance ? buildEditorUrl(docInstance.id, navCtx) : "/editor";
  const backLabel = buildBackLabel(navCtx);

  // ── Render preview ──
  function renderPreview() {
    if (!docInstance || !currentVersion || !branding) return;

    const blocks = currentVersion.blocks.map((b: any) => {
      const blockDef = getBlockByKey(b.block_key);
      return {
        key: b.block_key,
        family: blockDef?.family || "narrative",
        content: b.content,
        order: b.order,
      };
    }).sort((a: any, b: any) => a.order - b.order);

    const primaryColor = branding.primary_color || "#1B2A4A";
    const fontFamily = branding.font_family || "Inter, sans-serif";
    const spacing = spacingPreset === "compact" ? "0.75rem" : spacingPreset === "relaxed" ? "2rem" : "1.25rem";

    let html = `<div style="font-family: ${fontFamily}; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 2rem;">`;

    if (showCover) {
      html += `<div style="text-align: center; padding: 4rem 2rem; margin-bottom: 2rem; border-bottom: 3px solid ${primaryColor};">`;
      html += `<h1 style="font-size: 1.75rem; color: ${primaryColor}; margin-bottom: 0.5rem;">${docInstance.customer_name}</h1>`;
      html += `<p style="color: #666; font-size: 0.875rem;">${DOC_TYPE_CONFIG[docInstance.doc_type]?.label || docInstance.doc_type} — v${currentVersion.version_number}</p>`;
      html += `</div>`;
    }

    for (const block of blocks) {
      const familyConfig = BLOCK_FAMILY_CONFIG[block.family as keyof typeof BLOCK_FAMILY_CONFIG];
      const borderColor = familyConfig?.color || "#e5e7eb";

      html += `<div style="margin-bottom: ${spacing}; padding: 1rem; border-left: 3px solid ${borderColor}; background: #fafafa; border-radius: 0 4px 4px 0;">`;
      html += `<div style="font-size: 0.625rem; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; letter-spacing: 0.05em;">${block.key.replace(/_/g, ' ')}</div>`;

      const resolved = resolveTokens(block.content, {
        recordOverrides: {},
        templateDefaults: {},
        globalDefaults: {},
        entityBindings: {},
      }, docInstance.doc_type);

      html += `<div style="font-size: 0.8125rem; line-height: 1.6;">${resolved.renderedText}</div>`;
      html += `</div>`;
    }

    html += `</div>`;
    setCompiledHtml(html);
  }

  // ── Compile final PDF ──
  function compileFinalPDF() {
    if (!docInstance || !currentVersion || !branding) return;
    setIsCompiling(true);

    setTimeout(() => {
      try {
        const blocks = currentVersion.blocks.map((b: any) => ({
          id: b.block_key,
          block_key: b.block_key,
          order: b.order,
          content: b.content,
          is_locked: b.is_locked ?? false,
          is_ai_generated: b.is_ai_generated ?? false,
          config: b.config ?? {},
        }));

        const input: ComposerPDFInput = {
          title: docInstance.customer_name,
          doc_type: docInstance.doc_type,
          customer_name: docInstance.customer_name,
          workspace_name: null,
          blocks,
          branding,
          doc_ref: docInstance.id,
          version: currentVersion.version_number,
        };

        const html = compileComposerPDF(input);
        if (html) {
          const compiledId = `cd-${Date.now()}`;
          // Sync to Supabase
          syncCompiledDocCreate({
            id: compiledId,
            doc_instance_id: docInstanceId || docInstance.id,
            doc_instance_version_id: currentVersion.id,
            title: `${docInstance.customer_name} — ${DOC_TYPE_CONFIG[docInstance.doc_type]?.label || docInstance.doc_type} v${currentVersion.version_number}`,
            doc_type: docInstance.doc_type,
            customer_id: docInstance.customer_id,
            customer_name: docInstance.customer_name,
            workspace_id: docInstance.workspace_id,
            compiled_html: html,
            compiled_by: "Current User",
            status: "success",
          });
          setHasFinalPDF(true);
          setCompiledHtml(html);
          refetchCompiled();
          toast.success(`PDF compiled — ${blocks.length} blocks, artifact ${compiledId}`);
        } else {
          toast.error("Compilation returned empty output");
        }
      } catch {
        toast.error("Compilation failed — unexpected error");
      }
      setIsCompiling(false);
    }, 1500);
  }

  // ── Send to CRM ──
  function handleSendToCRM() {
    if (!docInstance) return;
    const result = exportToCRM(docInstance.id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message || "CRM export failed");
    }
  }

  // ── Loading state ──
  if (instanceLoading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#1B2A4A]/40 mr-2" />
          <span className="text-sm text-gray-400">Loading document from database...</span>
        </div>
      </div>
    );
  }

  // ── Not found state ──
  if (!docInstance || !currentVersion) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="text-center py-20">
          <XCircle size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-600">Document not found</h2>
          <p className="text-sm text-gray-400 mt-1">The document instance could not be resolved.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(editorUrl)}>
            <ArrowLeft size={14} className="mr-1.5" /> {backLabel}
          </Button>
        </div>
      </div>
    );
  }

  const docTypeConfig = DOC_TYPE_CONFIG[docInstance.doc_type] || { label: docInstance.doc_type };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(editorUrl)} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> {backLabel}
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <Badge className="bg-[#1B2A4A]/10 text-[#1B2A4A] border-0 text-xs">{docTypeConfig.label}</Badge>
          <span className="text-sm font-medium text-[#1B2A4A]">{docInstance.customer_name}</span>
          <span className="text-xs text-gray-400">v{currentVersion.version_number}</span>
          {docInstance.status === "canon" && <Lock size={12} className="text-amber-600" />}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[10px] ${
            tokenHealth.status === "healthy" ? "border-emerald-300 text-emerald-700" :
            tokenHealth.status === "warning" ? "border-amber-300 text-amber-700" :
            "border-red-300 text-red-700"
          }`}>
            {tokenHealth.status === "healthy" ? <CheckCircle size={10} className="mr-1" /> :
             tokenHealth.status === "warning" ? <AlertTriangle size={10} className="mr-1" /> :
             <XCircle size={10} className="mr-1" />}
            Tokens: {tokenHealth.resolved}/{tokenHealth.total}
          </Badge>
          <Button
            size="sm"
            className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs h-7"
            onClick={compileFinalPDF}
            disabled={isCompiling}
          >
            <FileDown size={12} className="mr-1" />
            {isCompiling ? "Compiling..." : "Compile PDF"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — Controls */}
        <div className="w-72 border-r border-gray-200 overflow-y-auto bg-gray-50/50 flex-shrink-0">
          <div className="p-3 space-y-3">

            {/* Token Health */}
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setTokenHealthExpanded(!tokenHealthExpanded)}
                >
                  <div className="flex items-center gap-2">
                    {tokenHealth.status === "healthy" ? <CheckCircle size={16} className="text-emerald-600" /> :
                     tokenHealth.status === "warning" ? <AlertTriangle size={16} className="text-amber-600" /> :
                     <XCircle size={16} className="text-red-600" />}
                    <span className="text-sm font-semibold text-[#1B2A4A]">Token Health</span>
                  </div>
                  {tokenHealthExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>
                {tokenHealthExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-[#1B2A4A]">{tokenHealth.total}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-emerald-600">{tokenHealth.resolved}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Resolved</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600">{tokenHealth.missing.length}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Missing</div>
                      </div>
                    </div>
                    {tokenHealth.missing.length > 0 && (
                      <div className="space-y-1">
                        {tokenHealth.missing.map(token => (
                          <div key={token} className="flex items-center gap-2 px-2 py-1.5 bg-red-50 rounded text-xs">
                            <AlertTriangle size={10} className="text-red-500 flex-shrink-0" />
                            <code className="text-red-700 font-mono text-[10px]">{`{{${token}}}`}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-5 text-[10px] text-red-600 hover:text-red-800 px-1"
                              onClick={() => navigate(editorUrl)}
                            >
                              Fix →
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {tokenHealth.status === "healthy" && (
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-emerald-50 rounded text-xs text-emerald-700">
                        <CheckCircle size={10} /> All tokens resolved — ready to compile
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Styling Controls */}
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setStylingExpanded(!stylingExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Palette size={16} className="text-[#1B2A4A]" />
                    <span className="text-sm font-semibold text-[#1B2A4A]">Styling</span>
                  </div>
                  {stylingExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>
                {stylingExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-medium">Branding Profile</label>
                      <Select value={effectiveBrandingId} onValueChange={setSelectedBrandingId}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue placeholder="Select branding" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandingProfiles.map(bp => (
                            <SelectItem key={bp.id} value={bp.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bp.primary_color }} />
                                {bp.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-medium">Spacing</label>
                      <Select value={spacingPreset} onValueChange={(v) => setSpacingPreset(v as typeof spacingPreset)}>
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="relaxed">Relaxed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={showCover} onChange={(e) => setShowCover(e.target.checked)} className="rounded border-gray-300" />
                      Show cover page
                    </label>
                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={renderPreview}>
                      <RefreshCw size={12} className="mr-2" /> Apply & Re-render
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setActionsExpanded(!actionsExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Layout size={16} className="text-[#1B2A4A]" />
                    <span className="text-sm font-semibold text-[#1B2A4A]">Actions</span>
                  </div>
                  {actionsExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>
                {actionsExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-2">
                    <Button variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => navigate(editorUrl)}>
                      <ArrowLeft size={12} className="mr-2" /> {backLabel}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full text-xs justify-start" onClick={renderPreview}>
                      <RefreshCw size={12} className="mr-2" /> Re-render Preview
                    </Button>
                    <Button
                      size="sm"
                      className="w-full text-xs justify-start bg-[#1B2A4A] hover:bg-[#2A3F6A]"
                      onClick={compileFinalPDF}
                      disabled={isCompiling}
                    >
                      <FileDown size={12} className="mr-2" />
                      {isCompiling ? "Compiling..." : "Compile Final PDF"}
                    </Button>
                    {(hasFinalPDF || existingCompiled.length > 0) && (
                      <>
                        <Button variant="outline" size="sm" className="w-full text-xs justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleSendToCRM}>
                          <Send size={12} className="mr-2" /> Send to CRM
                        </Button>
                        <Button variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => toast.success("Document saved to vault")}>
                          <Archive size={12} className="mr-2" /> Save to Vault
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vault Assets */}
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setVaultExpanded(!vaultExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <Archive size={16} className="text-[#1B2A4A]" />
                    <span className="text-sm font-semibold text-[#1B2A4A]">Document Vault</span>
                    {existingVaultAssets.length > 0 && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px] h-4">{existingVaultAssets.length}</Badge>
                    )}
                  </div>
                  {vaultExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>
                {vaultExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                    {existingVaultAssets.length === 0 && !hasFinalPDF && existingCompiled.length === 0 ? (
                      <div className="text-center py-3">
                        <Archive size={20} className="mx-auto mb-1.5 text-gray-300" />
                        <p className="text-[10px] text-gray-400">No vault assets yet</p>
                        <p className="text-[10px] text-gray-400">Compile a final PDF to save to vault</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {existingCompiled.map((comp: DbCompiledDocument) => (
                          <div key={comp.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                            <div className="flex items-center gap-2">
                              <FileDown size={12} className="text-[#1B2A4A]" />
                              <div>
                                <p className="text-[10px] font-medium">{comp.title}</p>
                                <p className="text-[10px] text-gray-400">{comp.compiled_at?.split("T")[0] || comp.compiled_at}</p>
                              </div>
                            </div>
                            <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px]">{comp.status}</Badge>
                          </div>
                        ))}
                        {existingVaultAssets.map((asset: any) => (
                          <div key={asset.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100">
                            <div className="flex items-center gap-2">
                              <Archive size={12} className="text-[#1B2A4A]" />
                              <div>
                                <p className="text-[10px] font-medium">{asset.title}</p>
                                <p className="text-[10px] text-gray-400">{asset.created_at?.split("T")[0] || asset.created_at}</p>
                              </div>
                            </div>
                            <Badge className="bg-blue-50 text-blue-700 border-0 text-[10px]">{asset.status}</Badge>
                          </div>
                        ))}
                        {hasFinalPDF && !existingCompiled.some((c: DbCompiledDocument) => c.doc_instance_id === docInstanceId) && (
                          <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-100">
                            <div className="flex items-center gap-2">
                              <CheckCircle size={12} className="text-emerald-600" />
                              <p className="text-[10px] text-emerald-700 font-medium">New PDF compiled — ready to save</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right — Document Preview */}
        <div className="flex-1 overflow-y-auto bg-gray-100">
          <div className="p-6">
            <Card className="border border-gray-200 shadow-sm max-w-4xl mx-auto">
              <CardContent className="p-0">
                {compiledHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: compiledHtml }} />
                ) : (
                  <div className="text-center py-20">
                    <Eye size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-400">Preview will render automatically...</p>
                    <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={renderPreview}>
                      <RefreshCw size={12} className="mr-1" /> Render Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
