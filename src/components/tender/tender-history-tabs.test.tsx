/**
 * tender-history-tabs.test.tsx — TCW-T4 (F6)
 *
 * Stored history rows must render regardless of their wording. The pre-wave
 * tabs silently HID any row whose text contained mock/sample/simulated/fake/
 * "development mode"/"coming soon" and computed all counters over the filtered
 * remainder — a human note containing the word "mock" vanished from the
 * operational timeline and from the governance audit trail. These
 * react-dom/server markup tests pin the fix: every stored row appears and the
 * total counters count the full set.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import TenderActivityTab from "@/components/tender/TenderActivityTab";
import TenderAuditTrailTab from "@/components/tender/TenderAuditTrailTab";

function activityEvent(id: string, title: string, description: string) {
  return {
    id,
    tenderWorkspaceId: "t-1",
    eventType: "note",
    title,
    description,
    category: "workspace",
    userId: "Amina",
    userName: "Amina",
    timestamp: "2026-08-19T10:00:00.000Z",
    severity: "info",
    mock: false,
    notes: undefined,
  } as any;
}

function auditEntry(id: string, details: string) {
  return {
    id,
    tenderWorkspaceId: "t-1",
    action: "updated",
    eventCode: "pricing.scenarios",
    eventName: "pricing.scenarios",
    entityType: "commercial_ticket",
    entityId: "t-1",
    category: "SYSTEM",
    userId: "Amina",
    userName: "Amina",
    timestamp: "2026-08-19T10:00:00.000Z",
    details,
    beforeState: undefined,
    afterState: undefined,
    severity: "info",
    mock: false,
    notes: undefined,
  } as any;
}

function wsWith(overrides: Record<string, unknown>) {
  return {
    tender: { id: "t-1" },
    activityEvents: [],
    auditEntries: [],
    ...overrides,
  } as any;
}

describe("TenderActivityTab renders every stored row (F6)", () => {
  it("a note containing the word 'mock' is shown, and Total counts the full set", () => {
    const ws = wsWith({
      activityEvents: [
        activityEvent("e1", "Mock bypass discussion with client", "They asked about the mock submission portal"),
        activityEvent("e2", "Kickoff call", "Ordinary note"),
      ],
    });
    const html = renderToStaticMarkup(React.createElement(TenderActivityTab, { ws, tenderId: "t-1", reload: () => {} }));
    expect(html).toContain("Mock bypass discussion with client");
    expect(html).toContain("Kickoff call");
    // "2 of 2 shown" — no row was hidden.
    expect(html).toContain("2 of 2 shown");
  });
});

describe("TenderAuditTrailTab renders every stored row (F6)", () => {
  it("an audit row whose text contains 'simulated'/'mock' is neither hidden nor uncounted", () => {
    const rowWithMarkerInEvent = { ...auditEntry("a1", "Reverted a simulated pricing entry recorded in error"), eventCode: "simulated_entry_correction", eventName: "simulated_entry_correction" };
    const ws = wsWith({
      auditEntries: [
        rowWithMarkerInEvent,
        auditEntry("a2", "P&L / Pricing updated | scenarios"),
      ],
    });
    const html = renderToStaticMarkup(React.createElement(TenderAuditTrailTab, { ws }));
    // The row renders (its event name is visible in the table)…
    expect(html).toContain("simulated_entry_correction");
    // …and the counters count the FULL stored set — nothing was hidden.
    expect(html).toContain("2 of 2 shown");
  });
});
