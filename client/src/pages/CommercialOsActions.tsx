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

function severityClass(severity: string) {
  const s = severity.toLowerCase();
  if (s.includes("critical") || s.includes("high")) return "border-red-300 bg-red-50 text-red-700";
  if (s.includes("medium") || s.includes("amber")) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

export default function CommercialOsActions() {
  const { data, loading, error, batchId } = useCommercialOsData();
  const rows = data.leadershipActions;

  return (
    <CommercialOsShell
      title="Leadership Actions"
      description={`Live read-only leadership actions for import batch ${batchId}.`}
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="leadership actions" /> : error ? <ErrorState error={error} /> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptySourceState label="Leadership actions" />
        ) : (
          <DataTable columns={["Action Code", "Risk / Action", "Impact", "Owner", "Status", "Severity", "Source Area", "Source"]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 font-medium">{row.actionCode || "--"}</td>
                <td className="min-w-72 px-3 py-3">{row.actionTitle || "--"}</td>
                <td className="max-w-md px-3 py-3 text-sm text-muted-foreground">{row.impact || "--"}</td>
                <td className="px-3 py-3">{row.owner || "--"}</td>
                <td className="px-3 py-3"><Badge variant="outline" className="bg-background">{row.status || "--"}</Badge></td>
                <td className="px-3 py-3">
                  <Badge variant="outline" className={severityClass(row.severity)}>{row.severity || "--"}</Badge>
                </td>
                <td className="px-3 py-3">{row.sourceArea || "--"}</td>
                <td className="px-3 py-3"><SourceCell {...row} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </CommercialOsShell>
  );
}
