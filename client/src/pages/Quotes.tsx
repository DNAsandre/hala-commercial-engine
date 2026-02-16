/*
 * Quotes Shell — List all quotes with ability to create/edit in the Commercial Editor
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState } from "react";
import { FileCheck, Plus, ArrowLeft, Edit, Eye, Download, Trash2, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { quotes, workspaces, formatSAR, formatPercent } from "@/lib/store";
import { toast } from "sonner";
import CommercialEditor, { type EditorDocument } from "@/components/CommercialEditor";
import { useLocation } from "wouter";

const stateColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  superseded: "bg-amber-100 text-amber-800",
};

export default function Quotes() {
  const [, navigate] = useLocation();
  const [editingQuote, setEditingQuote] = useState<{ customerName: string; quoteId: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredQuotes = quotes.filter(q => {
    const ws = workspaces.find(w => w.id === q.workspaceId);
    const name = ws?.customerName || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || q.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // If editing a quote, show the full editor
  if (editingQuote) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
          <Button variant="ghost" size="sm" onClick={() => setEditingQuote(null)} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to Quotes
          </Button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-600">Editing quote for <strong>{editingQuote.customerName}</strong></span>
        </div>
        <div className="flex-1">
          <CommercialEditor
            documentType="quote"
            customerName={editingQuote.customerName}
            onSave={(doc: EditorDocument) => {
              toast.success(`Quote saved — ${doc.title}`);
            }}
            onExportPDF={() => {
              toast.success("Quote PDF export initiated");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotes.length} quotes across all workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setEditingQuote({ customerName: "", quoteId: "new" })} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
            <Plus className="w-4 h-4 mr-1.5" /> New Quote
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search quotes by customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="text-xs"><Filter size={14} className="mr-1" /> Filter</Button>
      </div>

      {/* Quotes List */}
      <div className="space-y-3">
        {filteredQuotes.map(q => {
          const ws = workspaces.find(w => w.id === q.workspaceId);
          const customerName = ws?.customerName || "Unknown";
          return (
            <Card key={q.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-emerald-50">
                      <FileCheck className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#1B2A4A]">{customerName}</span>
                      <span className="text-xs text-gray-400 ml-2">Quote v{q.version}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${stateColors[q.state] || ""}`}>{q.state}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => setEditingQuote({ customerName, quoteId: q.id })}>
                      <Edit size={12} className="mr-1" /> Edit in Editor
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => toast.success("PDF export initiated")}>
                      <Download size={12} className="mr-1" /> PDF
                    </Button>
                    <span className="text-xs text-gray-400 ml-2">{q.createdAt}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {[
                    { l: "Storage Rate", v: `SAR ${q.storageRate}/plt/day` },
                    { l: "Pallets", v: q.palletVolume.toLocaleString() },
                    { l: "Monthly Rev", v: formatSAR(q.monthlyRevenue) },
                    { l: "Annual Rev", v: formatSAR(q.annualRevenue) },
                    { l: "GP%", v: formatPercent(q.gpPercent) },
                  ].map(kv => (
                    <div key={kv.l}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{kv.l}</p>
                      <p className="text-sm font-medium mt-0.5 text-[#1B2A4A]">{kv.v}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
