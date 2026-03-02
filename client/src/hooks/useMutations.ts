/**
 * useMutations — React hooks for Supabase write operations
 * Wraps create/update/delete with loading states, error handling,
 * toast notifications, and automatic refetch of related queries.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  createCustomer, updateCustomer,
  createWorkspace, updateWorkspace,
  createQuote, updateQuote,
  createProposal, updateProposal,
  createApprovalRecord, updateApprovalRecord,
  createSignal, createAuditEntry,
  updatePolicyGate, createPnLModel,
  createHandoverTask, updateHandoverTask,
  createCRMSyncEvent,
} from "@/lib/supabase-data";
import { supabase } from "@/lib/supabase";
import type {
  User, Customer, Workspace, Quote, Proposal, ApprovalRecord,
  Signal, AuditEntry, PolicyGate, PnLModel, HandoverTask, CRMSyncEvent,
} from "@/lib/store";

// ============================================================
// GENERIC MUTATION HOOK
// ============================================================

interface MutationResult<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput | null>;
  loading: boolean;
  error: string | null;
}

function useMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput | null>,
  options?: {
    onSuccess?: (data: TOutput) => void;
    onError?: (error: string) => void;
    successMessage?: string;
    errorMessage?: string;
  }
): MutationResult<TInput, TOutput> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (input: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await mutationFn(input);
      if (result === null) {
        const errMsg = options?.errorMessage || "Operation failed";
        setError(errMsg);
        toast.error(errMsg);
        options?.onError?.(errMsg);
        return null;
      }
      if (options?.successMessage) toast.success(options.successMessage);
      options?.onSuccess?.(result);
      return result;
    } catch (err: any) {
      const errMsg = err.message || options?.errorMessage || "Operation failed";
      setError(errMsg);
      toast.error(errMsg);
      options?.onError?.(errMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [mutationFn, options?.successMessage, options?.errorMessage]);

  return { mutate, loading, error };
}

// ============================================================
// CUSTOMER MUTATIONS
// ============================================================

export function useCreateCustomer(onSuccess?: (c: Customer) => void) {
  return useMutation(
    (customer: Customer) => createCustomer(customer),
    { successMessage: "Customer created successfully", onSuccess }
  );
}

export function useUpdateCustomer(onSuccess?: (c: Customer) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<Customer> }) => updateCustomer(id, updates),
    { successMessage: "Customer updated successfully", onSuccess }
  );
}

export function useDeleteCustomer(onSuccess?: () => void) {
  return useMutation(
    async (id: string) => {
      const { error } = await supabase.from("customers").update({ status: "Terminated" }).eq("id", id);
      if (error) throw error;
      return { id } as any;
    },
    { successMessage: "Customer deactivated", onSuccess: onSuccess ? () => onSuccess() : undefined }
  );
}

// ============================================================
// WORKSPACE MUTATIONS
// ============================================================

export function useCreateWorkspace(onSuccess?: (w: Workspace) => void) {
  return useMutation(
    (workspace: Workspace) => createWorkspace(workspace),
    { successMessage: "Workspace created successfully", onSuccess }
  );
}

export function useUpdateWorkspace(onSuccess?: (w: Workspace) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<Workspace> }) => updateWorkspace(id, updates),
    { onSuccess }
  );
}

export function useUpdateWorkspaceStage(onSuccess?: (w: Workspace) => void) {
  return useMutation(
    ({ id, stage }: { id: string; stage: string }) => updateWorkspace(id, { stage } as Partial<Workspace>),
    { successMessage: "Stage updated", onSuccess }
  );
}

export function useDeleteWorkspace(onSuccess?: () => void) {
  return useMutation(
    async (id: string) => {
      const { error } = await supabase.from("workspaces").delete().eq("id", id);
      if (error) throw error;
      return { id } as any;
    },
    { successMessage: "Workspace deleted", onSuccess: onSuccess ? () => onSuccess() : undefined }
  );
}

// ============================================================
// QUOTE MUTATIONS
// ============================================================

export function useCreateQuote(onSuccess?: (q: Quote) => void) {
  return useMutation(
    (quote: Quote) => createQuote(quote),
    { successMessage: "Quote created", onSuccess }
  );
}

export function useUpdateQuote(onSuccess?: (q: Quote) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<Quote> }) => updateQuote(id, updates),
    { successMessage: "Quote updated", onSuccess }
  );
}

// ============================================================
// PROPOSAL MUTATIONS
// ============================================================

export function useCreateProposal(onSuccess?: (p: Proposal) => void) {
  return useMutation(
    (proposal: Proposal) => createProposal(proposal),
    { successMessage: "Proposal created", onSuccess }
  );
}

export function useUpdateProposal(onSuccess?: (p: Proposal) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<Proposal> }) => updateProposal(id, updates),
    { successMessage: "Proposal updated", onSuccess }
  );
}

// ============================================================
// APPROVAL MUTATIONS
// ============================================================

export function useCreateApproval(onSuccess?: (a: ApprovalRecord) => void) {
  return useMutation(
    (record: ApprovalRecord) => createApprovalRecord(record),
    { successMessage: "Approval recorded", onSuccess }
  );
}

export function useUpdateApproval(onSuccess?: (a: ApprovalRecord) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<ApprovalRecord> }) => updateApprovalRecord(id, updates),
    { onSuccess }
  );
}

// ============================================================
// SIGNAL MUTATIONS
// ============================================================

export function useCreateSignal(onSuccess?: (s: Signal) => void) {
  return useMutation(
    (signal: Omit<Signal, "id">) => createSignal(signal),
    { onSuccess }
  );
}

// ============================================================
// AUDIT LOG MUTATIONS
// ============================================================

export function useCreateAuditEntry(onSuccess?: (a: AuditEntry) => void) {
  return useMutation(
    (entry: AuditEntry) => createAuditEntry(entry),
    { onSuccess }
  );
}

// ============================================================
// POLICY GATE MUTATIONS
// ============================================================

export function useUpdatePolicyGate(onSuccess?: (g: PolicyGate) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<PolicyGate> }) => updatePolicyGate(id, updates),
    { successMessage: "Policy gate updated", onSuccess }
  );
}

// ============================================================
// P&L MODEL MUTATIONS
// ============================================================

export function useCreatePnLModel(onSuccess?: (m: PnLModel) => void) {
  return useMutation(
    (model: PnLModel) => createPnLModel(model),
    { successMessage: "P&L model saved", onSuccess }
  );
}

// ============================================================
// HANDOVER TASK MUTATIONS
// ============================================================

export function useCreateHandoverTask(onSuccess?: (t: HandoverTask) => void) {
  return useMutation(
    (task: HandoverTask) => createHandoverTask(task),
    { successMessage: "Handover task created", onSuccess }
  );
}

export function useUpdateHandoverTask(onSuccess?: (t: HandoverTask) => void) {
  return useMutation(
    ({ id, updates }: { id: string; updates: Partial<HandoverTask> }) => updateHandoverTask(id, updates),
    { onSuccess }
  );
}

// ============================================================
// CRM SYNC EVENT MUTATIONS
// ============================================================

export function useCreateCRMSyncEvent(onSuccess?: (e: CRMSyncEvent) => void) {
  return useMutation(
    (event: CRMSyncEvent) => createCRMSyncEvent(event),
    { onSuccess }
  );
}

// ============================================================
// HELPER: Log audit entry for any action
// ============================================================

export async function logAuditAction(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  userName: string,
  details: string
): Promise<void> {
  await createAuditEntry({
    id: `audit-${crypto.randomUUID()}`,
    entityType,
    entityId,
    action,
    userId,
    userName,
    timestamp: new Date().toISOString(),
    details,
  });
}
