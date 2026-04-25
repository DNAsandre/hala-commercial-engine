/*
 * Commercial Editor Shell — WYSIWYG Three-Mode Authoring
 * Three-mode doctrine: Structure → Draft → Canon
 * Connected to Quotes, Proposals, and SLAs
 * Features: Customer data linking, Compiled View, Block View, AI Staging
 * Design: Swiss Precision Instrument — deep navy accents, IBM Plex Sans
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Heading1, Heading2, Heading3,
  Table as TableIcon, Link as LinkIcon, Highlighter,
  Undo2, Redo2, FileText, Save, Lock,
  Sparkles, Send, ChevronDown, ChevronRight, Plus,
  Trash2, GripVertical, X, Download,
  BookOpen, FileCheck, FileSignature, ClipboardList,
  Layers, PenTool, Shield, LayoutTemplate, Wand2, Check,
  Building2, User, Phone, Mail, MapPin, DollarSign,
  Calendar, Hash, ToggleLeft, ToggleRight, Eye, Columns2
} from "lucide-react";
import { type Customer, formatSAR } from "@/lib/store";
import { useCustomers } from "@/hooks/useSupabase";

// ============================================================
// TYPES
// ============================================================

export type DocumentType = "quote" | "proposal" | "sla";
export type EditorMode = "structure" | "draft" | "canon";
export type ViewMode = "block" | "compiled";

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  isLocked: boolean;
  isAIGenerated: boolean;
  order: number;
  type: "heading" | "body" | "pricing" | "terms" | "kpi" | "scope" | "custom";
}

export interface EditorDocument {
  id: string;
  type: DocumentType;
  title: string;
  workspaceId: string;
  customerId: string;
  customerName: string;
  version: number;
  sections: DocumentSection[];
  createdAt: string;
  updatedAt: string;
  status: "draft" | "review" | "approved" | "canon";
}

// ============================================================
// TEMPLATES
// ============================================================

const QUOTE_TEMPLATE: DocumentSection[] = [
  { id: "qt1", title: "Cover & Reference", content: "<h1>Commercial Quotation</h1><p><strong>Ref:</strong> HCS-Q-2026-XXX</p><p><strong>Date:</strong> [Date]</p><p><strong>Valid Until:</strong> [Date + 30 days]</p><p>Dear [Client Name],</p><p>Thank you for the opportunity to present our warehousing and logistics services quotation. Hala Supply Chain Services is pleased to offer the following commercial terms for your consideration.</p>", isLocked: false, isAIGenerated: false, order: 1, type: "heading" },
  { id: "qt2", title: "Scope of Services", content: "<h2>1. Scope of Services</h2><ul><li><strong>Warehousing:</strong> Ambient/temperature-controlled pallet storage with WMS integration</li><li><strong>Inbound:</strong> Container devanning, goods receipt, quality inspection, putaway</li><li><strong>Outbound:</strong> Order processing, pick-pack-ship, carrier management</li><li><strong>VAS:</strong> Labeling, kitting, co-packing, returns processing</li></ul>", isLocked: false, isAIGenerated: false, order: 2, type: "scope" },
  { id: "qt3", title: "Pricing Schedule", content: "<h2>2. Pricing Schedule</h2><table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th><th>Est. Volume</th><th>Monthly (SAR)</th></tr></thead><tbody><tr><td>Pallet Storage</td><td>Per pallet/day</td><td>0.00</td><td>0</td><td>0.00</td></tr><tr><td>Inbound Handling</td><td>Per pallet</td><td>0.00</td><td>0</td><td>0.00</td></tr><tr><td>Outbound Handling</td><td>Per pallet</td><td>0.00</td><td>0</td><td>0.00</td></tr><tr><td>VAS</td><td>Various</td><td>-</td><td>-</td><td>0.00</td></tr></tbody></table><p><strong>Estimated Monthly Total: SAR 0.00</strong></p><p><strong>Estimated Annual Total: SAR 0.00</strong></p>", isLocked: false, isAIGenerated: false, order: 3, type: "pricing" },
  { id: "qt4", title: "Terms & Conditions", content: "<h2>3. Terms & Conditions</h2><ul><li><strong>Payment Terms:</strong> Net 30 days from invoice date</li><li><strong>Contract Duration:</strong> [X] months from commencement date</li><li><strong>Rate Review:</strong> Annual review subject to CPI adjustment</li><li><strong>Minimum Commitment:</strong> [X] pallets per month</li><li><strong>Insurance:</strong> Standard warehouse liability coverage included</li></ul>", isLocked: false, isAIGenerated: false, order: 4, type: "terms" },
  { id: "qt5", title: "Validity & Acceptance", content: "<h2>4. Validity & Acceptance</h2><p>This quotation is valid for 30 days from the date of issue. To accept, please sign and return a copy of this document.</p><p>We look forward to the opportunity to serve your logistics needs.</p><p><strong>Authorized Signatory — Hala Supply Chain Services</strong></p><p>Name: _______________</p><p>Title: _______________</p><p>Date: _______________</p>", isLocked: false, isAIGenerated: false, order: 5, type: "terms" },
];

const PROPOSAL_TEMPLATE: DocumentSection[] = [
  { id: "pr1", title: "Executive Summary", content: "<h1>Commercial Proposal</h1><h2>Executive Summary</h2><p>Hala Supply Chain Services is pleased to present this comprehensive warehousing and logistics proposal. Our solution is designed to optimize your supply chain operations, reduce costs, and improve service levels across the Kingdom.</p>", isLocked: false, isAIGenerated: false, order: 1, type: "heading" },
  { id: "pr2", title: "Company Overview", content: "<h2>1. Company Overview</h2><p>Hala Supply Chain Services is a leading third-party logistics provider in Saudi Arabia, operating state-of-the-art facilities across the Eastern, Central, and Western regions. With over two decades of experience, we serve major clients across petrochemical, FMCG, healthcare, and industrial sectors.</p>", isLocked: false, isAIGenerated: false, order: 2, type: "body" },
  { id: "pr3", title: "Understanding of Requirements", content: "<h2>2. Understanding of Requirements</h2><p>[Client Name] requires a comprehensive warehousing and distribution solution that addresses the following key needs:</p><ul><li>Secure, temperature-controlled storage capacity</li><li>Efficient inbound and outbound operations</li><li>Real-time inventory visibility and reporting</li><li>Scalable solution to accommodate growth</li></ul>", isLocked: false, isAIGenerated: false, order: 3, type: "scope" },
  { id: "pr4", title: "Proposed Solution", content: "<h2>3. Proposed Solution</h2><p>Our proposed solution leverages our facility infrastructure, advanced WMS technology, and dedicated operational team to deliver:</p><ul><li><strong>Dedicated Storage:</strong> [X] pallet positions in our [Facility] warehouse</li><li><strong>WMS Integration:</strong> Real-time inventory management with client portal access</li><li><strong>Dedicated Team:</strong> Trained warehouse staff with industry-specific expertise</li><li><strong>MHE Fleet:</strong> Modern material handling equipment for efficient operations</li></ul>", isLocked: false, isAIGenerated: false, order: 4, type: "body" },
  { id: "pr5", title: "Commercial Terms", content: "<h2>4. Commercial Terms</h2><table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th></tr></thead><tbody><tr><td>Pallet Storage</td><td>Per pallet/day</td><td>0.00</td></tr><tr><td>Inbound Handling</td><td>Per pallet</td><td>0.00</td></tr><tr><td>Outbound Handling</td><td>Per pallet</td><td>0.00</td></tr></tbody></table>", isLocked: false, isAIGenerated: false, order: 5, type: "pricing" },
  { id: "pr6", title: "Implementation Timeline", content: "<h2>5. Implementation Timeline</h2><table><thead><tr><th>Phase</th><th>Activity</th><th>Duration</th><th>Owner</th></tr></thead><tbody><tr><td>Phase 1</td><td>Contract Signing & Kick-off</td><td>Week 1</td><td>Commercial Team</td></tr><tr><td>Phase 2</td><td>Facility Preparation</td><td>Week 2-3</td><td>Operations</td></tr><tr><td>Phase 3</td><td>WMS Configuration & Testing</td><td>Week 3-4</td><td>IT / Operations</td></tr><tr><td>Phase 4</td><td>Go-Live</td><td>Week 5</td><td>Joint Team</td></tr></tbody></table>", isLocked: false, isAIGenerated: false, order: 6, type: "body" },
  { id: "pr7", title: "SLA Framework", content: "<h2>6. Service Level Framework</h2><table><thead><tr><th>KPI</th><th>Target</th><th>Measurement</th></tr></thead><tbody><tr><td>Inventory Accuracy</td><td>≥ 99.5%</td><td>Monthly cycle count</td></tr><tr><td>Order Fulfillment</td><td>≥ 98%</td><td>Same-day dispatch</td></tr><tr><td>Goods Receipt</td><td>≤ 4 hours</td><td>From truck arrival</td></tr></tbody></table>", isLocked: false, isAIGenerated: false, order: 7, type: "kpi" },
];

const SLA_TEMPLATE: DocumentSection[] = [
  { id: "sl1", title: "SLA Header", content: "<h1>Service Level Agreement</h1><p><strong>Between:</strong> Hala Supply Chain Services (\"Service Provider\")</p><p><strong>And:</strong> [Client Name] (\"Client\")</p><p><strong>Effective Date:</strong> [Date]</p><p><strong>Agreement Reference:</strong> HCS-SLA-2026-XXX</p>", isLocked: false, isAIGenerated: false, order: 1, type: "heading" },
  { id: "sl2", title: "Service Description", content: "<h2>1. Service Description</h2><p>This SLA defines the service levels, performance metrics, and remediation procedures for the warehousing and logistics services provided by Hala Supply Chain Services under the Master Service Agreement.</p>", isLocked: false, isAIGenerated: false, order: 2, type: "scope" },
  { id: "sl3", title: "Key Performance Indicators", content: "<h2>2. Key Performance Indicators</h2><table><thead><tr><th>KPI</th><th>Target</th><th>Measurement Method</th><th>Frequency</th><th>Penalty</th></tr></thead><tbody><tr><td>Inventory Accuracy</td><td>≥ 99.5%</td><td>Cycle count vs WMS</td><td>Monthly</td><td>1% credit per 0.1% below target</td></tr><tr><td>Order Fulfillment Rate</td><td>≥ 98%</td><td>Orders shipped same day</td><td>Monthly</td><td>0.5% credit per 1% below target</td></tr><tr><td>Goods Receipt Time</td><td>≤ 4 hours</td><td>Truck arrival to putaway</td><td>Per shipment</td><td>SAR 500 per incident</td></tr><tr><td>Damage Rate</td><td>≤ 0.1%</td><td>Damaged units / total units</td><td>Monthly</td><td>Replacement cost + 10%</td></tr></tbody></table>", isLocked: false, isAIGenerated: false, order: 3, type: "kpi" },
  { id: "sl4", title: "Service Hours & Response Times", content: "<h2>3. Service Hours & Response Times</h2><table><thead><tr><th>Service</th><th>Hours</th><th>Response Time</th></tr></thead><tbody><tr><td>Standard Operations</td><td>Sun-Thu 07:00-19:00</td><td>N/A</td></tr><tr><td>Emergency Support</td><td>24/7</td><td>30 minutes</td></tr><tr><td>Client Queries</td><td>Sun-Thu 08:00-17:00</td><td>4 hours</td></tr><tr><td>System Issues</td><td>24/7</td><td>1 hour</td></tr></tbody></table>", isLocked: false, isAIGenerated: false, order: 4, type: "body" },
  { id: "sl5", title: "Penalty & Credit Framework", content: "<h2>4. Penalty & Credit Framework</h2><p>Service credits are calculated monthly and applied to the following month's invoice. Maximum monthly credit shall not exceed 10% of the monthly service fee.</p><p><strong>Credit Calculation:</strong> Credits are cumulative within a calendar month. Hala will provide a detailed credit calculation with each monthly performance report.</p>", isLocked: false, isAIGenerated: false, order: 5, type: "terms" },
  { id: "sl6", title: "Reporting & Review", content: "<h2>5. Reporting & Review</h2><h3>Monthly Reporting</h3><p>Hala will provide a monthly performance report within 5 business days of month-end, including all KPI measurements and trend analysis.</p><h3>Quarterly Review</h3><p>A formal quarterly business review will be conducted between both parties to review performance, discuss improvements, and address any concerns.</p>", isLocked: false, isAIGenerated: false, order: 6, type: "body" },
  { id: "sl7", title: "Escalation Procedure", content: "<h2>6. Escalation Procedure</h2><table><thead><tr><th>Level</th><th>Hala Contact</th><th>Client Contact</th><th>Response Time</th></tr></thead><tbody><tr><td>Level 1 — Operational</td><td>Warehouse Manager</td><td>Logistics Coordinator</td><td>4 hours</td></tr><tr><td>Level 2 — Management</td><td>Operations Head</td><td>Supply Chain Manager</td><td>24 hours</td></tr><tr><td>Level 3 — Executive</td><td>Commercial Director</td><td>VP Operations</td><td>48 hours</td></tr></tbody></table>", isLocked: false, isAIGenerated: false, order: 7, type: "body" },
  { id: "sl8", title: "Amendment & Validity", content: "<h2>7. Amendment & Validity</h2><p>This SLA is valid for the duration of the Master Service Agreement. Any amendments must be agreed in writing by both parties.</p><p>Review Date: [Date]</p><p>Next Review: [Date + 12 months]</p>", isLocked: false, isAIGenerated: false, order: 8, type: "terms" },
];

function getTemplate(type: DocumentType): DocumentSection[] {
  const ts = Date.now();
  switch (type) {
    case "quote": return QUOTE_TEMPLATE.map((s, i) => ({ ...s, id: `qs${i}-${ts}` }));
    case "proposal": return PROPOSAL_TEMPLATE.map((s, i) => ({ ...s, id: `ps${i}-${ts}` }));
    case "sla": return SLA_TEMPLATE.map((s, i) => ({ ...s, id: `sl${i}-${ts}` }));
  }
}

// ============================================================
// AI MOCK
// ============================================================

const AI_SUGGESTIONS: Record<string, string> = {
  "body": "<p>Hala Supply Chain Services, a leading 3PL provider in the Kingdom of Saudi Arabia, is pleased to present this comprehensive warehousing and logistics solution. With over two decades of operational excellence across the Eastern, Central, and Western regions, we bring unmatched expertise in temperature-controlled storage, multi-modal distribution, and value-added services.</p><p>Our proposed solution leverages our state-of-the-art facility infrastructure, advanced WMS technology, and dedicated operational team to deliver measurable improvements in supply chain efficiency, inventory accuracy, and cost optimization.</p>",
  "scope": "<p>The proposed scope encompasses end-to-end warehousing and distribution services including:</p><ul><li><strong>Inbound Operations:</strong> Container devanning, goods receipt verification against ASN, quality inspection, and systematic putaway using WMS-directed slotting</li><li><strong>Storage Management:</strong> Temperature-controlled pallet storage with real-time inventory visibility, cycle counting, and FIFO/FEFO management</li><li><strong>Outbound Operations:</strong> Wave-based order processing, pick-pack-ship execution, carrier management, and proof-of-delivery tracking</li><li><strong>Value-Added Services:</strong> Labeling, kitting, co-packing, returns processing, and custom reporting</li></ul>",
  "pricing": "<p>Our pricing structure is designed to provide transparency and predictability while aligning costs with actual service utilization. All rates are quoted in Saudi Riyals (SAR) and are subject to the terms outlined in this document.</p>",
  "kpi": "<p>Performance will be measured against industry-leading benchmarks. Hala commits to maintaining service levels that exceed market standards, with transparent reporting and a structured remediation process for any shortfalls.</p>",
  "terms": "<p>This agreement shall be governed by the laws of the Kingdom of Saudi Arabia. All disputes shall be resolved through amicable negotiation in the first instance, with arbitration as the final recourse.</p>",
  "heading": "<p>Hala Supply Chain Services — delivering operational excellence across the Kingdom.</p>",
  "custom": "<p>Hala Supply Chain Services is committed to delivering exceptional logistics solutions that drive operational efficiency and support our clients' growth objectives across the Kingdom.</p>",
};

// ============================================================
// BLOCK LIBRARY
// ============================================================

interface BlockTemplate {
  id: string;
  name: string;
  category: string;
  icon: typeof FileText;
  content: string;
  sectionType: DocumentSection["type"];
}

const BLOCK_LIBRARY: BlockTemplate[] = [
  { id: "bl1", name: "Standard Paragraph", category: "Text", icon: FileText, content: "<p>Enter your content here...</p>", sectionType: "body" },
  { id: "bl2", name: "Bullet List", category: "Text", icon: List, content: "<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>", sectionType: "body" },
  { id: "bl3", name: "Numbered List", category: "Text", icon: ListOrdered, content: "<ol><li>First</li><li>Second</li><li>Third</li></ol>", sectionType: "body" },
  { id: "bl4", name: "Pricing Table", category: "Commercial", icon: TableIcon, content: "<table><thead><tr><th>Service</th><th>Unit</th><th>Rate (SAR)</th><th>Volume</th><th>Monthly (SAR)</th></tr></thead><tbody><tr><td>Service Name</td><td>Unit</td><td>0.00</td><td>0</td><td>0.00</td></tr></tbody></table>", sectionType: "pricing" },
  { id: "bl5", name: "KPI Table", category: "SLA", icon: ClipboardList, content: "<table><thead><tr><th>KPI</th><th>Target</th><th>Measurement</th><th>Penalty</th></tr></thead><tbody><tr><td>KPI Name</td><td>99%</td><td>Monthly</td><td>Credit</td></tr></tbody></table>", sectionType: "kpi" },
  { id: "bl6", name: "Timeline Table", category: "Project", icon: LayoutTemplate, content: "<table><thead><tr><th>Phase</th><th>Activity</th><th>Duration</th><th>Owner</th></tr></thead><tbody><tr><td>Phase 1</td><td>Activity</td><td>Week 1</td><td>Owner</td></tr></tbody></table>", sectionType: "body" },
  { id: "bl7", name: "Callout Box", category: "Text", icon: Quote, content: "<blockquote><p><strong>Important:</strong> Enter your callout text here.</p></blockquote>", sectionType: "body" },
  { id: "bl8", name: "VAS Rate Card", category: "Commercial", icon: FileCheck, content: "<table><thead><tr><th>VAS Service</th><th>Description</th><th>Rate (SAR)</th><th>Unit</th></tr></thead><tbody><tr><td>Labeling</td><td>Apply/replace labels</td><td>2.50</td><td>Per item</td></tr><tr><td>Shrink Wrapping</td><td>Pallet wrapping</td><td>15.00</td><td>Per pallet</td></tr><tr><td>Kitting</td><td>Assembly of kits</td><td>5.00</td><td>Per kit</td></tr></tbody></table>", sectionType: "pricing" },
  { id: "bl9", name: "Escalation Matrix", category: "SLA", icon: FileSignature, content: "<table><thead><tr><th>Level</th><th>Hala Contact</th><th>Client Contact</th><th>Response Time</th></tr></thead><tbody><tr><td>Level 1</td><td>Warehouse Manager</td><td>Logistics Coordinator</td><td>4 hours</td></tr><tr><td>Level 2</td><td>Operations Head</td><td>SC Manager</td><td>24 hours</td></tr></tbody></table>", sectionType: "kpi" },
];

// ============================================================
// TOOLBAR COMPONENT
// ============================================================

function EditorToolbar({ editor, isLocked }: { editor: ReturnType<typeof useEditor>; isLocked: boolean }) {
  if (!editor) return null;

  const ToolBtn = ({ onClick, isActive, icon: Icon, title, disabled }: { onClick: () => void; isActive?: boolean; icon: typeof Bold; title: string; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled || isLocked}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive ? "bg-[#1B2A4A] text-white" : "text-gray-600 hover:bg-gray-100"
      } ${(disabled || isLocked) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-3 py-2 border-b border-gray-200 bg-gray-50/80 sticky top-0 z-10">
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} icon={Undo2} title="Undo" disabled={!editor.can().undo()} />
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} icon={Redo2} title="Redo" disabled={!editor.can().redo()} />
      <Separator orientation="vertical" className="h-5 mx-1" />
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} icon={Heading1} title="Heading 1" />
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} icon={Heading2} title="Heading 2" />
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} icon={Heading3} title="Heading 3" />
      <Separator orientation="vertical" className="h-5 mx-1" />
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} icon={Bold} title="Bold" />
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} icon={Italic} title="Italic" />
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} icon={UnderlineIcon} title="Underline" />
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} icon={Strikethrough} title="Strikethrough" />
      <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive("highlight")} icon={Highlighter} title="Highlight" />
      <Separator orientation="vertical" className="h-5 mx-1" />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })} icon={AlignLeft} title="Align Left" />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })} icon={AlignCenter} title="Align Center" />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })} icon={AlignRight} title="Align Right" />
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} isActive={editor.isActive({ textAlign: "justify" })} icon={AlignJustify} title="Justify" />
      <Separator orientation="vertical" className="h-5 mx-1" />
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} icon={List} title="Bullet List" />
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} icon={ListOrdered} title="Numbered List" />
      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} icon={Quote} title="Blockquote" />
      <Separator orientation="vertical" className="h-5 mx-1" />
      <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: true }).run()} icon={TableIcon} title="Insert Table" />
      <ToolBtn onClick={() => { const url = window.prompt("Enter URL:"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} isActive={editor.isActive("link")} icon={LinkIcon} title="Insert Link" />
    </div>
  );
}

// ============================================================
// CUSTOMER INFO BANNER
// ============================================================

function CustomerBanner({ customer }: { customer: Customer | null }) {
  if (!customer) return null;

  const gradeColors: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-800 border-emerald-300",
    B: "bg-blue-100 text-blue-800 border-blue-300",
    C: "bg-amber-100 text-amber-800 border-amber-300",
    D: "bg-orange-100 text-orange-800 border-orange-300",
    F: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className="px-4 py-3 bg-gradient-to-r from-[#1B2A4A]/5 to-transparent border-b border-gray-200">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-[#1B2A4A] flex items-center justify-center text-white font-bold text-sm shrink-0">
          {customer.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#1B2A4A]">{customer.name}</h3>
            <Badge className={`text-[10px] h-4 border ${gradeColors[customer.grade] || "bg-gray-100 text-gray-700"}`}>
              Grade {customer.grade}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-4">{customer.status}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Hash size={10} /> {customer.code}</span>
            <span className="flex items-center gap-1"><Building2 size={10} /> {customer.industry}</span>
            <span className="flex items-center gap-1"><MapPin size={10} /> {customer.city}, {customer.region}</span>
            <span className="flex items-center gap-1"><DollarSign size={10} /> {formatSAR(customer.contractValue2025)}</span>
            <span className="flex items-center gap-1"><Calendar size={10} /> Exp: {customer.contractExpiry}</span>
            <span className="flex items-center gap-1"><User size={10} /> {customer.contactName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION EDITOR COMPONENT (Block View)
// ============================================================

function SectionEditor({
  section, mode, onContentChange, onTitleChange, onLock, onDelete, onAIGenerate,
  aiStaging, onAcceptAI, onRejectAI,
}: {
  section: DocumentSection; mode: EditorMode;
  onContentChange: (content: string) => void; onTitleChange: (title: string) => void;
  onLock: () => void; onDelete: () => void; onAIGenerate: () => void;
  aiStaging: string | null; onAcceptAI: () => void; onRejectAI: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isLocked = section.isLocked || mode === "canon";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Underline, TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      Link.configure({ openOnClick: false }), TextStyle, Color,
    ],
    content: section.content,
    editable: !isLocked,
    onUpdate: ({ editor: e }) => { onContentChange(e.getHTML()); },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== !isLocked) {
      editor.setEditable(!isLocked);
    }
  }, [isLocked, editor]);

  const sectionTypeIcon: Record<string, typeof FileText> = {
    heading: BookOpen, body: FileText, pricing: TableIcon, terms: FileSignature,
    kpi: ClipboardList, scope: Layers, custom: PenTool,
  };
  const SectionIcon = sectionTypeIcon[section.type] || FileText;

  return (
    <div className={`border rounded-lg mb-3 transition-all ${
      isLocked ? "border-[#1B2A4A]/20 bg-[#F8F9FB]" : "border-gray-200 bg-white"
    } ${section.isAIGenerated ? "ring-1 ring-amber-300" : ""}`}>
      {/* Section Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50 rounded-t-lg">
        {mode === "structure" && <GripVertical size={14} className="text-gray-400 cursor-grab" />}
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-gray-500 hover:text-gray-700">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <SectionIcon size={14} className="text-[#1B2A4A]/60" />
        {mode === "structure" ? (
          <Input value={section.title} onChange={(e) => onTitleChange(e.target.value)}
            className="h-6 text-sm font-medium border-none bg-transparent p-0 focus-visible:ring-0" />
        ) : (
          <span className="text-sm font-medium text-[#1B2A4A]">{section.title}</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {section.isAIGenerated && (
            <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50">
              <Sparkles size={10} className="mr-1" /> AI
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] h-5 capitalize">{section.type}</Badge>
          {isLocked ? (
            <Lock size={12} className="text-[#1B2A4A]/40" />
          ) : (
            <>
              {mode === "draft" && (
                <button onClick={onAIGenerate} className="p-1 rounded hover:bg-amber-50 text-amber-600" title="Generate with AI">
                  <Wand2 size={14} />
                </button>
              )}
              <button onClick={onLock} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Lock as Canon">
                <Shield size={14} />
              </button>
              {mode === "structure" && (
                <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-400" title="Remove Section">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Section Content */}
      {!isCollapsed && (
        <div className="relative">
          {/* AI Staging Area */}
          {aiStaging && (
            <div className="mx-3 mt-3 p-3 rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700">AI Staging — Review before accepting</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 text-xs border-green-300 text-green-700 hover:bg-green-50" onClick={onAcceptAI}>
                    <Check size={12} className="mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 text-xs border-red-300 text-red-700 hover:bg-red-50" onClick={onRejectAI}>
                    <X size={12} className="mr-1" /> Reject
                  </Button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none text-amber-900/80" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aiStaging) }} />
            </div>
          )}

          {/* WYSIWYG Editor */}
          {mode !== "structure" && editor && (
            <>
              {!isLocked && <EditorToolbar editor={editor} isLocked={isLocked} />}
              <div className={`px-4 py-3 ${isLocked ? "opacity-80" : ""}`}>
                <EditorContent editor={editor} className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_th]:font-semibold" />
              </div>
            </>
          )}

          {/* Structure Mode — Show content preview */}
          {mode === "structure" && (
            <div className="px-4 py-3 text-sm text-gray-500 italic">
              <div className="prose prose-sm max-w-none opacity-60" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.content.substring(0, 200) + "...") }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPILED VIEW EDITOR — Single continuous document
// ============================================================

function CompiledViewEditor({ sections, isLocked, onContentChange }: {
  sections: DocumentSection[];
  isLocked: boolean;
  onContentChange: (allContent: string) => void;
}) {
  const compiledContent = useMemo(() => {
    return sections.map(s => s.content).join("\n<hr />\n");
  }, [sections]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing your document..." }),
      Underline, TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      Link.configure({ openOnClick: false }), TextStyle, Color,
    ],
    content: compiledContent,
    editable: !isLocked,
    onUpdate: ({ editor: e }) => { onContentChange(e.getHTML()); },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== !isLocked) {
      editor.setEditable(!isLocked);
    }
  }, [isLocked, editor]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {editor && !isLocked && <EditorToolbar editor={editor} isLocked={isLocked} />}
      <div className={`px-8 py-6 ${isLocked ? "opacity-80" : ""}`}>
        <EditorContent editor={editor} className="prose prose-base max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:border-gray-200" />
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMMERCIAL EDITOR
// ============================================================

interface CommercialEditorProps {
  documentType: DocumentType;
  workspaceId?: string;
  customerId?: string;
  customerName?: string;
  existingDocument?: EditorDocument;
  onSave?: (doc: EditorDocument) => void;
  onExportPDF?: (doc: EditorDocument) => void;
}

export default function CommercialEditor({
  documentType, workspaceId = "", customerId = "", customerName = "",
  existingDocument, onSave, onExportPDF,
}: CommercialEditorProps) {
  const [mode, setMode] = useState<EditorMode>("draft");
  const [viewMode, setViewMode] = useState<ViewMode>("block");
  const [document, setDocument] = useState<EditorDocument>(() => {
    if (existingDocument) return existingDocument;
    return {
      id: `doc-${crypto.randomUUID()}`, type: documentType,
      title: documentType === "quote" ? "New Quotation" : documentType === "proposal" ? "New Proposal" : "New Service Level Agreement",
      workspaceId, customerId, customerName, version: 1,
      sections: getTemplate(documentType),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "draft",
    };
  });

  // Resolve customer from ID or name
  const { data: customers } = useCustomers();
  const linkedCustomer = useMemo(() => {
    if (customerId) return customers.find((c: any) => c.id === customerId) || null;
    if (customerName) return customers.find((c: any) => c.name === customerName) || null;
    if (document.customerId) return customers.find((c: any) => c.id === document.customerId) || null;
    if (document.customerName) return customers.find((c: any) => c.name === document.customerName) || null;
    return null;
  }, [customerId, customerName, document.customerId, document.customerName, customers]);

  const [aiStagingMap, setAiStagingMap] = useState<Record<string, string>>({});
  const [promptText, setPromptText] = useState("");
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [showPromptBox, setShowPromptBox] = useState(false);

  const typeLabels: Record<DocumentType, string> = { quote: "Quotation", proposal: "Proposal", sla: "Service Level Agreement" };
  const typeIcons: Record<DocumentType, typeof FileText> = { quote: FileCheck, proposal: BookOpen, sla: FileSignature };
  const DocIcon = typeIcons[documentType];

  const updateSection = useCallback((sectionId: string, updates: Partial<DocumentSection>) => {
    setDocument(prev => ({
      ...prev, updatedAt: new Date().toISOString(),
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
    }));
  }, []);

  const addSection = useCallback((template?: BlockTemplate) => {
    const newSection: DocumentSection = {
      id: `sec-${crypto.randomUUID()}`, title: template?.name || "New Section",
      content: template?.content || "<p>Start writing...</p>",
      isLocked: false, isAIGenerated: false, order: document.sections.length + 1,
      type: template?.sectionType || "custom",
    };
    setDocument(prev => ({
      ...prev, updatedAt: new Date().toISOString(), sections: [...prev.sections, newSection],
    }));
    setShowBlockLibrary(false);
    toast.success("Section added");
  }, [document.sections.length]);

  const removeSection = useCallback((sectionId: string) => {
    setDocument(prev => ({
      ...prev, updatedAt: new Date().toISOString(), sections: prev.sections.filter(s => s.id !== sectionId),
    }));
    toast.success("Section removed");
  }, []);

  const handleAIGenerate = useCallback((sectionId: string) => {
    const section = document.sections.find(s => s.id === sectionId);
    if (!section) return;
    toast.info("AI is generating content...");
    setTimeout(() => {
      const suggestion = AI_SUGGESTIONS[section.type] || AI_SUGGESTIONS["custom"];
      setAiStagingMap(prev => ({ ...prev, [sectionId]: suggestion }));
      toast.success("AI draft ready — review in staging area");
    }, 1200);
  }, [document.sections]);

  const handleAcceptAI = useCallback((sectionId: string) => {
    const staged = aiStagingMap[sectionId];
    if (!staged) return;
    updateSection(sectionId, { content: staged, isAIGenerated: true });
    setAiStagingMap(prev => { const next = { ...prev }; delete next[sectionId]; return next; });
    toast.success("AI content accepted and transferred to document");
  }, [aiStagingMap, updateSection]);

  const handleRejectAI = useCallback((sectionId: string) => {
    setAiStagingMap(prev => { const next = { ...prev }; delete next[sectionId]; return next; });
    toast.info("AI suggestion rejected");
  }, []);

  const handlePromptSubmit = useCallback(() => {
    if (!promptText.trim()) return;
    toast.info("AI is processing your prompt...");
    setTimeout(() => {
      const newSection: DocumentSection = {
        id: `ai-${crypto.randomUUID()}`, title: "AI Generated Section",
        content: `<h2>Generated Content</h2><p>${promptText}</p><p>Hala Supply Chain Services has extensive experience in this area. Our dedicated team of logistics professionals ensures seamless execution of all operational requirements, backed by industry-leading technology and proven processes.</p><p>We recommend a phased approach to implementation, beginning with a thorough assessment of current operations, followed by solution design, pilot testing, and full-scale deployment.</p>`,
        isLocked: false, isAIGenerated: true, order: document.sections.length + 1, type: "custom",
      };
      setDocument(prev => ({
        ...prev, updatedAt: new Date().toISOString(), sections: [...prev.sections, newSection],
      }));
      setPromptText("");
      setShowPromptBox(false);
      toast.success("AI generated a new section — review and edit as needed");
    }, 1500);
  }, [promptText, document.sections.length]);

  const handleCompiledContentChange = useCallback((_content: string) => {
    // In compiled view, content changes are tracked but sections remain as-is
    // The compiled view is primarily for reading/light editing
    setDocument(prev => ({ ...prev, updatedAt: new Date().toISOString() }));
  }, []);

  const handleSave = useCallback(() => {
    if (onSave) onSave(document);
    toast.success("Document saved");
  }, [document, onSave]);

  const handleExportPDF = useCallback(() => {
    if (onExportPDF) onExportPDF(document);
    toast.success("PDF export initiated");
  }, [document, onExportPDF]);

  const lockAllSections = useCallback(() => {
    setDocument(prev => ({
      ...prev, status: "canon", updatedAt: new Date().toISOString(),
      sections: prev.sections.map(s => ({ ...s, isLocked: true })),
    }));
    setMode("canon");
    toast.success("Document locked as Canon — immutable version created");
  }, []);

  const lockedCount = document.sections.filter(s => s.isLocked).length;
  const totalCount = document.sections.length;

  return (
    <div className="flex h-full bg-white">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <DocIcon size={20} className="text-[#1B2A4A]" />
            <div>
              <Input value={document.title} onChange={(e) => setDocument(prev => ({ ...prev, title: e.target.value }))}
                className="h-7 text-base font-semibold border-none bg-transparent p-0 focus-visible:ring-0 w-[400px]" disabled={mode === "canon"} />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{typeLabels[documentType]}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500">v{document.version}</span>
                {linkedCustomer && (
                  <>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs font-medium text-[#1B2A4A]">{linkedCustomer.name}</span>
                    <span className="text-xs text-gray-400">({linkedCustomer.code})</span>
                  </>
                )}
                <span className="text-xs text-gray-300">·</span>
                <Badge variant={document.status === "canon" ? "default" : "outline"} className="text-[10px] h-4 capitalize">{document.status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 mr-2 border border-gray-200 rounded-md p-0.5">
              <button
                onClick={() => setViewMode("block")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  viewMode === "block" ? "bg-[#1B2A4A] text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
                title="Block View — Edit individual sections"
              >
                <Columns2 size={12} /> Blocks
              </button>
              <button
                onClick={() => setViewMode("compiled")}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  viewMode === "compiled" ? "bg-[#1B2A4A] text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
                title="Compiled View — Single continuous document"
              >
                <Eye size={12} /> Compiled
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={mode === "canon"}>
              <Save size={14} className="mr-1" /> Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <Download size={14} className="mr-1" /> Export PDF
            </Button>
            {mode !== "canon" && (
              <Button variant="default" size="sm" onClick={lockAllSections} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
                <Lock size={14} className="mr-1" /> Lock as Canon
              </Button>
            )}
          </div>
        </div>

        {/* Customer Banner */}
        <CustomerBanner customer={linkedCustomer} />

        {/* Mode Tabs */}
        <div className="px-4 pt-3 border-b border-gray-100">
          <Tabs value={mode} onValueChange={(v) => setMode(v as EditorMode)}>
            <TabsList className="bg-gray-100/80">
              <TabsTrigger value="structure" className="text-xs gap-1.5" disabled={mode === "canon"}>
                <Layers size={13} /> Structure
              </TabsTrigger>
              <TabsTrigger value="draft" className="text-xs gap-1.5" disabled={mode === "canon"}>
                <PenTool size={13} /> Draft
              </TabsTrigger>
              <TabsTrigger value="canon" className="text-xs gap-1.5">
                <Shield size={13} /> Canon
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Mode Description */}
        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
          {mode === "structure" && <p className="text-xs text-gray-500"><strong>Structure Mode</strong> — Organize sections, add/remove blocks, reorder content. No text editing in this mode.</p>}
          {mode === "draft" && viewMode === "block" && <p className="text-xs text-gray-500"><strong>Draft Mode — Block View</strong> — Edit individual sections with WYSIWYG. Use AI assistance. Lock sections when finalized.</p>}
          {mode === "draft" && viewMode === "compiled" && <p className="text-xs text-gray-500"><strong>Draft Mode — Compiled View</strong> — Edit the full document as a single continuous page, like a traditional word processor.</p>}
          {mode === "canon" && <p className="text-xs text-gray-500"><strong>Canon Mode</strong> — Immutable final version. All sections locked. This is the legal truth.</p>}
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto">
            {/* COMPILED VIEW */}
            {viewMode === "compiled" && (
              <CompiledViewEditor
                sections={document.sections}
                isLocked={mode === "canon"}
                onContentChange={handleCompiledContentChange}
              />
            )}

            {/* BLOCK VIEW */}
            {viewMode === "block" && (
              <>
                {document.sections.map((section) => (
                  <SectionEditor key={section.id} section={section} mode={mode}
                    onContentChange={(content) => updateSection(section.id, { content })}
                    onTitleChange={(title) => updateSection(section.id, { title })}
                    onLock={() => updateSection(section.id, { isLocked: true })}
                    onDelete={() => removeSection(section.id)}
                    onAIGenerate={() => handleAIGenerate(section.id)}
                    aiStaging={aiStagingMap[section.id] || null}
                    onAcceptAI={() => handleAcceptAI(section.id)}
                    onRejectAI={() => handleRejectAI(section.id)}
                  />
                ))}

                {/* Add Section */}
                {mode !== "canon" && (
                  <div className="flex items-center gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => addSection()} className="text-xs">
                      <Plus size={14} className="mr-1" /> Add Section
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowBlockLibrary(!showBlockLibrary)} className="text-xs">
                      <LayoutTemplate size={14} className="mr-1" /> Block Library
                    </Button>
                    {mode === "draft" && (
                      <Button variant="outline" size="sm" onClick={() => setShowPromptBox(!showPromptBox)} className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                        <Sparkles size={14} className="mr-1" /> AI Prompt
                      </Button>
                    )}
                  </div>
                )}

                {/* Block Library */}
                {showBlockLibrary && mode !== "canon" && (
                  <Card className="mt-3 border-[#1B2A4A]/20">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <LayoutTemplate size={14} /> Block Library
                        <button onClick={() => setShowBlockLibrary(false)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="grid grid-cols-3 gap-2">
                        {BLOCK_LIBRARY.map((block) => (
                          <button key={block.id} onClick={() => addSection(block)}
                            className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:border-[#1B2A4A]/30 hover:bg-[#F8F9FB] text-left transition-colors">
                            <block.icon size={14} className="text-[#1B2A4A]/60 shrink-0" />
                            <div>
                              <div className="text-xs font-medium">{block.name}</div>
                              <div className="text-[10px] text-gray-400">{block.category}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AI Prompt Box */}
                {showPromptBox && mode === "draft" && (
                  <Card className="mt-3 border-amber-300 bg-amber-50/30">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                        <Sparkles size={14} /> AI Prompt Box
                        <button onClick={() => setShowPromptBox(false)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <p className="text-xs text-amber-700 mb-2">Describe what you need and AI will generate a new section. Human reviews before it enters the document.</p>
                      <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
                        placeholder="e.g., Write an executive summary for a warehousing proposal for a petrochemical client in Jubail requiring 2500 pallet positions..."
                        className="text-sm mb-2 min-h-[80px]" />
                      <Button size="sm" onClick={handlePromptSubmit} className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Send size={14} className="mr-1" /> Generate
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Progress Bar */}
            <div className="mt-6 mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">Canon Progress</span>
                <span className="text-xs text-gray-500">{lockedCount}/{totalCount} sections locked</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#1B2A4A] rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (lockedCount / totalCount) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Right Sidebar */}
      <div className="w-72 border-l border-gray-200 bg-[#F8F9FB] flex flex-col overflow-y-auto">
        {/* Customer Card */}
        {linkedCustomer && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3 flex items-center gap-1.5">
              <Building2 size={14} /> Linked Customer
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-[#1B2A4A] flex items-center justify-center text-white text-xs font-bold">
                  {linkedCustomer.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#1B2A4A]">{linkedCustomer.name}</div>
                  <div className="text-[10px] text-gray-500">{linkedCustomer.code}</div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Industry</span><span className="font-medium">{linkedCustomer.industry}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Region</span><span className="font-medium">{linkedCustomer.city}, {linkedCustomer.region}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Grade</span><Badge variant="outline" className="text-[10px] h-4">{linkedCustomer.grade}</Badge></div>
                <div className="flex justify-between"><span className="text-gray-500">Contract</span><span className="font-medium">{formatSAR(linkedCustomer.contractValue2025)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Expiry</span><span className="font-medium">{linkedCustomer.contractExpiry}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Pallets</span><span className="font-medium">{linkedCustomer.palletContracted.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">DSO</span><span className="font-medium">{linkedCustomer.dso} days</span></div>
                <Separator className="my-1.5" />
                <div className="flex items-center gap-1.5 text-gray-500"><User size={10} /> {linkedCustomer.contactName}</div>
                <div className="flex items-center gap-1.5 text-gray-500"><Mail size={10} /> {linkedCustomer.contactEmail}</div>
                <div className="flex items-center gap-1.5 text-gray-500"><Phone size={10} /> {linkedCustomer.contactPhone}</div>
              </div>
            </div>
          </div>
        )}

        {/* Document Info */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Document Info</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{typeLabels[documentType]}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Version</span><span className="font-medium">v{document.version}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge variant="outline" className="text-[10px] h-4 capitalize">{document.status}</Badge></div>
            <div className="flex justify-between"><span className="text-gray-500">Sections</span><span className="font-medium">{totalCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Locked</span><span className="font-medium">{lockedCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">View</span><span className="font-medium capitalize">{viewMode}</span></div>
          </div>
        </div>

        {/* Sections Navigator */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Sections</h3>
          <ScrollArea className="max-h-[250px]">
            <div className="space-y-1">
              {document.sections.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white transition-colors">
                  <span className="text-gray-400 w-4">{i + 1}</span>
                  <span className="truncate flex-1">{s.title}</span>
                  {s.isLocked && <Lock size={10} className="text-[#1B2A4A]/40" />}
                  {s.isAIGenerated && <Sparkles size={10} className="text-amber-500" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Mode Guide */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Mode Guide</h3>
          <div className="space-y-2">
            {([
              { key: "structure" as const, icon: Layers, label: "Structure", desc: "Organize blocks, add/remove sections, set document architecture" },
              { key: "draft" as const, icon: PenTool, label: "Draft", desc: "Write and edit content with full WYSIWYG. Use AI to generate drafts." },
              { key: "canon" as const, icon: Shield, label: "Canon", desc: "Locked, immutable truth. The legal version of record." },
            ]).map(m => (
              <div key={m.key} className={`p-2 rounded text-xs ${mode === m.key ? "bg-white border border-[#1B2A4A]/20" : "text-gray-500"}`}>
                <div className="flex items-center gap-1.5 font-medium mb-0.5"><m.icon size={12} /> {m.label}</div>
                <p className="text-[10px] leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
