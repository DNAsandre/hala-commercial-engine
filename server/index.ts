/**
 * SC-01.1 — clean-owned server (minimal scaffold).
 *
 * Per sprint §5, the clean server exists ONLY for capabilities that genuinely
 * require server execution (document upload/download/compilation, PDF
 * generation where the selected FinalStudio flow requires it). Those routes
 * are SC-01.4 scope. SC-01.1 establishes the boundary: an independent process,
 * its own port, zero knowledge of the old Hala server.
 *
 * This server MUST NOT proxy to, import from, or reference
 * hala-commercial-engine in any way.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import express from "express";
import cors from "cors";

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

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "hala-clean-commercial-engine",
    wave: "SC-01.1",
    note: "Document/PDF capabilities arrive in SC-01.4.",
  });
});

app.listen(PORT, () => {
  console.log(`[clean-server] listening on http://localhost:${PORT}`);
});
