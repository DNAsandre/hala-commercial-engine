/**
 * supabase-error.ts
 * ─────────────────
 * Shared Supabase error handler.
 * 
 * Replaces bare `console.error()` calls across the sync layer with
 * structured error handling: toast notification + console log + optional
 * app_errors table persistence.
 * 
 * Usage:
 *   import { handleSupabaseError } from '@/lib/supabase-error';
 *   const { error } = await supabase.from('table').insert(row);
 *   if (error) handleSupabaseError('syncWorkspaceStage', error);
 */

import { toast } from 'sonner';

// ── Types ───────────────────────────────────────────────────

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

interface ErrorContext {
  /** The sync function that failed */
  operation: string;
  /** The Supabase error object */
  error: SupabaseError;
  /** Timestamp of the error */
  timestamp: string;
  /** Optional entity ID for traceability */
  entityId?: string;
}

// ── Error Log (in-memory ring buffer for debugging) ─────────

const ERROR_LOG_MAX = 50;
const errorLog: ErrorContext[] = [];

export function getRecentErrors(): ReadonlyArray<ErrorContext> {
  return errorLog;
}

// ── Main Handler ────────────────────────────────────────────

/**
 * Handle a Supabase error with toast + console + optional persistence.
 * 
 * @param operation - Name of the sync function (e.g., 'syncWorkspaceStage')
 * @param error - The Supabase error object
 * @param options - Optional configuration
 * @param options.silent - If true, skip the toast (useful for background syncs)
 * @param options.entityId - Entity ID for traceability
 */
export function handleSupabaseError(
  operation: string,
  error: SupabaseError,
  options?: { silent?: boolean; entityId?: string }
): void {
  const ctx: ErrorContext = {
    operation,
    error,
    timestamp: new Date().toISOString(),
    entityId: options?.entityId,
  };

  // 1. Console (always)
  console.error(`[Supabase] ${operation} failed:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    entityId: options?.entityId,
  });

  // 2. Ring buffer (always)
  errorLog.push(ctx);
  if (errorLog.length > ERROR_LOG_MAX) errorLog.shift();

  // 3. Toast (unless silent)
  if (!options?.silent) {
    const shortMsg = error.message.length > 80
      ? error.message.slice(0, 77) + '...'
      : error.message;
    toast.error(`Sync failed: ${operation}`, {
      description: shortMsg,
      duration: 5000,
    });
  }

  // 4. Optional: persist to app_errors table (future)
  // This is a placeholder for when we add an app_errors table.
  // persistErrorToSupabase(ctx).catch(() => {});
}

/**
 * Wrap a Supabase operation with automatic error handling.
 * Returns true if the operation succeeded, false if it failed.
 */
export async function withSupabaseErrorHandling(
  operation: string,
  fn: () => Promise<{ error: SupabaseError | null }>,
  options?: { silent?: boolean; entityId?: string }
): Promise<boolean> {
  const { error } = await fn();
  if (error) {
    handleSupabaseError(operation, error, options);
    return false;
  }
  return true;
}
