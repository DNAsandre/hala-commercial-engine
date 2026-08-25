import { describe, expect, it } from "vitest";
import { buildTenderDocumentBuckets } from "./TenderDocumentDrawer";
import type { TenderDocument } from "@/lib/tender-workspace-data";

function doc(overrides: Partial<TenderDocument>): TenderDocument {
  return {
    id: overrides.id ?? "doc-1",
    tender_id: "tender-1",
    document_name: "Document",
    document_category: "Supporting",
    document_type: "PDF",
    file_url: "",
    storage_path: "documents/file.pdf",
    version: "1",
    status: "Reviewed",
    stage_relevance: ["Qualification"],
    owner: "Human User",
    uploaded_by: "Human User",
    uploaded_at: "2026-08-25T00:00:00Z",
    received_date: "2026-08-25",
    expiry_date: "",
    required_for_submission: true,
    linked_requirement_id: "",
    linked_proposal_section: "",
    source_channel: "Upload",
    buyer_reference_number: "",
    notes: "",
    ...overrides,
  };
}

describe("Tender document drawer evidence truth (PDS-28)", () => {
  it("keeps archived rows in history but out of every active evidence bucket", () => {
    const active = doc({ id: "active", document_category: "Source" });
    const archived = doc({
      id: "archived",
      document_category: "Archived",
      archived_from_category: "Source",
      status: "Reviewed",
    });

    const buckets = buildTenderDocumentBuckets([active, archived]);

    expect(buckets.active.map(row => row.id)).toEqual(["active"]);
    expect(buckets.sourceDocs.map(row => row.id)).toEqual(["active"]);
    expect(buckets.recentlyAdded.map(row => row.id)).toEqual(["active"]);
    expect(buckets.missingRequired.map(row => row.id)).not.toContain("archived");
    expect(buckets.archived.map(row => row.id)).toEqual(["archived"]);
  });
});
