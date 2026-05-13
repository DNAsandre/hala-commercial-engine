import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMERCIAL_OS_DEFAULT_BATCH_ID,
  fetchCommercialOsData,
  type CommercialOsData,
} from "@/lib/commercial-os-data";

const EMPTY_DATA: CommercialOsData = {
  opportunities: [],
  capacitySnapshots: [],
  forecasts: [],
  revenueActuals: [],
  dashboardMetrics: [],
  leadershipActions: [],
  closedWonDeals: [],
  monthlyPhasing: [],
  warehouseChambers: [],
  kpiRegistry: [],
  sourceRegistry: [],
  defaultAssumptions: [],
  stageProbabilities: [],
  dashboardThresholds: [],
};

export function useCommercialOsData(batchId = COMMERCIAL_OS_DEFAULT_BATCH_ID) {
  const [data, setData] = useState<CommercialOsData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCommercialOsData(batchId);
      if (mountedRef.current) setData(result);
    } catch (err: any) {
      if (mountedRef.current) setError(err.message || "Failed to load Commercial OS data");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    mountedRef.current = true;
    refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return { data, loading, error, refetch, batchId };
}
