/*
 * Document Composer v1 — Template-driven block editor with single sticky toolbar
 * Replaces CommercialEditor with:
 *   - Template selector (load a template recipe into the editor)
 *   - Block library sidebar with drag/drop composition
 *   - Single sticky WYSIWYG toolbar (applies to focused block)
 *   - Draft / Canon tabs
 *   - Data-bound blocks (pricing, scope, SLA) auto-bind to current snapshot
 *   - Branding profile selector for PDF compilation
 *   - No-AI-creep constraints enforced at block level
 * Design: White cards, subtle borders, enterprise SaaS aesthetic
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Calendar, Hash, Eye, Columns2, Palette, FileCode,
  Bot, Scale, Truck, Warehouse
} from "lucide-react";
import { customers, type Customer, formatSAR } from "@/lib/store";
import {
  type DocType, type DocBlock, type BlockFamily, type BlockEditorMode,
  type DocTemplate, type TemplateVersion, type BrandingProfile,
  type DocInstance, type DocInstanceVersion, type InstanceBlock,
  type Bindings, type RecipeBlock,
  blockLibrary, brandingProfiles, docTemplates, docInstances,
  getBlockByKey, getBlocksByFamily, getPublishedTemplates,
  getLatestTemplateVersion, getPublishedTemplateVersion,
  getBrandingProfile, isBlockEditable, isAIAllowed, canLockToCanon,
  BLOCK_FAMILY_CONFIG, EDITOR_MODE_CONFIG,
  DOC_TYPE_CONFIG, TEMPLATE_STATUS_CONFIG, DOC_INSTANCE_STATUS_CONFIG,
} from "@/lib/document-composer";

// ============================================================
// TYPES
// ============================================================

export type ComposerMode = "draft" | "canon";

export interface ComposerBlock {
  id: string;
  block_key: string;
  order: number;
  content: string;
  is_locked: boolean;
  is_ai_generated: boolean;
  config: Record<string, string>;
}

export interface ComposerDocument {
  id: string;
  doc_type: DocType;
  title: string;
  template_version_id: string;
  branding_profile_id: string;
  customer_id: string;
  customer_name: string;
  workspace_id: string | null;
  workspace_name: string | null;
  blocks: ComposerBlock[];
  bindings: Bindings;
  status: "draft" | "canon";
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// AI MOCK
// ============================================================

const AI_SUGGESTIONS: Record<string, string> = {
  "commercial": "<p>Hala Supply Chain Services, a leading 3PL provider in the Kingdom of Saudi Arabia, is pleased to present this comprehensive warehousing and logistics solution. With over two decades of operational excellence across the Eastern, Central, and Western regions, we bring unmatched expertise in temperature-controlled storage, multi-modal distribution, and value-added services.</p>",
  "legal": "<p>This agreement shall be governed by the laws of the Kingdom of Saudi Arabia. All disputes shall be resolved through amicable negotiation in the first instance, with arbitration as the final recourse under the rules of the Saudi Center for Commercial Arbitration.</p>",
  "annexure": "<p>The following annexure details the operational parameters, service configurations, and performance benchmarks that form an integral part of this agreement. All specifications herein are binding upon execution.</p>",
  "asset": "<p>Our state-of-the-art facilities across the Kingdom provide the infrastructure backbone for reliable, scalable logistics operations.</p>",
  "data_bound": "",
};

// ============================================================
// STICKY TOOLBAR — Single toolbar for the active block
// ============================================================

function StickyToolbar({ editor, isLocked, isReadonly, blockKey }: {
  editor: ReturnType<typeof useEditor>;
  isLocked: boolean;
  isReadonly: boolean;
  blockKey: string | null;
}) {
  if (!editor) return null;
  const disabled = isLocked || isReadonly;

  const ToolBtn = ({ onClick, isActive, icon: Icon, title, btnDisabled }: {
    onClick: () => void; isActive?: boolean; icon: typeof Bold; title: string; btnDisabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={btnDisabled || disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive ? "bg-[#1B2A4A] text-white" : "text-gray-600 hover:bg-gray-100"
      } ${(btnDisabled || disabled) ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <Icon size={15} />
    </button>
  );

  const blockDef = blockKey ? getBlockByKey(blockKey) : null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-3 py-1.5 border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
      {/* Active block indicator */}
      {blockDef && (
        <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-gray-200">
          <Badge variant="outline" className="text-[10px] h-5 capitalize">
            {BLOCK_FAMILY_CONFIG[blockDef.family]?.label || blockDef.family}
          </Badge>
          <span className="text-[10px] text-gray-400">{blockDef.display_name}</span>
        </div>
      )}
      {!blockDef && (
        <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-gray-200">
          <span className="text-[10px] text-gray-400 italic">Click a block to edit</span>
        </div>
      )}

      <ToolBtn onClick={() => editor.chain().focus().undo().run()} icon={Undo2} title="Undo" btnDisabled={!editor.can().undo()} />
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} icon={Redo2} title="Redo" btnDisabled={!editor.can().redo()} />
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
      <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={TableIcon} title="Insert Table" />
      <ToolBtn onClick={() => {
        const url = window.prompt("Enter URL:");
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }} isActive={editor.isActive("link")} icon={LinkIcon} title="Insert Link" />

      {/* Status indicators */}
      <div className="ml-auto flex items-center gap-1.5">
        {isReadonly && <Badge className="text-[10px] h-5 bg-gray-100 text-gray-600 border-0">Read-Only</Badge>}
        {isLocked && <Badge className="text-[10px] h-5 bg-[#1B2A4A]/10 text-[#1B2A4A] border-0"><Lock size={10} className="mr-0.5" /> Locked</Badge>}
      </div>
    </div>
  );
}

// ============================================================
// BLOCK EDITOR — Individual block with inline editor
// ============================================================

function BlockEditor({
  block, mode, isActive, onFocus, onContentChange, onLock, onDelete,
  onAIGenerate, aiStaging, onAcceptAI, onRejectAI, onMoveUp, onMoveDown,
  isFirst, isLast,
}: {
  block: ComposerBlock;
  mode: ComposerMode;
  isActive: boolean;
  onFocus: () => void;
  onContentChange: (content: string) => void;
  onLock: () => void;
  onDelete: () => void;
  onAIGenerate: () => void;
  aiStaging: string | null;
  onAcceptAI: () => void;
  onRejectAI: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const blockDef = getBlockByKey(block.block_key);
  const familyCfg = blockDef ? BLOCK_FAMILY_CONFIG[blockDef.family] : null;
  const modeCfg = blockDef ? EDITOR_MODE_CONFIG[blockDef.editor_mode] : null;
  const isLocked = block.is_locked || mode === "canon";
  const isReadonly = blockDef?.editor_mode === "readonly";
  const canEdit = !isLocked && !isReadonly && mode === "draft";
  const canAI = blockDef ? blockDef.permissions.ai_allowed && !isLocked && mode === "draft" : false;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Underline, TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      Link.configure({ openOnClick: false }), TextStyle, Color,
    ],
    content: block.content,
    editable: canEdit,
    onUpdate: ({ editor: e }) => { onContentChange(e.getHTML()); },
    onFocus: () => { onFocus(); },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== canEdit) {
      editor.setEditable(canEdit);
    }
  }, [canEdit, editor]);

  return (
    <div
      className={`rounded-xl border transition-all mb-3 ${
        isActive ? "border-[#1B2A4A]/40 shadow-md ring-1 ring-[#1B2A4A]/10" : "border-gray-200 shadow-none hover:shadow-sm"
      } ${isLocked ? "bg-gray-50/50" : "bg-white"}`}
      onClick={onFocus}
    >
      {/* Block Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        {mode === "draft" && !isLocked && (
          <div className="flex flex-col gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst}
              className={`text-gray-300 hover:text-gray-500 ${isFirst ? "opacity-30" : ""}`}>
              <ChevronDown size={10} className="rotate-180" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast}
              className={`text-gray-300 hover:text-gray-500 ${isLast ? "opacity-30" : ""}`}>
              <ChevronDown size={10} />
            </button>
          </div>
        )}
        <GripVertical size={14} className="text-gray-300" />

        {familyCfg && (
          <Badge variant="outline" className={`text-[10px] h-5 ${familyCfg.bg} ${familyCfg.color} border`}>
            {familyCfg.label}
          </Badge>
        )}
        <span className="text-xs font-medium text-[#1B2A4A]">{blockDef?.display_name || block.block_key}</span>
        {modeCfg && <Badge variant="outline" className="text-[10px] h-5">{modeCfg.label}</Badge>}

        <div className="ml-auto flex items-center gap-1">
          {block.is_ai_generated && (
            <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50">
              <Sparkles size={10} className="mr-0.5" /> AI
            </Badge>
          )}
          {isLocked ? (
            <Lock size={12} className="text-[#1B2A4A]/40" />
          ) : (
            <>
              {canAI && (
                <button onClick={(e) => { e.stopPropagation(); onAIGenerate(); }}
                  className="p-1 rounded hover:bg-amber-50 text-amber-600" title="Generate with AI">
                  <Wand2 size={14} />
                </button>
              )}
              {blockDef?.permissions.lockable && mode === "draft" && (
                <button onClick={(e) => { e.stopPropagation(); onLock(); }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Lock Block">
                  <Shield size={14} />
                </button>
              )}
              {mode === "draft" && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-1 rounded hover:bg-red-50 text-red-400" title="Remove Block">
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* AI Staging */}
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
          <div className="prose prose-sm max-w-none text-amber-900/80" dangerouslySetInnerHTML={{ __html: aiStaging }} />
        </div>
      )}

      {/* Block Content */}
      {editor && (
        <div className={`px-4 py-3 ${isLocked ? "opacity-80" : ""}`}>
          <EditorContent editor={editor} className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[40px] [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_th]:font-semibold" />
        </div>
      )}

      {/* Variable Slots Indicator */}
      {blockDef && blockDef.schema.variable_slots.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {blockDef.schema.variable_slots.map((slot, i) => (
            <code key={i} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{`{{${slot}}}`}</code>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CUSTOMER BANNER
// ============================================================

function CustomerBanner({ customer }: { customer: Customer | null }) {
  if (!customer) return null;
  return (
    <div className="px-4 py-2 bg-[#F8F9FB] border-b border-gray-100 flex items-center gap-4 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-[#1B2A4A] flex items-center justify-center text-white text-[10px] font-bold">
          {customer.name.substring(0, 2).toUpperCase()}
        </div>
        <span className="font-medium text-[#1B2A4A]">{customer.name}</span>
        <span className="text-gray-400">({customer.code})</span>
      </div>
      <Separator orientation="vertical" className="h-4" />
      <span className="text-gray-500">{customer.industry}</span>
      <span className="text-gray-500">{customer.city}, {customer.region}</span>
      <span className="text-gray-500">Contract: {formatSAR(customer.contractValue2025)}</span>
      <span className="text-gray-500">Expiry: {customer.contractExpiry}</span>
    </div>
  );
}

// ============================================================
// BLOCK LIBRARY SIDEBAR
// ============================================================

function BlockLibrarySidebar({ onAddBlock, onClose }: {
  onAddBlock: (blockKey: string) => void;
  onClose: () => void;
}) {
  const [filterFamily, setFilterFamily] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return blockLibrary.filter(b => {
      if (search && !b.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterFamily !== "all" && b.family !== filterFamily) return false;
      return true;
    });
  }, [search, filterFamily]);

  const grouped = useMemo(() => {
    const groups: Record<string, DocBlock[]> = {};
    filtered.forEach(b => {
      if (!groups[b.family]) groups[b.family] = [];
      groups[b.family].push(b);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="w-64 border-l border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1B2A4A] flex items-center gap-1.5">
          <LayoutTemplate size={14} /> Block Library
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <div className="p-2 border-b border-gray-100">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blocks..." className="h-7 text-xs" />
      </div>
      <div className="p-2 border-b border-gray-100 flex flex-wrap gap-1">
        <button onClick={() => setFilterFamily("all")}
          className={`text-[10px] px-2 py-0.5 rounded ${filterFamily === "all" ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-600"}`}>
          All
        </button>
        {Object.entries(BLOCK_FAMILY_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilterFamily(key)}
            className={`text-[10px] px-2 py-0.5 rounded ${filterFamily === key ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-600"}`}>
            {cfg.label}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {Object.entries(grouped).map(([family, blocks]) => {
            const cfg = BLOCK_FAMILY_CONFIG[family as BlockFamily];
            return (
              <div key={family}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${cfg.color}`}>{cfg.label}</div>
                <div className="space-y-1">
                  {blocks.map(block => (
                    <button key={block.id} onClick={() => onAddBlock(block.block_key)}
                      className="w-full flex items-center gap-2 p-2 rounded border border-gray-100 hover:border-[#1B2A4A]/30 hover:bg-[#F8F9FB] text-left transition-colors">
                      <GripVertical size={10} className="text-gray-300 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-[#1B2A4A] truncate">{block.display_name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{block.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================
// TEMPLATE SELECTOR DIALOG
// ============================================================

function TemplateSelector({ open, onClose, onSelect, docType }: {
  open: boolean;
  onClose: () => void;
  onSelect: (template: DocTemplate, version: TemplateVersion, brandingId: string) => void;
  docType: DocType;
}) {
  const [selectedBranding, setSelectedBranding] = useState(brandingProfiles[0]?.id || "");
  const templates = useMemo(() => {
    return getPublishedTemplates().filter(t => t.doc_type === docType);
  }, [docType]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#1B2A4A] font-serif">Select Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Branding Profile</label>
            <Select value={selectedBranding} onValueChange={setSelectedBranding}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {brandingProfiles.map(bp => (
                  <SelectItem key={bp.id} value={bp.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: bp.primary_color }} />
                      {bp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="space-y-2">
            {templates.map(tpl => {
              const version = getPublishedTemplateVersion(tpl);
              if (!version) return null;
              return (
                <Card key={tpl.id} className="cursor-pointer border border-gray-200 hover:border-[#1B2A4A]/30 hover:shadow-sm transition-all"
                  onClick={() => onSelect(tpl, version, selectedBranding)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[#F8F9FB]">
                        <FileText size={18} className="text-[#1B2A4A]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-[#1B2A4A]">{tpl.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                          <span>v{version.version_number}</span>
                          <span>·</span>
                          <span>{version.recipe.length} blocks</span>
                          <span>·</span>
                          <span>{version.recipe.filter(r => r.required).length} required</span>
                          <span>·</span>
                          <Badge variant="outline" className="text-[10px] h-4">{tpl.default_locale.toUpperCase()}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No published templates for this document type</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN DOCUMENT COMPOSER
// ============================================================

interface DocumentComposerProps {
  documentType: DocType;
  workspaceId?: string;
  customerId?: string;
  customerName?: string;
  existingInstanceId?: string;
  onSave?: (doc: ComposerDocument) => void;
  onExportPDF?: (doc: ComposerDocument) => void;
}

export default function DocumentComposer({
  documentType, workspaceId = "", customerId = "", customerName = "",
  existingInstanceId, onSave, onExportPDF,
}: DocumentComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("draft");
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showPromptBox, setShowPromptBox] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [aiStagingMap, setAiStagingMap] = useState<Record<string, string>>({});

  // Load existing instance or create empty document
  const [document, setDocument] = useState<ComposerDocument>(() => {
    if (existingInstanceId) {
      const instance = docInstances.find(di => di.id === existingInstanceId);
      if (instance) {
        const version = instance.versions.find(v => v.id === instance.current_version_id);
        if (version) {
          return {
            id: instance.id, doc_type: instance.doc_type,
            title: `${instance.customer_name} — ${DOC_TYPE_CONFIG[instance.doc_type].label}`,
            template_version_id: instance.template_version_id,
            branding_profile_id: "bp-001",
            customer_id: instance.customer_id, customer_name: instance.customer_name,
            workspace_id: instance.workspace_id, workspace_name: instance.workspace_name,
            blocks: version.blocks.map((b, i) => ({
              id: `blk-${i}-${Date.now()}`, block_key: b.block_key, order: b.order,
              content: b.content, is_locked: b.is_locked, is_ai_generated: b.is_ai_generated, config: b.config,
            })),
            bindings: version.bindings,
            status: instance.status, version: version.version_number,
            created_at: instance.created_at, updated_at: instance.updated_at,
          };
        }
      }
    }
    return {
      id: `doc-${Date.now()}`, doc_type: documentType,
      title: `New ${DOC_TYPE_CONFIG[documentType].label}`,
      template_version_id: "", branding_profile_id: "bp-001",
      customer_id: customerId, customer_name: customerName,
      workspace_id: workspaceId || null, workspace_name: null,
      blocks: [], bindings: { pricing_snapshot_id: null, scope_snapshot_id: null, ecr_score_id: null, sla_snapshot_id: null },
      status: "draft", version: 1,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
  });

  // Show template selector if no blocks loaded
  useEffect(() => {
    if (document.blocks.length === 0 && !existingInstanceId) {
      setShowTemplateSelector(true);
    }
  }, []);

  // Resolve customer
  const linkedCustomer = useMemo(() => {
    if (document.customer_id) return customers.find(c => c.id === document.customer_id) || null;
    if (document.customer_name) return customers.find(c => c.name === document.customer_name) || null;
    return null;
  }, [document.customer_id, document.customer_name]);

  // Active block info
  const activeBlock = useMemo(() => {
    return document.blocks.find(b => b.id === activeBlockId) || null;
  }, [document.blocks, activeBlockId]);

  const activeBlockDef = useMemo(() => {
    return activeBlock ? getBlockByKey(activeBlock.block_key) : null;
  }, [activeBlock]);

  // Create a shared editor for the sticky toolbar to reference
  const toolbarEditor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline, TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      Link.configure({ openOnClick: false }), TextStyle, Color,
    ],
    content: "",
    editable: false,
  });

  // Template loading
  const handleTemplateSelect = useCallback((template: DocTemplate, version: TemplateVersion, brandingId: string) => {
    const blocks: ComposerBlock[] = version.recipe.map((recipe, i) => {
      const blockDef = getBlockByKey(recipe.block_key);
      return {
        id: `blk-${i}-${Date.now()}`,
        block_key: recipe.block_key,
        order: recipe.order,
        content: recipe.default_content_override || blockDef?.default_content || "<p>Block content</p>",
        is_locked: false,
        is_ai_generated: false,
        config: { ...recipe.config_override },
      };
    });

    setDocument(prev => ({
      ...prev,
      title: `${prev.customer_name || "New"} — ${template.name}`,
      template_version_id: version.id,
      branding_profile_id: brandingId,
      blocks,
      updated_at: new Date().toISOString(),
    }));
    setShowTemplateSelector(false);
    toast.success(`Template "${template.name}" loaded with ${blocks.length} blocks`);
  }, []);

  // Block operations
  const addBlock = useCallback((blockKey: string) => {
    const blockDef = getBlockByKey(blockKey);
    if (!blockDef) return;
    const newBlock: ComposerBlock = {
      id: `blk-${Date.now()}`, block_key: blockKey,
      order: document.blocks.length + 1,
      content: blockDef.default_content,
      is_locked: false, is_ai_generated: false, config: {},
    };
    setDocument(prev => ({
      ...prev, updated_at: new Date().toISOString(),
      blocks: [...prev.blocks, newBlock],
    }));
    toast.success(`Added "${blockDef.display_name}"`);
  }, [document.blocks.length]);

  const updateBlockContent = useCallback((blockId: string, content: string) => {
    setDocument(prev => ({
      ...prev, updated_at: new Date().toISOString(),
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, content } : b),
    }));
  }, []);

  const lockBlock = useCallback((blockId: string) => {
    setDocument(prev => ({
      ...prev, updated_at: new Date().toISOString(),
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, is_locked: true } : b),
    }));
    toast.success("Block locked");
  }, []);

  const removeBlock = useCallback((blockId: string) => {
    setDocument(prev => ({
      ...prev, updated_at: new Date().toISOString(),
      blocks: prev.blocks.filter(b => b.id !== blockId),
    }));
    toast.success("Block removed");
  }, []);

  const moveBlock = useCallback((blockId: string, direction: "up" | "down") => {
    setDocument(prev => {
      const idx = prev.blocks.findIndex(b => b.id === blockId);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.blocks.length) return prev;
      const newBlocks = [...prev.blocks];
      [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
      return { ...prev, blocks: newBlocks.map((b, i) => ({ ...b, order: i + 1 })), updated_at: new Date().toISOString() };
    });
  }, []);

  // AI operations
  const handleAIGenerate = useCallback((blockId: string) => {
    const block = document.blocks.find(b => b.id === blockId);
    if (!block) return;
    const blockDef = getBlockByKey(block.block_key);
    if (!blockDef || !blockDef.permissions.ai_allowed) {
      toast.error("AI is not allowed for this block type");
      return;
    }
    toast.info("AI is generating content...");
    setTimeout(() => {
      const suggestion = AI_SUGGESTIONS[blockDef.family] || AI_SUGGESTIONS["commercial"];
      setAiStagingMap(prev => ({ ...prev, [blockId]: suggestion }));
      toast.success("AI draft ready — review in staging area");
    }, 1200);
  }, [document.blocks]);

  const handleAcceptAI = useCallback((blockId: string) => {
    const staged = aiStagingMap[blockId];
    if (!staged) return;
    updateBlockContent(blockId, staged);
    setDocument(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === blockId ? { ...b, is_ai_generated: true } : b),
    }));
    setAiStagingMap(prev => { const next = { ...prev }; delete next[blockId]; return next; });
    toast.success("AI content accepted");
  }, [aiStagingMap, updateBlockContent]);

  const handleRejectAI = useCallback((blockId: string) => {
    setAiStagingMap(prev => { const next = { ...prev }; delete next[blockId]; return next; });
    toast.info("AI suggestion rejected");
  }, []);

  // AI Prompt
  const handlePromptSubmit = useCallback(() => {
    if (!promptText.trim()) return;
    toast.info("AI is processing your prompt...");
    setTimeout(() => {
      const newBlock: ComposerBlock = {
        id: `blk-ai-${Date.now()}`, block_key: "intro.narrative",
        order: document.blocks.length + 1,
        content: `<h2>Generated Content</h2><p>${promptText}</p><p>Hala Supply Chain Services has extensive experience in this area. Our dedicated team ensures seamless execution of all operational requirements, backed by industry-leading technology and proven processes.</p>`,
        is_locked: false, is_ai_generated: true, config: {},
      };
      setDocument(prev => ({
        ...prev, updated_at: new Date().toISOString(),
        blocks: [...prev.blocks, newBlock],
      }));
      setPromptText("");
      setShowPromptBox(false);
      toast.success("AI generated a new block — review and edit as needed");
    }, 1500);
  }, [promptText, document.blocks.length]);

  // Save & Export
  const handleSave = useCallback(() => {
    if (onSave) onSave(document);
    toast.success("Document saved");
  }, [document, onSave]);

  const handleExportPDF = useCallback(() => {
    if (onExportPDF) onExportPDF(document);
    toast.success("PDF compile initiated — document will be available in Documents shell");
  }, [document, onExportPDF]);

  const lockAllBlocks = useCallback(() => {
    setDocument(prev => ({
      ...prev, status: "canon", updated_at: new Date().toISOString(),
      blocks: prev.blocks.map(b => ({ ...b, is_locked: true })),
    }));
    setMode("canon");
    toast.success("Document locked as Canon — immutable version created");
  }, []);

  const lockedCount = document.blocks.filter(b => b.is_locked).length;
  const totalCount = document.blocks.length;
  const brandingProfile = getBrandingProfile(document.branding_profile_id);

  const docTypeConfig = DOC_TYPE_CONFIG[documentType];

  return (
    <div className="flex h-full bg-white">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-[#F8F9FB]">
              <FileText size={18} className="text-[#1B2A4A]" />
            </div>
            <div>
              <Input value={document.title} onChange={(e) => setDocument(prev => ({ ...prev, title: e.target.value }))}
                className="h-7 text-base font-semibold border-none bg-transparent p-0 focus-visible:ring-0 w-[400px]" disabled={mode === "canon"} />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">{docTypeConfig.label}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500">v{document.version}</span>
                {linkedCustomer && (
                  <>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs font-medium text-[#1B2A4A]">{linkedCustomer.name}</span>
                  </>
                )}
                {brandingProfile && (
                  <>
                    <span className="text-xs text-gray-300">·</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: brandingProfile.primary_color }} />
                      <span className="text-[10px] text-gray-400">{brandingProfile.name}</span>
                    </div>
                  </>
                )}
                <span className="text-xs text-gray-300">·</span>
                <Badge variant={document.status === "canon" ? "default" : "outline"} className="text-[10px] h-4 capitalize">{document.status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplateSelector(true)} className="text-xs h-7" disabled={mode === "canon"}>
              <LayoutTemplate size={12} className="mr-1" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBlockLibrary(!showBlockLibrary)} className="text-xs h-7" disabled={mode === "canon"}>
              <Layers size={12} className="mr-1" /> Blocks
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Button variant="outline" size="sm" onClick={handleSave} disabled={mode === "canon"} className="text-xs h-7">
              <Save size={12} className="mr-1" /> Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="text-xs h-7">
              <Download size={12} className="mr-1" /> Compile PDF
            </Button>
            {mode !== "canon" && (
              <Button variant="default" size="sm" onClick={lockAllBlocks} className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs h-7">
                <Lock size={12} className="mr-1" /> Lock as Canon
              </Button>
            )}
          </div>
        </div>

        {/* Customer Banner */}
        <CustomerBanner customer={linkedCustomer} />

        {/* Mode Tabs */}
        <div className="px-4 pt-2 border-b border-gray-100 flex items-center justify-between">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ComposerMode)}>
            <TabsList className="bg-gray-100/80 h-8">
              <TabsTrigger value="draft" className="text-xs gap-1 h-6" disabled={mode === "canon"}>
                <PenTool size={12} /> Draft
              </TabsTrigger>
              <TabsTrigger value="canon" className="text-xs gap-1 h-6">
                <Shield size={12} /> Canon
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{lockedCount}/{totalCount} blocks locked</span>
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#1B2A4A] rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (lockedCount / totalCount) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* Sticky Toolbar */}
        <StickyToolbar
          editor={toolbarEditor}
          isLocked={activeBlock?.is_locked || mode === "canon" || false}
          isReadonly={activeBlockDef?.editor_mode === "readonly" || false}
          blockKey={activeBlock?.block_key || null}
        />

        {/* Content Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto">
            {document.blocks.length === 0 && (
              <div className="text-center py-16">
                <LayoutTemplate size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-500 mb-2">No blocks loaded</h3>
                <p className="text-sm text-gray-400 mb-4">Select a template to load a document recipe, or add blocks from the library</p>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => setShowTemplateSelector(true)}>
                    <LayoutTemplate size={14} className="mr-1.5" /> Load Template
                  </Button>
                  <Button variant="outline" onClick={() => setShowBlockLibrary(true)}>
                    <Layers size={14} className="mr-1.5" /> Open Block Library
                  </Button>
                </div>
              </div>
            )}

            {document.blocks.map((block, idx) => (
              <BlockEditor
                key={block.id}
                block={block}
                mode={mode}
                isActive={activeBlockId === block.id}
                onFocus={() => setActiveBlockId(block.id)}
                onContentChange={(content) => updateBlockContent(block.id, content)}
                onLock={() => lockBlock(block.id)}
                onDelete={() => removeBlock(block.id)}
                onAIGenerate={() => handleAIGenerate(block.id)}
                aiStaging={aiStagingMap[block.id] || null}
                onAcceptAI={() => handleAcceptAI(block.id)}
                onRejectAI={() => handleRejectAI(block.id)}
                onMoveUp={() => moveBlock(block.id, "up")}
                onMoveDown={() => moveBlock(block.id, "down")}
                isFirst={idx === 0}
                isLast={idx === document.blocks.length - 1}
              />
            ))}

            {/* Add Block Actions */}
            {mode === "draft" && document.blocks.length > 0 && (
              <div className="flex items-center gap-2 mt-2 mb-4">
                <Button variant="outline" size="sm" onClick={() => setShowBlockLibrary(true)} className="text-xs">
                  <Plus size={14} className="mr-1" /> Add Block
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPromptBox(!showPromptBox)}
                  className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Sparkles size={14} className="mr-1" /> AI Prompt
                </Button>
              </div>
            )}

            {/* AI Prompt Box */}
            {showPromptBox && mode === "draft" && (
              <Card className="mb-4 border-amber-300 bg-amber-50/30">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
                    <Sparkles size={14} /> AI Prompt Box
                    <button onClick={() => setShowPromptBox(false)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-xs text-amber-700 mb-2">Describe what you need. AI will generate a new narrative block. Human reviews before it enters the document.</p>
                  <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
                    placeholder="e.g., Write an executive summary for a warehousing proposal for a petrochemical client in Jubail..." className="text-sm mb-2 min-h-[80px]" />
                  <Button size="sm" onClick={handlePromptSubmit} className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Send size={14} className="mr-1" /> Generate
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Sidebar — Block Library (conditional) */}
      {showBlockLibrary && (
        <BlockLibrarySidebar onAddBlock={addBlock} onClose={() => setShowBlockLibrary(false)} />
      )}

      {/* Right Sidebar — Document Info (when block library is closed) */}
      {!showBlockLibrary && (
        <div className="w-64 border-l border-gray-200 bg-[#F8F9FB] flex flex-col overflow-y-auto">
          {/* Customer Card */}
          {linkedCustomer && (
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2 flex items-center gap-1.5">
                <Building2 size={12} /> Customer
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded bg-[#1B2A4A] flex items-center justify-center text-white text-[10px] font-bold">
                    {linkedCustomer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1B2A4A]">{linkedCustomer.name}</div>
                    <div className="text-[10px] text-gray-500">{linkedCustomer.code}</div>
                  </div>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-gray-500">Industry</span><span className="font-medium">{linkedCustomer.industry}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Region</span><span className="font-medium">{linkedCustomer.city}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Contract</span><span className="font-medium">{formatSAR(linkedCustomer.contractValue2025)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Expiry</span><span className="font-medium">{linkedCustomer.contractExpiry}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Branding Profile */}
          {brandingProfile && (
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2 flex items-center gap-1.5">
                <Palette size={12} /> Branding
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-2.5">
                <div className="text-xs font-medium text-[#1B2A4A] mb-1.5">{brandingProfile.name}</div>
                <div className="flex gap-1 mb-1.5">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: brandingProfile.primary_color }} />
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: brandingProfile.secondary_color }} />
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: brandingProfile.accent_color }} />
                </div>
                <div className="text-[10px] text-gray-400">{brandingProfile.font_family} / {brandingProfile.font_heading}</div>
              </div>
            </div>
          )}

          {/* Document Info */}
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2">Document Info</h3>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{docTypeConfig.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Version</span><span className="font-medium">v{document.version}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge variant="outline" className="text-[10px] h-4 capitalize">{document.status}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-500">Blocks</span><span className="font-medium">{totalCount}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Locked</span><span className="font-medium">{lockedCount}</span></div>
            </div>
          </div>

          {/* Block Navigator */}
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2">Block Navigator</h3>
            <ScrollArea className="max-h-[250px]">
              <div className="space-y-0.5">
                {document.blocks.map((b, i) => {
                  const def = getBlockByKey(b.block_key);
                  const isActive = activeBlockId === b.id;
                  return (
                    <button key={b.id} onClick={() => setActiveBlockId(b.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                        isActive ? "bg-white border border-[#1B2A4A]/20 shadow-sm" : "hover:bg-white"
                      }`}>
                      <span className="text-gray-400 w-4 text-[10px]">{i + 1}</span>
                      <span className="truncate flex-1 text-[11px]">{def?.display_name || b.block_key}</span>
                      {b.is_locked && <Lock size={9} className="text-[#1B2A4A]/40" />}
                      {b.is_ai_generated && <Sparkles size={9} className="text-amber-500" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Bindings */}
          <div className="p-3">
            <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2">Data Bindings</h3>
            <div className="space-y-1.5 text-[10px]">
              {[
                { label: "Pricing Snapshot", value: document.bindings.pricing_snapshot_id },
                { label: "Scope Snapshot", value: document.bindings.scope_snapshot_id },
                { label: "ECR Score", value: document.bindings.ecr_score_id },
                { label: "SLA Snapshot", value: document.bindings.sla_snapshot_id },
              ].map((binding, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-white rounded border border-gray-100">
                  <span className="text-gray-500">{binding.label}</span>
                  {binding.value ? (
                    <code className="text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded">{binding.value}</code>
                  ) : (
                    <span className="text-gray-300 italic">Not bound</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template Selector Dialog */}
      <TemplateSelector
        open={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={handleTemplateSelect}
        docType={documentType}
      />
    </div>
  );
}
