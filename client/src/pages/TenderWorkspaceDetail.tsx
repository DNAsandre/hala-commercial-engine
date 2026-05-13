import { useParams, Link } from "wouter";
import { useState } from "react";
import { ArrowLeft, Package, ShieldAlert, AlertTriangle, CheckCircle2, Clock, DollarSign, Target, Users, Building2, CalendarDays, Radio, FileText, Truck, ClipboardList, FolderOpen, Activity, ScrollText, Info, XCircle, Wrench, FlaskConical, FileOutput, Eye, Mail, Loader2, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatSAR } from "@/lib/store";
import { getTenderStatusDisplayName, getTenderStatusColor, type TenderMilestone } from "@/lib/tender-engine";
import { getPackStatusLabel, getPackTypeLabel, getGateStatusLabel, getSectionStatusLabel, getSectionStatusColor, getSectionApprovalLabel, type TenderWorkspace, type TenderPack } from "@/lib/tender-workspace-data";
import { useTenderWorkspaceData } from "@/hooks/useTenderWorkspaceData";
import { toast } from "sonner";
import { updateTenderPhase } from "@/lib/supabase-tender-actions";
import { LifecycleLight, getLightState } from "@/components/LifecycleLight";
import TenderPlaceholdersTab from "@/components/tender/TenderPlaceholdersTab";
import TenderRequiredDocumentsTab from "@/components/tender/TenderRequiredDocumentsTab";
import TenderComplianceMatrixTab from "@/components/tender/TenderComplianceMatrixTab";
import TenderSubmissionGatesTab from "@/components/tender/TenderSubmissionGatesTab";
import TenderSplitPackGenerator from "@/components/tender/TenderSplitPackGenerator";
import TenderSubmissionEmailSimulator from "@/components/tender/TenderSubmissionEmailSimulator";
import TenderActivityTab from "@/components/tender/TenderActivityTab";
import TenderAuditTrailTab from "@/components/tender/TenderAuditTrailTab";

const LIFECYCLE_STAGES: { value: string; label: string }[] = [
  { value: "identified", label: "Identified" },
  { value: "bid_no_bid", label: "Bid / No-Bid" },
  { value: "preparing_submission", label: "Preparing" },
  { value: "internal_review", label: "Internal Review" },
  { value: "approved_for_submission", label: "Approved" },
  { value: "submitted", label: "Submitted" },
  { value: "clarification", label: "Clarification" },
  { value: "technical_review", label: "Tech Review" },
  { value: "commercial_review", label: "Commercial" },
  { value: "negotiation", label: "Negotiation" },
  { value: "awarded", label: "Awarded" },
  { value: "lost", label: "Lost" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "contract_conversion", label: "Contract" },
];

function mapStageToLifecycle(status: TenderMilestone): string {
  return status;
}



function riskBadge(level: string) {
  if (level === "red") return <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-50">High Risk</Badge>;
  if (level === "amber") return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Amber</Badge>;
  return <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">On Track</Badge>;
}

function PackCard({ pack }: { pack: TenderPack }) {
  return (
    <Card className={`border ${pack.isMaster ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10" : "border-border"}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{pack.packName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{getPackTypeLabel(pack.packType)}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${pack.isExternalSubmittable ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}>
            {pack.isExternalSubmittable ? "External" : "Internal Only"}
          </Badge>
        </div>
        {pack.isMaster && (
          <>
            <div className="mb-3 p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center gap-1.5 text-xs text-amber-800"><ShieldAlert className="w-3.5 h-3.5" /> Internal only — not for external submission</div>
            </div>
            <div className="mb-3 p-2 rounded-md border border-red-200 bg-red-50/50">
              <p className="text-[10px] text-red-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Mock Gate: Production would prevent external submission of this pack.</p>
            </div>
          </>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Readiness</span><span className="text-xs font-bold">{pack.readinessScore}%</span></div>
          <div className="w-full bg-muted rounded-full h-1.5"><div className="h-1.5 rounded-full bg-[var(--color-hala-navy)]" style={{ width: `${pack.readinessScore}%` }} /></div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="text-[10px] text-muted-foreground">Status: <span className="font-medium text-foreground">{getPackStatusLabel(pack.status)}</span></div>
            <div className="text-[10px] text-muted-foreground">Owner: <span className="font-medium text-foreground">{pack.ownerName}</span></div>
            <div className="text-[10px] text-muted-foreground">Sections: <span className="font-medium text-foreground">{pack.sectionsDrafted}/{pack.sectionsTotal}</span></div>
            <div className="text-[10px] text-muted-foreground">Placeholders: <span className="font-medium text-foreground">{pack.placeholdersPopulated}/{pack.placeholdersTotal}</span></div>
            <div className="text-[10px] text-muted-foreground">Documents: <span className="font-medium text-foreground">{pack.documentsReady}/{pack.documentsTotal}</span></div>
            <div className="text-[10px] text-muted-foreground">Compliance: <span className="font-medium text-foreground">{pack.complianceCompliant}/{pack.complianceTotal}</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlaceholderTab({ title, fields }: { title: string; fields: string[] }) {
  return (
    <div>
      <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <p className="text-xs text-blue-700 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Coming next sprint — placeholder only.</p>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-2.5 border-b"><span className="text-xs font-semibold">{title}</span></div>
        <div className="p-4 space-y-2">
          {fields.map(f => <div key={f} className="text-xs text-muted-foreground py-1 border-b border-dashed border-border last:border-0">• {f}</div>)}
        </div>
      </div>
    </div>
  );
}

export default function TenderWorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [splitGenOpen, setSplitGenOpen] = useState(false);
  const [emailSimOpen, setEmailSimOpen] = useState(false);

  // SUPA-006: Supabase-backed data load
  const { ws, status, errorMessage, reload } = useTenderWorkspaceData(id!);

  if (status === 'loading') return (
    <div className="p-6 flex items-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading tender workspace from Supabase…</span>
    </div>
  );

  if (status === 'error') return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-serif text-red-700">Failed to load tender workspace</h1>
      <p className="text-sm text-muted-foreground">{errorMessage}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
        <Link href="/tenders"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link>
      </div>
    </div>
  );

  if (status === 'empty' || !ws) return (
    <div className="p-6">
      <h1 className="text-xl font-serif">Tender workspace not found</h1>
      <p className="text-xs text-muted-foreground mt-1">No Supabase data found for tender ID: {id}</p>
      <Link href="/tenders"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1.5" />Back to Tenders</Button></Link>
    </div>
  );

  const t = ws.tender;
  const daysLeft = Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / 86400000);
  const currentStageIdx = LIFECYCLE_STAGES.findIndex(s => s.value === mapStageToLifecycle(t.status));
  const wouldBlockCount = ws.mockGates.filter(g => g.wouldBlock).length;
  const selectedPack = ws.packs.find(p => p.id === selectedPackId) ?? (ws.packs.length > 0 ? ws.packs[0] : null);

  return (
    <TooltipProvider>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Back */}
        <div className="mb-3"><Link href="/tenders"><Button variant="ghost" size="sm" className="text-xs gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Back to Tenders</Button></Link></div>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ws.riskLevel === "red" ? "bg-red-500" : ws.riskLevel === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
            <h1 className="text-xl font-serif font-bold">{t.title}</h1>
            <Badge variant="outline" className="text-[10px] border-violet-300 text-violet-700 bg-violet-50">{ws.tenderType}</Badge>
            <Badge variant="outline" className={`text-[10px] ${getTenderStatusColor(t.status)}`}>{getTenderStatusDisplayName(t.status)}</Badge>
            {riskBadge(ws.riskLevel)}
            <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-600">CRM: {ws.crmSyncStatus === "simulated" ? "Simulated" : ws.crmSyncStatus === "not_synced" ? "Not Synced" : ws.crmSyncStatus}</Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{t.customerName}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.assignedOwner}</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Due: <span className="font-medium text-foreground">{t.submissionDeadline}</span></span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{formatSAR(t.estimatedValue)}</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" />GP: {t.targetGpPercent}%</span>
            <span>Readiness: <span className="font-medium text-foreground">{ws.readinessScore}%</span></span>
          </div>
        </div>

        {/* Lifecycle Tracker */}
        <Card className="border shadow-none mb-4"><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tender Lifecycle Tracker</span>
          </div>
          <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
            {LIFECYCLE_STAGES.map((s, i) => {
              const isCurrent = i === currentStageIdx;
              const isPast = i < currentStageIdx && currentStageIdx >= 0;
              const canClick = !isCurrent;
              return (
                <div key={s.value} className="flex items-center shrink-0">
                  <button
                    disabled={isCurrent}
                    onClick={async () => {
                      if (isCurrent) return;
                      const result = await updateTenderPhase(id!, t.status, s.value as any, 'Manual stage movement');
                      if (result.success) {
                        toast.success(`Stage moved to ${s.label}`, { description: 'Persisted to Supabase.' });
                        reload();
                      } else {
                        toast.warning('Stage change failed — UI not blocked.', { description: result.error });
                      }
                    }}
                    className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all ${canClick ? 'cursor-pointer hover:ring-2 hover:ring-[var(--color-hala-navy)]/30' : ''} ${isCurrent ? "bg-[var(--color-hala-navy)] text-white shadow-md" : isPast ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "text-muted-foreground/50"}`}
                  >
                    <LifecycleLight state={getLightState(i, currentStageIdx, false)} size={10} className="mb-1" />
                    <span className={`text-[9px] font-medium whitespace-nowrap ${isCurrent ? "text-white font-semibold" : ""}`}>{s.label}</span>
                  </button>
                  {i < LIFECYCLE_STAGES.length - 1 && <div className={`h-px w-3 shrink-0 ${i < currentStageIdx ? "bg-emerald-400" : "bg-muted-foreground/15"}`} />}
                </div>
              );
            })}
          </div>
        </CardContent></Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-4">
          {[
            { label: "Value", value: formatSAR(t.estimatedValue), icon: <DollarSign className="w-3 h-3" /> },
            { label: "Target GP", value: `${t.targetGpPercent}%`, icon: <Target className="w-3 h-3" /> },
            { label: "Deadline", value: daysLeft > 0 ? `${daysLeft}d` : "Passed", icon: <Clock className="w-3 h-3" /> },
            { label: "Readiness", value: `${ws.readinessScore}%`, icon: <Radio className="w-3 h-3" /> },
            { label: "Packs", value: String(ws.packs.length), icon: <Package className="w-3 h-3" /> },
            { label: "Mock Gates", value: `${wouldBlockCount} would block`, icon: <ShieldAlert className="w-3 h-3" /> },
            { label: "Compliance", value: "Placeholder", icon: <ClipboardList className="w-3 h-3" /> },
            { label: "CRM Sync", value: ws.crmSyncStatus === "simulated" ? "Simulated" : "Not Synced", icon: <Radio className="w-3 h-3" /> },
          ].map(c => (
            <div key={c.label} className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">{c.icon} {c.label}</span>
              <span className="text-sm font-bold font-mono text-foreground leading-tight">{c.value}</span>
            </div>
          ))}
        </div>

        {/* Dev Mode Banner */}
        <div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-2.5">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700">Development mode: gates are mock warnings only. Nothing is hard-blocked.</p>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
            {["Overview","Packs","Placeholders","Commercial","Delivery","Compliance Matrix","Required Documents","Submission Gates","Activity","Audit Trail"].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase().replace(/ /g, "_")} className="text-xs">{t}</TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="space-y-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Executive Summary</CardTitle></CardHeader><CardContent>
                <p className="text-xs text-muted-foreground">{ws.tenderType} for {t.customerName}. Value: {formatSAR(t.estimatedValue)}. Target GP: {t.targetGpPercent}%. Currently in <span className="font-medium text-foreground">{getTenderStatusDisplayName(t.status)}</span> stage. {ws.packs.length} packs configured ({ws.packs.filter(p => p.isMaster).length} master, {ws.packs.filter(p => !p.isMaster).length} external).</p>
              </CardContent></Card>
              <Card className="border-amber-200 bg-amber-50/30"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-600" /> Next Best Action</CardTitle></CardHeader><CardContent>
                <p className="text-xs text-amber-800 font-medium">Complete Required Documents</p>
                <p className="text-xs text-amber-700 mt-1">Bulk Pack is missing signed OBK and Bid Statement. {wouldBlockCount} mock gates would block production submission.</p>
              </CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pack Readiness</CardTitle></CardHeader><CardContent>
                <div className="space-y-3">
                  {ws.packs.map(p => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="text-xs w-48 truncate">{p.packName}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5"><div className="h-1.5 rounded-full bg-[var(--color-hala-navy)]" style={{ width: `${p.readinessScore}%` }} /></div>
                      <span className="text-xs font-mono w-10 text-right">{p.readinessScore}%</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Key Risks</CardTitle></CardHeader><CardContent>
                <div className="space-y-1.5">
                  {[`${daysLeft} days to submission deadline`, `${wouldBlockCount} mock gates would block production`, `${ws.packs.reduce((s,p)=>s+p.placeholdersTotal-p.placeholdersPopulated,0)} placeholders still missing`, "OBK unsigned — needs finance sign-off"].map((r,i) => (
                    <div key={i} className="flex items-center gap-2 text-xs"><AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" /><span className="text-muted-foreground">{r}</span></div>
                  ))}
                </div>
              </CardContent></Card>
            </div>
          </TabsContent>

          {/* Packs */}
          <TabsContent value="packs">
            {ws.packs.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No packs configured yet.</p> : (
              <div className="space-y-4">
                {/* Dev mode banner */}
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-700">Development mode: pack actions are mock only. No document is generated, submitted, or locked.</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 shrink-0" onClick={() => setEmailSimOpen(true)}>
                    <Mail className="w-3.5 h-3.5" /> Simulate Submission Email
                  </Button>
                </div>

                {/* Pack selector cards */}
                <div className="grid gap-3 md:grid-cols-3">
                  {ws.packs.map(p => {
                    const isSelected = (selectedPack?.id === p.id);
                    return (
                      <button key={p.id} onClick={() => setSelectedPackId(p.id)} className={`text-left rounded-xl border-2 p-4 transition-all ${isSelected ? "border-[var(--color-hala-navy)] bg-[var(--color-hala-navy)]/5 shadow-md" : "border-border hover:border-muted-foreground/30 bg-background"} ${p.isMaster ? "ring-1 ring-amber-300/50" : ""}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div><p className="text-sm font-semibold">{p.packName}</p><p className="text-[10px] text-muted-foreground">{getPackTypeLabel(p.packType)}</p></div>
                          <Badge variant="outline" className={`text-[9px] ${p.isExternalSubmittable ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}>{p.isExternalSubmittable ? "External" : "Internal Only"}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 bg-muted rounded-full h-1.5"><div className="h-1.5 rounded-full bg-[var(--color-hala-navy)]" style={{ width: `${p.readinessScore}%` }} /></div>
                          <span className="text-xs font-mono font-bold">{p.readinessScore}%</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>Status: <span className="font-medium text-foreground">{getPackStatusLabel(p.status)}</span></span>
                          <span>Sections: <span className="font-medium text-foreground">{p.sections.filter(s => s.status === "approved").length}/{p.sections.length}</span></span>
                        </div>
                        {p.isMaster && <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700"><ShieldAlert className="w-3 h-3" /> Internal only — not submittable</div>}
                      </button>
                    );
                  })}
                </div>

                {/* Selected pack detail */}
                {selectedPack && (
                  <Card className={`border ${selectedPack.isMaster ? "border-amber-300" : "border-border"}`}>
                    <CardContent className="p-5 space-y-5">
                      {/* Pack header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-serif font-bold">{selectedPack.packName}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{getPackTypeLabel(selectedPack.packType)}</span>
                            <span>·</span>
                            <span>Owner: <span className="font-medium text-foreground">{selectedPack.ownerName}</span></span>
                            <span>·</span>
                            <span>v{selectedPack.version}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${selectedPack.isExternalSubmittable ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"}`}>{selectedPack.isExternalSubmittable ? "External Submittable" : "Internal Only"}</Badge>
                          <Badge variant="outline" className="text-[10px]">{getPackStatusLabel(selectedPack.status)}</Badge>
                        </div>
                      </div>

                      {/* Master pack warnings */}
                      {selectedPack.mockWarnings.length > 0 && (
                        <div className="space-y-2">
                          {selectedPack.mockWarnings.map((w, i) => (
                            <div key={i} className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                              <p className="text-xs text-amber-800 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 shrink-0" />{w}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Readiness breakdown */}
                      <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Readiness Breakdown</h4>
                        <div className="grid gap-2">
                          {(["sections", "placeholders", "required_documents", "compliance", "mock_gates", "outputs"] as const).map(key => {
                            const val = selectedPack.readinessBreakdown[key];
                            const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                            const barColor = val >= 70 ? "bg-emerald-500" : val >= 50 ? "bg-amber-500" : "bg-red-500";
                            return (
                              <div key={key} className="flex items-center gap-3">
                                <span className="text-xs w-40 text-muted-foreground">{label}</span>
                                <div className="flex-1 bg-muted rounded-full h-2"><div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${val}%` }} /></div>
                                <span className={`text-xs font-mono w-10 text-right font-bold ${val >= 70 ? "text-emerald-700" : val >= 50 ? "text-amber-700" : "text-red-700"}`}>{val}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Section list */}
                      <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sections ({selectedPack.sections.length})</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50"><tr>
                              <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                              <th className="px-3 py-2 text-left font-semibold">Section</th>
                              <th className="px-3 py-2 text-left font-semibold">Owner</th>
                              <th className="px-3 py-2 text-left font-semibold">Status</th>
                              <th className="px-3 py-2 text-center font-semibold">Missing</th>
                              <th className="px-3 py-2 text-left font-semibold">Updated</th>
                              <th className="px-3 py-2 text-left font-semibold">Approval</th>
                            </tr></thead>
                            <tbody>
                              {selectedPack.sections.map((sec, i) => (
                                <tr key={sec.id} className="border-t border-border hover:bg-muted/30">
                                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                  <td className="px-3 py-2 font-medium">{sec.title}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{sec.owner}</td>
                                  <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getSectionStatusColor(sec.status)}`}>{getSectionStatusLabel(sec.status)}</Badge></td>
                                  <td className="px-3 py-2 text-center">{sec.missingPlaceholders > 0 ? <span className="text-red-600 font-bold">{sec.missingPlaceholders}</span> : <span className="text-emerald-600">0</span>}</td>
                                  <td className="px-3 py-2 text-muted-foreground font-mono">{sec.lastUpdated}</td>
                                  <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getSectionApprovalLabel(sec.approvalState)}</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mock actions */}
                      <div>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pack Actions (Mock)</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedPack.mockActions.map(action => {
                            const icons: Record<string, typeof Wrench> = { "Open Pack Builder": Wrench, "Run Mock Split Check": FlaskConical, "Generate Test Output": FileOutput, "Review Mock Gates": Eye };
                            const Icon = icons[action] ?? Wrench;
                            const isSplitAction = action === "Run Mock Split Check" || action === "Generate Test Output";
                            return (
                              <Button key={action} variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => isSplitAction ? setSplitGenOpen(true) : toast.info(`Mock action: "${action}" — not yet connected.`, { description: "This is a development placeholder." })}>
                                <Icon className="w-3.5 h-3.5" /> {action}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Placeholders */}
          <TabsContent value="placeholders">
            <TenderPlaceholdersTab ws={ws} tenderId={id!} reload={reload} />
          </TabsContent>

          {/* Commercial */}
          <TabsContent value="commercial"><PlaceholderTab title="Commercial" fields={["OBK / pricing file","Target GP","Pricing assumptions","Fuel indexation","Performance guarantee","Margin approval status","Version history"]} /></TabsContent>

          {/* Delivery */}
          <TabsContent value="delivery"><PlaceholderTab title="Delivery" fields={["Fleet plan","Hubs","Transition plan","HSE","KPI model","Operational feasibility","Delivery owner"]} /></TabsContent>

          {/* Compliance Matrix */}
          <TabsContent value="compliance_matrix">
            <TenderComplianceMatrixTab ws={ws} tenderId={id!} reload={reload} />
          </TabsContent>

          {/* Required Documents */}
          <TabsContent value="required_documents">
            <TenderRequiredDocumentsTab ws={ws} tenderId={id!} reload={reload} />
          </TabsContent>

          {/* Submission Gates */}
          <TabsContent value="submission_gates">
            <TenderSubmissionGatesTab ws={ws} tenderId={id!} reload={reload} />
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity">
            <TenderActivityTab ws={ws} tenderId={id!} reload={reload} />
          </TabsContent>

          {/* Audit Trail */}
          <TabsContent value="audit_trail">
            <TenderAuditTrailTab ws={ws} />
          </TabsContent>
        </Tabs>
      </div>
      {splitGenOpen && <TenderSplitPackGenerator ws={ws} onClose={() => setSplitGenOpen(false)} />}
      {emailSimOpen && <TenderSubmissionEmailSimulator ws={ws} onClose={() => setEmailSimOpen(false)} tenderId={id!} reload={reload} />}
    </TooltipProvider>
  );
}
