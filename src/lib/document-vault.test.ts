/**
 * document-vault.test.ts — SC-01 Wave 04, Fable-owned shared module.
 *
 * `DocumentViewer` resolved its preview URL through `getFileUrl()`, which
 * returns null unconditionally (the legacy in-memory Blob registry was removed
 * in Wave 02). Every document therefore rendered
 *   "This document does not have a valid file attached"
 * even when its bytes were really in Storage, and the Download button — gated
 * on the same value — never appeared at all.
 *
 * The viewer now signs the active version's real storage path. These tests pin
 * the choice of path, and the distinction the old code destroyed: "no stored
 * file" and "could not reach the stored file" are different answers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildDocumentStoragePath,
  downloadDocument,
  getDocumentsByWorkspace,
  getFileUrl,
  getPersistedDocumentStatus,
  hasRealFile,
  initializeDocumentVault,
  resolveVersionFilePath,
  restoreDocument,
  softDeleteDocument,
  updateDocumentMetadata,
} from "./document-vault";

const db = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; row: Record<string, unknown>; id?: string }>,
  error: null as { message: string } | null,
  readRows: [{ id: "doc-1", status: "generated" }] as Array<Record<string, any>>,
  signedUrl: null as string | null,
}));

vi.mock("./supabase", () => ({
  supabase: {
    from(table: string) {
      const call = { table, row: {} as Record<string, unknown>, id: undefined as string | undefined };
      let mode: "read" | "update" = "read";
      const builder: any = {
        update(row: Record<string, unknown>) { mode = "update"; call.row = row; db.updates.push(call); return builder; },
        eq(_column: string, value: string) { call.id = value; return builder; },
        select() { return builder; },
        order() { return builder; },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const result = db.error
            ? { data: null, error: db.error }
            : mode === "update"
              ? { data: [{ id: call.id, ...call.row }], error: null }
              : { data: db.readRows.filter(row => !call.id || row.id === call.id), error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
    storage: { from: () => ({ createSignedUrl: vi.fn(async () => ({ data: { signedUrl: db.signedUrl }, error: null })) }) },
  },
}));

beforeEach(() => {
  db.updates.length = 0;
  db.error = null;
  db.readRows = [{ id: "doc-1", status: "generated" }];
  db.signedUrl = null;
});

const version = (n: number, filePath: string | null) =>
  ({ versionNumber: n, filePath, fileName: `v${n}.pdf` }) as any;

const docWith = (versions: any[], currentVersion = 1, filePath: string | null = null) =>
  ({ versions, currentVersion, filePath }) as any;

describe("resolveVersionFilePath", () => {
  it("returns the requested version's stored path", () => {
    const doc = docWith([version(1, "docs/a-v1.pdf"), version(2, "docs/a-v2.pdf")], 2);
    expect(resolveVersionFilePath(doc, 1)).toBe("docs/a-v1.pdf");
    expect(resolveVersionFilePath(doc, 2)).toBe("docs/a-v2.pdf");
  });

  it("falls back to the current version when none is requested", () => {
    const doc = docWith([version(1, "docs/a-v1.pdf"), version(2, "docs/a-v2.pdf")], 2);
    expect(resolveVersionFilePath(doc, null)).toBe("docs/a-v2.pdf");
  });

  it("falls back to the record's own filePath when versions carry none", () => {
    const doc = docWith([version(1, null)], 1, "docs/legacy.pdf");
    expect(resolveVersionFilePath(doc, 1)).toBe("docs/legacy.pdf");
  });

  it("returns null only when there genuinely is no stored file", () => {
    expect(resolveVersionFilePath(docWith([version(1, null)], 1, null), 1)).toBeNull();
    expect(resolveVersionFilePath(docWith([], 1, null), 1)).toBeNull();
    // an empty string is not a path
    expect(resolveVersionFilePath(docWith([version(1, "")], 1, ""), 1)).toBeNull();
  });

  it("resolves a path for a document that has stored bytes — the case the old viewer called 'not attached'", () => {
    const doc = docWith([version(1, "documents/kafd/quote.pdf")], 1);
    expect(hasRealFile({ ...doc, filePath: "documents/kafd/quote.pdf" } as any)).toBe(true);
    expect(resolveVersionFilePath(doc, 1)).toBe("documents/kafd/quote.pdf");
    // and the helper the viewer used to rely on still cannot produce one
    expect(getFileUrl("any-id", 1)).toBeNull();
  });
});

describe("document archive persistence", () => {
  it("distinguishes a canonical-only Tender document from a stored vault row", async () => {
    db.readRows = [];
    await expect(getPersistedDocumentStatus("canonical-only")).resolves.toBeNull();
    expect(db.updates).toHaveLength(0);
  });

  it("confirms the archived status before reporting completion", async () => {
    await softDeleteDocument("doc-1");
    expect(db.updates).toEqual([{ table: "generated_documents", row: { status: "archived" }, id: "doc-1" }]);
  });

  it("confirms restore before reporting completion", async () => {
    await restoreDocument("doc-1", "superseded");
    expect(db.updates[0]).toMatchObject({ table: "generated_documents", row: { status: "superseded" }, id: "doc-1" });
  });

  it("throws an honest error when the stored status update fails", async () => {
    db.error = { message: "permission denied" };
    await expect(softDeleteDocument("doc-1")).rejects.toThrow("permission denied");
  });
});

describe("document storage lineage (PDS-63)", () => {
  it("places Tender uploads under the exact customer and Tender identities", () => {
    expect(buildDocumentStoragePath({
      customerId: "customer-7",
      tenderId: "tender-9",
      category: "Tenders",
      name: "Scope Pack",
      extension: "PDF",
      date: "2026-08-25",
      suffix: "abc12345",
    })).toBe("customers/customer-7/tenders/tender-9/Tenders/2026-08-25-Scope_Pack-abc12345.pdf");
  });

  it("places proposal/workspace uploads under the exact workspace identity", () => {
    const path = buildDocumentStoragePath({
      customerId: "customer-7",
      workspaceId: "proposal-3",
      category: "Supporting",
      name: "Customer brief",
      extension: "docx",
      date: "2026-08-25",
      suffix: "abc12345",
    });
    expect(path).toContain("customers/customer-7/workspaces/proposal-3/");
    expect(path).not.toContain("unknown");
    expect(path).not.toContain("unassigned");
  });

  it("refuses to fabricate a customer identity", () => {
    expect(() => buildDocumentStoragePath({
      customerId: " ", tenderId: "tender-9", category: "Tenders", name: "Scope", extension: "pdf",
    })).toThrow("Customer identity is required");
  });
});

describe("vault metadata truth (PDS-27)", () => {
  async function loadDocument() {
    db.readRows = [{
      id: "doc-1",
      workspace_id: "ws-1",
      file_name: "old-name.pdf",
      document_type: "Supporting",
      status: "generated",
      notes: "Old notes",
      storage_path: "customers/c/workspaces/ws-1/Supporting/old-name.pdf",
      mime_type: "application/pdf",
      version_number: 1,
    }];
    initializeDocumentVault();
    await vi.waitFor(() => expect(getDocumentsByWorkspace("ws-1")[0]?.name).toBe("old-name.pdf"));
    return getDocumentsByWorkspace("ws-1")[0];
  }

  it("persists only real columns and mutates the loaded view after confirmed read-back", async () => {
    const before = await loadDocument();
    expect(before.name).toBe("old-name.pdf");

    const updated = await updateDocumentMetadata("doc-1", {
      name: "Customer Brief.pdf",
      category: "Proposals",
      status: "Superseded",
      notes: "Reviewed",
    });

    expect(db.updates.at(-1)).toEqual({
      table: "generated_documents",
      id: "doc-1",
      row: {
        file_name: "Customer Brief.pdf",
        document_type: "Proposals",
        status: "superseded",
        notes: "Reviewed",
      },
    });
    expect(updated).toMatchObject({
      name: "Customer Brief.pdf",
      fileName: "Customer Brief.pdf",
      category: "Proposals",
      status: "Superseded",
      notes: "Reviewed",
    });
  });

  it("does not change the loaded view when persistence fails", async () => {
    const before = await loadDocument();
    db.error = { message: "write refused" };

    await expect(updateDocumentMetadata("doc-1", { name: "Not saved.pdf" })).rejects.toThrow("write refused");
    expect(before.name).toBe("old-name.pdf");
  });

  it("keeps Tender register metadata under one owner instead of writing the vault copy", async () => {
    db.readRows = [{
      id: "tender-doc-1",
      source_type: "tender",
      source_id: "tender-1",
      workspace_id: "tender-1",
      file_name: "scope.pdf",
      document_type: "Tenders",
      status: "generated",
      notes: "",
      storage_path: "customers/c/tenders/tender-1/Tenders/scope.pdf",
      mime_type: "application/pdf",
      version_number: 1,
    }];
    initializeDocumentVault();
    await vi.waitFor(() => expect(getDocumentsByWorkspace("ws-1")).toHaveLength(0));
    db.updates.length = 0;

    await expect(updateDocumentMetadata("tender-doc-1", { name: "renamed.pdf" }))
      .rejects.toThrow("owned by the Tender document register");
    expect(db.updates).toHaveLength(0);
  });
});

describe("missing-file honesty (PDS-61)", () => {
  it("rejects a download with no recorded path instead of silently doing nothing", async () => {
    await expect(downloadDocument({
      currentVersion: 1,
      versions: [],
      filePath: null,
      fileName: "missing.pdf",
    } as any)).rejects.toThrow("No stored file path");
  });

  it("rejects a path whose signed link cannot be created", async () => {
    await expect(downloadDocument({
      currentVersion: 1,
      versions: [version(1, "missing/object.pdf")],
      filePath: "missing/object.pdf",
      fileName: "missing.pdf",
    } as any)).rejects.toThrow("download link could not be generated");
  });
});
