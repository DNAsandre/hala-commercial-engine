import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
/**
 * ECR CUSTOMER DASHBOARD
 * Design: Swiss Precision Instrument — Deep navy + warm white
 * Per-customer score history, grade trends, risk summary.
 * Central hub for viewing all ECR data across customers.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation } from 'wouter';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Users, Award,
  Shield, ArrowRight, Clock, ChevronRight, Database, FileText,
  Calculator, Layers, Plug, AlertTriangle
} from 'lucide-react';
import {
  mockScores, mockSnapshots, mockMetrics, mockRuleSets,
  mockConnectors, mockRuleWeights,
  ecrCustomerNames, getGradeBg, getGradeColor,
  computeEcrScore, getLatestScore, getCustomerScores,
  mockInputValues,
  type Grade
} from '@/lib/ecr';

export default function EcrDashboard() {
  const [, navigate] = useLocation();

  // Summary data
  const activeRuleSet = mockRuleSets.find(rs => rs.status === 'active');
  const activeMetrics = mockMetrics.filter(m => m.active);
  const customerIds = Object.keys(ecrCustomerNames);

  const customerSummaries = useMemo(() => {
    return customerIds.map(custId => {
      const scores = getCustomerScores(custId);
      const latest = getLatestScore(custId);
      const snapshots = mockSnapshots.filter(s => s.customerId === custId);

      // Trend: compare latest two scores
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (scores.length >= 2) {
        const sorted = [...scores].sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime());
        const diff = sorted[0].totalScore - sorted[1].totalScore;
        if (diff > 2) trend = 'up';
        else if (diff < -2) trend = 'down';
      }

      return {
        customerId: custId,
        name: ecrCustomerNames[custId],
        latestScore: latest,
        scoreCount: scores.length,
        snapshotCount: snapshots.length,
        trend,
        scores,
      };
    }).sort((a, b) => (b.latestScore?.totalScore ?? 0) - (a.latestScore?.totalScore ?? 0));
  }, []);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
    customerSummaries.forEach(cs => {
      if (cs.latestScore) dist[cs.latestScore.grade]++;
    });
    return dist;
  }, [customerSummaries]);

  const avgScore = useMemo(() => {
    const scored = customerSummaries.filter(cs => cs.latestScore);
    if (scored.length === 0) return 0;
    return scored.reduce((sum, cs) => sum + (cs.latestScore?.totalScore ?? 0), 0) / scored.length;
  }, [customerSummaries]);

  const trendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin-panel">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin
          </Button>
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-900">ECR Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Existing Customer Rating — Deterministic scoring overview. Human judgment remains sovereign.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            Active: {activeRuleSet?.name || 'None'}
          </Badge>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Customers</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{customerIds.length}</p>
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
              <p className={`text-2xl font-bold mt-1 ${getGradeColor(g)}`}>{gradeDistribution[g]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customer Ratings</TabsTrigger>
          <TabsTrigger value="overview">System Overview</TabsTrigger>
        </TabsList>

        {/* Customer Ratings */}
        <TabsContent value="customers" className="mt-4 space-y-3">
          {customerSummaries.map(cs => (
            <Card key={cs.customerId} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {cs.latestScore ? (
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center border-2 ${getGradeBg(cs.latestScore.grade)}`}>
                        <span className="text-2xl font-bold">{cs.latestScore.grade}</span>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-100 border-2 border-slate-200">
                        <span className="text-sm text-slate-400">N/A</span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{cs.name}</h3>
                        {cs.latestScore && (
                          <span className="text-lg font-bold text-slate-700">{cs.latestScore.totalScore.toFixed(1)}</span>
                        )}
                        {trendIcon(cs.trend)}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                        <span>{cs.scoreCount} scores</span>
                        <span>{cs.snapshotCount} snapshots</span>
                        {cs.latestScore && (
                          <span>Confidence: {cs.latestScore.confidenceScore}%</span>
                        )}
                        {cs.latestScore && (
                          <span>Last scored: {new Date(cs.latestScore.computedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Score History Mini Bar */}
                    {cs.scores.length > 1 && (
                      <div className="flex items-end gap-0.5 h-8">
                        {cs.scores
                          .sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime())
                          .map((s, i) => (
                            <div
                              key={s.id}
                              className={`w-2 rounded-t ${s.grade === 'A' ? 'bg-emerald-400' : s.grade === 'B' ? 'bg-blue-400' : s.grade === 'C' ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ height: `${(s.totalScore / 100) * 32}px` }}
                              title={`${s.totalScore.toFixed(1)} (${new Date(s.computedAt).toLocaleDateString()})`}
                            />
                          ))
                        }
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => navigate('/ecr-scoring')}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* System Overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Quick Links */}
            <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate('/ecr-metrics')}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Metric Dictionary</h3>
                    <p className="text-xs text-slate-500">{activeMetrics.length} active metrics defined</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate('/ecr-rule-sets')}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Rule Sets</h3>
                    <p className="text-xs text-slate-500">{mockRuleSets.length} versions, {activeRuleSet?.name} active</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate('/ecr-snapshots')}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Input Snapshots</h3>
                    <p className="text-xs text-slate-500">{mockSnapshots.length} snapshots across {new Set(mockSnapshots.map(s => s.customerId)).size} customers</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate('/ecr-scoring')}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Score Results</h3>
                    <p className="text-xs text-slate-500">{mockScores.length} scores computed</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate('/ecr-connectors')}>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Plug className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Connectors</h3>
                    <p className="text-xs text-slate-500">{mockConnectors.length} registered, {mockConnectors.filter(c => c.status === 'enabled').length} enabled</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            {/* Architecture Principles */}
            <Card>
              <CardContent className="py-4">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600" /> Architecture Principles
                </h3>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p>✓ Score is deterministic</p>
                  <p>✓ Formula is stored, versioned, configurable</p>
                  <p>✓ Inputs are structured and source-tracked</p>
                  <p>✓ Data providers are pluggable via interface</p>
                  <p>✓ AI cannot compute or alter ECR</p>
                  <p>✓ All scoring is reproducible</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* No AI Notice */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Human-First:</span>
            <span className="text-amber-700">ECR is deterministic, versioned, traceable, connector-ready, and AI-explainable but not AI-controlled. Human judgment remains sovereign.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
