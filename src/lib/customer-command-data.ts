/**
 * Customer Command Centre — Data Aggregation Layer
 *
 * Takes canonical PipelineTicket[] and real Customer[] data,
 * aggregates by customerName to produce one CustomerCommandRow per customer.
 *
 * DATA TRUTH:
 *   - Customer identity, pipeline values, stages, flags → commercial_tickets (Supabase)
 *   - DSO, Payment Risk, Contract Expiry, Industry → customers table (Supabase)
 *   - Health score combines real DSO, payment risk, GP, activity, and risks.
 */
import type { PipelineTicket } from "./pipeline-tickets";
import { sumCaptured, averageCaptured } from "./pipeline-tickets";
import type { Customer } from "./store";

export interface CustomerCommandRow {
  customerName: string;
  crmId: string;
  workspaceType: "Proposal" | "Tender" | "Mixed";
  region: string;
  industry: string;
  serviceType: string;
  owner: string;
  totalPipelineValue: number;
  activeTickets: number;
  proposalTickets: number;
  tenderTickets: number;
  wonRevenue: number;
  /** null = no ticket in this group captured a GP%. Never 0-as-unknown. */
  avgGpPct: number | null;
  /** "unknown" = no customer master record / no captured payment status. Never guessed. */
  paymentRisk: "low" | "medium" | "high" | "unknown";
  /** null = no customer master record was read, so DSO is unknown. */
  dso: number | null;
  contractStatus: string;
  contractExpiry: string;
  goLiveCount: number;
  openRisks: number;
  lastActivity: string;
  nextRenewal: string;
  /** null = the score CANNOT be computed because its inputs were not read. */
  healthScore: number | null;
  /** Why the score is null, for display. Empty when a score was computed. */
  healthScoreUnavailableReason: string;
  tickets: PipelineTicket[];
  /** true if matched to a real record in the customers table */
  hasCustomerRecord: boolean;
}

const CLOSED_STAGES = ["closed won", "closed lost", "discontinued"];
const WON_STAGES = ["closed won", "contract signed", "go live", "actual go live"];

/**
 * HEALTH SCORE — W04-C1 defect B.
 *
 * The score is a weighted index over FIVE inputs: average captured GP%, open
 * risk flags, active ticket count, payment status and DSO. The last two come
 * only from the `customers` master table, and GP% comes only from the tickets.
 *
 * It used to start from a hardcoded 50 and run regardless: with `customers`
 * returning no rows and GP% never captured, every customer received the same
 * invented number and it was rendered as a coloured bar and "{score}/100" —
 * a measurement of nothing.
 *
 * A score is now produced ONLY when the inputs it is derived from were actually
 * read. When they were not, the caller gets null plus the reason, and the grid
 * says the score cannot be computed. 50 is the mid-point of the index, not a
 * neutral default for absent data — nothing is ever scored on absent inputs.
 */
export const HEALTH_SCORE_INPUTS =
  "average captured GP%, open risks, active tickets, payment status and DSO";

function healthScoreUnavailableReason(row: {
  avgGpPct: number | null;
  hasCustomerRecord: boolean;
}): string {
  const missing: string[] = [];
  if (!row.hasCustomerRecord) missing.push("no customers master record was read (payment status, DSO)");
  if (row.avgGpPct == null) missing.push("no ticket captured a GP%");
  if (missing.length === 0) return "";
  return `Cannot be computed: ${missing.join("; ")}.`;
}

function computeHealthScore(row: {
  avgGpPct: number | null;
  openRisks: number;
  activeTickets: number;
  paymentRisk: string;
  dso: number | null;
  hasCustomerRecord: boolean;
}): number | null {
  // Refuse to score on inputs that were never read.
  if (!row.hasCustomerRecord || row.avgGpPct == null) return null;

  let score = 50;

  // GP contribution (0-25) — a real, captured figure by the guard above.
  if (row.avgGpPct >= 22) score += 25;
  else if (row.avgGpPct >= 10) score += 12;
  else score -= 10;

  // Risk penalty
  score -= Math.min(20, row.openRisks * 5);

  // Payment risk (real data only — "unknown" carries no penalty, because an
  // absent payment status is not evidence of medium risk)
  if (row.paymentRisk === "high") score -= 15;
  else if (row.paymentRisk === "medium") score -= 5;

  // DSO penalty (real data only)
  if (row.dso != null && row.dso > 90) score -= 10;
  else if (row.dso != null && row.dso > 60) score -= 5;

  // Activity bonus
  if (row.activeTickets > 0) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Match a customer record by name (fuzzy: case-insensitive, trimmed).
 */
function findCustomer(customers: Customer[], name: string): Customer | undefined {
  const norm = name.trim().toLowerCase();
  return customers.find(c => c.name.trim().toLowerCase() === norm);
}

/**
 * Map Supabase paymentStatus to risk level.
 *
 * An absent/blank payment status is reported as "unknown". It used to default
 * to "medium", which painted an amber risk chip and docked the health score for
 * every customer that simply had no master record — an invented metric.
 */
function mapPaymentRisk(paymentStatus?: string): "low" | "medium" | "high" | "unknown" {
  if (!paymentStatus) return "unknown";
  const s = paymentStatus.toLowerCase();
  if (s === "bad") return "high";
  if (s === "acceptable") return "medium";
  if (s === "good") return "low";
  return "unknown";
}

/**
 * Derive contract status from real contract expiry date.
 */
function deriveContractStatus(expiry: string | undefined): string {
  if (!expiry) return "Unknown";
  const exp = new Date(expiry);
  const now = new Date();
  if (exp < now) return "Expired";
  const daysToExpiry = Math.floor((exp.getTime() - now.getTime()) / 86400000);
  if (daysToExpiry <= 90) return "Renewing";
  return "Active";
}

export function deriveCustomerRowsFromTickets(
  tickets: PipelineTicket[],
  customers: Customer[] = [],
): CustomerCommandRow[] {
  const groups = new Map<string, PipelineTicket[]>();

  for (const ticket of tickets) {
    const key = ticket.customerName.trim() || "Not captured";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ticket);
  }

  const rows: CustomerCommandRow[] = [];

  for (const [name, custTickets] of groups) {
    const first = custTickets[0];
    const cust = findCustomer(customers, name);
    const stageLower = (s: string) => s.toLowerCase().replace(/[_-]/g, " ").trim();
    const activeTickets = custTickets.filter(t => !CLOSED_STAGES.includes(stageLower(t.crmStage)));
    const wonTickets = custTickets.filter(t => WON_STAGES.includes(stageLower(t.crmStage)));
    // Never-captured figures contribute nothing; they are not counted as zero.
    const totalValue = sumCaptured(custTickets.map(t => t.sarValue));
    const wonRevenue = sumCaptured(wonTickets.map(t => t.sarValue));
    const avgGp = averageCaptured(custTickets.map(t => t.gpPct));
    const proposalTickets = custTickets.filter(t => t.ticketType === "proposal").length;
    const tenderTickets = custTickets.filter(t => t.ticketType === "tender").length;
    const workspaceType: CustomerCommandRow["workspaceType"] =
      proposalTickets > 0 && tenderTickets > 0 ? "Mixed" : tenderTickets > 0 ? "Tender" : "Proposal";

    const riskFlags = custTickets.flatMap(t => t.flags).filter(f =>
      f.severity === "critical" || f.severity === "red" || f.severity === "high"
    );
    const dates = custTickets
      .map(t => t.createdAt || t.goLiveDate)
      .filter(Boolean)
      .sort()
      .reverse();
    const goLiveCount = custTickets.filter(t => stageLower(t.crmStage) === "go live" || stageLower(t.crmStage) === "actual go live").length;

    const paymentRisk = cust ? mapPaymentRisk(cust.paymentStatus) : "unknown" as const;
    // No master record means DSO was never read — not that it is zero days.
    const dso = cust ? cust.dso : null;
    const contractExpiry = cust?.contractExpiry || "";
    const contractStatus = cust ? deriveContractStatus(cust.contractExpiry) : "Unknown";
    const nextRenewal = cust?.contractExpiry || "—";
    const industry = cust?.industry || "—";
    const lastActivity = dates[0] || "—";

    const partial = {
      customerName: name,
      crmId: first.id,
      workspaceType,
      region: cust?.region || first.region || "—",
      industry,
      serviceType: first.serviceType || cust?.serviceType || "—",
      owner: first.owner || cust?.accountOwner || "—",
      totalPipelineValue: totalValue,
      activeTickets: activeTickets.length,
      proposalTickets,
      tenderTickets,
      wonRevenue,
      avgGpPct: avgGp == null ? null : Math.round(avgGp * 10) / 10,
      paymentRisk,
      dso,
      contractStatus,
      contractExpiry,
      goLiveCount,
      openRisks: riskFlags.length,
      lastActivity,
      nextRenewal,
      tickets: custTickets,
      hasCustomerRecord: !!cust,
    };

    rows.push({
      ...partial,
      healthScore: computeHealthScore(partial),
      healthScoreUnavailableReason: healthScoreUnavailableReason(partial),
    });
  }

  rows.sort((a, b) => b.totalPipelineValue - a.totalPipelineValue);
  return rows;
}
