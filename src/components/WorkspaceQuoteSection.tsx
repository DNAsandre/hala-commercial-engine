/**
 * WorkspaceQuoteSection — Quote management panel for Workspace Detail
 * Sprint 3: Shows quote list, version history, status actions, and wizard trigger.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus, Edit, Send, CheckCircle2, XCircle, Copy, Clock, AlertTriangle,
  ChevronDown, ChevronRight, FileText, Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  listQuotesByWorkspace,
  submitQuote,
  approveQuote,
  rejectQuote,
  createQuoteVersion,
  type QuoteRecord,
  type QuoteMutationOutcome,
  type RuntimeResult,
} from "@/lib/commercial-runtime";
import QuoteWizard from "./QuoteWizard";

const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  draft: { color: "bg-gray-100 text-gray-700 border-gray-300", label: "Draft", icon: FileText },
  submitted: { color: "bg-blue-100 text-blue-700 border-blue-300", label: "Submitted", icon: Send },
  approved: { color: "bg-emerald-100 text-emerald-700 border-emerald-300", label: "Approved", icon: CheckCircle2 },
  rejected: { color: "bg-red-100 text-red-700 border-red-300", label: "Rejected", icon: XCircle },
  superseded: { color: "bg-amber-100 text-amber-700 border-amber-300", label: "Superseded", icon: Clock },
  expired: { color: "bg-gray-100 text-gray-500 border-gray-200", label: "Expired", icon: Clock },
};

const ragDot: Record<string, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" };

function getRAG(gp: number) {
  if (gp >= 25) return "green";
  if (gp >= 15) return "amber";
  return "red";
}

interface Props {
  workspaceId: string;
  customerId?: string;
  customerName?: string;
}

export default function WorkspaceQuoteSection({ workspaceId, customerId, customerName }: Props) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<QuoteRecord | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);
  const [versionReason, setVersionReason] = useState("");

  const fetchQuotes = useCallback(async () => {
    const res = await listQuotesByWorkspace(workspaceId);
    if (!res.ok) {
      // A failed query is NOT an empty list — surface it.
      setLoadError(res.error);
      setQuotes([]);
    } else {
      setLoadError(null);
      setQuotes(res.data);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const handleWizardSaved = () => { setWizardOpen(false); setEditQuote(null); fetchQuotes(); };

  /** Report only what actually happened — never a success we did not confirm. */
  const report = (
    res: RuntimeResult<QuoteMutationOutcome>,
    successMessage: string,
  ) => {
    if (!res.ok) { toast.error(res.error); return false; }
    const notes: string[] = [...res.data.warnings];
    if (res.data.unstoredFields.length > 0) {
      notes.push(`Not stored (no column in the quotes table): ${res.data.unstoredFields.join(", ")}.`);
    }
    toast.success(successMessage, notes.length > 0 ? { description: notes.join(" ") } : undefined);
    return true;
  };

  const handleSubmit = async (id: string) => {
    const res = await submitQuote(id);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Quote submitted");
    fetchQuotes();
  };

  const handleApprove = async (id: string) => {
    const res = await approveQuote(id);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Quote approved");
    fetchQuotes();
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) { toast.error("Reason required"); return; }
    const res = await rejectQuote(rejectId, rejectReason);
    if (!report(res, "Quote rejected")) return;
    setRejectId(null); setRejectReason("");
    fetchQuotes();
  };

  const handleCreateVersion = async () => {
    if (!versionId || !versionReason.trim()) { toast.error("Change reason required"); return; }
    const res = await createQuoteVersion(versionId, versionReason);
    if (!report(res, "New version created")) return;
    setVersionId(null); setVersionReason("");
    fetchQuotes();
  };

  // Show wizard
  if (wizardOpen || editQuote) {
    return (
      <QuoteWizard
        workspaceId={workspaceId}
        customerId={customerId}
        customerName={customerName}
        existingQuote={editQuote}
        onSaved={handleWizardSaved}
        onCancel={() => { setWizardOpen(false); setEditQuote(null); }}
      />
    );
  }

  const latestQuote = quotes.find(q => q.status !== "superseded") || quotes[0];
  const olderVersions = quotes.filter(q => q !== latestQuote);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-serif flex items-center gap-2">
            <FileText className="w-4 h-4" /> Quotes
            {quotes.length > 0 && <Badge variant="outline" className="text-[10px]">{quotes.length} version{quotes.length !== 1 ? "s" : ""}</Badge>}
          </CardTitle>
          <Button size="sm" onClick={() => setWizardOpen(true)} className="text-xs h-7 bg-[var(--color-hala-navy)]">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Quote
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Loading quotes...</p>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-800">Quotes could not be loaded</p>
              <p className="text-[11px] text-red-700 mt-0.5">{loadError}</p>
              <p className="text-[10px] text-red-700/80 mt-1">This is a read failure, not an empty list. Nothing below is being hidden.</p>
            </div>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No quotes yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Create the first quote for this workspace.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Latest quote — expanded */}
            {latestQuote && <QuoteCard q={latestQuote} isLatest
              onEdit={() => latestQuote.status === "draft" ? setEditQuote(latestQuote) : setVersionId(latestQuote.id)}
              onSubmit={() => handleSubmit(latestQuote.id)}
              onApprove={() => handleApprove(latestQuote.id)}
              onReject={() => setRejectId(latestQuote.id)}
              onNewVersion={() => setVersionId(latestQuote.id)}
            />}

            {/* Reject dialog */}
            {rejectId && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-red-800">Rejection Reason</p>
                <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this quote being rejected?" className="h-8 text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setRejectId(null); setRejectReason(""); }} className="text-xs h-7">Cancel</Button>
                  <Button size="sm" onClick={handleReject} className="text-xs h-7 bg-red-600 hover:bg-red-700">Confirm Reject</Button>
                </div>
              </div>
            )}

            {/* Version dialog */}
            {versionId && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800">Create New Version — Change Reason</p>
                <Input value={versionReason} onChange={e => setVersionReason(e.target.value)} placeholder="Why is a new version needed?" className="h-8 text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setVersionId(null); setVersionReason(""); }} className="text-xs h-7">Cancel</Button>
                  <Button size="sm" onClick={handleCreateVersion} className="text-xs h-7 bg-blue-600 hover:bg-blue-700">Create Version</Button>
                </div>
              </div>
            )}

            {/* Older versions */}
            {olderVersions.length > 0 && (
              <div>
                <button onClick={() => setExpanded(expanded ? null : "history")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2">
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Version History ({olderVersions.length})
                </button>
                {expanded && olderVersions.map(q => <QuoteCard key={q.id} q={q} isLatest={false} />)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuoteCard({ q, isLatest, onEdit, onSubmit, onApprove, onReject, onNewVersion }: {
  q: QuoteRecord; isLatest: boolean;
  onEdit?: () => void; onSubmit?: () => void; onApprove?: () => void; onReject?: () => void; onNewVersion?: () => void;
}) {
  const cfg = statusConfig[q.status ?? "draft"] || statusConfig.draft;
  const Icon = cfg.icon;
  const rag = getRAG(q.gp_percent || 0);

  return (
    <div className={`rounded-lg border p-3 ${isLatest ? "border-border" : "border-muted bg-muted/10"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${ragDot[rag]}`} />
        <span className="text-sm font-semibold">V{q.version_number ?? "?"}</span>
        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}><Icon className="w-3 h-3 mr-0.5" />{cfg.label}</Badge>
        {isLatest && <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50">Latest</Badge>}
      </div>
      <div className="grid grid-cols-4 gap-3 text-xs mb-2">
        <div><span className="text-muted-foreground">Annual Revenue</span><p className="font-medium">SAR {q.annual_revenue.toLocaleString()}</p></div>
        <div><span className="text-muted-foreground">Cost</span><p className="font-medium">SAR {q.estimated_cost.toLocaleString()}</p></div>
        <div><span className="text-muted-foreground">GP%</span><p className="font-medium">{q.gp_percent}%</p></div>
        <div><span className="text-muted-foreground">GP Amount</span><p className="font-medium">SAR {q.gp_amount.toLocaleString()}</p></div>
      </div>

      {isLatest && (
        <div className="flex gap-1.5 mt-2 pt-2 border-t border-dashed">
          {q.status === "draft" && onEdit && <Button variant="outline" size="sm" onClick={onEdit} className="text-[10px] h-6"><Edit className="w-3 h-3 mr-0.5" />Edit</Button>}
          {q.status === "draft" && onSubmit && <Button variant="outline" size="sm" onClick={onSubmit} className="text-[10px] h-6"><Send className="w-3 h-3 mr-0.5" />Submit</Button>}
          {q.status === "submitted" && onApprove && <Button variant="outline" size="sm" onClick={onApprove} className="text-[10px] h-6 border-emerald-300 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-0.5" />Approve</Button>}
          {q.status === "submitted" && onReject && <Button variant="outline" size="sm" onClick={onReject} className="text-[10px] h-6 border-red-300 text-red-700"><XCircle className="w-3 h-3 mr-0.5" />Reject</Button>}
          {(q.status === "approved" || q.status === "rejected") && onNewVersion && <Button variant="outline" size="sm" onClick={onNewVersion} className="text-[10px] h-6 border-blue-300 text-blue-700"><Copy className="w-3 h-3 mr-0.5" />New Version</Button>}
        </div>
      )}
    </div>
  );
}
