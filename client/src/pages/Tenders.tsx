/*
 * Tender Management — Commercial Lifecycle Engine
 *
 * Decision-first UI. Command center, not a CRM form.
 * Instant milestone movement. No governance blocking. No typing confirmations.
 * Signal over noise.
 */

import { useState, useMemo, useRef, useEffect } from "react";
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
  CalendarDays,
  ArrowRight,
  Undo2,
  History,
  X,
  Upload,
  FolderOpen,
  Eye,
  ExternalLink,
  ChevronDown,
  Zap,
  TrendingDown,
  ShieldCheck,
  Activity,
  ArrowLeft,
  Radio,
  Clock as Clock3,
  CheckCircle2,
  Kanban,
  Search,
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
import { formatSAR, customers } from "@/lib/store";
import { useWorkspaces, useCustomers } from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
import {
  tenders,
  type Tender,
  type TenderMilestone,
  type TenderSource,
  getTenderStatusDisplayName,
  getTenderMilestoneShortLabel,
  getTenderStatusColor,
  getMarginSignal,
  getTimeRisk,
  getStateSignal,
  TENDER_MILESTONE_ORDER,
  TENDER_KANBAN_COLUMNS,
  TENDER_TERMINAL,
  getSuggestedNextMilestones,
  getPrimaryNextMilestone,
  moveTenderMilestone,
  revertTenderStatus,
  hasTenderUndoRecord,
  getTenderStageHistory,
  getTenderMetrics,
  createTender,
  tenderGovernanceOverrides,
} from "@/lib/tender-engine";
import { WorkspaceRiskSignalsTab } from "@/components/WorkspaceRiskSignalsTab";
import { useLocation } from "wouter";
import {
  getDocumentsByTender, getFileTypeColor, getCategoryIcon,
  uploadDocument, hasRealFile, initializeMockFiles,
  type UnifiedDocument, type DocumentCategory,
} from "@/lib/document-vault";
import { DocumentViewer, UploadDialog } from "@/components/DocumentViewer";

// ─── MILESTONE STRIP ───────────────────────────────────────

const STRIP_MILESTONES: TenderMilestone[] = [
  "identified",
  "preparing_submission",
  "submitted",
  "clarification",
  "technical_review",
  "commercial_review",
  "negotiation",
  "awarded",
];

function MilestoneStrip({
  current,
  onMove,
}: {
  current: TenderMilestone;
  onMove: (m: TenderMilestone) => void;
}) {
  const isTerminal = TENDER_TERMINAL.includes(current);
  const currentIdx = STRIP_MILESTONES.indexOf(current as any);
  const suggested = getSuggestedNextMilestones(current);

  return (
    <div>
      {/* Strip */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-thin">
        {STRIP_MILESTONES.map((m, i) => {
          const isCurrent = m === current;
          const isPast = !isTerminal && i < currentIdx;
          const isFuture = !isCurrent && !isPast;
          const isSuggested = suggested.includes(m);

          return (
            <div key={m} className="flex items-center shrink-0">
              {/* Step */}
              <button
                onClick={() => !isCurrent && onMove(m)}
                disabled={isCurrent}
                title={isSuggested ? `Suggested next: ${getTenderStatusDisplayName(m)}` : getTenderStatusDisplayName(m)}
                className={`
                  relative flex flex-col items-center px-3 py-2 rounded-lg transition-all group
                  ${isCurrent
                    ? "bg-[var(--color-hala-navy)] text-white shadow-md cursor-default"
                    : isPast
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 cursor-pointer"
                      : isSuggested
                        ? "border border-dashed border-primary/50 text-primary hover:bg-primary/5 cursor-pointer"
                        : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 cursor-pointer"
                  }
                `}
              >
                {/* Dot */}
                <div className={`w-2 h-2 rounded-full mb-1.5 ${
                  isCurrent ? "bg-white" :
                  isPast ? "bg-emerald-500" :
                  isSuggested ? "bg-primary/60" :
                  "bg-muted-foreground/20"
                }`} />
                <span className={`text-[10px] font-medium whitespace-nowrap leading-none ${
                  isCurrent ? "text-white font-semibold" : ""
                }`}>
                  {getTenderMilestoneShortLabel(m)}
                </span>
                {isSuggested && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>

              {/* Connector */}
              {i < STRIP_MILESTONES.length - 1 && (
                <div className={`h-px w-4 shrink-0 ${
                  i < currentIdx ? "bg-emerald-400" : "bg-muted-foreground/15"
                }`} />
              )}
            </div>
          );
        })}

        {/* Terminal states separated */}
        <div className="ml-3 flex items-center gap-1">
          <div className="h-4 w-px bg-border mx-1" />
          {(["lost", "withdrawn"] as TenderMilestone[]).map(m => (
            <button
              key={m}
              onClick={() => current !== m && onMove(m)}
              disabled={current === m}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                current === m
                  ? m === "lost" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 cursor-default"
                                 : "bg-gray-100 text-gray-500 dark:bg-gray-800 cursor-default"
                  : m === "lost"
                    ? "text-red-500/60 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                    : "text-muted-foreground/40 hover:bg-muted/40 hover:text-muted-foreground"
              }`}
            >
              {getTenderMilestoneShortLabel(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Helper microcopy */}
      <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
        Tender lifecycle tracker — separate from internal working board.
        {!isTerminal && suggested.length > 0 && (
          <span className="ml-1 text-primary/70 not-italic">
            Suggested next: <strong>{getTenderStatusDisplayName(suggested[0])}</strong>
          </span>
        )}
      </p>
    </div>
  );
}

// ─── SIGNAL BAR ────────────────────────────────────────────

function SignalBar({ tender }: { tender: Tender }) {
  const margin = getMarginSignal(tender.targetGpPercent);
  const timeRisk = getTimeRisk(tender.submissionDeadline);
  const stateSignal = getStateSignal(tender.status, tender.daysInStatus);

  const ragDot = (color: "green" | "amber" | "red") =>
    color === "green" ? "bg-emerald-500" :
    color === "amber" ? "bg-amber-500" :
    "bg-red-500";

  const ragText = (color: "green" | "amber" | "red") =>
    color === "green" ? "text-emerald-700 dark:text-emerald-400" :
    color === "amber" ? "text-amber-700 dark:text-amber-400" :
    "text-red-700 dark:text-red-400";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Value */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Value
        </span>
        <span className="text-base font-bold font-mono text-foreground leading-tight">
          {formatSAR(tender.estimatedValue)}
        </span>
      </div>

      {/* Margin Signal */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> Margin
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${ragDot(margin.color)}`} />
          <span className={`text-sm font-semibold ${ragText(margin.color)}`}>{margin.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{tender.targetGpPercent}% GP</span>
      </div>

      {/* State Signal */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Activity className="w-3 h-3" /> Status
        </span>
        <span className="text-xs font-medium text-foreground leading-snug mt-0.5">{stateSignal}</span>
      </div>

      {/* Time Risk */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock3 className="w-3 h-3" /> Deadline
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${ragDot(timeRisk.color)}`} />
          <span className={`text-sm font-semibold ${ragText(timeRisk.color)}`}>{timeRisk.label}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{tender.submissionDeadline}</span>
      </div>

      {/* Owner */}
      <div className="bg-muted/30 rounded-xl p-3 flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Users className="w-3 h-3" /> Owner
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-5 h-5 rounded-full bg-[var(--color-hala-navy)] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {tender.assignedOwner.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium truncate">{tender.assignedOwner}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{tender.region}</span>
      </div>
    </div>
  );
}

// ─── MOVE STAGE DROPDOWN ───────────────────────────────────

function MoveStageDropdown({
  tender,
  onMove,
}: {
  tender: Tender;
  onMove: (m: TenderMilestone) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const suggested = getSuggestedNextMilestones(tender.status);
  const allOther = TENDER_KANBAN_COLUMNS.filter(m => m !== tender.status);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (TENDER_TERMINAL.includes(tender.status)) {
    return (
      <Button variant="outline" size="sm" disabled className="text-xs opacity-50">
        Terminal stage
      </Button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        className="gap-1 text-xs"
        onClick={() => setOpen(!open)}
      >
        Move Stage <ChevronDown className="w-3.5 h-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-xl shadow-xl w-64 overflow-hidden">
          {suggested.length > 0 && (
            <>
              <div className="px-3 pt-2.5 pb-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggested next
                </span>
              </div>
              {suggested.map(m => (
                <button
                  key={m}
                  onClick={() => { onMove(m); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/5 text-left group transition-colors"
                >
                  <Zap className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-xs font-medium text-primary">
                    {getTenderStatusDisplayName(m)}
                  </span>
                </button>
              ))}
              <div className="border-t border-border mx-3 my-1" />
            </>
          )}
          <div className="px-3 pt-1 pb-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              All stages
            </span>
          </div>
          {allOther.map(m => (
            <button
              key={m}
              onClick={() => { onMove(m); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-left transition-colors ${
                TENDER_TERMINAL.includes(m) ? "text-muted-foreground/70" : ""
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                TENDER_TERMINAL.includes(m)
                  ? m === "awarded" ? "bg-emerald-400" : m === "lost" ? "bg-red-400" : "bg-gray-300"
                  : "bg-primary/40"
              }`} />
              <span className="text-xs">{getTenderStatusDisplayName(m)}</span>
            </button>
          ))}
          <div className="px-3 pb-2.5 pt-1">
            <p className="text-[9px] text-muted-foreground/60 italic">
              Click any stage to move instantly. No confirmation required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LIST CARD ─────────────────────────────────────────────

function TenderListCard({
  tender,
  selected,
  onClick,
}: {
  tender: Tender;
  selected: boolean;
  onClick: () => void;
}) {
  const margin = getMarginSignal(tender.targetGpPercent);
  const timeRisk = getTimeRisk(tender.submissionDeadline);
  const ragColor =
    timeRisk.color === "red" || margin.color === "red" ? "bg-red-500" :
    timeRisk.color === "amber" || margin.color === "amber" ? "bg-amber-500" :
    "bg-emerald-500";

  return (
    <Card
      onClick={onClick}
      className={`border shadow-none hover:shadow-sm transition-all cursor-pointer ${
        selected ? "border-primary ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${ragColor}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium leading-snug line-clamp-2">{tender.title}</span>
              <Badge
                variant="outline"
                className={`text-[9px] shrink-0 whitespace-nowrap ${getTenderStatusColor(tender.status)}`}
              >
                {getTenderMilestoneShortLabel(tender.status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{tender.customerName} · {tender.region}</p>

            {/* Mini milestone bar */}
            <div className="flex items-center gap-0.5 mb-2">
              {STRIP_MILESTONES.map((m, i) => {
                const idx = STRIP_MILESTONES.indexOf(tender.status as any);
                const isCur = m === tender.status;
                const isPast = i < idx && idx !== -1;
                return (
                  <div
                    key={m}
                    className={`h-1 rounded-full flex-1 transition-all ${
                      isCur ? "bg-[var(--color-hala-navy)]" :
                      isPast ? "bg-emerald-400" :
                      "bg-muted-foreground/10"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground uppercase">Value</span>
              <span className="text-xs font-bold font-mono">{formatSAR(tender.estimatedValue)}</span>
              <span className={`text-[10px] font-medium ml-auto ${
                timeRisk.color === "red" ? "text-red-600" :
                timeRisk.color === "amber" ? "text-amber-600" :
                "text-muted-foreground"
              }`}>
                {timeRisk.label}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CREATE FORM ───────────────────────────────────────────

function CreateTenderForm({
  onClose,
  onCreated,
  customers,
  workspaces,
}: {
  onClose: () => void;
  onCreated: (t: Tender) => void;
  customers: any[];
  workspaces: any[];
}) {
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
      status: "identified",
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
          <h3 className="text-base font-serif font-bold">New Tender</h3>
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
  const { data: workspaces } = useWorkspaces();
  const { data: customers } = useCustomers();
  const [, navigate] = useLocation();
  // Default to first tender — pipeline is never empty
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(
    () => tenders[0]?.id ?? null
  );
  const [showCreate, setShowCreate] = useState(false);
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  // Read ?company= URL param from Tenders Overview navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const company = params.get("company");
    if (company) {
      const decoded = decodeURIComponent(company);
      setFilterCompany(decoded);
      const match = tenders.find(t => t.customerName === decoded);
      if (match) setSelectedTenderId(match.id);
      // Clean up the URL param without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("company");
      window.history.replaceState({}, "", url.pathname);
    }
  }, []);

  // Undo banner
  const [undoBanner, setUndoBanner] = useState<{ tenderId: string; message: string } | null>(null);

  // Workspace suggestion
  const [wsSuggestion, setWsSuggestion] = useState<{ workspaceId: string; message: string } | null>(null);

  // Document viewer
  const [viewerDoc, setViewerDoc] = useState<UnifiedDocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showDocArchived, setShowDocArchived] = useState(false);

  useState(() => { initializeMockFiles(); });

  const metrics = useMemo(() => getTenderMetrics(), [tenders.length]);
  const owners = useMemo(() => Array.from(new Set(tenders.map(t => t.assignedOwner))).sort(), []);
  const regions = useMemo(() => Array.from(new Set(tenders.map(t => t.region))).sort(), []);
  const companies = useMemo(() => Array.from(new Set(tenders.map(t => t.customerName))).sort(), []);

  const filteredTenders = useMemo(() => {
    const search = filterSearch.toLowerCase().trim();
    return tenders.filter(t => {
      if (filterCompany !== "all" && t.customerName !== filterCompany) return false;
      if (filterOwner !== "all" && t.assignedOwner !== filterOwner) return false;
      if (filterRegion !== "all" && t.region !== filterRegion) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (search && !t.customerName.toLowerCase().includes(search) && !t.title.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [filterCompany, filterSearch, filterOwner, filterRegion, filterStatus, tenders.length]);

  const selectedTender = tenders.find(t => t.id === selectedTenderId) ?? null;
  const linkedWorkspace = selectedTender?.linkedWorkspaceId
    ? workspaces.find(w => w.id === selectedTender.linkedWorkspaceId)
    : null;

  // ── Stage movement — instant, no blocking ──
  function handleMove(tender: Tender, target: TenderMilestone) {
    const result = moveTenderMilestone(tender.id, target);
    if (result.success) {
      toast.success(result.message);
      setUndoBanner({ tenderId: tender.id, message: result.message });
      if (result.workspaceSuggestion) {
        setWsSuggestion({
          workspaceId: result.workspaceSuggestion.workspaceId,
          message: result.workspaceSuggestion.message,
        });
      }
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

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold">Tender Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {metrics.totalOpen} active · SAR {(metrics.weightedPipeline / 1_000_000).toFixed(1)}M weighted · {metrics.stalled.length} stalled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/tender-board")}>
            <Kanban className="w-4 h-4 mr-1.5" />
            Board View
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Tender
          </Button>
        </div>
      </div>

      {/* Undo Banner */}
      {undoBanner && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Undo2 className="w-4 h-4 text-blue-600" />
            <span className="text-blue-800 dark:text-blue-200">{undoBanner.message}</span>
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
              onClick={() => { navigate(`/workspaces/${wsSuggestion.workspaceId}`); setWsSuggestion(null); }}
            >
              Go to Workspace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWsSuggestion(null)}>Dismiss</Button>
          </div>
        </div>
      )}



      {/* Search + Filters */}
      <div className="space-y-2 mb-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search company or tender name..."
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); setSelectedTenderId(null); }}
            className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/60"
          />
          {filterSearch && (
            <button
              onClick={() => setFilterSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterCompany} onValueChange={v => { setFilterCompany(v); setSelectedTenderId(null); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
            <SelectTrigger className="w-[165px] h-8 text-xs">
              <SelectValue placeholder="Milestone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Milestones</SelectItem>
              {TENDER_KANBAN_COLUMNS.map(s => (
                <SelectItem key={s} value={s}>{getTenderStatusDisplayName(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterCompany !== "all" || filterSearch || filterOwner !== "all" || filterRegion !== "all" || filterStatus !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => { setFilterCompany("all"); setFilterSearch(""); setFilterOwner("all"); setFilterRegion("all"); setFilterStatus("all"); }}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="space-y-6">
        {/* Tender Detail — full width, shown first when a tender is selected */}
        {selectedTender && (
          <div className="space-y-4">

            {/* ── Decision-Domain Tabs ── */}
            <Tabs defaultValue="overview">
              <div className="border border-border rounded-xl overflow-hidden shadow-none">

                {/* Tab bar — polished rounded pill style */}
                <div className="border-b border-border bg-muted/20 px-3 pt-2 pb-0">
                  <TabsList className="h-9 bg-muted/40 rounded-lg p-0.5 gap-0.5">
                    {[
                      { value: "overview", label: "Overview" },
                      { value: "commercial", label: "Commercial" },
                      { value: "delivery", label: "Delivery" },
                      { value: "risk", label: "Risk & Signals" },
                      { value: "customer", label: "Customer" },
                      { value: "documents", label: "Documents" },
                      { value: "activity", label: "Activity" },
                      { value: "audit", label: "Audit Trail" },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="rounded-md px-3 h-7 text-[11px] font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground transition-all"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* ═══════════════════════════════════════════════════
                    1. OVERVIEW — Command center
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="overview" className="mt-0">
                  {/* Lifecycle strip */}
                  <div className="px-4 pt-4 pb-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Lifecycle Tracker
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate(`/tender-board`)}>
                          <Kanban className="w-3 h-3 mr-1" /> Board
                        </Button>
                        <MoveStageDropdown tender={selectedTender} onMove={m => handleMove(selectedTender, m)} />
                      </div>
                    </div>
                    <MilestoneStrip current={selectedTender.status} onMove={m => handleMove(selectedTender, m)} />
                  </div>

                  {/* Identity row */}
                  <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setSelectedTenderId(tenders[0]?.id ?? null)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate">{selectedTender.customerName}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">Tender</Badge>
                        <Badge variant="outline" className={`text-[9px] shrink-0 font-semibold ${getTenderStatusColor(selectedTender.status)}`}>
                          {getTenderStatusDisplayName(selectedTender.status)}
                        </Badge>
                        {!selectedTender.crmSynced && (
                          <Badge variant="outline" className="text-[9px] shrink-0 border-amber-300 text-amber-600">Not Synced</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedTender.title}</p>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Top signal cards — concise */}
                    <SignalBar tender={selectedTender} />

                    {/* Next action suggestion */}
                    {(() => {
                      const next = getPrimaryNextMilestone(selectedTender.status);
                      const stalled = selectedTender.daysInStatus > 14 && !TENDER_TERMINAL.includes(selectedTender.status);
                      if (!next && !stalled) return null;
                      return (
                        <div className={`p-3 rounded-lg border ${stalled ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20" : "border-primary/30 bg-primary/5"}`}>
                          <div className="flex items-center gap-2">
                            <Zap className={`w-4 h-4 ${stalled ? "text-amber-600" : "text-primary"}`} />
                            <span className={`text-xs font-medium ${stalled ? "text-amber-700" : "text-primary"}`}>
                              {stalled
                                ? `Stalled ${selectedTender.daysInStatus} days in ${getTenderStatusDisplayName(selectedTender.status)}`
                                : `Suggested next: ${getTenderStatusDisplayName(next!)}`
                              }
                            </span>
                            {next && !stalled && (
                              <Button size="sm" className="text-xs h-6 ml-auto" onClick={() => handleMove(selectedTender, next)}>
                                Move <ArrowRight className="w-3 h-3 ml-0.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Workspace links */}
                    {(() => {
                      const tenderWs = workspaces.find(w => w.linkedTenderId === selectedTender.id);
                      if (tenderWs) return (
                        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Gavel className="w-4 h-4 text-primary" />
                            <span className="text-xs font-medium text-primary">Tender Workspace</span>
                            <Badge variant="outline" className="text-[9px] border-violet-300 text-violet-700 bg-violet-50">Linked</Badge>
                          </div>
                          <Button size="sm" className="text-xs h-7" onClick={() => navigate(`/workspaces/${tenderWs.id}`)}>
                            Open Workspace <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                        </div>
                      );
                      return null;
                    })()}
                    {linkedWorkspace && (
                      <div className="p-3 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Commercial Workspace:</span>
                          <span className="text-xs font-medium">{linkedWorkspace.title}</span>
                          <Badge variant="outline" className="text-[9px]">{linkedWorkspace.stage.replace(/_/g, " ")}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(`/workspaces/${linkedWorkspace.id}`)}>
                          View <ChevronRight className="w-3 h-3 ml-0.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    2. COMMERCIAL — Deal judgement layer
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="commercial" className="mt-0 p-4 space-y-5">
                  {/* Pricing Summary */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Pricing Summary
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Estimated Value</span>
                        <p className="text-lg font-bold font-mono">{formatSAR(selectedTender.estimatedValue)}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Win Probability</span>
                        <p className="text-lg font-bold">{selectedTender.probabilityPercent}%</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Weighted Value</span>
                        <p className="text-lg font-bold font-mono">{formatSAR(Math.round(selectedTender.estimatedValue * selectedTender.probabilityPercent / 100))}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Source</span>
                        <p className="text-lg font-bold">{selectedTender.source}</p>
                      </div>
                    </div>
                  </div>

                  {/* Margin Summary */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" /> Margin Analysis
                    </h4>
                    {(() => {
                      const margin = getMarginSignal(selectedTender.targetGpPercent);
                      const ragDot = margin.color === "green" ? "bg-emerald-500" : margin.color === "amber" ? "bg-amber-500" : "bg-red-500";
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Target GP%</span>
                            <p className="text-lg font-bold">{selectedTender.targetGpPercent}%</p>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Margin Signal</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${ragDot}`} />
                              <span className="text-sm font-semibold">{margin.label}</span>
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded-xl p-3">
                            <span className="text-[9px] text-muted-foreground uppercase">Est. Gross Profit</span>
                            <p className="text-lg font-bold font-mono">{formatSAR(Math.round(selectedTender.estimatedValue * selectedTender.targetGpPercent / 100))}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Commercial Versions — future-ready */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Commercial Versions
                    </h4>
                    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/10 text-center">
                      <p className="text-xs text-muted-foreground">No commercial versions recorded yet.</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Quote and proposal references will appear here when linked.</p>
                    </div>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    3. DELIVERY — Operational feasibility
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="delivery" className="mt-0 p-4 space-y-5">
                  {/* Delivery Team */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Delivery Team
                    </h4>
                    <div className="space-y-2">
                      {selectedTender.assignedTeamMembers.map(member => (
                        <div key={member} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-hala-navy)] text-white flex items-center justify-center text-[10px] font-semibold shrink-0">
                            {member.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{member}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {member === selectedTender.assignedOwner ? "Tender Owner" : "Delivery Member"}
                            </p>
                          </div>
                          {member === selectedTender.assignedOwner && (
                            <Badge variant="outline" className="text-[9px]">Owner</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operational Context */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Operational Context
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Region</span>
                        <p className="text-sm font-semibold">{selectedTender.region}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Source</span>
                        <p className="text-sm font-semibold">{selectedTender.source}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <span className="text-[9px] text-muted-foreground uppercase">Created</span>
                        <p className="text-sm font-semibold">{selectedTender.createdAt}</p>
                      </div>
                    </div>
                  </div>

                  {/* Feasibility — future-ready */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Feasibility & Capacity
                    </h4>
                    <div className="p-4 rounded-lg border border-dashed border-border bg-muted/10 text-center">
                      <p className="text-xs text-muted-foreground">No feasibility assessment recorded.</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Operations capacity, service complexity, and implementation readiness will appear here.</p>
                    </div>
                  </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    4. RISK & SIGNALS — Exception view
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="risk" className="mt-0 p-4">
                  <WorkspaceRiskSignalsTab
                    workspaceId={selectedTender.id}
                    customerId={selectedTender.customerId}
                    contextLabel={selectedTender.customerName}
                    derivedSignals={((): import("@/components/WorkspaceRiskSignalsTab").DerivedSignal[] => {
                      const signals: import("@/components/WorkspaceRiskSignalsTab").DerivedSignal[] = [];
                      const marginSig = getMarginSignal(selectedTender.targetGpPercent);
                      signals.push(marginSig.color !== "green"
                        ? { label: "Margin Risk", detail: `GP ${selectedTender.targetGpPercent}% — ${marginSig.label}`, severity: marginSig.color as "red" | "amber" }
                        : { label: "Margin", detail: `GP ${selectedTender.targetGpPercent}% — healthy`, severity: "green" as const }
                      );
                      const days = Math.ceil((new Date(selectedTender.submissionDeadline).getTime() - Date.now()) / 86400000);
                      if (days < 0) signals.push({ label: "Deadline Overdue", detail: `Submission deadline passed ${Math.abs(days)} days ago`, severity: "red" });
                      else if (days <= 14) signals.push({ label: "Deadline Risk", detail: `${days} days to submission deadline`, severity: "amber" });
                      if (selectedTender.daysInStatus > 14 && !TENDER_TERMINAL.includes(selectedTender.status))
                        signals.push({ label: "Stage Stall", detail: `Stalled ${selectedTender.daysInStatus}d in ${getTenderStatusDisplayName(selectedTender.status)}`, severity: "red" });
                      else if (selectedTender.daysInStatus > 7)
                        signals.push({ label: "Stage Velocity", detail: `${selectedTender.daysInStatus}d in current stage — monitor`, severity: "amber" });
                      if (!selectedTender.crmSynced) signals.push({ label: "CRM Not Synced", detail: "Tender not synced to CRM — manual data only", severity: "amber" });
                      if (selectedTender.probabilityPercent < 30) signals.push({ label: "Win Probability", detail: `${selectedTender.probabilityPercent}% — low confidence`, severity: "red" });
                      else if (selectedTender.probabilityPercent < 50) signals.push({ label: "Win Probability", detail: `${selectedTender.probabilityPercent}% — moderate confidence`, severity: "amber" });
                      return signals;
                    })()}
                  />
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    5. CUSTOMER — Customer intelligence
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="customer" className="mt-0 p-4 space-y-5">
                  {(() => {
                    const cust = customers.find(c => c.id === selectedTender.customerId);
                    if (!cust) return (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">Customer not found in system.</p>
                      </div>
                    );
                    const gradeColor = cust.grade === "A" ? "text-emerald-700 bg-emerald-100" : cust.grade === "B" ? "text-blue-700 bg-blue-100" : cust.grade === "C" ? "text-amber-700 bg-amber-100" : cust.grade === "D" ? "text-orange-700 bg-orange-100" : "text-red-700 bg-red-100";
                    const payColor = cust.paymentStatus === "Good" ? "text-emerald-700" : cust.paymentStatus === "Acceptable" ? "text-amber-700" : "text-red-700";
                    return (
                      <>
                        {/* Customer Identity */}
                        <div>
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" /> Customer Identity
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Customer</span>
                              <p className="text-sm font-bold">{cust.name}</p>
                              <p className="text-[10px] text-muted-foreground">{cust.group}</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Code</span>
                              <p className="text-sm font-mono font-semibold">{cust.code}</p>
                              <p className="text-[10px] text-muted-foreground">{cust.city}, {cust.region}</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Industry</span>
                              <p className="text-sm font-semibold">{cust.industry}</p>
                              <p className="text-[10px] text-muted-foreground">{cust.serviceType}</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Status</span>
                              <p className="text-sm font-semibold">{cust.status}</p>
                              <p className="text-[10px] text-muted-foreground">Acct: {cust.accountOwner}</p>
                            </div>
                          </div>
                        </div>

                        {/* Customer Quality / ECR */}
                        <div>
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> Customer Quality (ECR)
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Grade</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${gradeColor}`}>{cust.grade}</span>
                                <span className="text-xs text-muted-foreground">
                                  {cust.grade === "A" ? "Premium" : cust.grade === "B" ? "Strong" : cust.grade === "C" ? "Standard" : cust.grade === "D" ? "At Risk" : "Critical"}
                                </span>
                              </div>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Payment</span>
                              <p className={`text-sm font-semibold ${payColor}`}>{cust.paymentStatus}</p>
                              <p className="text-[10px] text-muted-foreground">DSO: {cust.dso} days</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Contract</span>
                              <p className="text-sm font-semibold">{formatSAR(cust.contractValue2025)}</p>
                              <p className="text-[10px] text-muted-foreground">Exp: {cust.contractExpiry}</p>
                            </div>
                            <div className="bg-muted/30 rounded-xl p-3">
                              <span className="text-[9px] text-muted-foreground uppercase">Revenue Track</span>
                              <p className="text-sm font-semibold">{formatSAR(cust.revenue2025)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {cust.revenue2025 > cust.revenue2024 ? "↑ Growing" : cust.revenue2025 < cust.revenue2024 ? "↓ Declining" : "→ Flat"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* View full customer */}
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(`/customers/${cust.id}`)}>
                          <ExternalLink className="w-3 h-3 mr-1.5" /> Open Full Customer Profile
                        </Button>
                      </>
                    );
                  })()}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    6. DOCUMENTS — Document authority
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="documents" className="mt-0 p-4">
                  {(() => {
                    const tenderDocs = getDocumentsByTender(selectedTender.id, showDocArchived);
                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5" /> Documents ({tenderDocs.length})
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant={showDocArchived ? "default" : "outline"} className="gap-1.5 text-xs" onClick={() => setShowDocArchived(!showDocArchived)}>
                              {showDocArchived ? "Showing Archived" : "Show Archived"}
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowUpload(true)}>
                              <Upload className="w-3 h-3" /> Upload
                            </Button>
                          </div>
                        </div>
                        {tenderDocs.length > 0 ? (
                          <div className="space-y-2">
                            {tenderDocs.map(doc => {
                              const isClickable = hasRealFile(doc);
                              return (
                                <div
                                  key={doc.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${
                                    isClickable ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"
                                  }`}
                                  onClick={() => { if (isClickable) setViewerDoc(doc); }}
                                >
                                  <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                      {doc.name}
                                      {isClickable && <Eye className="w-3 h-3 text-muted-foreground" />}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.currentVersion} · {doc.uploadedBy} · {doc.uploadDate}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className="text-[9px]">{getCategoryIcon(doc.category)} {doc.category}</Badge>
                                    <Badge variant={doc.status === "Final" || doc.status === "Signed" ? "default" : "secondary"} className="text-[9px]">{doc.status}</Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground mb-3">No documents linked to this tender.</p>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowUpload(true)}>
                              <Upload className="w-3 h-3" /> Upload First Document
                            </Button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    7. ACTIVITY — Human-readable timeline
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="activity" className="mt-0 p-4 space-y-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Activity className="w-3.5 h-3.5" /> Activity Timeline
                  </h4>

                  {/* Notes section */}
                  {selectedTender.notes && (
                    <div className="p-3 rounded-lg border border-border bg-muted/10">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700">Note</Badge>
                        <span className="text-[10px] text-muted-foreground">Tender note</span>
                      </div>
                      <p className="text-sm text-foreground/90">{selectedTender.notes}</p>
                    </div>
                  )}

                  {/* Stage history as timeline */}
                  {(() => {
                    const history = getTenderStageHistory(selectedTender.id);
                    if (history.length === 0 && !selectedTender.notes) return (
                      <div className="text-center py-8">
                        <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">Stage changes, comments, and key events will appear here.</p>
                      </div>
                    );
                    return (
                      <div className="space-y-2">
                        {history.map(h => (
                          <div key={h.id} className="p-3 rounded-lg border border-border bg-muted/10">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={`text-[9px] ${
                                h.action === "reverted"
                                  ? "border-amber-400 text-amber-700"
                                  : "border-emerald-400 text-emerald-700"
                              }`}>
                                {h.action === "reverted" ? "Reverted" : "Stage Move"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {getTenderStatusDisplayName(h.fromStatus)} → {getTenderStatusDisplayName(h.toStatus)}
                              </span>
                            </div>
                            {h.note && (
                              <p className="text-xs text-foreground/80 mb-1 italic">"{h.note}"</p>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{h.userName}</span>
                              <span>{new Date(h.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    8. AUDIT TRAIL — Immutable system record
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="audit" className="mt-0 p-4">
                  {(() => {
                    const history = getTenderStageHistory(selectedTender.id);
                    if (history.length === 0) return (
                      <p className="text-sm text-muted-foreground text-center py-6">No audit entries.</p>
                    );
                    return (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" /> System Audit ({history.length} entries)
                        </h4>
                        <div className="space-y-1.5">
                          {history.map(h => (
                            <div key={h.id} className="px-3 py-2 rounded border border-border text-xs flex items-center gap-3 bg-muted/5">
                              <span className="text-muted-foreground font-mono text-[10px] shrink-0 w-36">{new Date(h.timestamp).toLocaleString()}</span>
                              <span className="shrink-0 w-14">
                                <Badge variant="outline" className={`text-[8px] ${h.action === "reverted" ? "border-amber-300 text-amber-600" : "border-emerald-300 text-emerald-600"}`}>
                                  {h.action === "reverted" ? "REVERT" : "MOVE"}
                                </Badge>
                              </span>
                              <span className="text-foreground/80">
                                {getTenderStatusDisplayName(h.fromStatus)} → {getTenderStatusDisplayName(h.toStatus)}
                              </span>
                              <span className="text-muted-foreground ml-auto shrink-0">{h.userName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>

              </div>
            </Tabs>
          </div>
        )}

        {/* When no tender selected — prompt to select one */}
        {!selectedTender && filteredTenders.length > 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Gavel className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a tender to view its lifecycle and signals</p>
            <p className="text-xs mt-1 opacity-70">{filteredTenders.length} tender{filteredTenders.length !== 1 ? "s" : ""} match your filters — click any result above or use the <button onClick={() => navigate("/tenders-overview")} className="underline hover:text-foreground transition-colors">Tenders Overview</button> for a full card view</p>
          </div>
        )}
        {!selectedTender && filteredTenders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No tenders match the current filters.</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <CreateTenderForm
          customers={customers}
          workspaces={workspaces}
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setSelectedTenderId(t.id);
            refresh();
          }}
        />
      )}

      {/* Document Viewer */}
      <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} onDocumentChanged={() => setTick(t => t + 1)} />

      {/* Upload Dialog */}
      {selectedTender && (
        <UploadDialog
          open={showUpload}
          onClose={() => setShowUpload(false)}
          defaultCategory="Tenders"
          suggestedName={selectedTender ? `${selectedTender.customerName} — ${selectedTender.title}` : undefined}
          onUpload={({ name, category, file, notes, tags }) => {
            uploadDocument({
              name,
              category: category as DocumentCategory,
              customerId: selectedTender.customerId,
              customerName: selectedTender.customerName,
              file,
              tenderId: selectedTender.id,
              tenderName: selectedTender.title,
              workspaceId: selectedTender.linkedWorkspaceId,
              workspaceName: linkedWorkspace?.title ?? null,
              notes,
              tags,
            });
            toast.success(`Document "${name}" uploaded.`);
            refresh();
          }}
        />
      )}
    </div>
  );
}
