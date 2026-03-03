/**
 * SlaVsPnlDeltaBanner — Shows delta warnings between SLA/Quote and approved P&L.
 * Deterministic computation. No AI.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, XCircle, TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import type { Workspace, Quote, PnLModel } from "@/lib/store";
import { formatSAR, formatPercent } from "@/lib/store";
import { computeSlaVsPnlDelta, type DeltaReport, type DeltaItem } from "@/lib/sla-integrity";

interface SlaVsPnlDeltaBannerProps {
  workspace: Workspace;
  quote: Quote | null;
  pnl: PnLModel | null;
  /** Called when delta report is computed */
  onDeltaComputed?: (report: DeltaReport) => void;
}

function formatDeltaValue(item: DeltaItem): string {
  if (item.field === "gpPercent") {
    return `${item.delta.toFixed(1)}pp`;
  }
  return formatSAR(item.delta);
}

function DeltaRow({ item }: { item: DeltaItem }) {
  const isIncrease = item.slaValue > item.pnlValue;

  return (
    <div
      className={`flex items-center justify-between rounded-md p-2.5 text-sm ${
        item.severity === "critical"
          ? "bg-red-50 border border-red-200"
          : item.severity === "warning"
            ? "bg-amber-50 border border-amber-200"
            : "bg-emerald-50/50 border border-emerald-200/50"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {item.severity === "critical" ? (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        ) : item.severity === "warning" ? (
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
        <span className="font-medium">{item.label}</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {/* P&L value */}
        <div className="text-right">
          <div className="text-muted-foreground">P&L</div>
          <div className="font-mono">
            {item.field === "gpPercent"
              ? formatPercent(item.pnlValue)
              : formatSAR(item.pnlValue)}
          </div>
        </div>

        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />

        {/* Quote/SLA value */}
        <div className="text-right">
          <div className="text-muted-foreground">Quote</div>
          <div className="font-mono">
            {item.field === "gpPercent"
              ? formatPercent(item.slaValue)
              : formatSAR(item.slaValue)}
          </div>
        </div>

        {/* Delta badge */}
        <Badge
          variant="outline"
          className={`ml-1 font-mono text-xs ${
            item.severity === "critical"
              ? "border-red-300 text-red-700 bg-red-50"
              : item.severity === "warning"
                ? "border-amber-300 text-amber-700 bg-amber-50"
                : "border-emerald-300 text-emerald-700 bg-emerald-50"
          }`}
        >
          {isIncrease ? (
            <TrendingUp className="h-3 w-3 mr-1" />
          ) : (
            <TrendingDown className="h-3 w-3 mr-1" />
          )}
          {formatDeltaValue(item)}
          {item.field !== "gpPercent" && ` (${item.deltaPercent.toFixed(1)}%)`}
        </Badge>
      </div>
    </div>
  );
}

export function SlaVsPnlDeltaBanner({
  workspace,
  quote,
  pnl,
  onDeltaComputed,
}: SlaVsPnlDeltaBannerProps) {
  const report = useMemo(() => {
    const r = computeSlaVsPnlDelta(workspace, quote, pnl);
    onDeltaComputed?.(r);
    return r;
  }, [workspace, quote, pnl, onDeltaComputed]);

  // Don't render if no data to compare
  if (!quote || !pnl) return null;

  // Don't render if no deltas at all
  if (report.items.length === 0) return null;

  const hasCritical = report.hasBlockingDelta;
  const hasWarning = report.hasDelta && !hasCritical;

  return (
    <Card
      className={`${
        hasCritical
          ? "border-red-300 bg-red-50/30"
          : hasWarning
            ? "border-amber-300 bg-amber-50/30"
            : "border-emerald-300/50"
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {hasCritical ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : hasWarning ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            SLA vs P&L Delta Check
          </span>
          <Badge
            variant={hasCritical ? "destructive" : hasWarning ? "secondary" : "default"}
            className={
              hasCritical
                ? ""
                : hasWarning
                  ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                  : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            }
          >
            {hasCritical ? "BLOCKED" : hasWarning ? "WARNING" : "PASS"}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{report.summary}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {report.items.map((item) => (
          <DeltaRow key={item.field} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}
