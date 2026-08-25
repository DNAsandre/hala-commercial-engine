/**
 * submission-readiness-tabs.test.tsx — TCW-T5 (Tender Functional Closure Wave).
 *
 * The three rebuilt register tabs (Placeholders / Required Documents /
 * Compliance Matrix) on the T1 P1 contract, tested house-style (no jsdom):
 * exported pure logic asserted directly + react-dom/server markup for the
 * three-state load honesty.
 *
 * Pins:
 *   - honest three-state load projection (loading / failed-with-reason /
 *     loaded), raw rows preserved verbatim for CRUD;
 *   - per-item status ops receive the EXACT row id, the section's name field
 *     and `expectedRevision` from the tab's own confirmed read;
 *   - the full-section writer receives the exact rows + expectedRevision;
 *   - outcome mapping: confirmed save → saved; 'saved_with_audit_warning' →
 *     amber (never plain green); 'stale' → non-destructive retry; failure →
 *     the service's real reason (GUARD anchor: a failed ActionResult must
 *     never map to a saved outcome);
 *   - linked-document resolution is exact-id only with full-name display —
 *     never first-word/fuzzy matching;
 *   - the false B20 copy ("Status changes persist to Supabase") is gone from
 *     the rendered markup, replaced by read-back truth.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// ── hermetic module doubles (the pure logic under test never touches these) ──
vi.mock("@/lib/supabase", () => ({ supabase: { __double: true } }));
vi.mock("@/lib/supabase-tender-source-record", () => ({
  createSupabaseTenderSourceRecordStore: () => ({
    readActiveTender: async () => null,
    updateActiveTender: async () => ({ status: "failed" as const }),
    insertAudit: async () => ({}),
    listAudit: async () => [],
  }),
}));
vi.mock("@/lib/supabase-tender-actions", () => ({
  updatePlaceholderStatus: vi.fn(async () => ({ success: true })),
  updateRequiredDocStatus: vi.fn(async () => ({ success: true })),
  updateComplianceStatus: vi.fn(async () => ({ success: true })),
  updateTenderSubmissionReadinessData: vi.fn(async () => ({ success: true })),
}));
const toastCalls = vi.hoisted(() => ({
  success: [] as unknown[][],
  warning: [] as unknown[][],
  error: [] as unknown[][],
  info: [] as unknown[][],
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastCalls.success.push(a),
    warning: (...a: unknown[]) => toastCalls.warning.push(a),
    error: (...a: unknown[]) => toastCalls.error.push(a),
    info: (...a: unknown[]) => toastCalls.info.push(a),
  },
}));

import TenderPlaceholdersTab, {
  describeTenderWriteOutcome,
  newRegisterRowId,
  nextRowsWithout,
  nextRowsWithUpsert,
  notifyTenderWriteOutcome,
  patchedRowForSave,
  projectRegisterLoad,
  RegisterStateNotice,
  registerStatusLabel,
  registerStatusOptions,
  sectionCrudBlocker,
  submitPlaceholderStatusChange,
  submitRegisterSectionRows,
  validatePlaceholderDraft,
} from "./TenderPlaceholdersTab";
import TenderRequiredDocumentsTab, {
  documentLinkOptions,
  linkedDocumentDisplay,
  submitRequiredDocStatusChange,
  validateRequiredDocumentDraft,
} from "./TenderRequiredDocumentsTab";
import TenderComplianceMatrixTab, {
  submitComplianceStatusChange,
  validateComplianceDraft,
} from "./TenderComplianceMatrixTab";
import { buildTenderSourceAggregate } from "@/lib/tender-source-record";
import type { ActionResult } from "@/lib/supabase-tender-actions";
import type { TenderDocument, TenderWorkspace } from "@/lib/tender-workspace-data";

const TENDER_ID = "c9f10000-0000-4000-8000-0000000000t5";
const REV = "2026-08-21T09:00:00.000+00:00";

function storedRow(typeDetails: Record<string, unknown>) {
  return {
    id: TENDER_ID,
    ticket_type: "tender",
    active: true,
    updated_at: REV,
    ticket_title: "T5 register tender",
    type_details: typeDetails,
  };
}

function aggregateWithRegister(register: Record<string, unknown>) {
  return buildTenderSourceAggregate(storedRow({ submission_readiness: register, sow_data: { keep: 1 } }));
}

function text(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const WS_STUB = {
  tender: { id: TENDER_ID, title: "T5 register tender", customerId: "c-1", customerName: "Acme" },
  packs: [],
  placeholders: [],
  requiredDocuments: [],
  documents: [],
  complianceItems: [],
  activityEvents: [],
  auditEntries: [],
} as unknown as TenderWorkspace;

// ═════════════════════════════════════════════════════════════
// Three-state load projection
// ═════════════════════════════════════════════════════════════

describe("projectRegisterLoad — honest three-state read", () => {
  it("a read error is a FAILED view carrying the real reason", () => {
    const view = projectRegisterLoad(null, "RLS denied the select");
    expect(view).toEqual({ phase: "failed", message: "RLS denied the select" });
  });

  it("a missing/inactive canonical row is a FAILED view, never 'loaded empty'", () => {
    const view = projectRegisterLoad(null);
    expect(view.phase).toBe("failed");
    if (view.phase === "failed") {
      expect(view.message).toContain("commercial_tickets");
    }
  });

  it("a loaded row exposes the normalized facet, the verbatim revision token, and the RAW rows for CRUD", () => {
    const malformed = { label: "row without id", status: "pending" };
    const view = projectRegisterLoad(
      aggregateWithRegister({
        facet_note: "keep me",
        placeholders: [
          { id: "ph-1", label: "Bid validity", status: "pending", updated_at: "2026-08-19T09:00:00Z", updated_by: "Amin" },
          malformed,
        ],
      }),
    );
    expect(view.phase).toBe("loaded");
    if (view.phase !== "loaded") return;
    expect(view.revisionToken).toBe(REV);
    // Normalized view drops the structurally invalid row (display only)…
    expect(view.facet.placeholders.map((r) => r.id)).toEqual(["ph-1"]);
    // …but the RAW rows — the basis for every section write — keep it verbatim.
    expect(view.rawRows("placeholders")).toHaveLength(2);
    expect(view.rawRows("placeholders")[1]).toBe(malformed);
    expect(view.rawRows("required_documents")).toEqual([]);
  });

  it("an empty register loads as loaded-with-zero-rows (distinct from failed)", () => {
    const view = projectRegisterLoad(aggregateWithRegister({}));
    expect(view.phase).toBe("loaded");
    if (view.phase === "loaded") {
      expect(view.facet.placeholders).toEqual([]);
      expect(view.facet.required_documents).toEqual([]);
      expect(view.facet.compliance_items).toEqual([]);
    }
  });
});

// ═════════════════════════════════════════════════════════════
// Outcome mapping (GUARD anchor)
// ═════════════════════════════════════════════════════════════

describe("describeTenderWriteOutcome — ActionResult → UI truth", () => {
  it("a confirmed save maps to saved", () => {
    expect(describeTenderWriteOutcome({ success: true })).toEqual({ kind: "saved" });
  });

  it("'saved_with_audit_warning' maps to the amber outcome with the real warning — never plain saved", () => {
    const outcome = describeTenderWriteOutcome({
      success: true,
      status: "saved_with_audit_warning",
      auditWarning: "Saved, but the audit entry was not recorded: RLS block",
    });
    expect(outcome.kind).toBe("saved_with_audit_warning");
    if (outcome.kind === "saved_with_audit_warning") {
      expect(outcome.warning).toContain("RLS block");
    }
  });

  it("'stale' maps to a non-destructive retry outcome carrying the service's message", () => {
    const outcome = describeTenderWriteOutcome({
      success: false,
      status: "stale",
      error: "Tender changed after this edit began.",
    });
    expect(outcome.kind).toBe("stale");
    if (outcome.kind === "stale") {
      expect(outcome.message).toContain("Tender changed");
    }
  });

  it("GUARD: a failed ActionResult is a FAILURE outcome with the real reason — never saved", () => {
    const outcome = describeTenderWriteOutcome({ success: false, error: "update affected no row" });
    expect(outcome.kind).toBe("failed");
    if (outcome.kind === "failed") {
      expect(outcome.message).toBe("update affected no row");
    }
  });

  it("notifyTenderWriteOutcome reports saved-ish outcomes as true and keeps stale/failed at false (entry preserved)", () => {
    toastCalls.success.length = 0;
    toastCalls.warning.length = 0;
    toastCalls.error.length = 0;
    expect(notifyTenderWriteOutcome({ kind: "saved" }, "ok")).toBe(true);
    expect(notifyTenderWriteOutcome({ kind: "saved_with_audit_warning", warning: "w" }, "ok")).toBe(true);
    expect(notifyTenderWriteOutcome({ kind: "stale", message: "s" }, "ok")).toBe(false);
    expect(notifyTenderWriteOutcome({ kind: "failed", message: "f" }, "ok")).toBe(false);
    expect(toastCalls.success).toHaveLength(1);
    // audit-warning and stale are WARNING toasts (amber), the failure is an error toast.
    expect(toastCalls.warning).toHaveLength(2);
    expect(toastCalls.error).toHaveLength(1);
    const staleDescription = (toastCalls.warning[1][1] as { description: string }).description;
    expect(staleDescription).toContain("Your entry is preserved");
  });
});

// ═════════════════════════════════════════════════════════════
// Mutation runners — exact ids + expectedRevision threading
// ═════════════════════════════════════════════════════════════

type Recorded = { args: unknown[] };

function recordingUpdate(result: ActionResult) {
  const rec: Recorded & { fn: (...args: unknown[]) => Promise<ActionResult> } = {
    args: [],
    fn: async (...args: unknown[]) => {
      rec.args = args;
      return result;
    },
  };
  return rec;
}

describe("per-item status ops — exact id, name field, previous status, expectedRevision", () => {
  const deps = { tenderId: TENDER_ID, revisionToken: REV };

  it("placeholder: threads the exact row id + label + prev/next and the read-time revision; value is left untouched", async () => {
    const rec = recordingUpdate({ success: true });
    const outcome = await submitPlaceholderStatusChange(
      deps,
      { id: "ph-77", label: "Bank guarantee ref", status: "pending" },
      "approved",
      rec.fn as never,
    );
    expect(outcome).toEqual({ kind: "saved" });
    expect(rec.args).toEqual([
      TENDER_ID,
      "ph-77",
      "Bank guarantee ref",
      "pending",
      "approved",
      undefined, // no value clobber on a bare status change
      { expectedRevision: REV },
    ]);
  });

  it("required document: threads exact id + document_name + expectedRevision", async () => {
    const rec = recordingUpdate({ success: true });
    await submitRequiredDocStatusChange(
      deps,
      { id: "rd-9", document_name: "Commercial registration", status: "missing" },
      "uploaded",
      rec.fn as never,
    );
    expect(rec.args).toEqual([
      TENDER_ID,
      "rd-9",
      "Commercial registration",
      "missing",
      "uploaded",
      { expectedRevision: REV },
    ]);
  });

  it("compliance: threads exact id + requirement + expectedRevision and preserves stored evidence on a bare status change", async () => {
    const rec = recordingUpdate({ success: true });
    await submitComplianceStatusChange(
      deps,
      { id: "ci-3", requirement: "ADR-certified drivers", status: "in_review" },
      "compliant",
      rec.fn as never,
    );
    expect(rec.args).toEqual([
      TENDER_ID,
      "ci-3",
      "ADR-certified drivers",
      "in_review",
      "compliant",
      undefined, // evidence not clobbered
      { expectedRevision: REV },
    ]);
  });

  it("a stale refusal from the writer surfaces as the stale outcome (retry offered, nothing lost)", async () => {
    const rec = recordingUpdate({ success: false, status: "stale", error: "Tender changed before save completed." });
    const outcome = await submitPlaceholderStatusChange(
      deps,
      { id: "ph-1", label: "L", status: "pending" },
      "approved",
      rec.fn as never,
    );
    expect(outcome.kind).toBe("stale");
  });

  it("an audit-warning save surfaces as the amber outcome, not plain success", async () => {
    const rec = recordingUpdate({
      success: true,
      status: "saved_with_audit_warning",
      auditWarning: "Saved, but the audit entry was not recorded: timeout",
    });
    const outcome = await submitRequiredDocStatusChange(
      deps,
      { id: "rd-1", document_name: "VAT certificate", status: "missing" },
      "approved",
      rec.fn as never,
    );
    expect(outcome.kind).toBe("saved_with_audit_warning");
  });
});

describe("submitRegisterSectionRows — full-section CRUD writer call", () => {
  it("passes the exact section rows with expectedRevision + reason in the opts object", async () => {
    const rec = recordingUpdate({ success: true });
    const rows = [{ id: "ph-1", label: "A", status: "pending" }];
    const outcome = await submitRegisterSectionRows(
      { tenderId: TENDER_ID, revisionToken: REV },
      "placeholders",
      rows,
      "Placeholder added: A",
      rec.fn as never,
    );
    expect(outcome).toEqual({ kind: "saved" });
    expect(rec.args).toEqual([
      TENDER_ID,
      "placeholders",
      rows,
      { expectedRevision: REV, reason: "Placeholder added: A" },
    ]);
  });

  it("a failed section write carries the service's real reason", async () => {
    const rec = recordingUpdate({ success: false, error: 'Submission readiness placeholders row "x" has no label.' });
    const outcome = await submitRegisterSectionRows(
      { tenderId: TENDER_ID, revisionToken: REV },
      "placeholders",
      [],
      "",
      rec.fn as never,
    );
    expect(outcome.kind).toBe("failed");
    if (outcome.kind === "failed") expect(outcome.message).toContain("has no label");
  });
});

// ═════════════════════════════════════════════════════════════
// Row helpers — CRUD builds from RAW rows, sibling preservation
// ═════════════════════════════════════════════════════════════

describe("row helpers", () => {
  const raw = [
    { id: "a", label: "A", status: "pending" },
    { label: "malformed row without id", status: "pending" },
    { id: "b", label: "B", status: "approved", updated_at: "2026-08-01", updated_by: "Amin" },
  ];

  it("nextRowsWithUpsert appends a new row after the verbatim existing rows (malformed sibling preserved)", () => {
    const next = nextRowsWithUpsert(raw, { id: "c", label: "C", status: "pending" });
    expect(next).toHaveLength(4);
    expect(next[1]).toBe(raw[1]); // byte-preserved malformed sibling
    expect(next[3]).toEqual({ id: "c", label: "C", status: "pending" });
  });

  it("nextRowsWithUpsert replaces exactly the matching id in place", () => {
    const next = nextRowsWithUpsert(raw, { id: "a", label: "A2", status: "approved" });
    expect(next.map((r) => (r as { label: string }).label)).toEqual(["A2", "malformed row without id", "B"]);
  });

  it("nextRowsWithout removes exactly the target id and nothing else", () => {
    const next = nextRowsWithout(raw, "a");
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(raw[1]);
    expect(next[1]).toBe(raw[2]);
  });

  it("patchedRowForSave clears the audit stamps so the write layer re-stamps the true actor/time", () => {
    const patched = patchedRowForSave(raw[2], { label: "B edited" });
    expect(patched).toMatchObject({ id: "b", label: "B edited", updated_at: "", updated_by: "" });
    // The source row is not mutated.
    expect(raw[2]).toMatchObject({ label: "B", updated_at: "2026-08-01" });
  });

  it("sectionCrudBlocker surfaces the write layer's own refusal for stored rows that fail the contract", () => {
    expect(sectionCrudBlocker("placeholders", [{ id: "a", label: "A", status: "pending" }])).toBeNull();
    const blocked = sectionCrudBlocker("placeholders", raw);
    expect(blocked).toContain("has no id");
  });

  it("newRegisterRowId produces unique, section-prefixed ids", () => {
    const a = newRegisterRowId("placeholders");
    const b = newRegisterRowId("placeholders");
    expect(a).toMatch(/^ph-/);
    expect(newRegisterRowId("required_documents")).toMatch(/^rd-/);
    expect(newRegisterRowId("compliance_items")).toMatch(/^ci-/);
    expect(a).not.toBe(b);
  });

  it("draft validation requires the human name field", () => {
    expect(validatePlaceholderDraft({ label: " " })).toContain("label");
    expect(validatePlaceholderDraft({ label: "ok" })).toBeNull();
    expect(validateRequiredDocumentDraft({ document_name: "" })).toContain("document name");
    expect(validateRequiredDocumentDraft({ document_name: "CR cert" })).toBeNull();
    expect(validateComplianceDraft({ requirement: "" })).toContain("requirement");
    expect(validateComplianceDraft({ requirement: "ADR" })).toBeNull();
  });

  it("status metadata covers every canonical status including 'na'", () => {
    expect(registerStatusOptions("placeholders").map((o) => o.value)).toEqual(["pending", "in_progress", "approved", "na"]);
    expect(registerStatusOptions("required_documents").map((o) => o.value)).toEqual(["missing", "in_progress", "uploaded", "approved", "na"]);
    expect(registerStatusOptions("compliance_items").map((o) => o.value)).toEqual(["pending", "in_review", "compliant", "non_compliant", "na"]);
    expect(registerStatusLabel("compliance_items", "non_compliant")).toBe("Non-Compliant");
    expect(registerStatusLabel("placeholders", "na")).toBe("N/A");
  });
});

// ═════════════════════════════════════════════════════════════
// Linked-document matching — exact id only, full-name display
// ═════════════════════════════════════════════════════════════

describe("linked documents — exact-id matching, never fuzzy", () => {
  const documents = [
    { id: "doc-1", document_name: "Commercial Registration Certificate 2026" },
    { id: "doc-2", document_name: "Commercial Proposal — Volume 1" },
  ] as TenderDocument[];

  it("documentLinkOptions lists uploaded documents by exact id with their full names", () => {
    expect(documentLinkOptions(documents)).toEqual([
      { id: "doc-1", name: "Commercial Registration Certificate 2026" },
      { id: "doc-2", name: "Commercial Proposal — Volume 1" },
    ]);
  });

  it("a stored linked_document_id resolves to the FULL document name by exact id", () => {
    expect(linkedDocumentDisplay("doc-2", documents)).toEqual({
      linked: true,
      activeEvidence: true,
      label: "Commercial Proposal — Volume 1",
    });
  });

  it("an empty link renders as not linked", () => {
    expect(linkedDocumentDisplay("", documents)).toEqual({ linked: false, activeEvidence: false, label: "Not linked" });
    expect(linkedDocumentDisplay(undefined, documents)).toEqual({ linked: false, activeEvidence: false, label: "Not linked" });
  });

  it("a set-but-unresolvable id is reported honestly — no first-word fallback onto a similarly named document", () => {
    // Both stored documents start with "Commercial …" — a fuzzy matcher would
    // grab one of them. The exact-id contract must instead say "not found".
    const display = linkedDocumentDisplay("doc-404", documents);
    expect(display.linked).toBe(true);
    expect(display.label).toContain("not found");
    expect(display.label).toContain("doc-404");
    expect(display.label).not.toContain("Commercial Registration");
    expect(display.label).not.toContain("Volume 1");
    expect(display.activeEvidence).toBe(false);
  });

  it("an archived file is neither selectable nor counted as active evidence (PDS-28)", () => {
    const archived = {
      id: "doc-archived",
      document_name: "Old Commercial Registration",
      document_category: "Archived",
      status: "Reviewed",
    } as TenderDocument;

    expect(documentLinkOptions([...documents, archived])).toEqual([
      { id: "doc-1", name: "Commercial Registration Certificate 2026" },
      { id: "doc-2", name: "Commercial Proposal — Volume 1" },
    ]);
    expect(linkedDocumentDisplay("doc-archived", [...documents, archived])).toEqual({
      linked: true,
      activeEvidence: false,
      label: "Old Commercial Registration (archived — not active evidence)",
    });
  });
});

// ═════════════════════════════════════════════════════════════
// Rendered markup — three-state honesty + B20 copy removal
// ═════════════════════════════════════════════════════════════

describe("rendered markup (react-dom/server, house pattern)", () => {
  it("each tab's initial render is the honest LOADING state — no fabricated table, no 'Supabase-Backed' pill", () => {
    for (const element of [
      <TenderPlaceholdersTab key="p" ws={WS_STUB} tenderId={TENDER_ID} reload={() => {}} />,
      <TenderRequiredDocumentsTab key="r" ws={WS_STUB} tenderId={TENDER_ID} reload={() => {}} />,
      <TenderComplianceMatrixTab key="c" ws={WS_STUB} tenderId={TENDER_ID} reload={() => {}} />,
    ]) {
      const body = text(renderToStaticMarkup(element));
      expect(body).toContain("Loading register");
      expect(body).toContain("Saves are confirmed against the stored register before success is shown");
      // B20: the false persistence claim is gone.
      expect(body).not.toContain("Status changes persist to Supabase");
      expect(body).not.toContain("Supabase-Backed");
      // Advisory truth, no gating language.
      expect(body).toContain("nothing here blocks stage movement or submission");
    }
  });

  it("the FAILED notice carries the real reason and says it is a read failure, not an empty register", () => {
    const body = text(
      renderToStaticMarkup(
        <RegisterStateNotice state={{ phase: "failed", message: "permission denied for table commercial_tickets" }} />,
      ),
    );
    expect(body).toContain("permission denied for table commercial_tickets");
    expect(body).toContain("read failure, not an empty register");
  });

  it("the EMPTY notice invites adding the first row instead of implying a verdict", () => {
    const body = text(
      renderToStaticMarkup(
        <RegisterStateNotice state={{ phase: "empty", addFirstLabel: "No placeholders recorded yet — add the first." }} />,
      ),
    );
    expect(body).toContain("No placeholders recorded yet — add the first.");
  });
});
