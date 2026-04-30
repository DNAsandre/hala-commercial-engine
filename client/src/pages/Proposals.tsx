/*
 * Proposals Shell — Governance-enforced proposal management with editor integration
 * Gate checks on: create, approve, submit to CRM
 * Audit logging on: all write actions
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Plus, ArrowLeft, Edit, Download, Send, Search, Filter, Shield, CheckCircle, XCircle, Clock, AlertTriangle, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSAR } from "@/lib/store";
import { useProposals, useWorkspaces, useCustomers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import { resolveOrCreateDocInstanceAsync } from "@/hooks/useResolveDocInstance";
import { getEcrScoreByCustomerName, getGradeBg, type EcrScore } from "@/lib/ecr";
import { Star } from "lucide-react";
import { toast } from "sonner";
import DocumentComposer, { type ComposerDocument } from "@/components/DocumentComposer";
import OverrideDialog from "@/components/OverrideDialog";
import { useGateCheck, useAuditLog } from "@/hooks/useGovernance";
import { navigationV1 } from "@/components/DashboardLayout";
import { syncProposalUpdate, syncApprovalCreate, syncAuditEntry } from "@/lib/supabase-sync";
import { getCurrentUser } from "@/lib/auth-state";

const stateColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready_for_crm: "bg-blue-100 text-blue-800",
  sent: "bg-indigo-100 text-indigo-800",
  negotiation_active: "bg-amber-100 text-amber-800",
  commercial_approved: "bg-emerald-100 text-emerald-800",
};

const stateIcons: Record<string, typeof CheckCircle> = {
  draft: Clock,
  ready_for_crm: Eye,
  sent: Send,
  negotiation_active: AlertTriangle,
  commercial_approved: CheckCircle,
};

export default function Proposals() {
  const [, navigate] = useLocation();
  const { data: proposals, loading: propLoading } = useProposals();
  const { data: workspaces, loading: wsLoading } = useWorkspaces();
  const { data: customers, loading: custLoading } = useCustomers();
  const [editingProposal, setEditingProposal] = useState<{ customerName: string; customerId: string; proposalId: string; workspaceId: string; existingInstanceId?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { checkGate, lastEvaluation, showOverrideDialog, executeOverride, cancelOverride } = useGateCheck();
  const { logAction, logApproval } = useAuditLog();

  if (propLoading || wsLoading || custLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  const filteredProposals = proposals.filter(p => {
    const ws = workspaces.find(w => w.id === p.workspaceId);
    const name = ws?.customerName || "";
    return p.title.toLowerCase().includes(searchTerm.toLowerCase()) || name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Governance-enforced create
  const handleNewProposal = () => {
    checkGate("pg1", {
      entityType: "proposal",
      entityId: "new",
      workspaceId: "",
      details: "Creating new proposal — checking commercial approval gate",
      contextData: { action: "create_proposal" },
    }, () => {
      logAction("proposal", "new", "proposal_create_initiated", "New proposal creation initiated");
      setEditingProposal({ customerName: "", customerId: "", proposalId: "new", workspaceId: "", existingInstanceId: undefined });
    });
  };

  // Governance-enforced approve
  const handleApproveProposal = (proposalId: string, title: string) => {
    checkGate("pg1", {
      entityType: "proposal",
      entityId: proposalId,
      workspaceId: "",
      details: `Approving proposal "${title}" — checking commercial approval gate`,
      contextData: { action: "approve_proposal" },
    }, () => {
      logApproval("proposal", proposalId, "approved", `Proposal "${title}" approved`, {});
      // Persist approval to Supabase
      const user = getCurrentUser();
      void syncProposalUpdate(proposalId, { state: "commercial_approved" });
      void syncApprovalCreate({
        id: `a-${crypto.randomUUID()}`,
        entityType: "proposal",
        entityId: proposalId,
        workspaceId: "",
        approverRole: user.role,
        approverName: user.name,
        decision: "approved",
        reason: `Proposal "${title}" approved`,
        isOverride: false,
      });
      toast.success("Proposal approved", { description: "Logged to governance audit trail" });
    });
  };

  // Governance-enforced CRM export
  const handleCRMExport = (proposalId: string, title: string) => {
    checkGate("pg1", {
      entityType: "proposal",
      entityId: proposalId,
      workspaceId: "",
      details: `Exporting proposal "${title}" to CRM — checking export gate`,
      contextData: { action: "crm_export" },
    }, () => {
      logAction("proposal", proposalId, "proposal_crm_exported", `Proposal "${title}" exported to CRM`);
      // Persist CRM export status to Supabase
      void syncProposalUpdate(proposalId, { state: "sent" });
      void syncAuditEntry({
        id: `audit-crm-${crypto.randomUUID()}`,
        entityType: "proposal",
        entityId: proposalId,
        action: "proposal_crm_exported",
        userId: getCurrentUser().id,
        userName: getCurrentUser().name,
        details: `Proposal "${title}" exported to CRM`,
      });
      toast.success("Proposal exported to CRM", { description: "PDF attached to Zoho deal record" });
    });
  };

  // If editing a proposal, show the unified Document Composer
  if (editingProposal) {
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <DocumentComposer
          documentType="proposal"
          customerId={editingProposal.customerId}
          customerName={editingProposal.customerName}
          workspaceId={editingProposal.workspaceId}
          existingInstanceId={editingProposal.existingInstanceId}
          onBack={() => setEditingProposal(null)}
          backLabel="Back to Proposals"
          onSave={(doc: ComposerDocument) => {
            logAction("proposal", doc.id, "proposal_saved", `Proposal "${doc.title}" saved — v${doc.version}`, { version: doc.version });
            toast.success(`Proposal saved — ${doc.title}`);
          }}
          onExportPDF={(doc: ComposerDocument) => {
            logAction("proposal", doc.id, "proposal_pdf_exported", `Proposal "${doc.title}" PDF exported`, { version: doc.version });
            toast.success("Proposal PDF export initiated");
          }}
        />
      </div>
    );
  }

  // Summary stats
  const draftCount = proposals.filter(p => p.state === "draft").length;
  const approvedCount = proposals.filter(p => p.state === "commercial_approved").length;
  const sentCount = proposals.filter(p => p.state === "sent").length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Legacy Banner */}
      {navigationV1 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-center gap-2">
          <span className="text-xs text-amber-800">This page is legacy. Please access documents via <a href="/workspaces" className="underline font-semibold hover:text-amber-900">Workspace</a>.</span>
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
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Proposals</h1>
          <p className="text-sm text-gray-500 mt-0.5">{proposals.length} proposals across all workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => toast("Batch PDF export coming soon")}>
            <Download className="w-4 h-4 mr-1.5" /> Export All
          </Button>
          <Button onClick={handleNewProposal} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
            <Plus className="w-4 h-4 mr-1.5" /> New Proposal
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Proposals", value: proposals.length, color: "text-[#1B2A4A]", bg: "bg-blue-50" },
          { label: "Drafts", value: draftCount, color: "text-gray-700", bg: "bg-gray-50" },
          { label: "Approved", value: approvedCount, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Sent to Client", value: sentCount, color: "text-indigo-700", bg: "bg-indigo-50" },
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
          const customer = customers.find(c => c.name === customerName);
          const ecrScore = customer ? getEcrScoreByCustomerName(customer.name) : undefined;
          const StateIcon = stateIcons[p.state] || Clock;

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
                      {customer && <span className="text-xs text-gray-400 ml-1.5">({customer.code})</span>}
                      <span className="text-xs text-gray-400 ml-2">v{p.version}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${stateColors[p.state] || ""}`}>
                      <StateIcon size={10} className="mr-1" /> {p.state.replace(/_/g, " ")}
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
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700 hover:bg-blue-50"
                      onClick={() => navigate(`/proposals/${p.id}`)}>
                      <Eye size={12} className="mr-1" /> View Detail
                    </Button>
                    {p.state === "draft" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleApproveProposal(p.id, p.title)}>
                        <CheckCircle size={12} className="mr-1" /> Approve
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={async () => {
                        logAction("proposal", p.id, "proposal_edit_opened", `Proposal "${p.title}" opened for editing`);
                        try {
                          const instance = await resolveOrCreateDocInstanceAsync({
                            doc_type: "proposal",
                            linked_entity_type: "proposal_version",
                            linked_entity_id: p.id,
                            customer_id: customer?.id || "",
                            customer_name: customerName,
                            workspace_id: p.workspaceId,
                            workspace_name: ws?.title,
                          });
                          setEditingProposal({
                            customerName,
                            customerId: customer?.id || "",
                            proposalId: p.id,
                            workspaceId: p.workspaceId,
                            existingInstanceId: instance.id,
                          });
                        } catch (err) {
                          console.warn('[Proposals] resolveOrCreateDocInstance fallback:', err);
                          setEditingProposal({
                            customerName,
                            customerId: customer?.id || "",
                            proposalId: p.id,
                            workspaceId: p.workspaceId,
                          });
                        }
                      }}>
                      <Edit size={12} className="mr-1" /> Edit in Composer
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        logAction("proposal", p.id, "proposal_pdf_exported", `Proposal "${p.title}" PDF exported`);
                        toast.success("PDF generation triggered");
                      }}>
                      <Download size={12} className="mr-1" /> PDF
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => handleCRMExport(p.id, p.title)}>
                      <Send size={12} className="mr-1" /> CRM
                    </Button>
                    <span className="text-xs text-gray-400 ml-2">{p.createdAt}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">{p.sections.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                <div className="flex items-center gap-4 mt-2">
                  {ws && <p className="text-xs text-gray-500">Workspace: {ws.customerName} — {ws.title}</p>}
                  {ecrScore && (
                    <p className="text-xs text-gray-500">ECR: <span className={`font-semibold ${ecrScore.grade === 'A' ? 'text-emerald-700' : ecrScore.grade === 'B' ? 'text-blue-700' : ecrScore.grade === 'C' ? 'text-amber-700' : 'text-red-700'}`}>{ecrScore.totalScore.toFixed(1)} ({ecrScore.grade})</span> · Confidence: {ecrScore.confidenceScore}%</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
