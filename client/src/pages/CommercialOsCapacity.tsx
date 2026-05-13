import { AlertTriangle } from "lucide-react";
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

function fmtDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function capacityStatus(utilizationPct: number, shortfallCapacity: number, remaining: number) {
  if (shortfallCapacity > 0 || remaining < 0) {
    return { label: "Constrained", className: "border-red-300 bg-red-50 text-red-700" };
  }
  if (utilizationPct > 90) {
    return { label: "High Utilization", className: "border-amber-300 bg-amber-50 text-amber-700" };
  }
  if (utilizationPct > 75) {
    return { label: "Watch", className: "border-blue-200 bg-blue-50 text-blue-700" };
  }
  return { label: "Available", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

export default function CommercialOsCapacity() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = Array.from(
    data.capacitySnapshots
      .reduce((latest, row) => {
        const key = row.warehouseLocationId || row.warehouseLabel || row.warehouseName || row.id;
        const current = latest.get(key);
        if (!current || row.snapshotDate.localeCompare(current.snapshotDate) >= 0) latest.set(key, row);
        return latest;
      }, new Map<string, (typeof data.capacitySnapshots)[number]>())
      .values()
  );

  return (
    <CommercialOsShell
      title="Warehouse Capacity"
      description={`Live read-only capacity snapshots for import batch ${batchId}.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="capacity snapshots" /> : error ? <ErrorState error={error} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptySourceState label="Warehouse capacity" />
        ) : (
          <DataTable
            columns={[
              "Warehouse",
              "Status",
              "Region",
              "Total Capacity",
              "Occupied Capacity",
              "Sellable Capacity",
              "Committed Capacity",
              "Remaining",
              "Utilization %",
              "Shortfall",
              "Snapshot",
              "Source",
            ]}
          >
            {rows.map((row) => {
              const remaining = row.sellableCapacity - row.committedCapacity;
              const highUtilization = row.utilizationPct > 90;
              const hasShortfall = row.shortfallCapacity > 0;
              const status = capacityStatus(row.utilizationPct, row.shortfallCapacity, remaining);
              return (
                <tr key={row.id} className={highUtilization || hasShortfall ? "bg-amber-50/40" : undefined}>
                  <td className="px-3 py-3 font-medium">{row.warehouseLabel || row.warehouseName || "--"}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                  </td>
                  <td className="px-3 py-3">{row.region || "--"}</td>
                  <td className="px-3 py-3">{fmt(row.totalCapacity)}</td>
                  <td className="px-3 py-3">{fmt(row.occupiedCapacity)}</td>
                  <td className="px-3 py-3">{fmt(row.sellableCapacity)}</td>
                  <td className="px-3 py-3">{fmt(row.committedCapacity)}</td>
                  <td className="px-3 py-3">{fmt(remaining)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span>{row.utilizationPct ? `${row.utilizationPct.toFixed(1)}%` : "--"}</span>
                      {highUtilization && <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">Utilization &gt; 90%</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span>{fmt(row.shortfallCapacity)}</span>
                      {hasShortfall && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Shortfall
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{fmtDate(row.snapshotDate)}</td>
                  <td className="px-3 py-3"><SourceCell {...row} /></td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </CommercialOsShell>
  );
}
