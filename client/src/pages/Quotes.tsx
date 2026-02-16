import { FileText, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { quotes, workspaces, formatSAR, formatPercent } from "@/lib/store";
import { toast } from "sonner";

const stateColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800", superseded: "bg-amber-100 text-amber-800" };

export default function Quotes() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-serif font-bold">Quotes</h1><p className="text-sm text-muted-foreground mt-0.5">{quotes.length} quotes across all workspaces</p></div>
        <Button onClick={() => toast("Create a quote from within a workspace")}><Plus className="w-4 h-4 mr-1.5" />New Quote</Button>
      </div>
      <div className="space-y-3">
        {quotes.map(q => {
          const ws = workspaces.find(w => w.id === q.workspaceId);
          return (
            <Card key={q.id} className="border border-border shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div><span className="text-sm font-medium">{ws?.customerName || "Unknown"}</span><span className="text-xs text-muted-foreground ml-2">Quote v{q.version}</span></div>
                    <Badge variant="outline" className={`text-[10px] ${stateColors[q.state] || ""}`}>{q.state}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{q.createdAt}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {[{ l: "Storage Rate", v: `SAR ${q.storageRate}/plt/day` }, { l: "Pallets", v: q.palletVolume.toLocaleString() }, { l: "Monthly Rev", v: formatSAR(q.monthlyRevenue) }, { l: "Annual Rev", v: formatSAR(q.annualRevenue) }, { l: "GP%", v: formatPercent(q.gpPercent) }].map(kv => (
                    <div key={kv.l}><p className="text-[10px] text-muted-foreground uppercase">{kv.l}</p><p className="data-value text-sm font-medium mt-0.5">{kv.v}</p></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
