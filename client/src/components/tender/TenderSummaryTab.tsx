import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import { Loader2, FileText, AlertCircle, CalendarClock, DollarSign, Database, ShieldCheck } from "lucide-react";
import { formatSAR } from "@/lib/store";
import TenderCustomerSnapshotTab from "./TenderCustomerSnapshotTab";

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
}

export default function TenderSummaryTab({ ws, reload }: Props) {
  const { data: commercialData, loading } = useCommercialOsData();
  const t = ws.tender;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading tender data...</span>
      </div>
    );
  }

  const linkedOpportunity = commercialData.opportunities.find(
    o => o.customerName.toLowerCase() === t.customerName.toLowerCase() ||
         o.opportunityName.toLowerCase().includes(t.title.toLowerCase())
  );

  const daysLeft = t.submissionDeadline 
    ? Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / 86400000)
    : null;

  const criticalSignals = ws.packs.reduce((sum, p) => sum + (p.readinessBreakdown?.readiness_signals ?? 0), 0);
  
  return (
    <div className="space-y-4">
      <Card className="border-border shadow-none">
        <CardHeader className="pb-2 border-b border-border bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Tender Intake Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid gap-4 md:grid-cols-2">
          
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Tender Title & ID</p>
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] font-mono bg-slate-100 text-slate-600">{t.id}</Badge>
                <Badge variant="outline" className="text-[10px] bg-slate-50">{ws.tenderType || "Unknown"}</Badge>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Source & Pipeline Origin</p>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">{t.source || "Not available"}</span>
                {linkedOpportunity && (
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 ml-2">Linked to CRM</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Commercial Targets</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                    <DollarSign className="w-3.5 h-3.5" /> Value
                  </div>
                  <span className="text-sm font-bold">{t.estimatedValue ? formatSAR(t.estimatedValue) : "Not available"}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Target GP
                  </div>
                  <span className={`text-sm font-bold ${t.targetGpPercent >= 20 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {t.targetGpPercent ? `${t.targetGpPercent}%` : "Not available"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Submission Timeline</p>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">{t.submissionDeadline || "Not captured yet"}</span>
                {daysLeft !== null && (
                  <span className={`text-xs ml-2 ${daysLeft <= 7 ? 'text-red-600 font-bold' : daysLeft <= 14 ? 'text-amber-600 font-medium' : 'text-emerald-600'}`}>
                    ({daysLeft > 0 ? `${daysLeft} days remaining` : 'Deadline passed'})
                  </span>
                )}
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Advisory Review Signals */}
      <Card className={`${criticalSignals > 0 || (daysLeft && daysLeft <= 7) ? 'border-amber-200 bg-amber-50/20' : 'border-emerald-200 bg-emerald-50/20'} shadow-none`}>
        <CardContent className="p-4">
          <h3 className={`text-xs font-semibold mb-2 flex items-center gap-1.5 ${criticalSignals > 0 || (daysLeft && daysLeft <= 7) ? 'text-amber-800' : 'text-emerald-800'}`}>
            <AlertCircle className="w-4 h-4" />
            Advisory Readiness Signals
          </h3>
          <ul className={`text-xs space-y-1 list-disc list-inside ${criticalSignals > 0 || (daysLeft && daysLeft <= 7) ? 'text-amber-700' : 'text-emerald-700'}`}>
            {criticalSignals > 0 && <li><strong>Signal Review Required:</strong> {criticalSignals} active readiness signals flagged for review in this workspace.</li>}
            {daysLeft && daysLeft <= 7 && <li><strong>Deadline Pressure:</strong> Submission due in {daysLeft} days. Expedite qualification tasks.</li>}
            {criticalSignals === 0 && (!daysLeft || daysLeft > 7) && <li className="list-none">All initial intake indicators appear stable. No severe signals flagged.</li>}
          </ul>
        </CardContent>
      </Card>

      {/* ═══ MERGED: Customer Snapshot content (below summary) ═══ */}
      <TenderCustomerSnapshotTab ws={ws} reload={reload} />
    </div>
  );
}
