/**
 * StandaloneBlankPanel.tsx
 * ────────────────────────
 * FPS-001-08 — Blank standalone document creation.
 *
 * All fields are OPTIONAL. Nothing here is a gate: the user can create a
 * document with everything blank. Create builds a standalone blank source,
 * dispatches it, persists the instance, and hands off to the shared composer.
 */

import { useState, useCallback } from "react";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { loadDocumentPack } from "@/lib/load-document-pack";
import type { DocumentIntent } from "@/lib/document-source";
import { useFinalPackInstance, type FinalPackInstance } from "@/hooks/useFinalPackInstance";

interface StandaloneBlankPanelProps {
  onInstanceReady: (instance: FinalPackInstance) => void;
  onBack: () => void;
}

const INTENTS: { value: DocumentIntent; label: string }[] = [
  { value: "custom_pdf", label: "Custom PDF" },
  { value: "combined_proposal", label: "Proposal" },
  { value: "quotation", label: "Quotation" },
  { value: "sla", label: "SLA" },
  { value: "msa", label: "MSA" },
  { value: "bilingual_quotation", label: "Bilingual Quotation" },
];

export default function StandaloneBlankPanel({
  onInstanceReady,
  onBack,
}: StandaloneBlankPanelProps) {
  const { createInstance, loading, error } = useFinalPackInstance();
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState<DocumentIntent>("custom_pdf");
  const [customerName, setCustomerName] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [creating, setCreating] = useState(false);
  // W04-T09 — a failed create used to log to the console and look like nothing
  // happened. Surface it.
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const snapshot = await loadDocumentPack({
        mode: "standalone",
        kind: "manual",
        creation: "blank",
        packType: intent,
        title: title || undefined,
        customerName: customerName || undefined,
        refNumber: refNumber || undefined,
      });
      if (snapshot.error) {
        console.error("[StandaloneBlankPanel] Loader error:", snapshot.error);
        setCreateError(`Could not create the document: ${snapshot.error}`);
        return;
      }
      const instance = await createInstance(null, snapshot);
      if (instance) onInstanceReady(instance);
    } catch (err) {
      console.error("[StandaloneBlankPanel] Create failed:", err);
      setCreateError(err instanceof Error ? err.message : "Could not create the document.");
    } finally {
      setCreating(false);
    }
  }, [intent, title, customerName, refNumber, createInstance, onInstanceReady]);

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Start Blank</h2>
          <p className="text-sm text-muted-foreground">
            All fields are optional — you can fill them in later in the composer.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Document title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Document"
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Document type</label>
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value as DocumentIntent)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {INTENTS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Customer / display name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Reference number <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {(error || createError) && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{createError || error}</span>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={creating || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Document
        </button>
      </div>
    </main>
  );
}
