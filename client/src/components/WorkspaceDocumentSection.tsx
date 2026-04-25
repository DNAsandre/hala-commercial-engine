/**
 * WorkspaceDocumentSection — PDF generation + download for Quotes, Proposals, SLAs
 * Sprint 6: Server-generated PDFs, stored in Supabase, fully audited.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, RefreshCw, Clock, User, FileCheck, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const typeCfg: Record<string, { icon: any; label: string; color: string }> = {
  quote: { icon: FileText, label: "Quote", color: "bg-emerald-100 text-emerald-700" },
  proposal: { icon: FileCheck, label: "Proposal", color: "bg-blue-100 text-blue-700" },
  sla: { icon: ShieldCheck, label: "SLA", color: "bg-purple-100 text-purple-700" },
};

interface Props {
  workspaceId: string;
  quotes?: any[];
  proposals?: any[];
  slas?: any[];
}

export default function WorkspaceDocumentSection({ workspaceId, quotes = [], proposals = [], slas = [] }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try { const r = await api.documents.listByWorkspace(workspaceId); setDocs(r.data || []); }
    catch (e: any) { console.warn("[DocSection]", e.message); }
    finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleGenerate = async (docType: string, sourceId: string, sourceVersion?: number) => {
    const key = `${docType}-${sourceId}`;
    setGenerating(key);
    try {
      await api.documents.generatePdf({ workspace_id: workspaceId, document_type: docType, source_id: sourceId, source_version: sourceVersion });
      toast.success(`${docType.charAt(0).toUpperCase() + docType.slice(1)} PDF generated`);
      fetchDocs();
    } catch (e: any) { toast.error(e.message || "Generation failed"); }
    finally { setGenerating(null); }
  };

  const handleDownload = async (docId: string) => {
    try {
      const res = await api.documents.download(docId);
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
      } else { toast.error("Download URL not available"); }
    } catch (e: any) { toast.error(e.message); }
  };

  // Build generation sources
  const sources: Array<{ type: string; id: string; version?: number; label: string; status: string }> = [];
  for (const q of quotes.filter(q => q.status !== "superseded")) {
    sources.push({ type: "quote", id: q.id, version: q.version_number || q.version, label: q.quote_number || `Q-V${q.version_number}`, status: q.status });
  }
  for (const p of proposals.filter(p => p.status !== "superseded")) {
    sources.push({ type: "proposal", id: p.id, version: p.version_number || p.version, label: p.proposal_number || `P-V${p.version_number}`, status: p.status });
  }
  for (const s of slas.filter(s => s.status !== "superseded")) {
    sources.push({ type: "sla", id: s.id, version: s.version_number, label: s.sla_number || `SLA-V${s.version_number}`, status: s.status });
  }

  const latestDocs = docs.filter(d => d.status === "generated");

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
                const cfg = typeCfg[s.type] || typeCfg.quote;
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
        : latestDocs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">No documents generated yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Generated Documents</p>
            {latestDocs.map(d => {
              const cfg = typeCfg[d.document_type] || typeCfg.quote;
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
                        <span>{(d.file_size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(d.id)} className="text-xs h-6"><Download className="w-3 h-3 mr-0.5" />Download</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleGenerate(d.document_type, d.source_id, d.source_version)} disabled={!!generating} className="text-xs h-6"><RefreshCw className="w-3 h-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Superseded docs */}
        {docs.filter(d => d.status === "superseded").length > 0 && (
          <details className="text-xs">
            <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Previous versions ({docs.filter(d => d.status === "superseded").length})</summary>
            <div className="mt-2 space-y-1.5">
              {docs.filter(d => d.status === "superseded").map(d => (
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
