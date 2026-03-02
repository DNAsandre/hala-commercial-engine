/**
 * supabase-variables.ts
 * ─────────────────────
 * Data layer for the Semantic Variables system.
 * Reads from Supabase when available; falls back to in-memory seed data
 * when PostgREST schema cache hasn't refreshed yet (PGRST205).
 *
 * Supabase table columns differ from the TypeScript interfaces defined in
 * semantic-variables.ts, so this layer maps between the two shapes.
 */

import { supabase } from './supabase';
import {
  variableDefinitions as seedDefinitions,
  variableSets as seedSets,
  variableSetItems as seedSetItems,
  docVariableOverrides as seedOverrides,
  type VariableDefinition,
  type VariableSet,
  type VariableSetItem,
  type DocVariableOverride,
} from './semantic-variables';

// ─── Cache flag ──────────────────────────────────────────────
let supabaseAvailable: boolean | null = null; // null = not yet tested

async function isSupabaseReady(): Promise<boolean> {
  if (supabaseAvailable !== null) return supabaseAvailable;
  const { error } = await supabase
    .from('variable_definitions')
    .select('id')
    .limit(1);
  supabaseAvailable = !error;
  // Re-check every 60s in case schema cache refreshes
  if (!supabaseAvailable) {
    setTimeout(() => { supabaseAvailable = null; }, 60_000);
  }
  return supabaseAvailable;
}

// ─── Row Mappers ─────────────────────────────────────────────
// Transform Supabase row shapes → TypeScript interface shapes

// Normalize Supabase source values → valid VariableSource
const SOURCE_MAP: Record<string, string> = {
  static: 'static', binding: 'binding', computed: 'computed',
  manual: 'static', system: 'static', // normalize non-standard values
};
// Normalize Supabase data_type values → valid VariableDataType
const DATA_TYPE_MAP: Record<string, string> = {
  text: 'text', number: 'number', currency: 'currency', date: 'date',
  percent: 'percent', boolean: 'boolean', image: 'image', table: 'table',
  percentage: 'percent', // normalize non-standard values
};

function mapDefinitionRow(row: Record<string, unknown>): VariableDefinition {
  const rawSource = (row.source as string) || 'static';
  const rawDataType = (row.data_type as string) || 'text';
  return {
    id: row.id as string,
    key: row.key as string,
    label: row.label as string,
    scope: (row.scope as string) || 'global',
    namespace: (row.namespace as string) || 'system',
    data_type: (DATA_TYPE_MAP[rawDataType] || 'text'),
    format: (row.format as string) || null,
    binding_path: (row.key as string) || '',
    default_value_json: row.default_value ?? row.fallback ?? null,
    allowed_in_doc_types: [],
    created_by: 'system',
    created_at: (row.created_at as string) || new Date().toISOString(),
    description: (row.description as string) || '',
    source: (SOURCE_MAP[rawSource] || 'static'),
    ...(row.is_required !== undefined ? { is_required: row.is_required } : {}),
    ...(row.fallback ? { fallback: row.fallback } : {}),
  } as unknown as VariableDefinition;
}

function mapSetRow(row: Record<string, unknown>): VariableSet {
  return {
    id: row.id as string,
    name: row.name as string,
    doc_type: (row.scope as string) || 'general',
    template_version_id: null,
    variable_ids: [],
    created_at: (row.created_at as string) || new Date().toISOString(),
    // Carry through extra fields
    ...(row.description ? { description: row.description } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
  } as VariableSet;
}

function mapSetItemRow(row: Record<string, unknown>): VariableSetItem {
  return {
    id: row.id as string,
    variable_set_id: (row.set_id as string) || (row.variable_set_id as string) || '',
    variable_definition_id: (row.variable_id as string) || (row.variable_definition_id as string) || '',
    required: false,
    fallback_mode: 'use_default' as const,
    // Extra
    ...(row.override_value !== undefined ? { override_value: row.override_value } : {}),
  } as unknown as VariableSetItem;
}

function mapOverrideRow(row: Record<string, unknown>): DocVariableOverride {
  return {
    id: row.id as string,
    doc_instance_id: (row.doc_instance_id as string) || '',
    key: (row.variable_id as string) || (row.key as string) || '',
    value_json: row.override_value ?? row.value_json ?? null,
    created_by: (row.created_by as string) || 'system',
    created_at: (row.created_at as string) || new Date().toISOString(),
  } as DocVariableOverride;
}

// ─── Variable Definitions ────────────────────────────────────

export async function fetchVariableDefinitions(): Promise<VariableDefinition[]> {
  if (await isSupabaseReady()) {
    const { data, error } = await supabase
      .from('variable_definitions')
      .select('*')
      .order('namespace')
      .order('key');
    if (!error && data) return data.map(r => mapDefinitionRow(r as Record<string, unknown>));
  }
  return [...seedDefinitions];
}

export async function fetchVariableDefinitionById(id: string): Promise<VariableDefinition | null> {
  if (await isSupabaseReady()) {
    const { data, error } = await supabase
      .from('variable_definitions')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) return mapDefinitionRow(data as Record<string, unknown>);
  }
  return seedDefinitions.find(d => d.id === id) ?? null;
}

export async function fetchVariableDefinitionByKey(key: string): Promise<VariableDefinition | null> {
  if (await isSupabaseReady()) {
    const { data, error } = await supabase
      .from('variable_definitions')
      .select('*')
      .eq('key', key)
      .single();
    if (!error && data) return mapDefinitionRow(data as Record<string, unknown>);
  }
  return seedDefinitions.find(d => d.key === key) ?? null;
}

export async function upsertVariableDefinition(def: Partial<VariableDefinition> & { id: string }): Promise<VariableDefinition | null> {
  if (await isSupabaseReady()) {
    // Map TS interface fields → Supabase column names
    const row: Record<string, unknown> = {
      id: def.id,
      key: def.key,
      label: def.label,
      scope: def.scope,
      namespace: def.namespace,
      data_type: def.data_type,
      format: (def as Record<string, unknown>).format || null,
      default_value: def.default_value_json ?? null,
      fallback: (def as Record<string, unknown>).fallback ?? null,
      description: def.description || '',
      source: (def as Record<string, unknown>).source || 'manual',
      is_required: (def as Record<string, unknown>).is_required ?? false,
    };
    // Remove undefined values
    Object.keys(row).forEach(k => { if (row[k] === undefined) delete row[k]; });
    const { data, error } = await supabase
      .from('variable_definitions')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return mapDefinitionRow(data as Record<string, unknown>);
  }
  // Fallback: update in-memory
  const idx = seedDefinitions.findIndex(d => d.id === def.id);
  if (idx >= 0) {
    Object.assign(seedDefinitions[idx], def);
    return seedDefinitions[idx];
  }
  const newDef = def as VariableDefinition;
  seedDefinitions.push(newDef);
  return newDef;
}

export async function deleteVariableDefinition(id: string): Promise<boolean> {
  if (await isSupabaseReady()) {
    const { error } = await supabase
      .from('variable_definitions')
      .delete()
      .eq('id', id);
    return !error;
  }
  const idx = seedDefinitions.findIndex(d => d.id === id);
  if (idx >= 0) { seedDefinitions.splice(idx, 1); return true; }
  return false;
}

// ─── Variable Sets ───────────────────────────────────────────

export async function fetchVariableSets(): Promise<VariableSet[]> {
  if (await isSupabaseReady()) {
    const { data, error } = await supabase
      .from('variable_sets')
      .select('*')
      .order('name');
    if (!error && data) return data.map(r => mapSetRow(r as Record<string, unknown>));
  }
  return [...seedSets];
}

export async function fetchVariableSetByDocType(docType: string): Promise<VariableSet | null> {
  if (await isSupabaseReady()) {
    // Supabase table uses "scope" instead of "doc_type"
    const { data, error } = await supabase
      .from('variable_sets')
      .select('*')
      .eq('scope', docType)
      .limit(1)
      .maybeSingle();
    if (!error && data) return mapSetRow(data as Record<string, unknown>);
  }
  return seedSets.find(s => s.doc_type === docType) ?? null;
}

// ─── Variable Set Items ──────────────────────────────────────

export async function fetchVariableSetItems(variableSetId: string): Promise<VariableSetItem[]> {
  if (await isSupabaseReady()) {
    const { data, error } = await supabase
      .from('variable_set_items')
      .select('*')
      .eq('set_id', variableSetId);
    if (!error && data) return data.map(r => mapSetItemRow(r as Record<string, unknown>));
  }
  return seedSetItems.filter(i => i.variable_set_id === variableSetId);
}

// ─── Doc Variable Overrides ──────────────────────────────────

export async function fetchDocVariableOverrides(docInstanceId: string | null): Promise<DocVariableOverride[]> {
  if (await isSupabaseReady()) {
    let query = supabase
      .from('doc_variable_overrides')
      .select('*')
      .order('created_at', { ascending: false });
    if (docInstanceId) {
      query = query.eq('doc_instance_id', docInstanceId);
    }
    const { data, error } = await query;
    if (!error && data) return data.map(r => mapOverrideRow(r as Record<string, unknown>));
  }
  if (docInstanceId) {
    return seedOverrides.filter(o => o.doc_instance_id === docInstanceId);
  }
  return [...seedOverrides];
}

export async function upsertDocVariableOverride(
  override: Partial<DocVariableOverride> & { id: string; doc_instance_id: string; key: string }
): Promise<DocVariableOverride | null> {
  if (await isSupabaseReady()) {
    // Map TS interface fields → Supabase column names
    const row: Record<string, unknown> = {
      id: override.id,
      doc_instance_id: override.doc_instance_id,
      variable_id: override.key,
      override_value: override.value_json ?? null,
    };
    const { data, error } = await supabase
      .from('doc_variable_overrides')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    if (!error && data) return mapOverrideRow(data as Record<string, unknown>);
  }
  // Fallback: update in-memory
  const idx = seedOverrides.findIndex(o => o.id === override.id);
  if (idx >= 0) {
    Object.assign(seedOverrides[idx], override);
    return seedOverrides[idx];
  }
  const newOverride = override as DocVariableOverride;
  seedOverrides.push(newOverride);
  return newOverride;
}

export async function deleteDocVariableOverride(id: string): Promise<boolean> {
  if (await isSupabaseReady()) {
    const { error } = await supabase
      .from('doc_variable_overrides')
      .delete()
      .eq('id', id);
    return !error;
  }
  const idx = seedOverrides.findIndex(o => o.id === id);
  if (idx >= 0) { seedOverrides.splice(idx, 1); return true; }
  return false;
}
