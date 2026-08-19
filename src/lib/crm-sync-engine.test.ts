/**
 * crm-sync-engine.test.ts — SC-01 Wave 04, Fable-owned shared foundation.
 *
 * Connection configuration lives in the global system_settings contract. The
 * absent crm_connections table must never be queried by the clean app.
 *
 * These tests pin the distinction Wave 04 requires: a missing table, a failed
 * read, and a genuinely empty table must be three different answers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type TerminalResult = { data?: unknown; error?: unknown };

const terminal: { list: TerminalResult } = { list: { data: [], error: null } };
const seen: { table: string | null; columns: string | null } = { table: null, columns: null };

function makeBuilder(table: string) {
  seen.table = table;
  const builder: any = {
    select: (cols?: string) => {
      seen.columns = cols ?? null;
      return builder;
    },
    order: () => builder,
    eq: () => builder,
    limit: () => builder,
    then: (resolve: (v: TerminalResult) => unknown) => resolve(terminal.list),
  };
  return builder;
}

vi.mock("./supabase", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

vi.mock("@/lib/supabase-error", () => ({
  handleSupabaseError: () => {},
  setFetchError: () => {},
  clearFetchError: () => {},
}));

import { fetchConnections, fetchConnectionsResult } from "./crm-sync-engine";

beforeEach(() => {
  terminal.list = { data: [], error: null };
  seen.table = null;
  seen.columns = null;
});

describe("fetchConnectionsResult — failed read is not an empty result", () => {
  it("reports PGRST205 (table absent) as unavailable, not as zero connections", async () => {
    terminal.list = {
      data: null,
      error: { code: "PGRST205", message: "Could not find the table 'public.system_settings'" },
    };
    const r = await fetchConnectionsResult();
    expect(r.status).toBe("unavailable");
    expect(r.connections).toEqual([]);
    expect(r.status).not.toBe("ok");
  });

  it("reports 42P01 (undefined_table) as unavailable", async () => {
    terminal.list = { data: null, error: { code: "42P01", message: "relation does not exist" } };
    expect((await fetchConnectionsResult()).status).toBe("unavailable");
  });

  it("reports any other read failure as error, carrying the real message", async () => {
    terminal.list = { data: null, error: { code: "42501", message: "permission denied" } };
    const r = await fetchConnectionsResult();
    expect(r.status).toBe("error");
    expect(r).toMatchObject({ message: "permission denied" });
  });

  it("reports a genuinely empty table as ok with zero connections", async () => {
    terminal.list = { data: [], error: null };
    const r = await fetchConnectionsResult();
    expect(r.status).toBe("ok");
    expect(r.connections).toEqual([]);
  });

  it("maps real rows from the global system settings contract", async () => {
    terminal.list = {
      data: [
        {
          settings: { crm_connections: [{
            id: "c1",
            provider: "zoho",
            name: "Zoho CRM",
            base_url: "https://example.invalid",
            enabled: true,
            auth_method: "oauth2",
            last_sync_at: null,
            health_status: "connected",
            sync_interval_minutes: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            config: null,
          }] },
        },
      ],
      error: null,
    };
    const r = await fetchConnectionsResult();
    expect(r.status).toBe("ok");
    expect(seen.table).toBe("system_settings");
    expect(r.connections).toHaveLength(1);
    expect(r.connections[0]).toMatchObject({ id: "c1", provider: "zoho", health_status: "connected" });
    // documented defaults, not invented values
    expect(r.connections[0].sync_interval_minutes).toBe(15);
    expect(r.connections[0].config).toEqual({});
  });
});

describe("fetchConnections — bare array form still behaves for list-only callers", () => {
  it("returns the rows on success", async () => {
    terminal.list = {
      data: [{ settings: { crm_connections: [{ id: "c1", provider: "ghl", name: "GHL", base_url: "", enabled: false, auth_method: "api_key", last_sync_at: null, health_status: "disconnected", sync_interval_minutes: 5, created_at: "", updated_at: "", config: {} }] } }],
      error: null,
    };
    expect(await fetchConnections()).toHaveLength(1);
  });

  it("returns [] when the table is absent — which is exactly why it cannot be used for counts", async () => {
    terminal.list = { data: null, error: { code: "PGRST205", message: "absent" } };
    expect(await fetchConnections()).toEqual([]);
  });
});
