/**
 * TND-003: Tender Placeholders Tab
 * Extracted component for the Placeholders tab inside TenderWorkspaceDetail.
 * Shows placeholder register, filters, summary cards, and mock review modal.
 */
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, Info, Search, Eye, CheckCircle2, XCircle, Clock, FileText, Hash, Database } from "lucide-react";
import { toast } from "sonner";
import { updatePlaceholderStatus } from "@/lib/supabase-tender-actions";
import {
  type TenderPlaceholder,
  type TenderWorkspace,
  type PlaceholderStatus,
  type PlaceholderCategory,
  getPlaceholderStatusLabel,
  getPlaceholderStatusColor,
  getCategoryLabel,
  getEvidenceStatusLabel,
  PLACEHOLDER_CATEGORIES,
} from "@/lib/tender-workspace-data";

// ─── PLACEHOLDER REVIEW MODAL ────────────────────────────────

function PlaceholderReviewModal({
  ph,
  onClose,
  tenderId,
  reload,
}: {
  ph: TenderPlaceholder;
  onClose: () => void;
  tenderId: string;
  reload: () => void;
}) {
  const handleMarkReviewed = async () => {
    const result = await updatePlaceholderStatus(tenderId, ph.id, ph.label, ph.status, 'approved');
    if (result.success) {
      toast.success(`Placeholder "${ph.label}" marked as approved.`, { description: 'Persisted to Supabase.' });
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
              <h3 className="text-sm font-serif font-bold">Placeholder Review</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Status changes persist to Supabase.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Key */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Placeholder Key</label>
            <p className="text-xs font-mono mt-1 p-2 bg-muted rounded-md">{ph.placeholderKey}</p>
          </div>
          {/* Label */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Label</label>
              <p className="text-xs mt-1">{ph.label}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</label>
              <p className="text-xs mt-1">{getCategoryLabel(ph.category)}</p>
            </div>
          </div>
          {/* Pack + Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pack</label>
              <p className="text-xs mt-1">{ph.packName}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Section</label>
              <p className="text-xs mt-1">{ph.sectionTitle}</p>
            </div>
          </div>
          {/* Current value */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Value</label>
            <div className="mt-1 p-2 bg-muted rounded-md min-h-[36px]">
              {ph.currentValue ? (
                <p className="text-xs">{ph.currentValue}</p>
              ) : (
                <p className="text-xs text-red-600 italic">No value populated</p>
              )}
            </div>
          </div>
          {/* Source + Evidence */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source</label>
              <p className="text-xs mt-1">{ph.source || <span className="text-muted-foreground italic">Not specified</span>}</p>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence Status</label>
              <p className="text-xs mt-1">{getEvidenceStatusLabel(ph.evidenceStatus)}</p>
            </div>
          </div>
          {/* Notes */}
          {ph.notes && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label>
              <p className="text-xs mt-1 text-muted-foreground">{ph.notes}</p>
            </div>
          )}
          {/* Mock warning */}
          {ph.wouldBlockInProduction && (
            <div className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Mock Gate: This placeholder would block production submission.
              </p>
            </div>
          )}
        </div>
        <div className="p-5 border-t flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={handleMarkReviewed}
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

// ─── MAIN COMPONENT ──────────────────────────────────────────

export default function TenderPlaceholdersTab({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [packFilter, setPackFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reviewPh, setReviewPh] = useState<TenderPlaceholder | null>(null);

  const phs = ws.placeholders;

  // Summary counts
  const totalCount = phs.length;
  const missingCount = phs.filter(p => p.status === "missing").length;
  const needsEvidenceCount = phs.filter(p => p.status === "needs_evidence").length;
  const inReviewCount = phs.filter(p => p.status === "in_review").length;
  const approvedCount = phs.filter(p => p.status === "approved").length;
  const wouldBlockCount = phs.filter(p => p.wouldBlockInProduction && p.status !== "approved").length;

  // Filtered list
  const filtered = useMemo(() => {
    return phs.filter(p => {
      if (packFilter !== "all" && p.packId !== packFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      return true;
    });
  }, [phs, packFilter, statusFilter, categoryFilter]);

  // Pack options
  const packOptions = useMemo(() => {
    const packs = ws.packs.map(p => ({ value: p.id, label: p.packName }));
    return [{ value: "all", label: "All Packs" }, ...packs];
  }, [ws.packs]);

  const statusOptions: { value: string; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "missing", label: "Missing" },
    { value: "drafted", label: "Drafted" },
    { value: "needs_evidence", label: "Needs Evidence" },
    { value: "in_review", label: "In Review" },
    { value: "approved", label: "Approved" },
  ];

  if (phs.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No placeholders registered yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Dev mode banner */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Development mode: placeholders are tracked as mock data. Missing placeholders would block production submission, but do not block testing.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1 shrink-0"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <SummaryCard label="Total" value={totalCount} color="text-foreground" />
        <SummaryCard label="Missing" value={missingCount} color="text-red-600" />
        <SummaryCard label="Needs Evidence" value={needsEvidenceCount} color="text-amber-600" />
        <SummaryCard label="In Review" value={inReviewCount} color="text-violet-600" />
        <SummaryCard label="Approved" value={approvedCount} color="text-emerald-600" />
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
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{PLACEHOLDER_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-1">{filtered.length} of {totalCount} shown</span>
      </div>

      {/* Placeholder table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Placeholder</th>
              <th className="px-3 py-2 text-left font-semibold">Pack</th>
              <th className="px-3 py-2 text-left font-semibold">Section</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Evidence</th>
              <th className="px-3 py-2 text-center font-semibold">Block?</th>
              <th className="px-3 py-2 text-left font-semibold">Updated</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ph => (
              <tr key={ph.id} className={`border-t border-border hover:bg-muted/30 ${ph.status === "missing" ? "bg-red-50/30" : ""}`}>
                <td className="px-3 py-2">
                  <div>
                    <p className="font-medium">{ph.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{ph.placeholderKey}</p>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{ph.packName}</td>
                <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{ph.sectionTitle}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getCategoryLabel(ph.category)}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{ph.owner}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={`text-[9px] ${getPlaceholderStatusColor(ph.status)}`}>
                    {getPlaceholderStatusLabel(ph.status)}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className={`text-[9px] ${ph.evidenceStatus === "missing" ? "text-red-700 bg-red-50 border-red-200" : ph.evidenceStatus === "attached_mock" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : ""}`}>
                    {getEvidenceStatusLabel(ph.evidenceStatus)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center">
                  {ph.wouldBlockInProduction && ph.status !== "approved" ? (
                    <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Would Block</Badge>
                  ) : ph.status === "approved" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground font-mono">{ph.lastUpdated}</td>
                <td className="px-3 py-2 text-center">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setReviewPh(ph)}>
                    <Eye className="w-3 h-3" /> Review Mock
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No placeholders match current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Review modal */}
      {reviewPh && <PlaceholderReviewModal ph={reviewPh} onClose={() => setReviewPh(null)} tenderId={tenderId} reload={reload} />}
    </div>
  );
}
