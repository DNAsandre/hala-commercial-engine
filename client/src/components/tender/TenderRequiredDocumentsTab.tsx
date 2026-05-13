/**
 * TND-004: Tender Required Documents Tab
 * Extracted component for the Required Documents tab inside TenderWorkspaceDetail.
 * Shows document register, filters, summary cards, requirement indicators, and mock review modal.
 */
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Eye, CheckCircle2, XCircle, FileText, Stamp, PenLine, Database } from "lucide-react";
import { toast } from "sonner";
import { updateRequiredDocStatus } from "@/lib/supabase-tender-actions";
import {
  type TenderRequiredDocument,
  type TenderWorkspace,
  type RequiredDocStatus,
  getDocStatusLabel,
  getDocStatusColor,
  getDocCategoryLabel,
  getFileReqLabel,
  getFileReqColor,
  REQUIRED_DOC_CATEGORIES,
} from "@/lib/tender-workspace-data";

// ─── HELPERS ─────────────────────────────────────────────────

function isOBK(doc: TenderRequiredDocument): boolean {
  return doc.category === "pricing_obk";
}

// ─── DOCUMENT REVIEW MODAL ──────────────────────────────────

function DocumentReviewModal({
  doc,
  onClose,
  tenderId,
  reload
}: {
  doc: TenderRequiredDocument;
  onClose: () => void;
  tenderId: string;
  reload: () => void;
}) {
  const handleMarkApproved = async () => {
    const result = await updateRequiredDocStatus(tenderId, doc.id, doc.documentName, doc.status, 'approved');
    if (result.success) {
      toast.success(`Document "${doc.documentName}" marked as approved.`, { description: 'Persisted to Supabase.' });
      reload();
    } else {
      toast.warning('Status change failed — UI not blocked.', { description: result.error });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl border shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-serif font-bold">Document Review (Mock)</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">This is a development mock review — no backend changes.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Document name */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document Name</label>
            <p className="text-xs font-medium mt-1">{doc.documentName}</p>
            {isOBK(doc) && (
              <Badge variant="outline" className="text-[9px] mt-1 border-amber-300 text-amber-700 bg-amber-50">OBK Control</Badge>
            )}
          </div>
          {/* Pack + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pack</label>
              <p className="text-xs mt-1">{doc.packName}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
              <p className="text-xs mt-1">{getDocCategoryLabel(doc.category)}</p>
            </div>
          </div>
          {/* Owner + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owner</label>
              <p className="text-xs mt-1">{doc.owner}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Status</label>
              <div className="mt-1">
                <Badge variant="outline" className={`text-[9px] ${getDocStatusColor(doc.status)}`}>{getDocStatusLabel(doc.status)}</Badge>
              </div>
            </div>
          </div>
          {/* Requirements */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-2 rounded-md border bg-muted/30 text-center">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Native</label>
              <p className="text-xs">{doc.nativeRequired ? getFileReqLabel(doc.nativeStatus) : "Not Required"}</p>
            </div>
            <div className="p-2 rounded-md border bg-muted/30 text-center">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Signed PDF</label>
              <p className="text-xs">{doc.signedPdfRequired ? getFileReqLabel(doc.signedPdfStatus) : "Not Required"}</p>
            </div>
            <div className="p-2 rounded-md border bg-muted/30 text-center">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Stamp</label>
              <p className="text-xs">{doc.stampRequired ? "Required" : "Not Required"}</p>
            </div>
          </div>
          {/* Version + Output */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Version</label>
              <p className="text-xs mt-1">v{doc.version}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Included in Output</label>
              <p className="text-xs mt-1">{doc.includedInOutput ? "Yes" : "No"}</p>
            </div>
          </div>
          {/* Notes */}
          {doc.notes && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
              <p className="text-xs mt-1 text-muted-foreground">{doc.notes}</p>
            </div>
          )}
          {/* OBK warning */}
          {isOBK(doc) && (
            <div className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Native Excel + signed/stamped PDF required for production submission.
              </p>
            </div>
          )}
          {/* Would block warning */}
          {doc.wouldBlockInProduction && doc.status === "awaiting" && (
            <div className="p-2.5 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30">
              <p className="text-xs text-red-800 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Mock Gate: This document would block production submission.
              </p>
            </div>
          )}
        </div>
        <div className="p-5 border-t flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={handleMarkApproved}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Approved
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── SUMMARY CARD ────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── FILE REQ CELL ───────────────────────────────────────────

function FileReqCell({ required, status }: { required: boolean; status: string }) {
  if (!required) return <span className="text-[10px] text-muted-foreground">Not Required</span>;
  const label = getFileReqLabel(status as any);
  const color = getFileReqColor(status as any);
  return (
    <Badge variant="outline" className={`text-[9px] ${color}`}>
      {label}
    </Badge>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function TenderRequiredDocumentsTab({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [packFilter, setPackFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reviewDoc, setReviewDoc] = useState<TenderRequiredDocument | null>(null);

  const docs = ws.requiredDocuments;

  // Summary counts
  const totalCount = docs.length;
  const awaitingCount = docs.filter(d => d.status === "awaiting").length;
  const inReviewCount = docs.filter(d => d.status === "in_review").length;
  const readyCount = docs.filter(d => ["ready", "signed", "stamped", "approved"].includes(d.status)).length;
  const includedCount = docs.filter(d => d.includedInOutput).length;
  const wouldBlockCount = docs.filter(d => d.wouldBlockInProduction && !["ready", "signed", "stamped", "approved", "submitted_mock"].includes(d.status)).length;

  // Filtered list
  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (packFilter !== "all" && d.packId !== packFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
      return true;
    });
  }, [docs, packFilter, statusFilter, categoryFilter]);

  // Pack options
  const packOptions = useMemo(() => {
    const packs = ws.packs.map(p => ({ value: p.id, label: p.packName }));
    return [{ value: "all", label: "All Packs" }, ...packs];
  }, [ws.packs]);

  const statusOptions: { value: string; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "awaiting", label: "Awaiting" },
    { value: "uploaded", label: "Uploaded" },
    { value: "draft", label: "Draft" },
    { value: "in_review", label: "In Review" },
    { value: "approved", label: "Approved" },
    { value: "signed", label: "Signed" },
    { value: "stamped", label: "Stamped" },
    { value: "ready", label: "Ready" },
    { value: "rejected", label: "Rejected" },
    { value: "superseded", label: "Superseded" },
    { value: "submitted_mock", label: "Submitted (Mock)" },
  ];

  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No required documents configured yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Dev mode banner */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Development mode: required documents are tracked as mock data. Missing documents would block production submission, but do not block testing.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1 shrink-0"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <SummaryCard label="Total Docs" value={totalCount} color="text-foreground" />
        <SummaryCard label="Awaiting" value={awaitingCount} color="text-red-600" />
        <SummaryCard label="In Review" value={inReviewCount} color="text-violet-600" />
        <SummaryCard label="Ready / Approved" value={readyCount} color="text-emerald-600" />
        <SummaryCard label="In Output" value={includedCount} color="text-blue-600" />
        <SummaryCard label="Would Block" value={wouldBlockCount} color="text-red-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={packFilter} onValueChange={setPackFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{packOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger size="sm" className="w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{REQUIRED_DOC_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-1">{filtered.length} of {totalCount} shown</span>
      </div>

      {/* Documents table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Required Document</th>
              <th className="px-3 py-2 text-left font-semibold">Pack</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-center font-semibold">Native</th>
              <th className="px-3 py-2 text-center font-semibold">Signed PDF</th>
              <th className="px-3 py-2 text-center font-semibold">Stamp</th>
              <th className="px-3 py-2 text-center font-semibold">Ver</th>
              <th className="px-3 py-2 text-center font-semibold">In Output</th>
              <th className="px-3 py-2 text-center font-semibold">Block?</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(doc => (
              <tr key={doc.id} className={`border-t border-border hover:bg-muted/30 ${doc.status === "awaiting" ? "bg-red-50/30" : ""} ${isOBK(doc) ? "border-l-2 border-l-amber-400" : ""}`}>
                <td className="px-3 py-2">
                  <div>
                    <p className="font-medium">{doc.documentName}</p>
                    {isOBK(doc) && (
                      <Badge variant="outline" className="text-[8px] mt-0.5 border-amber-300 text-amber-700 bg-amber-50">OBK Control</Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{doc.packName}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getDocCategoryLabel(doc.category)}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{doc.owner}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={`text-[9px] ${getDocStatusColor(doc.status)}`}>
                    {getDocStatusLabel(doc.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center"><FileReqCell required={doc.nativeRequired} status={doc.nativeStatus} /></td>
                <td className="px-3 py-2 text-center"><FileReqCell required={doc.signedPdfRequired} status={doc.signedPdfStatus} /></td>
                <td className="px-3 py-2 text-center">
                  {doc.stampRequired ? (
                    <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Required</Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground font-mono">v{doc.version}</td>
                <td className="px-3 py-2 text-center">
                  {doc.includedInOutput ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {doc.wouldBlockInProduction && !["ready", "signed", "stamped", "approved", "submitted_mock"].includes(doc.status) ? (
                    <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Would Block</Badge>
                  ) : ["ready", "signed", "stamped", "approved", "submitted_mock"].includes(doc.status) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setReviewDoc(doc)}>
                    <Eye className="w-3 h-3" /> Review Mock
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">No documents match current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Review modal */}
      {reviewDoc && <DocumentReviewModal doc={reviewDoc} onClose={() => setReviewDoc(null)} tenderId={tenderId} reload={reload} />}
    </div>
  );
}
