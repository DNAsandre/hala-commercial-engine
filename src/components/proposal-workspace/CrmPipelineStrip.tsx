/**
 * CrmPipelineStrip — TOP TRACKER showing the 10 CRM pipeline stages.
 *
 * This is SEPARATE from the Internal Proposal Tracker (ProposalTrackerStrip).
 * CRM Pipeline Stage = where the deal is in the CRM pipeline (parent layer)
 * Internal Proposal Stage = where the internal work is (child layer)
 *
 * These two trackers are completely independent.
 * Moving CRM stage does NOT move internal proposal stage and vice versa.
 */
import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CRMStage } from "@/lib/store";

// ═══════════════════════════════════════════════════════════
// CRM PIPELINE STAGES — the 10 approved CRM stages
// ═══════════════════════════════════════════════════════════

export const CRM_PIPELINE_STAGES: {
  key: CRMStage;
  label: string;
  shortLabel: string;
  terminal?: boolean;
}[] = [
  { key: "prospecting",            label: "Prospecting",          shortLabel: "Prospect" },
  { key: "qualified",              label: "Qualified",            shortLabel: "Qual" },
  { key: "proposal_sent",           label: "Proposal Sent",         shortLabel: "Sent" },
  { key: "shortlisted",             label: "Shortlisted",          shortLabel: "Short" },
  { key: "contract_negotiation",    label: "Contract Negotiation", shortLabel: "Negot" },
  { key: "closed_won",              label: "Closed Won",             shortLabel: "Won" },
  { key: "contract_signed",         label: "Contract Signed",      shortLabel: "Signed" },
  { key: "actual_go_live",          label: "Actual Go Live",       shortLabel: "Live" },
  { key: "closed_lost",              label: "Closed Lost",          shortLabel: "Lost",   terminal: true },
  { key: "discontinued",            label: "Discontinued",         shortLabel: "Disc",   terminal: true },
];

// Non-terminal stages for the linear strip
const STRIP_STAGES = CRM_PIPELINE_STAGES.filter(s => !s.terminal);
// Terminal exit stages
const TERMINAL_STAGES = CRM_PIPELINE_STAGES.filter(s => s.terminal);

export function getCrmStageLabel(stage: CRMStage): string {
  return CRM_PIPELINE_STAGES.find(s => s.key === stage)?.label ?? stage;
}

/** Convert saved labels and legacy title-case values to the CRM tracker key. */
export function normalizeCrmStageKey(value: string | null | undefined): CRMStage | null {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!token) return null;
  const stage = CRM_PIPELINE_STAGES.find((candidate) =>
    candidate.key === token ||
    candidate.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") === token,
  );
  return stage?.key ?? null;
}

// ═══════════════════════════════════════════════════════════

interface CrmPipelineStripProps {
  activeCrmStage: CRMStage;
  crmDealId?: string;
  onCrmStageChange: (stage: CRMStage) => void;
  saving?: boolean;
}

export default function CrmPipelineStrip({ activeCrmStage, crmDealId, onCrmStageChange, saving = false }: CrmPipelineStripProps) {
  const isTerminal = TERMINAL_STAGES.some(s => s.key === activeCrmStage);
  const activeIdx = STRIP_STAGES.findIndex(s => s.key === activeCrmStage);

  return (
    <Card className="mb-3 gap-0 overflow-hidden border border-emerald-200/60 py-0 shadow-none">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-emerald-200/70 bg-emerald-50/80 px-6 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              CRM Pipeline Stage
            </span>
            {crmDealId && (
              <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600 bg-emerald-50 gap-1">
                <ExternalLink className="w-2.5 h-2.5" />
                {crmDealId}
              </Badge>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={saving} size="sm" className="text-xs h-7 gap-1 bg-emerald-600 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md active:translate-y-0 active:bg-emerald-800">
                {saving ? "Saving CRM Stage" : "Move CRM Stage"} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              {STRIP_STAGES.map((s, i) => (
                <DropdownMenuItem
                  key={s.key}
                  disabled={s.key === activeCrmStage}
                  onClick={() => onCrmStageChange(s.key)}
                  className="text-xs"
                >
                  <span className={`w-4 text-center text-[10px] font-bold ${
                    !isTerminal && i < activeIdx ? "text-emerald-500" : i === activeIdx && !isTerminal ? "text-emerald-700" : "text-muted-foreground/40"
                  }`}>
                    {i + 1}
                  </span>
                  <span className="ml-2">{s.label}</span>
                  {s.key === activeCrmStage && <Badge variant="outline" className="ml-auto text-[8px]">Current</Badge>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {TERMINAL_STAGES.map(s => (
                <DropdownMenuItem
                  key={s.key}
                  disabled={s.key === activeCrmStage}
                  onClick={() => onCrmStageChange(s.key)}
                  className="text-xs text-red-600"
                >
                  <span className="ml-6">{s.label}</span>
                  {s.key === activeCrmStage && <Badge variant="outline" className="ml-auto text-[8px] border-red-200 text-red-600">Current</Badge>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Strip — 8 linear stages + terminal exits */}
        <div className="px-6 py-2.5">
        <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
          {STRIP_STAGES.map((s, i) => {
            const isCurrent = s.key === activeCrmStage && !isTerminal;
            const isPast = !isTerminal && i < activeIdx;
            const isNext = !isTerminal && i === activeIdx + 1;

            return (
              <div key={s.key} className="flex items-center shrink-0">
                <button
                  disabled={saving || isCurrent}
                  onClick={() => onCrmStageChange(s.key)}
                  title={s.label}
                  className={`
                    relative flex flex-col items-center px-2.5 py-1.5 rounded-lg transition-all
                    ${isCurrent
                      ? "bg-emerald-600 text-white shadow-md cursor-default"
                      : isPast
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                        : isNext
                          ? "border border-dashed border-emerald-300 text-emerald-500 hover:bg-emerald-50 cursor-pointer"
                          : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40 cursor-pointer"
                    }
                  `}
                >
                  {/* Stage number dot */}
                  <div className={`
                    w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold mb-1
                    ${isCurrent
                      ? "bg-white/20 text-white"
                      : isPast
                        ? "bg-emerald-200 text-emerald-700"
                        : "bg-muted/60 text-muted-foreground/60"
                    }
                  `}>
                    {isPast ? "✓" : i + 1}
                  </div>
                  <span className={`text-[9px] font-medium whitespace-nowrap leading-none ${isCurrent ? "text-white font-semibold" : ""}`}>
                    {s.shortLabel}
                  </span>
                </button>

                {/* Connector */}
                {i < STRIP_STAGES.length - 1 && (
                  <div className={`h-px w-3 shrink-0 ${isPast ? "bg-emerald-400" : "bg-muted-foreground/15"}`} />
                )}
              </div>
            );
          })}

          {/* Terminal states — separated visually */}
          <div className="ml-3 flex items-center gap-1">
            <div className="h-4 w-px bg-border mx-1" />
            {TERMINAL_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => onCrmStageChange(s.key)}
                className={`px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all cursor-pointer ${
                  s.key === activeCrmStage
                    ? "bg-red-100 text-red-700 shadow-sm"
                    : "text-red-400/60 hover:bg-red-50 hover:text-red-600"
                }`}
              >
                {s.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Active stage label */}
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          CRM Pipeline: <strong className="text-foreground/70">{getCrmStageLabel(activeCrmStage)}</strong>
          {isTerminal && <span className="ml-1 text-red-500 font-semibold">(Terminal)</span>}
        </p>
        </div>
      </CardContent>
    </Card>
  );
}
