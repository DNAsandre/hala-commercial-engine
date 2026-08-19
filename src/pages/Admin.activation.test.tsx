/**
 * Admin.activation.test.tsx — SC-01 Wave 06, lane T14 (GAP-1, manifest row A-05).
 *
 * User activation status is a DATABASE-CONTRACT-GAP: no readable source
 * reflects whether an account is active or deactivated (`users.status` does
 * not exist live). The Users tab therefore must not fabricate a stored state.
 *
 * `describeUserActivationAction` is the single source of what the admin is
 * told after a deactivate/reactivate request. These tests pin its honesty:
 *
 *  - success is claimed ONLY for an explicit `success: true` confirmation
 *    from the admin edge function (the Wave 04 rule: a submitted request is
 *    not proof of persistence);
 *  - a successful confirmation never claims a visible list state — it says
 *    plainly that activation state cannot be displayed;
 *  - a refusal carries the server's reason and marks nothing as changed.
 */
import { describe, expect, it } from "vitest";
import { USER_ACTIVATION_NOT_READABLE, describeUserActivationAction } from "./Admin";

describe("describeUserActivationAction — GAP-1 honesty", () => {
  it("reports success only for an explicit success:true confirmation", () => {
    const confirmed = describeUserActivationAction("deactivate", { success: true }, "Albert");
    expect(confirmed.tone).toBe("success");
    expect(confirmed.message).toBe("Deactivation confirmed by the server");
  });

  it("a confirmed action never claims a list state this build cannot read", () => {
    const confirmed = describeUserActivationAction("deactivate", { success: true }, "Albert");
    // The old toast said "Albert can no longer sign in" while the list kept
    // rendering a green "Active" badge from a column that does not exist.
    expect(confirmed.description).toContain(USER_ACTIVATION_NOT_READABLE);
    expect(confirmed.description).not.toMatch(/can no longer sign in/i);
    expect(confirmed.description).not.toMatch(/can now sign in/i);

    const reactivated = describeUserActivationAction("reactivate", { success: true }, "Albert");
    expect(reactivated.message).toBe("Reactivation confirmed by the server");
    expect(reactivated.description).toContain(USER_ACTIVATION_NOT_READABLE);
  });

  it("a refusal is an error carrying the server's reason", () => {
    const refused = describeUserActivationAction("deactivate", { success: false, error: "Caller is not an admin" }, "Albert");
    expect(refused.tone).toBe("error");
    expect(refused.message).toBe("Deactivation failed");
    expect(refused.description).toContain("Caller is not an admin");
  });

  it("a refusal without a reason still reports an unconfirmed change", () => {
    const refused = describeUserActivationAction("reactivate", { success: false }, "Albert");
    expect(refused.tone).toBe("error");
    expect(refused.description).toMatch(/did not confirm/i);
  });

  it("only a boolean true counts as confirmation — truthy strings do not", () => {
    const sloppy = describeUserActivationAction(
      "deactivate",
      { success: "true" as unknown as boolean },
      "Albert",
    );
    expect(sloppy.tone).toBe("error");
  });
});
