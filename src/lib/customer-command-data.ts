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
  avgGpPct: number;
  paymentRisk: "low" | "medium" | "high";
  dso: number;
  contractStatus: string;
  contractExpiry: string;
  goLiveCount: number;
  openRisks: number;
  lastActivity: string;
  nextRenewal: string;
  healthScore: number;
  tickets: PipelineTicket[];
  /** true if matched to a real record in the customers table */
  hasCustomerRecord: boolean;
}

const CLOSED_STAGES = ["closed won", "closed lost", "discontinued"];
const WON_STAGES = ["closed won", "contract signed", "go live", "actual go live"];

function computeHealthScore(row: {
  avgGpPct: number;
  openRisks: number;
  activeTickets: number;
  paymentRisk: string;
  dso: number;
}): number {
  let score = 50;

  // GP contribution (0-25)
  if (row.avgGpPct >= 22) score += 25;
  else if (row.avgGpPct >= 10) score += 12;
  else score -= 10;

  // Risk penalty
  score -= Math.min(20, row.openRisks * 5);

  // Payment risk (real data)
  if (row.paymentRisk === "high") score -= 15;
  else if (row.paymentRisk === "medium") score -= 5;

  // DSO penalty (real data)
  if (row.dso > 90) score -= 10;
  else if (row.dso > 60) score -= 5;

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
 */
function mapPaymentRisk(paymentStatus?: string): "low" | "medium" | "high" {
  if (!paymentStatus) return "medium";
  const s = paymentStatus.toLowerCase();
  if (s === "bad") return "high";
  if (s === "acceptable") return "medium";
  return "low"; // "Good"
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
    const totalValue = custTickets.reduce((s, t) => s + t.sarValue, 0);
    const wonRevenue = wonTickets.reduce((s, t) => s + t.sarValue, 0);
    const gpValues = custTickets.map(t => t.gpPct).filter(v => v > 0);
    const avgGp = gpValues.length > 0 ? gpValues.reduce((s, v) => s + v, 0) / gpValues.length : 0;
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

    const paymentRisk = cust ? mapPaymentRisk(cust.paymentStatus) : "medium" as const;
    const dso = cust ? cust.dso : 0;
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
      avgGpPct: Math.round(avgGp * 10) / 10,
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
    });
  }

  rows.sort((a, b) => b.totalPipelineValue - a.totalPipelineValue);
  return rows;
}
