/**
 * Sprint 14D — PDF Studio
 * 
 * Full-featured PDF generation studio:
 * - Template selector (Quote, Proposal, SLA, MSA, Service Order)
 * - Live HTML preview of the PDF
 * - Arabic Translation Bot panel
 * - Language mode toggle (EN / AR / Dual)
 * - Watermark selector (None, Draft, Confidential, Final)
 * - Cover style selector
 * - Customer selector
 * - Section editor (enable/disable, reorder)
 * - Pricing row editor
 * - SLA matrix editor
 * - Download as HTML (print-to-PDF)
 * - Translation dictionary browser
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  FileText, Printer, Eye, Download, Settings, Globe, Languages,
  ChevronRight, ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Search,
  CheckCircle2, AlertTriangle, BookOpen, ArrowRight, RefreshCw,
  Loader2, Copy, X, Stamp, FileSignature, LayoutTemplate, Palette,
  ZoomIn, ZoomOut, ChevronsUpDown, ArrowDown, ArrowUp, Maximize2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import {
  fetchPDFTemplates, getPDFTemplate, HALA_BRANDING,
  formatSARPdf, formatDatePdf, generateReferenceNumber,
  type PDFTemplate, type DocType, type LanguageMode, type WatermarkMode,
  type CoverStyle, type PDFRenderContext, type PDFSectionData,
  type PricingRow, type SLAMatrixRow, type TermItem,
  logPDFGeneration,
} from "@/lib/pdf-engine";

import { renderPDFHTML, getSamplePricingRows, getSampleSLARows } from "@/lib/pdf-renderer";

import {
  translateToArabic, translateBatch, translatePricingRows,
  getDictionaryStats, searchDictionary, getTranslationCategories,
  formatSARArabic, toArabicDigits,
  type TranslationResult, type TranslationCategory, type DictionaryEntry,
} from "@/lib/arabic-translator";

import { useCustomers } from "@/hooks/useSupabase";

// ============================================================
// SAMPLE TERMS DATA
// ============================================================

const SAMPLE_TERMS: TermItem[] = [
  {
    number: "1.",
    title_en: "Payment Terms",
    title_ar: "شروط الدفع",
    content_en: "Payment shall be made within 30 days from the date of invoice. Late payments will incur a penalty of 1.5% per month.",
    content_ar: "يتم الدفع خلال 30 يومًا من تاريخ الفاتورة. ستترتب على المدفوعات المتأخرة غرامة بنسبة 1.5٪ شهريًا.",
  },
  {
    number: "2.",
    title_en: "Contract Duration",
    title_ar: "مدة العقد",
    content_en: "This agreement shall be effective for a period of 12 months from the date of signing, with automatic renewal for successive periods of 12 months unless terminated by either party.",
    content_ar: "تسري هذه الاتفاقية لمدة 12 شهرًا من تاريخ التوقيع، مع التجديد التلقائي لفترات متتالية مدتها 12 شهرًا ما لم يتم إنهاؤها من قبل أي من الطرفين.",
  },
  {
    number: "3.",
    title_en: "Liability",
    title_ar: "المسؤولية",
    content_en: "The maximum liability of the service provider shall not exceed the total value of the contract for the preceding 12-month period.",
    content_ar: "لا تتجاوز المسؤولية القصوى لمقدم الخدمة القيمة الإجمالية للعقد عن فترة الاثني عشر شهرًا السابقة.",
  },
  {
    number: "4.",
    title_en: "Force Majeure",
    title_ar: "القوة القاهرة",
    content_en: "Neither party shall be liable for any failure or delay in performance due to circumstances beyond its reasonable control, including but not limited to acts of God, natural disasters, war, or government actions.",
    content_ar: "لا يكون أي من الطرفين مسؤولاً عن أي إخفاق أو تأخير في الأداء بسبب ظروف خارجة عن سيطرته المعقولة، بما في ذلك على سبيل المثال لا الحصر الكوارث الطبيعية والحروب أو الإجراءات الحكومية.",
  },
  {
    number: "5.",
    title_en: "Confidentiality",
    title_ar: "السرية",
    content_en: "Both parties agree to maintain the confidentiality of all proprietary information shared during the term of this agreement and for a period of 2 years following termination.",
    content_ar: "يوافق كلا الطرفين على الحفاظ على سرية جميع المعلومات الخاصة المتبادلة خلال مدة هذه الاتفاقية ولمدة سنتين بعد الإنهاء.",
  },
];

// ============================================================
// COMPONENT
// ============================================================

export default function PDFStudio() {
  const { data: customers } = useCustomers();
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Template & config state
  const [selectedTemplateId, setSelectedTemplateId] = useState("tpl-quote");
  const [language, setLanguage] = useState<LanguageMode>("en");
  const [watermark, setWatermark] = useState<WatermarkMode>("none");
  const [coverStyle, setCoverStyle] = useState<CoverStyle>("wave");
  const [selectedCustomerId, setSelectedCustomerId] = useState("c1");
  // 5B: Stable reference number per session (memoized once)
  const sessionRef = useRef(generateReferenceNumber() + `-${crypto.randomUUID().slice(0,4)}`);
  // 8A: Track if user manually edited Arabic pricing
  const [arabicDirty, setArabicDirty] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("3PL Warehousing Proposal");
  const [documentSubtitle, setDocumentSubtitle] = useState("");

  // Pricing rows
  const [pricingRows, setPricingRows] = useState<PricingRow[]>(getSamplePricingRows());

  // SLA rows
  const [slaRows, setSlaRows] = useState<SLAMatrixRow[]>(getSampleSLARows());

  // Terms
  const [terms, setTerms] = useState<TermItem[]>(SAMPLE_TERMS);

  // Gap 7: Editable notes
  const [notes, setNotes] = useState<string[]>([
    "All prices are exclusive of VAT (15%) unless otherwise stated.",
    "Rates are valid for 30 days from the date of this proposal.",
    "Minimum charges apply as specified in the pricing table.",
    "Additional services not listed above will be quoted separately.",
  ]);

  // Gap 5: Section content editing (Introduction & Scope)
  const [introContentEn, setIntroContentEn] = useState("");
  const [introContentAr, setIntroContentAr] = useState("");
  const [scopeContentEn, setScopeContentEn] = useState("");
  const [scopeContentAr, setScopeContentAr] = useState("");

  // Gap 1: Section toggle overrides
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, boolean>>({});

  // Translation bot state
  const [translationInput, setTranslationInput] = useState("");
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [dictSearch, setDictSearch] = useState("");
  const [dictCategory, setDictCategory] = useState<TranslationCategory | "all">("all");
  const [dictResults, setDictResults] = useState<DictionaryEntry[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState("preview");
  const [showSections, setShowSections] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Gap 6: Reset section overrides when template changes
  useEffect(() => {
    setSectionOverrides({});
  }, [selectedTemplateId]);

  const templates = fetchPDFTemplates();
  const selectedTemplate = getPDFTemplate(selectedTemplateId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const dictStats = getDictionaryStats();

  // Gap 1: Helper to check if a section is enabled (overrides > template defaults)
  const isSectionEnabled = (sectionId: string, templateEnabled: boolean) => {
    if (sectionId in sectionOverrides) return sectionOverrides[sectionId];
    return templateEnabled;
  };

  // Build render context
  const renderContext = useMemo<PDFRenderContext | null>(() => {
    if (!selectedTemplate) return null;
    
    const sectionsData: Record<string, PDFSectionData> = {
      cover: { type: "cover" },
      confidentiality: { type: "confidentiality" },
      introduction: { type: "introduction", content_html: introContentEn || undefined, content_html_ar: introContentAr || undefined },
      scope: { type: "scope_of_work", content_html: scopeContentEn || undefined, content_html_ar: scopeContentAr || undefined },
      pricing: { type: "pricing_table", pricing_rows: pricingRows },
      sla_matrix: { type: "sla_matrix", sla_rows: slaRows },
      terms: { type: "terms_and_conditions", terms },
      commercial_terms: { type: "commercial_terms", terms },
      legal: { type: "legal_clauses", terms },
      signature: { type: "signature" },
      notes: { type: "notes", notes },
    };

    // Gap 1: Apply section overrides to the template
    const overriddenTemplate = {
      ...selectedTemplate,
      cover_style: coverStyle,
      sections: selectedTemplate.sections.map(s => ({
        ...s,
        enabled: isSectionEnabled(s.id, s.enabled),
      })),
    };

    return {
      template: overriddenTemplate,
      branding: HALA_BRANDING,
      watermark,
      language,
      document_title: documentTitle,
      document_subtitle: documentSubtitle,
      customer_name: selectedCustomer?.name || "Customer",
      customer_name_ar: translateToArabic(selectedCustomer?.name || "Customer").translated,
      customer_logo_url: "",
      reference_number: sessionRef.current,
      date: new Date().toISOString(),
      sections_data: sectionsData,
    };
  }, [selectedTemplate, coverStyle, watermark, language, documentTitle, documentSubtitle, selectedCustomer, pricingRows, slaRows, terms, notes, introContentEn, introContentAr, scopeContentEn, scopeContentAr, sectionOverrides]);

  // Generate HTML preview
  const previewHTML = useMemo(() => {
    if (!renderContext) return "<p>Select a template to begin.</p>";
    return renderPDFHTML(renderContext);
  }, [renderContext]);

  // Update iframe
  useEffect(() => {
    if (previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHTML);
        doc.close();
      }
    }
  }, [previewHTML]);

  // Translation bot handler
  const handleTranslate = useCallback(() => {
    if (!translationInput.trim()) return;
    const result = translateToArabic(translationInput.trim());
    setTranslationResult(result);
  }, [translationInput]);

  // Dictionary search
  useEffect(() => {
    if (dictSearch.trim().length > 0) {
      const cat = dictCategory === "all" ? undefined : dictCategory;
      setDictResults(searchDictionary(dictSearch, cat));
    } else {
      setDictResults([]);
    }
  }, [dictSearch, dictCategory]);

  // Auto-translate pricing rows when switching to dual — 8A: protect manual Arabic edits
  const handleLanguageChange = (lang: LanguageMode) => {
    setLanguage(lang);
    if (lang === "dual" || lang === "ar") {
      if (arabicDirty) {
        const overwrite = window.confirm(
          "You have manually edited Arabic pricing descriptions.\n\n" +
          "Auto-translate will overwrite your changes. Proceed?"
        );
        if (!overwrite) return;
      }
      // Auto-translate pricing rows
      const translated = translatePricingRows(pricingRows.map(r => ({ description: r.description, unit: r.unit })));
      setPricingRows(prev => prev.map((row, i) => ({
        ...row,
        description_ar: translated[i]?.description_ar || "",
        unit_ar: translated[i]?.unit_ar || "",
      })));
      setArabicDirty(false);
      toast.success("Auto-translated pricing rows to Arabic");
    }
  };

  // Download HTML — with pre-download validation
  const handleDownload = useCallback(() => {
    // 1B: Warn on zero-rate rows
    const zeroRateRows = pricingRows.filter(r => r.rate === 0 && !r.is_total && !r.is_vat);
    if (zeroRateRows.length > 0) {
      const proceed = window.confirm(
        `Warning: ${zeroRateRows.length} pricing row(s) have a rate of SAR 0.00.\n\n` +
        zeroRateRows.map(r => `• ${r.description}`).join('\n') +
        '\n\nProceed with download?'
      );
      if (!proceed) return;
    }
    setGenerating(true);
    setTimeout(() => {
      // Use iframe content for reliable download (previewHTML may be stale in closure)
      let htmlContent = previewHTML;
      if (previewRef.current?.contentDocument) {
        htmlContent = '<!DOCTYPE html>' + previewRef.current.contentDocument.documentElement.outerHTML;
      }
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentTitle.replace(/\s+/g, "_")}_${language}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (renderContext) {
        logPDFGeneration({
          templateId: selectedTemplateId,
          docType: selectedTemplate?.doc_type || "quote",
          customerName: selectedCustomer?.name || "Customer",
          language,
          watermark,
        });
      }

      toast.success("PDF document downloaded", {
        description: "Open the HTML file in your browser and use Print → Save as PDF for a professional PDF output.",
      });
      setGenerating(false);
    }, 500);
  }, [previewHTML, documentTitle, language, renderContext, selectedTemplateId, selectedTemplate, selectedCustomer, watermark, pricingRows]);

  // Print preview
  const handlePrint = useCallback(() => {
    if (previewRef.current?.contentWindow) {
      previewRef.current.contentWindow.print();
    }
  }, []);

  // Page navigation helpers
  const scrollToPage = useCallback((pageNum: number) => {
    if (!previewRef.current?.contentDocument) return;
    const doc = previewRef.current.contentDocument;
    const pages = doc.querySelectorAll('.cover-page, .content-page');
    if (pages[pageNum - 1]) {
      pages[pageNum - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(pageNum);
    }
  }, []);

  // Track scroll position to update current page indicator
  useEffect(() => {
    const iframe = previewRef.current;
    if (!iframe?.contentDocument) return;
    const doc = iframe.contentDocument;
    const pages = doc.querySelectorAll('.cover-page, .content-page');
    setTotalPages(pages.length);

    const handleScroll = () => {
      const scrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
      let page = 1;
      pages.forEach((p, i) => {
        const el = p as HTMLElement;
        if (scrollTop >= el.offsetTop - 100) page = i + 1;
      });
      setCurrentPage(page);
    };

    const win = iframe.contentWindow;
    if (win) {
      win.addEventListener('scroll', handleScroll);
      // Initial count
      setTimeout(() => {
        setTotalPages(doc.querySelectorAll('.cover-page, .content-page').length);
      }, 300);
      return () => win.removeEventListener('scroll', handleScroll);
    }
  }, [previewHTML]);

  // Pricing row management
  const addPricingRow = () => {
    setPricingRows(prev => [...prev, {
      no: prev.length + 1,
      description: "New Service",
      unit: "Per Unit",
      rate: 0,
    }]);
  };

  const removePricingRow = (index: number) => {
    setPricingRows(prev => prev.filter((_, i) => i !== index));
  };

  // 1D: Properly typed value parameter instead of 'any'
  const updatePricingRow = (index: number, field: keyof PricingRow, value: string | number | boolean | undefined) => {
    setPricingRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  // Gap 2: SLA row management
  const addSlaRow = () => {
    setSlaRows(prev => [...prev, {
      metric: "New Metric",
      metric_ar: "",
      target: "99%",
      measurement: "Monthly",
      penalty: "As per SLA terms",
      severity: "medium" as const,
    }]);
  };

  const removeSlaRow = (index: number) => {
    setSlaRows(prev => prev.filter((_, i) => i !== index));
  };

  // Gap 3: Terms management
  const addTerm = () => {
    setTerms(prev => [...prev, {
      number: `${prev.length + 1}.`,
      title_en: "New Clause",
      title_ar: "بند جديد",
      content_en: "",
      content_ar: "",
    }]);
  };

  const removeTerm = (index: number) => {
    setTerms(prev => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, number: `${i + 1}.` })));
  };

  // Gap 4: Auto-computed pricing summary
  const pricingSubtotal = pricingRows.filter(r => !r.is_total && !r.is_vat).reduce((sum, r) => sum + r.rate, 0);
  const pricingVAT = pricingSubtotal * 0.15;
  const pricingGrandTotal = pricingSubtotal + pricingVAT;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-3">
            <Printer className="w-6 h-6 text-blue-600" />
            PDF Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Professional document generation with dual-language support
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" /> Print
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download HTML
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* ═══ LEFT PANEL — Controls ═══ */}
        <div className="space-y-4">
          {/* Template & Customer */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" /> Document Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Template</label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.doc_type.replace(/_/g, " ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Customer</label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Document Title</label>
                <Input
                  value={documentTitle}
                  onChange={e => setDocumentTitle(e.target.value)}
                  className="h-9"
                  placeholder="e.g. 3PL Warehousing Proposal"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Subtitle (optional)</label>
                <Input
                  value={documentSubtitle}
                  onChange={e => setDocumentSubtitle(e.target.value)}
                  className="h-9"
                  placeholder="e.g. Jeddah Warehouse Facility"
                />
              </div>
            </CardContent>
          </Card>

          {/* Style & Language */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4" /> Style & Language
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Language Mode</label>
                <div className="flex gap-1">
                  {(["en", "ar", "dual"] as LanguageMode[]).map(l => (
                    <Button
                      key={l}
                      variant={language === l ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => handleLanguageChange(l)}
                    >
                      {l === "en" ? "English" : l === "ar" ? "العربية" : "Dual EN/AR"}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Cover Style</label>
                <Select value={coverStyle} onValueChange={v => setCoverStyle(v as CoverStyle)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wave">Wave Gradient (Navy)</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="corporate">Corporate Border</SelectItem>
                    <SelectItem value="none">No Cover Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Watermark</label>
                <div className="flex gap-1">
                  {(["none", "draft", "confidential", "final"] as WatermarkMode[]).map(w => (
                    <Button
                      key={w}
                      variant={watermark === w ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-8 text-xs capitalize"
                      onClick={() => setWatermark(w)}
                    >
                      {w === "none" ? "None" : w}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section Manager */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setShowSections(!showSections)}
              >
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Sections ({selectedTemplate?.sections.filter(s => isSectionEnabled(s.id, s.enabled)).length || 0})
                </CardTitle>
                {showSections ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </CardHeader>
            {showSections && selectedTemplate && (
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {selectedTemplate.sections
                    .sort((a, b) => a.order - b.order)
                    .map(section => {
                      const enabled = isSectionEnabled(section.id, section.enabled);
                      return (
                      <div key={section.id} className="flex items-center gap-2 p-2 rounded-md border border-border">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-medium truncate block ${!enabled ? 'line-through text-muted-foreground' : ''}`}>{section.title_en}</span>
                          {language !== "en" && (
                            <span className="text-[10px] text-muted-foreground block" dir="rtl">{section.title_ar}</span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {section.type.replace(/_/g, " ")}
                        </Badge>
                        <button
                          onClick={() => setSectionOverrides(prev => ({ ...prev, [section.id]: !enabled }))}
                          className={`w-3 h-3 rounded-full border-2 cursor-pointer transition-colors ${enabled ? 'bg-emerald-500 border-emerald-600' : 'bg-gray-200 border-gray-300'}`}
                          title={enabled ? 'Click to disable section' : 'Click to enable section'}
                        />
                      </div>
                    );})}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Arabic Translation Bot */}
          <Card className="border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Languages className="w-4 h-4 text-emerald-600" />
                Arabic Translation Bot
                <Badge variant="outline" className="text-[9px] ml-auto">{dictStats.total} terms</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Translation input */}
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Translate English → Arabic</label>
                <div className="flex gap-1.5">
                  <Input
                    value={translationInput}
                    onChange={e => setTranslationInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleTranslate()}
                    placeholder="e.g. warehouse management system"
                    className="h-9 text-xs"
                  />
                  <Button size="sm" className="h-9 px-3" onClick={handleTranslate}>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Translation result */}
              {translationResult && (
                <div className="p-3 rounded-md border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={`text-[9px] ${
                      translationResult.confidence === "high" ? "border-emerald-300 text-emerald-700" :
                      translationResult.confidence === "medium" ? "border-amber-300 text-amber-700" :
                      "border-red-300 text-red-700"
                    }`}>
                      {translationResult.confidence} confidence
                    </Badge>
                    <Badge variant="outline" className="text-[9px]">{translationResult.method}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">English:</p>
                  <p className="text-sm font-medium mb-2">{translationResult.original}</p>
                  <p className="text-xs text-muted-foreground mb-1">Arabic:</p>
                  <p className="text-sm font-medium" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic', 'Traditional Arabic', sans-serif" }}>
                    {translationResult.translated}
                  </p>
                  {translationResult.untranslated_terms.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-[10px] text-amber-600">
                        Untranslated: {translationResult.untranslated_terms.join(", ")}
                      </p>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(translationResult.translated);
                      toast.success("Arabic text copied to clipboard");
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copy Arabic
                  </Button>
                </div>
              )}

              {/* Dictionary browser */}
              <div className="pt-2 border-t border-border">
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  <BookOpen className="w-3 h-3 inline mr-1" />
                  Dictionary Browser
                </label>
                <div className="flex gap-1.5 mb-2">
                  <Input
                    value={dictSearch}
                    onChange={e => setDictSearch(e.target.value)}
                    placeholder="Search terms..."
                    className="h-8 text-xs"
                  />
                  <Select value={dictCategory} onValueChange={v => setDictCategory(v as any)}>
                    <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {getTranslationCategories().map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {dictResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {dictResults.slice(0, 20).map((entry, i) => (
                      <div key={i} className="flex items-center justify-between p-1.5 rounded text-xs border border-border/50 hover:bg-muted/50">
                        <span className="font-medium">{entry.en}</span>
                        <span className="text-muted-foreground" dir="rtl" style={{ fontFamily: "'Noto Naskh Arabic', sans-serif" }}>
                          {entry.ar}
                        </span>
                      </div>
                    ))}
                    {dictResults.length > 20 && (
                      <p className="text-[10px] text-muted-foreground text-center py-1">
                        +{dictResults.length - 20} more results
                      </p>
                    )}
                  </div>
                )}
                {dictSearch && dictResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No matching terms found</p>
                )}
              </div>

              {/* Category stats */}
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground mb-1.5">Dictionary Coverage</p>
                <div className="grid grid-cols-3 gap-1">
                  {Object.entries(dictStats.categories).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, count]) => (
                    <div key={cat} className="text-center p-1.5 rounded bg-muted/30">
                      <p className="text-xs font-bold data-value">{count}</p>
                      <p className="text-[9px] text-muted-foreground capitalize">{cat}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ RIGHT PANEL — Preview & Editors ═══ */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="preview" className="gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Preview
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Content
              </TabsTrigger>
              <TabsTrigger value="pricing" className="gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Pricing Table
              </TabsTrigger>
              <TabsTrigger value="sla" className="gap-1.5">
                <FileSignature className="w-3.5 h-3.5" /> SLA Matrix
              </TabsTrigger>
              <TabsTrigger value="terms" className="gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Terms
              </TabsTrigger>
            </TabsList>

            {/* ── Preview Tab ── */}
            <TabsContent value="preview">
              <Card className="border border-border shadow-none">
                <CardContent className="p-0">
                  {/* ── Top toolbar with document info ── */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {selectedTemplate?.doc_type.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {language === "en" ? "English" : language === "ar" ? "Arabic" : "Dual EN/AR"}
                      </Badge>
                      {watermark !== "none" && (
                        <Badge variant="outline" className="text-[10px] capitalize">{watermark}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Page navigation */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage <= 1}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <span className="text-[10px] font-medium text-muted-foreground min-w-[60px] text-center">
                          Page {currentPage} / {totalPages || '...'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage >= totalPages}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                      {/* Zoom controls */}
                      <div className="flex items-center gap-1 border-l border-border pl-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                        >
                          <ZoomOut className="w-3 h-3" />
                        </Button>
                        <span className="text-[10px] font-medium text-muted-foreground min-w-[32px] text-center">
                          {previewZoom}%
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                        >
                          <ZoomIn className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-[10px] text-muted-foreground border-l border-border pl-3">
                        Ref: {sessionRef.current}
                      </span>
                    </div>
                  </div>

                  {/* ── Quick page jump bar ── */}
                  {totalPages > 0 && (
                    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border bg-muted/10 overflow-x-auto">
                      <span className="text-[9px] text-muted-foreground font-medium mr-1 shrink-0">Jump to:</span>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollToPage(i + 1)}
                          className={`text-[9px] px-2 py-0.5 rounded-sm transition-colors shrink-0 ${
                            currentPage === i + 1
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {i === 0 ? 'Cover' : `P${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── PDF Preview iframe ── */}
                  <div className="relative bg-neutral-100">
                    <iframe
                      ref={previewRef}
                      className="w-full border-0 mx-auto block"
                      style={{
                        height: "calc(100vh - 240px)",
                        minHeight: "700px",
                        transform: `scale(${previewZoom / 100})`,
                        transformOrigin: 'top center',
                        width: `${10000 / previewZoom}%`,
                      }}
                      title="PDF Preview"
                      sandbox="allow-same-origin"
                    />
                    {/* Scroll hint overlay on first load */}
                    {currentPage === 1 && totalPages > 1 && (
                      <div
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white px-4 py-2 rounded-full text-xs cursor-pointer hover:bg-black/90 transition-colors animate-bounce"
                        onClick={() => scrollToPage(2)}
                      >
                        <ChevronsUpDown className="w-3.5 h-3.5" />
                        Scroll down or click to see document pages ({totalPages} pages)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Content Editor (Gap 5 + 7) ── */}
            <TabsContent value="content">
              <div className="space-y-4">
                {/* Introduction */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Introduction</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Leave blank to use the default Hala SCS introduction text</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <textarea
                      value={introContentEn}
                      onChange={e => setIntroContentEn(e.target.value)}
                      className="w-full text-xs p-3 border border-border rounded resize-none bg-background min-h-[80px]"
                      placeholder="Custom introduction text (English)... Leave empty for default."
                      rows={3}
                    />
                    {language !== "en" && (
                      <textarea
                        value={introContentAr}
                        onChange={e => setIntroContentAr(e.target.value)}
                        className="w-full text-xs p-3 border border-border rounded resize-none bg-background min-h-[80px] text-right"
                        dir="rtl"
                        style={{ fontFamily: "'Noto Naskh Arabic', sans-serif" }}
                        placeholder="نص المقدمة المخصص (عربي)..."
                        rows={3}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Scope of Work */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Scope of Work</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Leave blank to use the default scope of work items</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <textarea
                      value={scopeContentEn}
                      onChange={e => setScopeContentEn(e.target.value)}
                      className="w-full text-xs p-3 border border-border rounded resize-none bg-background min-h-[80px]"
                      placeholder="Custom scope of work (English)... Leave empty for default."
                      rows={4}
                    />
                    {language !== "en" && (
                      <textarea
                        value={scopeContentAr}
                        onChange={e => setScopeContentAr(e.target.value)}
                        className="w-full text-xs p-3 border border-border rounded resize-none bg-background min-h-[80px] text-right"
                        dir="rtl"
                        style={{ fontFamily: "'Noto Naskh Arabic', sans-serif" }}
                        placeholder="نطاق العمل المخصص (عربي)..."
                        rows={4}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Notes</CardTitle>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNotes(prev => [...prev, ""])}>
                        <Plus className="w-3 h-3 mr-1" /> Add Note
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {notes.map((note, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={note}
                          onChange={e => setNotes(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                          className="h-8 text-xs flex-1"
                          placeholder={`Note ${i + 1}...`}
                        />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No notes. Click "Add Note" to add one.</p>}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Pricing Table Editor ── */}
            <TabsContent value="pricing">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Pricing Rows</CardTitle>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addPricingRow}>
                      <Plus className="w-3 h-3 mr-1" /> Add Row
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 font-medium text-muted-foreground w-10">#</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Description</th>
                          <th className="text-left p-2 font-medium text-muted-foreground w-32">Unit</th>
                          <th className="text-right p-2 font-medium text-muted-foreground w-24">Rate (SAR)</th>
                          <th className="text-right p-2 font-medium text-muted-foreground w-24">Option 2</th>
                          <th className="p-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingRows.map((row, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-2 text-muted-foreground">{row.no || "-"}</td>
                            <td className="p-2">
                              <Input
                                value={row.description}
                                onChange={e => updatePricingRow(i, "description", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.unit}
                                onChange={e => updatePricingRow(i, "unit", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={row.rate}
                                onChange={e => updatePricingRow(i, "rate", Math.max(0, parseFloat(e.target.value) || 0))}
                                className="h-7 text-xs text-right"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                value={row.rate_option2 || ""}
                                onChange={e => { const v = parseFloat(e.target.value); updatePricingRow(i, "rate_option2", !isNaN(v) ? Math.max(0, v) : undefined); }}
                                className="h-7 text-xs text-right"
                                placeholder="-"
                              />
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => removePricingRow(i)}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {language !== "en" && (
                    <div className="mt-3 p-2 rounded-md bg-blue-50 border border-blue-200">
                      <p className="text-xs text-blue-700 flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5" />
                        Arabic translations are auto-generated from the description using the Translation Bot dictionary.
                      </p>
                    </div>
                  )}
                  {/* Gap 4: Pricing Summary */}
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex justify-end">
                      <div className="w-64 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">{formatSARPdf(pricingSubtotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">VAT (15%):</span>
                          <span className="font-medium">{formatSARPdf(pricingVAT)}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-border pt-1.5">
                          <span className="font-semibold">Grand Total:</span>
                          <span className="font-bold text-emerald-700">{formatSARPdf(pricingGrandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SLA Matrix Editor ── */}
            <TabsContent value="sla">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">SLA Matrix</CardTitle>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSlaRow}>
                      <Plus className="w-3 h-3 mr-1" /> Add Row
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 font-medium text-muted-foreground">Metric</th>
                          {language !== "en" && <th className="text-right p-2 font-medium text-muted-foreground">المقياس</th>}
                          <th className="text-left p-2 font-medium text-muted-foreground w-24">Target</th>
                          <th className="text-left p-2 font-medium text-muted-foreground w-32">Measurement</th>
                          <th className="text-left p-2 font-medium text-muted-foreground w-40">Penalty</th>
                          <th className="text-center p-2 font-medium text-muted-foreground w-20">Severity</th>
                          <th className="p-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slaRows.map((row, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-2">
                              <Input
                                value={row.metric}
                                onChange={e => {
                                  const newRows = [...slaRows];
                                  newRows[i] = { ...newRows[i], metric: e.target.value };
                                  setSlaRows(newRows);
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            {language !== "en" && (
                              <td className="p-2">
                                <Input
                                  value={row.metric_ar || ""}
                                  onChange={e => {
                                    const newRows = [...slaRows];
                                    newRows[i] = { ...newRows[i], metric_ar: e.target.value };
                                    setSlaRows(newRows);
                                  }}
                                  className="h-7 text-xs text-right"
                                  dir="rtl"
                                  style={{ fontFamily: "'Noto Naskh Arabic', sans-serif" }}
                                />
                              </td>
                            )}
                            <td className="p-2">
                              <Input
                                value={row.target}
                                onChange={e => {
                                  const newRows = [...slaRows];
                                  newRows[i] = { ...newRows[i], target: e.target.value };
                                  setSlaRows(newRows);
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.measurement}
                                onChange={e => {
                                  const newRows = [...slaRows];
                                  newRows[i] = { ...newRows[i], measurement: e.target.value };
                                  setSlaRows(newRows);
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={row.penalty}
                                onChange={e => {
                                  const newRows = [...slaRows];
                                  newRows[i] = { ...newRows[i], penalty: e.target.value };
                                  setSlaRows(newRows);
                                }}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Select
                                value={row.severity}
                                onValueChange={v => {
                                  const newRows = [...slaRows];
                                  newRows[i] = { ...newRows[i], severity: v as SLAMatrixRow["severity"] };
                                  setSlaRows(newRows);
                                }}
                              >
                                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="critical">Critical</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeSlaRow(i)}>
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Terms Editor ── */}
            <TabsContent value="terms">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Terms & Conditions</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {terms.length} clauses
                      </Badge>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTerm}>
                        <Plus className="w-3 h-3 mr-1" /> Add Clause
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {terms.map((term, i) => (
                    <div key={i} className="p-3 rounded-md border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">{term.number}</Badge>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeTerm(i)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                        <Input
                          value={term.title_en}
                          onChange={e => {
                            const newTerms = [...terms];
                            newTerms[i] = { ...newTerms[i], title_en: e.target.value };
                            setTerms(newTerms);
                          }}
                          className="h-7 text-xs font-semibold flex-1"
                        />
                        {language !== "en" && (
                          <Input
                            value={term.title_ar}
                            onChange={e => {
                              const newTerms = [...terms];
                              newTerms[i] = { ...newTerms[i], title_ar: e.target.value };
                              setTerms(newTerms);
                            }}
                            className="h-7 text-xs flex-1 text-right"
                            dir="rtl"
                            style={{ fontFamily: "'Noto Naskh Arabic', sans-serif" }}
                          />
                        )}
                      </div>
                      <textarea
                        value={term.content_en}
                        onChange={e => {
                          const newTerms = [...terms];
                          newTerms[i] = { ...newTerms[i], content_en: e.target.value };
                          setTerms(newTerms);
                        }}
                        className="w-full text-xs p-2 border border-border rounded resize-none bg-background"
                        rows={2}
                      />
                      {language !== "en" && (
                        <textarea
                          value={term.content_ar}
                          onChange={e => {
                            const newTerms = [...terms];
                            newTerms[i] = { ...newTerms[i], content_ar: e.target.value };
                            setTerms(newTerms);
                          }}
                          className="w-full text-xs p-2 border border-border rounded resize-none bg-background mt-2 text-right"
                          dir="rtl"
                          style={{ fontFamily: "'Noto Naskh Arabic', sans-serif" }}
                          rows={2}
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
