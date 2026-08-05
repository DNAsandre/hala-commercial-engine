/**
 * Pipeline Ticket — derives CRM pipeline cards from canonical commercial_tickets data.
 *
 * Stage labels are the Hala-defined Unified CRM Pipeline stages (your single source of truth).
 * These are NOT GHL native names — they are Hala's own naming that maps TO GHL stages
 * via the GHL_STAGE_MAP in crm-sync-engine.ts for outbound sync.
 */
import { supabase } from "./supabase";
import type { CommercialTicket, UnifiedTicketType } from "./unified-ticket-types";
import { DEFAULT_CRM_PIPELINE_STAGE, DEFAULT_INTERNAL_STAGE } from "./unified-ticket-types";
import {
  filterAllowedOperationalTicketRows,
  filterAllowedOperationalTickets,
} from "./process-isolation";

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

// Terminal / exit states.
// ADVISORY ONLY (W04-C1 defect F). This list describes which stages are
// outcomes; it must never be used to refuse a manual stage move. A human may
// drag a card out of any stage, including these.
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

/**
 * Whole days since an ISO timestamp, or null when the value is absent or is not
 * a parseable date. Mirrors tender-ticket-adapter.daysSince — the guard that
 * stops "NaNd" reaching the screen.
 */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
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

/**
 * NULL POLICY (W04-C1 defect C).
 *
 * `estimated_value`, `target_gp_percent` and `probability_percent` are nullable
 * in commercial_tickets. A null means the figure was never captured; it does
 * NOT mean zero. These fields are therefore `number | null` and a `0` here can
 * only ever be a stored `0`. Every render site must show a never-captured value
 * as unknown, and a null must never produce a red or "Critical" verdict.
 *
 * `daysInStage` is null when created_at is absent or unparseable, so no surface
 * can print "NaNd" (defect D).
 */
export type PipelineRiskLevel = "green" | "amber" | "red" | "unknown";

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
  /** null = never captured. 0 = a stored zero. */
  sarValue: number | null;
  /** null = never captured. 0 = a stored zero. */
  gpPct: number | null;
  /** "unknown" = GP% was never captured, so no margin verdict can be made. */
  riskLevel: PipelineRiskLevel;
  riskLabel: string;
  crmStage: CrmStageLabel;
  internalStage: string;
  nextAction: string;
  /** null = created_at absent or unparseable. Never NaN. */
  daysInStage: number | null;
  syncStatus: "synced" | "pending" | "none";
  volumePallets: number;
  /** null = never captured. 0 = a stored zero. */
  probabilityPct: number | null;
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
    // Same guard shape as tender-ticket-adapter.daysSince: an unparseable date
    // yields null, never NaN.
    const daysInStage = daysSince(row.created_at);
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
      sarValue,
      gpPct,
      riskLevel: gpPct != null ? (gpPct < 10 ? "red" : gpPct < 22 ? "amber" : "green") : "unknown",
      riskLabel: gpPct != null
        ? (gpPct < 10 ? "Critical" : gpPct < 22 ? "Low GP" : "Healthy")
        : "GP not captured",
      crmStage,
      internalStage,
      nextAction: deriveNextAction(crmStage),
      daysInStage,
      syncStatus: row.lineage_status === "verified" ? "synced" : "pending",
      volumePallets: 0,
      probabilityPct: probPct,
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

// ─── NULL-SAFE AGGREGATION ─────────────────────────────────
// W04-C1 defect C. A never-captured number contributes nothing to a total and
// is excluded from an average — it is never counted as a zero.

/** Sum of the captured values only. Returns 0 for an empty/all-null set. */
export function sumCaptured(values: (number | null | undefined)[]): number {
  return values.reduce<number>((total, v) => (v == null ? total : total + v), 0);
}

/** Mean of the captured values, or null when nothing was captured. */
export function averageCaptured(values: (number | null | undefined)[]): number | null {
  const captured = values.filter((v): v is number => v != null);
  if (captured.length === 0) return null;
  return captured.reduce((total, v) => total + v, 0) / captured.length;
}

// ─── PROCESS-ISOLATION DISCLOSURE ──────────────────────────
// W04-C1 defect E. The database returns rows that the client-side isolation
// allowlist in process-isolation.ts then removes. Saying "the read succeeded
// and returned no rows" over that is untrue. These helpers let a surface state
// what actually happened, using its own pre-filter and post-filter arrays.

/**
 * One honest sentence about why a surface has fewer records than the database
 * returned. `fetched` is the pre-filter row count, `rendered` the post-filter
 * count. Returns null when nothing was withheld.
 */
export function describeIsolationWithholding(fetched: number, rendered: number): string | null {
  const withheld = fetched - rendered;
  if (withheld <= 0) return null;
  const rows = fetched === 1 ? "row" : "rows";
  return withheld === fetched
    ? `The read succeeded and returned ${fetched} ${rows}; the process-isolation filter in this build withheld all ${withheld}. Nothing was hidden by the database.`
    : `The read succeeded and returned ${fetched} ${rows}; the process-isolation filter in this build withheld ${withheld}.`;
}

/**
 * Empty-state copy that never claims the read returned nothing when it did.
 */
export function describeEmptyReadCause(fetched: number, rendered: number): string {
  return describeIsolationWithholding(fetched, rendered)
    ?? "The read succeeded and returned no rows.";
}

/** A read of commercial_tickets that keeps its own pre-isolation row count. */
export interface IsolationAwareTicketRead {
  /** Rows that survived the client-side process-isolation allowlist. */
  rows: CommercialTicket[];
  /** Rows the database actually returned, before isolation. */
  fetched: number;
  /** fetched − rows.length: rows the database returned and the client dropped. */
  withheld: number;
  error: string | null;
}

/**
 * Read active commercial tickets and report how many rows isolation removed.
 *
 * intake-save.fetchOperationalTickets() applies the same filter but returns
 * only the survivors, so the withheld count is unrecoverable downstream. This
 * lane may not modify intake-save.ts, so the read is repeated here with the
 * identical query in order to compare the pre-filter and post-filter arrays.
 * Any change to the query in intake-save.ts must be mirrored here.
 */
export async function readOperationalTicketsWithIsolation(
  ticketType?: UnifiedTicketType,
): Promise<IsolationAwareTicketRead> {
  let query = supabase.from("commercial_tickets").select("*").eq("active", true);
  if (ticketType) query = query.eq("ticket_type", ticketType);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return { rows: [], fetched: 0, withheld: 0, error: error.message };

  const fetchedRows = (data ?? []) as CommercialTicket[];
  const rows = ticketType
    ? filterAllowedOperationalTickets(ticketType, fetchedRows)
    : filterAllowedOperationalTicketRows(fetchedRows);

  return {
    rows,
    fetched: fetchedRows.length,
    withheld: fetchedRows.length - rows.length,
    error: null,
  };
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
