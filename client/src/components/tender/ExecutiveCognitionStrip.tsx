/**
 * ExecutiveCognitionStrip
 * Sprint 1.5 — Tender Executive Cognition Layer
 *
 * Persistent 4-indicator strip at the top of Tender Workspace.
 * Always visible. Executive-reads in one glance.
 *
 * Indicators:
 * 1. Tender Readiness    — progress bar
 * 2. Deadline Pressure  — timer/gauge
 * 3. Margin Health      — gauge
 * 4. Submission Readiness — status/gauge
 *
 * Doctrine: flag → explain → recommend. No blocks. No gates.
 */
import { BarChart3, Clock, TrendingUp, ZapOff, CheckCircle2, AlertTriangle } from "lucide-react";
import type { TenderWorkspace } from "@/lib/tender-workspace-data";

interface Props {
  ws: TenderWorkspace;
  daysLeft: number;
  targetGp: number;
  signalCount: number;
}

function gaugeColor(pct: number, thresholds: [number, number]) {
  if (pct >= thresholds[0]) return "text-emerald-600";
  if (pct >= thresholds[1]) return "text-amber-600";
  return "text-red-600";
}

function deadlineColor(days: number) {
  if (days > 14) return "text-emerald-600";
  if (days > 0) return "text-amber-600";
  return "text-red-600";
}

function MarginGauge({ gp }: { gp: number }) {
  const pct = Math.min(gp, 40);
  const color = gaugeColor(gp, [25, 18]);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">GP%</span>
        <span className={`text-xs font-bold font-mono ${color}`}>{gp}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${gp >= 25 ? "bg-emerald-500" : gp >= 18 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${(pct / 40) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SubmissionGauge({ ws, signalCount }: { ws: TenderWorkspace; signalCount: number }) {
  const docsReady = ws.packs.reduce((s, p) => s + p.documentsReady, 0);
  const docsTotal = ws.packs.reduce((s, p) => s + p.documentsTotal, 0);
  const placeholderTotal = ws.packs.reduce((s, p) => s + p.placeholdersTotal, 0);
  const placeholderPopulated = ws.packs.reduce((s, p) => s + p.placeholdersPopulated, 0);
  const total = docsTotal + placeholderTotal;
  const ready = docsReady + placeholderPopulated;
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const color = gaugeColor(pct, [80, 50]);
  const signalRisk = signalCount > 3 ? "text-red-600" : signalCount > 0 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">Submission</span>
        <div className="flex items-center gap-1">
          {signalCount > 0 && <span className={`text-[9px] font-bold ${signalRisk}`}>{signalCount}s</span>}
          <span className={`text-xs font-bold font-mono ${color}`}>{pct}%</span>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ExecutiveCognitionStrip({ ws, daysLeft, targetGp, signalCount }: Props) {
  const readinessPct = ws.readinessScore;
  const readinessColor = gaugeColor(readinessPct, [80, 50]);
  const deadlineRisk = deadlineColor(daysLeft);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
      {/* 1. Tender Readiness */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Tender Readiness</span>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex-1 mr-2">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${readinessPct >= 80 ? "bg-emerald-500" : readinessPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${readinessPct}%` }}
              />
            </div>
          </div>
          <span className={`text-sm font-bold font-mono ${readinessColor}`}>{readinessPct}%</span>
        </div>
        <span className={`text-[9px] ${readinessColor}`}>
          {readinessPct >= 80 ? "On Track" : readinessPct >= 50 ? "In Progress" : "Action Required"}
        </span>
      </div>

      {/* 2. Deadline Pressure */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Deadline</span>
        </div>
        <div className="flex items-end justify-between">
          <span className={`text-sm font-bold font-mono ${deadlineRisk}`}>
            {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? "Today" : "Overdue"}
          </span>
          <Clock className={`w-4 h-4 ${deadlineRisk}`} />
        </div>
        <span className={`text-[9px] ${deadlineRisk}`}>
          {daysLeft > 14 ? "On Track" : daysLeft > 0 ? "Urgent" : "Overdue"}
        </span>
      </div>

      {/* 3. Margin Health */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Margin Health</span>
        </div>
        <MarginGauge gp={targetGp} />
        <span className={`text-[9px] ${gaugeColor(targetGp, [25, 18])}`}>
          {targetGp >= 25 ? "Healthy" : targetGp >= 18 ? "Tight" : "Review"}
        </span>
      </div>

      {/* 4. Submission Readiness */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <ZapOff className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Submission</span>
        </div>
        <SubmissionGauge ws={ws} signalCount={signalCount} />
        <span className={`text-[9px] ${signalCount > 3 ? "text-red-600" : signalCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
          {signalCount > 3 ? "High Risk" : signalCount > 0 ? "Review" : "Ready"}
        </span>
      </div>
    </div>
  );
}