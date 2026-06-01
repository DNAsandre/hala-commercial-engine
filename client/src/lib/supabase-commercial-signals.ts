import type {
  CommercialExecutionSignal,
  CommercialWorkspaceSignalSummary,
} from "@/lib/commercial-workspace-data";

/**
 * Commercial signal summaries are disabled until the commercial child modules
 * are rebuilt against canonical commercial_tickets lineage.
 */
export async function fetchCommercialSignalSummariesFromSupabase(): Promise<{
  summaries: Record<string, CommercialWorkspaceSignalSummary>;
  signals: CommercialExecutionSignal[];
}> {
  return { summaries: {}, signals: [] };
}
