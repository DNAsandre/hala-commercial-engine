/**
 * tender-workspace-data.test.ts — SC-01 Wave 04, lane W04-C4.
 *
 * Contract under test — `buildRequiredDocumentsProgress`, which replaced the
 * Submitted → Submission Checklist progress bar in TenderWorkspace.tsx.
 *
 * The defect it closes: the page hardcoded a 14-item document list, fuzzy-
 * matched uploaded filenames against the FIRST WORD of each name, divided by a
 * literal `14`, and presented the result as this tender's progress. None of
 * that denominator was ever recorded for the tender being viewed.
 *
 * These are pure-function tests: no database is involved, because no database
 * was involved in the fabrication either.
 */
import { describe, expect, it } from "vitest";
import {
  buildRequiredDocumentsProgress,
  type TenderRequiredDocument,
} from "./tender-workspace-data";

function requirement(overrides: Partial<TenderRequiredDocument> = {}): TenderRequiredDocument {
  return {
    id: "rd-1",
    documentName: "VAT Certificate",
    packId: "pack-1",
    packName: "Master Pack",
    category: "compliance",
    owner: "Amin Al-Halabi",
    status: "awaiting",
    nativeRequired: true,
    signedPdfRequired: false,
    stampRequired: false,
    nativeStatus: "missing",
    signedPdfStatus: "not_required",
    evidenceStatus: "not_required",
    version: 1,
    includedInOutput: false,
    wouldBlockInProduction: false,
    lastUpdated: "2026-08-01T00:00:00.000Z",
    notes: "",
    ...overrides,
  } as TenderRequiredDocument;
}

describe("buildRequiredDocumentsProgress — no fabricated denominator", () => {
  it("reports NO percentage when no requirement set was read", () => {
    const p = buildRequiredDocumentsProgress({
      requiredDocuments: [],
      requiredDocumentsAssessed: false,
      uploadedDocumentNames: ["Final Tender Pack PDF", "VAT Certificate.pdf"],
    });

    // The old code would have said 14%–ish here purely from filename prefixes.
    expect(p.percent).toBeNull();
    expect(p.total).toBe(0);
    expect(p.note).toContain("not recorded");
  });

  it("does not let uploaded documents invent progress against a set that does not exist", () => {
    const p = buildRequiredDocumentsProgress({
      requiredDocuments: [],
      requiredDocumentsAssessed: false,
      // Every one of the old hardcoded 14 first-word prefixes.
      uploadedDocumentNames: [
        "final something", "obk native", "obk signed", "bid statement",
        "transition plan", "continuous improvement", "compliance pack",
        "commercial registration", "vat certificate", "iso 9001",
        "insurance cert", "adr class 2", "reference credentials",
        "performance guarantee",
      ],
    });

    expect(p.percent).toBeNull();
    expect(p.satisfied).toBe(0);
  });

  it("distinguishes 'no set recorded' from 'a set was read and it is empty'", () => {
    const notRead = buildRequiredDocumentsProgress({
      requiredDocuments: [],
      requiredDocumentsAssessed: false,
      uploadedDocumentNames: [],
    });
    const readAndEmpty = buildRequiredDocumentsProgress({
      requiredDocuments: [],
      requiredDocumentsAssessed: true,
      uploadedDocumentNames: [],
    });

    expect(notRead.percent).toBeNull();
    expect(readAndEmpty.percent).toBeNull();
    // Both decline to show a number, but they must not read the same to a human.
    expect(notRead.note).not.toBe(readAndEmpty.note);
    expect(readAndEmpty.note).toContain("No required documents are recorded");
  });

  it("derives the denominator from the recorded set, not from a literal", () => {
    const p = buildRequiredDocumentsProgress({
      requiredDocuments: [
        requirement({ id: "a", documentName: "VAT Certificate", status: "approved" }),
        requirement({ id: "b", documentName: "Commercial Registration", status: "awaiting" }),
        requirement({ id: "c", documentName: "Insurance Certificate", status: "awaiting" }),
      ],
      requiredDocumentsAssessed: true,
      uploadedDocumentNames: [],
    });

    expect(p.total).toBe(3);
    expect(p.satisfied).toBe(1);
    expect(p.percent).toBe(33);
  });

  it("counts an uploaded document only on a full name match, not a first-word prefix", () => {
    const required = [
      requirement({ id: "a", documentName: "Performance Guarantee Confirmation" }),
    ];

    // The old rule matched on the first word alone — "performance" — so an
    // unrelated "Performance Review Notes.pdf" scored as a satisfied
    // requirement. The full-name rule rejects it.
    const decoy = buildRequiredDocumentsProgress({
      requiredDocuments: required,
      requiredDocumentsAssessed: true,
      uploadedDocumentNames: ["Performance Review Notes.pdf"],
    });
    expect(decoy.satisfied).toBe(0);
    expect(decoy.percent).toBe(0);

    const real = buildRequiredDocumentsProgress({
      requiredDocuments: required,
      requiredDocumentsAssessed: true,
      uploadedDocumentNames: ["Performance Guarantee Confirmation (signed).pdf"],
    });
    expect(real.satisfied).toBe(1);
    expect(real.percent).toBe(100);
  });

  it("treats the requirement set's own recorded status as authoritative", () => {
    const p = buildRequiredDocumentsProgress({
      requiredDocuments: [
        requirement({ id: "a", documentName: "ISO Certificates", status: "signed" }),
        requirement({ id: "b", documentName: "ADR Class 2 Certifications", status: "rejected" }),
      ],
      requiredDocumentsAssessed: true,
      uploadedDocumentNames: [],
    });

    expect(p.satisfied).toBe(1);
    expect(p.percent).toBe(50);
  });
});
