import { useParams, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { cleanHref } from "@clean/lib/clean-routing";
import { ArrowLeft, Package, ShieldAlert, AlertTriangle, CheckCircle2, Clock, DollarSign, Target, Users, Building2, CalendarDays, Radio, FileText, Truck, ClipboardList, ClipboardCheck, FolderOpen, Activity, ScrollText, Info, XCircle, Wrench, FlaskConical, FileOutput, Eye, Mail, Loader2, Database, TrendingUp, ChevronRight, ChevronDown, Layers, BarChart3, FileCheck2, ZapOff, BookOpen, Calculator, Scale, Shield, MessageSquare, Send, Trophy, Stamp, Lock, UploadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatSAR } from "@/lib/store";
import { getTenderStatusColor, type TenderMilestone } from "@/lib/tender-engine";
import { getPackStatusLabel, getPackTypeLabel, getSectionStatusLabel, getSectionStatusColor, getSectionApprovalLabel, stageLabelFromInternalStage, type TenderStageRelevance, type TenderWorkspace, type TenderPack } from "@/lib/tender-workspace-data";
import { useTenderWorkspaceData } from "@/hooks/useTenderWorkspaceData";
import { toast } from "sonner";
import { updateTenderPhase, updateTenderCrmStage } from "@/lib/supabase-tender-actions";
import { mapDbStageToInternalCognitionStage, isRestorableCrmPipelineStage } from "@/lib/supabase-tender-data";
import {
  TENDER_INTERNAL_STAGES,
  normalizeTenderInternalStage,
  type TenderInternalStageDefinition,
} from "@/lib/tender-stage-source-truth";

import TenderPlaceholdersTab from "@/components/tender/TenderPlaceholdersTab";
import TenderRequiredDocumentsTab from "@/components/tender/TenderRequiredDocumentsTab";
import TenderComplianceMatrixTab from "@/components/tender/TenderComplianceMatrixTab";
import TenderSubmissionGatesTab from "@/components/tender/TenderSubmissionGatesTab";
import TenderSplitPackGenerator from "@/components/tender/TenderSplitPackGenerator";
import TenderSubmissionEmailReview from "@/components/tender/TenderSubmissionEmailReview";
import TenderActivityTab from "@/components/tender/TenderActivityTab";
import TenderAuditTrailTab from "@/components/tender/TenderAuditTrailTab";

import { buildStageConfig } from "@/lib/tender-stage-config";
import CrmPipelineStrip from "@/components/proposal-workspace/CrmPipelineStrip";
import SowQualification from "@/components/tender/SowQualification";
import TechnicalQualification from "@/components/tender/TechnicalQualification";
import CustomerFitQualification from "@/components/tender/CustomerFitQualification";
import RiskSnapshot from "@/components/tender/RiskSnapshot";
import TenderSummaryTab from "@/components/tender/TenderSummaryTab";
import TenderCustomerSnapshotTab from "@/components/tender/TenderCustomerSnapshotTab";
import IntakeFileAuditTab from "@/components/tender/IntakeFileAuditTab";
import TenderDocumentReviewTab from "@/components/tender/TenderDocumentReviewTab";
import IdentifiedComplianceMatrixTab from "@/components/tender/IdentifiedComplianceMatrixTab";
import IdentifiedClarificationLogTab from "@/components/tender/IdentifiedClarificationLogTab";
import TenderDocumentsLibrary from "@/components/tender/TenderDocumentsLibrary";
import TenderDocumentDrawer from "@/components/tender/TenderDocumentDrawer";
import TenderGlobalIntelligenceDrawer from "@/components/tender/TenderGlobalIntelligenceDrawer";
import SuggestedProposalBlocksPanel from "@/components/tender/SuggestedProposalBlocksPanel";
import TenderOrchestrationReviewSection from "@/components/orchestration/TenderOrchestrationReviewSection";
import TenderKnowledgeBaseSection from "@/components/tenders/TenderKnowledgeBaseSection";
import { toStageKey } from "@/lib/proposal-block-foundation";
import BidDecisionTab from "@/components/tender/BidDecisionTab";
import WinStrategyTab from "@/components/tender/WinStrategyTab";
import ResourceCommitmentTab from "@/components/tender/ResourceCommitmentTab";
import DecisionRecordTab from "@/components/tender/DecisionRecordTab";
import { PreviousStageIntelligenceContent } from "@/components/tender/PreviousStageIntelligence";
import { TenderStageIntelligenceProvider } from "@/components/tender/TenderStageTaskShell";
import HOPOperationsModelTab from "@/components/tender/HOPOperationsModelTab";
import HAMManpowerModelTab from "@/components/tender/HAMManpowerModelTab";
import HIPSystemsIPModelTab from "@/components/tender/HIPSystemsIPModelTab";
import ScopeMatrixTab from "@/components/tender/ScopeMatrixTab";
import SLAKPIModelTab from "@/components/tender/SLAKPIModelTab";
import AssumptionsDependenciesTab from "@/components/tender/AssumptionsDependenciesTab";
import SolutionConfigurationTab from "@/components/tender/SolutionConfigurationTab";
import PnlPricingStage from "@/components/tender/PnlPricingStage";
import TenderPnLCalculatorPanel from "@/components/tender/TenderPnLCalculatorPanel";
import TenderDraftingStage from "@/components/tender/TenderDraftingStage";
import InternalReviewStage from "@/components/tender/InternalReviewStage";
import ApprovalMatrixStage from "@/components/tender/ApprovalMatrixStage";
import FinalApprovedStage from "@/components/tender/FinalApprovedStage";
import SubmittedStage from "@/components/tender/SubmittedStage";
import ClarificationStage from "@/components/tender/ClarificationStage";
import ClientEvaluationStage from "@/components/tender/ClientEvaluationStage";
import NegotiationStage from "@/components/tender/NegotiationStage";
import AwardedStage from "@/components/tender/AwardedStage";
import LostWithdrawnStage from "@/components/tender/LostWithdrawnStage";

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

type StageTaskProgressSegment = {
  key: string;
  label: string;
  percent: number | null;
};

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function cleanProcessCopy(value: string): string | null {
  const cleaned = value
    .replace(/\bmock\b/gi, "")
    .replace(/\bsimulated\b/gi, "")
    .replace(/\bsimulation\b/gi, "")
    .replace(/\bfuture\b/gi, "")
    .replace(/\bsample\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function getCleanPackActionLabel(action: string): string | null {
  const normalizedAction = action.toLowerCase();
  if (normalizedAction.includes("output")) return "Open Output Workspace";
  if (normalizedAction.includes("split")) return "Review Split Pack";
  if (normalizedAction.includes("readiness")) return "Review Readiness";
  return cleanProcessCopy(action);
}

function getCleanCrmSyncStatusLabel(status?: string): string {
  if (!status || status === "not_synced" || status === "simulated") return "Not Synced";
  if (status === "synced") return "Synced";
  if (status === "sync_failed") return "Sync Failed";
  return status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Identified Stage Progress Builders ────────────────────────────

function buildTenderSummaryTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const t = ws.tender;

  // Segment 1: "Tender Intake Summary" tab — 7 core fields
  const intakeFields = [t.title, t.id, t.source, t.estimatedValue, t.targetGpPercent, t.submissionDeadline, t.assignedOwner];
  const intakePercent = progressPercent(intakeFields.filter(hasValue).length, intakeFields.length);

  // Segment 2: "Advisory Readiness Signals" tab — signal health
  const criticalSignals = ws.packs.reduce((sum, p) => sum + (p.readinessBreakdown?.readiness_signals ?? 0), 0);
  const daysLeft = t.submissionDeadline
    ? Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / 86400000)
    : null;
  const signalPercent = (criticalSignals === 0 && (!daysLeft || daysLeft > 7)) ? 100 : (criticalSignals > 0 || (daysLeft && daysLeft <= 7)) ? 50 : 100;

  return [
    { key: "intake", label: "Tender Intake Summary", percent: intakePercent },
    { key: "signals", label: "Advisory Readiness Signals", percent: signalPercent },
  ];
}

function buildCustomerSnapshotTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const t = ws.tender;
  const metadataFields = [t.customerName, t.region];
  const sowData = (t.sowData || {}) as any;
  const sowSections = [
    sowData.scope_summary,
    Array.isArray(sowData.service_lines) && sowData.service_lines.length > 0 ? sowData.service_lines : null,
    sowData.warehousing,
    Array.isArray(sowData.transport_lanes) && sowData.transport_lanes.length > 0 ? sowData.transport_lanes : null,
    Array.isArray(sowData.technology) && sowData.technology.length > 0 ? sowData.technology : null,
    Array.isArray(sowData.sla_kpis) && sowData.sla_kpis.length > 0 ? sowData.sla_kpis : null,
    Array.isArray(sowData.sites) && sowData.sites.length > 0 ? sowData.sites : null,
    Array.isArray(sowData.compliance) && sowData.compliance.length > 0 ? sowData.compliance : null,
    Array.isArray(sowData.clarifications) && sowData.clarifications.length > 0 ? sowData.clarifications : null,
    sowData.internal_notes,
  ];
  const sowFilled = sowSections.filter(hasValue).length;
  const ownershipFields = [t.assignedOwner, Array.isArray(t.assignedTeamMembers) && t.assignedTeamMembers.length > 0 ? t.assignedTeamMembers : null];
  const stratFields = [t.probabilityPercent, t.notes];

  return [
    { key: "metadata", label: "Customer Metadata", percent: progressPercent(metadataFields.filter(hasValue).length, metadataFields.length) },
    { key: "sow", label: "Scope of Work Capture", percent: progressPercent(sowFilled, 10) },
    { key: "ownership", label: "Assigned Ownership", percent: progressPercent(ownershipFields.filter(hasValue).length, ownershipFields.length) },
    { key: "strategic", label: "Strategic Context & Fit", percent: progressPercent(stratFields.filter(hasValue).length, stratFields.length) },
  ];
}

function getIdentifiedDetails(ws: TenderWorkspace): any {
  const details = ((ws.tender as any).typeDetails || (ws.tender as any).type_details || {}) as any;
  return details?.identified ?? {};
}

function buildIntakeFileAuditTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const data = getIdentifiedDetails(ws).intake_file_audit ?? {};
  const receivedFiles = Array.isArray(data.received_files) ? data.received_files : [];
  const missingItems = Array.isArray(data.missing_intake_items) ? data.missing_intake_items : [];
  const sourceFields = [data.source_channel, data.buyer_reference, data.tender_owner];
  const deadlineFields = [ws.tender.submissionDeadline, data.deadline_status && data.deadline_status !== "not_checked" ? data.deadline_status : null];
  const notesFields = [data.initial_notes];

  return [
    { key: "files", label: "Received Files", percent: progressPercent(receivedFiles.length > 0 ? 1 : 0, 1) },
    { key: "source", label: "Source Details", percent: progressPercent(sourceFields.filter(hasValue).length, sourceFields.length) },
    { key: "deadline", label: "Deadline Check", percent: progressPercent(deadlineFields.filter(hasValue).length, deadlineFields.length) },
    { key: "notes", label: "Initial Notes", percent: progressPercent(notesFields.filter(hasValue).length + (missingItems.length > 0 ? 1 : 0), 2) },
  ];
}

function buildDocumentReviewTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const data = getIdentifiedDetails(ws).document_review ?? {};
  const identifiedDocs = (ws.documents ?? []).filter(doc => doc.stage_relevance.includes("Identified"));
  const reviewedDocs = identifiedDocs.filter(doc => doc.status === "Reviewed" || doc.status === "Final").length;
  const reviewFields = [data.review_status && data.review_status !== "not_started" ? data.review_status : null, data.reviewer, data.review_date, data.key_obligations, data.review_notes];
  const missingFields = [data.missing_documents];

  return [
    { key: "inventory", label: "Document Inventory", percent: progressPercent(identifiedDocs.length > 0 ? 1 : 0, 1) },
    { key: "review", label: "Review Notes", percent: progressPercent(reviewFields.filter(hasValue).length, reviewFields.length) },
    { key: "missing", label: "Missing Documents", percent: identifiedDocs.length > 0 ? progressPercent(reviewedDocs, identifiedDocs.length) : progressPercent(missingFields.filter(hasValue).length, missingFields.length) },
  ];
}

function buildIdentifiedComplianceMatrixTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const data = getIdentifiedDetails(ws).compliance_matrix_notes ?? {};
  const items = ws.complianceItems ?? [];
  const reviewedItems = items.filter(item => item.status && item.status !== "not_reviewed").length;
  const notesFields = [data.risk_summary, data.notes];
  const statusFields = [data.review_status && data.review_status !== "not_started" ? data.review_status : null, data.owner, data.review_date];

  return [
    { key: "matrix", label: "Requirement Matrix", percent: items.length > 0 ? progressPercent(reviewedItems, items.length) : 0 },
    { key: "notes", label: "Early Notes", percent: progressPercent(notesFields.filter(hasValue).length, notesFields.length) },
    { key: "status", label: "Review Status", percent: progressPercent(statusFields.filter(hasValue).length, statusFields.length) },
  ];
}

function buildIdentifiedClarificationLogTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const identified = getIdentifiedDetails(ws);
  const rows = Array.isArray(identified.clarification_log) ? identified.clarification_log : [];
  const submitted = rows.filter((row: any) => row.submitted_to_client || row.status === "submitted" || row.status === "answered" || row.status === "closed").length;
  const answered = rows.filter((row: any) => row.response_received || row.status === "answered" || row.status === "closed").length;
  const notes = identified.clarification_log_notes;

  return [
    { key: "register", label: "Question Register", percent: progressPercent(rows.length > 0 ? 1 : 0, 1) },
    { key: "status", label: "Response Status", percent: rows.length > 0 ? progressPercent(submitted + answered, rows.length * 2) : 0 },
    { key: "notes", label: "Notes", percent: progressPercent(hasValue(notes) ? 1 : 0, 1) },
  ];
}

function buildIdentifiedTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  if (tabId === "tender_summary") return buildTenderSummaryTaskProgress(ws);
  if (tabId === "customer_snapshot") return buildCustomerSnapshotTaskProgress(ws);
  if (tabId === "intake_file_audit") return buildIntakeFileAuditTaskProgress(ws);
  if (tabId === "document_review") return buildDocumentReviewTaskProgress(ws);
  if (tabId === "compliance_matrix") return buildIdentifiedComplianceMatrixTaskProgress(ws);
  if (tabId === "clarification_log") return buildIdentifiedClarificationLogTaskProgress(ws);
  return null;
}

// ─── Qualification Stage Progress Builders ─────────────────────────

function objFieldCount(obj: any, keys: string[]): { filled: number; total: number } {
  if (!obj || typeof obj !== "object") return { filled: 0, total: keys.length };
  const filled = keys.filter(k => hasValue(obj[k])).length;
  return { filled, total: keys.length };
}

function buildSowQualificationTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const sq = ((ws.tender as any).sowQualificationData || {}) as any;
  // 6 inner tabs: snapshot, coverage, clarity, clarifications, outcome, wiring
  const snapshotFields = ["tender_title", "customer_name", "submission_deadline", "estimated_value"];
  const snapshot = objFieldCount(sq, snapshotFields);
  const coverage = Array.isArray(sq?.coverage_matrix) ? { filled: sq.coverage_matrix.filter((r: any) => r.status && r.status !== "Not Assessed").length, total: Math.max(sq.coverage_matrix.length, 1) } : { filled: 0, total: 1 };
  const clarity = sq?.clarity_assessment && typeof sq.clarity_assessment === "object" ? { filled: Object.values(sq.clarity_assessment).filter((v: any) => v && v !== "Not Assessed").length, total: Math.max(Object.keys(sq.clarity_assessment).length, 1) } : { filled: 0, total: 1 };
  const clarifications = Array.isArray(sq?.clarification_questions) ? { filled: sq.clarification_questions.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const outcome = objFieldCount(sq, ["overall_score", "recommendation", "qualification_status"]);
  const wiring = Array.isArray(sq?.output_wiring) ? { filled: sq.output_wiring.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };

  return [
    { key: "snapshot", label: "Tender Intake Snapshot", percent: progressPercent(snapshot.filled, snapshot.total) },
    { key: "coverage", label: "SOW Coverage Matrix", percent: progressPercent(coverage.filled, coverage.total) },
    { key: "clarity", label: "SOW Clarity Assessment", percent: progressPercent(clarity.filled, clarity.total) },
    { key: "clarifications", label: "SOW Clarification Questions", percent: progressPercent(clarifications.filled, clarifications.total) },
    { key: "outcome", label: "SOW Qualification Outcome", percent: progressPercent(outcome.filled, outcome.total) },
    { key: "wiring", label: "Output Use", percent: progressPercent(wiring.filled, wiring.total) },
  ];
}

function buildTechnicalQualificationTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const tq = ((ws.tender as any).technicalQualificationData || {}) as any;
  // 6 inner tabs: summary, capability, gaps, clarifications, recommendation, wiring
  const summary = objFieldCount(tq, ["overall_score", "technical_fit_level", "summary_narrative"]);
  const capability = Array.isArray(tq?.capability_assessment) ? { filled: tq.capability_assessment.filter((r: any) => r.status && r.status !== "Not Assessed").length, total: Math.max(tq.capability_assessment.length, 1) } : { filled: 0, total: 1 };
  const gaps = Array.isArray(tq?.requirement_gaps) ? { filled: tq.requirement_gaps.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const clarifications = Array.isArray(tq?.clarification_questions) ? { filled: tq.clarification_questions.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const recommendation = objFieldCount(tq, ["recommendation", "recommendation_rationale"]);
  const wiring = Array.isArray(tq?.output_wiring) ? { filled: tq.output_wiring.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };

  return [
    { key: "summary", label: "Technical Fit Summary", percent: progressPercent(summary.filled, summary.total) },
    { key: "capability", label: "Technical Capability Assessment", percent: progressPercent(capability.filled, capability.total) },
    { key: "gaps", label: "Technical Requirement Gaps", percent: progressPercent(gaps.filled, gaps.total) },
    { key: "clarifications", label: "Technical Clarifications", percent: progressPercent(clarifications.filled, clarifications.total) },
    { key: "recommendation", label: "Technical Recommendation", percent: progressPercent(recommendation.filled, recommendation.total) },
    { key: "wiring", label: "Output Use", percent: progressPercent(wiring.filled, wiring.total) },
  ];
}

function buildCustomerFitTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const cf = ((ws.tender as any).customerFitData || {}) as any;
  // 6 inner tabs: snapshot, dimensions, scorecard, evidence, gaps, recommendation
  const snapshotFields = ["customer_name", "source", "region", "owner", "estimated_value"];
  const snapshot = objFieldCount(cf, snapshotFields.length > 0 ? snapshotFields : ["customer_name"]);
  const dimensions = Array.isArray(cf?.fit_dimensions) ? { filled: cf.fit_dimensions.filter((r: any) => r.score && r.score !== "Not Assessed").length, total: Math.max(cf.fit_dimensions.length, 1) } : { filled: 0, total: 1 };
  const scorecard = objFieldCount(cf, ["overall_score", "qualification_status"]);
  const evidence = Array.isArray(cf?.evidence_register) ? { filled: cf.evidence_register.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const gaps = Array.isArray(cf?.fit_gaps) ? { filled: cf.fit_gaps.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const recommendation = objFieldCount(cf, ["recommendation", "recommendation_rationale"]);

  return [
    { key: "snapshot", label: "Customer Snapshot", percent: progressPercent(snapshot.filled, snapshot.total) },
    { key: "dimensions", label: "Fit Dimensions", percent: progressPercent(dimensions.filled, dimensions.total) },
    { key: "scorecard", label: "Qualification Scorecard", percent: progressPercent(scorecard.filled, scorecard.total) },
    { key: "evidence", label: "Evidence Register", percent: progressPercent(evidence.filled, evidence.total) },
    { key: "gaps", label: "Fit Gaps / Clarifications", percent: progressPercent(gaps.filled, gaps.total) },
    { key: "recommendation", label: "Qualification Recommendation", percent: progressPercent(recommendation.filled, recommendation.total) },
  ];
}

function buildRiskSnapshotTaskProgress(ws: TenderWorkspace): StageTaskProgressSegment[] {
  const rs = ((ws.tender as any).riskSnapshotData || {}) as any;
  // 7 inner tabs: summary, register, assessment, mitigation, clarifications, recommendation, wiring
  const summary = objFieldCount(rs, ["overall_risk_level", "summary_narrative"]);
  const register = Array.isArray(rs?.risk_register) ? { filled: rs.risk_register.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const assessment = rs?.risk_assessment && typeof rs.risk_assessment === "object" ? { filled: Object.values(rs.risk_assessment).filter((v: any) => v && v !== "Not Assessed").length, total: Math.max(Object.keys(rs.risk_assessment).length, 1) } : { filled: 0, total: 1 };
  const mitigation = Array.isArray(rs?.mitigation_actions) ? { filled: rs.mitigation_actions.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const clarifications = Array.isArray(rs?.clarification_questions) ? { filled: rs.clarification_questions.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };
  const recommendation = objFieldCount(rs, ["recommendation", "recommendation_rationale"]);
  const wiring = Array.isArray(rs?.output_wiring) ? { filled: rs.output_wiring.length > 0 ? 1 : 0, total: 1 } : { filled: 0, total: 1 };

  return [
    { key: "summary", label: "Risk Summary", percent: progressPercent(summary.filled, summary.total) },
    { key: "register", label: "Qualification Risk Register", percent: progressPercent(register.filled, register.total) },
    { key: "assessment", label: "Risk Assessment", percent: progressPercent(assessment.filled, assessment.total) },
    { key: "mitigation", label: "Mitigation Actions", percent: progressPercent(mitigation.filled, mitigation.total) },
    { key: "clarifications", label: "Risk Clarifications", percent: progressPercent(clarifications.filled, clarifications.total) },
    { key: "recommendation", label: "Risk Recommendation", percent: progressPercent(recommendation.filled, recommendation.total) },
    { key: "wiring", label: "Output Use", percent: progressPercent(wiring.filled, wiring.total) },
  ];
}

function buildQualificationTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  if (tabId === "sow_qualification") return buildSowQualificationTaskProgress(ws);
  if (tabId === "technical_qualification") return buildTechnicalQualificationTaskProgress(ws);
  if (tabId === "customer_fit") return buildCustomerFitTaskProgress(ws);
  if (tabId === "risk_snapshot") return buildRiskSnapshotTaskProgress(ws);
  return null;
}

// ─── Bid / No-Bid Stage Progress Builders ──────────────────────

function buildBidNoBidTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const bnb = (ws.tender as any)?.bidNoBidData;
  if (!bnb) return null;

  if (tabId === "bid_decision") {
    // DecisionData has 6 fields
    const decision = bnb.decision && typeof bnb.decision === "object" ? bnb.decision : null;
    const decisionFields = ["decision", "decision_owner", "decision_date", "approval_required", "executive_approval", "decision_reason"];
    const decisionFilled = decision ? decisionFields.filter(k => {
      const v = decision[k];
      if (v === null || v === undefined) return false;
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed.length === 0) return false;
        if (trimmed === "Not Decided" || trimmed === "Not Assessed") return false;
        return true;
      }
      return true;
    }).length : 0;
    const decisionPercent = progressPercent(decisionFilled, 6);

    const checklist = Array.isArray(bnb.decision_checklist) ? bnb.decision_checklist : [];
    const checklistFilled = checklist.filter((r: any) => r && r.status && r.status !== "Not Assessed").length;
    const checklistTotal = Math.max(checklist.length, 1);
    const checklistPercent = progressPercent(checklistFilled, checklistTotal);

    let recPercent = 0;
    if (bnb.recommendation && typeof bnb.recommendation === "object") {
      const nextStepFilled = bnb.recommendation.next_step && bnb.recommendation.next_step !== "Not Decided";
      const conditionsFilled = typeof bnb.recommendation.conditions === "string" && bnb.recommendation.conditions.trim().length > 0;
      if (nextStepFilled && conditionsFilled) recPercent = 100;
      else if (nextStepFilled) recPercent = 50;
    }

    return [
      { key: "decision_status", label: "Decision Status", percent: decisionPercent },
      { key: "decision_checklist", label: "Decision Checklist", percent: checklistPercent },
      { key: "decision_recommendation", label: "Decision Recommendation", percent: recPercent },
    ];
  }

  if (tabId === "win_strategy") {
    const wsData = bnb.win_strategy && typeof bnb.win_strategy === "object" ? bnb.win_strategy : {};

    // Rationale has 3 fields: why_bid, why_win, client_values
    const rationale = wsData.rationale && typeof wsData.rationale === "object" ? wsData.rationale : {};
    const rationaleFields = ["why_bid", "why_win", "client_values"];
    const rationaleFilled = rationaleFields.filter(k => {
      const v = rationale[k];
      return typeof v === "string" && v.trim().length > 0;
    }).length;
    const rationalePercent = progressPercent(rationaleFilled, 3);

    const themes = Array.isArray(wsData.win_themes) ? wsData.win_themes : [];
    const themesPercent = themes.length > 0 ? Math.min(Math.round((themes.length / 3) * 100), 100) : 0;

    const diffs = Array.isArray(wsData.differentiators) ? wsData.differentiators : [];
    const diffsPercent = diffs.length > 0 ? Math.min(Math.round((diffs.length / 3) * 100), 100) : 0;

    const evals = Array.isArray(wsData.evaluation_alignment) ? wsData.evaluation_alignment : [];
    const evalsPercent = evals.length > 0 ? Math.min(Math.round((evals.length / 3) * 100), 100) : 0;

    return [
      { key: "rationale", label: "Strategic Rationale", percent: rationalePercent },
      { key: "win_themes", label: "Win Themes", percent: themesPercent },
      { key: "differentiators", label: "Differentiators", percent: diffsPercent },
      { key: "eval_alignment", label: "Evaluation Alignment", percent: evalsPercent },
    ];
  }

  if (tabId === "resource_commitment") {
    const rc = bnb.resource_commitment && typeof bnb.resource_commitment === "object" ? bnb.resource_commitment : {};

    const rows = Array.isArray(rc.rows) ? rc.rows : [];
    const rowsFilled = rows.filter((r: any) => r && r.status && r.status !== "Not Assessed").length;
    const rowsTotal = Math.max(rows.length, 1);
    const rowsPercent = progressPercent(rowsFilled, rowsTotal);

    // EffortData has 4 fields
    const effort = rc.effort && typeof rc.effort === "object" ? rc.effort : {};
    const effortFields = ["estimated_effort", "deadline_pressure", "can_submit_on_time", "proposal_complexity"];
    const effortFilled = effortFields.filter(k => {
      const v = effort[k];
      return v && v !== "Not Assessed";
    }).length;
    const effortPercent = progressPercent(effortFilled, 4);

    const actions = Array.isArray(rc.actions) ? rc.actions : [];
    const actionsPercent = actions.length > 0 ? Math.min(Math.round((actions.length / 2) * 100), 100) : 0;

    let recPercent = 0;
    if (rc.recommendation && typeof rc.recommendation === "object") {
      const recFilled = rc.recommendation.recommendation && rc.recommendation.recommendation !== "Not Decided";
      const reasonFilled = typeof rc.recommendation.reason === "string" && rc.recommendation.reason.trim().length > 0;
      if (recFilled && reasonFilled) recPercent = 100;
      else if (recFilled) recPercent = 50;
    }

    return [
      { key: "resource_assessment", label: "Resource Assessment", percent: rowsPercent },
      { key: "effort_estimate", label: "Effort Estimate", percent: effortPercent },
      { key: "required_actions", label: "Required Actions", percent: actionsPercent },
      { key: "resource_recommendation", label: "Resource Recommendation", percent: recPercent },
    ];
  }

  if (tabId === "decision_record") {
    const dr = bnb.decision_record && typeof bnb.decision_record === "object" ? bnb.decision_record : {};

    // FormalRecord has 8 fields
    const formal = dr.formal && typeof dr.formal === "object" ? dr.formal : {};
    const formalFields = ["decision", "decision_date", "decision_owner", "approver", "approval_status", "decision_summary", "conditions", "clarifications_required"];
    const formalFilled = formalFields.filter(k => {
      const v = formal[k];
      if (v === null || v === undefined) return false;
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed.length === 0) return false;
        if (trimmed === "Not Decided" || trimmed === "Not Assessed") return false;
        return true;
      }
      return true;
    }).length;
    const formalPercent = progressPercent(formalFilled, 8);

    const evidence = Array.isArray(dr.evidence) ? dr.evidence : [];
    const evidencePercent = evidence.length > 0 ? Math.min(Math.round((evidence.length / 2) * 100), 100) : 0;

    return [
      { key: "formal_decision", label: "Formal Decision", percent: formalPercent },
      { key: "decision_evidence", label: "Decision Evidence", percent: evidencePercent },
    ];
  }

  return null;
}

/** Build solution design task progress per tab */
function buildSolutionDesignTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const sd = ws.tender?.solutionDesignData as any;

  if (tabId === "solution_configuration") {
    const cfg = sd?.configuration;
    const cp = cfg?.customer_problem;
    const cpFilled = [cp?.statement, cp?.evidence, cp?.owner].filter((v: any) => v && typeof v === "string" && v.trim()).length;
    return [
      { key: "customer_problem", label: "Customer Problem", percent: Math.round((cpFilled / 3) * 100) },
      { key: "operating_road", label: "Operating Road", percent: cfg?.customer_operating_road && cfg.customer_operating_road !== "Not Assessed" ? 100 : 0 },
      { key: "module_selection", label: "Module Selection", percent: cfg?.selected_modules && cfg.selected_modules !== "Not Selected" ? 100 : 0 },
      { key: "market_entry", label: "Market Entry", percent: cfg?.market_entry_mode && cfg.market_entry_mode !== "Not Assessed" ? 100 : 0 },
      { key: "solution_package", label: "Package & Deploy", percent: Math.round((
        (cfg?.solution_package && cfg.solution_package !== "Not Selected" ? 1 : 0) +
        (cfg?.deployment_type && cfg.deployment_type !== "Not Assessed" ? 1 : 0) +
        (Array.isArray(cfg?.customer_pain_categories) && cfg.customer_pain_categories.length > 0 ? 1 : 0) +
        (Array.isArray(cfg?.expansion_path) && cfg.expansion_path.length > 0 ? 1 : 0)
      ) / 4 * 100) },
    ];
  }

  if (tabId === "hop_operations_model") {
    const hop = sd?.hop;
    const wh = hop?.warehouse;
    const tr = hop?.transport;
    const whPct = wh?.storage_required && wh.storage_required !== "Not Assessed"
      ? (wh.storage_type && wh.storage_type !== "Not Assessed" ? 100 : 50) : 0;
    const trPct = tr?.transport_required && tr.transport_required !== "Not Assessed"
      ? (Array.isArray(tr.lanes) && tr.lanes.length > 0 ? 100 : 50) : 0;
    const flowPct = Array.isArray(hop?.operational_flow) && hop.operational_flow.length > 0
      ? Math.min(Math.round((hop.operational_flow.length / 3) * 100), 100) : 0;
    const recPct = hop?.recommendation?.readiness && hop.recommendation.readiness !== "Not Assessed"
      ? (hop.recommendation.notes ? 100 : 50) : 0;
    return [
      { key: "warehouse", label: "Warehouse", percent: whPct },
      { key: "transport", label: "Transport", percent: trPct },
      { key: "operational_flow", label: "Operational Flow", percent: flowPct },
      { key: "hop_recommendation", label: "Recommendation", percent: recPct },
    ];
  }

  if (tabId === "ham_manpower_model") {
    const ham = sd?.ham;
    const staffPct = Array.isArray(ham?.staffing) && ham.staffing.length > 0
      ? Math.min(Math.round((ham.staffing.length / 3) * 100), 100) : 0;
    const govVals = [
      ham?.governance?.primary_account_owner, ham?.governance?.operations_owner,
      ham?.governance?.transport_owner, ham?.governance?.warehouse_owner,
      ham?.governance?.quality_owner, ham?.governance?.hsse_owner,
      ham?.governance?.it_owner, ham?.governance?.escalation_owner,
    ];
    const govFilled = govVals.filter((v: any) => v && typeof v === "string" && v.trim()).length;
    const govPct = Math.round((govFilled / 8) * 100);
    const sh = ham?.shift;
    const shiftFilled = [
      sh?.operating_days && sh.operating_days.trim() ? 1 : 0,
      sh?.operating_hours && sh.operating_hours.trim() ? 1 : 0,
      sh?.shift_model && sh.shift_model !== "Not Assessed" ? 1 : 0,
      sh?.emergency_support && sh.emergency_support !== "Not Assessed" ? 1 : 0,
    ].reduce((a: number, b: number) => a + b, 0);
    const shiftPct = Math.round((shiftFilled / 4) * 100);
    const mobPct = Array.isArray(ham?.mobilization) && ham.mobilization.length > 0
      ? Math.min(Math.round((ham.mobilization.length / 3) * 100), 100) : 0;
    const recPct = ham?.recommendation?.readiness && ham.recommendation.readiness !== "Not Assessed"
      ? (ham.recommendation.notes ? 100 : 50) : 0;
    return [
      { key: "staffing", label: "Staffing", percent: staffPct },
      { key: "governance", label: "Governance", percent: govPct },
      { key: "shift", label: "Shift & Coverage", percent: shiftPct },
      { key: "mobilization", label: "Mobilization", percent: mobPct },
      { key: "ham_recommendation", label: "Recommendation", percent: recPct },
    ];
  }

  if (tabId === "hip_systems_ip_model") {
    const hip = sd?.hip;
    const sysPct = Array.isArray(hip?.systems) && hip.systems.length > 0
      ? Math.min(Math.round((hip.systems.length / 3) * 100), 100) : 0;
    const intPct = hip?.integration && typeof hip.integration === "object"
      && Object.values(hip.integration).some((v: any) => v && v !== "Not Assessed") ? 100 : 0;
    const sopPct = Array.isArray(hip?.sops) && hip.sops.length > 0
      ? Math.min(Math.round((hip.sops.length / 3) * 100), 100) : 0;
    const repPct = Array.isArray(hip?.reports) && hip.reports.length > 0
      ? Math.min(Math.round((hip.reports.length / 3) * 100), 100) : 0;
    const recPct = hip?.recommendation?.readiness && hip.recommendation.readiness !== "Not Assessed"
      ? (hip.recommendation.notes ? 100 : 50) : 0;
    return [
      { key: "systems", label: "Systems", percent: sysPct },
      { key: "integration", label: "Integration", percent: intPct },
      { key: "sops", label: "SOP / Process", percent: sopPct },
      { key: "reports", label: "Reporting", percent: repPct },
      { key: "hip_recommendation", label: "Recommendation", percent: recPct },
    ];
  }

  if (tabId === "scope_matrix") {
    const sm = sd?.scope_matrix;
    const rows = Array.isArray(sm?.rows) ? sm.rows : [];
    const rowPct = rows.length > 0 ? Math.min(Math.round((rows.length / 5) * 100), 100) : 0;
    const assessedPct = rows.length > 0
      ? Math.round((rows.filter((r: any) => r.included && r.included !== "Not Assessed").length / rows.length) * 100)
      : 0;
    return [
      { key: "scope_rows", label: "Scope Items", percent: rowPct },
      { key: "scope_assessed", label: "Items Assessed", percent: assessedPct },
    ];
  }

  if (tabId === "sla_kpi_model") {
    const sk = sd?.sla_kpi;
    const kpiPct = Array.isArray(sk?.kpis) && sk.kpis.length > 0
      ? Math.min(Math.round((sk.kpis.length / 3) * 100), 100) : 0;
    const govVals = [
      sk?.governance?.review_frequency, sk?.governance?.reporting_owner,
      sk?.governance?.customer_reporting_contact, sk?.governance?.escalation_trigger,
    ];
    const govFilled = govVals.filter((v: any) => v && typeof v === "string" && v.trim()).length;
    const govPct = Math.round((govFilled / 4) * 100);
    const recPct = sk?.recommendation?.readiness && sk.recommendation.readiness !== "Not Assessed"
      ? (sk.recommendation.notes ? 100 : 50) : 0;
    return [
      { key: "kpis", label: "KPIs", percent: kpiPct },
      { key: "sla_governance", label: "Governance", percent: govPct },
      { key: "sla_recommendation", label: "Recommendation", percent: recPct },
    ];
  }

  if (tabId === "assumptions_dependencies") {
    const ad = sd?.assumptions_dependencies;
    const asPct = Array.isArray(ad?.assumptions) && ad.assumptions.length > 0
      ? Math.min(Math.round((ad.assumptions.length / 3) * 100), 100) : 0;
    const depPct = Array.isArray(ad?.dependencies) && ad.dependencies.length > 0
      ? Math.min(Math.round((ad.dependencies.length / 3) * 100), 100) : 0;
    const exPct = Array.isArray(ad?.exclusions) && ad.exclusions.length > 0
      ? Math.min(Math.round((ad.exclusions.length / 2) * 100), 100) : 0;
    const clPct = Array.isArray(ad?.clarifications) && ad.clarifications.length > 0
      ? Math.min(Math.round((ad.clarifications.length / 2) * 100), 100) : 0;
    const recPct = ad?.recommendation?.readiness && ad.recommendation.readiness !== "Not Assessed"
      ? (ad.recommendation.notes ? 100 : 50) : 0;
    return [
      { key: "assumptions", label: "Assumptions", percent: asPct },
      { key: "dependencies", label: "Dependencies", percent: depPct },
      { key: "exclusions", label: "Exclusions", percent: exPct },
      { key: "clarifications", label: "Clarifications", percent: clPct },
      { key: "ad_recommendation", label: "Recommendation", percent: recPct },
    ];
  }

  return null;
}

// ─── Tender Drafting Stage Progress Builders ─────────────────

function buildTenderDraftingTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const td = (ws.tender as any)?.tenderDraftingData;
  if (!td) return null;

  if (tabId === "proposal_architecture_toc") {
    const arch = td.proposal_architecture ?? {};
    const versions = Array.isArray(arch.toc_versions) ? arch.toc_versions : [];
    const active = versions[versions.length - 1];
    const sections = Array.isArray(active?.sections) ? active.sections : [];
    const includedCount = sections.filter((s: any) => s.include_in_proposal).length;
    const tocFilled = sections.filter((s: any) => s.section_title && s.section_title.trim().length > 0).length;
    const tocStatusPct = arch.status === "Blocks Created" ? 100 : arch.status === "Selected for Build" ? 80 : arch.status === "Human Edited" ? 60 : arch.status === "Draft" && tocFilled > 0 ? 40 : 0;
    const includedPct = progressPercent(includedCount, Math.max(sections.length, 1));
    const blocksCreated = Array.isArray(td.proposal_blocks) && td.proposal_blocks.length > 0 ? 100 : 0;
    return [
      { key: "toc_status", label: "TOC Status", percent: tocStatusPct },
      { key: "sections_filled", label: "Sections Filled", percent: includedPct },
      { key: "blocks_created", label: "Blocks Created", percent: blocksCreated },
    ];
  }

  if (tabId === "proposal_block_workbench") {
    const blocks = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];
    const approved = blocks.filter((b: any) => b.approval_status === "Approved").length;
    const drafted = blocks.filter((b: any) => b.draft_status === "AI Drafted" || b.draft_status === "Human Edited" || b.draft_status === "Reviewed").length;
    const blocksPct = progressPercent(blocks.length, Math.max(blocks.length, 3));
    const draftedPct = progressPercent(drafted, Math.max(blocks.length, 1));
    const approvedPct = progressPercent(approved, Math.max(blocks.length, 1));
    return [
      { key: "blocks_total", label: "Blocks Registered", percent: blocksPct },
      { key: "blocks_drafted", label: "Blocks Drafted", percent: draftedPct },
      { key: "blocks_approved", label: "Blocks Approved", percent: approvedPct },
    ];
  }

  if (tabId === "technical_volume") {
    const blocks = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];
    const techBlocks = blocks.filter((b: any) => b.volume === "Technical" || b.volume === "Shared");
    const approved = techBlocks.filter((b: any) => b.approval_status === "Approved").length;
    return [
      { key: "tech_blocks", label: "Technical Blocks", percent: progressPercent(techBlocks.length, Math.max(techBlocks.length, 1)) },
      { key: "tech_approved", label: "Approved", percent: progressPercent(approved, Math.max(techBlocks.length, 1)) },
    ];
  }

  if (tabId === "commercial_volume") {
    const blocks = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];
    const commBlocks = blocks.filter((b: any) => b.volume === "Commercial" || b.volume === "Shared");
    const approved = commBlocks.filter((b: any) => b.approval_status === "Approved").length;
    return [
      { key: "comm_blocks", label: "Commercial Blocks", percent: progressPercent(commBlocks.length, Math.max(commBlocks.length, 1)) },
      { key: "comm_approved", label: "Approved", percent: progressPercent(approved, Math.max(commBlocks.length, 1)) },
    ];
  }

  if (tabId === "compliance_coverage") {
    const cc = td.compliance_coverage ?? {};
    const items = Array.isArray(cc.items) ? cc.items : [];
    const assessed = items.filter((i: any) => i.status && i.status !== "Not Assessed").length;
    return [
      { key: "compliance_items", label: "Coverage Items", percent: progressPercent(assessed, Math.max(items.length, 1)) },
    ];
  }

  if (tabId === "appendices_evidence") {
    const ae = td.appendices_evidence ?? {};
    const items = Array.isArray(ae.items) ? ae.items : [];
    const filled = items.filter((i: any) => i.title && i.title.trim().length > 0).length;
    return [
      { key: "appendices", label: "Appendices Captured", percent: progressPercent(filled, Math.max(items.length, 1)) },
    ];
  }

  return null;
}

function buildPnlPricingTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const pricing = ws.tender?.pricingData as any;
  const pnlSnap = pricing?.pnl_snapshot;
  const scenarios = pricing?.scenarios;
  const terms = pricing?.commercial_terms;
  const approval = pricing?.approval;

  if (tabId === "pnl_calculator") {
    const contextPct = pnlSnap?.linked_pnl_record_id || pnlSnap?.working_draft ? 100
      : (pnlSnap?.snapshot_status && pnlSnap.snapshot_status !== "No Snapshot") ? 50 : 0;
    const calcPct = pnlSnap?.working_draft?.calculator_state ? 100 : 0;
    const actionsPct = pnlSnap?.working_draft ? 50 : 0;
    const snapshots = Array.isArray(pnlSnap?.snapshots) ? pnlSnap.snapshots : [];
    const snapshotPct = snapshots.length > 0 ? 100 : (pnlSnap?.snapshot_status && pnlSnap.snapshot_status !== "No Snapshot") ? 50 : 0;
    const legacyPct: number | null = null;
    return [
      { key: "context", label: "Pricing Context", percent: contextPct },
      { key: "calculator", label: "P&L Calculator", percent: calcPct },
      { key: "actions", label: "Snapshot Actions", percent: actionsPct },
      { key: "snapshot", label: "Latest Snapshot", percent: snapshotPct },
      { key: "legacy_cost", label: "Legacy Cost Inputs", percent: legacyPct },
    ];
  }

  if (tabId === "pricing_scenarios") {
    const rows = Array.isArray(scenarios?.rows) ? scenarios.rows : [];
    const regPct = rows.length > 0 ? Math.min(Math.round((rows.length / 3) * 100), 100) : 0;
    const selPct = scenarios?.selected_scenario?.selected_scenario_id ? 100
      : scenarios?.selected_scenario?.reason_for_selection ? 50 : 0;
    const cmpPct = rows.length > 0 ? 100 : 0;
    const futurePct: number | null = null;
    return [
      { key: "register", label: "Scenario Register", percent: regPct },
      { key: "selected", label: "Selected Scenario", percent: selPct },
      { key: "comparison", label: "Comparison Summary", percent: cmpPct },
      { key: "future", label: "Output Use", percent: futurePct },
    ];
  }

  if (tabId === "commercial_terms") {
    const ptv = terms?.payment_tax_validity;
    const payPct = ptv?.payment_terms && ptv.payment_terms !== "Not Assessed"
      ? (ptv.vat_treatment && ptv.vat_treatment !== "Not Assessed" ? 100 : 50) : 0;
    const mnf = terms?.mobilization_notice_forecast;
    const mobVals = [mnf?.mobilization_period, mnf?.movement_notice_period, mnf?.forecast_notice_period].filter((v: any) => v && typeof v === "string" && v.trim()).length;
    const mobPct = Math.round((mobVals / 3) * 100);
    const ins = terms?.insurance_liability;
    const insPct = ins?.insurance_treatment && ins.insurance_treatment !== "Not Assessed" ? 100 : 0;
    const surPct = Array.isArray(terms?.surcharges) && terms.surcharges.length > 0
      ? Math.min(Math.round((terms.surcharges.length / 2) * 100), 100) : 0;
    const respPct = Array.isArray(terms?.customer_responsibilities) && terms.customer_responsibilities.length > 0
      ? Math.min(Math.round((terms.customer_responsibilities.length / 2) * 100), 100) : 0;
    const exclPct = Array.isArray(terms?.exclusions) && terms.exclusions.length > 0
      ? Math.min(Math.round((terms.exclusions.length / 2) * 100), 100) : 0;
    const assPct = Array.isArray(terms?.assumptions) && terms.assumptions.length > 0
      ? Math.min(Math.round((terms.assumptions.length / 3) * 100), 100) : 0;
    const futurePct: number | null = null;
    return [
      { key: "payment", label: "Payment / Tax", percent: payPct },
      { key: "mobilization", label: "Mobilization", percent: mobPct },
      { key: "insurance", label: "Insurance", percent: insPct },
      { key: "surcharges", label: "Surcharges", percent: surPct },
      { key: "responsibilities", label: "Responsibilities", percent: respPct },
      { key: "exclusions", label: "Exclusions", percent: exclPct },
      { key: "assumptions", label: "Assumptions", percent: assPct },
      { key: "future", label: "Output Mapping", percent: futurePct },
    ];
  }

  if (tabId === "pricing_approval") {
    const sumPct = approval?.summary?.approval_status && approval.summary.approval_status !== "Not Submitted"
      ? (approval.summary.current_approver ? 100 : 50) : 0;
    const chainPct = Array.isArray(approval?.approval_chain) && approval.approval_chain.length > 0
      ? Math.min(Math.round((approval.approval_chain.length / 3) * 100), 100) : 0;
    const checkPct = Array.isArray(approval?.approval_checks) && approval.approval_checks.length > 0
      ? Math.round((approval.approval_checks.filter((c: any) => c.status && c.status !== "Not Checked").length / approval.approval_checks.length) * 100) : 0;
    const condPct = Array.isArray(approval?.conditions) && approval.conditions.length > 0
      ? Math.min(Math.round((approval.conditions.filter((c: any) => c.status && c.status !== "Open").length / approval.conditions.length) * 100), 100) : 0;
    const futurePct: number | null = null;
    return [
      { key: "summary", label: "Approval Summary", percent: sumPct },
      { key: "chain", label: "Approval Chain", percent: chainPct },
      { key: "checks", label: "Approval Checks", percent: checkPct },
      { key: "conditions", label: "Conditions", percent: condPct },
      { key: "future", label: "Output Mapping", percent: futurePct },
    ];
  }

  return null;
}

/** Dispatch stage-task progress by stage */
function buildStageTaskProgress(stage: string, tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  if (stage === "identified") return buildIdentifiedTaskProgress(tabId, ws);
  if (stage === "qualification") return buildQualificationTaskProgress(tabId, ws);
  if (stage === "bid_no_bid") return buildBidNoBidTaskProgress(tabId, ws);
  if (stage === "solution_design") return buildSolutionDesignTaskProgress(tabId, ws);
  if (stage === "tender_drafting") return buildTenderDraftingTaskProgress(tabId, ws);
  if (stage === "pnl_pricing") return buildPnlPricingTaskProgress(tabId, ws);
  if (stage === "internal_review") return buildInternalReviewTaskProgress(tabId, ws);
  if (stage === "approval_matrix") return buildApprovalMatrixTaskProgress(tabId, ws);
  if (stage === "final_approved") return buildFinalApprovedTaskProgress(tabId, ws);
  if (stage === "submitted") return buildSubmittedTaskProgress(tabId, ws);
  if (stage === "clarification") return buildClarificationTaskProgress(tabId, ws);
  if (stage === "client_evaluation") return buildClientEvaluationTaskProgress(tabId, ws);
  if (stage === "negotiation") return buildNegotiationTaskProgress(tabId, ws);
  if (stage === "awarded") return buildAwardedTaskProgress(tabId, ws);
  if (stage === "lost_withdrawn") return buildLostWithdrawnTaskProgress(tabId, ws);
  return null;
}

function buildClarificationTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  // NOTE: reads from clarification.* — NOT client_evaluation.*
  const cl = td?.clarification ?? {};

  // Tab 1: Q&A Log — 2 sections: qa_register, response_tracking
  if (tabId === "q&a_log") {
    const entries: any[] = Array.isArray(cl.qa_log) ? cl.qa_log : [];
    const responded = entries.filter((e: any) => e.status === "responded").length;
    const registerPct = entries.length > 0 ? Math.min(Math.round((entries.length / 3) * 100), 100) : 0;
    const responsePct = entries.length > 0 ? Math.round((responded / entries.length) * 100) : 0;
    return [
      { key: "qa_register", label: "Q&A Register", percent: registerPct },
      { key: "response_tracking", label: "Response Tracking", percent: responsePct },
    ];
  }

  // Tab 2: Response Drafts — 2 sections: formal_response, draft_audit
  if (tabId === "response_drafts") {
    const response = cl.response ?? {};
    const responseStatus = String(response.response_status || "not_started").toLowerCase();
    const hasResponse = !!(
      (responseStatus && responseStatus !== "not_started") ||
      response.received_date ||
      response.due_date ||
      response.scope_changes ||
      response.submitted_date ||
      response.response_notes ||
      response.pricing_notes
    );
    return [
      { key: "formal_response", label: "Formal Response", percent: hasResponse ? (responseStatus === "submitted" || responseStatus === "not_applicable" ? 100 : 50) : 0 },
      { key: "draft_audit", label: "Response Audit Trail", percent: hasResponse ? 100 : 0 },
    ];
  }

  // Tab 3: Impact Analysis — 2 sections: margin_impact, scope_change
  if (tabId === "impact_analysis") {
    const margin = cl.margin_impact ?? {};
    const hasMargin = !!(margin.current_gp || margin.current_value);
    const hasScopeChange = !!(margin.scope_change_notes);
    return [
      { key: "margin_impact", label: "Margin Impact", percent: hasMargin ? 100 : 0 },
      { key: "scope_change", label: "Scope Change", percent: hasScopeChange ? 100 : 0 },
    ];
  }

  // Tab 4: Clarification Status — 1 section: overall_status
  if (tabId === "clarification_status") {
    const status = cl.status ?? {};
    const hasStatus = !!(status.round_status && status.round_status !== "unknown");
    return [
      { key: "overall_status", label: "Status Captured", percent: hasStatus ? 100 : 0 },
    ];
  }

  return null;
}


function buildClientEvaluationTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const ce = td?.client_evaluation ?? {};

  // Tab 1: Request Log — 2 sections: request_register, activity_log
  if (tabId === "request_log") {
    const entries: any[] = Array.isArray(ce.request_log) ? ce.request_log : [];
    const responded = entries.filter((e: any) => e.status === "responded").length;
    const registerPct = entries.length > 0 ? Math.min(Math.round((entries.length / 3) * 100), 100) : 0;
    const activityPct = entries.length > 0 ? Math.round((responded / entries.length) * 100) : 0;
    return [
      { key: "request_register", label: "Request Register", percent: registerPct },
      { key: "activity_log", label: "Activity Log", percent: activityPct },
    ];
  }

  // Tab 2: BAFO Manager — 2 sections: bafo_details, bafo_audit
  if (tabId === "client_clarifications") {
    const saved = ce.client_clarifications ?? {};
    const rows: any[] = Array.isArray(saved) ? saved : Array.isArray(saved?.rows) ? saved.rows : [];
    const notes = !Array.isArray(saved) && typeof saved?.notes === "string" ? saved.notes : "";
    const responded = rows.filter((row: any) => {
      const status = String(row.response_status || row.status || "").toLowerCase().replace(/_/g, " ");
      return status === "responded" || status === "closed";
    }).length;
    const responseReady = rows.filter((row: any) =>
      hasValue(row.response_owner) || hasValue(row.response_due) || hasValue(row.response_summary) ||
      ["responded", "closed"].includes(String(row.response_status || row.status || "").toLowerCase().replace(/_/g, " "))
    ).length;
    const impactReviewed = rows.filter((row: any) =>
      ["low", "medium", "high"].includes(String(row.bafo_impact || "").toLowerCase()) ||
      ["low", "medium", "high"].includes(String(row.pricing_impact || "").toLowerCase()) ||
      ["low", "medium", "high"].includes(String(row.scope_impact || "").toLowerCase()) ||
      row.documents_required === true || hasValue(row.notes)
    ).length;
    const notesCaptured = hasValue(notes) || rows.some((row: any) => row.documents_required === true || hasValue(row.notes));
    return [
      { key: "clarification_register", label: "Clarification Register", percent: rows.length > 0 ? Math.min(Math.round((rows.length / 3) * 100), 100) : 0 },
      { key: "response_tracking", label: "Response Tracking", percent: rows.length > 0 ? progressPercent(responseReady + responded, rows.length * 2) : 0 },
      { key: "impact_review", label: "Impact Review", percent: rows.length > 0 ? progressPercent(impactReviewed, rows.length) : 0 },
      { key: "notes_documents", label: "Notes / Documents", percent: notesCaptured ? 100 : 0 },
    ];
  }

  if (tabId === "bafo_manager") {
    const bafo = ce.bafo ?? {};
    const hasBafo = !!(bafo.request_date || bafo.bafo_status);
    return [
      { key: "bafo_details", label: "BAFO Details", percent: hasBafo ? (bafo.bafo_status === "submitted" ? 100 : 50) : 0 },
      { key: "bafo_audit", label: "BAFO Audit Trail", percent: hasBafo ? 100 : 0 },
    ];
  }

  // Tab 3: Margin Impact — 2 sections: pricing_impact, margin_activity
  if (tabId === "margin_impact") {
    const margin = ce.margin_impact ?? {};
    const hasMargin = !!(margin.current_gp || margin.current_value);
    return [
      { key: "pricing_impact", label: "Pricing Impact", percent: hasMargin ? 100 : 0 },
      { key: "margin_activity", label: "Activity Log", percent: hasMargin ? 100 : 0 },
    ];
  }

  // Tab 4: Evaluation Status — 1 section: status_tracker
  if (tabId === "evaluation_status") {
    const evalStatus = ce.evaluation_status ?? {};
    const hasStatus = !!(evalStatus.technical_status && evalStatus.technical_status !== "unknown") ||
                      !!(evalStatus.commercial_status && evalStatus.commercial_status !== "unknown");
    return [
      { key: "status_tracker", label: "Status Tracker", percent: hasStatus ? 100 : 0 },
    ];
  }

  return null;
}

function buildNegotiationTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const neg = td?.negotiation_data ?? {};

  // Tab 1: Negotiation Log — 2 sections: meeting_log, activity_log
  if (tabId === "negotiation_log") {
    const entries: any[] = Array.isArray(neg.negotiation_log) ? neg.negotiation_log : [];
    const positive = entries.filter((e: any) => e.outcome === "positive").length;
    return [
      { key: "meeting_log", label: "Meeting Log", percent: entries.length > 0 ? Math.min(Math.round((entries.length / 3) * 100), 100) : 0 },
      { key: "activity_log", label: "Activity Log", percent: entries.length > 0 ? Math.round((positive / entries.length) * 100) : 0 },
    ];
  }

  // Tab 2: Requested Changes — 2 sections: change_register, changes_audit
  if (tabId === "requested_changes") {
    const changes: any[] = Array.isArray(neg.requested_changes) ? neg.requested_changes : [];
    const agreed = changes.filter((c: any) => c.status === "agreed").length;
    return [
      { key: "change_register", label: "Change Register", percent: changes.length > 0 ? Math.min(Math.round((changes.length / 5) * 100), 100) : 0 },
      { key: "changes_audit", label: "Audit Trail", percent: changes.length > 0 ? Math.round((agreed / changes.length) * 100) : 0 },
    ];
  }

  // Tab 3: Negotiation Margin — 2 sections: margin_tracker, margin_activity
  if (tabId === "negotiation_margin") {
    const margin = neg.margin_impact ?? {};
    const hasMargin = !!(margin.current_gp || margin.current_value);
    return [
      { key: "margin_tracker", label: "Margin Tracker", percent: hasMargin ? 100 : 0 },
      { key: "margin_activity", label: "Activity Log", percent: hasMargin ? 100 : 0 },
    ];
  }

  // Tab 4: Revised Versions — 1 section: terms_tracker
  if (tabId === "revised_versions") {
    const revised = neg.revised_terms ?? {};
    const hasTerms = Array.isArray(revised.terms) && revised.terms.length > 0;
    return [
      { key: "terms_tracker", label: "Terms Tracker", percent: hasTerms ? (revised.contract_readiness === "ready" ? 100 : 50) : 0 },
    ];
  }

  return null;
}

function buildAwardedTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const aw = td?.awarded_data ?? {};

  // Tab 1: Award Notice — 2 sections: award_details, award_activity
  if (tabId === "award_notice") {
    const notice = aw.award_notice ?? {};
    const hasNotice = !!(notice.award_date || notice.award_reference);
    return [
      { key: "award_details", label: "Award Details", percent: hasNotice ? 100 : 0 },
      { key: "award_activity", label: "Activity Log", percent: hasNotice ? 100 : 0 },
    ];
  }

  // Tab 2: Contract Prep — 2 sections: contract_status, contract_audit
  if (tabId === "contract_prep") {
    const contract = aw.contract_prep ?? {};
    const hasContract = !!(contract.contract_status && contract.contract_status !== "not_started");
    return [
      { key: "contract_status", label: "Contract Status", percent: hasContract ? (contract.contract_status === "signed" ? 100 : 50) : 0 },
      { key: "contract_audit", label: "Audit Trail", percent: hasContract ? 100 : 0 },
    ];
  }

  // Tab 3: SLA Prep — 2 sections: sla_summary, sla_activity
  if (tabId === "sla_prep") {
    const sla = aw.sla_prep ?? {};
    const hasSla = !!(sla.sla_status && sla.sla_status !== "not_started") || !!(sla.sla_notes);
    return [
      { key: "sla_summary", label: "SLA Summary", percent: hasSla ? 100 : 0 },
      { key: "sla_activity", label: "Activity Log", percent: hasSla ? 100 : 0 },
    ];
  }

  // Tab 4: Handover Prep — 1 section: handover_checklist
  if (tabId === "handover_prep") {
    const handover = aw.handover ?? {};
    const hasHandover = !!(handover.handover_status && handover.handover_status !== "not_started") || (Array.isArray(handover.checklist) && handover.checklist.length > 0);
    return [
      { key: "handover_checklist", label: "Handover Checklist", percent: hasHandover ? 100 : 0 },
    ];
  }

  return null;
}

function buildLostWithdrawnTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const td = (ws.tender as any).typeDetails || (ws.tender as any).type_details || {};
  const lw = td?.lost_withdrawn_data ?? {};

  if (tabId === "loss_reason") {
    const lr = lw.loss_reason ?? {};
    const hasLoss = !!(lr.outcome_type || lr.primary_reason);
    return [
      { key: "loss_details", label: "Loss Details", percent: hasLoss ? 100 : 0 },
      { key: "loss_activity", label: "Activity Log", percent: hasLoss ? 100 : 0 },
    ];
  }

  if (tabId === "lessons_learned") {
    const ll = lw.lessons_learned ?? {};
    const count = Array.isArray(ll.lessons) ? ll.lessons.length : 0;
    const hasNarrative = !!(ll.what_went_well || ll.what_went_wrong);
    return [
      { key: "lessons_register", label: "Lessons Register", percent: count > 0 ? Math.min(Math.round((count / 3) * 100), 100) : (hasNarrative ? 30 : 0) },
      { key: "lessons_audit", label: "Audit Trail", percent: count > 0 ? 100 : 0 },
    ];
  }

  if (tabId === "competitor_intelligence") {
    const ci = lw.competitor_intel ?? {};
    const count = Array.isArray(ci.competitors) ? ci.competitors.length : 0;
    return [
      { key: "competitor_register", label: "Competitor Register", percent: count > 0 ? Math.min(Math.round((count / 3) * 100), 100) : 0 },
      { key: "competitor_activity", label: "Activity Log", percent: count > 0 ? 100 : 0 },
    ];
  }

  if (tabId === "rebid_potential") {
    const rb = lw.rebid_potential ?? {};
    const hasRebid = !!(rb.likelihood && rb.likelihood !== "none");
    return [
      { key: "rebid_assessment", label: "Rebid Assessment", percent: hasRebid ? 100 : 0 },
    ];
  }

  return null;
}


function buildApprovalMatrixTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const t = ws.tender as any;
  const drafting = t.tenderDraftingData ?? {};
  const matrix = drafting.approval_matrix ?? {};
  const approvals: any[] = Array.isArray(matrix.approvals) ? matrix.approvals : [];
  const totalApprovers = approvals.length || 2; // minimum 2 (salesman + regional sales head)
  const approvedCount = approvals.filter((a: any) => a.decision === "approved").length;
  const rejectedCount = approvals.filter((a: any) => a.decision === "rejected").length;

  if (tabId === "approval_matrix") {
    // 3 sections: Data Sources, Required Approvals, Governance Note
    const hasGp = t.pricingData != null;
    const hasPallets = t.solutionDesignData != null;
    const dataPct = ((hasGp ? 50 : 0) + (hasPallets ? 50 : 0));
    const approvalPct = totalApprovers > 0 ? Math.round((approvedCount / totalApprovers) * 100) : 0;
    return [
      { key: "data_sources", label: "Data Sources", percent: dataPct },
      { key: "approvals", label: "Required Approvals", percent: approvalPct },
      { key: "governance", label: "Governance Note", percent: 100 },
    ];
  }

  if (tabId === "signoff_tracker") {
    // 2 sections: Signoff Progress, Decision History
    const progressPct = totalApprovers > 0 ? Math.round((approvedCount / totalApprovers) * 100) : 0;
    const decidedCount = approvals.filter((a: any) => a.decision !== "pending" && a.decided_at).length;
    const historyPct = decidedCount > 0 ? Math.round((decidedCount / totalApprovers) * 100) : 0;
    return [
      { key: "signoff_progress", label: "Signoff Progress", percent: progressPct },
      { key: "decision_history", label: "Decision History", percent: historyPct },
    ];
  }

  if (tabId === "exception_notes") {
    // 1 section: Rejected Items
    const exPct = rejectedCount > 0 ? 0 : 100;
    return [
      { key: "rejected_items", label: "Rejected Items", percent: exPct },
    ];
  }

  if (tabId === "governance_log") {
    // 2 sections: Governance Rules, Audit Trail
    const auditPct = approvals.length > 0 ? 100 : 0;
    return [
      { key: "governance_rules", label: "Governance Rules", percent: 100 },
      { key: "audit_trail", label: "Audit Trail", percent: auditPct },
    ];
  }

  return null;
}

function buildInternalReviewTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const drafting = (ws.tender.tenderDraftingData ?? {}) as any;
  const blocks = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];

  if (tabId === "review_dashboard") {
    // 3 sections: Department Summary, Overall Readiness, AI Flags
    const depts = ["ops", "finance", "legal"];
    const totalDeptBlocks = depts.reduce((s, d) => {
      const vols = d === "ops" ? ["Technical", "Shared"] : d === "finance" ? ["Commercial", "Shared"] : ["Technical", "Commercial", "Shared", "Appendix"];
      return s + blocks.filter((b: any) => vols.includes(b.volume)).length;
    }, 0);
    const totalApproved = depts.reduce((s, d) => {
      const vols = d === "ops" ? ["Technical", "Shared"] : d === "finance" ? ["Commercial", "Shared"] : ["Technical", "Commercial", "Shared", "Appendix"];
      return s + blocks.filter((b: any) => vols.includes(b.volume) && b[`${d}_status`] === "Approved").length;
    }, 0);
    const deptPct = totalDeptBlocks > 0 ? Math.round((totalApproved / totalDeptBlocks) * 100) : 0;
    const readinessPct = deptPct;
    const allFlags = blocks.reduce((s: number, b: any) => s + (Array.isArray(b.ai_flags) ? b.ai_flags.length : 0), 0);
    const flagPct: number | null = null;
    return [
      { key: "dept_summary", label: "Department Summary", percent: deptPct },
      { key: "readiness", label: "Overall Readiness", percent: readinessPct },
      { key: "ai_flags", label: "AI Flags", percent: flagPct },
    ];
  }

  if (tabId === "operations_review") {
    const vols = ["Technical", "Shared"];
    const opBlocks = blocks.filter((b: any) => vols.includes(b.volume));
    const approved = opBlocks.filter((b: any) => b.ops_status === "Approved").length;
    const rejected = opBlocks.filter((b: any) => b.ops_status === "Rejected").length;
    const total = opBlocks.length;
    const briefPct = total > 0 ? 100 : 0;
    const reviewPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const flagCount = opBlocks.reduce((s: number, b: any) => s + (Array.isArray(b.ai_flags) ? b.ai_flags.filter((f: any) => f.department === "ops").length : 0), 0);
    const flagPct: number | null = null;
    return [
      { key: "ops_briefing", label: "Briefing", percent: briefPct },
      { key: "ops_findings", label: "AI Findings", percent: flagPct },
      { key: "ops_blocks", label: "Block Review", percent: reviewPct },
    ];
  }

  if (tabId === "finance_review") {
    const vols = ["Commercial", "Shared"];
    const finBlocks = blocks.filter((b: any) => vols.includes(b.volume));
    const approved = finBlocks.filter((b: any) => b.finance_status === "Approved").length;
    const total = finBlocks.length;
    const briefPct = total > 0 ? 100 : 0;
    const reviewPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const flagPct: number | null = null;
    return [
      { key: "fin_briefing", label: "Briefing", percent: briefPct },
      { key: "fin_findings", label: "AI Findings", percent: flagPct },
      { key: "fin_blocks", label: "Block Review", percent: reviewPct },
    ];
  }

  if (tabId === "legal_review") {
    const vols = ["Technical", "Commercial", "Shared", "Appendix"];
    const legBlocks = blocks.filter((b: any) => vols.includes(b.volume));
    const approved = legBlocks.filter((b: any) => b.legal_status === "Approved").length;
    const total = legBlocks.length;
    const briefPct = total > 0 ? 100 : 0;
    const reviewPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    const flagPct: number | null = null;
    return [
      { key: "leg_briefing", label: "Briefing", percent: briefPct },
      { key: "leg_findings", label: "AI Findings", percent: flagPct },
      { key: "leg_blocks", label: "Block Review", percent: reviewPct },
    ];
  }

  if (tabId === "exceptions") {
    const depts = ["ops", "finance", "legal"];
    const totalRejected = depts.reduce((s, d) => {
      return s + blocks.filter((b: any) => b[`${d}_status`] === "Rejected").length;
    }, 0);
    const exPct = totalRejected > 0 ? 0 : 100;
    return [
      { key: "exceptions_inbox", label: "Exceptions Inbox", percent: exPct },
    ];
  }

  return null;
}

function buildFinalApprovedTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const t = ws.tender as any;
  const td = t.tenderDraftingData ?? {};
  const checks = (() => {
    const hasQual = !!(t.sowQualificationData || t.technicalQualificationData || t.customerFitData);
    const bnd = t.bidNoBidData;
    const decision = bnd?.decision?.decision || bnd?.decision;
    const hasBid = !!decision && decision !== "Not Decided" && decision !== "not_decided";
    const sd = t.solutionDesignData;
    const hasSd = !!(sd && typeof sd === "object" && Object.keys(sd).length > 0);
    const pricing = t.pricingData;
    const hasPricing = (Array.isArray(pricing?.scenarios) && pricing.scenarios.length > 0) || !!(pricing?.summary);
    const blocks = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];
    const reviews = td.departmental_reviews ?? {};
    const submitted = ["operations", "finance", "legal"].filter(d => reviews[d]?.submitted_at);
    const matrix = td.approval_matrix;
    const approvals: any[] = Array.isArray(matrix?.approvals) ? matrix.approvals : [];
    const allApproved = approvals.length > 0 && approvals.every((a: any) => a.decision === "approved");
    return { hasQual, hasBid, hasSd, hasPricing, hasBlocks: blocks.length > 0, reviewDone: submitted.length === 3, allApproved };
  })();

  if (tabId === "submission_readiness") {
    const total = 7;
    const done = [checks.hasQual, checks.hasBid, checks.hasSd, checks.hasPricing, checks.hasBlocks, checks.reviewDone, checks.allApproved].filter(Boolean).length;
    const checklistPct = Math.round((done / total) * 100);
    const compGaps = ws.complianceItems.filter(c => c.status === "non_compliant" || c.status === "clarification_required").length;
    const signalPct = compGaps === 0 ? 100 : 0;
    return [
      { key: "stage_checklist", label: "Stage Checklist", percent: checklistPct },
      { key: "readiness_signals", label: "Readiness Signals", percent: signalPct },
    ];
  }

  if (tabId === "final_pack") {
    const botResult = td.final_approval_check;
    const botReadyForAssembly = botResult?.status === "READY_FOR_SUBMISSION" || botResult?.ready_for_final_pack === true;
    const blocks = Array.isArray(td.proposal_blocks) ? td.proposal_blocks : [];
    const approvedBlocks = blocks.filter((b: any) => b.approval_status === "Approved" || b.approval_status === "Locked").length;
    const assemblyReady = botReadyForAssembly && blocks.length > 0 && approvedBlocks > 0;
    return [
      { key: "bot_check", label: "Approval Check Bot", percent: botResult ? (botReadyForAssembly ? 100 : 50) : 0 },
      { key: "assembly_readiness", label: "Assembly Readiness", percent: assemblyReady ? 100 : approvedBlocks > 0 ? 50 : 0 },
      { key: "block_register", label: "Block Register", percent: blocks.length > 0 ? Math.round((approvedBlocks / blocks.length) * 100) : 0 },
    ];
  }

  if (tabId === "submission_checklist") {
    const uploadedNames = ws.documents.map(d => d.document_name.toLowerCase());
    const uploaded = [
      "Final Tender Pack PDF", "OBK Native Excel", "OBK Signed/Stamped PDF", "Bid Statement Signed/Stamped PDF",
      "Transition Plan", "Continuous Improvement Proposal Form", "Compliance Pack", "Commercial Registration",
      "VAT Certificate", "ISO Certificates", "Insurance Certificates", "ADR Class 2 Certifications",
      "Reference Credentials", "Performance Guarantee Confirmation",
    ].filter(doc => uploadedNames.some(n => n.includes(doc.toLowerCase().split(" ")[0]))).length;
    return [
      { key: "required_docs", label: "Required Documents", percent: Math.round((uploaded / 14) * 100) },
    ];
  }

  if (tabId === "approval_record") {
    const matrix = td.approval_matrix ?? {};
    const approvals: any[] = Array.isArray(matrix.approvals) ? matrix.approvals : [];
    const approved = approvals.filter((a: any) => a.decision === "approved").length;
    const hasTriggers = t.pricingData != null || t.solutionDesignData != null;
    return [
      { key: "triggers", label: "Routing Triggers", percent: hasTriggers ? 100 : 0 },
      { key: "signoffs", label: "Sign-off Log", percent: approvals.length > 0 ? Math.round((approved / approvals.length) * 100) : 0 },
      { key: "governance", label: "Governance", percent: 100 },
    ];
  }

  return null;
}

function buildSubmittedTaskProgress(tabId: string, ws: TenderWorkspace): StageTaskProgressSegment[] | null {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const sub = td?.submission ?? {};

  if (tabId === "submission_log") {
    const rec = sub.submission_record ?? {};
    const hasRecord = !!(rec.submitted_at || rec.submitted_by);
    const hasReceipt = rec.receipt_confirmed === true;
    return [
      { key: "record", label: "Submission Record", percent: hasRecord ? 100 : 0 },
      { key: "receipt", label: "Receipt Confirmation", percent: hasReceipt ? 100 : 0 },
    ];
  }

  if (tabId === "submitted_version") {
    const ver = sub.submitted_version ?? {};
    const hasVersion = !!(ver.version_label || ver.frozen_at);
    const drafting = td?.tender_drafting ?? {};
    const blocks = Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
    return [
      { key: "snapshot", label: "Version Snapshot", percent: hasVersion ? 100 : 0 },
      { key: "blocks", label: "Block Snapshot", percent: blocks.length > 0 ? 100 : 0 },
    ];
  }

  if (tabId === "crm_sync") {
    const crm = sub.crm_sync ?? {};
    const hasCrm = !!(crm.crm_stage_after || crm.synced_at);
    const isSynced = crm.sync_status === "synced";
    return [
      { key: "pipeline", label: "Pipeline Transition", percent: hasCrm ? 100 : 0 },
      { key: "details", label: "Sync Details", percent: isSynced ? 100 : (hasCrm ? 50 : 0) },
    ];
  }

  if (tabId === "audit_trail") {
    const evtCount = Array.isArray(ws.activityEvents) ? ws.activityEvents.length : 0;
    return [
      { key: "events", label: "Event Log", percent: evtCount > 0 ? 100 : 0 },
    ];
  }

  return null;
}

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
          title={`${segment.label}: ${segment.percent === null ? "Informational" : `${segment.percent}% complete`}`}
        />
      ))}
    </div>
  );
}

// Tab names containing & or / need explicit clean IDs to avoid fragile routing
const SOLUTION_TAB_ID_OVERRIDES: Record<string, string> = {
  "Intake & File Audit": "intake_file_audit",
  "P&L Calculator": "pnl_calculator",
  "P&L Snapshot": "pnl_snapshot",
  "HIP Systems & IP Model": "hip_systems_ip_model",
  "SLA / KPI Model": "sla_kpi_model",
  "Assumptions & Dependencies": "assumptions_dependencies",
  "Appendices & Evidence": "appendices_evidence",
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

export default function TenderWorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState("overview");
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [splitGenOpen, setSplitGenOpen] = useState(false);
  const [emailSimOpen, setEmailSimOpen] = useState(false);
  const [cognitionStage, setCognitionStage] = useState<string>("identified");
  const [crmCognitionStage, setCrmCognitionStage] = useState<(typeof CRM_PIPELINE_STAGES)[0] | null>(null);
  const [internalCognitionStage, setInternalCognitionStage] = useState<TenderInternalStageDefinition | null>(null);
  const [documentDrawerOpen, setDocumentDrawerOpen] = useState(false);
  const [documentDrawerDefaultStage, setDocumentDrawerDefaultStage] = useState<TenderStageRelevance | undefined>(undefined);
  const [globalIntelOpen, setGlobalIntelOpen] = useState(false);
  const [showDocumentLibrary, setShowDocumentLibrary] = useState(false);

  // SUPA-006: Supabase-backed data load
  const { ws, status, errorMessage, reload } = useTenderWorkspaceData(id!);

  // Sync cognition panel to the DB internal process stage when ws loads
  // Uses mapDbStageToInternalCognitionStage so e.g. 'proposal_preparation' → 'tender_drafting'
  useEffect(() => {
    setCognitionStage(mapDbStageToInternalCognitionStage(ws?.tender?.internalStageRaw));
  }, [ws?.tender?.internalStageRaw]);

  const activeStageConfig = useMemo(
    () => ws ? buildStageConfig(ws, cognitionStage) : null,
    [ws, cognitionStage]
  );
  const activeTabs = useMemo(() => activeStageConfig?.tabs || ["Overview", "Activity"], [activeStageConfig]);
  const activeTabIds = useMemo(() => activeTabs.map(t => toCleanTabId(t)), [activeTabs]);

  const openDocumentDrawer = (defaultStage?: TenderStageRelevance) => {
    setDocumentDrawerDefaultStage(defaultStage);
    setDocumentDrawerOpen(true);
  };

  const openDocumentDrawerForTrackerStage = (stage: string = cognitionStage) => {
    openDocumentDrawer(stageLabelFromInternalStage(stage));
  };


  // Default to first tab of the new stage when stage changes
  useEffect(() => {
    if (activeTabIds.length > 0 && !activeTabIds.includes(tab)) {
      setTab(activeTabIds[0]);
    }
  }, [activeTabIds, tab]);

  if (status === 'loading') return (
    <div className="p-6 flex items-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading tender workspace from Supabaseâ€¦</span>
    </div>
  );

  if (status === 'error') return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h1 className="text-xl font-serif text-red-700">Could not read this tender</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        The read failed. This is a failure, not an empty tender — nothing can be concluded about the record itself.
      </p>
      <p className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{errorMessage}</p>
      <p className="text-[11px] text-muted-foreground">Tender ID: {id}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
          <Link href={cleanHref("/tenders")}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link>
      </div>
    </div>
  );

  // W04-T08-A: process isolation skipped the read entirely. Reporting this as
  // "not found" would assert a database fact that was never checked.
  if (status === 'isolated') return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-2">
        <ZapOff className="w-5 h-5 text-amber-600" />
        <h1 className="text-xl font-serif text-amber-800">This tender workspace is not connected</h1>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">{errorMessage}</p>
      <p className="text-[11px] text-muted-foreground">Tender ID: {id}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
        <Link href={cleanHref("/tenders")}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Back to Tenders</Button></Link>
      </div>
    </div>
  );

  if (status === 'empty' || !ws) return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-serif">Tender workspace not found</h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        {errorMessage || `No active tender row is visible for id ${id} in commercial_tickets.`}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
        <Link href={cleanHref("/tenders")}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Back to Tenders</Button></Link>
      </div>
    </div>
  );

  const t = ws.tender;
  const persistedInternalStage = normalizeTenderInternalStage(t.internalStageRaw);
  const daysLeft = Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / 86400000);
  // Signal count derived from real compliance data — no mock gates
  const signalCount = ws.complianceItems.filter(c =>
    c.status === 'non_compliant' || c.status === 'clarification_required'
  ).length;
  const currentInternalStage = TENDER_INTERNAL_STAGES.find(s => s.value === cognitionStage) ?? TENDER_INTERNAL_STAGES[0];
  const activeInternalStage = currentInternalStage;
  const activeInternalStageIdx = Math.max(0, TENDER_INTERNAL_STAGES.findIndex(s => s.value === cognitionStage));
  const selectedPack = ws.packs.find(p => p.id === selectedPackId) ?? ws.packs[0] ?? null;

  return (
    <TooltipProvider>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Back */}
        <div className="mb-3"><Link href={cleanHref("/tenders")}><Button variant="ghost" size="sm" className="text-xs gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Back to Tenders</Button></Link></div>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ws.riskLevel === "red" ? "bg-red-500" : ws.riskLevel === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
            <h1 className="text-xl font-serif font-bold">{t.title}</h1>
            <Badge variant="outline" className="text-[10px] border-[#244f96] text-[#075eea] bg-[#075eea]/10">{ws.tenderType}</Badge>
            {/* W04-T08-A: this badge used to render `t.status`, which is
                internal_stage squeezed through the CRM TenderMilestone union —
                so a tender saved at "clarification" displayed "Prospecting".
                It now renders the internal stage in its own vocabulary. */}
            <Badge variant="outline" className="text-[10px] border-[#244f96]/40 text-[#075eea] bg-[#075eea]/10">
              Internal: {TENDER_INTERNAL_STAGES.find(s => s.value === persistedInternalStage)?.label ?? persistedInternalStage}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">
              Saved CRM stage: {ws.crmPipelineStageRaw ?? 'Not set'}
            </Badge>
            {riskBadge(ws.riskLevel)}
            <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-600">CRM: {getCleanCrmSyncStatusLabel(ws.crmSyncStatus)}</Badge>
            <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
            {/* CLEAN APP: was a raw <a> (full page reload). Raw anchors bypass
                wouter's <Router base="/clean">, so this would have escaped the
                clean surface to the legacy /tenders/:id/final-pack route.
                Converted to <Link> so it resolves to /clean/tenders/:id/final-pack.
                NO-GATE: unchanged — always enabled, no readiness condition. */}
            <Link
                      href={cleanHref(`/tenders/${id}/final-pack`)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-[var(--color-hala-navy)] bg-[var(--color-hala-navy)] px-3 py-1.5 text-[10px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <FileText className="w-3 h-3" />
              Final Pack Studio
            </Link>
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

        {/* W04-T08-A: the strip is fed the PERSISTED stage only. It used to
            prefer `crmCognitionStage`, a pending dialog selection, which would
            have shown an unsaved stage as if it were the saved one. */}
        <CrmPipelineStrip
          activeCrmStage={t.crmPipelineStage as any}
          onCrmStageChange={async (stage) => {
            // The read layer coerces any stage key it does not know back to
            // 'prospecting'. Writing such a key would produce a "persisted"
            // toast followed by a reload showing a different stage. Refuse and
            // say so rather than report a persistence that cannot be read back.
            if (!isRestorableCrmPipelineStage(stage)) {
              toast.warning('CRM stage not moved', {
                description: `"${stage}" is not a CRM stage this workspace can store and read back, so nothing was written. The saved stage is unchanged.`,
              });
              return;
            }
            const prev = ws.crmPipelineStageRaw ?? '(not set)';
            const result = await updateTenderCrmStage(id!, prev, stage, 'Manual CRM stage move');
            if (result.success) { toast.success(`CRM Pipeline moved to ${stage}`, { description: 'Persisted to Supabase.' }); reload(); }
            else toast.warning('CRM stage update failed', { description: result.error });
          }}
          crmDealId={t.id.substring(0, 6)}
        />

        {/* â”€â”€ TRACKER 2: INTERNAL TENDER PROCESS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Card className="border border-[#244f96]/30 shadow-none mb-3 gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            {/* Header strip — light blue, matching CRM Pipeline green strip */}
            <div className="flex items-center justify-between border-b border-[#075eea]/20 bg-[#075eea]/[0.06] px-6 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#075eea]">
                  Internal Tender Process Tracker
                </span>
                <Badge variant="outline" className="text-[9px] border-[#244f96]/40 text-[#075eea] bg-[#075eea]/10">
                  Stage {activeInternalStageIdx + 1} of {TENDER_INTERNAL_STAGES.length}
                </Badge>
                <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-600 bg-white">
                  Saved current: {TENDER_INTERNAL_STAGES.find(stage => stage.value === persistedInternalStage)?.label}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="text-xs h-7 gap-1 bg-[#075eea] text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#0b73ff] hover:shadow-md active:translate-y-0 active:bg-[#244f96]">
                    Browse Tender Stage <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                  {TENDER_INTERNAL_STAGES.map((s, i) => (
                    <DropdownMenuItem
                      key={s.value}
                      disabled={s.value === cognitionStage}
                      onClick={() => setCognitionStage(s.value)}
                      className="text-xs"
                    >
                      <span className={`w-4 text-center text-[10px] font-bold ${i < activeInternalStageIdx ? "text-emerald-500" : i === activeInternalStageIdx ? "text-[#075eea]" : "text-muted-foreground/40"}`}>
                        {i + 1}
                      </span>
                      <span className="ml-2">{s.label}</span>
                      {s.value === cognitionStage && <Badge variant="outline" className="ml-auto text-[8px]">Current</Badge>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stage pills */}
            <div className="px-6 py-2.5">
            <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
              {TENDER_INTERNAL_STAGES.map((s, i) => {
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
                          ? "bg-[#075eea] text-white shadow-md cursor-default"
                          : isPast
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            : isNext
                              ? "border border-dashed border-[#244f96] text-[#075eea] hover:bg-[#075eea]/10 cursor-pointer"
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

                    {i < TENDER_INTERNAL_STAGES.length - 1 && (
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
                {cognitionStage !== persistedInternalStage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px]"
                    onClick={() => setInternalCognitionStage(currentInternalStage)}
                  >
                    Set {currentInternalStage.label} as Current Stage
                  </Button>
                )}
              </div>
            )}

            {/* Active stage label */}
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              Internal Process: <strong className="text-foreground/70">{activeInternalStage.label}</strong>
            </p>
            </div>
          </CardContent>
        </Card>


        {/* â”€â”€ WORKBENCH CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Card className="border border-border shadow-none mb-4">
          <CardContent className="p-0">
            {/* Stage header */}
            {cognitionStage !== "qualification" && cognitionStage !== "identified" && cognitionStage !== "bid_no_bid" && cognitionStage !== "solution_design" && cognitionStage !== "pnl_pricing" && cognitionStage !== "tender_drafting" && cognitionStage !== "internal_review" && cognitionStage !== "approval_matrix" && cognitionStage !== "final_approved" && cognitionStage !== "submitted" && cognitionStage !== "clarification" && cognitionStage !== "client_evaluation" && cognitionStage !== "negotiation" && cognitionStage !== "awarded" && cognitionStage !== "lost_withdrawn" && (
            <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getTenderStatusColor(cognitionStage as any).split(' ')[0].replace('text-', 'bg-')}`} />
                <span className="text-sm font-semibold">{TENDER_INTERNAL_STAGES.find(s => s.value === cognitionStage)?.label ?? currentInternalStage.label}</span>
                <Badge variant="outline" className={`text-[9px]`}>
                  Stage {TENDER_INTERNAL_STAGES.findIndex(s => s.value === cognitionStage) + 1}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground/60 italic hidden sm:inline">{TENDER_INTERNAL_STAGES.find(s => s.value === cognitionStage)?.purpose ?? currentInternalStage.purpose}</span>
            </div>
            )}
            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab}>
              <div className={(cognitionStage === "qualification" || cognitionStage === "identified" || cognitionStage === "bid_no_bid" || cognitionStage === "tender_drafting" || cognitionStage === "solution_design" || cognitionStage === "pnl_pricing" || cognitionStage === "internal_review" || cognitionStage === "approval_matrix" || cognitionStage === "final_approved" || cognitionStage === "submitted" || cognitionStage === "clarification" || cognitionStage === "client_evaluation" || cognitionStage === "negotiation" || cognitionStage === "awarded" || cognitionStage === "lost_withdrawn") ? "grid gap-0 border-t border-border lg:grid-cols-[220px_minmax(0,1fr)]" : ""}>
              <div className={(cognitionStage === "qualification" || cognitionStage === "identified" || cognitionStage === "bid_no_bid" || cognitionStage === "tender_drafting" || cognitionStage === "solution_design" || cognitionStage === "pnl_pricing" || cognitionStage === "internal_review" || cognitionStage === "approval_matrix" || cognitionStage === "final_approved" || cognitionStage === "submitted" || cognitionStage === "clarification" || cognitionStage === "client_evaluation" || cognitionStage === "negotiation" || cognitionStage === "awarded" || cognitionStage === "lost_withdrawn")
                ? "border-b border-border bg-card p-4 lg:border-b-0 lg:border-r"
                : "px-4 pt-0 pb-0 border-b border-border bg-muted/10 overflow-x-auto"
              }>
                {(cognitionStage === "qualification" || cognitionStage === "identified" || cognitionStage === "bid_no_bid" || cognitionStage === "tender_drafting" || cognitionStage === "solution_design" || cognitionStage === "pnl_pricing" || cognitionStage === "internal_review" || cognitionStage === "approval_matrix" || cognitionStage === "final_approved" || cognitionStage === "submitted" || cognitionStage === "clarification" || cognitionStage === "client_evaluation" || cognitionStage === "negotiation" || cognitionStage === "awarded" || cognitionStage === "lost_withdrawn") && (
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Stage Tasks
                  </div>
                )}
                <TabsList className={(cognitionStage === "qualification" || cognitionStage === "identified" || cognitionStage === "bid_no_bid" || cognitionStage === "tender_drafting" || cognitionStage === "solution_design" || cognitionStage === "pnl_pricing" || cognitionStage === "internal_review" || cognitionStage === "approval_matrix" || cognitionStage === "final_approved" || cognitionStage === "submitted" || cognitionStage === "clarification" || cognitionStage === "client_evaluation" || cognitionStage === "negotiation" || cognitionStage === "awarded" || cognitionStage === "lost_withdrawn")
                  ? "flex h-auto w-full flex-row gap-2 overflow-x-auto bg-transparent p-0 lg:flex-col lg:overflow-visible"
                  : "h-8 bg-transparent p-0 gap-0"
                }>
                  {activeTabs.map(tName => {
                    const tabId = toCleanTabId(tName);
                    const icons: Record<string, React.ElementType> = {
                      tender_summary: BookOpen, packs: Package, tender_builder: Package, final_pack: Package, submitted_version: Send,
                      placeholders: FileText, commercial: DollarSign, pnl_calculator: Calculator, pnl_snapshot: Calculator, cost_inputs: DollarSign, pricing_scenarios: Scale, commercial_terms: ScrollText, pricing_approval: CheckCircle2,
                      delivery: Truck, warehouse_model: Package, transport_model: Truck, compliance_matrix: Shield, compliance_alignment: Shield, compliance_coverage: Shield,
                      required_documents: FileText, technical_evidence: FileText,
                      bid_decision: Scale, win_strategy: Trophy, resource_commitment: Users, decision_record: Stamp,
                      solution_configuration: Wrench, hop_operations_model: Truck, ham_manpower_model: Users, hip_systems_ip_model: Database, scope_matrix: ClipboardList, sla_kpi_model: Target, assumptions_dependencies: FileText,
                      proposal_architecture_toc: ClipboardList, proposal_block_workbench: Layers, technical_volume: BookOpen, commercial_volume: DollarSign, appendices_evidence: FolderOpen,
                      submission_readiness: CheckCircle2, activity: Activity, decision_log: ClipboardList, clarification_log: MessageSquare, negotiation_log: MessageSquare, submission_log: Send, response_history: Clock, audit_trail: Clock, approval_record: CheckCircle2,
                      "q&a_log": MessageSquare, response_drafts: FileText, impact_analysis: AlertTriangle, clarification_status: CheckCircle2,
                      review_dashboard: BarChart3, operations_review: Shield, finance_review: DollarSign, legal_review: Scale, exceptions: AlertTriangle,
                      approval_matrix: Shield, signoff_tracker: CheckCircle2, exception_notes: AlertTriangle, governance_log: Clock,
                      sow_qualification: ClipboardList, technical_qualification: Wrench, customer_fit: Users, risk_snapshot: ShieldAlert,
                      customer_snapshot: Building2, intake_file_audit: UploadCloud, document_review: FolderOpen,
                      submission_checklist: ClipboardCheck,
                      crm_sync: Radio,
                      request_log: MessageSquare, client_clarifications: MessageSquare, bafo_manager: DollarSign, margin_impact: AlertTriangle, evaluation_status: CheckCircle2,
                      requested_changes: ClipboardList, negotiation_margin: DollarSign, revised_versions: FileText,
                      award_notice: Trophy, contract_prep: FileText, sla_prep: Shield, handover_prep: Users,
                      loss_reason: XCircle, lessons_learned: BookOpen, competitor_intelligence: Eye, rebid_potential: TrendingUp,
                    };
                    const Icon = icons[tabId] ?? FileText;
                    const isStageTaskLayout = cognitionStage === "qualification" || cognitionStage === "identified" || cognitionStage === "bid_no_bid" || cognitionStage === "tender_drafting" || cognitionStage === "solution_design" || cognitionStage === "pnl_pricing" || cognitionStage === "internal_review" || cognitionStage === "approval_matrix" || cognitionStage === "final_approved" || cognitionStage === "submitted" || cognitionStage === "clarification" || cognitionStage === "client_evaluation" || cognitionStage === "negotiation" || cognitionStage === "awarded" || cognitionStage === "lost_withdrawn";
                    const taskIndex = activeTabs.indexOf(tName) + 1;
                    const activeTaskIndex = activeTabs.findIndex(name => toCleanTabId(name) === tab) + 1;
                    const isActiveStageTask = isStageTaskLayout && taskIndex === activeTaskIndex;
                    const taskProgress = buildStageTaskProgress(cognitionStage, tabId, ws);
                    return (
                      <TabsTrigger key={tabId} value={tabId}
                        className={isStageTaskLayout
                          ? "group grid min-h-12 w-[180px] shrink-0 grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-x-2 gap-y-1 rounded-md border border-transparent px-3 py-2 text-left text-[11px] font-medium transition-all whitespace-normal data-[state=active]:border-blue-300 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 data-[state=active]:shadow-none lg:w-full"
                          : "rounded-none border-b-2 border-transparent data-[state=active]:border-[#075eea] data-[state=active]:bg-transparent data-[state=active]:text-[#075eea] data-[state=active]:shadow-none px-3 h-8 text-[11px] font-medium transition-all whitespace-nowrap"
                        }>
                        {isStageTaskLayout ? (
                          <>
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground group-data-[state=active]:border-[#075eea]/30 group-data-[state=active]:bg-white group-data-[state=active]:text-[#075eea]">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 whitespace-normal break-normal text-[12px] font-semibold leading-tight">{tName}</span>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold ${
                              isActiveStageTask
                                ? "border-emerald-300 bg-emerald-400 text-white shadow-[0_0_0_3px_rgba(16,185,129,.18),0_0_14px_rgba(16,185,129,.55)]"
                                : "border-border bg-card text-muted-foreground"
                            }`}>
                              {isActiveStageTask ? <span className="h-2 w-2 rounded-full bg-white" /> : taskIndex}
                            </span>
                            {taskProgress && (
                              <>
                                <StageTaskProgressMeter segments={taskProgress} />
                                <span className="col-span-3 block whitespace-normal text-[10px] font-normal leading-tight text-slate-600">
                                  Each block maps to one inner tab.
                                </span>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <Icon className="w-3 h-3 mr-1.5" />{tName}
                          </>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              {activeTabs.map(tabName => {
                const tabId = toCleanTabId(tabName);
                return (
                  <TabsContent key={tabId} value={tabId} className={(cognitionStage === "qualification" || cognitionStage === "identified" || cognitionStage === "bid_no_bid" || cognitionStage === "tender_drafting" || cognitionStage === "solution_design" || cognitionStage === "pnl_pricing" || cognitionStage === "internal_review" || cognitionStage === "approval_matrix" || cognitionStage === "final_approved" || cognitionStage === "submitted" || cognitionStage === "clarification" || cognitionStage === "client_evaluation" || cognitionStage === "negotiation" || cognitionStage === "awarded" || cognitionStage === "lost_withdrawn") ? "mt-0 min-w-0 p-4 lg:p-5" : "mt-0 p-5"}>
                    <TenderStageIntelligenceProvider content={<PreviousStageIntelligenceContent ws={ws} currentStage={cognitionStage} />}>
                    {(() => {
                      // ─── Stage 9: Final Approved tabs ────────────────────
                      if (cognitionStage === "final_approved" && ["submission_readiness", "final_pack", "submission_checklist", "approval_record"].includes(tabId)) {
                        return <FinalApprovedStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("final_approved")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 10: Submitted tabs ─────────────────────────
                      if (cognitionStage === "submitted" && ["submission_log", "submitted_version", "crm_sync", "audit_trail"].includes(tabId)) {
                        return <SubmittedStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("submitted")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 11: Clarification tabs ────────────────────
                      if (cognitionStage === "clarification" && ["q&a_log", "response_drafts", "impact_analysis", "clarification_status"].includes(tabId)) {
                        return <ClarificationStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("clarification")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 12: Client Evaluation tabs ─────────────────
                      if (cognitionStage === "client_evaluation" && ["request_log", "client_clarifications", "bafo_manager", "margin_impact", "evaluation_status"].includes(tabId)) {
                        return <ClientEvaluationStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("client_evaluation")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 13: Negotiation tabs ────────────────────────
                      if (cognitionStage === "negotiation" && ["negotiation_log", "requested_changes", "negotiation_margin", "revised_versions"].includes(tabId)) {
                        return <NegotiationStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("negotiation")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 14: Awarded tabs ─────────────────────────────
                      if (cognitionStage === "awarded" && ["award_notice", "contract_prep", "sla_prep", "handover_prep"].includes(tabId)) {
                        return <AwardedStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("awarded")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 15: Lost / Withdrawn tabs ────────────────────
                      if (cognitionStage === "lost_withdrawn" && ["loss_reason", "lessons_learned", "competitor_intelligence", "rebid_potential"].includes(tabId)) {
                        return <LostWithdrawnStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("lost_withdrawn")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

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
                                <Mail className="w-3.5 h-3.5" /> Review Submission Email
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
                                  {(() => {
                                    const cleanWarnings = selectedPack.readinessWarnings
                                      .map(cleanProcessCopy)
                                      .filter((w): w is string => Boolean(w));
                                    if (cleanWarnings.length === 0) return null;
                                    return (
                                      <div className="space-y-2">
                                        {cleanWarnings.map((warning, i) => (
                                          <div key={`${warning}-${i}`} className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                                            <p className="text-xs text-amber-800 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 shrink-0" />{warning}</p>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}

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
                                      {selectedPack.advisoryActions.map(action => {
                                        const normalizedAction = action.toLowerCase();
                                        const Icon =
                                          normalizedAction.includes("output") ? FileOutput :
                                          normalizedAction.includes("split") ? FlaskConical :
                                          normalizedAction.includes("readiness") ? Eye :
                                          Wrench;
                                        const isSplitAction = normalizedAction.includes("split") || normalizedAction.includes("output");
                                        const label = getCleanPackActionLabel(action);
                                        if (!label) return null;
                                        return (
                                          <Button key={action} variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => isSplitAction ? setSplitGenOpen(true) : toast.info("Action not connected.", { description: "No workflow was created." })}>
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
                      // Identified Workbench Tabs
                      if (cognitionStage === "identified" && tabId === "intake_file_audit") {
                        return <IntakeFileAuditTab ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("identified")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }
                      if (cognitionStage === "identified" && tabId === "document_review") {
                        return <TenderDocumentReviewTab ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("identified")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }
                      if (cognitionStage === "identified" && tabId === "compliance_matrix") {
                        return <IdentifiedComplianceMatrixTab ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("identified")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }
                      if (cognitionStage === "identified" && tabId === "clarification_log") {
                        return <IdentifiedClarificationLogTab ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("identified")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      if (tabId === "placeholders") return <TenderPlaceholdersTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "compliance_matrix" || tabId === "compliance_alignment") return <TenderComplianceMatrixTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "required_documents" || tabId === "technical_evidence") return <TenderRequiredDocumentsTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "submission_readiness") return <TenderSubmissionGatesTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "activity" || tabId === "clarification_log" || tabId === "negotiation_log" || tabId === "submission_log" || tabId === "response_history") return <TenderActivityTab ws={ws} tenderId={id!} reload={reload} />;
                      if (tabId === "audit_trail" || tabId === "approval_record") return <TenderAuditTrailTab ws={ws} />;
                      if (tabId === "pnl_calculator") {
                        return <TenderPnLCalculatorPanel ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("pnl_pricing")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }
                      if (["pricing_scenarios", "commercial_terms", "pricing_approval"].includes(tabId)) {
                        return <PnlPricingStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("pnl_pricing")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 6: Tender Drafting tabs ────────────────
                      if (["proposal_architecture_toc", "proposal_block_workbench", "technical_volume", "commercial_volume", "compliance_coverage", "appendices_evidence"].includes(tabId)) {
                        return <TenderDraftingStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("tender_drafting")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} onSaved={reload} />;
                      }

                      // ─── Stage 7: Internal Review tabs ─────────────────
                      if (["review_dashboard", "operations_review", "finance_review", "legal_review", "exceptions"].includes(tabId)) {
                        return <InternalReviewStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("internal_review")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // ─── Stage 8: Approval Matrix tabs ──────────────────
                      if (["approval_matrix", "signoff_tracker", "exception_notes", "governance_log"].includes(tabId)) {
                        return <ApprovalMatrixStage ws={ws} activeTab={tabId} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("approval_matrix")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      }

                      // Identified Workbench Tabs
                      if (tabId === "tender_summary") return <TenderSummaryTab ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("identified")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "customer_snapshot") return <TenderCustomerSnapshotTab ws={ws} reload={reload} onOpenDocuments={() => openDocumentDrawerForTrackerStage("identified")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;

                      // Qualification Workbench Tabs
                      if (tabId === "sow_qualification") return <SowQualification ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("qualification")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} onSaved={reload} />;
                      if (tabId === "technical_qualification") return <TechnicalQualification ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("qualification")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "customer_fit") return <CustomerFitQualification ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("qualification")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "risk_snapshot") return <RiskSnapshot ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("qualification")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;

                      // Bid / No-Bid Workbench Tabs
                      if (tabId === "bid_decision") return <BidDecisionTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("bid_no_bid")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} onSaved={reload} />;
                      if (tabId === "win_strategy") return <WinStrategyTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("bid_no_bid")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} onSaved={reload} />;
                      if (tabId === "resource_commitment") return <ResourceCommitmentTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("bid_no_bid")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} onSaved={reload} />;
                      if (tabId === "decision_record") return <DecisionRecordTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("bid_no_bid")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} onSaved={reload} />;

                      // Solution Design Workbench Tabs
                      if (tabId === "solution_configuration") return <SolutionConfigurationTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "hop_operations_model") return <HOPOperationsModelTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "ham_manpower_model") return <HAMManpowerModelTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "hip_systems_ip_model") return <HIPSystemsIPModelTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "scope_matrix") return <ScopeMatrixTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "sla_kpi_model") return <SLAKPIModelTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;
                      if (tabId === "assumptions_dependencies") return <AssumptionsDependenciesTab ws={ws} onOpenDocuments={() => openDocumentDrawerForTrackerStage("solution_design")} onOpenGlobalIntel={() => setGlobalIntelOpen(true)} />;

                      // Configured clean-process tabs are routed above; unmapped tabs should not render synthetic process content.
                      return null;
                    })()}
                    </TenderStageIntelligenceProvider>
                  </TabsContent>
                );
              })}
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Proposal Block Readiness — stage-level panel (foundation only) */}
        <SuggestedProposalBlocksPanel
          stageKey={toStageKey(cognitionStage)}
          tenderData={ws ? buildTenderDataSnapshot(ws) : null}
        />

        {/* Tender Knowledge Base — document organization for orchestration (Wave 3). */}
        <TenderKnowledgeBaseSection tenderId={id!} documents={ws?.documents ?? []} reload={reload} />

        {/* AI Orchestration Review — review-only suggestion surface (Wave 2). */}
        <TenderOrchestrationReviewSection tenderId={id!} />

      </div>
      <TenderDocumentDrawer
        open={documentDrawerOpen}
        onOpenChange={open => {
          setDocumentDrawerOpen(open);
          if (!open) setDocumentDrawerDefaultStage(undefined);
        }}
        ws={ws}
        tenderId={id!}
        reload={reload}
        defaultStage={documentDrawerDefaultStage}
      />
      <TenderGlobalIntelligenceDrawer
        open={globalIntelOpen}
        onOpenChange={setGlobalIntelOpen}
        ws={ws}
        tenderId={id!}
        reload={reload}
        daysLeft={daysLeft}
        targetGp={t.targetGpPercent}
        signalCount={signalCount}
      />
      {splitGenOpen && <TenderSplitPackGenerator ws={ws} onClose={() => setSplitGenOpen(false)} />}
      {emailSimOpen && <TenderSubmissionEmailReview ws={ws} onClose={() => setEmailSimOpen(false)} tenderId={id!} reload={reload} />}

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
                  const prev = ws.crmPipelineStageRaw ?? '(not set)';
                  if (!isRestorableCrmPipelineStage(crmCognitionStage.value)) {
                    toast.warning('CRM stage not moved', {
                      description: `"${crmCognitionStage.value}" is not a CRM stage this workspace can store and read back, so nothing was written.`,
                    });
                    setCrmCognitionStage(null);
                    return;
                  }
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

      {/* ─── INTERNAL STAGE COGNITION DIALOG ─────────────────────────── */}
      <Dialog open={!!internalCognitionStage} onOpenChange={() => setInternalCognitionStage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#075eea]" />Tender Stage — {internalCognitionStage?.label}</DialogTitle>
          </DialogHeader>
          {internalCognitionStage && (
            <div className="space-y-4">
              <p className="text-xs font-medium text-foreground">{internalCognitionStage.purpose}</p>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Stage Outputs</p>
                <ul className="space-y-1">{internalCognitionStage.outputs.map(o => <li key={o} className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />{o}</li>)}</ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Next Action</p>
                <p className="text-xs text-amber-800 font-medium">{internalCognitionStage.nextAction}</p>
              </div>
              {internalCognitionStage.value !== persistedInternalStage && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Move to this stage?</p>
                  <Button className="w-full text-sm" onClick={async () => {
                    const result = await updateTenderPhase(id!, persistedInternalStage, internalCognitionStage.value, 'Manual internal Tender stage change');
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
