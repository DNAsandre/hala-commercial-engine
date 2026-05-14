import { useEffect, useState, useMemo } from "react";
import { useParams } from "wouter";
import {
  AlertTriangle, ArrowLeft, BarChart3, Boxes, Building2, Calculator,
  Database, Info, Link2, Radio, Shield,
} from "lucide-react";
import {
  CommercialOsShell, ErrorState, LoadingState, MetricCard,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import {
  fetchCustomerMaster, fetchCustomerAliases, fetchTenderCustomerLinks,
  classifyWarehouseRisk, computeGpV2Summary,
  type CustomerMasterRow, type CustomerAliasRow, type TenderCustomerLink,
  type CapacityRiskStatus,
} from "@/lib/commercial-os-data";

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);
}
function fmtSar(v: number) { return v ? fmt(v) + " SAR" : "0 SAR"; }
function fmtMonth(v: string) {
  if (!v) return "--";
  const d = new Date(v.length === 7 ? `${v}-01T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d);
}

function SectionHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b pb-2">
      <Icon className="h-4 w-4 text-indigo-600" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {badge && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]">{badge}</Badge>}
    </div>
  );
}

function ReportRow({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-dashed border-slate-100 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-semibold ${warn ? 'text-red-700' : 'text-foreground'}`}>{value}</span>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function riskBadge(status: CapacityRiskStatus) {
  const m: Record<CapacityRiskStatus, { label: string; cls: string }> = {
    overcommitted: { label: "Overcommitted", cls: "border-red-200 bg-red-50 text-red-700" },
    constrained: { label: "Constrained", cls: "border-orange-200 bg-orange-50 text-orange-700" },
    high_utilization: { label: "High Util", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    watch: { label: "Watch", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    available: { label: "Available", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  };
  const c = m[status] || m.available;
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

export default function CommercialOsCustomerReviewPack() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId || "";
  const { data, loading: osLoading, error: osError, batchId } = useCommercialOsData();
  const [customer, setCustomer] = useState<CustomerMasterRow | null>(null);
  const [aliases, setAliases] = useState<CustomerAliasRow[]>([]);
  const [tenderLinks, setTenderLinks] = useState<TenderCustomerLink[]>([]);
  const [cmLoading, setCmLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchCustomerMaster(), fetchCustomerAliases(), fetchTenderCustomerLinks()])
      .then(([customers, allAliases, allTenderLinks]) => {
        if (!mounted) return;
        const found = customers.find(c => c.id === customerId) ||
                      customers.find(c => c.canonicalName === customerId) ||
                      customers.find(c => c.displayName.toLowerCase() === decodeURIComponent(customerId).toLowerCase());
        setCustomer(found || null);
        if (found) {
          setAliases(allAliases.filter(a => a.customerId === found.id));
          setTenderLinks(allTenderLinks.filter(tl => tl.customerId === found.id));
        } else {
          const nameLower = decodeURIComponent(customerId).toLowerCase();
          setTenderLinks(allTenderLinks.filter(tl =>
            tl.tenderCustomerName.toLowerCase() === nameLower ||
            tl.customerMasterName.toLowerCase() === nameLower
          ));
        }
        setCmLoading(false);
      })
      .catch(() => { if (mounted) setCmLoading(false); });
    return () => { mounted = false; };
  }, [customerId]);

  const customerName = customer?.displayName || decodeURIComponent(customerId);
  const customerNameLower = customerName.toLowerCase().trim();

  const opportunities = useMemo(() =>
    data.opportunities.filter(o => o.customerName.toLowerCase().trim() === customerNameLower),
    [data.opportunities, customerNameLower]
  );
  const closedWon = useMemo(() =>
    (data.closedWonDeals || []).filter((d: any) =>
      (d.account_name || d.accountName || "").toLowerCase().trim() === customerNameLower
    ), [data.closedWonDeals, customerNameLower]
  );
  const revenue = useMemo(() =>
    data.revenueActuals.filter(r => r.customerName.toLowerCase().trim() === customerNameLower),
    [data.revenueActuals, customerNameLower]
  );
  const linkedWarehouses = useMemo(() => {
    const whNames = new Set(opportunities.map(o => o.warehouseLocation || o.warehouseRaw).filter(Boolean));
    return data.capacitySnapshots.filter(s => whNames.has(s.warehouseLabel) || whNames.has(s.warehouseName));
  }, [data.capacitySnapshots, opportunities]);

  // GP for this customer
  const custGp = opportunities.length > 0 ? computeGpV2Summary(opportunities) : null;
  const custGpTotalDeals = custGp ? (custGp.dealsVerified + custGp.dealsAssumed + custGp.dealsNoRevenue) : 0;

  // Revenue totals
  const ytdTotal = revenue.reduce((s, r) => s + r.amount, 0);
  const revenueByMonth = new Map<string, number>();
  for (const r of revenue) { revenueByMonth.set(r.month, (revenueByMonth.get(r.month) || 0) + r.amount); }
  const monthlyTrend = Array.from(revenueByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // Flags / signals
  const allFlags = opportunities.flatMap(o => o.flags || []);
  const relatedActions = useMemo(() =>
    data.leadershipActions.filter((a: any) =>
      `${a.actionTitle} ${a.impact} ${a.owner} ${a.sourceArea}`.toLowerCase().includes(customerNameLower)
    ), [data.leadershipActions, customerNameLower]
  );

  const weightedTotal = opportunities.reduce((s, o) => s + o.weightedTotal, 0);
  const acvTotal = opportunities.reduce((s, o) => s + o.acvAnnual, 0);
  const now = new Date();
  const reportMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const loading = osLoading || cmLoading;

  return (
    <CommercialOsShell
      title="Customer Review Pack"
      description={`Read-only MBR/QBR review pack for ${customerName}`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="customer review pack" /> : osError ? <ErrorState error={osError} /> : null}

        {!loading && !osError && (
          <>
            {/* Back link */}
            <Link href="/commercial-os/customers">
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline cursor-pointer">
                <ArrowLeft className="h-3 w-3" /> Back to Customer Master
              </span>
            </Link>

            {/* Pack Header */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-semibold text-foreground">Review Pack — {customerName} — {reportMonth}</p>
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">RPT-002</Badge>
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">MBR</Badge>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                    Read-only · Internal · Batch {batchId}
                  </Badge>
                </div>
                <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-3 mb-3">
                  <span className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Internal review pack
                  </span>
                  <span className="text-[10px] text-amber-700">• Not all assumptions are externally verified</span>
                  <span className="text-[10px] text-amber-700">• Finance and Commercial review recommended before customer-facing use</span>
                  <span className="text-[10px] text-amber-700">• No CRM or workflow</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-5">
                  <MetricCard label="Pipeline Deals" value={String(opportunities.length)} helper="Active opportunities" />
                  <MetricCard label="Pipeline ACV" value={fmtSar(acvTotal)} helper="Annual contract value" />
                  <MetricCard label="Weighted" value={fmtSar(weightedTotal)} helper="ACV × probability" />
                  <MetricCard label="Revenue YTD" value={fmtSar(ytdTotal)} helper="Actuals loaded" />
                  <MetricCard label="Closed Won" value={String(closedWon.length)} helper="Booked deals" />
                </div>
              </CardContent>
            </Card>

            {/* Section 1: Customer Overview */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Building2} title="1. Customer Overview" badge={customer?.sourceConfidence || 'snapshot'} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Customer Name" value={customerName} />
                    <ReportRow label="Type" value={customer?.customerType || 'warehouse'} />
                    <ReportRow label="Region" value={customer?.region || '--'} />
                    <ReportRow label="Status" value={customer?.status || 'active'} />
                    <ReportRow label="Source Confidence" value={customer?.sourceConfidence || 'snapshot'} warn={customer?.sourceConfidence === 'needs_review'} />
                    <ReportRow label="Linked Warehouses" value={String(linkedWarehouses.length)} />
                    <ReportRow label="Tender Links" value={String(tenderLinks.length)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Known Aliases</p>
                    {aliases.length > 0 ? aliases.map(a => (
                      <ReportRow key={a.id} label={a.aliasName} value={a.sourceTable} sub={a.needsReview ? 'Needs review' : 'Auto-matched'} warn={a.needsReview} />
                    )) : (
                      <p className="text-xs text-muted-foreground">No aliases registered in customer master.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Commercial Performance */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={BarChart3} title="2. Commercial Performance" badge={`${opportunities.length} deals`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Pipeline Deals" value={String(opportunities.length)} />
                    <ReportRow label="Total ACV" value={fmtSar(acvTotal)} />
                    <ReportRow label="Weighted Pipeline" value={fmtSar(weightedTotal)} />
                    <ReportRow label="Closed Won" value={String(closedWon.length)} />
                    {opportunities.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mt-3 mb-1">Stage Mix</p>
                        {Array.from(new Set(opportunities.map(o => o.stage))).map(stage => {
                          const count = opportunities.filter(o => o.stage === stage).length;
                          const wt = opportunities.filter(o => o.stage === stage).reduce((s, o) => s + o.weightedTotal, 0);
                          return <ReportRow key={stage} label={`${stage} (×${count})`} value={fmtSar(wt)} />;
                        })}
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Top Deals</p>
                    {[...opportunities].sort((a, b) => b.weightedTotal - a.weightedTotal).slice(0, 5).map((d, i) => (
                      <ReportRow key={d.id} label={`${i + 1}. ${d.opportunityName || d.customerName}`} value={fmtSar(d.weightedTotal)} sub={d.stage} />
                    ))}
                    {opportunities.length === 0 && <p className="text-xs text-muted-foreground">No pipeline deals for this customer.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Revenue Actuals */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Database} title="3. Revenue Actuals" badge={`${revenue.length} records`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Revenue Records" value={String(revenue.length)} />
                    <ReportRow label="YTD Total" value={fmtSar(ytdTotal)} />
                    <ReportRow label="Unique GL Codes" value={String(new Set(revenue.map(r => r.glCode).filter(Boolean)).size)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Monthly Trend</p>
                    {monthlyTrend.slice(-6).map(([month, amount]) => (
                      <ReportRow key={month} label={fmtMonth(month)} value={fmtSar(amount)} />
                    ))}
                    {monthlyTrend.length === 0 && <p className="text-xs text-muted-foreground">No revenue actuals loaded.</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: GP View */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Calculator} title="4. GP / Profit View" badge={custGp ? `${custGp.assumedGpPctOfTotal}% assumed` : undefined} />
                {custGp ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <ReportRow label="Total Deals" value={String(custGpTotalDeals)} />
                      <ReportRow label="Projected GP" value={fmtSar(custGp.projectedGpTotal)} />
                      <ReportRow label="Verified GP" value={fmtSar(custGp.projectedGpVerified)} sub={`${custGp.dealsVerified} deals`} />
                      <ReportRow label="Assumed GP" value={fmtSar(custGp.projectedGpAssumed)} warn={custGp.projectedGpAssumed > 0} sub="Using 25% default" />
                    </div>
                    <div>
                      <ReportRow label="% Assumed" value={custGp.assumedGpPctOfTotal + '%'} warn={custGp.assumedGpPctOfTotal > 50} />
                      <ReportRow label="Finance Review" value={custGp.assumedGpPctOfTotal > 50 ? 'REQUIRED' : 'No'} warn={custGp.assumedGpPctOfTotal > 50} />
                      <ReportRow label="Dangerous Defaults" value={String(custGp.dangerousDefaultCount)} warn={custGp.dangerousDefaultCount > 0} />
                      {custGp.dangerousDefaultCount > 0 && (
                        <div className="mt-2 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700 border border-red-100">
                          ⚠ {custGp.defaultWarningMessage}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No GP data available for this customer.</p>
                )}
              </CardContent>
            </Card>

            {/* Section 5: Capacity / Delivery Exposure */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Boxes} title="5. Capacity / Delivery Exposure" badge={`${linkedWarehouses.length} warehouses`} />
                {linkedWarehouses.length > 0 ? (
                  <div className="space-y-1">
                    {linkedWarehouses.map(w => {
                      const risk = classifyWarehouseRisk(w);
                      return (
                        <div key={w.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs">
                          <span className="font-medium">{w.warehouseLabel || w.warehouseName}</span>
                          <span className="text-muted-foreground">{w.region}</span>
                          <span className="font-mono">{fmt(w.sellableCapacity)} sellable</span>
                          <span className="font-mono">{fmt(w.committedCapacity)} committed</span>
                          <span className="font-mono">{w.utilizationPct.toFixed(1)}%</span>
                          {riskBadge(risk.riskStatus)}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No linked warehouse capacity data.</p>
                )}
              </CardContent>
            </Card>

            {/* Section 6: Tender / Transport View */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Link2} title="6. Tender / Transport View" badge={tenderLinks.length > 0 ? `${tenderLinks.length} links` : undefined} />
                <p className="text-[10px] text-muted-foreground mb-2">Read-only · Does not modify tender workflow · Linde preserved</p>
                {tenderLinks.length > 0 ? (
                  <div className="space-y-2">
                    {tenderLinks.map(tl => (
                      <div key={tl.id} className="rounded border border-violet-100 bg-violet-50/20 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] border-violet-200 bg-violet-50 text-violet-700">{tl.matchStatus}</Badge>
                          <span className="font-medium">{tl.tenderCustomerName}</span>
                          <span className="text-muted-foreground">→ Tender: {tl.tenderWorkspaceId}</span>
                          <Link href={`/tenders/${tl.tenderWorkspaceId}`}>
                            <span className="text-blue-700 hover:underline cursor-pointer">Open →</span>
                          </Link>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-muted-foreground">
                          <span>Confidence: {tl.matchConfidence}</span>
                          <span>Source: {tl.sourceType}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No linked tenders or transportation opportunities.</p>
                )}
              </CardContent>
            </Card>

            {/* Section 7: Risks / Signals */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={Radio} title="7. Risks / Signals / Escalations" badge={`${allFlags.length} flags · ${relatedActions.length} actions`} />
                {allFlags.length === 0 && relatedActions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active risks, signals, or escalations for this customer.</p>
                ) : (
                  <div className="space-y-1">
                    {allFlags.map((f, i) => (
                      <div key={`f-${i}`} className="flex items-center gap-2 rounded border px-3 py-1.5 text-xs">
                        <Badge variant="outline" className={`text-[10px] ${f.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' : f.severity === 'high' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{f.severity}</Badge>
                        <span>{f.flagMessage}</span>
                        <span className="ml-auto text-muted-foreground">{f.flagType}</span>
                      </div>
                    ))}
                    {relatedActions.map((a, i) => (
                      <div key={`a-${i}`} className="flex items-center gap-2 rounded border px-3 py-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] border-slate-200 bg-slate-50 text-slate-500">{a.severity || 'medium'}</Badge>
                        <span className="font-medium">{a.actionTitle}</span>
                        <span className="ml-auto text-muted-foreground">{a.owner}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 8: Assumptions / Source Notes */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <SectionHeader icon={AlertTriangle} title="8. Assumptions / Source Notes" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <ReportRow label="Default GP Margin" value="25%" sub="Dangerous default — not verified by Finance" warn />
                    <ReportRow label="Default Cost Ratio" value="75%" sub="Assumed across all deals" warn />
                    <ReportRow label="Default Pallet Rate" value="48 SAR/pallet/month" sub="Workbook assumption" />
                    <ReportRow label="Source Batch" value={batchId} sub="Excel import snapshot" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Source Limitations</p>
                    <p className="text-xs text-muted-foreground mb-1">• Revenue actuals may not cover full fiscal year</p>
                    <p className="text-xs text-muted-foreground mb-1">• GP figures are based on available cost data only</p>
                    <p className="text-xs text-muted-foreground mb-1">• Customer aliases may have false matches</p>
                    <p className="text-xs text-muted-foreground mb-1">• Capacity snapshots reflect point-in-time data</p>
                    <p className="text-xs text-red-700 font-medium mt-2">Not all values are client-safe. Do not expose assumed figures as certified facts.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <div className="rounded border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-800">Review Pack Methodology</span>
                  </div>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>This review pack is generated from live Commercial OS data (batch: {batchId}).</p>
                    <p>Customer matching uses canonical name resolution from CUST-002 customer master.</p>
                    <p>GP figures use available cost data. Where missing, 25% default is applied (flagged as "assumed").</p>
                    <p className="font-semibold">Finance and Commercial review recommended before any customer-facing use.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>• Internal review pack</span>
                  <span>• Source: {batchId}</span>
                  <span>• Generated: {now.toISOString().split('T')[0]}</span>
                  <span>• No CRM</span>
                  <span>• No workflow</span>
                  <span>• Not for external distribution without review</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
