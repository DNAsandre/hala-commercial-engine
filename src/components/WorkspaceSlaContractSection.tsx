import { FileCheck, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmptySlaState } from "@/lib/process-isolation";

interface Props {
  workspaceId: string;
  customerId?: string;
  customerName?: string;
  quotes?: any[];
  proposals?: any[];
}

export default function WorkspaceSlaContractSection({ workspaceId, customerName }: Props) {
  const emptyState = getEmptySlaState();

  return (
    <div className="space-y-4">
      <Card className="border border-amber-200 bg-amber-50/40 shadow-none">
        <CardHeader className="border-b border-amber-200 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <ShieldOff className="h-4 w-4 text-amber-600" />
              SLA And Contract Status Paused
            </CardTitle>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
              Isolation active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm leading-relaxed text-amber-800/90">{emptyState.reason}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-amber-200 bg-background/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Workspace</p>
              <p className="truncate text-xs font-medium text-foreground">{workspaceId}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-background/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
              <p className="truncate text-xs font-medium text-foreground">{customerName || "Not linked"}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-background/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Loaded SLA Rows</p>
              <p className="data-value text-lg font-semibold">{emptyState.slaRecords.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck className="h-4 w-4 text-muted-foreground" />
            Allowed Next Step
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Capture SLA handoff notes in the awarded tender stage only. This widget does not create SLA records or update contract-status rows.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
