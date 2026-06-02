/**
 * Internal Review Types
 *
 * Type definitions for the block-level review metadata used in the
 * Internal Review stage (Stage 7). Proposal blocks are untyped JSONB
 * objects in tender_drafting.proposal_blocks — these interfaces define
 * the review fields that get merged onto each block.
 *
 * No mock data. No hardcoded bots.
 */

export interface AIReviewFlag {
  id: string;
  department: ReviewDepartment;
  bot_id: string;
  severity: "high" | "medium" | "low";
  issue: string;
  recommendation: string;
  block_id: string;
  created_at: string;
}

export type ReviewStatus = "Pending" | "Approved" | "Rejected";
export type ReviewDepartment = "ops" | "finance" | "legal";

export const DEPARTMENT_LABELS: Record<ReviewDepartment, string> = {
  ops: "Operations",
  finance: "Finance",
  legal: "Legal",
};

export const DEPARTMENT_VOLUMES: Record<ReviewDepartment, string[]> = {
  ops: ["Technical", "Shared"],
  finance: ["Commercial", "Shared"],
  legal: ["Technical", "Commercial", "Shared", "Appendix"],
};

/** Fields added to each proposal block for internal review tracking */
export interface BlockReviewFields {
  ops_status: ReviewStatus;
  ops_comment: string;
  ops_reviewer: string;
  ops_reviewed_at: string;
  finance_status: ReviewStatus;
  finance_comment: string;
  finance_reviewer: string;
  finance_reviewed_at: string;
  legal_status: ReviewStatus;
  legal_comment: string;
  legal_reviewer: string;
  legal_reviewed_at: string;
  ai_flags: AIReviewFlag[];
}

/** Default values for a block that hasn't been reviewed yet */
export const DEFAULT_REVIEW_FIELDS: BlockReviewFields = {
  ops_status: "Pending",
  ops_comment: "",
  ops_reviewer: "",
  ops_reviewed_at: "",
  finance_status: "Pending",
  finance_comment: "",
  finance_reviewer: "",
  finance_reviewed_at: "",
  legal_status: "Pending",
  legal_comment: "",
  legal_reviewer: "",
  legal_reviewed_at: "",
  ai_flags: [],
};

/** Ensures a block has all review fields (backfills missing ones with defaults) */
export function ensureReviewFields(block: any): any & BlockReviewFields {
  return { ...DEFAULT_REVIEW_FIELDS, ...block };
}

/** Get the status key for a department */
export function deptStatusKey(dept: ReviewDepartment): string {
  return `${dept}_status`;
}

/** Get the comment key for a department */
export function deptCommentKey(dept: ReviewDepartment): string {
  return `${dept}_comment`;
}

/** Count blocks by review status for a department */
export function countByStatus(
  blocks: any[],
  department: ReviewDepartment,
  volumes: string[],
): { total: number; approved: number; rejected: number; pending: number } {
  const filtered = blocks.filter((b: any) => volumes.includes(b.volume));
  const statusKey = deptStatusKey(department);
  const approved = filtered.filter((b: any) => (b[statusKey] || "Pending") === "Approved").length;
  const rejected = filtered.filter((b: any) => (b[statusKey] || "Pending") === "Rejected").length;
  return {
    total: filtered.length,
    approved,
    rejected,
    pending: filtered.length - approved - rejected,
  };
}
