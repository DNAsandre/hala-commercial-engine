/**
 * SC-01 Wave 03 (W03-3) — clean-server document runtime tests.
 *
 * These are real HTTP round-trips against the assembled Express app on an
 * ephemeral port. Only the Supabase client is mocked, so routing, validation,
 * status codes and response bodies are exercised for real.
 *
 * No network call reaches Supabase, and nothing here touches the old Hala app.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";

// ─── Supabase mock ───────────────────────────────────────────

interface ScriptedResult {
  data?: unknown;
  error?: { message: string } | null;
}

interface Script {
  /** table name -> single result, or a queue consumed in call order. */
  tables?: Record<string, ScriptedResult | ScriptedResult[]>;
  storageList?: ScriptedResult;
  storageSign?: ScriptedResult;
}

const state = vi.hoisted(() => ({
  script: {} as {
    tables?: Record<string, unknown>;
    storageList?: unknown;
    storageSign?: unknown;
  },
  calls: [] as string[],
  tokens: [] as string[],
}));

function makeQuery(table: string, nextResult: () => ScriptedResult) {
  const query: Record<string, unknown> = {};
  const chainable = [
    "select",
    "eq",
    "gte",
    "lte",
    "ilike",
    "order",
    "limit",
    "update",
    "insert",
    "upsert",
    "delete",
  ];
  for (const method of chainable) {
    query[method] = (...args: unknown[]) => {
      state.calls.push(`${table}.${method}(${args.map(String).join(",")})`);
      return query;
    };
  }
  query.maybeSingle = () => Promise.resolve(nextResult());
  query.single = () => Promise.resolve(nextResult());
  // Thenable so `await chain.order(...).limit(...)` resolves like PostgREST.
  query.then = (resolve: (v: ScriptedResult) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(nextResult()).then(resolve, reject);
  return query;
}

vi.mock("./lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/supabase")>();
  return {
    ...actual,
    createUserScopedClient: (accessToken: string) => {
      state.tokens.push(accessToken);
      const queues = new Map<string, ScriptedResult[]>();
      return {
        from(table: string) {
          state.calls.push(`from:${table}`);
          const scripted = (state.script.tables as Record<string, ScriptedResult | ScriptedResult[]> | undefined)?.[
            table
          ];
          if (!queues.has(table)) {
            queues.set(table, Array.isArray(scripted) ? [...scripted] : scripted ? [scripted] : []);
          }
          const queue = queues.get(table)!;
          return makeQuery(table, () => {
            if (queue.length === 0) {
              return { data: null, error: { message: `no scripted result for ${table}` } };
            }
            return queue.length === 1 ? queue[0] : (queue.shift() as ScriptedResult);
          });
        },
        storage: {
          from(bucket: string) {
            state.calls.push(`storage:${bucket}`);
            return {
              list: async (dir: string, opts: unknown) => {
                state.calls.push(`storage.list(${dir},${JSON.stringify(opts)})`);
                return (state.script.storageList as ScriptedResult) ?? { data: [], error: null };
              },
              createSignedUrl: async (path: string, ttl: number) => {
                state.calls.push(`storage.createSignedUrl(${path},${ttl})`);
                return (
                  (state.script.storageSign as ScriptedResult) ?? {
                    data: null,
                    error: { message: "not scripted" },
                  }
                );
              },
            };
          },
        },
      };
    },
  };
});

// Import AFTER vi.mock so the route module picks up the mocked client.
const { createApp } = await import("./app");

// ─── harness ─────────────────────────────────────────────────

function script(s: Script): void {
  state.script = s as unknown as typeof state.script;
}

async function call(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<{ status: number; body: any }> {
  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (init.auth !== false) headers.Authorization = "Bearer test-access-token";
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const DOC_ID = "11111111-2222-4333-8444-555555555555";

const STORED_DOC = {
  id: DOC_ID,
  workspace_id: "ws-1",
  customer_id: "cust-1",
  document_type: "quote",
  source_type: "quote",
  source_id: "q-1",
  source_version: 2,
  file_name: "quote-v2-2026-08-05.pdf",
  storage_path: "customers/Acme/workspaces/ws-1/quote/v2/quote-v2-2026-08-05.pdf",
  file_size: 4096,
  mime_type: "application/pdf",
  language: "en",
  status: "generated",
  generated_by: "user-1",
  generated_at: "2026-08-05T09:00:00.000Z",
  version_number: 2,
  checksum: "abc123",
  notes: "",
  supersedes_document_id: null,
  last_downloaded_at: null,
  created_at: "2026-08-05T09:00:00.000Z",
};

afterEach(() => {
  state.script = {};
  state.calls = [];
  state.tokens = [];
  process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
  process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
});

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "anon-key";

// ─── /healthz (unchanged contract) ───────────────────────────

describe("GET /healthz", () => {
  it("returns the unchanged SC-01.1 health payload", async () => {
    const res = await call("/healthz", { auth: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      service: "hala-clean-commercial-engine",
      wave: "SC-01.4",
      note: "Document list and download are served here. Faithful PDF rendering stays client-side (FinalStudio); server-side generation is not available.",
    });
  });
});

// ─── row 26/27 — GET /api/documents ──────────────────────────

describe("GET /api/documents (rows 26/27)", () => {
  it("returns the generated_documents rows for the requested workspace scope", async () => {
    script({ tables: { generated_documents: { data: [STORED_DOC], error: null } } });
    const res = await call("/api/documents?workspace_id=ws-1");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([STORED_DOC]);
    expect(res.body.count).toBe(1);
    expect(res.body.truncated).toBe(false);
    expect(state.calls).toContain("generated_documents.eq(workspace_id,ws-1)");
    expect(state.tokens).toEqual(["test-access-token"]);
  });

  it("applies the optional customer_id and document_type filters", async () => {
    script({ tables: { generated_documents: { data: [], error: null } } });
    const res = await call("/api/documents?workspace_id=ws-1&customer_id=cust-1&document_type=quote");
    expect(res.status).toBe(200);
    expect(state.calls).toContain("generated_documents.eq(customer_id,cust-1)");
    expect(state.calls).toContain("generated_documents.eq(document_type,quote)");
  });

  it("rejects an unauthenticated request instead of reporting an empty vault", async () => {
    script({ tables: { generated_documents: { data: [], error: null } } });
    const res = await call("/api/documents?workspace_id=ws-1", { auth: false });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });

  it("rejects a request with no scope (invalid input, not an empty list)", async () => {
    const res = await call("/api/documents");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("SCOPE_REQUIRED");
  });

  it("rejects an unparsable date_from filter", async () => {
    const res = await call("/api/documents?workspace_id=ws-1&date_from=not-a-date");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_QUERY");
  });

  it("surfaces a Supabase read failure as an honest 500", async () => {
    script({ tables: { generated_documents: { data: null, error: { message: "permission denied" } } } });
    const res = await call("/api/documents?workspace_id=ws-1");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("DB_ERROR");
    expect(res.body.error).toContain("permission denied");
  });
});

// ─── row 30 — GET /api/documents/download/:id ────────────────

describe("GET /api/documents/download/:id (row 30)", () => {
  it("returns the record plus a signed URL for the real stored object", async () => {
    script({
      tables: { generated_documents: { data: STORED_DOC, error: null } },
      storageList: { data: [{ name: "quote-v2-2026-08-05.pdf" }], error: null },
      storageSign: { data: { signedUrl: "https://example.supabase.co/signed/quote.pdf" }, error: null },
    });
    const res = await call(`/api/documents/download/${DOC_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(DOC_ID);
    expect(res.body.data.download_url).toBe("https://example.supabase.co/signed/quote.pdf");
    expect(res.body.data.download_url_expires_in).toBe(3600);
    expect(state.calls).toContain("storage:documents");
    expect(state.calls.some((c) => c.startsWith("generated_documents.update"))).toBe(true);
  });

  it("rejects an id that is not a uuid", async () => {
    const res = await call("/api/documents/download/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });

  it("returns 404 when the document record does not exist", async () => {
    script({ tables: { generated_documents: { data: null, error: null } } });
    const res = await call(`/api/documents/download/${DOC_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns 404 when the record exists but the storage object is missing", async () => {
    script({
      tables: { generated_documents: { data: STORED_DOC, error: null } },
      storageList: { data: [], error: null },
    });
    const res = await call(`/api/documents/download/${DOC_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("STORAGE_OBJECT_MISSING");
    expect(state.calls.some((c) => c.startsWith("storage.createSignedUrl"))).toBe(false);
  });

  it("returns 404 when the record carries no storage_path at all", async () => {
    script({ tables: { generated_documents: { data: { ...STORED_DOC, storage_path: "" }, error: null } } });
    const res = await call(`/api/documents/download/${DOC_ID}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NO_STORED_FILE");
  });

  it("requires authentication", async () => {
    const res = await call(`/api/documents/download/${DOC_ID}`, { auth: false });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });
});

// ─── row 31 — POST /api/documents/generate-pdf ───────────────

describe("POST /api/documents/generate-pdf (row 31)", () => {
  const validBody = {
    workspace_id: "ws-1",
    document_type: "quote",
    source_id: "q-1",
    source_version: 2,
  };

  it("verifies the source truth and refuses to render divergent bytes, creating no record", async () => {
    script({ tables: { quotes: { data: { id: "q-1", workspace_id: "ws-1", version_number: 2 }, error: null } } });
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(501);
    expect(res.body.code).toBe("PDF_RENDER_UNAVAILABLE");
    expect(res.body.details.record_created).toBe(false);
    expect(res.body.details.bytes_generated).toBe(false);
    expect(res.body.details.source_verified).toEqual({
      document_type: "quote",
      source_table: "quotes",
      source_id: "q-1",
      source_version: 2,
      workspace_id: "ws-1",
    });
    // Critical: nothing was written to the documents table.
    expect(state.calls.some((c) => c.includes("generated_documents"))).toBe(false);
  });

  it("resolves a proposal from commercial_tickets with ticket_type = proposal", async () => {
    script({
      tables: {
        commercial_tickets: { data: { id: "t-1", ticket_type: "proposal", workspace_id: "ws-1" }, error: null },
      },
    });
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify({ workspace_id: "ws-1", document_type: "proposal", source_id: "t-1" }),
    });
    expect(res.status).toBe(501);
    expect(state.calls).toContain("commercial_tickets.eq(ticket_type,proposal)");
    expect(res.body.details.source_table).toBe(undefined);
    expect(res.body.details.source_verified.source_table).toBe("commercial_tickets");
  });

  it("returns 404 when the selected source does not exist", async () => {
    script({ tables: { quotes: { data: null, error: null } } });
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SOURCE_NOT_FOUND");
  });

  it("returns 409 when the requested source_version is not the stored version", async () => {
    script({ tables: { quotes: { data: { id: "q-1", workspace_id: "ws-1", version_number: 5 }, error: null } } });
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SOURCE_VERSION_MISMATCH");
  });

  it("returns 409 when the source belongs to a different workspace", async () => {
    script({ tables: { quotes: { data: { id: "q-1", workspace_id: "ws-other", version_number: 2 }, error: null } } });
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SOURCE_SCOPE_MISMATCH");
  });

  it("rejects an invalid body with field-level detail", async () => {
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify({ workspace_id: "ws-1", document_type: "invoice" }),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_BODY");
    expect(res.body.details.map((d: any) => d.field)).toContain("document_type");
    expect(res.body.details.map((d: any) => d.field)).toContain("source_id");
  });

  it("requires authentication", async () => {
    const res = await call("/api/documents/generate-pdf", {
      method: "POST",
      body: JSON.stringify(validBody),
      auth: false,
    });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("AUTH_REQUIRED");
  });
});

// ─── unimplemented surface ───────────────────────────────────

describe("unimplemented /api routes", () => {
  it("answers zero-caller document rows with an explicit 501 rather than HTML", async () => {
    const res = await call("/api/doc-instances");
    expect(res.status).toBe(501);
    expect(res.body.code).toBe("ROUTE_NOT_IMPLEMENTED");
  });

  it("does not implement /api/documents/upload (the client uploads to Storage directly)", async () => {
    const res = await call("/api/documents/upload", { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(501);
    expect(res.body.code).toBe("ROUTE_NOT_IMPLEMENTED");
  });
});
