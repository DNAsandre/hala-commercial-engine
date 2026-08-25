/**
 * Canonical Tender destination manifest (PADW T01).
 *
 * Derived from the 15 live stage routers, their editable component state,
 * and the write targets in supabase-tender-actions.ts. Paths are rooted at
 * commercial_tickets.type_details. Ticket columns (including both trackers),
 * generated row ids, AI-review data, and read-only projections are excluded.
 */
import type {
  FieldDescriptor,
  FieldType,
  ProcessManifest,
  RowIdentitySpec,
} from "./manifest-types";

const T = "tender" as const;

interface Spec {
  key: string;
  label?: string;
  type?: FieldType;
  unit?: string;
  enumValues?: readonly string[];
  nullBehavior?: FieldDescriptor["nullBehavior"];
  evidence?: FieldDescriptor["evidence"];
  pdfConsumer?: FieldDescriptor["pdfConsumer"];
  notes?: string;
}

interface GroupOptions {
  stage: string;
  tab: string;
  uiOwner: string;
  basePath: string;
  rowIdentity?: RowIdentitySpec;
  collectionLabel?: string;
  collectionType?: FieldType;
  notes?: string;
  emitCollection?: boolean;
}

const s = (key: string, rest: Omit<Spec, "key"> = {}): Spec => ({ key, ...rest });

function humanize(key: string): string {
  const value = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function defaultNull(type: FieldType): FieldDescriptor["nullBehavior"] {
  return ["number", "integer", "currency", "percent", "boolean"].includes(type)
    ? "default"
    : "empty_string";
}

function group(options: GroupOptions, leaves: readonly Spec[]): FieldDescriptor[] {
  const repeated = options.basePath.includes("[]");
  if (repeated && !options.rowIdentity) {
    throw new Error(`Repeated destination ${options.basePath} requires rowIdentity`);
  }
  const topFacet = options.basePath.split(".")[0].replace("[]", "");
  const sanitizer = `tenderFacet:${topFacet}`;
  const result: FieldDescriptor[] = [];

  if (options.basePath.endsWith("[]") && options.emitCollection !== false) {
    result.push({
      id: `t:${options.basePath}`,
      process: T,
      stage: options.stage,
      tab: options.tab,
      label: options.collectionLabel ?? humanize(options.basePath.split(".").pop()!.replace("[]", "")),
      type: options.collectionType ?? "object",
      nullBehavior: "omit",
      sanitizer,
      persistencePath: options.basePath,
      uiOwner: options.uiOwner,
      rowIdentity: options.rowIdentity,
      evidence: "sidecar",
      pdfConsumer: "not_exported",
      notes: options.notes ?? "Whole-row upsert target; stable identity comes from rowIdentity, never a generated id.",
    });
  }

  for (const leaf of leaves) {
    const type = leaf.type ?? "text";
    const path = `${options.basePath}.${leaf.key}`;
    result.push({
      id: `t:${path}`,
      process: T,
      stage: options.stage,
      tab: options.tab,
      label: leaf.label ?? humanize(leaf.key),
      type,
      ...(leaf.unit ? { unit: leaf.unit } : {}),
      ...(leaf.enumValues ? { enumValues: leaf.enumValues } : {}),
      nullBehavior: leaf.nullBehavior ?? defaultNull(type),
      sanitizer,
      persistencePath: path,
      uiOwner: options.uiOwner,
      ...(repeated ? { rowIdentity: options.rowIdentity } : {}),
      evidence: leaf.evidence ?? "sidecar",
      pdfConsumer: leaf.pdfConsumer ?? "not_exported",
      ...(leaf.notes ? { notes: leaf.notes } : {}),
    });
  }
  return result;
}

function primitiveCollection(options: GroupOptions): FieldDescriptor[] {
  return group({ ...options, collectionType: "array" }, []);
}

const owner = (name: string) => `src/components/tender/${name}`;

// Stage 1 - Identified
const IDENTIFIED: FieldDescriptor[] = [
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data" }, [
    s("scope_summary", { type: "richtext" }), s("assumptions", { type: "richtext" }),
    s("exclusions", { type: "richtext" }), s("internal_notes", { type: "richtext" }),
  ]),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.service_lines[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Service line" }),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.warehousing" }, [
    s("capacity_value", { type: "number" }), s("capacity_unit"), s("notes", { type: "richtext" }),
  ]),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.warehousing.storage_types[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Storage type" }),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.warehousing.activities[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Warehouse activity" }),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.transport" }, [s("required", { type: "boolean" })]),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.transport.models[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Transport model" }),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.transport.vehicle_types[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Vehicle type" }),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.transport.lanes[]", rowIdentity: { fingerprintFields: ["origin", "destination", "frequency"] }, collectionLabel: "Transport lane" },
    ["origin", "destination", "frequency", "estimated_trips", "sla_requirement", "special_handling", "notes"].map(key => s(key))),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.technology" }, [s("integration_notes", { type: "richtext" })]),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.technology.systems[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Technology system" }),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.sla_kpis[]", rowIdentity: { fingerprintFields: ["name"] }, collectionLabel: "SLA / KPI" },
    ["name", "target", "measurement_tool", "source", "hala_response", "notes"].map(key => s(key))),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.execution_regions[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Execution region" }),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.sites[]", rowIdentity: { fingerprintFields: ["site_name", "city", "address"] }, collectionLabel: "Site" },
    ["region", "city", "site_name", "site_type", "address", "notes"].map(key => s(key))),
  ...primitiveCollection({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.compliance.requirements[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Compliance requirement" }),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.compliance" }, [s("notes", { type: "richtext" })]),
  ...group({ stage: "identified", tab: "Customer Snapshot", uiOwner: owner("ScopeOfWorkCapture.tsx"), basePath: "sow_data.clarifications[]", rowIdentity: { fingerprintFields: ["question", "source_reference"] }, collectionLabel: "SOW clarification" },
    ["question", "source_reference", "status", "buyer_response"].map(key => s(key))),
  ...primitiveCollection({ stage: "identified", tab: "Intake & File Audit", uiOwner: owner("IntakeFileAuditTab.tsx"), basePath: "identified.intake_file_audit.received_files[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Received file" }),
  ...primitiveCollection({ stage: "identified", tab: "Intake & File Audit", uiOwner: owner("IntakeFileAuditTab.tsx"), basePath: "identified.intake_file_audit.missing_intake_items[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Missing intake item" }),
  ...group({ stage: "identified", tab: "Intake & File Audit", uiOwner: owner("IntakeFileAuditTab.tsx"), basePath: "identified.intake_file_audit" },
    ["source_channel", "buyer_reference", "deadline_status", "tender_owner", "initial_notes"].map(key => s(key))),
  ...group({ stage: "identified", tab: "Document Review", uiOwner: owner("TenderDocumentReviewTab.tsx"), basePath: "identified.document_review" }, [
    s("review_status"), s("reviewer"), s("review_date", { type: "date" }), s("key_obligations", { type: "richtext" }),
    s("missing_documents", { type: "richtext" }), s("review_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "identified", tab: "Compliance Matrix", uiOwner: owner("IdentifiedComplianceMatrixTab.tsx"), basePath: "identified.compliance_matrix_notes" }, [
    s("review_status"), s("owner"), s("review_date", { type: "date" }), s("risk_summary", { type: "richtext" }), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "identified", tab: "Clarification Log", uiOwner: owner("IdentifiedClarificationLogTab.tsx"), basePath: "identified.clarification_log[]", rowIdentity: { fingerprintFields: ["question", "source_reference", "due_date"] }, collectionLabel: "Clarification question" }, [
    s("question"), s("source_reference"), s("category"), s("owner"), s("due_date", { type: "date" }), s("status"),
    s("submitted_to_client", { type: "boolean", evidence: "none" }), s("response_received", { type: "boolean", evidence: "none" }), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "identified", tab: "Clarification Log", uiOwner: owner("IdentifiedClarificationLogTab.tsx"), basePath: "identified" }, [s("clarification_log_notes", { type: "richtext" })]),
  ...group({ stage: "identified", tab: "Documents", uiOwner: owner("TenderDocumentModal.tsx"), basePath: "documents[]", rowIdentity: { fingerprintFields: ["document_name", "storage_path", "version"] }, collectionLabel: "Tender document" }, [
    s("document_name"), s("document_category"), s("document_type"), s("file_url"), s("storage_path"), s("version"), s("status"),
    s("owner"), s("received_date", { type: "date" }), s("expiry_date", { type: "date" }), s("required_for_submission", { type: "boolean" }),
    s("linked_requirement_id", { type: "id_ref" }), s("linked_proposal_section"), s("source_channel"), s("buyer_reference_number"), s("notes", { type: "richtext" }),
    s("source_role"), s("orchestration_included", { type: "boolean", notes: "Document inclusion metadata only; no orchestration is activated by this manifest." }),
    s("extraction_readiness"), s("primary_source", { type: "boolean" }),
  ]),
  ...primitiveCollection({ stage: "identified", tab: "Documents", uiOwner: owner("TenderDocumentModal.tsx"), basePath: "documents[].stage_relevance[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Document stage relevance" }),
];

// Stage 2 - Qualification
const QUALIFICATION: FieldDescriptor[] = [
  ...group({ stage: "qualification", tab: "SOW Qualification", uiOwner: owner("SowQualification.tsx"), basePath: "sow_qualification_data.coverage_matrix[]", rowIdentity: { fingerprintFields: ["area"] }, collectionLabel: "SOW coverage row" }, [
    s("area"), s("status"), s("evidence"), s("owner"), s("risk"), s("clarification_needed", { type: "boolean" }),
  ]),
  ...group({ stage: "qualification", tab: "SOW Qualification", uiOwner: owner("SowQualification.tsx"), basePath: "sow_qualification_data.clarity_assessment" },
    ["scope_clarity", "volume_clarity", "submission_instruction_clarity", "pricing_format_clarity", "mobilization_clarity"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "SOW Qualification", uiOwner: owner("SowQualification.tsx"), basePath: "sow_qualification_data.clarifications[]", rowIdentity: { fingerprintFields: ["question", "source_reference"] }, collectionLabel: "Qualification clarification" },
    ["question", "sow_area", "source_reference", "impact", "owner", "status", "buyer_response"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "SOW Qualification", uiOwner: owner("SowQualification.tsx"), basePath: "sow_qualification_data.outcome" }, [s("recommendation"), s("reason", { type: "richtext" })]),
  ...group({ stage: "qualification", tab: "Technical Qualification", uiOwner: owner("TechnicalQualification.tsx"), basePath: "technical_qualification_data.capability_assessment[]", rowIdentity: { fingerprintFields: ["area", "question"] }, collectionLabel: "Capability assessment" },
    ["area", "question", "fit", "evidence", "gap_or_concern", "owner", "status"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Technical Qualification", uiOwner: owner("TechnicalQualification.tsx"), basePath: "technical_qualification_data.gaps[]", rowIdentity: { fingerprintFields: ["gap", "category"] }, collectionLabel: "Technical gap" },
    ["gap", "category", "severity", "evidence", "required_action", "owner", "status"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Technical Qualification", uiOwner: owner("TechnicalQualification.tsx"), basePath: "technical_qualification_data.clarifications[]", rowIdentity: { fingerprintFields: ["question", "source_reference"] }, collectionLabel: "Technical clarification" },
    ["question", "related_area", "source_reference", "impact", "owner", "status", "buyer_response"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Technical Qualification", uiOwner: owner("TechnicalQualification.tsx"), basePath: "technical_qualification_data.recommendation" }, [s("outcome"), s("reason", { type: "richtext" }), s("reviewer")]),
  ...group({ stage: "qualification", tab: "Customer Fit", uiOwner: owner("CustomerFitQualification.tsx"), basePath: "customer_fit_data.customer_snapshot" },
    ["customer_name", "source", "crm_reference", "existing_customer_status", "linked_opportunity", "owner", "estimated_value", "region", "win_probability", "notes"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Customer Fit", uiOwner: owner("CustomerFitQualification.tsx"), basePath: "customer_fit_data.dimensions[]", rowIdentity: { fingerprintFields: ["dimension", "question"] }, collectionLabel: "Customer-fit dimension" },
    ["dimension", "question", "assessment", "evidence", "gap_or_concern", "owner", "status"].map(key => s(key))),
  ...primitiveCollection({ stage: "qualification", tab: "Customer Fit", uiOwner: owner("CustomerFitQualification.tsx"), basePath: "customer_fit_data.dimensions[].selected_values[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Selected fit value" }),
  ...group({ stage: "qualification", tab: "Customer Fit", uiOwner: owner("CustomerFitQualification.tsx"), basePath: "customer_fit_data.evidence[]", rowIdentity: { fingerprintFields: ["evidence_type", "description", "source"] }, collectionLabel: "Customer-fit evidence" },
    ["evidence_type", "description", "source", "attachment_ref", "owner", "status"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Customer Fit", uiOwner: owner("CustomerFitQualification.tsx"), basePath: "customer_fit_data.gaps[]", rowIdentity: { fingerprintFields: ["gap_question", "required_by"] }, collectionLabel: "Customer-fit gap" },
    ["gap_question", "impact", "owner", "required_by", "status"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Customer Fit", uiOwner: owner("CustomerFitQualification.tsx"), basePath: "customer_fit_data.recommendation" }, [s("outcome"), s("reason", { type: "richtext" }), s("reviewer")]),
  ...group({ stage: "qualification", tab: "Risk Snapshot", uiOwner: owner("RiskSnapshot.tsx"), basePath: "risk_snapshot_data.register[]", rowIdentity: { fingerprintFields: ["title", "category"] }, collectionLabel: "Risk" }, [
    s("title"), s("category"), s("severity"), s("evidence"), s("recommended_action"), s("owner"), s("status"), s("bid_blocker", { type: "boolean" }),
  ]),
  ...group({ stage: "qualification", tab: "Risk Snapshot", uiOwner: owner("RiskSnapshot.tsx"), basePath: "risk_snapshot_data.assessment" },
    ["scope_risk", "deadline_risk", "commercial_risk", "technical_risk", "submission_risk", "compliance_risk", "resource_risk", "contractual_risk"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Risk Snapshot", uiOwner: owner("RiskSnapshot.tsx"), basePath: "risk_snapshot_data.mitigation_actions[]", rowIdentity: { fingerprintFields: ["action", "related_risk"] }, collectionLabel: "Mitigation action" },
    ["action", "related_risk", "owner", "due_date", "status", "notes"].map(key => s(key, key === "due_date" ? { type: "date" } : {}))),
  ...group({ stage: "qualification", tab: "Risk Snapshot", uiOwner: owner("RiskSnapshot.tsx"), basePath: "risk_snapshot_data.clarifications[]", rowIdentity: { fingerprintFields: ["question", "source_reference"] }, collectionLabel: "Risk clarification" },
    ["question", "related_risk", "source_reference", "impact", "owner", "status", "buyer_response"].map(key => s(key))),
  ...group({ stage: "qualification", tab: "Risk Snapshot", uiOwner: owner("RiskSnapshot.tsx"), basePath: "risk_snapshot_data.recommendation" }, [s("outcome"), s("reason", { type: "richtext" }), s("reviewer")]),
];

// Stage 3 - Bid / No-Bid
const BID_NO_BID: FieldDescriptor[] = [
  ...group({ stage: "bid_no_bid", tab: "Bid Decision", uiOwner: owner("BidDecisionTab.tsx"), basePath: "bid_no_bid_data.decision" },
    ["decision", "decision_owner", "decision_date", "approval_required", "executive_approval", "decision_reason"].map(key => s(key, key === "decision_date" ? { type: "date" } : {}))),
  ...group({ stage: "bid_no_bid", tab: "Bid Decision", uiOwner: owner("BidDecisionTab.tsx"), basePath: "bid_no_bid_data.decision_checklist[]", rowIdentity: { fingerprintFields: ["question"] }, collectionLabel: "Decision checklist item" },
    ["question", "status", "evidence", "owner"].map(key => s(key))),
  ...group({ stage: "bid_no_bid", tab: "Bid Decision", uiOwner: owner("BidDecisionTab.tsx"), basePath: "bid_no_bid_data.recommendation" }, [s("next_step"), s("conditions", { type: "richtext" })]),
  ...group({ stage: "bid_no_bid", tab: "Win Strategy", uiOwner: owner("WinStrategyTab.tsx"), basePath: "bid_no_bid_data.win_strategy.rationale" },
    ["why_bid", "why_win", "client_values"].map(key => s(key, { type: "richtext" }))),
  ...group({ stage: "bid_no_bid", tab: "Win Strategy", uiOwner: owner("WinStrategyTab.tsx"), basePath: "bid_no_bid_data.win_strategy.win_themes[]", rowIdentity: { fingerprintFields: ["theme", "buyer_need"] }, collectionLabel: "Win theme" },
    ["theme", "buyer_need", "hala_proof", "linked_criteria", "proposal_section", "owner", "status"].map(key => s(key))),
  ...group({ stage: "bid_no_bid", tab: "Win Strategy", uiOwner: owner("WinStrategyTab.tsx"), basePath: "bid_no_bid_data.win_strategy.differentiators[]", rowIdentity: { fingerprintFields: ["differentiator", "evidence"] }, collectionLabel: "Differentiator" },
    ["differentiator", "evidence", "where_to_use", "owner", "status"].map(key => s(key))),
  ...group({ stage: "bid_no_bid", tab: "Win Strategy", uiOwner: owner("WinStrategyTab.tsx"), basePath: "bid_no_bid_data.win_strategy.evaluation_alignment[]", rowIdentity: { fingerprintFields: ["criteria"] }, collectionLabel: "Evaluation alignment" },
    ["criteria", "weight", "response_strategy", "evidence_needed", "owner"].map(key => s(key))),
  ...group({ stage: "bid_no_bid", tab: "Resource Commitment", uiOwner: owner("ResourceCommitmentTab.tsx"), basePath: "bid_no_bid_data.resource_commitment.rows[]", rowIdentity: { fingerprintFields: ["resource"] }, collectionLabel: "Resource assessment" },
    ["resource", "status", "owner", "evidence", "due_date"].map(key => s(key, key === "due_date" ? { type: "date" } : {}))),
  ...group({ stage: "bid_no_bid", tab: "Resource Commitment", uiOwner: owner("ResourceCommitmentTab.tsx"), basePath: "bid_no_bid_data.resource_commitment.effort" },
    ["estimated_effort", "deadline_pressure", "can_submit_on_time", "proposal_complexity"].map(key => s(key))),
  ...group({ stage: "bid_no_bid", tab: "Resource Commitment", uiOwner: owner("ResourceCommitmentTab.tsx"), basePath: "bid_no_bid_data.resource_commitment.actions[]", rowIdentity: { fingerprintFields: ["action", "owner", "due_date"] }, collectionLabel: "Resource action" },
    ["action", "owner", "due_date", "status", "notes"].map(key => s(key, key === "due_date" ? { type: "date" } : {}))),
  ...group({ stage: "bid_no_bid", tab: "Resource Commitment", uiOwner: owner("ResourceCommitmentTab.tsx"), basePath: "bid_no_bid_data.resource_commitment.recommendation" }, [s("recommendation"), s("reason", { type: "richtext" })]),
  ...group({ stage: "bid_no_bid", tab: "Decision Record", uiOwner: owner("DecisionRecordTab.tsx"), basePath: "bid_no_bid_data.decision_record.formal" },
    ["decision", "decision_date", "decision_owner", "approver", "approval_status", "decision_summary", "conditions", "clarifications_required"].map(key => s(key, key === "decision_date" ? { type: "date" } : {}))),
  ...group({ stage: "bid_no_bid", tab: "Decision Record", uiOwner: owner("DecisionRecordTab.tsx"), basePath: "bid_no_bid_data.decision_record.if_bid" },
    ["approved_next_stage", "approved_to_commit", "proposal_authorized"].map(key => s(key))),
  ...group({ stage: "bid_no_bid", tab: "Decision Record", uiOwner: owner("DecisionRecordTab.tsx"), basePath: "bid_no_bid_data.decision_record.if_no_bid" }, [s("reason"), s("notes", { type: "richtext" })]),
  ...group({ stage: "bid_no_bid", tab: "Decision Record", uiOwner: owner("DecisionRecordTab.tsx"), basePath: "bid_no_bid_data.decision_record.evidence[]", rowIdentity: { fingerprintFields: ["evidence_type", "description", "source"] }, collectionLabel: "Decision evidence" },
    ["evidence_type", "description", "source", "document_reference", "owner"].map(key => s(key))),
];

// Stage 4 - Solution Design
const SOLUTION_DESIGN: FieldDescriptor[] = [
  ...group({ stage: "solution_design", tab: "Solution Configuration", uiOwner: owner("SolutionConfigurationTab.tsx"), basePath: "solution_design_data.configuration.customer_problem" }, [s("statement", { type: "richtext" }), s("evidence"), s("owner")]),
  ...group({ stage: "solution_design", tab: "Solution Configuration", uiOwner: owner("SolutionConfigurationTab.tsx"), basePath: "solution_design_data.configuration" },
    ["customer_operating_road", "selected_modules", "market_entry_mode", "solution_package", "deployment_type", "notes"].map(key => s(key))),
  ...primitiveCollection({ stage: "solution_design", tab: "Solution Configuration", uiOwner: owner("SolutionConfigurationTab.tsx"), basePath: "solution_design_data.configuration.customer_pain_categories[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Customer pain category" }),
  ...primitiveCollection({ stage: "solution_design", tab: "Solution Configuration", uiOwner: owner("SolutionConfigurationTab.tsx"), basePath: "solution_design_data.configuration.expansion_path[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Expansion path" }),
  ...group({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.warehouse" },
    ["storage_required", "storage_type", "capacity_value", "capacity_unit", "facility", "city", "region", "facility_ownership", "evidence", "notes"].map(key => s(key))),
  ...primitiveCollection({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.warehouse.activities[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Warehouse activity" }),
  ...group({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.transport" }, [s("transport_required")]),
  ...primitiveCollection({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.transport.transport_model[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Transport model" }),
  ...primitiveCollection({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.transport.vehicle_types[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Vehicle type" }),
  ...group({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.transport.lanes[]", rowIdentity: { fingerprintFields: ["origin", "destination", "frequency"] }, collectionLabel: "Operations lane" },
    ["origin", "destination", "frequency", "estimated_trips", "sla_requirement", "special_handling", "loading_responsibility", "offloading_responsibility", "permit_responsibility", "notes"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.operational_flow[]", rowIdentity: { fingerprintFields: ["process_step", "description"] }, collectionLabel: "Operational flow step" },
    ["process_step", "description", "hala_responsibility", "customer_responsibility", "system_used", "risk_dependency", "notes"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HOP Operations Model", uiOwner: owner("HOPOperationsModelTab.tsx"), basePath: "solution_design_data.hop.recommendation" }, [s("readiness"), s("notes", { type: "richtext" })]),
  ...group({ stage: "solution_design", tab: "HAM Manpower Model", uiOwner: owner("HAMManpowerModelTab.tsx"), basePath: "solution_design_data.ham.staffing[]", rowIdentity: { fingerprintFields: ["role", "department", "shift_coverage"] }, collectionLabel: "Staffing row" },
    ["role", "department", "quantity", "shift_coverage", "dedicated_shared", "required_from", "owner", "status", "notes"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HAM Manpower Model", uiOwner: owner("HAMManpowerModelTab.tsx"), basePath: "solution_design_data.ham.governance" },
    ["primary_account_owner", "operations_owner", "transport_owner", "warehouse_owner", "quality_owner", "hsse_owner", "it_owner", "escalation_owner", "customer_spoc_required"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HAM Manpower Model", uiOwner: owner("HAMManpowerModelTab.tsx"), basePath: "solution_design_data.ham.shift" },
    ["operating_days", "operating_hours", "shift_model", "emergency_support"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HAM Manpower Model", uiOwner: owner("HAMManpowerModelTab.tsx"), basePath: "solution_design_data.ham.mobilization[]", rowIdentity: { fingerprintFields: ["activity", "role_needed", "due_date"] }, collectionLabel: "Mobilization activity" },
    ["activity", "role_needed", "owner", "due_date", "status", "notes"].map(key => s(key, key === "due_date" ? { type: "date" } : {}))),
  ...group({ stage: "solution_design", tab: "HAM Manpower Model", uiOwner: owner("HAMManpowerModelTab.tsx"), basePath: "solution_design_data.ham.recommendation" }, [s("readiness"), s("notes", { type: "richtext" })]),
  ...primitiveCollection({ stage: "solution_design", tab: "HIP Systems & IP Model", uiOwner: owner("HIPSystemsIPModelTab.tsx"), basePath: "solution_design_data.hip.systems[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Selected system" }),
  ...group({ stage: "solution_design", tab: "HIP Systems & IP Model", uiOwner: owner("HIPSystemsIPModelTab.tsx"), basePath: "solution_design_data.hip.integration" },
    ["integration_required", "integration_type", "customer_system", "integration_notes", "it_owner", "status"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HIP Systems & IP Model", uiOwner: owner("HIPSystemsIPModelTab.tsx"), basePath: "solution_design_data.hip.sops[]", rowIdentity: { fingerprintFields: ["name", "purpose"] }, collectionLabel: "SOP" },
    ["name", "purpose", "applies_to", "owner", "status", "document_reference"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HIP Systems & IP Model", uiOwner: owner("HIPSystemsIPModelTab.tsx"), basePath: "solution_design_data.hip.reports[]", rowIdentity: { fingerprintFields: ["report", "frequency", "audience"] }, collectionLabel: "Report" },
    ["report", "frequency", "audience", "source_system", "owner", "status"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "HIP Systems & IP Model", uiOwner: owner("HIPSystemsIPModelTab.tsx"), basePath: "solution_design_data.hip.recommendation" }, [s("readiness"), s("notes", { type: "richtext" })]),
  ...group({ stage: "solution_design", tab: "Scope Matrix", uiOwner: owner("ScopeMatrixTab.tsx"), basePath: "solution_design_data.scope_matrix.rows[]", rowIdentity: { fingerprintFields: ["scope_item"] }, collectionLabel: "Scope matrix row" },
    ["scope_item", "included", "hala_responsibility", "customer_responsibility", "third_party_responsibility", "evidence_source", "commercial_impact", "clarification_needed", "notes"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "SLA / KPI Model", uiOwner: owner("SLAKPIModelTab.tsx"), basePath: "solution_design_data.sla_kpi.kpis[]", rowIdentity: { fingerprintFields: ["kpi_name", "target"] }, collectionLabel: "KPI" },
    ["kpi_name", "target", "measurement_method", "reporting_frequency", "owner", "source", "risk_notes", "include_in_proposal"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "SLA / KPI Model", uiOwner: owner("SLAKPIModelTab.tsx"), basePath: "solution_design_data.sla_kpi.governance" },
    ["review_frequency", "reporting_owner", "customer_reporting_contact", "escalation_trigger", "penalty_linkage"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "SLA / KPI Model", uiOwner: owner("SLAKPIModelTab.tsx"), basePath: "solution_design_data.sla_kpi.recommendation" }, [s("readiness"), s("notes", { type: "richtext" })]),
  ...group({ stage: "solution_design", tab: "Assumptions & Dependencies", uiOwner: owner("AssumptionsDependenciesTab.tsx"), basePath: "solution_design_data.assumptions_dependencies.assumptions[]", rowIdentity: { fingerprintFields: ["assumption", "category"] }, collectionLabel: "Assumption" },
    ["assumption", "category", "impact", "owner", "source", "status", "include_in_proposal"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "Assumptions & Dependencies", uiOwner: owner("AssumptionsDependenciesTab.tsx"), basePath: "solution_design_data.assumptions_dependencies.dependencies[]", rowIdentity: { fingerprintFields: ["dependency", "responsible_party", "due_date"] }, collectionLabel: "Dependency" },
    ["dependency", "responsible_party", "due_date", "impact_if_missing", "owner", "status"].map(key => s(key, key === "due_date" ? { type: "date" } : {}))),
  ...group({ stage: "solution_design", tab: "Assumptions & Dependencies", uiOwner: owner("AssumptionsDependenciesTab.tsx"), basePath: "solution_design_data.assumptions_dependencies.exclusions[]", rowIdentity: { fingerprintFields: ["exclusion", "reason"] }, collectionLabel: "Exclusion" },
    ["exclusion", "reason", "commercial_impact", "owner", "include_in_proposal"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "Assumptions & Dependencies", uiOwner: owner("AssumptionsDependenciesTab.tsx"), basePath: "solution_design_data.assumptions_dependencies.clarifications[]", rowIdentity: { fingerprintFields: ["question", "source_reference"] }, collectionLabel: "Design clarification" },
    ["question", "related_area", "source_reference", "impact", "owner", "status", "buyer_response"].map(key => s(key))),
  ...group({ stage: "solution_design", tab: "Assumptions & Dependencies", uiOwner: owner("AssumptionsDependenciesTab.tsx"), basePath: "solution_design_data.assumptions_dependencies.recommendation" }, [s("readiness"), s("notes", { type: "richtext" })]),
];

// Stage 5 - P&L / Pricing
const calc = ["storageRate", "pallets", "inboundRate", "inboundVol", "outboundRate", "outboundVol", "vasRevenue", "facilityCost", "staffCost", "mheCost", "insuranceCost", "otherCost"];
const summary = ["monthly_revenue", "annual_revenue", "monthly_opex", "annual_opex", "gross_profit", "gp_percent", "target_gp_percent", "target_gp_source", "variance_to_target", "approval_chain_required"];
const summaryText = new Set(["target_gp_percent", "target_gp_source", "variance_to_target", "approval_chain_required"]);
const PNL_PRICING: FieldDescriptor[] = [
  ...group({ stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: owner("TenderPnLCalculatorPanel.tsx"), basePath: "pricing.pnl_snapshot.working_draft.calculator_state" }, calc.map(key => s(key, { type: "number" }))),
  ...group({ stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: owner("TenderPnLCalculatorPanel.tsx"), basePath: "pricing.pnl_snapshot.working_draft" }, [s("target_gp_override", { type: "percent", unit: "%" })]),
  ...group({ stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: owner("TenderPnLCalculatorPanel.tsx"), basePath: "pricing.pnl_snapshot.snapshots[]", rowIdentity: { fingerprintFields: ["created_at", "summary.gp_percent", "summary.monthly_revenue"] }, collectionLabel: "P&L snapshot" }, [s("status"), s("notes", { type: "richtext" })]),
  ...group({ stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: owner("TenderPnLCalculatorPanel.tsx"), basePath: "pricing.pnl_snapshot.snapshots[].calculator_state", rowIdentity: { fingerprintFields: ["created_at", "summary.gp_percent", "summary.monthly_revenue"] } }, calc.map(key => s(key, { type: "number" }))),
  ...group({ stage: "pnl_pricing", tab: "P&L Calculator", uiOwner: owner("TenderPnLCalculatorPanel.tsx"), basePath: "pricing.pnl_snapshot.snapshots[].summary", rowIdentity: { fingerprintFields: ["created_at", "summary.gp_percent", "summary.monthly_revenue"] } }, summary.map(key => s(key, { type: summaryText.has(key) ? "text" : key === "gp_percent" ? "percent" : "currency", ...(key === "gp_percent" ? { unit: "%" } : summaryText.has(key) ? {} : { unit: "SAR" }) }))),
  ...group({ stage: "pnl_pricing", tab: "Pricing Scenarios", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.scenarios.rows[]", rowIdentity: { fingerprintFields: ["scenario_name", "scenario_type"] }, collectionLabel: "Pricing scenario" }, [
    s("scenario_name"), s("scenario_type"), s("linked_pnl_snapshot_reference", { type: "id_ref" }), s("revenue", { type: "currency", unit: "SAR" }),
    s("cost", { type: "currency", unit: "SAR" }), s("gp_percent", { type: "percent", unit: "%" }), s("target_gp_percent", { type: "percent", unit: "%" }),
    s("variance", { type: "percent", unit: "%" }), s("operational_assumption"), s("commercial_risk"), s("recommended"), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "pnl_pricing", tab: "Pricing Scenarios", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.scenarios.selected_scenario" },
    ["selected_scenario_id", "selected_scenario_name", "reason_for_selection", "approval_required"].map(key => s(key, key === "selected_scenario_id" ? { type: "id_ref" } : {}))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.payment_tax_validity" },
    ["payment_terms", "vat_treatment", "vat_percent", "proposal_validity", "contract_term", "extension_option"].map(key => s(key, key === "vat_percent" ? { type: "percent", unit: "%" } : {}))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.mobilization_notice_forecast" },
    ["mobilization_period", "movement_notice_period", "forecast_notice_period", "asn_requirement", "customer_forecast_responsibility", "notes"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.insurance_liability" },
    ["insurance_treatment", "coverage_limit", "liability_notes", "force_majeure_treatment", "damage_responsibility_notes"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.surcharges[]", rowIdentity: { fingerprintFields: ["charge_type", "trigger", "applies_to"] }, collectionLabel: "Surcharge" },
    ["charge_type", "trigger", "rate_formula", "applies_to", "notes", "include_in_proposal"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.customer_responsibilities[]", rowIdentity: { fingerprintFields: ["responsibility", "applies_to"] }, collectionLabel: "Customer responsibility" },
    ["responsibility", "applies_to", "source_evidence", "commercial_impact", "include_in_proposal"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.exclusions[]", rowIdentity: { fingerprintFields: ["exclusion", "reason"] }, collectionLabel: "Commercial exclusion" },
    ["exclusion", "reason", "commercial_impact", "include_in_proposal", "notes"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Commercial Terms", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.commercial_terms.assumptions[]", rowIdentity: { fingerprintFields: ["assumption", "category"] }, collectionLabel: "Commercial assumption" },
    ["assumption", "category", "impact", "owner", "source", "status", "include_in_proposal"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Pricing Approval", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.approval.summary" },
    ["approval_status", "approval_level_required", "current_approver", "submitted_date", "approved_date", "rejection_revision_reason"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Pricing Approval", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.approval.approval_chain[]", rowIdentity: { fingerprintFields: ["approval_role", "approver"] }, collectionLabel: "Pricing approver" },
    ["approval_role", "approver", "required", "status", "date", "notes"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Pricing Approval", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.approval.approval_checks[]", rowIdentity: { fingerprintFields: ["check"] }, collectionLabel: "Pricing approval check" },
    ["check", "status", "evidence_notes", "owner"].map(key => s(key))),
  ...group({ stage: "pnl_pricing", tab: "Pricing Approval", uiOwner: owner("PnlPricingStage.tsx"), basePath: "pricing.approval.conditions[]", rowIdentity: { fingerprintFields: ["condition", "owner", "due_date"] }, collectionLabel: "Pricing condition" },
    ["condition", "owner", "due_date", "status", "notes"].map(key => s(key, key === "due_date" ? { type: "date" } : {}))),
];

// Stage 6 - Tender Drafting
const TENDER_DRAFTING: FieldDescriptor[] = [
  ...group({ stage: "tender_drafting", tab: "Proposal Architecture / TOC", uiOwner: owner("ProposalArchitectureTOCTab.tsx"), basePath: "tender_drafting.proposal_architecture" }, [s("active_toc_id", { type: "id_ref" }), s("status")]),
  ...group({ stage: "tender_drafting", tab: "Proposal Architecture / TOC", uiOwner: owner("ProposalArchitectureTOCTab.tsx"), basePath: "tender_drafting.proposal_architecture.toc_versions[]", rowIdentity: { fingerprintFields: ["version", "created_at"] }, collectionLabel: "TOC version" }, [s("version", { type: "integer" }), s("status")]),
  ...group({ stage: "tender_drafting", tab: "Proposal Architecture / TOC", uiOwner: owner("ProposalArchitectureTOCTab.tsx"), basePath: "tender_drafting.proposal_architecture.toc_versions[].sections[]", rowIdentity: { fingerprintFields: ["section_number", "section_title", "volume"] }, collectionLabel: "TOC section" }, [
    s("section_number"), s("section_title"), s("volume"), s("section_purpose"), s("source_stages"), s("required_source_data"),
    s("required_evidence"), s("document_assembly_target"), s("owner"), s("include_in_proposal", { type: "boolean" }), s("status"),
  ]),
  ...group({ stage: "tender_drafting", tab: "Proposal Block Workbench", uiOwner: owner("ProposalBlockWorkbenchTab.tsx"), basePath: "tender_drafting.proposal_blocks[]", rowIdentity: { fingerprintFields: ["section_number", "block_key", "title", "volume"] }, collectionLabel: "Proposal block" }, [
    s("toc_section_id", { type: "id_ref" }), s("section_number"), s("title"), s("block_key"), s("block_type"), s("volume"), s("intended_section"),
    s("source_stages"), s("required_source_data"), s("required_evidence"), s("document_assembly_target"), s("owner"), s("notes", { type: "richtext" }),
    s("draft_content", { type: "richtext" }), s("editor_stage"), s("editor_content", { type: "richtext" }),
    s("section_name"), s("internal_notes", { type: "richtext" }), s("source_references"), s("draft_status"), s("approval_status"), s("reviewer"),
    s("review_notes", { type: "richtext" }), s("approved_at", { type: "datetime" }), s("approved_by"),
  ]),
  ...group({ stage: "tender_drafting", tab: "Compliance Coverage", uiOwner: owner("ComplianceCoverageTab.tsx"), basePath: "tender_drafting.compliance_coverage.requirements[]", rowIdentity: { fingerprintFields: ["requirement_id", "requirement_text", "source_document"] }, collectionLabel: "Compliance coverage requirement" }, [
    s("requirement_id"), s("requirement_text"), s("source_document"), s("linked_block_id", { type: "id_ref" }), s("linked_appendix_or_document_id", { type: "id_ref" }),
    s("status"), s("owner"), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "tender_drafting", tab: "Appendices & Evidence", uiOwner: owner("AppendicesEvidenceTab.tsx"), basePath: "tender_drafting.appendices_evidence.evidence_gaps[]", rowIdentity: { fingerprintFields: ["missing_evidence", "required_for", "linked_section"] }, collectionLabel: "Evidence gap" }, [
    s("missing_evidence"), s("required_for"), s("linked_block_id", { type: "id_ref" }), s("linked_section"), s("owner"), s("due_date", { type: "date" }), s("status"), s("notes", { type: "richtext" }),
  ]),
];

// Stage 7 - Internal Review (human review fields only; no AI-review payloads)
const INTERNAL_REVIEW: FieldDescriptor[] = [
  ...group({ stage: "internal_review", tab: "Department Reviews", uiOwner: owner("DepartmentalReviewTab.tsx"), basePath: "tender_drafting.proposal_blocks[]", rowIdentity: { fingerprintFields: ["section_number", "block_key", "title", "volume"] }, emitCollection: false }, [
    ...["ops", "finance", "legal"].flatMap(dept => [s(`${dept}_status`), s(`${dept}_comment`, { type: "richtext" }), s(`${dept}_reviewer`), s(`${dept}_reviewed_at`, { type: "datetime" })]),
  ]),
];

// Stage 8 - Approval Matrix
const APPROVAL_MATRIX: FieldDescriptor[] = [
  ...group({ stage: "approval_matrix", tab: "Approval Matrix", uiOwner: owner("ApprovalMatrixStage.tsx"), basePath: "approval_matrix.approvals[]", rowIdentity: { fingerprintFields: ["role", "role_label", "type"] }, collectionLabel: "Approval participant" }, [
    s("role"), s("role_label"), s("type"), s("decision"), s("decided_by"), s("comment", { type: "richtext" }), s("decided_at", { type: "datetime", nullBehavior: "null" }),
  ]),
];

// Stage 9 - Final Approved and the three editable submission-readiness registers
const FINAL_APPROVED: FieldDescriptor[] = [
  ...group({ stage: "final_approved", tab: "Approval Record", uiOwner: owner("FinalApprovedStage.tsx"), basePath: "final_approved.approval_record" }, [
    s("decision"), s("approved_by"), s("approved_at", { type: "datetime" }), s("reference"), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "final_approved", tab: "Placeholders", uiOwner: owner("TenderPlaceholdersTab.tsx"), basePath: "submission_readiness.placeholders[]", rowIdentity: { fingerprintFields: ["label"] }, collectionLabel: "Placeholder" },
    ["label", "status", "value", "owner", "notes"].map(key => s(key))),
  ...group({ stage: "final_approved", tab: "Required Documents", uiOwner: owner("TenderRequiredDocumentsTab.tsx"), basePath: "submission_readiness.required_documents[]", rowIdentity: { fingerprintFields: ["document_name"] }, collectionLabel: "Required document" }, [
    s("document_name"), s("status"), s("linked_document_id", { type: "id_ref" }), s("owner"), s("due_date", { type: "date" }), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "final_approved", tab: "Compliance", uiOwner: owner("TenderComplianceMatrixTab.tsx"), basePath: "submission_readiness.compliance_items[]", rowIdentity: { fingerprintFields: ["requirement", "source_reference"] }, collectionLabel: "Compliance item" },
    ["requirement", "status", "evidence", "source_reference", "owner", "notes"].map(key => s(key))),
];

// Stage 10 - Submitted
const SUBMITTED: FieldDescriptor[] = [
  ...group({ stage: "submitted", tab: "Submission Log", uiOwner: owner("SubmissionLogTab.tsx"), basePath: "submission.submission_record" }, [
    s("submitted_at", { type: "datetime" }), s("submitted_by"), s("submission_method"), s("submission_method_detail"), s("recipient_name"),
    s("recipient_email"), s("recipient_org"), s("reference_number"), s("attachments_count", { type: "integer" }), s("submission_notes", { type: "richtext" }),
    s("receipt_confirmed", { type: "boolean" }), s("receipt_confirmed_at", { type: "datetime" }), s("receipt_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "submitted", tab: "Submitted Version", uiOwner: owner("SubmittedVersionTab.tsx"), basePath: "submission.submitted_version" }, [
    s("version_label"), s("frozen_at", { type: "datetime" }), s("frozen_by"), s("document_hash"), s("total_pages", { type: "integer" }),
    s("file_size_mb", { type: "number" }), s("version_notes", { type: "richtext" }),
  ]),
  ...primitiveCollection({ stage: "submitted", tab: "Submitted Version", uiOwner: owner("SubmittedVersionTab.tsx"), basePath: "submission.submitted_version.volumes_included[]", rowIdentity: { fingerprintFields: ["value"] }, collectionLabel: "Submitted volume" }),
  ...group({ stage: "submitted", tab: "CRM Sync", uiOwner: owner("CrmSyncTab.tsx"), basePath: "submission.crm_sync" }, [
    s("crm_stage_before"), s("crm_stage_after"), s("synced_at", { type: "datetime" }), s("synced_by"), s("sync_status"), s("sync_notes", { type: "richtext" }),
  ]),
];

// Stages 11-15 - post-submission lifecycle
const CLARIFICATION: FieldDescriptor[] = [
  ...group({ stage: "clarification", tab: "Q&A Log", uiOwner: owner("ClarificationQALogTab.tsx"), basePath: "clarification.qa_log[]", rowIdentity: { fingerprintFields: ["date_received", "question", "from_contact"] }, collectionLabel: "Clarification Q&A row" },
    ["date_received", "type", "question", "from_contact", "response_due", "status", "response_date", "response_summary", "documents_count", "notes"].map(key => s(key, ["date_received", "response_due", "response_date"].includes(key) ? { type: "date" } : key === "documents_count" ? { type: "integer" } : {}))),
  ...group({ stage: "clarification", tab: "Response Drafts", uiOwner: owner("ClarificationResponseTab.tsx"), basePath: "clarification.response" }, [
    s("response_status"), s("received_date", { type: "date" }), s("due_date", { type: "date" }), s("scope_changes", { type: "richtext" }),
    s("revised_price", { type: "currency", unit: "SAR" }), s("revised_gp", { type: "percent", unit: "%" }), s("pricing_notes", { type: "richtext" }),
    s("submitted_date", { type: "date" }), s("response_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "clarification", tab: "Impact Analysis", uiOwner: owner("ClarificationMarginImpactTab.tsx"), basePath: "clarification.margin_impact" }, [
    s("current_value", { type: "currency", unit: "SAR" }), s("current_gp", { type: "percent", unit: "%" }), s("impact_notes", { type: "richtext" }), s("scope_change_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "clarification", tab: "Clarification Status", uiOwner: owner("ClarificationStatusTab.tsx"), basePath: "clarification.status" }, [
    s("round_status"), s("expected_resolution_date", { type: "date" }), s("client_contact"), s("round_number", { type: "integer" }), s("status_notes", { type: "richtext" }),
  ]),
];

const CLIENT_EVALUATION: FieldDescriptor[] = [
  ...group({ stage: "client_evaluation", tab: "Request Log", uiOwner: owner("ClientRequestLogTab.tsx"), basePath: "client_evaluation.request_log[]", rowIdentity: { fingerprintFields: ["date_received", "subject", "from_contact"] }, collectionLabel: "Client request" },
    ["date_received", "type", "subject", "from_contact", "response_due", "status", "response_date", "response_summary", "documents_count", "notes"].map(key => s(key, ["date_received", "response_due", "response_date"].includes(key) ? { type: "date" } : key === "documents_count" ? { type: "integer" } : {}))),
  ...group({ stage: "client_evaluation", tab: "Client Clarifications", uiOwner: owner("ClientClarificationsTab.tsx"), basePath: "client_evaluation.client_clarifications.rows[]", rowIdentity: { fingerprintFields: ["date_received", "question_or_request", "client_contact"] }, collectionLabel: "Client clarification" }, [
    s("date_received", { type: "date" }), s("client_contact"), s("question_or_request"), s("category"), s("response_owner"), s("response_due", { type: "date" }),
    s("response_status"), s("client_priority"), s("bafo_impact"), s("pricing_impact"), s("scope_impact"), s("response_summary", { type: "richtext" }),
    s("documents_required", { type: "boolean" }), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "client_evaluation", tab: "Client Clarifications", uiOwner: owner("ClientClarificationsTab.tsx"), basePath: "client_evaluation.client_clarifications" }, [s("notes", { type: "richtext" })]),
  ...group({ stage: "client_evaluation", tab: "BAFO Manager", uiOwner: owner("ClientBafoManagerTab.tsx"), basePath: "client_evaluation.bafo" }, [
    s("bafo_status"), s("received_date", { type: "date" }), s("due_date", { type: "date" }), s("scope_changes", { type: "richtext" }),
    s("revised_price", { type: "currency", unit: "SAR" }), s("revised_gp", { type: "percent", unit: "%" }), s("pricing_notes", { type: "richtext" }),
    s("submitted_date", { type: "date" }), s("response_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "client_evaluation", tab: "Margin Impact", uiOwner: owner("ClientMarginImpactTab.tsx"), basePath: "client_evaluation.margin_impact" }, [
    s("current_value", { type: "currency", unit: "SAR" }), s("current_gp", { type: "percent", unit: "%" }), s("original_pricing_label"), s("impact_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "client_evaluation", tab: "Evaluation Status", uiOwner: owner("ClientEvaluationStatusTab.tsx"), basePath: "client_evaluation.evaluation_status" },
    ["technical_status", "commercial_status", "overall_status", "expected_decision_date", "client_contact", "contact_notes", "competitor_intelligence", "evaluation_notes"].map(key => s(key, key === "expected_decision_date" ? { type: "date" } : {}))),
];

const NEGOTIATION: FieldDescriptor[] = [
  ...group({ stage: "negotiation", tab: "Negotiation Log", uiOwner: owner("NegotiationLogTab.tsx"), basePath: "negotiation_data.negotiation_log[]", rowIdentity: { fingerprintFields: ["date", "type", "attendees", "summary"] }, collectionLabel: "Negotiation event" },
    ["date", "type", "attendees", "summary", "key_points", "action_items", "next_steps", "outcome"].map(key => s(key, key === "date" ? { type: "date" } : {}))),
  ...group({ stage: "negotiation", tab: "Requested Changes", uiOwner: owner("NegotiationChangesTab.tsx"), basePath: "negotiation_data.requested_changes[]", rowIdentity: { fingerprintFields: ["category", "description", "client_request"] }, collectionLabel: "Requested change" },
    ["category", "description", "client_request", "hala_position", "counter_proposal", "gp_impact", "status", "notes"].map(key => s(key))),
  ...group({ stage: "negotiation", tab: "Negotiation Margin", uiOwner: owner("NegotiationMarginTab.tsx"), basePath: "negotiation_data.margin_impact" }, [
    s("current_value", { type: "currency", unit: "SAR" }), s("current_gp", { type: "percent", unit: "%" }), s("round_number", { type: "integer" }),
    s("concessions_summary", { type: "richtext" }), s("red_lines", { type: "richtext" }), s("impact_notes", { type: "richtext" }),
  ]),
  ...group({ stage: "negotiation", tab: "Revised Versions", uiOwner: owner("NegotiationRevisedTermsTab.tsx"), basePath: "negotiation_data.revised_terms.terms[]", rowIdentity: { fingerprintFields: ["category", "original_term"] }, collectionLabel: "Revised term" },
    ["category", "original_term", "revised_term", "status"].map(key => s(key))),
  ...group({ stage: "negotiation", tab: "Revised Versions", uiOwner: owner("NegotiationRevisedTermsTab.tsx"), basePath: "negotiation_data.revised_terms" }, [s("overall_notes", { type: "richtext" }), s("contract_readiness")]),
];

const AWARDED: FieldDescriptor[] = [
  ...group({ stage: "awarded", tab: "Award Notice", uiOwner: owner("AwardNoticeTab.tsx"), basePath: "awarded_data.award_notice" }, [
    s("award_date", { type: "date" }), s("award_reference"), s("award_type"), s("client_contact"), s("award_conditions", { type: "richtext" }),
    s("awarded_value", { type: "currency", unit: "SAR" }), s("awarded_gp", { type: "percent", unit: "%" }), s("contract_duration"), s("start_date", { type: "date" }), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "awarded", tab: "Contract Prep", uiOwner: owner("AwardContractPrepTab.tsx"), basePath: "awarded_data.contract_prep" },
    ["contract_status", "contract_reference", "draft_date", "target_sign_date", "actual_sign_date", "hala_legal_owner", "client_legal_contact", "redline_notes", "notes"].map(key => s(key, ["draft_date", "target_sign_date", "actual_sign_date"].includes(key) ? { type: "date" } : {}))),
  ...group({ stage: "awarded", tab: "Contract Prep", uiOwner: owner("AwardContractPrepTab.tsx"), basePath: "awarded_data.contract_prep.checklist" },
    ["award_letter_received", "contract_template_received", "hala_legal_review", "commercial_terms_verified", "sla_appendix_attached", "insurance_certificates", "bank_guarantee", "authorized_signatory", "contract_signed"].map(key => s(key, { type: "boolean", evidence: "none" }))),
  ...group({ stage: "awarded", tab: "SLA Prep", uiOwner: owner("AwardSlaPrepTab.tsx"), basePath: "awarded_data.sla_prep" },
    ["sla_status", "sla_owner", "target_sla_date", "service_lines", "kpi_summary", "penalty_structure", "reporting_cadence", "review_period", "exclusions", "notes"].map(key => s(key, key === "target_sla_date" ? { type: "date" } : {}))),
  ...group({ stage: "awarded", tab: "Handover Prep", uiOwner: owner("AwardHandoverTab.tsx"), basePath: "awarded_data.handover" },
    ["handover_status", "ops_manager", "ops_team", "handover_date", "mobilization_date", "lessons_learned", "notes"].map(key => s(key, ["handover_date", "mobilization_date"].includes(key) ? { type: "date" } : {}))),
  ...group({ stage: "awarded", tab: "Handover Prep", uiOwner: owner("AwardHandoverTab.tsx"), basePath: "awarded_data.handover.checklist" },
    ["ops_team_identified", "ops_briefing_held", "solution_design_shared", "site_surveys_scheduled", "mobilization_plan", "staffing_plan", "it_systems_setup", "client_intro_meeting", "contract_handover", "sla_handover", "risk_register_handover", "commercial_close"].map(key => s(key, { type: "boolean", evidence: "none" }))),
];

const LOST_WITHDRAWN: FieldDescriptor[] = [
  ...group({ stage: "lost_withdrawn", tab: "Loss Reason", uiOwner: owner("LossReasonTab.tsx"), basePath: "lost_withdrawn_data.loss_reason" }, [
    s("outcome_type"), s("primary_reason"), s("client_feedback", { type: "richtext" }), s("winning_bidder"), s("winning_price", { type: "currency", unit: "SAR" }),
    s("our_price", { type: "currency", unit: "SAR" }), s("loss_date", { type: "date" }), s("notified_by"), s("contributing_factors", { type: "richtext" }), s("notes", { type: "richtext" }),
  ]),
  ...group({ stage: "lost_withdrawn", tab: "Lessons Learned", uiOwner: owner("LessonsLearnedTab.tsx"), basePath: "lost_withdrawn_data.lessons_learned" }, [s("what_went_well", { type: "richtext" }), s("what_went_wrong", { type: "richtext" })]),
  ...group({ stage: "lost_withdrawn", tab: "Lessons Learned", uiOwner: owner("LessonsLearnedTab.tsx"), basePath: "lost_withdrawn_data.lessons_learned.lessons[]", rowIdentity: { fingerprintFields: ["category", "description"] }, collectionLabel: "Lesson" },
    ["category", "description", "impact", "recommendation"].map(key => s(key))),
  ...group({ stage: "lost_withdrawn", tab: "Competitor Intelligence", uiOwner: owner("CompetitorIntelTab.tsx"), basePath: "lost_withdrawn_data.competitor_intel.competitors[]", rowIdentity: { fingerprintFields: ["name"] }, collectionLabel: "Competitor" },
    ["name", "known_price", "strengths", "weaknesses", "notes"].map(key => s(key))),
  ...group({ stage: "lost_withdrawn", tab: "Competitor Intelligence", uiOwner: owner("CompetitorIntelTab.tsx"), basePath: "lost_withdrawn_data.competitor_intel" }, [s("market_notes", { type: "richtext" })]),
  ...group({ stage: "lost_withdrawn", tab: "Rebid Potential", uiOwner: owner("RebidPotentialTab.tsx"), basePath: "lost_withdrawn_data.rebid_potential" },
    ["likelihood", "expected_timeline", "current_contract_duration", "conditions_for_rebid", "strategy_notes", "client_relationship", "next_steps"].map(key => s(key))),
];

export const TENDER_STAGES = [
  "identified", "qualification", "bid_no_bid", "solution_design", "pnl_pricing",
  "tender_drafting", "internal_review", "approval_matrix", "final_approved",
  "submitted", "clarification", "client_evaluation", "negotiation", "awarded",
  "lost_withdrawn",
] as const;

export const TENDER_MANIFEST: ProcessManifest = {
  process: T,
  stages: TENDER_STAGES,
  fields: [
    ...IDENTIFIED, ...QUALIFICATION, ...BID_NO_BID, ...SOLUTION_DESIGN,
    ...PNL_PRICING, ...TENDER_DRAFTING, ...INTERNAL_REVIEW, ...APPROVAL_MATRIX,
    ...FINAL_APPROVED, ...SUBMITTED, ...CLARIFICATION, ...CLIENT_EVALUATION,
    ...NEGOTIATION, ...AWARDED, ...LOST_WITHDRAWN,
  ],
};
