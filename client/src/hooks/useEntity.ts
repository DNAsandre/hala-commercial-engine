/**
 * useEntity — Reusable Supabase entity hooks
 * Generic CRUD hooks for any Supabase table.
 * Designed for Wave 1+ persistence hardening.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { handleSupabaseError } from "@/lib/supabase-error";
import { optimisticUpdate } from "@/lib/optimistic-lock";

export interface UseEntityListResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseEntityByIdResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseCreateEntityResult<T> {
  create: (item: Partial<T>) => Promise<T | null>;
  loading: boolean;
  error: string | null;
}

export interface UseUpdateEntityResult<T> {
  update: (id: string, updates: Partial<T>, expectedUpdatedAt?: string) => Promise<T | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch all rows from a Supabase table, with optional filters.
 */
export function useEntityList<T>(
  table: string,
  options?: {
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    enabled?: boolean;
  }
): UseEntityListResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const filtersKey = JSON.stringify(options?.filters || {});
  const enabled = options?.enabled !== false;

  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from(table).select("*");
      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }
      if (options?.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
      }
      const { data: rows, error: err } = await query;
      if (err) throw err;
      if (mountedRef.current) {
        setData((rows as T[]) || []);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || `Failed to fetch ${table}`);
        handleSupabaseError(`useEntityList(${table})`, { message: String(err) }, { silent: true });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [table, filtersKey, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, refetch: load };
}

/**
 * Fetch a single row by ID from a Supabase table.
 */
export function useEntityById<T>(
  table: string,
  id: string | undefined | null,
  options?: { enabled?: boolean }
): UseEntityByIdResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const enabled = options?.enabled !== false && !!id;

  const load = useCallback(async () => {
    if (!enabled || !id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: row, error: err } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (err) throw err;
      if (mountedRef.current) {
        setData(row as T | null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || `Failed to fetch ${table}/${id}`);
        handleSupabaseError(`useEntityById(${table},${id})`, { message: String(err) }, { silent: true });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [table, id, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, refetch: load };
}

/**
 * Create a new row in a Supabase table.
 */
export function useCreateEntity<T>(table: string): UseCreateEntityResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (item: Partial<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(table)
        .insert(item as any)
        .select()
        .single();
      if (err) throw err;
      return data as T;
    } catch (err: any) {
      setError(err.message || `Failed to create in ${table}`);
      handleSupabaseError(`useCreateEntity(${table})`, { message: String(err) });
      return null;
    } finally {
      setLoading(false);
    }
  }, [table]);

  return { create, loading, error };
}

/**
 * Update a row by ID in a Supabase table.
 */
export function useUpdateEntity<T>(table: string): UseUpdateEntityResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (id: string, updates: Partial<T>, expectedUpdatedAt?: string): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await optimisticUpdate<T>(table, id, updates as Record<string, any>, expectedUpdatedAt);
      if (!result) {
        setError(`Failed to update ${table}/${id} — possible conflict`);
        return null;
      }
      return result;
    } catch (err: any) {
      setError(err.message || `Failed to update ${table}/${id}`);
      handleSupabaseError(`useUpdateEntity(${table},${id})`, { message: String(err) });
      return null;
    } finally {
      setLoading(false);
    }
  }, [table]);

  return { update, loading, error };
}
