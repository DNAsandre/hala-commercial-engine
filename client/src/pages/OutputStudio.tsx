import { useState, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, FileDown, Send, CheckCircle, AlertTriangle, XCircle,
  Palette, Layout, Image, Eye, Lock, Archive, ChevronDown, ChevronRight
} from "lucide-react";
import {
  getDocInstance, getCurrentVersion, getBlockByKey, getBrandingProfile,
  brandingProfiles, compiledDocuments, DOC_TYPE_CONFIG, BLOCK_FAMILY_CONFIG,
  saveToVault, exportToCRM, vaultAssets,
  type DocInstance, type DocInstanceVersion, type BrandingProfile, type CompiledDocument, type InstanceBlock,
} from "@/lib/document-composer";
import { compileComposerPDF, type ComposerPDFInput } from "@/lib/pdf-compiler";
import { resolveTokens, type TokenResolutionResult } from "@/lib/semantic-variables";

// ============================================================
// TOKEN HEALTH ANALYSIS
// ============================================================

interface TokenHealth {
  total: number;
  resolved: number;
  missing: string[];
  status: "healthy" | "warning" | "error";
}

function analyzeTokenHealth(blocks: InstanceBlock[]): TokenHealth {
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

  // Try to resolve each token
  for (const token of allTokenKeys) {
    const result: TokenResolutionResult = resolveTokens(`{{${token}}}`, { recordOverrides: {}, templateDefaults: {}, globalDefaults: {}, entityBindings: {} }, "proposal");
    if (result.missingTokens.length > 0) {
      missingKeys.push(token);
    }
  }

  const total = allTokenKeys.length;
  const resolvedCount = total - missingKeys.length;

  return {
    total,
    resolved: resolvedCount,
    missing: missingKeys,
    status: missingKeys.length === 0 ? "healthy" : missingKeys.length <= 2 ? "warning" : "error",
  };
}

// ============================================================
// OUTPUT STUDIO VIEWER
// ============================================================

export default function OutputStudio() {
  const [, params] = useRoute("/composer/:docInstanceId/view");
  const [, navigate] = useLocation();
  const docInstanceId = params?.docInstanceId || "";

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

  // Resolve document instance
  const docInstance = useMemo<DocInstance | undefined>(() => getDocInstance(docInstanceId), [docInstanceId]);
  const currentVersion = useMemo<DocInstanceVersion | null>(() => docInstance ? getCurrentVersion(docInstance) : null, [docInstance]);

  // Default branding
  const effectiveBrandingId = selectedBrandingId || (docInstance ? "bp-001" : "");
  const branding = useMemo<BrandingProfile | undefined>(() => getBrandingProfile(effectiveBrandingId), [effectiveBrandingId]);

  // Token health
  const tokenHealth = useMemo<TokenHealth>(() => {
    if (!currentVersion) return { total: 0, resolved: 0, missing: [], status: "healthy" };
    return analyzeTokenHealth(currentVersion.blocks);
  }, [currentVersion]);

  // Check for existing compiled documents
  const existingCompiled = useMemo<CompiledDocument[]>(() => {
    return compiledDocuments.filter(cd => cd.doc_instance_id === docInstanceId);
  }, [docInstanceId]);

  // Check vault assets
  const existingVaultAssets = useMemo(() => {
    return vaultAssets.filter(va => va.doc_instance_id === docInstanceId);
  }, [docInstanceId]);

  // Render preview
  const renderPreview = useCallback(() => {
    if (!currentVersion || !branding || !docInstance) return;

    const spacingMap = { compact: "16px", normal: "24px", relaxed: "36px" };
    const spacing = spacingMap[spacingPreset];

    const input: ComposerPDFInput = {
      branding,
      blocks: currentVersion.blocks.map((b, idx) => ({
        id: `blk-${idx}`,
        block_key: b.block_key,
        content: b.content,
        order: b.order,
        is_locked: b.is_locked,
        is_ai_generated: b.is_ai_generated,
        config: b.config,
      })),
      doc_ref: `${DOC_TYPE_CONFIG[docInstance.doc_type].label} — ${docInstance.customer_name}`,
      customer_name: docInstance.customer_name,
      title: `${DOC_TYPE_CONFIG[docInstance.doc_type].label}`,
      doc_type: docInstance.doc_type,
      workspace_name: docInstance.workspace_name,
      version: currentVersion.version_number,
    };

    const html = compileComposerPDF(input);
    // Inject spacing override
    const styledHtml = html.replace(
      "margin-bottom:20px;",
      `margin-bottom:${spacing};`
    );
    setCompiledHtml(styledHtml);
  }, [currentVersion, branding, docInstance, spacingPreset]);

  // Auto-render on mount
  useMemo(() => {
    if (currentVersion && branding && docInstance && !compiledHtml) {
      renderPreview();
    }
  }, [currentVersion, branding, docInstance, compiledHtml, renderPreview]);

  // Compile final PDF
  const compileFinalPDF = useCallback(() => {
    if (!docInstance || !currentVersion || !branding) return;
    setIsCompiling(true);

    setTimeout(() => {
      // Create compiled document record
      const compiled: CompiledDocument = {
        id: `cd-${Date.now()}`,
        doc_instance_version_id: currentVersion.id,
        output_type: "pdf",
        file_asset_id: `fa-${docInstance.id}-final`,
        checksum: `sha256:${Math.random().toString(36).substring(2, 14)}`,
        compiled_at: new Date().toISOString(),
        compiled_by: "Amin Al-Rashid",
        status: "success",
        error_text: null,
        branding_profile_id: effectiveBrandingId,
        doc_instance_id: docInstance.id,
        title: `${docInstance.customer_name} ${DOC_TYPE_CONFIG[docInstance.doc_type].label}`,
      };
      compiledDocuments.push(compiled);

      // Save to vault
      saveToVault({
        doc_instance_id: docInstance.id,
        doc_instance_version_id: currentVersion.id,
        compiled_document_id: compiled.id,
        title: compiled.title,
        doc_type: docInstance.doc_type,
        customer_id: docInstance.customer_id,
        customer_name: docInstance.customer_name,
        workspace_id: docInstance.workspace_id,
        workspace_name: docInstance.workspace_name,
        branding_profile_id: effectiveBrandingId,
        status: "final",
      });

      setHasFinalPDF(true);
      setIsCompiling(false);
      toast.success("Final PDF compiled and saved to Document Vault");
    }, 1500);
  }, [docInstance, currentVersion, branding, effectiveBrandingId]);

  // Send to CRM
  const handleSendToCRM = useCallback(() => {
    const finalAsset = vaultAssets.find(va => va.doc_instance_id === docInstanceId && va.status === "final");
    if (!finalAsset) {
      toast.error("No final PDF found — compile first");
      return;
    }
    const result = exportToCRM(finalAsset.id);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }, [docInstanceId]);

  // Not found
  if (!docInstance || !currentVersion) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="text-center py-20">
          <XCircle size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-600">Document not found</h2>
          <p className="text-sm text-gray-400 mt-1">The document instance could not be resolved.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/editor")}>
            <ArrowLeft size={14} className="mr-1.5" /> Back to Composer
          </Button>
        </div>
      </div>
    );
  }

  const docTypeConfig = DOC_TYPE_CONFIG[docInstance.doc_type];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/editor?instance=${docInstance.id}`)} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to Editor
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <Badge className="bg-[#1B2A4A]/10 text-[#1B2A4A] border-0 text-xs">{docTypeConfig.label}</Badge>
          <span className="text-sm font-medium text-[#1B2A4A]">{docInstance.customer_name}</span>
          <span className="text-xs text-gray-400">v{currentVersion.version_number}</span>
          {docInstance.status === "canon" && <Lock size={12} className="text-amber-600" />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={renderPreview}>
            <RefreshCw size={12} className="mr-1" /> Re-render
          </Button>
          <Button
            size="sm"
            className="text-xs bg-[#1B2A4A] hover:bg-[#2A3F6A]"
            onClick={compileFinalPDF}
            disabled={isCompiling}
          >
            <FileDown size={12} className="mr-1" />
            {isCompiling ? "Compiling..." : "Compile Final PDF"}
          </Button>
          {(hasFinalPDF || existingCompiled.length > 0) && (
            <Button variant="outline" size="sm" className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleSendToCRM}>
              <Send size={12} className="mr-1" /> Send to CRM
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Preview */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div className="max-w-[850px] mx-auto">
            {compiledHtml ? (
              <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                <iframe
                  srcDoc={compiledHtml}
                  className="w-full border-0"
                  style={{ minHeight: "1200px", height: "100%" }}
                  title="Document Preview"
                />
              </div>
            ) : (
              <div className="bg-white shadow-lg rounded-lg p-12 text-center">
                <Eye size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-600">No preview generated</h3>
                <p className="text-sm text-gray-400 mt-1">Click "Re-render" to generate a preview of this document.</p>
                <Button className="mt-4 bg-[#1B2A4A] hover:bg-[#2A3F6A]" onClick={renderPreview}>
                  <RefreshCw size={14} className="mr-1.5" /> Generate Preview
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Panels */}
        <div className="w-[340px] border-l border-gray-200 bg-white overflow-auto">
          <div className="p-4 space-y-3">
            {/* Token Health */}
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-0">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setTokenHealthExpanded(!tokenHealthExpanded)}
                >
                  <div className="flex items-center gap-2">
                    {tokenHealth.status === "healthy" ? (
                      <CheckCircle size={16} className="text-emerald-600" />
                    ) : tokenHealth.status === "warning" ? (
                      <AlertTriangle size={16} className="text-amber-600" />
                    ) : (
                      <XCircle size={16} className="text-red-600" />
                    )}
                    <span className="text-sm font-semibold text-[#1B2A4A]">Token Health</span>
                  </div>
                  {tokenHealthExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>
                {tokenHealthExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-[#1B2A4A]">{tokenHealth.total}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-600">{tokenHealth.resolved}</div>
                        <div className="text-[10px] text-gray-500 uppercase">Resolved</div>
                      </div>
                      <div className="text-center">
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
                              onClick={() => navigate(`/editor?instance=${docInstance.id}`)}
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
                    <span className="text-sm font-semibold text-[#1B2A4A]">Styling Controls</span>
                  </div>
                  {stylingExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                </button>
                {stylingExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-3">
                    {/* Branding Profile */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Branding Profile</label>
                      <Select value={effectiveBrandingId} onValueChange={setSelectedBrandingId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select branding..." />
                        </SelectTrigger>
                        <SelectContent>
                          {brandingProfiles.map(bp => (
                            <SelectItem key={bp.id} value={bp.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ background: bp.primary_color }} />
                                {bp.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Spacing Preset */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Spacing</label>
                      <Select value={spacingPreset} onValueChange={(v: string) => setSpacingPreset(v as "compact" | "normal" | "relaxed")}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compact</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="relaxed">Relaxed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Cover Page Toggle */}
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cover Page</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${showCover ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setShowCover(!showCover)}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showCover ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>

                    {/* Branding Preview */}
                    {branding && (
                      <div className="border border-gray-100 rounded-lg p-2.5 bg-gray-50">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded" style={{ background: branding.primary_color }} />
                          <div className="w-4 h-4 rounded" style={{ background: branding.secondary_color }} />
                          <div className="w-4 h-4 rounded" style={{ background: branding.accent_color }} />
                          <span className="text-[10px] text-gray-500 ml-auto">{branding.font_family}</span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Header: {branding.header_style} · Footer: {branding.footer_format.show_page_numbers ? "Pages" : "No pages"}
                        </div>
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="w-full text-xs" onClick={renderPreview}>
                      <RefreshCw size={12} className="mr-1" /> Apply & Re-render
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
                    <Button variant="outline" size="sm" className="w-full text-xs justify-start" onClick={() => navigate(`/editor?instance=${docInstance.id}`)}>
                      <ArrowLeft size={12} className="mr-2" /> Back to Editor
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
                    {existingVaultAssets.length === 0 && !hasFinalPDF ? (
                      <div className="text-center py-3">
                        <Archive size={20} className="mx-auto mb-1.5 text-gray-300" />
                        <p className="text-[10px] text-gray-400">No vault assets yet</p>
                        <p className="text-[10px] text-gray-400">Compile a final PDF to save to vault</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {existingVaultAssets.map(va => (
                          <div key={va.id} className="flex items-center gap-2 px-2 py-2 bg-gray-50 rounded-lg text-xs">
                            <div className={`w-1.5 h-8 rounded-full ${va.status === "final" ? "bg-emerald-500" : va.status === "preview" ? "bg-amber-500" : "bg-gray-400"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-[#1B2A4A] truncate">{va.title}</div>
                              <div className="text-[10px] text-gray-500 flex items-center gap-2">
                                <Badge className={`text-[9px] h-3.5 border-0 ${va.status === "final" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                  {va.status}
                                </Badge>
                                <span>{va.created_at.split("T")[0]}</span>
                                {va.sent_to_crm && <Badge className="text-[9px] h-3.5 bg-blue-50 text-blue-700 border-0">CRM ✓</Badge>}
                              </div>
                            </div>
                          </div>
                        ))}
                        {hasFinalPDF && existingVaultAssets.length === 0 && (
                          <div className="flex items-center gap-2 px-2 py-2 bg-emerald-50 rounded-lg text-xs text-emerald-700">
                            <CheckCircle size={12} /> Final PDF compiled — saved to vault
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Block Summary */}
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Block Summary</h3>
                <div className="space-y-1.5">
                  {currentVersion.blocks.map((block, idx) => {
                    const blockDef = getBlockByKey(block.block_key);
                    const familyCfg = blockDef ? BLOCK_FAMILY_CONFIG[blockDef.family] : null;
                    return (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${block.is_locked ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <span className="text-gray-700 truncate flex-1">{blockDef?.display_name || block.block_key}</span>
                        {familyCfg && (
                          <Badge className={`text-[9px] h-3.5 border-0 ${familyCfg.bg} ${familyCfg.color}`}>
                            {familyCfg.label}
                          </Badge>
                        )}
                        {block.is_locked && <Lock size={9} className="text-amber-500" />}
                        {block.is_ai_generated && <Badge className="text-[9px] h-3.5 bg-violet-50 text-violet-700 border-0">AI</Badge>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
