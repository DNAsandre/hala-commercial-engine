/**
 * ProposalStageWorkbench — Executive Cognition Architecture.
 * Each stage: Executive Strip (4 indicators) + Tabs + Single Next Action.
 */
import { useState, useEffect } from "react";
import {
  FileText, Calculator, Truck, Package, BookOpen, Users, MessageSquare,
  ClipboardList, Shield, Scale, DollarSign, BarChart3, CheckCircle2,
  Target, Zap, Send, Bot, ExternalLink, Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  STAGE_WORKBENCH_TABS, PROPOSAL_TRACKER_STAGES, getProposalStage,
} from "./proposal-stages";
import SupportingDocumentsPanel, { type SupportingDocument } from "./SupportingDocumentsPanel";
import {
  type ProposalWorkspaceData, createDefaultWorkspaceData,
  calcQualificationReadiness, calcDiscoveryCompleteness,
  calcSolutionReadiness, calcPricingConfidence,
  generateSignals,
  logProposalAudit, logDataChange,
} from "./proposal-workspace-state";
import ExecutiveStrip, { type StripIndicator } from "./ExecutiveStrip";

// Stage 1
import { QualificationSummaryTab, CustomerFitTab, RequiredInfoTab } from "./stages/QualifiedStage";
// Stage 2
import { MeetingNotesTab, CustomerNeedsTab, CurrentPainTab, VolumesLanesTab, RisksAssumptionsTab } from "./stages/DiscoveryStage";
// Stage 3
import { WarehouseModelTab, TransportModelTab, VasHandlingTab, ServiceScopeTab, OperationalFeasibilityTab } from "./stages/SolutionDesignStage";
// Stage 4
import { PnlCalculatorTab, CostInputsTab, PricingLinesTab, MarginScenariosTab, ApprovalSignalsTab } from "./stages/PnlPricingStage";

const TAB_ICONS: Record<string, React.ElementType> = {
  qualification_summary: ClipboardList, customer_fit: Target,
  required_info: CheckCircle2, discovery_summary: BookOpen,
  meeting_notes: MessageSquare, scope_inputs: Package,
  warehouse_model: Package, transport_model: Truck,
  service_scope: FileText, pnl_calculator: Calculator,
  cost_inputs: DollarSign, pricing_scenarios: Scale,
  quote_builder: FileText, assumptions: BookOpen,
  exclusions: Shield, pdf_studio: ExternalLink,
  proposal_builder: FileText, scope_of_work: ClipboardList,
  commercial_terms: DollarSign, sent_version: Send,
  crm_sync: ExternalLink, customer_response: MessageSquare,
  timeline: Clock, negotiation_log: MessageSquare,
  requested_changes: ClipboardList, margin_impact: Scale,
  revised_versions: FileText, approval_summary: CheckCircle2,
  exceptions: Shield, sla_review: FileText,
  approval_history: Clock, contract_reference: FileText,
  sla_draft_link: FileText, final_baseline: DollarSign,
  handover_notes: ClipboardList, go_live_checklist: CheckCircle2,
  sla_monitoring: BarChart3, billing_activation: DollarSign,
  first_review: Users, supporting_docs: FileText,
};

interface ProposalStageWorkbenchProps {
  activeStage: string;
  workspaceId: string;
  customerName: string;
  documents?: SupportingDocument[];
  onDocUpload?: (doc: Partial<SupportingDocument>) => void;
  onNavigateToComposer?: (type: "quote" | "proposal") => void;
  wsData?: ProposalWorkspaceData;
  onWsDataChange?: (d: ProposalWorkspaceData) => void;
  onSavePnlVersions?: (proposalId: string, version: any) => void;
}

export default function ProposalStageWorkbench({
  activeStage, workspaceId, customerName,
  documents = [], onDocUpload, onNavigateToComposer,
  wsData: externalData, onWsDataChange,
  onSavePnlVersions,
}: ProposalStageWorkbenchProps) {
  const [localData, setLocalData] = useState<ProposalWorkspaceData>(() => {
    return createDefaultWorkspaceData();
  });

  const wsData = externalData ?? localData;
  const setWsData = onWsDataChange ?? setLocalData;

  const updateWsData = (newData: ProposalWorkspaceData, stage: string, tab: string) => {
    const stageDataKey = tab as keyof ProposalWorkspaceData;
    const oldSection = (wsData as any)[stageDataKey];
    const newSection = (newData as any)[stageDataKey];
    if (oldSection && newSection && typeof oldSection === "object" && !Array.isArray(oldSection)) {
      logDataChange(workspaceId, stage, tab, oldSection, newSection);
    }
    setWsData(newData);
  };

  const tabs = STAGE_WORKBENCH_TABS[activeStage] ?? [];
  const stageInfo = getProposalStage(activeStage);
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "");

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [activeStage]);

  if (tabs.length === 0) return null;

  // ── Executive Cognition: derive indicators per stage ──
  const getStageIndicators = (): StripIndicator[] => {
    const qualR = calcQualificationReadiness(wsData);
    const discR = calcDiscoveryCompleteness(wsData);
    const solnR = calcSolutionReadiness(wsData);
    const priceR = calcPricingConfidence(wsData);
    const fitScore = wsData.customerFit ? Math.round((Object.values(wsData.customerFit).filter(v => v && v !== "" && v !== "none").length / Math.max(Object.keys(wsData.customerFit).length, 1)) * 100) : 0;
    const hasPnl = wsData.pnlVersions?.length > 0;
    const approvedPnl = wsData.pnlVersions?.find((v: any) => v.isApproved);
    const gpPct = approvedPnl ? ((approvedPnl.revenue?.reduce((s: number, l: any) => s + l.amount, 0) - approvedPnl.costs?.reduce((s: number, l: any) => s + l.amount, 0)) / Math.max(approvedPnl.revenue?.reduce((s: number, l: any) => s + l.amount, 0), 1)) * 100 : 0;

    switch (activeStage) {
      case "qualified": return [
        { label: "Qualification Readiness", type: "progress", value: qualR },
        { label: "Customer Fit", type: "gauge", value: fitScore },
        { label: "Commercial Potential", type: "gauge", value: wsData.qualificationSummary?.estimatedRevenue ? 70 : 20 },
        { label: "Payment Risk", type: "gauge", value: (wsData.qualificationSummary as any)?.paymentRisk === "low" ? 80 : (wsData.qualificationSummary as any)?.paymentRisk === "medium" ? 50 : 25, displayValue: (wsData.qualificationSummary as any)?.paymentRisk === "low" ? "Low" : (wsData.qualificationSummary as any)?.paymentRisk === "medium" ? "Medium" : "High" },
      ];
      case "discovery": return [
        { label: "Discovery Completeness", type: "progress", value: discR },
        { label: "Need Clarity", type: "gauge", value: wsData.customerNeeds ? Math.min(Object.values(wsData.customerNeeds).filter(v => v).length * 25, 100) : 0 },
        { label: "Volume Confidence", type: "gauge", value: wsData.volumesLanes?.pallets ? 70 : 0 },
        { label: "Open Questions", type: "counter", value: wsData.meetingNotes?.filter((n: any) => n.openQuestions?.length > 0).reduce((s: number, n: any) => s + n.openQuestions.length, 0) ?? 0 },
      ];
      case "solution_design": return [
        { label: "Solution Readiness", type: "progress", value: solnR },
        { label: "Feasibility Score", type: "gauge", value: (wsData.operationalFeasibility as any)?.feasibilityScore ?? solnR },
        { label: "Scope Clarity", type: "progress", value: wsData.serviceScope ? Math.round(Object.values(wsData.serviceScope).filter(v => v && v !== "" && v !== "none").length / Math.max(Object.keys(wsData.serviceScope).length, 1) * 100) : 0 },
        { label: "Operational Complexity", type: "gauge", value: (wsData.warehouseModel as any)?.complexity === "low" ? 80 : (wsData.warehouseModel as any)?.complexity === "medium" ? 50 : 30, displayValue: (wsData.warehouseModel as any)?.complexity === "low" ? "Simple" : (wsData.warehouseModel as any)?.complexity === "medium" ? "Moderate" : "Complex" },
      ];
      case "pnl_pricing": return [
        { label: "Pricing Confidence", type: "gauge", value: priceR },
        { label: "Margin Health / GP%", type: "gauge", value: gpPct >= 22 ? 85 : gpPct >= 10 ? 50 : 15, displayValue: hasPnl ? `${gpPct.toFixed(1)}%` : "—" },
        { label: "Cost Input Completeness", type: "progress", value: wsData.costInputs ? Math.round(wsData.costInputs.filter((c: any) => c.verified).length / Math.max(wsData.costInputs.length, 1) * 100) : 0 },
        { label: "Approval Risk", type: "gauge", value: gpPct >= 22 ? 85 : gpPct >= 10 ? 45 : 15, displayValue: gpPct >= 22 ? "Safe" : gpPct >= 10 ? "Review" : "Escalate" },
      ];
      case "quote": return [
        { label: "Quote Readiness", type: "progress", value: priceR >= 60 ? 70 : 20 },
        { label: "Assumptions Completeness", type: "progress", value: 0 },
        { label: "Exclusions Completeness", type: "progress", value: 0 },
        { label: "Commercial Defensibility", type: "gauge", value: priceR >= 60 ? 65 : 20 },
      ];
      case "proposal_drafting": return [
        { label: "Proposal Completeness", type: "progress", value: 0 },
        { label: "PDF Readiness", type: "progress", value: 0 },
        { label: "Scope Accuracy", type: "gauge", value: solnR >= 60 ? 70 : 30 },
        { label: "Customer Readability", type: "gauge", value: 0 },
      ];
      case "proposal_sent": return [
        { label: "Sent Status", type: "status", value: 0, displayValue: "Not Sent" },
        { label: "CRM Sync", type: "status", value: 0, displayValue: "Pending" },
        { label: "Customer Response", type: "gauge", value: 0, displayValue: "Awaiting" },
        { label: "Follow-Up Due", type: "status", value: 0, displayValue: "—" },
      ];
      case "negotiation": return [
        { label: "Negotiation Risk", type: "gauge", value: 50, displayValue: "Moderate" },
        { label: "Margin Drift", type: "gauge", value: 70, displayValue: "Stable" },
        { label: "Scope Drift", type: "gauge", value: 70, displayValue: "Stable" },
        { label: "Revision Status", type: "progress", value: 0 },
      ];
      case "commercial_approval": return [
        { label: "Approval Readiness", type: "progress", value: 0 },
        { label: "Approval Risk", type: "gauge", value: gpPct >= 22 ? 80 : 30 },
        { label: "Exception Severity", type: "gauge", value: 70, displayValue: "None" },
        { label: "SLA Exposure", type: "gauge", value: 50, displayValue: "TBD" },
      ];
      case "contract_signed": return [
        { label: "Contract Pack Completion", type: "progress", value: 0 },
        { label: "SLA Finalization", type: "progress", value: 0 },
        { label: "Baseline Integrity", type: "gauge", value: 0 },
        { label: "Handover Readiness", type: "gauge", value: 0 },
      ];
      case "go_live": return [
        { label: "Go-Live Readiness", type: "progress", value: 0 },
        { label: "Operational Readiness", type: "gauge", value: 0 },
        { label: "SLA Monitoring Active", type: "status", value: 0, displayValue: "Inactive" },
        { label: "Revenue Start", type: "status", value: 0, displayValue: "Pending" },
      ];
      default: return [];
    }
  };

  const getNextAction = (): string => {
    switch (activeStage) {
      case "qualified": return calcQualificationReadiness(wsData) >= 70 ? "Advance to Discovery" : "Complete Qualification";
      case "discovery": return calcDiscoveryCompleteness(wsData) >= 70 ? "Advance to Solution Design" : "Complete Discovery";
      case "solution_design": return calcSolutionReadiness(wsData) >= 70 ? "Advance to P&L" : "Complete Solution Design";
      case "pnl_pricing": return calcPricingConfidence(wsData) >= 70 ? "Advance to Quote" : "Finalize Pricing";
      case "quote": return "Finalize Quote";
      case "proposal_drafting": return "Generate Proposal";
      case "proposal_sent": return "Follow Up";
      case "negotiation": return "Resolve Negotiation";
      case "commercial_approval": return "Approve / Rework";
      case "contract_signed": return "Prepare Go-Live";
      case "go_live": return "Launch Live";
      default: return "Continue";
    }
  };

  // ── Tab content renderer ──
  const renderTabContent = (tabKey: string): React.ReactNode => {
    if (tabKey === "supporting_docs") {
      return <SupportingDocumentsPanel linkedStage={activeStage} linkedTab={tabKey} documents={documents} onUpload={onDocUpload} />;
    }
    if (tabKey === "pdf_studio") {
      return <PdfStudioPanel stage={activeStage} onNavigate={onNavigateToComposer} />;
    }
    // Stage 1: Qualified
    if (activeStage === "qualified") {
      switch (tabKey) {
        case "qualification_summary": return <QualificationSummaryTab data={wsData.qualificationSummary} onChange={d => updateWsData({ ...wsData, qualificationSummary: d }, "qualified", "qualificationSummary")} />;
        case "customer_fit": return <CustomerFitTab data={wsData.customerFit} onChange={d => updateWsData({ ...wsData, customerFit: d }, "qualified", "customerFit")} />;
        case "required_info": return <RequiredInfoTab data={wsData.requiredInfo} onChange={d => updateWsData({ ...wsData, requiredInfo: d }, "qualified", "requiredInfo")} />;
      }
    }
    // Stage 2: Discovery
    if (activeStage === "discovery") {
      switch (tabKey) {
        case "discovery_summary": return <CustomerNeedsTab data={wsData.customerNeeds} onChange={d => updateWsData({ ...wsData, customerNeeds: d }, "discovery", "customerNeeds")} />;
        case "meeting_notes": return <MeetingNotesTab data={wsData.meetingNotes} onChange={d => { if (d.length !== wsData.meetingNotes.length) logProposalAudit({ workspaceId, action: d.length > wsData.meetingNotes.length ? "meeting_added" : "meeting_removed", stage: "discovery", tab: "meetingNotes", details: `Meeting notes count: ${d.length}` }); setWsData({ ...wsData, meetingNotes: d }); }} />;
        case "scope_inputs": return <VolumesLanesTab data={wsData.volumesLanes} onChange={d => updateWsData({ ...wsData, volumesLanes: d }, "discovery", "volumesLanes")} />;
      }
    }
    // Stage 3: Solution Design
    if (activeStage === "solution_design") {
      switch (tabKey) {
        case "warehouse_model": return <WarehouseModelTab data={wsData.warehouseModel} onChange={d => updateWsData({ ...wsData, warehouseModel: d }, "solution_design", "warehouseModel")} />;
        case "transport_model": return <TransportModelTab data={wsData.transportModel} onChange={d => updateWsData({ ...wsData, transportModel: d }, "solution_design", "transportModel")} />;
        case "service_scope": return <ServiceScopeTab data={wsData.serviceScope} onChange={d => updateWsData({ ...wsData, serviceScope: d }, "solution_design", "serviceScope")} />;
      }
    }
    // Stage 4: P&L
    if (activeStage === "pnl_pricing") {
      switch (tabKey) {
        case "pnl_calculator": return <InlinePnlCalculator />;
        case "cost_inputs": return <CostInputsTab data={wsData.costInputs} onChange={d => setWsData({ ...wsData, costInputs: d })} />;
        case "pricing_scenarios": return <MarginScenariosTab data={wsData.marginScenarios} onChange={d => updateWsData({ ...wsData, marginScenarios: d }, "pnl_pricing", "marginScenarios")} />;
      }
    }

    // Fallback placeholder for stages 5-11
    const Icon = TAB_ICONS[tabKey] ?? FileText;
    const tabLabel = tabs.find(t => t.key === tabKey)?.label ?? tabKey;
    return (
      <div className="py-8 text-center">
        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center mx-auto mb-2">
          <Icon className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <p className="text-xs font-medium text-foreground/70">{tabLabel}</p>
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Coming in next sprint</p>
      </div>
    );
  };

  return (
    <Card className="border border-border shadow-none mb-4">
      <CardContent className="p-0">
        {/* Stage header */}
        <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${stageInfo?.bgColor ?? "bg-muted"}`} />
            <span className="text-sm font-semibold">{stageInfo?.label ?? activeStage}</span>
            <Badge variant="outline" className={`text-[9px] ${stageInfo?.color ?? ""} ${stageInfo?.borderColor ?? ""}`}>
              Stage {(PROPOSAL_TRACKER_STAGES.findIndex(s => s.key === activeStage) + 1) || "?"}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground/60 italic hidden sm:inline">{stageInfo?.description}</span>
        </div>

        {/* Executive Cognition Strip */}
        <div className="px-5 pt-3">
          <ExecutiveStrip
            indicators={getStageIndicators()}
            nextAction={getNextAction()}
            signals={generateSignals(wsData).filter(s => s.stage === activeStage)}
          />
        </div>

        {/* Tab strip */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-4 pt-0 pb-0 border-b border-border bg-muted/10 overflow-x-auto">
            <TabsList className="h-8 bg-transparent p-0 gap-0">
              {tabs.map(tab => {
                const Icon = TAB_ICONS[tab.key] ?? FileText;
                return (
                  <TabsTrigger key={tab.key} value={tab.key}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:text-indigo-700 data-[state=active]:shadow-none px-3 h-8 text-[11px] font-medium transition-all whitespace-nowrap">
                    <Icon className="w-3 h-3 mr-1.5" />{tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          {tabs.map(tab => (
            <TabsContent key={tab.key} value={tab.key} className="mt-0 p-5">
              {renderTabContent(tab.key)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ── PDF Studio linking ──
function PdfStudioPanel({ stage, onNavigate }: { stage: string; onNavigate?: (type: "quote" | "proposal") => void }) {
  const actions: Record<string, { title: string; desc: string; action: string; type?: "quote" | "proposal" }[]> = {
    quote: [
      { title: "Generate Quote PDF", desc: "Create customer-facing quote from pricing.", action: "Open Quote Builder", type: "quote" },
    ],
    proposal_drafting: [
      { title: "Generate Proposal PDF", desc: "Create full customer-ready proposal.", action: "Open Proposal Builder", type: "proposal" },
    ],
  };
  const items = actions[stage] ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><ExternalLink className="w-4 h-4 text-indigo-600" /><span className="text-sm font-semibold">PDF Studio</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((a, i) => (
          <div key={i} className="p-4 rounded-lg border border-border bg-background hover:bg-muted/20 transition-colors">
            <p className="text-sm font-medium mb-1">{a.title}</p>
            <p className="text-xs text-muted-foreground mb-3">{a.desc}</p>
            <button className="text-xs font-medium text-indigo-600 hover:text-indigo-800" onClick={() => a.type && onNavigate?.(a.type)}>
              <ExternalLink className="w-3 h-3 inline mr-1" />{a.action}
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground">PDF Studio available at Quote and Proposal stages.</p>}
      </div>
    </div>
  );
}

// ── Inline P&L Calculator (from standalone PnLCalculator page) ──
function InlinePnlCalculator() {
  const [storageRate, setStorageRate] = useState(40);
  const [pallets, setPallets] = useState(2500);
  const [inboundRate, setInboundRate] = useState(7);
  const [inboundVol, setInboundVol] = useState(800);
  const [outboundRate, setOutboundRate] = useState(7);
  const [outboundVol, setOutboundVol] = useState(800);
  const [vasRevenue, setVasRevenue] = useState(5000);
  const [facilityCost, setFacilityCost] = useState(120000);
  const [staffCost, setStaffCost] = useState(85000);
  const [mheCost, setMheCost] = useState(15000);
  const [insuranceCost, setInsuranceCost] = useState(5000);
  const [otherCost, setOtherCost] = useState(8000);

  const storageRev = storageRate * pallets * 30;
  const inboundRev = inboundRate * inboundVol;
  const outboundRev = outboundRate * outboundVol;
  const monthlyRev = storageRev + inboundRev + outboundRev + vasRevenue;
  const annualRev = monthlyRev * 12;
  const monthlyOpex = facilityCost + staffCost + mheCost + insuranceCost + otherCost;
  const gaCost = monthlyOpex * 0.10;
  const totalMonthlyOpex = monthlyOpex + gaCost;
  const annualOpex = totalMonthlyOpex * 12;
  const grossProfit = annualRev - annualOpex;
  const gpPercent = annualRev > 0 ? (grossProfit / annualRev) * 100 : 0;

  const fmt = (n: number) => `SAR ${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const revenueFields = [
    { l: "Storage Rate (SAR/plt/day)", v: storageRate, s: setStorageRate },
    { l: "Pallet Volume", v: pallets, s: setPallets },
    { l: "Inbound Rate (SAR/plt)", v: inboundRate, s: setInboundRate },
    { l: "Inbound Volume/mo", v: inboundVol, s: setInboundVol },
    { l: "Outbound Rate (SAR/plt)", v: outboundRate, s: setOutboundRate },
    { l: "Outbound Volume/mo", v: outboundVol, s: setOutboundVol },
    { l: "VAS Revenue/mo", v: vasRevenue, s: setVasRevenue },
  ];

  const costFields = [
    { l: "Facility Cost/mo", v: facilityCost, s: setFacilityCost },
    { l: "Staff Cost/mo", v: staffCost, s: setStaffCost },
    { l: "MHE Cost/mo", v: mheCost, s: setMheCost },
    { l: "Insurance/mo", v: insuranceCost, s: setInsuranceCost },
    { l: "Other Operational/mo", v: otherCost, s: setOtherCost },
  ];

  const breakdownItems = [
    { l: "Storage", v: storageRev, pct: monthlyRev > 0 ? (storageRev / monthlyRev) * 100 : 0 },
    { l: "Inbound", v: inboundRev, pct: monthlyRev > 0 ? (inboundRev / monthlyRev) * 100 : 0 },
    { l: "Outbound", v: outboundRev, pct: monthlyRev > 0 ? (outboundRev / monthlyRev) * 100 : 0 },
    { l: "VAS", v: vasRevenue, pct: monthlyRev > 0 ? (vasRevenue / monthlyRev) * 100 : 0 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Revenue + Cost inputs */}
      <div className="lg:col-span-2 space-y-4">
        {/* Revenue Model */}
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Revenue Model
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {revenueFields.map(f => (
              <div key={f.l}>
                <label className="text-[10px] text-muted-foreground font-medium">{f.l}</label>
                <input type="number" value={f.v} onChange={e => f.s(Number(e.target.value))}
                  className="mt-0.5 w-full h-8 px-2 text-sm rounded border border-border bg-background" />
              </div>
            ))}
          </div>
        </div>

        {/* Cost Model */}
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-violet-500" /> Cost Model
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {costFields.map(f => (
              <div key={f.l}>
                <label className="text-[10px] text-muted-foreground font-medium">{f.l}</label>
                <input type="number" value={f.v} onChange={e => f.s(Number(e.target.value))}
                  className="mt-0.5 w-full h-8 px-2 text-sm rounded border border-border bg-background" />
              </div>
            ))}
            <div>
              <label className="text-[10px] text-muted-foreground font-medium">G&A (10% of OPEX)</label>
              <div className="mt-0.5 h-8 flex items-center text-sm text-muted-foreground">{fmt(gaCost)}/mo</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: P&L Summary + Revenue Breakdown */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border p-4 bg-muted/20">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4" /> P&L Summary
          </p>
          <div className="space-y-2">
            {[
              { l: "Monthly Revenue", v: fmt(monthlyRev) },
              { l: "Annual Revenue", v: fmt(annualRev) },
              { l: "Monthly OPEX", v: fmt(totalMonthlyOpex) },
              { l: "Annual OPEX", v: fmt(annualOpex) },
            ].map(r => (
              <div key={r.l} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{r.l}</span>
                <span className="font-medium">{r.v}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 mt-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-sm font-semibold">Gross Profit</span>
              <span className={`text-lg font-bold ${grossProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(grossProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-semibold">GP%</span>
              <span className={`text-2xl font-bold ${gpPercent >= 22 ? "text-emerald-700" : gpPercent >= 10 ? "text-amber-700" : "text-red-700"}`}>{fmtPct(gpPercent)}</span>
            </div>
          </div>
          <div className="mt-3 p-2 rounded border border-border bg-background">
            <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-0.5">Approval Requirement</p>
            <p className="text-xs font-medium">
              {gpPercent >= 30 ? "Regional Sales Head + Ops Feasibility" : gpPercent >= 22 ? "Regional Sales Head + Ops Head" : gpPercent >= 10 ? "All above + Directors" : "All above + CEO/CFO"}
            </p>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold mb-3">Revenue Breakdown</p>
          <div className="space-y-2">
            {breakdownItems.map(r => (
              <div key={r.l}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span>{r.l}</span>
                  <span>{fmt(r.v)} ({fmtPct(r.pct)})</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
