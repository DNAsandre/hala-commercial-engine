import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Plus, ChevronRight, Search, Gavel, Briefcase, RotateCcw,
  AlertTriangle, Clock, TrendingDown, DollarSign, Target,
  ShieldCheck, Calendar, Users, MapPin, Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatSAR, formatPercent,
  WORKSPACE_STAGES, TENDER_WORKSPACE_STAGES,
  getWorkspaceType, getWorkspaceTypeLabel, getWorkspaceTypeBadgeColor,
  getEffectiveStageLabel, getEffectiveStageColor,
  customers,
  type WorkspaceType, type Workspace,
} from "@/lib/store";
import { useWorkspaces, useSignals } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";

// ─── Operating Mode Types ──────────────────────────────────────
type OperatingMode = "tenders" | "commercial" | "renewals";

// ─── Mode Definitions ──────────────────────────────────────────
const MODES: { key: OperatingMode; label: string; icon: typeof Gavel; color: string; activeColor: string }[] = [
  { key: "tenders",    label: "Tenders",    icon: Gavel,     color: "text-violet-600",  activeColor: "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-200" },
  { key: "commercial", label: "Commercial", icon: Briefcase, color: "text-blue-600",    activeColor: "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" },
  { key: "renewals",   label: "Renewals",   icon: RotateCcw, color: "text-amber-600",   activeColor: "bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-200" },
];

function getModeFromType(type: WorkspaceType): OperatingMode {
  if (type === "tender") return "tenders";
  if (type === "renewal") return "renewals";
  return "commercial";
}

export default function Workspaces() {
  const { data: workspaces, loading: wsLoading, refetch: refetchWorkspaces } = useWorkspaces();
  const { data: signals } = useSignals();
  const [, navigate] = useLocation();

  // Operating mode — default to commercial (sidebar handles mode routing)
  const [mode, setMode] = useState<OperatingMode>("commercial");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Mode-specific filters
  const [tenderStageFilter, setTenderStageFilter] = useState("all");
  const [tenderOwnerFilter, setTenderOwnerFilter] = useState("all");
  const [tenderRegionFilter, setTenderRegionFilter] = useState("all");
  const [commercialStageFilter, setCommercialStageFilter] = useState("all");
  const [commercialOwnerFilter, setCommercialOwnerFilter] = useState("all");
  const [commercialRegionFilter, setCommercialRegionFilter] = useState("all");
  const [renewalOwnerFilter, setRenewalOwnerFilter] = useState("all");
  const [renewalRegionFilter, setRenewalRegionFilter] = useState("all");
  const [renewalRagFilter, setRenewalRagFilter] = useState("all");

  if (wsLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  // ─── Segment data by operating mode ───────────────────────────
  const tenderWs = workspaces.filter(w => getWorkspaceType(w) === "tender");
  const commercialWs = workspaces.filter(w => getWorkspaceType(w) === "commercial");
  const renewalWs = workspaces.filter(w => getWorkspaceType(w) === "renewal");

  // ─── Active-mode workspaces ───────────────────────────────────
  const modeWorkspaces = mode === "tenders" ? tenderWs : mode === "commercial" ? commercialWs : renewalWs;

  // ─── Unique owners, regions ───────────────────────────────────
  const modeOwners = Array.from(new Set(modeWorkspaces.map(w => w.owner))).sort();
  const modeRegions = Array.from(new Set(modeWorkspaces.map(w => w.region))).sort();

  // ─── Apply mode-specific filters ──────────────────────────────
  let filtered = modeWorkspaces;

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(w =>
      w.customerName.toLowerCase().includes(q) ||
      w.title.toLowerCase().includes(q) ||
      w.owner.toLowerCase().includes(q)
    );
  }

  // Mode-specific filters
  if (mode === "tenders") {
    if (tenderStageFilter !== "all") filtered = filtered.filter(w => w.tenderStage === tenderStageFilter);
    if (tenderOwnerFilter !== "all") filtered = filtered.filter(w => w.owner === tenderOwnerFilter);
    if (tenderRegionFilter !== "all") filtered = filtered.filter(w => w.region === tenderRegionFilter);
  } else if (mode === "commercial") {
    if (commercialStageFilter !== "all") filtered = filtered.filter(w => w.stage === commercialStageFilter);
    if (commercialOwnerFilter !== "all") filtered = filtered.filter(w => w.owner === commercialOwnerFilter);
    if (commercialRegionFilter !== "all") filtered = filtered.filter(w => w.region === commercialRegionFilter);
  } else {
    if (renewalOwnerFilter !== "all") filtered = filtered.filter(w => w.owner === renewalOwnerFilter);
    if (renewalRegionFilter !== "all") filtered = filtered.filter(w => w.region === renewalRegionFilter);
    if (renewalRagFilter !== "all") filtered = filtered.filter(w => w.ragStatus === renewalRagFilter);
  }

  // ─── Summary Metrics ─────────────────────────────────────────
  function getTenderMetrics() {
    const active = tenderWs.filter(w => !["won", "lost", "withdrawn"].includes(w.tenderStage || ""));
    const totalValue = active.reduce((s, w) => s + w.estimatedValue, 0);
    const overdue = active.filter(w => w.submissionDeadline && new Date(w.submissionDeadline) < new Date()).length;
    const preparing = active.filter(w => ["draft", "in_preparation"].includes(w.tenderStage || "")).length;
    const submitted = active.filter(w => w.tenderStage === "submitted").length;
    return [
      { label: "Active Tenders", value: active.length.toString(), icon: Gavel, color: "text-violet-600" },
      { label: "Pipeline Value", value: formatSAR(totalValue), icon: DollarSign, color: "text-emerald-600" },
      { label: "Preparing", value: preparing.toString(), icon: Clock, color: "text-blue-600" },
      { label: "Submitted", value: submitted.toString(), icon: ShieldCheck, color: "text-cyan-600" },
      { label: "Overdue", value: overdue.toString(), icon: AlertTriangle, color: overdue > 0 ? "text-red-600" : "text-muted-foreground" },
    ];
  }

  function getCommercialMetrics() {
    const active = commercialWs.filter(w => w.stage !== "go_live");
    const totalValue = active.reduce((s, w) => s + w.estimatedValue, 0);
    const marginRisk = active.filter(w => w.gpPercent < 15).length;
    const stalled = active.filter(w => w.daysInStage > 14).length;
    const critical = active.filter(w => w.ragStatus === "red").length;
    return [
      { label: "Active Deals", value: active.length.toString(), icon: Briefcase, color: "text-blue-600" },
      { label: "Pipeline Value", value: formatSAR(totalValue), icon: DollarSign, color: "text-emerald-600" },
      { label: "Margin Risk", value: marginRisk.toString(), icon: TrendingDown, color: marginRisk > 0 ? "text-amber-600" : "text-muted-foreground" },
      { label: "Stalled", value: stalled.toString(), icon: Clock, color: stalled > 0 ? "text-amber-600" : "text-muted-foreground" },
      { label: "Critical", value: critical.toString(), icon: AlertTriangle, color: critical > 0 ? "text-red-600" : "text-muted-foreground" },
    ];
  }

  function getRenewalMetrics() {
    const now = new Date();
    const expiringSoon = renewalWs.filter(w => {
      // use workspace data to check contract expiry from linked customer
      const cust = customers.find(c => c.id === w.customerId);
      if (!cust) return false;
      const exp = new Date(cust.contractExpiry);
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000*60*60*24));
      return daysLeft > 0 && daysLeft <= 90;
    }).length;
    const totalValue = renewalWs.reduce((s, w) => s + w.estimatedValue, 0);
    const atRisk = renewalWs.filter(w => w.ragStatus === "red" || w.ragStatus === "amber").length;
    return [
      { label: "Total Renewals", value: renewalWs.length.toString(), icon: RotateCcw, color: "text-amber-600" },
      { label: "Portfolio Value", value: formatSAR(totalValue), icon: DollarSign, color: "text-emerald-600" },
      { label: "Expiring ≤90d", value: expiringSoon.toString(), icon: Calendar, color: expiringSoon > 0 ? "text-amber-600" : "text-muted-foreground" },
      { label: "At Risk", value: atRisk.toString(), icon: AlertTriangle, color: atRisk > 0 ? "text-red-600" : "text-muted-foreground" },
    ];
  }

  const metrics = mode === "tenders" ? getTenderMetrics() : mode === "commercial" ? getCommercialMetrics() : getRenewalMetrics();

  // ─── Mode labels for creation ─────────────────────────────────
  const createLabels: Record<OperatingMode, string> = {
    tenders: "New Tender",
    commercial: "New Commercial Deal",
    renewals: "New Renewal",
  };

  // ─── Has any filters active? ──────────────────────────────────
  const hasFilters = searchQuery.trim() ||
    (mode === "tenders" && (tenderStageFilter !== "all" || tenderOwnerFilter !== "all" || tenderRegionFilter !== "all")) ||
    (mode === "commercial" && (commercialStageFilter !== "all" || commercialOwnerFilter !== "all" || commercialRegionFilter !== "all")) ||
    (mode === "renewals" && (renewalOwnerFilter !== "all" || renewalRegionFilter !== "all" || renewalRagFilter !== "all"));

  function clearFilters() {
    setSearchQuery("");
    setTenderStageFilter("all"); setTenderOwnerFilter("all"); setTenderRegionFilter("all");
    setCommercialStageFilter("all"); setCommercialOwnerFilter("all"); setCommercialRegionFilter("all");
    setRenewalOwnerFilter("all"); setRenewalRegionFilter("all"); setRenewalRagFilter("all");
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* ── Header (matching Tender Pipeline style) ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-serif font-bold">
            {mode === "tenders" ? "Tender Pipeline" : mode === "commercial" ? "Commercial Pipeline" : "Renewal Pipeline"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(() => {
              const active = modeWorkspaces.filter(w => w.stage !== "go_live" && w.stage !== "closed_lost");
              const totalValue = active.reduce((s, w) => s + w.estimatedValue, 0);
              const stalled = active.filter(w => w.daysInStage > 14).length;
              return `${active.length} active · ${formatSAR(totalValue)} weighted · ${stalled} stalled`;
            })()}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> {createLabels[mode]}
        </Button>
      </div>

      {/* ── Search + Mode-Specific Filters (matching Tender Pipeline layout) ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={`Search ${mode}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        {/* Tenders filters */}
        {mode === "tenders" && (
          <>
            <Select value={tenderStageFilter} onValueChange={setTenderStageFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Milestones" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Milestones</SelectItem>
                {TENDER_WORKSPACE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tenderOwnerFilter} onValueChange={setTenderOwnerFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Owners" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {modeOwners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tenderRegionFilter} onValueChange={setTenderRegionFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Regions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {modeRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}

        {/* Commercial filters */}
        {mode === "commercial" && (
          <>
            <Select value={commercialStageFilter} onValueChange={setCommercialStageFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All Stages" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {WORKSPACE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={commercialOwnerFilter} onValueChange={setCommercialOwnerFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Owners" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {modeOwners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={commercialRegionFilter} onValueChange={setCommercialRegionFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Regions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {modeRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}

        {/* Renewals filters */}
        {mode === "renewals" && (
          <>
            <Select value={renewalOwnerFilter} onValueChange={setRenewalOwnerFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Owners" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {modeOwners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={renewalRegionFilter} onValueChange={setRenewalRegionFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Regions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {modeRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={renewalRagFilter} onValueChange={setRenewalRagFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Risk Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="red">Critical</SelectItem>
                <SelectItem value="amber">Warning</SelectItem>
                <SelectItem value="green">On Track</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-primary hover:underline whitespace-nowrap">Clear filters</button>
        )}
      </div>

      {/* ── Mode-Specific Data Table ── */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {/* Common: Signal */}
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-12">Signal</th>

                  {/* Mode-specific columns */}
                  {mode === "tenders" && (
                    <>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Customer / Tender</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Milestone</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Owner</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Value</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Deadline</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Days</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Region</th>
                    </>
                  )}
                  {mode === "commercial" && (
                    <>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Customer / Deal</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Stage</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Owner</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Value</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">GP%</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Days</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Pallets</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Region</th>
                    </>
                  )}
                  {mode === "renewals" && (
                    <>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Customer / Renewal</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Expiry</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Owner</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Value</th>
                      <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">GP%</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Grade</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Payment</th>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Region</th>
                    </>
                  )}
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ws => {
                  const cust = customers.find(c => c.id === ws.customerId);
                  return (
                    <tr key={ws.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                      {/* Signal dot */}
                      <td className="px-4 py-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${ws.ragStatus === "red" ? "bg-red-500" : ws.ragStatus === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      </td>

                      {/* ── TENDERS columns ── */}
                      {mode === "tenders" && (
                        <>
                          <td className="px-4 py-3">
                            <Link href={`/workspaces/${ws.id}`}>
                              <span className="text-sm font-medium text-foreground hover:text-primary">{ws.customerName}</span>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{ws.title}</p>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEffectiveStageColor(ws)}`}>
                              {getEffectiveStageLabel(ws)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ws.owner}</td>
                          <td className="px-4 py-3 text-right"><span className="text-sm font-mono">{formatSAR(ws.estimatedValue)}</span></td>
                          <td className="px-4 py-3 text-right">
                            {ws.submissionDeadline ? (
                              <span className={`text-xs font-medium ${
                                new Date(ws.submissionDeadline) < new Date() ? "text-red-600" : "text-muted-foreground"
                              }`}>
                                {ws.submissionDeadline}
                              </span>
                            ) : <span className="text-xs text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm ${ws.daysInStage > 14 ? "text-red-600 font-semibold" : ws.daysInStage > 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {ws.daysInStage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ws.region}</td>
                        </>
                      )}

                      {/* ── COMMERCIAL columns ── */}
                      {mode === "commercial" && (
                        <>
                          <td className="px-4 py-3">
                            <Link href={`/workspaces/${ws.id}`}>
                              <span className="text-sm font-medium text-foreground hover:text-primary">{ws.customerName}</span>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{ws.title}</p>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEffectiveStageColor(ws)}`}>
                              {getEffectiveStageLabel(ws)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ws.owner}</td>
                          <td className="px-4 py-3 text-right"><span className="text-sm font-mono">{formatSAR(ws.estimatedValue)}</span></td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-medium ${ws.gpPercent >= 22 ? "text-emerald-600" : ws.gpPercent >= 10 ? "text-amber-600" : "text-red-600"}`}>
                              {formatPercent(ws.gpPercent)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm ${ws.daysInStage > 14 ? "text-red-600 font-semibold" : ws.daysInStage > 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {ws.daysInStage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-muted-foreground">{ws.palletVolume.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ws.region}</td>
                        </>
                      )}

                      {/* ── RENEWALS columns ── */}
                      {mode === "renewals" && (
                        <>
                          <td className="px-4 py-3">
                            <Link href={`/workspaces/${ws.id}`}>
                              <span className="text-sm font-medium text-foreground hover:text-primary">{ws.customerName}</span>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{ws.title}</p>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {cust ? (
                              <span className={`text-xs font-medium ${
                                (() => {
                                  const daysLeft = Math.ceil((new Date(cust.contractExpiry).getTime() - Date.now()) / (1000*60*60*24));
                                  return daysLeft < 0 ? "text-red-600" : daysLeft <= 90 ? "text-amber-600" : "text-muted-foreground";
                                })()
                              }`}>
                                {cust.contractExpiry}
                              </span>
                            ) : <span className="text-xs text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ws.owner}</td>
                          <td className="px-4 py-3 text-right"><span className="text-sm font-mono">{formatSAR(ws.estimatedValue)}</span></td>
                          <td className="px-4 py-3 text-right">
                            <span className={`text-sm font-medium ${ws.gpPercent >= 22 ? "text-emerald-600" : ws.gpPercent >= 10 ? "text-amber-600" : "text-red-600"}`}>
                              {formatPercent(ws.gpPercent)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {cust ? (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                cust.grade === "A" ? "bg-emerald-100 text-emerald-700" :
                                cust.grade === "B" ? "bg-blue-100 text-blue-700" :
                                cust.grade === "C" ? "bg-amber-100 text-amber-700" :
                                cust.grade === "D" ? "bg-orange-100 text-orange-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {cust.grade}
                              </span>
                            ) : <span className="text-xs text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {cust ? (
                              <span className={`text-xs font-medium ${
                                cust.paymentStatus === "Good" ? "text-emerald-600" :
                                cust.paymentStatus === "Acceptable" ? "text-amber-600" :
                                "text-red-600"
                              }`}>
                                {cust.paymentStatus}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{ws.region}</td>
                        </>
                      )}

                      {/* Arrow */}
                      <td className="px-4 py-3">
                        <Link href={`/workspaces/${ws.id}`}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                No {mode === "tenders" ? "tenders" : mode === "commercial" ? "commercial deals" : "renewals"} match the current filters.
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateWorkspaceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={refetchWorkspaces}
        defaultMode={mode}
      />
    </div>
  );
}
