import { ShieldCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { approvalRecords, workspaces, getRoleLabel } from "@/lib/store";
import { toast } from "sonner";

export default function Approvals() {
  const pending = approvalRecords.filter(a => a.decision === "pending");
  const completed = approvalRecords.filter(a => a.decision !== "pending");
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Button>
        </Link>
      </div>
      <div className="mb-6"><h1 className="text-2xl font-serif font-bold">Approval Matrix</h1><p className="text-sm text-muted-foreground mt-0.5">{pending.length} pending approvals</p></div>
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="matrix">Approval Matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          {pending.length > 0 ? <div className="space-y-3">{pending.map(a => {
            const ws = workspaces.find(w => w.id === a.workspaceId);
            return (
              <Card key={a.id} className="border border-border shadow-none border-l-4 border-l-amber-400">
                <CardContent className="p-4"><div className="flex items-center justify-between">
                  <div><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium">{ws?.customerName} — {a.entityType}</span></div><p className="text-xs text-muted-foreground mt-1 ml-6">Awaiting: {a.approverName} ({getRoleLabel(a.approverRole)})</p></div>
                  <div className="flex gap-2"><Button size="sm" variant="outline" className="text-xs h-7 border-red-300 text-red-600" onClick={() => toast("Rejection flow coming soon")}><XCircle className="w-3 h-3 mr-1" />Reject</Button><Button size="sm" className="text-xs h-7" onClick={() => toast("Approval flow coming soon")}><CheckCircle className="w-3 h-3 mr-1" />Approve</Button></div>
                </div></CardContent>
              </Card>
            );
          })}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No pending approvals</CardContent></Card>}
        </TabsContent>
        <TabsContent value="completed">
          <div className="space-y-2">{completed.map(a => {
            const ws = workspaces.find(w => w.id === a.workspaceId);
            return (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div><div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{a.approverName}</span><span className="text-xs text-muted-foreground">({getRoleLabel(a.approverRole)})</span></div><p className="text-xs text-muted-foreground mt-1 ml-6">{ws?.customerName} — {a.reason}</p></div>
                <div className="text-right"><Badge variant={a.decision === "approved" ? "default" : "destructive"} className="text-[10px]">{a.decision}</Badge><p className="text-[10px] text-muted-foreground mt-1">{new Date(a.timestamp).toLocaleDateString()}</p></div>
              </div>
            );
          })}</div>
        </TabsContent>
        <TabsContent value="matrix">
          <div className="space-y-6">
            <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Volume-Based Approval</CardTitle></CardHeader><CardContent className="pt-0">
              <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2 text-xs text-muted-foreground">Pallet Volume</th><th className="text-center py-2 text-xs text-muted-foreground">Salesman</th><th className="text-center py-2 text-xs text-muted-foreground">Regional Sales Head</th><th className="text-center py-2 text-xs text-muted-foreground">Directors</th></tr></thead>
              <tbody>
                <tr className="border-b"><td className="py-2 font-medium">&lt; 300 pallets</td><td className="text-center">Price List</td><td className="text-center text-emerald-600">&#10003;</td><td className="text-center text-muted-foreground">—</td></tr>
                <tr><td className="py-2 font-medium">&gt; 300 pallets</td><td className="text-center">—</td><td className="text-center text-emerald-600">&#10003;</td><td className="text-center text-emerald-600">&#10003;</td></tr>
              </tbody></table>
            </CardContent></Card>
            <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">GP%-Based Approval</CardTitle></CardHeader><CardContent className="pt-0">
              <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2 text-xs text-muted-foreground">GP%</th><th className="text-center py-2 text-xs text-muted-foreground">Salesman</th><th className="text-center py-2 text-xs text-muted-foreground">Reg. Sales Head</th><th className="text-center py-2 text-xs text-muted-foreground">Reg. Ops Head</th><th className="text-center py-2 text-xs text-muted-foreground">Directors</th><th className="text-center py-2 text-xs text-muted-foreground">CEO/CFO</th></tr></thead>
              <tbody>
                {[{ gp: "> 30%", s: true, rsh: true, roh: "feasibility", d: false, c: false },
                  { gp: "> 25%", s: true, rsh: true, roh: "feasibility", d: false, c: false },
                  { gp: "> 22%", s: true, rsh: true, roh: true, d: false, c: false },
                  { gp: "10-22%", s: true, rsh: true, roh: true, d: true, c: false },
                  { gp: "< 10%", s: true, rsh: true, roh: true, d: true, c: true }
                ].map(row => (
                  <tr key={row.gp} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.gp}</td>
                    <td className="text-center">{row.s ? <span className="text-emerald-600">&#10003;</span> : "—"}</td>
                    <td className="text-center">{row.rsh ? <span className="text-emerald-600">&#10003;</span> : "—"}</td>
                    <td className="text-center">{row.roh === "feasibility" ? <span className="text-xs text-muted-foreground">Feasibility</span> : row.roh ? <span className="text-emerald-600">&#10003;</span> : "—"}</td>
                    <td className="text-center">{row.d ? <span className="text-emerald-600">&#10003;</span> : "—"}</td>
                    <td className="text-center">{row.c ? <span className="text-emerald-600">&#10003;</span> : "—"}</td>
                  </tr>
                ))}
              </tbody></table>
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
