/**
 * final-pack-loader-truth.test.ts — PADW T06a acceptance pins.
 *
 * Pins the loader-side source-truth repairs from the PDF Studio
 * commercial-grade audit (docs/pdf-studio-commercial-grade-audit/07):
 *
 *   PDS-01  pricing rows are a CUSTOMER-FACING projection — internal cost,
 *           GP%, recommendation and internal notes never leave the loader;
 *   PDS-04  SLA matrix reads the REAL writer field names (kpi_name /
 *           measurement_method), honors include_in_proposal, and sources
 *           penalty honestly from governance penalty linkage;
 *   PDS-06  drafted blocks match slots on structured fields (block_type /
 *           document_assembly_target) and unmatched drafted content is
 *           ingested as additional sections with warnings — never dropped;
 *   PDS-09  totals parse locale-formatted revenue; unparsable revenue is an
 *           honest state, never "SAR 1.00";
 *   PDS-21  scope.table maps the real captured sow_data.service_lines string[];
 *           cross-lane PDF source-map id: t:sow_data.service_lines[];
 *   PDS-22  the rate card block never renders the internal P&L summary.
 *
 * Mock contract: house standard — the Supabase double honours the select
 * projection (only requested columns come back).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  responses: new Map<string, { data: unknown; error: unknown }>(),
}));

function project(row: Record<string, unknown> | null, select?: string) {
  if (!row || typeof row !== "object") return row;
  if (!select || select.trim() === "*") return row;
  const cols = select.split(",").map((c) => c.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

vi.mock("./supabase", () => ({
  supabase: {
    from(table: string) {
      const call = { select: undefined as string | undefined };
      const result = () => db.responses.get(table) ?? { data: null, error: null };
      const settle = (single: boolean) => {
        const res = result();
        if (res.error) return { data: null, error: res.error };
        const data = res.data;
        if (Array.isArray(data)) {
          const rows = data.map((r) => project(r as Record<string, unknown>, call.select));
          return { data: single ? rows[0] ?? null : rows, error: null };
        }
        return { data: data ? project(data as Record<string, unknown>, call.select) : null, error: null };
      };
      const builder: Record<string, unknown> = {};
      Object.assign(builder, {
        select(cols?: string) { call.select = cols; return builder; },
        eq() { return builder; },
        in() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle: async () => settle(true),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(settle(false)).then(res, rej),
      });
      return builder;
    },
  },
}));

// DOMPurify pass-through double (house pattern from final-pack-fidelity.test.ts).
vi.mock("dompurify", () => ({
  default: { sanitize: (html: string) => html },
}));

import {
  buildTenderSourceData,
  computeSourceHash,
  loadTenderPack,
  parseRecordedRevenue,
} from "./final-pack-loader";
import { buildPreviewHTML, DEFAULT_BRANDING } from "./final-pack-preview";

// ─── fixtures ────────────────────────────────────────────────

const TENDER_ROW = {
  id: "f5e10000-0000-4000-8000-0000000000t6",
  ticket_type: "tender",
  ticket_title: "T06a Truth Tender",
  customer_name: "Truth Customer",
  estimated_value: 1_200_000,
  target_gp_percent: 25,
  target_date: "2026-11-01",
  internal_stage: "final_approved",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  type_details: {
    pricing: {
      scenarios: {
        rows: [{
          id: "sc-1",
          scenario_name: "Base",
          scenario_type: "Primary",
          revenue: "1,200,000",
          cost: "980,000",
          gp_percent: "18.3",
          recommended: "Recommended",
          notes: "INTERNAL: thin margin, do not discount further",
        }],
        selected_scenario: { selected_scenario_id: "sc-1" },
      },
    },
    solution_design_data: {
      sla_kpi: {
        kpis: [
          {
            kpi_name: "OTIF",
            target: "95%",
            measurement_method: "Monthly TMS report",
            include_in_proposal: "Yes",
          },
          {
            kpi_name: "Internal-only KPI",
            target: "99%",
            measurement_method: "Internal audit",
            include_in_proposal: "No",
          },
        ],
        governance: { penalty_linkage: "Yes" },
      },
    },
    sow_data: {
      service_lines: ["Warehousing", "Transport"],
    },
    tender_drafting: {
      proposal_blocks: [
        // Structured match: block_type wins although the title differs.
        { id: "pb-1", title: "Why Hala", block_type: "Executive Summary", content_html: "<p>Structured intro</p>" },
        // No slot matches this — must be INGESTED, never dropped (PDS-06).
        { id: "pb-2", title: "Operating Model", block_type: "Operating Model", content_html: "<p>Drafted operating model</p>" },
      ],
    },
  },
};

const RECIPE = [
  { block_key: "intro.narrative", order: 1, required: false, default_content_override: null, config_override: {} },
  { block_key: "scope.table", order: 2, required: false, default_content_override: null, config_override: {} },
  { block_key: "pricing.table.single", order: 3, required: true, default_content_override: null, config_override: {} },
  { block_key: "totals.number_to_words", order: 4, required: false, default_content_override: null, config_override: {} },
  { block_key: "annexure.b.sla_matrix", order: 5, required: false, default_content_override: null, config_override: {} },
  { block_key: "annexure.c.rate_card", order: 6, required: false, default_content_override: null, config_override: {} },
  { block_key: "signature.dual", order: 7, required: true, default_content_override: null, config_override: {} },
];

const BLOCK_LIBRARY = [
  { id: "bl-1", block_key: "intro.narrative", family: "commercial", display_name: "Introduction", editor_mode: "wysiwyg", render_key: "narrative", default_content: "<p>default intro</p>", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-2", block_key: "scope.table", family: "data_bound", display_name: "Scope Table", editor_mode: "form", render_key: "scope_table", default_content: "", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-3", block_key: "pricing.table.single", family: "commercial", display_name: "Pricing", editor_mode: "form", render_key: "pricing_table_single", default_content: "", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-4", block_key: "totals.number_to_words", family: "commercial", display_name: "Totals", editor_mode: "form", render_key: "totals_words", default_content: "", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-5", block_key: "annexure.b.sla_matrix", family: "annexure", display_name: "SLA Matrix", editor_mode: "form", render_key: "annexure_sla", default_content: "", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-6", block_key: "annexure.c.rate_card", family: "annexure", display_name: "Rate Card", editor_mode: "form", render_key: "annexure_rate_card", default_content: "", schema_config: {}, permissions: {}, description: "" },
  { id: "bl-7", block_key: "signature.dual", family: "legal", display_name: "Signatures", editor_mode: "form", render_key: "signature_dual", default_content: "", schema_config: {}, permissions: {}, description: "" },
];

function seed() {
  db.responses.set("commercial_tickets", { data: TENDER_ROW, error: null });
  db.responses.set("doc_template_versions", {
    data: { id: "tv-t6", template_id: "tpl-002", recipe: RECIPE, layout: null },
    error: null,
  });
  db.responses.set("doc_template_volumes", { data: [], error: null });
  db.responses.set("doc_block_library", { data: BLOCK_LIBRARY, error: null });
  db.responses.set("doc_templates", { data: { name: "Full Commercial Proposal" }, error: null });
}

beforeEach(() => {
  db.responses.clear();
  seed();
});

// ═════════════════════════════════════════════════════════════
// PDS-01 — customer-facing pricing projection
// ═════════════════════════════════════════════════════════════

describe("PDS-01 — internal pricing never leaves the loader", () => {
  it("pricing rows carry ONLY customer-facing fields, revenue formatted", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const pricing = snapshot.blocks.find((b) => b.block_key === "pricing.table.single");
    expect(pricing?.content.source_status).toBe("populated");
    const rows = pricing?.content.pricing_rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "sc-1",
      scenario_name: "Base",
      scenario_type: "Primary",
      revenue: expect.stringContaining("1,200,000"),
    });
    // The internal columns are structurally absent, not just empty.
    expect(rows[0]).not.toHaveProperty("cost");
    expect(rows[0]).not.toHaveProperty("gp_percent");
    expect(rows[0]).not.toHaveProperty("recommended");
    expect(rows[0]).not.toHaveProperty("notes");
    // And no internal value appears anywhere in the serialized block.
    const serialized = JSON.stringify(pricing);
    expect(serialized).not.toContain("980,000");
    expect(serialized).not.toContain("18.3");
    expect(serialized).not.toContain("INTERNAL");
  });

  it("the rendered pricing table shows customer columns only (render half of PDS-01)", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const html = buildPreviewHTML({
      blocks: snapshot.blocks,
      branding: DEFAULT_BRANDING,
      exportMode: "final",
      customerName: "Truth Customer",
      refNumber: "REF-1",
      date: "24/08/2026",
    });
    expect(html).toContain("1,200,000");
    expect(html).not.toContain('<th class="num">Cost</th>');
    expect(html).not.toContain("GP %");
    expect(html).not.toContain("980,000");
    expect(html).not.toContain("INTERNAL");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-09 — locale-tolerant totals, honest unparsable state
// ═════════════════════════════════════════════════════════════

describe("PDS-09 — totals parse", () => {
  it('parses "1,200,000" to the full amount (never "SAR 1.00")', async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const totals = snapshot.blocks.find((b) => b.block_key === "totals.number_to_words");
    expect(totals?.content.source_status).toBe("populated");
    expect(totals?.content.variables?.total_amount).toContain("1,200,000");
    expect(totals?.content.variables?.total_in_words).toContain("One Million Two Hundred Thousand");
  });

  it("an unparsable recorded revenue is an honest state, not a fabricated total", async () => {
    const row = JSON.parse(JSON.stringify(TENDER_ROW));
    row.type_details.pricing.scenarios.rows[0].revenue = "approx 1.2m TBD";
    db.responses.set("commercial_tickets", { data: row, error: null });

    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const totals = snapshot.blocks.find((b) => b.block_key === "totals.number_to_words");
    expect(totals?.content.source_status).toBe("not_captured");
    expect(totals?.content.variables?.total_amount).toContain("not a clean number");
    expect(totals?.content.variables?.total_amount).not.toContain("SAR 1.00");
  });

  it("parseRecordedRevenue accepts separators and SAR tokens, refuses prose", () => {
    expect(parseRecordedRevenue("1,200,000")).toBe(1_200_000);
    expect(parseRecordedRevenue("SAR 1,200,000.50")).toBe(1_200_000.5);
    expect(parseRecordedRevenue(" 950000 ")).toBe(950_000);
    expect(parseRecordedRevenue("approx 1.2m")).toBeNull();
    expect(parseRecordedRevenue("1.200.000")).toBeNull();
    expect(parseRecordedRevenue("")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-04 — SLA matrix real field mapping
// ═════════════════════════════════════════════════════════════

describe("PDS-04 — SLA matrix reads the writer's real fields", () => {
  it("maps kpi_name/measurement_method, excludes include_in_proposal=No, honest penalty", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const sla = snapshot.blocks.find((b) => b.block_key === "annexure.b.sla_matrix");
    expect(sla?.content.source_status).toBe("populated");
    const rows = sla?.content.sla_rows ?? [];
    expect(rows).toHaveLength(1); // the "No" row is excluded
    expect(rows[0]).toEqual({
      kpi: "OTIF",
      target: "95%",
      measurement: "Monthly TMS report",
      penalty: "Per governance penalty linkage: Yes",
    });
    expect(JSON.stringify(rows)).not.toContain("Internal-only KPI");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-06 — no drafted content silently dropped
// ═════════════════════════════════════════════════════════════

describe("PDS-06 — drafted content ingestion", () => {
  it("block_type matches the intro slot even when the title differs", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const intro = snapshot.blocks.find((b) => b.block_key === "intro.narrative");
    expect(intro?.content.html).toBe("<p>Structured intro</p>");
    expect(intro?.content.source_status).toBe("populated");
  });

  it("an unmatched drafted block is ingested as an additional section with a warning", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const extra = snapshot.blocks.find((b) => b.block_key.startsWith("drafted.extra."));
    expect(extra).toBeDefined();
    expect(extra?.display_name).toBe("Operating Model");
    expect(extra?.content.html).toBe("<p>Drafted operating model</p>");
    expect(extra?.content.source_status).toBe("populated");
    expect(extra?.required).toBe(false);
    expect(snapshot.warnings.join(" ")).toContain('Drafted block "Operating Model"');
    // Order is contiguous after the splice.
    expect(snapshot.blocks.map((b) => b.order)).toEqual(
      snapshot.blocks.map((_, i) => i + 1),
    );
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-07 — flagged commercial terms reach the pack
// ═════════════════════════════════════════════════════════════

describe("PDS-07 — commercial terms flagged for the proposal", () => {
  it("renders scalar terms and ONLY include_in_proposal=Yes rows as a Commercial Terms section", async () => {
    const row = JSON.parse(JSON.stringify(TENDER_ROW));
    row.type_details.pricing.commercial_terms = {
      payment_tax_validity: {
        payment_terms: "30 days from invoice",
        vat_treatment: "Standard",
        vat_percent: "15",
        proposal_validity: "60 days",
        contract_term: "",
        extension_option: "Not Assessed",
      },
      surcharges: [
        { id: "s1", charge_type: "Fuel", trigger: "Diesel > SAR 3/l", rate_formula: "+2%", applies_to: "Transport", notes: "", include_in_proposal: "Yes" },
        { id: "s2", charge_type: "Internal-only", trigger: "x", rate_formula: "y", applies_to: "z", notes: "", include_in_proposal: "Not Assessed" },
      ],
      customer_responsibilities: [],
      exclusions: [
        { id: "e1", exclusion: "Customs fines", reason: "Outside Hala control", commercial_impact: "", include_in_proposal: "Yes", notes: "" },
      ],
      assumptions: [],
    };
    db.responses.set("commercial_tickets", { data: row, error: null });

    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const ct = snapshot.blocks.find((b) => b.block_key === "commercial.terms.recorded");
    expect(ct).toBeDefined();
    expect(ct?.content.source_status).toBe("populated");
    expect(ct?.content.html).toContain("30 days from invoice");
    expect(ct?.content.html).toContain("Fuel");
    expect(ct?.content.html).toContain("Customs fines");
    // Strict opt-in: "Not Assessed" rows stay internal.
    expect(ct?.content.html).not.toContain("Internal-only");
    // Placed before the signature block.
    const ctIndex = snapshot.blocks.findIndex((b) => b.block_key === "commercial.terms.recorded");
    const sigIndex = snapshot.blocks.findIndex((b) => b.block_key === "signature.dual");
    expect(ctIndex).toBeLessThan(sigIndex);
  });

  it("no flagged terms → no Commercial Terms section (honest absence)", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    expect(snapshot.blocks.some((b) => b.block_key === "commercial.terms.recorded")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-21 — scope table maps real captured SOW data
// ═════════════════════════════════════════════════════════════

describe("PDS-21 — scope.table real mapping", () => {
  it("renders the canonical string[] service lines without invented object fields", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const scope = snapshot.blocks.find((b) => b.block_key === "scope.table");
    expect(scope?.content.source_status).toBe("populated");
    expect(scope?.content.html).toContain("<td>Warehousing</td><td></td><td></td>");
    expect(scope?.content.html).toContain("<td>Transport</td><td></td><td></td>");
    expect(scope?.content.html).not.toContain("Not captured yet");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-22 — rate card never renders the internal P&L
// ═════════════════════════════════════════════════════════════

describe("PDS-22 — rate card honesty", () => {
  it("the rate card block is honestly not_captured, with a warning — no internal P&L", async () => {
    const snapshot = await loadTenderPack(TENDER_ROW.id, "combined_proposal");
    const rateCard = snapshot.blocks.find((b) => b.block_key === "annexure.c.rate_card");
    expect(rateCard?.content.source_status).toBe("not_captured");
    expect(rateCard?.content.pricing_rows).toEqual([]);
    expect(snapshot.warnings.join(" ")).toContain("Rate card content is not captured");
    expect(JSON.stringify(rateCard)).not.toContain("980,000");
  });
});

// ═════════════════════════════════════════════════════════════
// PDS-18 / PDS-23 / PDS-24 — proposal identity + source parity
// ═════════════════════════════════════════════════════════════

describe("proposal source identity and source projections", () => {
  it("labels proposal snapshots as proposals and projects scope, SLA and evidence", async () => {
    const row = {
      ...TENDER_ROW,
      ticket_type: "proposal",
      ticket_title: "Proposal Source Truth",
      type_details: {
        proposal_workspace: {
          solution_design: {
            data: {
              solutionConfiguration: {
                solutionOverview: "Integrated warehousing and transport",
                operatingModel: "Dedicated control tower",
              },
              serviceScope: {
                included: "Inbound, storage and outbound",
                excluded: "Customs clearance",
                customerResponsibilities: "Provide forecasts",
                halaResponsibilities: "Operate the control tower",
                kpiScope: "OTIF and inventory accuracy",
              },
              warehouseModel: { storageType: "Ambient", capacityEstimate: "5,000 pallets" },
              transportModel: { laneStructure: "Riyadh to Jeddah", sla: "95% OTIF" },
              vasHandling: {},
            },
          },
          proposal_drafting: {
            data: {
              proposalEvidenceItems: [{
                id: "ev-1",
                evidenceTitle: "Customer requirements",
                evidenceType: "RFP",
                documentRef: "doc-proposal-1",
              }],
            },
          },
        },
      },
    };
    db.responses.set("commercial_tickets", { data: row, error: null });

    const snapshot = await loadTenderPack(row.id, "combined_proposal", undefined, "proposal");

    expect(snapshot.source_kind).toBe("proposal_engine");
    expect(snapshot.linked_entity_type).toBe("proposal");
    expect(snapshot.linked_entity_id).toBe(row.id);
    expect(snapshot.blocks.find((block) => block.block_key === "scope.table")?.content.html)
      .toContain("Inbound, storage and outbound");
    expect(snapshot.blocks.find((block) => block.block_key === "annexure.b.sla_matrix")?.content.sla_rows)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ kpi: "Recorded KPI scope", target: "OTIF and inventory accuracy" }),
        expect.objectContaining({ kpi: "Recorded transport SLA", target: "95% OTIF" }),
      ]));
    const evidence = snapshot.blocks.find((block) => block.block_key === "source.documents.recorded");
    expect(evidence?.content.html).toContain("Customer requirements");
    expect(evidence?.content.html).toContain("doc-proposal-1");
    expect(evidence?.provenance?.source_kind).toBe("proposal_engine");
  });
});

describe("PDS-23 / PDS-59 — active documents and exact drift scope", () => {
  function rowWithDocuments() {
    const row = JSON.parse(JSON.stringify(TENDER_ROW));
    row.type_details.documents = [
      {
        id: "doc-active",
        document_name: "Current RFP",
        document_category: "Source",
        document_type: "RFP / RFQ",
        version: "v2",
        status: "Reviewed",
        buyer_reference_number: "RFP-2026-11",
      },
      {
        id: "doc-archived",
        document_name: "Old RFP",
        document_category: "Archived",
        document_type: "RFP / RFQ",
        version: "v1",
        status: "Reviewed",
      },
    ];
    return row;
  }

  it("renders active document evidence and excludes archived documents", async () => {
    const row = rowWithDocuments();
    db.responses.set("commercial_tickets", { data: row, error: null });
    const snapshot = await loadTenderPack(row.id, "combined_proposal");
    const evidence = snapshot.blocks.find((block) => block.block_key === "source.documents.recorded");
    expect(evidence?.content.html).toContain("Current RFP");
    expect(evidence?.content.html).toContain("RFP-2026-11");
    expect(evidence?.content.html).not.toContain("Old RFP");
  });

  it("hashes only content the pack can reflect, including active document evidence", async () => {
    const original = rowWithDocuments();
    const originalProjection = buildTenderSourceData(original);
    const originalHash = await computeSourceHash(originalProjection);

    const internalOnly = rowWithDocuments();
    internalOnly.estimated_value = 9_999_999;
    internalOnly.target_gp_percent = 99;
    internalOnly.type_details.pricing.scenarios.rows[0].cost = "1";
    internalOnly.type_details.pricing.scenarios.rows[0].gp_percent = "99";
    internalOnly.type_details.documents[1].document_name = "Changed archived name";
    expect(await computeSourceHash(buildTenderSourceData(internalOnly))).toBe(originalHash);

    const activeDocumentChanged = rowWithDocuments();
    activeDocumentChanged.type_details.documents[0].document_name = "Current RFP revision 3";
    expect(await computeSourceHash(buildTenderSourceData(activeDocumentChanged))).not.toBe(originalHash);

    const renderedCoverChanged = rowWithDocuments();
    renderedCoverChanged.target_date = "2026-12-15";
    expect(await computeSourceHash(buildTenderSourceData(renderedCoverChanged))).not.toBe(originalHash);

    const serialized = JSON.stringify(originalProjection);
    expect(serialized).not.toContain("980,000");
    expect(serialized).not.toContain("target_gp_percent");
    expect(serialized).not.toContain("estimated_value");
  });
});
