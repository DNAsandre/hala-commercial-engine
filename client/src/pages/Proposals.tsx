/*
 * Proposals Shell — List all proposals with ability to create/edit in the Commercial Editor
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState } from "react";
import { BookOpen, Plus, ArrowLeft, Edit, Download, Send, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proposals, workspaces } from "@/lib/store";
import { toast } from "sonner";
import CommercialEditor, { type EditorDocument } from "@/components/CommercialEditor";

const stateColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready_for_crm: "bg-blue-100 text-blue-800",
  sent: "bg-indigo-100 text-indigo-800",
  negotiation_active: "bg-amber-100 text-amber-800",
  commercial_approved: "bg-emerald-100 text-emerald-800",
};

export default function Proposals() {
  const [editingProposal, setEditingProposal] = useState<{ customerName: string; proposalId: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProposals = proposals.filter(p => {
    const ws = workspaces.find(w => w.id === p.workspaceId);
    const name = ws?.customerName || "";
    return p.title.toLowerCase().includes(searchTerm.toLowerCase()) || name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // If editing a proposal, show the full editor
  if (editingProposal) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
          <Button variant="ghost" size="sm" onClick={() => setEditingProposal(null)} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to Proposals
          </Button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-600">Editing proposal for <strong>{editingProposal.customerName}</strong></span>
        </div>
        <div className="flex-1">
          <CommercialEditor
            documentType="proposal"
            customerName={editingProposal.customerName}
            onSave={(doc: EditorDocument) => {
              toast.success(`Proposal saved — ${doc.title}`);
            }}
            onExportPDF={() => {
              toast.success("Proposal PDF export initiated");
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
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Proposals</h1>
          <p className="text-sm text-gray-500 mt-0.5">{proposals.length} proposals across all workspaces</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast("Batch PDF export coming soon")}>
            <Download className="w-4 h-4 mr-1.5" /> Export All
          </Button>
          <Button onClick={() => setEditingProposal({ customerName: "", proposalId: "new" })} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
            <Plus className="w-4 h-4 mr-1.5" /> New Proposal
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search proposals..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="text-xs"><Filter size={14} className="mr-1" /> Filter</Button>
      </div>

      {/* Proposals List */}
      <div className="space-y-3">
        {filteredProposals.map(p => {
          const ws = workspaces.find(w => w.id === p.workspaceId);
          const customerName = ws?.customerName || "Unknown";
          return (
            <Card key={p.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-blue-50">
                      <BookOpen className="w-4 h-4 text-blue-700" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#1B2A4A]">{p.title}</span>
                      <span className="text-xs text-gray-400 ml-2">v{p.version}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${stateColors[p.state] || ""}`}>{p.state.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => setEditingProposal({ customerName, proposalId: p.id })}>
                      <Edit size={12} className="mr-1" /> Edit in Editor
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => toast.success("PDF generation triggered")}>
                      <Download size={12} className="mr-1" /> PDF
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => toast.success("CRM export triggered")}>
                      <Send size={12} className="mr-1" /> CRM
                    </Button>
                    <span className="text-xs text-gray-400 ml-2">{p.createdAt}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">{p.sections.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                {ws && <p className="text-xs text-gray-500 mt-2">Workspace: {ws.customerName} — {ws.title}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
