/**
 * Pipeline Ticket — derives CRM pipeline cards from canonical commercial_tickets data.
 *
 * Stage labels are the Hala-defined Unified CRM Pipeline stages (your single source of truth).
 * These are NOT GHL native names — they are Hala's own naming that maps TO GHL stages
 * via the GHL_STAGE_MAP in crm-sync-engine.ts for outbound sync.
 */
import type { CommercialTicket } from "./unified-ticket-types";
import { DEFAULT_CRM_PIPELINE_STAGE, DEFAULT_INTERNAL_STAGE } from "./unified-ticket-types";

// ═══════════════════════════════════════════════════════════
// UNIFIED CRM PIPELINE STAGES — Hala-defined single source
// ═══════════════════════════════════════════════════════════

const CRM_STAGES = [
  "Prospecting",
  "Qualified",
  "Proposal Sent",
  "Shortlisted",
  "Contract Negotiation",
  "Closed Won",
  "Contract Signed",
  "Actual Go Live",
  "Closed Lost",
  "Discontinued",
] as const;

export type CrmStageLabel = (typeof CRM_STAGES)[number];

// Non-terminal columns for Kanban
export const CRM_PIPELINE_COLUMNS: CrmStageLabel[] = [
  "Prospecting",
  "Qualified",
  "Proposal Sent",
  "Shortlisted",
  "Contract Negotiation",
  "Closed Won",
  "Contract Signed",
  "Actual Go Live",
];

// Terminal / exit states
export const CRM_TERMINAL: CrmStageLabel[] = ["Closed Won", "Closed Lost", "Discontinued", "Actual Go Live"];

// ─── NORMALIZE RAW STAGE → UNIFIED STAGE ──────────────────
// Maps raw DB / Zoho / legacy strings to unified stage labels

function normStage(s: string): CrmStageLabel {
  const lower = s.toLowerCase().replace(/[_\-]/g, " ").trim();
  const map: Record<string, CrmStageLabel> = {
    prospecting: "Prospecting", prospect: "Prospecting",
    qualified: "Qualified", qualification: "Qualified",
    "proposal sent": "Proposal Sent", proposal: "Proposal Sent", "proposal active": "Proposal Sent",
    shortlisted: "Shortlisted", shortlist: "Shortlisted",
    "contract negotiation": "Contract Negotiation", negotiation: "Contract Negotiation",
    "closed won": "Closed Won", won: "Closed Won",
    "contract signed": "Contract Signed", signed: "Contract Signed",
    "go live": "Actual Go Live", "actual go live": "Actual Go Live", live: "Actual Go Live",
    "closed lost": "Closed Lost", lost: "Closed Lost",
    discontinued: "Discontinued",
  };
  return map[lower] ?? "Prospecting";
}

// ─── NEXT ACTION PER STAGE ─────────────────────────────────

function deriveNextAction(stage: CrmStageLabel): string {
  const actions: Record<CrmStageLabel, string> = {
    Prospecting: "Qualify opportunity",
    Qualified: "Send proposal",
    "Proposal Sent": "Follow up with client",
    Shortlisted: "Negotiate terms",
    "Contract Negotiation": "Finalize contract",
    "Closed Won": "Begin onboarding",
    "Contract Signed": "Plan go-live",
    "Actual Go Live": "Monitor SLA",
    "Closed Lost": "—",
    Discontinued: "—",
  };
  return actions[stage] ?? "Review";
}

// ─── HELPERS ────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "??";
}

function getTicketDetails(row: CommercialTicket): Record<string, unknown> {
  return row.type_details && typeof row.type_details === "object" && !Array.isArray(row.type_details)
    ? row.type_details as Record<string, unknown>
    : {};
}

function getPipelineWorkspaceId(row: CommercialTicket): string | null {
  const details = getTicketDetails(row);
  const linkedWorkspaceId = details.linked_workspace_id;
  if (row.legacy_workspace_id) return row.legacy_workspace_id;
  if (typeof linkedWorkspaceId === "string" && linkedWorkspaceId.trim()) return linkedWorkspaceId;
  return row.ticket_type === "proposal" ? row.id : null;
}

// ─── PIPELINE TICKET ────────────────────────────────────────

export interface PipelineTicket {
  id: string;
  sourceTable: "commercial_tickets";
  customerName: string;
  opportunityName: string;
  ticketType: "proposal" | "tender";
  lineageStatus?: string;
  owner: string;
  ownerInitials: string;
  region: string;
  sarValue: number;
  gpPct: number;
  riskLevel: "green" | "amber" | "red";
  riskLabel: string;
  crmStage: CrmStageLabel;
  internalStage: string;
  nextAction: string;
  daysInStage: number;
  syncStatus: "synced" | "pending" | "none";
  volumePallets: number;
  probabilityPct: number;
  goLiveDate: string;
  serviceType: string;
  flags: { type: string; message: string; severity: string }[];
  workspaceId: string | null;
  quoteStatus: string;
  proposalStatus: string;
  slaStatus: string;
  contractStatus: string;
  createdAt: string | null;
}

export function deriveCommercialTicketPipelineTickets(rows: CommercialTicket[]): PipelineTicket[] {
  const valid: PipelineTicket[] = [];

  for (const row of rows) {
    if (!row.active) continue;
    if (row.ticket_type !== "proposal" && row.ticket_type !== "tender") continue;

    const crmStage = normStage(row.crm_pipeline_stage || DEFAULT_CRM_PIPELINE_STAGE);
    const internalStage = row.internal_stage || DEFAULT_INTERNAL_STAGE[row.ticket_type];
    const owner = row.owner || "";
    const gpPct = row.target_gp_percent != null ? Number(row.target_gp_percent) : null;
    const sarValue = row.estimated_value != null ? Number(row.estimated_value) : null;
    const probPct = row.probability_percent != null ? Number(row.probability_percent) : null;
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    const daysInStage = Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
    const workspaceId = getPipelineWorkspaceId(row);

    valid.push({
      id: row.id,
      sourceTable: "commercial_tickets" as const,
      customerName: row.customer_name || "Not captured",
      opportunityName: row.ticket_title || "Not captured",
      ticketType: row.ticket_type,
      lineageStatus: row.lineage_status,
      owner,
      ownerInitials: owner ? initials(owner) : "??",
      region: row.region || "",
      sarValue: sarValue ?? 0,
      gpPct: gpPct ?? 0,
      riskLevel: gpPct != null ? (gpPct < 10 ? "red" : gpPct < 22 ? "amber" : "green") : "green",
      riskLabel: gpPct != null ? (gpPct < 10 ? "Critical" : gpPct < 22 ? "Low GP" : "Healthy") : "",
      crmStage,
      internalStage,
      nextAction: deriveNextAction(crmStage),
      daysInStage,
      syncStatus: row.lineage_status === "verified" ? "synced" : "pending",
      volumePallets: 0,
      probabilityPct: probPct ?? 0,
      goLiveDate: row.target_date || "",
      serviceType: "",
      flags: row.lineage_status !== "verified"
        ? [{ type: "lineage", message: "Source evidence not verified yet", severity: "amber" }]
        : [],
      workspaceId,
      quoteStatus: "",
      proposalStatus: "",
      slaStatus: "",
      contractStatus: "",
      createdAt: row.created_at || null,
    });
  }

  return valid;
}

// ─── READ STATE (loading / error / empty / ready) ──────────
// W04-T07-A. A failed read is NOT an empty result. Every surface that reads
// commercial_tickets must be able to tell a human which of the four it is
// looking at, so no page can render "no records" after a read that failed.

export type ReadState = "loading" | "error" | "empty" | "ready";

export function resolveReadState(input: {
  loading: boolean;
  error: string | null | undefined;
  count: number;
}): ReadState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  return input.count > 0 ? "ready" : "empty";
}

/**
 * Counter copy that can never claim more records than are actually rendered.
 *
 * `rendered` must be the length of the array the surface paints; `total` is the
 * unfiltered set it was drawn from. A "12 tickets" headline above six cards is
 * the defect this exists to prevent.
 */
export function describeRenderedCount(rendered: number, total: number, noun: string): string {
  const plural = rendered === 1 ? noun : `${noun}s`;
  return rendered === total
    ? `${rendered} ${plural}`
    : `${rendered} ${plural} (filtered from ${total})`;
}

// ─── STAGE COLORS ──────────────────────────────────────────

export const STAGE_COLORS: Record<CrmStageLabel, { bg: string; text: string; border: string; headerBg: string }> = {
  Prospecting:          { bg: "bg-slate-50",    text: "text-slate-700", border: "border-slate-300",   headerBg: "bg-slate-100" },
  Qualified:            { bg: "bg-blue-50",     text: "text-blue-700",  border: "border-blue-300",    headerBg: "bg-blue-100" },
  "Proposal Sent":      { bg: "bg-[#075eea]/10",  text: "text-[#075eea]",border: "border-[#075eea]/30",  headerBg: "bg-[#075eea]/15" },
  Shortlisted:          { bg: "bg-amber-50",   text: "text-amber-700", border: "border-amber-300",  headerBg: "bg-amber-100" },
  "Contract Negotiation":{ bg: "bg-orange-50", text: "text-orange-700",border: "border-orange-300", headerBg: "bg-orange-100" },
  "Closed Won":         { bg: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-300",headerBg: "bg-emerald-100" },
  "Contract Signed":   { bg: "bg-teal-50",    text: "text-teal-700",  border: "border-teal-300",   headerBg: "bg-teal-100" },
  "Actual Go Live":     { bg: "bg-green-50",  text: "text-green-700", border: "border-green-500",  headerBg: "bg-green-100" },
  "Closed Lost":         { bg: "bg-red-50",     text: "text-red-700",   border: "border-red-300",    headerBg: "bg-red-100" },
  Discontinued:          { bg: "bg-gray-100",   text: "text-gray-500",  border: "border-gray-200",   headerBg: "bg-gray-100" },
};

// ─── TENDER → PIPELINE TICKET CONVERSION ────────────────────
// Converts raw Supabase tenders rows to PipelineTicket[] for the CRM Kanban.
// Uses tenders.crm_pipeline_stage for column placement. All data from DB.

export { normStage };
