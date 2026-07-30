/**
 * AwardSlaPrepTab — Tab 3 of Awarded Stage
 *
 * SLA handoff brief — snapshot of all SLA-relevant data from the tender.
 * This remains inside the tender process and does not create an SLA record.
 * Reads from solution_design.sla_kpi and negotiation revised terms.
 *
 * Data: type_details.awarded_data.sla_prep
 * No AI. No mock data.
 */
import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, Info, Target, FileText } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { updateTenderAwardedData } from "@/lib/supabase-tender-actions";

interface Props { ws: TenderWorkspace; reload: () => void }

export default function AwardSlaPrepTab({ ws, reload }: Props) {
  const tenderId = ws.tender.id;
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const saved = td?.awarded_data?.sla_prep ?? {};

  // Read existing SLA-relevant data from tender
  const solutionDesign = td?.solution_design ?? {};
  const slaKpi = solutionDesign?.sla_kpi ?? {};
  const negotiationTerms = td?.negotiation_data?.revised_terms ?? {};
  const negotiationChanges = td?.negotiation_data?.requested_changes ?? [];

  // Extract SLA-relevant negotiation items
  const slaRelatedChanges = useMemo(() => {
    if (!Array.isArray(negotiationChanges)) return [];
    return negotiationChanges.filter((c: any) =>
      c.category === "sla_penalties" || c.category === "kpis_reporting"
    );
  }, [negotiationChanges]);

  const [slaStatus, setSlaStatus] = useState(saved.sla_status || "not_started");
  const [slaOwner, setSlaOwner] = useState(saved.sla_owner || "");
  const [targetSlaDate, setTargetSlaDate] = useState(saved.target_sla_date || "");
  const [serviceLines, setServiceLines] = useState(saved.service_lines || "");
  const [kpiSummary, setKpiSummary] = useState(saved.kpi_summary || "");
  const [penaltyStructure, setPenaltyStructure] = useState(saved.penalty_structure || "");
  const [reportingCadence, setReportingCadence] = useState(saved.reporting_cadence || "monthly");
  const [reviewPeriod, setReviewPeriod] = useState(saved.review_period || "quarterly");
  const [exclusions, setExclusions] = useState(saved.exclusions || "");
  const [notes, setNotes] = useState(saved.notes || "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        sla_status: slaStatus, sla_owner: slaOwner, target_sla_date: targetSlaDate,
        service_lines: serviceLines, kpi_summary: kpiSummary,
        penalty_structure: penaltyStructure, reporting_cadence: reportingCadence,
        review_period: reviewPeriod, exclusions, notes,
      };
      const res = await updateTenderAwardedData(tenderId, "sla_prep", payload, `SLA status: ${slaStatus}`);
      if (!res.success) { toast.error(res.error || "Save failed."); return; }
      toast.success("SLA prep saved."); setDirty(false); reload();
    } catch (e: any) { toast.error(e.message || "Save failed."); }
    finally { setSaving(false); }
  }, [slaStatus, slaOwner, targetSlaDate, serviceLines, kpiSummary, penaltyStructure, reportingCadence, reviewPeriod, exclusions, notes, tenderId, reload]);

  const statusColor = (s: string) => {
    if (s === "ready") return "border-emerald-300 text-emerald-700 bg-emerald-50";
    if (s === "in_progress") return "border-blue-300 text-blue-700 bg-blue-50";
    return "border-slate-200 text-slate-500 bg-slate-50";
  };

  // Check what data exists from the tender pipeline
  const hasSlaKpi = Object.keys(slaKpi).length > 0;
  const hasNegotiatedTerms = Object.keys(negotiationTerms).length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-[#075eea]/10 border border-[#075eea]/15 rounded-md px-3 py-2">
        <Info className="w-3.5 h-3.5 mt-0.5 text-[#0b73ff] shrink-0" />
        <span>Prepare the SLA handoff brief for this tender. This captures SLA-relevant tender data only and does not create an SLA record.</span>
      </div>

      <div className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-muted/10">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">SLA Prep</span>
        <Badge variant="outline" className={`text-[8px] ${statusColor(slaStatus)}`}>
          {slaStatus === "ready" ? "Ready" : slaStatus === "in_progress" ? "In Progress" : "Not Started"}
        </Badge>
        <div className="ml-auto">
          <Button size="sm" className="h-7 text-[10px] gap-1" disabled={!dirty || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
          </Button>
        </div>
      </div>

      {/* Data Availability from Tender */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">Data Available from Tender</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-lg border p-3 ${hasSlaKpi ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">SLA/KPI Model</p>
              <p className={`text-xs font-semibold mt-1 ${hasSlaKpi ? "text-emerald-700" : "text-amber-700"}`}>
                {hasSlaKpi ? "Available from Solution Design" : "Not captured in tender"}
              </p>
            </div>
            <div className={`rounded-lg border p-3 ${hasNegotiatedTerms ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Negotiated Terms</p>
              <p className={`text-xs font-semibold mt-1 ${hasNegotiatedTerms ? "text-emerald-700" : "text-amber-700"}`}>
                {hasNegotiatedTerms ? "Available from Negotiation" : "Not captured"}
              </p>
            </div>
            <div className={`rounded-lg border p-3 ${slaRelatedChanges.length > 0 ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-slate-50/30"}`}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">SLA-Related Changes</p>
              <p className={`text-xs font-semibold mt-1 ${slaRelatedChanges.length > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                {slaRelatedChanges.length > 0 ? `${slaRelatedChanges.length} items from negotiation` : "None"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SLA Brief Fields */}
      <Card className="border-border shadow-none">
        <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#075eea]" />
            <span className="text-xs font-semibold">SLA Handover Brief</span>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-[10px] font-semibold text-muted-foreground">SLA Status</label>
              <Select value={slaStatus} onValueChange={v => { setSlaStatus(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started" className="text-xs">Not Started</SelectItem>
                  <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                  <SelectItem value="ready" className="text-xs">Ready for SLA Handoff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">SLA Owner</label>
              <Input className="h-8 text-xs mt-1" value={slaOwner} onChange={e => { setSlaOwner(e.target.value); mark(); }} placeholder="Who is responsible for the SLA" /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Target SLA Completion</label>
              <Input type="date" className="h-8 text-xs mt-1" value={targetSlaDate} onChange={e => { setTargetSlaDate(e.target.value); mark(); }} /></div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">Reporting Cadence</label>
              <Select value={reportingCadence} onValueChange={v => { setReportingCadence(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                  <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><label className="text-[10px] font-semibold text-muted-foreground">SLA Review Period</label>
              <Select value={reviewPeriod} onValueChange={v => { setReviewPeriod(v); mark(); }}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                  <SelectItem value="quarterly" className="text-xs">Quarterly</SelectItem>
                  <SelectItem value="semi_annual" className="text-xs">Semi-Annual</SelectItem>
                  <SelectItem value="annual" className="text-xs">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4"><label className="text-[10px] font-semibold text-muted-foreground">Service Lines Covered</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={serviceLines} onChange={e => { setServiceLines(e.target.value); mark(); }} placeholder="e.g. Warehousing, Transport, Value-Added Services..." /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">KPI Summary</label>
            <Textarea className="text-xs mt-1 min-h-[60px]" value={kpiSummary} onChange={e => { setKpiSummary(e.target.value); mark(); }} placeholder="Key KPIs and targets agreed (e.g. 99.5% order accuracy, 98% on-time delivery...)" /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Penalty / Credit Structure</label>
            <Textarea className="text-xs mt-1 min-h-[50px]" value={penaltyStructure} onChange={e => { setPenaltyStructure(e.target.value); mark(); }} placeholder="What happens when KPIs are missed..." /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Exclusions / Force Majeure</label>
            <Textarea className="text-xs mt-1 min-h-[40px]" value={exclusions} onChange={e => { setExclusions(e.target.value); mark(); }} placeholder="What is excluded from SLA measurement..." /></div>
          <div className="mt-3"><label className="text-[10px] font-semibold text-muted-foreground">Notes</label>
            <Textarea className="text-xs mt-1 min-h-[40px]" value={notes} onChange={e => { setNotes(e.target.value); mark(); }} placeholder="Additional SLA notes..." /></div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-dashed border-[#075eea]/20 bg-[#075eea]/10">
        <Target className="w-4 h-4 text-[#5b9cff]" />
        <div>
          <p className="text-xs font-medium text-[#075eea]">Tender-local SLA handoff only</p>
          <p className="text-[10px] text-[#0b73ff]">When the clean SLA process is rebuilt, this brief can be reviewed by a user before any SLA record is created.</p>
        </div>
      </div>
    </div>
  );
}
