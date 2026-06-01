/**
 * DISABLED: document system seed script.
 *
 * This script wrote default document blocks, templates, terms, and SLA content
 * into Supabase. Document templates are allowed only when created through a
 * governed admin process or human-reviewed migration, because default text can
 * become an unintended commercial commitment.
 */

console.error(
  [
    "This document seed script is disabled.",
    "Do not inject document templates or default commercial clauses from local scripts.",
    "Create approved templates through the governed admin/template process instead.",
  ].join("\n"),
);

process.exit(1);

export {};
