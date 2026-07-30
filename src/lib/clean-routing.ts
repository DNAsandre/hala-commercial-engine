/**
 * SC-01.6 — root-based routing helper.
 *
 * The standalone application operates from its OWN root: there is no /clean
 * prefix and no wouter base. This helper normalizes any historical prototype
 * form ("~/clean/x", "/clean/x") to the root-based path so no navigation can
 * reference the old mount point.
 */
export function cleanHref(path: string): string {
  let p = path;
  if (p.startsWith("~")) p = p.slice(1);
  if (p.startsWith("/clean")) p = p.slice("/clean".length) || "/";
  return p.startsWith("/") ? p : `/${p}`;
}
