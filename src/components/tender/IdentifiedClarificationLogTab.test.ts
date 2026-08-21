/**
 * IdentifiedClarificationLogTab.test.ts — TCW-T3 (Tender Functional Closure
 * Wave), work item 6.
 *
 * The stage-1 clarification log is a TWO-WRITE pair (clarification_log rows,
 * then clarification_log_notes) because the T1 section writer persists exactly
 * one section per call. The pair contract under test:
 *   - the UI-load revision token is threaded into the FIRST write only; the
 *     second write relies on the save layer's fresh in-call read (the first
 *     write's new token is not exposed by ActionResult);
 *   - the second write runs ONLY after the first is confirmed;
 *   - a second-write failure is reported as an HONEST PARTIAL outcome that
 *     names exactly which half persisted;
 *   - stale on the first write is non-destructive and arms the informed retry;
 *   - audit warnings from either half aggregate into one amber outcome.
 *
 * House pattern: pure orchestration exported from the component, no DOM.
 */
import { describe, expect, it, vi } from "vitest";
import { saveClarificationPair } from "./IdentifiedClarificationLogTab";

const OK = { success: true } as const;
const AUDIT_WARN = {
  success: true,
  status: "saved_with_audit_warning",
  auditWarning: "Saved, but the audit entry was not recorded: timeout",
} as const;
const STALE = {
  success: false,
  status: "stale",
  error: "Tender changed after this edit began. Review the current value and retry without losing your entry.",
} as const;
const FAILED = { success: false, error: "Tender save affected no row." } as const;

describe("saveClarificationPair", () => {
  it("threads the UI token into write 1 only; write 2 runs after confirmation with the save layer's own fresh read", async () => {
    const seen: Array<string | undefined> = [];
    const saveLog = vi.fn(async (expectedRevision: string | undefined) => { seen.push(expectedRevision); return OK; });
    const saveNotes = vi.fn(async () => OK);

    const result = await saveClarificationPair({
      saveLog, saveNotes, revisionToken: "rev-ui-load", staleRetryArmed: { current: false },
    });

    expect(seen).toEqual(["rev-ui-load"]);
    expect(saveNotes).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      savedRows: true,
      savedNotes: true,
      outcome: { kind: "saved", toastKind: "success", title: "Clarification log saved.", confirmedSaved: true },
    });
  });

  it("write 1 stale → NOTHING saved, notes write never attempted, informed retry armed, service message surfaced", async () => {
    const saveNotes = vi.fn(async () => OK);
    const armed = { current: false };

    const result = await saveClarificationPair({
      saveLog: async () => STALE, saveNotes, revisionToken: "rev-ui-load", staleRetryArmed: armed,
    });

    expect(result.savedRows).toBe(false);
    expect(result.savedNotes).toBe(false);
    expect(result.outcome.kind).toBe("stale");
    expect(result.outcome.description).toContain("retry without losing your entry");
    expect(saveNotes).not.toHaveBeenCalled();
    expect(armed.current).toBe(true);
  });

  it("after a stale refusal the retry omits the known-stale token", async () => {
    const seen: Array<string | undefined> = [];
    const result = await saveClarificationPair({
      saveLog: async expectedRevision => { seen.push(expectedRevision); return OK; },
      saveNotes: async () => OK,
      revisionToken: "rev-ui-load-stale",
      staleRetryArmed: { current: true },
    });
    expect(seen).toEqual([undefined]);
    expect(result.savedRows).toBe(true);
  });

  it("write 1 plain failure → nothing saved, honest reason, notes never attempted", async () => {
    const saveNotes = vi.fn(async () => OK);
    const result = await saveClarificationPair({
      saveLog: async () => FAILED, saveNotes, revisionToken: "rev-ui-load",
    });
    expect(result.savedRows).toBe(false);
    expect(result.savedNotes).toBe(false);
    expect(result.outcome.kind).toBe("failed");
    expect(result.outcome.description).toContain("affected no row");
    expect(saveNotes).not.toHaveBeenCalled();
  });

  it("write 1 confirmed + write 2 failed → HONEST PARTIAL: says the questions saved and the notes did not", async () => {
    const result = await saveClarificationPair({
      saveLog: async () => OK,
      saveNotes: async () => FAILED,
      revisionToken: "rev-ui-load",
    });
    expect(result.savedRows).toBe(true);
    expect(result.savedNotes).toBe(false);
    expect(result.outcome.confirmedSaved).toBe(false);
    expect(result.outcome.title).toBe("Partial save — questions saved, notes NOT saved.");
    expect(result.outcome.description).toContain("question rows were saved");
    expect(result.outcome.description).toContain("notes were not");
    expect(result.outcome.description).toContain("affected no row");
  });

  it("a throwing notes write is the same honest partial outcome, never an unhandled rejection", async () => {
    const result = await saveClarificationPair({
      saveLog: async () => OK,
      saveNotes: async () => { throw new Error("network down"); },
      revisionToken: "rev-ui-load",
    });
    expect(result.savedRows).toBe(true);
    expect(result.savedNotes).toBe(false);
    expect(result.outcome.description).toContain("network down");
  });

  it("audit warnings from either half aggregate into one amber confirmed outcome naming the half", async () => {
    const both = await saveClarificationPair({
      saveLog: async () => AUDIT_WARN, saveNotes: async () => AUDIT_WARN, revisionToken: "rev",
    });
    expect(both.savedRows && both.savedNotes).toBe(true);
    expect(both.outcome.kind).toBe("saved_with_audit_warning");
    expect(both.outcome.confirmedSaved).toBe(true);
    expect(both.outcome.description).toContain("questions:");
    expect(both.outcome.description).toContain("notes:");

    const notesOnly = await saveClarificationPair({
      saveLog: async () => OK, saveNotes: async () => AUDIT_WARN, revisionToken: "rev",
    });
    expect(notesOnly.outcome.kind).toBe("saved_with_audit_warning");
    expect(notesOnly.outcome.description).toContain("notes:");
    expect(notesOnly.outcome.description).not.toContain("questions:");
  });
});
