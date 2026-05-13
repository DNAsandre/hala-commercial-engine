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

export default function CommercialOsForecast() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = data.forecasts;

  return (
    <CommercialOsShell
      title="Forecast"
      description={`Live read-only forecast rows for import batch ${batchId}.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="forecast rows" /> : error ? <ErrorState error={error} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptySourceState label="Forecast" />
        ) : (
          <DataTable
            columns={[
              "Category",
              "Line Item",
              "Probability",
              "Month",
              "Amount",
              "Budget Amount",
              "Delta Amount",
              "Metric Type",
              "Source",
            ]}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3"><Badge variant="outline">{row.category || "--"}</Badge></td>
                <td className="px-3 py-3 font-medium">{row.lineItem || "--"}</td>
                <td className="px-3 py-3">{row.probabilityPct !== null ? `${row.probabilityPct}%` : "--"}</td>
                <td className="px-3 py-3">{row.month || "--"}</td>
                <td className="px-3 py-3">{fmt(row.amount)}</td>
                <td className="px-3 py-3">{fmt(row.budgetAmount)}</td>
                <td className={row.deltaAmount < 0 ? "px-3 py-3 text-red-700" : "px-3 py-3"}>{fmt(row.deltaAmount)}</td>
                <td className="px-3 py-3">{row.metricType || "--"}</td>
                <td className="px-3 py-3"><SourceCell {...row} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </CommercialOsShell>
  );
}
