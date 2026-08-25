/**
 * ProposalTrackerStrip — Visual 11-stage internal proposal tracker.
 *
 * This is SEPARATE from the CRM Pipeline milestone strip.
 * CRM = where the opportunity is commercially
 * This tracker = what internal work stage the proposal is in
 */
import { ChevronDown, Info, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROPOSAL_TRACKER_STAGES, getProposalStageIndex, type ProposalStage } from "./proposal-stages";

/**
 * Where the displayed stage came from. The strip is the human's statement of
 * "this proposal is here", so it must not present a placeholder, a value from
 * a previously opened proposal, or the aftermath of a failed read as if it
 * were the saved position. This disclosure never disables stage movement.
 */
export interface ProposalTrackerHydration {
  state: "loading" | "persisted" | "unrecorded" | "missing" | "error";
  message: string | null;
}

interface ProposalTrackerStripProps {
  activeStage: string;
  onStageChange: (key: string) => void;
  hydration?: ProposalTrackerHydration;
  onRetryHydration?: () => void;
  saving?: boolean;
}

export default function ProposalTrackerStrip({
  activeStage,
  onStageChange,
  hydration,
  onRetryHydration,
  saving = false,
}: ProposalTrackerStripProps) {
  const activeIdx = getProposalStageIndex(activeStage);
  const activeInfo = PROPOSAL_TRACKER_STAGES[activeIdx];
  const hydrationState = hydration?.state ?? "persisted";

  return (
    <Card className="border border-[#075eea]/20/60 shadow-none mb-3">
      <CardContent className="px-3 pb-3 pt-4 sm:px-6">
        {/* Persisted-truth disclosure — loading, unread and failed read are
            three visibly different answers, and none of them reads as saved. */}
        {hydrationState === "loading" && (
          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            Reading the saved internal stage from the commercial ticket…
          </div>
        )}
        {hydrationState === "error" && (
          <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Saved internal stage could not be read
            </p>
            <p className="mt-0.5 text-[10px] text-destructive/80">
              {hydration?.message} The stage shown below is a starting point, not the saved position.
            </p>
            {onRetryHydration && (
              <Button variant="outline" size="sm" onClick={onRetryHydration} className="mt-1.5 h-6 text-[10px]">
                Retry
              </Button>
            )}
          </div>
        )}
        {(hydrationState === "unrecorded" || hydrationState === "missing") && (
          <div className="mb-2 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-800">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{hydration?.message ?? "No internal stage is recorded on this ticket yet."}</span>
          </div>
        )}

        {/* Header row */}
        <div className="mb-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#075eea]">
              Internal Proposal Tracker
            </span>
            <Badge variant="outline" className="text-[9px] border-[#075eea]/20 text-[#075eea] bg-[#075eea]/10">
              Stage {activeIdx + 1} of {PROPOSAL_TRACKER_STAGES.length}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={saving || hydrationState === "loading" || hydrationState === "error"} variant="outline" size="sm" className="h-7 w-full gap-1 border-[#075eea]/20 text-xs text-[#075eea] hover:bg-[#075eea]/10 sm:w-auto">
                {saving ? "Saving Proposal Stage" : "Move Proposal Stage"} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              {PROPOSAL_TRACKER_STAGES.map((s, i) => (
                <DropdownMenuItem
                  key={s.key}
                  disabled={s.key === activeStage}
                  onClick={() => onStageChange(s.key)}
                  className="text-xs"
                >
                  <span className={`w-4 text-center text-[10px] font-bold ${i < activeIdx ? "text-emerald-500" : i === activeIdx ? "text-[#075eea]" : "text-muted-foreground/40"}`}>
                    {i + 1}
                  </span>
                  <span className="ml-2">{s.label}</span>
                  {s.key === activeStage && <Badge variant="outline" className="ml-auto text-[8px]">Current</Badge>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stage strip */}
        <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
          {PROPOSAL_TRACKER_STAGES.map((s, i) => {
            const isCurrent = s.key === activeStage;
            const isPast = i < activeIdx;
            const isNext = i === activeIdx + 1;

            return (
              <div key={s.key} className="flex items-center shrink-0">
                <button
                  disabled={saving || isCurrent || hydrationState === "loading" || hydrationState === "error"}
                  onClick={() => onStageChange(s.key)}
                  title={s.description}
                  className={`
                    relative flex flex-col items-center px-2.5 py-2 rounded-lg transition-all
                    ${isCurrent
                      ? "bg-[#075eea] text-white shadow-md cursor-default"
                      : isPast
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                        : isNext
                          ? "border border-dashed border-[#075eea]/30 text-[#0b73ff] hover:bg-[#075eea]/10 cursor-pointer"
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
                    {i + 1}
                  </div>
                  <span className={`text-[9px] font-medium whitespace-nowrap leading-none ${isCurrent ? "text-white font-semibold" : ""}`}>
                    {s.shortLabel}
                  </span>
                </button>

                {/* Connector */}
                {i < PROPOSAL_TRACKER_STAGES.length - 1 && (
                  <div className={`h-px w-3 shrink-0 ${i < activeIdx ? "bg-emerald-400" : "bg-muted-foreground/15"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Description */}
        {activeInfo && (
          <div className="flex items-start gap-1.5 mt-2 text-[10px] text-muted-foreground/70">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground/70">{activeInfo.label}:</strong>{" "}
              {activeInfo.description}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
