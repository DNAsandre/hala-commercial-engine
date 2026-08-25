import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SupportingDocumentsPanel from "./SupportingDocumentsPanel";

function render(loadState: "idle" | "loading" | "loaded" | "error", loadError: string | null = null) {
  return renderToStaticMarkup(
    <SupportingDocumentsPanel
      linkedStage="qualified"
      linkedTab="documents"
      documents={[]}
      loadState={loadState}
      loadError={loadError}
    />,
  );
}

describe("Proposal document list state (PDS-64)", () => {
  it("renders loading distinctly and never calls it an empty proposal", () => {
    const html = render("loading");
    expect(html).toContain("Loading supporting documents");
    expect(html).not.toContain("No supporting documents are loaded");
  });

  it("renders a failed read distinctly from an empty proposal", () => {
    const html = render("error", "Document read refused");
    expect(html).toContain("Document read refused");
    expect(html).not.toContain("No supporting documents are loaded");
  });

  it("shows the empty state only after a completed zero-row read", () => {
    const html = render("loaded");
    expect(html).toContain("No supporting documents uploaded for this stage");
  });
});
