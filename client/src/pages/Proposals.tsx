import { FileCheck, Plus, Download, Edit3, Send } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { proposals, workspaces } from "@/lib/store";
import { toast } from "sonner";

const stateColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ready_for_crm: "bg-blue-100 text-blue-800",
  sent: "bg-indigo-100 text-indigo-800",
  negotiation_active: "bg-amber-100 text-amber-800",
  commercial_approved: "bg-emerald-100 text-emerald-800",
};

export default function Proposals() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Proposals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{proposals.length} proposals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast("PDF export coming soon")}>
            <Download className="w-4 h-4 mr-1.5" />Export All
          </Button>
          <Link href="/editor">
            <Button>
              <Plus className="w-4 h-4 mr-1.5" />New Proposal
            </Button>
          </Link>
        </div>
      </div>
      <div className="space-y-3">
        {proposals.map(p => {
          const ws = workspaces.find(w => w.id === p.workspaceId);
          return (
            <Card key={p.id} className="border border-border shadow-none hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <FileCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{p.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${stateColors[p.state] || ""}`}>{p.state.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">v{p.version} — {p.createdAt}</span>
                    <Link href="/editor">
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <Edit3 className="w-3 h-3 mr-1" /> Open in Editor
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast("PDF generation triggered")}>
                      <Download className="w-3 h-3 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast("CRM export triggered")}>
                      <Send className="w-3 h-3 mr-1" /> CRM
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">{p.sections.map(s => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}</div>
                {ws && <p className="text-xs text-muted-foreground mt-2">Workspace: {ws.customerName} — {ws.title}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
