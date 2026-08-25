/**
 * WorkspaceDocumentSection — stored document records for Quotes and Proposals.
 * Final customer PDF composition/export belongs to Final Pack Studio.
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Clock, User, FileCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  downloadDocumentToUser,
  formatDocumentFileSize,
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

export default function WorkspaceDocumentSection({ workspaceId }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const handleDownload = async (docId: string) => {
    try {
      // Delivers the real file: the stored bytes, or the server's signed URL.
      await downloadDocumentToUser(docId);
    } catch (e: any) { toast.error(e?.message || "Download failed"); }
  };

  const latestDocs = docs.filter(d => d.status === "generated" && (d.document_type === "quote" || d.document_type === "proposal"));
  const supersededDocs = docs.filter(d => d.status === "superseded" && (d.document_type === "quote" || d.document_type === "proposal"));

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-serif flex items-center gap-2">
          <FileText className="w-4 h-4" /> Stored Document Records
          {latestDocs.length > 0 && <Badge variant="outline" className="text-[10px]">{latestDocs.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            Create, review, and export the customer-facing PDF in Final Pack Studio.
          </p>
          <Link href="/pdf-studio" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
            Open Studio <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

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
