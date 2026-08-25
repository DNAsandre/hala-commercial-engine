import { describe, expect, it } from "vitest";

import {
  DESTINATION_MANIFESTS,
  fingerprintDestinationRow,
  getDestinationField,
  getRepeatedDestinationLevels,
} from "./destination-contract";
import { PDF_BLOCK_SOURCE_MAP } from "./pdf-block-source-map";

const SUPPORTED_RENDER_KEYS = [
  "cover_hero", "confidentiality", "narrative", "scope_list",
  "facility_gallery", "terms", "terms_standard", "signature_dual", "closing",
  "pricing_table_single", "pricing_table_multi", "quote_pricing_vat",
  "scope_table", "totals_words", "party_details", "toc_auto", "legal_clauses",
  "annexure_config", "annexure_sla", "annexure_rate_card", "annexure_comms",
  "page_break", "custom_text",
] as const;

describe("clean destination contract", () => {
  it("publishes both complete manifests through one entry point", () => {
    expect(DESTINATION_MANIFESTS.tender.process).toBe("tender");
    expect(DESTINATION_MANIFESTS.proposal.process).toBe("proposal");
    expect(DESTINATION_MANIFESTS.tender.fields).toHaveLength(898);
    expect(DESTINATION_MANIFESTS.proposal.fields).toHaveLength(437);
  });

  it("exposes every nested repeated identity in outer-to-inner order", () => {
    expect(getRepeatedDestinationLevels("t:documents[].stage_relevance[]"))
      .toEqual([
        {
          persistencePath: "documents[]",
          rowIdentity: { fingerprintFields: ["document_name", "storage_path", "version"] },
        },
        {
          persistencePath: "documents[].stage_relevance[]",
          rowIdentity: { fingerprintFields: ["value"] },
        },
      ]);
    const valueSpec = getRepeatedDestinationLevels("t:sow_data.service_lines[]")[0].rowIdentity;
    expect(fingerprintDestinationRow({ value: " Warehousing " }, valueSpec))
      .toBe(fingerprintDestinationRow({ value: "warehousing" }, valueSpec));
  });

  it("maps every supported PDF block and every canonical source id to a real destination", () => {
    expect(Object.keys(PDF_BLOCK_SOURCE_MAP)).toEqual(expect.arrayContaining([...SUPPORTED_RENDER_KEYS]));
    for (const [renderKey, binding] of Object.entries(PDF_BLOCK_SOURCE_MAP)) {
      for (const fieldId of binding.sourceFields) {
        expect(getDestinationField(fieldId), `${renderKey} -> ${fieldId}`).toBeDefined();
      }
      for (const column of binding.sourceColumns ?? []) {
        expect(["ticket_title", "customer_name", "target_date"]).toContain(column);
      }
    }
  });
});
