/**
 * Disabled legacy escalation migration.
 *
 * This script used to create and seed escalation_events/escalation_tasks demo
 * rows. Those tables are no longer the operational source of truth.
 *
 * Use commercial_escalations with explicit source_lineage instead.
 */

console.error(
  [
    'run-escalation-migration.mjs is disabled.',
    'Do not seed escalation_events or escalation_tasks.',
    'Use the source-backed commercial_escalations pipeline instead.',
  ].join(' ')
);

process.exit(1);
