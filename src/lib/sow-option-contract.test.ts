import { describe, expect, it } from "vitest";
import { emptySowData } from "./sow-data-types";
import {
  SOW_OPTIONS,
  normalizeOptionList,
  normalizeSowSelections,
  recognizedOptionCount,
  unrecognizedOptions,
} from "./sow-option-contract";

describe("Scope of Work option contract", () => {
  it("counts only choices that the UI can visibly select", () => {
    const stored = ["Warehousing", "Dry warehousing", "Invisible legacy value"];
    expect(recognizedOptionCount(stored, SOW_OPTIONS.serviceLines)).toBe(1);
    expect(unrecognizedOptions(stored, SOW_OPTIONS.serviceLines)).toEqual([
      "Dry warehousing",
      "Invisible legacy value",
    ]);
  });

  it("normalizes aliases, de-duplicates them, and preserves unknown values visibly", () => {
    expect(normalizeOptionList(
      ["Dry storage", "Dry", "Unsupported storage"],
      SOW_OPTIONS.storageTypes,
      { "dry storage": ["Dry"] },
    )).toEqual({
      values: ["Dry", "Unsupported storage"],
      recognized: ["Dry"],
      unrecognized: ["Unsupported storage"],
      changed: true,
    });
  });

  it("normalizes the MIKE-style values across every SOW selection family", () => {
    const sow = emptySowData();
    sow.service_lines = ["Dry warehousing", "Stock count", "Full-truckload transport"];
    sow.warehousing.storage_types = ["Dry storage"];
    sow.warehousing.activities = ["Inbound receiving", "Pallet storage", "Outbound dispatch"];
    sow.transport.models = ["Full truckload distribution"];
    sow.transport.vehicle_types = ["10 Ton Reefer Dyna"];
    sow.technology.systems = ["Warehouse Management System", "Transport Management System", "Customer reporting portal"];
    sow.execution_regions = ["Riyadh"];
    sow.clarifications = [{ question: "Q", source_reference: "S", status: "complete", buyer_response: "" }];

    const result = normalizeSowSelections(sow);
    expect(result.changed).toBe(true);
    expect(result.sow.service_lines).toEqual(["Warehousing", "Stock Count", "Transportation"]);
    expect(result.sow.warehousing.storage_types).toEqual(["Dry"]);
    expect(result.sow.warehousing.activities).toEqual(["Receiving", "Storage", "Dispatch"]);
    expect(result.sow.transport.models).toEqual(["Full Truck Load"]);
    expect(result.sow.transport.vehicle_types).toEqual(["10 Ton"]);
    expect(result.sow.technology.systems).toEqual(["WMS", "TMS", "Customer Portal"]);
    expect(result.sow.execution_regions).toEqual(["Central"]);
    expect(result.sow.clarifications[0].status).toBe("Closed");
  });
});
