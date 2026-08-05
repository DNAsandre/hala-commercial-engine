/**
 * Renewals.test.tsx — SC-01 Wave 04, lane T07-B.
 *
 * This package has no DOM test environment (no jsdom / happy-dom / testing-library
 * in `package.json`, and `vite.config.ts` declares no `test` block), and neither
 * file is on this lane's write allowlist. So the page is rendered with
 * `react-dom/server`, which needs no DOM. That is why `RenewalsView` is a pure
 * function of its `state` prop: the loading, records, empty and failed-read
 * states are all reachable synchronously and their markup can be asserted.
 *
 * What these tests defend: the honest empty state and the failed-read state must
 * never be mistakable for one another, and neither may look like a finished
 * feature.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { RenewalsView } from "./Renewals";
import type { ContractBaselineRow, RenewalWorkspaceRow, RenewalsViewState } from "@/lib/renewals-data";

/** `ssrPath` gives wouter a location without a browser, matching the real route. */
function html(state: RenewalsViewState): string {
  return renderToStaticMarkup(
    <Router ssrPath="/customers/renewals">
      <RenewalsView state={state} />
    </Router>,
  );
}

/** Strips tags so assertions run against what a human actually reads. */
function text(state: RenewalsViewState): string {
  return html(state)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const workspace: RenewalWorkspaceRow = {
  id: "11111111-1111-4111-8111-111111111111",
  customer_id: "c-1",
  customer_name: "Stored Customer A",
  baseline_id: "b-1",
  status: "in_progress",
  owner: "stored-owner",
  decision: "pending",
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-03-04T00:00:00Z",
};

const baseline: ContractBaselineRow = {
  id: "22222222-2222-4222-8222-222222222222",
  customer_id: "c-1",
  customer_name: "Stored Customer A",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "stored-user",
};

describe("real rows render", () => {
  const state: RenewalsViewState = {
    kind: "records",
    workspaces: [workspace],
    baselines: [baseline],
    failures: [],
  };

  it("renders the stored values, not substitutes", () => {
    const t = text(state);
    expect(t).toContain("Stored Customer A");
    expect(t).toContain(workspace.id);
    expect(t).toContain("in_progress");
    expect(t).toContain("stored-owner");
    expect(t).toContain("2026-03-04");
  });

  it("shows counters that equal the rows actually rendered", () => {
    const t = text(state);
    expect(t).toContain("1 renewal workspace");
    expect(t).toContain("1 contract baseline");
    expect(t).toContain("Renewal workspaces (1)");
    expect(t).toContain("Contract baselines (1)");
  });

  it("does not show the empty state or the failure state alongside real rows", () => {
    const t = text(state);
    expect(t).not.toContain("No renewal records are stored or visible");
    expect(t).not.toContain("could not be read");
  });

  it("renders a row with no stored owner/decision as a dash, never as invented text", () => {
    const bare: RenewalWorkspaceRow = {
      ...workspace,
      customer_name: null,
      status: null,
      owner: null,
      decision: null,
      updated_at: null,
    };
    const t = text({ kind: "records", workspaces: [bare], baselines: [], failures: [] });
    expect(t).toContain("Owner: —");
    expect(t).toContain("Decision: —");
    expect(t).toContain("Updated: —");
    // no substituted "today"
    expect(t).not.toContain(new Date().toISOString().slice(0, 10));
  });

  it("declares incompleteness when part of the read failed", () => {
    const t = text({
      kind: "records",
      workspaces: [workspace],
      baselines: [],
      failures: [
        { source: "contract_baselines", status: "error", message: "permission denied" },
      ],
    });
    expect(t).toContain("Part of this page could not be read");
    expect(t).toContain("contract_baselines");
    expect(t).toContain("permission denied");
  });
});

describe("zero rows render the honest empty state", () => {
  const t = text({ kind: "empty" });

  it("says plainly that nothing is stored or visible", () => {
    expect(t).toContain("No renewal records are stored or visible");
  });

  it("names the relations it read so the claim is checkable", () => {
    expect(t).toContain("renewal_workspaces");
    expect(t).toContain("contract_baselines");
  });

  it("does not present itself as a completed feature", () => {
    expect(t).toContain("not yet populated");
    expect(t).toContain("not a finished renewals feature");
  });

  it("does not overclaim: it concedes row-level security may be hiding rows", () => {
    expect(t).toContain("row-level security");
  });

  it("renders no fabricated rows, customers, dates or values", () => {
    expect(t).not.toContain("Stored Customer A");
    expect(t).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(t).not.toContain("SAR");
  });

  it("is not the failure state", () => {
    expect(t).not.toContain("Renewal records could not be read");
  });
});

describe("a read error renders the error state and NOT the empty state", () => {
  const t = text({
    kind: "unreadable",
    failures: [
      { source: "renewal_workspaces", status: "error", message: "permission denied" },
      { source: "contract_baselines", status: "unavailable", message: "not present" },
    ],
  });

  it("states that the read failed", () => {
    expect(t).toContain("Renewal records could not be read");
    expect(t).toContain("This is a failed read, not a result");
  });

  it("must NOT claim there are no records", () => {
    expect(t).not.toContain("No renewal records are stored or visible");
    expect(t).not.toContain("not yet populated");
  });

  it("distinguishes an absent relation from a failed read", () => {
    expect(t).toContain("is not present in this environment");
    expect(t).toContain("could not be read: permission denied");
  });

  it("shows no record counter, because the record count is unknown", () => {
    expect(t).not.toMatch(/\d+ renewal workspaces?/);
    expect(t).not.toMatch(/\d+ contract baselines?/);
  });
});

describe("loading is a third, distinct state", () => {
  const t = text({ kind: "loading" });

  it("says it is still checking", () => {
    expect(t).toContain("Checking stored renewal records");
  });

  it("is neither the empty state nor the failure state", () => {
    expect(t).not.toContain("No renewal records are stored or visible");
    expect(t).not.toContain("Renewal records could not be read");
  });
});

describe("navigation stays inside the clean app", () => {
  it("links to root-based clean routes only", () => {
    const markup = html({ kind: "empty" });
    expect(markup).toContain('href="/crm-pipeline"');
    expect(markup).toContain('href="/workspaces/tenders"');
    expect(markup).toContain('href="/workspaces/proposals"');
    expect(markup).not.toContain("localhost:3001");
    expect(markup).not.toContain("/clean/");
  });
});
