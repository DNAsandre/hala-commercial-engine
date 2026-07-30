/**
 * ProposalStageWorkbench - universal proposal UX skeleton.
 *
 * Development rule: the skeleton standardizes UI only. It must not create
 * stage gates, tab locks, readiness blockers, or approval prisons.
 */
import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Database,
  DollarSign,
  FileCheck,
  FileSignature,
  FileText,
  FolderOpen,
  Handshake,
  History,
  Landmark,
  ListChecks,
  Loader2,
  MessageSquare,
  Package,
  Radio,
  Route,
  Save,
  Scale,
  Send,
  Shield,
  Target,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ProcessStageEmptyState,
  ProcessStageTaskShell,
  type ProcessStageSectionTab,
} from "@/components/process/ProcessStageTaskShell";
import type { ActiveProposalIdentity } from "@/lib/proposal-identity";
import {
  extractDiscoveryStageData,
  extractProposalContractSignedStageData,
  extractProposalCommercialApprovalStageData,
  extractProposalGoLiveStageData,
  extractProposalNegotiationStageData,
  extractPnlPricingStageData,
  extractProposalDraftingStageData,
  extractProposalSentStageData,
  extractQuoteStageData,
  extractQualifiedStageData,
  extractSolutionDesignStageData,
  getDiscoveryStageDataSignature,
  getProposalContractSignedStageDataSignature,
  getProposalCommercialApprovalStageDataSignature,
  getProposalGoLiveStageDataSignature,
  getProposalNegotiationStageDataSignature,
  getPnlPricingStageDataSignature,
  getProposalDraftingStageDataSignature,
  getProposalSentStageDataSignature,
  getQuoteStageDataSignature,
  getQualifiedStageDataSignature,
  getSolutionDesignStageDataSignature,
  loadProposalDiscoveryStageData,
  loadProposalContractSignedStageData,
  loadProposalCommercialApprovalStageData,
  loadProposalGoLiveStageData,
  loadProposalNegotiationStageData,
  loadProposalPnlPricingStageData,
  loadProposalDraftingStageData,
  loadProposalSentStageData,
  loadProposalQuoteStageData,
  loadProposalQualifiedStageData,
  loadProposalSolutionDesignStageData,
  mergeDiscoveryStageData,
  mergeProposalContractSignedStageData,
  mergeProposalCommercialApprovalStageData,
  mergeProposalGoLiveStageData,
  mergeProposalNegotiationStageData,
  mergePnlPricingStageData,
  mergeProposalDraftingStageData,
  mergeProposalSentStageData,
  mergeQuoteStageData,
  mergeQualifiedStageData,
  mergeSolutionDesignStageData,
  saveProposalDiscoveryStageData,
  saveProposalContractSignedStageData,
  saveProposalCommercialApprovalStageData,
  saveProposalGoLiveStageData,
  saveProposalNegotiationStageData,
  saveProposalPnlPricingStageData,
  saveProposalDraftingStageData,
  saveProposalSentStageData,
  saveProposalQuoteStageData,
  saveProposalQualifiedStageData,
  saveProposalSolutionDesignStageData,
} from "@/lib/proposal-workspace-persistence";
import {
  PROPOSAL_TRACKER_STAGES,
  getDefaultProposalTabKey,
  getDefaultProposalTaskKey,
  getProposalStage,
  getProposalStageTasks,
  getProposalTask,
  type ProposalStageTask,
} from "./proposal-stages";
import SupportingDocumentsPanel, {
  decodeProposalDocumentNotes,
  type SupportingDocCategory,
  type SupportingDocument,
} from "./SupportingDocumentsPanel";
import {
  calcCommercialApprovalReadiness,
  calcContractSignedReadiness,
  calcDiscoveryCompleteness,
  calcGoLiveReadiness,
  calcNegotiationReadiness,
  calcPricingConfidence,
  calcProposalDraftingReadiness,
  calcProposalSentReadiness,
  calcQuoteReadiness,
  calcQualificationReadiness,
  calcSolutionReadiness,
  createDefaultWorkspaceData,
  logDataChange,
  logProposalAudit,
  type ProposalWorkspaceData,
} from "./proposal-workspace-state";
import { CustomerFitTab, OpportunityBriefTab, QualificationSummaryTab, RequiredInfoTab } from "./stages/QualifiedStage";
import { CurrentPainTab, CustomerNeedsTab, MeetingNotesTab, RisksAssumptionsTab, VolumesLanesTab } from "./stages/DiscoveryStage";
import {
  AssumptionsDependenciesTab,
  OperationalFeasibilityTab,
  ServiceScopeTab,
  SolutionConfigurationTab,
  SystemsVisibilityTab,
  TransportModelTab,
  VasHandlingTab,
  WarehouseModelTab,
} from "./stages/SolutionDesignStage";
import { CostInputsTab, MarginScenariosTab, PnlCalculatorTab, PricingLinesTab } from "./stages/PnlPricingStage";
import { CommercialTermsTab, PricingAssumptionsExclusionsTab } from "./stages/PnlPricingCommercialTabs";
import {
  QuotePricingSummaryTab,
  QuoteServiceScopeTab,
  QuoteSummaryTab,
  QuoteTermsAssumptionsExclusionsTab,
  QuoteVersionsTab,
} from "./stages/QuoteStage";
import {
  AppendixNotesTab,
  BlockEditorTab,
  BlockRegisterTab,
  CommercialVolumeTab,
  EvidenceRegisterTab,
  FinalDraftReviewTab,
  SourceInspectorTab,
  SourceMapTab,
  TechnicalOperationalVolumeTab,
  TocPlannerTab,
} from "./stages/ProposalDraftingStage";
import {
  AttachmentsRegisterTab,
  DeliveryRecordTab,
  ProposalCrmSyncTab,
  ProposalSentAuditTrailTab,
  RecipientContactLogTab,
  SentVersionTab,
} from "./stages/ProposalSentStage";
import {
  CustomerFeedbackTab,
  NegotiationMarginImpactTab,
  NegotiationNotesTab,
  PricingChangesTab,
  RequestedScopeChangesTab,
  RevisedVersionsTab,
} from "./stages/NegotiationStage";
import {
  ApprovalRecordTab,
  ApprovalSummaryTab,
  FinalCommercialPositionTab,
  MarginTermsReviewTab,
  RiskExceptionNotesTab,
} from "./stages/CommercialApprovalStage";
import {
  FinalPricingTab,
  FinalScopeTab,
  FinalTermsTab,
  HandoverPrepTab,
  SignedContractReferenceTab,
} from "./stages/ContractSignedStage";
import {
  GoLiveSummaryTab,
  MobilizationTrackerTab,
  OpenRisksTab,
  OperationsHandoverTab,
  RenewalFutureMemoryTab,
  SlaKpiSetupTab,
} from "./stages/GoLiveStage";

interface ProposalStageWorkbenchProps {
  activeProposal?: ActiveProposalIdentity | null;
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

interface StageTaskProgressSegment {
  key: string;
  label: string;
  percent: number | null;
}

const TASK_ICONS: Record<string, ElementType> = {
  qualification_summary: ClipboardList,
  customer_fit: Target,
  opportunity_details: BookOpen,
  required_info: CheckCircle2,
  supporting_documents: FolderOpen,
  discovery_summary: BookOpen,
  meeting_notes: MessageSquare,
  customer_needs: Users,
  volumes_lanes_inventory: Package,
  pain_points_risks: AlertTriangle,
  solution_configuration: Wrench,
  warehouse_model: Building2,
  transport_model: Truck,
  vas_special_handling: Package,
  systems_visibility: Database,
  service_scope_matrix: ClipboardList,
  operational_feasibility: Shield,
  assumptions_dependencies: FileText,
  pnl_calculator: Calculator,
  cost_inputs: DollarSign,
  pricing_lines: DollarSign,
  margin_scenarios: Scale,
  commercial_terms: FileSignature,
  assumptions_exclusions: FileText,
  quote_summary: FileText,
  service_scope: ClipboardList,
  pricing_summary: DollarSign,
  terms_assumptions_exclusions: FileSignature,
  quote_versions: History,
  proposal_architecture_toc: ListChecks,
  proposal_block_workbench: FileText,
  technical_operational_volume: Truck,
  commercial_volume: Landmark,
  appendices_evidence: Archive,
  final_draft_review: CheckCircle2,
  sent_version: Send,
  delivery_record: FileCheck,
  recipient_contact_log: Users,
  attachments_register: FolderOpen,
  crm_sync: Radio,
  audit_trail: History,
  customer_feedback: MessageSquare,
  requested_scope_changes: ClipboardList,
  pricing_changes: DollarSign,
  margin_impact: Scale,
  revised_versions: FileText,
  negotiation_notes: MessageSquare,
  approval_summary: CheckCircle2,
  margin_terms_review: Scale,
  risk_exception_notes: AlertTriangle,
  final_commercial_position: Landmark,
  approval_record: FileCheck,
  signed_contract_reference: FileSignature,
  final_scope: ClipboardList,
  final_pricing: DollarSign,
  final_terms: FileSignature,
  handover_prep: Handshake,
  go_live_summary: Route,
  mobilization_tracker: Truck,
  operations_handover: Users,
  sla_kpi_setup: Target,
  open_risks: AlertTriangle,
  renewal_future_memory: History,
};

function stageTaskProgressColor(percent: number | null): string {
  if (percent === null) return "bg-slate-500";
  if (percent >= 100) return "bg-emerald-500";
  if (percent >= 80) return "bg-emerald-300";
  if (percent >= 50) return "bg-yellow-400";
  if (percent >= 20) return "bg-orange-500";
  return "bg-red-500";
}

function StageTaskProgressMeter({ segments }: { segments: StageTaskProgressSegment[] }) {
  return (
    <div className="col-span-3 mt-1 grid h-2 w-full grid-flow-col auto-cols-fr gap-0.5 rounded-full bg-slate-100">
      {segments.map(segment => (
        <span
          key={segment.key}
          className={`${stageTaskProgressColor(segment.percent)} min-w-0 rounded-sm shadow-[inset_0_0_0_1px_rgba(15,23,42,.12)] first:rounded-l-full last:rounded-r-full`}
          title={`${segment.label}: ${segment.percent === null ? "Awaiting data" : `${segment.percent}% complete`}`}
        />
      ))}
    </div>
  );
}

function percent(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

function hasValue(value: unknown): boolean {
  if (typeof value === "number") return value > 0;
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function hasNonZeroNumber(value: unknown): boolean {
  return typeof value === "number" && value !== 0;
}

function hasMeetingNoteContent(note: ProposalWorkspaceData["meetingNotes"][number]): boolean {
  return [
    note.date,
    note.attendees,
    note.notes,
    note.keyDecisions,
    note.openQuestions,
    note.nextActions,
  ].some(hasValue);
}

function hasPnlLineContent(line: { amount: number }): boolean {
  return hasNonZeroNumber(line.amount);
}

function hasPnlVersionContent(version: ProposalWorkspaceData["pnlVersions"][number]): boolean {
  return version.revenue.some(hasPnlLineContent) ||
    version.costs.some(hasPnlLineContent) ||
    hasNonZeroNumber(version.overheadPercent) ||
    hasValue(version.notes);
}

function hasCostInputContent(input: ProposalWorkspaceData["costInputs"][number]): boolean {
  return [input.category, input.description, input.source].some(hasValue) || hasNonZeroNumber(input.amount);
}

function hasPricingLineContent(line: ProposalWorkspaceData["pricingLines"][number]): boolean {
  return [line.service, line.unit, line.frequency].some(hasValue) ||
    [line.rate, line.quantity, line.total].some(hasNonZeroNumber);
}

function hasQuoteVersionContent(version: ProposalWorkspaceData["quoteVersions"][number]): boolean {
  return [version.versionLabel, version.createdAt, version.status, version.notes].some(hasValue);
}

function hasTocSectionContent(section: ProposalWorkspaceData["proposalTocSections"][number]): boolean {
  return [section.sectionTitle, section.volume, section.purpose, section.sourceStage, section.notes].some(hasValue);
}

function hasSourceMapContent(mapping: ProposalWorkspaceData["proposalSourceMap"][number]): boolean {
  return [mapping.sourceStage, mapping.sourceTab, mapping.sourceField, mapping.targetSectionId, mapping.usageNotes].some(hasValue);
}

function hasDraftBlockContent(block: ProposalWorkspaceData["proposalDraftBlocks"][number]): boolean {
  return [block.sectionId, block.blockTitle, block.volume, block.owner, block.status, block.sourceRefs, block.content].some(hasValue);
}

function hasEvidenceItemContent(item: ProposalWorkspaceData["proposalEvidenceItems"][number]): boolean {
  return [item.evidenceTitle, item.evidenceType, item.sourceStage, item.linkedSectionId, item.documentRef, item.notes].some(hasValue);
}

function hasStageDocuments(documents: SupportingDocument[], stageKey: string): boolean {
  return documents.some(doc => doc.linkedStage === stageKey || doc.linkedStage === "all");
}

function getQualifiedTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  const qs = wsData.qualificationSummary;
  const cf = wsData.customerFit;
  const ob = wsData.opportunityBrief;
  switch (taskKey) {
    case "qualification_summary": {
      const fields = [
        qs.opportunityName,
        qs.customer,
        qs.region,
        qs.industry,
        qs.serviceType,
        qs.estimatedRevenue,
        qs.expectedCloseDate,
        qs.crmRef,
        qs.leadSource,
      ];
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "customer_fit": {
      const fields = [
        cf.icpFit,
        cf.strategicFit,
        cf.regionFit,
        cf.capabilityFit,
        cf.relationshipStrength,
        cf.competitorPresence,
        cf.fitScore,
        cf.strategicFindings,
      ];
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "opportunity_details": {
      const fields = [
        ob.customerNeed,
        ob.whyNow,
        ob.scopeSummary,
        ob.keyStakeholders,
        ob.decisionTimeline,
        ob.knownConstraints,
      ];
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "required_info":
      return percent(wsData.requiredInfo.filter(item => item.complete).length, wsData.requiredInfo.length);
    case "supporting_documents":
      return hasStageDocuments(documents, "qualified") ? 100 : 0;
    default:
      return null;
  }
}

function getDiscoveryTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "discovery_summary":
      return calcDiscoveryCompleteness(wsData);
    case "meeting_notes": {
      if (wsData.meetingNotes.length === 0) return 0;
      const usefulNotes = wsData.meetingNotes.filter(hasMeetingNoteContent).length;
      return usefulNotes > 0 ? 100 : 0;
    }
    case "customer_needs": {
      const fields = Object.values(wsData.customerNeeds);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "volumes_lanes_inventory": {
      const fields = Object.values(wsData.volumesLanes);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "pain_points_risks": {
      const fields = [
        ...Object.values(wsData.currentPain),
        ...Object.values(wsData.risksAssumptions),
      ];
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "discovery") ? 100 : 0;
    default:
      return null;
  }
}

function getSolutionDesignTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "solution_configuration": {
      const fields = Object.values(wsData.solutionConfiguration);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "warehouse_model": {
      const fields = Object.values(wsData.warehouseModel);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "transport_model": {
      const fields = Object.values(wsData.transportModel);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "vas_special_handling": {
      const fields = Object.values(wsData.vasHandling);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "systems_visibility": {
      const fields = Object.values(wsData.systemsVisibility);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "service_scope_matrix": {
      const fields = Object.values(wsData.serviceScope);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "operational_feasibility": {
      const fields = Object.values(wsData.operationalFeasibility);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "assumptions_dependencies": {
      const fields = Object.values(wsData.assumptionsDependencies);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "solution_design") ? 100 : 0;
    default:
      return null;
  }
}

function getPnlPricingTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "pnl_calculator": {
      if (wsData.pnlVersions.length === 0) return 0;
      const meaningfulVersions = wsData.pnlVersions.filter(hasPnlVersionContent);
      const activeVersion = wsData.pnlVersions.find(version => version.id === wsData.activePnlVersion && hasPnlVersionContent(version));
      const completed = [
        meaningfulVersions.length > 0,
        Boolean(activeVersion),
        wsData.pnlVersions.some(version => version.revenue.some(hasPnlLineContent)),
        wsData.pnlVersions.some(version => version.costs.some(hasPnlLineContent)),
        wsData.pnlVersions.some(version => version.isApproved && hasPnlVersionContent(version)),
      ].filter(Boolean).length;
      return percent(completed, 5);
    }
    case "cost_inputs": {
      if (wsData.costInputs.length === 0) return 0;
      const meaningfulInputs = wsData.costInputs.filter(hasCostInputContent);
      if (meaningfulInputs.length === 0) return 0;
      const completed = meaningfulInputs.reduce((total, input) => total + [
        input.category,
        input.description,
        input.amount,
        input.source,
        input.verified,
      ].filter(hasValue).length, 0);
      return percent(completed, meaningfulInputs.length * 5);
    }
    case "pricing_lines": {
      if (wsData.pricingLines.length === 0) return 0;
      const meaningfulLines = wsData.pricingLines.filter(hasPricingLineContent);
      if (meaningfulLines.length === 0) return 0;
      const completed = meaningfulLines.reduce((total, line) => total + [
        line.service,
        line.unit,
        line.rate,
        line.quantity,
        line.frequency,
        line.total,
      ].filter(hasValue).length, 0);
      return percent(completed, meaningfulLines.length * 6);
    }
    case "margin_scenarios": {
      if (wsData.marginScenarios.length === 0) return 0;
      const completed = wsData.marginScenarios.filter(scenario =>
        hasValue(scenario.revenue) || hasValue(scenario.cost) || hasValue(scenario.notes)
      ).length;
      return percent(completed, wsData.marginScenarios.length);
    }
    case "commercial_terms": {
      const fields = Object.values(wsData.commercialTerms);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "assumptions_exclusions": {
      const fields = Object.values(wsData.pricingAssumptionsExclusions);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "pnl_pricing") ? 100 : 0;
    default:
      return null;
  }
}

function getQuoteTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "quote_summary": {
      const fields = Object.values(wsData.quoteSummary);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "service_scope": {
      const fields = Object.values(wsData.quoteServiceScope);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "pricing_summary": {
      const fields = [
        wsData.quotePricingSummary.linkedPnlVersionName,
        wsData.quotePricingSummary.totalRevenue,
        wsData.quotePricingSummary.totalCost,
        wsData.quotePricingSummary.grossProfit,
        wsData.quotePricingSummary.grossProfitPercent,
        wsData.quotePricingSummary.pricingSummary,
        wsData.quotePricingSummary.pricingTableNotes,
      ];
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "terms_assumptions_exclusions": {
      const fields = Object.values(wsData.quoteTermsAssumptionsExclusions);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "quote_versions":
      return wsData.quoteVersions.some(hasQuoteVersionContent) ? 100 : 0;
    case "supporting_documents":
      return hasStageDocuments(documents, "quote") ? 100 : 0;
    default:
      return null;
  }
}

function getProposalDraftingTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "proposal_architecture_toc": {
      const sectionScore = wsData.proposalTocSections.some(hasTocSectionContent) ? 50 : 0;
      const mappingScore = wsData.proposalSourceMap.some(hasSourceMapContent) ? 50 : 0;
      return sectionScore + mappingScore;
    }
    case "proposal_block_workbench": {
      if (wsData.proposalDraftBlocks.length === 0) return 0;
      const meaningfulBlocks = wsData.proposalDraftBlocks.filter(hasDraftBlockContent);
      if (meaningfulBlocks.length === 0) return 0;
      const completed = meaningfulBlocks.reduce((total, block) => total + [
        block.sectionId,
        block.blockTitle,
        block.volume,
        block.owner,
        block.status,
        block.sourceRefs,
        block.content,
      ].filter(hasValue).length, 0);
      return percent(completed, meaningfulBlocks.length * 7);
    }
    case "technical_operational_volume": {
      const fields = Object.values(wsData.proposalTechnicalVolume);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "commercial_volume": {
      const fields = Object.values(wsData.proposalCommercialVolume);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "appendices_evidence": {
      const evidenceScore = wsData.proposalEvidenceItems.some(hasEvidenceItemContent) ? 50 : 0;
      const appendixFields = Object.values(wsData.proposalAppendixNotes);
      const appendixScore = appendixFields.some(hasValue) ? 50 : 0;
      return evidenceScore + appendixScore;
    }
    case "final_draft_review": {
      const fields = Object.values(wsData.proposalFinalDraftReview);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "proposal_drafting") ? 100 : 0;
    default:
      return null;
  }
}

function hasProposalSentRecipientContent(contact: ProposalWorkspaceData["proposalRecipientContacts"][number]): boolean {
  return [
    contact.contactName,
    contact.role,
    contact.company,
    contact.email,
    contact.phone,
    contact.notes,
  ].some(hasValue);
}

function hasProposalSentAttachmentContent(attachment: ProposalWorkspaceData["proposalSentAttachments"][number]): boolean {
  return [
    attachment.documentName,
    attachment.category,
    attachment.versionLabel,
    attachment.documentRef,
    attachment.notes,
  ].some(hasValue);
}

function hasProposalSentAuditContent(note: ProposalWorkspaceData["proposalSentAuditNotes"][number]): boolean {
  return [
    note.eventDate,
    note.actor,
    note.action,
    note.notes,
  ].some(hasValue);
}

function hasNegotiationCustomerFeedbackContent(item: ProposalWorkspaceData["proposalCustomerFeedback"][number]): boolean {
  return [
    item.feedbackDate,
    item.contactName,
    item.feedbackType,
    item.feedbackSummary,
    item.sentiment,
    item.owner,
    item.nextAction,
  ].some(hasValue);
}

function hasNegotiationScopeChangeContent(item: ProposalWorkspaceData["proposalRequestedScopeChanges"][number]): boolean {
  return [
    item.changeArea,
    item.requestedChange,
    item.operationalImpact,
    item.status,
    item.owner,
    item.notes,
  ].some(hasValue);
}

function hasNegotiationPricingChangeContent(item: ProposalWorkspaceData["proposalPricingChanges"][number]): boolean {
  return [
    item.serviceLine,
    item.requestedChange,
    item.revisedPrice,
    item.commercialImpact,
    item.status,
    item.notes,
  ].some(hasValue);
}

function hasNegotiationRevisedVersionContent(item: ProposalWorkspaceData["proposalRevisedVersions"][number]): boolean {
  return [
    item.versionLabel,
    item.sourceVersion,
    item.changeSummary,
    item.documentRef,
    item.status,
    item.notes,
  ].some(hasValue);
}

function hasNegotiationNoteContent(item: ProposalWorkspaceData["proposalNegotiationNotes"][number]): boolean {
  return [
    item.noteDate,
    item.actor,
    item.discussionSummary,
    item.decision,
    item.nextAction,
  ].some(hasValue);
}

function getProposalSentTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "sent_version": {
      const fields = Object.values(wsData.proposalSentVersion);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "delivery_record": {
      const fields = Object.values(wsData.proposalDeliveryRecord);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "recipient_contact_log":
      return wsData.proposalRecipientContacts.some(hasProposalSentRecipientContent) ? 100 : 0;
    case "attachments_register":
      return wsData.proposalSentAttachments.some(hasProposalSentAttachmentContent) ? 100 : 0;
    case "crm_sync": {
      const fields = Object.values(wsData.proposalCrmSyncRecord);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "audit_trail":
      return wsData.proposalSentAuditNotes.some(hasProposalSentAuditContent) ? 100 : 0;
    case "supporting_documents":
      return hasStageDocuments(documents, "proposal_sent") ? 100 : 0;
    default:
      return null;
  }
}

function getNegotiationTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "customer_feedback":
      return wsData.proposalCustomerFeedback.some(hasNegotiationCustomerFeedbackContent) ? 100 : 0;
    case "requested_scope_changes":
      return wsData.proposalRequestedScopeChanges.some(hasNegotiationScopeChangeContent) ? 100 : 0;
    case "pricing_changes":
      return wsData.proposalPricingChanges.some(hasNegotiationPricingChangeContent) ? 100 : 0;
    case "margin_impact": {
      const fields = Object.values(wsData.proposalNegotiationMarginImpact);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "revised_versions":
      return wsData.proposalRevisedVersions.some(hasNegotiationRevisedVersionContent) ? 100 : 0;
    case "negotiation_notes":
      return wsData.proposalNegotiationNotes.some(hasNegotiationNoteContent) ? 100 : 0;
    case "supporting_documents":
      return hasStageDocuments(documents, "negotiation") ? 100 : 0;
    default:
      return null;
  }
}

function getCommercialApprovalTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "approval_summary": {
      const fields = Object.values(wsData.proposalApprovalSummary);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "margin_terms_review": {
      const fields = Object.values(wsData.proposalMarginTermsReview);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "risk_exception_notes": {
      const fields = Object.values(wsData.proposalRiskExceptionNotes);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "final_commercial_position": {
      const fields = Object.values(wsData.proposalFinalCommercialPosition);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "approval_record": {
      const fields = Object.values(wsData.proposalApprovalRecord);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "commercial_approval") ? 100 : 0;
    default:
      return null;
  }
}

function getContractSignedTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "signed_contract_reference": {
      const fields = Object.values(wsData.proposalSignedContractReference);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "final_scope": {
      const fields = Object.values(wsData.proposalFinalContractScope);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "final_pricing": {
      const fields = Object.values(wsData.proposalFinalContractPricing);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "final_terms": {
      const fields = Object.values(wsData.proposalFinalContractTerms);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "handover_prep": {
      const fields = Object.values(wsData.proposalContractHandoverPrep);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "contract_signed") ? 100 : 0;
    default:
      return null;
  }
}

function getGoLiveTaskPercent(taskKey: string, wsData: ProposalWorkspaceData, documents: SupportingDocument[]): number | null {
  switch (taskKey) {
    case "go_live_summary": {
      const fields = Object.values(wsData.proposalGoLiveSummary);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "mobilization_tracker": {
      const fields = Object.values(wsData.proposalMobilizationTracker);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "operations_handover": {
      const fields = Object.values(wsData.proposalOperationsHandover);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "sla_kpi_setup": {
      const fields = Object.values(wsData.proposalSlaKpiSetup);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "open_risks": {
      const fields = Object.values(wsData.proposalOpenImplementationRisks);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "renewal_future_memory": {
      const fields = Object.values(wsData.proposalRenewalFutureMemory);
      return percent(fields.filter(hasValue).length, fields.length);
    }
    case "supporting_documents":
      return hasStageDocuments(documents, "go_live") ? 100 : 0;
    default:
      return null;
  }
}

function buildTaskProgress(
  task: ProposalStageTask,
  activeStage: string,
  wsData: ProposalWorkspaceData,
  documents: SupportingDocument[],
): StageTaskProgressSegment[] {
  const taskPercent = activeStage === "qualified"
    ? getQualifiedTaskPercent(task.key, wsData, documents)
    : activeStage === "discovery"
      ? getDiscoveryTaskPercent(task.key, wsData, documents)
      : activeStage === "solution_design"
        ? getSolutionDesignTaskPercent(task.key, wsData, documents)
        : activeStage === "pnl_pricing"
          ? getPnlPricingTaskPercent(task.key, wsData, documents)
          : activeStage === "quote"
            ? getQuoteTaskPercent(task.key, wsData, documents)
            : activeStage === "proposal_drafting"
              ? getProposalDraftingTaskPercent(task.key, wsData, documents)
              : activeStage === "proposal_sent"
                ? getProposalSentTaskPercent(task.key, wsData, documents)
                : activeStage === "negotiation"
                  ? getNegotiationTaskPercent(task.key, wsData, documents)
                  : activeStage === "commercial_approval"
                    ? getCommercialApprovalTaskPercent(task.key, wsData, documents)
                    : activeStage === "contract_signed"
                      ? getContractSignedTaskPercent(task.key, wsData, documents)
                      : activeStage === "go_live"
                        ? getGoLiveTaskPercent(task.key, wsData, documents)
                      : null;
  return task.tabs.map(tab => ({
    key: tab.key,
    label: tab.label,
    percent: taskPercent,
  }));
}

function getIconForKey(key: string): ElementType {
  return TASK_ICONS[key] ?? FileText;
}

function findDocumentTask(stageTasks: ProposalStageTask[]): ProposalStageTask | undefined {
  const documentTaskPriority = [
    "supporting_documents",
    "appendices_evidence",
    "attachments_register",
    "signed_contract_reference",
    "approval_record",
    "revised_versions",
    "delivery_record",
    "handover_prep",
    "operations_handover",
  ];
  return documentTaskPriority.map(key => stageTasks.find(task => task.key === key)).find(Boolean)
    ?? stageTasks.find(task => /document|evidence|attachment|reference|version|record|handover/i.test(task.label));
}

function docText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function docNumber(value: unknown, defaultValue = 1): number {
  return typeof value === "number" && Number.isFinite(value) ? value : defaultValue;
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map(value => docText(value)).filter(Boolean)));
}

function mergeSupportingDocuments(...sets: SupportingDocument[][]): SupportingDocument[] {
  const merged = new Map<string, SupportingDocument>();
  sets.flat().forEach(doc => {
    if (!merged.has(doc.id)) merged.set(doc.id, doc);
  });
  return Array.from(merged.values());
}

function readDocumentRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
    : [];
}

function mapGeneratedDocumentToSupportingDocument(
  row: Record<string, unknown>,
  activeProposal: ActiveProposalIdentity,
): SupportingDocument | null {
  const decoded = decodeProposalDocumentNotes(docText(row.notes));
  if (!decoded.meta) return null;

  const id = docText(row.id);
  const fileName = docText(row.file_name);
  if (!id || !fileName) return null;

  const owner = docText(row.generated_by_name) || docText(row.generated_by) || "Unknown";
  const workspaceId = docText(row.workspace_id) || activeProposal.proposalId;

  return {
    id,
    fileName,
    category: (docText(row.document_type) || "Supporting") as SupportingDocCategory,
    proposalId: activeProposal.proposalId,
    proposalName: activeProposal.title,
    workspaceId,
    workspaceName: activeProposal.title,
    linkedStage: decoded.meta.linkedStage,
    linkedTab: decoded.meta.linkedTab,
    source: "Upload",
    owner,
    dateUploaded: docText(row.generated_at),
    version: docNumber(row.version_number),
    notes: decoded.notes,
    usedInPricing: decoded.meta.usedInPricing,
    usedInProposal: decoded.meta.usedInProposal,
    confidenceLevel: "medium",
  };
}

async function fetchProposalStageDocuments(
  activeProposal: ActiveProposalIdentity,
  workspaceId: string,
): Promise<SupportingDocument[]> {
  const scopeIds = uniqueText([
    activeProposal.proposalId,
    activeProposal.workspaceId,
    activeProposal.routeId,
    workspaceId,
  ]);
  const documents: SupportingDocument[] = [];

  for (const scopeId of scopeIds) {
    const response = await fetch(`/api/documents?workspace_id=${encodeURIComponent(scopeId)}`);
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(message || `Document load failed for ${scopeId}.`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) continue;
    const rows = readDocumentRows(await response.json());
    rows.forEach(row => {
      const doc = mapGeneratedDocumentToSupportingDocument(row, activeProposal);
      if (doc) documents.push(doc);
    });
  }

  return mergeSupportingDocuments(documents);
}

export default function ProposalStageWorkbench({
  activeProposal,
  activeStage,
  workspaceId,
  customerName,
  documents = [],
  onDocUpload,
  wsData: externalData,
  onWsDataChange,
  onSavePnlVersions,
}: ProposalStageWorkbenchProps) {
  const [localData, setLocalData] = useState<ProposalWorkspaceData>(() => createDefaultWorkspaceData());
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [activeTaskKey, setActiveTaskKey] = useState(() => getDefaultProposalTaskKey(activeStage));
  const [activeTab, setActiveTab] = useState(() => getDefaultProposalTabKey(activeStage, getDefaultProposalTaskKey(activeStage)));
  const [localDocuments, setLocalDocuments] = useState<SupportingDocument[]>([]);
  const [persistedDocuments, setPersistedDocuments] = useState<SupportingDocument[]>([]);
  const [qualifiedLoadState, setQualifiedLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [qualifiedSaveState, setQualifiedSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [qualifiedSavedAt, setQualifiedSavedAt] = useState<string | null>(null);
  const [lastSavedQualifiedSignature, setLastSavedQualifiedSignature] = useState(() =>
    getQualifiedStageDataSignature(extractQualifiedStageData(createDefaultWorkspaceData()))
  );
  const [discoveryLoadState, setDiscoveryLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [discoverySaveState, setDiscoverySaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [discoverySavedAt, setDiscoverySavedAt] = useState<string | null>(null);
  const [lastSavedDiscoverySignature, setLastSavedDiscoverySignature] = useState(() =>
    getDiscoveryStageDataSignature(extractDiscoveryStageData(createDefaultWorkspaceData()))
  );
  const [solutionDesignLoadState, setSolutionDesignLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [solutionDesignSaveState, setSolutionDesignSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [solutionDesignSavedAt, setSolutionDesignSavedAt] = useState<string | null>(null);
  const [lastSavedSolutionDesignSignature, setLastSavedSolutionDesignSignature] = useState(() =>
    getSolutionDesignStageDataSignature(extractSolutionDesignStageData(createDefaultWorkspaceData()))
  );
  const [pnlPricingLoadState, setPnlPricingLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [pnlPricingSaveState, setPnlPricingSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pnlPricingSavedAt, setPnlPricingSavedAt] = useState<string | null>(null);
  const [lastSavedPnlPricingSignature, setLastSavedPnlPricingSignature] = useState(() =>
    getPnlPricingStageDataSignature(extractPnlPricingStageData(createDefaultWorkspaceData()))
  );
  const [quoteLoadState, setQuoteLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [quoteSaveState, setQuoteSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [quoteSavedAt, setQuoteSavedAt] = useState<string | null>(null);
  const [lastSavedQuoteSignature, setLastSavedQuoteSignature] = useState(() =>
    getQuoteStageDataSignature(extractQuoteStageData(createDefaultWorkspaceData()))
  );
  const [proposalDraftingLoadState, setProposalDraftingLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proposalDraftingSaveState, setProposalDraftingSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [proposalDraftingSavedAt, setProposalDraftingSavedAt] = useState<string | null>(null);
  const [lastSavedProposalDraftingSignature, setLastSavedProposalDraftingSignature] = useState(() =>
    getProposalDraftingStageDataSignature(extractProposalDraftingStageData(createDefaultWorkspaceData()))
  );
  const [proposalSentLoadState, setProposalSentLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proposalSentSaveState, setProposalSentSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [proposalSentSavedAt, setProposalSentSavedAt] = useState<string | null>(null);
  const [lastSavedProposalSentSignature, setLastSavedProposalSentSignature] = useState(() =>
    getProposalSentStageDataSignature(extractProposalSentStageData(createDefaultWorkspaceData()))
  );
  const [proposalNegotiationLoadState, setProposalNegotiationLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proposalNegotiationSaveState, setProposalNegotiationSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [proposalNegotiationSavedAt, setProposalNegotiationSavedAt] = useState<string | null>(null);
  const [lastSavedProposalNegotiationSignature, setLastSavedProposalNegotiationSignature] = useState(() =>
    getProposalNegotiationStageDataSignature(extractProposalNegotiationStageData(createDefaultWorkspaceData()))
  );
  const [proposalCommercialApprovalLoadState, setProposalCommercialApprovalLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proposalCommercialApprovalSaveState, setProposalCommercialApprovalSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [proposalCommercialApprovalSavedAt, setProposalCommercialApprovalSavedAt] = useState<string | null>(null);
  const [lastSavedProposalCommercialApprovalSignature, setLastSavedProposalCommercialApprovalSignature] = useState(() =>
    getProposalCommercialApprovalStageDataSignature(extractProposalCommercialApprovalStageData(createDefaultWorkspaceData()))
  );
  const [proposalContractSignedLoadState, setProposalContractSignedLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proposalContractSignedSaveState, setProposalContractSignedSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [proposalContractSignedSavedAt, setProposalContractSignedSavedAt] = useState<string | null>(null);
  const [lastSavedProposalContractSignedSignature, setLastSavedProposalContractSignedSignature] = useState(() =>
    getProposalContractSignedStageDataSignature(extractProposalContractSignedStageData(createDefaultWorkspaceData()))
  );
  const [proposalGoLiveLoadState, setProposalGoLiveLoadState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [proposalGoLiveSaveState, setProposalGoLiveSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [proposalGoLiveSavedAt, setProposalGoLiveSavedAt] = useState<string | null>(null);
  const [lastSavedProposalGoLiveSignature, setLastSavedProposalGoLiveSignature] = useState(() =>
    getProposalGoLiveStageDataSignature(extractProposalGoLiveStageData(createDefaultWorkspaceData()))
  );
  const previousStageRef = useRef(activeStage);

  const proposalDataScopeId = activeProposal?.proposalId ?? workspaceId;
  const stageInfo = getProposalStage(activeStage);
  const stageIndex = PROPOSAL_TRACKER_STAGES.findIndex(stage => stage.key === activeStage);
  const wsData = externalData ?? localData;
  const setWsData = onWsDataChange ?? setLocalData;
  const workbenchDocuments = useMemo(
    () => mergeSupportingDocuments(documents, persistedDocuments, localDocuments),
    [documents, persistedDocuments, localDocuments],
  );
  const stageTasks = useMemo(() => getProposalStageTasks(activeStage), [activeStage]);
  const activeTask = getProposalTask(activeStage, activeTaskKey) ?? stageTasks[0];
  const activeTabs = activeTask?.tabs ?? [];
  const documentTask = useMemo(() => findDocumentTask(stageTasks), [stageTasks]);
  const qualifiedSignature = useMemo(
    () => getQualifiedStageDataSignature(extractQualifiedStageData(wsData)),
    [wsData],
  );
  const discoverySignature = useMemo(
    () => getDiscoveryStageDataSignature(extractDiscoveryStageData(wsData)),
    [wsData],
  );
  const solutionDesignSignature = useMemo(
    () => getSolutionDesignStageDataSignature(extractSolutionDesignStageData(wsData)),
    [wsData],
  );
  const pnlPricingSignature = useMemo(
    () => getPnlPricingStageDataSignature(extractPnlPricingStageData(wsData)),
    [wsData],
  );
  const quoteSignature = useMemo(
    () => getQuoteStageDataSignature(extractQuoteStageData(wsData)),
    [wsData],
  );
  const proposalDraftingSignature = useMemo(
    () => getProposalDraftingStageDataSignature(extractProposalDraftingStageData(wsData)),
    [wsData],
  );
  const proposalSentSignature = useMemo(
    () => getProposalSentStageDataSignature(extractProposalSentStageData(wsData)),
    [wsData],
  );
  const proposalNegotiationSignature = useMemo(
    () => getProposalNegotiationStageDataSignature(extractProposalNegotiationStageData(wsData)),
    [wsData],
  );
  const proposalCommercialApprovalSignature = useMemo(
    () => getProposalCommercialApprovalStageDataSignature(extractProposalCommercialApprovalStageData(wsData)),
    [wsData],
  );
  const proposalContractSignedSignature = useMemo(
    () => getProposalContractSignedStageDataSignature(extractProposalContractSignedStageData(wsData)),
    [wsData],
  );
  const proposalGoLiveSignature = useMemo(
    () => getProposalGoLiveStageDataSignature(extractProposalGoLiveStageData(wsData)),
    [wsData],
  );
  const qualifiedDirty = activeStage === "qualified" &&
    qualifiedLoadState === "loaded" &&
    qualifiedSignature !== lastSavedQualifiedSignature;
  const discoveryDirty = activeStage === "discovery" &&
    discoveryLoadState === "loaded" &&
    discoverySignature !== lastSavedDiscoverySignature;
  const solutionDesignDirty = activeStage === "solution_design" &&
    solutionDesignLoadState === "loaded" &&
    solutionDesignSignature !== lastSavedSolutionDesignSignature;
  const pnlPricingDirty = activeStage === "pnl_pricing" &&
    pnlPricingLoadState === "loaded" &&
    pnlPricingSignature !== lastSavedPnlPricingSignature;
  const quoteDirty = activeStage === "quote" &&
    quoteLoadState === "loaded" &&
    quoteSignature !== lastSavedQuoteSignature;
  const proposalDraftingDirty = activeStage === "proposal_drafting" &&
    proposalDraftingLoadState === "loaded" &&
    proposalDraftingSignature !== lastSavedProposalDraftingSignature;
  const proposalSentDirty = activeStage === "proposal_sent" &&
    proposalSentLoadState === "loaded" &&
    proposalSentSignature !== lastSavedProposalSentSignature;
  const proposalNegotiationDirty = activeStage === "negotiation" &&
    proposalNegotiationLoadState === "loaded" &&
    proposalNegotiationSignature !== lastSavedProposalNegotiationSignature;
  const proposalCommercialApprovalDirty = activeStage === "commercial_approval" &&
    proposalCommercialApprovalLoadState === "loaded" &&
    proposalCommercialApprovalSignature !== lastSavedProposalCommercialApprovalSignature;
  const proposalContractSignedDirty = activeStage === "contract_signed" &&
    proposalContractSignedLoadState === "loaded" &&
    proposalContractSignedSignature !== lastSavedProposalContractSignedSignature;
  const proposalGoLiveDirty = activeStage === "go_live" &&
    proposalGoLiveLoadState === "loaded" &&
    proposalGoLiveSignature !== lastSavedProposalGoLiveSignature;

  useEffect(() => {
    let cancelled = false;
    setLocalDocuments([]);
    setPersistedDocuments([]);

    if (!activeProposal?.proposalId) return;

    fetchProposalStageDocuments(activeProposal, workspaceId)
      .then(docs => {
        if (!cancelled) setPersistedDocuments(docs);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          toast.warning(`Proposal documents could not be loaded: ${err.message}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProposal?.proposalId, activeProposal?.routeId, activeProposal?.workspaceId, workspaceId]);

  useEffect(() => {
    const proposalId = activeProposal?.proposalId;
    setLocalDocuments([]);

    if (!proposalId) {
      setQualifiedLoadState("idle");
      setQualifiedSavedAt(null);
      setLastSavedQualifiedSignature(getQualifiedStageDataSignature(extractQualifiedStageData(wsData)));
      setDiscoveryLoadState("idle");
      setDiscoverySavedAt(null);
      setLastSavedDiscoverySignature(getDiscoveryStageDataSignature(extractDiscoveryStageData(wsData)));
      setSolutionDesignLoadState("idle");
      setSolutionDesignSavedAt(null);
      setLastSavedSolutionDesignSignature(getSolutionDesignStageDataSignature(extractSolutionDesignStageData(wsData)));
      setPnlPricingLoadState("idle");
      setPnlPricingSavedAt(null);
      setLastSavedPnlPricingSignature(getPnlPricingStageDataSignature(extractPnlPricingStageData(wsData)));
      setQuoteLoadState("idle");
      setQuoteSavedAt(null);
      setLastSavedQuoteSignature(getQuoteStageDataSignature(extractQuoteStageData(wsData)));
      setProposalDraftingLoadState("idle");
      setProposalDraftingSavedAt(null);
      setLastSavedProposalDraftingSignature(getProposalDraftingStageDataSignature(extractProposalDraftingStageData(wsData)));
      setProposalSentLoadState("idle");
      setProposalSentSavedAt(null);
      setLastSavedProposalSentSignature(getProposalSentStageDataSignature(extractProposalSentStageData(wsData)));
      setProposalNegotiationLoadState("idle");
      setProposalNegotiationSavedAt(null);
      setLastSavedProposalNegotiationSignature(getProposalNegotiationStageDataSignature(extractProposalNegotiationStageData(wsData)));
      setProposalCommercialApprovalLoadState("idle");
      setProposalCommercialApprovalSavedAt(null);
      setLastSavedProposalCommercialApprovalSignature(getProposalCommercialApprovalStageDataSignature(extractProposalCommercialApprovalStageData(wsData)));
      setProposalContractSignedLoadState("idle");
      setProposalContractSignedSavedAt(null);
      setLastSavedProposalContractSignedSignature(getProposalContractSignedStageDataSignature(extractProposalContractSignedStageData(wsData)));
      setProposalGoLiveLoadState("idle");
      setProposalGoLiveSavedAt(null);
      setLastSavedProposalGoLiveSignature(getProposalGoLiveStageDataSignature(extractProposalGoLiveStageData(wsData)));
      return;
    }

    let cancelled = false;
    setQualifiedLoadState("loading");
    setQualifiedSaveState("idle");
    setQualifiedSavedAt(null);
    setDiscoveryLoadState("loading");
    setDiscoverySaveState("idle");
    setDiscoverySavedAt(null);
    setSolutionDesignLoadState("loading");
    setSolutionDesignSaveState("idle");
    setSolutionDesignSavedAt(null);
    setPnlPricingLoadState("loading");
    setPnlPricingSaveState("idle");
    setPnlPricingSavedAt(null);
    setQuoteLoadState("loading");
    setQuoteSaveState("idle");
    setQuoteSavedAt(null);
    setProposalDraftingLoadState("loading");
    setProposalDraftingSaveState("idle");
    setProposalDraftingSavedAt(null);
    setProposalSentLoadState("loading");
    setProposalSentSaveState("idle");
    setProposalSentSavedAt(null);
    setProposalNegotiationLoadState("loading");
    setProposalNegotiationSaveState("idle");
    setProposalNegotiationSavedAt(null);
    setProposalCommercialApprovalLoadState("loading");
    setProposalCommercialApprovalSaveState("idle");
    setProposalCommercialApprovalSavedAt(null);
    setProposalContractSignedLoadState("loading");
    setProposalContractSignedSaveState("idle");
    setProposalContractSignedSavedAt(null);
    setProposalGoLiveLoadState("loading");
    setProposalGoLiveSaveState("idle");
    setProposalGoLiveSavedAt(null);

    Promise.all([
      loadProposalQualifiedStageData(proposalId),
      loadProposalDiscoveryStageData(proposalId),
      loadProposalSolutionDesignStageData(proposalId),
      loadProposalPnlPricingStageData(proposalId),
      loadProposalQuoteStageData(proposalId),
      loadProposalDraftingStageData(proposalId),
      loadProposalSentStageData(proposalId),
      loadProposalNegotiationStageData(proposalId),
      loadProposalCommercialApprovalStageData(proposalId),
      loadProposalContractSignedStageData(proposalId),
      loadProposalGoLiveStageData(proposalId),
    ])
      .then(([qualifiedResult, discoveryResult, solutionDesignResult, pnlPricingResult, quoteResult, proposalDraftingResult, proposalSentResult, proposalNegotiationResult, proposalCommercialApprovalResult, proposalContractSignedResult, proposalGoLiveResult]) => {
        if (cancelled) return;
        let nextData = mergeQualifiedStageData(createDefaultWorkspaceData(), qualifiedResult.baselineData);
        nextData = mergeQualifiedStageData(nextData, qualifiedResult.savedData);
        nextData = mergeDiscoveryStageData(nextData, discoveryResult.baselineData);
        nextData = mergeDiscoveryStageData(nextData, discoveryResult.savedData);
        nextData = mergeSolutionDesignStageData(nextData, solutionDesignResult.baselineData);
        nextData = mergeSolutionDesignStageData(nextData, solutionDesignResult.savedData);
        nextData = mergePnlPricingStageData(nextData, pnlPricingResult.baselineData);
        nextData = mergePnlPricingStageData(nextData, pnlPricingResult.savedData);
        nextData = mergeQuoteStageData(nextData, quoteResult.baselineData);
        nextData = mergeQuoteStageData(nextData, quoteResult.savedData);
        nextData = mergeProposalDraftingStageData(nextData, proposalDraftingResult.baselineData);
        nextData = mergeProposalDraftingStageData(nextData, proposalDraftingResult.savedData);
        nextData = mergeProposalSentStageData(nextData, proposalSentResult.baselineData);
        nextData = mergeProposalSentStageData(nextData, proposalSentResult.savedData);
        nextData = mergeProposalNegotiationStageData(nextData, proposalNegotiationResult.baselineData);
        nextData = mergeProposalNegotiationStageData(nextData, proposalNegotiationResult.savedData);
        nextData = mergeProposalCommercialApprovalStageData(nextData, proposalCommercialApprovalResult.baselineData);
        nextData = mergeProposalCommercialApprovalStageData(nextData, proposalCommercialApprovalResult.savedData);
        nextData = mergeProposalContractSignedStageData(nextData, proposalContractSignedResult.baselineData);
        nextData = mergeProposalContractSignedStageData(nextData, proposalContractSignedResult.savedData);
        nextData = mergeProposalGoLiveStageData(nextData, proposalGoLiveResult.baselineData);
        nextData = mergeProposalGoLiveStageData(nextData, proposalGoLiveResult.savedData);
        const nextQualifiedSignature = getQualifiedStageDataSignature(extractQualifiedStageData(nextData));
        const nextDiscoverySignature = getDiscoveryStageDataSignature(extractDiscoveryStageData(nextData));
        const nextSolutionDesignSignature = getSolutionDesignStageDataSignature(extractSolutionDesignStageData(nextData));
        const nextPnlPricingSignature = getPnlPricingStageDataSignature(extractPnlPricingStageData(nextData));
        const nextQuoteSignature = getQuoteStageDataSignature(extractQuoteStageData(nextData));
        const nextProposalDraftingSignature = getProposalDraftingStageDataSignature(extractProposalDraftingStageData(nextData));
        const nextProposalSentSignature = getProposalSentStageDataSignature(extractProposalSentStageData(nextData));
        const nextProposalNegotiationSignature = getProposalNegotiationStageDataSignature(extractProposalNegotiationStageData(nextData));
        const nextProposalCommercialApprovalSignature = getProposalCommercialApprovalStageDataSignature(extractProposalCommercialApprovalStageData(nextData));
        const nextProposalContractSignedSignature = getProposalContractSignedStageDataSignature(extractProposalContractSignedStageData(nextData));
        const nextProposalGoLiveSignature = getProposalGoLiveStageDataSignature(extractProposalGoLiveStageData(nextData));
        setWsData(nextData);
        setLastSavedQualifiedSignature(nextQualifiedSignature);
        setLastSavedDiscoverySignature(nextDiscoverySignature);
        setLastSavedSolutionDesignSignature(nextSolutionDesignSignature);
        setLastSavedPnlPricingSignature(nextPnlPricingSignature);
        setLastSavedQuoteSignature(nextQuoteSignature);
        setLastSavedProposalDraftingSignature(nextProposalDraftingSignature);
        setLastSavedProposalSentSignature(nextProposalSentSignature);
        setLastSavedProposalNegotiationSignature(nextProposalNegotiationSignature);
        setLastSavedProposalCommercialApprovalSignature(nextProposalCommercialApprovalSignature);
        setLastSavedProposalContractSignedSignature(nextProposalContractSignedSignature);
        setLastSavedProposalGoLiveSignature(nextProposalGoLiveSignature);
        setQualifiedSavedAt(qualifiedResult.savedAt);
        setDiscoverySavedAt(discoveryResult.savedAt);
        setSolutionDesignSavedAt(solutionDesignResult.savedAt);
        setPnlPricingSavedAt(pnlPricingResult.savedAt);
        setQuoteSavedAt(quoteResult.savedAt);
        setProposalDraftingSavedAt(proposalDraftingResult.savedAt);
        setProposalSentSavedAt(proposalSentResult.savedAt);
        setProposalNegotiationSavedAt(proposalNegotiationResult.savedAt);
        setProposalCommercialApprovalSavedAt(proposalCommercialApprovalResult.savedAt);
        setProposalContractSignedSavedAt(proposalContractSignedResult.savedAt);
        setProposalGoLiveSavedAt(proposalGoLiveResult.savedAt);
        setQualifiedLoadState(qualifiedResult.ticketFound ? "loaded" : "error");
        setDiscoveryLoadState(discoveryResult.ticketFound ? "loaded" : "error");
        setSolutionDesignLoadState(solutionDesignResult.ticketFound ? "loaded" : "error");
        setPnlPricingLoadState(pnlPricingResult.ticketFound ? "loaded" : "error");
        setQuoteLoadState(quoteResult.ticketFound ? "loaded" : "error");
        setProposalDraftingLoadState(proposalDraftingResult.ticketFound ? "loaded" : "error");
        setProposalSentLoadState(proposalSentResult.ticketFound ? "loaded" : "error");
        setProposalNegotiationLoadState(proposalNegotiationResult.ticketFound ? "loaded" : "error");
        setProposalCommercialApprovalLoadState(proposalCommercialApprovalResult.ticketFound ? "loaded" : "error");
        setProposalContractSignedLoadState(proposalContractSignedResult.ticketFound ? "loaded" : "error");
        setProposalGoLiveLoadState(proposalGoLiveResult.ticketFound ? "loaded" : "error");
        if (!qualifiedResult.ticketFound || !discoveryResult.ticketFound || !solutionDesignResult.ticketFound || !pnlPricingResult.ticketFound || !quoteResult.ticketFound || !proposalDraftingResult.ticketFound || !proposalSentResult.ticketFound || !proposalNegotiationResult.ticketFound || !proposalCommercialApprovalResult.ticketFound || !proposalContractSignedResult.ticketFound || !proposalGoLiveResult.ticketFound) {
          toast.error("Workspace remains editable, but saving needs a real active proposal ticket.");
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setQualifiedLoadState("error");
        setDiscoveryLoadState("error");
        setSolutionDesignLoadState("error");
        setPnlPricingLoadState("error");
        setQuoteLoadState("error");
        setProposalDraftingLoadState("error");
        setProposalSentLoadState("error");
        setProposalNegotiationLoadState("error");
        setProposalCommercialApprovalLoadState("error");
        setProposalContractSignedLoadState("error");
        setProposalGoLiveLoadState("error");
        toast.error(`Could not load proposal stage data: ${err.message}`);
      });

    return () => {
      cancelled = true;
    };
    // Load is keyed to the active proposal identity only. This prevents typed
    // edits from retriggering hydration while the user is working.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProposal?.proposalId]);

  useEffect(() => {
    const defaultTask = getDefaultProposalTaskKey(activeStage);
    const defaultTab = getDefaultProposalTabKey(activeStage, defaultTask);
    if (previousStageRef.current !== activeStage) {
      previousStageRef.current = activeStage;
      setActiveTaskKey(defaultTask);
      setActiveTab(defaultTab);
      return;
    }
    if (!stageTasks.some(task => task.key === activeTaskKey)) {
      setActiveTaskKey(defaultTask);
      setActiveTab(defaultTab);
      return;
    }
    const currentTask = getProposalTask(activeStage, activeTaskKey);
    if (currentTask && !currentTask.tabs.some(tab => tab.key === activeTab)) {
      setActiveTab(currentTask.tabs[0]?.key ?? "");
    }
  }, [activeStage, activeTaskKey, activeTab, stageTasks]);

  const updateWsData = (newData: ProposalWorkspaceData, stage: string, dataKey: keyof ProposalWorkspaceData) => {
    const oldSection = wsData[dataKey];
    const newSection = newData[dataKey];
    if (oldSection && newSection && typeof oldSection === "object" && !Array.isArray(oldSection)) {
      logDataChange(proposalDataScopeId, stage, String(dataKey), oldSection as Record<string, any>, newSection as Record<string, any>);
    }
    setWsData(newData);
  };

  const handleTaskChange = (task: ProposalStageTask) => {
    setActiveTaskKey(task.key);
    setActiveTab(task.tabs[0]?.key ?? "");
  };

  const handleOpenDocuments = () => {
    if (documentTask) {
      handleTaskChange(documentTask);
      toast.info(`${documentTask.label} opened for this proposal stage.`);
      return;
    }
    toast.info("No document-specific task is mapped for this proposal stage yet.");
  };

  const missingProposalSaveMessage = "Workspace remains editable, but saving needs a real active proposal ticket.";
  const proposalSaveTimeoutMs = 12000;

  const withProposalSaveTimeout = async <T,>(save: Promise<T>, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`${label} did not finish within ${proposalSaveTimeoutMs / 1000}s. Please check the connection and try again.`)),
        proposalSaveTimeoutMs,
      );
    });

    try {
      return await Promise.race([save, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const handleQualifiedSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setQualifiedSaveState("saving");
    try {
      const data = extractQualifiedStageData(wsData);
      const signature = getQualifiedStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalQualifiedStageData(activeProposal.proposalId, data), "Qualified stage save");
      setLastSavedQualifiedSignature(signature);
      setQualifiedSavedAt(result.savedAt);
      setQualifiedLoadState("loaded");
      setQualifiedSaveState("saved");
      toast.success("Qualified stage saved.");
    } catch (err: any) {
      setQualifiedSaveState("error");
      toast.error(`Qualified stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleDiscoverySave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setDiscoverySaveState("saving");
    try {
      const data = extractDiscoveryStageData(wsData);
      const signature = getDiscoveryStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalDiscoveryStageData(activeProposal.proposalId, data), "Discovery stage save");
      setLastSavedDiscoverySignature(signature);
      setDiscoverySavedAt(result.savedAt);
      setDiscoveryLoadState("loaded");
      setDiscoverySaveState("saved");
      toast.success("Discovery stage saved.");
    } catch (err: any) {
      setDiscoverySaveState("error");
      toast.error(`Discovery stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleSolutionDesignSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setSolutionDesignSaveState("saving");
    try {
      const data = extractSolutionDesignStageData(wsData);
      const signature = getSolutionDesignStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalSolutionDesignStageData(activeProposal.proposalId, data), "Solution Design stage save");
      setLastSavedSolutionDesignSignature(signature);
      setSolutionDesignSavedAt(result.savedAt);
      setSolutionDesignLoadState("loaded");
      setSolutionDesignSaveState("saved");
      toast.success("Solution Design stage saved.");
    } catch (err: any) {
      setSolutionDesignSaveState("error");
      toast.error(`Solution Design stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handlePnlPricingSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setPnlPricingSaveState("saving");
    try {
      const data = extractPnlPricingStageData(wsData);
      const signature = getPnlPricingStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalPnlPricingStageData(activeProposal.proposalId, data), "P&L / Pricing stage save");
      setLastSavedPnlPricingSignature(signature);
      setPnlPricingSavedAt(result.savedAt);
      setPnlPricingLoadState("loaded");
      setPnlPricingSaveState("saved");
      toast.success("P&L / Pricing stage saved.");
    } catch (err: any) {
      setPnlPricingSaveState("error");
      toast.error(`P&L / Pricing stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleQuoteSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setQuoteSaveState("saving");
    try {
      const data = extractQuoteStageData(wsData);
      const signature = getQuoteStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalQuoteStageData(activeProposal.proposalId, data), "Quote stage save");
      setLastSavedQuoteSignature(signature);
      setQuoteSavedAt(result.savedAt);
      setQuoteLoadState("loaded");
      setQuoteSaveState("saved");
      toast.success("Quote stage saved.");
    } catch (err: any) {
      setQuoteSaveState("error");
      toast.error(`Quote stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleProposalDraftingSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setProposalDraftingSaveState("saving");
    try {
      const data = extractProposalDraftingStageData(wsData);
      const signature = getProposalDraftingStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalDraftingStageData(activeProposal.proposalId, data), "Proposal Drafting stage save");
      setLastSavedProposalDraftingSignature(signature);
      setProposalDraftingSavedAt(result.savedAt);
      setProposalDraftingLoadState("loaded");
      setProposalDraftingSaveState("saved");
      toast.success("Proposal Drafting stage saved.");
    } catch (err: any) {
      setProposalDraftingSaveState("error");
      toast.error(`Proposal Drafting stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleProposalSentSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setProposalSentSaveState("saving");
    try {
      const data = extractProposalSentStageData(wsData);
      const signature = getProposalSentStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalSentStageData(activeProposal.proposalId, data), "Proposal Sent stage save");
      setLastSavedProposalSentSignature(signature);
      setProposalSentSavedAt(result.savedAt);
      setProposalSentLoadState("loaded");
      setProposalSentSaveState("saved");
      toast.success("Proposal Sent stage saved.");
    } catch (err: any) {
      setProposalSentSaveState("error");
      toast.error(`Proposal Sent stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleProposalNegotiationSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setProposalNegotiationSaveState("saving");
    try {
      const data = extractProposalNegotiationStageData(wsData);
      const signature = getProposalNegotiationStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalNegotiationStageData(activeProposal.proposalId, data), "Negotiation stage save");
      setLastSavedProposalNegotiationSignature(signature);
      setProposalNegotiationSavedAt(result.savedAt);
      setProposalNegotiationLoadState("loaded");
      setProposalNegotiationSaveState("saved");
      toast.success("Negotiation stage saved.");
    } catch (err: any) {
      setProposalNegotiationSaveState("error");
      toast.error(`Negotiation stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleProposalCommercialApprovalSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setProposalCommercialApprovalSaveState("saving");
    try {
      const data = extractProposalCommercialApprovalStageData(wsData);
      const signature = getProposalCommercialApprovalStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalCommercialApprovalStageData(activeProposal.proposalId, data), "Commercial Approval stage save");
      setLastSavedProposalCommercialApprovalSignature(signature);
      setProposalCommercialApprovalSavedAt(result.savedAt);
      setProposalCommercialApprovalLoadState("loaded");
      setProposalCommercialApprovalSaveState("saved");
      toast.success("Commercial Approval stage saved.");
    } catch (err: any) {
      setProposalCommercialApprovalSaveState("error");
      toast.error(`Commercial Approval stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleProposalContractSignedSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setProposalContractSignedSaveState("saving");
    try {
      const data = extractProposalContractSignedStageData(wsData);
      const signature = getProposalContractSignedStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalContractSignedStageData(activeProposal.proposalId, data), "Contract Signed stage save");
      setLastSavedProposalContractSignedSignature(signature);
      setProposalContractSignedSavedAt(result.savedAt);
      setProposalContractSignedLoadState("loaded");
      setProposalContractSignedSaveState("saved");
      toast.success("Contract Signed stage saved.");
    } catch (err: any) {
      setProposalContractSignedSaveState("error");
      toast.error(`Contract Signed stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleProposalGoLiveSave = async () => {
    if (!activeProposal?.proposalId) {
      toast.error(missingProposalSaveMessage);
      return;
    }

    setProposalGoLiveSaveState("saving");
    try {
      const data = extractProposalGoLiveStageData(wsData);
      const signature = getProposalGoLiveStageDataSignature(data);
      const result = await withProposalSaveTimeout(saveProposalGoLiveStageData(activeProposal.proposalId, data), "Go-Live stage save");
      setLastSavedProposalGoLiveSignature(signature);
      setProposalGoLiveSavedAt(result.savedAt);
      setProposalGoLiveLoadState("loaded");
      setProposalGoLiveSaveState("saved");
      toast.success("Go-Live stage saved.");
    } catch (err: any) {
      setProposalGoLiveSaveState("error");
      toast.error(`Go-Live stage save failed: ${err.message ?? "Unknown error"}`);
    }
  };

  const handleSupportingDocumentUpload = (doc: SupportingDocument) => {
    setLocalDocuments(current => [doc, ...current.filter(item => item.id !== doc.id)]);
    onDocUpload?.(doc);
  };

  const sectionTabs: ProcessStageSectionTab<string>[] = activeTabs.map(tab => {
    const Icon = getIconForKey(tab.key);
    return {
      key: tab.key,
      label: tab.label,
      icon: <Icon className="w-4 h-4" />,
    };
  });

  const metrics = [
    { label: "Stage", value: stageInfo?.label ?? activeStage },
    { label: "Stage Task", value: activeTask?.label ?? "Not selected" },
    { label: "Inner Tabs", value: String(activeTabs.length) },
    { label: "Proposal", value: activeProposal?.title ?? customerName },
    {
      label: activeStage === "qualified"
        ? "Qualified Readiness"
        : activeStage === "discovery"
          ? "Discovery Complete"
          : activeStage === "solution_design"
            ? "Solution Ready"
            : activeStage === "pnl_pricing"
              ? "Pricing Confidence"
              : activeStage === "quote"
                ? "Quote Readiness"
                : activeStage === "proposal_drafting"
                  ? "Drafting Readiness"
                  : activeStage === "proposal_sent"
                    ? "Sent Readiness"
                    : activeStage === "negotiation"
                      ? "Negotiation Readiness"
                      : activeStage === "commercial_approval"
                        ? "Commercial Readiness"
                        : activeStage === "contract_signed"
                          ? "Contract Readiness"
                          : activeStage === "go_live"
                            ? "Go-Live Readiness"
                          : "Mode",
      value: activeStage === "qualified"
        ? `${calcQualificationReadiness(wsData)}%`
        : activeStage === "discovery"
          ? `${calcDiscoveryCompleteness(wsData)}%`
          : activeStage === "solution_design"
            ? `${calcSolutionReadiness(wsData)}%`
            : activeStage === "pnl_pricing"
              ? `${calcPricingConfidence(wsData)}%`
              : activeStage === "quote"
                ? `${calcQuoteReadiness(wsData)}%`
                : activeStage === "proposal_drafting"
                  ? `${calcProposalDraftingReadiness(wsData)}%`
                  : activeStage === "proposal_sent"
                    ? `${calcProposalSentReadiness(wsData)}%`
                    : activeStage === "negotiation"
                      ? `${calcNegotiationReadiness(wsData)}%`
                      : activeStage === "commercial_approval"
                        ? `${calcCommercialApprovalReadiness(wsData)}%`
                        : activeStage === "contract_signed"
                          ? `${calcContractSignedReadiness(wsData)}%`
                          : activeStage === "go_live"
                            ? `${calcGoLiveReadiness(wsData)}%`
                          : "Open testing",
    },
  ];

  const renderSupportingDocuments = (tabKey: string) => (
    <SupportingDocumentsPanel
      linkedStage={activeStage}
      linkedTab={tabKey}
      documents={workbenchDocuments}
      onUpload={handleSupportingDocumentUpload}
      proposalId={activeProposal?.proposalId}
      proposalName={activeProposal?.title}
      workspaceId={activeProposal?.proposalId ?? workspaceId}
      workspaceName={activeProposal?.title}
      customerId={activeProposal?.customerId}
      customerName={activeProposal?.customerName ?? customerName}
    />
  );

  const renderDiscoverySummary = () => {
    const needsCaptured = Object.values(wsData.customerNeeds).filter(Boolean).length;
    const volumeFields = Object.values(wsData.volumesLanes).filter(Boolean).length;
    const painFields = Object.values(wsData.currentPain).filter(Boolean).length;
    const riskFields = Object.values(wsData.risksAssumptions).filter(Boolean).length;

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Meetings", value: String(meetingNotesCaptured) },
            { label: "Needs Captured", value: `${needsCaptured}/6` },
            { label: "Volume Fields", value: `${volumeFields}/8` },
            { label: "Pain / Risk Fields", value: `${painFields + riskFields}/10` },
          ].map(item => (
            <div key={item.label} className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Need</p>
            <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">
              {wsData.customerNeeds.warehousing || wsData.customerNeeds.transport || wsData.customerNeeds.vas || "No customer needs captured yet."}
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operational Data</p>
            <p className="mt-2 whitespace-pre-wrap text-xs text-foreground">
              {wsData.volumesLanes.pallets || wsData.volumesLanes.laneMatrix || wsData.volumesLanes.locations || "No volume, lane, or inventory detail captured yet."}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderPlaceholder = (label: string) => (
    <ProcessStageEmptyState text={`${label} workspace is ready for the next data sprint.`} />
  );

  const renderTabContent = (tabKey: string): ReactNode => {
    if (tabKey === "supporting_docs") return renderSupportingDocuments(tabKey);

    switch (tabKey) {
      case "discovery_summary":
        return renderDiscoverySummary();
      case "qualification_summary":
        return <QualificationSummaryTab data={wsData.qualificationSummary} onChange={data => updateWsData({ ...wsData, qualificationSummary: data }, "qualified", "qualificationSummary")} />;
      case "customer_fit":
        return <CustomerFitTab data={wsData.customerFit} onChange={data => updateWsData({ ...wsData, customerFit: data }, "qualified", "customerFit")} />;
      case "opportunity_details":
        return <OpportunityBriefTab data={wsData.opportunityBrief} onChange={data => updateWsData({ ...wsData, opportunityBrief: data }, "qualified", "opportunityBrief")} />;
      case "required_info":
        return <RequiredInfoTab data={wsData.requiredInfo} onChange={data => updateWsData({ ...wsData, requiredInfo: data }, "qualified", "requiredInfo")} />;
      case "meeting_notes":
        return <MeetingNotesTab data={wsData.meetingNotes} onChange={data => {
          if (data.length !== wsData.meetingNotes.length) {
            logProposalAudit({
              workspaceId: proposalDataScopeId,
              action: data.length > wsData.meetingNotes.length ? "meeting_added" : "meeting_removed",
              stage: "discovery",
              tab: "meeting_notes",
              details: `Meeting notes count: ${data.length}`,
            });
          }
          updateWsData({ ...wsData, meetingNotes: data }, "discovery", "meetingNotes");
        }} />;
      case "customer_needs":
        return <CustomerNeedsTab data={wsData.customerNeeds} onChange={data => updateWsData({ ...wsData, customerNeeds: data }, "discovery", "customerNeeds")} />;
      case "volumes_lanes_inventory":
        return <VolumesLanesTab data={wsData.volumesLanes} onChange={data => updateWsData({ ...wsData, volumesLanes: data }, "discovery", "volumesLanes")} />;
      case "pain_points_risks":
        return (
          <div className="space-y-4">
            <CurrentPainTab data={wsData.currentPain} onChange={data => updateWsData({ ...wsData, currentPain: data }, "discovery", "currentPain")} />
            <RisksAssumptionsTab data={wsData.risksAssumptions} onChange={data => updateWsData({ ...wsData, risksAssumptions: data }, "discovery", "risksAssumptions")} />
          </div>
        );
      case "solution_configuration":
        return <SolutionConfigurationTab data={wsData.solutionConfiguration} onChange={data => updateWsData({ ...wsData, solutionConfiguration: data }, "solution_design", "solutionConfiguration")} />;
      case "warehouse_model":
        return <WarehouseModelTab data={wsData.warehouseModel} onChange={data => updateWsData({ ...wsData, warehouseModel: data }, "solution_design", "warehouseModel")} />;
      case "transport_model":
        return <TransportModelTab data={wsData.transportModel} onChange={data => updateWsData({ ...wsData, transportModel: data }, "solution_design", "transportModel")} />;
      case "vas_special_handling":
        return <VasHandlingTab data={wsData.vasHandling} onChange={data => updateWsData({ ...wsData, vasHandling: data }, "solution_design", "vasHandling")} />;
      case "systems_visibility":
        return <SystemsVisibilityTab data={wsData.systemsVisibility} onChange={data => updateWsData({ ...wsData, systemsVisibility: data }, "solution_design", "systemsVisibility")} />;
      case "service_scope_matrix":
        return <ServiceScopeTab data={wsData.serviceScope} onChange={data => updateWsData({ ...wsData, serviceScope: data }, "solution_design", "serviceScope")} />;
      case "operational_feasibility":
        return <OperationalFeasibilityTab data={wsData.operationalFeasibility} onChange={data => updateWsData({ ...wsData, operationalFeasibility: data }, "solution_design", "operationalFeasibility")} />;
      case "assumptions_dependencies":
        return <AssumptionsDependenciesTab data={wsData.assumptionsDependencies} onChange={data => updateWsData({ ...wsData, assumptionsDependencies: data }, "solution_design", "assumptionsDependencies")} />;
      case "pnl_calculator":
        return <PnlCalculatorTab versions={wsData.pnlVersions} activeId={wsData.activePnlVersion} onVersionsChange={data => updateWsData({ ...wsData, pnlVersions: data }, "pnl_pricing", "pnlVersions")} onActiveChange={id => updateWsData({ ...wsData, activePnlVersion: id }, "pnl_pricing", "activePnlVersion")} onVersionsAndActiveChange={(pnlVersions, activePnlVersion) => updateWsData({ ...wsData, pnlVersions, activePnlVersion }, "pnl_pricing", "pnlVersions")} onSave={version => onSavePnlVersions?.(proposalDataScopeId, version)} />;
      case "cost_inputs":
        return <CostInputsTab data={wsData.costInputs} onChange={data => updateWsData({ ...wsData, costInputs: data }, "pnl_pricing", "costInputs")} />;
      case "pricing_lines":
        return <PricingLinesTab data={wsData.pricingLines} onChange={data => updateWsData({ ...wsData, pricingLines: data }, "pnl_pricing", "pricingLines")} />;
      case "margin_scenarios":
        return <MarginScenariosTab data={wsData.marginScenarios} onChange={data => updateWsData({ ...wsData, marginScenarios: data }, "pnl_pricing", "marginScenarios")} />;
      case "commercial_terms":
        return <CommercialTermsTab data={wsData.commercialTerms} onChange={data => updateWsData({ ...wsData, commercialTerms: data }, "pnl_pricing", "commercialTerms")} />;
      case "assumptions_exclusions":
        return <PricingAssumptionsExclusionsTab data={wsData.pricingAssumptionsExclusions} onChange={data => updateWsData({ ...wsData, pricingAssumptionsExclusions: data }, "pnl_pricing", "pricingAssumptionsExclusions")} />;
      case "quote_summary":
        return <QuoteSummaryTab data={wsData.quoteSummary} onChange={data => updateWsData({ ...wsData, quoteSummary: data }, "quote", "quoteSummary")} />;
      case "quote_service_scope":
        return <QuoteServiceScopeTab data={wsData.quoteServiceScope} onChange={data => updateWsData({ ...wsData, quoteServiceScope: data }, "quote", "quoteServiceScope")} />;
      case "quote_pricing_summary":
        return <QuotePricingSummaryTab data={wsData.quotePricingSummary} onChange={data => updateWsData({ ...wsData, quotePricingSummary: data }, "quote", "quotePricingSummary")} />;
      case "quote_terms_assumptions_exclusions":
        return <QuoteTermsAssumptionsExclusionsTab data={wsData.quoteTermsAssumptionsExclusions} onChange={data => updateWsData({ ...wsData, quoteTermsAssumptionsExclusions: data }, "quote", "quoteTermsAssumptionsExclusions")} />;
      case "quote_versions":
        return <QuoteVersionsTab data={wsData.quoteVersions} onChange={data => updateWsData({ ...wsData, quoteVersions: data }, "quote", "quoteVersions")} />;
      case "toc_planner":
        return <TocPlannerTab data={wsData.proposalTocSections} onChange={data => updateWsData({ ...wsData, proposalTocSections: data }, "proposal_drafting", "proposalTocSections")} />;
      case "source_map":
        return <SourceMapTab data={wsData.proposalSourceMap} tocSections={wsData.proposalTocSections} onChange={data => updateWsData({ ...wsData, proposalSourceMap: data }, "proposal_drafting", "proposalSourceMap")} />;
      case "block_register":
        return <BlockRegisterTab data={wsData.proposalDraftBlocks} tocSections={wsData.proposalTocSections} onChange={data => updateWsData({ ...wsData, proposalDraftBlocks: data }, "proposal_drafting", "proposalDraftBlocks")} />;
      case "block_editor":
        return <BlockEditorTab data={wsData.proposalDraftBlocks} tocSections={wsData.proposalTocSections} onChange={data => updateWsData({ ...wsData, proposalDraftBlocks: data }, "proposal_drafting", "proposalDraftBlocks")} />;
      case "source_inspector": {
        const quoteTotal = wsData.quotePricingSummary.totalRevenue || wsData.pricingLines.reduce((total, line) => total + line.total, 0);
        return (
          <SourceInspectorTab
            tocSections={wsData.proposalTocSections}
            sourceMap={wsData.proposalSourceMap}
            blocks={wsData.proposalDraftBlocks}
            carryForward={[
              { label: "Quote Summary", value: wsData.quoteSummary.quoteNarrative || wsData.quoteSummary.quotedServices },
              { label: "Quote Scope", value: wsData.quoteServiceScope.includedServices || wsData.serviceScope.included },
              { label: "Technical Solution", value: wsData.solutionConfiguration.solutionOverview || wsData.solutionConfiguration.serviceMix },
              { label: "Warehouse / Transport", value: [wsData.warehouseModel.storageType, wsData.transportModel.laneStructure].filter(Boolean).join(" / ") },
              { label: "Commercial Position", value: wsData.quotePricingSummary.pricingSummary || (quoteTotal > 0 ? `SAR ${quoteTotal.toLocaleString("en", { maximumFractionDigits: 0 })}` : "") },
              { label: "Terms / Assumptions", value: wsData.quoteTermsAssumptionsExclusions.assumptions || wsData.pricingAssumptionsExclusions.pricingAssumptions },
            ]}
          />
        );
      }
      case "technical_operational_volume":
        return <TechnicalOperationalVolumeTab data={wsData.proposalTechnicalVolume} onChange={data => updateWsData({ ...wsData, proposalTechnicalVolume: data }, "proposal_drafting", "proposalTechnicalVolume")} />;
      case "commercial_volume":
        return <CommercialVolumeTab data={wsData.proposalCommercialVolume} onChange={data => updateWsData({ ...wsData, proposalCommercialVolume: data }, "proposal_drafting", "proposalCommercialVolume")} />;
      case "evidence_register":
        return <EvidenceRegisterTab data={wsData.proposalEvidenceItems} tocSections={wsData.proposalTocSections} onChange={data => updateWsData({ ...wsData, proposalEvidenceItems: data }, "proposal_drafting", "proposalEvidenceItems")} />;
      case "appendix_notes":
        return <AppendixNotesTab data={wsData.proposalAppendixNotes} onChange={data => updateWsData({ ...wsData, proposalAppendixNotes: data }, "proposal_drafting", "proposalAppendixNotes")} />;
      case "final_draft_review":
        return <FinalDraftReviewTab data={wsData.proposalFinalDraftReview} onChange={data => updateWsData({ ...wsData, proposalFinalDraftReview: data }, "proposal_drafting", "proposalFinalDraftReview")} />;
      case "sent_version":
        return <SentVersionTab data={wsData.proposalSentVersion} onChange={data => updateWsData({ ...wsData, proposalSentVersion: data }, "proposal_sent", "proposalSentVersion")} />;
      case "delivery_record":
        return <DeliveryRecordTab data={wsData.proposalDeliveryRecord} onChange={data => updateWsData({ ...wsData, proposalDeliveryRecord: data }, "proposal_sent", "proposalDeliveryRecord")} />;
      case "recipient_contact_log":
        return <RecipientContactLogTab data={wsData.proposalRecipientContacts} onChange={data => updateWsData({ ...wsData, proposalRecipientContacts: data }, "proposal_sent", "proposalRecipientContacts")} />;
      case "attachments_register":
        return <AttachmentsRegisterTab data={wsData.proposalSentAttachments} onChange={data => updateWsData({ ...wsData, proposalSentAttachments: data }, "proposal_sent", "proposalSentAttachments")} />;
      case "proposal_crm_sync":
        return <ProposalCrmSyncTab data={wsData.proposalCrmSyncRecord} onChange={data => updateWsData({ ...wsData, proposalCrmSyncRecord: data }, "proposal_sent", "proposalCrmSyncRecord")} />;
      case "proposal_sent_audit_trail":
        return <ProposalSentAuditTrailTab data={wsData.proposalSentAuditNotes} onChange={data => updateWsData({ ...wsData, proposalSentAuditNotes: data }, "proposal_sent", "proposalSentAuditNotes")} />;
      case "customer_feedback":
        return <CustomerFeedbackTab data={wsData.proposalCustomerFeedback} onChange={data => updateWsData({ ...wsData, proposalCustomerFeedback: data }, "negotiation", "proposalCustomerFeedback")} />;
      case "requested_scope_changes":
        return <RequestedScopeChangesTab data={wsData.proposalRequestedScopeChanges} onChange={data => updateWsData({ ...wsData, proposalRequestedScopeChanges: data }, "negotiation", "proposalRequestedScopeChanges")} />;
      case "pricing_changes":
        return <PricingChangesTab data={wsData.proposalPricingChanges} onChange={data => updateWsData({ ...wsData, proposalPricingChanges: data }, "negotiation", "proposalPricingChanges")} />;
      case "negotiation_margin_impact":
        return <NegotiationMarginImpactTab data={wsData.proposalNegotiationMarginImpact} onChange={data => updateWsData({ ...wsData, proposalNegotiationMarginImpact: data }, "negotiation", "proposalNegotiationMarginImpact")} />;
      case "revised_versions":
        return <RevisedVersionsTab data={wsData.proposalRevisedVersions} onChange={data => updateWsData({ ...wsData, proposalRevisedVersions: data }, "negotiation", "proposalRevisedVersions")} />;
      case "negotiation_notes":
        return <NegotiationNotesTab data={wsData.proposalNegotiationNotes} onChange={data => updateWsData({ ...wsData, proposalNegotiationNotes: data }, "negotiation", "proposalNegotiationNotes")} />;
      case "approval_summary":
        return <ApprovalSummaryTab data={wsData.proposalApprovalSummary} onChange={data => updateWsData({ ...wsData, proposalApprovalSummary: data }, "commercial_approval", "proposalApprovalSummary")} />;
      case "margin_terms_review":
        return <MarginTermsReviewTab data={wsData.proposalMarginTermsReview} onChange={data => updateWsData({ ...wsData, proposalMarginTermsReview: data }, "commercial_approval", "proposalMarginTermsReview")} />;
      case "risk_exception_notes":
        return <RiskExceptionNotesTab data={wsData.proposalRiskExceptionNotes} onChange={data => updateWsData({ ...wsData, proposalRiskExceptionNotes: data }, "commercial_approval", "proposalRiskExceptionNotes")} />;
      case "final_commercial_position":
        return <FinalCommercialPositionTab data={wsData.proposalFinalCommercialPosition} onChange={data => updateWsData({ ...wsData, proposalFinalCommercialPosition: data }, "commercial_approval", "proposalFinalCommercialPosition")} />;
      case "approval_record":
        return <ApprovalRecordTab data={wsData.proposalApprovalRecord} onChange={data => updateWsData({ ...wsData, proposalApprovalRecord: data }, "commercial_approval", "proposalApprovalRecord")} />;
      case "signed_contract_reference":
        return <SignedContractReferenceTab data={wsData.proposalSignedContractReference} onChange={data => updateWsData({ ...wsData, proposalSignedContractReference: data }, "contract_signed", "proposalSignedContractReference")} />;
      case "final_scope":
        return <FinalScopeTab data={wsData.proposalFinalContractScope} onChange={data => updateWsData({ ...wsData, proposalFinalContractScope: data }, "contract_signed", "proposalFinalContractScope")} />;
      case "final_pricing":
        return <FinalPricingTab data={wsData.proposalFinalContractPricing} onChange={data => updateWsData({ ...wsData, proposalFinalContractPricing: data }, "contract_signed", "proposalFinalContractPricing")} />;
      case "final_terms":
        return <FinalTermsTab data={wsData.proposalFinalContractTerms} onChange={data => updateWsData({ ...wsData, proposalFinalContractTerms: data }, "contract_signed", "proposalFinalContractTerms")} />;
      case "handover_prep":
        return <HandoverPrepTab data={wsData.proposalContractHandoverPrep} onChange={data => updateWsData({ ...wsData, proposalContractHandoverPrep: data }, "contract_signed", "proposalContractHandoverPrep")} />;
      case "go_live_summary":
        return <GoLiveSummaryTab data={wsData.proposalGoLiveSummary} onChange={data => updateWsData({ ...wsData, proposalGoLiveSummary: data }, "go_live", "proposalGoLiveSummary")} />;
      case "mobilization_tracker":
        return <MobilizationTrackerTab data={wsData.proposalMobilizationTracker} onChange={data => updateWsData({ ...wsData, proposalMobilizationTracker: data }, "go_live", "proposalMobilizationTracker")} />;
      case "operations_handover":
        return <OperationsHandoverTab data={wsData.proposalOperationsHandover} onChange={data => updateWsData({ ...wsData, proposalOperationsHandover: data }, "go_live", "proposalOperationsHandover")} />;
      case "sla_kpi_setup":
        return <SlaKpiSetupTab data={wsData.proposalSlaKpiSetup} onChange={data => updateWsData({ ...wsData, proposalSlaKpiSetup: data }, "go_live", "proposalSlaKpiSetup")} />;
      case "open_risks":
        return <OpenRisksTab data={wsData.proposalOpenImplementationRisks} onChange={data => updateWsData({ ...wsData, proposalOpenImplementationRisks: data }, "go_live", "proposalOpenImplementationRisks")} />;
      case "renewal_future_memory":
        return <RenewalFutureMemoryTab data={wsData.proposalRenewalFutureMemory} onChange={data => updateWsData({ ...wsData, proposalRenewalFutureMemory: data }, "go_live", "proposalRenewalFutureMemory")} />;
      default:
        return renderPlaceholder(activeTabs.find(tab => tab.key === tabKey)?.label ?? activeTask?.label ?? "Proposal");
    }
  };

  const qualifiedSaveAction = activeStage === "qualified" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleQualifiedSave}
      disabled={qualifiedSaveState === "saving" || qualifiedLoadState === "loading"}
    >
      {qualifiedSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {qualifiedSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const discoverySaveAction = activeStage === "discovery" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleDiscoverySave}
      disabled={discoverySaveState === "saving" || discoveryLoadState === "loading"}
    >
      {discoverySaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {discoverySaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const solutionDesignSaveAction = activeStage === "solution_design" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleSolutionDesignSave}
      disabled={solutionDesignSaveState === "saving" || solutionDesignLoadState === "loading"}
    >
      {solutionDesignSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {solutionDesignSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const pnlPricingSaveAction = activeStage === "pnl_pricing" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handlePnlPricingSave}
      disabled={pnlPricingSaveState === "saving" || pnlPricingLoadState === "loading"}
    >
      {pnlPricingSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {pnlPricingSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const quoteSaveAction = activeStage === "quote" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleQuoteSave}
      disabled={quoteSaveState === "saving" || quoteLoadState === "loading"}
    >
      {quoteSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {quoteSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const proposalDraftingSaveAction = activeStage === "proposal_drafting" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleProposalDraftingSave}
      disabled={proposalDraftingSaveState === "saving" || proposalDraftingLoadState === "loading"}
    >
      {proposalDraftingSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {proposalDraftingSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const proposalSentSaveAction = activeStage === "proposal_sent" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleProposalSentSave}
      disabled={proposalSentSaveState === "saving" || proposalSentLoadState === "loading"}
    >
      {proposalSentSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {proposalSentSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const proposalNegotiationSaveAction = activeStage === "negotiation" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleProposalNegotiationSave}
      disabled={proposalNegotiationSaveState === "saving" || proposalNegotiationLoadState === "loading"}
    >
      {proposalNegotiationSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {proposalNegotiationSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const proposalCommercialApprovalSaveAction = activeStage === "commercial_approval" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleProposalCommercialApprovalSave}
      disabled={proposalCommercialApprovalSaveState === "saving" || proposalCommercialApprovalLoadState === "loading"}
    >
      {proposalCommercialApprovalSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {proposalCommercialApprovalSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const proposalContractSignedSaveAction = activeStage === "contract_signed" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleProposalContractSignedSave}
      disabled={proposalContractSignedSaveState === "saving" || proposalContractSignedLoadState === "loading"}
    >
      {proposalContractSignedSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {proposalContractSignedSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const proposalGoLiveSaveAction = activeStage === "go_live" ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 rounded-md border-[#2f5f9d] bg-[#102844]/80 px-2.5 text-[11px] font-medium text-slate-50 shadow-sm hover:bg-[#17365d] hover:text-white disabled:opacity-70"
      onClick={handleProposalGoLiveSave}
      disabled={proposalGoLiveSaveState === "saving" || proposalGoLiveLoadState === "loading"}
    >
      {proposalGoLiveSaveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      {proposalGoLiveSaveState === "saving" ? "Saving" : "Save"}
    </Button>
  ) : null;

  const activeStageSaved = activeStage === "qualified"
    ? qualifiedLoadState === "loaded" && !qualifiedDirty
    : activeStage === "discovery"
      ? discoveryLoadState === "loaded" && !discoveryDirty
      : activeStage === "solution_design"
        ? solutionDesignLoadState === "loaded" && !solutionDesignDirty
        : activeStage === "pnl_pricing"
          ? pnlPricingLoadState === "loaded" && !pnlPricingDirty
          : activeStage === "quote"
            ? quoteLoadState === "loaded" && !quoteDirty
            : activeStage === "proposal_drafting"
              ? proposalDraftingLoadState === "loaded" && !proposalDraftingDirty
              : activeStage === "proposal_sent"
                ? proposalSentLoadState === "loaded" && !proposalSentDirty
                : activeStage === "negotiation"
                  ? proposalNegotiationLoadState === "loaded" && !proposalNegotiationDirty
                  : activeStage === "commercial_approval"
                    ? proposalCommercialApprovalLoadState === "loaded" && !proposalCommercialApprovalDirty
                    : activeStage === "contract_signed"
                      ? proposalContractSignedLoadState === "loaded" && !proposalContractSignedDirty
                      : activeStage === "go_live"
                        ? proposalGoLiveLoadState === "loaded" && !proposalGoLiveDirty
                      : false;
  const activeStageUnsaved = activeStage === "qualified"
    ? qualifiedDirty
    : activeStage === "discovery"
      ? discoveryDirty
      : activeStage === "solution_design"
        ? solutionDesignDirty
        : activeStage === "pnl_pricing"
          ? pnlPricingDirty
          : activeStage === "quote"
            ? quoteDirty
            : activeStage === "proposal_drafting"
              ? proposalDraftingDirty
              : activeStage === "proposal_sent"
                ? proposalSentDirty
                : activeStage === "negotiation"
                  ? proposalNegotiationDirty
                  : activeStage === "commercial_approval"
                    ? proposalCommercialApprovalDirty
                    : activeStage === "contract_signed"
                      ? proposalContractSignedDirty
                      : activeStage === "go_live"
                        ? proposalGoLiveDirty
                      : false;
  const activeStageSaveAction = qualifiedSaveAction ?? discoverySaveAction ?? solutionDesignSaveAction ?? pnlPricingSaveAction ?? quoteSaveAction ?? proposalDraftingSaveAction ?? proposalSentSaveAction ?? proposalNegotiationSaveAction ?? proposalCommercialApprovalSaveAction ?? proposalContractSignedSaveAction ?? proposalGoLiveSaveAction;

  const meetingNotesCaptured = wsData.meetingNotes.filter(hasMeetingNoteContent).length;
  const meaningfulPnlVersions = wsData.pnlVersions.filter(hasPnlVersionContent);
  const costInputsCaptured = wsData.costInputs.filter(hasCostInputContent).length;
  const pricingLinesCaptured = wsData.pricingLines.filter(hasPricingLineContent).length;
  const quoteVersionsCaptured = wsData.quoteVersions.filter(hasQuoteVersionContent).length;
  const proposalTocCaptured = wsData.proposalTocSections.filter(hasTocSectionContent).length;
  const proposalSourceMapCaptured = wsData.proposalSourceMap.filter(hasSourceMapContent).length;
  const proposalDraftBlocksCaptured = wsData.proposalDraftBlocks.filter(hasDraftBlockContent).length;
  const proposalEvidenceCaptured = wsData.proposalEvidenceItems.filter(hasEvidenceItemContent).length;
  const workingPnlVersion = wsData.pnlVersions.find(version => version.id === wsData.activePnlVersion && hasPnlVersionContent(version))
    ?? wsData.pnlVersions.find(version => version.isApproved && hasPnlVersionContent(version));
  const workingPnlRevenue = workingPnlVersion?.revenue.reduce((total, line) => total + line.amount, 0) ?? 0;
  const workingPnlCost = workingPnlVersion
    ? workingPnlVersion.costs.reduce((total, line) => total + line.amount, 0) * (1 + workingPnlVersion.overheadPercent / 100)
    : 0;
  const workingPnlGpPercent = workingPnlRevenue > 0
    ? ((workingPnlRevenue - workingPnlCost) / workingPnlRevenue) * 100
    : 0;
  const pricingLinesTotal = wsData.pricingLines.reduce((total, line) => total + line.total, 0);
  const verifiedCostInputs = wsData.costInputs.filter(input => input.verified && hasCostInputContent(input)).length;
  const commercialTermsCaptured = Object.values(wsData.commercialTerms).filter(Boolean).length;
  const pricingAssumptionsCaptured = Object.values(wsData.pricingAssumptionsExclusions).filter(Boolean).length;
  const quoteSummaryCaptured = Object.values(wsData.quoteSummary).filter(Boolean).length;
  const quoteScopeCaptured = Object.values(wsData.quoteServiceScope).filter(Boolean).length;
  const quoteTermsCaptured = Object.values(wsData.quoteTermsAssumptionsExclusions).filter(Boolean).length;
  const proposalTechnicalCaptured = Object.values(wsData.proposalTechnicalVolume).filter(Boolean).length;
  const proposalCommercialCaptured = Object.values(wsData.proposalCommercialVolume).filter(Boolean).length;
  const proposalAppendixCaptured = Object.values(wsData.proposalAppendixNotes).filter(Boolean).length;
  const proposalFinalReviewCaptured = Object.values(wsData.proposalFinalDraftReview).filter(Boolean).length;
  const proposalSentVersionCaptured = Object.values(wsData.proposalSentVersion).filter(Boolean).length;
  const proposalDeliveryCaptured = Object.values(wsData.proposalDeliveryRecord).filter(Boolean).length;
  const proposalCrmSyncCaptured = Object.values(wsData.proposalCrmSyncRecord).filter(Boolean).length;
  const proposalSentRecipientCaptured = wsData.proposalRecipientContacts.filter(hasProposalSentRecipientContent).length;
  const proposalSentAttachmentCaptured = wsData.proposalSentAttachments.filter(hasProposalSentAttachmentContent).length;
  const proposalSentAuditCaptured = wsData.proposalSentAuditNotes.filter(hasProposalSentAuditContent).length;
  const negotiationCustomerFeedbackCaptured = wsData.proposalCustomerFeedback.filter(hasNegotiationCustomerFeedbackContent).length;
  const negotiationScopeChangeCaptured = wsData.proposalRequestedScopeChanges.filter(hasNegotiationScopeChangeContent).length;
  const negotiationPricingChangeCaptured = wsData.proposalPricingChanges.filter(hasNegotiationPricingChangeContent).length;
  const negotiationMarginCaptured = Object.values(wsData.proposalNegotiationMarginImpact).filter(Boolean).length;
  const negotiationRevisedVersionCaptured = wsData.proposalRevisedVersions.filter(hasNegotiationRevisedVersionContent).length;
  const negotiationNoteCaptured = wsData.proposalNegotiationNotes.filter(hasNegotiationNoteContent).length;
  const commercialApprovalSummaryCaptured = Object.values(wsData.proposalApprovalSummary).filter(Boolean).length;
  const commercialApprovalMarginTermsCaptured = Object.values(wsData.proposalMarginTermsReview).filter(Boolean).length;
  const commercialApprovalRiskExceptionCaptured = Object.values(wsData.proposalRiskExceptionNotes).filter(Boolean).length;
  const commercialApprovalFinalPositionCaptured = Object.values(wsData.proposalFinalCommercialPosition).filter(Boolean).length;
  const commercialApprovalRecordCaptured = Object.values(wsData.proposalApprovalRecord).filter(Boolean).length;
  const contractSignedReferenceCaptured = Object.values(wsData.proposalSignedContractReference).filter(Boolean).length;
  const contractSignedScopeCaptured = Object.values(wsData.proposalFinalContractScope).filter(Boolean).length;
  const contractSignedPricingCaptured = Object.values(wsData.proposalFinalContractPricing).filter(Boolean).length;
  const contractSignedTermsCaptured = Object.values(wsData.proposalFinalContractTerms).filter(Boolean).length;
  const contractSignedHandoverCaptured = Object.values(wsData.proposalContractHandoverPrep).filter(Boolean).length;
  const goLiveSummaryCaptured = Object.values(wsData.proposalGoLiveSummary).filter(Boolean).length;
  const goLiveMobilizationCaptured = Object.values(wsData.proposalMobilizationTracker).filter(Boolean).length;
  const goLiveHandoverCaptured = Object.values(wsData.proposalOperationsHandover).filter(Boolean).length;
  const goLiveSlaKpiCaptured = Object.values(wsData.proposalSlaKpiSetup).filter(Boolean).length;
  const goLiveOpenRisksCaptured = Object.values(wsData.proposalOpenImplementationRisks).filter(Boolean).length;
  const goLiveRenewalMemoryCaptured = Object.values(wsData.proposalRenewalFutureMemory).filter(Boolean).length;
  const qualifiedInfoComplete = wsData.requiredInfo.filter(item => item.complete).length;
  const qualifiedStageIntel = activeStage === "qualified" ? (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Opportunity</p>
        <p className="mt-1 truncate text-xs font-medium text-foreground">
          {wsData.qualificationSummary.opportunityName || "Not captured"}
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Service / Region</p>
        <p className="mt-1 truncate text-xs font-medium text-foreground">
          {[wsData.qualificationSummary.serviceType, wsData.qualificationSummary.region].filter(Boolean).join(" / ") || "Not captured"}
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Required Info</p>
        <p className="mt-1 text-xs font-medium text-foreground">
          {qualifiedInfoComplete}/{wsData.requiredInfo.length} complete
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
        <p className="mt-1 truncate text-xs font-medium text-foreground">
          {qualifiedSavedAt ? `Saved ${new Date(qualifiedSavedAt).toLocaleString()}` : "CRM ticket baseline"}
        </p>
      </div>
    </div>
  ) : null;

  const discoveryStageIntel = activeStage === "discovery" ? (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Meetings</p>
        <p className="mt-1 text-xs font-medium text-foreground">{meetingNotesCaptured} captured</p>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Needs</p>
        <p className="mt-1 text-xs font-medium text-foreground">
          {Object.values(wsData.customerNeeds).filter(Boolean).length}/6 captured
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Volume Data</p>
        <p className="mt-1 text-xs font-medium text-foreground">
          {Object.values(wsData.volumesLanes).filter(Boolean).length}/8 captured
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/20 p-3">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
        <p className="mt-1 truncate text-xs font-medium text-foreground">
          {discoverySavedAt ? `Saved ${new Date(discoverySavedAt).toLocaleString()}` : "Proposal discovery workspace"}
        </p>
      </div>
    </div>
  ) : null;

  const solutionDesignStageIntel = activeStage === "solution_design" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Configuration</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {Object.values(wsData.solutionConfiguration).filter(Boolean).length}/6 captured
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Ops Model</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {Object.values(wsData.warehouseModel).filter(Boolean).length + Object.values(wsData.transportModel).filter(Boolean).length}/12 captured
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Scope / Systems</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {Object.values(wsData.serviceScope).filter(Boolean).length + Object.values(wsData.systemsVisibility).filter(Boolean).length}/11 captured
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {solutionDesignSavedAt ? `Saved ${new Date(solutionDesignSavedAt).toLocaleString()}` : "Proposal solution workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Discovery Need</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.customerNeeds.warehousing || wsData.customerNeeds.transport || wsData.customerNeeds.vas || "No Discovery need captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Discovery Volume</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.volumesLanes.pallets || wsData.volumesLanes.laneMatrix || wsData.volumesLanes.locations || "No Discovery volume or lane data captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Discovery Risk</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.risksAssumptions.unknowns || wsData.risksAssumptions.dataGaps || wsData.currentPain.servicePain || "No Discovery risk or pain captured yet."}
          </p>
        </div>
      </div>
    </>
  ) : null;

  const pnlPricingStageIntel = activeStage === "pnl_pricing" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">P&L Versions</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {meaningfulPnlVersions.length} captured{workingPnlVersion ? ` / ${workingPnlVersion.name}` : ""}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Cost Inputs</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {costInputsCaptured} captured / {verifiedCostInputs} verified
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Pricing Lines</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {pricingLinesCaptured} lines / SAR {pricingLinesTotal.toLocaleString("en", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {pnlPricingSavedAt ? `Saved ${new Date(pnlPricingSavedAt).toLocaleString()}` : "Proposal P&L workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Working Margin</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {workingPnlVersion ? `${workingPnlGpPercent.toFixed(1)}% GP` : "No working scenario selected yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Terms / Assumptions</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {commercialTermsCaptured}/22 terms / {pricingAssumptionsCaptured}/10 assumptions
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Solution Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.assumptionsDependencies.commercialDependencies || wsData.serviceScope.included || wsData.solutionConfiguration.serviceMix || "No Solution Design commercial dependency captured yet."}
          </p>
        </div>
      </div>
    </>
  ) : null;

  const quoteStageIntel = activeStage === "quote" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Quote Summary</p>
          <p className="mt-1 text-xs font-medium text-foreground">{quoteSummaryCaptured}/8 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Scope / Terms</p>
          <p className="mt-1 text-xs font-medium text-foreground">{quoteScopeCaptured}/6 scope / {quoteTermsCaptured}/8 terms</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Quote Versions</p>
          <p className="mt-1 text-xs font-medium text-foreground">{quoteVersionsCaptured} captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {quoteSavedAt ? `Saved ${new Date(quoteSavedAt).toLocaleString()}` : "Proposal quote workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">P&L Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.quotePricingSummary.linkedPnlVersionName || workingPnlVersion?.name || "No working P&L linked yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Pricing Total</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            SAR {(wsData.quotePricingSummary.totalRevenue || pricingLinesTotal).toLocaleString("en", { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Terms Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.quoteTermsAssumptionsExclusions.paymentTerms || wsData.commercialTerms.paymentTerms || wsData.pricingAssumptionsExclusions.exclusions || "No quote terms captured yet."}
          </p>
        </div>
      </div>
    </>
  ) : null;

  const proposalDraftingStageIntel = activeStage === "proposal_drafting" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">TOC / Source Map</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalTocCaptured} sections / {proposalSourceMapCaptured} mappings</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Blocks</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalDraftBlocksCaptured} captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Volumes</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalTechnicalCaptured}/6 technical / {proposalCommercialCaptured}/5 commercial</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {proposalDraftingSavedAt ? `Saved ${new Date(proposalDraftingSavedAt).toLocaleString()}` : "Proposal drafting workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Quote Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.quoteSummary.quoteNarrative || wsData.quoteServiceScope.includedServices || "No Quote narrative or scope captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Solution Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.solutionConfiguration.solutionOverview || wsData.serviceScope.included || "No Solution Design content captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence / Review</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {proposalEvidenceCaptured} evidence / {proposalAppendixCaptured}/3 appendix / {proposalFinalReviewCaptured}/5 review
          </p>
        </div>
      </div>
    </>
  ) : null;

  const proposalSentStageIntel = activeStage === "proposal_sent" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Sent Version</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalSentVersionCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Delivery</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalDeliveryCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Recipients / Attachments</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalSentRecipientCaptured} contacts / {proposalSentAttachmentCaptured} attachments</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {proposalSentSavedAt ? `Saved ${new Date(proposalSentSavedAt).toLocaleString()}` : "Proposal sent workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Drafting Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.proposalSentVersion.sourceDraftReference || wsData.proposalFinalDraftReview.nextAction || (proposalDraftBlocksCaptured > 0 ? `${proposalDraftBlocksCaptured} proposal blocks captured` : "No Proposal Drafting carry-forward captured yet.")}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">CRM Record</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalCrmSyncCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Audit Notes</p>
          <p className="mt-1 text-xs font-medium text-foreground">{proposalSentAuditCaptured} captured</p>
        </div>
      </div>
    </>
  ) : null;

  const negotiationStageIntel = activeStage === "negotiation" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Feedback</p>
          <p className="mt-1 text-xs font-medium text-foreground">{negotiationCustomerFeedbackCaptured} captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Changes</p>
          <p className="mt-1 text-xs font-medium text-foreground">{negotiationScopeChangeCaptured} scope / {negotiationPricingChangeCaptured} pricing</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Revised Versions</p>
          <p className="mt-1 text-xs font-medium text-foreground">{negotiationRevisedVersionCaptured} captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {proposalNegotiationSavedAt ? `Saved ${new Date(proposalNegotiationSavedAt).toLocaleString()}` : "Proposal negotiation workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Proposal Sent Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.proposalSentVersion.sentDocumentRef || wsData.proposalSentVersion.sentVersionLabel || wsData.proposalDeliveryRecord.deliveryStatus || "No Proposal Sent carry-forward captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Margin Impact</p>
          <p className="mt-1 text-xs font-medium text-foreground">{negotiationMarginCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Negotiation Notes</p>
          <p className="mt-1 text-xs font-medium text-foreground">{negotiationNoteCaptured} captured</p>
        </div>
      </div>
    </>
  ) : null;

  const commercialApprovalStageIntel = activeStage === "commercial_approval" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Approval Summary</p>
          <p className="mt-1 text-xs font-medium text-foreground">{commercialApprovalSummaryCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Margin / Terms</p>
          <p className="mt-1 text-xs font-medium text-foreground">{commercialApprovalMarginTermsCaptured}/8 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Risks / Exceptions</p>
          <p className="mt-1 text-xs font-medium text-foreground">{commercialApprovalRiskExceptionCaptured}/5 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {proposalCommercialApprovalSavedAt ? `Saved ${new Date(proposalCommercialApprovalSavedAt).toLocaleString()}` : "Proposal commercial approval workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Negotiation Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.proposalFinalCommercialPosition.negotiationCarryForward || wsData.proposalNegotiationMarginImpact.marginNotes || (negotiationCustomerFeedbackCaptured > 0 ? `${negotiationCustomerFeedbackCaptured} customer feedback items captured` : "No Negotiation carry-forward captured yet.")}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Final Position</p>
          <p className="mt-1 text-xs font-medium text-foreground">{commercialApprovalFinalPositionCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Approval Record</p>
          <p className="mt-1 text-xs font-medium text-foreground">{commercialApprovalRecordCaptured}/6 captured</p>
        </div>
      </div>
    </>
  ) : null;

  const contractSignedStageIntel = activeStage === "contract_signed" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Contract Reference</p>
          <p className="mt-1 text-xs font-medium text-foreground">{contractSignedReferenceCaptured}/8 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Final Scope</p>
          <p className="mt-1 text-xs font-medium text-foreground">{contractSignedScopeCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Final Pricing / Terms</p>
          <p className="mt-1 text-xs font-medium text-foreground">{contractSignedPricingCaptured}/6 pricing / {contractSignedTermsCaptured}/8 terms</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {proposalContractSignedSavedAt ? `Saved ${new Date(proposalContractSignedSavedAt).toLocaleString()}` : "Proposal contract signed workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Commercial Approval Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.proposalFinalCommercialPosition.finalPricingPosition || wsData.proposalApprovalRecord.recordedDecision || wsData.proposalMarginTermsReview.marginPosition || "No Commercial Approval carry-forward captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Handover Prep</p>
          <p className="mt-1 text-xs font-medium text-foreground">{contractSignedHandoverCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {workbenchDocuments.filter(doc => doc.linkedStage === "contract_signed" || doc.linkedStage === "all").length} linked
          </p>
        </div>
      </div>
    </>
  ) : null;

  const goLiveStageIntel = activeStage === "go_live" ? (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Go-Live Summary</p>
          <p className="mt-1 text-xs font-medium text-foreground">{goLiveSummaryCaptured}/6 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Mobilization</p>
          <p className="mt-1 text-xs font-medium text-foreground">{goLiveMobilizationCaptured}/8 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Handover / SLA-KPI</p>
          <p className="mt-1 text-xs font-medium text-foreground">{goLiveHandoverCaptured}/6 handover / {goLiveSlaKpiCaptured}/6 SLA-KPI</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Source Truth</p>
          <p className="mt-1 truncate text-xs font-medium text-foreground">
            {proposalGoLiveSavedAt ? `Saved ${new Date(proposalGoLiveSavedAt).toLocaleString()}` : "Proposal go-live workspace"}
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Contract Carry-Forward</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium text-foreground">
            {wsData.proposalContractHandoverPrep.contractMemoryNotes || wsData.proposalFinalContractScope.finalServiceScope || wsData.proposalFinalContractTerms.finalSlaKpiNotes || "No Contract Signed carry-forward captured yet."}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Open Risks</p>
          <p className="mt-1 text-xs font-medium text-foreground">{goLiveOpenRisksCaptured}/7 captured</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Renewal / Future Memory</p>
          <p className="mt-1 text-xs font-medium text-foreground">{goLiveRenewalMemoryCaptured}/6 captured</p>
        </div>
      </div>
    </>
  ) : null;

  const stageIntelContent = (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Current Stage</p>
          <p className="mt-1 text-xs font-medium text-foreground">{stageInfo?.label ?? activeStage}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Previous Stage</p>
          <p className="mt-1 text-xs font-medium text-foreground">
            {stageIndex > 0 ? PROPOSAL_TRACKER_STAGES[stageIndex - 1]?.label : "None"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</p>
          <p className="mt-1 text-xs font-medium text-foreground">{workbenchDocuments.length} linked</p>
        </div>
      </div>
      {qualifiedStageIntel}
      {discoveryStageIntel}
      {solutionDesignStageIntel}
      {pnlPricingStageIntel}
      {quoteStageIntel}
      {proposalDraftingStageIntel}
      {proposalSentStageIntel}
      {negotiationStageIntel}
      {commercialApprovalStageIntel}
      {contractSignedStageIntel}
      {goLiveStageIntel}
    </div>
  );

  if (!activeTask) {
    return <ProcessStageEmptyState text="Proposal stage tasks are not configured." />;
  }

  return (
    <div className="grid gap-0 border border-border bg-card shadow-none lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="border-b border-border bg-card p-4 lg:border-b-0 lg:border-r">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Stage Tasks
        </div>
        <div className="flex h-auto w-full flex-row gap-2 overflow-x-auto bg-transparent p-0 lg:flex-col lg:overflow-visible">
          {stageTasks.map((task, index) => {
            const Icon = getIconForKey(task.key);
            const isActive = task.key === activeTask.key;
            const progress = buildTaskProgress(task, activeStage, wsData, workbenchDocuments);
            return (
              <button
                key={task.key}
                type="button"
                onClick={() => handleTaskChange(task)}
                className={`group grid min-h-12 w-[180px] shrink-0 grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-left text-[11px] font-medium transition-all whitespace-normal lg:w-full ${
                  isActive
                    ? "border-blue-300 bg-blue-100 text-blue-800"
                    : "border-transparent text-muted-foreground hover:border-slate-200 hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-muted/30 ${isActive ? "border-[#075eea]/30 bg-white text-[#075eea]" : "border-border text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 whitespace-normal text-[12px] font-semibold leading-tight">{task.label}</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  isActive
                    ? "border-emerald-300 bg-emerald-400 text-white shadow-[0_0_0_3px_rgba(16,185,129,.18),0_0_14px_rgba(16,185,129,.55)]"
                    : "border-border bg-card text-muted-foreground"
                }`}>
                  {isActive ? <span className="h-2 w-2 rounded-full bg-white" /> : index + 1}
                </span>
                <StageTaskProgressMeter segments={progress} />
                <span className="col-span-3 block whitespace-normal text-[10px] font-normal leading-tight text-slate-600">
                  {task.tabs.length} inner tab{task.tabs.length === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0">
        <ProcessStageTaskShell
          stageTitle={`${stageInfo?.label ?? activeStage} Stage Menu`}
          stageBadge={`Stage ${stageIndex >= 0 ? stageIndex + 1 : "?"}`}
          activeSection={activeTab}
          onSectionChange={setActiveTab}
          sectionTabs={sectionTabs}
          stageIntelOpen={stageIntelOpen}
          onStageIntelOpenChange={setStageIntelOpen}
          metrics={metrics}
          onOpenDocuments={handleOpenDocuments}
          onOpenGlobalIntel={() => toast.info("Global intelligence will show active-proposal memory only.")}
          saved={activeStageSaved}
          unsaved={activeStageUnsaved}
          actionSlot={activeStageSaveAction}
          stageIntelContent={stageIntelContent}
        >
          {renderTabContent(activeTab)}
        </ProcessStageTaskShell>
      </div>
    </div>
  );
}
