import { Link } from "wouter";
/*
 * Block Library — Admin page for browsing/managing document block types
 * Grouped by family, shows permissions, editor mode, and render key
 * Design: White cards, subtle borders, matching enterprise SaaS aesthetic
 */

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Blocks, Search, Shield, ShieldAlert, ShieldCheck, Bot,
  Lock, Unlock, Eye, Pencil, FileCode, ChevronDown, ChevronRight,
  Code2, Layers, GripVertical
, ArrowLeft } from "lucide-react";
import {
  blockLibrary, BLOCK_FAMILY_CONFIG, EDITOR_MODE_CONFIG,
  type DocBlock, type BlockFamily
} from "@/lib/document-composer";
import { navigationV1 } from "@/components/DashboardLayout";

export default function BlockLibraryPage() {
  const [search, setSearch] = useState("");
  const [filterFamily, setFilterFamily] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return blockLibrary.filter(b => {
      if (search && !b.display_name.toLowerCase().includes(search.toLowerCase()) && !b.block_key.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterFamily !== "all" && b.family !== filterFamily) return false;
      return true;
    });
  }, [search, filterFamily]);

  // Group by family for display
  const grouped = useMemo(() => {
    const groups: Record<string, DocBlock[]> = {};
    filtered.forEach(b => {
      if (!groups[b.family]) groups[b.family] = [];
      groups[b.family].push(b);
    });
    return groups;
  }, [filtered]);

  // Metrics
  const totalBlocks = blockLibrary.length;
  const editableCount = blockLibrary.filter(b => b.permissions.editable_in_draft).length;
  const readonlyCount = blockLibrary.filter(b => b.editor_mode === "readonly").length;
  const aiAllowedCount = blockLibrary.filter(b => b.permissions.ai_allowed).length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Legacy Banner */}
      {navigationV1 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2">
          <span className="text-xs text-amber-800">This page is now accessible via <a href="/admin" className="underline font-semibold hover:text-amber-900">Admin</a>.</span>
        </div>
      )}
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] font-serif">Block Library</h1>
          <p className="text-sm text-gray-500 mt-1">Document composition blocks — drag into templates to build document recipes</p>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Blocks", value: totalBlocks, icon: Blocks, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Editable", value: editableCount, icon: Pencil, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Read-Only", value: readonlyCount, icon: Eye, color: "text-gray-600", bg: "bg-gray-50" },
          { label: "AI-Allowed", value: aiAllowedCount, icon: Bot, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((m, i) => (
          <Card key={i} className="border border-gray-200 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                  <p className="text-2xl font-bold text-[#1B2A4A]">{m.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${m.bg}`}><m.icon size={18} className={m.color} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search blocks by name or key..." className="pl-9 h-9" />
        </div>
        <Tabs value={filterFamily} onValueChange={setFilterFamily}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs h-7">All</TabsTrigger>
            {Object.entries(BLOCK_FAMILY_CONFIG).map(([key, cfg]) => (
              <TabsTrigger key={key} value={key} className="text-xs h-7">{cfg.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Block Groups */}
      {Object.entries(grouped).map(([family, blocks]) => {
        const familyCfg = BLOCK_FAMILY_CONFIG[family as BlockFamily];
        return (
          <div key={family} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className={`px-2 py-0.5 rounded text-xs font-semibold border ${familyCfg.bg} ${familyCfg.color}`}>
                {familyCfg.label}
              </div>
              <span className="text-xs text-gray-400">{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="space-y-2">
              {blocks.map((block) => {
                const isExpanded = expandedId === block.id;
                const modeCfg = EDITOR_MODE_CONFIG[block.editor_mode];

                return (
                  <Card key={block.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
                    <CardContent className="p-0">
                      {/* Block Row */}
                      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : block.id)}>
                        <GripVertical size={14} className="text-gray-300" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-[#1B2A4A]">{block.display_name}</h3>
                            <code className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded font-mono">{block.block_key}</code>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{block.description}</p>
                        </div>

                        {/* Permission Badges */}
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] h-5">{modeCfg.label}</Badge>
                          {block.permissions.editable_in_draft ? (
                            <Badge className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-0">
                              <Pencil size={8} className="mr-0.5" /> Editable
                            </Badge>
                          ) : (
                            <Badge className="text-[10px] h-5 bg-gray-100 text-gray-600 border-0">
                              <Eye size={8} className="mr-0.5" /> Read-Only
                            </Badge>
                          )}
                          {block.permissions.ai_allowed && (
                            <Badge className="text-[10px] h-5 bg-purple-50 text-purple-700 border-0">
                              <Bot size={8} className="mr-0.5" /> AI
                            </Badge>
                          )}
                          {block.permissions.lockable && (
                            <Badge className="text-[10px] h-5 bg-amber-50 text-amber-700 border-0">
                              <Lock size={8} className="mr-0.5" /> Lockable
                            </Badge>
                          )}
                        </div>

                        {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                          <div className="grid grid-cols-3 gap-4">
                            {/* Permissions */}
                            <div>
                              <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Permissions</h4>
                              <div className="space-y-1.5 text-xs">
                                {[
                                  { label: "Editable in Draft", value: block.permissions.editable_in_draft, icon: Pencil },
                                  { label: "Editable in Canon", value: block.permissions.editable_in_canon, icon: ShieldAlert },
                                  { label: "AI Allowed", value: block.permissions.ai_allowed, icon: Bot },
                                  { label: "Lockable", value: block.permissions.lockable, icon: Lock },
                                ].map((p, i) => (
                                  <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100">
                                    <p.icon size={12} className={p.value ? "text-emerald-600" : "text-gray-300"} />
                                    <span className="text-gray-600 flex-1">{p.label}</span>
                                    {p.value ? (
                                      <ShieldCheck size={12} className="text-emerald-600" />
                                    ) : (
                                      <Shield size={12} className="text-gray-300" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Schema */}
                            <div>
                              <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Schema</h4>
                              <div className="p-3 bg-white rounded border border-gray-100 text-xs">
                                <p className="text-gray-500 mb-1">Variable Slots</p>
                                {block.schema.variable_slots.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {block.schema.variable_slots.map((slot, i) => (
                                      <code key={i} className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{`{{${slot}}}`}</code>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-gray-400 italic">No variable slots</p>
                                )}

                                {Object.keys(block.schema.config).length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-100">
                                    <p className="text-gray-500 mb-1">Config</p>
                                    {Object.entries(block.schema.config).map(([k, v]) => (
                                      <div key={k} className="flex justify-between">
                                        <code className="text-[10px] text-gray-500">{k}</code>
                                        <code className="text-[10px] text-gray-700">{v}</code>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 p-2 bg-white rounded border border-gray-100 flex items-center gap-2">
                                <Code2 size={12} className="text-gray-400" />
                                <span className="text-xs text-gray-500">Render Key:</span>
                                <code className="text-xs font-mono text-[#1B2A4A]">{block.render_key}</code>
                              </div>
                            </div>

                            {/* Default Content Preview */}
                            <div>
                              <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Default Content Preview</h4>
                              <div className="p-3 bg-white rounded border border-gray-100 max-h-48 overflow-y-auto">
                                <div className="text-xs text-gray-600 prose prose-xs" dangerouslySetInnerHTML={{ __html: block.default_content }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Blocks size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No blocks match your search</p>
        </div>
      )}
    </div>
  );
}
