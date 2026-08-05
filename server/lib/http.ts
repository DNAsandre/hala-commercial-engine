/**
 * SC-01 Wave 03 (W03-3) — small HTTP helpers for the clean server.
 *
 * Everything here exists to keep failures HONEST: a request either produces
 * the real thing, or it produces an explicit status + machine-readable code +
 * a human-readable message. There is no "empty but OK" and no silent default.
 */
import type { Request, Response } from "express";

export interface ErrorDetail {
  field: string;
  message: string;
}

/** Uniform error envelope. Mirrors the shape the clean api-client parses. */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: ErrorDetail[] | Record<string, unknown>,
): void {
  const body: Record<string, unknown> = { error: message, code };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

/**
 * Extract the caller's Supabase access token from `Authorization: Bearer ...`.
 * Returns null when absent or malformed — the caller turns that into a 401.
 */
export function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer[ \t]+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export type QueryParamResult =
  | { ok: true; value: string | undefined }
  | { ok: false; message: string };

const MAX_QUERY_VALUE_LENGTH = 300;

/**
 * Read a single optional string query parameter.
 *
 * Repeated params (`?a=1&a=2`) and nested objects are rejected rather than
 * silently coerced — a coerced filter would quietly return the wrong scope.
 */
export function readQueryParam(name: string, raw: unknown): QueryParamResult {
  if (raw === undefined) return { ok: true, value: undefined };
  if (Array.isArray(raw)) {
    return { ok: false, message: `Query parameter "${name}" was supplied more than once.` };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: `Query parameter "${name}" must be a string.` };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, message: `Query parameter "${name}" must not be empty.` };
  }
  if (value.length > MAX_QUERY_VALUE_LENGTH) {
    return {
      ok: false,
      message: `Query parameter "${name}" exceeds ${MAX_QUERY_VALUE_LENGTH} characters.`,
    };
  }
  return { ok: true, value };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `generated_documents.id` is a uuid; anything else is a client bug, not a 404. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** True when the value parses as a real timestamp (used for date_from/date_to). */
export function isParsableDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/** Split a storage path into (directory, object name) for existence checks. */
export function splitStoragePath(storagePath: string): { dir: string; name: string } {
  const lastSlash = storagePath.lastIndexOf("/");
  if (lastSlash === -1) return { dir: "", name: storagePath };
  return { dir: storagePath.slice(0, lastSlash), name: storagePath.slice(lastSlash + 1) };
}
