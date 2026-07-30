/**
 * template-variables.ts
 * ─────────────────────
 * FPS-005-12 — Template variable (placeholder) support.
 *
 * Templates may contain {{customer_name}}, {{reference_number}}, etc. When a
 * document is created from a template, known variables are replaced with the
 * provided values. UNKNOWN / missing variables are LEFT VISIBLE (never invented,
 * never stripped) so the user can see and fill them. Unresolved variables are
 * advisory only — they never block export.
 */

export interface TemplateVariableValues {
  customer_name?: string;
  reference_number?: string;
  document_date?: string;
  prepared_for?: string;
  prepared_by?: string;
  document_title?: string;
  proposal_title?: string;
  quotation_number?: string;
  validity_date?: string;
  [key: string]: string | undefined;
}

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Replace known {{variables}} in an HTML/text string with provided values.
 * Missing variables are left as-is.
 */
export function resolveTemplateVariables(
  content: string,
  values: TemplateVariableValues,
): string {
  if (!content) return content;
  return content.replace(VAR_RE, (match, name: string) => {
    const v = values[name];
    return v != null && v !== "" ? v : match;
  });
}

/** List the variable names still unresolved in a string (advisory only). */
export function findUnresolvedVariables(content: string): string[] {
  if (!content) return [];
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(content)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}
