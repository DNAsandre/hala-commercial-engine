/**
 * DISABLED: legacy SUPA-003C audit script.
 *
 * This audit targeted prototype workspace data and legacy commercial tables.
 * Use a current commercial_tickets lineage audit instead of validating obsolete
 * prototype records.
 */

console.error(
  [
    "This SUPA-003C audit script is disabled.",
    "It audited obsolete prototype workspace data and should not guide production cleanup.",
    "Use a canonical commercial_tickets audit for current investigations.",
  ].join("\n"),
);

process.exit(1);

export {};
