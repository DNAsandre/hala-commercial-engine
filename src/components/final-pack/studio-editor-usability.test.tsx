import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PricingEditor from "./blocks/PricingEditor";
import SlaEditor from "./blocks/SlaEditor";
import VolumeSelector from "./VolumeSelector";
import StartScreen from "./StartScreen";
import { loadStandaloneBlankPack } from "@/lib/sources/standalone-blank-source";
import { formatInstanceDisplayTitle } from "@/hooks/useFinalPackInstance";

const block = (content: Record<string, unknown>, renderKey: string) => ({
  id: "block-1",
  block_key: renderKey,
  render_key: renderKey,
  display_name: "Test block",
  family: "commercial",
  editor_mode: "form",
  visible: true,
  order: 1,
  required: false,
  content: { source_status: "not_captured", ...content },
  default_content: "",
  schema_config: {},
  permissions: {},
}) as any;

describe("Final Pack Studio editor closure", () => {
  it("offers real add-row controls for empty pricing and SLA tables", () => {
    const pricing = renderToStaticMarkup(createElement(PricingEditor, {
      block: block({ pricing_rows: [] }, "pricing_table_single"),
      onContentChange: vi.fn(),
    }));
    const sla = renderToStaticMarkup(createElement(SlaEditor, {
      block: block({ sla_rows: [] }, "annexure_sla"),
      onContentChange: vi.fn(),
    }));
    expect(pricing).toContain("Add pricing row");
    expect(sla).toContain("Add SLA row");
  });

  it("discloses blocks that belong only to the full document", () => {
    const html = renderToStaticMarkup(createElement(VolumeSelector, {
      volumes: [{ volume_key: "technical", volume_title: "Technical", block_keys: ["cover"], sort_order: 1, description: "" }],
      selectedKey: null,
      onSelect: vi.fn(),
      blocks: [block({}, "cover"), block({}, "custom_text")],
    }));
    expect(html).toContain("1 full-document-only");
  });

  it("does not advertise an unbuilt duplicate-document action", () => {
    const html = renderToStaticMarkup(createElement(StartScreen, { onChoose: vi.fn() }));
    expect(html).not.toContain("Duplicate Existing Document");
    expect(html).not.toContain("Coming soon");
    expect(html).toContain("Open Connected Tender");
  });

  it("retains a blank document reference number in its source snapshot", () => {
    const snapshot = loadStandaloneBlankPack({
      mode: "standalone",
      kind: "manual",
      creation: "blank",
      packType: "custom_pdf",
      title: "Operations Plan",
      refNumber: "HALA-REF-42",
    });
    expect(snapshot.source_data.ref_number).toBe("HALA-REF-42");
  });

  it("never produces a resume label that starts with an em dash", () => {
    expect(formatInstanceDisplayTitle("", { template_name: "Full Proposal", tender_title: "KAFD" }, "final_pack"))
      .toBe("KAFD — Full Proposal");
    expect(formatInstanceDisplayTitle("", { template_name: "Full Proposal" }, "final_pack"))
      .toBe("Untitled document — Full Proposal");
  });
});
