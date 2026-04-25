/**
 * Portfolio Engine — Customer Decision Layer
 *
 * 4 Layers:
 *   1. Customer Truth Layer  — raw factual base (Customer type from store)
 *   2. ECR Layer             — quality scoring (grade + recommendation)
 *   3. Signal Layer          — interpreted risk / business meanings
 *   4. Portfolio Decision    — action category per customer
 *
 * Doctrine:
 *   - Not all revenue is good revenue
 *   - Protect margin, ops feasibility, and strategic fit
 *   - Human judgment remains sovereign — engine recommends, humans decide
 *   - Decisions are auditable and traceable
 */

import type { Customer } from "@/lib/store";
import type { RenewalWorkspace } from "@/lib/renewal-engine";
import type { Tender } from "@/lib/tender-engine";

// ============================================================
// LAYER 2 — ECR TYPES (formal object, not just a badge)
// ============================================================

export type EcrGrade = "A" | "B" | "C" | "D" | "F";
export type EcrTrend = "improving" | "stable" | "deteriorating" | "unknown";

export type EcrRecommendation =
  | "Grow"
  | "Protect"
  | "Renew"
  | "Fix"
  | "Reprice"
  | "Exit / Replace";

export interface CustomerEcr {
  customerId: string;
  commercialValueScore: number;     // 0–100
  operationalComplexityScore: number; // 0–100 (higher = more complex / worse)
  financialBehaviorScore: number;   // 0–100
  overallGrade: EcrGrade;
  recommendation: EcrRecommendation;
  rationale: string;
  trendDirection: EcrTrend;
  lastReviewedAt: string;
  reviewedBy: string;
  versionNumber: number;
}

import type {
  PortfolioSignal,
  RenewalWindowStatus,
  SignalSeverity,
} from "./signal-engine";
import { deriveSignals, getRenewalWindowStatus } from "./signal-engine";
export type { PortfolioSignal, RenewalWindowStatus, SignalSeverity };

// ============================================================
// LAYER 4 — PORTFOLIO DECISION TYPES
// ============================================================

export type PortfolioCategory =
  | "Grow"
  | "Protect"
  | "Monitor"
  | "Fix"
  | "Exit / Replace";

export interface CustomerPortfolioView {
  customer: Customer;
  ecr: CustomerEcr | null;

  // Derived signals
  signals: PortfolioSignal[];

  // Portfolio decision
  category: PortfolioCategory;

  // Renewal context
  renewalWindowStatus: RenewalWindowStatus;
  renewalDaysToExpiry: number | null;
  linkedRenewalWorkspace: RenewalWorkspace | null;
  renewalActionRequired: boolean;

  // Quick access
  hasActiveEscalation: boolean;
  activeTendersCount: number;
}

// ============================================================

// ============================================================
// PORTFOLIO CATEGORY DERIVATION
// ============================================================

export function derivePortfolioCategory(
  customer: Customer,
  ecr: CustomerEcr | null,
  signals: PortfolioSignal[],
  renewalWindowStatus: RenewalWindowStatus
): PortfolioCategory {
  const grade = ecr?.overallGrade ?? customer.grade;
  const hasCritical = signals.some((s) => s.severity === "critical");
  const hasWarning  = signals.some((s) => s.severity === "warning");

  // ── Tier 1: Grade D/F — always Exit or Fix (grade governs) ──
  if (grade === "F") return "Exit / Replace";
  if (grade === "D") {
    // Exit only when compound bad: bad payer + expired OR explicit F-equivalent behaviour
    if (customer.paymentStatus === "Bad" && renewalWindowStatus === "expired") return "Exit / Replace";
    if (customer.paymentStatus === "Bad") return "Fix"; // still recoverable — fix payment first
    return "Fix";
  }

  // ── Tier 2: Grade C — quality is borderline ──────────────────
  if (grade === "C") {
    if (customer.paymentStatus === "Bad") return "Fix";          // bad payer, C grade = fix
    if (customer.paymentStatus === "Acceptable" && customer.dso > 60) return "Monitor";
    if (hasCritical) return "Monitor";  // C + critical signal = monitor closely
    return "Monitor";
  }

  // ── Tier 3: Grade A/B — healthy base, modified by risk ───────
  if (grade === "A" || grade === "B") {
    if (customer.paymentStatus === "Bad") return "Fix";           // A/B but bad payer = fix
    if (hasCritical) return "Protect";                            // A/B + critical risk = protect
    if (hasWarning)  return "Protect";                            // A/B + warnings = protect
    return "Grow";                                                // clean A/B = grow
  }

  // ── Fallback (TBA grade) ──────────────────────────────────────
  return "Monitor";
}

// ============================================================
// ECR DERIVATION FROM EXISTING CUSTOMER DATA
// (Phase 1: derives from existing customer fields until full ECR scoring is live)
// When full ECR is wired, replace this with database reads.
// ============================================================

export function deriveEcrFromCustomer(customer: Customer): CustomerEcr {
  // Commercial value: based on contract value and revenue trend
  const value = customer.contractValue2025;
  const commercialValueScore =
    value > 10_000_000 ? 90 :
    value > 5_000_000  ? 75 :
    value > 2_000_000  ? 60 :
    value > 1_000_000  ? 45 :
    value > 500_000    ? 30 : 15;

  // Operational complexity: derived from pallets and service type
  const pct = customer.palletContracted > 0
    ? (customer.palletOccupied / customer.palletContracted) * 100
    : 0;
  const complexService = ["WH & TP", "VAS", "F&C"].includes(customer.serviceType);
  const operationalComplexityScore =
    complexService ? Math.min(100, pct * 0.7 + 30)
    : Math.min(100, pct * 0.5 + 10);

  // Financial behavior: DSO and payment status
  let financialBehaviorScore = 80;
  if (customer.paymentStatus === "Bad") financialBehaviorScore -= 50;
  else if (customer.paymentStatus === "Acceptable") financialBehaviorScore -= 20;
  if (customer.dso > 90) financialBehaviorScore -= 20;
  else if (customer.dso > 60) financialBehaviorScore -= 10;
  financialBehaviorScore = Math.max(0, Math.min(100, financialBehaviorScore));

  // Overall grade from existing customer grade field (Phase 1 truth)
  // Phase 2: replace with full weighted score
  const gradeMap: Record<string, EcrGrade> = {
    A: "A", B: "B", C: "C", D: "D", F: "F", TBA: "C",
  };
  const overallGrade: EcrGrade = gradeMap[customer.grade] ?? "C";

  // Recommendation from grade + behavior
  let recommendation: EcrRecommendation;
  if (overallGrade === "F" || (overallGrade === "D" && customer.paymentStatus === "Bad")) {
    recommendation = "Exit / Replace";
  } else if (overallGrade === "D") {
    recommendation = "Fix";
  } else if (customer.paymentStatus === "Bad") {
    recommendation = "Reprice";
  } else if (overallGrade === "C" && customer.dso > 60) {
    recommendation = "Fix";
  } else if (overallGrade === "A" || overallGrade === "B") {
    recommendation = commercialValueScore > 70 ? "Grow" : "Protect";
  } else {
    recommendation = "Renew";
  }

  return {
    customerId: customer.id,
    commercialValueScore,
    operationalComplexityScore,
    financialBehaviorScore,
    overallGrade,
    recommendation,
    rationale: `Phase 1 ECR: derived from customer grade ${customer.grade}, DSO ${customer.dso}d, payment status ${customer.paymentStatus}`,
    trendDirection: "unknown",
    lastReviewedAt: new Date().toISOString().slice(0, 10),
    reviewedBy: "System (Phase 1 — upgrade to full ECR scoring)",
    versionNumber: 1,
  };
}

// ============================================================
// MAIN ENGINE — build full portfolio view for all customers
// ============================================================

export function buildPortfolioViews(
  customers: Customer[],
  renewalWorkspaces: RenewalWorkspace[],
  tenders: Tender[],
  escalatedCustomerIds: Set<string> = new Set()
): CustomerPortfolioView[] {
  const now = Date.now();
  const renewalByCustomer = new Map(
    renewalWorkspaces.map((r) => [r.customerId, r])
  );
  const tenderCountByCustomer = new Map<string, number>();
  for (const t of tenders) {
    if (!["awarded", "lost", "withdrawn"].includes(t.status)) {
      tenderCountByCustomer.set(
        t.customerId,
        (tenderCountByCustomer.get(t.customerId) ?? 0) + 1
      );
    }
  }

  return customers
    .filter((c) => c.status === "Active")
    .map((customer) => {
      const ecr = deriveEcrFromCustomer(customer);
      const renewal = renewalByCustomer.get(customer.id) ?? null;
      const { status: renewalWindowStatus, daysToExpiry } =
        getRenewalWindowStatus(customer, now);
      const hasActiveEscalation = escalatedCustomerIds.has(customer.id);

      const signals = deriveSignals(
        customer,
        ecr,
        renewal,
        renewalWindowStatus,
        daysToExpiry,
        hasActiveEscalation
      );

      const category = derivePortfolioCategory(customer, ecr, signals, renewalWindowStatus);

      const renewalActionRequired =
        renewalWindowStatus !== "none" &&
        (
          !renewal ||
          renewal.renewalDecision === "pending" ||
          renewalWindowStatus === "expired" ||
          renewalWindowStatus === "30d"
        );

      return {
        customer,
        ecr,
        signals,
        category,
        renewalWindowStatus,
        renewalDaysToExpiry: daysToExpiry,
        linkedRenewalWorkspace: renewal,
        renewalActionRequired,
        hasActiveEscalation,
        activeTendersCount: tenderCountByCustomer.get(customer.id) ?? 0,
      };
    });
}

// ============================================================
// PORTFOLIO SUMMARY (Dashboard output)
// ============================================================

export interface PortfolioSummary {
  wrongFitCount: number;
  badPayerCount: number;
  renewalsDueSoonCount: number;     // ≤ 90d
  renewalsUrgentCount: number;      // ≤ 30d
  keyAccountsAtRiskCount: number;
  exitReplaceCount: number;
  fixCount: number;
  growCount: number;
  protectCount: number;
  monitorCount: number;
  totalActive: number;
}

export function buildPortfolioSummary(views: CustomerPortfolioView[]): PortfolioSummary {
  const wrongFitCount = views.filter(
    (v) => v.category === "Exit / Replace"
  ).length;
  const badPayerCount = views.filter(
    (v) => v.customer.paymentStatus === "Bad"
  ).length;
  const renewalsDueSoonCount = views.filter(
    (v) => v.renewalWindowStatus !== "none"
  ).length;
  const renewalsUrgentCount = views.filter(
    (v) => v.renewalWindowStatus === "30d" || v.renewalWindowStatus === "expired"
  ).length;
  const keyAccountsAtRiskCount = views.filter(
    (v) =>
      (v.ecr?.overallGrade === "A" || v.ecr?.overallGrade === "B" || v.customer.grade === "A" || v.customer.grade === "B") &&
      v.signals.some((s) => s.severity === "critical" || s.severity === "warning")
  ).length;

  const byCategory = (cat: PortfolioCategory) =>
    views.filter((v) => v.category === cat).length;

  return {
    wrongFitCount,
    badPayerCount,
    renewalsDueSoonCount,
    renewalsUrgentCount,
    keyAccountsAtRiskCount,
    exitReplaceCount: byCategory("Exit / Replace"),
    fixCount: byCategory("Fix"),
    growCount: byCategory("Grow"),
    protectCount: byCategory("Protect"),
    monitorCount: byCategory("Monitor"),
    totalActive: views.length,
  };
}

// ============================================================
// FILTER HELPERS
// ============================================================

export function filterByCategory(
  views: CustomerPortfolioView[],
  category: PortfolioCategory | "all"
): CustomerPortfolioView[] {
  if (category === "all") return views;
  return views.filter((v) => v.category === category);
}

export function sortByUrgency(views: CustomerPortfolioView[]): CustomerPortfolioView[] {
  const categoryOrder: Record<PortfolioCategory, number> = {
    "Exit / Replace": 0,
    "Fix":            1,
    "Protect":        2,
    "Monitor":        3,
    "Grow":           4,
  };
  return [...views].sort(
    (a, b) => categoryOrder[a.category] - categoryOrder[b.category]
  );
}

// ============================================================
// DISPLAY HELPERS
// ============================================================

export const PORTFOLIO_CATEGORY_STYLES: Record<
  PortfolioCategory,
  { label: string; bg: string; text: string; dot: string }
> = {
  "Grow":           { label: "Grow",          bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  "Protect":        { label: "Protect",        bg: "bg-indigo-100 dark:bg-indigo-900/30",  text: "text-indigo-700 dark:text-indigo-300",  dot: "bg-indigo-500" },
  "Monitor":        { label: "Monitor",        bg: "bg-slate-100 dark:bg-slate-800",        text: "text-slate-600 dark:text-slate-300",    dot: "bg-slate-400" },
  "Fix":            { label: "Fix",            bg: "bg-amber-100 dark:bg-amber-900/30",   text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500" },
  "Exit / Replace": { label: "Exit / Replace", bg: "bg-red-100 dark:bg-red-900/30",        text: "text-red-700 dark:text-red-300",        dot: "bg-red-500" },
};

export const SIGNAL_SEVERITY_STYLES: Record<
  SignalSeverity,
  { bg: string; text: string; border: string }
> = {
  critical: { bg: "bg-red-50 dark:bg-red-950/20",    text: "text-red-700 dark:text-red-300",    border: "border-red-200 dark:border-red-800/50" },
  warning:  { bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/50" },
  info:     { bg: "bg-blue-50 dark:bg-blue-950/20",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-800/50" },
};

export const ECR_GRADE_STYLES: Record<
  EcrGrade,
  { bg: string; text: string }
> = {
  A: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  B: { bg: "bg-blue-100 dark:bg-blue-900/40",       text: "text-blue-700 dark:text-blue-300" },
  C: { bg: "bg-amber-100 dark:bg-amber-900/40",     text: "text-amber-700 dark:text-amber-300" },
  D: { bg: "bg-orange-100 dark:bg-orange-900/40",   text: "text-orange-700 dark:text-orange-300" },
  F: { bg: "bg-red-100 dark:bg-red-900/40",         text: "text-red-700 dark:text-red-300" },
};
