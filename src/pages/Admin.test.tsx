/**
 * Admin.test.tsx — SC-01 Wave 04, lane T07-C correction pass.
 *
 * Defect C: `users.name`, `.email` and `.role` are nullable. The Users tab
 * called `.toLowerCase()` on all three in its search filter and `.split(" ")`
 * on the name to build avatar initials, so a single null column threw during
 * render and took the whole tab down.
 *
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  USER_FIELD_NOT_RECORDED,
  matchesUserSearch,
  userField,
  userInitials,
} from "./Admin";

afterEach(() => {
  vi.restoreAllMocks();
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
