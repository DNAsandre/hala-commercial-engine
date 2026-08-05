/**
 * SC-01 Wave 03 — clean runtime base configuration (Fable-owned).
 *
 * The standalone application talks to exactly one backend of its own:
 * the sibling clean server. The old Hala Express server (localhost:3001)
 * is never a permitted target. Endpoints the clean server does not
 * implement fail honestly; nothing is proxied.
 */
export const CLEAN_SERVER_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:5301";

/** Build an absolute clean-server URL from a server-relative path. */
export function cleanServerUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${CLEAN_SERVER_BASE}${p}`;
}
