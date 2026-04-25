/**
 * Signal Engine — Centralized Business Rules & Signal Generation
 *
 * This engine extracts signal derivation logic so it can be consumed by the
 * Portfolio Engine, Escalation Engine, and ECR systems natively.
 *
 * Signals represent interpreted risks and business meanings extracted from raw truths.
 */

import type { Customer } from "@/lib/store";
import type { RenewalWorkspace } from "@/lib/renewal-engine";
import type { CustomerEcr } from "@/lib/portfolio-engine"; // We'll keep Ecr types there or move them if needed.

export type SignalFamily =
  | "customer_quality"
  | "financial_behavior"
  | "renewal"
  | "commercial_contractual"
  | "operations";

export type SignalSeverity = "critical" | "warning" | "info";

export interface PortfolioSignal {
  key: string;
  label: string;
  family: SignalFamily;
  severity: SignalSeverity;
  detail?: string;
}

export type RenewalWindowStatus =
  | "none"
  | "90d"
  | "60d"
  | "30d"
  | "expired";

const TERMINAL_RENEWAL = ["rejected", "locked"];

export function getRenewalWindowStatus(
  customer: Customer,
  now: number
): { status: RenewalWindowStatus; daysToExpiry: number | null } {
  if (!customer.contractExpiry) return { status: "none", daysToExpiry: null };
  const d = Math.ceil(
    (new Date(customer.contractExpiry).getTime() - now) / 86400000
  );
  if (d < 0) return { status: "expired", daysToExpiry: d };
  if (d <= 30) return { status: "30d", daysToExpiry: d };
  if (d <= 60) return { status: "60d", daysToExpiry: d };
  if (d <= 90) return { status: "90d", daysToExpiry: d };
  return { status: "none", daysToExpiry: d };
}

export function deriveSignals(
  customer: Customer,
  ecr: CustomerEcr | null,
  renewal: RenewalWorkspace | null,
  renewalWindowStatus: RenewalWindowStatus,
  daysToExpiry: number | null,
  hasEscalation: boolean
): PortfolioSignal[] {
  const signals: PortfolioSignal[] = [];

  // ── A. Customer Quality ──────────────────────────────────
  const grade = ecr?.overallGrade ?? customer.grade;
  if (grade === "F") {
    signals.push({
      key: "grade_f", label: "Grade F — Wrong-Fit",
      family: "customer_quality", severity: "critical",
      detail: "Customer quality below acceptable threshold — exit / replace decision required",
    });
  } else if (grade === "D") {
    signals.push({
      key: "grade_d", label: "Grade D — Deteriorating",
      family: "customer_quality", severity: "critical",
      detail: "Customer quality is poor — fix or exit decision needed",
    });
  }
  if (ecr?.trendDirection === "deteriorating") {
    signals.push({
      key: "trend_down", label: "Deteriorating Trend",
      family: "customer_quality", severity: "warning",
      detail: "Customer grade trending downward across scoring periods",
    });
  }

  // ── B. Financial Behavior ────────────────────────────────
  if (customer.paymentStatus === "Bad") {
    signals.push({
      key: "bad_payer", label: "Bad Payer",
      family: "financial_behavior", severity: "critical",
      detail: "Customer has persistent payment failures — cash exposure active",
    });
  } else if (customer.paymentStatus === "Acceptable") {
    signals.push({
      key: "late_payer", label: "Late Payer",
      family: "financial_behavior", severity: "warning",
      detail: "Customer payment is delayed — DSO elevated",
    });
  }
  if (customer.dso > 90) {
    signals.push({
      key: "dso_critical", label: `DSO ${customer.dso}d — Critical`,
      family: "financial_behavior", severity: "critical",
      detail: `DSO ${customer.dso} days is well above 60-day threshold — collections action required`,
    });
  } else if (customer.dso > 60) {
    signals.push({
      key: "dso_elevated", label: `DSO ${customer.dso}d — Elevated`,
      family: "financial_behavior", severity: "warning",
      detail: `DSO ${customer.dso} days exceeds 60-day threshold`,
    });
  }

  // ── C. Renewal Signals ───────────────────────────────────
  if (renewalWindowStatus === "expired") {
    signals.push({
      key: "contract_expired", label: "Contract Expired",
      family: "renewal", severity: "critical",
      detail: `Contract expired ${Math.abs(daysToExpiry ?? 0)} days ago — immediate decision required`,
    });
  } else if (renewalWindowStatus === "30d") {
    signals.push({
      key: "renewal_30d", label: `Renewal Due — ${daysToExpiry}d`,
      family: "renewal", severity: "critical",
      detail: "Contract expires within 30 days — notice window may be active",
    });
  } else if (renewalWindowStatus === "60d") {
    signals.push({
      key: "renewal_60d", label: `Renewal Due — ${daysToExpiry}d`,
      family: "renewal", severity: "warning",
      detail: "Contract expires within 60 days — renewal strategy must be in place",
    });
  } else if (renewalWindowStatus === "90d") {
    signals.push({
      key: "renewal_90d", label: `Renewal Due — ${daysToExpiry}d`,
      family: "renewal", severity: "info",
      detail: "Contract expires within 90 days — renewal assessment should begin",
    });
  }
  if (
    renewalWindowStatus !== "none" &&
    renewalWindowStatus !== "expired" &&
    !renewal
  ) {
    signals.push({
      key: "no_renewal_workspace", label: "No Renewal Strategy",
      family: "renewal", severity: "warning",
      detail: "No renewal workspace created — decision missing",
    });
  }
  if (renewal?.renewalDecision === "pending" && !TERMINAL_RENEWAL.includes(renewal.status ?? "")) {
    signals.push({
      key: "renewal_decision_pending", label: "No Renewal Decision",
      family: "renewal", severity: "warning",
      detail: "Renewal workspace exists but no decision: renew / renegotiate / exit / replace",
    });
  }
  if (
    ecr?.recommendation === "Exit / Replace" &&
    renewalWindowStatus !== "none"
  ) {
    signals.push({
      key: "exit_recommended", label: "Exit / Replace Recommended",
      family: "renewal", severity: "critical",
      detail: "ECR recommendation is Exit/Replace — renewal should not proceed without review",
    });
  }

  // ── D. Commercial / Contractual ──────────────────────────
  if (hasEscalation) {
    signals.push({
      key: "open_escalation", label: "Open Escalation",
      family: "commercial_contractual", severity: "critical",
      detail: "Active escalation requires attention",
    });
  }

  return signals;
}
