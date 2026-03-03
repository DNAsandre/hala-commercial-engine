/**
 * AIRunHistory — Collapsible right sidebar panel showing past AI runs
 * for the current document. Allows viewing and re-applying previous drafts.
 *
 * Design: Swiss Precision Instrument
 * Compact timeline view with status badges, bot info, and expandable output
 */

import { useState } from "react";
import {
  History,
  ChevronDown,
  ChevronRight,
  Bot,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Eye,
  FileText,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type AIRun, getAIRunsForDocument } from "@/lib/ai-runs";

interface AIRunHistoryProps {
  docInstanceId: string;
  onReapply?: (run: AIRun) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  applied: { label: "Applied", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  discarded: { label: "Discarded", color: "bg-zinc-100 text-zinc-500 border-zinc-200", icon: XCircle },
  draft: { label: "Draft", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateHtml(html: string, maxLen: number = 120): string {
  const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
  return text.length > maxLen ? text.substring(0, maxLen) + "…" : text;
}

export default function AIRunHistory({ docInstanceId, onReapply }: AIRunHistoryProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const runs = getAIRunsForDocument(docInstanceId);

  if (runs.length === 0) {
    return (
      <div className="border-t border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          <span>AI Run History</span>
          <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">0</Badge>
        </button>
        {expanded && (
          <div className="px-3 pb-3">
            <div className="text-[11px] text-muted-foreground/60 text-center py-4">
              No AI runs yet for this document.
              <br />
              Use the sparkle button on a block or the AI Document toolbar button to generate content.
            </div>
          </div>
        )}
      </div>
    );
  }

  const appliedCount = runs.filter(r => r.status === "applied").length;
  const draftCount = runs.filter(r => r.status === "draft").length;

  return (
    <div className="border-t border-border">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <History className="w-3.5 h-3.5" />
        <span>AI Run History</span>
        <div className="ml-auto flex items-center gap-1.5">
          {draftCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
              {draftCount} draft{draftCount > 1 ? "s" : ""}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {runs.length}
          </Badge>
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>
      </button>

      {/* Timeline */}
      {expanded && (
        <div className="px-2 pb-2 max-h-80 overflow-y-auto">
          <div className="space-y-1">
            {runs.map((run) => {
              const statusCfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusCfg.icon;
              const isExpanded = expandedRunId === run.id;
              const isBlock = run.target_scope === "block";

              return (
                <div
                  key={run.id}
                  className={cn(
                    "rounded-md border transition-colors",
                    run.status === "draft" ? "border-amber-200 bg-amber-50/50" : "border-border bg-card"
                  )}
                >
                  {/* Run header */}
                  <button
                    onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                    className="flex items-start gap-2 w-full px-2.5 py-2 text-left"
                  >
                    <StatusIcon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", 
                      run.status === "applied" ? "text-emerald-500" :
                      run.status === "discarded" ? "text-zinc-400" : "text-amber-500"
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {run.bot_name}
                        </span>
                        {isBlock ? (
                          <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                        ) : (
                          <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className={cn("text-[9px] px-1 py-0 border", statusCfg.color)}>
                          {statusCfg.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimeAgo(run.created_at)}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
                    )}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-2.5 pb-2.5 border-t border-border/50">
                      {/* Meta */}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <Bot className="w-3 h-3" />
                        <span>{run.provider}/{run.model}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span>{isBlock ? "Block" : "Document"} scope</span>
                      </div>

                      {/* Prompt */}
                      <div className="mt-2">
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Prompt</div>
                        <div className="text-[11px] text-foreground bg-muted/50 rounded px-2 py-1.5 max-h-16 overflow-y-auto">
                          {run.input_prompt || "(no prompt)"}
                        </div>
                      </div>

                      {/* Output preview */}
                      <div className="mt-2">
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Output</div>
                        <div className="text-[11px] text-foreground bg-muted/50 rounded px-2 py-1.5 max-h-24 overflow-y-auto">
                          {truncateHtml(run.output_text, 200)}
                        </div>
                      </div>

                      {/* Transcript ref */}
                      {run.input_transcript_ref && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          📎 Transcript: {run.input_transcript_ref.substring(0, 40)}…
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {run.status === "applied" && onReapply && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 gap-1"
                            onClick={(e) => { e.stopPropagation(); onReapply(run); }}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Re-apply
                          </Button>
                        )}
                        {run.status === "draft" && onReapply && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={(e) => { e.stopPropagation(); onReapply(run); }}
                          >
                            <Eye className="w-3 h-3" />
                            View Draft
                          </Button>
                        )}
                        <span className="text-[9px] text-muted-foreground/50 ml-auto">
                          {run.id.substring(0, 12)}…
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary footer */}
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-muted-foreground/60">
            <span>{appliedCount} applied, {runs.length - appliedCount - draftCount} discarded</span>
          </div>
        </div>
      )}
    </div>
  );
}
