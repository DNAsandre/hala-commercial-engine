/**
 * TenderKnowledgeBaseSection.tsx
 * ──────────────────────────────
 * Sprint 3.2 — collapsible mount of the Tender Knowledge Base in the workspace.
 *
 * Scoped to ONE tender. Renders the KB panel with editing wired to the EXISTING
 * document-metadata patch path (updateTenderDocumentMetadata) — document metadata
 * ONLY (source_role / orchestration_included / extraction_readiness /
 * primary_source). It writes no canonical tender field, runs no extraction,
 * moves no stage/CRM, touches no document output layer, and never blocks work.
 */

import { useState } from "react";
import { Library, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { updateTenderDocumentMetadata } from "@/lib/supabase-tender-actions";
import type { TenderDocument } from "@/lib/tender-workspace-data";
import type { KbDocPatch } from "@/lib/tender-knowledge-base";
import TenderKnowledgeBasePanel from "./TenderKnowledgeBasePanel";

interface Props {
  tenderId: string;
  documents: TenderDocument[];
  reload: () => void;
}

export default function TenderKnowledgeBaseSection({ tenderId, documents, reload }: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onUpdate = async (documentId: string, patch: KbDocPatch) => {
    setBusyId(documentId);
    try {
      // Document-metadata only — never a canonical tender field.
      await updateTenderDocumentMetadata(tenderId, documentId, patch);
      reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="px-4 py-2.5 border-b border-border bg-muted/20">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <Library className="h-3.5 w-3.5 text-[var(--color-hala-navy)]" />
          <span className="text-xs font-semibold text-foreground">Tender Knowledge Base</span>
          <span className="text-[10px] text-muted-foreground">{documents.length} docs</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{open ? "Hide" : "Show"}</span>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="p-3">
          <TenderKnowledgeBasePanel documents={documents} busyId={busyId} onUpdate={(id, patch) => void onUpdate(id, patch)} />
        </CardContent>
      )}
    </Card>
  );
}
