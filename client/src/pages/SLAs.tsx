/*
 * SLAs Shell — Governance-enforced Service Level Agreement management
 * Gate checks on: create, approve, activate
 * Audit logging on: all write actions
 * KPI monitoring with breach/warning alerts
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { FileSignature, Plus, ArrowLeft, Edit, Download, Search, Filter, Shield, AlertTriangle, CheckCircle, Clock, XCircle, BarChart3, Calendar, Eye, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomers } from "@/hooks/useSupabase";
import { resolveOrCreateDocInstanceAsync } from "@/hooks/useResolveDocInstance";
import { toast } from "sonner";
import DocumentComposer, { type ComposerDocument } from "@/components/DocumentComposer";
import OverrideDialog from "@/components/OverrideDialog";
import { useGateCheck, useAuditLog } from "@/hooks/useGovernance";
import { navigationV1 } from "@/components/DashboardLayout";
import { api } from "@/lib/api-client";

export interface SLARecord {
  id: string;
  customerName: string;
  customerId: string;
  title: string;
  status: "active" | "draft" | "expired" | "under_review";
  version: number;
  effectiveDate: string;
  expiryDate: string;
  kpis: { name: string; target: string; actual: string; status: "met" | "warning" | "breach" | "pending" }[];
  lastReview: string;
  nextReview: string;
}

// Legacy export kept for type compatibility
export const mockSLAs: SLARecord[] = [];

/** Map a DB SLA row into the frontend SLARecord shape */
function mapDbSla(row: any, customerName?: string): SLARecord {
  const kpiRows: any[] = Array.isArray(row.kpi_rows) ? row.kpi_rows : [];
  const kpis = kpiRows.map((k: any) => ({
    name: k.name || '',
    target: k.target || '',
    actual: k.actual || '-',
    status: (k.status || computeKPIStatusRaw(k.target, k.actual || '-')) as any,
  }));
  return {
    id: row.id,
    customerName: customerName || row.customer_name || row.customer_id || '',
    customerId: row.customer_id || '',
    title: row.title || row.sla_number || '',
    status: row.status === 'approved' ? 'active' : (row.status === 'superseded' ? 'expired' : row.status) as any,
    version: row.version_number || 1,
    effectiveDate: row.effective_date || '-',
    expiryDate: row.review_date || '-',
    kpis,
    lastReview: '-',
    nextReview: row.review_date || '-',
  };
}

function computeKPIStatusRaw(target: string, actual: string): string {
  if (!actual || actual === '-') return 'pending';
  const tMatch = target.match(/([\d.]+)%/);
  const aMatch = actual.match(/([\d.]+)%/);
  if (tMatch && aMatch) {
    const t = parseFloat(tMatch[1]);
    const a = parseFloat(aMatch[1]);
    if (a >= t) return 'met';
    if (a >= t - 1.0) return 'warning';
    return 'breach';
  }
  return 'met';
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  active: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle, label: "Active" },
  draft: { color: "bg-gray-100 text-gray-700", icon: Clock, label: "Draft" },
  expired: { color: "bg-red-100 text-red-700", icon: XCircle, label: "Expired" },
  under_review: { color: "bg-amber-100 text-amber-700", icon: AlertTriangle, label: "Under Review" },
};

const kpiStatusColors: Record<string, string> = {
  met: "text-emerald-600 bg-emerald-50",
  warning: "text-amber-600 bg-amber-50",
  breach: "text-red-600 bg-red-50",
  pending: "text-slate-500 bg-slate-50",
};

// 3C: Auto-compute KPI status from target vs actual values
function computeKPIStatus(target: string, actual: string): "met" | "warning" | "breach" | "pending" {
  // 3B: No actual data means pending
  if (!actual || actual === "-" || actual === "N/A") return "pending";
  // Parse percentage values
  const targetMatch = target.match(/([\d.]+)%/);
  const actualMatch = actual.match(/([\d.]+)%/);
  if (targetMatch && actualMatch) {
    const t = parseFloat(targetMatch[1]);
    const a = parseFloat(actualMatch[1]);
    const isLessBetter = target.startsWith("<") || target.startsWith("≤") || target.startsWith("<=");
    if (isLessBetter) {
      if (a <= t) return "met";
      if (a <= t * 1.5) return "warning";
      return "breach";
    } else {
      if (a >= t) return "met";
      if (a >= t - 1.0) return "warning";
      return "breach";
    }
  }
  // Non-percentage targets — return the static status as fallback
  return "met";
}

export default function SLAs() {
  const [, navigate] = useLocation();
  const { data: customers } = useCustomers();
  const [editingSLA, setEditingSLA] = useState<{ customerName: string; customerId: string; slaId: string; existingInstanceId?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { checkGate, lastEvaluation, showOverrideDialog, executeOverride, cancelOverride } = useGateCheck();
  const { logAction, logApproval } = useAuditLog();
  const [slaRecords, setSlaRecords] = useState<SLARecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all SLAs via global endpoint
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.slas.listAll();
        const rows = res?.data || res || [];
        if (Array.isArray(rows) && !cancelled) {
          setSlaRecords(rows.map(row => {
            const cust = customers.find(c => c.id === row.customer_id);
            return mapDbSla(row, cust?.name);
          }));
        }
      } catch { /* fallback: empty */ }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [customers]);

  const filteredSLAs = slaRecords.filter(s =>
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Governance-enforced create
  const handleNewSLA = () => {
    checkGate("pg1", {
      entityType: "sla",
      entityId: "new",
      workspaceId: "",
      details: "Creating new SLA — checking commercial approval gate",
      contextData: { action: "create_sla" },
    }, () => {
      logAction("sla", "new", "sla_create_initiated", "New SLA creation initiated");
      setEditingSLA({ customerName: "", customerId: "", slaId: "new", existingInstanceId: undefined });
    });
  };

  // Governance-enforced activate
  const handleActivateSLA = (sla: SLARecord) => {
    checkGate("pg1", {
      entityType: "sla",
      entityId: sla.id,
      workspaceId: "",
      details: `Activating SLA "${sla.title}" — checking activation gate`,
      contextData: { action: "activate_sla", customerName: sla.customerName },
    }, () => {
      logApproval("sla", sla.id, "activated", `SLA "${sla.title}" activated`, { customerName: sla.customerName });
      toast.success("SLA activated", { description: `${sla.title} — logged to governance audit trail` });
    });
  };

  // If editing an SLA, show the unified Document Composer
  if (editingSLA) {
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <DocumentComposer
          documentType="sla"
          customerId={editingSLA.customerId}
          customerName={editingSLA.customerName}
          existingInstanceId={editingSLA.existingInstanceId}
          onBack={() => setEditingSLA(null)}
          backLabel="Back to SLAs"
          onSave={(doc: ComposerDocument) => {
            logAction("sla", doc.id, "sla_saved", `SLA "${doc.title}" saved — v${doc.version}`, { version: doc.version });
            toast.success(`SLA saved — ${doc.title}`);
          }}
          onExportPDF={(doc: ComposerDocument) => {
            logAction("sla", doc.id, "sla_pdf_exported", `SLA "${doc.title}" PDF exported`, { version: doc.version });
            toast.success("SLA PDF export initiated");
          }}
        />
      </div>
    );
  }

  // Summary stats
  const activeSLAs = slaRecords.filter(s => s.status === "active").length;
  const breachCount = slaRecords.flatMap(s => s.kpis).filter(k => k.status === "breach").length;
  const warningCount = slaRecords.flatMap(s => s.kpis).filter(k => k.status === "warning").length;
  const upcomingReviews = slaRecords.filter(s => s.nextReview !== "-" && new Date(s.nextReview) <= new Date(Date.now() + 90 * 86400000)).length;

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

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
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Service Level Agreements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{slaRecords.length} SLAs across all customers</p>
        </div>
        <Button onClick={handleNewSLA} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
          <Plus className="w-4 h-4 mr-1.5" /> New SLA
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active SLAs", value: activeSLAs, color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle },
          { label: "KPI Breaches", value: breachCount, color: "text-red-700", bg: "bg-red-50", icon: XCircle },
          { label: "KPI Warnings", value: warningCount, color: "text-amber-700", bg: "bg-amber-50", icon: AlertTriangle },
          { label: "Reviews Due", value: upcomingReviews, color: "text-blue-700", bg: "bg-blue-50", icon: Calendar },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`border border-gray-200 ${stat.bg}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.color} opacity-30`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search SLAs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm" />
        </div>
        <Button variant="outline" size="sm" className="text-xs"><Filter size={14} className="mr-1" /> Filter</Button>
      </div>

      {/* SLAs List */}
      <div className="space-y-3">
        {filteredSLAs.map(sla => {
          const sc = statusConfig[sla.status];
          const StatusIcon = sc.icon;
          const customer = customers.find(c => c.name === sla.customerName);

          return (
            <Card key={sla.id} className="border border-gray-200 shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-purple-50">
                      <FileSignature className="w-4 h-4 text-purple-700" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-[#1B2A4A]">{sla.title}</span>
                      {customer && <span className="text-xs text-gray-400 ml-1.5">({customer.code})</span>}
                      <span className="text-xs text-gray-400 ml-2">v{sla.version}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                      <StatusIcon size={10} className="mr-1" /> {sc.label}
                    </Badge>
                    {customer && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                        Grade {customer.grade}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700 hover:bg-blue-50"
                      onClick={() => navigate(`/slas/${sla.id}`)}>
                      <Eye size={12} className="mr-1" /> View Detail
                    </Button>
                    {sla.status === "draft" && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleActivateSLA(sla)}>
                        <CheckCircle size={12} className="mr-1" /> Activate
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={async () => {
                        logAction("sla", sla.id, "sla_edit_opened", `SLA "${sla.title}" opened for editing`);
                        try {
                          const instance = await resolveOrCreateDocInstanceAsync({
                            doc_type: "sla",
                            linked_entity_type: "sla_version",
                            linked_entity_id: sla.id,
                            customer_id: sla.customerId,
                            customer_name: sla.customerName,
                          });
                          setEditingSLA({ customerName: sla.customerName, customerId: sla.customerId, slaId: sla.id, existingInstanceId: instance.id });
                        } catch (err) {
                          console.warn('[SLAs] resolveOrCreateDocInstance fallback:', err);
                          setEditingSLA({ customerName: sla.customerName, customerId: sla.customerId, slaId: sla.id });
                        }
                      }}>
                      <Edit size={12} className="mr-1" /> Edit in Composer
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => {
                        logAction("sla", sla.id, "sla_pdf_exported", `SLA "${sla.title}" PDF exported`);
                        toast.success("SLA PDF export initiated");
                      }}>
                      <Download size={12} className="mr-1" /> PDF
                    </Button>
                  </div>
                </div>

                {/* KPI Performance Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
                  {sla.kpis.map(kpi => (
                    <div key={kpi.name} className={`px-2.5 py-2 rounded border ${kpiStatusColors[kpi.status]} border-current/10`}>
                      <p className="text-[10px] font-medium opacity-80">{kpi.name}</p>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-sm font-bold">{kpi.actual}</span>
                        <span className="text-[10px] opacity-60">/ {kpi.target}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Effective: {sla.effectiveDate}</span>
                  <span className="text-gray-300">·</span>
                  <span className={sla.status === "expired" ? "text-red-600 font-medium" : ""}>Expires: {sla.expiryDate}</span>
                  <span className="text-gray-300">·</span>
                  <span>Last Review: {sla.lastReview}</span>
                  <span className="text-gray-300">·</span>
                  <span className={sla.nextReview !== "-" && new Date(sla.nextReview) <= new Date("2025-05-01") ? "text-amber-600 font-medium" : ""}>
                    Next Review: {sla.nextReview}
                  </span>
                  {customer && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{customer.region} — {customer.industry}</span>
                    </>
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
