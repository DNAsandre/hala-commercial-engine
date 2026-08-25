/**
 * pdf-block-source-map.ts — PADW T06b, design pin P6 (ADR-09).
 *
 * The machine-checkable contract of WHICH canonical destination fields feed
 * each PDF block render_key, what the block falls back to when the source is
 * absent, and what its honest empty state says. Canonical ids follow pin P1
 * ("t:" = tender, type_details-rooted; "p:" = proposal, proposal_workspace-
 * rooted). This file deliberately does NOT import the manifest data modules
 * (parallel-lane rule) — integration adds the cross-consistency test proving
 * every id below exists in TENDER_MANIFEST / PROPOSAL_MANIFEST.
 *
 * `fallback`:
 *  - "honest_empty"    → absent source renders the emptyState text, nothing else;
 *  - "labeled_default" → the block's template default may render, but ONLY
 *                        under the visible template-text label (pin P7).
 *
 * Blocks with structural/system content (page breaks, TOC) carry an empty
 * sourceFields list and are marked "not_source_bound".
 */

export type BlockFallback = "honest_empty" | "labeled_default" | "not_source_bound";

export interface BlockSourceBinding {
  /** Canonical destination field ids (pin P1) this block consumes. */
  sourceFields: string[];
  /** Real commercial_tickets columns used as document headers, not tracker destinations. */
  sourceColumns?: string[];
  fallback: BlockFallback;
  /** The honest text shown when the source is absent. */
  emptyState: string;
  notes?: string;
}

export const PDF_BLOCK_SOURCE_MAP: Record<string, BlockSourceBinding> = {
  cover_hero: {
    sourceFields: [],
    sourceColumns: ["ticket_title", "customer_name", "target_date"],
    fallback: "honest_empty",
    emptyState: "Cover details not captured yet.",
    notes: "Header columns are intentionally outside the tracker destination manifests. Legacy type_details.tender aliases may supply a recorded reference, but no reference or date is invented.",
  },
  toc_auto: {
    sourceFields: [],
    fallback: "not_source_bound",
    emptyState: "",
    notes: "Computed from rendered blocks at render time.",
  },
  page_break: {
    sourceFields: [],
    fallback: "not_source_bound",
    emptyState: "",
  },
  narrative: {
    sourceFields: [
      "t:tender_drafting.proposal_blocks[].draft_content",
      "t:tender_drafting.proposal_blocks[].editor_content",
      "t:tender_drafting.proposal_blocks[].block_type",
      "t:tender_drafting.proposal_blocks[].document_assembly_target",
      "p:proposal_drafting.proposalDraftBlocks[].content",
    ],
    fallback: "labeled_default",
    emptyState: "Content not captured yet.",
    notes: "PDS-06: structured matching (block_type / assembly target) first; unmatched drafted blocks are ingested as additional narrative sections, never dropped.",
  },
  scope_list: {
    sourceFields: [
      "t:tender_drafting.proposal_blocks[].draft_content",
      "t:tender_drafting.proposal_blocks[].editor_content",
      "p:proposal_drafting.proposalDraftBlocks[].content",
    ],
    fallback: "labeled_default",
    emptyState: "Content not captured yet.",
  },
  scope_table: {
    sourceFields: [
      "t:sow_data.service_lines[]",
    ],
    fallback: "honest_empty",
    emptyState: "Content not captured yet.",
    notes: "PDS-21: mapped to the real captured SOW service lines (legacy scope_items honored first).",
  },
  closing: {
    sourceFields: [
      "t:tender_drafting.proposal_blocks[].draft_content",
      "t:tender_drafting.proposal_blocks[].editor_content",
      "p:proposal_drafting.proposalDraftBlocks[].content",
    ],
    fallback: "labeled_default",
    emptyState: "Content not captured yet.",
  },
  confidentiality: {
    sourceFields: [],
    sourceColumns: ["customer_name"],
    fallback: "labeled_default",
    emptyState: "Content not captured yet.",
    notes: "PDS-03: recipient_name variable resolves to the customer name; unresolved variables stay visible and are flagged by WarningBanner.",
  },
  terms: {
    sourceFields: [],
    fallback: "labeled_default",
    emptyState: "No published clauses in the Clause Library yet.",
    notes: "PDS-02: clause-bearing terms render clause_library published rows (a system table, not a per-ticket destination — hence no canonical ticket field).",
  },
  terms_standard: {
    sourceFields: [],
    fallback: "labeled_default",
    emptyState: "No published clauses in the Clause Library yet.",
    notes: "Alias used by existing library rows; clause_library is a system table rather than a per-ticket destination.",
  },
  legal_clauses: {
    sourceFields: [],
    fallback: "honest_empty",
    emptyState: "No published clauses in the Clause Library yet.",
    notes: "PDS-02: renders clause_library published rows (EN + AR where present).",
  },
  annexure_config: {
    sourceFields: [
      "t:tender_drafting.proposal_blocks[].draft_content",
      "t:tender_drafting.proposal_blocks[].editor_content",
    ],
    fallback: "labeled_default",
    emptyState: "Content not captured yet.",
  },
  annexure_comms: {
    sourceFields: [
      "t:tender_drafting.proposal_blocks[].draft_content",
      "t:tender_drafting.proposal_blocks[].editor_content",
    ],
    fallback: "labeled_default",
    emptyState: "Content not captured yet.",
  },
  custom_text: {
    sourceFields: [],
    fallback: "not_source_bound",
    emptyState: "Content not captured yet.",
    notes: "Human-authored block content only.",
  },
  pricing_table_single: {
    sourceFields: [
      "t:pricing.scenarios.rows[].scenario_name",
      "t:pricing.scenarios.rows[].scenario_type",
      "t:pricing.scenarios.rows[].revenue",
      "t:pricing.scenarios.selected_scenario.selected_scenario_id",
      "p:pnl_pricing.pnlVersions[].name",
      "p:pnl_pricing.pnlVersions[].revenue[].amount",
      "p:pnl_pricing.activePnlVersion",
    ],
    fallback: "honest_empty",
    emptyState: "No pricing data captured yet.",
    notes: "PDS-01: CUSTOMER-FACING projection — internal cost/GP%/recommended/notes never render.",
  },
  pricing_table_multi: {
    sourceFields: [
      "t:pricing.scenarios.rows[].scenario_name",
      "t:pricing.scenarios.rows[].scenario_type",
      "t:pricing.scenarios.rows[].revenue",
    ],
    fallback: "honest_empty",
    emptyState: "No pricing data captured yet.",
    notes: "PDS-01 applies.",
  },
  quote_pricing_vat: {
    sourceFields: [
      "t:pricing.scenarios.rows[].scenario_name",
      "t:pricing.scenarios.rows[].revenue",
    ],
    fallback: "honest_empty",
    emptyState: "No pricing data captured yet.",
    notes: "PDS-08: bilingual EN/AR + VAT rendering is a declared gap until implemented or the pack card is relabeled.",
  },
  annexure_rate_card: {
    sourceFields: [],
    fallback: "honest_empty",
    emptyState: "Rate card content is not captured yet.",
    notes: "PDS-22: never renders the internal scenario P&L; stays honestly empty until a real rate-card source exists.",
  },
  totals_words: {
    sourceFields: [
      "t:pricing.scenarios.rows[].revenue",
      "t:pricing.scenarios.selected_scenario.selected_scenario_id",
    ],
    fallback: "honest_empty",
    emptyState: "Totals not captured yet.",
    notes: "PDS-09: locale-tolerant parse; unparsable recorded revenue is an honest state, never a fabricated total.",
  },
  annexure_sla: {
    sourceFields: [
      "t:solution_design_data.sla_kpi.kpis[].kpi_name",
      "t:solution_design_data.sla_kpi.kpis[].target",
      "t:solution_design_data.sla_kpi.kpis[].measurement_method",
      "t:solution_design_data.sla_kpi.kpis[].include_in_proposal",
      "t:solution_design_data.sla_kpi.governance.penalty_linkage",
    ],
    fallback: "honest_empty",
    emptyState: "No SLA/KPI data captured yet.",
    notes: "PDS-04: real writer field names; include_in_proposal honored; penalty sourced honestly from governance linkage.",
  },
  facility_gallery: {
    sourceFields: [],
    sourceColumns: ["customer_name"],
    fallback: "labeled_default",
    emptyState: "Not captured yet.",
    notes: "PDS-47: company-default variables; renders as default-status content (WarningBanner counts it).",
  },
  party_details: {
    sourceFields: [],
    sourceColumns: ["customer_name"],
    fallback: "honest_empty",
    emptyState: "Not captured yet.",
  },
  signature_dual: {
    sourceFields: [],
    sourceColumns: ["customer_name"],
    fallback: "honest_empty",
    emptyState: "Not captured yet.",
    notes: "Signatory names are intentionally blank for manual completion.",
  },
};

/** Render keys with no explicit binding fail the integration consistency test. */
export function getBlockSourceBinding(renderKey: string): BlockSourceBinding | undefined {
  return PDF_BLOCK_SOURCE_MAP[renderKey];
}
