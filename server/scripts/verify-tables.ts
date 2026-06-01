/**
 * DISABLED: legacy table verifier.
 *
 * This script checked obsolete commercial prototype tables and can give a
 * false sense of correctness. Current verification must target canonical
 * tables and lineage-approved records only.
 */

console.error(
  [
    "This legacy table verifier is disabled.",
    "Do not validate the Commercial OS against obsolete prototype tables.",
    "Use a current canonical schema audit instead.",
  ].join("\n"),
);

process.exit(1);

export {};
