import { useState } from "react";
import { Link } from "wouter";
import { Plus, Filter, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  formatSAR, formatPercent, WORKSPACE_STAGES,
  getWorkspaceType, getWorkspaceTypeLabel, getWorkspaceTypeBadgeColor,
  getEffectiveStageLabel, getEffectiveStageColor,
  type WorkspaceType,
} from "@/lib/store";
import { useWorkspaces, useSignals } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import CreateWorkspaceDialog from "@/components/CreateWorkspaceDialog";

export default function Workspaces() {
  const { data: workspaces, loading: wsLoading, refetch: refetchWorkspaces } = useWorkspaces();
  const { data: signals } = useSignals();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [ragFilter, setRagFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);

  if (wsLoading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  const filtered = workspaces.filter(w => {
    const wsType = getWorkspaceType(w);
    if (typeFilter !== "all" && wsType !== typeFilter) return false;
    if (stageFilter !== "all") {
      if (w.type === "tender") {
        if (w.tenderStage !== stageFilter) return false;
      } else {
        if (w.stage !== stageFilter) return false;
      }
    }
    if (ragFilter !== "all" && w.ragStatus !== ragFilter) return false;
    return true;
  });

  // Count by type
  const commercialCount = workspaces.filter(w => getWorkspaceType(w) === "commercial").length;
  const tenderCount = workspaces.filter(w => getWorkspaceType(w) === "tender").length;
  const renewalCount = workspaces.filter(w => getWorkspaceType(w) === "renewal").length;
  const criticalCount = workspaces.filter(w => w.ragStatus === "red").length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {workspaces.length} total — {commercialCount} commercial, {tenderCount} tender{renewalCount > 0 ? `, ${renewalCount} renewal` : ""} — {criticalCount} critical
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New Workspace
        </Button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="tender">Tender</SelectItem>
            <SelectItem value="renewal">Renewal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All Stages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {WORKSPACE_STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ragFilter} onValueChange={setRagFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="red">Red — Critical</SelectItem>
            <SelectItem value="amber">Amber — Warning</SelectItem>
            <SelectItem value="green">Green — On Track</SelectItem>
          </SelectContent>
        </Select>
        {(typeFilter !== "all" || stageFilter !== "all" || ragFilter !== "all") && (
          <button onClick={() => { setTypeFilter("all"); setStageFilter("all"); setRagFilter("all"); }} className="text-xs text-primary hover:underline">Clear filters</button>
        )}
      </div>
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Customer / Deal</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Stage</th>
                  <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Owner</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Value</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">GP%</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Days</th>
                  <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Pallets</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ws => {
                  const wsType = getWorkspaceType(ws);
                  return (
                    <tr key={ws.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3"><div className={`rag-dot ${ws.ragStatus === "red" ? "rag-dot-red" : ws.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} /></td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${getWorkspaceTypeBadgeColor(wsType)}`}>
                          {getWorkspaceTypeLabel(wsType)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/workspaces/${ws.id}`}>
                          <span className="text-sm font-medium text-foreground hover:text-primary">{ws.customerName}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{ws.title}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEffectiveStageColor(ws)}`}>{getEffectiveStageLabel(ws)}</Badge></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{ws.owner}</td>
                      <td className="px-4 py-3 text-right"><span className="data-value text-sm">{formatSAR(ws.estimatedValue)}</span></td>
                      <td className="px-4 py-3 text-right"><span className={`data-value text-sm font-medium ${ws.gpPercent >= 22 ? "rag-green" : ws.gpPercent >= 10 ? "rag-amber" : "rag-red"}`}>{formatPercent(ws.gpPercent)}</span></td>
                      <td className="px-4 py-3 text-right"><span className={`data-value text-sm ${ws.daysInStage > 14 ? "rag-red" : ws.daysInStage > 7 ? "rag-amber" : "text-muted-foreground"}`}>{ws.daysInStage}</span></td>
                      <td className="px-4 py-3 text-right"><span className="data-value text-sm text-muted-foreground">{ws.palletVolume.toLocaleString()}</span></td>
                      <td className="px-4 py-3"><Link href={`/workspaces/${ws.id}`}><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No workspaces match the current filters</div>}
        </CardContent>
      </Card>

      <CreateWorkspaceDialog open={showCreate} onOpenChange={setShowCreate} onCreated={refetchWorkspaces} />
    </div>
  );
}
