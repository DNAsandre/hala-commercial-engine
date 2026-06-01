/**
 * ProposalTrackerStrip — Visual 11-stage internal proposal tracker.
 *
 * This is SEPARATE from the CRM Pipeline milestone strip.
 * CRM = where the opportunity is commercially
 * This tracker = what internal work stage the proposal is in
 */
import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROPOSAL_TRACKER_STAGES, getProposalStageIndex, type ProposalStage } from "./proposal-stages";

interface ProposalTrackerStripProps {
  activeStage: string;
  onStageChange: (key: string) => void;
}

export default function ProposalTrackerStrip({ activeStage, onStageChange }: ProposalTrackerStripProps) {
  const activeIdx = getProposalStageIndex(activeStage);
  const activeInfo = PROPOSAL_TRACKER_STAGES[activeIdx];

  return (
    <Card className="border border-indigo-200/60 shadow-none mb-3">
      <CardContent className="pt-4 pb-3 px-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Internal Proposal Tracker
            </span>
            <Badge variant="outline" className="text-[9px] border-indigo-200 text-indigo-600 bg-indigo-50">
              Stage {activeIdx + 1} of {PROPOSAL_TRACKER_STAGES.length}
            </Badge>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                Move Proposal Stage <ChevronDown className="w-3 h-3" />
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
                  <span className={`w-4 text-center text-[10px] font-bold ${i < activeIdx ? "text-emerald-500" : i === activeIdx ? "text-indigo-600" : "text-muted-foreground/40"}`}>
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
                  onClick={() => onStageChange(s.key)}
                  title={s.description}
                  className={`
                    relative flex flex-col items-center px-2.5 py-2 rounded-lg transition-all
                    ${isCurrent
                      ? "bg-indigo-600 text-white shadow-md cursor-default"
                      : isPast
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                        : isNext
                          ? "border border-dashed border-indigo-300 text-indigo-500 hover:bg-indigo-50 cursor-pointer"
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
