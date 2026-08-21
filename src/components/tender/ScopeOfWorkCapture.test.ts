/**
 * ScopeOfWorkCapture.test.ts — TCW-T3 (Tender Functional Closure Wave), F7.
 *
 * The defect: on mount the SOW capture seeded 8 DEFAULT_KPI_NAMES rows into
 * state whenever the stored facet had none, so saving an untouched form
 * persisted template rows as captured scope. The fix under test:
 *   - the initial state is EXACTLY the stored facet — an empty (or absent)
 *     stored KPI list stays empty;
 *   - the default names survive only as click-to-add SUGGESTIONS that enter
 *     state on an explicit user action and persist only via a user save.
 *
 * House pattern: pure logic exported from the component, no DOM.
 */
import { describe, expect, it } from "vitest";
import { initialSowState, kpiSuggestionsFor } from "./ScopeOfWorkCapture";

describe("initialSowState — F7: no template KPI seeding", () => {
  it("GUARD: no stored facet → the KPI list starts EMPTY (no DEFAULT_KPI_NAMES rows)", () => {
    expect(initialSowState(undefined).sla_kpis).toEqual([]);
    expect(initialSowState(null).sla_kpis).toEqual([]);
  });

  it("a stored facet without sla_kpis stays empty", () => {
    expect(initialSowState({ scope_summary: "captured" }).sla_kpis).toEqual([]);
  });

  it("a stored facet with an explicitly empty list stays empty", () => {
    expect(initialSowState({ sla_kpis: [] }).sla_kpis).toEqual([]);
  });

  it("stored KPI rows load verbatim", () => {
    const row = { name: "On-time Delivery", target: "98%", measurement_tool: "TMS", source: "RFQ", hala_response: "Compliant", notes: "" };
    expect(initialSowState({ sla_kpis: [row] }).sla_kpis).toEqual([row]);
  });

  it("stored non-KPI sections load normally alongside the empty KPI list", () => {
    const state = initialSowState({ scope_summary: "3PL scope", service_lines: ["Warehousing"] });
    expect(state.scope_summary).toBe("3PL scope");
    expect(state.service_lines).toEqual(["Warehousing"]);
    expect(state.sla_kpis).toEqual([]);
  });
});

describe("kpiSuggestionsFor — defaults are suggestions, not state", () => {
  it("offers the full default list when nothing is captured", () => {
    const suggestions = kpiSuggestionsFor([]);
    expect(suggestions).toHaveLength(8);
    expect(suggestions).toContain("On-time Delivery");
    expect(suggestions).toContain("Order Accuracy");
  });

  it("hides names already captured (case-insensitive), keeps the rest", () => {
    const suggestions = kpiSuggestionsFor([
      { name: "on-time delivery", target: "", measurement_tool: "", source: "", hala_response: "", notes: "" },
      { name: "Custom Client KPI", target: "", measurement_tool: "", source: "", hala_response: "", notes: "" },
    ]);
    expect(suggestions).not.toContain("On-time Delivery");
    expect(suggestions).toHaveLength(7);
  });

  it("blank-name rows do not hide any suggestion", () => {
    expect(kpiSuggestionsFor([
      { name: "", target: "", measurement_tool: "", source: "", hala_response: "", notes: "" },
    ])).toHaveLength(8);
  });
});
