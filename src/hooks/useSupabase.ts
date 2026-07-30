/**
 * useSupabase — clean-owned replacement (SC-01 Wave 02, plan v3 §7.1).
 *
 * React hooks over lib/supabase-data with loading state, error state, and
 * refetch. Returns real values from Supabase or an explicit empty default;
 * fetch failures surface through the `error` field, never as data.
 */

import { getCurrentUser } from "@/lib/auth-state";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchUsers, fetchCurrentUser, fetchCustomerById,
  fetchWorkspaceById,
  fetchQuotesByWorkspace, fetchProposalsByWorkspace,
  fetchApprovalRecords,
  fetchPnLByWorkspace,
  fetchAuditLog,
} from "@/lib/supabase-data";
import type {
  User, Customer, Workspace, Quote, Proposal, ApprovalRecord,
  PnLModel, AuditEntry,
} from "@/lib/store";

interface UseQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Wraps a promise with a timeout — rejects if not resolved in `ms`.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function useQuery<T>(fetcher: () => Promise<T>, defaultValue: T, deps: any[] = []): UseQueryResult<T> {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(fetcher(), 8000);
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        console.warn("[useQuery] fetch failed:", err.message);
        setError(err.message || "Failed to fetch data");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  return { data, loading, error, refetch: load };
}

// ============================================================
// TYPED HOOKS
// ============================================================

export function useUsers(): UseQueryResult<User[]> {
  return useQuery(fetchUsers, []);
}

export function useCurrentUser(): UseQueryResult<User> {
  return useQuery(fetchCurrentUser, getCurrentUser() as any);
}

export function useCustomer(id: string): UseQueryResult<Customer | null> {
  return useQuery(() => fetchCustomerById(id), null, [id]);
}

export function useWorkspace(id: string, mode: "workspace" | "proposal" = "workspace"): UseQueryResult<Workspace | null> {
  return useQuery(() => fetchWorkspaceById(id, { proposalOnly: mode === "proposal" }), null, [id, mode]);
}

export function useQuotesByWorkspace(workspaceId: string): UseQueryResult<Quote[]> {
  return useQuery(() => fetchQuotesByWorkspace(workspaceId), [], [workspaceId]);
}

export function useProposalsByWorkspace(workspaceId: string): UseQueryResult<Proposal[]> {
  return useQuery(() => fetchProposalsByWorkspace(workspaceId), [], [workspaceId]);
}

export function useApprovalRecords(): UseQueryResult<ApprovalRecord[]> {
  return useQuery(fetchApprovalRecords, []);
}

export function usePnLByWorkspace(workspaceId: string): UseQueryResult<PnLModel | null> {
  return useQuery(() => fetchPnLByWorkspace(workspaceId), null, [workspaceId]);
}

export function useAuditLog(): UseQueryResult<AuditEntry[]> {
  return useQuery(fetchAuditLog, []);
}
