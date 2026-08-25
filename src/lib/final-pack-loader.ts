/**
 * final-pack-loader.ts
 * ────────────────────
 * FPS-012 — The single most important function in the entire build.
 *
 * Reads tender data from commercial_tickets (READ ONLY — never writes).
 * Maps tender content to document blocks using explicit block_key mapping.
 * Computes source_hash for drift detection.
 *
 * Source-truth safety:
 * - READS commercial_tickets.type_details (never updates)
 * - READS doc_block_library, doc_templates, doc_template_versions, clause_library
 * - NEVER calls .update() / .upsert() / .delete() on commercial_tickets
 */

import { supabase } from "./supabase";
import { stableJsonStringify } from "./stable-json";
import type { BlockProvenance } from "./document-source";
import { makeBlockProvenance } from "./final-pack-snapshot-contract";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

/** The 5 supported pack types — matches doc_instances.pack_type */
export type PackType =
  | "combined_proposal"
  | "quotation"
  | "sla"
  | "msa"
  | "bilingual_quotation";

/** Pack type → template ID mapping (matches seed data) */
const PACK_TEMPLATE_MAP: Record<PackType, string> = {
  combined_proposal: "tpl-002",
  quotation: "tpl-001",
  sla: "tpl-003",
  msa: "tpl-005",
  bilingual_quotation: "tpl-004",
};

/** A single block in the output snapshot */
export interface OutputBlock {
  /** Unique block instance ID (e.g., "cover.hero-1") */
  id: string;
  /** Block key from doc_block_library (e.g., "cover.hero") */
  block_key: string;
  /** Render key from doc_block_library (e.g., "cover_hero") */
  render_key: string;
  /** Display name from doc_block_library */
  display_name: string;
  /** Block family: commercial, data_bound, legal, annexure, asset */
  family: string;
  /** Editor mode: form, wysiwyg, clause, readonly */
  editor_mode: string;
  /** Whether this block is visible in the output */
  visible: boolean;
  /** Order position in the document */
  order: number;
  /** Whether this block is required by the template */
  required: boolean;
  /** The resolved content for this block */
  content: BlockContent;
  /** Default content from block library (for reset) */
  default_content: string;
  /** Schema config from block library */
  schema_config: Record<string, unknown>;
  /** Permissions from block library */
  permissions: Record<string, unknown>;
  /**
   * Block provenance (FPS-002) — traceability label only, never a lock.
   * Optional so existing blocks/callers keep compiling; missing provenance
   * is treated as unknown_legacy at read time without rewriting the row.
   */
  provenance?: BlockProvenance;
}

/** Content varies by render_key */
export interface BlockContent {
  /** Resolved HTML content (for wysiwyg/clause blocks) */
  html?: string;
  /** Resolved variable values (for form blocks) */
  variables?: Record<string, string>;
  /** Pricing rows (for pricing blocks) */
  pricing_rows?: PricingOutputRow[];
  /** SLA rows (for SLA blocks) */
  sla_rows?: SlaOutputRow[];
  /** Clause entries (for legal clause blocks) */
  clauses?: ClauseEntry[];
  /** TOC entries (for auto-TOC — computed at render time) */
  toc_entries?: TocEntry[];
  /** Cover design overrides (FPS-009) — per-document, additive, advisory. */
  cover_config?: CoverConfig;
  /** Source status — where did this data come from? */
  source_status: "populated" | "not_captured" | "default";
}

/**
 * FPS-009 — Per-document cover overrides, stored on the cover block's content.
 * All fields optional; missing → fall back to the template layout default and
 * the current cover look. Never a gate — invalid values degrade safely.
 */
export interface CoverConfig {
  /** Override the template layout.cover_style for THIS document. */
  cover_style?: string;
  show_logo?: boolean;
  show_subtitle?: boolean;
  show_meta?: boolean;
  show_hero?: boolean;
  show_watermark?: boolean;
  /** Explicit selected hero image URL (from branding cover_hero_urls). */
  hero_url?: string;
  /** Or an index into branding.cover_hero_urls. */
  hero_index?: number;
  align?: "left" | "center" | "right";

  /**
   * FPS-013 — Cover mode. Default (absent) = the native designed cover.
   * - "native"        → designed cover (style/toggles above).
   * - "image"         → the uploaded image cover (hero_url path, FPS-009-2C).
   * - "imported_pdf"  → a user-supplied PDF used STATICALLY as page 1 of the
   *                     exported pack. Never converted to editable content.
   */
  cover_mode?: "native" | "image" | "imported_pdf";
  /** FPS-013 — private-storage path of the imported PDF (no binary in JSON). */
  imported_pdf_path?: string;
  /** FPS-013 — original file name (display only). */
  imported_pdf_file_name?: string;
  /** FPS-013 — which page of the imported PDF to use as the cover (1-based). */
  imported_pdf_page?: number;
  /** FPS-013 — always true; the imported PDF is static, never editable. */
  imported_pdf_static?: boolean;
}

/**
 * PADW T06a (PDS-01): pricing rows are a CUSTOMER-FACING projection.
 * Internal P&L columns (cost, gp_percent, recommended, internal notes) are
 * deliberately absent from this shape — they must never reach a customer
 * document. Revenue is formatted at projection time (PDS-09 parse rules).
 */
export interface PricingOutputRow {
  id: string;
  scenario_name: string;
  scenario_type: string;
  revenue: string;
}

export interface SlaOutputRow {
  kpi: string;
  target: string;
  measurement: string;
  penalty: string;
}

export interface ClauseEntry {
  id: string;
  name: string;
  category: string;
  content_en: string;
  content_ar: string;
}

export interface TocEntry {
  block_key: string;
  display_name: string;
  order: number;
}

/** The full snapshot returned by loadTenderPack */
export interface BlockSnapshot {
  /** Ordered array of output blocks */
  blocks: OutputBlock[];
  /** Tender metadata */
  tender_id: string;
  tender_title: string;
  customer_name: string;
  /** Pack type selected */
  pack_type: PackType;
  /** Template used */
  template_id: string;
  template_name: string;
  /** Source hash for drift detection (SHA-256 of stable-stringified source data) */
  source_hash: string;
  /** Pricing scenario used (if applicable) */
  pricing_scenario_id: string | null;
  /** Snapshot timestamp */
  snapshot_at: string;
  /** The raw source data that was hashed (for drift comparison) */
  source_data: Record<string, unknown>;
  /** Any warnings (non-blocking) */
  warnings: string[];
  /** Error (if load failed) */
  error?: string;

  // ── Snapshot Contract (FPS-001, truthpack v1.2 §"Snapshot Contract") ──
  // Optional source-mode metadata. Optional so the existing connected loader
  // and all current callers keep compiling unchanged. Every adapter populates
  // these; createInstance persists them as real columns AND mirrors them into
  // source_snapshot. These are traceability labels only — never gates/locks.
  /** connected | standalone */
  source_mode?: "connected" | "standalone";
  /** Where the data came from (origin only) */
  source_kind?: string;
  /** How the instance was started */
  creation_method?: string;
  /** What (if anything) the instance links to: tender | standalone | custom_document */
  linked_entity_type?: string;
  /** Linked source id (null for standalone/blank) */
  linked_entity_id?: string | null;
  /** Actual template version id (doc_template_versions.id) where known */
  template_version_id?: string | null;
  /** Template layout config (doc_template_versions.layout) where known — FPS-004 */
  layout?: Record<string, unknown> | null;
  /** Template volume config rows (doc_template_volumes) where known — FPS-006 */
  volumes?: unknown[];
}

// ═══════════════════════════════════════════════════════════
// Internal types
// ═══════════════════════════════════════════════════════════

interface RecipeEntry {
  block_key: string;
  order: number;
  required: boolean;
  default_content_override: string | null;
  config_override: Record<string, unknown>;
}

interface BlockLibraryRow {
  id: string;
  block_key: string;
  family: string;
  display_name: string;
  editor_mode: string;
  permissions: Record<string, unknown>;
  schema_config: Record<string, unknown>;
  render_key: string;
  default_content: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════
// Shared source projection (loader ⇄ drift check)
// ═══════════════════════════════════════════════════════════

/**
 * The exact commercial_tickets projection the snapshot hash is computed from.
 * W04-T09: the drift checker MUST select the same columns — hashing a different
 * shape reported "source has changed" on every connected document, which is a
 * fabricated status, not a comparison.
 */
export const TENDER_SOURCE_SELECT =
  "id, ticket_title, customer_name, estimated_value, target_gp_percent, target_date, internal_stage, type_details, created_at, updated_at";

/** Title resolution used by both the snapshot and the drift projection. */
export function resolveTenderTitle(tender: Record<string, any>): string {
  const td = safeObject(tender?.type_details);
  return tender?.ticket_title || safeString(td.tender?.title) || "Not available";
}

/** Customer resolution used by both the snapshot and the drift projection. */
export function resolveTenderCustomer(tender: Record<string, any>): string {
  const td = safeObject(tender?.type_details);
  return tender?.customer_name || safeString(td.tender?.customerName) || "Not available";
}

/**
 * Build the content-bearing projection of a commercial_tickets row that the
 * source hash is computed over. Pure — same row in, same object out.
 */
export function buildTenderSourceData(tender: Record<string, any>): Record<string, unknown> {
  const td = normalizeCommercialTicketDetails(safeObject(tender?.type_details));
  return {
    tender_id: tender?.id,
    tender_title: resolveTenderTitle(tender),
    customer_name: resolveTenderCustomer(tender),
    estimated_value: tender?.estimated_value,
    target_gp_percent: tender?.target_gp_percent,
    target_date: tender?.target_date,
    pricing: td.pricing ?? null,
    tender_drafting: td.tender_drafting ?? null,
    solution_design_data: td.solution_design_data ?? null,
    sow_data: td.sow_data ?? null,
    tender_metadata: td.tender ?? null,
  };
}

/**
 * FinalPack has one document contract. Proposal work is stored under
 * proposal_workspace, so translate that persisted truth into the established
 * read-only document projection without writing back to the commercial ticket.
 */
export function normalizeCommercialTicketDetails(details: Record<string, any>): Record<string, any> {
  const workspace = safeObject(details.proposal_workspace);
  const draftingStage = safeObject(workspace.proposal_drafting ?? workspace.proposalDrafting);
  const drafting = safeObject(Object.keys(safeObject(draftingStage.data)).length ? draftingStage.data : draftingStage);
  const toc = Array.isArray(drafting.proposalTocSections) ? drafting.proposalTocSections : [];
  const tocById = new Map(toc.map((section: any) => [safeString(section.id), safeString(section.sectionTitle)]));
  const proposalBlocks = Array.isArray(drafting.proposalDraftBlocks)
    ? drafting.proposalDraftBlocks.map((block: any) => ({
        id: safeString(block.id),
        section_key: safeString(block.sectionId),
        block_key: safeString(block.sectionId),
        title: safeString(block.blockTitle) || tocById.get(safeString(block.sectionId)) || "Proposal section",
        content_html: safeString(block.content),
        source_refs: safeString(block.sourceRefs),
      }))
    : [];

  const pnlStage = safeObject(workspace.pnl_pricing ?? workspace.pnlPricing);
  const pnl = safeObject(Object.keys(safeObject(pnlStage.data)).length ? pnlStage.data : pnlStage);
  const pnlVersions = Array.isArray(pnl.pnlVersions) ? pnl.pnlVersions : [];
  const pricingRows = pnlVersions.map((version: any) => {
    const revenue = Array.isArray(version.revenue) ? version.revenue.reduce((sum: number, line: any) => sum + Number(line.amount || 0), 0) : 0;
    const directCost = Array.isArray(version.costs) ? version.costs.reduce((sum: number, line: any) => sum + Number(line.amount || 0), 0) : 0;
    const cost = directCost * (1 + Number(version.overheadPercent || 0) / 100);
    const gp = revenue - cost;
    return {
      id: safeString(version.id),
      scenario_name: safeString(version.name),
      scenario_type: version.isApproved ? "Working scenario" : "Alternative",
      revenue: String(revenue),
      cost: String(cost),
      gp_percent: revenue > 0 ? String(gp / revenue * 100) : "0",
      recommended: version.isApproved ? "Working scenario" : "Alternative",
      notes: safeString(version.notes),
    };
  });

  if (proposalBlocks.length === 0 && pricingRows.length === 0) return details;
  return {
    ...details,
    tender_drafting: {
      ...safeObject(details.tender_drafting),
      proposal_blocks: proposalBlocks,
    },
    pricing: pricingRows.length > 0
      ? { ...safeObject(details.pricing), scenarios: { rows: pricingRows, selected_scenario: { selected_scenario_id: safeString(pnl.activePnlVersion) } } }
      : details.pricing,
  };
}

/**
 * Order a template recipe by its explicit `order` field (stable for ties).
 * Block position is array position everywhere downstream (canvas, preview,
 * export), so array position and the displayed `#order` must agree instead of
 * relying on the stored JSON array happening to be sorted.
 */
export function sortRecipeByOrder<T extends { order?: number }>(entries: T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const ao = typeof a.entry.order === "number" ? a.entry.order : Number.POSITIVE_INFINITY;
      const bo = typeof b.entry.order === "number" ? b.entry.order : Number.POSITIVE_INFINITY;
      return ao === bo ? a.index - b.index : ao - bo;
    })
    .map((x) => x.entry);
}

/**
 * Guarantee block-instance ids are unique within one snapshot. Two recipe rows
 * sharing a block_key + order would otherwise collide, and every edit to one
 * would silently apply to both (edits are matched by id).
 */
export function uniqueBlockId(candidate: string, used: Set<string>): string {
  let id = candidate;
  let n = 2;
  while (used.has(id)) {
    id = `${candidate}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

// ═══════════════════════════════════════════════════════════
// Main loader
// ═══════════════════════════════════════════════════════════

/**
 * Load a tender's content and map it to document blocks for a specific pack type.
 *
 * This function:
 * 1. Fetches the tender from commercial_tickets (READ ONLY)
 * 2. Fetches the template recipe for the selected pack type
 * 3. Fetches block definitions from doc_block_library
 * 4. Fetches clauses from clause_library (if needed)
 * 5. Maps tender data to blocks using explicit block_key mapping
 * 6. Computes source_hash for drift detection
 *
 * @param tenderId - UUID of the tender in commercial_tickets
 * @param packType - Which pack type to build
 * @param scenarioId - Optional pricing scenario ID to use
 * @returns BlockSnapshot with all blocks, hash, and metadata
 */
export async function loadTenderPack(
  tenderId: string,
  packType: PackType,
  scenarioId?: string,
): Promise<BlockSnapshot> {
  const warnings: string[] = [];
  const templateId = PACK_TEMPLATE_MAP[packType];

  // ── 1. Fetch tender (READ ONLY) ────────────────────────
  const { data: tender, error: tenderErr } = await supabase
    .from("commercial_tickets")
    .select(TENDER_SOURCE_SELECT)
    .eq("id", tenderId)
    .maybeSingle();

  if (tenderErr) {
    return errorSnapshot(tenderId, packType, templateId, `Supabase error: ${tenderErr.message}`);
  }
  if (!tender) {
    return errorSnapshot(tenderId, packType, templateId, `Tender ${tenderId} not found in commercial_tickets`);
  }

  const td = normalizeCommercialTicketDetails(safeObject(tender.type_details));
  const tenderTitle = resolveTenderTitle(tender);
  const customerName = resolveTenderCustomer(tender);

  // ── 2. Fetch template recipe ───────────────────────────
  const { data: templateVersion, error: tvErr } = await supabase
    .from("doc_template_versions")
    .select("id, template_id, recipe, layout")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tvErr || !templateVersion) {
    return errorSnapshot(tenderId, packType, templateId,
      `Template version not found for ${templateId}: ${tvErr?.message || "no rows"}`);
  }

  const recipe: RecipeEntry[] = sortRecipeByOrder(
    Array.isArray(templateVersion.recipe) ? templateVersion.recipe : [],
  );

  if (recipe.length === 0) {
    return errorSnapshot(tenderId, packType, templateId, "Template recipe is empty");
  }

  // FPS-006: load any configured volumes for this template version (advisory;
  // empty if none). Never blocks the pack if this read fails.
  const { data: volumeRows } = await supabase
    .from("doc_template_volumes")
    .select("volume_key, volume_name, block_keys, sort_order, description")
    .eq("template_version_id", templateVersion.id)
    .order("sort_order", { ascending: true });

  // ── 3. Fetch block library definitions ─────────────────
  const blockKeys = recipe.map((r) => r.block_key);
  const { data: blockDefs, error: blErr } = await supabase
    .from("doc_block_library")
    .select("*")
    .in("block_key", blockKeys);

  if (blErr) {
    return errorSnapshot(tenderId, packType, templateId, `Block library error: ${blErr.message}`);
  }

  const blockMap = new Map<string, BlockLibraryRow>();
  for (const def of (blockDefs ?? [])) {
    blockMap.set(def.block_key, def as BlockLibraryRow);
  }

  // ── 4. Fetch clauses (if recipe needs them) ────────────
  let clauses: ClauseEntry[] = [];
  const needsClauses = blockKeys.some((k) =>
    k === "legal.clauses.locked" || k === "terms.standard"
  );
  if (needsClauses) {
    const { data: clauseRows } = await supabase
      .from("clause_library")
      .select("id, name, category, content_en, content_ar")
      .eq("status", "published")
      .order("category");
    clauses = (clauseRows ?? []) as ClauseEntry[];
  }

  // ── 5. Fetch template name ─────────────────────────────
  const { data: templateRow } = await supabase
    .from("doc_templates")
    .select("name")
    .eq("id", templateId)
    .maybeSingle();

  const templateName = templateRow?.name || templateId;

  // ── 6. Build source data for hashing ───────────────────
  // Only include the type_details sections that matter for content.
  // Built by the SHARED projection so drift re-checks hash the same shape.
  const sourceData = buildTenderSourceData(tender);

  const sourceHash = await computeSourceHash(sourceData);

  // ── 7. Map recipe to output blocks ─────────────────────
  const blocks: OutputBlock[] = [];
  const usedIds = new Set<string>();

  for (const entry of recipe) {
    const def = blockMap.get(entry.block_key);
    if (!def) {
      warnings.push(`Block definition not found for key: ${entry.block_key}`);
      continue;
    }

    const content = resolveBlockContent(
      entry.block_key,
      def,
      td,
      tender,
      clauses,
      scenarioId,
      warnings,
    );

    blocks.push({
      id: uniqueBlockId(`${entry.block_key}-${entry.order}`, usedIds),
      block_key: entry.block_key,
      render_key: def.render_key,
      display_name: def.display_name,
      family: def.family,
      editor_mode: def.editor_mode,
      visible: true,
      order: entry.order,
      required: entry.required,
      content,
      default_content: entry.default_content_override || def.default_content,
      schema_config: safeObject(def.schema_config),
      permissions: safeObject(def.permissions),
      provenance: makeBlockProvenance("commercial_ticket", {
        origin_ref: {
          source_id: tender.id,
          template_id: templateId,
          template_version_id: templateVersion.id,
          block_library_id: def.id,
        },
        source_mode: "connected",
        source_kind: "commercial_ticket",
        creation_method: "connected_source",
      }),
    });
  }

  // ── PDS-06: ingest drafted blocks no template slot consumed ──
  // Every content-bearing drafted block that matched no narrative slot is
  // appended as an additional section (never silently dropped), with a
  // warning naming it so the human can reposition or hide it.
  const extraSections = collectUnmatchedDraftedSections(td);
  if (extraSections.length > 0) {
    const narrativeKeys = new Set(["intro.narrative", "scope.list", "closing.note"]);
    let insertAt = -1;
    for (let i = 0; i < blocks.length; i++) {
      if (narrativeKeys.has(blocks[i].block_key)) insertAt = i + 1;
    }
    if (insertAt < 0) {
      const signatureIndex = blocks.findIndex((b) => b.block_key === "signature.dual");
      insertAt = signatureIndex >= 0 ? signatureIndex : blocks.length;
    }
    const extraBlocks: OutputBlock[] = extraSections.map((section) => ({
      id: uniqueBlockId(`drafted.extra.${section.id}`, usedIds),
      block_key: `drafted.extra.${section.id}`,
      render_key: "narrative",
      display_name: section.title,
      family: "commercial",
      editor_mode: "wysiwyg",
      visible: true,
      order: 0, // re-numbered below
      required: false,
      content: { html: section.html, source_status: "populated" },
      default_content: "",
      schema_config: {},
      permissions: {},
      provenance: makeBlockProvenance("commercial_ticket", {
        origin_ref: { source_id: tender.id, original_block_id: section.id },
        source_mode: "connected",
        source_kind: "commercial_ticket",
        creation_method: "connected_source",
      }),
    }));
    blocks.splice(insertAt, 0, ...extraBlocks);
    blocks.forEach((block, index) => { block.order = index + 1; });
    for (const section of extraSections) {
      warnings.push(
        `Drafted block "${section.title}" matched no template slot — added as an additional section.`,
      );
    }
  }

  // ── PDS-07: recorded commercial terms flagged for the proposal ──
  // Payment/VAT/validity facts and every row explicitly marked
  // include_in_proposal = "Yes" previously never reached ANY pack. They are
  // rendered as a dedicated Commercial Terms section (strict opt-in — only
  // "Yes" rows; "Not Assessed" stays internal).
  const commercialTermsHtml = buildCommercialTermsSectionHtml(td);
  if (commercialTermsHtml) {
    const signatureIndex = blocks.findIndex((b) => b.block_key === "signature.dual");
    const insertCtAt = signatureIndex >= 0 ? signatureIndex : blocks.length;
    blocks.splice(insertCtAt, 0, {
      id: uniqueBlockId("commercial.terms.recorded", usedIds),
      block_key: "commercial.terms.recorded",
      render_key: "narrative",
      display_name: "Commercial Terms",
      family: "commercial",
      editor_mode: "wysiwyg",
      visible: true,
      order: 0, // re-numbered below
      required: false,
      content: { html: commercialTermsHtml, source_status: "populated" },
      default_content: "",
      schema_config: {},
      permissions: {},
      provenance: makeBlockProvenance("commercial_ticket", {
        origin_ref: { source_id: tender.id },
        source_mode: "connected",
        source_kind: "commercial_ticket",
        creation_method: "connected_source",
      }),
    });
    blocks.forEach((block, index) => { block.order = index + 1; });
  }

  return {
    blocks,
    tender_id: tender.id,
    tender_title: tenderTitle,
    customer_name: customerName,
    pack_type: packType,
    template_id: templateId,
    template_name: templateName,
    source_hash: sourceHash,
    pricing_scenario_id: scenarioId ?? null,
    snapshot_at: new Date().toISOString(),
    source_data: sourceData,
    warnings,
    // FPS-002-03: store the ACTUAL template version id (not the template id).
    template_version_id: templateVersion.id,
    // FPS-004: carry the template layout config into the snapshot.
    layout: (templateVersion.layout as Record<string, unknown>) ?? null,
    // FPS-006: carry configured volumes (empty if none).
    volumes: volumeRows ?? [],
  };
}

// ═══════════════════════════════════════════════════════════
// Block content resolution (explicit block_key mapping)
// ═══════════════════════════════════════════════════════════

/**
 * Resolves content for a single block based on its block_key.
 * Uses explicit mapping — NO title heuristics.
 */
function resolveBlockContent(
  blockKey: string,
  def: BlockLibraryRow,
  td: Record<string, any>,
  tender: Record<string, any>,
  clauses: ClauseEntry[],
  scenarioId: string | undefined,
  warnings: string[],
): BlockContent {
  switch (blockKey) {
    // ── Cover page ──────────────────────────────────────
    case "cover.hero":
      return resolveCover(td, tender);

    // ── Confidentiality ─────────────────────────────────
    case "confidentiality.locked":
      return resolveConfidentiality(td, tender);

    // ── Narrative / Introduction ─────────────────────────
    case "intro.narrative":
      return resolveNarrative(td, "introduction");

    // ── Scope of services ───────────────────────────────
    case "scope.list":
      return resolveNarrative(td, "scope");

    // ── Scope table (data-bound) ────────────────────────
    case "scope.table":
      return resolveScopeTable(td);

    // ── Facility gallery ────────────────────────────────
    case "facility.gallery":
      return resolveFacilityGallery(td, tender);

    // ── Pricing — single option ─────────────────────────
    case "pricing.table.single":
      return resolvePricing(td, scenarioId, "single", warnings);

    // ── Pricing — multi option ──────────────────────────
    case "pricing.table.multi_option":
      return resolvePricing(td, scenarioId, "multi", warnings);

    // ── Pricing — bilingual with VAT ────────────────────
    case "quote.pricing.vat_bilingual":
      return resolvePricing(td, scenarioId, "bilingual_vat", warnings);

    // ── Totals in words ─────────────────────────────────
    case "totals.number_to_words":
      return resolveTotals(td, scenarioId);

    // ── Terms & conditions ──────────────────────────────
    case "terms.standard":
      return resolveClauses(clauses);

    // ── Closing note ────────────────────────────────────
    case "closing.note":
      return resolveNarrative(td, "closing");

    // ── Signature block ─────────────────────────────────
    case "signature.dual":
      return resolveSignature(td, tender);

    // ── Legal — party details ───────────────────────────
    case "legal.party_details":
      return resolvePartyDetails(td, tender);

    // ── Legal — TOC (auto) ──────────────────────────────
    case "legal.toc.auto":
      return { source_status: "default", toc_entries: [] };

    // ── Legal — clauses ─────────────────────────────────
    case "legal.clauses.locked":
      return resolveClauses(clauses);

    // ── Annexure A — config ─────────────────────────────
    case "annexure.a.config":
      return resolveNarrative(td, "annexure_config");

    // ── Annexure B — SLA matrix ─────────────────────────
    case "annexure.b.sla_matrix":
      return resolveSlaMatrix(td, warnings);

    // ── Annexure C — rate card ──────────────────────────
    case "annexure.c.rate_card":
      // PDS-22: this block previously rendered the scenario P&L summary
      // (including internal cost/GP — compounding PDS-01) under the label
      // "Rate Card". No rate-card source exists in the tender record, so the
      // honest state is "not captured" — never internal P&L in disguise.
      warnings.push(
        "Rate card content is not captured — pricing scenarios are an internal P&L view, not a rate card.",
      );
      return { pricing_rows: [], source_status: "not_captured" };

    // ── Annexure D — communication matrix ───────────────
    case "annexure.d.communication_matrix":
      return resolveNarrative(td, "communication_matrix");

    default:
      warnings.push(`No content resolver for block_key: ${blockKey}`);
      return {
        html: def.default_content,
        source_status: "default",
      };
  }
}

// ═══════════════════════════════════════════════════════════
// Individual block resolvers
// ═══════════════════════════════════════════════════════════

function resolveCover(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const tenderMeta = safeObject(td.tender);
  const title = tender.ticket_title || safeString(tenderMeta.title) || "Not available";
  const customerName = tender.customer_name || safeString(tenderMeta.customerName) || "Not available";
  const tenderRef = safeString(tenderMeta.tenderRef) || (tender.id ? String(tender.id).slice(0, 8) : "—");
  const date = tender.target_date || safeString(tenderMeta.submissionDeadline) || new Date().toLocaleDateString("en-GB");

  return {
    variables: {
      title,
      subtitle: `Ref: ${tenderRef}`,
      customer_name: customerName,
      ref_number: tenderRef,
      date,
    },
    source_status: "populated",
  };
}

function resolveConfidentiality(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      company_name: "Hala Supply Chain Services",
      recipient_name: customerName,
    },
    source_status: "populated",
  };
}

/**
 * PADW T06a (PDS-06) — drafted-block → narrative-slot matching.
 *
 * Structured fields win: the Block Workbench records `block_type` and the
 * drafter's `document_assembly_target` / `intended_section`, so those are
 * matched FIRST. The historical block_key / title heuristics remain only as
 * a fallback for blocks drafted before the structured fields existed.
 */
const NARRATIVE_SECTIONS = [
  "introduction",
  "scope",
  "closing",
  "annexure_config",
  "communication_matrix",
] as const;
export type NarrativeSection = (typeof NARRATIVE_SECTIONS)[number];

/** Exact `block_type` values that map unambiguously onto a narrative slot. */
const BLOCK_TYPE_SLOTS: Record<NarrativeSection, string[]> = {
  introduction: ["executive summary"],
  scope: ["scope of work"],
  closing: ["decision required"],
  annexure_config: [],
  communication_matrix: [],
};

/** Assembly-target / intended-section phrases per slot (normalized includes). */
const TARGET_PHRASES: Record<NarrativeSection, string[]> = {
  introduction: ["introduction", "executive summary", "intro"],
  scope: ["scope of service", "scope of work", "scope"],
  closing: ["closing", "conclusion", "next steps"],
  annexure_config: ["annexure a", "service configuration", "config"],
  communication_matrix: ["communication", "escalation"],
};

function sectionMatchesBlock(section: NarrativeSection, b: any): boolean {
  const blockType = safeString(b.block_type).trim().toLowerCase();
  if (blockType && BLOCK_TYPE_SLOTS[section].includes(blockType)) return true;

  const targets = [b.document_assembly_target, b.intended_section]
    .map((v) => safeString(v).trim().toLowerCase())
    .filter(Boolean);
  if (targets.some((t) => TARGET_PHRASES[section].some((p) => t.includes(p)))) {
    return true;
  }

  // Legacy fallback: block_key / title heuristics (pre-structured blocks).
  const key = safeString(b.block_key || b.section_key).toLowerCase();
  const title = safeString(b.title).toLowerCase();
  switch (section) {
    case "introduction":
      return key === "introduction" || key === "intro" ||
        title.includes("introduction") || title.includes("executive summary");
    case "scope":
      return key === "scope" || key === "scope_of_services" ||
        title.includes("scope of service") || title.includes("scope of work");
    case "closing":
      return key === "closing" || key === "closing_note" || key === "conclusion" ||
        title.includes("closing") || title.includes("next steps") || title.includes("conclusion");
    case "annexure_config":
      return key.includes("annexure") || key.includes("config") ||
        title.includes("service configuration") || title.includes("annexure a");
    case "communication_matrix":
      return key.includes("communication") || key.includes("escalation") ||
        title.includes("communication matrix") || title.includes("escalation");
  }
}

function draftedProposalBlocks(td: Record<string, any>): any[] {
  const drafting = safeObject(td.tender_drafting);
  return Array.isArray(drafting.proposal_blocks) ? drafting.proposal_blocks : [];
}

/** The drafted block a narrative slot consumes (first structured/heuristic match). */
export function matchDraftedBlock(td: Record<string, any>, section: NarrativeSection): any | undefined {
  return draftedProposalBlocks(td).find((b) => sectionMatchesBlock(section, b));
}

/**
 * PDS-06 — content-bearing drafted blocks that NO narrative slot consumes.
 * These previously vanished from the pack silently (Operating Model,
 * Implementation Plan, Manpower, Risk, …). The loader now ingests them as
 * additional sections and says so in the warnings.
 */
export function collectUnmatchedDraftedSections(
  td: Record<string, any>,
): Array<{ id: string; title: string; html: string }> {
  const blocks = draftedProposalBlocks(td);
  const consumed = new Set<any>();
  for (const section of NARRATIVE_SECTIONS) {
    const matched = blocks.find((b) => sectionMatchesBlock(section, b));
    if (matched) consumed.add(matched);
  }
  const extras: Array<{ id: string; title: string; html: string }> = [];
  for (const block of blocks) {
    if (consumed.has(block)) continue;
    const html = extractProposalContent(block);
    if (!html) continue;
    extras.push({
      id: safeString(block.id) || `drafted-${extras.length + 1}`,
      title: safeString(block.title) || safeString(block.block_type) || "Drafted section",
      html,
    });
  }
  return extras;
}

function resolveNarrative(
  td: Record<string, any>,
  section: NarrativeSection,
): BlockContent {
  const matched = matchDraftedBlock(td, section);
  if (!matched) {
    return { html: undefined, source_status: "not_captured" };
  }

  const html = extractProposalContent(matched);
  if (!html) {
    return { html: undefined, source_status: "not_captured" };
  }

  return { html, source_status: "populated" };
}

function resolveScopeTable(td: Record<string, any>): BlockContent {
  const sowData = safeObject(td.sow_data);
  // PDS-21: the old reader looked ONLY for `scope_items` / `deliverables`,
  // which no writer produces — a dead mapping that kept this block empty
  // forever. The real captured scope lives in `sow_data.service_lines`
  // (SOW capture); the legacy keys are still honored first for any
  // historical rows that carry them.
  const legacyItems = sowData.scope_items || sowData.deliverables;
  const scopeItems = Array.isArray(legacyItems) && legacyItems.length > 0
    ? legacyItems
    : Array.isArray(sowData.service_lines)
      ? sowData.service_lines
      : [];

  if (!Array.isArray(scopeItems) || scopeItems.length === 0) {
    return { html: undefined, source_status: "not_captured" };
  }

  // Build an HTML table from scope items
  let html = "<table><thead><tr><th>Item</th><th>Description</th><th>Deliverable</th></tr></thead><tbody>";
  for (const item of scopeItems) {
    const name = safeString(item.name || item.item);
    const desc = safeString(item.description);
    const deliverable = safeString(item.deliverable || item.output);
    html += `<tr><td>${name || "Not captured yet"}</td><td>${desc || "Not captured yet"}</td><td>${deliverable || "Not captured yet"}</td></tr>`;
  }
  html += "</tbody></table>";

  return { html, source_status: "populated" };
}

function resolveFacilityGallery(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      facility_name: "Hala Supply Chain Services",
      location: "Kingdom of Saudi Arabia",
      customer_name: customerName,
    },
    source_status: "default",
  };
}

function resolvePricing(
  td: Record<string, any>,
  scenarioId: string | undefined,
  format: "single" | "multi" | "bilingual_vat",
  warnings: string[],
): BlockContent {
  const pricingData = safeObject(td.pricing);
  const scenarios = safeObject(pricingData.scenarios);
  const rows: any[] = Array.isArray(scenarios.rows) ? scenarios.rows : [];

  if (rows.length === 0) {
    warnings.push("No pricing scenarios found in tender data");
    return { pricing_rows: [], source_status: "not_captured" };
  }

  let selectedRows: any[];

  if (format === "single" && scenarioId) {
    // Use the specified scenario
    const match = rows.find((r: any) => r.id === scenarioId);
    selectedRows = match ? [match] : rows.slice(0, 1);
    if (!match) {
      warnings.push(`Pricing scenario ${scenarioId} not found, using first available`);
    }
  } else if (format === "single") {
    // Use selected scenario or first
    const selectedId = scenarios.selected_scenario?.selected_scenario_id;
    const match = selectedId ? rows.find((r: any) => r.id === selectedId) : null;
    selectedRows = match ? [match] : rows.slice(0, 1);
  } else {
    // Multi / bilingual — show all scenarios
    selectedRows = rows;
  }

  // PDS-01: customer-facing projection ONLY. Internal cost / GP% /
  // recommendation / internal notes never leave this function.
  const pricingRows: PricingOutputRow[] = selectedRows.map((r: any) => ({
    id: safeString(r.id),
    scenario_name: safeString(r.scenario_name) || "Not captured yet",
    scenario_type: safeString(r.scenario_type) || "Not captured yet",
    revenue: formatRecordedRevenue(safeString(r.revenue)),
  }));

  return { pricing_rows: pricingRows, source_status: "populated" };
}

function resolveTotals(
  td: Record<string, any>,
  scenarioId: string | undefined,
): BlockContent {
  const pricingData = safeObject(td.pricing);
  const scenarios = safeObject(pricingData.scenarios);
  const rows: any[] = Array.isArray(scenarios.rows) ? scenarios.rows : [];

  if (rows.length === 0) {
    return {
      variables: {
        total_amount: "Not captured yet",
        total_in_words: "Not captured yet",
        currency: "SAR",
      },
      source_status: "not_captured",
    };
  }

  // Find the relevant scenario
  let scenario: any;
  if (scenarioId) {
    scenario = rows.find((r: any) => r.id === scenarioId) || rows[0];
  } else {
    const selectedId = scenarios.selected_scenario?.selected_scenario_id;
    scenario = selectedId ? rows.find((r: any) => r.id === selectedId) || rows[0] : rows[0];
  }

  // PDS-09: locale-tolerant parse. parseFloat("1,200,000") === 1 silently
  // exported "SAR 1.00 / One Saudi Riyals" — a wrong number in a customer
  // document. Unparsable recorded revenue is now an HONEST state, never a
  // fabricated total.
  const revenue = safeString(scenario.revenue);
  const amount = parseRecordedRevenue(revenue);

  if (amount === null) {
    return {
      variables: {
        total_amount: revenue.trim()
          ? `Recorded revenue "${revenue.trim()}" is not a clean number — review the pricing scenario`
          : "Not captured yet",
        total_in_words: "Not available",
        currency: "SAR",
      },
      source_status: "not_captured",
    };
  }

  return {
    variables: {
      total_amount: amount > 0 ? formatSAR(amount) : "Not captured yet",
      total_in_words: amount > 0 ? numberToWords(amount) + " Saudi Riyals" : "Not captured yet",
      currency: "SAR",
    },
    source_status: amount > 0 ? "populated" : "not_captured",
  };
}

function resolveClauses(clauses: ClauseEntry[]): BlockContent {
  if (clauses.length === 0) {
    return { clauses: [], source_status: "not_captured" };
  }
  return { clauses, source_status: "populated" };
}

function resolveSignature(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      hala_signatory: "",
      hala_title: "",
      client_signatory: "",
      client_title: "",
      hala_company: "Hala Supply Chain Services",
      client_company: customerName,
    },
    source_status: "populated",
  };
}

function resolvePartyDetails(
  td: Record<string, any>,
  tender: Record<string, any>,
): BlockContent {
  const customerName = tender.customer_name || safeString(td.tender?.customerName) || "Not available";
  return {
    variables: {
      first_party_name: "Hala Supply Chain Services Company",
      first_party_cr: "",
      first_party_address: "Kingdom of Saudi Arabia",
      second_party_name: customerName,
      second_party_cr: "",
      second_party_address: "",
    },
    source_status: "populated",
  };
}

function resolveSlaMatrix(
  td: Record<string, any>,
  warnings: string[],
): BlockContent {
  const solutionDesign = safeObject(td.solution_design_data);
  const slaData = safeObject(solutionDesign.sla_kpi);
  const kpis: any[] = Array.isArray(slaData.rows)
    ? slaData.rows
    : Array.isArray(slaData.kpis)
      ? slaData.kpis
      : [];

  // PDS-04: the SLA writer (SLAKPIModelTab) records `kpi_name` and
  // `measurement_method`, and rows carry `include_in_proposal`. The old
  // reader looked for `kpi` / `measurement` / a per-row `penalty` that no
  // writer produces — a dead data contract that rendered "Not captured yet"
  // over fully captured KPIs. Read the REAL field names (legacy aliases kept),
  // honor include_in_proposal, and source penalty honestly from the recorded
  // governance penalty linkage instead of pretending a per-row field exists.
  const included = kpis.filter(
    (kpi: any) => safeString(kpi.include_in_proposal) !== "No",
  );

  if (included.length === 0) {
    warnings.push(
      kpis.length === 0
        ? "No SLA/KPI data found in tender solution design"
        : "All captured SLA KPIs are marked exclude-from-proposal",
    );
    return { sla_rows: [], source_status: "not_captured" };
  }

  const governance = safeObject(slaData.governance);
  const penaltyLinkage = safeString(governance.penalty_linkage);
  const governancePenalty =
    penaltyLinkage && penaltyLinkage !== "Not Assessed"
      ? `Per governance penalty linkage: ${penaltyLinkage}`
      : "Not captured yet";

  const slaRows: SlaOutputRow[] = included.map((kpi: any) => ({
    kpi: safeString(kpi.kpi_name || kpi.kpi || kpi.name) || "Not captured yet",
    target: safeString(kpi.target) || "Not captured yet",
    measurement:
      safeString(kpi.measurement_method || kpi.measurement) || "Not captured yet",
    penalty: safeString(kpi.penalty) || governancePenalty,
  }));

  return { sla_rows: slaRows, source_status: "populated" };
}

// ═══════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════

/**
 * PADW T06a (PDS-07) — render the recorded commercial terms that are flagged
 * for the proposal into one HTML section. STRICT opt-in: repeated rows render
 * only when include_in_proposal === "Yes". Scalar payment/VAT/validity facts
 * render when captured. Returns undefined when nothing qualifies — the pack
 * simply has no Commercial Terms section (honest absence, never boilerplate).
 */
export function buildCommercialTermsSectionHtml(td: Record<string, any>): string | undefined {
  const terms = safeObject(safeObject(td.pricing).commercial_terms);
  const esc = (v: unknown): string =>
    safeString(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [];

  const ptv = safeObject(terms.payment_tax_validity);
  const scalarRows: Array<[string, string]> = [
    ["Payment terms", safeString(ptv.payment_terms)],
    ["VAT treatment", safeString(ptv.vat_treatment)],
    ["VAT %", safeString(ptv.vat_percent)],
    ["Proposal validity", safeString(ptv.proposal_validity)],
    ["Contract term", safeString(ptv.contract_term)],
    ["Extension option", safeString(ptv.extension_option)],
  ].filter(([, value]) => value.trim() && value !== "Not Assessed") as Array<[string, string]>;
  if (scalarRows.length > 0) {
    parts.push(
      `<table><tbody>${scalarRows
        .map(([label, value]) => `<tr><td><strong>${esc(label)}</strong></td><td>${esc(value)}</td></tr>`)
        .join("")}</tbody></table>`,
    );
  }

  const flagged = (rows: unknown): any[] =>
    (Array.isArray(rows) ? rows : []).filter(
      (row: any) => safeString(row?.include_in_proposal) === "Yes",
    );

  const surcharges = flagged(terms.surcharges);
  if (surcharges.length > 0) {
    parts.push(
      `<h3>Surcharges</h3><table><thead><tr><th>Charge</th><th>Trigger</th><th>Rate</th><th>Applies to</th></tr></thead><tbody>${surcharges
        .map((r: any) => `<tr><td>${esc(r.charge_type)}</td><td>${esc(r.trigger)}</td><td>${esc(r.rate_formula)}</td><td>${esc(r.applies_to)}</td></tr>`)
        .join("")}</tbody></table>`,
    );
  }

  const responsibilities = flagged(terms.customer_responsibilities);
  if (responsibilities.length > 0) {
    parts.push(
      `<h3>Customer Responsibilities</h3><ul>${responsibilities
        .map((r: any) => `<li>${esc(r.responsibility)}${safeString(r.applies_to).trim() ? ` — ${esc(r.applies_to)}` : ""}</li>`)
        .join("")}</ul>`,
    );
  }

  const exclusions = flagged(terms.exclusions);
  if (exclusions.length > 0) {
    parts.push(
      `<h3>Exclusions</h3><ul>${exclusions
        .map((r: any) => `<li>${esc(r.exclusion)}${safeString(r.reason).trim() ? ` — ${esc(r.reason)}` : ""}</li>`)
        .join("")}</ul>`,
    );
  }

  const assumptions = flagged(terms.assumptions);
  if (assumptions.length > 0) {
    parts.push(
      `<h3>Assumptions</h3><ul>${assumptions
        .map((r: any) => `<li>${esc(r.assumption)}${safeString(r.impact).trim() ? ` — ${esc(r.impact)}` : ""}</li>`)
        .join("")}</ul>`,
    );
  }

  if (parts.length === 0) return undefined;
  return `<h2>Commercial Terms</h2>${parts.join("")}`;
}

/** Extract content from a proposal block using priority chain */
function extractProposalContent(block: any): string | undefined {
  const content =
    block.content_html ||
    block.editor_content ||
    block.draft_content ||
    block.content_text ||
    block.content;

  if (!content || typeof content !== "string") return undefined;
  return content;
}

/** Compute SHA-256 hash of stable-stringified data */
export async function computeSourceHash(data: Record<string, unknown>): Promise<string> {
  const stableJson = stableJsonStringify(data);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(stableJson));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Safe object accessor */
function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/** Safe string accessor */
function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

/**
 * PADW T06a (PDS-09) — locale-tolerant parse of a human-recorded revenue
 * string. Accepts thousands separators, spaces, and a leading/trailing
 * "SAR" token. Returns null (never a wrong number) when the remainder is
 * not one clean number.
 */
export function parseRecordedRevenue(raw: string): number | null {
  const cleaned = raw
    .replace(/sar/gi, "")
    .replace(/[,\s ٬]/g, "")
    .trim();
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/** Customer-facing revenue cell: formatted when parseable, verbatim otherwise. */
function formatRecordedRevenue(raw: string): string {
  if (!raw.trim()) return "Not captured yet";
  const amount = parseRecordedRevenue(raw);
  return amount === null ? raw.trim() : formatSAR(amount);
}

/** Format number as SAR currency */
function formatSAR(amount: number): string {
  return new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Basic number-to-words for SAR amounts (English) */
function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " Million" + (n % 1000000 ? " " + convert(n % 1000000) : "");
    return convert(Math.floor(n / 1000000000)) + " Billion" + (n % 1000000000 ? " " + convert(n % 1000000000) : "");
  }

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let result = convert(intPart);
  if (decPart > 0) {
    result += ` and ${convert(decPart)} Halalas`;
  }
  return result;
}

/** Create error snapshot */
function errorSnapshot(
  tenderId: string,
  packType: PackType,
  templateId: string,
  error: string,
): BlockSnapshot {
  return {
    blocks: [],
    tender_id: tenderId,
    tender_title: "Not available",
    customer_name: "Not available",
    pack_type: packType,
    template_id: templateId,
    template_name: "",
    source_hash: "",
    pricing_scenario_id: null,
    snapshot_at: new Date().toISOString(),
    source_data: {},
    warnings: [],
    error,
  };
}
