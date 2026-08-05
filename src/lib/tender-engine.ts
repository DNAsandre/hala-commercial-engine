/**
 * tender-engine.ts — clean-owned replacement (SC-01 Wave 02, plan v3 §7.3).
 *
 * Pure lifecycle helpers and the Tender entity type. This module carries no
 * data of its own: the legacy in-memory tender registry was permanently empty
 * and has been removed. Live tender records come from Supabase via
 * lib/supabase-data.ts (fetchTenders / fetchTenderById).
 */

import type { SowData } from "./sow-data-types";
import type { TenderPricingData } from "./tender-pricing-types";
import type { Region } from "./store";

// ─── CRM PIPELINE MILESTONES ───────────────────────────────

/**
 * SC-01 Wave 04: `actual_go_live` added so this union matches the CRM stage
 * vocabulary the human actually clicks. `CRMStage` (src/lib/store.ts) and the
 * CRM Pipeline strip both offer "Actual Go Live"; this union did not know it,
 * so selecting that stage stored a value the reader could not map and the row
 * reloaded as "Prospecting" — after a "Persisted to Supabase" success toast.
 * `operational_handover` is retained because rows may already hold it.
 */
export type TenderMilestone =
  | "prospecting"
  | "qualified"
  | "proposal_sent"
  | "shortlisted"
  | "contract_negotiation"
  | "closed_won"
  | "contract_signed"
  | "operational_handover"
  | "actual_go_live"
  | "closed_lost"
  | "discontinued";

export function getTenderStatusDisplayName(status: TenderMilestone): string {
  const labels: Record<TenderMilestone, string> = {
    prospecting: "Prospecting",
    qualified: "Qualified",
    proposal_sent: "Proposal Sent",
    shortlisted: "Shortlisted",
    contract_negotiation: "Contract Negotiation",
    closed_won: "Closed Won",
    contract_signed: "Contract Signed",
    operational_handover: "Operational Handover",
    actual_go_live: "Actual Go Live",
    closed_lost: "Closed Lost",
    discontinued: "Discontinued",
  };
  return labels[status] ?? status;
}

export function getTenderStatusColor(status: TenderMilestone): string {
  const colors: Record<TenderMilestone, string> = {
    prospecting: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    qualified: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    proposal_sent: "bg-[#075eea]/15 text-[#075eea] dark:bg-[#075eea]/20 dark:text-[#8bb9ff]",
    shortlisted: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    contract_negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    closed_won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    contract_signed: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    operational_handover: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    actual_go_live: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    closed_lost: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    discontinued: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  };
  return colors[status] ?? "";
}

// Internal (non-exported) union referenced by the Tender interface.
type TenderSource = "CRM" | "Direct" | "Referral";

// ─── TENDER ENTITY ─────────────────────────────────────────

export interface Tender {
  id: string;
  linkedWorkspaceId: string | null;
  customerId: string;
  customerName: string;
  title: string;
  submissionDeadline: string; // ISO date
  estimatedValue: number;
  targetGpPercent: number;
  probabilityPercent: number;
  assignedOwner: string;
  assignedTeamMembers: string[];
  /** Internal tender process stage */
  status: TenderMilestone;
  /** CRM Pipeline stage — read from commercial_tickets.crm_pipeline_stage */
  crmPipelineStage: TenderMilestone;
  source: TenderSource;
  region: Region;
  /** Tender Execution Scope — operational delivery geography (manual capture from RFQ/SOW) */
  executionRegions: string[];
  targetSites: { name: string; type: string }[];
  executionType: string;
  geographicComplexity: string;
  siteCount: number;
  executionNotes: string;
  createdAt: string;
  updatedAt: string;
  daysInStatus: number;
  notes: string;
  crmSynced?: boolean;
  /** Structured Scope of Work data — persisted in type_details.sow_data */
  sowData?: SowData;
  /** Structured Customer Fit Qualification data — persisted in type_details.customer_fit_data */
  customerFitData?: Record<string, any>;
  /** Structured SOW Qualification data — persisted in type_details.sow_qualification_data */
  sowQualificationData?: Record<string, any>;
  /** Structured Technical Qualification data — persisted in type_details.technical_qualification_data */
  technicalQualificationData?: Record<string, any>;
  /** Structured Risk Snapshot data — persisted in type_details.risk_snapshot_data */
  riskSnapshotData?: Record<string, any>;
  /** Structured Bid / No-Bid data — persisted in type_details.bid_no_bid_data */
  bidNoBidData?: Record<string, any>;
  /** Structured Solution Design data — persisted in type_details.solution_design_data */
  solutionDesignData?: Record<string, any>;
  /** Structured P&L / Pricing data - persisted in type_details.pricing */
  pricingData?: TenderPricingData;
  /** Structured Tender Drafting data — persisted in type_details.tender_drafting */
  tenderDraftingData?: Record<string, any>;
  /** Full normalized tender detail payload from commercial_tickets.type_details */
  typeDetails?: Record<string, any>;
  /** Snake-case compatibility alias for components that still read raw DB naming */
  type_details?: Record<string, any>;
  /** Raw internal_stage value from commercial_tickets — used to open workspace at the correct process stage */
  internalStageRaw?: string;
}

/**
 * Legacy in-memory lookup. The old app kept a module-level tender registry
 * that was permanently empty; it has been removed rather than replicated.
 * This function therefore always returns undefined (an explicit empty
 * result). Live tenders must be loaded through
 * lib/supabase-data.ts#fetchTenderById.
 */
export function getTenderById(id: string): Tender | undefined {
  void id;
  return undefined;
}
