import { Link } from "wouter";
/*
 * Block Builder — Admin page for creating and managing custom document blocks
 * Sprint 3: Now persists blocks to Supabase via /api/blocks.
 * Design: White cards, subtle borders, enterprise SaaS aesthetic matching AdminGovernance
 */

import { useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus, Search, Layers, PenTool, Shield, Lock, Eye,
  Sparkles, Trash2, GripVertical, Settings2, X,
  BookOpen, FileCheck, FileSignature, Variable,
  ChevronRight, Code, LayoutTemplate, Wrench,
  AlertTriangle, CheckCircle2, Copy, Loader2,
  ArrowLeft } from "lucide-react";
import {
  type DocBlock, type BlockFamily, type BlockEditorMode,
  blockLibrary, BLOCK_FAMILY_CONFIG, EDITOR_MODE_CONFIG,
  getBlockByKey, getBlocksByFamily,
} from "@/lib/document-composer";
import { useDocBlocks } from "@/hooks/useSupabase";
import { blocksApi } from "@/lib/api-blocks";

// ============================================================
// BLOCK DETAIL PANEL
// ============================================================

function BlockDetailPanel({ block, onClose }: { block: DocBlock; onClose: () => void }) {
  const familyCfg = BLOCK_FAMILY_CONFIG[block.family];
  const modeCfg = EDITOR_MODE_CONFIG[block.editor_mode];

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1B2A4A]">Block Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>

      <div className="p-4 space-y-4">
        {/* Identity */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Display Name</label>
          <p className="text-sm font-medium text-[#1B2A4A] mt-0.5">{block.display_name}</p>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Block Key</label>
          <code className="block text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded mt-0.5 font-mono">{block.block_key}</code>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</label>
          <p className="text-xs text-gray-600 mt-0.5">{block.description}</p>
        </div>

        <Separator />

        {/* Classification */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Family</label>
            <div className="mt-1">
              <Badge variant="outline" className={`text-[10px] ${familyCfg.bg} ${familyCfg.color}`}>{familyCfg.label}</Badge>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Editor Mode</label>
            <div className="mt-1">
              <Badge variant="outline" className="text-[10px]">{modeCfg.label}</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Schema */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Variable Slots</label>
          {block.schema.variable_slots.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {block.schema.variable_slots.map((slot, i) => (
                <code key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{`{{${slot}}}`}</code>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No variable slots defined</p>
          )}
        </div>

        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Config</label>
          {Object.keys(block.schema.config).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {Object.entries(block.schema.config).map(([key, val]: [string, string], i: number) => (
                <Badge key={i} variant="outline" className="text-[10px]">{key}: {val}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No additional config</p>
          )}
        </div>

        <Separator />

        {/* Permissions */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Permissions</label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 flex items-center gap-1.5"><Lock size={11} /> Lockable</span>
              <Badge variant="outline" className={`text-[10px] ${block.permissions.lockable ? "text-emerald-700 bg-emerald-50" : "text-gray-500"}`}>
                {block.permissions.lockable ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 flex items-center gap-1.5"><Sparkles size={11} /> AI Allowed</span>
              <Badge variant="outline" className={`text-[10px] ${block.permissions.ai_allowed ? "text-amber-700 bg-amber-50" : "text-gray-500"}`}>
                {block.permissions.ai_allowed ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 flex items-center gap-1.5"><Trash2 size={11} /> Editable in Draft</span>
              <Badge variant="outline" className={`text-[10px] ${block.permissions.editable_in_draft ? "text-emerald-700 bg-emerald-50" : "text-gray-500"}`}>
                {block.permissions.editable_in_draft ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Default Content Preview */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Default Content</label>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 prose prose-sm max-w-none text-xs"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.default_content.substring(0, 300) + (block.default_content.length > 300 ? "..." : "")) }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CREATE BLOCK DIALOG
// ============================================================

function CreateBlockDialog({ open, onClose, onCreated, editBlock }: { open: boolean; onClose: () => void; onCreated: () => void; editBlock?: DocBlock | null }) {
  const [displayName, setDisplayName] = useState(editBlock?.display_name ?? "");
  const [blockKey, setBlockKey] = useState(editBlock?.block_key ?? "");
  const [description, setDescription] = useState(editBlock?.description ?? "");
  const [family, setFamily] = useState<BlockFamily>(editBlock?.family ?? "commercial");
  const [editorMode, setEditorMode] = useState<BlockEditorMode>(editBlock?.editor_mode ?? "wysiwyg");
  const [variableSlots, setVariableSlots] = useState(editBlock?.schema?.variable_slots?.join(", ") ?? "");
  const [lockable, setLockable] = useState(editBlock?.permissions?.lockable ?? true);
  const [aiAllowed, setAiAllowed] = useState(editBlock?.permissions?.ai_allowed ?? true);
  const [deletable, setDeletable] = useState(true);
  const [defaultContent, setDefaultContent] = useState(editBlock?.default_content ?? "<p>Block content goes here...</p>");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editBlock;

  const handleCreate = async () => {
    if (!displayName.trim() || !blockKey.trim()) {
      toast.error("Display name and block key are required");
      return;
    }
    setSaving(true);
    try {
      const slots = variableSlots.split(",").map(s => s.trim()).filter(Boolean);
      const payload = {
        display_name: displayName.trim(),
        family,
        editor_mode: editorMode,
        description: description.trim(),
        default_content: defaultContent,
        permissions: { editable_in_draft: true, editable_in_canon: false, ai_allowed: aiAllowed, lockable },
        schema: { variable_slots: slots, config: {} },
      };
      if (isEdit) {
        await blocksApi.update(editBlock.id, payload);
        toast.success(`Block "${displayName}" updated`);
      } else {
        await blocksApi.create({ ...payload, block_key: blockKey.trim() });
        toast.success(`Block "${displayName}" created`);
      }
      onCreated();
      onClose();
      // Reset form
      setDisplayName(""); setBlockKey(""); setDescription("");
      setFamily("commercial"); setEditorMode("wysiwyg");
      setVariableSlots(""); setLockable(true); setAiAllowed(true); setDeletable(true);
      setDefaultContent("<p>Block content goes here...</p>");
    } catch (err: any) {
      toast.error(err.message || "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate block key from display name
  const handleNameChange = (name: string) => {
    setDisplayName(name);
    if (!blockKey || blockKey === displayName.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "")) {
      setBlockKey(name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#1B2A4A] font-serif flex items-center gap-2">
            <Plus size={16} /> Create Custom Block
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Define a new block type for the Document Composer block library
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Display Name *</label>
              <Input value={displayName} onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Custom Rate Card" className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Block Key *</label>
              <Input value={blockKey} onChange={(e) => setBlockKey(e.target.value)}
                placeholder="e.g., custom.rate.card" className="h-8 text-xs font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="What this block is used for..." className="text-xs min-h-[60px]" />
          </div>

          <Separator />

          {/* Classification */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Family</label>
              <Select value={family} onValueChange={(v) => setFamily(v as BlockFamily)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BLOCK_FAMILY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Editor Mode</label>
              <Select value={editorMode} onValueChange={(v) => setEditorMode(v as BlockEditorMode)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EDITOR_MODE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variable Slots */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Variable Slots</label>
            <Input value={variableSlots} onChange={(e) => setVariableSlots(e.target.value)}
              placeholder="Comma-separated: customer.name, contract.value, ..." className="h-8 text-xs" />
            <p className="text-[10px] text-gray-400 mt-0.5">These tokens will be resolved from bound data during PDF compilation</p>
          </div>

          <Separator />

          {/* Permissions */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-2 block">Permissions</label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setLockable(!lockable)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  lockable ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500"
                }`}>
                <Lock size={12} /> Lockable
              </button>
              <button onClick={() => setAiAllowed(!aiAllowed)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  aiAllowed ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-200 text-gray-500"
                }`}>
                <Sparkles size={12} /> AI Allowed
              </button>
              <button onClick={() => setDeletable(!deletable)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  deletable ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"
                }`}>
                <Trash2 size={12} /> Deletable
              </button>
            </div>
          </div>

          {/* Default Content */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Default Content (HTML)</label>
            <Textarea value={defaultContent} onChange={(e) => setDefaultContent(e.target.value)}
              className="text-xs font-mono min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving} className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs">
            {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Plus size={12} className="mr-1" />}
            {isEdit ? "Save Changes" : "Create Block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN BLOCK BUILDER PAGE
// ============================================================

export default function BlockBuilder() {
  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState<string>("all");
  const [selectedBlock, setSelectedBlock] = useState<DocBlock | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editBlock, setEditBlock] = useState<DocBlock | null>(null);

  // Live DB data with in-memory fallback
  const { data: liveBlocks, loading: blocksLoading, error: blocksError, refetch: refetchBlocks } = useDocBlocks();
  const blocks: DocBlock[] = blocksError ? blockLibrary : (liveBlocks.length > 0 ? liveBlocks : blockLibrary);

  const filtered = useMemo(() => {
    return blocks.filter(b => {
      if (search) {
        const s = search.toLowerCase();
        if (!b.display_name.toLowerCase().includes(s) && !b.block_key.toLowerCase().includes(s) && !b.description.toLowerCase().includes(s)) return false;
      }
      if (filterFamily !== "all" && b.family !== filterFamily) return false;
      return true;
    });
  }, [blocks, search, filterFamily]);

  const grouped = useMemo(() => {
    const groups: Record<string, DocBlock[]> = {};
    filtered.forEach(b => {
      if (!groups[b.family]) groups[b.family] = [];
      groups[b.family].push(b);
    });
    return groups;
  }, [filtered]);

  const handleDeleteBlock = useCallback(async (block: DocBlock) => {
    if (!confirm(`Delete block "${block.display_name}"? This cannot be undone.`)) return;
    try {
      await blocksApi.delete(block.id);
      toast.success(`Block "${block.display_name}" deleted`);
      setSelectedBlock(null);
      refetchBlocks();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  }, [refetchBlocks]);

  // Stats
  const totalBlocks = blocks.length;
  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    blocks.forEach(b => { counts[b.family] = (counts[b.family] || 0) + 1; });
    return counts;
  }, [blocks]);
  const aiEnabledCount = blocks.filter(b => b.permissions.ai_allowed).length;
  const readonlyCount = blocks.filter(b => b.editor_mode === "readonly").length;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 max-w-[1400px] mx-auto w-full flex-1 overflow-y-auto">
          {/* Back to Admin */}
          <div className="mb-4">
            <Link href="/admin-panel">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
              </Button>
            </Link>
          </div>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1B2A4A] font-serif">Block Builder</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage document block types for the Document Composer block library
            </p>
          </div>

          {/* Metric Strip */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[#1B2A4A]">{totalBlocks}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Total Blocks</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50"><Layers size={16} className="text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[#1B2A4A]">{Object.keys(familyCounts).length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Families</p>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50"><LayoutTemplate size={16} className="text-purple-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[#1B2A4A]">{aiEnabledCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">AI-Enabled</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50"><Sparkles size={16} className="text-amber-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-200 shadow-none">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold text-[#1B2A4A]">{readonlyCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Read-Only / Data-Bound</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-100"><Eye size={16} className="text-gray-600" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search blocks..." className="h-8 text-xs pl-8 w-56" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setFilterFamily("all")}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    filterFamily === "all" ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  All ({totalBlocks})
                </button>
                {Object.entries(BLOCK_FAMILY_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => setFilterFamily(key)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                      filterFamily === key ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {cfg.label} ({familyCounts[key] || 0})
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)} className="bg-[#1B2A4A] hover:bg-[#2A3F6A] text-xs">
              <Plus size={14} className="mr-1" /> Create Block
            </Button>
          </div>

          {/* Block List — grouped by family */}
          <div className="space-y-6">
            {Object.entries(grouped).map(([family, blocks]) => {
              const cfg = BLOCK_FAMILY_CONFIG[family as BlockFamily];
              return (
                <div key={family}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg ${cfg.bg}`}>
                      <Layers size={14} className={cfg.color} />
                    </div>
                    <h2 className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</h2>
                    <Badge variant="outline" className="text-[10px] h-4">{blocks.length} blocks</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {blocks.map(block => {
                      const modeCfg = EDITOR_MODE_CONFIG[block.editor_mode];
                      const isSelected = selectedBlock?.id === block.id;
                      return (
                        <Card key={block.id}
                          className={`cursor-pointer transition-all border ${
                            isSelected ? "border-[#1B2A4A]/40 shadow-md ring-1 ring-[#1B2A4A]/10" : "border-gray-200 hover:shadow-sm hover:border-gray-300"
                          }`}
                          onClick={() => setSelectedBlock(block)}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${cfg.bg} shrink-0`}>
                                <GripVertical size={14} className={cfg.color} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-sm font-semibold text-[#1B2A4A] truncate">{block.display_name}</h3>
                                </div>
                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{block.description}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <code className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{block.block_key}</code>
                                  <Badge variant="outline" className="text-[9px] h-4">{modeCfg.label}</Badge>
                                  {block.permissions.ai_allowed && (
                                    <Badge variant="outline" className="text-[9px] h-4 border-amber-300 text-amber-700 bg-amber-50">AI</Badge>
                                  )}
                                  {block.schema.variable_slots.length > 0 && (
                                    <Badge variant="outline" className="text-[9px] h-4 border-blue-300 text-blue-600 bg-blue-50">
                                      <Variable size={8} className="mr-0.5" /> {block.schema.variable_slots.length}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {Object.keys(grouped).length === 0 && (
              <div className="text-center py-12">
                <Layers size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-400">No blocks match your search</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedBlock && (
        <BlockDetailPanel block={selectedBlock} onClose={() => setSelectedBlock(null)} />
      )}

      {/* Create / Edit Dialog */}
      <CreateBlockDialog
        open={showCreate || !!editBlock}
        onClose={() => { setShowCreate(false); setEditBlock(null); }}
        onCreated={refetchBlocks}
        editBlock={editBlock}
      />
    </div>
  );
}
