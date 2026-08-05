/**
 * WorkspaceDocumentSection — PDF generation + download for Quotes and Proposals
 * Sprint 6: Server-generated PDFs, stored in Supabase, fully audited.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, RefreshCw, Clock, User, FileCheck, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  downloadDocumentToUser,
  formatDocumentFileSize,
  generateDocumentPdf,
  listWorkspaceDocuments,
  type DocumentRecord,
} from "@/lib/document-runtime";

type GeneratedDocumentType = "quote" | "proposal";

const typeCfg: Record<GeneratedDocumentType, { icon: any; label: string; color: string }> = {
  quote: { icon: FileText, label: "Quote", color: "bg-emerald-100 text-emerald-700" },
  proposal: { icon: FileCheck, label: "Proposal", color: "bg-blue-100 text-blue-700" },
};

interface Props {
  workspaceId: string;
  quotes?: any[];
  proposals?: any[];
}

export default function WorkspaceDocumentSection({ workspaceId, quotes = [], proposals = [] }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  // SC-01 W03-4: the clean server is the only document backend. A failed load
  // is shown as a failure — it is never presented as "no documents".
  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listWorkspaceDocuments(workspaceId);
      setDocs(rows);
      setLoadError(null);
    } catch (e: any) {
      setDocs([]);
      setLoadError(e?.message || "Documents could not be loaded.");
    } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleGenerate = async (docType: GeneratedDocumentType, sourceId: string, sourceVersion?: number) => {
    const key = `${docType}-${sourceId}`;
    const label = docType.charAt(0).toUpperCase() + docType.slice(1);
    setGenerating(key);
    try {
      const result = await generateDocumentPdf({ workspace_id: workspaceId, document_type: docType, source_id: sourceId, source_version: sourceVersion });
      // Success is claimed only for what the server actually confirmed.
      if (result.fileGenerated) {
        toast.success(`${label} PDF generated`);
      } else {
        toast.warning(result.notice || `${label} document record created — the server did not report a generated PDF file.`);
      }
      fetchDocs();
    } catch (e: any) { toast.error(e?.message || "Generation failed"); }
    finally { setGenerating(null); }
  };

  const handleDownload = async (docId: string) => {
    try {
      // Delivers the real file: the stored bytes, or the server's signed URL.
      await downloadDocumentToUser(docId);
    } catch (e: any) { toast.error(e?.message || "Download failed"); }
  };

  // Build generation sources
  const sources: Array<{ type: GeneratedDocumentType; id: string; version?: number; label: string; status: string }> = [];
  for (const q of quotes.filter(q => q.status !== "superseded")) {
    sources.push({ type: "quote", id: q.id, version: q.version_number || q.version, label: q.quote_number || `Q-V${q.version_number}`, status: q.status });
  }
  for (const p of proposals.filter(p => p.status !== "superseded")) {
    sources.push({ type: "proposal", id: p.id, version: p.version_number || p.version, label: p.proposal_number || `P-V${p.version_number}`, status: p.status });
  }
  const latestDocs = docs.filter(d => d.status === "generated" && (d.document_type === "quote" || d.document_type === "proposal"));
  const supersededDocs = docs.filter(d => d.status === "superseded" && (d.document_type === "quote" || d.document_type === "proposal"));

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <FileText className="w-4 h-4" /> Generated Documents
          {latestDocs.length > 0 && <Badge variant="outline" className="text-[10px]">{latestDocs.length}</Badge>}
          <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50">Server PDF</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Generate actions */}
        {sources.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Generate Final PDF</p>
            <div className="flex flex-wrap gap-2">
              {sources.map(s => {
                const cfg = typeCfg[s.type];
                const Icon = cfg.icon;
                const isGen = generating === `${s.type}-${s.id}`;
                return (
                  <Button key={s.id} variant="outline" size="sm"
                    onClick={() => handleGenerate(s.type, s.id, s.version)}
                    disabled={!!generating} className="text-xs h-7 gap-1">
                    {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                    {s.label}
                    <Badge variant="outline" className={`text-[9px] ml-1 ${cfg.color}`}>{s.status}</Badge>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated documents list */}
        {loading ? <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
        : loadError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Documents could not be loaded
            </p>
            <p className="text-[10px] text-destructive/80 mt-1">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => fetchDocs()} className="text-xs h-6 mt-2">Retry</Button>
          </div>
        ) : latestDocs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">No documents generated yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Generated Documents</p>
            {latestDocs.map(d => {
              const docType = d.document_type as GeneratedDocumentType;
              const cfg = typeCfg[docType];
              const Icon = cfg.icon;
              return (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">{d.file_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <Badge variant="outline" className={`text-[9px] ${cfg.color}`}>{cfg.label}</Badge>
                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{new Date(d.generated_at).toLocaleDateString()}</span>
                        {(d.generated_by_name || d.generated_by) && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{d.generated_by_name || d.generated_by.substring(0, 8)}</span>}
                        {/* SC-01 W04 (Wave 03 obs 13): a NULL file_size used to
                            render the literal "NaN KB". Unknown reads as unknown. */}
                        <span>{formatDocumentFileSize(d.file_size)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(d.id)} className="text-xs h-6"><Download className="w-3 h-3 mr-0.5" />Download</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleGenerate(docType, d.source_id, d.source_version)} disabled={!!generating} className="text-xs h-6"><RefreshCw className="w-3 h-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Superseded docs */}
        {supersededDocs.length > 0 && (
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Previous versions ({supersededDocs.length})</summary>
            <div className="mt-2 space-y-1.5">
              {supersededDocs.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded border border-muted bg-muted/10 p-2">
                  <span className="text-[10px] text-muted-foreground">{d.file_name} — v{d.version_number}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d.id)} className="text-[10px] h-5"><Download className="w-2.5 h-2.5" /></Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
