/**
 * DISABLED: automatic legacy migration runner.
 *
 * This runner targeted obsolete commercial/tender schema work and attempted
 * service-role SQL execution. Current doctrine: inspect schema first, generate
 * SQL, and have a human run it manually.
 */

console.error(
  [
    "This automatic legacy migration runner is disabled.",
    "Do not execute commercial database migrations from local scripts.",
    "Use human-reviewed SQL in the Supabase SQL Editor instead.",
  ].join("\n"),
);

process.exit(1);

export {};
