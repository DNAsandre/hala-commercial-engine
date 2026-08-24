/**
 * PADW foundation (Fable-owned) — canonical destination-manifest contract.
 *
 * Every editable Tender/Proposal leaf field, repeated collection, and document
 * reference is described by exactly one FieldDescriptor in exactly one
 * ProcessManifest. Canonical field IDs mirror the persistence path:
 *   "t:pricing.scenarios.rows[].revenue"    (tender, type_details-rooted)
 *   "p:pnl_pricing.pnlVersions[].name"      (proposal, proposal_workspace-rooted)
 * `[]` marks a repeated collection and REQUIRES a RowIdentitySpec so that
 * extraction replay can update rather than duplicate.
 *
 * This file defines shape + validation only. It contains no bot, prompt,
 * provider, model, or knowledge content (AI-BOT-CONFIGURATION-ARCHITECTURE-RULE).
 */

export type ProcessKind = "tender" | "proposal";

export type FieldType =
  | "text"
  | "richtext"
  | "number"
  | "integer"
  | "currency"
  | "percent"
  | "date"
  | "datetime"
  | "boolean"
  | "enum"
  | "id_ref"
  | "array"
  | "object";

/** How a repeated row is recognized across extraction replays. */
export interface RowIdentitySpec {
  /** Leaf names (relative to the row) hashed into the stable source fingerprint. */
  readonly fingerprintFields: readonly string[];
  readonly note?: string;
}

export interface FieldDescriptor {
  /** Canonical id — unique across the manifest, mirrors persistencePath. */
  readonly id: string;
  readonly process: ProcessKind;
  /** Internal stage key (tender: 15 stages; proposal: 11 stages). */
  readonly stage: string;
  readonly tab?: string;
  /** Human label as rendered by the owning UI. */
  readonly label: string;
  readonly type: FieldType;
  /** e.g. "SAR", "%", "days" — required for currency/percent by validation. */
  readonly unit?: string;
  readonly enumValues?: readonly string[];
  /** What an absent value means at persistence time. */
  readonly nullBehavior: "omit" | "null" | "empty_string" | "default";
  /** Named normalization contract (documented in the manifest evidence doc). */
  readonly sanitizer?: string;
  /**
   * JSON path from the process root:
   *  tender  → commercial_tickets.type_details.<path>
   *  proposal → commercial_tickets.type_details.proposal_workspace.<path>
   */
  readonly persistencePath: string;
  /** Owning UI component (repo-relative file path). */
  readonly uiOwner: string;
  /** REQUIRED when persistencePath contains "[]". */
  readonly rowIdentity?: RowIdentitySpec;
  /** Where source evidence for this field lives. */
  readonly evidence: "sidecar" | { readonly inlineField: string } | "none";
  /** PDF block render_keys consuming this field, or explicitly not exported. */
  readonly pdfConsumer: readonly string[] | "not_exported";
  readonly notes?: string;
}

export interface ProcessManifest {
  readonly process: ProcessKind;
  readonly stages: readonly string[];
  readonly fields: readonly FieldDescriptor[];
}

/** Prefix for canonical ids per process. */
export const ID_PREFIX: Record<ProcessKind, string> = {
  tender: "t:",
  proposal: "p:",
};

/**
 * Structural validation. Returns a list of human-readable problems; empty
 * array = valid. Pure, deterministic, no I/O.
 */
export function validateManifest(m: ProcessManifest): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const prefix = ID_PREFIX[m.process];
  for (const f of m.fields) {
    if (f.process !== m.process) {
      problems.push(`${f.id}: process mismatch (${f.process} in ${m.process} manifest)`);
    }
    if (!f.id.startsWith(prefix)) {
      problems.push(`${f.id}: id must start with "${prefix}"`);
    }
    if (seen.has(f.id)) {
      problems.push(`${f.id}: duplicate canonical id`);
    }
    seen.add(f.id);
    if (f.id.slice(prefix.length) !== f.persistencePath) {
      problems.push(`${f.id}: id does not mirror persistencePath "${f.persistencePath}"`);
    }
    if (!m.stages.includes(f.stage)) {
      problems.push(`${f.id}: unknown stage "${f.stage}"`);
    }
    if (f.persistencePath.includes("[]") && !f.rowIdentity) {
      problems.push(`${f.id}: repeated path requires rowIdentity`);
    }
    if (!f.persistencePath.includes("[]") && f.rowIdentity) {
      problems.push(`${f.id}: rowIdentity on a non-repeated path`);
    }
    if ((f.type === "currency" || f.type === "percent") && !f.unit) {
      problems.push(`${f.id}: ${f.type} requires a unit`);
    }
    if (f.type === "enum" && (!f.enumValues || f.enumValues.length === 0)) {
      problems.push(`${f.id}: enum requires enumValues`);
    }
    if (!f.uiOwner.trim()) {
      problems.push(`${f.id}: uiOwner is required`);
    }
    if (f.pdfConsumer !== "not_exported" && f.pdfConsumer.length === 0) {
      problems.push(`${f.id}: pdfConsumer must name blocks or be "not_exported"`);
    }
  }
  return problems;
}
