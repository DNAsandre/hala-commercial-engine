/*
 * SLAs Shell — Service Level Agreements management with editor integration
 * Design: Swiss Precision — deep navy, IBM Plex Sans
 */

import { useState } from "react";
import { FileSignature, Plus, ArrowLeft, Edit, Download, Search, Filter, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import CommercialEditor, { type EditorDocument } from "@/components/CommercialEditor";

interface SLARecord {
  id: string;
  customerName: string;
  title: string;
  status: "active" | "draft" | "expired" | "under_review";
  version: number;
  effectiveDate: string;
  expiryDate: string;
  kpis: { name: string; target: string; actual: string; status: "met" | "warning" | "breach" }[];
  lastReview: string;
  nextReview: string;
}

const mockSLAs: SLARecord[] = [
  {
    id: "sla1", customerName: "SABIC", title: "SABIC Jubail Warehousing SLA",
    status: "active", version: 2, effectiveDate: "2024-06-01", expiryDate: "2026-05-31",
    kpis: [
      { name: "Receiving Accuracy", target: "99.5%", actual: "99.7%", status: "met" },
      { name: "Order Accuracy", target: "99.8%", actual: "99.6%", status: "warning" },
      { name: "On-Time Dispatch", target: "98%", actual: "97.2%", status: "warning" },
      { name: "Inventory Accuracy", target: "99.9%", actual: "99.95%", status: "met" },
      { name: "Damage Rate", target: "<0.1%", actual: "0.05%", status: "met" },
    ],
    lastReview: "2025-01-15", nextReview: "2025-04-15",
  },
  {
    id: "sla2", customerName: "Almarai", title: "Almarai Cold Chain SLA — Eastern Region",
    status: "active", version: 3, effectiveDate: "2024-01-01", expiryDate: "2025-12-31",
    kpis: [
      { name: "Receiving Accuracy", target: "99.5%", actual: "99.8%", status: "met" },
      { name: "Order Accuracy", target: "99.8%", actual: "99.9%", status: "met" },
      { name: "On-Time Dispatch", target: "98%", actual: "98.5%", status: "met" },
      { name: "Temperature Compliance", target: "100%", actual: "99.8%", status: "warning" },
    ],
    lastReview: "2025-01-20", nextReview: "2025-04-20",
  },
  {
    id: "sla3", customerName: "Maaden", title: "Maaden Distribution SLA",
    status: "draft", version: 1, effectiveDate: "2025-03-01", expiryDate: "2027-02-28",
    kpis: [
      { name: "Receiving Accuracy", target: "99.5%", actual: "-", status: "met" },
      { name: "Order Accuracy", target: "99.8%", actual: "-", status: "met" },
      { name: "On-Time Dispatch", target: "98%", actual: "-", status: "met" },
    ],
    lastReview: "-", nextReview: "2025-06-01",
  },
  {
    id: "sla4", customerName: "NADEC", title: "NADEC Warehousing SLA",
    status: "under_review", version: 2, effectiveDate: "2023-07-01", expiryDate: "2025-06-30",
    kpis: [
      { name: "Receiving Accuracy", target: "99.5%", actual: "98.9%", status: "breach" },
      { name: "Order Accuracy", target: "99.8%", actual: "99.5%", status: "warning" },
      { name: "On-Time Dispatch", target: "98%", actual: "96.1%", status: "breach" },
      { name: "Inventory Accuracy", target: "99.9%", actual: "99.7%", status: "warning" },
    ],
    lastReview: "2025-02-01", nextReview: "2025-05-01",
  },
  {
    id: "sla5", customerName: "Aramco", title: "Aramco Logistics SLA",
    status: "expired", version: 1, effectiveDate: "2023-01-01", expiryDate: "2024-12-31",
    kpis: [
      { name: "Receiving Accuracy", target: "99.5%", actual: "99.6%", status: "met" },
      { name: "Order Accuracy", target: "99.8%", actual: "99.8%", status: "met" },
    ],
    lastReview: "2024-10-15", nextReview: "-",
  },
];

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
};

export default function SLAs() {
  const [editingSLA, setEditingSLA] = useState<{ customerName: string; slaId: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSLAs = mockSLAs.filter(s =>
    s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If editing an SLA, show the full editor
  if (editingSLA) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
          <Button variant="ghost" size="sm" onClick={() => setEditingSLA(null)} className="text-xs">
            <ArrowLeft size={14} className="mr-1" /> Back to SLAs
          </Button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-600">Editing SLA for <strong>{editingSLA.customerName}</strong></span>
        </div>
        <div className="flex-1">
          <CommercialEditor
            documentType="sla"
            customerName={editingSLA.customerName}
            onSave={(doc: EditorDocument) => {
              toast.success(`SLA saved — ${doc.title}`);
            }}
            onExportPDF={() => {
              toast.success("SLA PDF export initiated");
            }}
          />
        </div>
      </div>
    );
  }

  // Summary stats
  const activeSLAs = mockSLAs.filter(s => s.status === "active").length;
  const breachCount = mockSLAs.flatMap(s => s.kpis).filter(k => k.status === "breach").length;
  const warningCount = mockSLAs.flatMap(s => s.kpis).filter(k => k.status === "warning").length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#1B2A4A]">Service Level Agreements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{mockSLAs.length} SLAs across all customers</p>
        </div>
        <Button onClick={() => setEditingSLA({ customerName: "", slaId: "new" })} className="bg-[#1B2A4A] hover:bg-[#2A3F6A]">
          <Plus className="w-4 h-4 mr-1.5" /> New SLA
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active SLAs", value: activeSLAs, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "KPI Breaches", value: breachCount, color: "text-red-700", bg: "bg-red-50" },
          { label: "KPI Warnings", value: warningCount, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Next Review", value: "Apr 15", color: "text-blue-700", bg: "bg-blue-50" },
        ].map(stat => (
          <Card key={stat.label} className="border border-gray-200">
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
                      <span className="text-xs text-gray-400 ml-2">v{sla.version}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                      <StatusIcon size={10} className="mr-1" /> {sc.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => setEditingSLA({ customerName: sla.customerName, slaId: sla.id })}>
                      <Edit size={12} className="mr-1" /> Edit in Editor
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => toast.success("SLA PDF export initiated")}>
                      <Download size={12} className="mr-1" /> PDF
                    </Button>
                  </div>
                </div>

                {/* KPI Performance */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {sla.kpis.map(kpi => (
                    <div key={kpi.name} className={`px-2.5 py-1.5 rounded text-xs ${kpiStatusColors[kpi.status]}`}>
                      <span className="font-medium">{kpi.name}:</span> {kpi.actual} / {kpi.target}
                    </div>
                  ))}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Effective: {sla.effectiveDate}</span>
                  <span className="text-gray-300">·</span>
                  <span>Expires: {sla.expiryDate}</span>
                  <span className="text-gray-300">·</span>
                  <span>Last Review: {sla.lastReview}</span>
                  <span className="text-gray-300">·</span>
                  <span>Next Review: {sla.nextReview}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
