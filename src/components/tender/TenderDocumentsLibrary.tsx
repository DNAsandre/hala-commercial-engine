import { useMemo, useState } from "react";
import { Download, Edit, FileText, FolderOpen, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getSignedDownloadUrl } from "@/lib/document-vault";
import {
  displayTenderDocumentStageRelevance,
  getTenderDocumentStatusColor,
  isTenderDocumentExpired,
  tenderDocumentMatchesStage,
  TENDER_DOCUMENT_CATEGORIES,
  TENDER_DOCUMENT_STATUSES,
  TENDER_STAGE_RELEVANCE_OPTIONS,
  type TenderDocument,
  type TenderDocumentCategory,
  type TenderDocumentStatus,
  type TenderStageRelevance,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";
import TenderDocumentModal from "./TenderDocumentModal";

interface TenderDocumentsLibraryProps {
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
  initialCategory?: TenderDocumentCategory | "all";
  initialStage?: TenderStageRelevance | "all";
}

function categoryCount(docs: TenderDocument[], category: TenderDocumentCategory): number {
  return docs.filter(doc => doc.document_category === category).length;
}

async function openDocument(doc: TenderDocument) {
  // TCW-T5: this used to run without a try/catch — a signing-transport failure
  // became an unhandled rejection and the user saw NOTHING (which reads as a
  // dead button). Failures now surface with their reason, like the drawer.
  try {
    if (!doc.storage_path && !doc.file_url) {
      toast.info("No file link is available for this document.");
      return;
    }
    if (doc.file_url) {
      window.open(doc.file_url, "_blank", "noopener,noreferrer");
      return;
    }
    const url = await getSignedDownloadUrl(doc.storage_path);
    if (!url) {
      toast.error("Could not create a download link.", {
        description: "The storage service returned no signed URL for this file's stored path.",
      });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (err) {
    toast.error("Could not open this document.", {
      description: err instanceof Error ? err.message : "The download link request failed.",
    });
  }
}

export default function TenderDocumentsLibrary({ ws, tenderId, reload, initialCategory = "all", initialStage = "all" }: TenderDocumentsLibraryProps) {
  const [category, setCategory] = useState<TenderDocumentCategory | "all">(initialCategory);
  const [status, setStatus] = useState<TenderDocumentStatus | "all">("all");
  const [stage, setStage] = useState<TenderStageRelevance | "all">(initialStage);
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<TenderDocument | null>(null);

  const docs = ws.documents ?? [];
  const documentTypes = useMemo(() => Array.from(new Set(docs.map(doc => doc.document_type).filter(Boolean))).sort(), [docs]);
  const missingExpired = docs.filter(doc => doc.status === "Missing" || doc.status === "Expired" || isTenderDocumentExpired(doc)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(doc => {
      if (category !== "all" && doc.document_category !== category) return false;
      if (status !== "all" && doc.status !== status) return false;
      if (stage !== "all" && !tenderDocumentMatchesStage(doc, stage)) return false;
      if (type !== "all" && doc.document_type !== type) return false;
      if (q && ![doc.document_name, doc.document_type, doc.owner, doc.notes].join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, docs, search, stage, status, type]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Documents</h3>
          <p className="text-xs text-muted-foreground">Tender-level library. Stage views filter this same register.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
          <Upload className="h-3.5 w-3.5" /> Upload Document
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        {TENDER_DOCUMENT_CATEGORIES.filter(item => item !== "Archived").map(item => (
          <Card key={item} className="shadow-none">
            <CardContent className="p-3">
              <p className="text-lg font-semibold">{categoryCount(docs, item)}</p>
              <p className="text-[10px] text-muted-foreground">{item === "Submission" ? "Submission Pack" : `${item} Documents`}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="shadow-none">
          <CardContent className="p-3">
            <p className={missingExpired > 0 ? "text-lg font-semibold text-red-600" : "text-lg font-semibold"}>{missingExpired}</p>
            <p className="text-[10px] text-muted-foreground">Missing / Expired</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search documents" className="pl-8" />
        </div>
        <Select value={category} onValueChange={value => setCategory(value as TenderDocumentCategory | "all")}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {TENDER_DOCUMENT_CATEGORIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={value => setStatus(value as TenderDocumentStatus | "all")}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TENDER_DOCUMENT_STATUSES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={value => setStage(value as TenderStageRelevance | "all")}>
          <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {TENDER_STAGE_RELEVANCE_OPTIONS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="max-w-xs">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {documentTypes.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {docs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Document</th>
                <th className="px-3 py-2 text-left font-semibold">Category</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Stage Relevance</th>
                <th className="px-3 py-2 text-left font-semibold">Owner</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No documents match current filters.</td></tr>
              ) : filtered.map(doc => (
                <tr key={doc.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <p className="font-medium">{doc.document_name}</p>
                    <p className="text-[10px] text-muted-foreground">v{doc.version || "1"} {doc.required_for_submission ? "· Required" : ""}</p>
                  </td>
                  <td className="px-3 py-2">{doc.document_category}</td>
                  <td className="px-3 py-2 text-muted-foreground">{doc.document_type || "-"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getTenderDocumentStatusColor(isTenderDocumentExpired(doc) ? "Expired" : doc.status)}`}>{isTenderDocumentExpired(doc) ? "Expired" : doc.status}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-[260px] flex-wrap gap-1">{doc.stage_relevance.length ? doc.stage_relevance.map(item => <Badge key={item} variant="outline" className="text-[9px]">{displayTenderDocumentStageRelevance(item)}</Badge>) : <span className="text-muted-foreground">-</span>}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{doc.owner || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditDoc(doc)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDocument(doc)}><Download className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <TenderDocumentModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        tenderId={tenderId}
        tenderName={ws.tender.title}
        customerId={ws.tender.customerId}
        customerName={ws.tender.customerName}
        defaultStage={initialStage === "all" ? undefined : initialStage}
        onSaved={reload}
      />
      <TenderDocumentModal
        open={!!editDoc}
        onOpenChange={open => !open && setEditDoc(null)}
        tenderId={tenderId}
        tenderName={ws.tender.title}
        customerId={ws.tender.customerId}
        customerName={ws.tender.customerName}
        document={editDoc}
        onSaved={reload}
      />
    </div>
  );
}
