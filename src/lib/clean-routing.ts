export function cleanHref(path: string): string {
  if (path.startsWith("~/clean")) return path;
  if (path.startsWith("/clean")) return `~${path}`;
  if (path.startsWith("/")) return `~/clean${path}`;
  return `~/clean/${path}`;
}
