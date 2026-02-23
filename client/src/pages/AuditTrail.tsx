import { Clock, Filter, Shield, FileText, Users, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuditLog } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  approve: "bg-violet-100 text-violet-800",
  reject: "bg-red-100 text-red-800",
  override: "bg-amber-100 text-amber-800",
  submit: "bg-indigo-100 text-indigo-800",
  export: "bg-teal-100 text-teal-800",
  sync: "bg-cyan-100 text-cyan-800",
};

const entityIcons: Record<string, React.ElementType> = {
  workspace: Activity,
  quote: FileText,
  proposal: FileText,
  approval: Shield,
  customer: Users,
  policy: Shield,
};

export default function AuditTrail() {
  const { data: auditLog, loading } = useAuditLog();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  const filtered = auditLog
    .filter(e => typeFilter === "all" || e.entityType === typeFilter)
    .filter(e => actionFilter === "all" || e.action === actionFilter);

  const uniqueTypes = Array.from(new Set(auditLog.map(e => e.entityType)));
  const uniqueActions = Array.from(new Set(auditLog.map(e => e.action)));

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Audit Trail</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete system activity log — immutable record — {auditLog.length} entries
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Events", value: auditLog.length, icon: Activity, color: "bg-blue-100 text-blue-800" },
          { label: "Approvals", value: auditLog.filter(e => e.action === "approve").length, icon: CheckCircle, color: "bg-emerald-100 text-emerald-800" },
          { label: "Overrides", value: auditLog.filter(e => e.action === "override").length, icon: AlertTriangle, color: "bg-amber-100 text-amber-800" },
          { label: "Users Active", value: new Set(auditLog.map(e => e.userName)).size, icon: Users, color: "bg-violet-100 text-violet-800" },
        ].map(stat => (
          <Card key={stat.label} className="border border-border shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} entries shown</span>
      </div>

      {/* Event List */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.map(entry => {
              const Icon = entityIcons[entry.entityType] || Activity;
              return (
                <div key={entry.id} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{entry.userName}</span>
                      <Badge variant="outline" className={`text-[10px] ${actionColors[entry.action] || ""}`}>{entry.action}</Badge>
                      <Badge variant="outline" className="text-[10px]">{entry.entityType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
