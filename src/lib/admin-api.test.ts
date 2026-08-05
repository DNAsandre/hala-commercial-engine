/**
 * admin-api.test.ts — SC-01 Wave 04, lane T07-C.
 *
 * Requirement D touches the Admin panel's user CRUD. The brief's rule is that
 * "a submitted request is not proof of persistence": the panel raises
 * toast.success("User created" / "User updated" / "Password reset") whenever
 * `result.success` is truthy, so an HTTP 200 with an ambiguous body must not
 * be reported as a completed change.
 *
 * These tests assert what actually reaches the network — the URL, the method,
 * the Authorization header and the exact JSON body — and that only an explicit
 * `success: true` is treated as success.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const session: { access_token: string | null } = { access_token: "jwt-abc" };

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: session.access_token ? { access_token: session.access_token } : null },
      }),
    },
  },
}));

import {
  adminCreateUser,
  adminDeactivateUser,
  adminReactivateUser,
  adminResetPassword,
  adminUpdateUser,
} from "./admin-api";

type FetchCall = { url: string; init: RequestInit };
const fetchCalls: FetchCall[] = [];

function stubFetch(response: { ok: boolean; status: number; body: unknown | (() => never) }) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    fetchCalls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status,
      json: async () => {
        if (typeof response.body === "function") (response.body as () => never)();
        return response.body;
      },
    };
  }));
}

const lastBody = () => JSON.parse(String(fetchCalls.at(-1)!.init.body));
const lastHeaders = () => fetchCalls.at(-1)!.init.headers as Record<string, string>;

beforeEach(() => {
  fetchCalls.length = 0;
  session.access_token = "jwt-abc";
});

describe("what reaches the admin edge function", () => {
  it("posts the action and the caller's parameters, with the session JWT", async () => {
    stubFetch({ ok: true, status: 200, body: { success: true, userId: "u9" } });

    const result = await adminCreateUser({
      email: "a@b.com", password: "Passw0rd!", name: "A B",
      role: "salesman", department: "Sales", region: "East", office: "Riyadh",
    });

    expect(result).toEqual({ success: true, userId: "u9" });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/functions/v1/admin-user-management");
    expect(fetchCalls[0].init.method).toBe("POST");
    expect(lastHeaders().Authorization).toBe("Bearer jwt-abc");
    expect(lastBody()).toEqual({
      action: "create-user",
      email: "a@b.com", password: "Passw0rd!", name: "A B",
      role: "salesman", department: "Sales", region: "East", office: "Riyadh",
    });
  });

  it("sends the right action name for each operation", async () => {
    const seen: string[] = [];
    stubFetch({ ok: true, status: 200, body: { success: true } });

    await adminUpdateUser({ userId: "u1", authId: "auth-1", name: "N" });
    seen.push(lastBody().action);
    await adminResetPassword("auth-1", "NewPassw0rd");
    seen.push(lastBody().action);
    await adminDeactivateUser("auth-1", "u1");
    seen.push(lastBody().action);
    await adminReactivateUser("auth-1", "u1");
    seen.push(lastBody().action);

    expect(seen).toEqual(["update-user", "reset-password", "deactivate-user", "reactivate-user"]);
  });

  it("never contacts the network when there is no session", async () => {
    session.access_token = null;
    stubFetch({ ok: true, status: 200, body: { success: true } });

    const result = await adminDeactivateUser("auth-1", "u1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Not authenticated");
    expect(fetchCalls).toEqual([]);
  });
});

describe("a submitted request is not proof of persistence", () => {
  it("treats an explicit success:true as saved", async () => {
    stubFetch({ ok: true, status: 200, body: { success: true } });
    expect((await adminUpdateUser({ userId: "u1", authId: "a1" })).success).toBe(true);
  });

  it("does NOT report success for a 200 with an empty body", async () => {
    stubFetch({ ok: true, status: 200, body: {} });
    const result = await adminUpdateUser({ userId: "u1", authId: "a1" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("did not confirm the change");
  });

  it("does NOT report success for a 200 whose body is not an object", async () => {
    stubFetch({ ok: true, status: 200, body: "ok" });
    const result = await adminCreateUser({ email: "a@b.com", password: "P1assword", name: "N", role: "viewer" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("could not be read");
  });

  it("does NOT report success for a 200 whose body is unparseable JSON", async () => {
    stubFetch({ ok: true, status: 200, body: (() => { throw new SyntaxError("not json"); }) as unknown as () => never });
    const result = await adminResetPassword("a1", "NewPassw0rd");
    expect(result.success).toBe(false);
    expect(result.error).toContain("could not be read");
  });

  it("does NOT treat a truthy non-true success value as saved", async () => {
    stubFetch({ ok: true, status: 200, body: { success: "yes" } });
    expect((await adminUpdateUser({ userId: "u1", authId: "a1" })).success).toBe(false);
  });

  it("surfaces the server's own error message on a non-2xx", async () => {
    stubFetch({ ok: false, status: 403, body: { error: "caller is not an admin" } });
    const result = await adminDeactivateUser("a1", "u1");
    expect(result).toEqual({ success: false, error: "caller is not an admin" });
  });

  it("reports the status code when a non-2xx carries no message", async () => {
    stubFetch({ ok: false, status: 500, body: {} });
    expect((await adminReactivateUser("a1", "u1")).error).toBe("HTTP 500");
  });

  it("reports a network failure as a failure, never as a completed change", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Failed to fetch"); }));
    const result = await adminCreateUser({ email: "a@b.com", password: "P1assword", name: "N", role: "viewer" });
    expect(result).toEqual({ success: false, error: "Failed to fetch" });
  });
});
