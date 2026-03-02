/**
 * useVariables.ts
 * ────────────────
 * React hooks for the Semantic Variables system.
 * Wraps supabase-variables.ts data layer with React state management.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  VariableDefinition,
  VariableSet,
  VariableSetItem,
  DocVariableOverride,
} from '@/lib/semantic-variables';
import {
  fetchVariableDefinitions,
  fetchVariableDefinitionByKey,
  fetchVariableSets,
  fetchVariableSetByDocType,
  fetchVariableSetItems,
  fetchDocVariableOverrides,
  upsertVariableDefinition,
  deleteVariableDefinition,
  upsertDocVariableOverride,
  deleteDocVariableOverride,
} from '@/lib/supabase-variables';

// ─── useVariableDefinitions ──────────────────────────────────
// Fetches all variable definitions, optionally filtered by namespace or doc type.

export function useVariableDefinitions(options?: {
  namespace?: string;
  docType?: string;
}) {
  const [definitions, setDefinitions] = useState<VariableDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let defs = await fetchVariableDefinitions();
      if (options?.namespace) {
        defs = defs.filter(d => d.namespace === options.namespace);
      }
      if (options?.docType) {
        defs = defs.filter(d =>
          d.allowed_in_doc_types.length === 0 ||
          d.allowed_in_doc_types.includes(options.docType!)
        );
      }
      setDefinitions(defs);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load variable definitions');
    } finally {
      setLoading(false);
    }
  }, [options?.namespace, options?.docType]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (def: Partial<VariableDefinition> & { id: string }) => {
    const result = await upsertVariableDefinition(def);
    if (result) await load();
    return result;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteVariableDefinition(id);
    if (ok) await load();
    return ok;
  }, [load]);

  return { definitions, loading, error, reload: load, save, remove };
}

// ─── useVariableDefinition (single by key) ───────────────────

export function useVariableDefinition(key: string | null) {
  const [definition, setDefinition] = useState<VariableDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!key) { setDefinition(null); setLoading(false); return; }
    setLoading(true);
    fetchVariableDefinitionByKey(key).then(d => {
      setDefinition(d);
      setLoading(false);
    });
  }, [key]);

  return { definition, loading };
}

// ─── useVariableSets ─────────────────────────────────────────

export function useVariableSets() {
  const [sets, setSets] = useState<VariableSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVariableSets().then(s => {
      setSets(s);
      setLoading(false);
    });
  }, []);

  return { sets, loading };
}

// ─── useVariableSetForDocType ────────────────────────────────

export function useVariableSetForDocType(docType: string | null) {
  const [variableSet, setVariableSet] = useState<VariableSet | null>(null);
  const [items, setItems] = useState<VariableSetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docType) { setVariableSet(null); setItems([]); setLoading(false); return; }
    setLoading(true);
    fetchVariableSetByDocType(docType).then(async vs => {
      setVariableSet(vs);
      if (vs) {
        const vsi = await fetchVariableSetItems(vs.id);
        setItems(vsi);
      }
      setLoading(false);
    });
  }, [docType]);

  return { variableSet, items, loading };
}

// ─── useDocVariableOverrides ─────────────────────────────────

export function useDocVariableOverrides(docInstanceId: string | null) {
  const [overrides, setOverrides] = useState<DocVariableOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!docInstanceId) { setOverrides([]); setLoading(false); return; }
    setLoading(true);
    const data = await fetchDocVariableOverrides(docInstanceId);
    setOverrides(data);
    setLoading(false);
  }, [docInstanceId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (
    override: Partial<DocVariableOverride> & { id: string; doc_instance_id: string; key: string }
  ) => {
    const result = await upsertDocVariableOverride(override);
    if (result) await load();
    return result;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteDocVariableOverride(id);
    if (ok) await load();
    return ok;
  }, [load]);

  return { overrides, loading, reload: load, save, remove };
}
