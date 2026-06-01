/**
 * StageAwareIndicatorPanel
 * Sprint 1.5 — Tender Executive Cognition Layer
 *
 * Shows stage-aware indicators when user clicks an internal tender stage.
 * Max 4 visual indicators + max 3 advisory signals + 1 next best action.
 *
 * Uses existing tender workspace data only.
 * Falls back to neutral/unknown when data is not available.
 *
 * Doctrine: flag → explain → recommend. No blocks. No gates.
 */
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, BarChart3, FileCheck2, ZapOff, ShieldAlert, FileText, Users, Eye, Info } from "lucide-react";
import type { TenderWorkspace, TenderMockGate } from "@/lib/tender-workspace-data";

// ─── Indicator helpers ──────────────────────────────────────

function ProgressBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold font-mono ${color}`}>{value}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Gauge({ value, label, unit = "%", color }: { value: number; label: string; unit?: string; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className={`text-xs font-bold font-mono ${color}`}>{value}{unit}</span>
      </div>
    </div>
  );
}

function StatusChip({ label, state, color }: { label: string; state: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Badge variant="outline" className={`text-[9px] ${color}`}>{state}</Badge>
    </div>
  );
}

function NumericBadge({ label, value, suffix = "", color }: { label: string; value: number; suffix?: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`text-xs font-bold font-mono ${color}`}>{value}{suffix}</span>
    </div>
  );
}

// ─── Signal builder ─────────────────────────────────────────

import { buildStageConfig, type Signal, type Indicator } from "@/lib/tender-stage-config";

// ─── Signal row ─────────────────────────────────────────────

function SignalRow({ signal }: { signal: Signal }) {
  const severityColor: Record<string, string> = {
    critical: "border-red-300 bg-red-50",
    high: "border-red-200 bg-red-50/50",
    warning: "border-amber-200 bg-amber-50/50",
    info: "border-blue-200 bg-blue-50/50",
  };
  const badgeColor: Record<string, string> = {
    critical: "text-red-700 bg-red-100 border-red-300",
    high: "text-red-600 bg-red-50 border-red-200",
    warning: "text-amber-700 bg-amber-50 border-amber-200",
    info: "text-blue-700 bg-blue-50 border-blue-200",
  };
  return (
    <div className={`p-2 rounded-md border ${severityColor[signal.severity]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-foreground">{signal.title}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{signal.reason}</p>
          <p className="text-[9px] text-amber-700 mt-0.5">→ {signal.recommendation}</p>
        </div>
        <Badge variant="outline" className={`text-[8px] shrink-0 ${badgeColor[signal.severity]}`}>{signal.severity}</Badge>
      </div>
    </div>
  );
}

// ─── Indicator renderer ──────────────────────────────────────

function IndicatorRow({ ind }: { ind: Indicator }) {
  switch (ind.type) {
    case "progress": return <ProgressBar value={ind.value} label={ind.label} color={ind.color} />;
    case "gauge": return <Gauge value={ind.value} label={ind.label} unit={ind.unit} color={ind.color} />;
    case "status": return <StatusChip label={ind.label} state={ind.state} color={ind.color} />;
    case "numeric": return <NumericBadge label={ind.label} value={ind.value} suffix={ind.suffix} color={ind.color} />;
    case "unknown": return (
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{ind.label}</span>
        <Badge variant="outline" className="text-[9px] text-slate-500 bg-slate-50 border-slate-200">Not Available</Badge>
      </div>
    );
  }
}

// ─── MAIN COMPONENT ─────────────────────────────────────────

interface Props {
  ws: TenderWorkspace;
  stageValue: string;
  stageLabel: string;
}

export default function StageAwareIndicatorPanel({ ws, stageValue, stageLabel }: Props) {
  const config = useMemo(() => buildStageConfig(ws, stageValue), [ws, stageValue]);

  return (
    <div className="space-y-3">
      {/* Stage header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Stage Indicators:</span>
        <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-700 bg-amber-50">{stageLabel}</Badge>
      </div>

      {/* Indicators grid */}
      <div className="grid grid-cols-2 gap-2">
        {config.indicators.map((ind, i) => (
          <div key={i} className="bg-muted/20 rounded-lg p-2.5">
            <IndicatorRow ind={ind} />
          </div>
        ))}
      </div>

      {/* Advisory signals */}
      {config.signals.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Advisory Signals</p>
          {config.signals.map((sig, i) => (
            <SignalRow key={i} signal={sig} />
          ))}
        </div>
      )}

      {/* Next Best Action */}
      <div className="p-2 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <p className="text-[10px] text-amber-800 font-medium">{config.nextAction}</p>
      </div>
    </div>
  );
}