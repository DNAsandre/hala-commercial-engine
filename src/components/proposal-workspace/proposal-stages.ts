/**
 * Proposal Internal Process Tracker - Stage Definitions.
 *
 * These are internal Proposal Creator stages. They do not replace the CRM
 * pipeline. During development every stage remains visible and selectable.
 */

export interface ProposalStage {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface StageTab {
  key: string;
  label: string;
}

export interface ProposalStageTask {
  key: string;
  label: string;
  tabs: StageTab[];
}

export const PROPOSAL_TRACKER_STAGES: ProposalStage[] = [
  { key: "qualified",           label: "Qualified",            shortLabel: "Qual",       description: "Confirm the opportunity is real enough to work.",                                  color: "text-blue-700",    bgColor: "bg-blue-50",      borderColor: "border-blue-200" },
  { key: "discovery",           label: "Discovery",            shortLabel: "Disc",       description: "Capture customer needs, current pain, operational context, and open questions.",    color: "text-cyan-700",    bgColor: "bg-cyan-50",      borderColor: "border-cyan-200" },
  { key: "solution_design",     label: "Solution Design",      shortLabel: "Design",     description: "Define the proposed Hala logistics solution.",                                     color: "text-[#075eea]",   bgColor: "bg-[#075eea]/10", borderColor: "border-[#075eea]/20" },
  { key: "pnl_pricing",         label: "P&L / Pricing",        shortLabel: "P&L",        description: "Build the commercial model, cost inputs, pricing lines, and margin scenarios.",     color: "text-[#075eea]",   bgColor: "bg-[#075eea]/10", borderColor: "border-[#075eea]/20" },
  { key: "quote",               label: "Quote",                shortLabel: "Quote",      description: "Create the quote position that will feed the proposal.",                            color: "text-emerald-700", bgColor: "bg-emerald-50",   borderColor: "border-emerald-200" },
  { key: "proposal_drafting",   label: "Proposal Drafting",    shortLabel: "Draft",      description: "Create the proposal TOC, blocks, technical/commercial content, and evidence.",      color: "text-teal-700",    bgColor: "bg-teal-50",      borderColor: "border-teal-200" },
  { key: "proposal_sent",       label: "Proposal Sent",        shortLabel: "Sent",       description: "Record what proposal version was sent, to whom, when, and through which channel.",  color: "text-sky-700",     bgColor: "bg-sky-50",       borderColor: "border-sky-200" },
  { key: "negotiation",         label: "Negotiation",          shortLabel: "Neg",        description: "Track customer feedback, requested changes, pricing impact, and revised versions.", color: "text-amber-700",   bgColor: "bg-amber-50",     borderColor: "border-amber-200" },
  { key: "commercial_approval", label: "Commercial Approval",  shortLabel: "Approval",   description: "Review final commercial position, margin, exceptions, and readiness before contract.", color: "text-orange-700", bgColor: "bg-orange-50",    borderColor: "border-orange-200" },
  { key: "contract_signed",     label: "Contract Signed",      shortLabel: "Contract",   description: "Capture signed agreement references, final scope, pricing, terms, and handover prep.", color: "text-green-700",  bgColor: "bg-green-50",     borderColor: "border-green-200" },
  { key: "go_live",             label: "Go-Live",              shortLabel: "Live",       description: "Prepare handover into operations and preserve proposal memory for execution.",      color: "text-rose-700",    bgColor: "bg-rose-50",      borderColor: "border-rose-200" },
];

/** Convert saved labels and legacy title-case values to the tracker key. */
export function normalizeProposalStageKey(value: string | null | undefined): string | null {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!token) return null;

  const direct = PROPOSAL_TRACKER_STAGES.find((stage) => stage.key === token);
  if (direct) return direct.key;

  const byLabel = PROPOSAL_TRACKER_STAGES.find((stage) =>
    stage.label
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") === token,
  );
  return byLabel?.key ?? null;
}

export const PROPOSAL_STAGE_TASKS: Record<string, ProposalStageTask[]> = {
  qualified: [
    { key: "qualification_summary", label: "Qualification Summary", tabs: [{ key: "qualification_summary", label: "Qualification Summary" }] },
    { key: "customer_fit", label: "Customer Fit", tabs: [{ key: "customer_fit", label: "Customer Fit" }] },
    { key: "opportunity_details", label: "Opportunity Details", tabs: [{ key: "opportunity_details", label: "Opportunity Details" }] },
    { key: "required_info", label: "Required Info", tabs: [{ key: "required_info", label: "Required Info" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  discovery: [
    { key: "discovery_summary", label: "Discovery Summary", tabs: [{ key: "discovery_summary", label: "Discovery Summary" }] },
    { key: "meeting_notes", label: "Meeting Notes", tabs: [{ key: "meeting_notes", label: "Meeting Notes" }] },
    { key: "customer_needs", label: "Customer Needs", tabs: [{ key: "customer_needs", label: "Customer Needs" }] },
    { key: "volumes_lanes_inventory", label: "Volumes / Lanes / Inventory", tabs: [{ key: "volumes_lanes_inventory", label: "Volumes / Lanes / Inventory" }] },
    { key: "pain_points_risks", label: "Pain Points / Risks", tabs: [{ key: "pain_points_risks", label: "Pain Points / Risks" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  solution_design: [
    { key: "solution_configuration", label: "Solution Configuration", tabs: [{ key: "solution_configuration", label: "Solution Configuration" }] },
    { key: "warehouse_model", label: "Warehouse Model", tabs: [{ key: "warehouse_model", label: "Warehouse Model" }] },
    { key: "transport_model", label: "Transport Model", tabs: [{ key: "transport_model", label: "Transport Model" }] },
    { key: "vas_special_handling", label: "VAS / Special Handling", tabs: [{ key: "vas_special_handling", label: "VAS / Special Handling" }] },
    { key: "systems_visibility", label: "Systems & Visibility", tabs: [{ key: "systems_visibility", label: "Systems & Visibility" }] },
    { key: "service_scope_matrix", label: "Service Scope Matrix", tabs: [{ key: "service_scope_matrix", label: "Service Scope Matrix" }] },
    { key: "operational_feasibility", label: "Operational Feasibility", tabs: [{ key: "operational_feasibility", label: "Operational Feasibility" }] },
    { key: "assumptions_dependencies", label: "Assumptions & Dependencies", tabs: [{ key: "assumptions_dependencies", label: "Assumptions & Dependencies" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  pnl_pricing: [
    { key: "pnl_calculator", label: "P&L Calculator", tabs: [{ key: "pnl_calculator", label: "P&L Calculator" }] },
    { key: "cost_inputs", label: "Cost Inputs", tabs: [{ key: "cost_inputs", label: "Cost Inputs" }] },
    { key: "pricing_lines", label: "Pricing Lines", tabs: [{ key: "pricing_lines", label: "Pricing Lines" }] },
    { key: "margin_scenarios", label: "Margin Scenarios", tabs: [{ key: "margin_scenarios", label: "Margin Scenarios" }] },
    { key: "commercial_terms", label: "Commercial Terms", tabs: [{ key: "commercial_terms", label: "Commercial Terms" }] },
    { key: "assumptions_exclusions", label: "Assumptions / Exclusions", tabs: [{ key: "assumptions_exclusions", label: "Assumptions / Exclusions" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  quote: [
    { key: "quote_summary", label: "Quote Summary", tabs: [{ key: "quote_summary", label: "Quote Summary" }] },
    { key: "service_scope", label: "Service Scope", tabs: [{ key: "quote_service_scope", label: "Service Scope" }] },
    { key: "pricing_summary", label: "Pricing Summary", tabs: [{ key: "quote_pricing_summary", label: "Pricing Summary" }] },
    { key: "terms_assumptions_exclusions", label: "Terms / Assumptions / Exclusions", tabs: [{ key: "quote_terms_assumptions_exclusions", label: "Terms / Assumptions / Exclusions" }] },
    { key: "quote_versions", label: "Quote Versions", tabs: [{ key: "quote_versions", label: "Quote Versions" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  proposal_drafting: [
    { key: "proposal_architecture_toc", label: "Proposal Architecture / TOC", tabs: [{ key: "toc_planner", label: "TOC Planner" }, { key: "source_map", label: "Source Map" }] },
    { key: "proposal_block_workbench", label: "Proposal Block Workbench", tabs: [{ key: "block_register", label: "Block Register" }, { key: "block_editor", label: "Block Editor" }, { key: "source_inspector", label: "Source Inspector" }] },
    { key: "technical_operational_volume", label: "Technical / Operational Volume", tabs: [{ key: "technical_operational_volume", label: "Technical / Operational Volume" }] },
    { key: "commercial_volume", label: "Commercial Volume", tabs: [{ key: "commercial_volume", label: "Commercial Volume" }] },
    { key: "appendices_evidence", label: "Appendices & Evidence", tabs: [{ key: "evidence_register", label: "Evidence Register" }, { key: "appendix_notes", label: "Appendix Notes" }] },
    { key: "final_draft_review", label: "Final Draft Review", tabs: [{ key: "final_draft_review", label: "Final Draft Review" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  proposal_sent: [
    { key: "sent_version", label: "Sent Version", tabs: [{ key: "sent_version", label: "Sent Version" }] },
    { key: "delivery_record", label: "Delivery Record", tabs: [{ key: "delivery_record", label: "Delivery Record" }] },
    { key: "recipient_contact_log", label: "Recipient / Contact Log", tabs: [{ key: "recipient_contact_log", label: "Recipient / Contact Log" }] },
    { key: "attachments_register", label: "Attachments Register", tabs: [{ key: "attachments_register", label: "Attachments Register" }] },
    { key: "crm_sync", label: "CRM Sync", tabs: [{ key: "proposal_crm_sync", label: "CRM Sync" }] },
    { key: "delivery_notes", label: "Delivery Notes", tabs: [{ key: "proposal_sent_audit_trail", label: "Delivery Notes" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  negotiation: [
    { key: "customer_feedback", label: "Customer Feedback", tabs: [{ key: "customer_feedback", label: "Customer Feedback" }] },
    { key: "requested_scope_changes", label: "Requested Scope Changes", tabs: [{ key: "requested_scope_changes", label: "Requested Scope Changes" }] },
    { key: "pricing_changes", label: "Pricing Changes", tabs: [{ key: "pricing_changes", label: "Pricing Changes" }] },
    { key: "margin_impact", label: "Margin Impact", tabs: [{ key: "negotiation_margin_impact", label: "Margin Impact" }] },
    { key: "revised_versions", label: "Revised Versions", tabs: [{ key: "revised_versions", label: "Revised Versions" }] },
    { key: "negotiation_notes", label: "Negotiation Notes", tabs: [{ key: "negotiation_notes", label: "Negotiation Notes" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  commercial_approval: [
    { key: "approval_summary", label: "Approval Summary", tabs: [{ key: "approval_summary", label: "Approval Summary" }] },
    { key: "margin_terms_review", label: "Margin / Terms Review", tabs: [{ key: "margin_terms_review", label: "Margin / Terms Review" }] },
    { key: "risk_exception_notes", label: "Risk / Exception Notes", tabs: [{ key: "risk_exception_notes", label: "Risk / Exception Notes" }] },
    { key: "final_commercial_position", label: "Final Commercial Position", tabs: [{ key: "final_commercial_position", label: "Final Commercial Position" }] },
    { key: "approval_record", label: "Approval Record", tabs: [{ key: "approval_record", label: "Approval Record" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  contract_signed: [
    { key: "signed_contract_reference", label: "Signed Contract Reference", tabs: [{ key: "signed_contract_reference", label: "Signed Contract Reference" }] },
    { key: "final_scope", label: "Final Scope", tabs: [{ key: "final_scope", label: "Final Scope" }] },
    { key: "final_pricing", label: "Final Pricing", tabs: [{ key: "final_pricing", label: "Final Pricing" }] },
    { key: "final_terms", label: "Final Terms", tabs: [{ key: "final_terms", label: "Final Terms" }] },
    { key: "handover_prep", label: "Handover Prep", tabs: [{ key: "handover_prep", label: "Handover Prep" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
  go_live: [
    { key: "go_live_summary", label: "Go-Live Summary", tabs: [{ key: "go_live_summary", label: "Go-Live Summary" }] },
    { key: "mobilization_tracker", label: "Mobilization Tracker", tabs: [{ key: "mobilization_tracker", label: "Mobilization Tracker" }] },
    { key: "operations_handover", label: "Operations Handover", tabs: [{ key: "operations_handover", label: "Operations Handover" }] },
    { key: "sla_kpi_setup", label: "SLA / KPI Setup", tabs: [{ key: "sla_kpi_setup", label: "SLA / KPI Setup" }] },
    { key: "open_risks", label: "Open Risks", tabs: [{ key: "open_risks", label: "Open Risks" }] },
    { key: "renewal_future_memory", label: "Renewal / Future Memory", tabs: [{ key: "renewal_future_memory", label: "Renewal / Future Memory" }] },
    { key: "supporting_documents", label: "Supporting Documents", tabs: [{ key: "supporting_docs", label: "Supporting Documents" }] },
  ],
};

export const IMPLEMENTED_PROPOSAL_WORKBENCH_STAGES = new Set(PROPOSAL_TRACKER_STAGES.map(stage => stage.key));

export function isProposalWorkbenchStageEnabled(stageKey: string): boolean {
  return IMPLEMENTED_PROPOSAL_WORKBENCH_STAGES.has(stageKey);
}

export const STAGE_WORKBENCH_TABS: Record<string, StageTab[]> = Object.fromEntries(
  Object.entries(PROPOSAL_STAGE_TASKS).map(([stageKey, tasks]) => [
    stageKey,
    tasks.flatMap(task => task.tabs),
  ])
);

export function getProposalStage(key: string): ProposalStage | undefined {
  return PROPOSAL_TRACKER_STAGES.find(stage => stage.key === key);
}

export function getProposalStageIndex(key: string): number {
  return PROPOSAL_TRACKER_STAGES.findIndex(stage => stage.key === key);
}

export function getProposalStageLabel(key: string): string {
  return getProposalStage(key)?.label ?? key;
}

export function getProposalStageTasks(stageKey: string): ProposalStageTask[] {
  return PROPOSAL_STAGE_TASKS[stageKey] ?? [];
}

export function getDefaultProposalTaskKey(stageKey: string): string {
  return getProposalStageTasks(stageKey)[0]?.key ?? "";
}

export function getProposalTask(stageKey: string, taskKey: string): ProposalStageTask | undefined {
  return getProposalStageTasks(stageKey).find(task => task.key === taskKey);
}

export function getDefaultProposalTabKey(stageKey: string, taskKey: string): string {
  return getProposalTask(stageKey, taskKey)?.tabs[0]?.key ?? "";
}

export function getProposalTaskForTab(stageKey: string, tabKey: string): ProposalStageTask | undefined {
  return getProposalStageTasks(stageKey).find(task => task.tabs.some(tab => tab.key === tabKey));
}

export { SUPPORTING_DOC_CATEGORIES } from "./SupportingDocumentsPanel";
