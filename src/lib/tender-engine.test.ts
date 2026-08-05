/**
 * tender-engine.test.ts — SC-01 Wave 04, Fable-owned.
 *
 * The defect this exists to prevent recurring: the CRM Pipeline strip offered a
 * stage ("Actual Go Live") that the read layer's stage map did not know, so
 * choosing it wrote a value that could not be read back. The row reloaded as
 * "Prospecting" — under a "Persisted to Supabase" success toast — meaning the
 * UI displayed a stage the record does not hold.
 *
 * The invariant is simple and worth pinning for every key, not just the one
 * that broke: every stage a human can click must survive a round trip, and must
 * have a label and a colour.
 */
import { describe, expect, it } from "vitest";
import { CRM_PIPELINE_STAGES, getCrmStageLabel } from "@/components/proposal-workspace/CrmPipelineStrip";
import { getTenderStatusColor, getTenderStatusDisplayName, type TenderMilestone } from "./tender-engine";
import { isRestorableCrmPipelineStage, RESTORABLE_CRM_PIPELINE_STAGES } from "./supabase-tender-data";

describe("CRM stage vocabulary — every clickable stage round-trips", () => {
  it("offers exactly the ten approved CRM stages", () => {
    expect(CRM_PIPELINE_STAGES).toHaveLength(10);
  });

  it.each(CRM_PIPELINE_STAGES.map(s => [s.key, s.label] as const))(
    "%s is restorable by the read layer",
    (key) => {
      expect(isRestorableCrmPipelineStage(key)).toBe(true);
      expect(RESTORABLE_CRM_PIPELINE_STAGES).toContain(key);
    },
  );

  it.each(CRM_PIPELINE_STAGES.map(s => [s.key, s.label] as const))(
    "%s has a display name and a colour",
    (key, label) => {
      expect(getCrmStageLabel(key)).toBe(label);
      expect(getTenderStatusDisplayName(key as TenderMilestone)).toBeTruthy();
      expect(getTenderStatusColor(key as TenderMilestone)).not.toBe("");
    },
  );

  it("keeps operational_handover readable, because stored rows may already carry it", () => {
    expect(isRestorableCrmPipelineStage("operational_handover")).toBe(true);
    expect(getTenderStatusDisplayName("operational_handover")).toBe("Operational Handover");
  });

  it("does not restore a stage the vocabulary has never defined", () => {
    expect(isRestorableCrmPipelineStage("not_a_stage")).toBe(false);
    expect(isRestorableCrmPipelineStage("")).toBe(false);
    expect(isRestorableCrmPipelineStage(null)).toBe(false);
  });
});
