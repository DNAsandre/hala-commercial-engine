import { useEffect, useState } from "react";
import { AlertTriangle, Building2, MapPin, Truck } from "lucide-react";
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
import {
  fetchTransportationOpportunities,
  fetchTransportationCustomerLinks,
  type TransportationOpportunity,
  type TransportationCustomerLink,
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

function sourceBadge(source: string) {
  const m: Record<string, { label: string; cls: string }> = {
    tender_snapshot: { label: "Tender Workspace", cls: "border-violet-200 bg-violet-50 text-violet-700" },
    d365: { label: "D365", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    tms: { label: "TMS", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    finance: { label: "Finance", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    manual: { label: "Manual", cls: "border-zinc-200 bg-zinc-50 text-zinc-500" },
  };
  const c = m[source] || m.manual!;
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

function confidenceBadge(tier: number) {
  const m: Record<number, { label: string; cls: string }> = {
    1: { label: "T1 Live", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    2: { label: "T2 Formula", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    3: { label: "T3 Snapshot", cls: "border-blue-200 bg-blue-50 text-blue-700" },
    4: { label: "T4 Assumed", cls: "border-amber-200 bg-amber-50 text-amber-700" },
    5: { label: "T5 Default", cls: "border-red-200 bg-red-50 text-red-700" },
  };
  const c = m[tier] || m[4]!;
  return <Badge variant="outline" className={`text-[10px] ${c.cls}`}>{c.label}</Badge>;
}

export default function CommercialOsTransportation() {
  const [opportunities, setOpportunities] = useState<TransportationOpportunity[]>([]);
  const [customerLinks, setCustomerLinks] = useState<TransportationCustomerLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchTransportationOpportunities(), fetchTransportationCustomerLinks()])
      .then(([ops, links]) => {
        if (!mounted) return;
        setOpportunities(ops);
        setCustomerLinks(links);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "Failed to load transportation pipeline");
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const linksByOpp = new Map<string, TransportationCustomerLink[]>();
  for (const l of customerLinks) {
    if (!linksByOpp.has(l.transportationOpportunityId)) linksByOpp.set(l.transportationOpportunityId, []);
    linksByOpp.get(l.transportationOpportunityId)!.push(l);
  }

  const totalRevenue = opportunities.reduce((s, o) => s + o.expectedRevenue, 0);
  const totalGp = opportunities.reduce((s, o) => s + o.expectedGp, 0);
  const tenderCount = opportunities.filter(o => o.pipelineType === 'tender' || o.sourceType === 'tender_snapshot').length;

  return (
    <CommercialOsShell
      title="Transportation Pipeline"
      description="Read-only transportation / tender pipeline. Separate from Warehouse Pipeline."
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="transportation pipeline" /> : error ? <ErrorState error={error} /> : null}

        {!loading && !error && (
          <>
            {/* Pipeline Identity */}
            <Card className="shadow-none border-violet-200">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-violet-700" />
                  <p className="text-sm font-semibold">Transportation Pipeline</p>
                  <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700 text-[10px]">TPT-001</Badge>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                    <AlertTriangle className="mr-0.5 h-3 w-3" />Separate from Warehouse Pipeline
                  </Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">Read-only · No CRM · No writes</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard label="Opportunities" value={String(opportunities.length)} helper="Transportation pipeline deals" />
                  <MetricCard label="Expected Revenue" value={fmt(totalRevenue)} helper="Sum of expected revenue" />
                  <MetricCard label="Expected GP" value={fmt(totalGp)} helper="Sum of expected gross profit" />
                  <MetricCard label="Tender Sourced" value={String(tenderCount)} helper="From tender workspace" />
                  <MetricCard label="Customer Links" value={String(customerLinks.length)} helper="Cross-references to Customer Master" />
                </div>
              </CardContent>
            </Card>

            {/* Future Source Labels */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Future sources:</span>
              {["Tender Workspace", "D365", "TMS", "Finance"].map(s => (
                <Badge key={s} variant="outline" className="text-[10px] border-zinc-200 bg-zinc-50 text-zinc-400">{s}</Badge>
              ))}
            </div>

            {/* Pipeline Table */}
            {opportunities.length === 0 ? (
              <EmptySourceState label="Transportation pipeline opportunities" />
            ) : (
              <DataTable
                columns={[
                  "Customer",
                  "Opportunity",
                  "Owner",
                  "Stage",
                  "Prob %",
                  "Service",
                  "Lane",
                  "Start",
                  "Revenue",
                  "GP",
                  "Source",
                  "Confidence",
                ]}
              >
                {opportunities.map(o => {
                  const links = linksByOpp.get(o.id) || [];
                  const isLinde = o.customerName.toLowerCase().includes('linde');
                  return (
                    <tr key={o.id} className="text-xs">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{o.customerName}</span>
                          {links.length > 0 && links[0].matchStatus === 'needs_review' && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">Review</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {isLinde ? (
                          <Link href="/tenders/tn-linde-001">
                            <span className="text-violet-700 hover:underline cursor-pointer">{o.opportunityName}</span>
                          </Link>
                        ) : (
                          o.opportunityName || "--"
                        )}
                      </td>
                      <td className="px-3 py-2">{o.owner || "--"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{o.stage}</Badge></td>
                      <td className="px-3 py-2 font-mono text-right">{o.probabilityPct}%</td>
                      <td className="px-3 py-2">{o.serviceType || "--"}</td>
                      <td className="px-3 py-2">
                        {o.laneSummary ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {o.laneSummary}
                          </span>
                        ) : o.origin && o.destination ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {o.origin} → {o.destination}
                          </span>
                        ) : "--"}
                      </td>
                      <td className="px-3 py-2">{fmtDate(o.expectedStartDate)}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(o.expectedRevenue)}</td>
                      <td className="px-3 py-2 font-mono text-right">{fmt(o.expectedGp)}</td>
                      <td className="px-3 py-2">{sourceBadge(o.sourceType)}</td>
                      <td className="px-3 py-2">{confidenceBadge(o.confidenceTier)}</td>
                    </tr>
                  );
                })}
              </DataTable>
            )}

            {/* Source Lineage */}
            {opportunities.filter(o => o.sourceLineage).length > 0 && (
              <Card className="shadow-none">
                <CardContent className="p-5">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source Lineage</p>
                  <div className="space-y-1">
                    {opportunities.filter(o => o.sourceLineage).map(o => (
                      <div key={o.id} className="flex items-start gap-2 rounded border px-3 py-2 text-xs">
                        <span className="font-medium shrink-0">{o.customerName}</span>
                        <span className="text-muted-foreground">{o.sourceLineage}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
