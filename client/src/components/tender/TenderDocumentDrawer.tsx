import { useMemo, useState } from "react";
import { Download, FileText, FolderOpen, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { getSignedDownloadUrl } from "@/lib/document-vault";
import {
  getTenderDocumentStatusColor,
  isTenderDocumentExpired,
  type TenderDocument,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";
import TenderDocumentModal from "./TenderDocumentModal";

interface TenderDocumentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ws: TenderWorkspace;
  tenderId: string;
  reload: () => void;
}

async function openDocument(doc: TenderDocument) {
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
}

function DrawerSection({ title, docs }: { title: string; docs: TenderDocument[] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">{title}</h4>
        <Badge variant="outline" className="text-[9px]">{docs.length}</Badge>
      </div>
      {docs.length === 0 ? (
        <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.slice(0, 5).map(doc => (
            <div key={doc.id} className="rounded-md border p-2.5">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{doc.document_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{doc.document_category} · {doc.document_type || "Unspecified"} · v{doc.version || "1"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className={`text-[9px] ${getTenderDocumentStatusColor(isTenderDocumentExpired(doc) ? "Expired" : doc.status)}`}>{isTenderDocumentExpired(doc) ? "Expired" : doc.status}</Badge>
                    {doc.stage_relevance.slice(0, 2).map(stage => <Badge key={stage} variant="outline" className="text-[9px]">{stage}</Badge>)}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openDocument(doc)}>
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

export default function TenderDocumentDrawer({ open, onOpenChange, ws, tenderId, reload }: TenderDocumentDrawerProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const docs = ws.documents ?? [];
  const recentlyAdded = useMemo(() => [...docs].sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime()).slice(0, 5), [docs]);
  const missingRequired = docs.filter(doc => doc.required_for_submission && doc.status === "Missing");
  const expiringExpired = docs.filter(doc => doc.status === "Expired" || isTenderDocumentExpired(doc));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[420px] gap-0 overflow-y-auto sm:max-w-[420px]">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Tender Documents</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 p-4">
            <Button className="w-full gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload Document
            </Button>
            <DrawerSection title="Source Documents" docs={docs.filter(doc => doc.document_category === "Source")} />
            <DrawerSection title="Supporting Documents" docs={docs.filter(doc => doc.document_category === "Supporting")} />
            <DrawerSection title="Recently Added" docs={recentlyAdded} />
            <DrawerSection title="Missing Required" docs={missingRequired} />
            <DrawerSection title="Expiring / Expired" docs={expiringExpired} />
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
        onSaved={reload}
      />
    </>
  );
}
