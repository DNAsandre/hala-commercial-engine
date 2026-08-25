import { type ReactNode } from "react";
import { toast } from "sonner";
import {
  TenderStageEmptyState,
  TenderStageSectionCard,
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";

export type IdentifiedSectionTab<T extends string> = TenderStageSectionTab<T>;
export type IdentifiedStageMetric = TenderStageMetric;

// ═══════════════════════════════════════════════════════════
// TCW-T3 — shared tender-tab save-outcome contract
//
// Every stage 1–5 save handler routes its ActionResult through these helpers so
// the four save-layer outcomes render honestly and identically:
//   - plain success            → green toast
//   - 'saved_with_audit_warning' → amber "Saved — audit entry not recorded: …"
//     (the primary save IS confirmed; only the advisory audit append is not)
//   - 'stale'                  → red, NON-DESTRUCTIVE: the user's entry stays on
//     screen, the service's own message is shown, and the next save attempt is
//     an informed retry (see runTenderTabSave)
//   - failure                  → red with the service's real reason
//
// Pure functions are exported for direct testing (house pattern — no jsdom).
// ═══════════════════════════════════════════════════════════

/** The shape every supabase-tender-actions writer resolves to (ActionResult). */
export interface TenderTabSaveResult {
  success: boolean;
  error?: string;
  status?: string;
  auditWarning?: string;
}

export interface TenderTabSaveOutcome {
  kind: "saved" | "saved_with_audit_warning" | "stale" | "failed";
  toastKind: "success" | "warning" | "error";
  title: string;
  description?: string;
  /** True only when the PRIMARY write is confirmed stored (incl. audit-warning saves). */
  confirmedSaved: boolean;
}

/**
 * Map an ActionResult onto the honest UI outcome. Pure — unit tested directly.
 */
export function resolveTenderTabSaveOutcome(
  result: TenderTabSaveResult,
  labels: { saved: string; failed: string },
): TenderTabSaveOutcome {
  if (result.success) {
    if (result.status === "saved_with_audit_warning") {
      return {
        kind: "saved_with_audit_warning",
        toastKind: "warning",
        title: "Saved — audit entry not recorded",
        description: result.auditWarning
          ?? "Saved, but the audit entry was not recorded (no reason returned by the service).",
        confirmedSaved: true,
      };
    }
    return { kind: "saved", toastKind: "success", title: labels.saved, confirmedSaved: true };
  }
  if (result.status === "stale") {
    return {
      kind: "stale",
      toastKind: "error",
      title: "Not saved — the tender changed while you were editing.",
      description: `${result.error ?? "Review the current value and retry without losing your entry."} Your entry is kept on screen; saving again applies only this tab's fields over the latest stored version.`,
      confirmedSaved: false,
    };
  }
  return {
    kind: "failed",
    toastKind: "error",
    title: labels.failed,
    description: result.error,
    confirmedSaved: false,
  };
}

/** Render an outcome as the matching sonner toast (green / amber / red). */
export function announceTenderTabSaveOutcome(outcome: TenderTabSaveOutcome): void {
  if (outcome.toastKind === "success") {
    toast.success(outcome.title, outcome.description ? { description: outcome.description } : undefined);
  } else if (outcome.toastKind === "warning") {
    toast.warning(outcome.title, { description: outcome.description });
  } else {
    toast.error(outcome.title, outcome.description ? { description: outcome.description } : undefined);
  }
}

/**
 * The T1 contract handle for optimistic-revision threading: the workspace
 * bundle carries `revisionToken` (the tender row's verbatim `updated_at` at
 * load time) and tabs pass it as `expectedRevision` on every save.
 *
 * KNOWN CROSS-LANE GAP (reported, out of this lane's grant to fix): the bundle
 * field exists (supabase-tender-data.ts `TenderWorkspaceBundle.revisionToken`)
 * but `bundleToTenderWorkspace` does not yet copy it onto the `TenderWorkspace`
 * object tabs receive, so at runtime this currently resolves to `undefined` and
 * the writers fall back to their own in-call token (the pre-existing guard).
 * The moment the owning lane maps the field through, threading goes live here
 * with no further tab changes.
 */
export function tenderRevisionTokenOf(ws: unknown): string | undefined {
  const token = (ws as { revisionToken?: unknown } | null | undefined)?.revisionToken;
  return typeof token === "string" && token ? token : undefined;
}

/** A mutable one-shot flag owned by the component (useRef) - see runTenderTabSave. */
export interface TenderStaleRetryFlag {
  current: boolean;
}

export interface RunTenderTabSaveArgs {
  /** Perform the write, threading the token the orchestrator chose. */
  write: (expectedRevision: string | undefined) => Promise<TenderTabSaveResult>;
  /** The UI-load-time revision token (tenderRevisionTokenOf(ws)). */
  revisionToken: string | undefined;
  /**
   * One-shot informed-retry flag. After a stale refusal the user has been told
   * the tender changed; the NEXT attempt omits the stale UI token so the save
   * layer's own fresh read supplies the revision. Patch-merge writers still send
   * only this tab's keys, so sibling data is never clobbered by the retry.
   */
  staleRetryArmed?: TenderStaleRetryFlag;
  labels: { saved: string; failed: string };
  /** Runs ONLY on a confirmed primary save (incl. audit-warning saves). */
  onConfirmed?: () => void;
  /** Runs ONLY on a stale refusal (e.g. reload the bundle under the kept entry). */
  onStale?: () => void;
  /** Toast sink — injectable for tests; defaults to announceTenderTabSaveOutcome. */
  announce?: (outcome: TenderTabSaveOutcome) => void;
}

/**
 * TCW-T3 shared save orchestration for stage 1–5 tabs. Threads the revision
 * token, classifies the result, announces it, and fires the side-effect hooks
 * with the outcome discipline the wave contract requires:
 *   - onConfirmed fires on confirmed saves ONLY (never on stale/failure);
 *   - stale keeps the user's entry (this function never mutates form state),
 *     arms the informed retry and fires onStale;
 *   - the armed flag is cleared by any non-stale outcome.
 */
export async function runTenderTabSave(args: RunTenderTabSaveArgs): Promise<TenderTabSaveOutcome> {
  const armed = args.staleRetryArmed?.current === true;
  const token = armed ? undefined : args.revisionToken;

  let result: TenderTabSaveResult;
  try {
    result = await args.write(token);
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const outcome = resolveTenderTabSaveOutcome(result, args.labels);
  (args.announce ?? announceTenderTabSaveOutcome)(outcome);

  if (args.staleRetryArmed) args.staleRetryArmed.current = outcome.kind === "stale";
  if (outcome.confirmedSaved) {
    args.onConfirmed?.();
  } else if (outcome.kind === "stale") {
    args.onStale?.();
  }
  return outcome;
}

/**
 * B12 badge truth: green "Saved" only when a confirmed or hydrated checkpoint
 * is represented by the form and it holds no unsaved edits.
 */
export function identifiedSavedBadgeState(savedConfirmed: boolean, dirty: boolean): boolean {
  return savedConfirmed && !dirty;
}

export function hasPersistedIdentifiedCheckpoint(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

interface IdentifiedStageShellProps<T extends string> {
  activeSection: T;
  onSectionChange: (section: T) => void;
  sectionTabs: IdentifiedSectionTab<T>[];
  stageIntelOpen: boolean;
  onStageIntelOpenChange: (open: boolean) => void;
  metrics: IdentifiedStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  /** B12: real save state — green "Saved" after a confirmed save while clean. */
  saved?: boolean;
  unsaved?: boolean;
  actionSlot?: ReactNode;
  children: ReactNode;
}

export function IdentifiedStageShell<T extends string>({
  activeSection,
  onSectionChange,
  sectionTabs,
  stageIntelOpen,
  onStageIntelOpenChange,
  metrics,
  onOpenDocuments,
  onOpenGlobalIntel,
  saved,
  unsaved,
  actionSlot,
  children,
}: IdentifiedStageShellProps<T>) {
  return (
    <TenderStageTaskShell
      stageTitle="Identified Stage Menu"
      stageBadge="Stage 1"
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionTabs={sectionTabs}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={onStageIntelOpenChange}
      metrics={metrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
      unsaved={unsaved}
      actionSlot={actionSlot}
    >
      {children}
    </TenderStageTaskShell>
  );
}

export function IdentifiedSectionCard({
  title,
  icon,
  badge,
  hidden,
  children,
}: {
  title: string;
  icon: ReactNode;
  badge?: string;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <TenderStageSectionCard title={title} icon={icon} badge={badge} hidden={hidden}>
      {children}
    </TenderStageSectionCard>
  );
}

export function IdentifiedEmptyState({ text }: { text: string }) {
  return <TenderStageEmptyState text={text} />;
}
