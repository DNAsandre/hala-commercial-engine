import { useMemo, useState } from "react";
import { Download, FileText, FolderOpen, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { getSignedDownloadUrl } from "@/lib/document-vault";
import {
  displayTenderDocumentStageRelevance,
  documentsForTenderStage,
  getTenderDocumentStatusColor,
  isTenderDocumentExpired,
  type TenderDocument,
  type TenderStageRelevance,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";
import TenderDocumentModal from "./TenderDocumentModal";

interface TenderDocumentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
  defaultStage?: TenderStageRelevance;
}

async function openDocument(doc: TenderDocument) {
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
      toast.error("Could not create a download link.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.error("Could not open this document.");
    return;
  }
}

function DrawerSection({ title, docs, emptyLabel = "No documents uploaded yet." }: { title: string; docs: TenderDocument[]; emptyLabel?: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">{title}</h4>
        <Badge variant="outline" className="text-[9px]">{docs.length}</Badge>
      </div>
      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {docs.slice(0, 5).map(doc => (
            <div key={doc.id} className="rounded-md border p-2.5">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{doc.document_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{doc.document_category} - {doc.document_type || "Unspecified"} - v{doc.version || "1"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className={`text-[9px] ${getTenderDocumentStatusColor(isTenderDocumentExpired(doc) ? "Expired" : doc.status)}`}>{isTenderDocumentExpired(doc) ? "Expired" : doc.status}</Badge>
                    {doc.stage_relevance.slice(0, 2).map(stage => <Badge key={stage} variant="outline" className="text-[9px]">{displayTenderDocumentStageRelevance(stage)}</Badge>)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label={`Open ${doc.document_name}`}
                  onClick={() => void openDocument(doc)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function TenderDocumentDrawer({ open, onOpenChange, ws, tenderId, reload, defaultStage }: TenderDocumentDrawerProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const docs = ws.documents ?? [];
  const stageDocs = useMemo(
    () => defaultStage ? documentsForTenderStage(docs, defaultStage) : [],
    [defaultStage, docs],
  );
  const documentBuckets = useMemo(() => {
    const sourceDocs: TenderDocument[] = [];
    const supportingDocs: TenderDocument[] = [];
    const missingRequired: TenderDocument[] = [];
    const expiringExpired: TenderDocument[] = [];

    for (const doc of docs) {
      if (doc.document_category === "Source") sourceDocs.push(doc);
      if (doc.document_category === "Supporting") supportingDocs.push(doc);
      if (doc.required_for_submission && doc.status === "Missing") missingRequired.push(doc);
      if (doc.status === "Expired" || isTenderDocumentExpired(doc)) expiringExpired.push(doc);
    }

    return {
      sourceDocs,
      supportingDocs,
      missingRequired,
      expiringExpired,
      recentlyAdded: [...docs].sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime()).slice(0, 5),
    };
  }, [docs]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[420px] gap-0 overflow-y-auto sm:max-w-[420px]">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Tender Documents</SheetTitle>
            <SheetDescription className="sr-only">
              View and upload documents linked to {defaultStage ?? "this tender"}.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 p-4">
            {defaultStage && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document Stage</p>
                  <Badge variant="outline" className="text-[9px]">{defaultStage}</Badge>
                </div>
              </div>
            )}
            <Button className="w-full gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload Document
            </Button>
            {defaultStage && (
              <DrawerSection
                title={`${defaultStage} Documents`}
                docs={stageDocs}
                emptyLabel="No documents linked to this stage yet."
              />
            )}
            <DrawerSection title="Source Documents" docs={documentBuckets.sourceDocs} />
            <DrawerSection title="Supporting Documents" docs={documentBuckets.supportingDocs} />
            <DrawerSection title="Recently Added" docs={documentBuckets.recentlyAdded} />
            <DrawerSection title="Missing Required" docs={documentBuckets.missingRequired} />
            <DrawerSection title="Expiring / Expired" docs={documentBuckets.expiringExpired} />
          </div>
        </SheetContent>
      </Sheet>
      <TenderDocumentModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        tenderId={tenderId}
        tenderName={ws.tender.title}
        customerId={ws.tender.customerId}
        customerName={ws.tender.customerName}
        defaultStage={defaultStage}
        onSaved={reload}
      />
    </>
  );
}
