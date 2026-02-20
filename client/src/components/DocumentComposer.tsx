/**
 * Document Composer v3 — Complete Rewrite
 * 
 * FIXES from v2:
 *   1. Header: Split into two clean rows (info row + action row)
 *   2. Sticky toolbar: Uses native overflow-y-auto container (not Radix ScrollArea)
 *      so CSS `sticky top-0` actually works inside the scroll container
 *   3. Editor wiring: `activeEditor` is React STATE (not a ref), so toolbar re-renders
 *      when user clicks different blocks
 *   4. Block focus: `onActivate(editor)` callback sets both activeBlockId AND activeEditor
 *      in a single state update batch
 *   5. Navigation: Uses wouter's useLocation for Output Studio link
 *   6. All entry points: Works standalone (/editor), embedded (Proposals, Quotes, SLAs)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
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
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Heading1, Heading2, Heading3,
  Table as TableIcon, Link as LinkIcon, Highlighter,
  Undo2, Redo2, FileText, Save, Lock,
  Sparkles, Send, ChevronDown, Plus,
  Trash2, GripVertical, X, Download,
  BookOpen, FileCheck, FileSignature, ClipboardList,
  Layers, PenTool, Shield, LayoutTemplate, Wand2, Check,
  Building2, Palette, ImageIcon, Variable, Eye,
  Bot, Scale, Truck, Warehouse, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, ChevronRight, Hash, DollarSign,
  Calendar, Phone, Users, BarChart3, Type, ToggleLeft,
  Percent, Image as ImageLucide, Mail, Star, MapPin,
  CreditCard, Package, Activity, ShieldCheck, ArrowLeft
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
import {
  type VariableDefinition, type MissingToken, type TokenResolutionResult,
  type ResolutionContext,
  variableDefinitions, NAMESPACE_CONFIG, DATA_TYPE_CONFIG,
  getVariablesGroupedByNamespace, getVariablesForDocType,
  buildResolutionContext, resolveTokens, resolveDocumentTokens,
  checkCompileReadiness, getOverridesForInstance, setVariableOverride,
} from "@/lib/semantic-variables";

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
  is_compiled: boolean;
  compiled_at: string | null;
}

// ============================================================
// AI MOCK
// ============================================================

const AI_SUGGESTIONS: Record<string, string> = {
  "commercial": "<p>Hala Supply Chain Services, a leading 3PL provider in the Kingdom of Saudi Arabia, is pleased to present this comprehensive warehousing and logistics solution. With over two decades of operational excellence across the Eastern, Central, and Western regions, we bring unmatched expertise in temperature-controlled storage, multi-modal distribution, and value-added services.</p>",
  "legal": "<p>This agreement shall be governed by the laws of the Kingdom of Saudi Arabia. All disputes shall be resolved through amicable negotiation in the first instance, with arbitration as the final recourse under the rules of the Saudi Center for Commercial Arbitration.</p>",
  "annexure": "<p>The following annexure details the operational parameters, service configurations, and performance benchmarks that form an integral part of this agreement.</p>",
  "asset": "<p>Our state-of-the-art facilities across the Kingdom provide the infrastructure backbone for reliable, scalable logistics operations.</p>",
  "data_bound": "",
};

// ============================================================
// NAMESPACE ICON MAP
// ============================================================

const NS_ICON_MAP: Record<string, typeof Building2> = {
  Building2, Users, FileCheck, BookOpen, FileSignature, DollarSign,
  Calendar, Phone, ClipboardList, BarChart3, Type, Hash,
  ToggleLeft, ImageLucide, TableIcon, Percent,
};

function getNamespaceIcon(iconName: string) {
  return NS_ICON_MAP[iconName] || Variable;
}

// ============================================================
// TOKEN INSERT MODAL
// ============================================================

function TokenInsertModal({ open, onClose, onInsert, docType }: {
  open: boolean;
  onClose: () => void;
  onInsert: (tokenKey: string) => void;
  docType: DocType;
}) {
  const [search, setSearch] = useState("");
  const [expandedNs, setExpandedNs] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => getVariablesGroupedByNamespace(docType), [docType]);

  const filteredGrouped = useMemo(() => {
    if (!search.trim()) return grouped;
    const s = search.toLowerCase();
    const result: Record<string, VariableDefinition[]> = {};
    for (const [ns, vars] of Object.entries(grouped)) {
      const filtered = vars.filter(v =>
        v.label.toLowerCase().includes(s) ||
        v.key.toLowerCase().includes(s) ||
        v.description.toLowerCase().includes(s)
      );
      if (filtered.length > 0) result[ns] = filtered;
    }
    return result;
  }, [grouped, search]);

  const toggleNs = (ns: string) => {
    setExpandedNs(prev => ({ ...prev, [ns]: !prev[ns] }));
  };

  useEffect(() => {
    if (search.trim()) {
      const allExpanded: Record<string, boolean> = {};
      Object.keys(filteredGrouped).forEach(ns => { allExpanded[ns] = true; });
      setExpandedNs(allExpanded);
    }
  }, [search, filteredGrouped]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#1B2A4A] font-serif flex items-center gap-2">
            <Variable size={18} /> Insert Custom Value
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Select a token to insert at cursor position. Tokens resolve deterministically from bound data.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables by name, key, or description..."
            className="h-8 text-xs" autoFocus />
        </div>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-1 pb-4">
            {Object.entries(filteredGrouped).map(([ns, vars]) => {
              const nsCfg = NAMESPACE_CONFIG[ns];
              const isExpanded = expandedNs[ns] !== false;
              const Icon = nsCfg ? getNamespaceIcon(nsCfg.icon) : Variable;
              return (
                <div key={ns}>
                  <button onClick={() => toggleNs(ns)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left">
                    <ChevronRight size={12} className={`text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    <div className={`p-1 rounded ${nsCfg?.bg || "bg-gray-100"}`}>
                      <Icon size={12} className={nsCfg?.color || "text-gray-600"} />
                    </div>
                    <span className="text-xs font-semibold text-[#1B2A4A]">{nsCfg?.label || ns}</span>
                    <Badge variant="outline" className="text-[10px] h-4 ml-auto">{vars.length}</Badge>
                  </button>
                  {isExpanded && (
                    <div className="ml-7 space-y-0.5 mb-2">
                      {vars.map(v => (
                        <button key={v.id} onClick={() => { onInsert(v.key); onClose(); }}
                          className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-blue-50 text-left transition-colors group">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[#1B2A4A]">{v.label}</span>
                              <code className="text-[9px] bg-gray-100 text-gray-500 px-1 rounded font-mono">{`{{${v.key}}}`}</code>
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">{v.description}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                            {DATA_TYPE_CONFIG[v.data_type]?.label || v.data_type}
                          </Badge>
                          <Plus size={12} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(filteredGrouped).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No variables match your search</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// BLOCK ADD CONFIRMATION DIALOG
// ============================================================

function BlockAddConfirmDialog({ open, onClose, onConfirm, block, insertionPoint }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (position: "after_current" | "end") => void;
  block: DocBlock | null;
  insertionPoint: string;
}) {
  const [position, setPosition] = useState<"after_current" | "end">("end");

  if (!block) return null;
  const familyCfg = BLOCK_FAMILY_CONFIG[block.family];
  const modeCfg = EDITOR_MODE_CONFIG[block.editor_mode];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1B2A4A] font-serif flex items-center gap-2">
            <Plus size={16} /> Add Block
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Confirm adding this block to your document
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Card className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${familyCfg.bg}`}>
                  <Layers size={16} className={familyCfg.color} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[#1B2A4A]">{block.display_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{block.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={`text-[10px] h-4 ${familyCfg.bg} ${familyCfg.color}`}>
                      {familyCfg.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4">{modeCfg.label}</Badge>
                    {block.permissions.ai_allowed && (
                      <Badge variant="outline" className="text-[10px] h-4 border-amber-300 text-amber-700 bg-amber-50">AI</Badge>
                    )}
                  </div>
                  {block.schema.variable_slots.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {block.schema.variable_slots.map((slot, i) => (
                        <code key={i} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{`{{${slot}}}`}</code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="mt-3">
            <label className="text-xs font-medium text-gray-700 mb-1.5 block">Insertion Point</label>
            <Select value={position} onValueChange={(v) => setPosition(v as "after_current" | "end")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="after_current">After current block{insertionPoint ? ` (${insertionPoint})` : ""}</SelectItem>
                <SelectItem value="end">At end of document</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={() => { onConfirm(position); onClose(); }}
            className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs">
            <Plus size={12} className="mr-1" /> Add Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// IMAGE INSERT DIALOG
// ============================================================

function ImageInsertDialog({ open, onClose, onInsert }: {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string, alt: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");

  const sampleImages = [
    { url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800", alt: "Warehouse Operations" },
    { url: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800", alt: "Logistics Fleet" },
    { url: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800", alt: "Supply Chain" },
    { url: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800", alt: "Industrial Facility" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1B2A4A] font-serif flex items-center gap-2">
            <ImageIcon size={16} /> Insert Image
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Enter an image URL or select from the asset library
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Image URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..." className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Alt Text</label>
            <Input value={alt} onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image..." className="h-8 text-xs" />
          </div>
          <Separator />
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">Asset Library</label>
            <div className="grid grid-cols-2 gap-2">
              {sampleImages.map((img, i) => (
                <button key={i} onClick={() => { setUrl(img.url); setAlt(img.alt); }}
                  className={`rounded-lg border-2 overflow-hidden transition-all ${
                    url === img.url ? "border-[#1B2A4A] shadow-md" : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <img src={img.url} alt={img.alt} className="w-full h-20 object-cover" />
                  <div className="px-2 py-1 text-[10px] text-gray-500 truncate">{img.alt}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" disabled={!url.trim()} onClick={() => { onInsert(url, alt); onClose(); setUrl(""); setAlt(""); }}
            className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs">
            <ImageIcon size={12} className="mr-1" /> Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// PDF PREVIEW VIEWER MODAL
// ============================================================

function PDFPreviewModal({ open, onClose, compiledHtml, missingTokens, onRecompile, onApprove }: {
  open: boolean;
  onClose: () => void;
  compiledHtml: string;
  missingTokens: MissingToken[];
  onRecompile: () => void;
  onApprove: () => void;
}) {
  const blockingErrors = missingTokens.filter(t => t.severity === "error");
  const warnings = missingTokens.filter(t => t.severity === "warning");
  const infos = missingTokens.filter(t => t.severity === "info");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#1B2A4A] font-serif flex items-center gap-2">
            <Eye size={18} /> PDF Preview
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Review the compiled document before saving. Resolve any missing tokens marked below.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex gap-4 overflow-hidden">
          <div className="flex-1 border border-gray-200 rounded-lg overflow-auto bg-white">
            <div className="p-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: compiledHtml }} />
          </div>
          <div className="w-64 flex flex-col">
            <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2">Token Status</h3>
            <div className="space-y-2 flex-1 overflow-auto">
              {blockingErrors.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <XCircle size={12} className="text-red-500" />
                    <span className="text-[10px] font-semibold text-red-700">Blocking Errors ({blockingErrors.length})</span>
                  </div>
                  {blockingErrors.map((t, i) => (
                    <div key={i} className="px-2 py-1 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 mb-1">
                      <span className="font-medium">{t.label}</span>
                      <code className="ml-1 text-[9px] bg-red-100 px-1 rounded">{`{{${t.key}}}`}</code>
                    </div>
                  ))}
                </div>
              )}
              {warnings.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={12} className="text-amber-500" />
                    <span className="text-[10px] font-semibold text-amber-700">Warnings ({warnings.length})</span>
                  </div>
                  {warnings.map((t, i) => (
                    <div key={i} className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 mb-1">
                      <span className="font-medium">{t.label}</span>
                      <code className="ml-1 text-[9px] bg-amber-100 px-1 rounded">{`{{${t.key}}}`}</code>
                    </div>
                  ))}
                </div>
              )}
              {infos.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={12} className="text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-500">Empty Fallbacks ({infos.length})</span>
                  </div>
                  {infos.map((t, i) => (
                    <div key={i} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500 mb-1">
                      <span className="font-medium">{t.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {missingTokens.length === 0 && (
                <div className="text-center py-4">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs text-emerald-700 font-medium">All tokens resolved</p>
                  <p className="text-[10px] text-gray-400 mt-1">Document is ready for approval</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {blockingErrors.length > 0 ? (
              <span className="text-red-600 font-medium">Cannot approve — {blockingErrors.length} blocking error(s)</span>
            ) : warnings.length > 0 ? (
              <span className="text-amber-600">Warning: {warnings.length} warning(s) — review before approving</span>
            ) : (
              <span className="text-emerald-600">Ready to approve</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRecompile} className="text-xs">
              <RefreshCw size={12} className="mr-1" /> Fix & Recompile
            </Button>
            <Button size="sm" disabled={blockingErrors.length > 0} onClick={onApprove}
              className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs">
              <Check size={12} className="mr-1" /> Approve & Save to Documents
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// STICKY TOOLBAR — receives activeEditor as STATE prop
// ============================================================

function StickyToolbar({ activeEditor, isLocked, isReadonly, blockKey, onInsertToken, onInsertImage }: {
  activeEditor: Editor | null;
  isLocked: boolean;
  isReadonly: boolean;
  blockKey: string | null;
  onInsertToken: () => void;
  onInsertImage: () => void;
}) {
  const disabled = isLocked || isReadonly || !activeEditor;

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
      <Icon size={14} />
    </button>
  );

  const blockDef = blockKey ? getBlockByKey(blockKey) : null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-3 py-1.5 border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
      {blockDef ? (
        <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-gray-200">
          <Badge variant="outline" className="text-[10px] h-5 capitalize">
            {BLOCK_FAMILY_CONFIG[blockDef.family]?.label || blockDef.family}
          </Badge>
          <span className="text-[10px] text-gray-400 max-w-[120px] truncate">{blockDef.display_name}</span>
          {isReadonly && <Badge className="text-[9px] h-4 bg-gray-100 text-gray-500 border-0">Read-Only</Badge>}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-gray-200">
          <span className="text-[10px] text-gray-400 italic">Click a block to edit</span>
        </div>
      )}

      <ToolBtn onClick={() => activeEditor?.chain().focus().undo().run()} icon={Undo2} title="Undo" btnDisabled={!activeEditor?.can().undo()} />
      <ToolBtn onClick={() => activeEditor?.chain().focus().redo().run()} icon={Redo2} title="Redo" btnDisabled={!activeEditor?.can().redo()} />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 1 }).run()} isActive={activeEditor?.isActive("heading", { level: 1 })} icon={Heading1} title="Heading 1" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 2 }).run()} isActive={activeEditor?.isActive("heading", { level: 2 })} icon={Heading2} title="Heading 2" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 3 }).run()} isActive={activeEditor?.isActive("heading", { level: 3 })} icon={Heading3} title="Heading 3" />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleBold().run()} isActive={activeEditor?.isActive("bold")} icon={Bold} title="Bold" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleItalic().run()} isActive={activeEditor?.isActive("italic")} icon={Italic} title="Italic" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleUnderline().run()} isActive={activeEditor?.isActive("underline")} icon={UnderlineIcon} title="Underline" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleStrike().run()} isActive={activeEditor?.isActive("strike")} icon={Strikethrough} title="Strikethrough" />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolBtn onClick={() => activeEditor?.chain().focus().setTextAlign("left").run()} isActive={activeEditor?.isActive({ textAlign: "left" })} icon={AlignLeft} title="Align Left" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().setTextAlign("center").run()} isActive={activeEditor?.isActive({ textAlign: "center" })} icon={AlignCenter} title="Align Center" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().setTextAlign("right").run()} isActive={activeEditor?.isActive({ textAlign: "right" })} icon={AlignRight} title="Align Right" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().setTextAlign("justify").run()} isActive={activeEditor?.isActive({ textAlign: "justify" })} icon={AlignJustify} title="Justify" />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleBulletList().run()} isActive={activeEditor?.isActive("bulletList")} icon={List} title="Bullet List" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()} isActive={activeEditor?.isActive("orderedList")} icon={ListOrdered} title="Ordered List" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleBlockquote().run()} isActive={activeEditor?.isActive("blockquote")} icon={Quote} title="Blockquote" />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolBtn onClick={() => {
        const url = window.prompt("Enter URL:");
        if (url) activeEditor?.chain().focus().setLink({ href: url }).run();
      }} isActive={activeEditor?.isActive("link")} icon={LinkIcon} title="Link" />
      <ToolBtn onClick={() => activeEditor?.chain().focus().toggleHighlight().run()} isActive={activeEditor?.isActive("highlight")} icon={Highlighter} title="Highlight" />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <button onClick={onInsertToken} disabled={disabled} title="Insert Custom Value (Token)"
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          disabled ? "opacity-30 cursor-not-allowed text-gray-400" : "text-blue-600 hover:bg-blue-50 cursor-pointer"
        }`}>
        <Variable size={13} /> Token
      </button>

      <button onClick={onInsertImage} disabled={disabled} title="Insert Image"
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          disabled ? "opacity-30 cursor-not-allowed text-gray-400" : "text-emerald-600 hover:bg-emerald-50 cursor-pointer"
        }`}>
        <ImageIcon size={13} /> Image
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {isReadonly && <Badge className="text-[10px] h-5 bg-gray-100 text-gray-600 border-0">Read-Only</Badge>}
        {isLocked && <Badge className="text-[10px] h-5 bg-[#1B2A4A]/10 text-[#1B2A4A] border-0">Locked</Badge>}
      </div>
    </div>
  );
}

// ============================================================
// BLOCK EDITOR — Individual block with inline TipTap editor
// KEY FIX: onActivate(editor) callback replaces onFocus + onEditorReady
// ============================================================

function BlockEditor({
  block, mode, isActive, onActivate, onContentChange, onLock, onDelete,
  onAIGenerate, aiStaging, onAcceptAI, onRejectAI, onMoveUp, onMoveDown,
  isFirst, isLast, blockRef,
}: {
  block: ComposerBlock;
  mode: ComposerMode;
  isActive: boolean;
  onActivate: (editor: Editor | null) => void;
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
  blockRef: (el: HTMLDivElement | null) => void;
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
      Image.configure({ inline: false, allowBase64: true }),
    ],
    content: block.content,
    editable: canEdit,
    onUpdate: ({ editor: e }) => { onContentChange(e.getHTML()); },
    onFocus: () => {
      // KEY FIX: When user clicks into the editor, call onActivate with this editor
      // This sets BOTH activeBlockId and activeEditor as STATE in the parent
    },
  });

  // When user clicks the block wrapper OR the editor gets focus, activate this block
  const handleClick = useCallback(() => {
    onActivate(editor);
  }, [editor, onActivate]);

  // Also wire up editor focus event
  useEffect(() => {
    if (!editor) return;
    const handleFocus = () => {
      onActivate(editor);
    };
    editor.on("focus", handleFocus);
    return () => {
      editor.off("focus", handleFocus);
    };
  }, [editor, onActivate]);

  useEffect(() => {
    if (editor && editor.isEditable !== canEdit) {
      editor.setEditable(canEdit);
    }
  }, [canEdit, editor]);

  return (
    <div
      ref={blockRef}
      data-block-id={block.id}
      className={`rounded-xl border transition-all mb-2 ${
        isActive ? "border-[#1B2A4A]/40 shadow-md ring-1 ring-[#1B2A4A]/10" : "border-gray-200 shadow-none hover:shadow-sm"
      } ${isLocked ? "bg-gray-50/50" : "bg-white"}`}
      onClick={handleClick}
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
          <EditorContent editor={editor} className="prose prose-sm max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[40px] [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-2" />
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
// BETWEEN-BLOCK INSERT ROW
// ============================================================

function InsertRow({ onAddBlock, onAddSection, onOpenLibrary, visible }: {
  onAddBlock: () => void;
  onAddSection: () => void;
  onOpenLibrary: () => void;
  visible: boolean;
}) {
  const [show, setShow] = useState(false);

  if (!visible) return null;

  return (
    <div
      className="relative py-1.5 group"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className={`absolute inset-x-0 top-1/2 h-px transition-colors ${show ? "bg-[#1B2A4A]/20" : "bg-transparent"}`} />
      <div className={`flex items-center justify-center gap-1.5 transition-all ${show ? "opacity-100" : "opacity-0"}`}>
        <button onClick={onAddSection}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm hover:border-[#1B2A4A]/30 hover:shadow text-[10px] font-medium text-gray-600 transition-all">
          <Plus size={10} /> Section
        </button>
        <button onClick={onAddBlock}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm hover:border-[#1B2A4A]/30 hover:shadow text-[10px] font-medium text-gray-600 transition-all">
          <Plus size={10} /> Block
        </button>
        <button onClick={onOpenLibrary}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm hover:border-[#1B2A4A]/30 hover:shadow text-[10px] font-medium text-gray-600 transition-all">
          <Layers size={10} /> Library
        </button>
      </div>
    </div>
  );
}

// ============================================================
// BLOCK LIBRARY SIDEBAR
// ============================================================

function BlockLibrarySidebar({ onAddBlock, onClose, docType }: {
  onAddBlock: (blockKey: string) => void;
  onClose: () => void;
  docType: DocType;
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
    <div className="w-64 border-l border-gray-200 bg-white flex flex-col shrink-0">
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
          <DialogDescription className="text-xs text-gray-500">Choose a template and branding profile for your document</DialogDescription>
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
  onBack?: () => void;
  backLabel?: string;
  breadcrumb?: { label: string; href: string }[];
}

export default function DocumentComposer({
  documentType, workspaceId = "", customerId = "", customerName = "",
  existingInstanceId, onSave, onExportPDF, onBack, backLabel = "Back", breadcrumb,
}: DocumentComposerProps) {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<ComposerMode>("draft");
  const [showBlockLibrary, setShowBlockLibrary] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showPromptBox, setShowPromptBox] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [aiStagingMap, setAiStagingMap] = useState<Record<string, string>>({});
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string | null>(null);

  // v1.1 state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [compiledPreviewHtml, setCompiledPreviewHtml] = useState("");
  const [previewMissingTokens, setPreviewMissingTokens] = useState<MissingToken[]>([]);
  const [blockToAdd, setBlockToAdd] = useState<DocBlock | null>(null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  // KEY FIX: activeEditor is STATE, not a ref — changes trigger re-renders
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  // Block element refs for scroll-to
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
            is_compiled: false, compiled_at: null,
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
      is_compiled: false, compiled_at: null,
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

  // Build resolution context
  const resolutionContext = useMemo(() => {
    const customerData = linkedCustomer ? {
      name: linkedCustomer.name,
      code: linkedCustomer.code,
      industry: linkedCustomer.industry,
      city: linkedCustomer.city,
      contactName: linkedCustomer.contactName || "",
      contactEmail: linkedCustomer.contactEmail || "",
      contactPhone: linkedCustomer.contactPhone || "",
      accountManager: linkedCustomer.accountOwner || "",
      contractExpiry: linkedCustomer.contractExpiry,
    } : null;

    return buildResolutionContext(
      document.id,
      document.doc_type,
      customerData as Record<string, unknown> | null,
      {}
    );
  }, [document.id, document.doc_type, linkedCustomer]);

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

  // KEY FIX: Block activation handler — sets both blockId and editor in one batch
  const handleBlockActivate = useCallback((blockId: string, editor: Editor | null) => {
    setActiveBlockId(blockId);
    setActiveEditor(editor);
  }, []);

  // Block operations — with confirmation
  const requestAddBlock = useCallback((blockKey: string) => {
    const blockDef = getBlockByKey(blockKey);
    if (!blockDef) return;
    setBlockToAdd(blockDef);
    setShowBlockConfirm(true);
  }, []);

  const confirmAddBlock = useCallback((position: "after_current" | "end") => {
    if (!blockToAdd) return;
    const newBlock: ComposerBlock = {
      id: `blk-${Date.now()}`, block_key: blockToAdd.block_key,
      order: document.blocks.length + 1,
      content: blockToAdd.default_content,
      is_locked: false, is_ai_generated: false, config: {},
    };

    setDocument(prev => {
      const targetId = insertAfterBlockId || activeBlockId;
      if (position === "after_current" && targetId) {
        const idx = prev.blocks.findIndex(b => b.id === targetId);
        if (idx >= 0) {
          const newBlocks = [...prev.blocks];
          newBlocks.splice(idx + 1, 0, newBlock);
          return { ...prev, blocks: newBlocks.map((b, i) => ({ ...b, order: i + 1 })), updated_at: new Date().toISOString() };
        }
      }
      return { ...prev, blocks: [...prev.blocks, newBlock], updated_at: new Date().toISOString() };
    });
    toast.success(`Added "${blockToAdd.display_name}"`);
    setBlockToAdd(null);
    setInsertAfterBlockId(null);
  }, [blockToAdd, document.blocks.length, activeBlockId, insertAfterBlockId]);

  // Quick add section
  const addQuickSection = useCallback((afterBlockId: string | null) => {
    const newBlock: ComposerBlock = {
      id: `blk-section-${Date.now()}`, block_key: "intro.narrative",
      order: document.blocks.length + 1,
      content: "<h2>New Section</h2><p>Start writing here...</p>",
      is_locked: false, is_ai_generated: false, config: {},
    };
    setDocument(prev => {
      if (afterBlockId) {
        const idx = prev.blocks.findIndex(b => b.id === afterBlockId);
        if (idx >= 0) {
          const newBlocks = [...prev.blocks];
          newBlocks.splice(idx + 1, 0, newBlock);
          return { ...prev, blocks: newBlocks.map((b, i) => ({ ...b, order: i + 1 })), updated_at: new Date().toISOString() };
        }
      }
      return { ...prev, blocks: [...prev.blocks, newBlock], updated_at: new Date().toISOString() };
    });
    toast.success("New section added");
  }, [document.blocks.length]);

  const openLibraryForInsert = useCallback((afterBlockId: string | null) => {
    setInsertAfterBlockId(afterBlockId);
    setShowBlockLibrary(true);
  }, []);

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
    if (activeBlockId === blockId) {
      setActiveBlockId(null);
      setActiveEditor(null);
    }
    toast.success("Block removed");
  }, [activeBlockId]);

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

  // Token insert — uses activeEditor STATE
  const handleInsertToken = useCallback((tokenKey: string) => {
    if (activeEditor && activeEditor.isEditable) {
      activeEditor.chain().focus().insertContent(`{{${tokenKey}}}`).run();
      toast.success(`Inserted {{${tokenKey}}}`);
    } else {
      toast.error("No editable block selected — click a block first");
    }
  }, [activeEditor]);

  // Image insert
  const handleInsertImage = useCallback((url: string, alt: string) => {
    if (activeEditor && activeEditor.isEditable) {
      activeEditor.chain().focus().setImage({ src: url, alt }).run();
      toast.success("Image inserted");
    } else {
      toast.error("No editable block selected — click a block first");
    }
  }, [activeEditor]);

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

  // Save
  const handleSave = useCallback(() => {
    if (onSave) onSave(document);
    toast.success("Document saved");
  }, [document, onSave]);

  // PDF Compile
  const handleCompilePDF = useCallback(() => {
    const results = resolveDocumentTokens(
      document.blocks.map(b => ({ content: b.content, block_key: b.block_key })),
      resolutionContext,
      document.doc_type,
    );

    const allMissing = results.flatMap(r => r.result.missingTokens);
    const compiledHtml = results.map(r => r.result.renderedText).join("\n<hr style='margin:2rem 0;border-color:#e5e7eb;' />\n");

    setCompiledPreviewHtml(compiledHtml);
    setPreviewMissingTokens(allMissing);
    setShowPDFPreview(true);
  }, [document, resolutionContext]);

  const handleApproveCompile = useCallback(() => {
    setShowPDFPreview(false);
    setDocument(prev => ({ ...prev, is_compiled: true, compiled_at: new Date().toISOString() }));
    if (onExportPDF) onExportPDF(document);
    toast.success("PDF approved and saved to Documents");
  }, [document, onExportPDF]);

  const handleCanonLock = useCallback(() => {
    setDocument(prev => ({
      ...prev, status: "canon", updated_at: new Date().toISOString(),
      blocks: prev.blocks.map(b => ({ ...b, is_locked: true })),
      is_compiled: true, compiled_at: new Date().toISOString(),
    }));
    setMode("canon");
    setShowPDFPreview(false);
    if (onExportPDF) onExportPDF(document);
    toast.success("Document locked as Canon — immutable version created, final PDF compiled");
  }, [document, onExportPDF]);

  // Bind now action
  const handleBindNow = useCallback((bindingKey: keyof Bindings) => {
    const mockBindings: Record<string, string> = {
      pricing_snapshot_id: `ps-${document.customer_id}-${Date.now()}`,
      scope_snapshot_id: `ss-${document.customer_id}-${Date.now()}`,
      ecr_score_id: `ecr-${document.customer_id}-${Date.now()}`,
      sla_snapshot_id: `sla-${document.customer_id}-${Date.now()}`,
    };
    setDocument(prev => ({
      ...prev,
      bindings: { ...prev.bindings, [bindingKey]: mockBindings[bindingKey] || `bound-${Date.now()}` },
      updated_at: new Date().toISOString(),
    }));
    toast.success(`Bound ${bindingKey.replace(/_/g, " ")}`);
  }, [document.customer_id]);

  // Scroll to block
  const scrollToBlock = useCallback((blockId: string) => {
    setActiveBlockId(blockId);
    const el = blockRefs.current[blockId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const lockedCount = document.blocks.filter(b => b.is_locked).length;
  const totalCount = document.blocks.length;
  const brandingProfile = getBrandingProfile(document.branding_profile_id);
  const docTypeConfig = DOC_TYPE_CONFIG[documentType];
  const activeBlockName = activeBlock ? (getBlockByKey(activeBlock.block_key)?.display_name || activeBlock.block_key) : "";

  const gradeColor = (grade: string) => {
    const map: Record<string, string> = { A: "text-emerald-700 bg-emerald-50", B: "text-blue-700 bg-blue-50", C: "text-amber-700 bg-amber-50", D: "text-orange-700 bg-orange-50", F: "text-red-700 bg-red-50" };
    return map[grade] || "text-gray-700 bg-gray-50";
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="flex h-full bg-white">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ===== ROW 1: Document Info Header ===== */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-300">/</span>}
                  <button onClick={() => navigate(crumb.href)} className="hover:text-primary hover:underline transition-colors">{crumb.label}</button>
                </span>
              ))}
              <span className="text-gray-300">/</span>
              <span className="text-foreground font-medium">Editor</span>
            </nav>
          )}
          {!breadcrumb && onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-xs h-7 shrink-0">
              <ArrowLeft size={12} className="mr-1" /> {backLabel}
            </Button>
          )}
          <Badge className={`text-xs h-6 px-2.5 shrink-0 ${
            docTypeConfig.family === "legal" ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-blue-100 text-blue-700 border-blue-200"
          }`}>
            {docTypeConfig.label}
          </Badge>
          <div className="flex-1 min-w-0">
            <Input value={document.title} onChange={(e) => setDocument(prev => ({ ...prev, title: e.target.value }))}
              className="h-7 text-sm font-semibold border-none bg-transparent p-0 focus-visible:ring-0 w-full" disabled={mode === "canon"} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500">v{document.version}</span>
            {linkedCustomer && (
              <>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs font-medium text-[#1B2A4A] max-w-[140px] truncate">{linkedCustomer.name}</span>
              </>
            )}
            {brandingProfile && (
              <>
                <span className="text-xs text-gray-300">·</span>
                <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: brandingProfile.primary_color }} />
              </>
            )}
            <Badge variant={document.status === "canon" ? "default" : "outline"} className="text-[10px] h-4 capitalize">{document.status}</Badge>
            {document.is_compiled && (
              <Badge className="text-[10px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 size={9} className="mr-0.5" /> Compiled
              </Badge>
            )}
          </div>
        </div>

        {/* ===== ROW 2: Actions + Mode Tabs ===== */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-100 bg-white shrink-0">
          <Tabs value={mode} onValueChange={(v) => setMode(v as ComposerMode)}>
            <TabsList className="bg-gray-100/80 h-8">
              <TabsTrigger value="draft" className="text-xs gap-1 h-6" disabled={mode === "canon"}>
                <PenTool size={11} /> Draft
              </TabsTrigger>
              <TabsTrigger value="canon" className="text-xs gap-1 h-6">
                <Shield size={11} /> Canon
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 mr-2 text-xs text-gray-400">
              <span>{lockedCount}/{totalCount} locked</span>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#1B2A4A] rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (lockedCount / totalCount) * 100 : 0}%` }} />
              </div>
            </div>
            <Separator orientation="vertical" className="h-5" />
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
            <Button variant="outline" size="sm" onClick={handleCompilePDF} className="text-xs h-7">
              <Download size={12} className="mr-1" /> Compile
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              navigate(`/composer/${document.id}/view`);
            }} className="text-xs h-7">
              <Eye size={12} className="mr-1" /> Output Studio
            </Button>
            {mode !== "canon" && (
              <Button variant="default" size="sm" onClick={() => handleCompilePDF()} className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs h-7">
                <Lock size={12} className="mr-1" /> Lock Canon
              </Button>
            )}
          </div>
        </div>

        {/* ===== SCROLLABLE CONTENT with STICKY TOOLBAR ===== */}
        {/* KEY FIX: Using native overflow-y-auto div instead of Radix ScrollArea.
            Radix ScrollArea creates a custom viewport that breaks CSS sticky positioning.
            With native overflow, the toolbar's `sticky top-0` works correctly. */}
        <div className="flex-1 overflow-y-auto">
          {/* Sticky Toolbar — inside the scroll container so it sticks */}
          <StickyToolbar
            activeEditor={activeEditor}
            isLocked={activeBlock?.is_locked || mode === "canon" || false}
            isReadonly={activeBlockDef?.editor_mode === "readonly" || false}
            blockKey={activeBlock?.block_key || null}
            onInsertToken={() => setShowTokenModal(true)}
            onInsertImage={() => setShowImageModal(true)}
          />

          {/* Content Area */}
          <div className="p-4">
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
                <div key={block.id}>
                  {idx > 0 && (
                    <InsertRow
                      visible={mode === "draft"}
                      onAddSection={() => addQuickSection(document.blocks[idx - 1].id)}
                      onAddBlock={() => {
                        setInsertAfterBlockId(document.blocks[idx - 1].id);
                        setShowBlockLibrary(true);
                      }}
                      onOpenLibrary={() => openLibraryForInsert(document.blocks[idx - 1].id)}
                    />
                  )}
                  <BlockEditor
                    block={block}
                    mode={mode}
                    isActive={activeBlockId === block.id}
                    onActivate={(editor) => handleBlockActivate(block.id, editor)}
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
                    blockRef={(el) => { blockRefs.current[block.id] = el; }}
                  />
                </div>
              ))}

              {/* Bottom Insert Row */}
              {mode === "draft" && document.blocks.length > 0 && (
                <div className="flex items-center gap-2 mt-3 mb-4 pt-3 border-t border-dashed border-gray-200">
                  <Button variant="outline" size="sm" onClick={() => addQuickSection(null)} className="text-xs">
                    <Plus size={14} className="mr-1" /> Add Section
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowBlockLibrary(true)} className="text-xs">
                    <Layers size={14} className="mr-1" /> Block Library
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
          </div>
        </div>
      </div>

      {/* Right Sidebar — Block Library (conditional) */}
      {showBlockLibrary && (
        <BlockLibrarySidebar onAddBlock={requestAddBlock} onClose={() => { setShowBlockLibrary(false); setInsertAfterBlockId(null); }} docType={documentType} />
      )}

      {/* Right Sidebar — Full Info Panel (when block library is closed) */}
      {!showBlockLibrary && (
        <div className="w-72 border-l border-gray-200 bg-[#F8F9FB] flex flex-col overflow-y-auto shrink-0">
          {/* Governance Status Pill */}
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Governance Active</span>
              <Badge className="ml-auto text-[9px] h-4 bg-emerald-100 text-emerald-700 border-emerald-200">Enforced</Badge>
            </div>
          </div>

          {/* Linked Customer Card */}
          {linkedCustomer && (
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2 flex items-center gap-1.5">
                <Building2 size={12} /> Linked Customer
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-2.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-8 h-8 rounded bg-[#1B2A4A] flex items-center justify-center text-white text-[10px] font-bold">
                    {linkedCustomer.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#1B2A4A] truncate">{linkedCustomer.name}</div>
                    <div className="text-[10px] text-gray-500">{linkedCustomer.code}</div>
                  </div>
                  <Badge className={`text-[10px] h-5 ${gradeColor(linkedCustomer.grade)}`}>
                    <Star size={9} className="mr-0.5" /> {linkedCustomer.grade}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between"><span className="text-gray-500">Industry</span><span className="font-medium">{linkedCustomer.industry}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Region</span><span className="font-medium">{linkedCustomer.city}, {linkedCustomer.region}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Contract</span><span className="font-medium">{formatSAR(linkedCustomer.contractValue2025)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Expiry</span><span className="font-medium">{linkedCustomer.contractExpiry}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between"><span className="text-gray-500">Pallets</span><span className="font-medium">{linkedCustomer.palletOccupied.toLocaleString()} / {linkedCustomer.palletContracted.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">DSO</span><span className="font-medium">{linkedCustomer.dso} days</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Payment</span>
                    <Badge variant="outline" className={`text-[9px] h-4 ${linkedCustomer.paymentStatus === "Good" ? "text-emerald-700 bg-emerald-50" : linkedCustomer.paymentStatus === "Acceptable" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"}`}>
                      {linkedCustomer.paymentStatus}
                    </Badge>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex items-center gap-1.5">
                    <Users size={10} className="text-gray-400" />
                    <span className="text-gray-500 truncate">{linkedCustomer.contactName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail size={10} className="text-gray-400" />
                    <span className="text-gray-500 truncate text-[10px]">{linkedCustomer.contactEmail}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone size={10} className="text-gray-400" />
                    <span className="text-gray-500">{linkedCustomer.contactPhone}</span>
                  </div>
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
              <div className="flex justify-between"><span className="text-gray-500">Compiled</span>
                {document.is_compiled ? (
                  <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700">Yes</Badge>
                ) : (
                  <span className="text-gray-400 text-[10px]">Not yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Block Navigator */}
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2">Block Navigator</h3>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-0.5">
                {document.blocks.map((b, i) => {
                  const def = getBlockByKey(b.block_key);
                  const isBlockActive = activeBlockId === b.id;
                  return (
                    <button key={b.id} onClick={() => scrollToBlock(b.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                        isBlockActive ? "bg-white border border-[#1B2A4A]/20 shadow-sm" : "hover:bg-white"
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

          {/* Data Bindings */}
          <div className="p-3">
            <h3 className="text-xs font-semibold text-[#1B2A4A] mb-2">Data Bindings</h3>
            <div className="space-y-1.5 text-[10px]">
              {([
                { label: "Pricing Snapshot", key: "pricing_snapshot_id" as keyof Bindings, value: document.bindings.pricing_snapshot_id },
                { label: "Scope Snapshot", key: "scope_snapshot_id" as keyof Bindings, value: document.bindings.scope_snapshot_id },
                { label: "ECR Score", key: "ecr_score_id" as keyof Bindings, value: document.bindings.ecr_score_id },
                { label: "SLA Snapshot", key: "sla_snapshot_id" as keyof Bindings, value: document.bindings.sla_snapshot_id },
              ]).map((binding, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 bg-white rounded border border-gray-100">
                  <span className="text-gray-500">{binding.label}</span>
                  {binding.value ? (
                    <code className="text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded">{binding.value}</code>
                  ) : (
                    <button onClick={() => handleBindNow(binding.key)}
                      className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors font-medium">
                      Bind now
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TemplateSelector
        open={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={handleTemplateSelect}
        docType={documentType}
      />

      <TokenInsertModal
        open={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onInsert={handleInsertToken}
        docType={documentType}
      />

      <ImageInsertDialog
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onInsert={handleInsertImage}
      />

      <BlockAddConfirmDialog
        open={showBlockConfirm}
        onClose={() => { setShowBlockConfirm(false); setBlockToAdd(null); }}
        onConfirm={confirmAddBlock}
        block={blockToAdd}
        insertionPoint={activeBlockName}
      />

      <PDFPreviewModal
        open={showPDFPreview}
        onClose={() => setShowPDFPreview(false)}
        compiledHtml={compiledPreviewHtml}
        missingTokens={previewMissingTokens}
        onRecompile={() => { setShowPDFPreview(false); toast.info("Fix the missing tokens and recompile"); }}
        onApprove={handleApproveCompile}
      />
    </div>
  );
}
