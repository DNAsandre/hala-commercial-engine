import { describe, expect, it } from "vitest";
import fs from "node:fs";

const pageSource = fs.readFileSync("src/pages/ProposalWorkspace.tsx", "utf8");
const workbenchSource = fs.readFileSync(
  "src/components/proposal-workspace/ProposalStageWorkbench.tsx",
  "utf8",
);

describe("Proposal move-then-save revision handoff", () => {
  it("passes each confirmed tracker revision into the stage workbench", () => {
    expect(pageSource.match(/setTrackerRevision\(saved\.revision\)/g)).toHaveLength(2);
    expect(pageSource).toContain("ticketRevision={trackerRevision}");
  });

  it("refreshes the workbench revision when a tracker write advances the ticket", () => {
    expect(workbenchSource).toContain("if (ticketRevision) setWorkspaceRevision(ticketRevision)");
    expect(workbenchSource).toContain("expectedRevision: workspaceRevision");
  });
});
