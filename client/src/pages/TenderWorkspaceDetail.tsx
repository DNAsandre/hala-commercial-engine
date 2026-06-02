import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { ArrowLeft, Package, ShieldAlert, AlertTriangle, CheckCircle2, Clock, DollarSign, Target, Users, Building2, CalendarDays, Radio, FileText, Truck, ClipboardList, FolderOpen, Activity, ScrollText, Info, XCircle, Wrench, FlaskConical, FileOutput, Eye, Mail, Loader2, Database, TrendingUp, ChevronRight, ChevronDown, Layers, BarChart3, FileCheck2, ZapOff, BookOpen, Calculator, Scale, Shield, MessageSquare, Send, Trophy, Stamp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatSAR } from "@/lib/store";
import { getTenderStatusDisplayName, getTenderStatusColor, type TenderMilestone } from "@/lib/tender-engine";
import { getPackStatusLabel, getPackTypeLabel, getGateStatusLabel, getSectionStatusLabel, getSectionStatusColor, getSectionApprovalLabel, type TenderWorkspace, type TenderPack } from "@/lib/tender-workspace-data";
import { useTenderWorkspaceData } from "@/hooks/useTenderWorkspaceData";
import { toast } from "sonner";
import { updateTenderPhase, updateTenderCrmStage } from "@/lib/supabase-tender-actions";
import { mapDbStageToInternalCognitionStage } from "@/lib/supabase-tender-data";
import { getCustomerLinkForTender, type TenderCustomerLink } from "@/lib/commercial-os-data";
import { LifecycleLight, getLightState } from "@/components/LifecycleLight";
import TenderPlaceholdersTab from "@/components/tender/TenderPlaceholdersTab";
import TenderRequiredDocumentsTab from "@/components/tender/TenderRequiredDocumentsTab";
import TenderComplianceMatrixTab from "@/components/tender/TenderComplianceMatrixTab";
import TenderSubmissionGatesTab from "@/components/tender/TenderSubmissionGatesTab";
import TenderSplitPackGenerator from "@/components/tender/TenderSplitPackGenerator";
import TenderSubmissionEmailSimulator from "@/components/tender/TenderSubmissionEmailSimulator";
import TenderActivityTab from "@/components/tender/TenderActivityTab";
import TenderAuditTrailTab from "@/components/tender/TenderAuditTrailTab";
import ExecutiveCognitionStrip from "@/components/tender/ExecutiveCognitionStrip";
import { buildStageConfig } from "@/lib/tender-stage-config";
import CrmPipelineStrip from "@/components/proposal-workspace/CrmPipelineStrip";
import SowQualification from "@/components/tender/SowQualification";
import TechnicalQualification from "@/components/tender/TechnicalQualification";
import CustomerFitQualification from "@/components/tender/CustomerFitQualification";
import RiskSnapshot from "@/components/tender/RiskSnapshot";
import TenderSummaryTab from "@/components/tender/TenderSummaryTab";
import TenderCustomerSnapshotTab from "@/components/tender/TenderCustomerSnapshotTab";
import TenderDocumentsLibrary from "@/components/tender/TenderDocumentsLibrary";
import TenderDocumentDrawer from "@/components/tender/TenderDocumentDrawer";
import SuggestedProposalBlocksPanel from "@/components/tender/SuggestedProposalBlocksPanel";
import { toStageKey } from "@/lib/proposal-block-foundation";
import BidDecisionTab from "@/components/tender/BidDecisionTab";
import WinStrategyTab from "@/components/tender/WinStrategyTab";
import ResourceCommitmentTab from "@/components/tender/ResourceCommitmentTab";
import DecisionRecordTab from "@/components/tender/DecisionRecordTab";
import PreviousStageIntelligence from "@/components/tender/PreviousStageIntelligence";
import BidNoBidDocumentsCard from "@/components/tender/BidNoBidDocumentsCard";
import HOPOperationsModelTab from "@/components/tender/HOPOperationsModelTab";
import HAMManpowerModelTab from "@/components/tender/HAMManpowerModelTab";
import HIPSystemsIPModelTab from "@/components/tender/HIPSystemsIPModelTab";
import ScopeMatrixTab from "@/components/tender/ScopeMatrixTab";
import SLAKPIModelTab from "@/components/tender/SLAKPIModelTab";
import AssumptionsDependenciesTab from "@/components/tender/AssumptionsDependenciesTab";
import SolutionDesignDocumentsCard from "@/components/tender/SolutionDesignDocumentsCard";
import SolutionConfigurationTab from "@/components/tender/SolutionConfigurationTab";
import PnlPricingStage, { PnlPricingStageHeader } from "@/components/tender/PnlPricingStage";
import TenderPnLCalculatorPanel from "@/components/tender/TenderPnLCalculatorPanel";
import TenderDraftingStage, { TenderDraftingStageHeader } from "@/components/tender/TenderDraftingStage";
import InternalReviewStage from "@/components/tender/InternalReviewStage";

// â”€â”€â”€ CRM PIPELINE STAGES (10) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CRM_PIPELINE_STAGES: { value: TenderMilestone; label: string; short: string }[] = [
  { value: "prospecting",          label: "Prospecting",          short: "Prospect" },
  { value: "qualified",            label: "Qualified",            short: "Qualified" },
  { value: "proposal_sent",        label: "Proposal Sent",        short: "Sent" },
  { value: "shortlisted",          label: "Shortlisted",          short: "Listed" },
  { value: "contract_negotiation", label: "Contract Negotiation", short: "Negotiate" },
  { value: "closed_won",           label: "Closed Won",           short: "Won" },
  { value: "contract_signed",      label: "Contract Signed",      short: "Signed" },
  { value: "operational_handover", label: "Operational Handover", short: "Handover" },
  { value: "closed_lost",          label: "Closed Lost",          short: "Lost" },
  { value: "discontinued",         label: "Discontinued",         short: "Disc." },
];

// â”€â”€â”€ INTERNAL TENDER PROCESS STAGES (16) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface InternalStage { value: string; label: string; purpose: string; outputs: string[]; nextAction: string; pdfStudio?: boolean; approvalMatrix?: boolean; }
const INTERNAL_TENDER_STAGES: InternalStage[] = [
  { value: "identified",       label: "Identified",       purpose: "Opportunity has been spotted and logged.", outputs: ["Tender brief", "Initial assessment"], nextAction: "Begin qualification review" },
  { value: "qualification",    label: "Qualification",    purpose: "Assess fit, capability, and strategic value.", outputs: ["Qualification scorecard", "Go/No-Go recommendation"], nextAction: "Complete scorecard and decide" },
  { value: "bid_no_bid",       label: "Bid / No-Bid",     purpose: "Formal decision gate â€” commit resources or exit.", outputs: ["Bid/No-Bid decision log", "Resource allocation plan"], nextAction: "Record final decision" },
  { value: "solution_design",  label: "Solution Design",  purpose: "Design the operational and technical solution.", outputs: ["Solution overview", "Fleet plan", "Hub layout"], nextAction: "Complete solution design document" },
  { value: "pnl_pricing",      label: "P&L / Pricing",    purpose: "Build the financial model and price the bid.", outputs: ["P&L model", "Pricing sheet", "GP analysis"], nextAction: "Submit pricing for internal review" },
  { value: "tender_drafting",  label: "Tender Drafting",  purpose: "Compose the full tender response document.", outputs: ["Tender pack draft", "Compliance matrix", "Required documents"], nextAction: "Draft all pack sections in PDF Studio", pdfStudio: true },
  { value: "internal_review",  label: "Internal Review",  purpose: "Cross-functional review of the complete tender.", outputs: ["Review sign-off", "Red-line comments resolved"], nextAction: "Collect all reviewer sign-offs" },
  { value: "approval_matrix",  label: "Approval Matrix",  purpose: "Route for mandatory advisory approvals based on value and GP.", outputs: ["Approval matrix log", "Signoff chain"], nextAction: "Obtain required approvals", approvalMatrix: true },
  { value: "final_approved",   label: "Final Approved",   purpose: "All internal approvals complete. Ready for submission.", outputs: ["Final approved pack", "Submission checklist"], nextAction: "Proceed to submission" },
  { value: "submitted",        label: "Submitted",        purpose: "Tender officially submitted to client.", outputs: ["Submission confirmation", "Submission email log"], nextAction: "Monitor for client response" },
  { value: "clarification",    label: "Clarification",    purpose: "Client has raised queries requiring formal response.", outputs: ["Clarification responses", "Q&A log"], nextAction: "Submit clarification responses" },
  { value: "technical_review", label: "Technical Review", purpose: "Client technical evaluation in progress.", outputs: ["Technical evaluation status"], nextAction: "Support client technical queries" },
  { value: "commercial_review",label: "Commercial Review",purpose: "Client commercial evaluation and shortlisting.", outputs: ["Commercial proposal updates"], nextAction: "Await commercial decision" },
  { value: "negotiation",      label: "Negotiation",      purpose: "Active contract term negotiation with client.", outputs: ["Negotiation log", "Term sheet"], nextAction: "Finalize contract terms" },
  { value: "awarded",          label: "Awarded",          purpose: "Tender awarded. Contract to be signed.", outputs: ["Award letter", "Contract draft"], nextAction: "Progress to contract signing" },
  { value: "lost_withdrawn",   label: "Lost / Withdrawn", purpose: "Tender lost or withdrawn. Close and capture lessons.", outputs: ["Loss analysis", "Lessons learned"], nextAction: "Record loss reason and lessons" },
];

// Tab names containing & or / need explicit clean IDs to avoid fragile routing
const SOLUTION_TAB_ID_OVERRIDES: Record<string, string> = {
  "P&L Calculator": "pnl_calculator",
  "P&L Snapshot": "pnl_snapshot",
  "HIP Systems & IP Model": "hip_systems_ip_model",
  "SLA / KPI Model": "sla_kpi_model",
  "Assumptions & Dependencies": "assumptions_dependencies",
  "Appendices & Evidence": "appendices_evidence",
  "PDF Studio Handoff": "pdf_studio_handoff",
  "Proposal Architecture / TOC": "proposal_architecture_toc",
  "Exceptions & Fix List": "exceptions_fix_list",
  "Red Team / QA Review": "red_team_qa_review",
};
function toCleanTabId(name: string): string {
  return SOLUTION_TAB_ID_OVERRIDES[name] || name.toLowerCase().replace(/ /g, "_");
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
          <div className="mb-3 p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex items-center gap-1.5 text-xs text-amber-800"><ShieldAlert className="w-3.5 h-3.5" /> Internal only â€” advisory signal: production approval required before external submission.</div>
          </div>
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

/**
 * Build a flat data snapshot from a TenderWorkspace for the
 * Proposal Block Readiness evaluator. Read-only — never mutates ws.
 */
function buildTenderDataSnapshot(ws: TenderWorkspace): Record<string, any> {
  const t = ws.tender;
  return {
    // Identified stage data
    tender_summary: t.title ? { title: t.title, customer: t.customerName, value: t.estimatedValue, deadline: t.submissionDeadline, source: t.source, region: t.region } : undefined,
    customer_snapshot: t.customerName ? { name: t.customerName, region: t.region } : undefined,
    sow_data: t.sowData || undefined,
    source_documents: ws.documents?.filter(d => d.document_category === "Source") || [],
    supporting_documents: ws.documents?.filter(d => d.document_category === "Supporting") || [],

    // Qualification stage data
    sow_qualification: t.sowQualificationData || undefined,
    technical_qualification: t.technicalQualificationData || undefined,
    customer_fit: t.customerFitData || undefined,
    risk_snapshot: t.riskSnapshotData || undefined,

    // Bid / No-Bid stage data
    bid_no_bid: t.bidNoBidData || undefined,
    pricing: t.pricingData || undefined,
    pnl_pricing: {
      pricing_model: (t.pricingData as any)?.pnl_snapshot || undefined,
      boq_inputs: (t.pricingData as any)?.cost_inputs || undefined,
      commercial_terms: (t.pricingData as any)?.commercial_terms || undefined,
      assumptions: (t.pricingData as any)?.commercial_terms?.assumptions || undefined,
      exclusions: (t.pricingData as any)?.commercial_terms?.exclusions || undefined,
      target_gp: (t.pricingData as any)?.pnl_snapshot?.target_gp_percent || t.targetGpPercent || undefined,
      approval: (t.pricingData as any)?.approval || undefined,
    },

    // Solution Design stage data
    solution_design: t.solutionDesignData || undefined,

    // Nested qualification paths for block mappings
    qualification: {
      sow: {
        clarifications: (t.sowQualificationData as any)?.clarifications || [],
        coverage_matrix: (t.sowQualificationData as any)?.coverage_matrix || [],
      },
      technical: {
        capability_assessment: (t.technicalQualificationData as any)?.capability_assessment || [],
        gaps: (t.technicalQualificationData as any)?.gaps || [],
        recommendation: (t.technicalQualificationData as any)?.recommendation || undefined,
      },
      risk: {
        register: (t.riskSnapshotData as any)?.register || [],
        mitigation_actions: (t.riskSnapshotData as any)?.mitigation_actions || [],
        clarifications: (t.riskSnapshotData as any)?.clarifications || [],
      },
    },
  };
}

/** TND-002: Read-only Customer Link Panel — does not affect tender workflow */
function TenderCustomerLinkPanel({ tenderWorkspaceId }: { tenderWorkspaceId: string }) {
  const [links, setLinks] = useState<TenderCustomerLink[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCustomerLinkForTender(tenderWorkspaceId)
      .then(data => { if (mounted) { setLinks(data); setLoaded(true); } })
      .catch(() => { if (mounted) setLoaded(true); });
    return () => { mounted = false; };
  }, [tenderWorkspaceId]);

  if (!loaded || links.length === 0) return null;

  return (
    <Card className="mb-4 border-violet-200 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-violet-700" />
          <span className="text-xs font-semibold">Customer Link</span>
          <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">TND-002</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">Read-only Â· Does not affect tender workflow</span>
        </div>
        {links.map(tl => {
          const matchCls: Record<string, string> = {
            exact: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            likely: 'border-blue-200 bg-blue-50 text-blue-700',
            possible: 'border-amber-200 bg-amber-50 text-amber-700',
            needs_review: 'border-red-200 bg-red-50 text-red-700',
            unmatched: 'border-zinc-200 bg-zinc-50 text-zinc-500',
          };
          return (
            <div key={tl.id} className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant="outline" className={`text-[10px] ${matchCls[tl.matchStatus] || matchCls.needs_review}`}>{tl.matchStatus}</Badge>
              <span className="font-medium">{tl.tenderCustomerName}</span>
              {tl.customerMasterName && (
                <Link href={`/commercial-os/customers/${encodeURIComponent(tl.customerMasterName)}`}>
                  <span className="text-blue-700 hover:underline cursor-pointer">View in Customer Master â†’</span>
                </Link>
              )}
              <span className="text-muted-foreground">Confidence: {tl.matchConfidence} Â· T{tl.confidenceTier}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function TenderWorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [splitGenOpen, setSplitGenOpen] = useState(false);
  const [emailSimOpen, setEmailSimOpen] = useState(false);
  const [cognitionStage, setCognitionStage] = useState<string>("identified");
  const [crmCognitionStage, setCrmCognitionStage] = useState<(typeof CRM_PIPELINE_STAGES)[0] | null>(null);
  const [internalCognitionStage, setInternalCognitionStage] = useState<InternalStage | null>(null);
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [showDocumentLibrary, setShowDocumentLibrary] = useState(false);

  // SUPA-006: Supabase-backed data load
  const { ws, status, errorMessage, reload } = useTenderWorkspaceData(id!);

  // Sync cognition panel to the DB internal process stage when ws loads
  // Uses mapDbStageToInternalCognitionStage so e.g. 'proposal_preparation' → 'tender_drafting'
  useEffect(() => {
    if (ws?.tender?.internalStageRaw) {
      setCognitionStage(mapDbStageToInternalCognitionStage(ws.tender.internalStageRaw));
    } else if (ws?.tender?.status) {
      setCognitionStage(ws.tender.status);
    }
  }, [ws?.tender?.internalStageRaw, ws?.tender?.status]);

  const activeStageConfig = ws ? buildStageConfig(ws, cognitionStage) : null;
  const activeTabs = activeStageConfig?.tabs || ["Overview", "Activity"];


  // Default to first tab of the new stage when stage changes
  useEffect(() => {
    if (activeStageConfig) {
      const validIds = activeStageConfig.tabs.map(t => toCleanTabId(t));
      if (!validIds.includes(tab)) {
        setTab(validIds[0]);
      }
    }
  }, [cognitionStage, activeStageConfig, tab]);

  if (status === 'loading') return (
    <div className="p-6 flex items-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading tender workspace from Supabaseâ€¦</span>
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
  // Signal count derived from real compliance data — no mock gates
  const signalCount = ws.complianceItems.filter(c =>
    c.status === 'non_compliant' || c.status === 'clarification_required'
  ).length;
  const selectedPack = ws.packs.find(p => p.id === selectedPackId) ?? (ws.packs.length > 0 ? ws.packs[0] : null);
  const crmStageIdx = CRM_PIPELINE_STAGES.findIndex(s => s.value === (t.crmPipelineStage ?? 'prospecting'));
  const internalStageIdx = INTERNAL_TENDER_STAGES.findIndex(s => s.value === t.status);
  const activeInternalStageIdx = INTERNAL_TENDER_STAGES.findIndex(s => s.value === cognitionStage);
  const currentInternalStage = INTERNAL_TENDER_STAGES[internalStageIdx] ?? INTERNAL_TENDER_STAGES[0];
  const activeInternalStage = INTERNAL_TENDER_STAGES[activeInternalStageIdx] ?? currentInternalStage;
  const complianceReady = ws.complianceItems.length > 0 ? Math.round(ws.complianceItems.filter(c => c.status === 'compliant').length / ws.complianceItems.length * 100) : 0;
  const docsReady = ws.packs.reduce((s,p) => s + p.documentsReady, 0);
  const docsTotal = ws.packs.reduce((s,p) => s + p.documentsTotal, 0);

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

        {/* â”€â”€ TRACKER 1: CRM PIPELINE STAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {showDocumentLibrary && (
          <Card className="mb-4 border border-border shadow-none">
            <CardContent className="p-5">
              <TenderDocumentsLibrary ws={ws} tenderId={id!} reload={reload} />
            </CardContent>
          </Card>
        )}

        <CrmPipelineStrip
          activeCrmStage={(crmCognitionStage?.value ?? t.crmPipelineStage ?? 'prospecting') as any}
          onCrmStageChange={async (stage) => {
            const prev = t.crmPipelineStage ?? 'prospecting';
            const result = await updateTenderCrmStage(id!, prev, stage, 'Manual CRM stage move');
            if (result.success) { toast.success(`CRM Pipeline moved to ${stage}`, { description: 'Persisted to Supabase.' }); reload(); }
            else toast.warning('CRM stage update failed', { description: result.error });
          }}
          crmDealId={t.id.substring(0, 6)}
        />

        {/* â”€â”€ TRACKER 2: INTERNAL TENDER PROCESS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Card className="border border-indigo-200/60 shadow-none mb-3">
          <CardContent className="pt-4 pb-3 px-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                  Internal Tender Process Tracker
                </span>
                <Badge variant="outline" className="text-[9px] border-indigo-200 text-indigo-600 bg-indigo-50">
                  Stage {activeInternalStageIdx + 1} of {INTERNAL_TENDER_STAGES.length}
                </Badge>
                {currentInternalStage?.pdfStudio && <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700 bg-blue-50 flex items-center gap-1"><FileText className="w-2.5 h-2.5" />PDF Studio</Badge>}
                {currentInternalStage?.approvalMatrix && <Badge variant="outline" className="text-[9px] border-violet-200 text-violet-700 bg-violet-50">Approval Matrix</Badge>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    Move Tender Stage <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                  {INTERNAL_TENDER_STAGES.map((s, i) => (
                    <DropdownMenuItem
                      key={s.value}
                      disabled={s.value === cognitionStage}
                      onClick={() => setCognitionStage(s.value)}
                      className="text-xs"
                    >
                      <span className={`w-4 text-center text-[10px] font-bold ${i < activeInternalStageIdx ? "text-emerald-500" : i === activeInternalStageIdx ? "text-indigo-600" : "text-muted-foreground/40"}`}>
                        {i + 1}
                      </span>
                      <span className="ml-2">{s.label}</span>
                      {s.value === cognitionStage && <Badge variant="outline" className="ml-auto text-[8px]">Current</Badge>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
              {INTERNAL_TENDER_STAGES.map((s, i) => {
                const isCurrent = s.value === cognitionStage;
                const isPast = i < activeInternalStageIdx;
                const isNext = i === activeInternalStageIdx + 1;

                return (
                  <div key={s.value} className="flex items-center shrink-0">
                    <button
                      onClick={() => setCognitionStage(s.value)}
                      title={s.purpose}
                      className={`
                        relative flex flex-col items-center px-2.5 py-2 rounded-lg transition-all
                        ${isCurrent
                          ? "bg-indigo-600 text-white shadow-md cursor-default"
                          : isPast
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            : isNext
                              ? "border border-dashed border-indigo-300 text-indigo-500 hover:bg-indigo-50 cursor-pointer"
                              : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 cursor-pointer"
                        }
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mb-1
                        ${isCurrent
                          ? "bg-white/20 text-white"
                          : isPast
                            ? "bg-emerald-200 text-emerald-700"
                            : "bg-muted/60 text-muted-foreground/60"
                        }
                      `}>
                        {isPast ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                      </div>
                      <span className={`text-[9px] font-medium whitespace-nowrap leading-none ${isCurrent ? "text-white font-semibold" : ""}`}>
                        {s.label}
                      </span>
                    </button>

                    {i < INTERNAL_TENDER_STAGES.length - 1 && (
                      <div className={`h-px w-3 shrink-0 ${isPast ? "bg-emerald-400" : "bg-muted-foreground/15"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {currentInternalStage && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                  <strong className="text-foreground/70">{activeInternalStage.label}:</strong>{" "}
                  {activeInternalStage.purpose}
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-9 gap-2 rounded-md bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md active:translate-y-0 active:bg-indigo-800"
                  onClick={() => setDocumentDrawerOpen(true)}
                >
                  <FolderOpen className="w-4 h-4" /> Open Documents
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TND-002: Customer Link Panel */}
        <TenderCustomerLinkPanel tenderWorkspaceId={id!} />

        {/* â”€â”€ WORKBENCH CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Card className="border border-border shadow-none mb-4">
          <CardContent className="p-0">
            {/* Stage header */}
            <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getTenderStatusColor(cognitionStage as any).split(' ')[0].replace('text-', 'bg-')}`} />
                <span className="text-sm font-semibold">{INTERNAL_TENDER_STAGES.find(s => s.value === cognitionStage)?.label ?? currentInternalStage.label}</span>
                <Badge variant="outline" className={`text-[9px]`}>
                  Stage {INTERNAL_TENDER_STAGES.findIndex(s => s.value === cognitionStage) + 1}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground/60 italic hidden sm:inline">{INTERNAL_TENDER_STAGES.find(s => s.value === cognitionStage)?.purpose ?? currentInternalStage.purpose}</span>
            </div>

            {/* Executive Cognition Strip */}
            <div className="px-5 pt-3">
              <ExecutiveCognitionStrip ws={ws} daysLeft={daysLeft} targetGp={t.targetGpPercent} signalCount={signalCount} />
            </div>

            {/* Bid / No-Bid: Previous Stage Intelligence + Save Status + Documents */}
            {cognitionStage === "bid_no_bid" && (
              <div className="px-5 pt-3 space-y-3">
                <PreviousStageIntelligence ws={ws} />
                {/* Save status strip */}
                {(() => {
                  const bnb = t.bidNoBidData as any;
                  const tabs = [
                    { label: "Bid Decision", saved: !!(bnb?.decision && (bnb.decision.decision !== "Not Decided" || bnb.decision.decision_owner || bnb.decision.decision_reason)) },
                    { label: "Win Strategy", saved: !!(bnb?.win_strategy && (bnb.win_strategy.rationale?.why_bid || (Array.isArray(bnb.win_strategy.win_themes) && bnb.win_strategy.win_themes.length > 0))) },
                    { label: "Resource Commitment", saved: !!(bnb?.resource_commitment && (Array.isArray(bnb.resource_commitment.rows) && bnb.resource_commitment.rows.some((r: any) => r.status !== "Not Assessed"))) },
                    { label: "Decision Record", saved: !!(bnb?.decision_record?.formal && bnb.decision_record.formal.decision !== "Not Decided") },
                  ];
                  return (
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-md border border-border bg-muted/10">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Save Status</span>
                      <div className="flex items-center gap-2">
                        {tabs.map(tb => (
                          <div key={tb.label} className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${tb.saved ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className={`text-[9px] ${tb.saved ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>{tb.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <BidNoBidDocumentsCard ws={ws} onOpenDocuments={() => setDocumentDrawerOpen(true)} />
              </div>
            )}

            {/* Solution Design: Previous Stage Intelligence + Save Status + Documents */}
            {cognitionStage === "solution_design" && (
              <div className="px-5 pt-3 space-y-3">
                <PreviousStageIntelligence ws={ws} />
                {(() => {
                  const sd = t.solutionDesignData as any;
                  const cfgSaved = !!(sd?.configuration && (sd.configuration.selected_modules !== "Not Selected" || sd.configuration.customer_operating_road !== "Not Assessed" || sd.configuration.market_entry_mode !== "Not Assessed" || sd.configuration.solution_package !== "Not Selected" || sd.configuration.deployment_type !== "Not Assessed" || (sd.configuration.customer_problem?.statement) || (Array.isArray(sd.configuration.customer_pain_categories) && sd.configuration.customer_pain_categories.length > 0) || (Array.isArray(sd.configuration.expansion_path) && sd.configuration.expansion_path.length > 0)));
                  const tabs = [
                    { label: "Config", saved: cfgSaved },
                    { label: "HOP", saved: !!(sd?.hop && (sd.hop.warehouse?.storage_required !== "Not Assessed" || sd.hop.transport?.transport_required !== "Not Assessed" || (Array.isArray(sd.hop.operational_flow) && sd.hop.operational_flow.length > 0))) },
                    { label: "HAM", saved: !!(sd?.ham && (Array.isArray(sd.ham.staffing) && sd.ham.staffing.length > 0)) },
                    { label: "HIP", saved: !!(sd?.hip && (Array.isArray(sd.hip.systems) && sd.hip.systems.length > 0)) },
                    { label: "Scope", saved: !!(sd?.scope_matrix && Array.isArray(sd.scope_matrix.rows) && sd.scope_matrix.rows.length > 0) },
                    { label: "SLA/KPI", saved: !!(sd?.sla_kpi && Array.isArray(sd.sla_kpi.kpis) && sd.sla_kpi.kpis.length > 0) },
                    { label: "Assumptions", saved: !!(sd?.assumptions_dependencies && (Array.isArray(sd.assumptions_dependencies.assumptions) && sd.assumptions_dependencies.assumptions.length > 0)) },
                  ];
                  return (
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-md border border-border bg-muted/10">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Save Status</span>
                      <div className="flex items-center gap-2">
                        {tabs.map(tb => (
                          <div key={tb.label} className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${tb.saved ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className={`text-[9px] ${tb.saved ? "text-emerald-700 font-medium" : "text-muted-foreground"}`}>{tb.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <SolutionDesignDocumentsCard ws={ws} onOpenDocuments={() => setDocumentDrawerOpen(true)} />
              </div>
            )}

            {cognitionStage === "pnl_pricing" && (
              <PnlPricingStageHeader ws={ws} onOpenDocuments={() => setDocumentDrawerOpen(true)} />
            )}

            {cognitionStage === "tender_drafting" && (
              <div className="px-5 pt-3">
                <TenderDraftingStageHeader ws={ws} onOpenDocuments={() => setDocumentDrawerOpen(true)} />
              </div>
            )}

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
              <div className="px-4 pt-0 pb-0 border-b border-border bg-muted/10 overflow-x-auto">
                <TabsList className="h-8 bg-transparent p-0 gap-0">
                  {activeTabs.map(tName => {
                    const tabId = toCleanTabId(tName);
                    const icons: Record<string, React.ElementType> = {
                      tender_summary: BookOpen, packs: Package, tender_builder: Package, final_pack: Package, submitted_version: Send,
                      placeholders: FileText, commercial: DollarSign, pnl_calculator: Calculator, pnl_snapshot: Calculator, cost_inputs: DollarSign, pricing_scenarios: Scale, commercial_terms: ScrollText, pricing_approval: CheckCircle2,
                      delivery: Truck, warehouse_model: Package, transport_model: Truck, compliance_matrix: Shield, compliance_alignment: Shield, compliance_coverage: Shield,
                      required_documents: FileText, technical_evidence: FileText,
                      bid_decision: Scale, win_strategy: Trophy, resource_commitment: Users, decision_record: Stamp,
                      solution_configuration: Wrench, hop_operations_model: Truck, ham_manpower_model: Users, hip_systems_ip_model: Database, scope_matrix: ClipboardList, sla_kpi_model: Target, assumptions_dependencies: FileText,
                      proposal_architecture_toc: ClipboardList, proposal_block_workbench: Layers, technical_volume: BookOpen, commercial_volume: DollarSign, appendices_evidence: FolderOpen, pdf_studio_handoff: FileOutput,
                      submission_readiness: CheckCircle2, activity: Activity, decision_log: ClipboardList, clarification_log: MessageSquare, negotiation_log: MessageSquare, submission_log: Send, response_history: Clock, audit_trail: Clock, approval_record: CheckCircle2,
                    };
                    const Icon = icons[tabId] ?? FileText;
                    return (
                      <TabsTrigger key={tabId} value={tabId}
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-3 h-8 text-[11px] font-medium transition-all whitespace-nowrap">
                        <Icon className="w-3 h-3 mr-1.5" />{tName}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              {activeTabs.map(tabName => {
                const tabId = toCleanTabId(tabName);
                return (
                  <TabsContent key={tabId} value={tabId} className="mt-0 p-5">
                    {(() => {
                      if (tabId === "tender_builder" || tabId === "packs" || tabId === "final_pack" || tabId === "submitted_version") {
                        if (ws.packs.length === 0) return <p className="text-sm text-muted-foreground py-8 text-center">No packs configured yet.</p>;
                        return (
                          <div className="space-y-4">
                            {/* Packs toolbar */}
                            <div className="p-3 rounded-lg border border-muted bg-muted/20 flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5">
                                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                                <p className="text-xs text-muted-foreground">{ws.packs.length} pack{ws.packs.length > 1 ? 's' : ''} configured. All actions are advisory â€” no documents are locked or submitted.</p>
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
                                    {p.isMaster && <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-700"><ShieldAlert className="w-3 h-3" /> Internal only â€” not submittable</div>}
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
                                        <span>Â·</span>
                                        <span>Owner: <span className="font-medium text-foreground">{selectedPack.ownerName}</span></span>
                                        <span>Â·</span>
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
                                      {(["sections", "placeholders", "required_documents", "compliance", "readiness_signals", "outputs"] as const).map(key => {
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

                                  {/* Pack actions */}
                                  <div>
                                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pack Actions</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedPack.mockActions.map(action => {
                                        const normalizedAction = action.toLowerCase();
                                        const Icon =
                                          normalizedAction.includes("output") ? FileOutput :
                                          normalizedAction.includes("split") ? FlaskConical :
                                          normalizedAction.includes("readiness") ? Eye :
                                          Wrench;
                                        const isSplitAction = normalizedAction.includes("split") || normalizedAction.includes("output");
                                        const label = normalizedAction.includes("output")
                                          ? "Open PDF Studio"
                                          : action.replace(/mock\s+/gi, "");
                                        return (
                                          <Button key={action} variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => isSplitAction ? setSplitGenOpen(true) : toast.info(`Action not connected: "${action}".`, { description: "No workflow was created." })}>
                                            <Icon className="w-3.5 h-3.5" /> {label}
                                          </Button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        );
                      }
                      if (tabId === "placeholders") return <TenderPlaceholdersTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "compliance_matrix" || tabId === "compliance_alignment") return <TenderComplianceMatrixTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "required_documents" || tabId === "technical_evidence") return <TenderRequiredDocumentsTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "submission_readiness") return <TenderSubmissionGatesTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "activity" || tabId === "clarification_log" || tabId === "negotiation_log" || tabId === "submission_log" || tabId === "response_history") return <TenderActivityTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "audit_trail" || tabId === "approval_record") return <TenderAuditTrailTab ws={ws} />;
                      if (tabId === "pnl_calculator") {
                        return <TenderPnLCalculatorPanel ws={ws} reload={reload} />;
                      }
                      if (["pricing_scenarios", "commercial_terms", "pricing_approval"].includes(tabId)) {
                        return <PnlPricingStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => setDocumentDrawerOpen(true)} />;
                      }

                      // ─── Stage 6: Tender Drafting tabs ────────────────
                      if (["proposal_architecture_toc", "proposal_block_workbench", "technical_volume", "commercial_volume", "compliance_coverage", "appendices_evidence", "pdf_studio_handoff"].includes(tabId)) {
                        return <TenderDraftingStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => setDocumentDrawerOpen(true)} />;
                      }

                      // ─── Stage 7: Internal Review tabs ─────────────────
                      if (["review_dashboard", "operations_review", "finance_review", "legal_review", "exceptions"].includes(tabId)) {
                        return <InternalReviewStage ws={ws} activeTab={tabId} reload={reload} />;
                      }

                      // Identified Workbench Tabs
                      if (tabId === "tender_summary") return <TenderSummaryTab ws={ws} reload={reload} />;
                      if (tabId === "customer_snapshot") return <TenderCustomerSnapshotTab ws={ws} reload={reload} />;

                      // Qualification Workbench Tabs
                      if (tabId === "sow_qualification") return <SowQualification ws={ws} />;
                      if (tabId === "technical_qualification") return <TechnicalQualification ws={ws} />;
                      if (tabId === "customer_fit") return <CustomerFitQualification ws={ws} />;
                      if (tabId === "risk_snapshot") return <RiskSnapshot ws={ws} />;

                      // Bid / No-Bid Workbench Tabs
                      if (tabId === "bid_decision") return <BidDecisionTab ws={ws} />;
                      if (tabId === "win_strategy") return <WinStrategyTab ws={ws} />;
                      if (tabId === "resource_commitment") return <ResourceCommitmentTab ws={ws} />;
                      if (tabId === "decision_record") return <DecisionRecordTab ws={ws} />;

                      // Solution Design Workbench Tabs
                      if (tabId === "solution_configuration") return <SolutionConfigurationTab ws={ws} />;
                      if (tabId === "hop_operations_model") return <HOPOperationsModelTab ws={ws} />;
                      if (tabId === "ham_manpower_model") return <HAMManpowerModelTab ws={ws} />;
                      if (tabId === "hip_systems_ip_model") return <HIPSystemsIPModelTab ws={ws} />;
                      if (tabId === "scope_matrix") return <ScopeMatrixTab ws={ws} />;
                      if (tabId === "sla_kpi_model") return <SLAKPIModelTab ws={ws} />;
                      if (tabId === "assumptions_dependencies") return <AssumptionsDependenciesTab ws={ws} />;

                      // Default generic placeholder for all other mapped tabs
                      return <PlaceholderTab title={tabName} fields={["Data linked to this stage", "Assigned owner", "Status", "Review log", "Associated risks"]} />;
                    })()}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Proposal Block Readiness — stage-level panel (foundation only) */}
        <SuggestedProposalBlocksPanel
          stageKey={toStageKey(cognitionStage)}
          tenderData={ws ? buildTenderDataSnapshot(ws) : null}
        />

      </div>
      <TenderDocumentDrawer
        open={documentDrawerOpen}
        onOpenChange={setDocumentDrawerOpen}
        ws={ws}
        tenderId={id!}
        reload={reload}
      />
      {splitGenOpen && <TenderSplitPackGenerator ws={ws} onClose={() => setSplitGenOpen(false)} />}
      {emailSimOpen && <TenderSubmissionEmailSimulator ws={ws} onClose={() => setEmailSimOpen(false)} tenderId={id!} reload={reload} />}

      {/* â”€â”€ CRM STAGE COGNITION DIALOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={!!crmCognitionStage} onOpenChange={() => setCrmCognitionStage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="w-4 h-4 text-[var(--color-hala-navy)]" />CRM Pipeline â€” {crmCognitionStage?.label}</DialogTitle>
          </DialogHeader>
          {crmCognitionStage && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">This stage represents the CRM-level position of the opportunity in the unified commercial pipeline. It is independent from the internal tender process.</p>
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Move to this stage?</p>
                <Button className="w-full text-sm" onClick={async () => {
                  const prev = t.crmPipelineStage ?? 'prospecting';
                  const result = await updateTenderCrmStage(id!, prev, crmCognitionStage.value, 'Manual CRM stage move');
                  if (result.success) { toast.success(`CRM Pipeline moved to ${crmCognitionStage.label}`, { description: 'Persisted to Supabase.' }); reload(); }
                  else toast.warning('CRM stage update failed', { description: result.error });
                  setCrmCognitionStage(null);
                }}>Confirm: Move CRM to {crmCognitionStage.label}</Button>
                <Button variant="ghost" className="w-full text-xs" onClick={() => setCrmCognitionStage(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* â”€â”€ INTERNAL STAGE COGNITION DIALOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={!!internalCognitionStage} onOpenChange={() => setInternalCognitionStage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-amber-600" />Tender Stage â€” {internalCognitionStage?.label}</DialogTitle>
          </DialogHeader>
          {internalCognitionStage && (
            <div className="space-y-4">
              <p className="text-xs font-medium text-foreground">{internalCognitionStage.purpose}</p>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Required Outputs</p>
                <ul className="space-y-1">{internalCognitionStage.outputs.map(o => <li key={o} className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />{o}</li>)}</ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Next Action</p>
                <p className="text-xs text-amber-800 font-medium">{internalCognitionStage.nextAction}</p>
              </div>
              {internalCognitionStage.pdfStudio && <div className="p-2 rounded-lg border border-blue-200 bg-blue-50 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600 shrink-0" /><p className="text-xs text-blue-700 font-medium">Primary Document Engine: PDF Studio â€” Sprint 3</p></div>}
              {internalCognitionStage.approvalMatrix && <div className="p-2 rounded-lg border border-violet-200 bg-violet-50 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-violet-600 shrink-0" /><p className="text-xs text-violet-700 font-medium">Approval Matrix routing â€” Sprint 2</p></div>}
              {internalCognitionStage.value !== t.status && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Move to this stage?</p>
                  <Button className="w-full text-sm" onClick={async () => {
                    const result = await updateTenderPhase(id!, t.status, internalCognitionStage.value as any, 'Manual stage move via cognition panel');
                    if (result.success) { toast.success(`Stage moved to ${internalCognitionStage.label}`, { description: 'Persisted to Supabase.' }); reload(); }
                    else toast.warning('Stage update failed', { description: result.error });
                    setInternalCognitionStage(null);
                  }}>Confirm: Move to {internalCognitionStage.label}</Button>
                  <Button variant="ghost" className="w-full text-xs" onClick={() => setInternalCognitionStage(null)}>Cancel</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
