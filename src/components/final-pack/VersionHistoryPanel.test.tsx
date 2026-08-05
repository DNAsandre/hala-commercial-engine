/**
 * VersionHistoryPanel.test.tsx — SC-01 Wave 04, lane W04-C4.
 *
 * Defect E: `fmt` wrapped `toLocaleString` in a try/catch that could never
 * fire, so an unparseable `created_at` rendered as the literal string
 * "Invalid Date" on every version row.
 */
import { describe, expect, it } from "vitest";
import { fmt } from "./VersionHistoryPanel";

describe("fmt — never renders the string 'Invalid Date'", () => {
  it("formats a real ISO timestamp", () => {
    expect(fmt("2026-06-15T10:30:00.000Z")).toContain("15 Jun");
  });

  it("renders an em dash for an empty value", () => {
    expect(fmt("")).toBe("—");
  });

  it.each(["not-a-date", "0000-00-00", "", "  "])(
    "never leaks 'Invalid Date' for %j",
    (value) => {
      expect(fmt(value)).not.toContain("Invalid");
    },
  );

  it("does not echo an unparseable value back to the user as if it were a date", () => {
    // The old catch branch returned the raw `iso` string; it never ran, but if
    // it had it would have rendered the junk value itself.
    expect(fmt("not-a-date")).toBe("—");
  });
});
