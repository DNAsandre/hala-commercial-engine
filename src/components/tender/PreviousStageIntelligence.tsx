/**
 * PreviousStageIntelligence - read-only tender intelligence for the active tender.
 *
 * This component only summarizes actual saved data already attached to the active
 * tender workspace. It does not infer, generate, fetch outside intelligence, or
 * write anything back to the database.
 */

import { Badge } from "@/components/ui/badge";
import {
  documentsForTenderStage,
  summarizeTenderDocuments,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";
import { isMeaningfulTenderValue } from "@/lib/proposal-block-foundation";
import { hasPricingData, normalizeTenderPricingData } from "@/lib/tender-pricing-types";
import { projectTenderStageTruth } from "@/lib/tender-stage-source-truth";
import { deriveDepartmentalReviewProgress } from "./FinalApprovedStage";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ClipboardList,
  FileText,
  Shield,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

type StageKey =
  | "identified"
  | "qualification"
  | "bid_no_bid"
  | "solution_design"
  | "pnl_pricing"
  | "tender_drafting"
  | "internal_review"
  | "approval_matrix"
  | "final_approved"
  | "submitted"
  | "clarification"
  | "client_evaluation"
  | "negotiation"
  | "awarded"
  | "lost_withdrawn";

interface Props {
  ws: TenderWorkspace;
  currentStage?: string;
}

interface IntelligenceRow {
  stage: StageKey;
  icon: LucideIcon;
  label: string;
  status: string;
  detail?: string;
  captured: boolean;
}

const STAGE_ORDER: StageKey[] = [
  "identified",
  "qualification",
  "bid_no_bid",
  "solution_design",
  "pnl_pricing",
  "tender_drafting",
  "internal_review",
  "approval_matrix",
  "final_approved",
  "submitted",
  "clarification",
  "client_evaluation",
  "negotiation",
  "awarded",
  "lost_withdrawn",
];

const STAGE_LABELS: Record<StageKey, string> = {
  identified: "Identified",
  qualification: "Qualification",
  bid_no_bid: "Bid / No-Bid",
  solution_design: "Solution Design",
  pnl_pricing: "P&L / Pricing",
  tender_drafting: "Tender Drafting",
  internal_review: "Internal Review",
  approval_matrix: "Approval Matrix",
  final_approved: "Final Approved",
  submitted: "Submitted",
  clarification: "Clarification",
  client_evaluation: "Client Evaluation",
  negotiation: "Negotiation",
  awarded: "Awarded",
  lost_withdrawn: "Lost / Withdrawn",
};

function normalizeStage(stage?: string): StageKey | null {
  const normalized = String(stage || "").trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/\//g, "_");
  const aliases: Record<string, StageKey> = {
    identified: "identified",
    qualification: "qualification",
    bid_no_bid: "bid_no_bid",
    bid___no_bid: "bid_no_bid",
    bid_no___bid: "bid_no_bid",
    solution_design: "solution_design",
    solutioning: "solution_design",
    pnl_pricing: "pnl_pricing",
    p_l_pricing: "pnl_pricing",
    p_l___pricing: "pnl_pricing",
    tender_drafting: "tender_drafting",
    proposal_preparation: "tender_drafting",
    internal_review: "internal_review",
    approval_matrix: "approval_matrix",
    final_approved: "final_approved",
    submitted: "submitted",
    submission: "submitted",
    clarification: "clarification",
    technical_review: "client_evaluation",
    commercial_review: "client_evaluation",
    client_evaluation: "client_evaluation",
    negotiation: "negotiation",
    contract_negotiation: "negotiation",
    awarded: "awarded",
    lost_withdrawn: "lost_withdrawn",
    lost___withdrawn: "lost_withdrawn",
  };
  return aliases[normalized] ?? null;
}

function labelize(value: unknown, fallback = "Not captured"): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim().replace(/_/g, " ");
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function compactDetail(parts: Array<string | number | null | undefined | false>): string | undefined {
  const clean = parts
    .map(part => String(part ?? "").trim())
    .filter(Boolean);
  return clean.length > 0 ? clean.join(" - ") : undefined;
}

function rowsFrom(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.terms)) return value.terms;
  return [];
}

function countItems(data: any, arrayKey: string): number {
  return rowsFrom(data?.[arrayKey]).length;
}

function countAssessedRows(data: any, arrayKey: string, statusKey: string, defaultStatus: string): { assessed: number; total: number } {
  const arr = rowsFrom(data?.[arrayKey]);
  const assessed = arr.filter(row => row?.[statusKey] && row[statusKey] !== defaultStatus).length;
  return { assessed, total: arr.length };
}

function isCaptured(value: unknown): boolean {
  return isMeaningfulTenderValue(value);
}

function extractStatus(data: any): string {
  if (!data || typeof data !== "object") return "Not captured";
  const rec = data.recommendation || data.outcome;
  if (rec && typeof rec === "object") {
    const val = rec.outcome || rec.recommendation;
    if (val && val !== "Not decided" && val !== "Not Decided") return String(val);
  }
  return "Captured - no recommendation yet";
}

function typeDetails(ws: TenderWorkspace): Record<string, any> {
  const tender = ws.tender as any;
  return (tender.typeDetails || tender.type_details || {}) as Record<string, any>;
}

function stageDocumentRow(ws: TenderWorkspace, stage: StageKey, label: string): IntelligenceRow {
  const docs = documentsForTenderStage(ws.documents || [], stage);
  const summary = summarizeTenderDocuments(docs);
  return {
    stage,
    icon: FileText,
    label,
    status: summary.total > 0 ? `${summary.total} document${summary.total === 1 ? "" : "s"}` : "No documents linked",
    detail: compactDetail([
      `${summary.source} source`,
      `${summary.supporting} supporting`,
      summary.issues > 0 ? `${summary.issues} issue${summary.issues === 1 ? "" : "s"}` : "no document issues",
    ]),
    captured: summary.total > 0,
  };
}

function buildIdentifiedRows(ws: TenderWorkspace): IntelligenceRow[] {
  const tender = ws.tender as any;
  const td = typeDetails(ws);
  const identified = td.identified ?? {};
  const intake = identified.intake_file_audit ?? {};
  const documentReview = identified.document_review ?? {};
  const complianceNotes = identified.compliance_matrix_notes ?? {};
  const clarificationLog = rowsFrom(identified.clarification_log);
  const openClarifications = clarificationLog.filter((row: any) => row.status !== "answered" && row.status !== "closed").length;
  const complianceItems = ws.complianceItems ?? [];
  const reviewedCompliance = complianceItems.filter(item => item.status && item.status !== "not_reviewed").length;
  const complianceGaps = complianceItems.filter(item => item.status === "non_compliant" || item.status === "partial" || item.status === "clarification_required").length;
  const intakeCaptured = isCaptured(intake) || isCaptured(tender.title) || isCaptured(tender.submissionDeadline) || Number(tender.estimatedValue) > 0;
  const documentReviewRow = stageDocumentRow(ws, "identified", "Document Review");

  return [
    {
      stage: "identified",
      icon: ClipboardList,
      label: "Tender Intake",
      status: intakeCaptured ? labelize(tender.title, "Tender intake captured") : "Not captured",
      detail: compactDetail([
        tender.source ? `Source: ${tender.source}` : null,
        tender.submissionDeadline ? `Deadline: ${tender.submissionDeadline}` : null,
        tender.assignedOwner ? `Owner: ${tender.assignedOwner}` : null,
      ]),
      captured: intakeCaptured,
    },
    {
      ...documentReviewRow,
      status: isCaptured(documentReview)
        ? labelize(documentReview.review_status, "Review notes captured")
        : documentReviewRow.status,
      captured: isCaptured(documentReview) || documentReviewRow.captured,
    },
    {
      stage: "identified",
      icon: Shield,
      label: "Compliance Intake",
      status: complianceItems.length > 0 ? `${reviewedCompliance}/${complianceItems.length} reviewed` : labelize(complianceNotes.review_status),
      detail: complianceItems.length > 0 ? `${complianceGaps} gap${complianceGaps === 1 ? "" : "s"}` : undefined,
      captured: complianceItems.length > 0 || isCaptured(complianceNotes),
    },
    {
      stage: "identified",
      icon: Users,
      label: "Intake Clarifications",
      status: clarificationLog.length > 0 ? `${clarificationLog.length} question${clarificationLog.length === 1 ? "" : "s"}` : "No questions logged",
      detail: clarificationLog.length > 0 ? `${openClarifications} open` : undefined,
      captured: clarificationLog.length > 0,
    },
  ];
}

function buildQualificationRows(ws: TenderWorkspace): IntelligenceRow[] {
  const tender = ws.tender as any;
  const sowQ = tender.sowQualificationData as any;
  const techQ = tender.technicalQualificationData as any;
  const custF = tender.customerFitData as any;
  const riskS = tender.riskSnapshotData as any;
  const sowExists = isCaptured(sowQ);
  const techExists = isCaptured(techQ);
  const custExists = isCaptured(custF);
  const riskExists = isCaptured(riskS);
  const sowCoverage = sowExists ? countAssessedRows(sowQ, "coverage_matrix", "status", "Not Assessed") : { assessed: 0, total: 0 };
  const techCapability = techExists ? countAssessedRows(techQ, "capability_assessment", "fit", "Not Assessed") : { assessed: 0, total: 0 };
  const custDimensions = custExists ? countAssessedRows(custF, "dimensions", "assessment", "Not Assessed") : { assessed: 0, total: 0 };
  const riskRows = rowsFrom(riskS?.register).length > 0 ? rowsFrom(riskS?.register) : rowsFrom(riskS?.risk_rows);
  const bidBlockers = riskRows.filter((row: any) => row.bid_blocker === true || row.risk_level === "Critical" || row.risk_level === "Very High").length;

  return [
    {
      stage: "qualification",
      icon: ClipboardList,
      label: "SOW Qualification",
      status: sowExists ? extractStatus(sowQ) : "Not captured",
      detail: sowExists ? `${sowCoverage.assessed}/${sowCoverage.total} areas assessed - ${countItems(sowQ, "clarifications")} clarifications` : undefined,
      captured: sowExists,
    },
    {
      stage: "qualification",
      icon: Target,
      label: "Technical Qualification",
      status: techExists ? extractStatus(techQ) : "Not captured",
      detail: techExists ? `${techCapability.assessed}/${techCapability.total} assessed - ${countItems(techQ, "gaps")} gaps` : undefined,
      captured: techExists,
    },
    {
      stage: "qualification",
      icon: Users,
      label: "Customer Fit",
      status: custExists ? extractStatus(custF) : "Not captured",
      detail: custExists ? `${custDimensions.assessed}/${custDimensions.total} dimensions assessed` : undefined,
      captured: custExists,
    },
    {
      stage: "qualification",
      icon: Shield,
      label: "Risk Snapshot",
      status: riskExists ? extractStatus(riskS) : "Not captured",
      detail: riskExists ? `${riskRows.length} risks - ${bidBlockers} bid blockers - ${countItems(riskS, "clarifications")} clarifications` : undefined,
      captured: riskExists,
    },
  ];
}

function buildBidRows(ws: TenderWorkspace): IntelligenceRow[] {
  const bnb = (ws.tender as any).bidNoBidData as any;
  const bnbExists = isCaptured(bnb);
  const bidDecision = bnbExists
    ? (bnb.decision?.decision || bnb.bid_decision?.decision || bnb.decision_record?.formal?.decision || "Not decided")
    : "Not captured";
  const winThemes = rowsFrom(bnb?.win_strategy?.win_themes);
  const resourceRows = rowsFrom(bnb?.resource_commitment?.rows);
  const resources = resourceRows.filter((row: any) => row?.resource || row?.owner || (row?.status && row.status !== "Not Assessed")).length;
  const decisionRecord = bnb?.decision_record;

  return [
    {
      stage: "bid_no_bid",
      icon: CheckCircle2,
      label: "Bid / No-Bid Decision",
      status: bidDecision,
      detail: bnbExists ? `Decision: ${bidDecision}` : undefined,
      captured: bnbExists,
    },
    {
      stage: "bid_no_bid",
      icon: Target,
      label: "Win Strategy",
      status: winThemes.length > 0 ? `${winThemes.length} win themes` : "Not captured",
      detail: winThemes.length > 0 ? `${winThemes.length} themes captured` : undefined,
      captured: isCaptured(bnb?.win_strategy),
    },
    {
      stage: "bid_no_bid",
      icon: Users,
      label: "Resource Commitment",
      status: resources > 0 ? `${resources} commitment${resources === 1 ? "" : "s"}` : "Not captured",
      detail: labelize(bnb?.resource_commitment?.recommendation?.recommendation, ""),
      captured: isCaptured(bnb?.resource_commitment),
    },
    {
      stage: "bid_no_bid",
      icon: FileText,
      label: "Decision Record",
      status: isCaptured(decisionRecord) ? "Recorded" : "Not captured",
      detail: labelize(decisionRecord?.formal?.decision || decisionRecord?.decision, ""),
      captured: isCaptured(decisionRecord),
    },
  ];
}

function buildSolutionRows(ws: TenderWorkspace): IntelligenceRow[] {
  const sd = ((ws.tender as any).solutionDesignData ?? {}) as any;
  const scopeRows = rowsFrom(sd.scope_matrix);
  const assumptions = sd.assumptions_dependencies ?? {};

  return [
    {
      stage: "solution_design",
      icon: ClipboardList,
      label: "Solution Configuration",
      status: isCaptured(sd.configuration) ? labelize(sd.configuration?.selected_modules, "Captured") : "Not captured",
      detail: compactDetail([sd.configuration?.operating_model, sd.configuration?.pallet_volume ? `${sd.configuration.pallet_volume} pallets` : null]),
      captured: isCaptured(sd.configuration),
    },
    {
      stage: "solution_design",
      icon: Target,
      label: "HOP Operations Model",
      status: isCaptured(sd.hop) ? "Captured" : "Not captured",
      detail: compactDetail([sd.hop?.warehouse?.storage_capacity ? `${sd.hop.warehouse.storage_capacity} capacity` : null, sd.hop?.operations_model]),
      captured: isCaptured(sd.hop),
    },
    {
      stage: "solution_design",
      icon: Users,
      label: "HAM Manpower Model",
      status: isCaptured(sd.ham) ? "Captured" : "Not captured",
      detail: compactDetail([sd.ham?.total_headcount ? `${sd.ham.total_headcount} headcount` : null, sd.ham?.shift_model]),
      captured: isCaptured(sd.ham),
    },
    {
      stage: "solution_design",
      icon: Shield,
      label: "HIP Systems & IP",
      status: isCaptured(sd.hip) ? "Captured" : "Not captured",
      detail: compactDetail([sd.hip?.systems_required, sd.hip?.integration_scope]),
      captured: isCaptured(sd.hip),
    },
    {
      stage: "solution_design",
      icon: ClipboardList,
      label: "Scope Matrix",
      status: scopeRows.length > 0 ? `${scopeRows.length} scope item${scopeRows.length === 1 ? "" : "s"}` : "Not captured",
      captured: scopeRows.length > 0 || isCaptured(sd.scope_matrix),
    },
    {
      stage: "solution_design",
      icon: Target,
      label: "SLA / KPI Model",
      status: isCaptured(sd.sla_kpi) ? "Captured" : "Not captured",
      detail: compactDetail([rowsFrom(sd.sla_kpi?.kpis).length ? `${rowsFrom(sd.sla_kpi?.kpis).length} KPIs` : null, sd.sla_kpi?.sla_model]),
      captured: isCaptured(sd.sla_kpi),
    },
    {
      stage: "solution_design",
      icon: FileText,
      label: "Assumptions & Dependencies",
      status: isCaptured(assumptions) ? "Captured" : "Not captured",
      detail: compactDetail([
        rowsFrom(assumptions.assumptions).length ? `${rowsFrom(assumptions.assumptions).length} assumptions` : null,
        rowsFrom(assumptions.clarifications).length ? `${rowsFrom(assumptions.clarifications).length} clarifications` : null,
      ]),
      captured: isCaptured(assumptions),
    },
  ];
}

function buildPricingRows(ws: TenderWorkspace): IntelligenceRow[] {
  const pricing = normalizeTenderPricingData((ws.tender as any).pricingData);
  const snapshotCaptured = isCaptured(pricing.pnl_snapshot.linked_pnl_record_id) || pricing.pnl_snapshot.snapshot_status !== "No Snapshot";
  const commercialTermsCaptured = isCaptured(pricing.commercial_terms);
  const approvalCaptured = pricing.approval.summary.approval_status !== "Not Submitted" ||
    pricing.approval.approval_chain.length > 0 ||
    pricing.approval.conditions.length > 0;

  return [
    {
      stage: "pnl_pricing",
      icon: Target,
      label: "P&L Snapshot",
      status: snapshotCaptured ? pricing.pnl_snapshot.snapshot_status : "Not captured",
      detail: compactDetail([pricing.pnl_snapshot.gp_percent ? `GP ${pricing.pnl_snapshot.gp_percent}%` : null, pricing.pnl_snapshot.linked_pnl_record_id]),
      captured: hasPricingData((ws.tender as any).pricingData) && snapshotCaptured,
    },
    {
      stage: "pnl_pricing",
      icon: ClipboardList,
      label: "Pricing Scenarios",
      status: `${pricing.scenarios.rows.length} scenario${pricing.scenarios.rows.length === 1 ? "" : "s"}`,
      detail: pricing.scenarios.selected_scenario.selected_scenario_name || undefined,
      captured: pricing.scenarios.rows.length > 0,
    },
    {
      stage: "pnl_pricing",
      icon: FileText,
      label: "Commercial Terms",
      status: commercialTermsCaptured ? labelize(pricing.commercial_terms.payment_tax_validity.payment_terms, "Captured") : "Not captured",
      detail: compactDetail([
        rowsFrom(pricing.commercial_terms.assumptions).length ? `${rowsFrom(pricing.commercial_terms.assumptions).length} assumptions` : null,
        rowsFrom(pricing.commercial_terms.exclusions).length ? `${rowsFrom(pricing.commercial_terms.exclusions).length} exclusions` : null,
      ]),
      captured: commercialTermsCaptured,
    },
    {
      stage: "pnl_pricing",
      icon: CheckCircle2,
      label: "Pricing Approval",
      status: pricing.approval.summary.approval_status,
      detail: compactDetail([
        pricing.approval.approval_chain.length ? `${pricing.approval.approval_chain.length} approvers` : null,
        pricing.approval.conditions.length ? `${pricing.approval.conditions.length} conditions` : null,
      ]),
      captured: approvalCaptured,
    },
  ];
}

function buildDraftingRows(ws: TenderWorkspace): IntelligenceRow[] {
  const drafting = (((ws.tender as any).tenderDraftingData ?? {}) as any);
  const blocks = rowsFrom(drafting.proposal_blocks);
  const approvedBlocks = blocks.filter((block: any) => block.approval_status === "Approved" || block.approval_status === "Locked").length;
  const appendicesRow = stageDocumentRow(ws, "tender_drafting", "Appendices & Evidence");

  return [
    {
      stage: "tender_drafting",
      icon: ClipboardList,
      label: "Proposal Architecture / TOC",
      status: isCaptured(drafting.proposal_architecture) ? labelize(drafting.proposal_architecture?.status, "Captured") : "Not captured",
      captured: isCaptured(drafting.proposal_architecture),
    },
    {
      stage: "tender_drafting",
      icon: FileText,
      label: "Proposal Blocks",
      status: blocks.length > 0 ? `${blocks.length} block${blocks.length === 1 ? "" : "s"}` : "No blocks",
      detail: blocks.length > 0 ? `${approvedBlocks} approved` : undefined,
      captured: blocks.length > 0,
    },
    {
      stage: "tender_drafting",
      icon: Target,
      label: "Technical Volume",
      status: isCaptured(drafting.technical_volume) ? "Captured" : "Not captured",
      captured: isCaptured(drafting.technical_volume),
    },
    {
      stage: "tender_drafting",
      icon: Target,
      label: "Commercial Volume",
      status: isCaptured(drafting.commercial_volume) ? "Captured" : "Not captured",
      captured: isCaptured(drafting.commercial_volume),
    },
    {
      stage: "tender_drafting",
      icon: Shield,
      label: "Compliance Coverage",
      status: isCaptured(drafting.compliance_coverage) ? "Captured" : "Not captured",
      detail: rowsFrom(drafting.compliance_coverage?.requirements).length ? `${rowsFrom(drafting.compliance_coverage?.requirements).length} requirements` : undefined,
      captured: isCaptured(drafting.compliance_coverage),
    },
    {
      ...appendicesRow,
      captured: appendicesRow.captured || isCaptured(drafting.appendices_evidence),
    },
  ];
}

function buildLaterStageRows(ws: TenderWorkspace): IntelligenceRow[] {
  const td = typeDetails(ws);
  const drafting = (((ws.tender as any).tenderDraftingData ?? {}) as any);
  const blocks = rowsFrom(drafting.proposal_blocks);
  // TCW-T4 (P6): derived from the per-block `<dept>_status` decisions that ARE
  // written — the `departmental_reviews` facet this read previously checked has
  // no writer, so "N/3 submitted" could never become true.
  const reviewProgress = deriveDepartmentalReviewProgress(blocks);
  const fullyReviewedDepts = reviewProgress.fullyReviewed.length;
  const rejectedReviews = reviewProgress.rejectedCount;
  // TCW-T4: the Stage-8 component writes CANONICAL type_details.approval_matrix
  // (legacy tender_drafting.approval_matrix remains readable) — resolve via the
  // canonical-with-legacy stage-truth projection instead of legacy-only.
  const approvalRows = rowsFrom((projectTenderStageTruth(td).approval_matrix as any)?.approvals);
  const approvedRows = approvalRows.filter((row: any) => row.decision === "approved").length;
  const finalCheck = drafting.final_approval_check ?? {};
  const submission = td.submission ?? {};
  const clarification = td.clarification ?? {};
  const clientEvaluation = td.client_evaluation ?? {};
  const negotiation = td.negotiation_data ?? {};
  const awarded = td.awarded_data ?? {};
  const lostWithdrawn = td.lost_withdrawn_data ?? {};
  const qaLog = rowsFrom(clarification.qa_log);
  const clientRequests = rowsFrom(clientEvaluation.request_log);
  const clientClarifications = rowsFrom(clientEvaluation.client_clarifications);
  const negotiationLog = rowsFrom(negotiation.negotiation_log);
  const requestedChanges = rowsFrom(negotiation.requested_changes);

  return [
    {
      stage: "internal_review",
      icon: CheckCircle2,
      label: "Department Reviews",
      status: fullyReviewedDepts > 0
        ? `${fullyReviewedDepts}/3 fully reviewed`
        : reviewProgress.anyDecision
          ? "Review in progress"
          : "Not captured",
      detail: rejectedReviews > 0 ? `${rejectedReviews} rejected review item${rejectedReviews === 1 ? "" : "s"}` : undefined,
      captured: reviewProgress.anyDecision,
    },
    {
      stage: "approval_matrix",
      icon: Shield,
      label: "Approval Matrix",
      status: approvalRows.length > 0 ? `${approvedRows}/${approvalRows.length} approved` : "Not captured",
      detail: approvalRows.some((row: any) => row.decision === "rejected") ? "Rejected approval exists" : undefined,
      captured: approvalRows.length > 0,
    },
    {
      stage: "final_approved",
      icon: CheckCircle2,
      label: "Final Approval Readiness",
      status: isCaptured(finalCheck) ? labelize(finalCheck.status, "Captured") : "Not captured",
      detail: finalCheck.ready_for_final_pack === true ? "Ready for final pack" : undefined,
      captured: isCaptured(finalCheck),
    },
    {
      stage: "submitted",
      icon: FileText,
      label: "Submission Record",
      status: isCaptured(submission.submission_record) ? "Recorded" : "Not captured",
      detail: compactDetail([
        submission.submission_record?.submitted_at,
        submission.submission_record?.receipt_confirmed === true ? "receipt confirmed" : null,
      ]),
      captured: isCaptured(submission.submission_record),
    },
    {
      stage: "clarification",
      icon: Users,
      label: "Clarification Q&A",
      status: qaLog.length > 0 ? `${qaLog.length} question${qaLog.length === 1 ? "" : "s"}` : "Not captured",
      detail: isCaptured(clarification.response) ? `Response: ${labelize(clarification.response?.response_status, "captured")}` : undefined,
      captured: qaLog.length > 0 || isCaptured(clarification.response),
    },
    {
      stage: "client_evaluation",
      icon: Target,
      label: "Client Evaluation",
      status: clientRequests.length > 0 || clientClarifications.length > 0
        ? `${clientRequests.length} requests / ${clientClarifications.length} clarifications`
        : labelize(clientEvaluation.evaluation_status?.overall_status),
      detail: clientEvaluation.bafo?.bafo_status ? `BAFO: ${labelize(clientEvaluation.bafo.bafo_status)}` : undefined,
      captured: clientRequests.length > 0 || clientClarifications.length > 0 || isCaptured(clientEvaluation.bafo) || isCaptured(clientEvaluation.evaluation_status),
    },
    {
      stage: "negotiation",
      icon: ClipboardList,
      label: "Negotiation",
      status: negotiationLog.length > 0 ? `${negotiationLog.length} meeting${negotiationLog.length === 1 ? "" : "s"}` : "Not captured",
      detail: requestedChanges.length > 0 ? `${requestedChanges.length} requested change${requestedChanges.length === 1 ? "" : "s"}` : undefined,
      captured: negotiationLog.length > 0 || requestedChanges.length > 0 || isCaptured(negotiation.margin_impact) || isCaptured(negotiation.revised_terms),
    },
    {
      stage: "awarded",
      icon: CheckCircle2,
      label: "Award & Handover",
      status: isCaptured(awarded.award_notice) ? "Award notice captured" : "Not captured",
      detail: compactDetail([
        awarded.contract_prep?.contract_status ? `Contract: ${labelize(awarded.contract_prep.contract_status)}` : null,
        awarded.sla_prep?.sla_status ? `SLA: ${labelize(awarded.sla_prep.sla_status)}` : null,
      ]),
      captured: isCaptured(awarded),
    },
    {
      stage: "lost_withdrawn",
      icon: AlertCircle,
      label: "Loss / Withdrawal Record",
      status: isCaptured(lostWithdrawn.loss_reason) ? labelize(lostWithdrawn.loss_reason?.primary_reason, "Captured") : "Not captured",
      detail: rowsFrom(lostWithdrawn.lessons_learned?.lessons).length ? `${rowsFrom(lostWithdrawn.lessons_learned.lessons).length} lessons` : undefined,
      captured: isCaptured(lostWithdrawn),
    },
  ];
}

function buildStageRows(ws: TenderWorkspace): IntelligenceRow[] {
  return [
    ...buildIdentifiedRows(ws),
    ...buildQualificationRows(ws),
    ...buildBidRows(ws),
    ...buildSolutionRows(ws),
    ...buildPricingRows(ws),
    ...buildDraftingRows(ws),
    ...buildLaterStageRows(ws),
  ];
}

function filterPreviousRows(rows: IntelligenceRow[], ws: TenderWorkspace, currentStage?: string): IntelligenceRow[] {
  const activeStage = normalizeStage(currentStage) ?? normalizeStage((ws.tender as any).status);
  if (!activeStage) return rows;
  const activeIndex = STAGE_ORDER.indexOf(activeStage);
  if (activeIndex <= 0) return [];
  return rows.filter(row => STAGE_ORDER.indexOf(row.stage) >= 0 && STAGE_ORDER.indexOf(row.stage) < activeIndex);
}

export function PreviousStageIntelligenceContent({ ws, currentStage }: Props) {
  const rows = filterPreviousRows(buildStageRows(ws), ws, currentStage);
  const activeStage = normalizeStage(currentStage) ?? normalizeStage((ws.tender as any).status);
  const capturedCount = rows.filter(row => row.captured).length;

  return (
    <div className="rounded-md border border-border bg-muted/10 p-3">
      <div className="flex items-start gap-2 border-b border-border pb-2">
        <Brain className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#075eea]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">Previous Stage Intelligence</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Actual saved tender data from earlier process stages. Informational only.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[8px]">
          {capturedCount}/{rows.length} captured
        </Badge>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-border bg-card px-3 py-4 text-center">
          <p className="text-xs font-medium text-foreground">
            {activeStage === "identified"
              ? "Identified is the first tracker stage."
              : "No earlier stage intelligence is available yet."}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {activeStage === "identified"
              ? "Stage-specific data captured here will become previous-stage intelligence for Qualification and later stages."
              : "Save data in earlier stage tabs to populate this panel."}
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map(row => (
            <div key={`${row.stage}-${row.label}`} className="min-w-0 rounded-md border border-border bg-card p-2.5">
              <div className="flex items-start gap-2">
                <row.icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${row.captured ? "text-[#0b73ff]" : "text-muted-foreground/40"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold">{row.label}</span>
                    {row.captured ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 shrink-0 text-amber-400" />
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    {STAGE_LABELS[row.stage]}
                  </p>
                  <p className={`mt-0.5 truncate text-[10px] ${row.captured ? "text-foreground/70" : "text-muted-foreground"}`}>
                    {row.status}
                  </p>
                  {row.detail && <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{row.detail}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PreviousStageIntelligence({ ws, currentStage }: Props) {
  return <PreviousStageIntelligenceContent ws={ws} currentStage={currentStage} />;
}
