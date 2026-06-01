/**
 * ExecutiveStrip — Reusable executive cognition gauge strip.
 * Renders 4 indicators + next action + stage-filtered active signals.
 */
import { Button } from "@/components/ui/button";
import { ChevronRight, AlertTriangle, Info } from "lucide-react";

export type IndicatorType = "progress" | "gauge" | "counter" | "status";

export interface StripIndicator {
  label: string;
  type: IndicatorType;
  value: number;
  displayValue?: string;
}

export interface StripSignal {
  type: "warning" | "info" | "critical";
  message: string;
  recommendation: string;
}

interface ExecutiveStripProps {
  indicators: StripIndicator[];
  nextAction: string;
  signals?: StripSignal[];
  onNextAction?: () => void;
}

const gaugeColor = (v: number) =>
  v >= 70 ? "text-emerald-600" : v >= 40 ? "text-amber-600" : "text-red-500";
const gaugeBar = (v: number) =>
  v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-red-400";
const gaugeBg = (v: number) =>
  v >= 70 ? "border-emerald-200 bg-emerald-50/50" : v >= 40 ? "border-amber-200 bg-amber-50/50" : "border-red-200 bg-red-50/50";

export default function ExecutiveStrip({ indicators, nextAction, signals = [], onNextAction }: ExecutiveStripProps) {
  return (
    <div className="space-y-2 mb-4">
      {/* 4-indicator strip */}
      <div className="grid grid-cols-4 gap-2">
        {indicators.map(ind => (
          <div key={ind.label} className={`rounded-lg border p-2.5 ${ind.type === "gauge" ? gaugeBg(ind.value) : "border-border bg-muted/10"}`}>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{ind.label}</p>
            {ind.type === "progress" && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${gaugeBar(ind.value)}`} style={{ width: `${ind.value}%` }} />
                </div>
                <span className={`text-xs font-bold ${gaugeColor(ind.value)}`}>{ind.value}%</span>
              </div>
            )}
            {ind.type === "gauge" && (
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${gaugeBar(ind.value)}`} />
                <span className={`text-sm font-bold ${gaugeColor(ind.value)}`}>
                  {ind.displayValue ?? (ind.value >= 70 ? "Good" : ind.value >= 40 ? "Fair" : "Risk")}
                </span>
              </div>
            )}
            {ind.type === "counter" && (
              <span className="text-lg font-bold">{ind.displayValue ?? ind.value}</span>
            )}
            {ind.type === "status" && (
              <span className={`text-xs font-bold ${ind.value >= 70 ? "text-emerald-600" : ind.value >= 40 ? "text-amber-600" : "text-muted-foreground"}`}>
                {ind.displayValue ?? (ind.value >= 70 ? "Active" : ind.value >= 40 ? "Pending" : "Not Started")}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Single next action */}
      <Button variant="outline" size="sm" className="w-full h-8 text-[11px] font-medium border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-700" onClick={onNextAction}>
        <ChevronRight className="w-3.5 h-3.5 mr-1.5" />
        {nextAction}
      </Button>

      {/* Active Signals — stage-filtered */}
      {signals.length > 0 && (
        <div className="space-y-1">
          {signals.map((s, i) => (
            <div key={i} className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10px] ${
              s.type === "critical" ? "border-red-200 bg-red-50" : s.type === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
            }`}>
              {s.type === "critical" || s.type === "warning"
                ? <AlertTriangle className={`w-3 h-3 shrink-0 ${s.type === "critical" ? "text-red-500" : "text-amber-500"}`} />
                : <Info className="w-3 h-3 shrink-0 text-blue-500" />}
              <span className="font-medium">{s.message}</span>
              <span className="text-muted-foreground ml-auto">→ {s.recommendation}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
