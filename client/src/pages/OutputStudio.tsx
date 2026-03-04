/**
 * Output Studio — Complete Overhaul
 * 
 * Professional A4 PDF viewer with:
 * - Full-page document preview using pdf-renderer.ts (proper cover, headers, footers, tables)
 * - Dual-language EN/AR toggle with Arabic translation bot
 * - Branding profile selection
 * - Watermark modes (Draft, Confidential, Final)
 * - Compile & Download (HTML for print-to-PDF)
 * - Page navigation
 * - Zoom controls
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, FileDown, Send, CheckCircle, AlertTriangle, XCircle,
  Palette, Eye, Lock, Archive, ChevronDown, ChevronRight, Loader2,
  ZoomIn, ZoomOut, Languages, Download, Printer, Globe, ChevronLeft,
  ChevronRight as ChevronRightIcon
} from "lucide-react";
import {
  getBlockByKey, getBrandingProfile,
  brandingProfiles, DOC_TYPE_CONFIG, BLOCK_FAMILY_CONFIG,
  saveToVault, exportToCRM,
  type BrandingProfile as ComposerBrandingProfile, type InstanceBlock,
} from "@/lib/document-composer";
import { compileComposerPDF, type ComposerPDFInput } from "@/lib/pdf-compiler";
import { resolveTokens, type TokenResolutionResult, type ResolutionContext } from "@/lib/semantic-variables";
import { getTokenHealthSummary, buildAsyncResolutionContext, type AsyncResolutionInput } from "@/lib/token-resolver";
import { useCustomer, useWorkspace } from "@/hooks/useSupabase";
import {
  useDocInstance, useCompiledDocuments, useVaultAssets,
  type HydratedDocInstance, type HydratedDocVersion, type DbCompiledDocument,
} from "@/hooks/useDocuments";
import { syncCompiledDocCreate } from "@/lib/supabase-sync";

// PDF Engine imports
import {
  type PDFRenderContext, type PDFTemplate, type PDFSectionData, type PricingRow,
  type LanguageMode, type WatermarkMode, type CoverStyle,
  type BrandingProfile as PDFBrandingProfile,
  fetchPDFTemplates, getPDFTemplate, HALA_BRANDING,
  formatSARPdf, formatDatePdf, generateReferenceNumber,
} from "@/lib/pdf-engine";
import { renderPDFHTML, getSamplePricingRows, getSampleSLARows } from "@/lib/pdf-renderer";
import { translateToArabic, translateBatch, translatePricingRows, translateSLAMetrics, translateTerms } from "@/lib/arabic-translator";

// ============================================================
// TOKEN HEALTH ANALYSIS
// ============================================================

interface TokenHealth {
  total: number;
  resolved: number;
  missing: string[];
  status: "healthy" | "warning" | "error";
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

function buildEditorUrl(docInstanceId: string, ctx: NavContext, docWorkspaceId?: string | null): string {
  // Always prefer navigating back to the workspace if we have a workspace ID
  const wsId = ctx.workspaceId || docWorkspaceId;
  if (wsId) {
    return `/workspaces/${wsId}?tab=documents`;
  }
  if (ctx.from === "documents") {
    return `/editor?instance=${docInstanceId}&from=documents`;
  }
  return `/editor?instance=${docInstanceId}`;
}

function buildBackLabel(ctx: NavContext, docWorkspaceId?: string | null): string {
  const wsId = ctx.workspaceId || docWorkspaceId;
  if (wsId) return "Back to Workspace";
  if (ctx.from === "documents") return "Back to Editor";
  return "Back to Editor";
}

// ============================================================
// BRIDGE: Convert composer blocks to PDF render context
// ============================================================

function buildPDFRenderContext(
  docInstance: HydratedDocInstance,
  currentVersion: HydratedDocVersion,
  resolutionCtx: ResolutionContext | null,
  language: LanguageMode,
  watermark: WatermarkMode,
  coverStyle: CoverStyle,
  customerName: string,
): PDFRenderContext {
  const docType = docInstance.doc_type;

  // Get the matching PDF template
  const templates = fetchPDFTemplates(docType as any);
  const template: PDFTemplate = templates[0] || fetchPDFTemplates()[0];

  // Resolve all blocks' tokens
  const blocks = currentVersion.blocks
    .map((b: any) => ({
      key: b.block_key,
      content: b.content,
      order: b.order,
    }))
    .sort((a: any, b: any) => a.order - b.order);

  const resolvedBlocks: Record<string, string> = {};
  for (const block of blocks) {
    const resolved = resolveTokens(block.content, resolutionCtx || {
      recordOverrides: {},
      templateDefaults: {},
      globalDefaults: {},
      entityBindings: {},
    }, docType);
    resolvedBlocks[block.key] = resolved.renderedText;
  }

  // Build sections_data from resolved blocks
  const sections_data: Record<string, PDFSectionData> = {};

  // Track which blocks have been handled
  const handledBlocks = new Set<string>();

  for (const block of blocks) {
    const resolvedContent = resolvedBlocks[block.key] || block.content;
    const key = block.key;

    // ── Cover ──
    if (key === "cover.hero" || key === "cover_hero") {
      handledBlocks.add(key);
      // Cover is rendered by the template system, no sections_data needed
      continue;
    }

    // ── Confidentiality ──
    if (key === "confidentiality.locked" || key === "confidentiality_locked") {
      handledBlocks.add(key);
      sections_data["confidentiality"] = {
        type: "confidentiality",
        content_html: resolvedContent,
        content_html_ar: language !== "en" ? translateToArabic(stripHtml(resolvedContent)).translated : undefined,
      };
      continue;
    }

    // ── Introduction / Narrative ──
    if (key === "intro.narrative" || key === "intro_narrative") {
      handledBlocks.add(key);
      sections_data["introduction"] = {
        type: "introduction",
        content_html: resolvedContent,
        content_html_ar: language !== "en" ? translateToArabic(stripHtml(resolvedContent)).translated : undefined,
      };
      continue;
    }

    // ── Scope of Work ──
    if (key === "scope.list" || key === "scope_list" || key === "scope.table") {
      handledBlocks.add(key);
      sections_data["scope"] = {
        type: "scope_of_work",
        content_html: resolvedContent,
        content_html_ar: language !== "en" ? translateToArabic(stripHtml(resolvedContent)).translated : undefined,
      };
      continue;
    }

    // ── Pricing Tables ── (parse actual editor HTML for table data)
    if (key.startsWith("pricing.") || key.startsWith("quote.pricing")) {
      handledBlocks.add(key);
      // Try to parse pricing rows from the editor HTML table
      const parsedRows = parsePricingFromHtml(resolvedContent);
      const pricingRows = parsedRows.length > 0 ? parsedRows : getSamplePricingRows();
      if (language !== "en") {
        const translated = translatePricingRows(pricingRows);
        pricingRows.forEach((row: PricingRow, i: number) => {
          row.description_ar = translated[i]?.description_ar;
          row.unit_ar = translated[i]?.unit_ar;
        });
      }
      sections_data["pricing"] = {
        type: "pricing_table",
        pricing_rows: pricingRows,
        content_html: resolvedContent,
      };
      continue;
    }

    // ── Totals / Number to Words ──
    if (key === "totals.number_to_words") {
      handledBlocks.add(key);
      // Totals are rendered as part of the pricing table footer
      if (sections_data["pricing"]) {
        sections_data["pricing"].content_html = (sections_data["pricing"].content_html || "") + resolvedContent;
      }
      continue;
    }

    // ── Terms & Conditions ──
    if (key === "terms.standard" || key === "terms_standard") {
      handledBlocks.add(key);
      const termItems = parseTermsFromHtml(resolvedContent);
      const translatedTerms = language !== "en" ? translateTerms(termItems.map(t => ({ title: t.title_en, content: t.content_en }))) : [];
      sections_data["terms"] = {
        type: "terms_and_conditions",
        content_html: resolvedContent,
        terms: termItems.map((t, i) => ({
          ...t,
          title_ar: translatedTerms[i]?.title_ar || "",
          content_ar: translatedTerms[i]?.content_ar || "",
        })),
      };
      continue;
    }

    // ── Signature ──
    if (key === "signature.dual" || key === "signature_dual") {
      handledBlocks.add(key);
      // Signature is rendered by the template system
      continue;
    }

    // ── SLA Matrix ──
    if (key === "annexure.b.sla_matrix" || key === "sla.matrix" || key === "sla_matrix") {
      handledBlocks.add(key);
      sections_data["sla_matrix"] = {
        type: "sla_matrix",
        sla_rows: getSampleSLARows(),
        content_html: resolvedContent,
      };
      continue;
    }

    // ── Legal Clauses ──
    if (key === "legal.clauses.locked") {
      handledBlocks.add(key);
      sections_data["legal_clauses"] = {
        type: "legal_clauses",
        content_html: resolvedContent,
        content_html_ar: language !== "en" ? translateToArabic(stripHtml(resolvedContent)).translated : undefined,
      };
      continue;
    }

    // ── Legal Party Details ──
    if (key === "legal.party_details") {
      handledBlocks.add(key);
      sections_data["party_details"] = {
        type: "custom_content",
        content_html: resolvedContent,
      };
      continue;
    }

    // ── Table of Contents ──
    if (key === "legal.toc.auto") {
      handledBlocks.add(key);
      // TOC is auto-generated by the template system
      continue;
    }

    // ── Closing Note ──
    if (key === "closing.note") {
      handledBlocks.add(key);
      sections_data["closing"] = {
        type: "notes",
        content_html: resolvedContent,
        content_html_ar: language !== "en" ? translateToArabic(stripHtml(resolvedContent)).translated : undefined,
      };
      continue;
    }

    // ── Facility Gallery ──
    if (key === "facility.gallery") {
      handledBlocks.add(key);
      sections_data["facility"] = {
        type: "custom_content",
        content_html: resolvedContent,
      };
      continue;
    }

    // ── Annexures ──
    if (key.startsWith("annexure.")) {
      handledBlocks.add(key);
      const annexureKey = key.replace(/\./g, "_");
      sections_data[annexureKey] = {
        type: "custom_content",
        content_html: resolvedContent,
        content_html_ar: language !== "en" ? translateToArabic(stripHtml(resolvedContent)).translated : undefined,
      };
      continue;
    }

    // ── Any unmatched block → render as custom content ──
    if (!handledBlocks.has(key)) {
      handledBlocks.add(key);
      const customKey = key.replace(/\./g, "_");
      sections_data[customKey] = {
        type: "custom_content",
        content_html: resolvedContent,
      };
    }
  }

  // Ensure introduction exists even if no block matched
  if (!sections_data["introduction"]) {
    const introBlock = blocks.find(b => b.key.includes("intro"));
    if (introBlock) {
      sections_data["introduction"] = {
        type: "introduction",
        content_html: resolvedBlocks[introBlock.key] || introBlock.content,
      };
    }
  }

  // Ensure scope exists
  if (!sections_data["scope"]) {
    const scopeBlock = blocks.find(b => b.key.includes("scope"));
    if (scopeBlock) {
      sections_data["scope"] = {
        type: "scope_of_work",
        content_html: resolvedBlocks[scopeBlock.key] || scopeBlock.content,
      };
    }
  }

  // Ensure pricing exists
  if (!sections_data["pricing"]) {
    sections_data["pricing"] = {
      type: "pricing_table",
      pricing_rows: getSamplePricingRows(),
    };
  }

  // Ensure terms exists
  if (!sections_data["terms"]) {
    sections_data["terms"] = {
      type: "terms_and_conditions",
      terms: [
        { number: "1", title_en: "Payment Terms", title_ar: "شروط الدفع", content_en: "Net 30 days from invoice date.", content_ar: "صافي ٣٠ يوم من تاريخ الفاتورة." },
        { number: "2", title_en: "Contract Duration", title_ar: "مدة العقد", content_en: "12 months from commencement date.", content_ar: "١٢ شهراً من تاريخ البدء." },
        { number: "3", title_en: "Rate Review", title_ar: "مراجعة الأسعار", content_en: "Annual review subject to CPI adjustment.", content_ar: "مراجعة سنوية وفقاً لمؤشر أسعار المستهلك." },
        { number: "4", title_en: "Insurance", title_ar: "التأمين", content_en: "Standard warehouse liability coverage included.", content_ar: "تغطية مسؤولية المستودعات القياسية مشمولة." },
        { number: "5", title_en: "Minimum Commitment", title_ar: "الحد الأدنى للالتزام", content_en: "As specified in the pricing schedule.", content_ar: "كما هو محدد في جدول الأسعار." },
      ],
    };
  }

  // Build customer Arabic name
  const customerNameAr = translateToArabic(customerName).translated;

  // Override template settings
  const adjustedTemplate = {
    ...template,
    cover_style: coverStyle,
    language_mode: language,
  };

  return {
    template: adjustedTemplate,
    branding: HALA_BRANDING,
    watermark,
    language,
    document_title: docInstance.title || `${customerName} — ${DOC_TYPE_CONFIG[docType]?.label || docType}`,
    document_subtitle: DOC_TYPE_CONFIG[docType]?.label || docType,
    customer_name: customerName,
    customer_name_ar: customerNameAr,
    customer_logo_url: "",
    reference_number: generateReferenceNumber(),
    date: formatDatePdf(),
    sections_data,
  };
}

// Helper: strip HTML tags for translation
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Helper: parse pricing rows from editor HTML table
function parsePricingFromHtml(html: string): PricingRow[] {
  const rows: PricingRow[] = [];
  try {
    // Extract table rows from HTML
    const rowMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!rowMatches || rowMatches.length < 2) return []; // Need at least header + 1 data row
    
    // Skip header row, parse data rows
    for (let i = 1; i < rowMatches.length; i++) {
      const cellMatches = rowMatches[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (!cellMatches || cellMatches.length < 2) continue;
      
      const cells = cellMatches.map(c => c.replace(/<[^>]*>/g, "").trim());
      const description = cells[0] || `Item ${i}`;
      const unit = cells.length >= 3 ? cells[1] : "Per unit";
      const rateStr = cells.length >= 3 ? cells[2] : cells[1];
      const rate = parseFloat(rateStr?.replace(/[^\d.]/g, "") || "0");
      const volumeStr = cells.length >= 4 ? cells[3] : "";
      const volume = parseInt(volumeStr?.replace(/[^\d]/g, "") || "0", 10);
      const monthlyStr = cells.length >= 5 ? cells[4] : cells[cells.length - 1];
      const monthly = parseFloat(monthlyStr?.replace(/[^\d.]/g, "") || "0");
      
      rows.push({
        no: i,
        description,
        unit,
        rate: rate || monthly,
      });
    }
  } catch {
    // If parsing fails, return empty to fall back to sample data
  }
  return rows;
}

// Helper: parse terms from HTML content
function parseTermsFromHtml(html: string): Array<{ number: string; title_en: string; title_ar: string; content_en: string; content_ar: string }> {
  const text = stripHtml(html);
  const lines = text.split(/(?=\d+\.\s)/).filter(l => l.trim());
  return lines.map((line, i) => {
    const match = line.match(/^(\d+)\.\s*(.+?):\s*(.+)$/);
    if (match) {
      return { number: match[1], title_en: match[2].trim(), title_ar: "", content_en: match[3].trim(), content_ar: "" };
    }
    const parts = line.split(":");
    if (parts.length >= 2) {
      return { number: String(i + 1), title_en: parts[0].replace(/^\d+\.\s*/, "").trim(), title_ar: "", content_en: parts.slice(1).join(":").trim(), content_ar: "" };
    }
    return { number: String(i + 1), title_en: `Clause ${i + 1}`, title_ar: "", content_en: line.trim(), content_ar: "" };
  });
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
  const [languageMode, setLanguageMode] = useState<LanguageMode>("en");
  const [watermarkMode, setWatermarkMode] = useState<WatermarkMode>("draft");
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("wave");
  const [zoom, setZoom] = useState(70);
  const [compiledHtml, setCompiledHtml] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [hasFinalPDF, setHasFinalPDF] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sidebar sections
  const [tokenHealthExpanded, setTokenHealthExpanded] = useState(true);
  const [stylingExpanded, setStylingExpanded] = useState(true);
  const [actionsExpanded, setActionsExpanded] = useState(true);
  const [vaultExpanded, setVaultExpanded] = useState(false);

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
  const branding = useMemo<ComposerBrandingProfile | undefined>(() => getBrandingProfile(effectiveBrandingId), [effectiveBrandingId]);

  // Token health — async from Supabase-backed resolver
  const [tokenHealth, setTokenHealth] = useState<TokenHealth>({ total: 0, resolved: 0, missing: [], status: "healthy" });
  const [resolutionCtx, setResolutionCtx] = useState<ResolutionContext | null>(null);

  // Fetch customer and workspace from Supabase
  const { data: sbCustomer } = useCustomer(docInstance?.customer_id || "");
  const { data: sbWorkspace } = useWorkspace(docInstance?.workspace_id || "");

  // Build async resolution input
  const asyncInput = useMemo<AsyncResolutionInput | null>(() => {
    if (!docInstance) return null;
    const entityData: Record<string, unknown> = {};
    if (sbCustomer) {
      entityData.name = sbCustomer.name;
      entityData.code = sbCustomer.code;
      entityData.city = sbCustomer.city;
      entityData.region = sbCustomer.region;
      entityData.industry = sbCustomer.industry;
      entityData.grade = sbCustomer.grade;
      entityData.facility = sbCustomer.facility;
      entityData.contract_expiry = sbCustomer.contractExpiry;
      entityData.service_type = sbCustomer.serviceType;
      entityData.contactName = sbCustomer.contactName;
    }
    const pricingSnapshot: Record<string, unknown> = {};
    if (sbWorkspace) {
      pricingSnapshot.estimated_value = sbWorkspace.estimatedValue;
      pricingSnapshot.pallet_volume = sbWorkspace.palletVolume;
      pricingSnapshot.gp_percent = sbWorkspace.gpPercent;
      pricingSnapshot.total = sbWorkspace.estimatedValue;
    }
    return {
      docInstanceId: docInstance.id,
      docType: docInstance.doc_type,
      entityData,
      pricingSnapshot,
      docTitle: docInstance.title || undefined,
      customerName: docInstance.customer_name || undefined,
    };
  }, [docInstance, sbCustomer, sbWorkspace]);

  // Fetch token health + resolution context asynchronously
  useEffect(() => {
    if (!currentVersion || !asyncInput) return;
    let cancelled = false;
    (async () => {
      try {
        const blocks = currentVersion.blocks.map((b: any) => ({ content: b.content, block_key: b.block_key }));
        const [summary, { context }] = await Promise.all([
          getTokenHealthSummary(blocks, asyncInput),
          buildAsyncResolutionContext(asyncInput),
        ]);
        if (cancelled) return;
        setResolutionCtx(context);
        setTokenHealth({
          total: summary.totalTokens,
          resolved: summary.resolvedCount,
          missing: summary.missingTokens.map(t => t.key),
          status: summary.missingCount === 0 ? "healthy" : summary.missingCount <= 2 ? "warning" : "error",
        });
      } catch {
        if (!cancelled) {
          setTokenHealth({ total: 0, resolved: 0, missing: [], status: "healthy" });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [currentVersion, asyncInput]);

  // Auto-render preview on load and when resolution context updates
  useEffect(() => {
    if (currentVersion && docInstance) {
      renderPreview();
    }
  }, [currentVersion?.id, resolutionCtx, languageMode, watermarkMode, coverStyle]);

  const editorUrl = docInstance ? buildEditorUrl(docInstance.id, navCtx, docInstance.workspace_id) : "/editor";
  const backLabel = buildBackLabel(navCtx, docInstance?.workspace_id);

  // ── Render preview using professional PDF renderer ──
  const renderPreview = useCallback(() => {
    if (!docInstance || !currentVersion) return;

    try {
      const ctx = buildPDFRenderContext(
        docInstance,
        currentVersion,
        resolutionCtx,
        languageMode,
        watermarkMode,
        coverStyle,
        docInstance.customer_name,
      );
      const html = renderPDFHTML(ctx);
      setCompiledHtml(html);
    } catch (err) {
      console.error("PDF render error:", err);
      // Fallback to basic render
      renderBasicPreview();
    }
  }, [docInstance, currentVersion, resolutionCtx, languageMode, watermarkMode, coverStyle]);

  // Fallback basic render (same as old version)
  function renderBasicPreview() {
    if (!docInstance || !currentVersion || !branding) return;
    const blocks = currentVersion.blocks.map((b: any) => {
      const blockDef = getBlockByKey(b.block_key);
      return { key: b.block_key, family: blockDef?.family || "narrative", content: b.content, order: b.order };
    }).sort((a: any, b: any) => a.order - b.order);

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #333; padding: 2rem; }
      h1, h2, h3 { color: #1B2A4A; margin-bottom: 0.5rem; }
    </style></head><body>`;
    for (const block of blocks) {
      const resolved = resolveTokens(block.content, resolutionCtx || {
        recordOverrides: {}, templateDefaults: {}, globalDefaults: {}, entityBindings: {},
      }, docInstance.doc_type);
      html += `<div style="margin-bottom:1.5rem;">${resolved.renderedText}</div>`;
    }
    html += `</body></html>`;
    setCompiledHtml(html);
  }

  // ── Compile final PDF ──
  function compileFinalPDF() {
    if (!docInstance || !currentVersion) return;
    setIsCompiling(true);

    setTimeout(() => {
      try {
        // Use the professional renderer
        const ctx = buildPDFRenderContext(
          docInstance,
          currentVersion,
          resolutionCtx,
          languageMode,
          watermarkMode === "draft" ? "final" : watermarkMode,
          coverStyle,
          docInstance.customer_name,
        );
        const html = renderPDFHTML(ctx);

        if (html) {
          const compiledId = `cd-${crypto.randomUUID()}`;
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
          toast.success("PDF compiled successfully — ready for download");
        } else {
          toast.error("Compilation returned empty output");
        }
      } catch {
        toast.error("Compilation failed — unexpected error");
      }
      setIsCompiling(false);
    }, 800);
  }

  // ── Download HTML ──
  function handleDownloadHTML() {
    if (!compiledHtml) {
      toast.error("No document to download — render first");
      return;
    }
    const blob = new Blob([compiledHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const langSuffix = languageMode === "dual" ? "_dual" : languageMode === "ar" ? "_ar" : "";
    a.href = url;
    a.download = `${docInstance?.customer_name || "document"}${langSuffix}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("HTML downloaded — open in browser and use Print → Save as PDF");
  }

  // ── Print ──
  function handlePrint() {
    if (!compiledHtml) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }
    printWindow.document.write(compiledHtml);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 600);
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
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-[#1B2A4A]/40 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading document...</p>
        </div>
      </div>
    );
  }

  // ── Not found state ──
  if (!docInstance || !currentVersion) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
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
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(editorUrl)} className="text-xs h-7">
            <ArrowLeft size={14} className="mr-1" /> {backLabel}
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <Badge className="bg-[#1B2A4A]/10 text-[#1B2A4A] border-0 text-xs">{docTypeConfig.label}</Badge>
          <span className="text-sm font-medium text-[#1B2A4A]">{docInstance.customer_name}</span>
          <span className="text-xs text-gray-400">v{currentVersion.version_number}</span>
          {docInstance.status === "canon" && <Lock size={12} className="text-amber-600" />}
        </div>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${languageMode === "en" ? "bg-[#1B2A4A] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setLanguageMode("en")}
            >
              EN
            </button>
            <button
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${languageMode === "dual" ? "bg-[#1B2A4A] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setLanguageMode("dual")}
            >
              EN/AR
            </button>
            <button
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${languageMode === "ar" ? "bg-[#1B2A4A] text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              onClick={() => setLanguageMode("ar")}
            >
              عربي
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button className="px-1.5 py-1 hover:bg-gray-50" onClick={() => setZoom(Math.max(40, zoom - 10))}>
              <ZoomOut size={12} className="text-gray-500" />
            </button>
            <span className="px-2 text-[10px] text-gray-500 font-mono min-w-[36px] text-center">{zoom}%</span>
            <button className="px-1.5 py-1 hover:bg-gray-50" onClick={() => setZoom(Math.min(120, zoom + 10))}>
              <ZoomIn size={12} className="text-gray-500" />
            </button>
          </div>

          {/* Token health badge */}
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

          <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleDownloadHTML}>
            <Download size={12} className="mr-1" /> Download
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={handlePrint}>
            <Printer size={12} className="mr-1" /> Print
          </Button>
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

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — Controls */}
        <div className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50/50 flex-shrink-0">
          <div className="p-3 space-y-2">

            {/* Token Health */}
            <SidebarSection
              icon={tokenHealth.status === "healthy" ? <CheckCircle size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
              title="Token Health"
              expanded={tokenHealthExpanded}
              onToggle={() => setTokenHealthExpanded(!tokenHealthExpanded)}
            >
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div>
                  <div className="text-base font-bold text-[#1B2A4A]">{tokenHealth.total}</div>
                  <div className="text-[9px] text-gray-500 uppercase">Total</div>
                </div>
                <div>
                  <div className="text-base font-bold text-emerald-600">{tokenHealth.resolved}</div>
                  <div className="text-[9px] text-gray-500 uppercase">Resolved</div>
                </div>
                <div>
                  <div className="text-base font-bold text-red-600">{tokenHealth.missing.length}</div>
                  <div className="text-[9px] text-gray-500 uppercase">Missing</div>
                </div>
              </div>
              {tokenHealth.missing.length > 0 && (
                <div className="space-y-1">
                  {tokenHealth.missing.map(token => (
                    <div key={token} className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded text-[10px]">
                      <AlertTriangle size={9} className="text-red-500 flex-shrink-0" />
                      <code className="text-red-700 font-mono text-[9px]">{`{{${token}}}`}</code>
                    </div>
                  ))}
                </div>
              )}
              {tokenHealth.status === "healthy" && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50 rounded text-[10px] text-emerald-700">
                  <CheckCircle size={10} /> All tokens resolved
                </div>
              )}
            </SidebarSection>

            {/* Styling Controls */}
            <SidebarSection
              icon={<Palette size={14} className="text-[#1B2A4A]" />}
              title="Styling"
              expanded={stylingExpanded}
              onToggle={() => setStylingExpanded(!stylingExpanded)}
            >
              <div className="space-y-2.5">
                <div>
                  <label className="text-[9px] text-gray-500 uppercase font-medium">Branding</label>
                  <Select value={effectiveBrandingId} onValueChange={setSelectedBrandingId}>
                    <SelectTrigger className="h-7 text-[11px] mt-0.5">
                      <SelectValue placeholder="Select branding" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandingProfiles.map(bp => (
                        <SelectItem key={bp.id} value={bp.id}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bp.primary_color }} />
                            <span className="text-[11px]">{bp.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[9px] text-gray-500 uppercase font-medium">Cover Style</label>
                  <Select value={coverStyle} onValueChange={(v) => setCoverStyle(v as CoverStyle)}>
                    <SelectTrigger className="h-7 text-[11px] mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wave">Wave (Professional)</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="none">No Cover</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[9px] text-gray-500 uppercase font-medium">Watermark</label>
                  <Select value={watermarkMode} onValueChange={(v) => setWatermarkMode(v as WatermarkMode)}>
                    <SelectTrigger className="h-7 text-[11px] mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button variant="outline" size="sm" className="w-full text-[11px] h-7" onClick={renderPreview}>
                  <RefreshCw size={11} className="mr-1.5" /> Re-render
                </Button>
              </div>
            </SidebarSection>

            {/* Actions */}
            <SidebarSection
              icon={<FileDown size={14} className="text-[#1B2A4A]" />}
              title="Actions"
              expanded={actionsExpanded}
              onToggle={() => setActionsExpanded(!actionsExpanded)}
            >
              <div className="space-y-1.5">
                <Button variant="outline" size="sm" className="w-full text-[11px] h-7 justify-start" onClick={() => navigate(editorUrl)}>
                  <ArrowLeft size={11} className="mr-1.5" /> {backLabel}
                </Button>
                <Button variant="outline" size="sm" className="w-full text-[11px] h-7 justify-start" onClick={handleDownloadHTML}>
                  <Download size={11} className="mr-1.5" /> Download HTML
                </Button>
                <Button variant="outline" size="sm" className="w-full text-[11px] h-7 justify-start" onClick={handlePrint}>
                  <Printer size={11} className="mr-1.5" /> Print / Save PDF
                </Button>
                <Button
                  size="sm"
                  className="w-full text-[11px] h-7 justify-start bg-[#1B2A4A] hover:bg-[#2A3F6A]"
                  onClick={compileFinalPDF}
                  disabled={isCompiling}
                >
                  <FileDown size={11} className="mr-1.5" />
                  {isCompiling ? "Compiling..." : "Compile Final PDF"}
                </Button>
                {(hasFinalPDF || existingCompiled.length > 0) && (
                  <>
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 justify-start text-emerald-700 border-emerald-200 hover:bg-emerald-50" onClick={handleSendToCRM}>
                      <Send size={11} className="mr-1.5" /> Send to CRM
                    </Button>
                    <Button variant="outline" size="sm" className="w-full text-[11px] h-7 justify-start" onClick={() => toast.success("Document saved to vault")}>
                      <Archive size={11} className="mr-1.5" /> Save to Vault
                    </Button>
                  </>
                )}
              </div>
            </SidebarSection>

            {/* Vault Assets */}
            <SidebarSection
              icon={<Archive size={14} className="text-[#1B2A4A]" />}
              title={`Document Vault${existingVaultAssets.length > 0 ? ` (${existingVaultAssets.length})` : ""}`}
              expanded={vaultExpanded}
              onToggle={() => setVaultExpanded(!vaultExpanded)}
            >
              {existingVaultAssets.length === 0 && !hasFinalPDF && existingCompiled.length === 0 ? (
                <div className="text-center py-2">
                  <Archive size={16} className="mx-auto mb-1 text-gray-300" />
                  <p className="text-[9px] text-gray-400">No vault assets yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {existingCompiled.map((comp: DbCompiledDocument) => (
                    <div key={comp.id} className="flex items-center justify-between p-1.5 bg-white rounded border border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <FileDown size={10} className="text-[#1B2A4A]" />
                        <div>
                          <p className="text-[9px] font-medium truncate max-w-[140px]">{comp.title}</p>
                          <p className="text-[8px] text-gray-400">{comp.compiled_at?.split("T")[0]}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[8px] h-3.5">{comp.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </SidebarSection>
          </div>
        </div>

        {/* ── Right — Full Document Preview ── */}
        <div className="flex-1 overflow-auto bg-gray-200/50">
          <div className="p-6 flex justify-center">
            {compiledHtml ? (
              <div
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top center",
                  width: `${100 / (zoom / 100)}%`,
                  maxWidth: `${210 * (100 / zoom)}mm`,
                }}
              >
                <iframe
                  ref={iframeRef}
                  srcDoc={compiledHtml}
                  className="w-full bg-white shadow-xl border border-gray-300"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    height: "auto",
                  }}
                  onLoad={() => {
                    // Auto-resize iframe to fit content
                    const iframe = iframeRef.current;
                    if (iframe?.contentDocument?.body) {
                      const h = iframe.contentDocument.body.scrollHeight;
                      iframe.style.height = `${Math.max(h + 40, 1123)}px`;
                    }
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-20">
                <Loader2 size={24} className="animate-spin mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-400">Rendering document preview...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR SECTION COMPONENT
// ============================================================

function SidebarSection({ icon, title, expanded, onToggle, children }: {
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-gray-200 shadow-none">
      <CardContent className="p-0">
        <button
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-xs font-semibold text-[#1B2A4A]">{title}</span>
          </div>
          {expanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
        </button>
        {expanded && (
          <div className="px-3 pb-2.5 border-t border-gray-100 pt-2">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
