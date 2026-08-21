/**
 * tender-save-outcome.test.ts — TCW-T4
 *
 * The lane-wide save contract every stage 6-15 tab threads through:
 *  - P2a: the ws revision token is threaded VERBATIM into the writer's
 *    trailing `expectedRevision` (and only when genuinely present);
 *  - P3: the four outcomes are classified honestly — a saved-with-audit-warning
 *    is never plain success, a stale refusal is non-destructive retry guidance,
 *    a failure carries the service's real reason.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastCalls = vi.hoisted(() => ({
  success: [] as any[][],
  warning: [] as any[][],
  error: [] as any[][],
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => { toastCalls.success.push(args); },
    warning: (...args: any[]) => { toastCalls.warning.push(args); },
    error: (...args: any[]) => { toastCalls.error.push(args); },
  },
}));

// The helper's ActionResult type import reaches supabase-tender-actions →
// @/lib/supabase; mock the client module so no env/client is required.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  classifySaveOutcome,
  reportSaveOutcome,
  saveTenderSectionWithOutcome,
  wsRevisionToken,
} from "@/components/tender/tender-save-outcome";

beforeEach(() => {
  toastCalls.success.length = 0;
  toastCalls.warning.length = 0;
  toastCalls.error.length = 0;
});

describe("wsRevisionToken (P2a)", () => {
  it("returns the bundle revision token verbatim when present", () => {
    expect(wsRevisionToken({ revisionToken: "2026-08-20T10:00:00.123456+00:00" }))
      .toBe("2026-08-20T10:00:00.123456+00:00");
  });

  it("returns undefined when the ws object does not carry a token (writer falls back to its own fresh-read lock)", () => {
    expect(wsRevisionToken({})).toBeUndefined();
    expect(wsRevisionToken(null)).toBeUndefined();
    expect(wsRevisionToken(undefined)).toBeUndefined();
    expect(wsRevisionToken({ revisionToken: null })).toBeUndefined();
    expect(wsRevisionToken({ revisionToken: "" })).toBeUndefined();
    expect(wsRevisionToken({ revisionToken: "   " })).toBeUndefined();
    expect(wsRevisionToken({ revisionToken: 42 })).toBeUndefined();
  });
});

describe("classifySaveOutcome (P3)", () => {
  it("plain success", () => {
    const outcome = classifySaveOutcome({ success: true }, "Record saved.");
    expect(outcome).toEqual({ kind: "saved", success: true, title: "Record saved." });
  });

  it("saved_with_audit_warning stays a CONFIRMED primary save but is never plain success", () => {
    const outcome = classifySaveOutcome(
      { success: true, status: "saved_with_audit_warning", auditWarning: "Saved, but the audit entry was not recorded: RLS denied insert" },
      "Record saved.",
    );
    expect(outcome.kind).toBe("saved_with_audit_warning");
    expect(outcome.success).toBe(true);
    expect(outcome.title).toContain("audit entry not recorded");
    expect(outcome.description).toContain("RLS denied insert");
  });

  it("stale is a refusal with NON-destructive retry guidance (entry preserved)", () => {
    const outcome = classifySaveOutcome(
      { success: false, status: "stale", error: "Tender changed after this edit began. Review the current value and retry without losing your entry." },
      "Record saved.",
    );
    expect(outcome.kind).toBe("stale");
    expect(outcome.success).toBe(false);
    expect(outcome.title).toContain("tender changed");
    expect(outcome.description).toContain("Tender changed after this edit began");
    expect(outcome.description).toContain("still on this screen");
  });

  it("failure carries the service's real reason", () => {
    const outcome = classifySaveOutcome({ success: false, error: "commercial_tickets returned no stored row" }, "Record saved.");
    expect(outcome.kind).toBe("failed");
    expect(outcome.success).toBe(false);
    expect(outcome.description).toContain("no stored row");
  });
});

describe("reportSaveOutcome toast mapping", () => {
  it("success → toast.success only", () => {
    expect(reportSaveOutcome({ success: true }, "Saved.")).toBe(true);
    expect(toastCalls.success).toHaveLength(1);
    expect(toastCalls.warning).toHaveLength(0);
    expect(toastCalls.error).toHaveLength(0);
  });

  it("audit warning → amber warning toast, still returns confirmed=true", () => {
    expect(reportSaveOutcome({ success: true, status: "saved_with_audit_warning", auditWarning: "Saved, but the audit entry was not recorded: timeout" }, "Saved.")).toBe(true);
    expect(toastCalls.success).toHaveLength(0);
    expect(toastCalls.warning).toHaveLength(1);
    expect(String(toastCalls.warning[0][0])).toContain("audit entry not recorded");
  });

  it("stale → warning toast, returns false so callers keep the entry and skip reload", () => {
    expect(reportSaveOutcome({ success: false, status: "stale", error: "Tender changed after this edit began." }, "Saved.")).toBe(false);
    expect(toastCalls.warning).toHaveLength(1);
    expect(toastCalls.error).toHaveLength(0);
  });

  it("failure → error toast, returns false", () => {
    expect(reportSaveOutcome({ success: false, error: "boom" }, "Saved.")).toBe(false);
    expect(toastCalls.error).toHaveLength(1);
  });
});

describe("saveTenderSectionWithOutcome (P2a threading through the writer signature)", () => {
  it("threads the ws revision token VERBATIM as the writer's trailing expectedRevision", async () => {
    const writer = vi.fn(async () => ({ success: true }));
    const ws = { revisionToken: "2026-08-20T09:30:11.000+00:00" };
    const result = await saveTenderSectionWithOutcome(
      writer as any, "tender-1", "submission_record", { submitted_by: "A" }, "Submission log recorded", ws, "Submission record saved.",
    );
    expect(result.success).toBe(true);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith(
      "tender-1",
      "submission_record",
      { submitted_by: "A" },
      "Submission log recorded",
      "2026-08-20T09:30:11.000+00:00",
    );
  });

  it("passes undefined (never a fabricated token) when the ws carries none", async () => {
    const writer = vi.fn(async (..._args: any[]) => ({ success: true }));
    await saveTenderSectionWithOutcome(writer as any, "tender-1", "proposal_blocks", [], "Proposal blocks updated", {}, "Proposal blocks saved.");
    expect(writer.mock.calls[0][4]).toBeUndefined();
  });

  it("stale writer outcome is surfaced as the non-destructive warning and returned unconfirmed", async () => {
    const writer = vi.fn(async () => ({ success: false, status: "stale" as const, error: "Tender changed after this edit began." }));
    const result = await saveTenderSectionWithOutcome(writer as any, "tender-1", "approval_record", {}, "Manual final approval record", { revisionToken: "t0" }, "Final approval record saved.");
    expect(result.success).toBe(false);
    expect(result.status).toBe("stale");
    expect(toastCalls.warning).toHaveLength(1);
    expect(toastCalls.success).toHaveLength(0);
  });

  it("audit-warning outcome returns the confirmed result with its warning intact", async () => {
    const writer = vi.fn(async () => ({ success: true, status: "saved_with_audit_warning" as const, auditWarning: "Saved, but the audit entry was not recorded: x" }));
    const result = await saveTenderSectionWithOutcome(writer as any, "tender-1", "proposal_blocks", [], "r", {}, "Proposal blocks saved.");
    expect(result.success).toBe(true);
    expect(result.auditWarning).toContain("not recorded");
    expect(toastCalls.warning).toHaveLength(1);
  });
});
