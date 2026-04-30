import { useState, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, GripVertical, Lock, Unlock, Eye, EyeOff, Trash2, Save,
  ChevronDown, ChevronRight, Settings, Layers, Palette, FileText, Hash, Check
} from "lucide-react";
import {
  docTemplates, blockLibrary, brandingProfiles, DOC_TYPE_CONFIG, BLOCK_FAMILY_CONFIG,
  type DocTemplate, type RecipeBlock, type DocBlock, type TemplateVersion,
  getLatestTemplateVersion,
} from "@/lib/document-composer";
import { variableDefinitions, NAMESPACE_CONFIG, type VariableDefinition } from "@/lib/semantic-variables";
import { useDocTemplates, useDocBlocks, useDocBrandingProfiles } from "@/hooks/useSupabase";
import { api } from "@/lib/api-client";

// ============================================================
// TEMPLATE DESIGNER
// ============================================================

type BlockStatus = "required" | "optional" | "locked";

interface DesignerBlock {
  block_key: string;
  display_name: string;
  family: string;
  status: BlockStatus;
  order: number;
}

interface LayoutConfig {
  cover_enabled: boolean;
  cover_hero_slot: boolean;
  header_enabled: boolean;
  footer_enabled: boolean;
  spacing_preset: "compact" | "normal" | "relaxed";
  page_break_between_blocks: boolean;
  annexure_mode: boolean;
}

interface VariableSetConfig {
  allowed_namespaces: string[];
  required_variables: string[];
}

export default function TemplateDesigner() {
  const [, params] = useRoute("/templates/:templateId/designer");
  const [, navigate] = useLocation();
  const templateId = params?.templateId || "";

  // Load live templates from Supabase; fall back to seed data for unmirgated templates
  const { data: liveTemplates, refetch: refetchTemplates } = useDocTemplates();
  const { data: liveBlocks } = useDocBlocks();
  const { data: liveBranding } = useDocBrandingProfiles();

  const activeBlocks = liveBlocks.length > 0 ? liveBlocks : blockLibrary;
  const activeBranding = liveBranding.length > 0 ? liveBranding : brandingProfiles;

  // Find template — prefer live DB data, fall back to seed
  const template = useMemo<DocTemplate | undefined>(
    () =>
      liveTemplates.find((t: DocTemplate) => t.id === templateId) ||
      docTemplates.find((t: DocTemplate) => t.id === templateId),
    [liveTemplates, templateId]
  );

  const latestVersion = useMemo<TemplateVersion | null>(
    () => template ? getLatestTemplateVersion(template) : null,
    [template]
  );

  // State
  const [blocks, setBlocks] = useState<DesignerBlock[]>(() => {
    if (!latestVersion) return [];
    return latestVersion.recipe.map((r: RecipeBlock, idx: number) => {
      const schema = activeBlocks.find((s: DocBlock) => s.block_key === r.block_key);
      return {
        block_key: r.block_key,
        display_name: schema?.display_name || r.block_key,
        family: schema?.family || "commercial",
        status: (r.required ? "required" : "optional") as BlockStatus,
        order: idx,
      };
    });
  });

  const [layout, setLayout] = useState<LayoutConfig>({
    cover_enabled: true,
    cover_hero_slot: true,
    header_enabled: true,
    footer_enabled: true,
    spacing_preset: "normal",
    page_break_between_blocks: false,
    annexure_mode: false,
  });

  const [variableSet, setVariableSet] = useState<VariableSetConfig>({
    allowed_namespaces: ["company", "customer", "pricing", "legal"],
    required_variables: [],
  });

  const [selectedBrandingId, setSelectedBrandingId] = useState(template?.default_branding_profile_id || "bp-001");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _latestVersion = latestVersion;
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [activeTab, setActiveTab] = useState<"blocks" | "layout" | "variables" | "branding">("blocks");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [layoutExpanded, setLayoutExpanded] = useState(true);

  // Available blocks not yet in recipe
  const availableBlocks = useMemo(() => {
    const usedKeys = blocks.map(b => b.block_key);
    return activeBlocks.filter((s: DocBlock) => !usedKeys.includes(s.block_key));
  }, [blocks, activeBlocks]);

  // Namespace list
  const namespaces = useMemo(() => Object.keys(NAMESPACE_CONFIG), []);

  // Variables by namespace
  const variablesByNamespace = useMemo(() => {
    const map: Record<string, VariableDefinition[]> = {};
    for (const v of variableDefinitions) {
      const ns = v.namespace;
      if (!map[ns]) map[ns] = [];
      map[ns].push(v);
    }
    return map;
  }, []);

  // Move block
  const moveBlock = useCallback((fromIdx: number, toIdx: number) => {
    setBlocks(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next.map((b, i) => ({ ...b, order: i }));
    });
  }, []);

  // Toggle block status
  const toggleStatus = useCallback((idx: number) => {
    setBlocks(prev => prev.map((b, i) => {
      if (i !== idx) return b;
      const cycle: BlockStatus[] = ["required", "optional", "locked"];
      const nextIdx = (cycle.indexOf(b.status) + 1) % cycle.length;
      return { ...b, status: cycle[nextIdx] };
    }));
  }, []);

  // Remove block
  const removeBlock = useCallback((idx: number) => {
    setBlocks(prev => prev.filter((_, i) => i !== idx).map((b, i) => ({ ...b, order: i })));
  }, []);

  // Add block
  const addBlock = useCallback((schema: DocBlock) => {
    setBlocks(prev => [...prev, {
      block_key: schema.block_key,
      display_name: schema.display_name,
      family: schema.family,
      status: "optional" as BlockStatus,
      order: prev.length,
    }]);
    setShowAddBlock(false);
    toast.success(`Added "${schema.display_name}" to template`);
  }, []);

  // Toggle namespace
  const toggleNamespace = useCallback((ns: string) => {
    setVariableSet(prev => ({
      ...prev,
      allowed_namespaces: prev.allowed_namespaces.includes(ns)
        ? prev.allowed_namespaces.filter(n => n !== ns)
        : [...prev.allowed_namespaces, ns],
    }));
  }, []);

  // Toggle required variable
  const toggleRequiredVariable = useCallback((key: string) => {
    setVariableSet(prev => ({
      ...prev,
      required_variables: prev.required_variables.includes(key)
        ? prev.required_variables.filter(k => k !== key)
        : [...prev.required_variables, key],
    }));
  }, []);

  // Save template — creates a new version in Supabase
  const handleSave = useCallback(async () => {
    if (!template) return;
    const recipe = blocks.map((b, idx) => ({
      block_key: b.block_key,
      order: idx,
      required: b.status === "required",
      default_content_override: null,
      config_override: {},
    }));
    const layoutPayload = latestVersion?.layout || {
      cover_page: layout.cover_enabled,
      cover_style: layout.cover_hero_slot ? "hero_image" : "minimal",
      section_spacing: layout.spacing_preset === "relaxed" ? "spacious" : layout.spacing_preset,
      page_break_between_sections: layout.page_break_between_blocks,
      annexure_section: layout.annexure_mode,
      toc_auto: false,
    };
    try {
      await api.templates.addVersion(template.id, recipe, layoutPayload);
      if (selectedBrandingId !== template.default_branding_profile_id) {
        await api.templates.update(template.id, { default_branding_profile_id: selectedBrandingId });
      }
      await refetchTemplates();
      toast.success("Template version saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  }, [template, blocks, selectedBrandingId, latestVersion, layout, refetchTemplates]);

  // Not found
  if (!template) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="text-center py-20">
          <FileText size={48} className="mx-auto mb-4 text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-600">Template not found</h2>
          <p className="text-sm text-gray-400 mt-1">The template could not be resolved.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/template-manager")}>
            <ArrowLeft size={14} className="mr-1.5" /> Back to Templates
          </Button>
        </div>
      </div>
    );
  }

  const docTypeConfig = DOC_TYPE_CONFIG[template.doc_type as keyof typeof DOC_TYPE_CONFIG];
  const statusConfig: Record<BlockStatus, { label: string; bg: string; color: string; icon: typeof Lock }> = {
    required: { label: "Required", bg: "bg-blue-50", color: "text-blue-700", icon: Check },
    optional: { label: "Optional", bg: "bg-gray-50", color: "text-gray-600", icon: EyeOff },
    locked: { label: "Locked", bg: "bg-amber-50", color: "text-amber-700", icon: Lock },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/template-manager")} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Templates
          </Button>
          <div className="h-5 w-px bg-gray-200" />
          <Badge className="bg-[#1B2A4A]/10 text-[#1B2A4A] border-0 text-xs">{docTypeConfig?.label || template.doc_type}</Badge>
          <span className="text-sm font-medium text-[#1B2A4A]">{template.name}</span>
          <span className="text-xs text-gray-400">v{latestVersion?.version_number || 1}</span>
          <Badge className={`text-[10px] h-4 border-0 ${template.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {template.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.info("Preview renders a sample doc in Output Studio Viewer")}>
            <Eye size={12} className="mr-1" /> Preview Template
          </Button>
          <Button size="sm" className="text-xs bg-[#1B2A4A] hover:bg-[#2A3F6A]" onClick={handleSave}>
            <Save size={12} className="mr-1" /> Save Template
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 bg-white px-4">
        <div className="flex gap-0">
          {(["blocks", "layout", "variables", "branding"] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? "border-[#1B2A4A] text-[#1B2A4A]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "blocks" && <Layers size={12} className="inline mr-1.5" />}
              {tab === "layout" && <Settings size={12} className="inline mr-1.5" />}
              {tab === "variables" && <Hash size={12} className="inline mr-1.5" />}
              {tab === "branding" && <Palette size={12} className="inline mr-1.5" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-[900px] mx-auto">

          {/* BLOCKS TAB */}
          {activeTab === "blocks" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#1B2A4A]">Block Recipe</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Drag to reorder. Click status badge to cycle: Required → Optional → Locked.</p>
                </div>
                <Button size="sm" className="text-xs bg-[#1B2A4A] hover:bg-[#2A3F6A]" onClick={() => setShowAddBlock(true)}>
                  <Plus size={12} className="mr-1" /> Add Block
                </Button>
              </div>

              {blocks.map((block, idx) => {
                const familyCfg = BLOCK_FAMILY_CONFIG[block.family as keyof typeof BLOCK_FAMILY_CONFIG];
                const statusCfg = statusConfig[block.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <Card
                    key={`${block.block_key}-${idx}`}
                    className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow"
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e: React.DragEvent) => e.preventDefault()}
                    onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveBlock(dragIdx, idx); setDragIdx(null); }}
                  >
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <GripVertical size={14} className="text-gray-400 cursor-grab flex-shrink-0" />
                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#1B2A4A]">{block.display_name}</div>
                          <div className="text-[10px] text-gray-500">{block.block_key}</div>
                        </div>
                        {familyCfg && (
                          <Badge className={`text-[10px] h-5 border-0 ${familyCfg.bg} ${familyCfg.color}`}>
                            {familyCfg.label}
                          </Badge>
                        )}
                        <button
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.color} hover:opacity-80 transition-opacity`}
                          onClick={() => toggleStatus(idx)}
                        >
                          <StatusIcon size={10} />
                          {statusCfg.label}
                        </button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500" onClick={() => removeBlock(idx)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {blocks.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <Layers size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">No blocks in recipe</p>
                  <Button size="sm" className="mt-3 text-xs" onClick={() => setShowAddBlock(true)}>
                    <Plus size={12} className="mr-1" /> Add First Block
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* LAYOUT TAB */}
          {activeTab === "layout" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#1B2A4A] mb-4">Layout Configuration</h2>

              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[#1B2A4A]">Cover Page</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Cover Page Enabled</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${layout.cover_enabled ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setLayout(p => ({ ...p, cover_enabled: !p.cover_enabled }))}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${layout.cover_enabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Hero Image Slot</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${layout.cover_hero_slot ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setLayout(p => ({ ...p, cover_hero_slot: !p.cover_hero_slot }))}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${layout.cover_hero_slot ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[#1B2A4A]">Header & Footer</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Header Enabled</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${layout.header_enabled ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setLayout(p => ({ ...p, header_enabled: !p.header_enabled }))}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${layout.header_enabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Footer Enabled</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${layout.footer_enabled ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setLayout(p => ({ ...p, footer_enabled: !p.footer_enabled }))}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${layout.footer_enabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-[#1B2A4A]">Spacing & Breaks</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Spacing Preset</label>
                      <Select value={layout.spacing_preset} onValueChange={(v: string) => setLayout(p => ({ ...p, spacing_preset: v as "compact" | "normal" | "relaxed" }))}>
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
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Page Break Between Blocks</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${layout.page_break_between_blocks ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setLayout(p => ({ ...p, page_break_between_blocks: !p.page_break_between_blocks }))}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${layout.page_break_between_blocks ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-600">Annexure Mode (Legal Docs)</label>
                      <button
                        className={`relative w-9 h-5 rounded-full transition-colors ${layout.annexure_mode ? "bg-[#1B2A4A]" : "bg-gray-300"}`}
                        onClick={() => setLayout(p => ({ ...p, annexure_mode: !p.annexure_mode }))}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${layout.annexure_mode ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* VARIABLES TAB */}
          {activeTab === "variables" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#1B2A4A]">Variable Configuration</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Choose allowed variable namespaces and mark required variables for this template.</p>
                </div>
              </div>

              {/* Namespace toggles */}
              <Card className="border border-gray-200 shadow-none">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-[#1B2A4A] mb-3">Allowed Namespaces</h3>
                  <div className="flex flex-wrap gap-2">
                    {namespaces.map(ns => {
                      const cfg = NAMESPACE_CONFIG[ns];
                      const isActive = variableSet.allowed_namespaces.includes(ns);
                      return (
                        <button
                          key={ns}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                            isActive ? "bg-[#1B2A4A] text-white border-[#1B2A4A]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => toggleNamespace(ns)}
                        >
                          {isActive && <Check size={10} />}
                          {cfg?.label || ns}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Variables per namespace */}
              {variableSet.allowed_namespaces.map(ns => {
                const vars = variablesByNamespace[ns] || [];
                const cfg = NAMESPACE_CONFIG[ns];
                return (
                  <Card key={ns} className="border border-gray-200 shadow-none">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="text-[10px] h-5 border-0 bg-[#1B2A4A]/10 text-[#1B2A4A]">{cfg?.label || ns}</Badge>
                        <span className="text-[10px] text-gray-500">{vars.length} variables</span>
                      </div>
                      {vars.length === 0 ? (
                        <p className="text-xs text-gray-400">No variables in this namespace</p>
                      ) : (
                        <div className="space-y-1">
                          {vars.map(v => {
                            const isRequired = variableSet.required_variables.includes(v.key);
                            return (
                              <div key={v.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
                                <button
                                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                                    isRequired ? "bg-[#1B2A4A] border-[#1B2A4A]" : "border-gray-300"
                                  }`}
                                  onClick={() => toggleRequiredVariable(v.key)}
                                >
                                  {isRequired && <Check size={10} className="text-white" />}
                                </button>
                                <code className="text-[10px] font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{`{{${v.key}}}`}</code>
                                <span className="text-xs text-gray-600 flex-1">{v.label}</span>
                                <Badge className={`text-[9px] h-3.5 border-0 ${v.data_type === "currency" ? "bg-emerald-50 text-emerald-700" : v.data_type === "number" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                  {v.data_type}
                                </Badge>
                                {isRequired && <Badge className="text-[9px] h-3.5 bg-red-50 text-red-700 border-0">Required</Badge>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* BRANDING TAB */}
          {activeTab === "branding" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[#1B2A4A] mb-4">Default Branding Profile</h2>
              <div className="grid grid-cols-2 gap-4">
                {activeBranding.map(bp => {
                  const isSelected = selectedBrandingId === bp.id;
                  return (
                    <Card
                      key={bp.id}
                      className={`border cursor-pointer transition-all ${isSelected ? "border-[#1B2A4A] shadow-md ring-2 ring-[#1B2A4A]/20" : "border-gray-200 shadow-none hover:shadow-sm"}`}
                      onClick={() => setSelectedBrandingId(bp.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-[#1B2A4A]">{bp.name}</span>
                          {isSelected && <Check size={16} className="text-[#1B2A4A]" />}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded" style={{ background: bp.primary_color }} />
                          <div className="w-6 h-6 rounded" style={{ background: bp.secondary_color }} />
                          <div className="w-6 h-6 rounded" style={{ background: bp.accent_color }} />
                        </div>
                        <div className="text-[10px] text-gray-500 space-y-0.5">
                          <div>Body: {bp.font_family}</div>
                          <div>Heading: {bp.font_heading}</div>
                          <div>Header: {bp.header_style}</div>
                        </div>
                        {selectedBrandingId === bp.id && <Badge className="mt-2 text-[9px] h-3.5 bg-emerald-50 text-emerald-700 border-0">Selected</Badge>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Block Dialog */}
      <Dialog open={showAddBlock} onOpenChange={setShowAddBlock}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#1B2A4A]">Add Block to Recipe</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto space-y-1">
            {availableBlocks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">All available blocks are already in the recipe.</p>
            ) : (
              availableBlocks.map((schema: DocBlock) => {
                const familyCfg = BLOCK_FAMILY_CONFIG[schema.family as keyof typeof BLOCK_FAMILY_CONFIG];
                return (
                  <button
                    key={schema.block_key}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    onClick={() => addBlock(schema)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1B2A4A]">{schema.display_name}</div>
                      <div className="text-[10px] text-gray-500">{schema.block_key}</div>
                    </div>
                    {familyCfg && (
                      <Badge className={`text-[10px] h-5 border-0 ${familyCfg.bg} ${familyCfg.color}`}>
                        {familyCfg.label}
                      </Badge>
                    )}
                    <Badge className={`text-[10px] h-5 border-0 ${schema.editor_mode === "wysiwyg" ? "bg-blue-50 text-blue-700" : schema.editor_mode === "readonly" ? "bg-emerald-50 text-emerald-700" : schema.editor_mode === "clause" ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                      {schema.editor_mode}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddBlock(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
