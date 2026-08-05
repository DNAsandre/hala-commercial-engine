/**
 * FacilitiesAdmin.test.tsx — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Defect A: the page issued `.update(...).eq("id", id)` with no read-back and
 * then raised `toast.success("Updated")`. An update matching zero rows returns
 * no error, so an administrator was told a change had been saved that the
 * database never stored.
 *
 * `ops-runtime.writes.test.ts` proves the read-back reaches the database.
 * This file proves the other half: the word "success" is only ever produced
 * for a verdict of `stored`.
 */
import { describe, expect, it } from "vitest";
import type { FacilityWriteResult } from "@/lib/ops-runtime";
import { describeFacilityWrite } from "./FacilitiesAdmin";

const SUCCESS = "Saved — the stored record now holds these values";

describe("describeFacilityWrite — defect A", () => {
  it("reports success only when the stored value was confirmed", () => {
    const stored: FacilityWriteResult = { status: "stored", stored: { id: "f-1", name: "Jubail" } };
    const report = describeFacilityWrite(stored, "This facility", SUCCESS);
    expect(report.tone).toBe("success");
    expect(report.message).toBe(SUCCESS);
  });

  it("never reports success when the change was not stored", () => {
    const notStored: FacilityWriteResult = {
      status: "not_stored",
      error: "The change was not stored: no matching facility record was updated.",
    };
    const report = describeFacilityWrite(notStored, "This facility", SUCCESS);
    expect(report.tone).toBe("error");
    expect(report.message).toContain("NOT saved");
    expect(report.message).not.toMatch(/saved —/i);
    if (report.tone !== "error") throw new Error("unreachable");
    expect(report.description).toContain("no matching facility record");
  });

  it("never reports success when the request itself failed", () => {
    const failed: FacilityWriteResult = { status: "error", error: "permission denied" };
    const report = describeFacilityWrite(failed, "This facility", SUCCESS);
    expect(report.tone).toBe("error");
    expect(report.message).toContain("Failed to update");
    if (report.tone !== "error") throw new Error("unreachable");
    expect(report.description).toBe("permission denied");
  });

  it("a failed request and an unstored change do not read the same", () => {
    const failed = describeFacilityWrite({ status: "error", error: "network down" }, "X", SUCCESS);
    const notStored = describeFacilityWrite({ status: "not_stored", error: "zero rows" }, "X", SUCCESS);
    expect(failed.message).not.toBe(notStored.message);
  });

  it("the only verdict that can ever produce tone 'success' is 'stored'", () => {
    const verdicts: FacilityWriteResult[] = [
      { status: "stored", stored: {} },
      { status: "not_stored", error: "zero rows" },
      { status: "error", error: "boom" },
    ];
    const successes = verdicts
      .map(v => describeFacilityWrite(v, "X", SUCCESS))
      .filter(r => r.tone === "success");
    expect(successes).toHaveLength(1);
  });
});
