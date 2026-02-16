import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Printer, Star, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customers, workspaces, formatSAR, formatPercent, calculateECR } from "@/lib/store";
import { generateECRScorecardPDF, openPDFPreview } from "@/lib/pdf-compiler";
import {
  getEcrCustomerIdByName, getLatestScore, getCustomerScores,
  getGradeBg, getGradeColor, mockSnapshots, mockRuleSets,
  type EcrScore, type Grade
} from "@/lib/ecr";

const gradeColors: Record<string, string> = { A: "bg-emerald-100 text-emerald-800", B: "bg-blue-100 text-blue-800", C: "bg-amber-100 text-amber-800", D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800" };

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const c = customers.find(x => x.id === id);
  if (!c) return <div className="p-6"><h1 className="text-xl font-serif">Customer not found</h1><Link href="/customers"><Button variant="outline" className="mt-4"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link></div>;
  const custWorkspaces = workspaces.filter(w => w.customerId === c.id);
  const ecr = calculateECR(c.dso, c.contractValue2025, 22, 0.7, 0.6);

  // ECR v1 integration
  const ecrCustId = getEcrCustomerIdByName(c.name);
  const ecrLatest = ecrCustId ? getLatestScore(ecrCustId) : undefined;
  const ecrScores = ecrCustId ? getCustomerScores(ecrCustId) : [];
  const ecrSnapshots = ecrCustId ? mockSnapshots.filter(s => s.customerId === ecrCustId) : [];

  // Trend
  let ecrTrend: 'up' | 'down' | 'stable' = 'stable';
  if (ecrScores.length >= 2) {
    const sorted = [...ecrScores].sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime());
    const diff = sorted[0].totalScore - sorted[1].totalScore;
    if (diff > 2) ecrTrend = 'up';
    else if (diff < -2) ecrTrend = 'down';
  }

  const activeRuleSet = mockRuleSets.find(rs => rs.status === 'active');

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif font-bold">{c.name}</h1>
            <Badge variant="outline" className={`text-xs ${gradeColors[c.grade] || ""}`}>Grade {c.grade}</Badge>
            {/* ECR v1 Badge */}
            {ecrLatest && (
              <Badge variant="outline" className={`text-xs ${getGradeBg(ecrLatest.grade)}`}>
                <Star className="w-3 h-3 mr-1" />
                ECR {ecrLatest.grade} · {ecrLatest.totalScore.toFixed(1)}
              </Badge>
            )}
            <span className={`text-xs font-medium ${c.status === "Active" ? "rag-green" : "rag-red"}`}>{c.status}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{c.code} — {c.industry} — {c.region}</p>
        </div>
        <Button variant="outline" onClick={() => { const html = generateECRScorecardPDF(c); openPDFPreview(html, `ECR Scorecard — ${c.name}`); }}>
          <Printer className="w-4 h-4 mr-1.5" />ECR Scorecard PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[
          { l: "Contract Value", v: formatSAR(c.contractValue2025) },
          { l: "Monthly Revenue", v: formatSAR(c.expectedMonthlyRevenue) },
          { l: "DSO", v: `${c.dso} days`, color: c.dso > 60 ? "rag-red" : c.dso > 45 ? "rag-amber" : undefined },
          { l: "Pallets", v: c.palletContracted.toLocaleString() },
          { l: "ECR Score", v: ecrLatest ? `${ecrLatest.totalScore.toFixed(1)} (${ecrLatest.grade})` : `${ecr.score.toFixed(0)}%`, color: ecrLatest ? getGradeColor(ecrLatest.grade) : undefined },
          { l: "Payment", v: c.paymentStatus, color: c.paymentStatus === "Bad" ? "rag-red" : c.paymentStatus === "Acceptable" ? "rag-amber" : "rag-green" },
        ].map(kpi => (
          <Card key={kpi.l} className="border border-border shadow-none"><CardContent className="p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.l}</p>
            <p className={`data-value text-lg font-semibold mt-0.5 ${kpi.color || ""}`}>{kpi.v}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ecr">
            ECR Scorecard
            {ecrLatest && <Badge variant="outline" className={`ml-1.5 text-[10px] ${getGradeBg(ecrLatest.grade)}`}>{ecrLatest.grade}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="revenue">Revenue History</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces ({custWorkspaces.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Company Details</CardTitle></CardHeader><CardContent className="pt-0 space-y-2">
              {[{ l: "Group", v: c.group }, { l: "City", v: c.city }, { l: "Region", v: c.region }, { l: "Industry", v: c.industry }, { l: "Account Owner", v: c.accountOwner }, { l: "Service Type", v: c.serviceType }, { l: "Facility", v: c.facility }].map(r => (
                <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="font-medium">{r.v}</span></div>
              ))}
            </CardContent></Card>
            <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Contract & Contact</CardTitle></CardHeader><CardContent className="pt-0 space-y-2">
              {[{ l: "Contract Expiry", v: c.contractExpiry }, { l: "Rate/Pallet", v: `SAR ${c.ratePerPallet}` }, { l: "Contact Name", v: c.contactName }, { l: "Email", v: c.contactEmail }, { l: "Phone", v: c.contactPhone }].map(r => (
                <div key={r.l} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.l}</span><span className="font-medium">{r.v}</span></div>
              ))}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="ecr">
          {ecrLatest ? (
            <div className="space-y-4">
              {/* ECR v1 Score Summary */}
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-serif flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      ECR v1 — Existing Customer Rating
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => navigate('/ecr-scoring')}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Full ECR Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-6 p-4 rounded-lg bg-muted mb-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center border-2 ${getGradeBg(ecrLatest.grade)}`}>
                      <span className="text-3xl font-bold">{ecrLatest.grade}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-foreground">{ecrLatest.totalScore.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 100</span>
                        {ecrTrend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-600" />}
                        {ecrTrend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                        {ecrTrend === 'stable' && <Minus className="w-5 h-5 text-slate-400" />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Rule Set: {activeRuleSet?.name} · Confidence: {ecrLatest.confidenceScore}% · Computed: {new Date(ecrLatest.computedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Score History */}
                  {ecrScores.length > 1 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Score History</p>
                      <div className="flex items-end gap-1 h-12">
                        {[...ecrScores]
                          .sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime())
                          .map((s) => (
                            <div key={s.id} className="flex flex-col items-center gap-0.5 flex-1">
                              <span className="text-[10px] text-muted-foreground">{s.totalScore.toFixed(0)}</span>
                              <div
                                className={`w-full rounded-t ${s.grade === 'A' ? 'bg-emerald-400' : s.grade === 'B' ? 'bg-blue-400' : s.grade === 'C' ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ height: `${(s.totalScore / 100) * 32}px` }}
                              />
                              <span className="text-[9px] text-muted-foreground">{new Date(s.computedAt).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  {/* Snapshots */}
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Input Snapshots ({ecrSnapshots.length})</p>
                    <div className="space-y-1.5">
                      {ecrSnapshots.map(snap => {
                        const score = ecrScores.find(s => s.snapshotId === snap.id);
                        return (
                          <div key={snap.id} className="flex items-center justify-between p-2.5 rounded border border-border text-sm">
                            <div>
                              <span className="font-medium">{snap.periodStart} → {snap.periodEnd}</span>
                              <span className="text-xs text-muted-foreground ml-2">by {snap.createdBy}</span>
                            </div>
                            {score && (
                              <Badge variant="outline" className={`text-xs ${getGradeBg(score.grade)}`}>
                                {score.grade} · {score.totalScore.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Fallback to legacy ECR scorecard */
            <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">ECR Classification Scorecard</CardTitle></CardHeader><CardContent className="pt-0">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 mb-4 text-sm text-blue-800">
                <Star className="w-4 h-4 inline mr-1" />
                No ECR v1 score available for this customer. Showing legacy scorecard. <Button variant="link" className="text-blue-700 p-0 h-auto text-sm" onClick={() => navigate('/ecr-snapshots')}>Create a snapshot →</Button>
              </div>
              <div className="space-y-4">
                {[{ criteria: "DSO (Days Sales Outstanding)", weight: "30%", score: c.dso <= 30 ? "1.0" : c.dso <= 45 ? "0.5" : "0.0", detail: `${c.dso} days` },
                  { criteria: "Contract Value", weight: "30%", score: c.contractValue2025 > 2000000 ? "1.0" : c.contractValue2025 > 1000000 ? "0.7" : "0.3", detail: formatSAR(c.contractValue2025) },
                  { criteria: "Client Profitability (GP%)", weight: "20%", score: "0.5", detail: "Estimated" },
                  { criteria: "Potential Growth", weight: "10%", score: "0.7", detail: "Volume + Services" },
                  { criteria: "Cost of Acquisition", weight: "10%", score: "0.6", detail: "Operational" }
                ].map(row => (
                  <div key={row.criteria} className="flex items-center justify-between p-3 rounded border border-border">
                    <div><p className="text-sm font-medium">{row.criteria}</p><p className="text-xs text-muted-foreground">{row.detail}</p></div>
                    <div className="text-right"><span className="data-value text-sm font-semibold">{row.score}</span><p className="text-[10px] text-muted-foreground">Weight: {row.weight}</p></div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <span className="text-sm font-semibold">Total ECR Score</span>
                  <div className="flex items-center gap-3">
                    <span className="data-value text-xl font-bold">{ecr.score.toFixed(0)}%</span>
                    <Badge className={`${gradeColors[ecr.grade] || ""}`}>Grade {ecr.grade}</Badge>
                  </div>
                </div>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="revenue">
          <Card className="border border-border shadow-none"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Revenue History</CardTitle></CardHeader><CardContent className="pt-0">
            <div className="space-y-3">
              {[{ year: "2023", rev: c.revenue2023 }, { year: "2024", rev: c.revenue2024 }, { year: "2025 (YTD)", rev: c.revenue2025 }].map(r => {
                const maxRev = Math.max(c.revenue2023, c.revenue2024, c.revenue2025 * 2);
                const width = maxRev > 0 ? (r.rev / maxRev) * 100 : 0;
                return (
                  <div key={r.year}>
                    <div className="flex justify-between mb-1"><span className="text-sm font-medium">{r.year}</span><span className="data-value text-sm">{formatSAR(r.rev)}</span></div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[{ l: "Contracted", v: c.palletContracted }, { l: "Occupied", v: c.palletOccupied }, { l: "Potential", v: c.palletPotential }].map(p => (
                <div key={p.l} className="text-center p-3 rounded border border-border"><p className="text-[10px] text-muted-foreground uppercase">{p.l} Pallets</p><p className="data-value text-lg font-semibold mt-1">{p.v.toLocaleString()}</p></div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="workspaces">
          {custWorkspaces.length > 0 ? <div className="space-y-2">{custWorkspaces.map(w => (
            <Link key={w.id} href={`/workspaces/${w.id}`}><div className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3"><div className={`rag-dot ${w.ragStatus === "red" ? "rag-dot-red" : w.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} /><div><p className="text-sm font-medium">{w.title}</p><p className="text-xs text-muted-foreground">{w.stage}</p></div></div>
              <span className="data-value text-sm">{formatSAR(w.estimatedValue)}</span>
            </div></Link>
          ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No active workspaces for this customer</CardContent></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
