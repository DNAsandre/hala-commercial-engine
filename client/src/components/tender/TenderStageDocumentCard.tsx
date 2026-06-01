import { AlertTriangle, FileText, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  documentsForTenderStage,
  isTenderDocumentExpired,
  stageLabelFromInternalStage,
  type TenderDocumentCategory,
  type TenderWorkspace,
} from "@/lib/tender-workspace-data";

interface TenderStageDocumentCardProps {
  ws: TenderWorkspace;
  stage: string;
  title?: string;
  onOpenDocuments: () => void;
}

function countCategory(docs: ReturnType<typeof documentsForTenderStage>, category: TenderDocumentCategory): number {
  return docs.filter(doc => doc.document_category === category).length;
}

export default function TenderStageDocumentCard({ ws, stage, title, onOpenDocuments }: TenderStageDocumentCardProps) {
  const docs = documentsForTenderStage(ws.documents ?? [], stage);
  const sourceCount = countCategory(docs, "Source");
  const supportingCount = countCategory(docs, "Supporting");
  const generatedCount = countCategory(docs, "Generated");
  const submissionCount = countCategory(docs, "Submission");
  const requiredCount = docs.filter(doc => doc.required_for_submission).length;
  const issueCount = docs.filter(doc => doc.status === "Missing" || doc.status === "Expired" || isTenderDocumentExpired(doc)).length;
  const stageLabel = stageLabelFromInternalStage(stage);

  return (
    <Card className="border-border shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{title ?? `${stageLabel} Documents`}</h3>
              <Badge variant="outline" className="text-[9px]">{docs.length}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Filtered from the global tender document library.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenDocuments}>
            <FolderOpen className="h-3.5 w-3.5" /> Open Documents
          </Button>
        </div>

        {docs.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border p-3">
              <p className="text-lg font-semibold">{sourceCount}</p>
              <p className="text-[10px] text-muted-foreground">Source Documents</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-lg font-semibold">{supportingCount}</p>
              <p className="text-[10px] text-muted-foreground">Supporting Documents</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-lg font-semibold">{generatedCount}</p>
              <p className="text-[10px] text-muted-foreground">Generated Documents</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-lg font-semibold">{submissionCount}</p>
              <p className="text-[10px] text-muted-foreground">Submission Pack</p>
            </div>
            <div className="rounded-md border p-3">
              <p className={issueCount > 0 ? "text-lg font-semibold text-red-600" : "text-lg font-semibold"}>{issueCount}</p>
              <p className="text-[10px] text-muted-foreground">Missing / Expired</p>
            </div>
          </div>
        )}

        {requiredCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            {requiredCount} relevant document{requiredCount === 1 ? "" : "s"} marked required for submission.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
