/**
 * CW-010: Commercial Audit Trail Tab
 * Mock governance evidence log. No real immutable audit or backend.
 * SUPA-003B: Now reads from Supabase via useCommercialWorkspaceData.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, AlertTriangle, Info, Eye, Clock, User, Hash, Loader2, Database } from "lucide-react";
import { type CommercialAuditEvent, getAuditForWorkspace } from "@/lib/commercial-workspace-data";
import { useCommercialWorkspaceData } from "@/hooks/useCommercialWorkspaceData";

const sevColor = (s: string) => s === "Critical" ? "text-red-700 bg-red-100 border-red-300" : s === "High" ? "text-red-600 bg-red-50 border-red-200" : s === "Warning" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-600 bg-slate-50 border-slate-200";
const catBadge = (c: string) => {
  if (["MARGIN","ESCALATION"].includes(c)) return "text-red-700 bg-red-50 border-red-200";
  if (["CAPACITY","CUSTOMER_SCORE","REVENUE_TIMING"].includes(c)) return "text-amber-700 bg-amber-50 border-amber-200";
  if (["PROPOSAL","NEGOTIATION","SLA"].includes(c)) return "text-violet-700 bg-violet-50 border-violet-200";
  if (["QUOTE","PRICING","PNL","PRICING_POSTURE"].includes(c)) return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
};

interface Props { workspaceId: string; }

export default function CommercialAuditTrailTab({ workspaceId }: Props) {
  const { bundle, status } = useCommercialWorkspaceData(workspaceId);

  // SUPA-003B: Use Supabase-backed audit data when available
  const allEvents = bundle && bundle.auditEvents.length > 0
    ? bundle.auditEvents
    : getAuditForWorkspace(workspaceId);
  const isSupabaseBacked = bundle?.supabaseBacked && bundle.auditEvents.length > 0;

  const [catFilter, setCatFilter] = useState("All");
  const [sevFilter, setSevFilter] = useState("All");
  const [codeFilter, setCodeFilter] = useState("All");
  const [selected, setSelected] = useState<CommercialAuditEvent | null>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set(allEvents.map(e => e.category)))], [allEvents]);
  const codes = useMemo(() => ["All", ...Array.from(new Set(allEvents.map(e => e.eventCode)))], [allEvents]);
  const filtered = useMemo(() => allEvents.filter(e =>
    (catFilter === "All" || e.category === catFilter) &&
    (sevFilter === "All" || e.severity === sevFilter) &&
    (codeFilter === "All" || e.eventCode === codeFilter)
  ), [allEvents, catFilter, sevFilter, codeFilter]);

  const quoteEvents = allEvents.filter(e => ["QUOTE","PRICING","PNL"].includes(e.category)).length;
  const escalationEvents = allEvents.filter(e => e.category === "ESCALATION").length;
  const propSlaEvents = allEvents.filter(e => ["PROPOSAL","NEGOTIATION","SLA"].includes(e.category)).length;
  const highCritical = allEvents.filter(e => e.severity === "High" || e.severity === "Critical").length;
  const lastTs = allEvents[0]?.timestamp ? new Date(allEvents[0].timestamp).toLocaleDateString() : "—";

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-hala-navy)]" />
        <span className="text-sm text-muted-foreground">Loading audit data from Supabase…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-base font-serif font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[var(--color-hala-navy)]" /> Audit Trail</h3><p className="text-xs text-muted-foreground">Mock governance evidence log</p></div>
        <div className="flex items-center gap-2">
          {isSupabaseBacked && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><Database className="w-3 h-3 mr-1" />Supabase-Backed</Badge>}
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Development Mode</Badge>
        </div>
      </div>
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50"><CardContent className="p-3"><div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" /><div><div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: audit events are mock records</div><p className="text-xs text-amber-700">Production audit will be immutable and backend-backed later.</p></div></div></CardContent></Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[{l:"Total Events",v:String(allEvents.length)},{l:"Quote Events",v:String(quoteEvents)},{l:"Escalation",v:String(escalationEvents)},{l:"Proposal/SLA",v:String(propSlaEvents)},{l:"High/Critical",v:String(highCritical)},{l:"Last Audit",v:lastTs}].map(i=>(
          <div key={i.l} className="bg-muted/30 rounded-lg p-2.5"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{i.l}</p><p className="text-sm font-bold mt-0.5">{i.v}</p></div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Category:</span>
          <Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{categories.map(c=><SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Event Code:</span>
          <Select value={codeFilter} onValueChange={setCodeFilter}><SelectTrigger className="h-7 text-xs w-[220px]"><SelectValue /></SelectTrigger><SelectContent>{codes.map(c=><SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Severity:</span>
          <Select value={sevFilter} onValueChange={setSevFilter}><SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger><SelectContent>{["All","Info","Warning","High","Critical"].map(s=><SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent></Select>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">{filtered.length} of {allEvents.length} events</span>
      </div>

      {/* Audit table */}
      <Card className="border shadow-none">
        <CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="border-b text-muted-foreground bg-muted/30">{["Event Code","Event Name","Category","Entity","Actor","Before","After","Severity","Mock","Timestamp","Trace","Action"].map(h=><th key={h} className="text-left py-2 px-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{filtered.map(e=>(
            <tr key={e.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
              <td className="py-1.5 px-2 font-mono text-[10px]">{e.eventCode}</td>
              <td className="py-1.5 px-2 font-semibold">{e.eventName}</td>
              <td className="py-1.5 px-2"><Badge variant="outline" className={`text-[8px] ${catBadge(e.category)}`}>{e.category}</Badge></td>
              <td className="py-1.5 px-2 truncate max-w-[120px]">{e.entityName}</td>
              <td className="py-1.5 px-2">{e.actor}</td>
              <td className="py-1.5 px-2 text-muted-foreground">{e.beforeState}</td>
              <td className="py-1.5 px-2 font-medium">{e.afterState}</td>
              <td className="py-1.5 px-2"><Badge variant="outline" className={`text-[8px] ${sevColor(e.severity)}`}>{e.severity}</Badge></td>
              <td className="py-1.5 px-2"><Badge variant="outline" className="text-[8px] bg-slate-50 border-slate-200">Mock</Badge></td>
              <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">{new Date(e.timestamp).toLocaleDateString()}</td>
              <td className="py-1.5 px-2 font-mono text-[10px] text-muted-foreground">{e.traceId}</td>
              <td className="py-1.5 px-2"><Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={()=>setSelected(e)}><Eye className="w-3 h-3" />View</Button></td>
            </tr>
          ))}</tbody>
        </table></div></CardContent>
      </Card>

      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2"><Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /><p className="text-xs text-blue-800">All audit events are mock records for development. Production audit will be immutable, backend-backed, and tamper-proof.</p></div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-serif flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[var(--color-hala-navy)]" /> Mock Audit Detail</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="p-2 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> This is a mock audit record. Production audit will be immutable.</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[{l:"Event Code",v:selected.eventCode,icon:Hash},{l:"Event Name",v:selected.eventName,icon:ShieldCheck},{l:"Category",v:selected.category,icon:ShieldCheck},{l:"Entity",v:`${selected.entityType}: ${selected.entityName}`,icon:ShieldCheck},{l:"Actor",v:`${selected.actor} (${selected.role})`,icon:User},{l:"Timestamp",v:new Date(selected.timestamp).toLocaleString(),icon:Clock}].map(i=>(
                  <div key={i.l} className="bg-muted/30 rounded-lg p-2"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><i.icon className="w-3 h-3" />{i.l}</p><p className="font-medium mt-0.5">{i.v}</p></div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-2 border"><p className="text-[9px] font-semibold uppercase text-muted-foreground">Before State</p><p className="text-xs font-medium mt-0.5">{selected.beforeState}</p></div>
                <div className="bg-slate-50 rounded-lg p-2 border"><p className="text-[9px] font-semibold uppercase text-muted-foreground">After State</p><p className="text-xs font-medium mt-0.5">{selected.afterState}</p></div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className={`text-[9px] ${sevColor(selected.severity)}`}>{selected.severity}</Badge>
                <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200">Mock</Badge>
                <span className="text-muted-foreground ml-auto font-mono text-[10px]">Trace: {selected.traceId}</span>
              </div>
              {selected.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
              {selected.notes && <p className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {selected.notes}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
