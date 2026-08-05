/**
 * document-runtime.ts — SC-01 Wave 03 (W03-4)
 *
 * The clean application's ONLY client contract for generated documents.
 *
 * TWO TRANSPORTS, BY ARCHITECT ALLOCATION (not an inconsistency):
 *  - Row 69 (workspace documents list, WorkspaceDocumentSection) is allocated
 *    to DIRECT SUPABASE: it reads the `generated_documents` table itself,
 *    modelled on the established `document-vault.ts` scoping semantics.
 *  - Rows 26-32 (proposal stage document list, download, generate-pdf) are
 *    allocated to the CLEAN SERVER, because they need server execution
 *    (storage signing, PDF production).
 *
 * INDEPENDENCE
 *  - Every server request is an absolute clean-server URL built from
 *    `cleanServerUrl()`. There is no relative `/api/...` fetch (which would hit
 *    the frontend origin on :5300 and return the SPA shell), no
 *    localhost:3001, and no proxy.
 *
 * HONESTY
 *  - A read that cannot be made, is refused, or comes back in a shape this
 *    module does not recognise throws `DocumentRuntimeError`. It is NEVER
 *    converted into an empty list, a fake record or a fake success.
 *  - "The source returned zero rows" is the ONLY thing that produces an empty
 *    list — a Supabase error never renders as "no documents".
 *  - Nothing here invents documents, counts, statuses, file sizes or URLs.
 *    Response shapes are normalised (bare array vs `{ data: [...] }`), never
 *    fabricated.
 */
import { cleanServerUrl } from "@/lib/runtime-config";
import { supabase } from "@/lib/supabase";

/** The established document record table (same table document-vault.ts reads). */
const DOCUMENT_TABLE = "generated_documents";

/**
 * A `generated_documents` row exactly as the clean server returned it. The
 * value type is intentionally permissive: this module does not reshape,
 * rename or default any field of a server row.
 */
export type DocumentRecord = Record<string, any>;

/** Every failure this module can produce, so callers can surface it verbatim. */
export class DocumentRuntimeError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "DocumentRuntimeError";
    this.status = status;
  }
}

export type DocumentDownload =
  /** The server handed back a location (e.g. a signed storage URL). */
  | { kind: "url"; url: string; record: DocumentRecord | null }
  /** The server streamed the stored bytes. */
  | { kind: "file"; blob: Blob; fileName: string };

export interface GenerateDocumentPdfInput {
  workspace_id: string;
  document_type: "quote" | "proposal";
  source_id: string;
  source_version?: number;
}

export interface GenerateDocumentPdfResult {
  /** The persisted document record the server confirmed. */
  record: DocumentRecord;
  /**
   * True only when the confirmed record actually points at stored bytes.
   * When the server limits itself to creating the record, this is false and
   * the caller must not claim a PDF was produced.
   */
  fileGenerated: boolean;
  /** A message the server chose to send back (e.g. why no bytes were made). */
  notice: string | null;
}

// ─── internals ───────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is DocumentRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const found = text(value);
    if (found) return found;
  }
  return "";
}

function isJsonResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
}

async function readFailureMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (isRecord(parsed)) {
        const message = firstText(parsed.error, parsed.message);
        if (message) return message;
      }
    } catch {
      // Not JSON — fall through to the raw body below.
    }
    const trimmed = body.trim();
    // Do not echo an HTML error page back at the user as if it were a message.
    if (trimmed && !trimmed.startsWith("<")) return trimmed.slice(0, 300);
  }
  return `Clean server responded ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`;
}

/** Issue a clean-server request; network failure and non-2xx both throw. */
async function requestCleanServer(path: string, init?: RequestInit): Promise<Response> {
  const url = cleanServerUrl(path);

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    const detail = cause instanceof Error && cause.message ? ` (${cause.message})` : "";
    throw new DocumentRuntimeError(`Clean document server not reachable at ${url}${detail}`);
  }

  if (!response.ok) {
    throw new DocumentRuntimeError(await readFailureMessage(response), response.status);
  }
  return response;
}

/**
 * Accept either a bare array or `{ data: [...] }`. Anything else is a contract
 * mismatch and is reported as an error rather than silently becoming empty.
 */
function normalizeDocumentRows(payload: unknown, url: string): DocumentRecord[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : null;

  if (!rows) {
    throw new DocumentRuntimeError(
      `Clean server returned an unrecognised document list shape from ${url}.`,
    );
  }
  if (!rows.every(isRecord)) {
    throw new DocumentRuntimeError(
      `Clean server returned a document list containing non-document entries from ${url}.`,
    );
  }
  return rows as DocumentRecord[];
}

// ─── list (row 69 — DIRECT SUPABASE) ─────────────────────────────────────────

/**
 * Workspace document list, read straight from `generated_documents`.
 *
 * Scoping mirrors the established `document-vault.ts` contract
 * (`getDocumentsByWorkspace`):
 *  - matched on the `workspace_id` column,
 *  - rows whose `source_type` is "tender" are NOT workspace documents (the
 *    vault maps their workspaceId to null),
 *  - archived rows are excluded,
 *  - newest first by `generated_at`.
 *
 * Rows are returned exactly as stored, so `WorkspaceDocumentSection` renders
 * the same columns it always did. An empty array means the table genuinely
 * holds zero matching rows; a query error throws and must be shown.
 */
export async function listWorkspaceDocuments(workspaceId: string): Promise<DocumentRecord[]> {
  const scopeId = text(workspaceId);
  if (!scopeId) {
    throw new DocumentRuntimeError("Cannot load documents without a workspace id.");
  }

  const { data, error } = await supabase
    .from(DOCUMENT_TABLE)
    .select("*")
    .eq("workspace_id", scopeId)
    .order("generated_at", { ascending: false });

  if (error) {
    throw new DocumentRuntimeError(
      error.message || "Documents could not be read from generated_documents.",
    );
  }
  if (!Array.isArray(data)) {
    // No error AND no result set: ambiguous, so it is reported rather than
    // silently rendered as "no documents".
    throw new DocumentRuntimeError("generated_documents returned no result set.");
  }

  return (data as DocumentRecord[]).filter(
    row => isRecord(row) && row.source_type !== "tender" && row.status !== "archived",
  );
}

// ─── list (row 27 — CLEAN SERVER) ────────────────────────────────────────────

/**
 * GET /api/documents?workspace_id=...
 *
 * Returns the rows the clean server holds for the scope. An empty array means
 * the server genuinely returned zero rows; every other outcome throws.
 */
export async function listScopeDocumentsFromCleanServer(
  workspaceId: string,
): Promise<DocumentRecord[]> {
  const scopeId = text(workspaceId);
  if (!scopeId) {
    throw new DocumentRuntimeError("Cannot load documents without a workspace id.");
  }

  const path = `/api/documents?workspace_id=${encodeURIComponent(scopeId)}`;
  const url = cleanServerUrl(path);
  const response = await requestCleanServer(path, { headers: { Accept: "application/json" } });

  if (!isJsonResponse(response)) {
    throw new DocumentRuntimeError(
      `Clean server did not return JSON for the document list at ${url}.`,
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DocumentRuntimeError(
      `Clean server returned an unreadable document list from ${url}.`,
      response.status,
    );
  }

  return normalizeDocumentRows(payload, url);
}

// ─── download ────────────────────────────────────────────────────────────────

function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, "")) || fallback;
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

/**
 * GET /api/documents/download/:id
 *
 * Tolerates both server styles: a JSON envelope carrying a (signed) URL, or
 * the stored bytes themselves. Never returns a placeholder.
 */
export async function fetchDocumentDownload(documentId: string): Promise<DocumentDownload> {
  const id = text(documentId);
  if (!id) throw new DocumentRuntimeError("Cannot download a document without an id.");

  const response = await requestCleanServer(`/api/documents/download/${encodeURIComponent(id)}`);

  if (isJsonResponse(response)) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DocumentRuntimeError("Clean server returned an unreadable download response.");
    }
    const envelope = isRecord(payload) ? payload : null;
    const record = envelope && isRecord(envelope.data) ? envelope.data : envelope;
    const url = firstText(
      record?.download_url,
      record?.signed_url,
      record?.signedUrl,
      record?.url,
      envelope?.download_url,
      envelope?.url,
    );
    if (!url) {
      throw new DocumentRuntimeError(
        "Clean server did not return a download location for this document.",
      );
    }
    return { kind: "url", url, record: record ?? null };
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new DocumentRuntimeError("Clean server returned an empty file for this document.");
  }
  return {
    kind: "file",
    blob,
    fileName: fileNameFromDisposition(response.headers.get("content-disposition"), `document-${id}`),
  };
}

/** Hand the real file (or its location) to the user. Browser-only. */
export function deliverDocumentDownload(download: DocumentDownload): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new DocumentRuntimeError("Downloads are only available in the browser.");
  }

  if (download.kind === "url") {
    const opened = window.open(download.url, "_blank", "noopener,noreferrer");
    if (!opened) {
      throw new DocumentRuntimeError(
        "The browser blocked the download window. Allow pop-ups for this site and try again.",
      );
    }
    return;
  }

  const objectUrl = URL.createObjectURL(download.blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = download.fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

/** Fetch + deliver. Any failure throws and must be shown to the user. */
export async function downloadDocumentToUser(documentId: string): Promise<void> {
  deliverDocumentDownload(await fetchDocumentDownload(documentId));
}

// ─── generate ────────────────────────────────────────────────────────────────

function hasStoredFile(record: DocumentRecord): boolean {
  if (text(record.storage_path) || text(record.file_url) || text(record.download_url)) return true;
  return typeof record.file_size === "number" && record.file_size > 0;
}

/**
 * POST /api/documents/generate-pdf
 *
 * Resolves ONLY when the server confirms a persisted document record. Whether
 * the PDF bytes themselves were produced is reported separately in
 * `fileGenerated` so callers never claim a file that does not exist.
 */
export async function generateDocumentPdf(
  input: GenerateDocumentPdfInput,
): Promise<GenerateDocumentPdfResult> {
  const response = await requestCleanServer("/api/documents/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });

  if (!isJsonResponse(response)) {
    throw new DocumentRuntimeError(
      "Clean server did not confirm a persisted document (non-JSON response).",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DocumentRuntimeError(
      "Clean server returned an unreadable generate-pdf response.",
      response.status,
    );
  }

  const envelope = isRecord(payload) ? payload : null;
  const record = envelope && isRecord(envelope.data) ? envelope.data : envelope;
  if (!record || !text(record.id)) {
    throw new DocumentRuntimeError(
      "Clean server did not confirm a persisted document record.",
      response.status,
    );
  }

  return {
    record,
    fileGenerated: hasStoredFile(record),
    notice:
      firstText(envelope?.message, envelope?.notice, envelope?.warning, record.notice, record.warning) ||
      null,
  };
}
