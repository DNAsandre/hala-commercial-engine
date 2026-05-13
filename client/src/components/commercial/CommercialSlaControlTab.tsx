/**
 * CW-009: SLA Control Mock Layer
 * Mock-only — no real SLA, PDF, CRM, approval, or document generation.
 * SUPA-003B: Now reads from Supabase via useCommercialWorkspaceData.
 * SUPA-004: Actions now write to Supabase.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle, Eye, Play, ShieldAlert, ChevronDown, ChevronRight, Link2, Info, ClipboardCheck, BarChart3, Scale, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { type CommercialSlaDraft, getSlaDraftsForWorkspace, getSlaSections, getSlaKpis, getSlaPromiseGaps, getLinkedCommercialBasis } from "@/lib/commercial-workspace-data";
import { useCommercialWorkspaceData } from "@/hooks/useCommercialWorkspaceData";
import type { SlaBundleForDraft } from "@/lib/supabase-commercial-data";
import { logMockAction, markSlaReviewedMock, requestSlaOpsReviewMock, requestSlaLegalReviewMock, type ActionActor } from "@/lib/supabase-commercial-actions";
import { useAuth } from "@/contexts/AuthContext";

const riskColor = (r: string) => r === "Critical" ? "text-red-700 bg-red-100 border-red-300" : r === "High" ? "text-red-600 bg-red-50 border-red-200" : r === "Medium" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
const statusColor = (s: string) => s.includes("Lock Warning") || s.includes("Review Needed") ? "text-red-600 bg-red-50 border-red-200" : s.includes("Linked") || s.includes("Draft") ? "text-amber-700 bg-amber-50 border-amber-200" : s.includes("Reviewed") || s.includes("Ready") ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-600 bg-slate-50 border-slate-200";
const lockColor = (s: string) => s === "Not Locked" || s === "Future Lock Required" ? "text-red-600 bg-red-50 border-red-200" : s === "Mock Linked" || s === "Pricing Lock Warning" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
const gateColor = (s: string) => s.includes("Would Require") ? "text-red-600 bg-red-50 border-red-200" : s.includes("Warning") ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
const escColor = (s: string) => s.startsWith("Critical") ? "text-red-700 bg-red-100 border-red-300" : s.startsWith("Red") ? "text-red-600 bg-red-50 border-red-200" : s.startsWith("Amber") ? "text-amber-700 bg-amber-50 border-amber-200" : "text-emerald-700 bg-emerald-50 border-emerald-200";
const readinessColor = (r: number) => r >= 70 ? "text-emerald-600" : r >= 50 ? "text-amber-600" : "text-red-600";
const getGpBg = (sla: CommercialSlaDraft) => sla.riskLevel === "Critical" ? "border-l-red-500" : sla.riskLevel === "High" ? "border-l-red-400" : sla.riskLevel === "Medium" ? "border-l-amber-400" : "border-l-emerald-400";

function SlaCard({ s, selected, onSelect }: { s: CommercialSlaDraft; selected: boolean; onSelect: () => void }) {
  return (
    <Card className={`border shadow-none transition-all cursor-pointer border-l-4 ${getGpBg(s)} ${selected ? "ring-2 ring-[var(--color-hala-navy)] bg-muted/20" : "hover:bg-muted/10"}`} onClick={onSelect}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2"><ClipboardCheck className={`w-3.5 h-3.5 ${selected ? "text-[var(--color-hala-navy)]" : "text-muted-foreground"}`} /><span className="text-sm font-semibold">{s.slaName}</span></div>
          <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[9px]">{s.version}</Badge><Badge variant="outline" className={`text-[9px] ${statusColor(s.status)}`}>{s.status}</Badge></div>
        </div>
        <div className="grid grid-cols-4 gap-3 text-xs mb-2">
          <div><span className="text-muted-foreground">Linked Proposal</span><p className="font-medium truncate">{s.linkedProposalName}</p></div>
          <div><span className="text-muted-foreground">Pricing Lock</span><p className="font-medium">{s.pricingLockStatus}</p></div>
          <div><span className="text-muted-foreground">KPI Ready</span><p className={`font-bold ${readinessColor(s.kpiReadiness)}`}>{s.kpiReadiness}%</p></div>
          <div><span className="text-muted-foreground">Promise Gaps</span><p className={`font-bold ${s.promiseGapCount > 2 ? "text-red-600" : s.promiseGapCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>{s.promiseGapCount}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><span className="text-muted-foreground">Risk</span><p className="font-medium">{s.riskLevel}</p></div>
          <div><span className="text-muted-foreground">Gate</span><p className="font-medium">{s.futureGateStatus}</p></div>
          <div><span className="text-muted-foreground">Escalation</span><p className="font-medium">{s.mockEscalationStatus}</p></div>
        </div>
        {s.pricingLockStatus === "Not Locked" || s.pricingLockStatus === "Future Lock Required" ? (
          <div className="mt-2 p-2 rounded-md border border-red-200 bg-red-50 flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" /><p className="text-[10px] text-red-700">Future Gate: SLA should reflect locked pricing and agreed commercial terms. Current mode: mock warning only.</p></div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SlaDetailPanel({ s, slaBundle, workspaceId, onActionComplete }: { s: CommercialSlaDraft; slaBundle?: SlaBundleForDraft; workspaceId?: string; onActionComplete?: () => void }) {
  const { appUser } = useAuth();
  const actor: ActionActor = { name: appUser?.name ?? 'Development User', role: appUser?.role ?? 'Commercial Tester' };

  const mkAction = async (eventType: string, title: string, desc: string, code: string, after: string) => {
    if (!workspaceId) { toast.info(`${title}. No backend update.`); return; }
    const result = await logMockAction(
      { workspaceId, eventType, title, description: desc, category: 'SLA', actor, severity: 'Info', relatedArtifact: s.slaName, relatedModule: 'SLA Control', relatedScenarioId: s.linkedQuoteScenarioId },
      { workspaceId, eventCode: code, eventName: title, description: desc, category: 'SLA', actor, entityType: 'SLA', entityName: s.slaName, beforeState: s.status, afterState: after, severity: 'Info' }
    );
    if (result.success) { toast.success(`${title} saved to Supabase.`); onActionComplete?.(); }
    else { toast.error(`Mock action could not be saved: ${result.error}`); }
  };

  const basis = getLinkedCommercialBasis(s);
  // SUPA-003B: Use Supabase-backed section/kpi/gap data when available
  const sections = slaBundle ? slaBundle.sections : getSlaSections(s.id);
  const kpis = slaBundle ? slaBundle.kpis : getSlaKpis(s.id);
  const gaps = slaBundle ? slaBundle.promiseGaps : getSlaPromiseGaps(s.id);
  const isCritical = s.riskLevel === "Critical";
  const isHigh = s.riskLevel === "High";
  return (
    <div className="space-y-4">
      {/* Detail card */}
      <Card className="border shadow-none">
        <CardHeader className="pb-2 border-b"><div className="flex items-center justify-between"><CardTitle className="text-sm font-serif flex items-center gap-2"><Eye className="w-4 h-4 text-[var(--color-hala-navy)]" />{s.slaName} — {s.version}</CardTitle><Badge variant="outline" className={`text-[10px] ${statusColor(s.status)}`}>{s.status}</Badge></div></CardHeader>
        <CardContent className="pt-3 space-y-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[{l:"Pricing Lock",v:s.pricingLockStatus,c:""},{l:"KPI Ready",v:`${s.kpiReadiness}%`,c:readinessColor(s.kpiReadiness)},{l:"Resp. Ready",v:`${s.responsibilityReadiness}%`,c:readinessColor(s.responsibilityReadiness)},{l:"Promise Gaps",v:String(s.promiseGapCount),c:s.promiseGapCount>2?"text-red-600":""},{l:"Risk",v:s.riskLevel,c:s.riskLevel==="Critical"?"text-red-700":s.riskLevel==="High"?"text-red-600":"text-amber-600"},{l:"Owner",v:s.owner,c:""}].map(i=>(
              <div key={i.l} className="bg-muted/30 rounded-lg p-2.5"><p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{i.l}</p><p className={`text-sm font-bold mt-0.5 ${i.c}`}>{i.v}</p></div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[{l:"Ops Review",v:s.opsReviewStatus},{l:"Legal Review",v:s.legalReviewStatus},{l:"Commercial Terms",v:s.commercialTermsStatus},{l:"Escalation Matrix",v:s.escalationMatrixStatus}].map(i=>(
              <div key={i.l}><span className="text-muted-foreground">{i.l}</span><p className="mt-0.5"><Badge variant="outline" className={`text-[9px] ${statusColor(i.v)}`}>{i.v}</Badge></p></div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {[{l:"Future Gate",v:s.futureGateStatus,c:gateColor},{l:"Escalation",v:s.mockEscalationStatus,c:escColor},{l:"Linked Quote",v:s.linkedQuoteScenarioName,c:()=>""}].map(i=>(
              <div key={i.l}><span className="text-muted-foreground">{i.l}</span><p className="mt-0.5"><Badge variant="outline" className={`text-[9px] ${i.c(i.v)}`}>{i.v}</Badge></p></div>
            ))}
          </div>
          {/* Linked Commercial Basis */}
          {basis && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-[var(--color-hala-navy)]" /> Linked Commercial Basis</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                {[{l:"Proposal",v:basis.proposalName},{l:"Quote",v:basis.quoteName},{l:"GP%",v:`${basis.quoteGpPercent}%`},{l:"Posture",v:basis.pricingPosture},{l:"P&L Confidence",v:basis.pnlConfidence}].map(f=>(
                  <div key={f.l} className="bg-white rounded p-1.5"><p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{f.l}</p><p className="font-medium mt-0.5">{f.v}</p></div>
                ))}
              </div>
            </div>
          )}
          {/* Critical SLA Warning */}
          {isCritical && (
            <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 flex items-start gap-2"><ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /><div><p className="text-xs font-semibold text-red-800">Critical SLA Risk — Mock escalation created. Production would require commercial, operations, legal, and executive review before finalization. Testing may continue.</p><p className="text-[10px] text-red-700 mt-0.5">No real SLA document will be generated.</p></div></div>
          )}
          {isHigh && !isCritical && (
            <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><div><p className="text-xs font-semibold text-amber-800">Future Gate: SLA should reflect locked pricing and agreed commercial terms. Current mode: mock warning only.</p></div></div>
          )}
          {s.notes && <div className="text-xs text-muted-foreground"><span className="font-medium">Notes:</span> {s.notes}</div>}
          <div className="flex items-center gap-2 pt-2 border-t border-dashed flex-wrap">
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={async () => {
              if (workspaceId) {
                const result = await markSlaReviewedMock(s.id, workspaceId, s.slaName, actor);
                if (result.success) { toast.success("SLA review saved to Supabase."); onActionComplete?.(); }
                else { toast.error(`Mock action could not be saved: ${result.error}`); }
              } else { toast.info(`Mock SLA review logged for "${s.version}". No external action.`); }
            }}><Eye className="w-3.5 h-3.5" /> Review SLA Mock</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={async () => {
              if (workspaceId) {
                const result = await requestSlaOpsReviewMock(s.id, workspaceId, s.slaName, actor);
                if (result.success) { toast.success("Ops review requested in Supabase."); onActionComplete?.(); }
                else { toast.error(`Mock action could not be saved: ${result.error}`); }
              } else { toast.info("Mock Ops review requested. No external action."); }
            }}><ClipboardCheck className="w-3.5 h-3.5" /> Request Ops Review Mock</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={async () => {
              if (workspaceId) {
                const result = await requestSlaLegalReviewMock(s.id, workspaceId, s.slaName, actor);
                if (result.success) { toast.success("Legal review requested in Supabase."); onActionComplete?.(); }
                else { toast.error(`Mock action could not be saved: ${result.error}`); }
              } else { toast.info("Mock Legal review requested. No external action."); }
            }}><Scale className="w-3.5 h-3.5" /> Request Legal Review Mock</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => mkAction('sla_preview_mock', 'SLA Preview Mock', `Mock SLA preview generated for "${s.version}". No real PDF.`, 'SLA_PREVIEW_MOCK', 'Preview Generated')}><FileText className="w-3.5 h-3.5" /> SLA Preview Mock</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 text-blue-700 border-blue-200" onClick={() => mkAction('sla_bypass_mock', 'SLA Testing Bypass', 'Continue for testing — no enforcement applied.', 'SLA_BYPASS_MOCK', 'Testing Bypass')}><Play className="w-3.5 h-3.5" /> Continue for Testing</Button>
          </div>
        </CardContent>
      </Card>

      {/* SLA Sections Readiness */}
      {sections.length > 0 && (
        <Card className="border shadow-none">
          <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-serif flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-[var(--color-hala-navy)]" /> SLA Sections Readiness<Badge variant="outline" className="text-[9px]">{sections.length} sections</Badge></CardTitle></CardHeader>
          <CardContent className="pt-3"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-muted-foreground">{["Section","Category","Status","Owner","Ready","Risk","Notes"].map(h=><th key={h} className={`text-left py-1 font-semibold ${h==="Ready"?"text-right":""}`}>{h}</th>)}</tr></thead><tbody>{sections.map(sec=>(
            <tr key={sec.id} className="border-b last:border-0">
              <td className="py-1.5 font-semibold">{sec.sectionName}</td>
              <td className="py-1.5">{sec.category}</td>
              <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${statusColor(sec.status)}`}>{sec.status}</Badge></td>
              <td className="py-1.5">{sec.owner}</td>
              <td className={`py-1.5 text-right font-bold ${readinessColor(sec.readiness)}`}>{sec.readiness}%</td>
              <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${riskColor(sec.riskLevel)}`}>{sec.riskLevel}</Badge></td>
              <td className="py-1.5 text-muted-foreground max-w-[200px] truncate">{sec.notes}</td>
            </tr>
          ))}</tbody></table></div></CardContent>
        </Card>
      )}

      {/* KPI Register */}
      {kpis.length > 0 && (
        <Card className="border shadow-none">
          <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-serif flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[var(--color-hala-navy)]" /> KPI Register<Badge variant="outline" className="text-[9px]">{kpis.length} KPIs</Badge></CardTitle></CardHeader>
          <CardContent className="pt-3"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-muted-foreground">{["KPI","Target","Method","Owner","Ready","Risk","Notes"].map(h=><th key={h} className={`text-left py-1 font-semibold ${h==="Ready"?"text-right":""}`}>{h}</th>)}</tr></thead><tbody>{kpis.map(k=>(
            <tr key={k.id} className="border-b last:border-0">
              <td className="py-1.5 font-semibold">{k.kpiName}</td>
              <td className="py-1.5">{k.target}</td>
              <td className="py-1.5">{k.measurementMethod}</td>
              <td className="py-1.5">{k.owner}</td>
              <td className={`py-1.5 text-right font-bold ${readinessColor(k.readiness)}`}>{k.readiness}%</td>
              <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${riskColor(k.riskLevel)}`}>{k.riskLevel}</Badge></td>
              <td className="py-1.5 text-muted-foreground max-w-[200px] truncate">{k.notes}</td>
            </tr>
          ))}</tbody></table></div></CardContent>
        </Card>
      )}

      {/* Promise Gaps */}
      {gaps.length > 0 && (
        <Card className="border shadow-none border-l-4 border-l-amber-400">
          <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-serif flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Commercial Promise Gaps<Badge variant="outline" className="text-[9px]">{gaps.length} gap{gaps.length!==1?"s":""}</Badge></CardTitle></CardHeader>
          <CardContent className="pt-3 space-y-2">
            <div className="text-[10px] text-muted-foreground bg-muted/20 rounded-lg p-2">Promise gaps show where SLA commitments may differ from pricing, capacity, or operational reality. Current mode: mock warning only.</div>
            {gaps.map(g=>(
              <div key={g.id} className={`rounded-lg border p-2.5 space-y-1 ${g.severity==="Critical"?"border-red-200 bg-red-50/30":g.severity==="High"?"border-red-200 bg-red-50/20":"border-amber-200 bg-amber-50/20"}`}>
                <div className="flex items-center justify-between"><span className="text-xs font-semibold">{g.promise}</span><Badge variant="outline" className={`text-[8px] ${riskColor(g.severity)}`}>{g.severity}</Badge></div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-red-50/30 rounded p-1.5 border border-red-100"><p className="text-[8px] font-semibold uppercase text-red-700">Operational Reality</p><p className="mt-0.5">{g.operationalReality}</p></div>
                  <div className="bg-amber-50/30 rounded p-1.5 border border-amber-100"><p className="text-[8px] font-semibold uppercase text-amber-700">Impact</p><p className="mt-0.5">{g.impact}</p></div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground"><span>Owner: <strong>{g.owner}</strong></span><span>Action: {g.recommendedAction}</span>{g.wouldEscalateInProduction && <Badge variant="outline" className="text-[8px] text-red-600 bg-red-50 border-red-200">Would Escalate</Badge>}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SlaComparisonSummary({ drafts }: { drafts: CommercialSlaDraft[] }) {
  if (drafts.length < 2) return null;
  return (
    <Card className="border shadow-none">
      <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-serif flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-[var(--color-hala-navy)]" /> SLA Comparison</CardTitle></CardHeader>
      <CardContent className="pt-3"><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-muted-foreground">{["Version","Linked Proposal","KPI Ready","Pricing Lock","Gaps","Risk","Gate","Escalation"].map(h=><th key={h} className={`text-left py-1 font-semibold ${h==="KPI Ready"||h==="Gaps"?"text-right":""}`}>{h}</th>)}</tr></thead><tbody>{drafts.map(d=>(
        <tr key={d.id} className="border-b last:border-0">
          <td className="py-1.5 font-semibold">{d.version}</td>
          <td className="py-1.5 truncate max-w-[150px]">{d.linkedProposalName}</td>
          <td className={`py-1.5 text-right font-bold ${readinessColor(d.kpiReadiness)}`}>{d.kpiReadiness}%</td>
          <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${lockColor(d.pricingLockStatus)}`}>{d.pricingLockStatus}</Badge></td>
          <td className={`py-1.5 text-right font-bold ${d.promiseGapCount>2?"text-red-600":"text-amber-600"}`}>{d.promiseGapCount}</td>
          <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${riskColor(d.riskLevel)}`}>{d.riskLevel}</Badge></td>
          <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${gateColor(d.futureGateStatus)}`}>{d.futureGateStatus}</Badge></td>
          <td className="py-1.5"><Badge variant="outline" className={`text-[8px] ${escColor(d.mockEscalationStatus)}`}>{d.mockEscalationStatus}</Badge></td>
        </tr>
      ))}</tbody></table></div></CardContent>
    </Card>
  );
}

interface Props { workspaceId: string; customerName?: string; }

export default function CommercialSlaControlTab({ workspaceId, customerName }: Props) {
  const { bundle, status, reload } = useCommercialWorkspaceData(workspaceId);

  // SUPA-003B: Use Supabase-backed SLA data when available
  const drafts = bundle && bundle.slaBundles.length > 0
    ? bundle.slaBundles.map(sb => sb.draft)
    : getSlaDraftsForWorkspace(workspaceId);
  const isSupabaseBacked = bundle?.supabaseBacked && bundle.slaBundles.length > 0;

  const [selectedId, setSelectedId] = useState<string>(drafts[0]?.id || "");
  const [detailExpanded, setDetailExpanded] = useState(true);
  const selected = drafts.find(d => d.id === selectedId) || drafts[0];
  const selectedSlaBundle = bundle?.slaBundles.find(sb => sb.draft.id === selectedId);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-hala-navy)]" />
        <span className="text-sm text-muted-foreground">Loading SLA data from Supabase…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-base font-serif font-bold flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-[var(--color-hala-navy)]" /> SLA Control</h3><p className="text-xs text-muted-foreground">Mock SLA drafts for {customerName || "this workspace"}</p></div>
        <div className="flex items-center gap-2">
          {isSupabaseBacked && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><Database className="w-3 h-3 mr-1" />Supabase-Backed</Badge>}
          <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200">CRM Sync: Mock / Not Connected</Badge><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Development Mode</Badge>
        </div>
      </div>
      <Card className="border-2 border-amber-200 shadow-none bg-amber-50/50"><CardContent className="p-3"><div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" /><div><div className="text-sm font-semibold text-amber-800 mb-0.5">Development mode: SLA controls are mock-only</div><p className="text-xs text-amber-700 leading-relaxed">Future gates show pricing-lock, Ops, and Legal review requirements but do not block testing or generate real SLA documents.</p></div></div></CardContent></Card>
      <div className="space-y-3">
        <div className="flex items-center gap-2"><h4 className="text-sm font-semibold">SLA Drafts</h4><Badge variant="outline" className="text-[9px]">{drafts.length} draft{drafts.length!==1?"s":""}</Badge></div>
        {drafts.map(d => <SlaCard key={d.id} s={d} selected={selectedId===d.id} onSelect={()=>setSelectedId(d.id)} />)}
      </div>
      {selected && (
        <div>
          <button className="flex items-center gap-1.5 text-sm font-semibold mb-2 hover:text-[var(--color-hala-navy)] transition-colors" onClick={()=>setDetailExpanded(!detailExpanded)}>{detailExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}Selected SLA Detail</button>
          {detailExpanded && <SlaDetailPanel s={selected} slaBundle={selectedSlaBundle} workspaceId={workspaceId} onActionComplete={reload} />}
        </div>
      )}
      <SlaComparisonSummary drafts={drafts} />
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2"><Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /><p className="text-xs text-blue-800">All SLA controls are mock-only for development. SLA drafts, KPIs, promise gaps, and future gates show decision paths but do not generate real documents, sync with CRM, or enforce approvals.</p></div>
    </div>
  );
}
