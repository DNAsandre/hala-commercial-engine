import { beforeEach, describe, expect, it, vi } from "vitest";

const vault = vi.hoisted(() => ({
  status: "generated" as "generated" | "superseded" | "archived" | null,
  archived: [] as string[],
  restored: [] as Array<{ id: string; status: string }>,
  restoreError: null as Error | null,
}));

const canonical = vi.hoisted(() => ({
  result: { success: true } as { success: boolean; error?: string; auditWarning?: string },
  calls: [] as Array<{ tenderId: string; documentId: string }>,
}));

vi.mock("@/lib/document-vault", () => ({
  getPersistedDocumentStatus: vi.fn(async () => vault.status),
  softDeleteDocument: vi.fn(async (id: string) => { vault.archived.push(id); }),
  restoreDocument: vi.fn(async (id: string, status: string) => {
    if (vault.restoreError) throw vault.restoreError;
    vault.restored.push({ id, status });
  }),
}));

vi.mock("@/lib/supabase-tender-actions", () => ({
  archiveTenderDocument: vi.fn(async (tenderId: string, documentId: string) => {
    canonical.calls.push({ tenderId, documentId });
    return canonical.result;
  }),
}));

import { archiveTenderDocumentRecords } from "./tender-document-archive";

beforeEach(() => {
  vault.status = "generated";
  vault.archived = [];
  vault.restored = [];
  vault.restoreError = null;
  canonical.result = { success: true };
  canonical.calls = [];
});

describe("archiveTenderDocumentRecords", () => {
  it("archives both linked records and preserves audit warnings", async () => {
    canonical.result = { success: true, auditWarning: "history unavailable" };
    const result = await archiveTenderDocumentRecords("t-1", "d-1");
    expect(result).toEqual({ success: true, auditWarning: "history unavailable" });
    expect(vault.archived).toEqual(["d-1"]);
    expect(canonical.calls).toEqual([{ tenderId: "t-1", documentId: "d-1" }]);
  });

  it("archives a canonical-only document without inventing a vault row", async () => {
    vault.status = null;
    await expect(archiveTenderDocumentRecords("t-1", "d-1")).resolves.toEqual({ success: true });
    expect(vault.archived).toEqual([]);
    expect(vault.restored).toEqual([]);
  });

  it("restores the exact previous vault status when the canonical write fails", async () => {
    vault.status = "superseded";
    canonical.result = { success: false, error: "revision conflict" };
    const result = await archiveTenderDocumentRecords("t-1", "d-1");
    expect(result).toEqual({ success: false, error: "revision conflict" });
    expect(vault.restored).toEqual([{ id: "d-1", status: "superseded" }]);
  });

  it("reports a failed rollback instead of hiding the split state", async () => {
    canonical.result = { success: false, error: "revision conflict" };
    vault.restoreError = new Error("vault permission denied");
    const result = await archiveTenderDocumentRecords("t-1", "d-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("revision conflict");
    expect(result.error).toContain("vault rollback also failed");
    expect(result.error).toContain("vault permission denied");
  });
});
