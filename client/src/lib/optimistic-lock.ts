/**
 * optimistic-lock.ts
 * ──────────────────
 * Implements optimistic concurrency control for Supabase updates.
 * 
 * Pattern: Every UPDATE adds `WHERE updated_at = $expected` to detect
 * concurrent modifications. If another user changed the row since we
 * last read it, the update returns 0 rows and we surface a conflict error.
 * 
 * Usage:
 *   // In supabase-data.ts:
 *   const result = await optimisticUpdate("customers", id, row, expectedUpdatedAt);
 *   
 *   // In supabase-sync.ts (fire-and-forget, no expectedUpdatedAt):
 *   // Sync functions set updated_at themselves, so they use a simpler pattern.
 */

import { supabase } from "./supabase";
import { handleSupabaseError } from "./supabase-error";
import { toast } from "sonner";

export class OptimisticLockError extends Error {
  constructor(table: string, id: string) {
    super(`Conflict: "${table}" row "${id}" was modified by another user. Please refresh and try again.`);
    this.name = "OptimisticLockError";
  }
}

/**
 * Perform an optimistic-locked update on a Supabase table.
 * 
 * @param table - The table name
 * @param id - The row ID
 * @param updates - The column updates (snake_case, including updated_at = now)
 * @param expectedUpdatedAt - The updated_at value we last read (ISO string).
 *   If provided, the update will include `WHERE updated_at = $expected`.
 *   If null/undefined, the update proceeds without the lock check (backward compat).
 * @returns The updated row, or null on error/conflict
 */
export async function optimisticUpdate<T = any>(
  table: string,
  id: string,
  updates: Record<string, any>,
  expectedUpdatedAt?: string | null
): Promise<T | null> {
  // Always set updated_at to now
  const now = new Date().toISOString();
  const row = { ...updates, updated_at: now };

  let query = supabase.from(table).update(row).eq("id", id);

  // Add optimistic lock condition if we have an expected timestamp
  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error, count } = await query.select().single();

  if (error) {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned"
    // This means the WHERE updated_at condition didn't match → conflict
    if (error.code === "PGRST116" && expectedUpdatedAt) {
      toast.error("Update conflict", {
        description: "This record was modified by another user. Please refresh and try again.",
        duration: 6000,
      });
      handleSupabaseError(`optimisticUpdate(${table})`, error, { entityId: id, silent: true });
      return null;
    }
    handleSupabaseError(`optimisticUpdate(${table})`, error, { entityId: id });
    return null;
  }

  return data as T;
}

/**
 * Perform an optimistic-locked update for sync operations (fire-and-forget).
 * These don't return data, just check for conflicts.
 * 
 * @param table - The table name
 * @param id - The row ID  
 * @param updates - The column updates (snake_case)
 * @param operation - Name of the sync operation for error reporting
 */
export async function optimisticSyncUpdate(
  table: string,
  id: string,
  updates: Record<string, any>,
  operation: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const row = { ...updates, updated_at: now };

  const { error } = await supabase.from(table).update(row).eq("id", id);

  if (error) {
    handleSupabaseError(operation, error, { entityId: id });
    return false;
  }
  return true;
}
