/**
 * useSupabase — React hooks for Supabase data fetching
 * Provides loading states, error handling, and automatic refetch.
 */

import { getCurrentUser } from "@/lib/auth-state";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchUsers, fetchCurrentUser, fetchCustomers, fetchCustomerById,
  fetchWorkspaces, fetchWorkspaceById, fetchWorkspacesByCustomer,
  fetchQuotes, fetchQuotesByWorkspace, fetchProposals, fetchProposalsByWorkspace,
  fetchApprovalRecords, fetchSignals, fetchPolicyGates,
  fetchPnLModels, fetchPnLByWorkspace, fetchHandoverTasks,
  fetchCRMSyncEvents, fetchAuditLog,
  fetchContactsByCustomer, type CustomerContact,
} from "@/lib/supabase-data";
import type {
  User, Customer, Workspace, Quote, Proposal, ApprovalRecord,
  Signal, PolicyGate, PnLModel, HandoverTask, CRMSyncEvent, AuditEntry,
} from "@/lib/store";

interface UseQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
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
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "Failed to fetch data");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
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

export function useCustomers(): UseQueryResult<Customer[]> {
  return useQuery(fetchCustomers, []);
}

export function useCustomer(id: string): UseQueryResult<Customer | null> {
  return useQuery(() => fetchCustomerById(id), null, [id]);
}

export function useWorkspaces(): UseQueryResult<Workspace[]> {
  return useQuery(fetchWorkspaces, []);
}

export function useWorkspace(id: string): UseQueryResult<Workspace | null> {
  return useQuery(() => fetchWorkspaceById(id), null, [id]);
}

export function useWorkspacesByCustomer(customerId: string): UseQueryResult<Workspace[]> {
  return useQuery(() => fetchWorkspacesByCustomer(customerId), [], [customerId]);
}

export function useQuotes(): UseQueryResult<Quote[]> {
  return useQuery(fetchQuotes, []);
}

export function useQuotesByWorkspace(workspaceId: string): UseQueryResult<Quote[]> {
  return useQuery(() => fetchQuotesByWorkspace(workspaceId), [], [workspaceId]);
}

export function useProposals(): UseQueryResult<Proposal[]> {
  return useQuery(fetchProposals, []);
}

export function useProposalsByWorkspace(workspaceId: string): UseQueryResult<Proposal[]> {
  return useQuery(() => fetchProposalsByWorkspace(workspaceId), [], [workspaceId]);
}

export function useApprovalRecords(): UseQueryResult<ApprovalRecord[]> {
  return useQuery(fetchApprovalRecords, []);
}

export function useSignals(): UseQueryResult<Signal[]> {
  return useQuery(fetchSignals, []);
}

export function usePolicyGates(): UseQueryResult<PolicyGate[]> {
  return useQuery(fetchPolicyGates, []);
}

export function usePnLModels(): UseQueryResult<PnLModel[]> {
  return useQuery(fetchPnLModels, []);
}

export function usePnLByWorkspace(workspaceId: string): UseQueryResult<PnLModel | null> {
  return useQuery(() => fetchPnLByWorkspace(workspaceId), null, [workspaceId]);
}

export function useHandoverTasks(workspaceId?: string): UseQueryResult<HandoverTask[]> {
  return useQuery(() => fetchHandoverTasks(workspaceId), [], [workspaceId]);
}

export function useCRMSyncEvents(): UseQueryResult<CRMSyncEvent[]> {
  return useQuery(fetchCRMSyncEvents, []);
}

export function useAuditLog(): UseQueryResult<AuditEntry[]> {
  return useQuery(fetchAuditLog, []);
}

export function useCustomerContacts(customerId: string): UseQueryResult<CustomerContact[]> {
  return useQuery(() => fetchContactsByCustomer(customerId), [], [customerId]);
}
