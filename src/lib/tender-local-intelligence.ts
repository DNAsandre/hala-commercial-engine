import type { TenderWorkspace } from "@/lib/tender-workspace-data";

type AnyRecord = Record<string, any>;

export type TenderLocalCustomerMatchStatus = "tender_record" | "customer_name" | "unmatched";

export interface TenderLocalCustomerLink {
  tenderId: string;
  tenderCustomerName: string;
  tenderCustomerId: string | null;
  region: string;
  source: string;
  matchStatus: TenderLocalCustomerMatchStatus;
  matchStatusLabel: string;
  matchConfidence: string;
  confidenceTier: number;
  hasCustomerIdentity: boolean;
  notes: string;
}

export interface TenderLocalDocumentSnapshot {
  uploadedDocuments: number;
  requiredDocuments: number;
  placeholders: number;
  packs: number;
  readinessSignals: number;
}

export interface TenderLocalIntelligence {
  customerLink: TenderLocalCustomerLink;
  documents: TenderLocalDocumentSnapshot;
  typeDetails: AnyRecord;
}

function textOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function getTenderTypeDetails(ws: TenderWorkspace): AnyRecord {
  const tender = ws.tender as AnyRecord;
  const details = tender.typeDetails || tender.type_details;
  return details && typeof details === "object" && !Array.isArray(details) ? details : {};
}

export function getTenderLocalCustomerLink(ws: TenderWorkspace): TenderLocalCustomerLink {
  const tender = ws.tender as AnyRecord;
  const tenderCustomerName = textOrFallback(tender.customerName || tender.customer_name, "Unknown customer");
  const rawCustomerId = textOrFallback(tender.customerId || tender.customer_id, "");
  const region = textOrFallback(tender.region, "Not available");
  const source = textOrFallback(tender.source, "Current tender record");

  if (rawCustomerId && tenderCustomerName !== "Unknown customer") {
    return {
      tenderId: String(tender.id),
      tenderCustomerName,
      tenderCustomerId: rawCustomerId,
      region,
      source,
      matchStatus: "tender_record",
      matchStatusLabel: "Linked in tender record",
      matchConfidence: "Tender customer ID and customer name are present",
      confidenceTier: 1,
      hasCustomerIdentity: true,
      notes: "This intelligence is derived only from the active tender workspace.",
    };
  }

  if (tenderCustomerName !== "Unknown customer") {
    return {
      tenderId: String(tender.id),
      tenderCustomerName,
      tenderCustomerId: rawCustomerId || null,
      region,
      source,
      matchStatus: "customer_name",
      matchStatusLabel: "Customer captured",
      matchConfidence: "Tender customer name is present; no customer ID is stored on the tender",
      confidenceTier: 2,
      hasCustomerIdentity: true,
      notes: "This is not matched against external opportunity data.",
    };
  }

  return {
    tenderId: String(tender.id),
    tenderCustomerName,
    tenderCustomerId: rawCustomerId || null,
    region,
    source,
    matchStatus: "unmatched",
    matchStatusLabel: "Not linked",
    matchConfidence: "No customer identity is stored on the tender yet",
    confidenceTier: 4,
    hasCustomerIdentity: false,
    notes: "Capture the customer on this tender before using customer-level intelligence.",
  };
}

export function getTenderLocalDocumentSnapshot(ws: TenderWorkspace): TenderLocalDocumentSnapshot {
  return {
    uploadedDocuments: ws.documents.length,
    requiredDocuments: ws.requiredDocuments.length,
    placeholders: ws.placeholders.length,
    packs: ws.packs.length,
    readinessSignals: ws.packs.reduce((sum, pack) => sum + (pack.readinessBreakdown?.readiness_signals ?? 0), 0),
  };
}

export function buildTenderLocalIntelligence(ws: TenderWorkspace): TenderLocalIntelligence {
  return {
    customerLink: getTenderLocalCustomerLink(ws),
    documents: getTenderLocalDocumentSnapshot(ws),
    typeDetails: getTenderTypeDetails(ws),
  };
}
