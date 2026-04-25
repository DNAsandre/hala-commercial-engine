/**
 * DocumentVault — Central searchable repository of generated commercial documents.
 * Sprint 7: Search, filter, download, version history, comparison.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Download, Search, Clock, User, Filter, Eye, GitCompare,
  ChevronDown, ChevronRight, Archive, FileCheck, ShieldCheck, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const typeCfg: Record<string, { icon: any; label: string; color: string }> = {
  quote: { icon: FileText, label: "Quote", color: "bg-emerald-100 text-emerald-700" },
  proposal: { icon: FileCheck, label: "Proposal", color: "bg-blue-100 text-blue-700" },
  sla: { icon: ShieldCheck, label: "SLA", color: "bg-purple-100 text-purple-700" },
};
const statusCfg: Record<string, string> = {
  generated: "bg-emerald-100 text-emerald-700",
  superseded: "bg-amber-100 text-amber-700",
  archived: "bg-gray-100 text-gray-600",
};

export default function DocumentVault() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [compareA, setCompareA] = useState<any>(null);
  const [compareB, setCompareB] = useState<any>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [timeline, setTimeline] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (search) filters.search = search;
      if (typeFilter !== "all") filters.document_type = typeFilter;
      if (statusFilter !== "all") filters.status = statusFilter;
      const r = await api.documents.search(filters);
      setDocs(r.data || []);
    } catch (e: any) { console.warn(e.message); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleDownload = async (id: string) => {
    try {
      const res = await api.documents.download(id);
      if (res.data?.download_url) window.open(res.data.download_url, '_blank');
      else toast.error("Download URL not available");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.documents.updateStatus(id, "archived");
      toast.success("Document archived");
      fetchDocs();
    } catch (e: any) { toast.error(e.message); }
  };

  // Group by source for timeline
  const timelineDocs = timeline
    ? docs.filter(d => d.source_id === timeline).sort((a, b) => a.version_number - b.version_number)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-serif font-semibold">Document Vault</h1>
        <Badge variant="outline" className="text-xs">{docs.length} documents</Badge>
      </div>

      {/* Filters */}
      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..."
                className="h-8 text-xs pl-8" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="proposal">Proposal</SelectItem>
                <SelectItem value="sla">SLA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="generated">Generated</SelectItem>
                <SelectItem value="superseded">Superseded</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Compare panel */}
      {showCompare && compareA && compareB && (
        <Card className="border-2 border-blue-200 shadow-sm">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-serif flex items-center gap-2"><GitCompare className="w-4 h-4" />Document Comparison</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setShowCompare(false); setCompareA(null); setCompareB(null); }} className="text-xs h-6">Close</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <CompareCol doc={compareA} />
              <CompareCol doc={compareB} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document list */}
      {loading ? <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>
      : docs.length === 0 ? (
        <Card className="border shadow-sm"><CardContent className="py-12 text-center">
          <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No generated documents yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Generate a PDF from a Quote, Proposal, or SLA first.</p>
        </CardContent></Card>
      ) : (
        <Card className="border shadow-sm">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30 text-[10px] text-muted-foreground uppercase">
                  <th className="px-3 py-2 text-left font-medium">Document</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Source</th>
                  <th className="px-3 py-2 text-left font-medium">Version</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Generated</th>
                  <th className="px-3 py-2 text-left font-medium">Size</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => {
                  const cfg = typeCfg[d.document_type] || typeCfg.quote;
                  const Icon = cfg.icon;
                  const isSelected = compareA?.id === d.id || compareB?.id === d.id;
                  return (
                    <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/10 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{d.file_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><Badge variant="outline" className={`text-[9px] ${cfg.color}`}>{cfg.label}</Badge></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.source_id?.substring(0, 8)}… v{d.source_version}</td>
                      <td className="px-3 py-2.5 text-xs font-medium">v{d.version_number}</td>
                      <td className="px-3 py-2.5"><Badge variant="outline" className={`text-[9px] ${statusCfg[d.status] || ''}`}>{d.status}</Badge></td>
                      <td className="px-3 py-2.5">
                        <div className="text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date(d.generated_at).toLocaleDateString()}</div>
                          {d.generated_by && <div className="flex items-center gap-1"><User className="w-2.5 h-2.5" />{d.generated_by.substring(0, 8)}</div>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground">{(d.file_size / 1024).toFixed(1)} KB</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleDownload(d.id)} className="text-[10px] h-6"><Download className="w-2.5 h-2.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setTimeline(timeline === d.source_id ? null : d.source_id)} className="text-[10px] h-6" title="Version timeline"><Eye className="w-2.5 h-2.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (!compareA) setCompareA(d);
                            else if (!compareB) { setCompareB(d); setShowCompare(true); }
                            else { setCompareA(d); setCompareB(null); setShowCompare(false); }
                          }} className={`text-[10px] h-6 ${isSelected ? 'text-blue-600' : ''}`} title="Compare"><GitCompare className="w-2.5 h-2.5" /></Button>
                          {d.status === 'generated' && <Button variant="ghost" size="sm" onClick={() => handleArchive(d.id)} className="text-[10px] h-6" title="Archive"><Archive className="w-2.5 h-2.5" /></Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Version Timeline */}
      {timeline && timelineDocs.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-serif flex items-center gap-2"><Clock className="w-4 h-4" />Version Timeline</CardTitle></CardHeader>
          <CardContent className="pt-3">
            <div className="relative pl-6">
              {timelineDocs.map((d, i) => (
                <div key={d.id} className="relative pb-4 last:pb-0">
                  <div className="absolute left-[-18px] top-1 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-hala-navy,#1B2A4A)] bg-background" />
                  {i < timelineDocs.length - 1 && <div className="absolute left-[-14px] top-4 w-0.5 h-full bg-border" />}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">v{d.version_number}</span>
                    <Badge variant="outline" className={`text-[9px] ${statusCfg[d.status] || ''}`}>{d.status}</Badge>
                    <span className="text-muted-foreground">{new Date(d.generated_at).toLocaleString()}</span>
                    {d.generated_by && <span className="text-muted-foreground">by {d.generated_by.substring(0, 8)}</span>}
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(d.id)} className="text-[10px] h-5 ml-auto"><Download className="w-2.5 h-2.5 mr-0.5" />Download</Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Source v{d.source_version} • {d.file_name} • {(d.file_size / 1024).toFixed(1)} KB
                    {d.supersedes_document_id && <span className="ml-2">↑ supersedes {d.supersedes_document_id.substring(0, 8)}</span>}
                    {d.notes && <span className="ml-2 italic">"{d.notes}"</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CompareCol({ doc }: { doc: any }) {
  if (!doc) return <div className="text-center text-muted-foreground">Select a document</div>;
  return (
    <div className="space-y-1.5 p-2 rounded border">
      <p className="font-semibold text-xs">{doc.file_name}</p>
      <Row l="Type" v={doc.document_type} />
      <Row l="Version" v={`v${doc.version_number}`} />
      <Row l="Source Version" v={`v${doc.source_version}`} />
      <Row l="Status" v={doc.status} />
      <Row l="Generated" v={new Date(doc.generated_at).toLocaleString()} />
      <Row l="Generated By" v={doc.generated_by || '—'} />
      <Row l="Size" v={`${(doc.file_size / 1024).toFixed(1)} KB`} />
      <Row l="Checksum" v={doc.checksum?.substring(0, 12) || '—'} />
      <Row l="Language" v={doc.language} />
      {doc.supersedes_document_id && <Row l="Supersedes" v={doc.supersedes_document_id.substring(0, 12)} />}
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between border-b border-dashed border-muted py-0.5 last:border-0"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>;
}
