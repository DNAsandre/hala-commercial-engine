/**
 * CW-010: Commercial Activity Tab
 * Mock operational timeline. No real event bus or backend.
 * SUPA-003B: Now reads from Supabase via useCommercialWorkspaceData.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, AlertTriangle, Clock, Info, User, Loader2, Database } from "lucide-react";
import { getActivityForWorkspace } from "@/lib/commercial-workspace-data";
import { useCommercialWorkspaceData } from "@/hooks/useCommercialWorkspaceData";

const sevColor = (s: string) => s === "Critical" ? "text-red-700 bg-red-100 border-red-300" : s === "High" ? "text-red-600 bg-red-50 border-red-200" : s === "Warning" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-600 bg-slate-50 border-slate-200";
const catColor = (c: string) => {
  if (["Margin","Escalation"].includes(c)) return "text-red-700 bg-red-50 border-red-200";
  if (["Capacity","Customer Score","Revenue Timing"].includes(c)) return "text-amber-700 bg-amber-50 border-amber-200";
  if (["Proposal","Negotiation","SLA"].includes(c)) return "text-violet-700 bg-violet-50 border-violet-200";
  if (["Quote","Pricing","P&L","Pricing Posture"].includes(c)) return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};
const dotColor = (s: string) => s === "Critical" ? "bg-red-500" : s === "High" ? "bg-red-400" : s === "Warning" ? "bg-amber-400" : "bg-slate-300";

interface Props { workspaceId: string; }

export default function CommercialActivityTab({ workspaceId }: Props) {
  const { bundle, status } = useCommercialWorkspaceData(workspaceId);

  // SUPA-003B: Use Supabase-backed activity data when available
  const allEvents = bundle && bundle.activityEvents.length > 0
    ? bundle.activityEvents
    : getActivityForWorkspace(workspaceId);
  const isSupabaseBacked = bundle?.supabaseBacked && bundle.activityEvents.length > 0;

  const [catFilter, setCatFilter] = useState("All");
  const [sevFilter, setSevFilter] = useState("All");

  const categories = useMemo(() => ["All", ...Array.from(new Set(allEvents.map(e => e.category)))], [allEvents]);
  const filtered = useMemo(() => allEvents.filter(e => (catFilter === "All" || e.category === catFilter) && (sevFilter === "All" || e.severity === sevFilter)), [allEvents, catFilter, sevFilter]);

  const warnings = allEvents.filter(e => e.severity === "Warning").length;
  const highCritical = allEvents.filter(e => e.severity === "High" || e.severity === "Critical").length;
  const lastTs = allEvents[0]?.timestamp ? new Date(allEvents[0].timestamp).toLocaleDateString() : "—";

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-hala-navy)]" />
        <span className="text-sm text-muted-foreground">Loading activity data from Supabase…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-base font-serif font-bold flex items-center gap-2"><Activity className="w-5 h-5 text-[var(--color-hala-navy)]" /> Commercial Activity</h3><p className="text-xs text-muted-foreground">Mock operational timeline</p></div>
        <div className="flex items-center gap-2">
          {isSupabaseBacked && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><Database className="w-3 h-3 mr-1" />Supabase-Backed</Badge>}
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Development Mode</Badge>
        </div>
      </div>
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50"><CardContent className="p-3"><div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" /><div><div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: mock operational timeline</div><p className="text-xs text-amber-700">Real workflow history will be backend-backed later.</p></div></div></CardContent></Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[{l:"Total Events",v:String(allEvents.length),c:""},{l:"Warnings",v:String(warnings),c:warnings>0?"text-amber-600":""},{l:"High / Critical",v:String(highCritical),c:highCritical>0?"text-red-600":""},{l:"Mock Events",v:String(allEvents.length),c:""},{l:"Last Activity",v:lastTs,c:""}].map(i=>(
          <div key={i.l} className="bg-muted/30 rounded-lg p-2.5"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{i.l}</p><p className={`text-sm font-bold mt-0.5 ${i.c}`}>{i.v}</p></div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Category:</span>
          <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c=><SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Severity:</span>
          <Select value={sevFilter} onValueChange={setSevFilter}><SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{["All","Info","Warning","High","Critical"].map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent></Select>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} of {allEvents.length} events</span>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {filtered.map(e => (
          <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg border hover:bg-muted/10 transition-colors">
            <div className="flex flex-col items-center gap-1 pt-1"><div className={`w-2 h-2 rounded-full shrink-0 ${dotColor(e.severity)}`} /><div className="w-px flex-1 bg-border" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold">{e.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={`text-[8px] ${catColor(e.category)}`}>{e.category}</Badge>
                  <Badge variant="outline" className={`text-[8px] ${sevColor(e.severity)}`}>{e.severity}</Badge>
                  <Badge variant="outline" className="text-[8px] bg-slate-50 border-slate-200">Mock</Badge>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mb-1">{e.description}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{e.actor} · {e.role}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(e.timestamp).toLocaleDateString()}</span>
                {e.relatedArtifact && <span>{e.relatedModule}: {e.relatedArtifact}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2"><Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /><p className="text-xs text-blue-800">All activity events are mock records for development. Production activity will be backend-backed and immutable.</p></div>
    </div>
  );
}
