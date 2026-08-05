/**
 * document-runtime-disclosure.test.ts — SC-01 Wave 04 (T08-B)
 *
 * Covers the three Wave 03 document-honesty observations owned by this lane:
 *
 *  - obs 9  — `GET /api/documents` caps the row set at `LIST_LIMIT` and says so
 *             in `{ limit, truncated }`. The client used to return only `data`,
 *             so a scope with more documents than the cap rendered a PARTIAL
 *             list that looked complete.
 *  - obs 10 — a failed document read was announced only by a transient toast
 *             over an empty list, so after the toast dismissed the panel read
 *             as genuinely empty.
 *  - obs 13 — a NULL `file_size` rendered as the literal string "NaN KB".
 *
 * The truncation flag is asserted to come from the SERVER envelope, never
 * inferred from the row count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLEAN_SERVER_BASE } from "@/lib/runtime-config";
import {
  DocumentRuntimeError,
  formatDocumentFileSize,
  listScopeDocumentsPageFromCleanServer,
  resolveDocumentListState,
} from "@/lib/document-runtime";

const sb = vi.hoisted(() => ({ session: null as { access_token?: string } | null }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: sb.session }, error: null }) },
    from: () => {
      throw new Error("this suite must not touch a table");
    },
  },
}));

let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  sb.session = { access_token: "test-access-token" };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listScopeDocumentsPageFromCleanServer — obs 9, truncation reaches the caller", () => {
  it("carries the server's truncated flag and limit alongside the rows", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: `doc-${i}`, file_name: `f${i}.pdf` }));
    fetchMock.mockResolvedValue(jsonResponse({ data: rows, count: 200, limit: 200, truncated: true }));

    const page = await listScopeDocumentsPageFromCleanServer("ws-1");

    expect(page.rows).toHaveLength(200);
    expect(page.truncated).toBe(true);
    expect(page.limit).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${CLEAN_SERVER_BASE}/api/documents?workspace_id=ws-1`,
    );
  });

  it("does not claim truncation when the server said the list was complete", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "doc-1" }], count: 1, limit: 200, truncated: false }));

    const page = await listScopeDocumentsPageFromCleanServer("ws-1");

    expect(page.truncated).toBe(false);
    expect(page.limit).toBe(200);
  });

  it("never INFERS truncation from the row count when the server declared none", async () => {
    // A bare array carries no envelope: the honest answer is "not truncated".
    fetchMock.mockResolvedValue(jsonResponse(Array.from({ length: 200 }, (_, i) => ({ id: `d${i}` }))));

    const page = await listScopeDocumentsPageFromCleanServer("ws-1");

    expect(page.rows).toHaveLength(200);
    expect(page.truncated).toBe(false);
    expect(page.limit).toBeNull();
  });

  it("still throws on a failed read rather than returning an empty page", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));

    await expect(listScopeDocumentsPageFromCleanServer("ws-1")).rejects.toBeInstanceOf(DocumentRuntimeError);
  });
});

describe("resolveDocumentListState — obs 10, error is not empty", () => {
  it("keeps a recorded failure visible instead of falling through to empty", () => {
    const state = resolveDocumentListState({
      loadState: "error",
      error: "Clean document server not reachable at http://localhost:5301/api/documents",
      count: 0,
    });

    expect(state.kind).toBe("error");
    expect(state).toMatchObject({ message: expect.stringContaining("not reachable") });
  });

  it("reports a real zero-row scope as empty, not as an error", () => {
    expect(resolveDocumentListState({ loadState: "loaded", error: null, count: 0 })).toEqual({
      kind: "empty",
      truncationNotice: null,
    });
  });

  it("still discloses truncation when THIS view has zero rows but the scope was capped", () => {
    const state = resolveDocumentListState({ loadState: "loaded", count: 0, truncated: true, limit: 200 });

    expect(state.kind).toBe("empty");
    expect((state as any).truncationNotice).toContain("Partial list");
  });

  it("distinguishes loading from both of them", () => {
    expect(resolveDocumentListState({ loadState: "loading", count: 0 })).toEqual({ kind: "loading" });
    expect(resolveDocumentListState({ loadState: "idle", count: 0 })).toEqual({ kind: "loading" });
  });

  it("an error outranks rows already on screen, so a stale list is never certified", () => {
    const state = resolveDocumentListState({ loadState: "error", error: "read refused", count: 3 });
    expect(state.kind).toBe("error");
  });

  it("discloses a partial list, naming the server's cap", () => {
    const state = resolveDocumentListState({ loadState: "loaded", count: 200, truncated: true, limit: 200 });

    expect(state.kind).toBe("list");
    expect(state).toMatchObject({
      count: 200,
      truncationNotice: expect.stringContaining("Partial list"),
    });
    expect((state as any).truncationNotice).toContain("200");
  });

  it("says nothing about truncation when the list is complete", () => {
    const state = resolveDocumentListState({ loadState: "loaded", count: 3, truncated: false });
    expect(state).toEqual({ kind: "list", count: 3, truncationNotice: null });
  });
});

describe("formatDocumentFileSize — obs 13, a null size is unknown, never a number", () => {
  it("renders an unknown size as unknown", () => {
    expect(formatDocumentFileSize(null)).toBe("Size unknown");
    expect(formatDocumentFileSize(undefined)).toBe("Size unknown");
    expect(formatDocumentFileSize("")).toBe("Size unknown");
    expect(formatDocumentFileSize("not-a-number")).toBe("Size unknown");
    expect(formatDocumentFileSize(NaN)).toBe("Size unknown");
    expect(formatDocumentFileSize(-1)).toBe("Size unknown");
  });

  it("never produces the string NaN", () => {
    for (const value of [null, undefined, {}, [], "abc", NaN, Infinity]) {
      expect(formatDocumentFileSize(value)).not.toMatch(/NaN/);
    }
  });

  it("renders a real size", () => {
    expect(formatDocumentFileSize(2048)).toBe("2.0 KB");
    expect(formatDocumentFileSize(512)).toBe("512 B");
    expect(formatDocumentFileSize(0)).toBe("0 B");
  });
});
