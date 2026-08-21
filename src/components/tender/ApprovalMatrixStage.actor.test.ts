/**
 * ApprovalMatrixStage.actor.test.ts — TCW-T4 (P4/F1)
 *
 * Approval decisions persist the SESSION user as `decided_by`. The pre-wave
 * code stamped the string literal "Current User" into every stored decision —
 * the pure decision applier the handler now uses must carry the passed
 * session-user name verbatim and leave untouched participants untouched.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { applyApprovalDecision, type ApprovalRecord } from "@/components/tender/ApprovalMatrixStage";

const participant = (role: string): ApprovalRecord => ({
  id: `apr-${role}`,
  role,
  role_label: role.toUpperCase(),
  type: "approval",
  decision: "pending",
  decided_by: "",
  comment: "",
  decided_at: null,
});

describe("applyApprovalDecision actor truth", () => {
  it("persists the session user name verbatim as decided_by — never 'Current User'", () => {
    const next = applyApprovalDecision(
      [participant("ceo"), participant("cfo")],
      { role: "ceo", roleLabel: "CEO", type: "approval", decision: "approved", comment: "Margins hold" },
      "Amina Al-Rashid",
      "2026-08-20T08:00:00.000Z",
    );
    const decided = next.find(r => r.role === "ceo")!;
    expect(decided.decided_by).toBe("Amina Al-Rashid");
    expect(decided.decided_by).not.toBe("Current User");
    expect(decided.decision).toBe("approved");
    expect(decided.comment).toBe("Margins hold");
    expect(decided.decided_at).toBe("2026-08-20T08:00:00.000Z");
  });

  it("a signed-out session records the auth module's honest literal verbatim", () => {
    const next = applyApprovalDecision(
      [participant("legal")],
      { role: "legal", roleLabel: "Legal", type: "feasibility", decision: "rejected", comment: "" },
      "Unauthenticated",
    );
    expect(next[0].decided_by).toBe("Unauthenticated");
  });

  it("only the targeted participant changes; siblings are preserved byte-for-byte", () => {
    const before = [participant("ceo"), participant("cfo")];
    const next = applyApprovalDecision(
      before,
      { role: "cfo", roleLabel: "CFO", type: "approval", decision: "approved", comment: "" },
      "Amina Al-Rashid",
    );
    expect(next.find(r => r.role === "ceo")).toEqual(before[0]);
    expect(next.find(r => r.role === "cfo")!.decision).toBe("approved");
  });
});
