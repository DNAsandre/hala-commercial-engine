import { describe, expect, it } from "vitest";
import { isUsablePnLSnapshotRecord } from "./TenderPnLCalculatorPanel";

describe("Tender P&L snapshot resilience", () => {
  it("rejects incomplete persisted snapshot rows instead of rendering them", () => {
    expect(isUsablePnLSnapshotRecord({ status: "Snapshot Created", notes: "legacy row" })).toBe(false);
  });

  it("accepts a snapshot with identity, status, calculator state, and summary", () => {
    expect(isUsablePnLSnapshotRecord({
      id: "snapshot-1",
      status: "Snapshot Created",
      calculator_state: {},
      summary: {},
    })).toBe(true);
  });
});
