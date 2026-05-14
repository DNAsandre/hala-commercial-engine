import { useEffect, useState, useMemo } from "react";
import {
  Archive, CheckCircle, Database, FileText, FolderOpen,
  Info, Shield, Truck,
} from "lucide-react";
import {
  CommercialOsShell, DataTable, ErrorState, LoadingState, MetricCard,
} from "@/components/commercial-os/CommercialOsShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchDocumentVault,
  type DocumentVaultRow,
} from "@/lib/commercial-os-data";

const TYPE_META: Record<string, { label: string; cls: string }> = {
  source_import:        { label: "Import",         cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  monthly_report:       { label: "Monthly Report", cls: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  customer_review_pack: { label: "Customer Pack",  cls: "border-blue-200 bg-blue-50 text-blue-700" },
  governance_pack:      { label: "Governance",     cls: "border-violet-200 bg-violet-50 text-violet-700" },
  finance_snapshot:     { label: "Finance",        cls: "border-amber-200 bg-amber-50 text-amber-700" },
  forecast_snapshot:    { label: "Forecast",       cls: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  tender_reference:     { label: "Tender Ref",     cls: "border-rose-200 bg-rose-50 text-rose-700" },
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:     { label: "Active",     cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  archived:   { label: "Archived",   cls: "border-slate-200 bg-slate-50 text-slate-500" },
  superseded: { label: "Superseded", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  draft:      { label: "Draft",      cls: "border-blue-200 bg-blue-50 text-blue-700" },
};

function fmtDate(v: string) {
  if (!v) return "--";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function tierBadge(tier: number) {
  const cls = tier <= 2 ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : tier === 3 ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-amber-200 bg-amber-50 text-amber-700";
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>T{tier}</Badge>;
}

export default function CommercialOsDocuments() {
  const [docs, setDocs] = useState<DocumentVaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchDocumentVault()
      .then(setDocs)
      .catch(e => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    filter === "all" ? docs : docs.filter(d => d.documentType === filter),
    [docs, filter]
  );

  const types = useMemo(() => Array.from(new Set(docs.map(d => d.documentType))), [docs]);

  const activeCount = docs.filter(d => d.versionStatus === "active").length;
  const archivedCount = docs.filter(d => d.versionStatus === "archived" || d.versionStatus === "superseded").length;

  return (
    <CommercialOsShell
      title="Document Vault"
      description="Read-only artifact registry for Commercial OS documents, imports, and governance packs."
    >
      <div className="space-y-4">
        {loading ? <LoadingState label="document vault" /> : error ? <ErrorState error={error} /> : null}

        {!loading && !error && (
          <>
            {/* Governance Banner */}
            <div className="rounded border border-amber-100 bg-amber-50/50 px-3 py-2 flex flex-wrap gap-3">
              <span className="text-[10px] font-medium text-amber-800 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Artifact registry
              </span>
              <span className="text-[10px] text-amber-700">• Read-only metadata governance</span>
              <span className="text-[10px] text-amber-700">• Source files remain system-of-record</span>
              <span className="text-[10px] text-amber-700">• Vault does not replace source truth</span>
              <span className="text-[10px] text-amber-700">• No CRM or workflow</span>
            </div>

            {/* Header */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-semibold text-foreground">Document Vault</p>
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">DOC-001</Badge>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                    Read-only · {docs.length} artifacts
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <MetricCard label="Total Artifacts" value={String(docs.length)} helper="Registered documents" />
                  <MetricCard label="Active" value={String(activeCount)} helper="Current versions" />
                  <MetricCard label="Archived" value={String(archivedCount)} helper="Superseded / archived" />
                  <MetricCard label="Document Types" value={String(types.length)} helper="Distinct categories" />
                </div>
              </CardContent>
            </Card>

            {/* Type Filter */}
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                All ({docs.length})
              </button>
              {types.map(t => {
                const meta = TYPE_META[t] || { label: t, cls: "" };
                const count = docs.filter(d => d.documentType === t).length;
                return (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Document Table */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                    No documents found for this filter.
                  </div>
                ) : (
                  <DataTable columns={["Document", "Type", "Entity", "Source", "Version", "Status", "Truth", "Tier", "Date"]}>
                    {filtered.map(doc => {
                      const typeMeta = TYPE_META[doc.documentType] || { label: doc.documentType, cls: "" };
                      const statusMeta = STATUS_META[doc.versionStatus] || STATUS_META.active;
                      return (
                        <tr key={doc.id} className="text-xs">
                          <td className="px-3 py-2">
                            <div>
                              <span className="font-medium">{doc.documentTitle}</span>
                              {doc.sourceFileName && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{doc.sourceFileName}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={`text-[10px] ${typeMeta.cls}`}>{typeMeta.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{doc.relatedEntityType}</td>
                          <td className="px-3 py-2 text-muted-foreground">{doc.sourceSystem}</td>
                          <td className="px-3 py-2 font-mono">v{doc.versionNumber}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={`text-[10px] ${statusMeta.cls}`}>{statusMeta.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{doc.truthStatus}</td>
                          <td className="px-3 py-2">{tierBadge(doc.confidenceTier)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{fmtDate(doc.generatedAt)}</td>
                        </tr>
                      );
                    })}
                  </DataTable>
                )}
              </CardContent>
            </Card>

            {/* Detail cards per type */}
            {types.map(t => {
              const typeDocs = docs.filter(d => d.documentType === t);
              if (filter !== "all" && filter !== t) return null;
              const meta = TYPE_META[t] || { label: t, cls: "" };
              return (
                <Card key={t} className="shadow-none border-slate-200">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-2 border-b pb-2">
                      {t === 'tender_reference' ? <Truck className="h-4 w-4 text-rose-600" /> :
                       t === 'finance_snapshot' ? <Database className="h-4 w-4 text-amber-600" /> :
                       t === 'governance_pack' ? <CheckCircle className="h-4 w-4 text-violet-600" /> :
                       <FileText className="h-4 w-4 text-indigo-600" />}
                      <h3 className="text-sm font-semibold text-foreground">{meta.label}</h3>
                      <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{typeDocs.length} docs</Badge>
                    </div>
                    <div className="space-y-2">
                      {typeDocs.map(doc => (
                        <div key={doc.id} className="rounded border px-3 py-2 text-xs flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{doc.documentTitle}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{doc.sourceLineage}</p>
                            {doc.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{doc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {tierBadge(doc.confidenceTier)}
                            <Badge variant="outline" className={`text-[10px] ${(STATUS_META[doc.versionStatus] || STATUS_META.active).cls}`}>
                              {doc.versionStatus}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Footer */}
            <Card className="shadow-none border-slate-200">
              <CardContent className="p-4">
                <div className="rounded border border-blue-100 bg-blue-50/50 px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-800">Vault Governance</span>
                  </div>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>The Document Vault is a metadata registry for Commercial OS artifacts.</p>
                    <p>Source files remain in their original systems. The vault provides traceability and version tracking.</p>
                    <p>Vault entries are read-only. No files are moved, deleted, or modified by this registry.</p>
                    <p className="font-semibold">Vault does not replace source truth. Source systems remain authoritative.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span>• Artifact registry</span>
                  <span>• Read-only metadata governance</span>
                  <span>• No CRM</span>
                  <span>• No workflow</span>
                  <span>• No file deletion</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </CommercialOsShell>
  );
}
