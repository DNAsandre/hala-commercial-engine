/*
 * CommercialEditor — Three-Mode Editor (Truthpack Addendum 2)
 * Mode 1: STRUCTURE — Define sections, blocks, and TOC
 * Mode 2: DRAFT — Write content with AI staging and prompt box
 * Mode 3: CANON — Lock content, version, and prepare for output
 * 
 * Three surfaces: Human Editor → AI Staging → Prompt Box
 */

import { useState, useRef } from "react";
import {
  AlignLeft, Bot, Check, ChevronDown, ChevronRight, ChevronUp, Copy,
  Edit3, Eye, FileText, GripVertical, Hash, Layout, List, Lock,
  MessageSquare, Pencil, Plus, RotateCcw, Save, Send, Sparkles,
  Trash2, Type, Unlock, Wand2, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type EditorMode = "structure" | "draft" | "canon";

interface Block {
  id: string;
  type: "heading" | "paragraph" | "table" | "list" | "kpi" | "scope_item" | "pricing_row";
  content: string;
  aiDraft?: string;
  isLocked: boolean;
  order: number;
}

interface Section {
  id: string;
  title: string;
  blocks: Block[];
  isExpanded: boolean;
  order: number;
}

// Pre-built block library (Truthpack Addendum 3)
const BLOCK_LIBRARY = [
  { type: "heading" as const, label: "Section Heading", icon: Hash, description: "H2/H3 heading block" },
  { type: "paragraph" as const, label: "Narrative Paragraph", icon: AlignLeft, description: "Free-text content block" },
  { type: "table" as const, label: "Data Table", icon: Layout, description: "Structured data table" },
  { type: "list" as const, label: "Bullet List", icon: List, description: "Ordered or unordered list" },
  { type: "kpi" as const, label: "KPI Metric", icon: Hash, description: "Key performance indicator" },
  { type: "scope_item" as const, label: "Scope of Work Item", icon: FileText, description: "SOW line item" },
  { type: "pricing_row" as const, label: "Pricing Row", icon: Type, description: "Rate/price line item" },
];

// Default proposal sections
const DEFAULT_SECTIONS: Section[] = [
  {
    id: "s1", title: "Executive Summary", order: 1, isExpanded: true,
    blocks: [
      { id: "b1", type: "heading", content: "Executive Summary", aiDraft: "", isLocked: false, order: 1 },
      { id: "b2", type: "paragraph", content: "", aiDraft: "Hala Supply Chain Solutions is pleased to present this proposal for comprehensive warehousing and logistics services. Our solution is designed to meet your specific operational requirements while delivering measurable value through optimized processes, dedicated infrastructure, and experienced personnel.", isLocked: false, order: 2 },
    ],
  },
  {
    id: "s2", title: "Scope of Work", order: 2, isExpanded: false,
    blocks: [
      { id: "b3", type: "heading", content: "Scope of Work", aiDraft: "", isLocked: false, order: 1 },
      { id: "b4", type: "scope_item", content: "Receiving & Inbound Processing", aiDraft: "Complete inbound logistics including unloading, quality inspection, GRN processing, and systematic putaway within 24 hours of receipt.", isLocked: false, order: 2 },
      { id: "b5", type: "scope_item", content: "Storage & Inventory Management", aiDraft: "Dedicated pallet positions with real-time WMS tracking, cycle counting, and FIFO/FEFO management as per product requirements.", isLocked: false, order: 3 },
      { id: "b6", type: "scope_item", content: "Order Fulfillment & Dispatch", aiDraft: "Pick, pack, and dispatch operations with same-day processing for orders received before 14:00. Full documentation and POD management.", isLocked: false, order: 4 },
    ],
  },
  {
    id: "s3", title: "Pricing & Commercial Terms", order: 3, isExpanded: false,
    blocks: [
      { id: "b7", type: "heading", content: "Pricing & Commercial Terms", aiDraft: "", isLocked: false, order: 1 },
      { id: "b8", type: "pricing_row", content: "Storage Rate: SAR [X] per pallet per day", aiDraft: "", isLocked: false, order: 2 },
      { id: "b9", type: "pricing_row", content: "Inbound Handling: SAR [X] per pallet", aiDraft: "", isLocked: false, order: 3 },
      { id: "b10", type: "pricing_row", content: "Outbound Handling: SAR [X] per pallet", aiDraft: "", isLocked: false, order: 4 },
    ],
  },
  {
    id: "s4", title: "SLA Framework", order: 4, isExpanded: false,
    blocks: [
      { id: "b11", type: "heading", content: "Service Level Agreement", aiDraft: "", isLocked: false, order: 1 },
      { id: "b12", type: "kpi", content: "Inbound Processing: ≤ 24 hours", aiDraft: "", isLocked: false, order: 2 },
      { id: "b13", type: "kpi", content: "Order Accuracy: ≥ 99.5%", aiDraft: "", isLocked: false, order: 3 },
      { id: "b14", type: "kpi", content: "Inventory Accuracy: ≥ 99.8%", aiDraft: "", isLocked: false, order: 4 },
    ],
  },
  {
    id: "s5", title: "Terms & Conditions", order: 5, isExpanded: false,
    blocks: [
      { id: "b15", type: "heading", content: "Terms & Conditions", aiDraft: "", isLocked: false, order: 1 },
      { id: "b16", type: "paragraph", content: "", aiDraft: "This proposal is valid for 30 days from the date of issue. All pricing is exclusive of VAT (15%). Payment terms are Net 30 days from invoice date. The initial contract term is 12 months with automatic renewal unless either party provides 90 days written notice.", isLocked: false, order: 2 },
    ],
  },
];

interface CommercialEditorProps {
  documentTitle?: string;
  workspaceId?: string;
  onSave?: (sections: Section[]) => void;
}

export default function CommercialEditor({ documentTitle = "Commercial Proposal", workspaceId, onSave }: CommercialEditorProps) {
  const [mode, setMode] = useState<EditorMode>("structure");
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [addToSectionId, setAddToSectionId] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [isCanonLocked, setIsCanonLocked] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const totalBlocks = sections.reduce((sum, s) => sum + s.blocks.length, 0);
  const lockedBlocks = sections.reduce((sum, s) => sum + s.blocks.filter(b => b.isLocked).length, 0);
  const filledBlocks = sections.reduce((sum, s) => sum + s.blocks.filter(b => b.content.trim() || b.aiDraft?.trim()).length, 0);

  function toggleSection(sectionId: string) {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s));
  }

  function updateBlockContent(sectionId: string, blockId: string, content: string) {
    if (isCanonLocked) return;
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, content } : b) } : s
    ));
  }

  function acceptAiDraft(sectionId: string, blockId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? {
        ...s, blocks: s.blocks.map(b =>
          b.id === blockId ? { ...b, content: b.aiDraft || b.content, aiDraft: "" } : b
        )
      } : s
    ));
    toast.success("AI draft accepted into human editor");
  }

  function rejectAiDraft(sectionId: string, blockId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? {
        ...s, blocks: s.blocks.map(b =>
          b.id === blockId ? { ...b, aiDraft: "" } : b
        )
      } : s
    ));
    toast("AI draft discarded");
  }

  function toggleBlockLock(sectionId: string, blockId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, isLocked: !b.isLocked } : b) } : s
    ));
  }

  function addBlock(sectionId: string, type: Block["type"]) {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    const newBlock: Block = {
      id: `b_${Date.now()}`,
      type,
      content: "",
      aiDraft: "",
      isLocked: false,
      order: section.blocks.length + 1,
    };
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, blocks: [...s.blocks, newBlock] } : s
    ));
    setShowBlockLibrary(false);
    setAddToSectionId(null);
  }

  function removeBlock(sectionId: string, blockId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, blocks: s.blocks.filter(b => b.id !== blockId) } : s
    ));
  }

  function addSection() {
    const newSection: Section = {
      id: `s_${Date.now()}`,
      title: "New Section",
      blocks: [{ id: `b_${Date.now()}`, type: "heading", content: "New Section", aiDraft: "", isLocked: false, order: 1 }],
      isExpanded: true,
      order: sections.length + 1,
    };
    setSections(prev => [...prev, newSection]);
  }

  function removeSection(sectionId: string) {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }

  function moveSection(sectionId: string, direction: "up" | "down") {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (direction === "up" && idx > 0) {
      const newSections = [...sections];
      [newSections[idx - 1], newSections[idx]] = [newSections[idx], newSections[idx - 1]];
      setSections(newSections);
    } else if (direction === "down" && idx < sections.length - 1) {
      const newSections = [...sections];
      [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
      setSections(newSections);
    }
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) {
      toast.error("Enter a prompt for the AI");
      return;
    }
    setAiLoading(true);

    // Simulate AI generation (in production, this calls the AI API)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Find the selected block and generate contextual content
    let targetSection: Section | undefined;
    let targetBlock: Block | undefined;
    for (const s of sections) {
      const b = s.blocks.find(b => b.id === selectedBlockId);
      if (b) { targetSection = s; targetBlock = b; break; }
    }

    if (targetBlock && targetSection) {
      const aiContent = generateAiResponse(aiPrompt, targetBlock, targetSection);
      setSections(prev => prev.map(s =>
        s.id === targetSection!.id ? {
          ...s, blocks: s.blocks.map(b =>
            b.id === targetBlock!.id ? { ...b, aiDraft: aiContent } : b
          )
        } : s
      ));
      toast.success("AI draft generated", { description: "Review in the AI Staging area, then accept or reject." });
    } else {
      toast.error("Select a block first, then use the AI prompt");
    }

    setAiLoading(false);
    setAiPrompt("");
  }

  function generateAiResponse(prompt: string, block: Block, section: Section): string {
    // Simulated AI responses based on context
    const responses: Record<string, string> = {
      "executive summary": "Hala Supply Chain Solutions (SCS) is pleased to present this comprehensive warehousing and logistics proposal. With over 15 years of operational excellence across the Kingdom, Hala SCS operates 500,000+ sqm of Grade-A warehouse space across Eastern, Central, and Western regions. Our solution is specifically designed to address your unique operational requirements, leveraging our proven methodology, dedicated infrastructure, and experienced team to deliver measurable value from day one.",
      "scope": "Our integrated warehousing solution encompasses the full spectrum of supply chain services: receiving and quality inspection, systematic storage with real-time WMS visibility, order fulfillment with same-day processing capability, value-added services including labeling, kitting, and co-packing, and last-mile delivery coordination. Each service component is backed by defined KPIs and regular performance reporting.",
      "pricing": "Our pricing model is structured to provide transparency and predictability. All rates are based on actual volumes processed, ensuring you only pay for services utilized. The storage rate includes standard racking, inventory management, and WMS access. Handling rates cover all labor, equipment, and processing costs. Volume-based discounts are available for commitments exceeding the base volume.",
      "sla": "Our Service Level Agreement defines measurable performance standards across all operational areas. We commit to 99.5% order accuracy, 24-hour inbound processing, 99.8% inventory accuracy, and 98% on-time dispatch. Monthly performance reviews with detailed KPI reporting ensure continuous improvement and accountability.",
      "terms": "This proposal is valid for thirty (30) calendar days from the date of issue. The initial contract term shall be twelve (12) months, commencing from the operational go-live date. Payment terms are Net 30 days from invoice date. All pricing is exclusive of Value Added Tax (VAT) at the prevailing rate. Either party may terminate with ninety (90) days written notice.",
    };

    const lowerPrompt = prompt.toLowerCase();
    for (const [key, value] of Object.entries(responses)) {
      if (lowerPrompt.includes(key)) return value;
    }

    return `Based on your request: "${prompt}"\n\nHala Supply Chain Solutions proposes a tailored approach that addresses the specific requirements outlined. Our solution leverages proven operational frameworks, dedicated resources, and technology-enabled processes to deliver consistent, measurable results. The detailed specifications and commercial terms are structured to provide clarity and mutual benefit throughout the engagement period.`;
  }

  function lockForCanon() {
    setIsCanonLocked(true);
    setVersion(prev => prev + 1);
    setMode("canon");
    toast.success(`Document locked as Canon v${version + 1}`, {
      description: "Content is now immutable. Create a new version to make changes.",
    });
  }

  function unlockFromCanon() {
    setIsCanonLocked(false);
    setMode("draft");
    toast("Document unlocked for editing");
  }

  function handleSave() {
    onSave?.(sections);
    toast.success("Document saved", { description: `v${version} — ${new Date().toLocaleString()}` });
  }

  const blockTypeIcons: Record<Block["type"], React.ElementType> = {
    heading: Hash,
    paragraph: AlignLeft,
    table: Layout,
    list: List,
    kpi: Hash,
    scope_item: FileText,
    pricing_row: Type,
  };

  const blockTypeLabels: Record<Block["type"], string> = {
    heading: "Heading",
    paragraph: "Paragraph",
    table: "Table",
    list: "List",
    kpi: "KPI",
    scope_item: "SOW Item",
    pricing_row: "Pricing",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Edit3 className="w-4.5 h-4.5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">{documentTitle}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-[10px]">v{version}</Badge>
              <span className="text-[10px] text-muted-foreground">{sections.length} sections · {totalBlocks} blocks · {filledBlocks} filled · {lockedBlocks} locked</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleSave}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
          {mode === "draft" && (
            <Button size="sm" className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700" onClick={lockForCanon}>
              <Lock className="w-3.5 h-3.5 mr-1" /> Lock as Canon
            </Button>
          )}
          {mode === "canon" && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={unlockFromCanon}>
              <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
            </Button>
          )}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-border bg-muted/30">
        {(["structure", "draft", "canon"] as EditorMode[]).map((m, i) => (
          <button
            key={m}
            onClick={() => {
              if (m === "canon" && !isCanonLocked) {
                toast("Lock the document first to enter Canon mode");
                return;
              }
              setMode(m);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <span className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center font-bold">
              {i + 1}
            </span>
            <span className="capitalize">{m}</span>
            {m === "canon" && isCanonLocked && <Lock className="w-3 h-3" />}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          {mode === "structure" && "Define sections, reorder blocks, set document skeleton"}
          {mode === "draft" && "Write content, use AI staging, refine with prompt box"}
          {mode === "canon" && "Locked content — immutable, versioned, ready for output"}
        </span>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document Structure / Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {sections.map((section, sIdx) => (
            <div key={section.id} className="mb-4">
              {/* Section Header */}
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg border transition-colors",
                mode === "canon" ? "bg-emerald-50/50 border-emerald-200" : "bg-muted/50 border-border hover:border-primary/30"
              )}>
                <button onClick={() => toggleSection(section.id)} className="text-muted-foreground hover:text-foreground">
                  {section.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                {mode === "structure" && <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab" />}
                <span className="text-sm font-semibold flex-1">
                  {mode === "structure" ? (
                    <Input
                      value={section.title}
                      onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                      className="h-7 text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0"
                    />
                  ) : (
                    section.title
                  )}
                </span>
                <Badge variant="outline" className="text-[10px]">{section.blocks.length} blocks</Badge>
                {mode === "structure" && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveSection(section.id, "up")} className="p-1 rounded hover:bg-muted" title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveSection(section.id, "down")} className="p-1 rounded hover:bg-muted" title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeSection(section.id)} className="p-1 rounded hover:bg-red-100 text-red-500" title="Remove section"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>

              {/* Section Blocks */}
              {section.isExpanded && (
                <div className="ml-6 mt-2 space-y-2">
                  {section.blocks.map(block => {
                    const BlockIcon = blockTypeIcons[block.type];
                    const isSelected = selectedBlockId === block.id;

                    return (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        className={cn(
                          "group rounded-lg border p-3 transition-all cursor-pointer",
                          isSelected ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/20",
                          block.isLocked && "bg-emerald-50/30 border-emerald-200",
                          isCanonLocked && "cursor-default"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {mode === "structure" && <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 mt-1 cursor-grab" />}
                          <BlockIcon className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] text-muted-foreground font-medium uppercase">{blockTypeLabels[block.type]}</span>
                              {block.isLocked && <Lock className="w-3 h-3 text-emerald-600" />}
                              {block.aiDraft && <Badge className="text-[9px] bg-violet-100 text-violet-700 h-4">AI Draft</Badge>}
                            </div>

                            {/* STRUCTURE mode: just show type and label */}
                            {mode === "structure" && (
                              <p className="text-xs text-muted-foreground truncate">{block.content || "(empty)"}</p>
                            )}

                            {/* DRAFT mode: editable content + AI staging */}
                            {mode === "draft" && (
                              <div className="space-y-2">
                                {/* Human Editor Surface */}
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <Pencil className="w-3 h-3 text-blue-600" />
                                    <span className="text-[9px] font-semibold text-blue-600 uppercase">Human Editor</span>
                                  </div>
                                  <Textarea
                                    value={block.content}
                                    onChange={e => updateBlockContent(section.id, block.id, e.target.value)}
                                    placeholder={`Enter ${blockTypeLabels[block.type].toLowerCase()} content...`}
                                    className="text-sm min-h-[60px] resize-none"
                                    disabled={block.isLocked || isCanonLocked}
                                  />
                                </div>

                                {/* AI Staging Surface */}
                                {block.aiDraft && (
                                  <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center gap-1">
                                        <Bot className="w-3 h-3 text-violet-600" />
                                        <span className="text-[9px] font-semibold text-violet-600 uppercase">AI Staging</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost" size="sm"
                                          className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                          onClick={() => acceptAiDraft(section.id, block.id)}
                                        >
                                          <Check className="w-3 h-3 mr-0.5" /> Accept
                                        </Button>
                                        <Button
                                          variant="ghost" size="sm"
                                          className="h-6 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50"
                                          onClick={() => rejectAiDraft(section.id, block.id)}
                                        >
                                          <X className="w-3 h-3 mr-0.5" /> Reject
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-violet-900 leading-relaxed">{block.aiDraft}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* CANON mode: read-only locked content */}
                            {mode === "canon" && (
                              <p className="text-sm leading-relaxed">{block.content || <span className="text-muted-foreground italic">No content</span>}</p>
                            )}
                          </div>

                          {/* Block actions */}
                          {mode !== "canon" && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={e => { e.stopPropagation(); toggleBlockLock(section.id, block.id); }}
                                className={cn("p-1 rounded", block.isLocked ? "text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:bg-muted")}
                                title={block.isLocked ? "Unlock" : "Lock"}
                              >
                                {block.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                              {mode === "structure" && (
                                <button
                                  onClick={e => { e.stopPropagation(); removeBlock(section.id, block.id); }}
                                  className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600"
                                  title="Remove block"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add block button */}
                  {mode === "structure" && (
                    <div className="relative">
                      <button
                        onClick={() => { setShowBlockLibrary(!showBlockLibrary); setAddToSectionId(section.id); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Block
                      </button>
                      {showBlockLibrary && addToSectionId === section.id && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-card border border-border rounded-lg shadow-lg p-2 grid grid-cols-2 gap-1">
                          {BLOCK_LIBRARY.map(bl => {
                            const BLIcon = bl.icon;
                            return (
                              <button
                                key={bl.type}
                                onClick={() => addBlock(section.id, bl.type)}
                                className="flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors"
                              >
                                <BLIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div>
                                  <div className="text-xs font-medium">{bl.label}</div>
                                  <div className="text-[10px] text-muted-foreground">{bl.description}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add section */}
          {mode === "structure" && (
            <button
              onClick={addSection}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          )}
        </div>

        {/* Right: AI Prompt Box (visible in Draft mode) */}
        {mode === "draft" && (
          <div className="w-80 border-l border-border bg-muted/20 flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-semibold">AI Prompt Box</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Select a block, then describe what you want the AI to draft. The output appears in the AI Staging area for your review.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Quick prompts */}
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Quick Prompts</span>
                {[
                  "Write an executive summary",
                  "Draft scope of work items",
                  "Generate pricing justification",
                  "Write SLA framework",
                  "Draft terms and conditions",
                  "Create value proposition paragraph",
                ].map(qp => (
                  <button
                    key={qp}
                    onClick={() => setAiPrompt(qp)}
                    className="w-full text-left text-xs p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Wand2 className="w-3 h-3 inline mr-1.5" />{qp}
                  </button>
                ))}
              </div>

              {/* Selected block info */}
              {selectedBlockId && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-[10px] font-semibold text-primary uppercase">Selected Block</span>
                  {(() => {
                    for (const s of sections) {
                      const b = s.blocks.find(b => b.id === selectedBlockId);
                      if (b) return (
                        <div className="mt-1">
                          <div className="text-xs font-medium">{blockTypeLabels[b.type]} in "{s.title}"</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{b.content || "(empty)"}</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            {/* Prompt input */}
            <div className="p-4 border-t border-border">
              <Textarea
                ref={promptRef}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Describe what you want the AI to draft..."
                className="text-xs min-h-[80px] resize-none mb-2"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAiGenerate();
                }}
              />
              <Button
                className="w-full text-xs"
                onClick={handleAiGenerate}
                disabled={aiLoading || !selectedBlockId}
              >
                {aiLoading ? (
                  <><RotateCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating...</>
                ) : (
                  <><Send className="w-3.5 h-3.5 mr-1.5" /> Generate AI Draft</>
                )}
              </Button>
              {!selectedBlockId && (
                <p className="text-[10px] text-amber-600 mt-1.5 text-center">Select a block first</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
