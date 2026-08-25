import type { SowData } from "./sow-data-types";

export const SOW_OPTIONS = {
  serviceLines: [
    "Warehousing", "Transportation", "Inventory Management", "Order Fulfilment",
    "Distribution", "Freight Forwarding", "Customs Clearance", "Value Added Services",
    "Office Space", "Technology Integration", "Reporting / Dashboards", "HSE / Compliance",
    "Stock Count", "Command Center / Control Tower", "Security / Risk Management", "Business Continuity",
  ],
  storageTypes: [
    "Dry", "Ambient", "Temperature Controlled", "Chilled", "Frozen",
    "Dangerous Goods", "Bonded", "Open Yard", "Secure / Fenced Area", "Crossdock",
  ],
  capacityUnits: ["SQM", "Pallets", "CBM", "Containers", "Other"],
  warehouseActivities: [
    "Receiving", "Inspection", "Quality Check", "Putaway", "Storage",
    "Picking", "Packing", "Kitting", "Labelling", "Dispatch",
    "Cycle Count", "Full Inventory Audit", "Damage Reporting", "Returns Processing",
    "Palletization", "Re-palletization", "Stretch Wrapping", "Destuffing", "VAS",
  ],
  transportModels: [
    "Dedicated Fleet", "Shared Fleet", "Per Trip", "Per Month", "Linehaul",
    "Last Mile", "Shuttle", "Express", "Ad-hoc", "Full Truck Load", "Multi-drop",
  ],
  vehicleTypes: [
    "Reefer", "Dry Truck", "1 Ton", "4 Ton", "5 Ton", "6 Ton", "10 Ton",
    "40 FT Trailer", "Flatbed", "Curtain Side", "Dyna", "Other",
  ],
  technologySystems: [
    "WMS", "TMS", "GPS Tracking", "Electronic POD", "Barcode Scanning",
    "RFID", "Customer Portal", "ERP Integration", "API Integration",
    "Dashboard Reporting", "AWB Automation", "Photo Evidence", "Digital Signatures",
  ],
  halaResponses: [
    "Compliant", "Partially Compliant", "Not Compliant", "Clarification Required", "Not Applicable",
  ],
  regions: ["Central", "East", "West", "North", "South", "Nationwide"],
  siteTypes: [
    "Client Site", "Hala Warehouse", "Factory", "Crossdock", "Distribution Point",
    "Port", "Airport", "Border", "Secure Yard", "Other",
  ],
  complianceRequirements: [
    "Civil Defense", "NFPA", "ISO 9001", "ISO 45001", "SFDA", "DG Handling",
    "CCTV / Security", "Fire Suppression", "Emergency Response", "Staff Training",
    "Pest Control", "Hygiene Maintenance", "BCP / DRP", "Data Security",
    "Supplier Code of Conduct", "Local Content / LCGPA",
  ],
  clarificationStatuses: ["Draft", "Submitted", "Answered", "Closed"],
} as const;

type AliasMap = Readonly<Record<string, readonly string[]>>;

const aliases = {
  serviceLines: {
    "dry warehousing": ["Warehousing"],
    "full-truckload transport": ["Transportation"],
  },
  storageTypes: {
    "dry storage": ["Dry"],
  },
  warehouseActivities: {
    "inbound receiving": ["Receiving"],
    "pallet storage": ["Storage"],
    "outbound dispatch": ["Dispatch"],
  },
  transportModels: {
    "full truckload distribution": ["Full Truck Load"],
  },
  vehicleTypes: {
    "10 ton reefer dyna": ["10 Ton"],
  },
  technologySystems: {
    "warehouse management system": ["WMS"],
    "transport management system": ["TMS"],
    "customer reporting portal": ["Customer Portal"],
  },
  regions: {
    riyadh: ["Central"],
  },
  clarificationStatuses: {
    complete: ["Closed"],
    completed: ["Closed"],
  },
} as const satisfies Record<string, AliasMap>;

function normalizedKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface NormalizedOptionList {
  values: string[];
  recognized: string[];
  unrecognized: string[];
  changed: boolean;
}

export function normalizeOptionList(
  input: unknown,
  options: readonly string[],
  aliasMap: AliasMap = {},
): NormalizedOptionList {
  const source = Array.isArray(input)
    ? input.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const optionByKey = new Map(options.map(option => [normalizedKey(option), option]));
  const values: string[] = [];

  for (const raw of source) {
    const key = normalizedKey(raw);
    const canonical = optionByKey.get(key);
    const replacements = canonical ? [canonical] : aliasMap[key] ?? [raw.trim()];
    for (const replacement of replacements) {
      if (!values.includes(replacement)) values.push(replacement);
    }
  }

  const recognized = values.filter(value => options.includes(value));
  const unrecognized = values.filter(value => !options.includes(value));
  return {
    values,
    recognized,
    unrecognized,
    changed: JSON.stringify(values) !== JSON.stringify(source),
  };
}

export function recognizedOptionCount(input: unknown, options: readonly string[]): number {
  return normalizeOptionList(input, options).recognized.length;
}

export function unrecognizedOptions(input: unknown, options: readonly string[]): string[] {
  return normalizeOptionList(input, options).unrecognized;
}

function normalizeSingleOption(
  value: unknown,
  options: readonly string[],
  aliasMap: AliasMap = {},
): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const normalized = normalizeOptionList([value], options, aliasMap);
  return normalized.values[0] ?? "";
}

export function normalizeSowSelections(input: SowData): { sow: SowData; changed: boolean } {
  const sow = JSON.parse(JSON.stringify(input)) as SowData;

  sow.service_lines = normalizeOptionList(sow.service_lines, SOW_OPTIONS.serviceLines, aliases.serviceLines).values;
  sow.warehousing.storage_types = normalizeOptionList(sow.warehousing.storage_types, SOW_OPTIONS.storageTypes, aliases.storageTypes).values;
  sow.warehousing.activities = normalizeOptionList(sow.warehousing.activities, SOW_OPTIONS.warehouseActivities, aliases.warehouseActivities).values;
  sow.warehousing.capacity_unit = normalizeSingleOption(sow.warehousing.capacity_unit, SOW_OPTIONS.capacityUnits);
  sow.transport.models = normalizeOptionList(sow.transport.models, SOW_OPTIONS.transportModels, aliases.transportModels).values;
  sow.transport.vehicle_types = normalizeOptionList(sow.transport.vehicle_types, SOW_OPTIONS.vehicleTypes, aliases.vehicleTypes).values;
  sow.technology.systems = normalizeOptionList(sow.technology.systems, SOW_OPTIONS.technologySystems, aliases.technologySystems).values;
  sow.execution_regions = normalizeOptionList(sow.execution_regions, SOW_OPTIONS.regions, aliases.regions).values;
  sow.compliance.requirements = normalizeOptionList(sow.compliance.requirements, SOW_OPTIONS.complianceRequirements).values;

  sow.sla_kpis = sow.sla_kpis.map(kpi => ({
    ...kpi,
    hala_response: normalizeSingleOption(kpi.hala_response, SOW_OPTIONS.halaResponses),
  }));
  sow.sites = sow.sites.map(site => ({
    ...site,
    region: normalizeSingleOption(site.region, SOW_OPTIONS.regions, aliases.regions),
    site_type: normalizeSingleOption(site.site_type, SOW_OPTIONS.siteTypes),
  }));
  sow.clarifications = sow.clarifications.map(clarification => ({
    ...clarification,
    status: normalizeSingleOption(clarification.status, SOW_OPTIONS.clarificationStatuses, aliases.clarificationStatuses),
  }));

  return { sow, changed: JSON.stringify(sow) !== JSON.stringify(input) };
}
