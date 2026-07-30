/**
 * tender-knowledge-base.ts
 * ────────────────────────
 * Sprint 3.1 (Wave 3) — Tender Knowledge Base / Document Package FOUNDATION (pure).
 *
 * Organizes the SOURCE material the orchestrator will later read from: assigns
 * source roles, inclusion, extraction-readiness, and primary-source to tender
 * documents, and groups them into a knowledge package. It does NOT read or
 * interpret document contents, and generates no tender suggestion. It writes nothing.
 *
 * It extends the EXISTING tender document model additively (the optional fields
 * on TenderDocument) and REUSES the Sprint 2 orchestration package for grouping —
 * no duplicate package concept, no schema change.
 */

import { buildPackage, type OrchestrationPackage, type CoreDeps, defaultDeps } from "./orchestration-core";

// ═══════════════════════════════════════════════════════════
// Vocabularies
// ═══════════════════════════════════════════════════════════

export const TENDER_SOURCE_ROLES = [
  "RFQ",
  "RFP",
  "SOW",
  "BOQ",
  "pricing_template",
  "commercial_terms",
  "legal_terms",
  "clarification_document",
  "customer_email",
  "compliance_requirement",
  "technical_specification",
  "appendix",
  "evidence_document",
  "certification",
  "previous_proposal",
  "technical_proposal",
  "commercial_proposal",
  "company_profile",
  "other",
] as const;
export type TenderSourceRole = (typeof TENDER_SOURCE_ROLES)[number];

export function isValidSourceRole(v: unknown): v is TenderSourceRole {
  return typeof v === "string" && (TENDER_SOURCE_ROLES as readonly string[]).includes(v);
}
export function normalizeSourceRole(v: unknown): TenderSourceRole {
  return isValidSourceRole(v) ? v : "other";
}

export const EXTRACTION_READINESS_STATES = [
  "uploaded",
  "classified",
  "ready_for_extraction",
  "extraction_pending",
  "extracted",
  "extraction_failed",
  "needs_human_review",
  "excluded_from_orchestration",
] as const;
export type ExtractionReadiness = (typeof EXTRACTION_READINESS_STATES)[number];

export function isValidExtractionReadiness(v: unknown): v is ExtractionReadiness {
  return typeof v === "string" && (EXTRACTION_READINESS_STATES as readonly string[]).includes(v);
}
export function normalizeExtractionReadiness(v: unknown): ExtractionReadiness {
  return isValidExtractionReadiness(v) ? v : "uploaded";
}

/** The Tender Knowledge Base package is a Sprint 2 orchestration package scoped to docs. */
export const TENDER_KB_PACKAGE_TYPE = "tender_kb";
export type TenderKnowledgePackage = OrchestrationPackage;

// ═══════════════════════════════════════════════════════════
// The document shape the helpers operate on (TenderDocument satisfies this)
// ═══════════════════════════════════════════════════════════

export interface KbDocument {
  id: string;
  document_name: string;
  document_category?: string;
  document_type?: string;
  source_role?: string;
  orchestration_included?: boolean;
  extraction_readiness?: string;
  primary_source?: boolean;
}

// ═══════════════════════════════════════════════════════════
// Source-role classification (filename + existing metadata; no content parsing)
// ═══════════════════════════════════════════════════════════

// Ordered: first match wins. Keep specific patterns before generic ones.
const FILENAME_ROLE_RULES: Array<{ re: RegExp; role: TenderSourceRole }> = [
  { re: /\bcommercial\s*proposal\b/i, role: "commercial_proposal" },
  { re: /\btechnical\s*proposal\b/i, role: "technical_proposal" },
  { re: /\bcompany\s*profile\b/i, role: "company_profile" },
  { re: /\bprevious\s*proposal\b/i, role: "previous_proposal" },
  { re: /\b(rfq)\b/i, role: "RFQ" },
  { re: /\b(rfp)\b/i, role: "RFP" },
  { re: /\b(sow|scope of work|tor)\b/i, role: "SOW" },
  { re: /\b(boq|bill of quant)/i, role: "BOQ" },
  { re: /\bpricing\b/i, role: "pricing_template" },
  { re: /\bcommercial\s*terms\b/i, role: "commercial_terms" },
  { re: /\blegal\b/i, role: "legal_terms" },
  { re: /\bclarification\b/i, role: "clarification_document" },
  { re: /\bcompliance\b/i, role: "compliance_requirement" },
  { re: /\btechnical\s*(spec|requirement)/i, role: "technical_specification" },
  { re: /\bcertificat/i, role: "certification" },
  { re: /\bappendix\b/i, role: "appendix" },
  { re: /\bemail\b/i, role: "customer_email" },
  { re: /\bevidence\b/i, role: "evidence_document" },
];

// Fallback mapping from the existing document_type vocabulary.
const DOC_TYPE_ROLE_MAP: Record<string, TenderSourceRole> = {
  "RFP / RFQ": "RFP",
  "TOR / SOW": "SOW",
  "BOQ / Pricing Template": "BOQ",
  "Commercial Terms": "commercial_terms",
  "Technical Requirements": "technical_specification",
  "Clarification Addendum": "clarification_document",
  "Official Buyer Response": "customer_email",
  "Company Profile": "company_profile",
  "Commercial Registration": "certification",
  "VAT Certificate": "certification",
  "ISO Certificate": "certification",
  License: "certification",
  "Insurance Certificate": "certification",
  "SLA / KPI Appendix": "appendix",
  "Contract Draft": "legal_terms",
};

/**
 * Suggest a source role from the file name (and optional existing metadata).
 * A caller-set `source_role` is preserved; otherwise infer from filename, then
 * document_type, else "other". Pure, never throws, never reads file content.
 */
export function classifyTenderDocumentRole(
  fileName: string,
  existing?: Pick<KbDocument, "source_role" | "document_type">,
): TenderSourceRole {
  if (existing?.source_role && isValidSourceRole(existing.source_role)) return existing.source_role;

  const name = fileName ?? "";
  for (const rule of FILENAME_ROLE_RULES) {
    if (rule.re.test(name)) return rule.role;
  }
  if (existing?.document_type && DOC_TYPE_ROLE_MAP[existing.document_type]) {
    return DOC_TYPE_ROLE_MAP[existing.document_type];
  }
  return "other";
}

// ═══════════════════════════════════════════════════════════
// Selection / grouping / summary (pure, read-only)
// ═══════════════════════════════════════════════════════════

/** A document is included in orchestration unless explicitly excluded (default true). */
export function isOrchestrationIncluded(doc: KbDocument): boolean {
  return doc.orchestration_included !== false && doc.extraction_readiness !== "excluded_from_orchestration";
}

export function filterOrchestrationIncludedDocuments<T extends KbDocument>(documents: T[]): T[] {
  return documents.filter(isOrchestrationIncluded);
}

export function groupDocumentsBySourceRole<T extends KbDocument>(
  documents: T[],
): Array<{ role: TenderSourceRole; documents: T[] }> {
  const map = new Map<TenderSourceRole, T[]>();
  for (const d of documents) {
    const role = normalizeSourceRole(d.source_role ?? classifyTenderDocumentRole(d.document_name, d));
    if (!map.has(role)) map.set(role, []);
    map.get(role)!.push(d);
  }
  return Array.from(map.entries()).map(([role, docs]) => ({ role, documents: docs }));
}

export function getPrimarySourceDocuments<T extends KbDocument>(documents: T[]): T[] {
  return documents.filter((d) => d.primary_source === true);
}

export interface TenderKnowledgeSummary {
  total: number;
  included: number;
  excluded: number;
  primarySources: number;
  byRole: Record<string, number>;
  byReadiness: Record<string, number>;
}

export function summarizeTenderKnowledgePackage(documents: KbDocument[]): TenderKnowledgeSummary {
  const byRole: Record<string, number> = {};
  const byReadiness: Record<string, number> = {};
  let included = 0;
  let primarySources = 0;

  for (const d of documents) {
    const role = normalizeSourceRole(d.source_role ?? classifyTenderDocumentRole(d.document_name, d));
    byRole[role] = (byRole[role] ?? 0) + 1;
    const readiness = normalizeExtractionReadiness(d.extraction_readiness);
    byReadiness[readiness] = (byReadiness[readiness] ?? 0) + 1;
    if (isOrchestrationIncluded(d)) included += 1;
    if (d.primary_source === true) primarySources += 1;
  }

  return {
    total: documents.length,
    included,
    excluded: documents.length - included,
    primarySources,
    byRole,
    byReadiness,
  };
}

// ═══════════════════════════════════════════════════════════
// Package build + validation (reuses Sprint 2 orchestration package)
// ═══════════════════════════════════════════════════════════

export interface NewKnowledgePackageInput {
  tender_id: string;
  package_name: string;
  document_ids?: string[];
  created_by?: string;
  notes?: string;
}

/** Build a tender knowledge package (an orchestration package, package_type tender_kb). */
export function buildTenderKnowledgePackage(
  input: NewKnowledgePackageInput,
  deps: CoreDeps = defaultDeps,
): TenderKnowledgePackage {
  return buildPackage(
    {
      tender_id: input.tender_id,
      package_name: input.package_name,
      package_type: TENDER_KB_PACKAGE_TYPE,
      document_ids: input.document_ids ?? [],
      created_by: input.created_by,
      notes: input.notes,
    },
    deps,
  );
}

export interface PackageValidation {
  ok: boolean;
  errors: string[];
}

/** Structural validation of a knowledge package. Pure; never throws. */
export function validateTenderKnowledgePackage(pkg: Partial<TenderKnowledgePackage> | null | undefined): PackageValidation {
  const errors: string[] = [];
  if (!pkg || typeof pkg !== "object") return { ok: false, errors: ["package is missing"] };
  if (!pkg.id) errors.push("id is required");
  if (!pkg.tender_id) errors.push("tender_id is required");
  if (!pkg.package_name || !pkg.package_name.trim()) errors.push("package_name is required");
  if (!Array.isArray(pkg.document_ids)) errors.push("document_ids must be an array");
  return { ok: errors.length === 0, errors };
}

/** True if a package is a tender knowledge base package. */
export function isTenderKnowledgePackage(pkg: Pick<TenderKnowledgePackage, "package_type">): boolean {
  return pkg.package_type === TENDER_KB_PACKAGE_TYPE;
}

// ═══════════════════════════════════════════════════════════
// Sprint 3.2 — human metadata edits (document-metadata only; pure patch builders)
// ═══════════════════════════════════════════════════════════
//
// Readiness states a human may set. Extraction-process states
// (extraction_pending / extracted / extraction_failed) are NOT human-editable —
// they would be set by a future extraction step, never from this UI.
export const EDITABLE_READINESS_STATES: ExtractionReadiness[] = [
  "uploaded",
  "classified",
  "ready_for_extraction",
  "needs_human_review",
  "excluded_from_orchestration",
];

export function isEditableReadiness(r: unknown): r is ExtractionReadiness {
  return typeof r === "string" && (EDITABLE_READINESS_STATES as readonly string[]).includes(r);
}

/** The ONLY document fields a human may patch from the KB UI (no file/canonical/stage). */
export type KbDocPatch = Partial<
  Pick<KbDocument, "source_role" | "orchestration_included" | "extraction_readiness" | "primary_source">
>;

export function buildSetRolePatch(role: unknown): KbDocPatch {
  return { source_role: normalizeSourceRole(role) };
}
export function buildInclusionPatch(included: boolean): KbDocPatch {
  return { orchestration_included: included };
}
export function buildPrimaryPatch(primary: boolean): KbDocPatch {
  return { primary_source: primary };
}
/** Returns a readiness patch only for human-editable states; otherwise null (no-op). */
export function buildReadinessPatch(readiness: unknown): KbDocPatch | null {
  const r = normalizeExtractionReadiness(readiness);
  return isEditableReadiness(r) ? { extraction_readiness: r } : null;
}
