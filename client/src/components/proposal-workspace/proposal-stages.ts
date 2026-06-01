/**
 * Proposal Internal Process Tracker — Stage Definitions
 *
 * These are INTERNAL to the Proposal Workspace only.
 * They do NOT replace CRM Pipeline stages.
 * CRM pipeline stage remains separate.
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

export const PROPOSAL_TRACKER_STAGES: ProposalStage[] = [
  { key: "qualified",           label: "Qualified",            shortLabel: "Qual",       description: "Confirm the opportunity is real enough to work.",                                     color: "text-blue-700",    bgColor: "bg-blue-50",      borderColor: "border-blue-200" },
  { key: "discovery",           label: "Discovery",            shortLabel: "Disc",       description: "Capture the need behind the need.",                                                   color: "text-cyan-700",    bgColor: "bg-cyan-50",      borderColor: "border-cyan-200" },
  { key: "solution_design",     label: "Solution Design",      shortLabel: "Design",     description: "Turn customer needs into a deliverable logistics model.",                             color: "text-indigo-700",  bgColor: "bg-indigo-50",    borderColor: "border-indigo-200" },
  { key: "pnl_pricing",         label: "P&L / Pricing",        shortLabel: "P&L",        description: "Create commercial truth. Value is created or destroyed here.",                        color: "text-violet-700",  bgColor: "bg-violet-50",    borderColor: "border-violet-200" },
  { key: "quote",               label: "Quote",                shortLabel: "Quote",      description: "Create a defensible commercial price position.",                                      color: "text-emerald-700", bgColor: "bg-emerald-50",   borderColor: "border-emerald-200" },
  { key: "proposal_drafting",   label: "Proposal Drafting",    shortLabel: "Draft",      description: "Generate the full customer-ready proposal.",                                          color: "text-teal-700",    bgColor: "bg-teal-50",      borderColor: "border-teal-200" },
  { key: "proposal_sent",       label: "Proposal Sent",        shortLabel: "Sent",       description: "Record what was sent and sync commercial status.",                                    color: "text-sky-700",     bgColor: "bg-sky-50",       borderColor: "border-sky-200" },
  { key: "negotiation",         label: "Negotiation",          shortLabel: "Neg",        description: "Control commercial change and prevent silent scope creep.",                            color: "text-amber-700",   bgColor: "bg-amber-50",     borderColor: "border-amber-200" },
  { key: "commercial_approval", label: "Commercial Approval",  shortLabel: "Approval",   description: "Human decision point with advisory signals.",                                         color: "text-orange-700",  bgColor: "bg-orange-50",    borderColor: "border-orange-200" },
  { key: "contract_signed",     label: "Contract Signed",      shortLabel: "Contract",   description: "Preserve final commercial memory and prepare execution.",                             color: "text-green-700",   bgColor: "bg-green-50",     borderColor: "border-green-200" },
  { key: "go_live",             label: "Go-Live",              shortLabel: "Live",       description: "Connect commercial promise to operational reality.",                                  color: "text-rose-700",    bgColor: "bg-rose-50",      borderColor: "border-rose-200" },
];

export interface StageTab {
  key: string;
  label: string;
}

/**
 * Maps each proposal tracker stage to its workbench tabs.
 */
export const STAGE_WORKBENCH_TABS: Record<string, StageTab[]> = {
  qualified: [
    { key: "qualification_summary", label: "Qualification Summary" },
    { key: "customer_fit",          label: "Customer Fit" },
    { key: "required_info",         label: "Required Info" },
    { key: "supporting_docs",       label: "Supporting Documents" },
  ],
  discovery: [
    { key: "discovery_summary",  label: "Discovery Summary" },
    { key: "meeting_notes",      label: "Meeting Notes" },
    { key: "scope_inputs",       label: "Scope Inputs" },
    { key: "supporting_docs",    label: "Supporting Documents" },
  ],
  solution_design: [
    { key: "warehouse_model",     label: "Warehouse Model" },
    { key: "transport_model",     label: "Transport Model" },
    { key: "service_scope",       label: "Service Scope" },
    { key: "supporting_docs",     label: "Supporting Documents" },
  ],
  pnl_pricing: [
    { key: "pnl_calculator",     label: "P&L Calculator" },
    { key: "cost_inputs",        label: "Cost Inputs" },
    { key: "pricing_scenarios",  label: "Pricing Scenarios" },
    { key: "supporting_docs",    label: "Supporting Documents" },
  ],
  quote: [
    { key: "quote_builder",       label: "Quote Builder" },
    { key: "assumptions",         label: "Assumptions" },
    { key: "exclusions",          label: "Exclusions" },
    { key: "pdf_studio",          label: "PDF Studio" },
  ],
  proposal_drafting: [
    { key: "proposal_builder",   label: "Proposal Builder" },
    { key: "scope_of_work",      label: "Scope of Work" },
    { key: "commercial_terms",   label: "Commercial Terms" },
    { key: "pdf_studio",         label: "PDF Studio" },
  ],
  proposal_sent: [
    { key: "sent_version",       label: "Sent Version" },
    { key: "crm_sync",           label: "CRM Sync" },
    { key: "customer_response",  label: "Customer Response" },
    { key: "timeline",           label: "Timeline" },
  ],
  negotiation: [
    { key: "negotiation_log",    label: "Negotiation Log" },
    { key: "requested_changes",  label: "Requested Changes" },
    { key: "margin_impact",      label: "Margin Impact" },
    { key: "revised_versions",   label: "Revised Versions" },
  ],
  commercial_approval: [
    { key: "approval_summary",    label: "Approval Summary" },
    { key: "exceptions",          label: "Exceptions" },
    { key: "sla_review",          label: "SLA Review" },
    { key: "approval_history",    label: "Approval History" },
  ],
  contract_signed: [
    { key: "contract_reference",  label: "Contract Reference" },
    { key: "sla_draft_link",      label: "SLA Draft" },
    { key: "final_baseline",      label: "Final Baseline" },
    { key: "handover_notes",      label: "Handover Notes" },
  ],
  go_live: [
    { key: "go_live_checklist",   label: "Launch Checklist" },
    { key: "sla_monitoring",      label: "SLA Monitoring" },
    { key: "billing_activation",  label: "Billing Activation" },
    { key: "first_review",        label: "First Review" },
  ],
};

// ── Helpers ──

export function getProposalStage(key: string): ProposalStage | undefined {
  return PROPOSAL_TRACKER_STAGES.find(s => s.key === key);
}

export function getProposalStageIndex(key: string): number {
  return PROPOSAL_TRACKER_STAGES.findIndex(s => s.key === key);
}

export function getProposalStageLabel(key: string): string {
  return getProposalStage(key)?.label ?? key;
}

// ── Re-export for backward compatibility with legacy V2 files ──
export { SUPPORTING_DOC_CATEGORIES } from "./SupportingDocumentsPanel";
