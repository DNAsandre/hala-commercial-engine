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
  fetchTenders, fetchTendersByCustomer, fetchTenderById,
  fetchRenewalWorkspaces, fetchContractBaselines,
} from "@/lib/supabase-data";
import type {
  User, Customer, Workspace, Quote, Proposal, ApprovalRecord,
  Signal, PolicyGate, PnLModel, HandoverTask, CRMSyncEvent, AuditEntry,
} from "@/lib/store";
import type { Tender } from "@/lib/tender-engine";
import type { RenewalWorkspace, ContractBaseline } from "@/lib/renewal-engine";

interface UseQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
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

// ─── TENDERS ────────────────────────────────────────────────

export function useTenders(): UseQueryResult<Tender[]> {
  return useQuery(fetchTenders, []);
}

export function useTender(id: string): UseQueryResult<Tender | null> {
  return useQuery(() => fetchTenderById(id), null, [id]);
}

export function useTendersByCustomer(customerId: string): UseQueryResult<Tender[]> {
  return useQuery(() => fetchTendersByCustomer(customerId), [], [customerId]);
}

// ─── RENEWALS ────────────────────────────────────────────────

export function useRenewalWorkspaces(): UseQueryResult<RenewalWorkspace[]> {
  return useQuery(fetchRenewalWorkspaces, []);
}

export function useContractBaselines(): UseQueryResult<ContractBaseline[]> {
  return useQuery(fetchContractBaselines, []);
}

// ─── ECR ─────────────────────────────────────────────────────

import type {
  EcrMetric, EcrRuleSet, EcrRuleWeight, EcrInputSnapshot,
  EcrInputValue, EcrScore, EcrAuditTrailEntry,
} from "@/lib/ecr";
import {
  fetchEcrMetrics, fetchEcrRuleSets, fetchActiveEcrRuleSet,
  fetchEcrRuleWeights, fetchEcrSnapshots, fetchEcrInputValues,
  fetchEcrScores, fetchEcrAuditTrail,
} from "@/lib/supabase-data";

export function useEcrMetrics(): UseQueryResult<EcrMetric[]> {
  return useQuery(fetchEcrMetrics, []);
}

export function useEcrRuleSets(): UseQueryResult<EcrRuleSet[]> {
  return useQuery(fetchEcrRuleSets, []);
}

export function useActiveEcrRuleSet(): UseQueryResult<EcrRuleSet | null> {
  return useQuery(fetchActiveEcrRuleSet, null);
}

export function useEcrRuleWeights(ruleSetId?: string): UseQueryResult<EcrRuleWeight[]> {
  return useQuery(() => fetchEcrRuleWeights(ruleSetId), [], [ruleSetId]);
}

export function useEcrSnapshots(customerId?: string): UseQueryResult<EcrInputSnapshot[]> {
  return useQuery(() => fetchEcrSnapshots(customerId), [], [customerId]);
}

export function useEcrInputValues(snapshotId?: string): UseQueryResult<EcrInputValue[]> {
  return useQuery(() => fetchEcrInputValues(snapshotId), [], [snapshotId]);
}

export function useEcrScores(customerId?: string): UseQueryResult<EcrScore[]> {
  return useQuery(() => fetchEcrScores(customerId), [], [customerId]);
}

export function useEcrAuditTrail(customerId?: string): UseQueryResult<EcrAuditTrailEntry[]> {
  return useQuery(() => fetchEcrAuditTrail(customerId), [], [customerId]);
}

// ─── DOCUMENT COMPOSER ───────────────────────────────────────

import type {
  DocBlock, BrandingProfile, DocTemplate,
  DocInstance, CompiledDocument, VaultAsset,
} from "@/lib/document-composer";
import {
  fetchDocBlocks, fetchDocBrandingProfiles, fetchDocTemplates,
  fetchDocInstances, fetchDocCompiledOutputs, fetchDocVaultAssets,
} from "@/lib/supabase-data";

export function useDocBlocks(): UseQueryResult<DocBlock[]> {
  return useQuery(fetchDocBlocks, []);
}

export function useDocBrandingProfiles(): UseQueryResult<BrandingProfile[]> {
  return useQuery(fetchDocBrandingProfiles, []);
}

export function useDocTemplates(): UseQueryResult<DocTemplate[]> {
  return useQuery(fetchDocTemplates, []);
}

export function useDocInstances(): UseQueryResult<DocInstance[]> {
  return useQuery(fetchDocInstances, []);
}

export function useDocCompiledOutputs(): UseQueryResult<CompiledDocument[]> {
  return useQuery(fetchDocCompiledOutputs, []);
}

export function useDocVaultAssets(): UseQueryResult<VaultAsset[]> {
  return useQuery(fetchDocVaultAssets, []);
}

// ─── GHL / DNA SUPERSYSTEMS CRM ──────────────────────────────

import type {
  CRMConfig, CRMContactMap, CRMOpportunityMap,
  GHLPipeline, GHLContact, GHLOpportunity,
} from "@/lib/ghl-client";
import {
  fetchCRMConfig, fetchContactMaps, fetchOpportunityMaps,
  fetchGHLPipelines, fetchGHLContacts, fetchGHLOpportunities,
} from "@/lib/ghl-client";

export function useCRMConfig(): UseQueryResult<CRMConfig | null> {
  return useQuery(fetchCRMConfig, null);
}

export function useCRMContactMaps(): UseQueryResult<CRMContactMap[]> {
  return useQuery(fetchContactMaps, []);
}

export function useCRMOpportunityMaps(): UseQueryResult<CRMOpportunityMap[]> {
  return useQuery(fetchOpportunityMaps, []);
}

export function useGHLPipelines(): UseQueryResult<GHLPipeline[]> {
  return useQuery(fetchGHLPipelines, []);
}

export function useGHLContacts(query?: string): UseQueryResult<GHLContact[]> {
  return useQuery(() => fetchGHLContacts(query), [], [query]);
}

export function useGHLOpportunities(pipelineId?: string): UseQueryResult<GHLOpportunity[]> {
  return useQuery(
    () => pipelineId ? fetchGHLOpportunities(pipelineId) : Promise.resolve([]),
    [],
    [pipelineId]
  );
}

// ─── BOT GOVERNANCE ──────────────────────────────────────────

import type { EditorBot, AIRun } from "@/lib/ai-runs";
import { fetchEditorBots, fetchAIRuns } from "@/lib/supabase-data";

export function useEditorBots(): UseQueryResult<EditorBot[]> {
  return useQuery(fetchEditorBots, []);
}

export function useAIRuns(docInstanceId?: string): UseQueryResult<AIRun[]> {
  return useQuery(() => fetchAIRuns(docInstanceId), [], [docInstanceId]);
}




