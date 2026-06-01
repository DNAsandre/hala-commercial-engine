/**
 * DISABLED: SUPA-003B fabricated commercial seed script.
 *
 * This script used service-role writes to create operational proposal,
 * negotiation, SLA, activity, and audit records. The application now requires
 * those records to originate from commercial_tickets, verified source data,
 * or real workflow events.
 */

console.error(
  [
    "This SUPA-003B seed script is disabled.",
    "It must not inject fabricated proposal, SLA, activity, or audit records.",
    "Use canonical intake, verified imports, and real workflow event creation only.",
  ].join("\n"),
);

process.exit(1);

export {};
