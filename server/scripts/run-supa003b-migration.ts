/**
 * DISABLED: automatic SUPA-003B migration runner.
 *
 * Commercial OS database doctrine requires SQL to be inspected and run by a
 * human in Supabase. Local scripts must not execute commercial schema changes
 * through a service-role key.
 */

console.error(
  [
    "This automatic migration runner is disabled.",
    "Do not execute commercial database migrations from local scripts.",
    "Generate SQL for human review and manual Supabase execution only.",
  ].join("\n"),
);

process.exit(1);

export {};
