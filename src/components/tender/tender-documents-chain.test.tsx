/**
 * tender-documents-chain.test.tsx — TCW-T5 (Tender Functional Closure Wave).
 *
 * Honest-failure reporting for the tender document upload chain
 * (TenderDocumentModal) and metadata saves:
 *
 *   step 1  Supabase Storage upload          ┐ document-vault.uploadDocument
 *   step 2  generated_documents row insert   ┘ (throws on either failure)
 *   step 3  tender register entry            addTenderDocument →
 *           type_details.documents on the canonical commercial_tickets row
 *
 * Pins:
 *   - a step-1/2 failure reports "nothing stored" (the vault helper throws
 *     before returning);
 *   - a step-3 failure AFTER steps 1–2 succeeded is reported as exactly that:
 *     stored in the vault but NOT listed on this tender, naming the vault
 *     record and warning that a re-upload would duplicate the file — never a
 *     generic failure, never a success (GUARD anchor);
 *   - 'saved_with_audit_warning' surfaces amber on both the upload and the
 *     metadata paths, never as plain success.
 */
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/supabase-tender-actions";

// Hermetic: the modal's import chain reaches the Supabase client and the real
// write layer; neither is exercised here (the chain runner takes injected deps).
vi.mock("@/lib/supabase", () => ({ supabase: { __double: true } }));
vi.mock("@/lib/document-vault", () => ({
  uploadDocument: vi.fn(async () => ({ id: "unused" })),
  getSignedDownloadUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase-tender-actions", () => ({
  addTenderDocument: vi.fn(async () => ({ success: true })),
  updateTenderDocumentMetadata: vi.fn(async () => ({ success: true })),
}));

import {
  describeMetadataSaveResult,
  describeUploadLinkFailure,
  performDocumentUploadChain,
} from "./TenderDocumentModal";

const uploaded = { id: "gd-42", filePath: "customers/c-1/x.pdf", uploadedBy: "Session Operator" };

function chain(linkResult: ActionResult | Error, uploadError?: Error) {
  return performDocumentUploadChain({
    upload: async () => {
      if (uploadError) throw uploadError;
      return uploaded;
    },
    link: async () => {
      if (linkResult instanceof Error) throw linkResult;
      return linkResult;
    },
  });
}

describe("performDocumentUploadChain — three-step honesty", () => {
  it("a storage/vault failure (steps 1–2) reports not_saved with the thrown reason — nothing was stored", async () => {
    const report = await chain({ success: true }, new Error("File upload failed: bucket quota exceeded"));
    expect(report.kind).toBe("not_saved");
    if (report.kind === "not_saved") {
      expect(report.message).toContain("bucket quota exceeded");
    }
  });

  it("GUARD: a step-3 failure after steps 1–2 succeeded is NEVER reported as saved", async () => {
    const report = await chain({ success: false, error: "update affected no row (possible RLS block)" });
    expect(report.kind).not.toBe("saved");
    expect(report.kind).toBe("uploaded_not_linked");
  });

  it("the step-3 failure message names the vault record, the real reason, and the duplicate-upload risk", async () => {
    const report = await chain({ success: false, error: "revision conflict" });
    expect(report.kind).toBe("uploaded_not_linked");
    if (report.kind === "uploaded_not_linked") {
      expect(report.message).toContain("WAS uploaded");
      expect(report.message).toContain("gd-42");
      expect(report.message).toContain("revision conflict");
      expect(report.message).toContain("Do not upload the file again");
    }
  });

  it("a step-3 THROW (not just a failure result) is also reported as uploaded-not-linked, not swallowed", async () => {
    const report = await chain(new Error("network dropped mid-request"));
    expect(report.kind).toBe("uploaded_not_linked");
    if (report.kind === "uploaded_not_linked") {
      expect(report.message).toContain("network dropped mid-request");
    }
  });

  it("a fully confirmed chain reports saved with no amber note", async () => {
    const report = await chain({ success: true });
    expect(report).toEqual({ kind: "saved", amber: undefined });
  });

  it("a confirmed chain whose audit append was lost reports saved WITH the amber warning — never plain green", async () => {
    const report = await chain({
      success: true,
      status: "saved_with_audit_warning",
      auditWarning: "Saved, but the audit entry was not recorded: commercial_ticket_audit returned no stored row",
    });
    expect(report.kind).toBe("saved");
    if (report.kind === "saved") {
      expect(report.amber).toContain("audit entry was not recorded");
    }
  });

  it("a missing failure reason still produces an honest message, not undefined", async () => {
    const report = await chain({ success: false });
    if (report.kind === "uploaded_not_linked") {
      expect(report.message).toContain("no reason was returned");
    } else {
      throw new Error(`expected uploaded_not_linked, got ${report.kind}`);
    }
  });
});

describe("describeUploadLinkFailure — the message users act on", () => {
  it("carries the vault id, the reason, and the duplicate warning verbatim", () => {
    const message = describeUploadLinkFailure("gd-7", "RLS denied the update");
    expect(message).toContain("gd-7");
    expect(message).toContain("RLS denied the update");
    expect(message).toContain("duplicate");
  });
});

describe("describeMetadataSaveResult — metadata path honesty", () => {
  it("a failed metadata save reports not_saved with the real reason", () => {
    const report = describeMetadataSaveResult({ success: false, error: "zero-row update" });
    expect(report).toEqual({ kind: "not_saved", message: "zero-row update" });
  });

  it("a confirmed metadata save reports saved", () => {
    expect(describeMetadataSaveResult({ success: true })).toEqual({ kind: "saved", amber: undefined });
  });

  it("an audit-warning metadata save carries the amber note", () => {
    const report = describeMetadataSaveResult({
      success: true,
      status: "saved_with_audit_warning",
      auditWarning: "Saved, but the audit entry was not recorded: timeout",
    });
    if (report.kind !== "saved") throw new Error("expected saved");
    expect(report.amber).toContain("timeout");
  });
});
