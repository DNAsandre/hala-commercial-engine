import { useParams, Link } from "wouter";
import { ArrowLeft, FileText, Calculator, ShieldCheck, FileCheck, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { workspaces, customers, quotes, proposals, approvalRecords, signals, auditLog, formatSAR, formatPercent, getStageLabel, getStageColor, getApprovalRequirements, getRoleLabel, WORKSPACE_STAGES } from "@/lib/store";
import { toast } from "sonner";

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const ws = workspaces.find(w => w.id === id);
  if (!ws) return <div className="p-6"><h1 className="text-xl font-serif">Workspace not found</h1><Link href="/workspaces"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link></div>;
  const customer = customers.find(c => c.id === ws.customerId);
  const wsQuotes = quotes.filter(q => q.workspaceId === ws.id);
  const wsProposals = proposals.filter(p => p.workspaceId === ws.id);
  const wsApprovals = approvalRecords.filter(a => a.workspaceId === ws.id);
  const wsSignals = signals.filter(s => s.workspaceId === ws.id);
  const wsAudit = auditLog.filter(a => a.entityId === ws.id || wsQuotes.some(q => q.id === a.entityId) || wsProposals.some(p => p.id === a.entityId));
  const approvalReqs = getApprovalRequirements(ws.gpPercent, ws.palletVolume);
  const currentStageIdx = WORKSPACE_STAGES.findIndex(s => s.value === ws.stage);

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/workspaces"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`rag-dot ${ws.ragStatus === "red" ? "rag-dot-red" : ws.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
            <h1 className="text-xl font-serif font-bold">{ws.customerName}</h1>
            <Badge variant="outline" className={`text-xs ${getStageColor(ws.stage)}`}>{getStageLabel(ws.stage)}</Badge>
            {ws.crmDealId && <span className="text-xs text-muted-foreground data-value">CRM: {ws.crmDealId}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-6">{ws.title}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => toast("Stage advanced", { description: "Feature coming soon" })}>Advance Stage</Button>
      </div>

      <Card className="border border-border shadow-none mb-6"><CardContent className="py-4 px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {WORKSPACE_STAGES.slice(0, 8).map((s, i) => (
            <div key={s.value} className="flex items-center">
              <div className={`px-2.5 py-1 rounded text-[10px] font-medium whitespace-nowrap ${i <= currentStageIdx ? "bg-primary text-primary-foreground" : i === currentStageIdx + 1 ? "bg-muted text-muted-foreground border border-dashed border-primary/30" : "bg-muted text-muted-foreground/50"}`}>{s.label}</div>
              {i < 7 && <div className={`w-4 h-px mx-0.5 ${i < currentStageIdx ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[{ label: "Est. Value", value: formatSAR(ws.estimatedValue) }, { label: "GP%", value: formatPercent(ws.gpPercent), color: ws.gpPercent >= 22 ? "rag-green" : ws.gpPercent >= 10 ? "rag-amber" : "rag-red" }, { label: "Pallets", value: ws.palletVolume.toLocaleString() }, { label: "Days in Stage", value: String(ws.daysInStage), color: ws.daysInStage > 14 ? "rag-red" : ws.daysInStage > 7 ? "rag-amber" : undefined }, { label: "Region", value: ws.region }, { label: "Owner", value: ws.owner }].map(kpi => (
          <Card key={kpi.label} className="border border-border shadow-none"><CardContent className="p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`data-value text-lg font-semibold mt-0.5 ${kpi.color || ""}`}>{kpi.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {wsSignals.length > 0 && <div className="mb-6 space-y-2">
        {wsSignals.map(sig => (
          <div key={sig.id} className={`flex items-start gap-3 p-3 rounded-lg border ${sig.severity === "red" ? "border-[var(--color-rag-red)]/20 bg-red-50" : sig.severity === "amber" ? "border-[var(--color-rag-amber)]/20 bg-amber-50" : "border-[var(--color-rag-green)]/20 bg-green-50"}`}>
            <div className={`rag-dot mt-1.5 shrink-0 ${sig.severity === "red" ? "rag-dot-red" : sig.severity === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
            <div>
              <p className="text-sm font-medium">{sig.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sig.message}</p>
            </div>
          </div>
        ))}
      </div>}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({wsQuotes.length})</TabsTrigger>
          <TabsTrigger value="proposals">Proposals ({wsProposals.length})</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Customer Info</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                {customer && [{ l: "Code", v: customer.code }, { l: "Industry", v: customer.industry }, { l: "Grade", v: customer.grade }, { l: "Service Type", v: customer.serviceType }, { l: "Contract Expiry", v: customer.contractExpiry }, { l: "DSO", v: `${customer.dso} days` }, { l: "Payment Status", v: customer.paymentStatus }, { l: "Contact", v: customer.contactName }].map(r => (
                  <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="font-medium data-value">{r.v}</span></div>
                ))}
              </CardContent>
            </Card>
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Approval Requirements</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Based on GP% of {formatPercent(ws.gpPercent)} and {ws.palletVolume.toLocaleString()} pallets</p>
                {approvalReqs.map((req, i) => {
                  const existing = wsApprovals.find(a => a.approverRole === req.role);
                  return <div key={i} className="flex items-center justify-between p-2 rounded border border-border">
                    <div><span className="text-sm font-medium">{getRoleLabel(req.role)}</span><span className="text-xs text-muted-foreground ml-2">({req.type})</span></div>
                    <Badge variant={existing?.decision === "approved" ? "default" : existing?.decision === "pending" ? "secondary" : "outline"} className="text-[10px]">{existing?.decision || "not started"}</Badge>
                  </div>;
                })}
              </CardContent>
            </Card>
          </div>
          <Card className="border border-border shadow-none mt-6"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Notes</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-sm text-muted-foreground">{ws.notes}</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="quotes">
          {wsQuotes.length > 0 ? <div className="space-y-3">{wsQuotes.map(q => (
            <Card key={q.id} className="border border-border shadow-none"><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">Quote v{q.version}</span><Badge variant="outline" className="text-[10px]">{q.state}</Badge></div>
                <span className="text-xs text-muted-foreground">{q.createdAt}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[{ l: "Storage Rate", v: `SAR ${q.storageRate}/pallet/day` }, { l: "Monthly Revenue", v: formatSAR(q.monthlyRevenue) }, { l: "Annual Revenue", v: formatSAR(q.annualRevenue) }, { l: "GP%", v: formatPercent(q.gpPercent) }].map(kv => (
                  <div key={kv.l}><p className="text-[10px] text-muted-foreground uppercase">{kv.l}</p><p className="data-value text-sm font-medium mt-0.5">{kv.v}</p></div>
                ))}
              </div>
            </CardContent></Card>
          ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No quotes created yet</CardContent></Card>}
        </TabsContent>

        <TabsContent value="proposals">
          {wsProposals.length > 0 ? <div className="space-y-3">{wsProposals.map(p => (
            <Card key={p.id} className="border border-border shadow-none"><CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{p.title}</span><Badge variant="outline" className="text-[10px]">{p.state}</Badge></div>
                <span className="text-xs text-muted-foreground">v{p.version} — {p.createdAt}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">{p.sections.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
            </CardContent></Card>
          ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No proposals created yet</CardContent></Card>}
        </TabsContent>

        <TabsContent value="approvals">
          {wsApprovals.length > 0 ? <div className="space-y-2">{wsApprovals.map(a => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{a.approverName}</span><span className="text-xs text-muted-foreground">({getRoleLabel(a.approverRole)})</span></div>
                {a.reason && <p className="text-xs text-muted-foreground mt-1 ml-6">{a.reason}</p>}
              </div>
              <div className="text-right">
                <Badge variant={a.decision === "approved" ? "default" : a.decision === "rejected" ? "destructive" : "secondary"} className="text-[10px]">{a.decision}</Badge>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.timestamp).toLocaleDateString()}</p>
              </div>
            </div>
          ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No approval records yet</CardContent></Card>}
        </TabsContent>

        <TabsContent value="audit">
          <Card className="border border-border shadow-none"><CardContent className="p-0">
            <div className="divide-y divide-border">
              {wsAudit.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium">{entry.userName}</span><span className="text-xs text-muted-foreground">{entry.action}</span></div><p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p></div>
                  <span className="text-[10px] text-muted-foreground data-value shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {wsAudit.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No audit entries</div>}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
