/**
 * GovernanceConsole.test.tsx — SC-01 Wave 06, lane T14 (manifest row A-35).
 *
 * The Tender Config tab renders ONLY what `tender_governance_config` returns
 * (read contract proven in supabase-governance-data.test.ts). These tests
 * cover the pure display model: every stored row must reach the screen —
 * grouped, never dropped — and every stored value must render without
 * throwing, whatever shape the JSONB column holds.
 *
 * No DOM test environment exists in this package, so the helpers are exported
 * as pure functions and asserted directly (house pattern, AuditTrail.test.tsx).
 */
import { describe, expect, it } from "vitest";
import type { GovernanceConfigEntry } from "@/lib/supabase-governance-data";
import { formatGovernanceConfigValue, groupGovernanceConfigEntries } from "./GovernanceConsole";

function configEntry(over: Partial<GovernanceConfigEntry>): GovernanceConfigEntry {
  return {
    id: "tgc-1",
    config_key: "tender_templates",
    config_value: { templates: [] },
    category: "Templates",
    description: "stored description",
    is_active: true,
    updated_at: "2026-06-01T08:00:00.000Z",
    ...over,
  };
}

describe("groupGovernanceConfigEntries — every stored row reaches the screen", () => {
  it("groups by recorded category preserving first-seen order", () => {
    const groups = groupGovernanceConfigEntries([
      configEntry({ id: "a", category: "Templates" }),
      configEntry({ id: "b", category: "Gate Rules" }),
      configEntry({ id: "c", category: "Templates" }),
    ]);
    expect(groups.map(g => g.category)).toEqual(["Templates", "Gate Rules"]);
    expect(groups[0]!.entries.map(e => e.id)).toEqual(["a", "c"]);
    expect(groups[1]!.entries.map(e => e.id)).toEqual(["b"]);
  });

  it("never drops an entry: group sizes sum to the input size", () => {
    const entries = [
      configEntry({ id: "a", category: "Templates" }),
      configEntry({ id: "b", category: "" }),
      configEntry({ id: "c", category: undefined as unknown as string }),
      configEntry({ id: "d", category: "Roles" }),
    ];
    const groups = groupGovernanceConfigEntries(entries);
    const total = groups.reduce((sum, g) => sum + g.entries.length, 0);
    expect(total).toBe(entries.length);
  });

  it("an entry with no recorded category is shown as Uncategorized, not hidden", () => {
    const groups = groupGovernanceConfigEntries([configEntry({ id: "x", category: "" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe("Uncategorized");
    expect(groups[0]!.entries[0]!.id).toBe("x");
  });

  it("zero entries produce zero groups (the panel renders its empty state instead)", () => {
    expect(groupGovernanceConfigEntries([])).toEqual([]);
  });
});

describe("formatGovernanceConfigValue — stored values render without throwing", () => {
  it("passes a stored string through unchanged", () => {
    expect(formatGovernanceConfigValue("advisory")).toBe("advisory");
  });

  it("renders an absent value as an explicit dash, never 'undefined'", () => {
    expect(formatGovernanceConfigValue(null)).toBe("—");
    expect(formatGovernanceConfigValue(undefined)).toBe("—");
  });

  it("renders JSONB objects and arrays as readable JSON", () => {
    expect(formatGovernanceConfigValue({ gate: "warn" })).toBe(JSON.stringify({ gate: "warn" }, null, 1));
    expect(formatGovernanceConfigValue([1, 2])).toBe(JSON.stringify([1, 2], null, 1));
    expect(formatGovernanceConfigValue(7)).toBe("7");
    expect(formatGovernanceConfigValue(false)).toBe("false");
  });

  it("does not throw on an unserialisable value", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => formatGovernanceConfigValue(circular)).not.toThrow();
    expect(typeof formatGovernanceConfigValue(circular)).toBe("string");
  });
});
