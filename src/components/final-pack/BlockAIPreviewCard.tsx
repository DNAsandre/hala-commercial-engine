/**
 * BlockAIPreviewCard.tsx
 * ──────────────────────
 * FPS-008-11 — AI preview surface.  FPS-008-12 — human-controlled actions.
 *
 * Renders the validated, PREVIEW-ONLY output of a Bot Builder microbot run and
 * the human actions that may act on it. AI output NEVER auto-applies — only a
 * human button click here causes a block-content change (via the callbacks,
 * which the parent routes to the selected block's content update path).
 *
 * Action availability:
 *  - valid / warning : Apply · Append · Replace · Edit first · Discard · Reject · Regenerate
 *  - invalid / error : Discard · Reject · Regenerate   (NO apply/append/replace/edit)
 *
 * Nothing here writes to source/template/reusable tables, snapshots, or export,
 * and nothing is ever marked approved.
 */

import { useState } from "react";
import {
  Sparkles, X, CheckCircle2, AlertTriangle, ShieldAlert, Loader2,
  Check, Plus, Repeat, Pencil, Trash2, Ban, RotateCw,
} from "lucide-react";
import type { BlockAIPreview } from "@/lib/final-pack-bot-runtime";

interface BlockAIPreviewCardProps {
  preview: BlockAIPreview;
  /** A regenerate is in flight (keep current preview visible). */
  regenerating?: boolean;
  /** Whether the target block currently has non-empty content (gates Replace confirm). */
  blockHasContent: boolean;
  onApply: (text: string) => void;
  onAppend: (text: string) => void;
  onReplace: (text: string) => void;
  onDiscard: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}

export default function BlockAIPreviewCard({
  preview,
  regenerating,
  blockHasContent,
  onApply,
  onAppend,
  onReplace,
  onDiscard,
  onReject,
  onRegenerate,
}: BlockAIPreviewCardProps) {
  const v = preview.validation;
  const isRunning = preview.status === "running";
  const isRuntimeError = preview.status === "error";
  const vStatus = v?.status;
  const canApply =
    preview.status === "success" && (vStatus === "valid" || vStatus === "warning") && !!v?.preview_content;

  // Edit-first + replace-confirm are local until the human confirms.
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [confirmingReplace, setConfirmingReplace] = useState(false);

  const baseText = v?.preview_content ?? "";
  const effectiveText = editing ? editText : baseText;
  const busy = !!regenerating;

  const showContent = canApply && !editing;

  function startEdit() {
    setEditText(baseText);
    setEditing(true);
    setConfirmingReplace(false);
  }
  function doReplace() {
    if (blockHasContent) {
      setConfirmingReplace(true);
    } else {
      onReplace(effectiveText);
    }
  }

  return (
    <div className="border-t border-border bg-violet-500/5 px-3 py-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <span className="font-medium text-foreground">{preview.bot_name}</span>
        <span className="text-muted-foreground">· {preview.bot_category}</span>

        <span className="ml-auto flex items-center gap-2">
          {regenerating && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Regenerating…
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Running…
            </span>
          )}
          {preview.status === "success" && vStatus === "valid" && (
            <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> valid
            </span>
          )}
          {preview.status === "success" && vStatus === "warning" && (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">
              <AlertTriangle className="h-3 w-3" /> warning
            </span>
          )}
          {preview.status === "success" && vStatus === "invalid" && (
            <span className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-red-600">
              <ShieldAlert className="h-3 w-3" /> invalid
            </span>
          )}
          {isRuntimeError && (
            <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600">
              <AlertTriangle className="h-3 w-3" /> advisory
            </span>
          )}
          <button onClick={onDiscard} aria-label="Dismiss AI preview" className="rounded p-0.5 text-muted-foreground hover:bg-accent" title="Dismiss preview">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      {/* Runtime failure — advisory only */}
      {isRuntimeError && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          {preview.error} <span className="text-muted-foreground">Your document is unchanged.</span>
        </p>
      )}

      {/* Valid / warning content (read-only display) */}
      {showContent && (
        <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded border border-border bg-card p-2 text-[11px] leading-relaxed text-foreground">
{v!.preview_content}
        </pre>
      )}

      {/* Edit-first: editable, local only until confirmed */}
      {canApply && editing && (
        <div className="mt-1.5">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={Math.min(12, Math.max(4, editText.split("\n").length + 1))}
            className="w-full rounded border border-violet-400/50 bg-card p-2 text-[11px] leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Editing locally — not applied until you choose Apply, Append, or Replace.
          </p>
        </div>
      )}

      {/* Missing information / warnings */}
      {v && v.missing_information.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {v.missing_information.map((m, i) => (
            <li key={i} className="flex items-start gap-1 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {m}
            </li>
          ))}
        </ul>
      )}
      {v && v.warnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {v.warnings.map((w, i) => (
            <li key={i} className="text-[11px] text-amber-600">• {w}</li>
          ))}
        </ul>
      )}

      {/* Blocked reasons (invalid) — content withheld, no apply controls */}
      {v && vStatus === "invalid" && (
        <div className="mt-1.5">
          <p className="text-[11px] font-medium text-red-600">This output was blocked and not shown:</p>
          <ul className="mt-0.5 space-y-0.5">
            {v.blocked_reasons.map((b, i) => (
              <li key={i} className="flex items-start gap-1 text-[11px] text-red-600">
                <ShieldAlert className="mt-0.5 h-3 w-3 flex-shrink-0" /> {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Replace confirmation */}
      {confirmingReplace && (
        <div className="mt-2 rounded border border-amber-400/50 bg-amber-500/5 p-2">
          <p className="text-[11px] text-amber-700">
            Replace the existing content of this block? This overwrites what's there now.
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              onClick={() => { setConfirmingReplace(false); onReplace(effectiveText); }}
              className="rounded bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
            >
              Confirm replace
            </button>
            <button
              onClick={() => setConfirmingReplace(false)}
              className="rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isRunning && !confirmingReplace && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {canApply && (
            <>
              <ActionBtn onClick={() => onApply(effectiveText)} disabled={busy} icon={Check} label="Apply" primary />
              <ActionBtn onClick={() => onAppend(effectiveText)} disabled={busy} icon={Plus} label="Append" />
              <ActionBtn onClick={doReplace} disabled={busy} icon={Repeat} label="Replace" />
              {editing ? (
                <ActionBtn onClick={() => setEditing(false)} disabled={busy} icon={Pencil} label="Cancel edit" />
              ) : (
                <ActionBtn onClick={startEdit} disabled={busy} icon={Pencil} label="Edit first" />
              )}
            </>
          )}
          <ActionBtn onClick={onDiscard} disabled={busy} icon={Trash2} label="Discard" />
          <ActionBtn onClick={onReject} disabled={busy} icon={Ban} label="Reject" />
          <ActionBtn onClick={onRegenerate} disabled={busy} icon={RotateCw} label="Regenerate" />
        </div>
      )}

      {/* Footer — preview-only label + metadata */}
      {!isRunning && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Preview only — not applied to the block.
          {preview.model && ` · ${preview.model}`}
          {typeof preview.tokens_output === "number" &&
            ` · ${preview.tokens_input ?? 0}→${preview.tokens_output} tokens`}
          {typeof preview.latency_ms === "number" && ` · ${preview.latency_ms} ms`}
          {v?.language && v.language !== "unknown" && ` · ${v.language}`}
        </p>
      )}
    </div>
  );
}

function ActionBtn({
  onClick, disabled, icon: Icon, label, primary,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Check;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (primary
          ? "bg-violet-600 text-white hover:bg-violet-700"
          : "border border-border text-foreground hover:bg-accent")
      }
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
