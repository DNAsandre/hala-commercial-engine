import {
  CommercialOsShell,
  DataTable,
  EmptySourceState,
  ErrorState,
  LoadingState,
  SourceCell,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { useCommercialOsData } from "@/hooks/useCommercialOsData";

function fmt(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0);
}

export default function CommercialOsRevenue() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = data.revenueActuals;

  return (
    <CommercialOsShell
      title="Revenue Actuals"
      description={`Live read-only GL/customer revenue actuals for import batch ${batchId}.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="revenue actuals" /> : error ? <ErrorState error={error} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptySourceState label="Revenue actuals" />
        ) : (
          <DataTable columns={["GL Code", "Customer", "Month", "Amount", "YTD", "Period Year", "Revenue Type", "Source"]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 font-medium">{row.glCode || "--"}</td>
                <td className="min-w-64 px-3 py-3">{row.customerName || "--"}</td>
                <td className="px-3 py-3">{row.month || "--"}</td>
                <td className="px-3 py-3">{fmt(row.amount)}</td>
                <td className="px-3 py-3">{fmt(row.ytdAmount)}</td>
                <td className="px-3 py-3">{row.periodYear ?? "--"}</td>
                <td className="px-3 py-3"><Badge variant="outline">{row.revenueType || "--"}</Badge></td>
                <td className="px-3 py-3"><SourceCell {...row} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </CommercialOsShell>
  );
}
