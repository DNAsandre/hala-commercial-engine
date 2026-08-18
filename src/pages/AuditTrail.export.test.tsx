/**
 * AuditTrail.export.test.tsx — SC-01 Wave 06, lane T14 (manifest row A-24).
 *
 * The CSV export is a REBUILD-CLEAN: the old app persisted a
 * `feature_audit_export` flag that no code consumed, so the "capability" was
 * fabricated. The rebuilt export must hold three promises:
 *
 *  1. the file contains EXACTLY the filtered rows the list renders
 *     (visible truth), in the same order;
 *  2. every exported value is a stored value or the page's own honest
 *     rendering of it — no invented columns, no "Invalid Date";
 *  3. structure survives hostile stored content (quotes, commas, newlines).
 *
 * This package has no DOM test environment, so the CSV builder is exported as
 * a pure function and asserted directly (same pattern as AuditTrail.test.tsx).
 */
import { describe, expect, it } from "vitest";
import type { AuditTrailRecord } from "@/lib/ops-runtime";
import {
  TIMESTAMP_NOT_RECORDED,
  TIMESTAMP_UNREADABLE,
  formatRecordedDateTime,
} from "@/lib/ops-runtime";
import {
  AUDIT_CSV_COLUMNS,
  auditTrailCsv,
  auditTrailExportFileName,
  filterAuditEntries,
} from "./AuditTrail";

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
];

describe("auditTrailCsv — exported values match visible truth", () => {
  it("writes a header plus exactly one line per row, in row order", () => {
    const lines = auditTrailCsv(rows).split("\n");
    expect(lines).toHaveLength(1 + rows.length);
    expect(lines[0]).toBe(AUDIT_CSV_COLUMNS.join(","));
    expect(lines[1]).toContain('"e-1"');
    expect(lines[2]).toContain('"e-2"');
    expect(lines[3]).toContain('"e-3"');
  });

  it("every cell is a stored value or the page's own rendering of it", () => {
    const row = entry({
      id: "e-9",
      timestamp: "2026-03-04T10:00:00.000Z",
      userId: "u-9",
      userName: "Carla",
      action: "update",
      entityType: "proposal",
      entityId: "p-7",
      details: "changed the stored value",
    });
    const line = auditTrailCsv([row]).split("\n")[1];
    // Expected line built from the SAME record and the SAME formatter the
    // page renders with, so the file can never disagree with the screen.
    const expected = [
      "e-9",
      "2026-03-04T10:00:00.000Z",
      formatRecordedDateTime("2026-03-04T10:00:00.000Z"),
      "u-9",
      "Carla",
      "update",
      "proposal",
      "p-7",
      "changed the stored value",
    ].map(v => `"${v}"`).join(",");
    expect(line).toBe(expected);
  });

  it("invents no columns: the header holds only fields the audit_log projection provides", () => {
    // The most damaging historical defect on the sibling page was exporting
    // fabricated gate-check "pass" columns as audit evidence. Guard the header.
    const header = auditTrailCsv(rows).split("\n")[0]!.toLowerCase();
    expect(header).not.toContain("gate");
    expect(header).not.toContain("status");
    expect(header).not.toContain("approved");
    expect(AUDIT_CSV_COLUMNS).toEqual([
      "ID",
      "Timestamp (stored)",
      "Timestamp (as shown)",
      "User ID",
      "User Name",
      "Action",
      "Entity Type",
      "Entity ID",
      "Details",
    ]);
  });

  it("escapes quotes, commas and newlines so hostile stored text cannot split rows", () => {
    const hostile = entry({
      id: "e-h",
      details: 'He said "stop", then\nsaved again',
      userName: "Comma, Name",
    });
    const csv = auditTrailCsv([hostile]);
    expect(csv).toContain('"He said ""stop"", then\nsaved again"');
    expect(csv).toContain('"Comma, Name"');
    // Structure check: exactly one header line and one (quoted) record even
    // though the stored detail contains a newline — CSV-quoting keeps it one
    // logical row.
    const recordPart = csv.slice(csv.indexOf("\n") + 1);
    expect(recordPart.startsWith('"e-h"')).toBe(true);
  });

  it("renders an unreadable stored timestamp honestly — never 'Invalid Date'", () => {
    const bad = entry({ id: "e-bad", timestamp: "not-a-real-instant" });
    const none = entry({ id: "e-none", timestamp: "" });
    const csv = auditTrailCsv([bad, none]);
    expect(csv).toContain(`"${TIMESTAMP_UNREADABLE}"`);
    expect(csv).toContain(`"${TIMESTAMP_NOT_RECORDED}"`);
    expect(csv).not.toContain("Invalid Date");
  });

  it("composed with filterAuditEntries, exports exactly the rows the list renders", () => {
    const filtered = filterAuditEntries(rows, "quote", "all");
    const csv = auditTrailCsv(filtered);
    expect(csv).toContain('"e-1"');
    expect(csv).toContain('"e-2"');
    // e-3 is on screen only when the filter is cleared; it must not leak into
    // a file that claims to be the shown rows.
    expect(csv).not.toContain('"e-3"');
    expect(csv.split("\n")).toHaveLength(1 + filtered.length);
  });

  it("zero rows produce a header-only string (the page refuses to download it)", () => {
    expect(auditTrailCsv([])).toBe(AUDIT_CSV_COLUMNS.join(","));
  });
});

describe("auditTrailExportFileName", () => {
  it("names the file by the UTC date of the export", () => {
    expect(auditTrailExportFileName(new Date("2026-08-18T22:15:00.000Z"))).toBe("audit-trail-2026-08-18.csv");
  });
});
