/**
 * DISABLED: legacy commercial/tender seed script.
 *
 * This file previously wrote fabricated commercial workspace records into
 * Supabase using the service role key. That violates the Commercial OS data
 * doctrine: operational records must come from verified source systems,
 * approved imports, or human intake with lineage.
 */

console.error(
  [
    "This legacy seed script is disabled.",
    "It must not write commercial, tender, proposal, SLA, pricing, or escalation records.",
    "Use the unified intake flow and human-reviewed SQL/migrations instead.",
  ].join("\n"),
);

process.exit(1);

export {};
