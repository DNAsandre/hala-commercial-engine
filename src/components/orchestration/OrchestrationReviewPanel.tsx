/**
 * OrchestrationReviewPanel.tsx
 * ────────────────────────────
 * Sprint 2.5 — Minimal human review surface for orchestration suggestions.
 *
 * DECISION CAPTURE ONLY. The reviewer can Accept / Edit / Reject / Defer.
 * It NEVER applies suggestions to canonical tender fields, NEVER sets `applied`,
 * NEVER moves stage/CRM, NEVER touches the document output layer, and adds no
 * apply / submit / export / approve actions. Suggestions are advisory; reviewing
 * is helpful, not mandatory (no workflow gate).
 *
 * Two exports:
 *   - OrchestrationReviewPanel — presentational (suggestions + onReview).
 *   - ConnectedOrchestrationReviewPanel — wires to the orchestration service
 *     (list + status update). Status updates flow through the service, which
 *     itself blocks `applied`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Inbox, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrchestrationSuggestion, SuggestionStatus, StatusUpdateInput } from "@/lib/orchestration-core";
import { SUGGESTION_STATUSES } from "@/lib/orchestration-core";
import { getCurrentUser } from "@/lib/auth-state";
import {
  summarizeReview,
  uniqueValues,
  buildAcceptUpdate,
  buildEditUpdate,
  buildRejectUpdate,
  REVIEW_NOTICE,
  LOADING_COPY,
  EMPTY_COPY,
  ERROR_COPY,
} from "@/lib/orchestration-review-helpers";
import OrchestrationSuggestionCard from "./OrchestrationSuggestionCard";
import { driftById as buildDriftMap, summarizeDrift, driftLabel, type DriftResult } from "@/lib/orchestration-drift";
import { buildApplyPreview, PREVIEW_ONLY_NOTICE, type ApplyPreview } from "@/lib/orchestration-preview";

// ═══════════════════════════════════════════════════════════
// Presentational panel
// ═══════════════════════════════════════════════════════════

interface PanelProps {
  suggestions: OrchestrationSuggestion[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  busyId?: string | null;
  reviewerName?: string;
  /** Optional read-only drift preview per suggestion (advisory; never a gate). */
  driftById?: Record<string, DriftResult>;
  /** Optional read-only dry-run apply preview (advisory; never a gate). */
  preview?: ApplyPreview | null;
  /** Trigger a read-only dry-run preview (no writes). */
  onPreview?: () => void;
  /** Parent routes the decision to the orchestration service. */
  onReview: (suggestionId: string, update: StatusUpdateInput) => void;
}

export function OrchestrationReviewPanel({ suggestions, title = "Orchestration Review", loading, error, busyId, reviewerName, driftById, preview, onPreview, onReview }: PanelProps) {
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | "all">("all");
  const [stageFilter, setStageFilter] = useState<string | "all">("all");
  const summary = useMemo(() => summarizeReview(suggestions), [suggestions]);
  const stages = useMemo(() => uniqueValues(suggestions, "stage"), [suggestions]);
  const driftSummary = useMemo(
    () => (driftById ? summarizeDrift(Object.values(driftById)) : null),
    [driftById],
  );
  const visible = useMemo(
    () =>
      suggestions.filter(
        (s) => (statusFilter === "all" || s.status === statusFilter) && (stageFilter === "all" || s.stage === stageFilter),
      ),
    [suggestions, statusFilter, stageFilter],
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="outline" className="text-[10px]">{summary.total} total</Badge>
        {SUGGESTION_STATUSES.map((s) =>
          summary.byStatus[s] > 0 ? (
            <Badge key={s} variant="outline" className="text-[9px]">{s}: {summary.byStatus[s]}</Badge>
          ) : null,
        )}
      </div>

      {/* No-gate notice */}
      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
        {REVIEW_NOTICE} Reviewing is optional and never blocks tender work.
      </p>

      {/* Read-only drift summary (advisory; never a gate) */}
      {driftSummary && (
        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Drift:</span>
          {(Object.keys(driftSummary) as Array<keyof typeof driftSummary>)
            .filter((k) => driftSummary[k] > 0)
            .map((k) => (
              <span key={k} className="rounded border border-border bg-muted/30 px-1.5 py-0.5">
                {driftLabel(k)}: {driftSummary[k]}
              </span>
            ))}
        </div>
      )}

      {/* Read-only dry-run preview (advisory; never a gate) */}
      {onPreview && (
        <div className="space-y-1.5 rounded-md border border-border bg-muted/20 px-2.5 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={onPreview}>Preview impact</Button>
            <span className="text-[10px] text-muted-foreground">{PREVIEW_ONLY_NOTICE}</span>
          </div>
          {preview && (
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-muted-foreground">considered: {preview.summary.considered}</span>
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">would apply: {preview.summary.wouldApply}</span>
              <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600">skipped: {preview.summary.skipped}</span>
              <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">conflicts: {preview.summary.conflicts}</span>
              {preview.summary.errors > 0 && (
                <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-700">errors: {preview.summary.errors}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip label="All status" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        {SUGGESTION_STATUSES.filter((s) => summary.byStatus[s] > 0).map((s) => (
          <FilterChip key={s} label={`${s} (${summary.byStatus[s]})`} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
        ))}
      </div>

      {/* Stage filter (only when more than one stage is represented) */}
      {stages.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="All stages" active={stageFilter === "all"} onClick={() => setStageFilter("all")} />
          {stages.map((st) => (
            <FilterChip key={st} label={st} active={stageFilter === st} onClick={() => setStageFilter(st)} />
          ))}
        </div>
      )}

      {/* Non-blocking error */}
      {error && (
        <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">{ERROR_COPY}</p>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">{LOADING_COPY}</span>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Inbox className="h-6 w-6" />
          <p className="text-xs">
            {summary.total === 0 ? EMPTY_COPY : `No suggestions match the current filter.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((s) => (
            <OrchestrationSuggestionCard
              key={s.id}
              suggestion={s}
              busy={busyId === s.id}
              drift={driftById?.[s.id]}
              preview={preview?.byId[s.id]}
              onAccept={() => onReview(s.id, buildAcceptUpdate(reviewerName))}
              onEdit={(value) => onReview(s.id, buildEditUpdate(value, reviewerName))}
              onReject={(reason) => onReview(s.id, buildRejectUpdate(reason, reviewerName))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} className="h-6 px-2 text-[10px]" onClick={onClick}>
      {label}
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════
// Connected variant — wires to the orchestration service
// ═══════════════════════════════════════════════════════════
// Mount point (later): tender workspace, shown only when a tender has
// orchestration suggestions. Status updates go through the service, which blocks
// `applied`. No canonical-field write, no stage/CRM, no document-output mutation.

interface ConnectedProps {
  tenderId: string;
  reviewerName?: string;
  /** Notified after each load so a parent (e.g. the collapsed section header)
   * can show a count badge without doing its own fetch. */
  onLoaded?: (summary: { total: number; pending: number }) => void;
}

export function ConnectedOrchestrationReviewPanel({ tenderId, reviewerName, onLoaded }: ConnectedProps) {
  const [suggestions, setSuggestions] = useState<OrchestrationSuggestion[]>([]);
  const [drift, setDrift] = useState<Record<string, DriftResult>>({});
  const [typeDetails, setTypeDetails] = useState<Record<string, unknown> | undefined>(undefined);
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reviewer identity from the existing auth accessor (no new auth plumbing).
  const effectiveReviewer = reviewerName ?? getCurrentUser()?.name;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { listOrchestrationSuggestions, readTenderTypeDetails } = await import("@/lib/orchestration");
      // Read-only: list suggestions + the CURRENT tender's type_details (single tender).
      const [res, detailsRes] = await Promise.all([
        listOrchestrationSuggestions(tenderId),
        readTenderTypeDetails(tenderId),
      ]);
      if (res.success && res.data) {
        setSuggestions(res.data.suggestions);
        // Compute read-only drift vs the current live values (advisory only).
        const td = detailsRes.success ? detailsRes.data : undefined;
        setTypeDetails(td);
        setPreview(null); // a fresh load invalidates any prior preview
        setDrift(buildDriftMap(td, res.data.suggestions));
        const sum = summarizeReview(res.data.suggestions);
        onLoaded?.({ total: sum.total, pending: sum.byStatus.pending_review });
      } else {
        setError(res.error ?? "Failed to load suggestions.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suggestions.");
    } finally {
      setLoading(false);
    }
  }, [tenderId, onLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  const onReview = useCallback(
    async (suggestionId: string, update: StatusUpdateInput) => {
      setBusyId(suggestionId);
      try {
        const { updateOrchestrationSuggestionStatus } = await import("@/lib/orchestration");
        await updateOrchestrationSuggestionStatus(tenderId, suggestionId, update);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [tenderId, load],
  );

  // Read-only dry-run preview from the already-loaded current-tender typeDetails.
  // Never writes; only the dry-run path is ever invoked.
  const onPreview = useCallback(() => {
    setPreview(buildApplyPreview(typeDetails));
  }, [typeDetails]);

  return (
    <OrchestrationReviewPanel
      suggestions={suggestions}
      loading={loading}
      error={error}
      busyId={busyId}
      reviewerName={effectiveReviewer}
      driftById={drift}
      preview={preview}
      onPreview={onPreview}
      onReview={onReview}
    />
  );
}

export default OrchestrationReviewPanel;
