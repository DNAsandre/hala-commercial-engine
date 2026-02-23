import { Link } from "wouter";
import { RefreshCw, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock , ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCRMSyncEvents } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CRMSync() {
  const { data: crmSyncEvents, loading } = useCRMSyncEvents();
  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold">CRM Sync</h1><p className="text-sm text-muted-foreground mt-0.5">Zoho CRM Integration — Mock Mode</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast("Manual sync triggered", { description: "Polling Zoho CRM for updates..." })}><RefreshCw className="w-4 h-4 mr-1.5" />Sync Now</Button>
          <Button variant="outline" onClick={() => toast("CRM configuration", { description: "Connect Zoho credentials in Settings > Integrations" })}>Configure</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[{ l: "Last Sync", v: "2 min ago", icon: Clock }, { l: "Sync Status", v: "Connected (Mock)", icon: CheckCircle }, { l: "Events Today", v: String(crmSyncEvents.length), icon: RefreshCw }].map(s => (
          <Card key={s.l} className="border border-border shadow-none"><CardContent className="p-4 flex items-center gap-3">
            <s.icon className="w-5 h-5 text-muted-foreground" />
            <div><p className="text-[10px] text-muted-foreground uppercase">{s.l}</p><p className="text-sm font-semibold mt-0.5">{s.v}</p></div>
          </CardContent></Card>
        ))}
      </div>
      <Card className="border border-border shadow-none mb-6">
        <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Zoho CRM Stage Mapping</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2 text-xs text-muted-foreground">Zoho Stage</th><th className="text-left py-2 text-xs text-muted-foreground">App Action</th><th className="text-left py-2 text-xs text-muted-foreground">Workspace Stage</th></tr></thead>
          <tbody>
            {[{ z: "1. Prospecting", a: "Monitor only", w: "\u2014" }, { z: "2. Qualified", a: "Create Workspace", w: "Qualified" }, { z: "3. Proposal Sent", a: "Update stage", w: "Proposal Active" }, { z: "4. Shortlisted", a: "Update stage", w: "Negotiation" }, { z: "5. Contract Negotiation", a: "Update stage", w: "Contract Sent" }, { z: "6. Closed Won", a: "Trigger handover", w: "Contract Signed" }, { z: "7. Contract Signed", a: "Complete handover", w: "Handover" }, { z: "8. Go-Live", a: "Archive workspace", w: "Go-Live" }].map(r => (
              <tr key={r.z} className="border-b last:border-0"><td className="py-2 font-medium">{r.z}</td><td className="py-2 text-muted-foreground">{r.a}</td><td className="py-2">{r.w}</td></tr>
            ))}
          </tbody></table>
        </CardContent>
      </Card>
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Sync Event Log</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {crmSyncEvents.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3">
                {e.direction === "inbound" ? <ArrowDownLeft className="w-4 h-4 text-blue-500 shrink-0" /> : <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-sm font-medium">{e.entity}</span><span className="data-value text-xs text-muted-foreground">{e.zohoId}</span></div>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.details}</p>
                </div>
                <Badge variant={e.status === "success" ? "default" : e.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
                <span className="text-[10px] text-muted-foreground data-value">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
