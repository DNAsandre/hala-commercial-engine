/*
 * Tender Management — Governed Tender Module
 * Swiss Precision Instrument Design
 *
 * Formal Tender entity with CRUD, detail view, workspace linkage,
 * team members, governed status transitions, and audit trail.
 * Uses the centralized tender-engine.ts for all transitions.
 */

import { useState, useMemo } from "react";
import {
  Gavel,
  Plus,
  ChevronRight,
  Users,
  FileText,
  Clock,
  Building2,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Target,
  Link2,
  MapPin,
  Percent,
  CalendarDays,
  ArrowRight,
  Undo2,
  ShieldAlert,
  History,
  X,
  Upload,
  FolderOpen,
  Archive,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatSAR, workspaces, customers } from "@/lib/store";
import {
  tenders,
  type Tender,
  type TenderStatus,
  type TenderSource,
  getTenderStatusDisplayName,
  getTenderStatusColor,
  TENDER_KANBAN_COLUMNS,
  advanceTenderStatus,
  preflightTenderValidation,
  checkTenderUndoEligibility,
  revertTenderStatus,
  hasTenderUndoRecord,
  getTenderStageHistory,
  tenderGovernanceOverrides,
  getTenderMetrics,
  createTender,
  getNextTenderStatus,
  type TenderValidationFailure,
  type WorkspaceSuggestion,
} from "@/lib/tender-engine";
import { useLocation } from "wouter";
import {
  getDocumentsByTender, createDocument, getFileTypeColor, getCategoryIcon,
  DOCUMENT_CATEGORIES, type DocumentCategory, type DocumentStatus, type UnifiedDocument,
} from "@/lib/document-vault";

// ─── STATUS FLOW DISPLAY ───────────────────────────────────

const statusFlowOrder: TenderStatus[] = ["draft", "in_preparation", "submitted", "under_evaluation", "won"];

function StatusFlowBar({ current }: { current: TenderStatus }) {
  const currentIdx = statusFlowOrder.indexOf(current);
  const isTerminal = current === "lost" || current === "withdrawn";

  return (
    <div className="flex items-center gap-1">
      {statusFlowOrder.map((s, i) => {
        const isCurrent = s === current;
        const isPast = !isTerminal && i < currentIdx;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`h-1.5 rounded-full transition-all ${
                isCurrent ? "w-8 bg-[var(--color-hala-navy)]" :
                isPast ? "w-4 bg-[var(--color-hala-navy)]/40" :
                "w-4 bg-muted-foreground/15"
              }`}
            />
          </div>
        );
      })}
      {isTerminal && (
        <div className={`h-1.5 w-8 rounded-full ${current === "lost" ? "bg-[var(--color-rag-red)]" : "bg-muted-foreground/30"}`} />
      )}
    </div>
  );
}

// ─── CREATE TENDER DIALOG ──────────────────────────────────

function CreateTenderForm({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Tender) => void }) {
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("none");
  const [deadline, setDeadline] = useState("");
  const [estValue, setEstValue] = useState("");
  const [targetGp, setTargetGp] = useState("25");
  const [probability, setProbability] = useState("50");
  const [owner, setOwner] = useState("Ra'ed");
  const [source, setSource] = useState<TenderSource>("Direct");
  const [region, setRegion] = useState<"East" | "Central" | "West">("East");
  const [notes, setNotes] = useState("");

  const selectedCustomer = customers.find(c => c.id === customerId);

  function handleSubmit() {
    if (!title || !customerId || !deadline || !estValue) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const tender = createTender({
      linkedWorkspaceId: workspaceId === "none" ? null : workspaceId,
      customerId,
      customerName: selectedCustomer?.name ?? "Unknown",
      title,
      submissionDeadline: deadline,
      estimatedValue: parseFloat(estValue),
      targetGpPercent: parseFloat(targetGp),
      probabilityPercent: parseFloat(probability),
      assignedOwner: owner,
      assignedTeamMembers: [owner],
      status: "draft",
      source,
      region,
      notes,
    });
    toast.success(`Tender "${tender.title}" created.`);
    onCreated(tender);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-serif font-bold">Create New Tender</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tender title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Linked Workspace</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {workspaces.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Submission Deadline *</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Estimated Value (SAR) *</Label>
              <Input type="number" value={estValue} onChange={e => setEstValue(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Target GP%</Label>
              <Input type="number" value={targetGp} onChange={e => setTargetGp(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Probability %</Label>
              <Input type="number" value={probability} onChange={e => setProbability(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={v => setSource(v as TenderSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRM">CRM</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Owner</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Ra'ed", "Albert", "Hano", "Yazan", "Mohammed"].map(o => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Region</Label>
              <Select value={region} onValueChange={v => setRegion(v as "East" | "Central" | "West")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="East">East</SelectItem>
                  <SelectItem value="Central">Central</SelectItem>
                  <SelectItem value="West">West</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Tender</Button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────

export default function Tenders() {
  const [, navigate] = useLocation();
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  // Transition modal state
  const [transitionModal, setTransitionModal] = useState<{
    tender: Tender;
    targetStatus: TenderStatus;
    warnings: TenderValidationFailure[];
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Undo banner state
  const [undoBanner, setUndoBanner] = useState<{ tenderId: string; message: string } | null>(null);

  // Workspace suggestion state
  const [wsSuggestion, setWsSuggestion] = useState<WorkspaceSuggestion | null>(null);

  const metrics = useMemo(() => getTenderMetrics(), [tenders.length]);

  const owners = useMemo(() => Array.from(new Set(tenders.map(t => t.assignedOwner))).sort(), []);
  const regions = useMemo(() => Array.from(new Set(tenders.map(t => t.region))).sort(), []);

  const filteredTenders = useMemo(() => {
    return tenders.filter(t => {
      if (filterOwner !== "all" && t.assignedOwner !== filterOwner) return false;
      if (filterRegion !== "all" && t.region !== filterRegion) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      return true;
    });
  }, [filterOwner, filterRegion, filterStatus, tenders.length]);

  const selectedTender = tenders.find(t => t.id === selectedTenderId) ?? null;
  const linkedWorkspace = selectedTender?.linkedWorkspaceId
    ? workspaces.find(w => w.id === selectedTender.linkedWorkspaceId)
    : null;

  // ── Transition handler ──
  function handleAdvance(tender: Tender) {
    const next = getNextTenderStatus(tender.status);
    if (!next) {
      toast.info("This tender is at a terminal status.");
      return;
    }
    const warnings = preflightTenderValidation(tender.id, next);
    setTransitionModal({ tender, targetStatus: next, warnings });
    setConfirmText("");
    setOverrideReason("");
  }

  function handleConfirmTransition() {
    if (!transitionModal) return;
    const { tender, targetStatus, warnings } = transitionModal;
    const result = advanceTenderStatus(tender.id, targetStatus, {
      overrideReason: warnings.length > 0 ? overrideReason : undefined,
    });

    if (result.success) {
      toast.success(result.message);
      setTransitionModal(null);
      setUndoBanner({ tenderId: tender.id, message: result.message });
      if (result.workspaceSuggestion) {
        setWsSuggestion(result.workspaceSuggestion);
      }
      // Auto-clear undo banner after 5 min
      setTimeout(() => setUndoBanner(b => b?.tenderId === tender.id ? null : b), 5 * 60 * 1000);
      refresh();
    } else {
      toast.error(result.message);
    }
  }

  function handleUndo() {
    if (!undoBanner) return;
    const result = revertTenderStatus(undoBanner.tenderId);
    if (result.success) {
      toast.success(result.message);
      setUndoBanner(null);
      refresh();
    } else {
      toast.error(result.message);
    }
  }

  const daysLeft = (deadline: string) => Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Tender Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Governed tender lifecycle — {tenders.length} tenders, {metrics.totalOpen} open
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Tender
        </Button>
      </div>

      {/* Undo Banner */}
      {undoBanner && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Undo2 className="w-4 h-4 text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">Transition completed. Undo available for 5 minutes.</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleUndo} className="text-blue-700 border-blue-300">
            <Undo2 className="w-3.5 h-3.5 mr-1" /> Undo
          </Button>
        </div>
      )}

      {/* Workspace Suggestion Banner */}
      {wsSuggestion && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="w-4 h-4 text-amber-600" />
            <span className="text-amber-800 dark:text-amber-200">{wsSuggestion.message}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-amber-700 border-amber-300"
              onClick={() => {
                navigate(`/workspaces/${wsSuggestion.workspaceId}`);
                setWsSuggestion(null);
              }}
            >
              Go to Workspace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWsSuggestion(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Open Tenders", value: String(metrics.totalOpen), sub: `${formatSAR(metrics.activePipelineValue)} pipeline`, icon: FileText },
          { label: "Win Rate", value: `${metrics.winRate.toFixed(0)}%`, sub: `${metrics.totalWon}W / ${metrics.totalLost}L`, icon: Target },
          { label: "Avg. Cycle", value: `${metrics.avgSubmissionCycleDays}d`, sub: "Submission cycle", icon: Clock },
          { label: "Weighted Pipeline", value: formatSAR(metrics.weightedPipeline), sub: "Probability-adjusted", icon: DollarSign },
        ].map(m => (
          <Card key={m.label} className="border border-border shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</span>
              </div>
              <p className="text-xl font-bold font-mono">{m.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRegion} onValueChange={setFilterRegion}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TENDER_KANBAN_COLUMNS.map(s => (
              <SelectItem key={s} value={s}>{getTenderStatusDisplayName(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterOwner !== "all" || filterRegion !== "all" || filterStatus !== "all") && (
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setFilterOwner("all"); setFilterRegion("all"); setFilterStatus("all"); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tender List */}
        <div className={selectedTender ? "lg:col-span-1" : "lg:col-span-3"}>
          <div className="space-y-3">
            {filteredTenders.map(t => {
              const days = daysLeft(t.submissionDeadline);
              const isRisk = t.targetGpPercent < 22;
              return (
                <Card
                  key={t.id}
                  className={`border shadow-none hover:shadow-sm transition-all cursor-pointer ${selectedTenderId === t.id ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
                  onClick={() => setSelectedTenderId(selectedTenderId === t.id ? null : t.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Gavel className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{t.title}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ml-2 ${getTenderStatusColor(t.status)}`}>
                        {getTenderStatusDisplayName(t.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <StatusFlowBar current={t.status} />
                      {isRisk && (
                        <Badge variant="outline" className="text-[9px] border-[var(--color-rag-red)] text-[var(--color-rag-red)]">
                          Low GP
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Value</p>
                        <p className="text-sm font-bold font-mono">{formatSAR(t.estimatedValue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Customer</p>
                        <p className="text-sm font-medium truncate">{t.customerName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Days Left</p>
                        <p className={`text-sm font-bold font-mono ${days <= 14 ? "text-[var(--color-rag-red)]" : days <= 30 ? "text-[var(--color-rag-amber)]" : ""}`}>
                          {days > 0 ? `${days}d` : "Passed"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredTenders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No tenders match the current filters.
              </div>
            )}
          </div>
        </div>

        {/* Tender Detail */}
        {selectedTender && (
          <div className="lg:col-span-2 space-y-4">
            {/* Detail Header */}
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-serif">{selectedTender.title}</CardTitle>
                    {tenderGovernanceOverrides.some(o => o.tenderId === selectedTender.id) && (
                      <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700 bg-amber-50">
                        <ShieldAlert className="w-3 h-3 mr-1" />
                        Governance Override
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className={`${getTenderStatusColor(selectedTender.status)}`}>
                    {getTenderStatusDisplayName(selectedTender.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { icon: Building2, label: "Customer", value: selectedTender.customerName },
                    { icon: DollarSign, label: "Est. Value", value: formatSAR(selectedTender.estimatedValue) },
                    { icon: CalendarDays, label: "Deadline", value: selectedTender.submissionDeadline },
                    { icon: Percent, label: "Target GP%", value: `${selectedTender.targetGpPercent}%` },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                        <p className="text-sm font-medium">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { icon: Target, label: "Probability", value: `${selectedTender.probabilityPercent}%` },
                    { icon: MapPin, label: "Region", value: selectedTender.region },
                    { icon: Users, label: "Owner", value: selectedTender.assignedOwner },
                    { icon: FileText, label: "Source", value: selectedTender.source },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">{item.label}</p>
                        <p className="text-sm font-medium">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Linked Workspace */}
                {linkedWorkspace && (
                  <div className="p-3 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Linked Workspace:</span>
                      <span className="text-xs font-medium">{linkedWorkspace.title}</span>
                      <Badge variant="outline" className="text-[9px]">{linkedWorkspace.stage.replace(/_/g, " ")}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/workspaces/${linkedWorkspace.id}`)}>
                      View <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                )}

                {/* Advance Button */}
                {!["won", "lost", "withdrawn"].includes(selectedTender.status) && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => handleAdvance(selectedTender)}>
                      Advance to {getTenderStatusDisplayName(getNextTenderStatus(selectedTender.status) ?? selectedTender.status)}
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="team">
              <TabsList>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="team">
                <Card className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {selectedTender.assignedTeamMembers.map(member => (
                        <div key={member} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                          <div className="w-9 h-9 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                            {member.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{member}</p>
                            <p className="text-xs text-muted-foreground">
                              {member === selectedTender.assignedOwner ? "Owner" : "Team Member"}
                            </p>
                          </div>
                          {member === selectedTender.assignedOwner && (
                            <Badge variant="outline" className="text-[9px] ml-auto">Owner</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents">
                {(() => {
                  const tenderDocs = getDocumentsByTender(selectedTender.id);
                  return (
                    <Card className="border border-border shadow-none">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5" /> Tender Documents ({tenderDocs.length})
                          </h4>
                        </div>
                        {tenderDocs.length > 0 ? (
                          <div className="space-y-2">
                            {tenderDocs.map(doc => (
                              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.currentVersion} · {doc.uploadedBy} · {doc.uploadDate}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="text-[9px]">{getCategoryIcon(doc.category)} {doc.category}</Badge>
                                  <Badge variant={doc.status === "Final" ? "default" : "secondary"} className="text-[9px]">{doc.status}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-6">No documents linked to this tender. Upload documents from the Customer Vault.</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              <TabsContent value="audit">
                <Card className="border border-border shadow-none">
                  <CardContent className="p-4 space-y-4">
                    {/* Stage History */}
                    {(() => {
                      const history = getTenderStageHistory(selectedTender.id);
                      if (history.length === 0) return null;
                      return (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" /> Stage History ({history.length})
                          </h4>
                          <div className="space-y-2">
                            {history.map(h => (
                              <div key={h.id} className="p-3 rounded-lg border border-border bg-muted/10">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={`text-[9px] ${
                                    h.action === "reverted" ? "border-amber-400 text-amber-700" :
                                    h.action === "advanced_with_override" ? "border-orange-400 text-orange-700" :
                                    "border-emerald-400 text-emerald-700"
                                  }`}>
                                    {h.action === "reverted" ? "Reverted" : h.action === "advanced_with_override" ? "Override" : "Advanced"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {getTenderStatusDisplayName(h.fromStatus)} → {getTenderStatusDisplayName(h.toStatus)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span>{h.userName}</span>
                                  <span>{new Date(h.timestamp).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Governance Overrides */}
                    {(() => {
                      const overrides = tenderGovernanceOverrides.filter(o => o.tenderId === selectedTender.id);
                      if (overrides.length === 0) return null;
                      return (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> Governance Overrides ({overrides.length})
                          </h4>
                          <div className="space-y-2">
                            {overrides.map((o, i) => (
                              <div key={i} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium">
                                    {getTenderStatusDisplayName(o.fromStatus)} → {getTenderStatusDisplayName(o.toStatus)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-1">Reason: {o.overrideReason}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  Rules overridden: {o.overriddenRules.join(", ")} — {o.userName}, {new Date(o.timestamp).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {getTenderStageHistory(selectedTender.id).length === 0 &&
                     tenderGovernanceOverrides.filter(o => o.tenderId === selectedTender.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No audit entries yet.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes">
                <Card className="border border-border shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm">{selectedTender.notes || "No notes."}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Create Tender Dialog */}
      {showCreate && (
        <CreateTenderForm
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setSelectedTenderId(t.id);
            refresh();
          }}
        />
      )}

      {/* Transition Confirmation Modal */}
      {transitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-border">
              <h3 className="text-base font-serif font-bold">Confirm Status Transition</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* From / To */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-center flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase">From</p>
                  <Badge variant="outline" className={`mt-1 ${getTenderStatusColor(transitionModal.tender.status)}`}>
                    {getTenderStatusDisplayName(transitionModal.tender.status)}
                  </Badge>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="text-center flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase">To</p>
                  <Badge variant="outline" className={`mt-1 ${getTenderStatusColor(transitionModal.targetStatus)}`}>
                    {getTenderStatusDisplayName(transitionModal.targetStatus)}
                  </Badge>
                </div>
              </div>

              {/* Warnings */}
              {transitionModal.warnings.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">Validation Warnings</span>
                  </div>
                  <ul className="space-y-1">
                    {transitionModal.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span><strong>{w.ruleName}:</strong> {w.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Override Reason (if warnings) */}
              {transitionModal.warnings.length > 0 && (
                <div>
                  <Label className="text-xs">Override Reason (required)</Label>
                  <Textarea
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Provide justification for overriding validation warnings..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
              )}

              {/* Type to Confirm */}
              <div>
                <Label className="text-xs">
                  Type <strong>"{getTenderStatusDisplayName(transitionModal.targetStatus)}"</strong> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={getTenderStatusDisplayName(transitionModal.targetStatus)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-border">
              <Button variant="outline" onClick={() => setTransitionModal(null)}>Cancel</Button>
              <Button
                disabled={
                  confirmText !== getTenderStatusDisplayName(transitionModal.targetStatus) ||
                  (transitionModal.warnings.length > 0 && !overrideReason.trim())
                }
                onClick={handleConfirmTransition}
              >
                {transitionModal.warnings.length > 0 ? "Confirm with Override" : "Confirm Advance"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
