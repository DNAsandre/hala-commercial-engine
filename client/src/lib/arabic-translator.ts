/**
 * Sprint 14C — Arabic Translation Bot
 * 
 * Client-side translation engine for commercial/logistics documents.
 * Provides:
 * - Comprehensive logistics/supply-chain dictionary (EN→AR)
 * - Sentence-level translation using dictionary + pattern matching
 * - SLA/contract term translation
 * - Number/currency formatting in Arabic
 * - RTL text handling utilities
 * 
 * NOTE: For production, this would integrate with a real translation API.
 * This implementation uses a curated dictionary approach for offline capability
 * and domain-specific accuracy in logistics/commercial terminology.
 */

// ============================================================
// TYPES
// ============================================================

export interface TranslationResult {
  original: string;
  translated: string;
  confidence: "high" | "medium" | "low";
  method: "dictionary" | "pattern" | "partial" | "passthrough";
  untranslated_terms: string[];
}

export interface TranslationBatch {
  items: TranslationResult[];
  overall_confidence: "high" | "medium" | "low";
  total_terms: number;
  translated_terms: number;
  coverage_percent: number;
}

export interface DictionaryEntry {
  en: string;
  ar: string;
  category: TranslationCategory;
  context?: string;
}

export type TranslationCategory =
  | "logistics"
  | "warehouse"
  | "transport"
  | "commercial"
  | "legal"
  | "financial"
  | "sla"
  | "general"
  | "company"
  | "measurement"
  | "time"
  | "document"
  | "action";

// ============================================================
// COMPREHENSIVE LOGISTICS DICTIONARY
// ============================================================

const DICTIONARY: DictionaryEntry[] = [
  // ─── COMPANY & BRANDING ─────────────────────────────────
  { en: "Hala Supply Chain Services", ar: "هلا لخدمات الإمدادات المساندة", category: "company" },
  { en: "Hala SCS", ar: "هلا للإمدادات", category: "company" },
  { en: "HSCS", ar: "هلا", category: "company" },
  { en: "Supply Chain Services", ar: "خدمات الإمدادات المساندة", category: "company" },
  { en: "Kingdom of Saudi Arabia", ar: "المملكة العربية السعودية", category: "company" },
  { en: "Saudi Arabia", ar: "المملكة العربية السعودية", category: "company" },
  { en: "Riyadh", ar: "الرياض", category: "company" },
  { en: "Jeddah", ar: "جدة", category: "company" },
  { en: "Dammam", ar: "الدمام", category: "company" },

  // ─── LOGISTICS CORE ─────────────────────────────────────
  { en: "supply chain", ar: "سلسلة الإمداد", category: "logistics" },
  { en: "logistics", ar: "الخدمات اللوجستية", category: "logistics" },
  { en: "third party logistics", ar: "الخدمات اللوجستية للطرف الثالث", category: "logistics" },
  { en: "3PL", ar: "طرف ثالث لوجستي", category: "logistics" },
  { en: "distribution", ar: "التوزيع", category: "logistics" },
  { en: "fulfillment", ar: "التنفيذ", category: "logistics" },
  { en: "last mile delivery", ar: "توصيل الميل الأخير", category: "logistics" },
  { en: "freight", ar: "الشحن", category: "logistics" },
  { en: "cargo", ar: "البضائع", category: "logistics" },
  { en: "shipment", ar: "الشحنة", category: "logistics" },
  { en: "consignment", ar: "الإرسالية", category: "logistics" },
  { en: "tracking", ar: "التتبع", category: "logistics" },
  { en: "routing", ar: "التوجيه", category: "logistics" },
  { en: "fleet management", ar: "إدارة الأسطول", category: "logistics" },
  { en: "cross-docking", ar: "العبور المباشر", category: "logistics" },
  { en: "reverse logistics", ar: "اللوجستيات العكسية", category: "logistics" },
  { en: "cold chain", ar: "سلسلة التبريد", category: "logistics" },
  { en: "supply chain management", ar: "إدارة سلسلة الإمداد", category: "logistics" },
  { en: "value added services", ar: "خدمات القيمة المضافة", category: "logistics" },
  { en: "VAS", ar: "خدمات القيمة المضافة", category: "logistics" },

  // ─── WAREHOUSE ──────────────────────────────────────────
  { en: "warehouse", ar: "المستودع", category: "warehouse" },
  { en: "warehousing", ar: "التخزين", category: "warehouse" },
  { en: "storage", ar: "التخزين", category: "warehouse" },
  { en: "temperature controlled storage", ar: "التخزين بدرجة حرارة مضبوطة", category: "warehouse" },
  { en: "cold storage", ar: "التخزين البارد", category: "warehouse" },
  { en: "ambient storage", ar: "التخزين في درجة حرارة الغرفة", category: "warehouse" },
  { en: "pallet", ar: "منصة نقالة", category: "warehouse" },
  { en: "pallet position", ar: "موقع المنصة النقالة", category: "warehouse" },
  { en: "racking", ar: "الأرفف", category: "warehouse" },
  { en: "inventory", ar: "المخزون", category: "warehouse" },
  { en: "stock", ar: "المخزون", category: "warehouse" },
  { en: "SKU", ar: "وحدة حفظ المخزون", category: "warehouse" },
  { en: "batch number", ar: "رقم الدفعة", category: "warehouse" },
  { en: "inbound", ar: "الوارد", category: "warehouse" },
  { en: "outbound", ar: "الصادر", category: "warehouse" },
  { en: "handling", ar: "المناولة", category: "warehouse" },
  { en: "handling in", ar: "مناولة الوارد", category: "warehouse" },
  { en: "handling out", ar: "مناولة الصادر", category: "warehouse" },
  { en: "picking", ar: "الانتقاء", category: "warehouse" },
  { en: "packing", ar: "التعبئة", category: "warehouse" },
  { en: "palletizing", ar: "التحميل على المنصات", category: "warehouse" },
  { en: "depalletizing", ar: "التفريغ من المنصات", category: "warehouse" },
  { en: "stretch wrap", ar: "التغليف بالبلاستيك", category: "warehouse" },
  { en: "labeling", ar: "وضع الملصقات", category: "warehouse" },
  { en: "WMS", ar: "نظام إدارة المستودعات", category: "warehouse" },
  { en: "warehouse management system", ar: "نظام إدارة المستودعات", category: "warehouse" },
  { en: "receiving", ar: "الاستلام", category: "warehouse" },
  { en: "dispatch", ar: "الإرسال", category: "warehouse" },
  { en: "case handling", ar: "مناولة الصناديق", category: "warehouse" },
  { en: "piece handling", ar: "مناولة القطع", category: "warehouse" },
  { en: "delayering", ar: "إزالة الطبقات", category: "warehouse" },
  { en: "relabeling", ar: "إعادة وضع الملصقات", category: "warehouse" },
  { en: "kitting", ar: "التجميع", category: "warehouse" },
  { en: "co-packing", ar: "التعبئة المشتركة", category: "warehouse" },
  { en: "shrink wrap", ar: "التغليف الحراري", category: "warehouse" },
  { en: "dock", ar: "رصيف التحميل", category: "warehouse" },
  { en: "loading bay", ar: "منطقة التحميل", category: "warehouse" },
  { en: "forklift", ar: "رافعة شوكية", category: "warehouse" },

  // ─── TRANSPORT ──────────────────────────────────────────
  { en: "transportation", ar: "النقل", category: "transport" },
  { en: "transport", ar: "النقل", category: "transport" },
  { en: "delivery", ar: "التوصيل", category: "transport" },
  { en: "vehicle", ar: "المركبة", category: "transport" },
  { en: "truck", ar: "الشاحنة", category: "transport" },
  { en: "trailer", ar: "المقطورة", category: "transport" },
  { en: "refrigerated truck", ar: "شاحنة مبردة", category: "transport" },
  { en: "driver", ar: "السائق", category: "transport" },
  { en: "route", ar: "المسار", category: "transport" },
  { en: "transit", ar: "العبور", category: "transport" },
  { en: "in transit", ar: "في الطريق", category: "transport" },
  { en: "proof of delivery", ar: "إثبات التسليم", category: "transport" },
  { en: "POD", ar: "إثبات التسليم", category: "transport" },
  { en: "bill of lading", ar: "بوليصة الشحن", category: "transport" },

  // ─── COMMERCIAL ─────────────────────────────────────────
  { en: "proposal", ar: "العرض", category: "commercial" },
  { en: "quotation", ar: "عرض السعر", category: "commercial" },
  { en: "quote", ar: "عرض السعر", category: "commercial" },
  { en: "commercial proposal", ar: "العرض التجاري", category: "commercial" },
  { en: "financial proposal", ar: "العرض المالي", category: "commercial" },
  { en: "scope of work", ar: "نطاق العمل", category: "commercial" },
  { en: "scope of services", ar: "نطاق الخدمات", category: "commercial" },
  { en: "pricing", ar: "التسعير", category: "commercial" },
  { en: "rate", ar: "السعر", category: "commercial" },
  { en: "unit price", ar: "سعر الوحدة", category: "commercial" },
  { en: "total", ar: "المجموع", category: "commercial" },
  { en: "subtotal", ar: "المجموع الفرعي", category: "commercial" },
  { en: "discount", ar: "الخصم", category: "commercial" },
  { en: "minimum charges", ar: "الحد الأدنى للرسوم", category: "commercial" },
  { en: "minimum pallet positions", ar: "الحد الأدنى لمواقع المنصات", category: "commercial" },
  { en: "unit of measure", ar: "وحدة القياس", category: "commercial" },
  { en: "per pallet", ar: "لكل منصة", category: "commercial" },
  { en: "per month", ar: "شهرياً", category: "commercial" },
  { en: "per case", ar: "لكل صندوق", category: "commercial" },
  { en: "per piece", ar: "لكل قطعة", category: "commercial" },
  { en: "per trip", ar: "لكل رحلة", category: "commercial" },
  { en: "per pallet per month", ar: "لكل منصة شهرياً", category: "commercial" },
  { en: "option", ar: "الخيار", category: "commercial" },
  { en: "tender", ar: "المناقصة", category: "commercial" },
  { en: "bid", ar: "العطاء", category: "commercial" },
  { en: "RFP", ar: "طلب تقديم العروض", category: "commercial" },
  { en: "RFQ", ar: "طلب عرض الأسعار", category: "commercial" },

  // ─── FINANCIAL ──────────────────────────────────────────
  { en: "SAR", ar: "ريال سعودي", category: "financial" },
  { en: "Saudi Riyal", ar: "ريال سعودي", category: "financial" },
  { en: "VAT", ar: "ضريبة القيمة المضافة", category: "financial" },
  { en: "value added tax", ar: "ضريبة القيمة المضافة", category: "financial" },
  { en: "invoice", ar: "الفاتورة", category: "financial" },
  { en: "payment", ar: "الدفع", category: "financial" },
  { en: "payment terms", ar: "شروط الدفع", category: "financial" },
  { en: "credit", ar: "الائتمان", category: "financial" },
  { en: "debit", ar: "المدين", category: "financial" },
  { en: "revenue", ar: "الإيرادات", category: "financial" },
  { en: "cost", ar: "التكلفة", category: "financial" },
  { en: "gross profit", ar: "الربح الإجمالي", category: "financial" },
  { en: "margin", ar: "الهامش", category: "financial" },
  { en: "budget", ar: "الميزانية", category: "financial" },
  { en: "capital", ar: "رأس المال", category: "financial" },

  // ─── LEGAL / CONTRACT ──────────────────────────────────
  { en: "agreement", ar: "الاتفاقية", category: "legal" },
  { en: "contract", ar: "العقد", category: "legal" },
  { en: "master services agreement", ar: "اتفاقية الخدمات الرئيسية", category: "legal" },
  { en: "MSA", ar: "اتفاقية الخدمات الرئيسية", category: "legal" },
  { en: "service order", ar: "طلب الخدمة", category: "legal" },
  { en: "terms and conditions", ar: "الشروط والأحكام", category: "legal" },
  { en: "terms & conditions", ar: "الشروط والأحكام", category: "legal" },
  { en: "effective date", ar: "تاريخ السريان", category: "legal" },
  { en: "expiry date", ar: "تاريخ الانتهاء", category: "legal" },
  { en: "termination", ar: "الإنهاء", category: "legal" },
  { en: "renewal", ar: "التجديد", category: "legal" },
  { en: "amendment", ar: "التعديل", category: "legal" },
  { en: "clause", ar: "البند", category: "legal" },
  { en: "article", ar: "المادة", category: "legal" },
  { en: "section", ar: "القسم", category: "legal" },
  { en: "liability", ar: "المسؤولية", category: "legal" },
  { en: "indemnification", ar: "التعويض", category: "legal" },
  { en: "force majeure", ar: "القوة القاهرة", category: "legal" },
  { en: "confidentiality", ar: "السرية", category: "legal" },
  { en: "confidential", ar: "سري", category: "legal" },
  { en: "non-disclosure", ar: "عدم الإفصاح", category: "legal" },
  { en: "dispute resolution", ar: "حل النزاعات", category: "legal" },
  { en: "arbitration", ar: "التحكيم", category: "legal" },
  { en: "governing law", ar: "القانون الحاكم", category: "legal" },
  { en: "jurisdiction", ar: "الاختصاص القضائي", category: "legal" },
  { en: "intellectual property", ar: "الملكية الفكرية", category: "legal" },
  { en: "warranty", ar: "الضمان", category: "legal" },
  { en: "penalty", ar: "الغرامة", category: "legal" },
  { en: "compliance", ar: "الامتثال", category: "legal" },
  { en: "authorized signatory", ar: "المفوض بالتوقيع", category: "legal" },
  { en: "duly authorized", ar: "مخول حسب الأصول", category: "legal" },
  { en: "party", ar: "الطرف", category: "legal" },
  { en: "first party", ar: "الطرف الأول", category: "legal" },
  { en: "second party", ar: "الطرف الثاني", category: "legal" },
  { en: "witness", ar: "الشاهد", category: "legal" },
  { en: "stamp", ar: "الختم", category: "legal" },
  { en: "company stamp", ar: "ختم الشركة", category: "legal" },

  // ─── SLA ────────────────────────────────────────────────
  { en: "service level agreement", ar: "اتفاقية مستوى الخدمة", category: "sla" },
  { en: "SLA", ar: "اتفاقية مستوى الخدمة", category: "sla" },
  { en: "SLA matrix", ar: "مصفوفة اتفاقية مستوى الخدمة", category: "sla" },
  { en: "KPI", ar: "مؤشر الأداء الرئيسي", category: "sla" },
  { en: "key performance indicator", ar: "مؤشر الأداء الرئيسي", category: "sla" },
  { en: "target", ar: "الهدف", category: "sla" },
  { en: "measurement", ar: "القياس", category: "sla" },
  { en: "severity", ar: "الخطورة", category: "sla" },
  { en: "critical", ar: "حرج", category: "sla" },
  { en: "high", ar: "عالي", category: "sla" },
  { en: "medium", ar: "متوسط", category: "sla" },
  { en: "low", ar: "منخفض", category: "sla" },
  { en: "order accuracy", ar: "دقة الطلبات", category: "sla" },
  { en: "on-time dispatch", ar: "التسليم في الوقت المحدد", category: "sla" },
  { en: "on-time delivery", ar: "التوصيل في الوقت المحدد", category: "sla" },
  { en: "inventory accuracy", ar: "دقة المخزون", category: "sla" },
  { en: "damage rate", ar: "معدل التلف", category: "sla" },
  { en: "inbound processing", ar: "معالجة الواردات", category: "sla" },
  { en: "customer response time", ar: "وقت استجابة العملاء", category: "sla" },
  { en: "system uptime", ar: "وقت تشغيل النظام", category: "sla" },
  { en: "downtime", ar: "وقت التوقف", category: "sla" },
  { en: "monthly audit", ar: "التدقيق الشهري", category: "sla" },
  { en: "weekly tracking", ar: "التتبع الأسبوعي", category: "sla" },
  { en: "quarterly count", ar: "الجرد الربع سنوي", category: "sla" },
  { en: "monthly report", ar: "التقرير الشهري", category: "sla" },
  { en: "per receipt", ar: "لكل استلام", category: "sla" },
  { en: "per inquiry", ar: "لكل استفسار", category: "sla" },

  // ─── DOCUMENT ───────────────────────────────────────────
  { en: "document", ar: "الوثيقة", category: "document" },
  { en: "cover page", ar: "صفحة الغلاف", category: "document" },
  { en: "table of contents", ar: "جدول المحتويات", category: "document" },
  { en: "introduction", ar: "المقدمة", category: "document" },
  { en: "confidentiality statement", ar: "بيان السرية", category: "document" },
  { en: "signature", ar: "التوقيع", category: "document" },
  { en: "annexure", ar: "الملحق", category: "document" },
  { en: "appendix", ar: "الملحق", category: "document" },
  { en: "reference", ar: "المرجع", category: "document" },
  { en: "version", ar: "الإصدار", category: "document" },
  { en: "draft", ar: "مسودة", category: "document" },
  { en: "final", ar: "نهائي", category: "document" },
  { en: "approved", ar: "معتمد", category: "document" },
  { en: "page", ar: "صفحة", category: "document" },
  { en: "of", ar: "من", category: "document" },
  { en: "note", ar: "ملاحظة", category: "document" },
  { en: "notes", ar: "ملاحظات", category: "document" },
  { en: "description", ar: "الوصف", category: "document" },
  { en: "completed by", ar: "أعدت بواسطة", category: "document" },
  { en: "date", ar: "التاريخ", category: "document" },
  { en: "prepared for", ar: "أعدت لـ", category: "document" },
  { en: "prepared by", ar: "أعدت بواسطة", category: "document" },

  // ─── SIGNATURE FIELDS ──────────────────────────────────
  { en: "name", ar: "الاسم", category: "document" },
  { en: "designation", ar: "المنصب", category: "document" },
  { en: "email", ar: "البريد الإلكتروني", category: "document" },
  { en: "phone", ar: "الهاتف", category: "document" },
  { en: "fax", ar: "الفاكس", category: "document" },
  { en: "address", ar: "العنوان", category: "document" },
  { en: "the customer", ar: "العميل", category: "document" },
  { en: "the provider", ar: "مقدم الخدمة", category: "document" },

  // ─── MEASUREMENT ────────────────────────────────────────
  { en: "square meter", ar: "متر مربع", category: "measurement" },
  { en: "sqm", ar: "متر مربع", category: "measurement" },
  { en: "square feet", ar: "قدم مربع", category: "measurement" },
  { en: "kilogram", ar: "كيلوغرام", category: "measurement" },
  { en: "kg", ar: "كغ", category: "measurement" },
  { en: "ton", ar: "طن", category: "measurement" },
  { en: "CBM", ar: "متر مكعب", category: "measurement" },
  { en: "cubic meter", ar: "متر مكعب", category: "measurement" },
  { en: "celsius", ar: "درجة مئوية", category: "measurement" },
  { en: "percent", ar: "بالمئة", category: "measurement" },

  // ─── TIME ───────────────────────────────────────────────
  { en: "daily", ar: "يومياً", category: "time" },
  { en: "weekly", ar: "أسبوعياً", category: "time" },
  { en: "monthly", ar: "شهرياً", category: "time" },
  { en: "quarterly", ar: "ربع سنوي", category: "time" },
  { en: "annually", ar: "سنوياً", category: "time" },
  { en: "year", ar: "سنة", category: "time" },
  { en: "month", ar: "شهر", category: "time" },
  { en: "day", ar: "يوم", category: "time" },
  { en: "hour", ar: "ساعة", category: "time" },
  { en: "hours", ar: "ساعات", category: "time" },
  { en: "business days", ar: "أيام عمل", category: "time" },

  // ─── ACTIONS ────────────────────────────────────────────
  { en: "approve", ar: "الموافقة", category: "action" },
  { en: "reject", ar: "الرفض", category: "action" },
  { en: "review", ar: "المراجعة", category: "action" },
  { en: "submit", ar: "التقديم", category: "action" },
  { en: "sign", ar: "التوقيع", category: "action" },
  { en: "generate", ar: "إنشاء", category: "action" },
  { en: "download", ar: "تحميل", category: "action" },
  { en: "print", ar: "طباعة", category: "action" },
  { en: "translate", ar: "ترجمة", category: "action" },
  { en: "export", ar: "تصدير", category: "action" },

  // ─── GENERAL ────────────────────────────────────────────
  { en: "customer", ar: "العميل", category: "general" },
  { en: "client", ar: "العميل", category: "general" },
  { en: "provider", ar: "مقدم الخدمة", category: "general" },
  { en: "service provider", ar: "مقدم الخدمة", category: "general" },
  { en: "company", ar: "الشركة", category: "general" },
  { en: "manager", ar: "المدير", category: "general" },
  { en: "director", ar: "المدير", category: "general" },
  { en: "CEO", ar: "الرئيس التنفيذي", category: "general" },
  { en: "COO", ar: "مدير العمليات", category: "general" },
  { en: "operations", ar: "العمليات", category: "general" },
  { en: "quality", ar: "الجودة", category: "general" },
  { en: "safety", ar: "السلامة", category: "general" },
  { en: "security", ar: "الأمن", category: "general" },
  { en: "insurance", ar: "التأمين", category: "general" },
  { en: "petrochemical", ar: "البتروكيماويات", category: "general" },
  { en: "healthcare", ar: "الرعاية الصحية", category: "general" },
  { en: "pharmaceutical", ar: "الأدوية", category: "general" },
  { en: "FMCG", ar: "السلع الاستهلاكية سريعة التداول", category: "general" },
  { en: "industrial", ar: "الصناعية", category: "general" },
  { en: "food and beverage", ar: "الأغذية والمشروبات", category: "general" },
  { en: "F&B", ar: "الأغذية والمشروبات", category: "general" },
  { en: "experience", ar: "الخبرة", category: "general" },
  { en: "solution", ar: "الحل", category: "general" },
  { en: "service", ar: "الخدمة", category: "general" },
  { en: "services", ar: "الخدمات", category: "general" },
  { en: "requirement", ar: "المتطلب", category: "general" },
  { en: "requirements", ar: "المتطلبات", category: "general" },
  { en: "specification", ar: "المواصفات", category: "general" },
  { en: "standard", ar: "المعيار", category: "general" },
  { en: "certificate", ar: "الشهادة", category: "general" },
  { en: "certification", ar: "الاعتماد", category: "general" },
  { en: "ISO", ar: "آيزو", category: "general" },
  { en: "HACCP", ar: "تحليل المخاطر ونقاط التحكم الحرجة", category: "general" },
  { en: "GDP", ar: "ممارسات التوزيع الجيد", category: "general" },
];

// Build lookup map sorted by length (longest first for greedy matching)
const SORTED_DICT = [...DICTIONARY].sort((a, b) => b.en.length - a.en.length);

// ============================================================
// TRANSLATION ENGINE
// ============================================================

/**
 * Translate a single English text to Arabic using dictionary matching.
 */
export function translateToArabic(text: string): TranslationResult {
  if (!text || text.trim().length === 0) {
    return { original: text, translated: text, confidence: "high", method: "passthrough", untranslated_terms: [] };
  }

  // Check for exact match first (case-insensitive)
  const exactMatch = SORTED_DICT.find(d => d.en.toLowerCase() === text.trim().toLowerCase());
  if (exactMatch) {
    return { original: text, translated: exactMatch.ar, confidence: "high", method: "dictionary", untranslated_terms: [] };
  }

  // Try phrase-level replacement (greedy, longest first)
  let result = text;
  let matchCount = 0;
  const totalWords = text.split(/\s+/).filter(w => w.length > 2).length;
  const untranslated: string[] = [];

  for (const entry of SORTED_DICT) {
    const regex = new RegExp(`\\b${escapeRegex(entry.en)}\\b`, "gi");
    if (regex.test(result)) {
      result = result.replace(regex, entry.ar);
      matchCount++;
    }
  }

  // Check coverage
  const remainingEnglish = result.match(/[a-zA-Z]{3,}/g) || [];
  untranslated.push(...remainingEnglish.filter(w => !["and", "the", "for", "per", "SAR", "ISO", "KSA", "LLC", "Co", "Ltd", "Inc", "No", "Ref"].includes(w)));

  const coverage = totalWords > 0 ? ((totalWords - untranslated.length) / totalWords) : 1;
  const confidence = coverage >= 0.8 ? "high" : coverage >= 0.5 ? "medium" : "low";
  const method = matchCount > 0 ? (untranslated.length === 0 ? "dictionary" : "partial") : "passthrough";

  return { original: text, translated: result, confidence, method, untranslated_terms: untranslated };
}

/**
 * Translate a batch of texts.
 */
export function translateBatch(texts: string[]): TranslationBatch {
  const items = texts.map(t => translateToArabic(t));
  const translated = items.filter(i => i.method !== "passthrough").length;
  const coverage = texts.length > 0 ? (translated / texts.length) * 100 : 100;
  const overallConfidence = coverage >= 80 ? "high" : coverage >= 50 ? "medium" : "low";

  return {
    items,
    overall_confidence: overallConfidence,
    total_terms: texts.length,
    translated_terms: translated,
    coverage_percent: Math.round(coverage),
  };
}

/**
 * Translate pricing row descriptions.
 */
export function translatePricingRows(rows: { description: string; unit: string }[]): { description_ar: string; unit_ar: string }[] {
  return rows.map(row => ({
    description_ar: translateToArabic(row.description).translated,
    unit_ar: translateToArabic(row.unit).translated,
  }));
}

/**
 * Translate SLA metric names.
 */
export function translateSLAMetrics(metrics: string[]): string[] {
  return metrics.map(m => translateToArabic(m).translated);
}

/**
 * Translate contract terms.
 */
export function translateTerms(terms: { title: string; content: string }[]): { title_ar: string; content_ar: string }[] {
  return terms.map(t => ({
    title_ar: translateToArabic(t.title).translated,
    content_ar: translateToArabic(t.content).translated,
  }));
}

// ============================================================
// NUMBER / CURRENCY FORMATTING (ARABIC)
// ============================================================

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/**
 * Convert Western digits to Arabic-Indic digits.
 */
export function toArabicDigits(num: string | number): string {
  return String(num).replace(/[0-9]/g, d => ARABIC_DIGITS[parseInt(d)]);
}

/**
 * Format SAR amount in Arabic.
 */
export function formatSARArabic(amount: number): string {
  const formatted = new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ريال`;
}

/**
 * Format percentage in Arabic.
 */
export function formatPercentArabic(value: number): string {
  return `${toArabicDigits(value.toFixed(1))}٪`;
}

// ============================================================
// DICTIONARY MANAGEMENT
// ============================================================

/**
 * Search the dictionary.
 */
export function searchDictionary(query: string, category?: TranslationCategory): DictionaryEntry[] {
  const q = query.toLowerCase();
  let results = DICTIONARY.filter(d =>
    d.en.toLowerCase().includes(q) || d.ar.includes(query)
  );
  if (category) results = results.filter(d => d.category === category);
  return results;
}

/**
 * Get all dictionary entries by category.
 */
export function getDictionaryByCategory(category: TranslationCategory): DictionaryEntry[] {
  return DICTIONARY.filter(d => d.category === category);
}

/**
 * Get dictionary statistics.
 */
export function getDictionaryStats(): { total: number; categories: Record<string, number> } {
  const categories: Record<string, number> = {};
  for (const entry of DICTIONARY) {
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  }
  return { total: DICTIONARY.length, categories };
}

/**
 * Get all available categories.
 */
export function getTranslationCategories(): { value: TranslationCategory; label: string; label_ar: string }[] {
  return [
    { value: "logistics", label: "Logistics", label_ar: "اللوجستيات" },
    { value: "warehouse", label: "Warehouse", label_ar: "المستودعات" },
    { value: "transport", label: "Transport", label_ar: "النقل" },
    { value: "commercial", label: "Commercial", label_ar: "التجاري" },
    { value: "legal", label: "Legal", label_ar: "القانوني" },
    { value: "financial", label: "Financial", label_ar: "المالي" },
    { value: "sla", label: "SLA", label_ar: "اتفاقية مستوى الخدمة" },
    { value: "general", label: "General", label_ar: "عام" },
    { value: "company", label: "Company", label_ar: "الشركة" },
    { value: "measurement", label: "Measurement", label_ar: "القياس" },
    { value: "time", label: "Time", label_ar: "الوقت" },
    { value: "document", label: "Document", label_ar: "الوثيقة" },
    { value: "action", label: "Action", label_ar: "الإجراء" },
  ];
}

// ============================================================
// UTILITIES
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
