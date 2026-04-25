/*
 * Quotes Shell — Governance-enforced quote management with editor integration
 * Gate checks on: create, approve, submit
 * Audit logging on: all write actions
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState } from "react";
import { FileCheck, Plus, ArrowLeft, Edit, Eye, Download, Search, Filter, Shield, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSAR, formatPercent } from "@/lib/store";
import { useQuotes, useWorkspaces, useCustomers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import { resolveOrCreateDocInstanceAsync } from "@/hooks/useResolveDocInstance";
import { getEcrScoreByCustomerName, getGradeBg, type EcrScore } from "@/lib/ecr";
import { Star } from "lucide-react";
import { toast } from "sonner";
import DocumentComposer, { type ComposerDocument } from "@/components/DocumentComposer";
import OverrideDialog from "@/components/OverrideDialog";
import { useGateCheck, useAuditLog } from "@/hooks/useGovernance";
import { navigationV1 } from "@/components/DashboardLayout";
import { syncApprovalCreate } from "@/lib/supabase-sync";
import { api } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/auth-state";

const stateColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  superseded: "bg-amber-100 text-amber-800",
};

const stateIcons: Record<string, typeof CheckCircle> = {
  draft: Clock,
  submitted: Eye,
  approved: CheckCircle,
  rejected: XCircle,
  superseded: AlertTriangle,
};

export default function Quotes() {
  const { data: quotes, loading: qLoading } = useQuotes();
  const { data: workspaces, loading: wsLoading } = useWorkspaces();
  const { data: customers, loading: custLoading } = useCustomers();
  const [editingQuote, setEditingQuote] = useState<{ customerName: string; customerId: string; quoteId: string; workspaceId: string; existingInstanceId?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { checkGate, lastEvaluation, showOverrideDialog, executeOverride, cancelOverride } = useGateCheck();
  const { logAction, logApproval } = useAuditLog();

  if (qLoading || wsLoading || custLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  const filteredQuotes = quotes.filter(q => {
    const ws = workspaces.find(w => w.id === q.workspaceId);
    const name = ws?.customerName || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || q.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Governance-enforced create
  const handleNewQuote = () => {
    checkGate("pg1", {
      entityType: "quote",
      entityId: "new",
      workspaceId: "",
      details: "Creating new quote — checking commercial approval gate",
      contextData: { action: "create_quote" },
    }, () => {
      logAction("quote", "new", "quote_create_initiated", "New quote creation initiated");
      setEditingQuote({ customerName: "", customerId: "", quoteId: "new", workspaceId: "", existingInstanceId: undefined });
    });
  };

  // Governance-enforced approve — 2C: resolve workspaceId from quote's parent workspace
  const handleApproveQuote = (quoteId: string, gpPercent: number, palletVolume: number) => {
    // Resolve workspace from quote
    const quote = quotes.find(q => q.id === quoteId);
    const resolvedWsId = quote?.workspaceId || "";
    checkGate("pg1", {
      entityType: "quote",
      entityId: quoteId,
      workspaceId: resolvedWsId,
      details: `Approving quote — GP% ${gpPercent.toFixed(1)}%, ${palletVolume} pallets`,
      contextData: { gpPercent, palletVolume, action: "approve_quote" },
    }, () => {
      const user = getCurrentUser();
      void api.quotes.approve(quoteId).then(() => {
        logApproval("quote", quoteId, "approved", `Quote ${quoteId} approved — GP% ${gpPercent.toFixed(1)}%`, { gpPercent, palletVolume });
        void syncApprovalCreate({
          id: `a-${crypto.randomUUID()}`,
          entityType: "quote",
          entityId: quoteId,
          workspaceId: resolvedWsId,
          approverRole: user.role,
          approverName: user.name,
          decision: "approved",
          reason: `GP% ${gpPercent.toFixed(1)}%, ${palletVolume} pallets`,
          isOverride: false,
        });
        toast.success("Quote approved", { description: `GP% ${gpPercent.toFixed(1)}% — logged to audit trail` });
      }).catch((e: any) => {
        toast.error(e.message || "Approval failed");
      });
    });
  };

  // If editing a quote, show the unified Document Composer
  if (editingQuote) {
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <DocumentComposer
          documentType="quote"
          customerId={editingQuote.customerId}
          customerName={editingQuote.customerName}
          workspaceId={editingQuote.workspaceId}
          existingInstanceId={editingQuote.existingInstanceId}
          onBack={() => setEditingQuote(null)}
          backLabel="Back to Quotes"
          onSave={(doc: ComposerDocument) => {
            logAction("quote", doc.id, "quote_saved", `Quote "${doc.title}" saved — v${doc.version}`, { version: doc.version });
            toast.success(`Quote saved — ${doc.title}`);
          }}
          onExportPDF={(doc: ComposerDocument) => {
            logAction("quote", doc.id, "quote_pdf_exported", `Quote "${doc.title}" PDF exported`, { version: doc.version });
            toast.success("Quote PDF export initiated");
          }}
        />
      </div>
    );
  }

  // Summary stats
  const draftCount = quotes.filter(q => q.state === "draft").length;
  const approvedCount = quotes.filter(q => q.state === "approved").length;
  const avgGP = quotes.length > 0 ? quotes.reduce((s, q) => s + q.gpPercent, 0) / quotes.length : 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Legacy Banner */}
      {navigationV1 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <span className="text-xs text-amber-800">This page is read-only legacy. To create or edit quotes, use <a href="/workspaces" className="underline font-semibold hover:text-amber-900">Workspaces</a>.</span>
        </div>
      )}
      {/* Override Dialog */}
      <OverrideDialog
        open={showOverrideDialog}
        gateName={lastEvaluation?.gateName || ""}
        details={lastEvaluation?.details || ""}
        onOverride={executeOverride}
        onCancel={cancelOverride}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Quotes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotes.length} quotes across all workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleNewQuote} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
            <Plus className="w-4 h-4 mr-1.5" /> New Quote
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Quotes", value: quotes.length, color: "text-[#1B2A4A]", bg: "bg-blue-50" },
          { label: "Drafts", value: draftCount, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Approved", value: approvedCount, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Avg GP%", value: formatPercent(avgGP), color: avgGP >= 22 ? "text-emerald-700" : avgGP >= 10 ? "text-amber-700" : "text-red-700", bg: avgGP >= 22 ? "bg-emerald-50" : avgGP >= 10 ? "bg-amber-50" : "bg-red-50" },
        ].map(stat => (
          <Card key={stat.label} className={`border border-gray-200 ${stat.bg}`}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
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
          const customer = customers.find(c => c.name === customerName);
          const ecrScore = customer ? getEcrScoreByCustomerName(customer.name) : undefined;
          const StateIcon = stateIcons[q.state] || Clock;
          const gpColor = q.gpPercent >= 30 ? "text-emerald-700" : q.gpPercent >= 22 ? "text-emerald-600" : q.gpPercent >= 10 ? "text-amber-700" : "text-red-700";

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
                      {customer && <span className="text-xs text-gray-400 ml-1.5">({customer.code})</span>}
                      <span className="text-xs text-gray-400 ml-2">Quote v{q.version}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${stateColors[q.state] || ""}`}>
                      <StateIcon size={10} className="mr-1" /> {q.state}
                    </Badge>
                    {customer && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                        Grade {customer.grade}
                      </Badge>
                    )}
                    {ecrScore && (
                      <Badge variant="outline" className={`text-[10px] ${getGradeBg(ecrScore.grade)}`}>
                        <Star size={10} className="mr-1" /> ECR {ecrScore.grade} · {ecrScore.totalScore.toFixed(1)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {q.state === "submitted" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleApproveQuote(q.id, q.gpPercent, q.palletVolume)}>
                        <CheckCircle size={12} className="mr-1" /> Approve
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={async () => {
                        logAction("quote", q.id, "quote_edit_opened", `Quote ${q.id} opened for editing`);
                        try {
                          const instance = await resolveOrCreateDocInstanceAsync({
                            doc_type: "quote",
                            linked_entity_type: "quote_version",
                            linked_entity_id: q.id,
                            customer_id: customer?.id || "",
                            customer_name: customerName,
                            workspace_id: q.workspaceId,
                            workspace_name: ws?.title,
                          });
                          setEditingQuote({
                            customerName,
                            customerId: customer?.id || "",
                            quoteId: q.id,
                            workspaceId: q.workspaceId,
                            existingInstanceId: instance.id,
                          });
                        } catch (err) {
                          console.warn('[Quotes] resolveOrCreateDocInstance fallback:', err);
                          setEditingQuote({
                            customerName,
                            customerId: customer?.id || "",
                            quoteId: q.id,
                            workspaceId: q.workspaceId,
                          });
                        }
                      }}>
                      <Edit size={12} className="mr-1" /> Edit in Composer
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        logAction("quote", q.id, "quote_pdf_exported", `Quote ${q.id} PDF exported`);
                        toast.success("PDF export initiated");
                      }}>
                      <Download size={12} className="mr-1" /> PDF
                    </Button>
                    <span className="text-xs text-gray-400 ml-2">{q.createdAt}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                  {[
                    { l: "Storage Rate", v: `SAR ${q.storageRate}/plt/day` },
                    { l: "Pallets", v: q.palletVolume.toLocaleString() },
                    { l: "Monthly Rev", v: formatSAR(q.monthlyRevenue) },
                    { l: "Annual Rev", v: formatSAR(q.annualRevenue) },
                    { l: "GP%", v: <span className={`font-bold ${gpColor}`}>{formatPercent(q.gpPercent)}</span> },
                    { l: "ECR Score", v: ecrScore ? <span className={`font-bold ${ecrScore.grade === 'A' ? 'text-emerald-700' : ecrScore.grade === 'B' ? 'text-blue-700' : ecrScore.grade === 'C' ? 'text-amber-700' : 'text-red-700'}`}>{ecrScore.totalScore.toFixed(1)} ({ecrScore.grade})</span> : <span className="text-gray-400">—</span> },
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
