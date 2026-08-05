/**
 * document-runtime.test.ts — SC-01 Wave 03 (W03-4)
 *
 * Proves the document call paths are honest, across BOTH allocated transports:
 *  - row 69 (workspace list) reads generated_documents directly via Supabase,
 *  - rows 26-32 (proposal scope list, download, generate-pdf) use the clean
 *    server at an ABSOLUTE base — never a relative /api/... URL against the
 *    frontend origin.
 *
 * In both transports: real rows come back as real rows, zero rows is an empty
 * list (not an error), and every failure surfaces as an error — never a silent
 * empty list or a fake success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLEAN_SERVER_BASE } from "@/lib/runtime-config";
import {
  DocumentRuntimeError,
  fetchDocumentDownload,
  generateDocumentPdf,
  listScopeDocumentsFromCleanServer,
  listWorkspaceDocuments,
} from "@/lib/document-runtime";

// ─── mocked Supabase client (row 69) ─────────────────────────────────────────

const sb = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  calls: [] as Array<{ table: string; filters: Array<[string, unknown]>; order: unknown[] }>,
  session: null as { access_token?: string } | null,
  sessionThrows: null as Error | null,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => {
        if (sb.sessionThrows) throw sb.sessionThrows;
        return { data: { session: sb.session }, error: null };
      },
    },
    from(table: string) {
      const call = { table, filters: [] as Array<[string, unknown]>, order: [] as unknown[] };
      sb.calls.push(call);
      const builder: any = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          call.filters.push([column, value]);
          return builder;
        },
        order: (...args: unknown[]) => {
          call.order = args;
          return Promise.resolve(sb.result);
        },
      };
      return builder;
    },
  },
}));

const JSON_HEADERS = { "content-type": "application/json" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  sb.result = { data: null, error: null };
  sb.calls.length = 0;
  // Clean-server routes are authenticated: default the suite to a signed-in
  // caller, and opt into the no-session case explicitly.
  sb.session = { access_token: "test-access-token" };
  sb.sessionThrows = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function requestedUrl(call = 0): string {
  return String(fetchMock.mock.calls[call][0]);
}

function requestedAuthHeader(call = 0): string | null {
  return new Headers(fetchMock.mock.calls[call][1]?.headers).get("Authorization");
}

describe("listWorkspaceDocuments (row 69 — direct Supabase)", () => {
  it("returns the generated_documents rows exactly as stored", async () => {
    const row = {
      id: "doc-1",
      workspace_id: "ws-1",
      file_name: "quote.pdf",
      document_type: "quote",
      status: "generated",
      file_size: 2048,
      generated_at: "2026-07-29T10:00:00.000Z",
      source_id: "q-1",
      source_version: 2,
    };
    sb.result = { data: [row], error: null };

    await expect(listWorkspaceDocuments("ws-1")).resolves.toEqual([row]);
  });

  it("queries generated_documents scoped to the workspace, newest first", async () => {
    sb.result = { data: [], error: null };

    await listWorkspaceDocuments("ws-1");

    expect(sb.calls).toHaveLength(1);
    expect(sb.calls[0].table).toBe("generated_documents");
    expect(sb.calls[0].filters).toEqual([["workspace_id", "ws-1"]]);
    expect(sb.calls[0].order).toEqual(["generated_at", { ascending: false }]);
    expect(fetchMock).not.toHaveBeenCalled(); // no server hop on this row
  });

  it("treats zero rows as a genuinely empty list, not an error", async () => {
    sb.result = { data: [], error: null };

    await expect(listWorkspaceDocuments("ws-1")).resolves.toEqual([]);
  });

  it("surfaces a Supabase error instead of rendering 'no documents'", async () => {
    sb.result = { data: null, error: { message: "permission denied for table generated_documents" } };

    const promise = listWorkspaceDocuments("ws-1");
    await expect(promise).rejects.toBeInstanceOf(DocumentRuntimeError);
    await expect(listWorkspaceDocuments("ws-1")).rejects.toThrow(/permission denied/i);
  });

  it("surfaces a missing result set rather than a silent empty list", async () => {
    sb.result = { data: null, error: null };

    await expect(listWorkspaceDocuments("ws-1")).rejects.toThrow(/no result set/i);
  });

  it("applies the document-vault scoping semantics (no tender rows, no archived)", async () => {
    sb.result = {
      data: [
        { id: "keep", source_type: "ticket", status: "generated" },
        { id: "tender", source_type: "tender", status: "generated" },
        { id: "archived", source_type: "ticket", status: "archived" },
      ],
      error: null,
    };

    const rows = await listWorkspaceDocuments("ws-1");

    expect(rows.map(r => r.id)).toEqual(["keep"]);
  });

  it("refuses to query without a workspace id", async () => {
    await expect(listWorkspaceDocuments("  ")).rejects.toBeInstanceOf(DocumentRuntimeError);
    expect(sb.calls).toHaveLength(0);
  });
});

describe("listScopeDocumentsFromCleanServer (row 27 — clean server)", () => {
  it("returns the server rows when the payload is a bare array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { id: "doc-1", file_name: "quote.pdf", document_type: "quote", status: "generated" },
      ]),
    );

    const rows = await listScopeDocumentsFromCleanServer("ws-1");

    expect(rows).toEqual([
      { id: "doc-1", file_name: "quote.pdf", document_type: "quote", status: "generated" },
    ]);
  });

  it("returns the server rows when the payload is wrapped in { data }", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "doc-2" }], count: 1 }));

    await expect(listScopeDocumentsFromCleanServer("ws-1")).resolves.toEqual([{ id: "doc-2" }]);
  });

  it("targets the absolute clean-server URL, never a relative /api path", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listScopeDocumentsFromCleanServer("ws 1/2");

    const url = requestedUrl();
    expect(url.startsWith(`${CLEAN_SERVER_BASE}/api/documents?workspace_id=`)).toBe(true);
    expect(url).toContain(encodeURIComponent("ws 1/2"));
    expect(url).not.toContain("3001");
  });

  it("treats zero rows as a genuinely empty list, not an error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], count: 0 }));
    await expect(listScopeDocumentsFromCleanServer("ws-1")).resolves.toEqual([]);

    fetchMock.mockResolvedValue(jsonResponse([]));
    await expect(listScopeDocumentsFromCleanServer("ws-1")).resolves.toEqual([]);
  });

  it("surfaces a non-OK response as an error instead of an empty list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Document scope not found" }, 404));

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toMatchObject({
      name: "DocumentRuntimeError",
      message: "Document scope not found",
      status: 404,
    });
  });

  it("surfaces an unreachable clean server as an error instead of an empty list", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toBeInstanceOf(DocumentRuntimeError);
    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toThrow(/not reachable/i);
  });

  it("surfaces an HTML/SPA response (the old relative-fetch defect) as an error", async () => {
    fetchMock.mockResolvedValue(
      new Response("<!doctype html><html></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toThrow(/did not return JSON/i);
  });

  it("surfaces an unrecognised payload shape as an error rather than inventing rows", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ documents: [{ id: "doc-3" }] }));

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toThrow(
      /unrecognised document list shape/i,
    );
  });

  it("refuses to call the server without a workspace id", async () => {
    await expect(listScopeDocumentsFromCleanServer("  ")).rejects.toBeInstanceOf(DocumentRuntimeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchDocumentDownload", () => {
  it("returns the signed URL the server supplied", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { id: "doc-1", download_url: "https://storage.example/doc-1.pdf" } }),
    );

    const result = await fetchDocumentDownload("doc-1");

    expect(result).toMatchObject({ kind: "url", url: "https://storage.example/doc-1.pdf" });
    expect(requestedUrl()).toBe(`${CLEAN_SERVER_BASE}/api/documents/download/doc-1`);
  });

  it("returns the streamed bytes with the server file name", async () => {
    fetchMock.mockResolvedValue(
      new Response("%PDF-1.7 bytes", {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="quote-v2.pdf"',
        },
      }),
    );

    const result = await fetchDocumentDownload("doc-1");

    expect(result.kind).toBe("file");
    if (result.kind === "file") {
      expect(result.fileName).toBe("quote-v2.pdf");
      expect(result.blob.size).toBeGreaterThan(0);
    }
  });

  it("surfaces a failed download as an error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Document not found" }, 404));

    await expect(fetchDocumentDownload("doc-1")).rejects.toMatchObject({
      message: "Document not found",
      status: 404,
    });
  });

  it("errors when the server returns no download location", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "doc-1" } }));

    await expect(fetchDocumentDownload("doc-1")).rejects.toThrow(/did not return a download location/i);
  });

  it("errors when the server streams an empty file", async () => {
    fetchMock.mockResolvedValue(
      new Response("", { status: 200, headers: { "content-type": "application/pdf" } }),
    );

    await expect(fetchDocumentDownload("doc-1")).rejects.toThrow(/empty file/i);
  });
});

describe("generateDocumentPdf", () => {
  const input = {
    workspace_id: "ws-1",
    document_type: "quote" as const,
    source_id: "q-1",
    source_version: 2,
  };

  it("POSTs to the clean server and reports a confirmed, stored document", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { id: "doc-9", storage_path: "quotes/doc-9.pdf", file_size: 4096 } }, 201),
    );

    const result = await generateDocumentPdf(input);

    expect(result.fileGenerated).toBe(true);
    expect(result.record.id).toBe("doc-9");
    expect(requestedUrl()).toBe(`${CLEAN_SERVER_BASE}/api/documents/generate-pdf`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(input);
  });

  it("reports record-only creation honestly when no bytes were stored", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { data: { id: "doc-10" }, message: "Document record created; PDF rendering is unavailable." },
        201,
      ),
    );

    const result = await generateDocumentPdf(input);

    expect(result.fileGenerated).toBe(false);
    expect(result.notice).toBe("Document record created; PDF rendering is unavailable.");
  });

  it("surfaces a non-OK response as an error instead of a fake success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "PDF generation failed" }, 500));

    await expect(generateDocumentPdf(input)).rejects.toMatchObject({
      message: "PDF generation failed",
      status: 500,
    });
  });

  it("errors when the response confirms no persisted record", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 201));

    await expect(generateDocumentPdf(input)).rejects.toThrow(/did not confirm a persisted document/i);
  });
});

// ─── auth contract (clean-server routes: rows 27, 30, 31) ────────────────────

describe("clean-server auth contract", () => {
  const generateInput = {
    workspace_id: "ws-1",
    document_type: "quote" as const,
    source_id: "q-1",
  };

  it("attaches the Supabase access token to the scope document list", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await listScopeDocumentsFromCleanServer("ws-1");

    expect(requestedAuthHeader()).toBe("Bearer test-access-token");
  });

  it("attaches the Supabase access token to the download request", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "doc-1", download_url: "https://s/d.pdf" } }));

    await fetchDocumentDownload("doc-1");

    expect(requestedAuthHeader()).toBe("Bearer test-access-token");
  });

  it("attaches the token to generate-pdf without dropping the JSON content type", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "doc-9", storage_path: "x.pdf" } }, 201));

    await generateDocumentPdf(generateInput);

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-access-token");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("fails fast without a session instead of firing a request that would 401", async () => {
    sb.session = null;

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toThrow(/not signed in/i);
    await expect(fetchDocumentDownload("doc-1")).rejects.toThrow(/not signed in/i);
    await expect(generateDocumentPdf(generateInput)).rejects.toThrow(/not signed in/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails fast when the session itself cannot be read", async () => {
    sb.sessionThrows = new Error("storage unavailable");

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toThrow(/could not read the current sign-in session/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a genuine 401 from the server as an error, never an empty list", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Authentication required", code: "AUTH_REQUIRED" }, 401),
    );

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toMatchObject({
      name: "DocumentRuntimeError",
      message: "Authentication required",
      status: 401,
    });
  });

  it("still says something true when a 401 carries no readable body", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));

    await expect(listScopeDocumentsFromCleanServer("ws-1")).rejects.toThrow(/unauthenticated \(401\)/i);
  });

  it("leaves row 69 alone: the direct Supabase read needs no bearer token", async () => {
    sb.session = null;
    sb.result = { data: [{ id: "doc-1" }], error: null };

    await expect(listWorkspaceDocuments("ws-1")).resolves.toEqual([{ id: "doc-1" }]);
  });
});
