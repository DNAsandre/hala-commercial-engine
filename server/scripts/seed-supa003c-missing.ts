/**
 * DISABLED: SUPA-003C missing-event seed script.
 *
 * This script previously inserted fabricated activity and audit events for a
 * prototype workspace. Activity and audit rows must now be created only by
 * real application actions against canonical records.
 */

console.error(
  [
    "This SUPA-003C event seed script is disabled.",
    "It must not insert fabricated activity or audit events.",
    "Generate activity and audit rows from real workflow actions only.",
  ].join("\n"),
);

process.exit(1);

export {};
