import { useEffect, useState, useMemo } from "react";
import { useParams } from "wouter";
import {
  AlertTriangle, ArrowLeft, Building2, Boxes, ClipboardList,
  FileSpreadsheet, Link2, TableProperties, TrendingUp, Users,
} from "lucide-react";
import {
  CommercialOsShell,
  DataTable,
  EmptySourceState,
  ErrorState,
  LoadingState,
  MetricCard,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import {
  fetchCustomerMaster,
  fetchCustomerAliases,
  fetchTenderCustomerLinks,
  classifyWarehouseRisk,
  type CustomerMasterRow,
  type CustomerAliasRow,
  type TenderCustomerLink,
  type CapacityRiskStatus,
} from "@/lib/commercial-os-data";

function fmt(v: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v || 0);
}
function fmtDate(v: string) {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtMonth(v: string) {
  if (!v) return "--";
  const d = new Date(v.length === 7 ? `${v}-01T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d);
}

function riskBadge(status: CapacityRiskStatus) {
  const m: Record<CapacityRiskStatus, { label: string; cls: string }> = {
    overcommitted: { label: "Overcommitted", cls: "border-red-200 bg-red-50 text-red-700" },
    constrained: { label: "Constrained", cls: "border-orange-200 bg-orange-50 text-orange-700" },
    high_utilization: { label: "High Utilization", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    watch: { label: "Watch", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    available: { label: "Available", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  };
  const c = m[status] || m.available;
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
      No linked {label} records yet.
    </div>
  );
}

export default function CommercialOsCustomerDetail() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId || "";
  const { data, loading: osLoading, error: osError, batchId } = useCommercialOsData();
  const [customer, setCustomer] = useState<CustomerMasterRow | null>(null);
  const [aliases, setAliases] = useState<CustomerAliasRow[]>([]);
  const [tenderLinks, setTenderLinks] = useState<TenderCustomerLink[]>([]);
  const [cmLoading, setCmLoading] = useState(true);

  // Try to load customer from customer_master (may not exist yet)
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
          // Fallback: match by customer name
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

  // Resolve customer name for cross-referencing
  const customerName = customer?.displayName || decodeURIComponent(customerId);
  const customerNameLower = customerName.toLowerCase().trim();

  // Filter operational data by customer name
  const opportunities = useMemo(() =>
    data.opportunities.filter(o => o.customerName.toLowerCase().trim() === customerNameLower),
    [data.opportunities, customerNameLower]
  );

  const closedWon = useMemo(() =>
    (data.closedWonDeals || []).filter((d: any) =>
      (d.account_name || d.accountName || "").toLowerCase().trim() === customerNameLower
    ),
    [data.closedWonDeals, customerNameLower]
  );

  const revenue = useMemo(() =>
    data.revenueActuals.filter(r => r.customerName.toLowerCase().trim() === customerNameLower),
    [data.revenueActuals, customerNameLower]
  );

  const phasing = useMemo(() => {
    const oppIds = new Set(opportunities.map(o => o.id));
    return data.monthlyPhasing.filter((p: any) => {
      const oppId = p.opportunity_id || p.commercial_opportunity_id;
      return oppIds.has(oppId);
    });
  }, [data.monthlyPhasing, opportunities]);

  const phasingTotal = phasing.reduce((s: number, p: any) => s + Number(p.revenue_amount || p.amount || 0), 0);
  const phasingWeighted = phasing.reduce((s: number, p: any) => s + Number(p.weighted_amount || p.weighted_total || 0), 0);

  // Warehouse exposure
  const linkedWarehouses = useMemo(() => {
    const whNames = new Set(opportunities.map(o => o.warehouseLocation || o.warehouseRaw).filter(Boolean));
    return data.capacitySnapshots.filter(s =>
      whNames.has(s.warehouseLabel) || whNames.has(s.warehouseName)
    );
  }, [data.capacitySnapshots, opportunities]);

  // Flags
  const allFlags = opportunities.flatMap(o => o.flags || []);

  // Leadership actions (if they mention customer name)
  const relatedActions = useMemo(() =>
    data.leadershipActions.filter((a: any) => {
      const text = `${a.actionTitle} ${a.impact} ${a.owner} ${a.sourceArea}`.toLowerCase();
      return text.includes(customerNameLower);
    }),
    [data.leadershipActions, customerNameLower]
  );

  const loading = osLoading || cmLoading;

  return (
    <CommercialOsShell
      title="Customer 360"
      description={`Read-only customer operating view for ${customerName} · Batch ${batchId}`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="customer data" /> : osError ? <ErrorState error={osError} /> : null}

        {!loading && !osError && (
          <>
            {/* Back link */}
            <Link href="/commercial-os/customers">
              <span className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline cursor-pointer">
                <ArrowLeft className="h-3 w-3" /> Back to Customer Master
              </span>
            </Link>

            {/* Customer Header */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-blue-700" />
                      <h2 className="text-lg font-semibold">{customerName}</h2>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">CUST-002</Badge>
                      {customer?.sourceConfidence === 'needs_review' && (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                          <AlertTriangle className="mr-0.5 h-3 w-3" />Needs Review
                        </Badge>
                      )}
                    </div>
                    {customer && (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {customer.region && <span>Region: {customer.region}</span>}
                        <span>Type: {customer.customerType}</span>
                        <span>Status: {customer.status}</span>
                        <span>Confidence: {customer.sourceConfidence}</span>
                      </div>
                    )}
                    {aliases.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {aliases.map(a => (
                          <Badge key={a.id} variant="outline" className={`text-[10px] ${a.needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}>
                            <Users className="mr-0.5 h-2.5 w-2.5" />{a.aliasName} ({a.sourceTable})
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span>Read-only · No writes · No CRM</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Pipeline Deals" value={String(opportunities.length)} helper="Active warehouse opportunities" />
              <MetricCard label="Pipeline ACV" value={fmt(opportunities.reduce((s, o) => s + o.acvAnnual, 0))} helper="Sum of annual contract value" />
              <MetricCard label="Weighted Total" value={fmt(opportunities.reduce((s, o) => s + o.weightedTotal, 0))} helper="ACV × probability" />
              <MetricCard label="Closed Won" value={String(closedWon.length)} helper="Booked deals" />
              <MetricCard label="Revenue Rows" value={String(revenue.length)} helper="GL/customer actuals" />
            </div>

            {/* 1. Warehouse Pipeline */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TableProperties className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Warehouse Pipeline</p>
                  <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700">{opportunities.length} deals</Badge>
                </div>
                {opportunities.length === 0 ? <SectionEmpty label="pipeline" /> : (
                  <DataTable columns={["Opportunity", "Stage", "ACV", "Weighted", "Warehouse", "Owner", "Flags"]}>
                    {opportunities.map(o => (
                      <tr key={o.id} className="text-xs">
                        <td className="px-3 py-2 font-medium">{o.opportunityName || o.customerName}</td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{o.stage}</Badge></td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(o.acvAnnual)}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(o.weightedTotal)}</td>
                        <td className="px-3 py-2">{o.warehouseLocation || o.warehouseRaw || "--"}</td>
                        <td className="px-3 py-2">{o.owner || "--"}</td>
                        <td className="px-3 py-2">{o.flags.length > 0 ? <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700">{o.flags.length} flags</Badge> : "--"}</td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </CardContent>
            </Card>

            {/* 2. Monthly Phasing */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold">Monthly Phasing</p>
                  <Badge variant="outline" className="text-[10px]">{phasing.length} rows</Badge>
                </div>
                {phasing.length === 0 ? <SectionEmpty label="monthly phasing" /> : (
                  <>
                    <div className="mb-3 grid gap-3 sm:grid-cols-3">
                      <MetricCard label="Phasing Rows" value={String(phasing.length)} helper={`${opportunities.length} linked opportunities`} />
                      <MetricCard label="Grand Total" value={fmt(phasingTotal)} helper="Sum of revenue amounts" />
                      <MetricCard label="Weighted Total" value={fmt(phasingWeighted)} helper="Sum of weighted amounts" />
                    </div>
                    <DataTable columns={["Month", "Revenue", "Weighted"]}>
                      {phasing.slice(0, 12).map((p: any, i: number) => (
                        <tr key={i} className="text-xs">
                          <td className="px-3 py-2">{fmtMonth(p.month || p.phasing_month)}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmt(Number(p.revenue_amount || p.amount || 0))}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmt(Number(p.weighted_amount || p.weighted_total || 0))}</td>
                        </tr>
                      ))}
                    </DataTable>
                    {phasing.length > 12 && <p className="mt-1 text-[10px] text-muted-foreground">Showing first 12 of {phasing.length} rows</p>}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 3. Closed Won */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold">Closed Won Deals</p>
                  <Badge variant="outline" className="text-[10px]">{closedWon.length}</Badge>
                </div>
                {closedWon.length === 0 ? <SectionEmpty label="closed won" /> : (
                  <DataTable columns={["Account", "ACV", "Go-Live", "Warehouse", "Source"]}>
                    {closedWon.map((d: any, i: number) => (
                      <tr key={i} className="text-xs">
                        <td className="px-3 py-2 font-medium">{d.account_name || d.accountName}</td>
                        <td className="px-3 py-2 font-mono text-right">{fmt(Number(d.acv_annual || d.acvAnnual || 0))}</td>
                        <td className="px-3 py-2">{fmtDate(d.go_live_date || d.goLiveDate || "")}</td>
                        <td className="px-3 py-2">{d.warehouse_location || d.warehouseLocation || "--"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.source_sheet || d.sourceSheet || "--"}</td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </CardContent>
            </Card>

            {/* 4. Revenue Actuals */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Revenue Actuals</p>
                  <Badge variant="outline" className="text-[10px]">{revenue.length} rows</Badge>
                </div>
                {revenue.length === 0 ? <SectionEmpty label="revenue actuals" /> : (
                  <>
                    <div className="mb-3 grid gap-3 sm:grid-cols-3">
                      <MetricCard label="Revenue Rows" value={String(revenue.length)} helper="GL/customer actuals" />
                      <MetricCard label="Total Amount" value={fmt(revenue.reduce((s, r) => s + r.amount, 0))} helper="Sum of monthly amounts" />
                      <MetricCard label="YTD" value={fmt(Math.max(...revenue.map(r => r.ytdAmount || 0)))} helper="Highest YTD value" />
                    </div>
                    <DataTable columns={["GL Code", "Month", "Amount", "YTD", "Type", "Source"]}>
                      {revenue.map((r, i) => (
                        <tr key={i} className="text-xs">
                          <td className="px-3 py-2 font-medium">{r.glCode || "--"}</td>
                          <td className="px-3 py-2">{fmtMonth(r.month)}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmt(r.amount)}</td>
                          <td className="px-3 py-2 font-mono text-right">{fmt(r.ytdAmount)}</td>
                          <td className="px-3 py-2">{r.revenueType || "--"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.sourceSheet || "--"}</td>
                        </tr>
                      ))}
                    </DataTable>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 5. Capacity Exposure */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Capacity Exposure</p>
                  <Badge variant="outline" className="text-[10px]">{linkedWarehouses.length} warehouses</Badge>
                </div>
                {linkedWarehouses.length === 0 ? <SectionEmpty label="capacity exposure" /> : (
                  <div className="space-y-1">
                    {linkedWarehouses.map(w => {
                      const risk = classifyWarehouseRisk(w);
                      return (
                        <div key={w.id} className="flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs">
                          <span className="font-medium">{w.warehouseLabel || w.warehouseName}</span>
                          <span className="text-muted-foreground">{w.region}</span>
                          <span className="font-mono">{w.utilizationPct.toFixed(1)}%</span>
                          {riskBadge(risk.riskStatus)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 6. Tender / Transport Linkage */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-violet-700" />
                  <p className="text-sm font-semibold">Tender / Transport Linkage</p>
                  <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">TND-002</Badge>
                  <span className="text-[10px] text-muted-foreground">Read-only · No tender modification · Does not affect tender workflow</span>
                </div>
                {tenderLinks.length > 0 ? (
                  <div className="space-y-2">
                    {tenderLinks.map(tl => {
                      const matchCls: Record<string, string> = {
                        exact: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        likely: 'border-blue-200 bg-blue-50 text-blue-700',
                        possible: 'border-amber-200 bg-amber-50 text-amber-700',
                        needs_review: 'border-red-200 bg-red-50 text-red-700',
                        unmatched: 'border-zinc-200 bg-zinc-50 text-zinc-500',
                      };
                      return (
                        <div key={tl.id} className="rounded border border-violet-100 bg-violet-50/20 px-3 py-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${matchCls[tl.matchStatus] || matchCls.needs_review}`}>{tl.matchStatus}</Badge>
                            <span className="font-medium">{tl.tenderCustomerName}</span>
                            <span className="text-muted-foreground">→ Tender: {tl.tenderWorkspaceId}</span>
                            <Link href={`/tenders/${tl.tenderWorkspaceId}`}>
                              <span className="text-blue-700 hover:underline cursor-pointer">Open Workspace →</span>
                            </Link>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-muted-foreground">
                            <span>Confidence: {tl.matchConfidence}</span>
                            <span>Source: {tl.sourceType}</span>
                            <span>T{tl.confidenceTier}</span>
                          </div>
                          {tl.notes && <p className="mt-1 text-muted-foreground">{tl.notes}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : customerNameLower.includes('linde') ? (
                  <div className="rounded border border-violet-100 bg-violet-50/20 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">Tender Link</Badge>
                      <span className="font-medium">Linde SIGAS Transportation Tender</span>
                      <Link href="/tenders/tn-linde-001">
                        <span className="text-blue-700 hover:underline cursor-pointer">Open Workspace →</span>
                      </Link>
                    </div>
                    <p className="mt-1 text-muted-foreground">SAR 55.6M · Preparing Submission · Transport pipeline (separate from warehouse)</p>
                  </div>
                ) : (
                  <SectionEmpty label="tender / transport" />
                )}
              </CardContent>
            </Card>

            {/* 7. Risks / Actions */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-semibold">Risks & Actions</p>
                  <Badge variant="outline" className="text-[10px]">{allFlags.length} flags · {relatedActions.length} actions</Badge>
                </div>
                {allFlags.length === 0 && relatedActions.length === 0 ? <SectionEmpty label="risks / actions" /> : (
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
                        <Badge variant="outline" className={`text-[10px] ${a.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{a.severity || 'medium'}</Badge>
                        <span className="font-medium">{a.actionTitle}</span>
                        <span className="ml-auto text-muted-foreground">{a.owner}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
