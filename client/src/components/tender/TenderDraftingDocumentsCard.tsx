/**
 * TenderDraftingDocumentsCard — Compact Stage Document Card
 *
 * Reads from the global Tender Document Library only.
 * Filters by stage_relevance containing "tender_drafting" or "Tender Drafting".
 * Shows document counts and "Open Documents" button.
 *
 * No separate upload. No duplicate storage. No document mutations.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import { FileText, FolderOpen, AlertCircle } from "lucide-react";

interface Props {
  ws: TenderWorkspace;
  onOpenDocuments: () => void;
}

export default function TenderDraftingDocumentsCard({ ws, onOpenDocuments }: Props) {
  const docs = ws.documents || [];

  // Filter documents relevant to Tender Drafting stage
  const relevantDocs = docs.filter(d => {
    const relevance = (d as any).stage_relevance;
    if (typeof relevance === "string") {
      const lower = relevance.toLowerCase();
      return lower.includes("tender_drafting") || lower.includes("tender drafting") || lower.includes("drafting");
    }
    if (Array.isArray(relevance)) {
      return relevance.some((s: string) => {
        const lower = s.toLowerCase();
        return lower.includes("tender_drafting") || lower.includes("tender drafting") || lower.includes("drafting");
      });
    }
    return false;
  });

  const sourceCount = relevantDocs.filter(d => d.document_category === "Source" || (d as any).document_category === "source_document").length;
  const supportingCount = relevantDocs.filter(d => d.document_category === "Supporting" || (d as any).document_category === "supporting").length;
  const missingExpired = docs.filter(d => d.status === "Missing" || d.status === "Expired" || d.status === "Needs Update").length;

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-semibold">Tender Drafting Documents</span>
          <Badge variant="outline" className="text-[8px] ml-auto">
            {relevantDocs.length} document{relevantDocs.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {relevantDocs.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>No documents tagged for this stage. Add documents via the global Documents Library.</span>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Source:</span>
              <span className="font-medium">{sourceCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Supporting:</span>
              <span className="font-medium">{supportingCount}</span>
            </div>
            {missingExpired > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span className="text-amber-600 font-medium">{missingExpired} missing/expired</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7" onClick={onOpenDocuments}>
            <FolderOpen className="w-3 h-3" /> Open Documents
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
