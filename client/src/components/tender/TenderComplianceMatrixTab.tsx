/**
 * TND-005: Tender Compliance Matrix Tab
 * Extracted component for the Compliance Matrix tab inside TenderWorkspaceDetail.
 * Shows compliance register, filters, summary cards, risk indicators, and mock review modal.
 */
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Eye, CheckCircle2, XCircle, AlertTriangle, Scale, Info, Database } from "lucide-react";
import { toast } from "sonner";
import { updateComplianceStatus } from "@/lib/supabase-tender-actions";
import {
  type TenderComplianceItem,
  type TenderWorkspace,
  getComplianceStatusLabel,
  getComplianceStatusColor,
  getComplianceCategoryLabel,
  getRiskLabel,
  getRiskColor,
  COMPLIANCE_CATEGORIES,
  COMPLIANCE_RISK_LEVELS,
} from "@/lib/tender-workspace-data";

// ─── COMPLIANCE REVIEW MODAL ─────────────────────────────────

function ComplianceReviewModal({ item, onClose, tenderId, reload }: { item: TenderComplianceItem; onClose: () => void; tenderId: string; reload: () => void }) {
  const handleMarkCompliant = async () => {
    const result = await updateComplianceStatus(tenderId, item.id, item.requirement, item.status, 'compliant');
    if (result.success) {
      toast.success(`Compliance "${item.reference}" marked compliant.`, { description: 'Persisted to Supabase.' });
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
              <h3 className="text-sm font-serif font-bold">Compliance Review (Mock)</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Development mock review — no backend changes.</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}><XCircle className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Reference + Requirement */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reference</label>
            <p className="text-xs font-mono font-medium mt-1">{item.reference}</p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Requirement</label>
            <p className="text-xs mt-1">{item.requirement}</p>
          </div>
          {/* Pack + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pack</label><p className="text-xs mt-1">{item.packName}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</label><p className="text-xs mt-1">{getComplianceCategoryLabel(item.category)}</p></div>
          </div>
          {/* Status + Risk */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
              <div className="mt-1"><Badge variant="outline" className={`text-[9px] ${getComplianceStatusColor(item.status)}`}>{getComplianceStatusLabel(item.status)}</Badge></div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Level</label>
              <div className="mt-1"><Badge variant="outline" className={`text-[9px] ${getRiskColor(item.riskLevel)}`}>{getRiskLabel(item.riskLevel)}</Badge></div>
            </div>
          </div>
          {/* Evidence + Owner */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence</label><p className="text-xs mt-1">{item.evidence}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owner</label><p className="text-xs mt-1">{item.owner}</p></div>
          </div>
          {/* Impact */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Commercial Impact</label><p className="text-xs mt-1 text-muted-foreground">{item.commercialImpact}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operational Impact</label><p className="text-xs mt-1 text-muted-foreground">{item.operationalImpact}</p></div>
          </div>
          {/* Flags */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legal Review</label><p className="text-xs mt-1">{item.legalReviewRequired ? "Required" : "Not Required"}</p></div>
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clarification</label><p className="text-xs mt-1">{item.clarificationNeeded ? "Needed" : "Not Needed"}</p></div>
          </div>
          {/* Notes */}
          {item.notes && (
            <div><label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</label><p className="text-xs mt-1 text-muted-foreground">{item.notes}</p></div>
          )}
          {/* Warnings */}
          {item.status === "non_compliant" && (
            <div className="p-2.5 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30">
              <p className="text-xs text-red-800 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 shrink-0" />Non-compliant: this requirement must be resolved before production submission.</p>
            </div>
          )}
          {item.clarificationNeeded && (
            <div className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />Clarification required from client or internal team before compliance can be confirmed.</p>
            </div>
          )}
          {item.wouldBlockInProduction && item.status !== "compliant" && (
            <div className="p-2.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 shrink-0" />Mock Gate: Would block production submission.</p>
            </div>
          )}
        </div>
        <div className="p-5 border-t flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleMarkCompliant}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Compliant
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={onClose}>Close</Button>
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

export default function TenderComplianceMatrixTab({ ws, tenderId, reload }: { ws: TenderWorkspace; tenderId: string; reload: () => void }) {
  const [packFilter, setPackFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [reviewItem, setReviewItem] = useState<TenderComplianceItem | null>(null);

  const items = ws.complianceItems;

  // Summary counts
  const totalCount = items.length;
  const compliantCount = items.filter(i => i.status === "compliant").length;
  const partialCount = items.filter(i => i.status === "partial").length;
  const nonCompliantCount = items.filter(i => i.status === "non_compliant").length;
  const clarificationCount = items.filter(i => i.status === "clarification_required").length;
  const highCriticalCount = items.filter(i => i.riskLevel === "high" || i.riskLevel === "critical").length;
  const wouldBlockCount = items.filter(i => i.wouldBlockInProduction && i.status !== "compliant").length;

  // Filtered list
  const filtered = useMemo(() => {
    return items.filter(i => {
      if (packFilter !== "all" && i.packId !== packFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
      if (riskFilter !== "all" && i.riskLevel !== riskFilter) return false;
      return true;
    });
  }, [items, packFilter, statusFilter, categoryFilter, riskFilter]);

  const packOptions = useMemo(() => {
    const packs = ws.packs.map(p => ({ value: p.id, label: p.packName }));
    return [{ value: "all", label: "All Packs" }, ...packs];
  }, [ws.packs]);

  const statusOptions: { value: string; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "not_reviewed", label: "Not Reviewed" },
    { value: "compliant", label: "Compliant" },
    { value: "partial", label: "Partial" },
    { value: "non_compliant", label: "Non-Compliant" },
    { value: "clarification_required", label: "Clarification Required" },
    { value: "accepted_risk_mock", label: "Accepted Risk (Mock)" },
  ];

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No compliance items configured yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Dev mode banner */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            Development mode: compliance items are tracked as mock data. Compliance gaps would block or escalate production submission, but do not block testing.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50 flex items-center gap-1 shrink-0"><Database className="w-2.5 h-2.5" />Supabase-Backed</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        <SummaryCard label="Total" value={totalCount} color="text-foreground" />
        <SummaryCard label="Compliant" value={compliantCount} color="text-emerald-600" />
        <SummaryCard label="Partial" value={partialCount} color="text-amber-600" />
        <SummaryCard label="Non-Compliant" value={nonCompliantCount} color="text-red-600" />
        <SummaryCard label="Clarification" value={clarificationCount} color="text-amber-600" />
        <SummaryCard label="High / Critical" value={highCriticalCount} color="text-red-600" />
        <SummaryCard label="Would Block" value={wouldBlockCount} color="text-red-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={packFilter} onValueChange={setPackFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{packOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger size="sm" className="w-[180px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{statusOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger size="sm" className="w-[200px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{COMPLIANCE_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger size="sm" className="w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{COMPLIANCE_RISK_LEVELS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground ml-1">{filtered.length} of {totalCount} shown</span>
      </div>

      {/* Compliance table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Ref</th>
              <th className="px-3 py-2 text-left font-semibold">Requirement</th>
              <th className="px-3 py-2 text-left font-semibold">Pack</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Evidence</th>
              <th className="px-3 py-2 text-left font-semibold">Owner</th>
              <th className="px-3 py-2 text-center font-semibold">Risk</th>
              <th className="px-3 py-2 text-center font-semibold">Legal</th>
              <th className="px-3 py-2 text-center font-semibold">Clarification</th>
              <th className="px-3 py-2 text-center font-semibold">Block?</th>
              <th className="px-3 py-2 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const isRisky = item.status === "non_compliant" || item.riskLevel === "critical";
              const isWarning = item.status === "partial" || item.status === "clarification_required";
              return (
                <tr key={item.id} className={`border-t border-border hover:bg-muted/30 ${isRisky ? "bg-red-50/40 border-l-2 border-l-red-400" : isWarning ? "bg-amber-50/30 border-l-2 border-l-amber-300" : ""}`}>
                  <td className="px-3 py-2 font-mono font-medium text-muted-foreground">{item.reference}</td>
                  <td className="px-3 py-2 max-w-[260px]"><p className="font-medium leading-snug">{item.requirement}</p></td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[110px] truncate">{item.packName}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[9px]">{getComplianceCategoryLabel(item.category)}</Badge></td>
                  <td className="px-3 py-2"><Badge variant="outline" className={`text-[9px] ${getComplianceStatusColor(item.status)}`}>{getComplianceStatusLabel(item.status)}</Badge></td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{item.evidence}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.owner}</td>
                  <td className="px-3 py-2 text-center"><Badge variant="outline" className={`text-[9px] ${getRiskColor(item.riskLevel)}`}>{getRiskLabel(item.riskLevel)}</Badge></td>
                  <td className="px-3 py-2 text-center">
                    {item.legalReviewRequired ? <Badge variant="outline" className="text-[9px] text-violet-700 bg-violet-50 border-violet-200">Required</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.clarificationNeeded ? <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Needed</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.wouldBlockInProduction && item.status !== "compliant" ? (
                      <Badge variant="outline" className="text-[9px] text-amber-700 bg-amber-50 border-amber-200">Would Block</Badge>
                    ) : item.status === "compliant" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setReviewItem(item)}><Eye className="w-3 h-3" /> Review Mock</Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">No compliance items match current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Future signal note */}
      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <p className="text-[10px] text-blue-700">Future signal: partial, non-compliant, and clarification-required items will feed Tender Board and Commercial Command risk signals.</p>
      </div>

      {/* Review modal */}
      {reviewItem && <ComplianceReviewModal item={reviewItem} onClose={() => setReviewItem(null)} tenderId={tenderId} reload={reload} />}
    </div>
  );
}
