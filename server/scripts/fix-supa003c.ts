/**
 * DISABLED: legacy SUPA-003C cleanup script.
 *
 * This script used direct service-role deletes against prototype commercial
 * proposal and SLA tables. Database cleanup must be performed by explicit,
 * human-reviewed SQL after the affected rows and lineage have been inspected.
 */

console.error(
  [
    "This SUPA-003C cleanup script is disabled.",
    "It must not directly delete Supabase rows from local script execution.",
    "Prepare human-reviewed cleanup SQL instead.",
  ].join("\n"),
);

process.exit(1);

export {};
