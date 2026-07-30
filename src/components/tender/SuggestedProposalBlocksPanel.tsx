/**
 * SuggestedProposalBlocksPanel — Proposal readiness component
 *
 * Shows what proposal blocks a given stage can support from captured tender data.
 *
 * This is a read-only visibility component.
 *
 * It does NOT:
 *   - Generate AI content
 *   - Save blocks
 *   - Write doc_instances
 *   - Modify discontinued document tooling
 *   - Create drafts
 *   - Export documents
 *   - Move tender or CRM stage
 *   - Invent data
 *
 * It reads actual tender/workspace data and displays:
 *   - Mapped proposal blocks for this stage
 *   - Readiness status (Not Ready / Ready to Draft)
 *   - Missing required data fields
 *   - Available data fields
 *   - Target document assembly block types (informational only)
 *   - Proposal output use
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ChevronRight, Layers, CheckCircle2,
  AlertCircle, ArrowRight, FileText, Info,
} from "lucide-react";
import {
  type StageKey,
  type BlockReadinessResult,
  getStageMappings,
  getStageContract,
  evaluateProposalBlockReadiness,
} from "@/lib/proposal-block-foundation";

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

interface Props {
  stageKey: StageKey;
  tenderData: any;
  compact?: boolean;
}

export default function SuggestedProposalBlocksPanel({ stageKey, tenderData, compact }: Props) {
  const [open, setOpen] = useState(false);

  const contract = useMemo(() => getStageContract(stageKey), [stageKey]);
  const mappings = useMemo(() => getStageMappings(stageKey), [stageKey]);
  const results = useMemo(
    () => mappings.map(m => evaluateProposalBlockReadiness(m, tenderData)),
    [mappings, tenderData],
  );

  // If no mappings exist for this stage, don't render at all
  if (mappings.length === 0) return null;

  const readyCount = results.filter(r => r.ready).length;
  const totalCount = results.length;

  return (
    <Card className="border-border shadow-none mt-4">
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
          <Layers className="w-3.5 h-3.5 text-[#075eea]" />
          <span className="text-xs font-semibold group-hover:text-foreground transition-colors">
            Proposal Block Readiness
          </span>
          <Badge variant="outline" className="text-[8px] ml-auto">
            {readyCount}/{totalCount} ready
          </Badge>
        </button>
        {!open && (
          <p className="text-[10px] text-muted-foreground mt-1 pl-[30px]">
            Proposal sections supported by the data captured in this stage.
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="p-4 space-y-3">
          {/* Subtitle */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg border border-blue-200/60 bg-blue-50/40">
            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-700 font-medium">Proposal Block Readiness</p>
              <p className="text-[9px] text-blue-600/70 mt-0.5">
                Shows which proposal sections this stage can support from captured tender data.
              </p>
            </div>
          </div>

          {/* Stage contract summary */}
          {contract && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className="text-sm font-bold font-mono">{contract.capturedDataKeys.length}</p>
                <p className="text-[9px] text-muted-foreground">Data fields</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className="text-sm font-bold font-mono">{contract.requiredDataKeys.length}</p>
                <p className="text-[9px] text-muted-foreground">Required</p>
              </div>
              <div className="rounded-lg border border-border p-2 bg-card">
                <p className="text-sm font-bold font-mono">{contract.outputsCreated.length}</p>
                <p className="text-[9px] text-muted-foreground">Outputs</p>
              </div>
            </div>
          )}

          {/* Block mapping cards */}
          {results.map((result, idx) => {
            const mapping = mappings[idx];
            return (
              <BlockMappingCard
                key={result.mappingId}
                mapping={mapping}
                result={result}
                compact={compact}
              />
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENT: Block Mapping Card
// ═══════════════════════════════════════════════════════════

function BlockMappingCard({
  mapping,
  result,
  compact,
}: {
  mapping: ReturnType<typeof getStageMappings>[number];
  result: BlockReadinessResult;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold truncate">
              {mapping.targetBlocks[0]?.blockLabel || mapping.id}
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground truncate">
            → {mapping.targetBlocks[0]?.intendedProposalSection}
          </p>
        </div>
        <ReadinessBadge ready={result.ready} />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-border/50">
          {/* Data availability */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Available Data
              </p>
              {result.availableData.length === 0 ? (
                <p className="text-[9px] text-muted-foreground/50">No data captured yet</p>
              ) : (
                <div className="space-y-0.5">
                  {result.availableData.map(key => (
                    <div key={key} className="flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                      <span className="text-[9px] text-emerald-700 truncate">{formatKey(key)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Missing Required
              </p>
              {result.missingRequiredData.length === 0 ? (
                <p className="text-[9px] text-emerald-600">All required data present</p>
              ) : (
                <div className="space-y-0.5">
                  {result.missingRequiredData.map(key => (
                    <div key={key} className="flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                      <span className="text-[9px] text-amber-700 truncate">{formatKey(key)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Target blocks */}
          {!compact && mapping.targetBlocks.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Document Assembly Targets
              </p>
              <div className="flex flex-wrap gap-1">
                {mapping.targetBlocks.map(tb => (
                  <Badge
                    key={tb.blockKey}
                    variant="outline"
                    className="text-[8px] gap-1 border-slate-200 bg-slate-50 text-slate-600"
                  >
                    <FileText className="w-2.5 h-2.5" />
                    {tb.pdfStudioTarget || tb.blockKey}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Proposal use */}
          {!compact && mapping.futureUse.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Proposal Sections
              </p>
              <div className="flex flex-wrap gap-1">
                {mapping.futureUse.map(fu => (
                  <Badge
                    key={fu}
                    variant="outline"
                    className="text-[8px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]"
                  >
                    <ArrowRight className="w-2 h-2" />
                    {fu}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Readiness notice */}
          {result.ready && (
            <div className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-slate-50/60">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="text-[9px] text-slate-500">
                Source data ready for proposal drafting.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function ReadinessBadge({ ready }: { ready: boolean }) {
  if (ready) {
    return (
      <Badge variant="outline" className="text-[8px] border-emerald-300 bg-emerald-50 text-emerald-700 gap-0.5 shrink-0">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Ready to Draft
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[8px] border-amber-300 bg-amber-50 text-amber-700 gap-0.5 shrink-0">
      <AlertCircle className="w-2.5 h-2.5" />
      Not Ready
    </Badge>
  );
}

/** Convert a dot-path data key to a human-friendly label */
function formatKey(key: string): string {
  return key
    .split(".")
    .pop()!
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
