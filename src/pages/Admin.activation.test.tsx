/**
 * Admin.activation.test.tsx — SC-01 Wave 06, lane T14 (GAP-1, manifest row A-05).
 *
 * `describeUserActivationAction` is the single source of what the admin is
 * told after a deactivate/reactivate request. These tests pin its honesty:
 *
 *  - success is claimed ONLY for an explicit `success: true` confirmation
 *    from the admin edge function (the Wave 04 rule: a submitted request is
 *    not proof of persistence);
 *  - a successful confirmation reports the status persisted by the admin
 *    function and subsequently read back by the Users tab;
 *  - a refusal carries the server's reason and marks nothing as changed.
 */
import { describe, expect, it } from "vitest";
import { describeUserActivationAction } from "./Admin";

describe("describeUserActivationAction — readable activation contract", () => {
  it("reports success only for an explicit success:true confirmation", () => {
    const confirmed = describeUserActivationAction("deactivate", { success: true }, "Albert");
    expect(confirmed.tone).toBe("success");
    expect(confirmed.message).toBe("User deactivated");
  });

  it("a confirmed action reports the persisted state", () => {
    const confirmed = describeUserActivationAction("deactivate", { success: true }, "Albert");
    expect(confirmed.description).toContain("recorded as inactive");

    const reactivated = describeUserActivationAction("reactivate", { success: true }, "Albert");
    expect(reactivated.message).toBe("User reactivated");
    expect(reactivated.description).toContain("recorded as active");
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
