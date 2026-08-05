/**
 * Admin.test.tsx — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Defect C: `users.name`, `.email` and `.role` are nullable. The Users tab
 * called `.toLowerCase()` on all three in its search filter and `.split(" ")`
 * on the name to build avatar initials, so a single null column threw during
 * render and took the whole tab down.
 *
 * Defect D: `fetchCollections` (src/lib/knowledgebase.ts:92-94) THROWS on a
 * failed read. The Knowledgebase panel had no `.catch`, so a rejection left
 * the loading flag set forever: the tab spun indefinitely and a failure was
 * indistinguishable from loading.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchCollections = vi.fn();

vi.mock("@/lib/knowledgebase", () => ({
  fetchCollections: (...args: unknown[]) => fetchCollections(...args),
}));

import {
  USER_FIELD_NOT_RECORDED,
  loadKnowledgebaseCollections,
  matchesUserSearch,
  userField,
  userInitials,
} from "./Admin";

afterEach(() => {
  fetchCollections.mockReset();
});

describe("user field guards — defect C", () => {
  it("does not throw on a user whose columns are all null", () => {
    const broken = { id: "u-1", name: null, email: null, role: null };
    expect(() => userInitials(broken.name)).not.toThrow();
    expect(() => matchesUserSearch(broken, "anything")).not.toThrow();
    expect(() => userField(broken.role).replace(/_/g, " ")).not.toThrow();
  });

  it("degrades a missing field to an honest placeholder", () => {
    expect(userField(null)).toBe(USER_FIELD_NOT_RECORDED);
    expect(userField("")).toBe(USER_FIELD_NOT_RECORDED);
    expect(userField("   ")).toBe(USER_FIELD_NOT_RECORDED);
    expect(userField("Albert")).toBe("Albert");
    expect(userInitials(null)).toBe("?");
    expect(userInitials("")).toBe("?");
  });

  it("still builds initials from a recorded name", () => {
    expect(userInitials("Mohammed Al-Harbi")).toBe("MA");
    expect(userInitials("Ra'ed")).toBe("R");
    expect(userInitials("  Yazan   Ops  ")).toBe("YO");
  });

  it("searches every recorded column and skips the unrecorded ones", () => {
    const user = { name: "Albert", email: "albert@example.com", role: null };
    expect(matchesUserSearch(user, "alb")).toBe(true);
    expect(matchesUserSearch(user, "EXAMPLE")).toBe(true);
    expect(matchesUserSearch(user, "manager")).toBe(false);
    // A user with nothing recorded matches nothing rather than crashing.
    expect(matchesUserSearch({ name: null, email: null, role: null }, "a")).toBe(false);
  });

  it("an empty query keeps every row, including rows with null columns", () => {
    expect(matchesUserSearch({ name: null, email: null, role: null }, "")).toBe(true);
    expect(matchesUserSearch({ name: null, email: null, role: null }, "   ")).toBe(true);
  });

  it("a filter over a list containing a null-column user does not throw", () => {
    const users = [
      { id: "u-1", name: "Albert", email: "a@x.com", role: "sales" },
      { id: "u-2", name: null, email: null, role: null },
    ];
    expect(() => users.filter(u => matchesUserSearch(u, "albert"))).not.toThrow();
    expect(users.filter(u => matchesUserSearch(u, "albert"))).toHaveLength(1);
  });
});

describe("loadKnowledgebaseCollections — defect D", () => {
  it("turns the helper's THROW into a reportable error, not an endless spinner", async () => {
    fetchCollections.mockRejectedValueOnce(
      new Error("Failed to load knowledgebase collections: permission denied"),
    );
    const read = await loadKnowledgebaseCollections();
    expect(read.status).toBe("error");
    if (read.status !== "error") throw new Error("unreachable");
    expect(read.error).toContain("permission denied");
  });

  it("reports a genuine empty store differently from a failure", async () => {
    fetchCollections.mockResolvedValueOnce([]);
    const read = await loadKnowledgebaseCollections();
    expect(read.status).toBe("empty");
  });

  it("reports real collections", async () => {
    fetchCollections.mockResolvedValueOnce([
      { id: "c-1", name: "Stored Collection", visibility: "team", doc_count: 2, chunk_count: 9 },
    ]);
    const read = await loadKnowledgebaseCollections();
    expect(read.status).toBe("loaded");
    if (read.status !== "loaded") throw new Error("unreachable");
    expect(read.collections).toHaveLength(1);
    expect(read.collections[0]!.name).toBe("Stored Collection");
  });

  it("handles a non-Error rejection without losing the reason", async () => {
    fetchCollections.mockRejectedValueOnce("kb_collections is unreachable");
    const read = await loadKnowledgebaseCollections();
    expect(read.status).toBe("error");
    if (read.status !== "error") throw new Error("unreachable");
    expect(read.error).toContain("unreachable");
  });
});
