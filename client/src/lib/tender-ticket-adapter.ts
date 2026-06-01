/**
 * Tender ticket adapter.
 *
 * Canonical tender identity comes from commercial_tickets. Legacy tender
 * workspace child tables are handled separately by the tender workspace read
 * layer and must not be treated as the tender master list.
 */
import { supabase } from "./supabase";
import type { CommercialTicket } from "./unified-ticket-types";
import { DEFAULT_CRM_PIPELINE_STAGE } from "./unified-ticket-types";

export interface TenderPortfolioRow {
  id: string;
  customer_name: string | null;
  title: string | null;
  crm_pipeline_stage: string | null;
  phase: string | null;
  estimated_value: number | null;
  target_gp_percent: number | null;
  probability_percent: number | null;
  submission_deadline: string | null;
  assigned_owner: string | null;
  region: string | null;
  source: string | null;
  days_in_status: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  lineage_status: string | null;
}

const TENDER_STAGE_KEYS = new Set([
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
  "technical_review",
  "commercial_review",
  "negotiation",
  "awarded",
  "lost_withdrawn",
]);

function normalizeInternalStage(value: string | null | undefined): string {
  if (!value) return "identified";
  const normalized = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const aliases: Record<string, string> = {
    bid_no_bid: "bid_no_bid",
    bid_or_no_bid: "bid_no_bid",
    p_l_pricing: "pnl_pricing",
    pnl_pricing: "pnl_pricing",
    p_and_l_pricing: "pnl_pricing",
    lost: "lost_withdrawn",
    withdrawn: "lost_withdrawn",
    lost_withdrawn: "lost_withdrawn",
  };

  const mapped = aliases[normalized] ?? normalized;
  return TENDER_STAGE_KEYS.has(mapped) ? mapped : "identified";
}

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

function typeDetails(row: CommercialTicket): Record<string, unknown> {
  return row.type_details && typeof row.type_details === "object" && !Array.isArray(row.type_details)
    ? row.type_details as Record<string, unknown>
    : {};
}

export function mapCommercialTicketToTenderPortfolioRow(row: CommercialTicket): TenderPortfolioRow {
  const details = typeDetails(row);
  const detailDeadline = typeof details.submission_deadline === "string" ? details.submission_deadline : null;

  return {
    id: row.id,
    customer_name: row.customer_name,
    title: row.ticket_title,
    crm_pipeline_stage: row.crm_pipeline_stage || DEFAULT_CRM_PIPELINE_STAGE,
    phase: normalizeInternalStage(row.internal_stage),
    estimated_value: row.estimated_value,
    target_gp_percent: row.target_gp_percent,
    probability_percent: row.probability_percent,
    submission_deadline: detailDeadline || row.target_date,
    assigned_owner: row.owner,
    region: row.region,
    source: row.source_type,
    days_in_status: daysSince(row.updated_at || row.created_at),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    lineage_status: row.lineage_status,
  };
}

export async function fetchTenderPortfolioRows(): Promise<TenderPortfolioRow[]> {
  const { data, error } = await supabase
    .from("commercial_tickets")
    .select("*")
    .eq("ticket_type", "tender")
    .eq("active", true)
    .neq("lineage_status", "rejected")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as CommercialTicket[]).map(mapCommercialTicketToTenderPortfolioRow);
}
