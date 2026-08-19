import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchEcrAuditTrail,
  fetchEcrMetrics,
  fetchEcrRuleSets,
  fetchEcrRuleWeights,
  fetchEcrScores,
  fetchEcrSnapshots,
} from "@/lib/supabase-data";
import { getFetchError } from "@/lib/supabase-error";

const ECR_READS = [
  "fetchEcrMetrics",
  "fetchEcrRuleSets",
  "fetchEcrRuleWeights",
  "fetchEcrSnapshots",
  "fetchEcrScores",
  "fetchEcrAuditTrail",
] as const;

type EcrData = {
  metrics: Awaited<ReturnType<typeof fetchEcrMetrics>>;
  ruleSets: Awaited<ReturnType<typeof fetchEcrRuleSets>>;
  weights: Awaited<ReturnType<typeof fetchEcrRuleWeights>>;
  snapshots: Awaited<ReturnType<typeof fetchEcrSnapshots>>;
  scores: Awaited<ReturnType<typeof fetchEcrScores>>;
  audit: Awaited<ReturnType<typeof fetchEcrAuditTrail>>;
};

type EcrRead =
  | { status: "ok"; data: EcrData }
  | { status: "error"; message: string };

export async function loadEcrOverview(): Promise<EcrRead> {
  const [metrics, ruleSets, weights, snapshots, scores, audit] = await Promise.all([
    fetchEcrMetrics(),
    fetchEcrRuleSets(),
    fetchEcrRuleWeights(),
    fetchEcrSnapshots(),
    fetchEcrScores(),
    fetchEcrAuditTrail(),
  ]);
  const failures = ECR_READS.flatMap((operation) => {
    const failure = getFetchError(operation);
    return failure ? [`${operation}: ${failure.error.message}`] : [];
  });
  if (failures.length > 0) return { status: "error", message: failures.join("; ") };
  return { status: "ok", data: { metrics, ruleSets, weights, snapshots, scores, audit } };
}

export default function EcrOverview() {
  const [read, setRead] = useState<EcrRead | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRead(null);
    loadEcrOverview().then((result) => { if (!cancelled) setRead(result); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (!read) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading ECR records...</div>;
  }

  if (read.status === "error") {
    return (
      <Card className="border-red-200 bg-red-50/40 shadow-none">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> ECR records could not be read</div>
          <p className="text-xs text-muted-foreground break-all">{read.message}</p>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const { metrics, ruleSets, weights, snapshots, scores, audit } = read.data;
  const activeRuleSet = ruleSets.find((ruleSet) => ruleSet.status === "active") ?? null;
  const activeWeights = activeRuleSet ? weights.filter((weight) => weight.ruleSetId === activeRuleSet.id) : [];
  const weightTotal = activeWeights.reduce((total, weight) => total + weight.weight, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{metrics.filter((metric) => metric.active).length}</div><div className="text-xs text-muted-foreground">Active metrics</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{scores.length}</div><div className="text-xs text-muted-foreground">Recorded scores</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{snapshots.length}</div><div className="text-xs text-muted-foreground">Input snapshots</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{audit.length}</div><div className="text-xs text-muted-foreground">Audit entries</div></CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Current scoring rules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {activeRuleSet ? (
              <>
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{activeRuleSet.name}</span><Badge variant="outline">Version {activeRuleSet.versionNumber}</Badge><Badge>{activeRuleSet.status}</Badge></div>
                <p className="text-xs text-muted-foreground">{activeRuleSet.description || "No description recorded."}</p>
                <p className="text-xs">{activeWeights.length} weights recorded; total weight {weightTotal.toFixed(2)}.</p>
              </>
            ) : <p className="text-sm text-muted-foreground">No active ECR rule set is recorded.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Latest customer scores</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {scores.length === 0 ? <p className="text-sm text-muted-foreground">No ECR scores are recorded.</p> : scores.slice(0, 6).map((score) => (
              <div key={score.id} className="flex items-center justify-between gap-3 border-b last:border-0 py-2">
                <div className="min-w-0"><p className="text-sm font-medium truncate">Customer {score.customerId}</p><p className="text-xs text-muted-foreground">{score.computedAt ? new Date(score.computedAt).toLocaleString() : "No computation time recorded"}</p></div>
                <div className="text-right shrink-0"><Badge variant="outline">Grade {score.grade}</Badge><p className="text-xs mt-1">{score.totalScore.toFixed(1)} / confidence {score.confidenceScore.toFixed(1)}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
