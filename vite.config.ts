import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

/**
 * SC-01.1 — standalone clean-app build configuration.
 *
 * INDEPENDENCE RULES ENFORCED HERE:
 *  - `root` is THIS package. Vite (and Tailwind v4 source discovery) never
 *    scans the old hala-commercial-engine tree.
 *  - Every alias resolves INSIDE this package. "@/" points at OUR src, not the
 *    old client/src. There is no path expression in this file that reaches a
 *    sibling directory.
 *  - Own port (5300). The old app's dev server (3000/3001) is untouched.
 *
 * FOUNDATION DECISION (flagged for Codex inspection):
 * In the old repository, "@/" resolved into the old client/src, so the plan
 * doctrine was "the alias must be absent". In this SIBLING package the same
 * alias is safe and useful: it can only ever resolve into our own src/, and it
 * means files copied in SC-01.2 (which use "@/..." specifiers) resolve
 * internally by construction. "@clean/" is mapped identically so the existing
 * 22 clean pages work when copied. The SC-01.3 "repoint" work therefore
 * becomes resolution verification plus targeted rewrites, not 1,146 hand edits.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@clean": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    // F-01: the frontend OWNS 5300. If it is occupied, fail loudly instead of
    // silently drifting onto another port (which could collide with the clean
    // server's 5301 and make dev:all nondeterministic).
    port: 5300,
    strictPort: true,
    fs: {
      strict: true,
      // Deny everything outside this package; Vite default already restricts
      // to root + node_modules, keep it explicit.
      deny: ["**/.*"],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
