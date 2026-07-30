/**
 * TenderKnowledgeBasePanel.tsx
 * ────────────────────────────
 * Sprint 3.1 (read-only summary) + Sprint 3.2 (optional human metadata editing).
 *
 * Summarizes a tender's documents by source role, orchestration inclusion,
 * extraction readiness, and primary source. When `onUpdate` is provided, the
 * reviewer can edit ONLY the four KB metadata fields (source_role,
 * orchestration_included, extraction_readiness, primary_source) — never file
 * paths, canonical tender fields, stage, CRM, or the document output layer.
 *
 * It writes nothing itself: edits are delegated to the parent via `onUpdate`,
 * which routes them through the existing document-metadata patch path. It runs
 * no extraction and never reads document contents.
 */

import { Library, Star } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  summarizeTenderKnowledgePackage,
  groupDocumentsBySourceRole,
  normalizeExtractionReadiness,
  isOrchestrationIncluded,
  classifyTenderDocumentRole,
  normalizeSourceRole,
  buildSetRolePatch,
  buildInclusionPatch,
  buildPrimaryPatch,
  buildReadinessPatch,
  TENDER_SOURCE_ROLES,
  EDITABLE_READINESS_STATES,
  type KbDocument,
  type KbDocPatch,
} from "@/lib/tender-knowledge-base";

interface Props {
  documents: KbDocument[];
  packageName?: string;
  busyId?: string | null;
  /** When provided, the panel renders metadata editors. Document-metadata only. */
  onUpdate?: (documentId: string, patch: KbDocPatch) => void;
}

export default function TenderKnowledgeBasePanel({ documents, packageName = "Tender Knowledge Base", busyId, onUpdate }: Props) {
  const summary = summarizeTenderKnowledgePackage(documents);
  const groups = groupDocumentsBySourceRole(documents);
  const editable = !!onUpdate;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <Library className="h-3.5 w-3.5 text-[var(--color-hala-navy)]" />
          <span className="text-xs font-semibold text-foreground">{packageName}</span>
          <Badge variant="outline" className="text-[9px]">{summary.total} docs</Badge>
          <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-700 bg-emerald-50">{summary.included} included</Badge>
          {summary.excluded > 0 && <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-600 bg-slate-50">{summary.excluded} excluded</Badge>}
          {summary.primarySources > 0 && <Badge variant="outline" className="text-[9px] border-amber-200 text-amber-700 bg-amber-50">{summary.primarySources} primary</Badge>}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <p className="text-[10px] text-muted-foreground">Organizes source documents for future orchestration. No content is read or extracted; nothing here updates tender fields.</p>
        {summary.total === 0 ? (
          <p className="text-xs text-muted-foreground">No tender documents yet. This tender can continue normally.</p>
        ) : (
          groups.map(({ role, documents: docs }) => (
            <div key={role} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{role}</span>
                <Badge variant="outline" className="text-[8px]">{docs.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {docs.map((d) => {
                  const readiness = normalizeExtractionReadiness(d.extraction_readiness);
                  const included = isOrchestrationIncluded(d);
                  const inferred = normalizeSourceRole(d.source_role ?? classifyTenderDocumentRole(d.document_name, d));
                  const busy = busyId === d.id;
                  return (
                    <div key={d.id} className="flex items-center gap-2 text-[11px] flex-wrap">
                      {d.primary_source && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
                      <span className="text-foreground truncate max-w-[280px]" title={d.document_name}>{d.document_name}</span>
                      {d.document_type && <span className="text-[9px] text-muted-foreground">· {d.document_type}</span>}

                      {editable ? (
                        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                          <select
                            value={inferred}
                            disabled={busy}
                            onChange={(e) => onUpdate!(d.id, buildSetRolePatch(e.target.value))}
                            className="h-6 rounded border border-border bg-card px-1 text-[9px]"
                            aria-label="Source role"
                          >
                            {TENDER_SOURCE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <select
                            value={readiness}
                            disabled={busy}
                            onChange={(e) => { const patch = buildReadinessPatch(e.target.value); if (patch) onUpdate!(d.id, patch); }}
                            className="h-6 rounded border border-border bg-card px-1 text-[9px]"
                            aria-label="Extraction readiness"
                          >
                            {EDITABLE_READINESS_STATES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px]" disabled={busy} onClick={() => onUpdate!(d.id, buildInclusionPatch(!included))}>
                            {included ? "exclude" : "include"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-1.5 text-[9px]" disabled={busy} onClick={() => onUpdate!(d.id, buildPrimaryPatch(!d.primary_source))}>
                            {d.primary_source ? "unset primary" : "set primary"}
                          </Button>
                        </div>
                      ) : (
                        <div className="ml-auto flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[8px]">{inferred}</Badge>
                          <Badge variant="outline" className={`text-[8px] ${included ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>{included ? "included" : "excluded"}</Badge>
                          <Badge variant="outline" className="text-[8px] text-muted-foreground">{readiness}</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
