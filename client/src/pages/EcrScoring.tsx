import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * ECR SCORE COMPUTATION & RESULTS
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Deterministic scoring, grade calculation, breakdown, historical preservation.
 * Score = Σ(normalized_value × weight / 100) — No AI involvement.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Calculator, TrendingUp, BarChart3, Shield, Award,
  ChevronDown, ChevronUp, Clock, User, FileText, History, Loader2
} from 'lucide-react';
import {
  computeEcrScore, getGradeBg, getGradeColor,
  type EcrScore, type EcrScoreBreakdown, type Grade
} from '@/lib/ecr';
import {
  useEcrScores, useEcrSnapshots, useEcrRuleSets, useEcrMetrics,
  useEcrRuleWeights, useEcrInputValues,
} from '@/hooks/useSupabase';

const gradeDescriptions: Record<Grade, string> = {
  A: 'Premium customer — high profitability, low risk, strategic value',
  B: 'Good customer — solid performance, moderate opportunities',
  C: 'Average customer — mixed signals, needs attention',
  D: 'At-risk customer — low performance, high risk factors',
};

export default function EcrScoring() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);

  // Live Supabase data
  const { data: scores, loading: scoresLoading } = useEcrScores();
  const { data: snapshots } = useEcrSnapshots();
  const { data: ruleSets } = useEcrRuleSets();
  const { data: metrics } = useEcrMetrics();
  const { data: ruleWeights } = useEcrRuleWeights();
  const { data: inputValues } = useEcrInputValues();

  // Build customer IDs and name lookup from scores
  const customerIds = useMemo(() => {
    const ids = new Set<string>();
    scores.forEach(s => ids.add(s.customerId));
    return Array.from(ids);
  }, [scores]);

  const customerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const id of customerIds) {
      const raw = id.replace('cust-', '').replace(/-/g, ' ');
      names[id] = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return names;
  }, [customerIds]);

  const filteredScores = useMemo(() => {
    let result = [...scores];
    if (selectedCustomer !== 'all') {
      result = result.filter(s => s.customerId === selectedCustomer);
    }
    return result.sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime());
  }, [scores, selectedCustomer]);

  // Summary stats
  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
    : 0;
  const gradeDistribution = scores.reduce((acc, s) => {
    acc[s.grade] = (acc[s.grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Latest scores per customer (for leaderboard)
  const latestPerCustomer = useMemo(() => {
    const map = new Map<string, EcrScore>();
    for (const s of scores) {
      const existing = map.get(s.customerId);
      if (!existing || new Date(s.computedAt) > new Date(existing.computedAt)) {
        map.set(s.customerId, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalScore - a.totalScore);
  }, [scores]);

  const getBreakdown = (score: EcrScore): EcrScoreBreakdown[] => {
    const result = computeEcrScore(score.snapshotId, score.ruleSetId, metrics, ruleWeights, inputValues);
    return result.breakdown;
  };

  const getSnapshot = (snapshotId: string) => snapshots.find(s => s.id === snapshotId);
  const getRuleSet = (ruleSetId: string) => ruleSets.find(rs => rs.id === ruleSetId);

  if (scoresLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href="/ecr">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to ECR Dashboard
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Scoring</h1>
          <p className="text-sm text-slate-500 mt-1">Deterministic score computation. Score = Σ(normalized_value × weight / 100). Historical scores are immutable.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Total Scores</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{scores.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Score</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{avgScore.toFixed(1)}</p>
          </CardContent>
        </Card>
        {(['A', 'B', 'C', 'D'] as Grade[]).map(g => (
          <Card key={g}>
            <CardContent className="py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Grade {g}</p>
              <p className={`text-2xl font-bold mt-1 ${getGradeColor(g)}`}>{gradeDistribution[g] || 0}</p>
            </CardContent>
          </Card>
        )).slice(0, 3)}
      </div>

      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">Score History</TabsTrigger>
          <TabsTrigger value="leaderboard">Customer Leaderboard</TabsTrigger>
          <TabsTrigger value="formula">Scoring Formula</TabsTrigger>
        </TabsList>

        {/* Score History */}
        <TabsContent value="scores" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Filter by customer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customerIds.map(id => (
                  <SelectItem key={id} value={id}>{customerNames[id] || id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredScores.map(score => {
              const isExpanded = expandedScoreId === score.id;
              const snapshot = getSnapshot(score.snapshotId);
              const ruleSet = getRuleSet(score.ruleSetId);
              const breakdown = isExpanded ? getBreakdown(score) : [];

              return (
                <Card key={score.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedScoreId(isExpanded ? null : score.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${getGradeBg(score.grade)}`}>
                          <span className="text-2xl font-bold">{score.grade}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{customerNames[score.customerId] || score.customerId}</h3>
                            <span className="text-lg font-bold text-slate-700">{score.totalScore.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(score.computedAt).toLocaleDateString()}</span>
                            {snapshot && <span>Period: {snapshot.periodStart} → {snapshot.periodEnd}</span>}
                            {ruleSet && <span>Rule Set: {ruleSet.name}</span>}
                            <span>Confidence: {score.confidenceScore}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {score.computedBySystem && (
                          <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500">System Computed</Badge>
                        )}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded Breakdown */}
                    {isExpanded && breakdown.length > 0 && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" /> Score Breakdown
                        </h4>

                        <div className="space-y-2">
                          {breakdown.sort((a, b) => b.weightedScore - a.weightedScore).map(item => {
                            const maxWeighted = Math.max(...breakdown.map(b => b.weightedScore));
                            const barWidth = maxWeighted > 0 ? (item.weightedScore / maxWeighted) * 100 : 0;

                            return (
                              <div key={item.metricKey} className="flex items-center gap-3">
                                <div className="w-44 min-w-44 text-sm text-slate-600">{item.displayName}</div>
                                <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
                                  <div
                                    className="h-full bg-slate-700 rounded-full transition-all"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
                                    {item.weightedScore.toFixed(2)}
                                  </span>
                                </div>
                                <div className="w-24 text-right text-xs text-slate-500">
                                  {item.value}{item.unit === '%' ? '%' : item.unit === 'days' ? 'd' : ''} × {item.weight}%
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-slate-500" />
                            <span className="text-sm text-slate-600">Total Score</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-slate-900">{score.totalScore.toFixed(1)}</span>
                            <Badge variant="outline" className={`text-sm font-bold ${getGradeBg(score.grade)}`}>
                              Grade {score.grade}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 italic">
                          {gradeDescriptions[score.grade]}
                        </p>

                        {/* Immutability Notice */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                          <History className="w-3.5 h-3.5" />
                          This score is immutable. It was computed with snapshot {score.snapshotId} and rule set {score.ruleSetId}. Even if rule sets change later, this historical score remains unchanged.
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Customer Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card>
            <CardContent className="py-4">
              <div className="space-y-3">
                {latestPerCustomer.map((score, index) => (
                  <div key={score.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-600' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{customerNames[score.customerId] || score.customerId}</h4>
                      <p className="text-xs text-slate-400">Latest: {new Date(score.computedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-slate-900">{score.totalScore.toFixed(1)}</span>
                      <Badge variant="outline" className={`ml-2 text-xs font-bold ${getGradeBg(score.grade)}`}>
                        {score.grade}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scoring Formula */}
        <TabsContent value="formula" className="mt-4 space-y-4">
          <Card>
            <CardContent className="py-6">
              <h3 className="text-lg font-semibold font-serif text-slate-900 mb-4">ECR Scoring Formula</h3>

              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-lg border font-mono text-sm">
                  <p className="text-slate-600 mb-2">// Step 1: Normalize each metric value to 0-100 scale</p>
                  <p className="text-slate-900">normalized = (value - min) / (max - min) × 100</p>
                  <p className="text-slate-600 mt-3 mb-2">// Step 2: For inverse metrics (DSO, Dispute Rate) — lower is better</p>
                  <p className="text-slate-900">normalized = (max - value) / (max - min) × 100</p>
                  <p className="text-slate-600 mt-3 mb-2">// Step 3: Apply weights and sum</p>
                  <p className="text-slate-900">total_score = Σ (normalized_value × weight / 100)</p>
                  <p className="text-slate-600 mt-3 mb-2">// Step 4: Assign grade</p>
                  <p className="text-slate-900">A: 80-100 | B: 60-79 | C: 40-59 | D: 0-39</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Normalization Rules</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <p className="text-sm font-medium text-emerald-800">Higher is Better</p>
                      <p className="text-xs text-emerald-600 mt-1">GP%, Revenue Growth, SLA Compliance, Volume Utilization, Strategic Value</p>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm font-medium text-red-800">Lower is Better (Inverse)</p>
                      <p className="text-xs text-red-600 mt-1">Days Sales Outstanding, Dispute Rate</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Confidence Score</h4>
                  <p className="text-sm text-slate-600">
                    Confidence = (metrics with values / total weighted metrics) × 100%.
                    A score with 100% confidence means all weighted metrics have input values.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Historical Preservation</h4>
                  <p className="text-sm text-slate-600">
                    Every computed score stores the snapshot_id and rule_set_id used at computation time.
                    Historical scores never change, even if rule sets are updated later.
                    This ensures full auditability and reproducibility.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No AI Notice */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 text-amber-800 text-sm">
                <Shield className="w-4 h-4" />
                <span className="font-medium">No AI Creep:</span>
                <span className="text-amber-700">ECR score calculation is purely arithmetic. No LLM may calculate, modify, or adjust scores. AI may only explain results after computation.</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
