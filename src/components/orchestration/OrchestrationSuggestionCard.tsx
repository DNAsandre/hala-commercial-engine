/**
 * OrchestrationSuggestionCard.tsx
 * ───────────────────────────────
 * Sprint 2.5 — One AI suggestion + human review actions (DECISION CAPTURE ONLY).
 *
 * Presentational: it renders a suggestion and calls back with the chosen review
 * decision. It NEVER applies to canonical fields, never sets `applied`, never
 * moves stage/CRM, and has no apply/submit/document-output actions. Status changes
 * are routed by the parent through the orchestration service (which itself
 * blocks `applied`).
 */

import { useState } from "react";
import { Check, Pencil, Ban, Clock3, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OrchestrationSuggestion, SuggestionStatus } from "@/lib/orchestration-core";
import {
  formatValuePreview,
  formatValueFull,
  provenanceRows,
  validateEditedValue,
  confidenceLabel,
  baselineLabel,
  canReview,
} from "@/lib/orchestration-review-helpers";
import { driftLabel, driftSeverity, type DriftResult } from "@/lib/orchestration-drift";
import { previewLabel, previewSeverity, type PreviewItem } from "@/lib/orchestration-preview";

interface Props {
  suggestion: OrchestrationSuggestion;
  busy?: boolean;
  /** Read-only drift preview for this suggestion (advisory; never a gate). */
  drift?: DriftResult;
  /** Read-only dry-run preview outcome for this suggestion (advisory; never a gate). */
  preview?: PreviewItem;
  onAccept: () => void;
  onEdit: (acceptedValue: unknown) => void;
  onReject: (reason: string) => void;
  /** Leave pending — collapses any open editor without changing status. */
  onDefer?: () => void;
}

const STATUS_STYLE: Record<SuggestionStatus, string> = {
  pending_review: "border-slate-300 text-slate-700 bg-slate-50",
  accepted: "border-emerald-300 text-emerald-700 bg-emerald-50",
  edited: "border-blue-300 text-blue-700 bg-blue-50",
  rejected: "border-red-300 text-red-700 bg-red-50",
  superseded: "border-amber-300 text-amber-700 bg-amber-50",
  applied: "border-violet-300 text-violet-700 bg-violet-50",
};

export default function OrchestrationSuggestionCard({ suggestion, busy, drift, preview, onAccept, onEdit, onReject, onDefer }: Props) {
  const [mode, setMode] = useState<"idle" | "edit" | "reject">("idle");
  const [expanded, setExpanded] = useState(false);
  const seedValue = suggestion.accepted_value !== undefined ? suggestion.accepted_value : suggestion.proposed_value;
  const [editText, setEditText] = useState(() => formatValueFull(seedValue));
  const [reason, setReason] = useState("");

  const reviewable = canReview(suggestion.status);
  const rows = provenanceRows(suggestion);
  const confLabel = confidenceLabel(suggestion.confidence);
  const confStyle =
    confLabel === "high" ? "border-emerald-300 text-emerald-700 bg-emerald-50"
      : confLabel === "medium" ? "border-amber-300 text-amber-700 bg-amber-50"
        : confLabel === "low" ? "border-red-300 text-red-700 bg-red-50"
          : "border-slate-300 text-slate-600 bg-slate-50";
  const editValidation = validateEditedValue(editText, suggestion.proposed_value);

  const startEdit = () => {
    setEditText(formatValueFull(seedValue));
    setMode("edit");
  };
  const defer = () => {
    setMode("idle");
    onDefer?.();
  };

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
          <span className="text-xs font-mono font-semibold text-foreground">{suggestion.field_path}</span>
          <Badge variant="outline" className="text-[9px]">{suggestion.stage}</Badge>
          {suggestion.tab && <Badge variant="outline" className="text-[9px]">{suggestion.tab}</Badge>}
          <Badge variant="outline" className={`ml-auto text-[9px] ${STATUS_STYLE[suggestion.status]}`}>{suggestion.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Proposed vs current */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 mb-1">AI proposed value</p>
            <p className="text-xs text-foreground break-words whitespace-pre-wrap">{formatValuePreview(suggestion.proposed_value)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Current saved value</p>
            <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">{formatValuePreview(suggestion.current_saved_value)}</p>
          </div>
        </div>

        {/* Confidence + baseline + drift at-a-glance */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`text-[9px] ${confStyle}`}>confidence: {confLabel}</Badge>
          {suggestion.baseline_status && (
            <span className="text-[10px] text-muted-foreground" title={baselineLabel(suggestion.baseline_status)}>
              baseline: {suggestion.baseline_status === "baseline_captured" ? "captured" : "not captured"}
            </span>
          )}
          {drift && (
            <Badge
              variant="outline"
              className={`text-[9px] ${
                driftSeverity(drift.status) === "ok"
                  ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                  : driftSeverity(drift.status) === "warn"
                    ? "border-amber-300 text-amber-700 bg-amber-50"
                    : "border-slate-300 text-slate-600 bg-slate-50"
              }`}
              title={drift.message}
            >
              {driftLabel(drift.status)}
            </Badge>
          )}
        </div>
        {drift && driftSeverity(drift.status) === "warn" && (
          <p className="text-[10px] text-amber-700">{drift.message}</p>
        )}

        {/* Read-only dry-run preview outcome */}
        {preview && (
          <Badge
            variant="outline"
            className={`text-[9px] ${
              previewSeverity(preview.category) === "ok"
                ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                : previewSeverity(preview.category) === "warn"
                  ? "border-amber-300 text-amber-700 bg-amber-50"
                  : previewSeverity(preview.category) === "error"
                    ? "border-red-300 text-red-700 bg-red-50"
                    : "border-slate-300 text-slate-600 bg-slate-50"
            }`}
            title={preview.reason}
          >
            preview: {previewLabel(preview.category)}
          </Badge>
        )}

        {suggestion.accepted_value !== undefined && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Accepted value (human)</p>
            <p className="text-xs text-foreground break-words whitespace-pre-wrap">{formatValuePreview(suggestion.accepted_value)}</p>
          </div>
        )}
        {suggestion.status === "rejected" && suggestion.rejection_reason && (
          <p className="text-[11px] text-red-700">Rejected: {suggestion.rejection_reason}</p>
        )}

        {/* Provenance (collapsible) */}
        {rows.length > 0 && (
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Source & provenance ({rows.length})
            </button>
            {expanded && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-2.5 pb-2.5 text-[11px]">
                {rows.map((r) => (
                  <div key={r.label} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="text-foreground font-medium text-right break-all">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit editor */}
        {mode === "edit" && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Edit accepted value</p>
            <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={5} className="text-xs font-mono" />
            {!editValidation.ok && <p className="text-[10px] text-red-600">{editValidation.error}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="text-xs h-7"
                disabled={busy || !editValidation.ok}
                onClick={() => { if (!editValidation.ok) return; onEdit(editValidation.value); setMode("idle"); }}
              >
                Save edited value
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={defer}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Reject editor */}
        {mode === "reject" && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600">Reason for rejection</p>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="text-xs" placeholder="Why is this suggestion being rejected?" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs h-7" disabled={busy} onClick={() => { onReject(reason); setMode("idle"); }}>
                Confirm reject
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={defer}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Action bar — decision capture only. No apply / submit / stage / document-output. */}
        {reviewable && mode === "idle" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" className="text-xs h-7 gap-1" disabled={busy} onClick={onAccept}>
              <Check className="h-3.5 w-3.5" /> Accept
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" disabled={busy} onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" disabled={busy} onClick={() => setMode("reject")}>
              <Ban className="h-3.5 w-3.5" /> Reject
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" disabled={busy} onClick={defer}>
              <Clock3 className="h-3.5 w-3.5" /> Defer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
