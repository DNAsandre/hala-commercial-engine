/*
 * Document Composer Shell — Template-driven authoring environment
 * Accessible from /editor, /editor?type=quote, /editor?type=proposal, /editor?type=sla
 * Wraps the DocumentComposer component with document library listing
 * Design: White cards, subtle borders, enterprise SaaS aesthetic
 */

import { useState, useMemo } from "react";
import DocumentComposer, { type ComposerDocument } from "@/components/DocumentComposer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileCheck, BookOpen, FileSignature, Plus, ArrowLeft,
  FileText, Clock, Search, Scale, Truck, Warehouse,
  LayoutTemplate, Lock
} from "lucide-react";
import { useLocation } from "wouter";
import {
  type DocType, docInstances, DOC_TYPE_CONFIG, DOC_INSTANCE_STATUS_CONFIG,
  getPublishedTemplates,
} from "@/lib/document-composer";

const ICON_MAP: Record<string, typeof FileText> = {
  FileCheck, BookOpen, FileSignature, Scale, Truck, Warehouse, FileText,
};

export default function Editor() {
  const [, navigate] = useLocation();
  const [activeDoc, setActiveDoc] = useState<{
    type: DocType;
    instanceId?: string;
    customerName?: string;
    customerId?: string;
    workspaceId?: string;
  } | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  // All hooks MUST be called before any conditional return
  const filteredInstances = useMemo(() => {
    return docInstances.filter(di => {
      if (filterType !== "all" && di.doc_type !== filterType) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!di.customer_name.toLowerCase().includes(s) && !di.doc_type.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [filterType, search]);

  const publishedTemplates = useMemo(() => getPublishedTemplates(), []);

  // Check URL params for document type
  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type") as DocType | null;
  const urlInstanceId = urlParams.get("instance") || undefined;

  // If we have an active document or URL params, show the composer
  if (activeDoc || urlType) {
    const docType = activeDoc?.type || urlType || "proposal";
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
          <Button variant="ghost" size="sm" onClick={() => { setActiveDoc(null); navigate("/editor"); }} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to Documents
          </Button>
        </div>
        <div className="flex-1">
          <DocumentComposer
            documentType={docType}
            existingInstanceId={activeDoc?.instanceId || urlInstanceId}
            customerId={activeDoc?.customerId}
            customerName={activeDoc?.customerName}
            workspaceId={activeDoc?.workspaceId}
            onSave={(doc: ComposerDocument) => {
              toast.success("Document saved to library");
            }}
            onExportPDF={(doc: ComposerDocument) => {
              toast.success("PDF compile initiated — document will be available in Documents shell");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1B2A4A] font-serif">Document Composer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create and manage commercial documents with template-driven block editing, branding profiles, and PDF compilation
        </p>
      </div>

      {/* Create New Document */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#1B2A4A] mb-3 uppercase tracking-wider">Create New Document</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["quote", "proposal", "sla"] as DocType[]).map((type) => {
            const config = DOC_TYPE_CONFIG[type];
            const Icon = ICON_MAP[config.icon] || FileText;
            const templateCount = publishedTemplates.filter(t => t.doc_type === type).length;
            const colorMap: Record<string, { text: string; bg: string }> = {
              quote: { text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
              proposal: { text: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
              sla: { text: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
            };
            const colors = colorMap[type] || { text: "text-gray-700", bg: "bg-gray-50 border-gray-200" };
            return (
              <Card key={type} className={`cursor-pointer border-2 hover:shadow-md transition-all ${colors.bg}`}
                onClick={() => setActiveDoc({ type })}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg bg-white/80 ${colors.text}`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold text-sm ${colors.text}`}>{config.label}</h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {type === "quote" && "Commercial pricing quotations with rate cards, terms, and scope of services"}
                        {type === "proposal" && "Full commercial proposals with executive summary, solution design, and implementation plan"}
                        {type === "sla" && "SLA documents with KPIs, penalties, escalation procedures, and review schedules"}
                      </p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Plus size={12} /> Create New</span>
                        <span className="flex items-center gap-1"><LayoutTemplate size={12} /> {templateCount} templates</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Document Instances */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#1B2A4A] uppercase tracking-wider">Document Instances</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-7 text-xs pl-8 w-48" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(DOC_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          {filteredInstances.map((di) => {
            const config = DOC_TYPE_CONFIG[di.doc_type];
            const Icon = ICON_MAP[config.icon] || FileText;
            const statusCfg = DOC_INSTANCE_STATUS_CONFIG[di.status];
            const currentVersion = di.versions.find(v => v.id === di.current_version_id);
            const colorMap: Record<string, string> = {
              quote: "text-emerald-700",
              proposal: "text-blue-700",
              sla: "text-purple-700",
              msa: "text-indigo-700",
              service_order_transport: "text-orange-700",
              service_order_warehouse: "text-teal-700",
            };
            const iconColor = colorMap[di.doc_type] || "text-gray-700";
            return (
              <Card key={di.id} className="cursor-pointer hover:shadow-sm transition-all border border-gray-200"
                onClick={() => setActiveDoc({ type: di.doc_type, instanceId: di.id, customerName: di.customer_name, customerId: di.customer_id })}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded ${iconColor} bg-gray-50`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#1B2A4A] truncate">
                          {di.customer_name} — {config.label}
                        </h3>
                        <Badge className={`text-[10px] h-4 ${statusCfg.bg} ${statusCfg.color} border-0`}>{statusCfg.label}</Badge>
                        {di.status === "canon" && <Lock size={10} className="text-[#1B2A4A]/40" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{di.customer_name}</span>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {di.updated_at}</span>
                        <span className="text-gray-300">·</span>
                        <span>v{currentVersion?.version_number || 1}</span>
                        <span className="text-gray-300">·</span>
                        <span>{currentVersion?.blocks.length || 0} blocks</span>
                        {di.workspace_name && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{di.workspace_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${iconColor}`}>{config.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredInstances.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <FileText size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No document instances found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
