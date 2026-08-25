/**
 * TenderSummaryTab - Identified Stage, Stage Task 1.
 *
 * Data sources: current tender workspace and tender-local packs.
 * Persistent state comes from the current tender workspace only.
 */

import { useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { getTenderLocalCustomerLink } from "@/lib/tender-local-intelligence";
import {
  AlertCircle,
  CalendarClock,
  ClipboardList,
  Database,
  DollarSign,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { formatSAR } from "@/lib/store";
import {
  IdentifiedSectionCard,
  IdentifiedStageShell,
  type IdentifiedStageMetric,
  type IdentifiedSectionTab,
} from "./IdentifiedStageShared";

type SectionKey = "intake" | "signals";

const SECTION_TABS: IdentifiedSectionTab<SectionKey>[] = [
  { key: "intake", label: "Tender Intake Summary", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "signals", label: "Advisory Readiness Signals", icon: <AlertCircle className="w-3.5 h-3.5" /> },
];

interface Props {
  ws: TenderWorkspace;
  reload?: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

export default function TenderSummaryTab({ ws, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender;
  const customerLink = getTenderLocalCustomerLink(ws);

  const [activeSection, setActiveSection] = useState<SectionKey>("intake");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const daysLeft = t.submissionDeadline
    ? Math.ceil((new Date(t.submissionDeadline).getTime() - Date.now()) / 86400000)
    : null;
  const criticalSignals = ws.packs.reduce((sum, p) => sum + (p.readinessBreakdown?.readiness_signals ?? 0), 0);
  const signalEvidenceAvailable = ws.packs.some(p => typeof p.readinessBreakdown?.readiness_signals === "number");
  const deadlinePressure = daysLeft !== null && daysLeft <= 7;
  const targetGpPercent = t.targetGpPercent ?? 0;
  const needsAttention = signalEvidenceAvailable && (criticalSignals > 0 || deadlinePressure);

  const intelMetrics: IdentifiedStageMetric[] = [
    { label: "Tender Title", value: t.title || "Not captured" },
    { label: "Customer", value: t.customerName || "Not captured" },
    { label: "Estimated Value", value: t.estimatedValue ? formatSAR(t.estimatedValue) : "Not captured" },
    { label: "Target GP", value: targetGpPercent ? `${targetGpPercent}%` : "Not captured" },
    { label: "Days Left", value: daysLeft !== null ? `${daysLeft} days` : "Not captured" },
  ];

  return (
    <IdentifiedStageShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={SECTION_TABS}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      metrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
    >
      <IdentifiedSectionCard
        title="Tender Intake Summary"
        icon={<FileText className="w-3.5 h-3.5 text-[#075eea]" />}
        hidden={activeSection !== "intake"}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tender Title & ID</p>
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="bg-slate-100 font-mono text-[10px] text-slate-600">{t.id}</Badge>
                <Badge variant="outline" className="bg-slate-50 text-[10px]">{ws.tenderType || "Unknown"}</Badge>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source & Pipeline Origin</p>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">{t.source || "Not available"}</span>
                {customerLink.hasCustomerIdentity && (
                  <Badge variant="outline" className="ml-2 border-emerald-300 bg-emerald-50 text-[10px] text-emerald-700">
                    {customerLink.matchStatusLabel}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Commercial Targets</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" /> Value
                  </div>
                  <span className="text-sm font-bold">{t.estimatedValue ? formatSAR(t.estimatedValue) : "Not available"}</span>
                </div>
                <div>
                  <div className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" /> Target GP
                  </div>
                  <span className={`text-sm font-bold ${targetGpPercent >= 20 ? "text-emerald-700" : "text-amber-700"}`}>
                    {targetGpPercent ? `${targetGpPercent}%` : "Not available"}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Submission Timeline</p>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium">{t.submissionDeadline || "Not captured yet"}</span>
                {daysLeft !== null && (
                  <span className={`ml-2 text-xs ${daysLeft <= 7 ? "font-bold text-red-600" : daysLeft <= 14 ? "font-medium text-amber-600" : "text-emerald-600"}`}>
                    ({daysLeft > 0 ? `${daysLeft} days remaining` : "Deadline passed"})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </IdentifiedSectionCard>

      <IdentifiedSectionCard
        title="Advisory Readiness Signals"
        icon={<AlertCircle className="w-3.5 h-3.5 text-[#075eea]" />}
        badge={!signalEvidenceAvailable ? "Not recorded" : needsAttention ? "Action Required" : "Stable"}
        hidden={activeSection !== "signals"}
      >
        <div className={`rounded-lg border ${!signalEvidenceAvailable ? "border-slate-200 bg-slate-50/30" : needsAttention ? "border-amber-200 bg-amber-50/20" : "border-emerald-200 bg-emerald-50/20"}`}>
          <CardContent className="p-4">
            <h3 className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${!signalEvidenceAvailable ? "text-slate-700" : needsAttention ? "text-amber-800" : "text-emerald-800"}`}>
              <AlertCircle className="h-4 w-4" />
              Advisory Readiness Signals
            </h3>
            <ul className={`list-inside list-disc space-y-1 text-xs ${!signalEvidenceAvailable ? "text-slate-600" : needsAttention ? "text-amber-700" : "text-emerald-700"}`}>
              {!signalEvidenceAvailable && <li className="list-none">No readiness-signal record exists for this tender yet. This panel does not infer a stable result.</li>}
              {criticalSignals > 0 && <li><strong>Signal Review Required:</strong> {criticalSignals} active readiness signals flagged for review in this workspace.</li>}
              {deadlinePressure && <li><strong>Deadline Pressure:</strong> Submission due in {daysLeft} days. Expedite qualification tasks.</li>}
              {signalEvidenceAvailable && criticalSignals === 0 && !deadlinePressure && <li className="list-none">Recorded readiness signals show no severe item for review.</li>}
            </ul>
          </CardContent>
        </div>
      </IdentifiedSectionCard>
    </IdentifiedStageShell>
  );
}
