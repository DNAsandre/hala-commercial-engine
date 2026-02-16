/*
 * Editor Shell — Standalone authoring environment for Quotes, Proposals, and SLAs
 * Accessible from /editor, /editor?type=quote, /editor?type=proposal, /editor?type=sla
 * Or from within workspace detail / quotes / proposals pages
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState } from "react";
import CommercialEditor, { type DocumentType, type EditorDocument } from "@/components/CommercialEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileCheck, BookOpen, FileSignature, Plus, ArrowLeft,
  FileText, Clock, Sparkles
} from "lucide-react";
import { useLocation } from "wouter";

interface SavedDocument {
  id: string;
  type: DocumentType;
  title: string;
  customerName: string;
  status: string;
  updatedAt: string;
  version: number;
}

export default function Editor() {
  const [, navigate] = useLocation();
  const [activeDocument, setActiveDocument] = useState<{ type: DocumentType; customerName?: string } | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([
    { id: "d1", type: "proposal", title: "SABIC Jubail Warehousing Proposal", customerName: "SABIC", status: "draft", updatedAt: "2025-02-14", version: 3 },
    { id: "d2", type: "quote", title: "Maaden Storage Quotation", customerName: "Maaden", status: "review", updatedAt: "2025-02-12", version: 2 },
    { id: "d3", type: "sla", title: "Almarai SLA — Eastern Region", customerName: "Almarai", status: "canon", updatedAt: "2025-02-10", version: 1 },
    { id: "d4", type: "quote", title: "NADEC Cold Chain Quote", customerName: "NADEC", status: "draft", updatedAt: "2025-02-08", version: 1 },
    { id: "d5", type: "proposal", title: "Aramco Logistics Proposal", customerName: "Aramco", status: "approved", updatedAt: "2025-02-06", version: 4 },
  ]);

  // Check URL params for document type
  const urlParams = new URLSearchParams(window.location.search);
  const urlType = urlParams.get("type") as DocumentType | null;

  // If we have an active document, show the editor
  if (activeDocument || urlType) {
    const docType = activeDocument?.type || urlType || "proposal";
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
          <Button variant="ghost" size="sm" onClick={() => { setActiveDocument(null); navigate("/editor"); }} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to Documents
          </Button>
        </div>
        <div className="flex-1">
          <CommercialEditor
            documentType={docType}
            customerName={activeDocument?.customerName || ""}
            onSave={(doc: EditorDocument) => {
              const existing = savedDocuments.find(d => d.id === doc.id);
              if (existing) {
                setSavedDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, title: doc.title, status: doc.status, updatedAt: doc.updatedAt, version: doc.version } : d));
              } else {
                setSavedDocuments(prev => [{ id: doc.id, type: doc.type, title: doc.title, customerName: doc.customerName, status: doc.status, updatedAt: doc.updatedAt, version: doc.version }, ...prev]);
              }
              toast.success("Document saved to library");
            }}
            onExportPDF={() => {
              toast.success("PDF export initiated — document will be available in Documents shell");
            }}
          />
        </div>
      </div>
    );
  }

  // Document Library View
  const typeConfig: Record<DocumentType, { icon: typeof FileText; label: string; color: string; bg: string; desc: string }> = {
    quote: { icon: FileCheck, label: "Quotation", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", desc: "Commercial pricing quotations with rate cards, terms, and scope of services" },
    proposal: { icon: BookOpen, label: "Proposal", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", desc: "Full commercial proposals with executive summary, solution design, and implementation plan" },
    sla: { icon: FileSignature, label: "Service Level Agreement", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", desc: "SLA documents with KPIs, penalties, escalation procedures, and review schedules" },
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    review: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    canon: "bg-[#1B2A4A] text-white",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1B2A4A] font-serif">Commercial Editor</h1>
        <p className="text-sm text-gray-500 mt-1">Create and manage Quotes, Proposals, and SLAs with the three-mode authoring system</p>
      </div>

      {/* Create New Document */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-[#1B2A4A] mb-3 uppercase tracking-wider">Create New Document</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["quote", "proposal", "sla"] as DocumentType[]).map((type) => {
            const config = typeConfig[type];
            const Icon = config.icon;
            return (
              <Card key={type} className={`cursor-pointer border-2 hover:shadow-md transition-all ${config.bg}`}
                onClick={() => setActiveDocument({ type })}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg bg-white/80 ${config.color}`}>
                      <Icon size={22} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-semibold text-sm ${config.color}`}>{config.label}</h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{config.desc}</p>
                      <div className="flex items-center gap-1 mt-3 text-xs font-medium text-gray-500">
                        <Plus size={12} /> Create New
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Documents */}
      <div>
        <h2 className="text-sm font-semibold text-[#1B2A4A] mb-3 uppercase tracking-wider">Recent Documents</h2>
        <div className="space-y-2">
          {savedDocuments.map((doc) => {
            const config = typeConfig[doc.type];
            const Icon = config.icon;
            return (
              <Card key={doc.id} className="cursor-pointer hover:shadow-sm transition-all border border-gray-200"
                onClick={() => setActiveDocument({ type: doc.type, customerName: doc.customerName })}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded ${config.color} bg-gray-50`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#1B2A4A] truncate">{doc.title}</h3>
                        <Badge className={`text-[10px] h-4 ${statusColors[doc.status]} border-0`}>{doc.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{doc.customerName}</span>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {doc.updatedAt}</span>
                        <span className="text-gray-300">·</span>
                        <span>v{doc.version}</span>
                        {doc.status === "draft" && (
                          <span className="flex items-center gap-1 text-amber-600"><Sparkles size={10} /> AI assisted</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
