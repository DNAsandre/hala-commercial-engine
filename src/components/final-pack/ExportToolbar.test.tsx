/**
 * ExportToolbar.test.tsx — SC-01 Wave 04, lane W04-C4.
 *
 * Defect C (UI half): the toolbar showed the same green tick whether a file was
 * downloaded, the browser's print dialog was merely opened, or the export audit
 * row was lost. What the toolbar tells the user must match what actually
 * happened.
 */
import { describe, expect, it } from "vitest";
import { describeExportOutcome } from "./ExportToolbar";

describe("describeExportOutcome", () => {
  it("says a file was handed to the browser only when it was", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "file_downloaded",
      auditPersisted: true,
    });
    expect(text).toContain("download");
    expect(text).not.toContain("cannot confirm");
  });

  it("says the print pipeline was invoked — not that a PDF was written", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "print_dialog_opened",
      auditPersisted: true,
    });
    expect(text).toContain("Print pipeline invoked");
    expect(text).toContain("cannot confirm the file was saved");
    // It must not claim a file exists.
    expect(text).not.toMatch(/file (was )?(written|saved successfully)/i);
  });

  it("reports an unconfirmed audit row alongside a genuine export", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "file_downloaded",
      auditPersisted: false,
      auditError: "new row violates row-level security policy",
    });
    expect(text).toContain("download");
    expect(text).toContain("NOT confirmed stored");
    expect(text).toContain("row-level security");
  });

  it("stays silent about persistence when the audit row did land", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "server_file_opened",
      auditPersisted: true,
    });
    expect(text).toContain("Server-rendered file opened");
    expect(text).not.toContain("NOT confirmed");
  });
});
