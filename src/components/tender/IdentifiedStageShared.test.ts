/**
 * IdentifiedStageShared.test.ts — TCW-T3 (Tender Functional Closure Wave).
 *
 * The shared stage 1–5 save-outcome contract every converted tab routes
 * through:
 *   - the four ActionResult outcomes map to honest UI states (plain green is
 *     reserved for a confirmed save with a recorded audit entry; audit-warning
 *     saves are amber with the service's reason; stale is a non-destructive
 *     refusal carrying the service's own message; failures carry the real
 *     reason);
 *   - runTenderTabSave threads the UI-load revision token, fires onConfirmed
 *     on confirmed saves ONLY (the "onSaved on success only" discipline), and
 *     arms a one-shot informed retry after a stale refusal (the next attempt
 *     omits the known-stale token so the save layer's fresh in-call read
 *     supplies the revision — patch-merge writers still send only the tab's
 *     own keys, so the retry cannot clobber sibling data);
 *   - the B12 badge fix: green "Saved" requires a confirmed save in this
 *     session AND a clean form — data presence alone is not a save claim.
 *
 * House pattern: pure logic exported from the component module, no DOM.
 */
import { describe, expect, it, vi } from "vitest";
import {
  identifiedSavedBadgeState,
  resolveTenderTabSaveOutcome,
  runTenderTabSave,
  tenderRevisionTokenOf,
  type TenderTabSaveOutcome,
} from "./IdentifiedStageShared";

const LABELS = { saved: "Thing saved.", failed: "Failed to save thing." };

describe("resolveTenderTabSaveOutcome — the four save-layer outcomes", () => {
  it("plain success → green with the tab's saved label", () => {
    const outcome = resolveTenderTabSaveOutcome({ success: true }, LABELS);
    expect(outcome).toEqual({
      kind: "saved",
      toastKind: "success",
      title: "Thing saved.",
      confirmedSaved: true,
    });
  });

  it("saved_with_audit_warning → amber, still a CONFIRMED save, service reason verbatim", () => {
    const outcome = resolveTenderTabSaveOutcome(
      {
        success: true,
        status: "saved_with_audit_warning",
        auditWarning: "Saved, but the audit entry was not recorded: permission denied",
      },
      LABELS,
    );
    expect(outcome.kind).toBe("saved_with_audit_warning");
    expect(outcome.toastKind).toBe("warning");
    expect(outcome.title).toBe("Saved — audit entry not recorded");
    expect(outcome.description).toBe("Saved, but the audit entry was not recorded: permission denied");
    expect(outcome.confirmedSaved).toBe(true);
  });

  it("audit warning without a service reason still states the fact honestly", () => {
    const outcome = resolveTenderTabSaveOutcome(
      { success: true, status: "saved_with_audit_warning" },
      LABELS,
    );
    expect(outcome.description).toContain("audit entry was not recorded");
  });

  it("stale → NOT saved, carries the service's honest message plus the kept-entry promise", () => {
    const serviceMessage =
      "Tender changed after this edit began. Review the current value and retry without losing your entry.";
    const outcome = resolveTenderTabSaveOutcome(
      { success: false, status: "stale", error: serviceMessage },
      LABELS,
    );
    expect(outcome.kind).toBe("stale");
    expect(outcome.toastKind).toBe("error");
    expect(outcome.confirmedSaved).toBe(false);
    expect(outcome.description).toContain(serviceMessage);
    expect(outcome.description).toContain("Your entry is kept on screen");
  });

  it("failure → red with the service's real reason, never success", () => {
    const outcome = resolveTenderTabSaveOutcome(
      { success: false, error: "Tender save affected no row. The entered values remain available for retry." },
      LABELS,
    );
    expect(outcome.kind).toBe("failed");
    expect(outcome.confirmedSaved).toBe(false);
    expect(outcome.title).toBe("Failed to save thing.");
    expect(outcome.description).toContain("affected no row");
  });
});

describe("tenderRevisionTokenOf — the T1 bundle contract field", () => {
  it("returns the verbatim revisionToken string when present", () => {
    expect(tenderRevisionTokenOf({ revisionToken: "2026-08-19T09:38:11.074248+00:00" }))
      .toBe("2026-08-19T09:38:11.074248+00:00");
  });

  it("returns undefined for null / empty / missing / non-string values (writers fall back to their in-call token)", () => {
    expect(tenderRevisionTokenOf({ revisionToken: null })).toBeUndefined();
    expect(tenderRevisionTokenOf({ revisionToken: "" })).toBeUndefined();
    expect(tenderRevisionTokenOf({ revisionToken: 42 })).toBeUndefined();
    expect(tenderRevisionTokenOf({})).toBeUndefined();
    expect(tenderRevisionTokenOf(null)).toBeUndefined();
    expect(tenderRevisionTokenOf(undefined)).toBeUndefined();
  });
});

describe("identifiedSavedBadgeState — B12 badge truth", () => {
  it("green only after a confirmed save while clean; dirty or unconfirmed is never 'Saved'", () => {
    expect(identifiedSavedBadgeState(true, false)).toBe(true);
    expect(identifiedSavedBadgeState(true, true)).toBe(false);
    // No save confirmed this session — data presence alone must not claim Saved (C3 inverse).
    expect(identifiedSavedBadgeState(false, false)).toBe(false);
    expect(identifiedSavedBadgeState(false, true)).toBe(false);
  });
});

describe("runTenderTabSave — orchestration discipline", () => {
  function harness(result: { success: boolean; error?: string; status?: string; auditWarning?: string }) {
    const write = vi.fn(async (_expectedRevision: string | undefined) => result);
    const onConfirmed = vi.fn();
    const onStale = vi.fn();
    const announced: TenderTabSaveOutcome[] = [];
    const announce = (outcome: TenderTabSaveOutcome) => { announced.push(outcome); };
    const staleRetryArmed = { current: false };
    return { write, onConfirmed, onStale, announce, announced, staleRetryArmed };
  }

  it("threads the UI-load revision token into the write", async () => {
    const h = harness({ success: true });
    await runTenderTabSave({
      write: h.write, revisionToken: "rev-ui-load", staleRetryArmed: h.staleRetryArmed,
      labels: LABELS, onConfirmed: h.onConfirmed, onStale: h.onStale, announce: h.announce,
    });
    expect(h.write).toHaveBeenCalledWith("rev-ui-load");
  });

  it("confirmed save → onConfirmed fires exactly once, onStale never, flag disarmed", async () => {
    const h = harness({ success: true });
    h.staleRetryArmed.current = true; // even a previously armed flag clears on success
    const outcome = await runTenderTabSave({
      write: h.write, revisionToken: "rev-ui-load", staleRetryArmed: h.staleRetryArmed,
      labels: LABELS, onConfirmed: h.onConfirmed, onStale: h.onStale, announce: h.announce,
    });
    expect(outcome.kind).toBe("saved");
    expect(h.onConfirmed).toHaveBeenCalledTimes(1);
    expect(h.onStale).not.toHaveBeenCalled();
    expect(h.staleRetryArmed.current).toBe(false);
  });

  it("audit-warning save → still confirmed: onConfirmed fires, amber outcome announced", async () => {
    const h = harness({ success: true, status: "saved_with_audit_warning", auditWarning: "Saved, but the audit entry was not recorded: RLS" });
    await runTenderTabSave({
      write: h.write, revisionToken: "rev-ui-load", staleRetryArmed: h.staleRetryArmed,
      labels: LABELS, onConfirmed: h.onConfirmed, onStale: h.onStale, announce: h.announce,
    });
    expect(h.onConfirmed).toHaveBeenCalledTimes(1);
    expect(h.announced[0].toastKind).toBe("warning");
    expect(h.announced[0].description).toContain("RLS");
  });

  it("stale → NON-DESTRUCTIVE: onConfirmed is NOT called, onStale fires, retry armed", async () => {
    const h = harness({ success: false, status: "stale", error: "Tender changed after this edit began. Review the current value and retry without losing your entry." });
    const outcome = await runTenderTabSave({
      write: h.write, revisionToken: "rev-ui-load", staleRetryArmed: h.staleRetryArmed,
      labels: LABELS, onConfirmed: h.onConfirmed, onStale: h.onStale, announce: h.announce,
    });
    expect(outcome.kind).toBe("stale");
    expect(h.onConfirmed).not.toHaveBeenCalled();
    expect(h.onStale).toHaveBeenCalledTimes(1);
    expect(h.staleRetryArmed.current).toBe(true);
  });

  it("the attempt AFTER a stale refusal omits the known-stale token (informed retry via the save layer's fresh read)", async () => {
    const h = harness({ success: true });
    h.staleRetryArmed.current = true;
    await runTenderTabSave({
      write: h.write, revisionToken: "rev-ui-load-stale", staleRetryArmed: h.staleRetryArmed,
      labels: LABELS, onConfirmed: h.onConfirmed, onStale: h.onStale, announce: h.announce,
    });
    expect(h.write).toHaveBeenCalledWith(undefined);
    expect(h.staleRetryArmed.current).toBe(false);
  });

  it("plain failure → onConfirmed NOT called, onStale NOT called, flag disarmed", async () => {
    const h = harness({ success: false, error: "Tender save affected no row." });
    h.staleRetryArmed.current = true;
    const outcome = await runTenderTabSave({
      write: h.write, revisionToken: "rev-ui-load", staleRetryArmed: h.staleRetryArmed,
      labels: LABELS, onConfirmed: h.onConfirmed, onStale: h.onStale, announce: h.announce,
    });
    expect(outcome.kind).toBe("failed");
    expect(h.onConfirmed).not.toHaveBeenCalled();
    expect(h.onStale).not.toHaveBeenCalled();
    expect(h.staleRetryArmed.current).toBe(false);
  });

  it("a throwing write becomes an honest failed outcome — never a silent success", async () => {
    const onConfirmed = vi.fn();
    const announced: TenderTabSaveOutcome[] = [];
    const outcome = await runTenderTabSave({
      write: async () => { throw new Error("network down"); },
      revisionToken: "rev-ui-load",
      labels: LABELS,
      onConfirmed,
      announce: o => { announced.push(o); },
    });
    expect(outcome.kind).toBe("failed");
    expect(outcome.description).toContain("network down");
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
