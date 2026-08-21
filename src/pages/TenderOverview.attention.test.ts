/**
 * TenderOverview.attention.test.ts — TCW-T2 (B23).
 *
 * getTenderAttention used to fall through to a green "On Track" verdict even
 * when every input behind the verdict (deadline, days-in-status, target GP)
 * was absent. A tender with no captured data is not "on track" — it is
 * unmeasured. These tests pin the grey "Not enough data" fallback and the
 * real verdicts when inputs exist.
 */
import { describe, expect, it } from "vitest";
import { getTenderAttention } from "./TenderOverview";
import type { TenderPortfolioRow } from "@/lib/tender-ticket-adapter";

function row(overrides: Partial<TenderPortfolioRow> = {}): TenderPortfolioRow {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    customer_name: "Linde",
    title: "Warehouse & Transport Tender",
    crm_pipeline_stage: null,
    phase: null,
    estimated_value: null,
    target_gp_percent: null,
    probability_percent: null,
    submission_deadline: null,
    assigned_owner: null,
    region: null,
    source: null,
    days_in_status: null,
    notes: null,
    created_at: null,
    updated_at: null,
    lineage_status: null,
    ...overrides,
  };
}

function isoInDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

describe("getTenderAttention — B23 no-data fallback", () => {
  it("states 'Not enough data' (grey) when no attention input is captured", () => {
    expect(getTenderAttention(row())).toEqual({ level: "unknown", label: "Not enough data" });
  });

  it("treats an unreadable stored deadline as an absent input, not as healthy", () => {
    expect(getTenderAttention(row({ submission_deadline: "not-a-date" })))
      .toEqual({ level: "unknown", label: "Not enough data" });
  });

  it("still derives real verdicts when inputs exist", () => {
    expect(getTenderAttention(row({ submission_deadline: isoInDays(3) })).level).toBe("red");
    expect(getTenderAttention(row({ submission_deadline: isoInDays(-2) })).label).toBe("Overdue");
    expect(getTenderAttention(row({ days_in_status: 20 }))).toEqual({ level: "amber", label: "Stalled" });
    expect(getTenderAttention(row({ target_gp_percent: 18 }))).toEqual({ level: "amber", label: "Tight GP" });
  });

  it("says On Track only when at least one input is captured and none flags", () => {
    expect(getTenderAttention(row({ target_gp_percent: 30 }))).toEqual({ level: "green", label: "On Track" });
    expect(getTenderAttention(row({ days_in_status: 3 }))).toEqual({ level: "green", label: "On Track" });
    expect(getTenderAttention(row({ submission_deadline: isoInDays(60) }))).toEqual({ level: "green", label: "On Track" });
  });
});
