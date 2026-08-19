import { describe, expect, it } from "vitest";
import { classifyFinalPackTenderSources } from "./PdfStudio";

describe("Final Pack tender source classification", () => {
  it("keeps active clean tenders and excludes proposals and legacy UAT seeds", () => {
    const sources = classifyFinalPackTenderSources([
      { id: "7483c493-0098-40a9-9e5f-76007bc62cd1", ticket_type: "tender", active: true, created_from_intake: true, ticket_title: "Linde", customer_name: "Linde", internal_stage: "drafting" },
      { id: "089447d6-6d4f-4921-9df3-92483f36233a", ticket_type: "proposal", active: true, created_from_intake: true, ticket_title: "KAFD" },
      { id: "a1100000-0000-4000-8000-000000000030", ticket_type: "tender", active: true, created_from_intake: true, ticket_title: "UAT" },
      { id: "inactive", ticket_type: "tender", active: false, created_from_intake: true, ticket_title: "Inactive" },
    ]);

    expect(sources).toEqual([{ id: "7483c493-0098-40a9-9e5f-76007bc62cd1", title: "Linde", customer: "Linde", stage: "drafting" }]);
  });
});
