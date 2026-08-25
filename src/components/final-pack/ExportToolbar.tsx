/**
 * ExportToolbar.tsx
 * ─────────────────
 * FPS-028 — Toolbar with 5 always-available export actions.
 *
 * CRITICAL RULES:
 * - All 5 buttons ALWAYS enabled. No disabled state. No conditional rendering.
 * - No coupling to WarningBanner.
 * - No checking bot status.
 * - No reading can_export_to_pdf_studio.
 * - No confirmation modals.
 *
 * Source-truth safety: Triggers export engine → doc_compiled_outputs only.
 */

import { useState } from "react";
import { FileDown, Printer, FileText, Loader2, Check, AlertCircle, Layers } from "lucide-react";
import {
  executeExport, exportAllVolumes,
  type ExportMode, type ExportAction, type ExportRequest, type VolumeForExport,
  type ExportDelivery, type ExportResult,
} from "@/lib/final-pack-export";
import type { BrandingProfile } from "@/lib/final-pack-preview";
import type { OutputBlock } from "@/lib/final-pack-loader";

interface ExportToolbarProps {
  instanceId: string;
  templateId: string;
  blocks: OutputBlock[];
  branding: BrandingProfile;
  title: string;
  customerName: string;
  refNumber: string;
  date: string;
  compiledBy: string;
  // Optional audit metadata context (FPS-002-12) — never affects availability.
  sourceMode?: string;
  sourceKind?: string;
  creationMethod?: string;
  templateVersionId?: string | null;
  templateClass?: string;
  instanceLastEditedAt?: string | null;
  layout?: Record<string, unknown> | null;
  // Volume context (FPS-006). When a volume is selected, normal exports produce
  // that volume; allVolumes enables the "All Volumes" action.
  volumeKey?: string | null;
  volumeTitle?: string | null;
  volumeBlockKeys?: string[] | null;
  allVolumes?: VolumeForExport[];
}

type ActionState = "idle" | "loading" | "success" | "error";

interface ActionStatus {
  state: ActionState;
  error?: string;
}

/**
 * W04-C4 — say exactly what happened.
 *
 * Opening the browser's print dialog is not the same event as a PDF file being
 * written to disk; the page cannot observe the second one. The toolbar used to
 * show a green tick for both. It now names the step that actually completed,
 * and separately reports when the export audit row could not be confirmed.
 */
export function describeExportOutcome(result: ExportResult): string {
  const delivery: Record<ExportDelivery, string> = {
    file_downloaded: "File handed to the browser for download.",
    print_dialog_opened:
      "Print pipeline invoked — choose “Save as PDF” in the print dialog to write the file. This page cannot confirm the file was saved.",
    server_file_opened: "Server-rendered file opened in a new tab.",
  };
  const parts: string[] = [];
  if (result.delivered) parts.push(delivery[result.delivered]);
  // PADW T06e (PDS-12): a text-only fallback render is a real fidelity
  // downgrade — it is named here, never hidden behind the same tick.
  if (result.rendererNote) parts.push(result.rendererNote);
  if (result.auditPersisted === false) {
    parts.push(
      `Export audit row was NOT confirmed stored${result.auditError ? ` — ${result.auditError}` : ""}.`,
    );
  }
  return parts.join(" ");
}

export default function ExportToolbar({
  instanceId,
  templateId,
  blocks,
  branding,
  title,
  customerName,
  refNumber,
  date,
  compiledBy,
  sourceMode,
  sourceKind,
  creationMethod,
  templateVersionId,
  templateClass,
  instanceLastEditedAt,
  layout,
  volumeKey,
  volumeTitle,
  volumeBlockKeys,
  allVolumes,
}: ExportToolbarProps) {
  const [status, setStatus] = useState<Record<string, ActionStatus>>({});
  // W04-C4: the precise outcome of the last export, shown in the toolbar.
  const [outcome, setOutcome] = useState<{ text: string; advisory: boolean } | null>(null);

  const handleExport = async (action: ExportAction, mode: ExportMode) => {
    const key = `${action}-${mode}`;
    setStatus((prev) => ({ ...prev, [key]: { state: "loading" } }));

    const req: ExportRequest = {
      instanceId,
      templateId,
      blocks,
      branding,
      exportMode: mode,
      action,
      customerName,
      title,
      refNumber,
      date,
      compiledBy,
      sourceMode,
      sourceKind,
      creationMethod,
      templateVersionId,
      templateClass,
      instanceLastEditedAt,
      layout,
      volumeKey,
      volumeTitle,
      volumeBlockKeys,
    };

    const result = await executeExport(req);

    if (result.success) {
      setStatus((prev) => ({ ...prev, [key]: { state: "success" } }));
      setOutcome({
        text: describeExportOutcome(result),
        advisory: result.auditPersisted === false || Boolean(result.rendererNote),
      });
      // Reset to idle after 3s
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, [key]: { state: "idle" } }));
      }, 3000);
    } else {
      setStatus((prev) => ({
        ...prev,
        [key]: { state: "error", error: result.error },
      }));
      setOutcome({ text: `Export failed — ${result.error ?? "unknown error"}`, advisory: true });
      // Reset to idle after 5s
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, [key]: { state: "idle" } }));
      }, 5000);
    }
  };

  const [allStatus, setAllStatus] = useState<ActionStatus>({ state: "idle" });
  const handleAllVolumes = async () => {
    if (!allVolumes || allVolumes.length === 0) return;
    setAllStatus({ state: "loading" });
    const base = {
      instanceId, templateId, blocks, branding,
      exportMode: "final" as ExportMode,
      customerName, title, refNumber, date, compiledBy,
      sourceMode, sourceKind, creationMethod, templateVersionId, templateClass, instanceLastEditedAt, layout,
    };
    const { results } = await exportAllVolumes(base, allVolumes);
    const failed = results.filter((r) => !r.success);
    const unaudited = results.filter((r) => r.success && r.auditPersisted === false);
    const ok = failed.length === 0;
    setAllStatus({
      state: ok ? "success" : "error",
      error: ok ? undefined : `${failed.length} of ${results.length} volumes failed`,
    });
    setOutcome({
      text: [
        `${results.length - failed.length} of ${results.length} volume files handed to the browser for download.`,
        failed.length > 0 ? `${failed.length} failed: ${failed.map((f) => f.volume_key).join(", ")}.` : "",
        unaudited.length > 0
          ? `${unaudited.length} export audit row(s) were NOT confirmed stored.`
          : "",
      ].filter(Boolean).join(" "),
      advisory: failed.length > 0 || unaudited.length > 0,
    });
    setTimeout(() => setAllStatus({ state: "idle" }), 4000);
  };

  return (
    <div className="fps-export-toolbar">
      <span className="text-xs font-medium text-muted-foreground mr-2">Export:</span>

      {/* Draft PDF */}
      <ExportButton
        label="Draft PDF"
        icon={<FileDown className="h-3.5 w-3.5" />}
        status={status["pdf-draft"]}
        onClick={() => handleExport("pdf", "draft")}
      />

      {/* Test PDF */}
      <ExportButton
        label="Test PDF"
        icon={<FileDown className="h-3.5 w-3.5" />}
        status={status["pdf-test"]}
        onClick={() => handleExport("pdf", "test")}
      />

      {/* Final PDF */}
      <ExportButton
        label="Final PDF"
        icon={<FileText className="h-3.5 w-3.5" />}
        status={status["pdf-final"]}
        onClick={() => handleExport("pdf", "final")}
      />

      <div className="h-5 w-px bg-border mx-1" />

      {/* Print Preview */}
      <ExportButton
        label="Print"
        icon={<Printer className="h-3.5 w-3.5" />}
        status={status["print-draft"]}
        onClick={() => handleExport("print", "draft")}
      />

      {/* HTML Download */}
      <ExportButton
        label="HTML"
        icon={<FileDown className="h-3.5 w-3.5" />}
        status={status["html-draft"]}
        onClick={() => handleExport("html", "draft")}
      />

      {/* All Volumes — separate file per volume (FPS-006-08). Never disables full export. */}
      {allVolumes && allVolumes.length > 0 && (
        <>
          <div className="h-5 w-px bg-border mx-1" />
          <ExportButton
            label={`All Volumes (${allVolumes.length})`}
            icon={<Layers className="h-3.5 w-3.5" />}
            status={allStatus}
            onClick={handleAllVolumes}
          />
        </>
      )}

      {/* W04-C4: the precise outcome of the last export — never a bare tick. */}
      {outcome && (
        <span
          role="status"
          className={`ml-2 basis-full text-[11px] leading-snug ${
            outcome.advisory ? "text-amber-600" : "text-muted-foreground"
          }`}
        >
          {outcome.text}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Individual export button
// ═══════════════════════════════════════════════════════════

function ExportButton({
  label,
  icon,
  status,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  status?: ActionStatus;
  onClick: () => void;
}) {
  const state = status?.state || "idle";

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors bg-card border border-border text-foreground hover:bg-accent hover:text-accent-foreground"
      title={state === "error" ? status?.error : label}
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "success" ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : state === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}
