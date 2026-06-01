/**
 * PreviousStageIntelligence — Read-only Summary Panel
 *
 * Displays actual saved data from prior stages:
 * - SOW Qualification
 * - Technical Qualification
 * - Customer Fit
 * - Risk Snapshot
 * - Global Documents
 *
 * If data is missing, shows "Not captured".
 * Does NOT infer, generate, or invent values.
 * Does NOT write to database.
 * Does NOT call AI.
 * Pure read-only component.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { isMeaningfulTenderValue } from "@/lib/proposal-block-foundation";
import {
  ChevronDown, ChevronRight, Brain, CheckCircle2, AlertCircle,
  FileText, Shield, Users, ClipboardList, Target,
} from "lucide-react";

interface Props {
  ws: TenderWorkspace;
}

function extractStatus(data: any, key: string): string {
  if (!data || typeof data !== "object") return "Not captured";
  const rec = data.recommendation || data.outcome;
  if (rec && typeof rec === "object") {
    const val = rec.outcome || rec.recommendation;
    if (val && val !== "Not decided" && val !== "Not Decided") return val;
  }
  return "Captured — no recommendation yet";
}

function countAssessedRows(data: any, arrayKey: string, statusKey: string, defaultStatus: string): { assessed: number; total: number } {
  if (!data || typeof data !== "object") return { assessed: 0, total: 0 };
  const arr = data[arrayKey];
  if (!Array.isArray(arr)) return { assessed: 0, total: 0 };
  const total = arr.length;
  const assessed = arr.filter((r: any) => r[statusKey] && r[statusKey] !== defaultStatus).length;
  return { assessed, total };
}

function countItems(data: any, arrayKey: string): number {
  if (!data || typeof data !== "object") return 0;
  const arr = data[arrayKey];
  return Array.isArray(arr) ? arr.length : 0;
}

export default function PreviousStageIntelligence({ ws }: Props) {
  const [open, setOpen] = useState(false);
  const t = ws.tender;
  const sowQ = t.sowQualificationData as any;
  const techQ = t.technicalQualificationData as any;
  const custF = t.customerFitData as any;
  const riskS = t.riskSnapshotData as any;
  const docs = ws.documents || [];

  // SOW Qualification — use isMeaningfulTenderValue to avoid false positives from saved defaults
  const sowExists = !!sowQ && isMeaningfulTenderValue(sowQ);
  const sowStatus = sowExists ? extractStatus(sowQ, "outcome") : "Not captured";
  const sowCoverage = sowExists ? countAssessedRows(sowQ, "coverage_matrix", "status", "Not Assessed") : { assessed: 0, total: 0 };
  const sowClarifications = sowExists ? countItems(sowQ, "clarifications") : 0;

  // Technical Qualification
  const techExists = !!techQ && isMeaningfulTenderValue(techQ);
  const techStatus = techExists ? extractStatus(techQ, "recommendation") : "Not captured";
  const techCapability = techExists ? countAssessedRows(techQ, "capability_assessment", "fit", "Not Assessed") : { assessed: 0, total: 0 };
  const techGaps = techExists ? countItems(techQ, "gaps") : 0;

  // Customer Fit
  const custExists = !!custF && isMeaningfulTenderValue(custF);
  const custStatus = custExists ? extractStatus(custF, "recommendation") : "Not captured";
  const custDimensions = custExists ? countAssessedRows(custF, "dimensions", "assessment", "Not Assessed") : { assessed: 0, total: 0 };

  // Risk Snapshot
  const riskExists = !!riskS && isMeaningfulTenderValue(riskS);
  const riskStatus = riskExists ? extractStatus(riskS, "recommendation") : "Not captured";
  const riskCount = riskExists ? countItems(riskS, "register") : 0;
  const bidBlockers = riskExists && Array.isArray(riskS.register)
    ? riskS.register.filter((r: any) => r.bid_blocker === true).length : 0;
  const riskClarifications = riskExists ? countItems(riskS, "clarifications") : 0;

  // Documents
  const sourceDocsCount = docs.filter(d => d.document_category === "Source").length;
  const supportingDocsCount = docs.filter(d => d.document_category === "Supporting").length;

  // Bid / No-Bid
  const bnb = t.bidNoBidData as any;
  const bnbExists = !!bnb && isMeaningfulTenderValue(bnb);
  const bidDecision = bnbExists ? (bnb.decision?.decision || bnb.decision_record?.formal?.decision || "Not decided") : "Not captured";
  const winStrategyExists = bnbExists && !!bnb.win_strategy && isMeaningfulTenderValue(bnb.win_strategy);
  const winThemeCount = winStrategyExists && Array.isArray(bnb.win_strategy?.win_themes) ? bnb.win_strategy.win_themes.length : 0;

  const rows: { icon: typeof Brain; label: string; status: string; detail?: string; captured: boolean }[] = [
    {
      icon: CheckCircle2,
      label: "Bid / No-Bid Decision",
      status: bidDecision,
      detail: bnbExists ? `Decision: ${bidDecision}` : undefined,
      captured: bnbExists,
    },
    {
      icon: Target,
      label: "Win Strategy",
      status: winStrategyExists ? `${winThemeCount} win themes` : "Not captured",
      detail: winStrategyExists ? `${winThemeCount} themes captured` : undefined,
      captured: winStrategyExists,
    },
    {
      icon: ClipboardList,
      label: "SOW Qualification",
      status: sowStatus,
      detail: sowExists ? `${sowCoverage.assessed}/${sowCoverage.total} areas assessed · ${sowClarifications} clarifications` : undefined,
      captured: sowExists,
    },
    {
      icon: Target,
      label: "Technical Qualification",
      status: techStatus,
      detail: techExists ? `${techCapability.assessed}/${techCapability.total} assessed · ${techGaps} gaps` : undefined,
      captured: techExists,
    },
    {
      icon: Users,
      label: "Customer Fit",
      status: custStatus,
      detail: custExists ? `${custDimensions.assessed}/${custDimensions.total} dimensions assessed` : undefined,
      captured: custExists,
    },
    {
      icon: Shield,
      label: "Risk Snapshot",
      status: riskStatus,
      detail: riskExists ? `${riskCount} risks · ${bidBlockers} bid blockers · ${riskClarifications} clarifications` : undefined,
      captured: riskExists,
    },
    {
      icon: FileText,
      label: "Documents",
      status: docs.length > 0 ? `${docs.length} documents` : "No documents",
      detail: `${sourceDocsCount} source · ${supportingDocsCount} supporting`,
      captured: docs.length > 0,
    },
  ];

  return (
    <Card className="border-border shadow-none mb-4">
      <CardHeader className="pb-2 border-b border-border bg-muted/20">
        <button
          type="button"
          className="flex items-center gap-2 w-full text-left group"
          onClick={() => setOpen(!open)}
        >
          {open
            ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground" />
          }
          <Brain className="w-3.5 h-3.5 text-violet-600" />
          <span className="text-xs font-semibold group-hover:text-foreground transition-colors">
            Previous Stage Intelligence
          </span>
          <Badge variant="outline" className="text-[8px] ml-auto">
            {rows.filter(r => r.captured).length}/{rows.length} captured
          </Badge>
        </button>
        {!open && (
          <p className="text-[10px] text-muted-foreground mt-1 pl-[30px]">
            Summary of actual data captured in prior stages. Informational only — does not block decisions.
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="p-3 space-y-1.5">
          {rows.map(row => (
            <div key={row.label} className="flex items-start gap-2.5 px-2 py-2 rounded-md border border-border bg-card">
              <row.icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${row.captured ? "text-violet-500" : "text-muted-foreground/40"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{row.label}</span>
                  {row.captured ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                  )}
                </div>
                <p className={`text-[10px] mt-0.5 ${row.captured ? "text-foreground/70" : "text-muted-foreground"}`}>
                  {row.status}
                </p>
                {row.detail && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">{row.detail}</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
