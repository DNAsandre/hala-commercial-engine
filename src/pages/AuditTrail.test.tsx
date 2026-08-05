/**
 * AuditTrail.test.tsx — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Defect C: `audit_log.entity_type` / `.action` are nullable and map to "".
 * A Radix `SelectItem` throws on an empty `value`, so one such row took the
 * whole page down. Only values actually present may become options.
 *
 * Defect G: the counters carried a comment claiming they were computed over
 * the same array the list renders. They were computed over the unfiltered
 * read while the list rendered the filtered subset, so a filter left totals
 * describing rows the reader could not see.
 *
 * This package has no DOM test environment, so the page's data logic is
 * exported as pure functions and asserted directly.
 */
import { describe, expect, it } from "vitest";
import type { AuditTrailRecord } from "@/lib/ops-runtime";
import { filterAuditEntries, selectableAuditValues, summariseAuditEntries } from "./AuditTrail";

function entry(over: Partial<AuditTrailRecord>): AuditTrailRecord {
  return {
    id: "e-1",
    entityType: "quote",
    entityId: "q-1",
    action: "approve",
    userId: "u-1",
    userName: "Stored User",
    timestamp: "2026-03-04T10:00:00.000Z",
    details: "stored detail",
    ...over,
  };
}

const rows: AuditTrailRecord[] = [
  entry({ id: "e-1", entityType: "quote", action: "approve", userName: "Alice" }),
  entry({ id: "e-2", entityType: "quote", action: "override", userName: "Bob" }),
  entry({ id: "e-3", entityType: "proposal", action: "approve", userName: "Alice" }),
  entry({ id: "e-4", entityType: "proposal", action: "update", userName: "Carla" }),
];

describe("selectableAuditValues — defect C", () => {
  it("never offers an empty value to a Radix SelectItem", () => {
    const withNulls = [
      ...rows,
      // Both columns are nullable; mapAuditRow turns a null into "".
      entry({ id: "e-5", entityType: "", action: "" }),
    ];
    const { types, actions } = selectableAuditValues(withNulls);
    expect(types).not.toContain("");
    expect(actions).not.toContain("");
    expect(types).toEqual(["quote", "proposal"]);
    expect(actions).toEqual(["approve", "override", "update"]);
  });

  it("still lists every value that is actually recorded", () => {
    const { types, actions } = selectableAuditValues(rows);
    expect(new Set(types)).toEqual(new Set(["quote", "proposal"]));
    expect(new Set(actions)).toEqual(new Set(["approve", "override", "update"]));
  });

  it("a row with no recorded type is still rendered by the list", () => {
    const withNulls = [...rows, entry({ id: "e-5", entityType: "", action: "" })];
    // Dropping it from the FILTER OPTIONS must not drop it from the DATA.
    expect(filterAuditEntries(withNulls, "all", "all")).toHaveLength(5);
  });
});

describe("summariseAuditEntries — defect G", () => {
  it("counts exactly the entries the list renders when a filter is applied", () => {
    const filtered = filterAuditEntries(rows, "quote", "all");
    const stats = summariseAuditEntries(filtered);

    expect(filtered.map(e => e.id)).toEqual(["e-1", "e-2"]);
    // The headline figure equals the number of rows on screen — not 4.
    expect(stats.total).toBe(filtered.length);
    expect(stats.total).toBe(2);
    expect(stats.approvals).toBe(1);
    expect(stats.overrides).toBe(1);
    expect(stats.users).toBe(2);
  });

  it("agrees with the unfiltered list when no filter is applied", () => {
    const all = filterAuditEntries(rows, "all", "all");
    const stats = summariseAuditEntries(all);
    expect(stats.total).toBe(rows.length);
    expect(stats.approvals).toBe(2);
    expect(stats.overrides).toBe(1);
    expect(stats.users).toBe(3);
  });

  it("both filters compose, and the counters follow the composed set", () => {
    const filtered = filterAuditEntries(rows, "proposal", "approve");
    expect(filtered.map(e => e.id)).toEqual(["e-3"]);
    expect(summariseAuditEntries(filtered).total).toBe(1);
    expect(summariseAuditEntries(filtered).approvals).toBe(1);
    expect(summariseAuditEntries(filtered).overrides).toBe(0);
  });

  it("does not count an unrecorded user as a distinct active user", () => {
    const filtered = [entry({ id: "e-6", userName: "" }), entry({ id: "e-7", userName: "" })];
    expect(summariseAuditEntries(filtered).users).toBe(0);
  });
});
