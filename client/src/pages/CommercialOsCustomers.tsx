import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Link2, Search, Users } from "lucide-react";
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
import { useCommercialOsData } from "@/hooks/useCommercialOsData";
import {
  fetchCustomerMaster,
  fetchCustomerAliases,
  fetchCustomerSourceLinks,
  type CustomerMasterRow,
  type CustomerAliasRow,
  type CustomerSourceLinkRow,
} from "@/lib/commercial-os-data";

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

function confidenceBadge(confidence: string) {
  const map: Record<string, { label: string; className: string }> = {
    verified: { label: "Verified", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    snapshot: { label: "Snapshot", className: "border-blue-200 bg-blue-50 text-blue-700" },
    assumed: { label: "Assumed", className: "border-amber-200 bg-amber-50 text-amber-700" },
    needs_review: { label: "Needs Review", className: "border-red-200 bg-red-50 text-red-700" },
  };
  const cfg = map[confidence] || map.snapshot!;
  return <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>;
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    warehouse: "border-blue-200 bg-blue-50 text-blue-700",
    transport: "border-violet-200 bg-violet-50 text-violet-700",
    both: "border-emerald-200 bg-emerald-50 text-emerald-700",
    unknown: "border-zinc-200 bg-zinc-50 text-zinc-500",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[type] || map.unknown!}`}>{type}</Badge>;
}

export default function CommercialOsCustomers() {
  const { data, loading: osLoading, error: osError, batchId } = useCommercialOsData();
  const [customers, setCustomers] = useState<CustomerMasterRow[]>([]);
  const [aliases, setAliases] = useState<CustomerAliasRow[]>([]);
  const [sourceLinks, setSourceLinks] = useState<CustomerSourceLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchCustomerMaster(), fetchCustomerAliases(), fetchCustomerSourceLinks()])
      .then(([c, a, s]) => {
        if (!mounted) return;
        setCustomers(c);
        setAliases(a);
        setSourceLinks(s);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message || "Failed to load customer master");
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Build cross-reference counts from operational data
  const pipelineCounts = new Map<string, number>();
  const closedWonCounts = new Map<string, number>();
  const revenueCounts = new Map<string, number>();

  if (!osLoading && !osError) {
    for (const o of data.opportunities) {
      const name = o.customerName?.toLowerCase().trim();
      if (name) pipelineCounts.set(name, (pipelineCounts.get(name) || 0) + 1);
    }
    for (const d of data.closedWonDeals || []) {
      const name = (d as any).account_name?.toLowerCase().trim() || (d as any).accountName?.toLowerCase().trim();
      if (name) closedWonCounts.set(name, (closedWonCounts.get(name) || 0) + 1);
    }
    for (const r of data.revenueActuals || []) {
      const name = (r as any).customer_name?.toLowerCase().trim() || (r as any).customerName?.toLowerCase().trim();
      if (name) revenueCounts.set(name, (revenueCounts.get(name) || 0) + 1);
    }
  }

  const aliasesByCustomer = new Map<string, CustomerAliasRow[]>();
  for (const a of aliases) {
    if (!aliasesByCustomer.has(a.customerId)) aliasesByCustomer.set(a.customerId, []);
    aliasesByCustomer.get(a.customerId)!.push(a);
  }

  const linksByCustomer = new Map<string, CustomerSourceLinkRow[]>();
  for (const l of sourceLinks) {
    if (!linksByCustomer.has(l.customerId)) linksByCustomer.set(l.customerId, []);
    linksByCustomer.get(l.customerId)!.push(l);
  }

  const needsReviewCount = customers.filter(c => c.sourceConfidence === 'needs_review').length;
  const searchLower = search.toLowerCase();
  const filtered = search
    ? customers.filter(c =>
        c.displayName.toLowerCase().includes(searchLower) ||
        c.canonicalName.includes(searchLower) ||
        c.region?.toLowerCase().includes(searchLower)
      )
    : customers;

  return (
    <CommercialOsShell
      title="Customer Master"
      description={`Read-only customer foundation for import batch ${batchId}. No auto-merge — duplicates flagged for review.`}
    >
      <div className="space-y-4">
        {(loading || osLoading) ? <LoadingState label="customer master" /> : error || osError ? <ErrorState error={error || osError || ""} /> : null}

        {!loading && !error && (
          <>
            {/* Summary */}
            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-700" />
                  <p className="text-sm font-semibold">Customer Master</p>
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">CUST-001</Badge>
                  <span className="ml-auto text-[10px] text-muted-foreground">Read-only · No auto-merge · Duplicates flagged for review</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <MetricCard label="Total Customers" value={String(customers.length)} helper="Distinct customer records" />
                  <MetricCard label="Aliases" value={String(aliases.length)} helper="Name variants across sources" />
                  <MetricCard label="Source Links" value={String(sourceLinks.length)} helper="Cross-system references" />
                  <MetricCard label="Needs Review" value={String(needsReviewCount)} helper={needsReviewCount > 0 ? "Possible duplicates flagged" : "No review needed"} />
                  <MetricCard label="Active" value={String(customers.filter(c => c.status === 'active').length)} helper="Active customer records" />
                </div>
              </CardContent>
            </Card>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>

            {/* Customer Table */}
            {filtered.length === 0 ? (
              <EmptySourceState label="Customer master" />
            ) : (
              <DataTable
                columns={[
                  "Customer",
                  "Type",
                  "Region",
                  "Confidence",
                  "Aliases",
                  "Pipeline",
                  "Closed Won",
                  "Revenue",
                  "Links",
                  "Status",
                ]}
              >
                {filtered.map((c) => {
                  const custAliases = aliasesByCustomer.get(c.id) || [];
                  const custLinks = linksByCustomer.get(c.id) || [];
                  const pipelineCount = pipelineCounts.get(c.canonicalName) || 0;
                  const closedCount = closedWonCounts.get(c.canonicalName) || 0;
                  const revenueCount = revenueCounts.get(c.canonicalName) || 0;
                  const hasReview = custAliases.some(a => a.needsReview);
                  return (
                    <tr key={c.id} className={hasReview ? "bg-amber-50/30" : undefined}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.displayName}</span>
                          {hasReview && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">
                              <AlertTriangle className="mr-0.5 h-3 w-3" />Review
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">{typeBadge(c.customerType)}</td>
                      <td className="px-3 py-3 text-sm">{c.region || "--"}</td>
                      <td className="px-3 py-3">{confidenceBadge(c.sourceConfidence)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{custAliases.length}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm font-mono">{pipelineCount || "--"}</td>
                      <td className="px-3 py-3 text-sm font-mono">{closedCount || "--"}</td>
                      <td className="px-3 py-3 text-sm font-mono">{revenueCount || "--"}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Link2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{custLinks.length}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={`text-[10px] ${
                          c.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                          'border-zinc-200 bg-zinc-50 text-zinc-500'
                        }`}>{c.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}

            {/* Needs Review Panel */}
            {needsReviewCount > 0 && (
              <Card className="shadow-none border-amber-200">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold">Flagged for Review</p>
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-[10px]">{needsReviewCount} customers</Badge>
                    <span className="ml-auto text-[10px] text-muted-foreground">No auto-merge — human review required before linking</span>
                  </div>
                  <div className="space-y-1">
                    {customers.filter(c => c.sourceConfidence === 'needs_review').map(c => {
                      const custAliases = aliasesByCustomer.get(c.id) || [];
                      const reviewAliases = custAliases.filter(a => a.needsReview);
                      return (
                        <div key={c.id} className="flex items-center gap-3 rounded border border-amber-100 bg-amber-50/20 px-3 py-2 text-xs">
                          <span className="font-medium">{c.displayName}</span>
                          {reviewAliases.length > 0 && (
                            <span className="text-muted-foreground">
                              {reviewAliases[0]?.matchReason}
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground">{custAliases.length} aliases</span>
                        </div>
                      );
                    })}
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
