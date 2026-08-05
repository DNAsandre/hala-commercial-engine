/**
 * PackSelector.test.tsx — SC-01 Wave 04, lane W04-C4.
 *
 * Defect E: `formatDate` wrapped `toLocaleDateString` in a try/catch that could
 * never fire. An unparseable date does not throw — `toLocaleDateString` RETURNS
 * the string "Invalid Date", which was then rendered verbatim in the pack list.
 */
import { describe, expect, it } from "vitest";
import { formatDate } from "./PackSelector";

describe("formatDate — never renders the string 'Invalid Date'", () => {
  it("formats a real ISO timestamp", () => {
    expect(formatDate("2026-06-15T10:30:00.000Z")).toBe("15 Jun 2026");
  });

  it("renders an em dash for an empty value", () => {
    expect(formatDate("")).toBe("—");
  });

  it.each([
    "not-a-date",
    "0000-00-00",
    "2026-13-45T99:99:99Z",
    "undefined",
    "null",
  ])("renders an em dash, not 'Invalid Date', for %j", (value) => {
    const out = formatDate(value);
    expect(out).toBe("—");
    expect(out).not.toContain("Invalid");
  });

  it("proves the old catch could not have helped: the platform returns a string", () => {
    // This is the exact behaviour the previous implementation misread.
    expect(new Date("not-a-date").toLocaleDateString("en-GB")).toBe("Invalid Date");
    expect(Number.isNaN(new Date("not-a-date").getTime())).toBe(true);
  });
});
