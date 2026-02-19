/*
 * Template Manager — Admin page for managing document templates
 * CRUD templates, version management, publish flow
 * Design: White cards, subtle borders, matching enterprise SaaS aesthetic
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  LayoutTemplate, Search, Plus, FileCheck, BookOpen, FileSignature,
  Scale, Truck, Warehouse, ChevronDown, ChevronRight, Clock, User,
  CheckCircle2, Archive, FileText, Layers, Copy, Trash2, Send,
  Eye, Settings2, Hash
} from "lucide-react";
import {
  docTemplates, blockLibrary, brandingProfiles, getLatestTemplateVersion,
  DOC_TYPE_CONFIG, TEMPLATE_STATUS_CONFIG, BLOCK_FAMILY_CONFIG,
  type DocTemplate, type DocType, type TemplateStatus, type RecipeBlock, type LayoutConfig
} from "@/lib/document-composer";
import { navigationV1 } from "@/components/DashboardLayout";

const DOC_TYPE_ICONS: Record<string, typeof FileText> = {
  quote: FileCheck, proposal: BookOpen, sla: FileSignature,
  msa: Scale, service_order_transport: Truck, service_order_warehouse: Warehouse,
};

export default function TemplateManager() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDocType, setNewDocType] = useState<DocType>("proposal");
  const [newDescription, setNewDescription] = useState("");
  const [newBrandingId, setNewBrandingId] = useState(brandingProfiles[0]?.id || "");

  const filtered = useMemo(() => {
    return docTemplates.filter(t => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && t.doc_type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      return true;
    });
  }, [search, filterType, filterStatus]);

  // Metrics
  const totalTemplates = docTemplates.length;
  const publishedCount = docTemplates.filter(t => t.status === "published").length;
  const draftCount = docTemplates.filter(t => t.status === "draft").length;
  const totalVersions = docTemplates.reduce((sum, t) => sum + t.versions.length, 0);

  const handleCreate = () => {
    if (!newName.trim()) { toast.error("Template name is required"); return; }
    toast.success(`Template "${newName}" created as draft`);
    setShowCreateDialog(false);
    setNewName(""); setNewDescription("");
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Legacy Banner */}
      {navigationV1 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2">
          <span className="text-xs text-amber-800">This page is now accessible via <a href="/admin" className="underline font-semibold hover:text-amber-900">Admin</a>.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] font-serif">Template Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Create, version, and publish document templates for Quotes, Proposals, SLAs, and MSAs</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
          <Plus size={14} className="mr-1.5" /> New Template
        </Button>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Templates", value: totalTemplates, icon: LayoutTemplate, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Published", value: publishedCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Drafts", value: draftCount, icon: FileText, color: "text-gray-600", bg: "bg-gray-50" },
          { label: "Total Versions", value: totalVersions, icon: Hash, color: "text-purple-600", bg: "bg-purple-50" },
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
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9 h-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Template List */}
      <div className="space-y-3">
        {filtered.map((template) => {
          const isExpanded = expandedId === template.id;
          const latestVersion = getLatestTemplateVersion(template);
          const statusCfg = TEMPLATE_STATUS_CONFIG[template.status];
          const typeCfg = DOC_TYPE_CONFIG[template.doc_type];
          const TypeIcon = DOC_TYPE_ICONS[template.doc_type] || FileText;
          const branding = brandingProfiles.find(bp => bp.id === template.default_branding_profile_id);

          return (
            <Card key={template.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-0">
                {/* Template Header Row */}
                <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : template.id)}>
                  <div className={`p-2.5 rounded-lg bg-gray-50`}>
                    <TypeIcon size={20} className="text-[#1B2A4A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1B2A4A]">{template.name}</h3>
                      <Badge className={`text-[10px] h-5 border-0 ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      <Badge variant="outline" className="text-[10px] h-5">{typeCfg.label}</Badge>
                      {template.default_locale === "bilingual" && (
                        <Badge variant="outline" className="text-[10px] h-5 border-amber-200 text-amber-700 bg-amber-50">EN/AR</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{template.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Layers size={10} /> {template.versions.length} version{template.versions.length !== 1 ? "s" : ""}</span>
                      <span className="flex items-center gap-1"><User size={10} /> {template.created_by}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {template.updated_at}</span>
                      {branding && <span className="flex items-center gap-1"><Settings2 size={10} /> {branding.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); navigate(`/templates/${template.id}/designer`); }}>
                      <Settings2 size={12} className="mr-1" /> Design
                    </Button>
                    {template.status === "draft" && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={(e) => { e.stopPropagation(); toast.success(`Template "${template.name}" published`); }}>
                        <Send size={12} className="mr-1" /> Publish
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); toast.info("Feature coming soon"); }}>
                      <Copy size={14} />
                    </Button>
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && latestVersion && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Recipe (Block List) */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Block Recipe (v{latestVersion.version_number})</h4>
                        <div className="space-y-1.5">
                          {latestVersion.recipe.map((rb, i) => {
                            const block = blockLibrary.find(b => b.block_key === rb.block_key);
                            const familyCfg = block ? BLOCK_FAMILY_CONFIG[block.family] : null;
                            return (
                              <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100">
                                <span className="text-xs text-gray-400 w-5 text-right">{rb.order}</span>
                                <span className="text-xs font-medium text-[#1B2A4A] flex-1">{block?.display_name || rb.block_key}</span>
                                {familyCfg && <Badge className={`text-[9px] h-4 border ${familyCfg.bg} ${familyCfg.color}`}>{familyCfg.label}</Badge>}
                                {rb.required && <Badge variant="outline" className="text-[9px] h-4 border-red-200 text-red-600">Required</Badge>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Layout & Version Info */}
                      <div>
                        <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mb-2">Layout Configuration</h4>
                        <div className="bg-white rounded border border-gray-100 p-3 space-y-2 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Cover Page</span><span className="font-medium">{latestVersion.layout.cover_page ? "Yes" : "No"}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Cover Style</span><span className="font-medium capitalize">{latestVersion.layout.cover_style.replace(/_/g, " ")}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Section Spacing</span><span className="font-medium capitalize">{latestVersion.layout.section_spacing}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Page Breaks</span><span className="font-medium">{latestVersion.layout.page_break_between_sections ? "Between sections" : "None"}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Annexure Section</span><span className="font-medium">{latestVersion.layout.annexure_section ? "Included" : "None"}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Auto TOC</span><span className="font-medium">{latestVersion.layout.toc_auto ? "Yes" : "No"}</span></div>
                        </div>

                        <h4 className="text-xs font-semibold text-[#1B2A4A] uppercase tracking-wider mt-4 mb-2">Version History</h4>
                        <div className="space-y-1.5">
                          {template.versions.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100 text-xs">
                              <Badge variant="outline" className="text-[10px] h-5">v{v.version_number}</Badge>
                              <span className="text-gray-500">{v.created_by}</span>
                              <span className="text-gray-400">{v.created_at}</span>
                              {v.published_at && <Badge className="text-[9px] h-4 bg-emerald-50 text-emerald-700 border-0 ml-auto">Published {v.published_at}</Badge>}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.info("Feature coming soon")}>
                            <Plus size={12} className="mr-1" /> New Version
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.info("Feature coming soon")}>
                            <Eye size={12} className="mr-1" /> Preview
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => toast.info("Feature coming soon")}>
                            <Archive size={12} className="mr-1" /> Archive
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <LayoutTemplate size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No templates match your filters</p>
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B2A4A] font-serif">Create New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Template Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Standard Quotation v2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Document Type</label>
              <Select value={newDocType} onValueChange={(v) => setNewDocType(v as DocType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Branding Profile</label>
              <Select value={newBrandingId} onValueChange={setNewBrandingId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {brandingProfiles.map(bp => (
                    <SelectItem key={bp.id} value={bp.id}>{bp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Description</label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description of this template..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
