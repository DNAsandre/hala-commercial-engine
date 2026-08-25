/**
 * SC-01 Wave 03 (W03-3) — clean-server document runtime.
 *
 * Implements ONLY the three published rows that have live callers:
 *   row 26/27  GET  /api/documents                 — scoped vault listing
 *   row 30     GET  /api/documents/download/:id    — real stored file
 *   row 31     POST /api/documents/generate-pdf    — source-truth verification
 *
 * ESTABLISHED CONTRACT (verified, not invented):
 *   - metadata table : generated_documents
 *       migrations/sprint6_generated_documents.sql (+ sprint6b / sprint7)
 *       columns: id, workspace_id, customer_id, document_type, source_type,
 *                source_id, source_version, file_name, storage_path, file_size,
 *                mime_type, language, status, generated_by, generated_at,
 *                version_number, checksum, notes, supersedes_document_id,
 *                last_downloaded_at, created_at
 *   - storage bucket : "documents" (private)
 *       the clean client already uploads straight into it and inserts the row
 *       itself (src/lib/document-vault.ts) — this server adds no second writer.
 *   No column is added, renamed or invented here.
 *
 * INDEPENDENCE: nothing in this file imports from, proxies to, or references
 * hala-commercial-engine. Supabase is reached directly with the anon key plus
 * the caller's own access token.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createUserScopedClient,
  DOCUMENT_BUCKET,
  DOCUMENT_TABLE,
  SupabaseConfigError,
} from "../lib/supabase";
import {
  isParsableDate,
  isUuid,
  readBearerToken,
  readQueryParam,
  sendError,
  splitStoragePath,
  type ErrorDetail,
} from "../lib/http";

export const documentRoutes = Router();

/** Matches the established vault listing cap. */
const LIST_LIMIT = 200;

/** Short-lived signed URL TTL for downloads (seconds). */
const SIGNED_URL_TTL_SECONDS = 3600;

/** Equality filters accepted by GET /api/documents, all real table columns. */
const EQUALITY_FILTERS = [
  "workspace_id",
  "customer_id",
  "document_type",
  "source_type",
  "source_id",
  "status",
  "language",
  "generated_by",
] as const;

const ALL_QUERY_KEYS = [...EQUALITY_FILTERS, "date_from", "date_to", "search"] as const;

/**
 * Source-of-truth lookup for POST /api/documents/generate-pdf.
 * These are the same source records the established route resolved:
 *   quote    -> quotes.id
 *   proposal -> commercial_tickets.id where ticket_type = 'proposal'
 */
const SOURCE_LOOKUP = {
  quote: { table: "quotes", typeColumn: null },
  proposal: { table: "commercial_tickets", typeColumn: "ticket_type" as const },
} as const;

type SourceRow = Record<string, unknown>;

// ─── auth ────────────────────────────────────────────────────
// The anon key carries no identity and `generated_documents` grants SELECT to
// the `authenticated` role only. Without a caller token the query would return
// an empty list, which would be an "empty but OK" lie. So: explicit 401.

interface AuthorizedContext {
  supabase: ReturnType<typeof createUserScopedClient>;
}

function authorize(req: Request, res: Response): AuthorizedContext | null {
  const token = readBearerToken(req);
  if (!token) {
    sendError(
      res,
      401,
      "AUTH_REQUIRED",
      "A Supabase access token is required (Authorization: Bearer <token>). " +
        "Document records are protected by row-level security and cannot be read anonymously.",
    );
    return null;
  }
  try {
    return { supabase: createUserScopedClient(token) };
  } catch (err) {
    if (err instanceof SupabaseConfigError) {
      sendError(res, 500, "CONFIG_ERROR", err.message);
      return null;
    }
    throw err;
  }
}

// ─── row 26/27 — GET /api/documents ──────────────────────────
// Live caller: src/components/proposal-workspace/ProposalStageWorkbench.tsx
//   via listScopeDocumentsFromCleanServer() in src/lib/document-runtime.ts,
//   which builds an absolute URL from CLEAN_SERVER_BASE and attaches the
//   caller's bearer token. (The old api-client was deleted in Wave 03.)

documentRoutes.get("/documents", async (req, res, next) => {
  try {
    const ctx = authorize(req, res);
    if (!ctx) return;

    const params: Partial<Record<(typeof ALL_QUERY_KEYS)[number], string>> = {};
    for (const key of ALL_QUERY_KEYS) {
      const parsed = readQueryParam(key, req.query[key]);
      if (!parsed.ok) {
        sendError(res, 400, "INVALID_QUERY", parsed.message);
        return;
      }
      if (parsed.value !== undefined) params[key] = parsed.value;
    }

    // A scope is mandatory. An unscoped dump of every customer's documents is
    // not a capability any caller has, and silently returning one would be a
    // data-exposure bug rather than a feature.
    if (!params.workspace_id && !params.customer_id) {
      sendError(
        res,
        400,
        "SCOPE_REQUIRED",
        "A scope is required: supply workspace_id (primary) and/or customer_id.",
      );
      return;
    }

    for (const key of ["date_from", "date_to"] as const) {
      const value = params[key];
      if (value !== undefined && !isParsableDate(value)) {
        sendError(res, 400, "INVALID_QUERY", `Query parameter "${key}" is not a valid date.`);
        return;
      }
    }

    let query = ctx.supabase.from(DOCUMENT_TABLE).select("*");
    for (const column of EQUALITY_FILTERS) {
      const value = params[column];
      if (value !== undefined) query = query.eq(column, value);
    }
    if (params.date_from) query = query.gte("generated_at", params.date_from);
    if (params.date_to) query = query.lte("generated_at", params.date_to);
    if (params.search) query = query.ilike("file_name", `%${params.search}%`);

    const { data, error } = await query
      .order("generated_at", { ascending: false })
      .limit(LIST_LIMIT);

    if (error) {
      sendError(res, 500, "DB_ERROR", `Failed to read ${DOCUMENT_TABLE}: ${error.message}`);
      return;
    }
    if (!Array.isArray(data)) {
      // No error and no result set means the driver gave us nothing usable.
      // Reporting that as an empty vault would be a fabricated success.
      sendError(
        res,
        500,
        "DB_ERROR",
        `Query against ${DOCUMENT_TABLE} returned no result set.`,
      );
      return;
    }

    res.json({
      data,
      count: data.length,
      limit: LIST_LIMIT,
      // Honest disclosure: at the cap the list is partial, not complete.
      truncated: data.length === LIST_LIMIT,
    });
  } catch (err) {
    next(err);
  }
});

// ─── row 30 — GET /api/documents/download/:id ────────────────
// Live caller: src/components/WorkspaceDocumentSection.tsx
//   const res = await api.documents.download(docId);
//   if (res.data?.download_url) window.open(res.data.download_url, "_blank");
//
// DELIVERY CHOICE: short-lived SIGNED URL (not a proxied byte stream).
//  - It is what the established contract and the live caller consume.
//  - It hands back the genuine stored object from the private bucket; no bytes
//    are re-encoded, re-rendered or copied, and no temp file is written.
//  - The object's existence is verified BEFORE signing, so a missing object is
//    a 404 here instead of a broken link the user discovers later.

documentRoutes.get("/documents/download/:id", async (req, res, next) => {
  try {
    const ctx = authorize(req, res);
    if (!ctx) return;

    const id = req.params.id;
    if (!isUuid(id)) {
      sendError(res, 400, "INVALID_ID", `"${id}" is not a valid document id (expected a uuid).`);
      return;
    }

    const { data: doc, error } = await ctx.supabase
      .from(DOCUMENT_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      sendError(res, 500, "DB_ERROR", `Failed to read ${DOCUMENT_TABLE}: ${error.message}`);
      return;
    }
    if (!doc) {
      sendError(res, 404, "DOCUMENT_NOT_FOUND", `No document record with id "${id}".`);
      return;
    }

    const storagePath = typeof doc.storage_path === "string" ? doc.storage_path.trim() : "";
    if (!storagePath) {
      sendError(
        res,
        404,
        "NO_STORED_FILE",
        `Document "${id}" has no storage_path — there is no stored file to download.`,
      );
      return;
    }

    // Verify the object really exists before handing out a signed URL.
    const { dir, name } = splitStoragePath(storagePath);
    const { data: listing, error: listError } = await ctx.supabase.storage
      .from(DOCUMENT_BUCKET)
      .list(dir, { search: name, limit: 100 });

    if (listError) {
      sendError(
        res,
        500,
        "STORAGE_ERROR",
        `Failed to inspect storage bucket "${DOCUMENT_BUCKET}": ${listError.message}`,
      );
      return;
    }
    const objectExists = Array.isArray(listing) && listing.some((entry) => entry?.name === name);
    if (!objectExists) {
      sendError(
        res,
        404,
        "STORAGE_OBJECT_MISSING",
        `Document record "${id}" exists but its file is not in the "${DOCUMENT_BUCKET}" bucket ` +
          `at "${storagePath}".`,
      );
      return;
    }

    const { data: signed, error: signError } = await ctx.supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      sendError(
        res,
        500,
        "STORAGE_ERROR",
        `Failed to sign a download URL for "${storagePath}": ${signError?.message ?? "no URL returned"}`,
      );
      return;
    }

    // Best-effort download tracking; never blocks or fakes the download result.
    const { error: touchError } = await ctx.supabase
      .from(DOCUMENT_TABLE)
      .update({ last_downloaded_at: new Date().toISOString() })
      .eq("id", id);
    if (touchError) {
      console.warn(`[clean-server] last_downloaded_at update failed for ${id}: ${touchError.message}`);
    }

    res.json({
      data: {
        ...doc,
        download_url: signed.signedUrl,
        download_url_expires_in: SIGNED_URL_TTL_SECONDS,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── row 31 — POST /api/documents/generate-pdf ───────────────
// Live caller: src/components/WorkspaceDocumentSection.tsx (handleGenerate).
//
// DOCUMENT-TRUTH RULING (this is deliberate, not an omission):
// The proven fidelity path for a Hala document is the CLIENT-side FinalStudio
// export. src/lib/server-pdf.ts records the standing inspection finding: the
// old server route rendered quote/proposal PDFs with PDFKit from raw source
// rows, which produces a DIFFERENT document than the one the user edited, and
// server export is feature-flagged OFF for exactly that reason.
//
// So this route does NOT render bytes. It also does NOT insert a
// generated_documents row: `storage_path` is NOT NULL and every consumer treats
// a row as a finished, downloadable document, so writing a row with no object
// behind it would fabricate a completed document — the one thing this route is
// forbidden to do.
//
// What it DOES do honestly: authenticate, validate, and verify the selected
// source truth really exists (and matches the requested workspace/version),
// then return an explicit 501 naming the verified source and stating that no
// record was created.

const generatePdfSchema = z.object({
  workspace_id: z.string().trim().min(1).max(200),
  document_type: z.enum(["quote", "proposal"]),
  source_id: z.string().trim().min(1).max(200),
  source_version: z.number().int().positive().optional(),
  language: z.string().trim().min(1).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

function readSourceVersion(row: SourceRow): number | null {
  const candidate = row.version_number ?? row.version;
  return typeof candidate === "number" ? candidate : null;
}

documentRoutes.post("/documents/generate-pdf", async (req, res, next) => {
  try {
    const ctx = authorize(req, res);
    if (!ctx) return;

    const parsed = generatePdfSchema.safeParse(req.body);
    if (!parsed.success) {
      const details: ErrorDetail[] = parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(body)",
        message: issue.message,
      }));
      sendError(res, 400, "INVALID_BODY", "Invalid generate-pdf request body.", details);
      return;
    }
    const body = parsed.data;
    const lookup = SOURCE_LOOKUP[body.document_type];

    let sourceQuery = ctx.supabase.from(lookup.table).select("*").eq("id", body.source_id);
    if (lookup.typeColumn) sourceQuery = sourceQuery.eq(lookup.typeColumn, body.document_type);

    const { data: source, error: sourceError } = await sourceQuery.maybeSingle();

    if (sourceError) {
      sendError(
        res,
        500,
        "DB_ERROR",
        `Failed to read source ${body.document_type} from ${lookup.table}: ${sourceError.message}`,
      );
      return;
    }
    if (!source) {
      sendError(
        res,
        404,
        "SOURCE_NOT_FOUND",
        `No ${body.document_type} with id "${body.source_id}" in ${lookup.table}. ` +
          "Nothing was generated and no document record was created.",
      );
      return;
    }

    const sourceRow = source as SourceRow;

    // Scope check — only when the source actually carries a workspace_id.
    const sourceWorkspaceId = sourceRow.workspace_id;
    if (typeof sourceWorkspaceId === "string" && sourceWorkspaceId !== body.workspace_id) {
      sendError(
        res,
        409,
        "SOURCE_SCOPE_MISMATCH",
        `The ${body.document_type} "${body.source_id}" belongs to workspace ` +
          `"${sourceWorkspaceId}", not "${body.workspace_id}".`,
      );
      return;
    }

    const actualVersion = readSourceVersion(sourceRow);
    if (body.source_version !== undefined && actualVersion !== null && actualVersion !== body.source_version) {
      sendError(
        res,
        409,
        "SOURCE_VERSION_MISMATCH",
        `Requested version ${body.source_version} of ${body.document_type} "${body.source_id}", ` +
          `but the stored source is version ${actualVersion}.`,
      );
      return;
    }

    sendError(
      res,
      501,
      "PDF_RENDER_UNAVAILABLE",
      "Server-side PDF byte generation is not available in the clean application. " +
        "The proven fidelity path is the client-side FinalStudio export; rendering here " +
        "would produce a different document than the one the user edited. No document " +
        "record was created, because a generated_documents row without a stored file " +
        "would represent a completed document that does not exist.",
      {
        record_created: false,
        bytes_generated: false,
        source_verified: {
          document_type: body.document_type,
          source_table: lookup.table,
          source_id: body.source_id,
          source_version: actualVersion,
          workspace_id: body.workspace_id,
        },
        // PADW T06d (PDS-25): the previous text claimed the client persists
        // exports via the documents vault — it does not (exports go to the
        // browser's Downloads only). Say what is actually true.
        use_instead:
          "Export the document from Final Pack Studio; the file is saved by the browser (Downloads). " +
          "Exports are not yet recorded in the documents vault.",
      },
    );
  } catch (err) {
    next(err);
  }
});
