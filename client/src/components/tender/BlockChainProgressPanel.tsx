/**
 * BlockChainProgressPanel
 *
 * Shows a progress panel during auto-draft of all blocks.
 * Displays current block, progress bar, and cancel button.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, StopCircle, Sparkles } from "lucide-react";
import type { BlockChainProgress, BlockChainResult } from "@/lib/ai-runs";

interface Props {
  progress: BlockChainProgress | null;
  result: BlockChainResult | null;
  onCancel: () => void;
  onDone: () => void;
}

export default function BlockChainProgressPanel({ progress, result, onCancel, onDone }: Props) {
  // ── Completed state ──
  if (result) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/30 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              {result.cancelled ? (
                <StopCircle className="h-4 w-4 text-amber-600" />
              ) : result.failed > 0 ? (
                <XCircle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">
                {result.cancelled
                  ? "Pipeline Cancelled"
                  : `Auto-Draft Complete`}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {result.completed > 0 && (
                  <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
                    {result.completed} drafted
                  </Badge>
                )}
                {result.failed > 0 && (
                  <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">
                    {result.failed} failed
                  </Badge>
                )}
                {result.cancelled && (
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                    Cancelled by user
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-emerald-700">
                Go to the Proposal Block Workbench tab to review each block's AI-drafted content.
              </p>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={onDone}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Go to Block Workbench
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── In-progress state ──
  if (!progress) return null;

  const pct = Math.round((progress.current / progress.total) * 100);
  const isGenerating = progress.status === "generating";

  return (
    <Card className="border-indigo-200 bg-indigo-50/30 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
            <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-indigo-800">
                Auto-Drafting Blocks…
              </p>
              <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700">
                {progress.current} / {progress.total}
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Current block */}
            <div className="mt-2 flex items-center gap-2">
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
              ) : progress.status === "completed" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
              <span className="text-[11px] text-indigo-700">
                {isGenerating ? "Generating: " : progress.status === "completed" ? "Completed: " : "Failed: "}
                <span className="font-medium">{progress.blockTitle}</span>
              </span>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            onClick={onCancel}
          >
            <StopCircle className="w-3.5 h-3.5" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
