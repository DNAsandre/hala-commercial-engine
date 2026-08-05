/**
 * PipelineCard.test.tsx — SC-01 Wave 04 / correction lane W04-C1.
 *
 * Defends four corrections to the CRM Kanban card and its preview strip:
 *
 *   A — the executive gauges printed "85%" / "80%" from three-way bucket
 *       constants. Nothing measured 85. Every printed figure must now come
 *       from the record.
 *   C — a never-captured value must not render as "SAR 0" or a red "0%".
 *   D — an unparseable created_at must not print "NaNd".
 *   F — every card must be draggable, including cards in Closed Won and
 *       Actual Go Live, and the label the code tests must be the real one.
 *
 * This package has no DOM test environment (no jsdom / happy-dom /
 * testing-library in package.json and no `test` block in vite.config.ts), so
 * the card is rendered with `react-dom/server`, which needs no DOM. The
 * preview dialog is closed in that render, so the strip is asserted through
 * `ticketMeasures`, the exact data the strip maps over.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { PipelineTicketCard, ticketMeasures } from "./PipelineCard";
import type { PipelineTicket } from "@/lib/pipeline-tickets";

function pipelineTicket(overrides: Partial<PipelineTicket> = {}): PipelineTicket {
  return {
    id: "t-1",
    sourceTable: "commercial_tickets",
    customerName: "Linde SIGAS",
    opportunityName: "Bulk Transportation Tender",
    ticketType: "proposal",
    lineageStatus: "verified",
    owner: "Sara Al Otaibi",
    ownerInitials: "SA",
    region: "Central",
    sarValue: 4_200_000,
    gpPct: 18,
    riskLevel: "amber",
    riskLabel: "Low GP",
    crmStage: "Qualified",
    internalStage: "qualified",
    nextAction: "Send proposal",
    daysInStage: 12,
    syncStatus: "synced",
    volumePallets: 0,
    probabilityPct: 60,
    goLiveDate: "",
    serviceType: "",
    flags: [],
    workspaceId: null,
    quoteStatus: "",
    proposalStatus: "",
    slaStatus: "",
    contractStatus: "",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function html(ticket: PipelineTicket): string {
  return renderToStaticMarkup(
    <Router ssrPath="/crm-pipeline">
      <PipelineTicketCard ticket={ticket} />
    </Router>,
  );
}

/** Strips tags so assertions run against what a human actually reads. */
function text(ticket: PipelineTicket): string {
  return html(ticket)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Defect A: no fabricated percentage ──────────────────────────────

describe("ticketMeasures — every printed figure is a real measurement", () => {
  it("prints the actual GP%, not a bucket constant", () => {
    const [margin] = ticketMeasures(pipelineTicket({ gpPct: 24, riskLevel: "green" }));
    // Was: gpPct >= 22 ? 85 → rendered as the literal text "85%".
    expect(margin.text).toBe("24%");
    expect(margin.text).not.toBe("85%");
    expect(margin.tone).toBe("green");
  });

  it("never prints 85, 50, 15, 80 or 20 for a record that measures none of them", () => {
    const fabricated = ["85%", "80%", "50%", "15%", "20%"];
    for (const gpPct of [4, 12, 24, 30]) {
      for (const daysInStage of [1, 10, 40]) {
        const measures = ticketMeasures(pipelineTicket({ gpPct, daysInStage, probabilityPct: 33 }));
        const printed = measures.map(m => m.text);
        for (const value of fabricated) {
          // The only way one of these appears is if the record really measures it.
          if (value === `${gpPct}%` || value === `${daysInStage}%`) continue;
          expect(printed).not.toContain(value);
        }
        expect(printed[0]).toBe(`${gpPct}%`);
        expect(printed[1]).toBe(`${daysInStage}d`);
        expect(printed[2]).toBe("33%");
      }
    }
  });

  it("prints days as days, so no bar percentage is mistaken for a measure", () => {
    const [, age] = ticketMeasures(pipelineTicket({ daysInStage: 12 }));
    expect(age.text).toBe("12d");
    expect(age.label).toContain("Days in Stage");
    // The bar is scaled, and its scale is disclosed rather than printed.
    expect(age.scaleNote).toContain("30 days");
  });

  it("shows 'Not captured' with no bar and no colour verdict when nothing was captured", () => {
    const measures = ticketMeasures(pipelineTicket({
      gpPct: null, riskLevel: "unknown", daysInStage: null, probabilityPct: null,
    }));
    expect(measures.map(m => m.text)).toEqual(["Not captured", "Not captured", "Not captured"]);
    expect(measures.map(m => m.fill)).toEqual([null, null, null]);
    expect(measures.map(m => m.tone)).toEqual(["none", "none", "none"]);
  });

  it("takes its margin verdict from the ticket's own risk level, not a local rule", () => {
    expect(ticketMeasures(pipelineTicket({ gpPct: 18, riskLevel: "amber" }))[0].tone).toBe("amber");
    expect(ticketMeasures(pipelineTicket({ gpPct: 4, riskLevel: "red" }))[0].tone).toBe("red");
  });
});

// ── Defect C: absent values are not measured zeros ──────────────────

describe("PipelineTicketCard — a never-captured figure is not rendered as 0", () => {
  it("says 'Not captured' instead of SAR 0 and 0%", () => {
    const rendered = text(pipelineTicket({
      sarValue: null, gpPct: null, riskLevel: "unknown", riskLabel: "GP not captured",
    }));
    expect(rendered).toContain("Not captured");
    expect(rendered).not.toMatch(/\b0%/);
    expect(rendered).not.toMatch(/SAR 0\b/);
  });

  it("does not paint an uncaptured margin red or call it Critical", () => {
    const markup = html(pipelineTicket({
      sarValue: null, gpPct: null, riskLevel: "unknown", riskLabel: "GP not captured",
    }));
    expect(markup).not.toContain("text-red-600");
    expect(markup).not.toContain("border-l-red-400");
    expect(text(pipelineTicket({ gpPct: null, riskLevel: "unknown", riskLabel: "GP not captured" })))
      .not.toContain("Critical");
  });

  it("still renders a STORED zero as a real 0%", () => {
    const rendered = text(pipelineTicket({ gpPct: 0, riskLevel: "red", riskLabel: "Critical" }));
    expect(rendered).toContain("0%");
    expect(rendered).toContain("Critical");
  });
});

// ── Defect D: no literal NaN ────────────────────────────────────────

describe("PipelineTicketCard — days never render as NaN", () => {
  it("prints a dash rather than 'NaNd' when the age is unknown", () => {
    const rendered = text(pipelineTicket({ daysInStage: null }));
    expect(rendered).not.toContain("NaN");
    expect(rendered).not.toContain("nulld");
    expect(rendered).toContain("—");
  });

  it("prints the real age when it is known", () => {
    expect(text(pipelineTicket({ daysInStage: 12 }))).toContain("12d");
  });
});

// ── Defect F: no stage lock, no silent broken drag ──────────────────

describe("PipelineTicketCard — every card can be dragged out of its stage", () => {
  it("marks a Closed Won card draggable", () => {
    expect(html(pipelineTicket({ crmStage: "Closed Won" }))).toContain("draggable=\"true\"");
  });

  it("marks an Actual Go Live card draggable", () => {
    // The old test compared against the string "Go Live" while the real label
    // is "Actual Go Live", so these cards were grabbable but undroppable.
    expect(html(pipelineTicket({ crmStage: "Actual Go Live" }))).toContain("draggable=\"true\"");
  });

  it("marks every stage a card can occupy draggable, with no exception", () => {
    const stages: PipelineTicket["crmStage"][] = [
      "Prospecting", "Qualified", "Proposal Sent", "Shortlisted",
      "Contract Negotiation", "Closed Won", "Contract Signed",
      "Actual Go Live", "Closed Lost", "Discontinued",
    ];
    for (const crmStage of stages) {
      expect(html(pipelineTicket({ crmStage }))).toContain("draggable=\"true\"");
    }
  });

  it("never emits draggable=false", () => {
    expect(html(pipelineTicket({ crmStage: "Closed Won" }))).not.toContain("draggable=\"false\"");
  });
});
