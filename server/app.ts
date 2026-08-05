/**
 * SC-01 Wave 03 (W03-3) — clean-server application assembly.
 *
 * Split out of index.ts so the HTTP surface can be exercised by tests without
 * binding the real port or requiring CLEAN_SERVER_PORT. index.ts keeps sole
 * ownership of environment validation and listening.
 *
 * This server MUST NOT proxy to, import from, or reference
 * hala-commercial-engine in any way.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { documentRoutes } from "./routes/documents";
import { sendError } from "./lib/http";

export function createApp() {
  const app = express();

  // CORS stays open so the clean frontend on 5300 can call this server on 5301.
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Unchanged from SC-01.1 — the health contract other tooling already polls.
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "hala-clean-commercial-engine",
      wave: "SC-01.1",
      note: "Document/PDF capabilities arrive in SC-01.4.",
    });
  });

  app.use("/api", documentRoutes);

  // Any other /api path is genuinely not implemented here. Say so explicitly
  // instead of returning Express's HTML 404, which a JSON caller would
  // misreport as a parse failure.
  app.use("/api", (req: Request, res: Response) => {
    sendError(
      res,
      501,
      "ROUTE_NOT_IMPLEMENTED",
      `The clean server does not implement ${req.method} ${req.baseUrl}${req.path}.`,
    );
  });

  // Malformed JSON bodies and unexpected throws become honest JSON errors.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const isBodyParseError =
      typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed";
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    if (isBodyParseError) {
      sendError(res, 400, "INVALID_JSON", `Request body is not valid JSON: ${message}`);
      return;
    }
    console.error("[clean-server] unhandled error:", err);
    sendError(res, 500, "INTERNAL_ERROR", message);
  });

  return app;
}
