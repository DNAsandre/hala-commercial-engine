/**
 * Variable Resolver — Sprint 2
 * Substitutes {{variable_name}} placeholders in block content.
 */

/** Replace all {{key}} placeholders with values from the variables map. */
export function substituteVariables(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
  });
}

/** Return every unique variable key found in content. */
export function extractVariableKeys(content: string): string[] {
  const matches = [...content.matchAll(/\{\{(\w+)\}\}/g)];
  return [...new Set(matches.map(m => m[1]))];
}

/** Build a variable context from common document fields. */
export function buildVariableContext(params: {
  customerName?: string;
  workspaceName?: string;
  refNumber?: string;
  date?: string;
  extra?: Record<string, string>;
}): Record<string, string> {
  return {
    customer_name: params.customerName ?? '',
    workspace_name: params.workspaceName ?? '',
    ref_number: params.refNumber ?? '',
    date: params.date ?? new Date().toISOString().split('T')[0],
    title: '',
    subtitle: '',
    recipient_name: params.customerName ?? '',
    company_name: 'Hala Supply Chain Services',
    hala_signatory: '',
    hala_title: '',
    client_signatory: params.customerName ?? '',
    client_title: '',
    first_party_name: 'Hala Supply Chain Services',
    second_party_name: params.customerName ?? '',
    facility_name: params.workspaceName ?? '',
    location: '',
    ...params.extra,
  };
}
