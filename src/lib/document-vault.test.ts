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
import { getFileUrl, getPersistedDocumentStatus, hasRealFile, resolveVersionFilePath, restoreDocument, softDeleteDocument } from "./document-vault";

const db = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; row: Record<string, unknown>; id?: string }>,
  error: null as { message: string } | null,
  readRows: [{ id: "doc-1", status: "generated" }] as Array<{ id: string; status: string }>,
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
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const result = db.error
            ? { data: null, error: db.error }
            : mode === "update"
              ? { data: [{ id: call.id, status: call.row.status }], error: null }
              : { data: db.readRows.filter(row => !call.id || row.id === call.id), error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

beforeEach(() => {
  db.updates.length = 0;
  db.error = null;
  db.readRows = [{ id: "doc-1", status: "generated" }];
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
