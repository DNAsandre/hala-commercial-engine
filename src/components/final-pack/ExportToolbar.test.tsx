/**
 * ExportToolbar.test.tsx — SC-01 Wave 04, lane W04-C4.
 *
 * Defect C (UI half): the toolbar showed the same green tick whether a file was
 * downloaded, the browser's print dialog was merely opened, or the export audit
 * row was lost. What the toolbar tells the user must match what actually
 * happened.
 */
import { describe, expect, it } from "vitest";
import { actionStateForExportResult, describeExportOutcome } from "./ExportToolbar";

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

  it("distinguishes a printable window from a print dialog", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "print_window_opened",
      auditPersisted: true,
    });
    expect(text).toContain("Printable document opened");
    expect(text).toContain("could not be invoked");
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

  it("reports a final lifecycle status that was not confirmed stored", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "file_downloaded",
      auditPersisted: true,
      instanceStatus: "exported",
      instanceStatusPersisted: false,
      instanceStatusError: "read-back returned no row",
    });
    expect(text).toContain("lifecycle status was NOT confirmed stored");
    expect(text).toContain("read-back returned no row");
  });

  it("surfaces durable-HTML asset warnings", () => {
    const text = describeExportOutcome({
      success: true,
      delivered: "file_downloaded",
      auditPersisted: true,
      advisoryNotes: ["1 image could not be embedded and may expire."],
    });
    expect(text).toContain("could not be embedded");
  });
});

describe("actionStateForExportResult", () => {
  it("never gives a print-only outcome the green-success state", () => {
    expect(actionStateForExportResult({ success: true, delivered: "print_dialog_opened" })).toBe("opened");
    expect(actionStateForExportResult({ success: true, delivered: "print_window_opened" })).toBe("opened");
  });

  it("uses success only for a real file/server handoff", () => {
    expect(actionStateForExportResult({ success: true, delivered: "file_downloaded" })).toBe("success");
    expect(actionStateForExportResult({ success: true, delivered: "server_file_opened" })).toBe("success");
  });
});
