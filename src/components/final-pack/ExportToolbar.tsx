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
      // Reset to idle after 3s
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, [key]: { state: "idle" } }));
      }, 3000);
    } else {
      setStatus((prev) => ({
        ...prev,
        [key]: { state: "error", error: result.error },
      }));
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
    const ok = results.every((r) => r.success);
    setAllStatus({ state: ok ? "success" : "error", error: ok ? undefined : "Some volumes failed" });
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
