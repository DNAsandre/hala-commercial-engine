/**
 * SC-01.1 — clean-owned server (process entry point).
 *
 * Per sprint §5, the clean server exists ONLY for capabilities that genuinely
 * require server execution (document download and document-truth verification).
 * SC-01.1 established the boundary: an independent process, its own port, zero
 * knowledge of the old Hala server. W03-3 adds the document runtime; the HTTP
 * surface itself lives in server/app.ts.
 *
 * This server MUST NOT proxy to, import from, or reference
 * hala-commercial-engine in any way.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { createApp } from "./app";

// F-02: load THIS package's .env explicitly (path-anchored, not cwd-dependent).
// Nothing is inherited from hala-commercial-engine.
loadEnv({ path: path.resolve(import.meta.dirname, "..", ".env") });

// No hard-coded port fallback: CLEAN_SERVER_PORT in .env is the single source
// of truth, and a missing/invalid value fails loudly instead of masking a
// broken environment load.
const rawPort = process.env.CLEAN_SERVER_PORT;
if (!rawPort) {
  throw new Error(
    "CLEAN_SERVER_PORT is not set. Define it in hala-clean-commercial-engine/.env (see .env.example)."
  );
}
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error(`CLEAN_SERVER_PORT is invalid: "${rawPort}"`);
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`[clean-server] listening on http://localhost:${PORT}`);
});
