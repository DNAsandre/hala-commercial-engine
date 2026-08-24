import { getCurrentUser } from "@/lib/auth-state";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { cleanHref } from "@clean/lib/clean-routing";
import {
  ArrowLeft, FileText, ShieldCheck, FileCheck, Clock, ChevronRight, ChevronDown, AlertTriangle,
  CheckCircle2, XCircle, Undo2, Timer, ArrowRightLeft, ShieldAlert, ShieldOff, Info,
  FolderOpen, Upload, Eye, Edit, Download, FileSignature, RefreshCw, CalendarClock,
  User, BarChart3, Plus, ToggleLeft, ToggleRight, Link2, Archive, RotateCcw,
  FileUp, Filter, Search, Trash2, DollarSign, TrendingUp, ExternalLink, Truck,
  ClipboardList, PackageCheck, Landmark, Scale, Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  formatSAR, formatPercent, getStageLabel, getStageColor, getApprovalRequirements,
  getRoleLabel, WORKSPACE_STAGES, TENDER_WORKSPACE_STAGES,
  getWorkspaceType, getWorkspaceTypeLabel, getWorkspaceTypeBadgeColor,
  getEffectiveStage, getEffectiveStageLabel, getEffectiveStageColor,
  getStagesForType, type WorkspaceType, type TenderWorkspaceStage,
  COMMERCIAL_MILESTONES, mapToCommercialMilestone, deriveSubLifecycleStates,
  QUOTE_STATES, PROPOSAL_STATES, SLA_STATES, HANDOVER_STATES,
} from "@/lib/store";
import {
  useWorkspace, useQuotesByWorkspace, useProposalsByWorkspace,
  useApprovalRecords, useAuditLog as useSupabaseAuditLog,
} from "@/hooks/useSupabase";
import { Loader2 } from "lucide-react";
// SC-01 rulings R3/R5 (SX-005/SX-011): the stage-transition gating engine is
// excluded from this build. Stage movement is human-controlled, free and
// non-gating; persistence goes through updateWorkspaceDB below. No validation
// hard-blocks, no strict mode, no override machinery.
import { toast } from "sonner";
import { updateWorkspace as updateWorkspaceDB, createAuditEntry } from "@/lib/supabase-data";
import { logAuditAction } from "@/hooks/useMutations";
import {
  filterProposalsForActiveIdentity,
  resolveActiveProposalIdentity,
} from "@/lib/proposal-identity";
import {
  getDocumentsByWorkspace, getFileTypeColor, getCategoryIcon,
  uploadDocument, hasRealFile, initializeDocumentVault,
  type UnifiedDocument, type DocumentCategory,
} from "@/lib/document-vault";
import { DocumentViewer, UploadDialog } from "@/components/DocumentViewer";
// CLEAN APP: inlined — see GovernanceConsole.tsx. Importing this from
// @/components/DashboardLayout would drag the legacy shell (ComposerDirtyContext,
// UnsavedChangesModal, BotAssistPanel, GlobalCRMSyncIndicator) and its
// allNavItems array of denylisted routes into the clean bundle.
const navigationV1 = true;
import { handleSupabaseError, getFetchError } from "@/lib/supabase-error";
import { readCustomerMasterById, type CustomerMasterRead } from "@/lib/supabase-commercial-data";
import { isPricingLocked, getPricingLockReason, canOverridePricingLock, logOverrideAudit, canEditCosts, type DeltaReport } from "@/lib/sla-integrity";
import { SlaVsPnlDeltaBanner } from "@/components/SlaVsPnlDeltaBanner";
import CRMSyncBadge from "@/components/CRMSyncBadge";
import WorkspaceQuoteSection from "@/components/WorkspaceQuoteSection";
import WorkspaceProposalSection from "@/components/WorkspaceProposalSection";
import WorkspaceSlaContractSection from "@/components/WorkspaceSlaContractSection";
import WorkspaceDocumentSection from "@/components/WorkspaceDocumentSection";
import CommercialQuoteControlTab from "@/components/commercial/CommercialQuoteControlTab";
import CommercialProposalControlTab from "@/components/commercial/CommercialProposalControlTab";
import CommercialSlaControlTab from "@/components/commercial/CommercialSlaControlTab";
import CommercialActivityTab from "@/components/commercial/CommercialActivityTab";
import CommercialAuditTrailTab from "@/components/commercial/CommercialAuditTrailTab";
import { usePnLByWorkspace } from "@/hooks/useSupabase";
import ProposalTrackerStrip from "@/components/proposal-workspace/ProposalTrackerStrip";
import ProposalStageWorkbench from "@/components/proposal-workspace/ProposalStageWorkbench";
import ProposalOverviewPanel from "@/components/proposal-workspace/ProposalOverviewPanel";
import ProposalSnapshotCard from "@/components/proposal-workspace/ProposalSnapshotCard";
import CrmPipelineStrip, { getCrmStageLabel } from "@/components/proposal-workspace/CrmPipelineStrip";
import { getProposalStageLabel, PROPOSAL_TRACKER_STAGES } from "@/components/proposal-workspace/proposal-stages";
// SC-01 W04 (T08-B): tracker persistence goes through helpers that CONFIRM the
// stored value from the returned row before anything is reported. The hazard
// is real — proved live on 2026-08-05: an unauthorised PATCH returned HTTP 200
// with an empty row set and the stored value unchanged, so `{ error: null }`
// alone is not proof of persistence. `lib/intake-save.ts#changeStage`, used
// here previously, had that gap; as of commit a53717f it reads the row back
// and compares the stored value itself, so this note is history, not a defect.
import {
  changeProposalTrackerStage,
  finalizeStageAdvance,
  readProposalTrackerStages,
} from "@/lib/proposal-workspace-persistence";
import {
  createDefaultWorkspaceData, type ProposalWorkspaceData,
  calcQualificationReadiness, calcDiscoveryCompleteness, calcSolutionReadiness, calcPricingConfidence,
  // SC-01 W04 (T08-B correction pass): honest-render decisions live in the
  // state module so they can be asserted by test — there is no jsdom here.
  resolveWorkspaceReadState, readCustomerRisk, filterSupportingDocs, formatRecordedDate,
} from "@/components/proposal-workspace/proposal-workspace-state";
import {
  isWorkspaceIntegrationEnabled, updateRenewalOwner,
  getDaysToExpiry, isInRenewalWindow, getSupportingDocs, uploadSupportingDoc,
  toggleRequiredForContract, linkDocToCycle, archiveSupportingDoc, restoreSupportingDoc,
  teamMembers, SUPPORT_DOC_CATEGORIES, type SupportingDoc, type SupportDocCategory, type ContractCycle,
} from "@/lib/workspace-integration";

// ─── SLA Records (canonical backing pending) ─────────────────────
interface WorkspaceSLA {
  id: string;
  workspaceId: string;
  customerName: string;
  customerId: string;
  title: string;
  status: "active" | "draft" | "expired" | "under_review";
  version: number;
  effectiveDate: string;
  expiryDate: string;
}

const workspaceSLAs: WorkspaceSLA[] = [];

function WorkspaceProcessIsolationNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border border-amber-200 bg-amber-50/40 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
          <ShieldOff className="w-4 h-4 text-amber-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-amber-800/90 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

function WorkspaceRiskSignalsTab(_props: Record<string, unknown>) {
  return (
    <WorkspaceProcessIsolationNotice
      title="Risk And Signal Feeds Disconnected"
      description="Workspace risk, signal, and generated insight feeds are paused. This workspace remains available as a clean container for CRM, documents, proposal, tender, and SLA work."
    />
  );
}

function WorkspaceEscalationsTab(_props: Record<string, unknown>) {
  return (
    <WorkspaceProcessIsolationNotice
      title="Escalation Feed Disconnected"
      description="Workspace escalation events and generated escalation tasks are paused while the clean process surfaces are isolated."
    />
  );
}

// ─── CYCLE STATUS CONFIG ────────────────────────────────────
const cycleStatusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  active: { color: "bg-emerald-100 text-emerald-700", label: "Active" },
  expiring: { color: "bg-amber-100 text-amber-700", label: "Expiring" },
  renewal_window: { color: "bg-orange-100 text-orange-700", label: "Renewal Window" },
  renewal_in_progress: { color: "bg-blue-100 text-blue-700", label: "Renewal In Progress" },
  closed: { color: "bg-gray-100 text-gray-500", label: "Closed" },
};

// ── Local free stage movement (SC-01 ruling R3: human-controlled, non-gating) ──
type ValidationFailure = { ruleName: string; error: string };
type TransitionResult = {
  success: boolean;
  fromStage: string;
  nextStage: string | null;
  message: string;
  governanceOverride?: boolean;
  validationErrors: ValidationFailure[];
};
const getStageDisplayName = (stage: string): string => getStageLabel(stage as never);
function getNextStage(stage: string): string | null {
  const i = WORKSPACE_STAGES.findIndex((st) => st.value === stage);
  return i >= 0 && i < WORKSPACE_STAGES.length - 1 ? WORKSPACE_STAGES[i + 1].value : null;
}
function getPrevStage(stage: string): string | null {
  const i = WORKSPACE_STAGES.findIndex((st) => st.value === stage);
  return i > 0 ? WORKSPACE_STAGES[i - 1].value : null;
}
/** Free advance: the only "failure" is having no further stage. */
function advanceStage(stage: string): TransitionResult {
  const next = getNextStage(stage);
  if (!next) return { success: false, fromStage: stage, nextStage: null, message: "Already at the final stage.", validationErrors: [] };
  return { success: true, fromStage: stage, nextStage: next, message: "Stage advanced.", validationErrors: [] };
}
/** Free revert to the previous stage. */
function revertStage(stage: string): TransitionResult {
  const prev = getPrevStage(stage);
  if (!prev) return { success: false, fromStage: stage, nextStage: null, message: "Already at the first stage.", validationErrors: [] };
  return { success: true, fromStage: stage, nextStage: prev, message: "Stage reverted.", validationErrors: [] };
}
// The excluded module's history/override/strict-mode stores do not exist in
// this build — honest empty values, never fabricated entries.
type StageHistoryEntry = {
  id: string; action: string;
  fromStage: string; toStage: string; timestamp: string; userName: string;
  overrideReason: string; overriddenRules: string[];
  overrideRecord?: { overrideReason: string; overriddenRules: string[] };
};
const getStageHistory = (_id: string): StageHistoryEntry[] => [];
const getWorkspaceOverrides = (_id: string): StageHistoryEntry[] => [];
const getLatestOverride = (_id: string): StageHistoryEntry | null => null;
const preflightValidation = (_id: string): ValidationFailure[] => [];
const getStrictMode = (): boolean => false;
// Undo window: a genuine LOCAL session timer started only after a stage
// advance has been confirmed persisted AND the workspace rehydrated. It is
// UX convenience state, not a fabricated record and not a gate.
const UNDO_WINDOW_MS = 10_000;

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const isProposalRoute = location.startsWith("/proposals/");
  const [, forceUpdate] = useState(0);
  const [transitionResult, setTransitionResult] = useState<TransitionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [undoCountdown, setUndoCountdown] = useState(0);
  const [showUndoBanner, setShowUndoBanner] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAdvanceAtRef = useRef<number | null>(null);

  // Document viewer state
  const [viewerDoc, setViewerDoc] = useState<UnifiedDocument | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showDocArchived, setShowDocArchived] = useState(false);


  // SLA Integrity Guard state
  const [pricingOverrideOpen, setPricingOverrideOpen] = useState(false);
  const [pricingOverrideField, setPricingOverrideField] = useState("");
  const [slaChecklistComplete, setSlaChecklistComplete] = useState(false);
  const [deltaReport, setDeltaReport] = useState<DeltaReport | null>(null);

  // Supporting docs state
  const [supportDocFilter, setSupportDocFilter] = useState<string>("all");
  const [showSupportUpload, setShowSupportUpload] = useState(false);
  const [supportUploadName, setSupportUploadName] = useState("");
  const [supportUploadCategory, setSupportUploadCategory] = useState<SupportDocCategory>("Other");
  const [supportUploadRequired, setSupportUploadRequired] = useState(false);

  // ── Internal Proposal Tracker stage (separate from CRM pipeline stage) ──
  const [proposalStage, setProposalStage] = useState(PROPOSAL_TRACKER_STAGES[0].key);

  // ── CRM Pipeline Stage (TOP tracker — completely independent from proposalStage) ──
  const [crmPipelineStage, setCrmPipelineStage] = useState<import("@/lib/store").CRMStage>("qualified");

  // Where the displayed internal stage came from. The tracker must never
  // present a stage as persisted truth when it is a placeholder, a stale value
  // from a previously opened proposal, or the result of a failed read.
  const [trackerHydration, setTrackerHydration] = useState<{
    state: "loading" | "persisted" | "unrecorded" | "missing" | "error";
    message: string | null;
  }>({ state: "loading", message: null });
  const [trackerReloadKey, setTrackerReloadKey] = useState(0);
  const [trackerSaving, setTrackerSaving] = useState<"crm" | "internal" | null>(null);
  // Whether `crm_pipeline_stage` is actually recorded on the ticket. The
  // workspace mapper turns a NULL column into "prospecting", which would read
  // as a real CRM position; this keeps the difference visible.
  const [crmStageRecorded, setCrmStageRecorded] = useState(true);

  // Proposal workbench state is session-only until it is backed by Supabase.
  const [proposalWsData, setProposalWsData] = useState<ProposalWorkspaceData>(() => createDefaultWorkspaceData());
  const updateProposalWsData = (d: ProposalWorkspaceData) => {
    setProposalWsData(d);
  };

  // Initialize (one-time side effects)
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      initializeDocumentVault();
    }
  }, []);

  // Read ?tab= URL param for deep-linking (e.g., from Output Studio back navigation)
  const initialTab = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    if (requestedTab === "risk_signals" || requestedTab === "escalations") return "overview";
    return requestedTab || 'overview';
  }, []);

  const { data: ws, loading: wsLoading, error: wsError, refetch: refetchWs } = useWorkspace(id!, isProposalRoute ? "proposal" : "workspace");
  const { data: wsQuotes, loading: qLoading } = useQuotesByWorkspace(id!);
  const { data: wsProposals, loading: pLoading } = useProposalsByWorkspace(id!);
  const { data: allApprovals, loading: appLoading } = useApprovalRecords();
  const { data: allAuditLog, loading: auditLoading } = useSupabaseAuditLog();
  const { data: wsPnL, loading: pnlLoading } = usePnLByWorkspace(id!);

  // SC-01 W04 (T08-B correction pass): a failed read must not look like an
  // absent proposal. The hook surfaces thrown/timed-out reads through `error`,
  // but the proposal fetcher ALSO swallows PostgREST/RLS failures and returns
  // null — it records them through setFetchError instead. Both channels are
  // read here so "Workspace not found" is only ever shown for a read that
  // actually succeeded and matched nothing.
  const [readAttempt, setReadAttempt] = useState(0);
  const workspaceFetchError = !wsLoading && !ws
    ? getFetchError("fetchProposalWorkspaceById")?.error.message ?? null
    : null;

  // ── Customer master record (real read; replaces a hardcoded literal) ──
  // The page used to build `customer` as an object literal carrying
  // paymentStatus:'Good' and dso:0, then rendered a "Healthy customer profile"
  // verdict and "0 days" from it. Nothing was ever read. Now: read the row,
  // and keep found / absent / read-failed distinguishable.
  const [customerRead, setCustomerRead] = useState<CustomerMasterRead & { loading: boolean }>(
    { status: "absent", customer: null, message: null, loading: true },
  );
  const customerIdForRead = ws?.customerId ?? "";
  useEffect(() => {
    let cancelled = false;
    setCustomerRead({ status: "absent", customer: null, message: null, loading: true });
    if (!customerIdForRead) {
      setCustomerRead({ status: "absent", customer: null, message: null, loading: false });
      return;
    }
    (async () => {
      const result = await readCustomerMasterById(customerIdForRead);
      if (cancelled) return;
      setCustomerRead({ ...result, loading: false });
    })();
    return () => { cancelled = true; };
  }, [customerIdForRead, readAttempt]);

  // Canonical document lists from doc_instances (Wave 2)

  // ── Hotkey protection ── (must be above early returns)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !showConfirm) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        if (target.closest("[data-advance-stage-btn]")) { e.preventDefault(); e.stopPropagation(); }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [showConfirm]);

  // ── Undo cleanup ── (must be above early returns)
  useEffect(() => {
    return () => { if (undoTimerRef.current) clearInterval(undoTimerRef.current); };
  }, []);

  // Workspace renewal cycles, global signals, and escalation feeds are intentionally disconnected.
  const integrationEnabled = isWorkspaceIntegrationEnabled();
  const [activeCycle] = useState<ContractCycle | undefined>(undefined);
  const [contractReadyChecks] = useState<any[]>([]);
  const workspaceEscalations: Array<{ status: string }> = [];
  const setWorkspaceEscalations = () => undefined;

  // ── Seed BOTH trackers from the recorded commercial_tickets row so the
  //    displayed stages are the persisted stages and survive a page reload.
  //    (crm_pipeline_stage / internal_stage are established columns.) ──
  //    SC-01 W04 (T08-B): the tracker state is RESET on every ticket change
  //    before the read starts. Previously `internal_stage` was applied only
  //    when it was non-null and the read error was swallowed, so opening a
  //    second proposal could keep showing the FIRST proposal's internal stage.
  useEffect(() => {
    const ticketId = ws?.crmDealId;

    // Identity reset — never carry another record's tracker state forward.
    setProposalStage(PROPOSAL_TRACKER_STAGES[0].key);
    setTrackerHydration({ state: "loading", message: null });
    setCrmStageRecorded(true);
    if (ws?.crmStage) setCrmPipelineStage(ws.crmStage);

    if (!ticketId) {
      setTrackerHydration({
        state: "missing",
        message: "No commercial ticket is linked to this workspace, so no saved internal stage could be read.",
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const stages = await readProposalTrackerStages(ticketId);
      if (cancelled) return;
      if (stages.error) {
        setTrackerHydration({ state: "error", message: stages.error });
        return;
      }
      if (!stages.found) {
        setTrackerHydration({
          state: "missing",
          message: "The linked commercial ticket could not be read with the current sign-in, so the saved stage is unknown.",
        });
        return;
      }
      setCrmStageRecorded(stages.crmPipelineStage !== null);
      if (stages.crmPipelineStage) setCrmPipelineStage(stages.crmPipelineStage as import("@/lib/store").CRMStage);
      if (stages.internalStage) {
        setProposalStage(stages.internalStage);
        setTrackerHydration({ state: "persisted", message: null });
      } else {
        setTrackerHydration({
          state: "unrecorded",
          message: "No internal stage is recorded on this ticket yet — the strip shows the first stage as a starting point, not a saved position.",
        });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.id, ws?.crmDealId, trackerReloadKey]);

  // CLEAN APP: `diLoading` removed — it came from useDocInstances (doc_instances),
  // which was composer-only and has been severed.
  const loading = wsLoading || qLoading || pLoading || appLoading || auditLoading || pnlLoading;

  // Three distinct outcomes — loading, genuinely not found, read failed.
  const readState = resolveWorkspaceReadState({
    loading,
    workspace: ws,
    errors: [wsError, workspaceFetchError],
  });

  if (readState.kind === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading proposal {id}…</p>
      </div>
    );
  }

  if (readState.kind === "read_failed") {
    return (
      <div className="p-6 max-w-2xl">
        <Card className="border border-red-200 bg-red-50/40 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-serif flex items-center gap-2 text-red-900">
              <XCircle className="w-4 h-4 text-red-600" /> This proposal could not be read
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-red-800/90">
              The read of proposal <span className="font-mono text-xs">{id}</span> failed, so it is unknown
              whether this record exists. This is <span className="font-semibold">not</span> a statement that
              the proposal is missing.
            </p>
            <p className="rounded border border-red-200 bg-white/70 px-2 py-1.5 font-mono text-[11px] text-red-800">
              {readState.reason}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setReadAttempt(n => n + 1); void refetchWs(); }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
              <Link href={cleanHref("/workspaces/proposals")}>
                <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1.5" />Back to proposals</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (readState.kind === "not_found" || !ws) return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-serif">Proposal not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The read succeeded and returned no proposal with id <span className="font-mono text-xs">{id}</span>.
      </p>
      <div className="flex items-center gap-2 mt-4">
        <Link href={cleanHref("/workspaces/proposals")}><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</Button></Link>
        <Button variant="ghost" onClick={() => { setReadAttempt(n => n + 1); void refetchWs(); }}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Check again
        </Button>
      </div>
    </div>
  );

  const wsType = getWorkspaceType(ws);
  const isTender = wsType === "tender";
  const isRenewal = wsType === "renewal";
  const isCommercial = wsType === "commercial";
  const proposalIdentityResolution = isCommercial
    ? resolveActiveProposalIdentity({ routeId: id, workspace: ws, isProposalRoute })
    : null;
  const activeProposalIdentity = proposalIdentityResolution?.identity ?? null;
  const scopedWsProposals = filterProposalsForActiveIdentity(wsProposals, activeProposalIdentity);
  const effectiveStages = getStagesForType(wsType);
  const effectiveStage = getEffectiveStage(ws);
  const effectiveStageIdx = effectiveStages.findIndex(s => s.value === effectiveStage);

  // ── CRM Stage handler (updates crm_pipeline_stage ONLY, never internal
  //    stage). Persists FIRST to the established commercial_tickets column;
  //    state and success are reported only after the confirmed write. ──
  const handleCrmStageChange = async (newStage: import("@/lib/store").CRMStage) => {
    const oldStage = crmPipelineStage;
    if (trackerSaving || newStage === oldStage) return;
    const ticketId = ws.crmDealId;
    if (!ticketId) {
      toast.error("CRM stage not saved", { description: "No commercial ticket is linked to this workspace." });
      return;
    }
    // Confirmed write: the displayed stage, the audit entry and the success
    // message all wait for the value the database returned.
    setTrackerSaving("crm");
    const saved = await changeProposalTrackerStage({
      ticketId,
      column: "crm_pipeline_stage",
      oldValue: oldStage,
      newValue: newStage,
      userName: getCurrentUser().name,
    });
    setTrackerSaving(null);
    if (!saved.ok) {
      toast.error("CRM stage NOT saved", { description: saved.message });
      return;
    }
    setCrmPipelineStage(newStage);
    setCrmStageRecorded(true);
    toast.success(`CRM Pipeline → ${getCrmStageLabel(newStage)}`, { description: saved.message });
  };

  // ── Proposal Stage handler (updates internal_stage ONLY, never CRM
  //    pipeline). Persists FIRST; state changes only after confirmed write. ──
  const handleProposalStageChange = async (newStage: string) => {
    const oldStage = proposalStage;
    if (trackerSaving || newStage === oldStage || trackerHydration.state === "loading" || trackerHydration.state === "error") return;
    const ticketId = ws.crmDealId;
    if (!ticketId) {
      toast.error("Internal stage not saved", { description: "No commercial ticket is linked to this workspace." });
      return;
    }
    setTrackerSaving("internal");
    const saved = await changeProposalTrackerStage({
      ticketId,
      column: "internal_stage",
      oldValue: oldStage,
      newValue: newStage,
      userName: getCurrentUser().name,
    });
    setTrackerSaving(null);
    if (!saved.ok) {
      toast.error("Internal stage NOT saved", { description: saved.message });
      return;
    }
    setProposalStage(newStage);
    setTrackerHydration({ state: "persisted", message: null });
    toast.success(`Internal stage → ${getProposalStageLabel(newStage)}`, { description: saved.message });
  };
  // ── Customer master record ──
  // `customer` is now ONLY the row that was read back from `customers`. It is
  // null when no row was found and null when the read failed; the two are told
  // apart by `customerRead.status`, never by this value. Nothing here is
  // defaulted — an unread field stays null and renders as "not recorded".
  const customer = customerRead.status === "found" ? customerRead.customer : null;
  const customerRisk = readCustomerRisk(customer);
  const customerUnavailableNote =
    customerRead.loading
      ? "Reading the customer master record…"
      : customerRead.status === "error"
        ? `The customer master record could not be read: ${customerRead.message ?? "reason not reported"}. Whether one exists is unknown.`
        : ws.customerId
          ? "No customer master record is linked to this proposal, so customer grade, DSO, payment behaviour and contract values are not recorded."
          : "This proposal carries no customer id, so no customer master record can be read.";
  const wsApprovals = allApprovals.filter(a => a.workspaceId === ws.id);
  const wsSignals: Array<{ id: string; severity: "red" | "amber" | "green"; type: string; message: string }> = [];
  const wsSLAs = workspaceSLAs.filter(s => s.workspaceId === ws.id);
  const wsAudit = allAuditLog.filter(a =>
    a.entityId === ws.id ||
    wsQuotes.some(q => q.id === a.entityId) ||
    scopedWsProposals.some(p => p.id === a.entityId) ||
    a.entityId.startsWith(`cc-${ws.id}`) ||
    a.entityId.startsWith(`sd-${ws.id}`)
  );
  const approvalReqs = getApprovalRequirements(ws.gpPercent, ws.palletVolume);
  const currentStageIdx = WORKSPACE_STAGES.findIndex(s => s.value === ws.stage);
  const nextStage = getNextStage(ws.stage);
  const wsStageHistory = getStageHistory(ws.id);
  const wsOverrides = getWorkspaceOverrides(ws.id);
  const latestOverride = getLatestOverride(ws.id);
  const preflightFailures: ValidationFailure[] = nextStage ? preflightValidation(ws.id) : [];
  const hasWarnings = preflightFailures.length > 0;
  const isStrictMode = getStrictMode();

  // SLA Integrity Guard computed values
  const pricingLocked = !isCommercial && isPricingLocked(ws);
  const pricingLockReason = getPricingLockReason(ws);
  const currentUserRole = getCurrentUser().role as import("@/lib/store").UserRole;
  const isAdminUser = currentUserRole === "admin";
  const canEditCostFields = canEditCosts(currentUserRole);
  const latestQuote = wsQuotes.length > 0 ? wsQuotes[0] : null;
  const daysToExpiry = activeCycle ? getDaysToExpiry(activeCycle.endDate) : null;
  const inRenewalWindow = activeCycle ? isInRenewalWindow(activeCycle) : false;

  // Supporting docs.
  // ONE derived set behind ONE counter: `visibleSupportDocs` is both what the
  // badge counts and what the list renders. The page previously showed
  // `wsSupportDocs.length` (pre-filter) above a category-filtered list, in two
  // separate Documents tabs with two different counters.
  const wsSupportDocs = integrationEnabled ? getSupportingDocs(ws.id, showDocArchived) : [];
  const visibleSupportDocs = filterSupportingDocs(wsSupportDocs, supportDocFilter);

  // ── Undo countdown timer (local window; starts only after confirmed,
  //     rehydrated stage advance) ──
  const startUndoTimer = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setShowUndoBanner(true);
    const tick = () => {
      const started = lastAdvanceAtRef.current;
      const remainingMs = started === null ? 0 : UNDO_WINDOW_MS - (Date.now() - started);
      if (remainingMs <= 0) {
        setShowUndoBanner(false);
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        return;
      }
      setUndoCountdown(Math.ceil(remainingMs / 1000));
    };
    tick();
    undoTimerRef.current = setInterval(tick, 1000);
  };

  // ── Stage transition handlers ──
  const handleAdvanceStage = () => {
    setTransitionResult(null); setConfirmInput(""); setOverrideReason(""); setShowConfirm(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const executeTransition = async () => {
    // SC-01 ruling R5 (SX-007/SX-011): SLA checklist and delta gates are
    // absent in this build and never block manual stage movement.
    // Boundary correction: persistence is AWAITED — success and audit history
    // are reported only after Supabase confirms the write; failures surface
    // honestly and database truth is untouched (no local state to restore).

    setShowConfirm(false);
    const result = advanceStage(ws.stage);
    setConfirmInput(""); setOverrideReason("");
    if (!result.success) {
      setTransitionResult(result);
      toast.error("Stage advance not possible", { description: result.message });
      return;
    }
    // Persist, then REHYDRATE from Supabase so the displayed tracker and any
    // subsequent Undo operate on the persisted stage, not the stale cached
    // object. Success, audit history and the undo window come last, and only
    // on `confirmed`. A failed refresh yields no success message and no Undo.
    const outcome = await finalizeStageAdvance({
      persist: async () => !!(await updateWorkspaceDB(ws.id, { stage: result.nextStage!, daysInStage: 0 } as any)),
      refetch: refetchWs,
    });
    if (outcome.status === "not_persisted") {
      toast.error("Stage advance NOT saved", { description: outcome.message });
      return;
    }
    if (outcome.status === "persisted_not_refreshed") {
      toast.warning("Stage saved, but the page could not refresh", { description: outcome.message });
      return;
    }
    setTransitionResult(result);
    logAuditAction("workspace", ws.id, "stage_advanced", getCurrentUser().id, getCurrentUser().name,
      `${getStageDisplayName(result.fromStage)} → ${getStageDisplayName(result.nextStage!)}`);
    toast.success(result.message, {
      description: `${getStageDisplayName(result.fromStage)} → ${getStageDisplayName(result.nextStage!)}`,
    });
    lastAdvanceAtRef.current = Date.now();
    startUndoTimer();
  };

  const handleUndo = async () => {
    const result = revertStage(ws.stage);
    if (!result.success) {
      toast.error("Undo not possible", { description: result.message });
      return;
    }
    // Undo acts on `ws.stage`, which is the value rehydrated from Supabase by
    // the advance that opened this window — never on an optimistic local value.
    const outcome = await finalizeStageAdvance({
      persist: async () => !!(await updateWorkspaceDB(ws.id, { stage: result.nextStage!, daysInStage: 0 } as any)),
      refetch: refetchWs,
    });
    if (outcome.status === "not_persisted") {
      toast.error("Stage revert NOT saved", { description: outcome.message });
      return;
    }
    lastAdvanceAtRef.current = null;
    if (outcome.status === "persisted_not_refreshed") {
      toast.warning("Stage reverted, but the page could not refresh", { description: outcome.message });
      setShowUndoBanner(false); setTransitionResult(null);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      return;
    }
    logAuditAction("workspace", ws.id, "stage_reverted", getCurrentUser().id, getCurrentUser().name, result.message);
    toast.success("Stage reverted", { description: result.message });
    setShowUndoBanner(false); setTransitionResult(null);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
  };

  const dismissResult = () => setTransitionResult(null);
  const requiredConfirmText = nextStage ? getStageDisplayName(nextStage) : "";
  const confirmMatch = confirmInput.trim().toLowerCase() === requiredConfirmText.toLowerCase();
  const canConfirm = isStrictMode
    ? (confirmMatch && !hasWarnings)
    : (confirmMatch && (!hasWarnings || overrideReason.trim().length > 0));

  // ── New Document (with template picker) ──

  // ── Delete Draft Document ──


  // ── Handle supporting doc upload ──
  // The success message waits for the CONFIRMED stored row. Previously the
  // insert was fire-and-forget and the toast fired immediately, so a failure
  // arrived as a second toast after the human had been told it worked.
  const handleSupportDocUpload = async () => {
    const name = supportUploadName.trim();
    if (!name) { toast.error("Name is required"); return; }
    const result = await uploadSupportingDoc({
      workspaceId: ws.id,
      name,
      fileName: `${name.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      category: supportUploadCategory,
      isRequired: supportUploadRequired,
    });
    forceUpdate(n => n + 1);
    if (!result.ok) {
      toast.error(`Supporting doc "${name}" NOT saved`, { description: result.message });
      return;
    }
    toast.success(`Supporting doc "${name}" saved`, { description: result.message });
    setSupportUploadName(""); setSupportUploadCategory("Other"); setSupportUploadRequired(false);
    setShowSupportUpload(false);
  };

  // Archive / restore also report only what the database confirmed.
  const handleSupportDocArchive = async (docId: string, docName: string) => {
    const result = await archiveSupportingDoc(docId);
    forceUpdate(n => n + 1);
    if (!result.ok) { toast.error(`"${docName}" NOT archived`, { description: result.message }); return; }
    toast.success(`"${docName}" archived`, { description: result.message });
  };
  const handleSupportDocRestore = async (docId: string, docName: string) => {
    const result = await restoreSupportingDoc(docId);
    forceUpdate(n => n + 1);
    if (!result.ok) { toast.error(`"${docName}" NOT restored`, { description: result.message }); return; }
    toast.success(`"${docName}" restored`, { description: result.message });
  };


  return (
    <TooltipProvider>
    <div className="p-3 md:p-6 max-w-[1400px] mx-auto min-w-0">
        {/* ═══ HEADER ═══ */}
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <Link href={cleanHref("/workspaces/proposals")}><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
          <div className="min-w-0 flex-1">
            {/* Opportunity Type Heading */}
            {isCommercial && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#075eea] mb-1">Proposal Opportunity</p>
            )}
            {isTender && (
              <p className="text-[11px] font-bold uppercase tracking-widest text-red-600 mb-1">Tender Opportunity</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <div className={`rag-dot ${ws.ragStatus === "red" ? "rag-dot-red" : ws.ragStatus === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
              <h1 className="text-xl font-serif font-bold">{ws.customerName}</h1>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${getWorkspaceTypeBadgeColor(wsType)}`}>
                {getWorkspaceTypeLabel(wsType)}
              </Badge>
              {isCommercial && (
                crmStageRecorded ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">
                    CRM: {getCrmStageLabel(crmPipelineStage)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700"
                    title="crm_pipeline_stage is empty on this commercial ticket.">
                    CRM: not recorded
                  </Badge>
                )
              )}
              {isCommercial && (
                trackerHydration.state === "persisted" ? (
                  <Badge variant="outline" className="text-[10px] border-[#075eea]/20 bg-[#075eea]/10 text-[#075eea]">
                    Internal: {getProposalStageLabel(proposalStage)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700"
                    title={trackerHydration.message ?? "The saved internal stage has not been read yet."}>
                    Internal: {trackerHydration.state === "loading" ? "reading…" : "not recorded"}
                  </Badge>
                )
              )}
              {!isCommercial && (
                <Badge variant="outline" className={`text-xs ${getEffectiveStageColor(ws)}`}>{getEffectiveStageLabel(ws)}</Badge>
              )}
              <CRMSyncBadge workspaceId={ws.id} workspaceTitle={ws.title} variant="badge" />
              {ws.crmDealId && <span className="text-xs text-muted-foreground data-value">CRM: {ws.crmDealId}</span>}
              {isTender && ws.submissionDeadline && (
                <span className="text-xs text-muted-foreground">Deadline: <span className="font-medium data-value">{ws.submissionDeadline}</span></span>
              )}
              {latestOverride && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] border-amber-400 bg-amber-50 text-amber-800 cursor-help gap-1">
                      <ShieldOff className="w-3 h-3" /> Governance Override Applied
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm p-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold">Override Details</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Reason:</span><span className="font-medium">{latestOverride.overrideReason}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Approver:</span><span className="font-medium">{latestOverride.userName}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Transition:</span><span className="font-medium">{getStageDisplayName(latestOverride.fromStage)} → {getStageDisplayName(latestOverride.toStage)}</span></div>
                        <div className="flex gap-2"><span className="text-muted-foreground shrink-0">Rules:</span><span className="font-medium">{latestOverride.overriddenRules.join(", ")}</span></div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{ws.title}</p>
          </div>
          {/* Advance button — only for non-commercial. Commercial uses CRM strip + Proposal strip buttons. */}
          {!isCommercial && (
            <Button variant="outline" size="sm" onClick={handleAdvanceStage} disabled={!nextStage} data-advance-stage-btn>
              <ChevronRight className="w-3.5 h-3.5 mr-1" />
              {nextStage ? `Advance to ${getStageDisplayName(nextStage)}` : "Final Stage"}
            </Button>
          )}
        </div>

        {/* ═══ CONFIRMATION MODAL ═══ */}
        {showConfirm && nextStage && (
          <div className="mb-4 rounded-lg border-2 border-amber-300/60 bg-amber-50/80 overflow-hidden">
            <div className="px-5 py-3 bg-amber-100/60 border-b border-amber-200/60 flex items-center gap-2.5">
              <ShieldAlert className="w-4.5 h-4.5 text-amber-600 shrink-0" />
              <span className="text-sm font-semibold text-amber-900">Stage Transition — Governance Check</span>
              {isStrictMode && <Badge variant="outline" className="text-[9px] border-red-300 text-red-700 ml-auto">STRICT MODE</Badge>}
              {!isStrictMode && hasWarnings && <Badge variant="outline" className="text-[9px] border-amber-400 text-amber-700 ml-auto">SOFT GOVERNANCE</Badge>}
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-md border border-border bg-background p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">From Stage</p>
                  <p className="text-sm font-semibold">{getStageDisplayName(ws.stage)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="flex-1 rounded-md border-2 border-dashed border-amber-300 bg-amber-50 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-medium mb-1">To Stage</p>
                  <p className="text-sm font-semibold text-amber-900">{getStageDisplayName(nextStage)}</p>
                </div>
              </div>

              {preflightFailures.length > 0 && (
                <div className={`rounded-md border p-3 ${isStrictMode ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50/60"}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className={`w-3.5 h-3.5 ${isStrictMode ? "text-red-500" : "text-amber-600"}`} />
                    <span className={`text-xs font-semibold ${isStrictMode ? "text-red-800" : "text-amber-800"}`}>
                      {isStrictMode ? "Validation Errors (Hard Block)" : "Validation Warnings (Override Available)"}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {preflightFailures.map((f, i) => (
                      <li key={i} className={`text-xs flex items-start gap-1.5 ${isStrictMode ? "text-red-700" : "text-amber-800"}`}>
                        <span className={`mt-0.5 ${isStrictMode ? "text-red-400" : "text-amber-500"}`}>•</span>
                        <span><span className="font-medium">[{f.ruleName}]</span> {f.error}</span>
                      </li>
                    ))}
                  </ul>
                  {!isStrictMode && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-100/60 rounded px-2 py-1.5">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>Soft governance mode is active. You may override these warnings by providing a reason below.</span>
                    </div>
                  )}
                </div>
              )}

              {hasWarnings && !isStrictMode && (
                <div>
                  <label className="text-xs font-medium text-amber-800 block mb-1.5">
                    Override Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Provide justification for overriding the validation warnings..."
                    className="w-full h-16 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                  Type <span className="font-bold text-foreground">"{requiredConfirmText}"</span> to confirm
                </label>
                <Input ref={inputRef} value={confirmInput} onChange={e => setConfirmInput(e.target.value)}
                  placeholder={requiredConfirmText} className="h-9 text-sm font-mono"
                  onKeyDown={e => { if (e.key === "Enter" && canConfirm) { e.preventDefault(); executeTransition(); } }} />
              </div>

              {isStrictMode && hasWarnings && confirmMatch && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700"><span className="font-semibold">Strict governance mode is active.</span> Resolve all issues before advancing.</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => { setShowConfirm(false); setConfirmInput(""); setOverrideReason(""); }} className="text-xs h-8">Cancel</Button>
                <Button size="sm" onClick={executeTransition} disabled={!canConfirm}
                  className={`text-xs h-8 ${hasWarnings && !isStrictMode && overrideReason.trim() ? "bg-amber-700 hover:bg-amber-800" : "bg-[#1B2A4A] hover:bg-[#2A3F6A]"} disabled:opacity-40`}>
                  {hasWarnings && !isStrictMode && overrideReason.trim()
                    ? <><ShieldOff className="w-3.5 h-3.5 mr-1" />Confirm with Override</>
                    : <><ShieldCheck className="w-3.5 h-3.5 mr-1" />Confirm Advance</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ UNDO BANNER ═══ */}
        {showUndoBanner && transitionResult?.success && (
          <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${transitionResult.governanceOverride ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 ${transitionResult.governanceOverride ? "text-amber-600" : "text-emerald-600"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${transitionResult.governanceOverride ? "text-amber-800" : "text-emerald-800"}`}>
                {transitionResult.governanceOverride ? "Stage Advanced (Governance Override)" : "Stage Advanced Successfully"}
              </p>
              <p className={`text-xs mt-0.5 ${transitionResult.governanceOverride ? "text-amber-700" : "text-emerald-700"}`}>{transitionResult.message}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`flex items-center gap-1.5 text-xs ${transitionResult.governanceOverride ? "text-amber-700" : "text-blue-700"}`}>
                <Timer className="w-3.5 h-3.5" />
                <span className="data-value font-medium">{Math.floor(undoCountdown / 60)}:{String(undoCountdown % 60).padStart(2, "0")}</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleUndo}
                className={`text-xs h-8 ${transitionResult.governanceOverride ? "border-amber-300 text-amber-700 hover:bg-amber-100" : "border-blue-300 text-blue-700 hover:bg-blue-100"}`}>
                <Undo2 className="w-3.5 h-3.5 mr-1" /> Undo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowUndoBanner(false); setTransitionResult(null); }} className="text-xs h-7">Dismiss</Button>
            </div>
          </div>
        )}

        {/* ═══ BLOCKED RESULT ═══ */}
        {transitionResult && !transitionResult.success && (
          <div className="mb-4 p-4 rounded-lg border border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">Stage Advance Blocked</p>
                <p className="text-xs mt-0.5 text-red-700">{transitionResult.message}</p>
                {transitionResult.validationErrors.length > 1 && (
                  <ul className="mt-2 space-y-1">
                    {transitionResult.validationErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">•</span> {err.error}</li>
                    ))}
                  </ul>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={dismissResult} className="text-xs h-7 shrink-0">Dismiss</Button>
            </div>
          </div>
        )}

        {/* ═══ STAGE PIPELINE (type-aware — commercial uses dual-tracker) ═══ */}
        {isCommercial ? (
          <>
          {/* ═══ TOP TRACKER: CRM PIPELINE STAGE (10 stages) ═══ */}
          <CrmPipelineStrip
            activeCrmStage={crmPipelineStage}
            crmDealId={ws.crmDealId}
            onCrmStageChange={handleCrmStageChange}
            saving={trackerSaving === "crm"}
          />

          {/* ═══ SECOND TRACKER: INTERNAL PROPOSAL TRACKER (11 stages) ═══ */}
          <ProposalTrackerStrip
            activeStage={proposalStage}
            onStageChange={handleProposalStageChange}
            hydration={trackerHydration}
            onRetryHydration={() => setTrackerReloadKey(key => key + 1)}
            saving={trackerSaving === "internal"}
          />
          </>
        ) : (
          /* ── Tender / Renewal strip (unchanged) ── */
          <Card className="border border-border shadow-none mb-6"><CardContent className="py-4 px-6">
            <div className="flex items-center gap-1 overflow-x-auto">
              {effectiveStages.map((s, i) => (
                <div key={s.value} className="flex items-center">
                  <div className={`px-2.5 py-1 rounded text-[10px] font-medium whitespace-nowrap ${i <= effectiveStageIdx ? "bg-primary text-primary-foreground" : i === effectiveStageIdx + 1 ? "bg-muted text-muted-foreground border border-dashed border-primary/30" : "bg-muted text-muted-foreground/50"}`}>{s.label}</div>
                  {i < effectiveStages.length - 1 && <div className={`w-4 h-px mx-0.5 ${i < effectiveStageIdx ? "bg-primary" : "bg-border"}`} />}
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}


        {/* ═══ PROPOSAL STAGE WORKBENCH ═══ */}
        {isCommercial && (
          <ProposalStageWorkbench
            activeProposal={activeProposalIdentity}
            activeStage={proposalStage}
            workspaceId={ws.id}
            customerName={ws.customerName}
            wsData={proposalWsData}
            onWsDataChange={updateProposalWsData}
            onNavigateToComposer={() => navigate(cleanHref(`/proposals/${activeProposalIdentity?.proposalId ?? id}/final-pack`))}
          />
        )}

        {/* ═══ TENDER/RENEWAL: KPI CARDS (unchanged) ═══ */}
        {!isCommercial && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {(isTender ? [
              { label: "Est. Value", value: formatSAR(ws.estimatedValue) },
              { label: "Target GP%", value: formatPercent(ws.gpPercent), color: ws.gpPercent >= 22 ? "rag-green" : ws.gpPercent >= 10 ? "rag-amber" : "rag-red" },
              { label: "Probability", value: `${ws.probabilityPercent ?? 0}%` },
              { label: "Deadline", value: ws.submissionDeadline || "—" },
              { label: "Region", value: ws.region },
              { label: "Owner", value: ws.owner },
            ] : [
              { label: "Est. Value", value: formatSAR(ws.estimatedValue) },
              { label: "GP%", value: formatPercent(ws.gpPercent), color: ws.gpPercent >= 22 ? "rag-green" : ws.gpPercent >= 10 ? "rag-amber" : "rag-red" },
              { label: "Pallets", value: ws.palletVolume.toLocaleString() },
              { label: "Days in Stage", value: String(ws.daysInStage), color: ws.daysInStage > 14 ? "rag-red" : ws.daysInStage > 7 ? "rag-amber" : undefined },
              { label: "Region", value: ws.region },
              { label: "Owner", value: ws.owner },
            ]).map(kpi => (
              <Card key={kpi.label} className="border border-border shadow-none"><CardContent className="p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className={`data-value text-lg font-semibold mt-0.5 ${kpi.color || ""}`}>{kpi.value}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* CONTRACT & RENEWAL STRIP (renewal/non-tender only — removed from commercial) */}
          {integrationEnabled && activeCycle && (
            <Card className={`border shadow-none mb-6 ${inRenewalWindow ? "border-orange-300 bg-orange-50/30" : daysToExpiry !== null && daysToExpiry <= 120 ? "border-amber-200 bg-amber-50/20" : "border-border"}`}>
              <CardContent className="py-3 px-5">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract Cycle</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">Cycle #{activeCycle.cycleNumber}</span>
                    <Badge variant="outline" className={`text-[10px] ${cycleStatusConfig[activeCycle.status]?.color || ""}`}>
                      {cycleStatusConfig[activeCycle.status]?.label || activeCycle.status}
                    </Badge>
                  </div>
                  {activeCycle.endDate && (
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase">SLA Expiry</span>
                        <p className="text-sm font-medium data-value">{activeCycle.endDate}</p>
                      </div>
                      {daysToExpiry !== null && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase">Days Left</span>
                          <p className={`text-sm font-bold ${daysToExpiry <= 30 ? "text-red-600" : daysToExpiry <= 90 ? "text-amber-600" : "text-emerald-600"}`}>
                            {daysToExpiry > 0 ? daysToExpiry : "Expired"}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase">Renewal Window</span>
                        <p className={`text-sm font-medium ${inRenewalWindow ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>
                          {inRenewalWindow ? "OPEN" : daysToExpiry !== null && daysToExpiry <= 0 ? "Expired" : "Closed"}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Renewal Owner:</span>
                    <Select value={activeCycle.renewalOwnerId || "unassigned"} onValueChange={(val) => { const member = teamMembers.find(m => m.id === val); if (member) { updateRenewalOwner(activeCycle.id, member.id, member.name); forceUpdate(n => n + 1); toast.success(`Renewal owner changed to ${member.name}`); } }}>
                      <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{teamMembers.map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  {inRenewalWindow && activeCycle.status !== "renewal_in_progress" && (
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-xs h-7 ml-auto" disabled>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Start Renewal
                    </Button>
                  )}
                  {activeCycle.status === "renewal_in_progress" && (
                    <Badge variant="outline" className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 ml-auto"><RefreshCw className="w-3 h-3 mr-1" /> Renewal In Progress</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SIGNALS (tender/renewal — unchanged) */}
          {wsSignals.length > 0 && <div className="mb-6 space-y-2">
            {wsSignals.map(sig => (
              <div key={sig.id} className={`flex items-start gap-3 p-3 rounded-lg border ${sig.severity === "red" ? "border-[var(--color-rag-red)]/20 bg-red-50" : sig.severity === "amber" ? "border-[var(--color-rag-amber)]/20 bg-amber-50" : "border-[var(--color-rag-green)]/20 bg-green-50"}`}>
                <div className={`rag-dot mt-1.5 shrink-0 ${sig.severity === "red" ? "rag-dot-red" : sig.severity === "amber" ? "rag-dot-amber" : "rag-dot-green"}`} />
                <div>
                  <p className="text-sm font-medium">{sig.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sig.message}</p>
                </div>
              </div>
            ))}
          </div>}
        </>}

        {/* ═══ TABS (type-aware — commercial uses decision-domain tabs) ═══ */}
        {/* SC-01 W04 (T08-B correction pass): this list used to carry
            `className={isCommercial ? "hidden" : ""}`. `isCommercial` is
            unconditionally true on /proposals/:id — the workspace mapper in
            lib/supabase-data.ts stamps every proposal ticket `type:"commercial"`
            — so the nine commercial tabs below were reachable only by typing a
            `?tab=` deep link. They are clickable again; no tab content changed. */}
        <Tabs defaultValue={initialTab} className="space-y-4">
          <TabsList className={isCommercial ? "flex flex-wrap h-auto gap-1 justify-start" : ""}>
            <TabsTrigger value="overview" className={isCommercial ? "rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm" : ""}>Overview</TabsTrigger>
            {isTender ? (
              /* Tender workspace tabs */
              <>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </>
            ) : isCommercial ? (
              /* ── Commercial decision-domain tabs ── */
              <>
                <TabsTrigger value="quote_control" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Quote Control</TabsTrigger>
                <TabsTrigger value="proposal_control" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Proposals</TabsTrigger>
                <TabsTrigger value="sla_control" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">SLA</TabsTrigger>
                <TabsTrigger value="commercial" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Commercial</TabsTrigger>
                <TabsTrigger value="delivery" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Delivery</TabsTrigger>
                <TabsTrigger value="customer_tab" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Customer</TabsTrigger>
                <TabsTrigger value="documents" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Documents</TabsTrigger>
                <TabsTrigger value="activity" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Activity</TabsTrigger>
                <TabsTrigger value="audit" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">Audit Trail</TabsTrigger>
              </>
            ) : (
              /* Renewal / other workspace tabs */
              <>
                {navigationV1 ? (
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                ) : (
                  <>
                    <TabsTrigger value="quotes">Quotes ({wsQuotes.length})</TabsTrigger>
                    <TabsTrigger value="proposals">Proposals ({scopedWsProposals.length})</TabsTrigger>
                    <TabsTrigger value="slas">SLAs ({wsSLAs.length})</TabsTrigger>
                  </>
                )}
                {navigationV1 && <TabsTrigger value="commercial">Commercial</TabsTrigger>}
                {navigationV1 && <TabsTrigger value="contracts">Contracts</TabsTrigger>}
                <TabsTrigger value="approvals">Approvals</TabsTrigger>
                {navigationV1 && currentStageIdx >= WORKSPACE_STAGES.findIndex(s => s.value === "contract_signed") && (
                  <TabsTrigger value="handover">Handover</TabsTrigger>
                )}
                {!navigationV1 && <TabsTrigger value="documents">{integrationEnabled ? "Supporting Docs" : "Documents"}</TabsTrigger>}
                <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ═══ OVERVIEW TAB (commercial) ═══
              The commercial overview surface is the CRM strip, the internal
              tracker and the stage workbench rendered ABOVE this tab bar. This
              panel therefore only restates the ticket's own recorded fields and
              says where the rest of the work lives — it asserts nothing that is
              not stored on the commercial_tickets row. */}
          {isCommercial && (
            <TabsContent value="overview">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" /> Recorded On This Proposal
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-[10px] text-muted-foreground uppercase">Title</p><p className="text-sm font-medium mt-0.5">{ws.title || <span className="text-muted-foreground">Not recorded</span>}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Owner</p><p className="text-sm font-medium mt-0.5">{ws.owner || <span className="text-muted-foreground">Not recorded</span>}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Commercial Ticket</p><p className="text-sm font-medium mt-0.5 font-mono text-xs">{ws.crmDealId || <span className="font-sans text-sm text-muted-foreground">Not linked</span>}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Est. Value</p><p className="text-sm font-medium mt-0.5 data-value">{formatSAR(ws.estimatedValue)}</p></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The CRM stage, the internal proposal stage and the stage workbench for this proposal
                    are shown above the tabs. The tabs cover quotes, proposals, SLA, commercial, delivery,
                    customer, documents, activity and audit.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ═══ OVERVIEW TAB (tender / renewal) ═══ */}
          {!isCommercial && (
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Customer Info</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {customer ? [
                    { l: "Code", v: customer.code }, { l: "Industry", v: customer.industry },
                    { l: "Grade", v: customer.grade }, { l: "Service Type", v: customer.serviceType },
                    { l: "Contract Expiry", v: customer.contractExpiry },
                    { l: "DSO", v: customerRisk.dsoDays === null ? null : `${customerRisk.dsoDays} days` },
                    { l: "Payment Status", v: customer.paymentStatus }, { l: "Account Owner", v: customer.accountOwner },
                  ].map(r => (
                    <div key={r.l} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{r.l}</span>
                      {r.v ? <span className="font-medium data-value">{r.v}</span> : <span className="text-muted-foreground/70">Not recorded</span>}
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">{customerUnavailableNote}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-base font-serif">Approval Requirements</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">Based on GP% of {formatPercent(ws.gpPercent)} and {ws.palletVolume.toLocaleString()} pallets</p>
                  {approvalReqs.map((req, i) => {
                    const existing = wsApprovals.find(a => a.approverRole === req.role);
                    return <div key={i} className="flex items-center justify-between p-2 rounded border border-border">
                      <div><span className="text-sm font-medium">{getRoleLabel(req.role)}</span><span className="text-xs text-muted-foreground ml-2">({req.type})</span></div>
                      <Badge variant={existing?.decision === "approved" ? "default" : existing?.decision === "pending" ? "secondary" : "outline"} className="text-[10px]">{existing?.decision || "not started"}</Badge>
                    </div>;
                  })}
                </CardContent>
              </Card>
            </div>
            <Card className="border border-border shadow-none mt-6"><CardHeader className="pb-3"><CardTitle className="text-base font-serif">Notes</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-sm text-muted-foreground">{ws.notes}</p></CardContent></Card>
          </TabsContent>
          )}

          {/* ═══ QUOTE CONTROL TAB (CW-001) ═══ */}
          {isCommercial && (
            <TabsContent value="quote_control">
              <CommercialQuoteControlTab workspaceId={ws.id} customerName={ws.customerName} gpPercent={ws.gpPercent} estimatedValue={ws.estimatedValue} />
            </TabsContent>
          )}

          {/* ═══ PROPOSAL CONTROL TAB (CW-008) ═══ */}
          {isCommercial && (
            <TabsContent value="proposal_control">
              <CommercialProposalControlTab workspaceId={ws.id} customerName={ws.customerName} />
            </TabsContent>
          )}

          {/* ═══ SLA CONTROL TAB (CW-009) ═══ */}
          {isCommercial && (
            <TabsContent value="sla_control">
              <CommercialSlaControlTab workspaceId={ws.id} customerName={ws.customerName} />
            </TabsContent>
          )}

          {/* ═══ COMMERCIAL TAB (commercial decision-domain) ═══ */}
          {isCommercial && (
            <TabsContent value="commercial">
              {(() => {
                const sub = deriveSubLifecycleStates(ws, wsQuotes, scopedWsProposals, wsSLAs);
                const latestQuote = wsQuotes.length > 0 ? wsQuotes[wsQuotes.length - 1] : null;
                const grossProfit = ws.estimatedValue * (ws.gpPercent / 100);
                return (
                  <div className="space-y-6">
                    {/* Pricing Summary */}
                    <Card className="border border-border shadow-none">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-muted-foreground" /> Pricing Summary</CardTitle></CardHeader>
                      <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                          <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated Value</p>
                            <p className="text-lg font-bold mt-0.5">{formatSAR(ws.estimatedValue)}</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">GP%</p>
                            <p className={`text-lg font-bold mt-0.5 ${ws.gpPercent >= 22 ? "text-emerald-600" : ws.gpPercent >= 10 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(ws.gpPercent)}</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Est. Gross Profit</p>
                            <p className="text-lg font-bold mt-0.5">{formatSAR(grossProfit)}</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Pallets</p>
                            <p className="text-lg font-bold mt-0.5">{ws.palletVolume.toLocaleString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Approval Status — collapsed by default */}
                    {(() => {
                      const approvedCount = approvalReqs.filter(r => wsApprovals.find(a => a.approverRole === r.role && a.decision === "approved")).length;
                      const pendingCount = approvalReqs.filter(r => wsApprovals.find(a => a.approverRole === r.role && a.decision === "pending")).length;
                      const totalCount = approvalReqs.length;
                      const summaryLabel = approvedCount === totalCount ? "Fully Approved" : pendingCount > 0 ? `${pendingCount} Pending` : "Not Started";
                      const summaryColor = approvedCount === totalCount ? "text-emerald-700" : pendingCount > 0 ? "text-amber-700" : "text-muted-foreground";
                      return (
                        <details className="border border-border rounded-lg">
                          <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 rounded-lg">
                            <span className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-muted-foreground" /> Approval Status</span>
                            <span className={`text-xs font-semibold ${summaryColor}`}>{summaryLabel} ({approvedCount}/{totalCount})</span>
                          </summary>
                          <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                            <p className="text-xs text-muted-foreground">Based on GP% of {formatPercent(ws.gpPercent)} and {ws.palletVolume.toLocaleString()} pallets</p>
                            {approvalReqs.map((req, i) => {
                              const existing = wsApprovals.find(a => a.approverRole === req.role);
                              return <div key={i} className="flex items-center justify-between p-2 rounded border border-border">
                                <div><span className="text-sm font-medium">{getRoleLabel(req.role)}</span><span className="text-xs text-muted-foreground ml-2">({req.type})</span></div>
                                <Badge variant={existing?.decision === "approved" ? "default" : existing?.decision === "pending" ? "secondary" : "outline"} className="text-[10px]">{existing?.decision || "not started"}</Badge>
                              </div>;
                            })}
                          </div>
                        </details>
                      );
                    })()}

                    {/* Document Sub-Lifecycle Cards */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /> Document Sub-Lifecycles</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Quote */}
                        <Card className="border border-border shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote</span>
                              {sub.quoteState ? (
                                <Badge variant="outline" className={`text-[10px] ${QUOTE_STATES.find(s => s.value === sub.quoteState)?.color}`}>
                                  {QUOTE_STATES.find(s => s.value === sub.quoteState)?.label}
                                </Badge>
                              ) : <span className="text-[10px] text-muted-foreground/50">Not started</span>}
                            </div>
                            {latestQuote ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">v{latestQuote.version}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{latestQuote.createdAt}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">GP%</span><span className={`font-medium ${latestQuote.gpPercent >= 22 ? "text-emerald-600" : latestQuote.gpPercent >= 10 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(latestQuote.gpPercent)}</span></div>
                              </div>
                            ) : <p className="text-xs text-muted-foreground/60 mt-1">No quote started yet. Create one when pricing is ready.</p>}
                          </CardContent>
                        </Card>

                        {/* Proposal */}
                        <Card className="border border-border shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposal</span>
                              {sub.proposalState ? (
                                <Badge variant="outline" className={`text-[10px] ${PROPOSAL_STATES.find(s => s.value === sub.proposalState)?.color}`}>
                                  {PROPOSAL_STATES.find(s => s.value === sub.proposalState)?.label}
                                </Badge>
                              ) : <span className="text-[10px] text-muted-foreground/50">Not started</span>}
                            </div>
                            {scopedWsProposals.length > 0 ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">v{scopedWsProposals[scopedWsProposals.length - 1].version}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Title</span><span className="font-medium truncate max-w-[150px]">{scopedWsProposals[scopedWsProposals.length - 1].title}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{scopedWsProposals[scopedWsProposals.length - 1].createdAt}</span></div>
                              </div>
                            ) : <p className="text-xs text-muted-foreground/60 mt-1">No proposal drafted yet. Typically starts after quoting.</p>}
                          </CardContent>
                        </Card>

                        {/* SLA */}
                        <Card className="border border-border shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SLA</span>
                              <Badge variant="outline" className={`text-[10px] ${SLA_STATES.find(s => s.value === sub.slaState)?.color}`}>
                                {SLA_STATES.find(s => s.value === sub.slaState)?.label}
                              </Badge>
                            </div>
                            {wsSLAs.length > 0 ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">v{wsSLAs[0].version}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{wsSLAs[0].status}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-medium">{wsSLAs[0].expiryDate}</span></div>
                              </div>
                            ) : <p className="text-xs text-muted-foreground/60 mt-1">SLA drafting begins after commercial approval.</p>}
                          </CardContent>
                        </Card>

                        {/* Handover */}
                        <Card className="border border-border shadow-none">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handover</span>
                              <Badge variant="outline" className={`text-[10px] ${HANDOVER_STATES.find(s => s.value === sub.handoverState)?.color}`}>
                                {HANDOVER_STATES.find(s => s.value === sub.handoverState)?.label}
                              </Badge>
                            </div>
                            {sub.handoverState !== "not_started" ? (
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium">{HANDOVER_STATES.find(s => s.value === sub.handoverState)?.label}</span></div>
                              </div>
                            ) : <p className="text-xs text-muted-foreground/60 mt-1">Handover initiates after contract signing.</p>}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          )}

          {/* ═══ DELIVERY TAB (commercial) ═══ */}
          {isCommercial && (
            <TabsContent value="delivery">
              <div className="space-y-6">
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /> Workspace Team</CardTitle></CardHeader>
                  <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Owner</p>
                        <p className="text-sm font-semibold mt-0.5">{ws.owner}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Region</p>
                        <p className="text-sm font-semibold mt-0.5">{ws.region}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Days in Stage</p>
                        <p className={`text-sm font-semibold mt-0.5 ${ws.daysInStage > 14 ? "text-red-600" : ws.daysInStage > 7 ? "text-amber-600" : ""}`}>{ws.daysInStage}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-muted-foreground" /> Operational Context</CardTitle></CardHeader>
                  <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pallet Volume</span><span className="font-medium">{ws.palletVolume.toLocaleString()}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Estimated Value</span><span className="font-medium">{formatSAR(ws.estimatedValue)}</span></div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">CRM Deal</span><span className="font-medium">{ws.crmDealId || "—"}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">CRM Stage</span><span className="font-medium">{ws.crmStage || "—"}</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ═══ RISK & SIGNALS TAB (commercial) ═══ */}
          {isCommercial && (
            <TabsContent value="risk_signals">
              <WorkspaceRiskSignalsTab
                workspaceId={ws.id}
                customerId={ws.customerId}
                contextLabel={ws.customerName || ws.title}
                derivedSignals={((): Array<{ label: string; detail: string; severity: "red" | "amber" | "green" }> => {
                  const s: Array<{ label: string; detail: string; severity: "red" | "amber" | "green" }> = [];
                  if (ws.gpPercent < 10) s.push({ label: "Margin Risk", detail: `GP ${formatPercent(ws.gpPercent)} — critical, CEO/CFO approval needed`, severity: "red" });
                  else if (ws.gpPercent < 22) s.push({ label: "Margin Risk", detail: `GP ${formatPercent(ws.gpPercent)} — tight, Director approval required`, severity: "amber" });
                  else s.push({ label: "Margin", detail: `GP ${formatPercent(ws.gpPercent)} — healthy`, severity: "green" });
                  if (ws.daysInStage > 14) s.push({ label: "Stage Stall", detail: `${ws.daysInStage}d in current stage — action needed`, severity: "red" });
                  else if (ws.daysInStage > 7) s.push({ label: "Stage Velocity", detail: `${ws.daysInStage}d in current stage — monitor`, severity: "amber" });
                  if (!ws.crmDealId) s.push({ label: "CRM Not Linked", detail: "Workspace not linked to CRM deal", severity: "amber" });
                  return s;
                })()}
              />
            </TabsContent>
          )}

          {/* ═══ CUSTOMER TAB (commercial — ECR + behavior + risk) ═══ */}
          {isCommercial && (
            <TabsContent value="customer_tab">
              {(() => {
                // SC-01 W04 (T08-B correction pass). Everything on this tab now
                // comes from the `customers` row that was actually read back.
                // What was removed and why:
                //   · the "Healthy customer profile" verdict — it was derived
                //     from a hardcoded paymentStatus:'Good'
                //   · the "0 days" DSO — hardcoded dso:0
                //   · the ECR score (92/78/55/35/10) — invented from the grade
                //     letter; no ECR score is stored for a customer here
                // A missing value renders "Not recorded"; a failed read says so.
                if (customerRead.loading) {
                  return (
                    <Card className="border border-border shadow-none">
                      <CardContent className="py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Reading the customer master record…
                      </CardContent>
                    </Card>
                  );
                }

                if (customerRead.status === "error") {
                  return (
                    <Card className="border border-red-200 bg-red-50/40 shadow-none">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-900">
                          <XCircle className="w-4 h-4 text-red-600" /> Customer record could not be read
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <p className="text-sm text-red-800/90">
                          The read of the <span className="font-mono text-xs">customers</span> row for this
                          proposal failed. No grade, DSO, payment behaviour or contract value is shown,
                          because none of it is known — this is not a statement that the customer has none.
                        </p>
                        <p className="rounded border border-red-200 bg-white/70 px-2 py-1.5 font-mono text-[11px] text-red-800">
                          {customerRead.message ?? "reason not reported"}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => setReadAttempt(n => n + 1)}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                        </Button>
                      </CardContent>
                    </Card>
                  );
                }

                if (!customer) {
                  return (
                    <div className="space-y-4">
                      <Card className="border border-amber-200 bg-amber-50/40 shadow-none">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-900">
                            <Info className="w-4 h-4 text-amber-600" /> No customer master record
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-amber-800/90">{customerUnavailableNote}</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-border shadow-none">
                        <CardContent className="p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Customer name on this proposal</p>
                          <p className="text-sm font-bold mt-0.5">{ws.customerName}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Recorded on the commercial ticket. It is not backed by a customer master row.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                }

                const notRecorded = <span className="text-sm font-normal text-muted-foreground">Not recorded</span>;
                const revenueTrend =
                  customer.revenue2025 === null || customer.revenue2024 === null
                    ? null
                    : customer.revenue2025 > customer.revenue2024 ? "↑ Growing"
                    : customer.revenue2025 === customer.revenue2024 ? "→ Flat"
                    : "↓ Declining";

                return (
                  <div className="space-y-6">
                    {/* Recorded risk readout — a verdict ONLY when both the
                        stored payment status and the stored DSO exist. */}
                    {customerRisk.verdict ? (
                      <div className={`p-3 rounded-lg border ${customerRisk.tone === "red" ? "border-red-200 bg-red-50" : customerRisk.tone === "amber" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`w-4 h-4 ${customerRisk.tone === "red" ? "text-red-600" : customerRisk.tone === "amber" ? "text-amber-600" : "text-emerald-600"}`} />
                          <span className={`text-sm font-semibold ${customerRisk.tone === "red" ? "text-red-800" : customerRisk.tone === "amber" ? "text-amber-800" : "text-emerald-800"}`}>
                            {customerRisk.verdict}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-border bg-muted/20">
                        <p className="text-sm text-muted-foreground">
                          No risk verdict is shown: this customer record has
                          {customerRisk.paymentRisk === null ? " no recorded payment status" : ""}
                          {customerRisk.paymentRisk === null && customerRisk.dsoDays === null ? " and" : ""}
                          {customerRisk.dsoDays === null ? " no recorded DSO" : ""}.
                        </p>
                      </div>
                    )}

                    {/* Identity — stored fields only */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</p>
                        <p className="text-sm font-bold mt-0.5">{customer.name ?? ws.customerName}</p>
                        <p className="text-[10px] text-muted-foreground">{customer.code ?? "code not recorded"} · {customer.industry ?? "industry not recorded"}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Grade</p>
                        <p className="text-sm font-bold mt-0.5">{customer.grade ?? notRecorded}</p>
                        <p className="text-[10px] text-muted-foreground">Stored customer grade</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">2025 Contract Value</p>
                        <p className="text-sm font-bold mt-0.5">{customer.contractValue2025 === null ? notRecorded : formatSAR(customer.contractValue2025)}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
                        <p className="text-sm font-bold mt-0.5">{customer.accountOwner ?? notRecorded}</p>
                        <p className="text-[10px] text-muted-foreground">{customer.serviceType ?? "service type not recorded"} · {customer.region ?? "region not recorded"}</p>
                      </div>
                    </div>

                    {/* Payment Behaviour — recorded values only */}
                    <Card className="border border-border shadow-none">
                      <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-muted-foreground" /> Payment Behaviour</CardTitle></CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className={`rounded-lg border p-3 ${customerRisk.paymentRisk === "High" ? "border-red-200 bg-red-50/60" : customerRisk.paymentRisk === "Medium" ? "border-amber-200 bg-amber-50/60" : customerRisk.paymentRisk === "Low" ? "border-emerald-200 bg-emerald-50/60" : "border-border bg-muted/20"}`}>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Payment Risk</p>
                            <p className={`text-sm font-bold mt-0.5 ${customerRisk.paymentRisk === "High" ? "text-red-700" : customerRisk.paymentRisk === "Medium" ? "text-amber-700" : customerRisk.paymentRisk === "Low" ? "text-emerald-700" : ""}`}>{customerRisk.paymentRisk ?? notRecorded}</p>
                            <p className="text-[10px] text-muted-foreground">{customer.paymentStatus ?? "no stored payment status"}</p>
                          </div>
                          <div className={`rounded-lg border p-3 ${customerRisk.dsoBand === "Critical" ? "border-red-200 bg-red-50/60" : customerRisk.dsoBand === "Watch" ? "border-amber-200 bg-amber-50/60" : "border-border bg-muted/20"}`}>
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">DSO</p>
                            <p className={`text-sm font-bold mt-0.5 ${customerRisk.dsoBand === "Critical" ? "text-red-700" : customerRisk.dsoBand === "Watch" ? "text-amber-700" : ""}`}>{customerRisk.dsoDays === null ? notRecorded : `${customerRisk.dsoDays} days`}</p>
                            <p className="text-[10px] text-muted-foreground">{customerRisk.dsoBand ?? "no stored DSO"}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Contract Expiry</p>
                            <p className="text-sm font-bold mt-0.5">{formatRecordedDate(customer.contractExpiry) ?? notRecorded}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-muted/20 p-3">
                            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue Trend</p>
                            <p className="text-sm font-bold mt-0.5">{revenueTrend ?? notRecorded}</p>
                            <p className="text-[10px] text-muted-foreground">{customer.revenue2025 === null ? "2025 revenue not recorded" : `${formatSAR(customer.revenue2025)} recorded for 2025`}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Identity-preserving link: the customers.id that was read
                        back travels with the navigation. It used to point at a
                        bare /customers, dropping the record the user was on. */}
                    <div className="flex items-center gap-3">
                      <Link href={cleanHref(`/customers?customerId=${encodeURIComponent(customer.id)}`)}>
                        <Button variant="outline" size="sm" className="text-xs">
                          <ExternalLink className="w-3 h-3 mr-1.5" /> Open in Customer Command Centre
                        </Button>
                      </Link>
                      <span className="text-[10px] text-muted-foreground font-mono">{customer.id}</span>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          )}

          {/* ═══ ACTIVITY TAB (CW-010) ═══ */}
          {isCommercial && (
            <TabsContent value="activity">
              <CommercialActivityTab workspaceId={ws.id} />
            </TabsContent>
          )}

          {/* ═══ COMMERCIAL TAB (navigationV1) ═══ */}
          {navigationV1 && (
            <TabsContent value="commercial">
              <div className="space-y-6">
                {/* Quote Section — Sprint 3 */}
                <WorkspaceQuoteSection workspaceId={ws.id} customerId={ws.customerId} customerName={ws.customerName} />

                {/* Proposal Section — Sprint 4 */}
                <WorkspaceProposalSection workspaceId={ws.id} customerId={ws.customerId} customerName={ws.customerName} />

                {/* SLA + Contract Section — Sprint 5 */}
                <WorkspaceSlaContractSection workspaceId={ws.id} customerId={ws.customerId} customerName={ws.customerName} quotes={wsQuotes} proposals={scopedWsProposals} />

                {/* Generated Documents — Sprint 6 */}
                <WorkspaceDocumentSection workspaceId={ws.id} quotes={wsQuotes} proposals={scopedWsProposals} />

                {/* P&L Calculator Link */}
                <Card className="border border-border shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <DollarSign className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">P&L Calculator</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Full profitability analysis for this workspace. Required before proposal creation.</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs"><span className="text-muted-foreground">Est. Revenue:</span> <span className="font-medium data-value">{formatSAR(ws.estimatedValue)}</span></span>
                            <span className="text-xs"><span className="text-muted-foreground">GP%:</span> <span className={`font-medium data-value ${ws.gpPercent >= 22 ? "text-emerald-600" : ws.gpPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(ws.gpPercent)}</span></span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs" disabled>
                        <ExternalLink className="w-3 h-3 mr-1" /> Open P&L
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* ECR View Link */}
                <Card className="border border-border shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                          <BarChart3 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">ECR — Customer Rating</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Enterprise customer rating and risk scoring for {ws.customerName}.</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs"><span className="text-muted-foreground">Grade:</span> <span className="font-medium">{customer?.grade ?? "Not recorded"}</span></span>
                            <span className="text-xs"><span className="text-muted-foreground">DSO:</span> <span className="font-medium data-value">{customerRisk.dsoDays === null ? "Not recorded" : `${customerRisk.dsoDays} days`}</span></span>
                            <span className="text-xs"><span className="text-muted-foreground">Payment:</span> <span className="font-medium">{customer?.paymentStatus ?? "Not recorded"}</span></span>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="text-xs" disabled>
                        <ExternalLink className="w-3 h-3 mr-1" /> Open ECR
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Pricing Snapshot */}
                <Card className={`border shadow-none ${pricingLocked ? "border-amber-300 bg-amber-50/20" : "border-border"}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-serif flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Pricing Snapshot
                        {pricingLocked && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50 ml-2"><ShieldAlert className="w-3 h-3 mr-1" />LOCKED</Badge>}
                      </CardTitle>
                      {pricingLocked && isAdminUser && (
                        <Button variant="outline" size="sm" className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => { setPricingOverrideField("pricing_snapshot"); setPricingOverrideOpen(true); }}>
                          <ShieldAlert className="w-3 h-3 mr-1" /> Admin Override
                        </Button>
                      )}
                    </div>
                    {pricingLocked && (
                      <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" /> {pricingLockReason}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {wsQuotes.length > 0 ? (
                      <div className="space-y-3">
                        {wsQuotes.map(q => (
                          <div key={q.id} className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-3 rounded-lg border border-border">
                            <div><p className="text-[10px] text-muted-foreground uppercase">Quote</p><p className="text-sm font-medium mt-0.5">v{q.version} <Badge variant="outline" className="text-[9px] ml-1">{q.state}</Badge></p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase">Storage Rate</p><p className="text-sm font-medium mt-0.5 data-value">SAR {q.storageRate}/pallet/day</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase">Monthly</p><p className="text-sm font-medium mt-0.5 data-value">{formatSAR(q.monthlyRevenue)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase">Annual</p><p className="text-sm font-medium mt-0.5 data-value">{formatSAR(q.annualRevenue)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase">GP%</p><p className={`text-sm font-medium mt-0.5 data-value ${q.gpPercent >= 22 ? "text-emerald-600" : q.gpPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(q.gpPercent)}</p></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No quotes created yet. Pricing data will appear here once quotes are generated.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Margin Metrics */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-serif flex items-center gap-2">
                      <Scale className="w-4 h-4" /> Margin Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div><p className="text-[10px] text-muted-foreground uppercase">Workspace GP%</p><p className={`text-lg font-bold mt-0.5 data-value ${ws.gpPercent >= 22 ? "text-emerald-600" : ws.gpPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(ws.gpPercent)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Est. Value</p><p className="text-lg font-bold mt-0.5 data-value">{formatSAR(ws.estimatedValue)}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Pallet Volume</p><p className="text-lg font-bold mt-0.5 data-value">{ws.palletVolume.toLocaleString()}</p></div>
                      <div><p className="text-[10px] text-muted-foreground uppercase">Approval Threshold</p><p className="text-sm font-medium mt-1">{ws.gpPercent < 15 ? "Commercial Director required" : ws.gpPercent < 22 ? "Regional Sales Head" : "Standard"}</p></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ═══ CONTRACTS TAB (navigationV1) ═══ */}
          {navigationV1 && (
            <TabsContent value="contracts">
              {activeCycle ? (
                <div className="space-y-4">
                  <Card className="border border-border shadow-none">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-serif flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> Contract Cycle #{activeCycle.cycleNumber}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div><p className="text-[10px] text-muted-foreground uppercase">Status</p><Badge variant="outline" className={`mt-1 text-[10px] ${cycleStatusConfig[activeCycle.status]?.color || ""}`}>{cycleStatusConfig[activeCycle.status]?.label || activeCycle.status}</Badge></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Start Date</p><p className="text-sm font-medium mt-0.5 data-value">{activeCycle.startDate}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">End Date</p><p className="text-sm font-medium mt-0.5 data-value">{activeCycle.endDate}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Days to Expiry</p><p className={`text-sm font-medium mt-0.5 data-value ${daysToExpiry !== null && daysToExpiry < 90 ? "text-red-600" : ""}`}>{daysToExpiry ?? "N/A"}</p></div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div><p className="text-[10px] text-muted-foreground uppercase">Annual Value</p><p className="text-sm font-medium mt-0.5 data-value">{formatSAR(wsQuotes[0]?.annualRevenue ?? 0)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Renewal Window</p><p className="text-sm font-medium mt-0.5">{activeCycle.renewalWindowDays} days</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Renewal Owner</p><p className="text-sm font-medium mt-0.5">{activeCycle.renewalOwnerName || "Unassigned"}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">In Renewal Window</p><p className="text-sm font-medium mt-0.5">{inRenewalWindow ? "Yes" : "No"}</p></div>
                      </div>
                      {/* Contract Ready Checks */}
                      {contractReadyChecks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs font-semibold mb-2">Contract Ready Checklist</p>
                          <div className="space-y-1.5">
                            {contractReadyChecks.map((check, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {check.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                <span className={check.passed ? "text-muted-foreground" : "font-medium"}>{check.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* SLA vs P&L Delta Banner */}
                  <SlaVsPnlDeltaBanner
                    workspace={ws}
                    quote={latestQuote}
                    pnl={wsPnL}
                    onDeltaComputed={setDeltaReport}
                  />
                  {/* SC-01 ruling R5: SLA verification checklist is not
                      available in this build (deferred to Sprint X - SX-007).
                      It never blocks manual work. */}
                  <Card className="border border-dashed border-border shadow-none">
                    <CardContent className="py-4 text-center">
                      <p className="text-xs text-muted-foreground">SLA verification checklist is not available in this build (deferred to Sprint X). Manual SLA work is unrestricted.</p>
                    </CardContent>
                  </Card>

                  {/* SLA Summary in Contracts */}
                  {wsSLAs.length > 0 && (
                    <Card className="border border-border shadow-none">
                      <CardHeader className="pb-3"><CardTitle className="text-sm font-serif">Linked SLAs</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y divide-border">
                          {wsSLAs.map(sla => {
                            const slaStatusColor = sla.status === "active" ? "bg-emerald-100 text-emerald-700" : sla.status === "draft" ? "bg-gray-100 text-gray-700" : sla.status === "expired" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
                            return (
                              <div key={sla.id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <FileSignature className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{sla.title}</span>
                                  <Badge variant="outline" className={`text-[10px] ${slaStatusColor}`}>{sla.status}</Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">Expires: {sla.expiryDate}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Renewal Link */}
                  <Card className="border border-border shadow-none hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#075eea]/10 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-[#075eea]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold">Renewal Engine</h4>
                            <p className="text-xs text-muted-foreground">View renewal pipeline, policy gates, and revenue exposure for this contract.</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate(cleanHref("/workspaces/renewals"))}>
                            <ExternalLink className="w-3 h-3 mr-1" /> Renewals
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" disabled>
                            Policy Gates
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs" disabled>
                            Revenue Exposure
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Handover Link (if stage >= contract_signed) */}
                  {currentStageIdx >= WORKSPACE_STAGES.findIndex(s => s.value === "contract_signed") && (
                    <Card className="border border-border shadow-none hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-lime-50 flex items-center justify-center">
                              <Truck className="w-5 h-5 text-lime-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold">Handover</h4>
                              <p className="text-xs text-muted-foreground">Post-signature handover workflow — legal, finance, ops, training, go-live.</p>
                            </div>
                          </div>
                           <Button variant="outline" size="sm" className="text-xs" disabled>
                            <ExternalLink className="w-3 h-3 mr-1" /> Open Handover
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card className="border border-border shadow-none">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    <CalendarClock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    No contract cycle created yet.
                    <p className="text-xs mt-1">Contract cycles are created when the workspace reaches the Contract Ready stage.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ═══ LEGACY QUOTES TAB (non-navigationV1) ═══ */}

          {/* ═══ APPROVALS TAB ═══ */}
          <TabsContent value="approvals">
            {/* Missing approvals banner */}
            {wsApprovals.length > 0 && approvalReqs.some(req => !wsApprovals.find(a => a.approverRole === req.role && a.decision === "approved")) && (
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Approval records are incomplete</p>
                  <p className="text-xs text-amber-700 mt-0.5">Some approval records are pending or not started. This is information only and does not stop manual work.</p>
                </div>
              </div>
            )}
            {wsApprovals.length > 0 ? <div className="space-y-2">{wsApprovals.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{a.approverName}</span><span className="text-xs text-muted-foreground">({getRoleLabel(a.approverRole)})</span></div>
                  {a.reason && <p className="text-xs text-muted-foreground mt-1 ml-6">{a.reason}</p>}
                </div>
                <div className="text-right">
                  <Badge variant={a.decision === "approved" ? "default" : a.decision === "rejected" ? "destructive" : "secondary"} className="text-[10px]">{a.decision}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatRecordedDate(a.timestamp) ?? "date not recorded"}</p>
                </div>
              </div>
            ))}</div> : <Card className="border border-border shadow-none"><CardContent className="py-12 text-center text-sm text-muted-foreground">No approval records yet</CardContent></Card>}

            {/* Global Approvals Link */}
            {navigationV1 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Need to review all pending approvals across all workspaces?</p>
                   <Button variant="outline" size="sm" className="text-xs" disabled>
                    <ExternalLink className="w-3 h-3 mr-1" /> Global Approvals
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ HANDOVER TAB (navigationV1, stage >= contract_signed) ═══ */}
          {navigationV1 && currentStageIdx >= WORKSPACE_STAGES.findIndex(s => s.value === "contract_signed") && (
            <TabsContent value="handover">
              <div className="space-y-6">
                {/* Handover Status */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-serif flex items-center gap-2">
                        <Truck className="w-4 h-4" /> Handover Workflow
                      </CardTitle>
                       <Button variant="outline" size="sm" className="text-xs" disabled>
                        <ExternalLink className="w-3 h-3 mr-1" /> Full Handover View
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* SC-01 W04 (T08-B correction pass): these six steps used to
                        carry Complete / Pending badges. Three were flipped to
                        "Complete" purely because ws.stage === "go_live", and the
                        other three were hardcoded "Pending". No handover task is
                        read for this proposal, so no step status is asserted. */}
                    <p className="text-xs text-muted-foreground">
                      Post-signature handover steps for {ws.customerName}. <span className="font-medium">No handover
                      progress is recorded in this build</span> — no per-step status is read, so none is shown. The list
                      below is the step sequence, not a status report.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { step: "Legal Complete", icon: Landmark },
                        { step: "Finance Setup", icon: DollarSign },
                        { step: "Ops Briefed", icon: ClipboardList },
                        { step: "Client Portal", icon: ExternalLink },
                        { step: "Training", icon: PackageCheck },
                        { step: "Go-Live Scheduled", icon: Clock },
                      ].map(s => (
                        <div key={s.step} className="p-3 rounded-lg border border-dashed border-border text-center">
                          <s.icon className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
                          <p className="text-xs font-medium">{s.step}</p>
                          <Badge variant="outline" className="text-[9px] mt-1 text-muted-foreground">Not recorded</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* CRM Sync Link */}
                <Card className="border border-border shadow-none hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Link2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">CRM Sync</h4>
                          <p className="text-xs text-muted-foreground">Sync handover status, contract data, and go-live dates to CRM.</p>
                        </div>
                      </div>
                       <Button variant="outline" size="sm" className="text-xs" disabled>
                        <ExternalLink className="w-3 h-3 mr-1" /> CRM Sync
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* ═══ SUPPORTING DOCS / DOCUMENTS TAB ═══
              SC-01 W04 (T08-B correction pass): this is now the ONLY
              `documents` tab. A second one (a navigationV1 block above) used to
              render the same supporting-document list with its own, differently
              computed counter; both were mounted at the same time. The P&L and
              ECR snapshots that only existed there have moved to the bottom of
              this tab, so no content was lost.
              The counter below is `visibleSupportDocs`, i.e. exactly the set
              the list renders — filter and archived toggle included. */}
          <TabsContent value="documents">
            {integrationEnabled ? (
              <>
                {/* Supporting Docs (v1 integration) */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5" /> Supporting Documents ({visibleSupportDocs.length}
                    {supportDocFilter !== "all" && wsSupportDocs.length !== visibleSupportDocs.length
                      ? ` of ${wsSupportDocs.length} loaded`
                      : ""})
                  </h4>
                  <div className="flex items-center gap-2">
                    <Select value={supportDocFilter} onValueChange={setSupportDocFilter}>
                      <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {SUPPORT_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant={showDocArchived ? "default" : "outline"} className="text-xs h-7" onClick={() => { setShowDocArchived(!showDocArchived); forceUpdate(n => n + 1); }}>
                      {showDocArchived ? "Showing Archived" : "Show Archived"}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSupportUpload(true)}>
                      <Upload className="w-3 h-3 mr-1" /> Upload
                    </Button>
                  </div>
                </div>

                {/* Upload dialog */}
                {showSupportUpload && (
                  <Card className="border border-blue-200 bg-blue-50/30 shadow-none mb-4">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-semibold text-blue-800">Upload Supporting Document</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Document Name</label>
                          <Input value={supportUploadName} onChange={e => setSupportUploadName(e.target.value)} placeholder="e.g. Trade License 2025" className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Category</label>
                          <Select value={supportUploadCategory} onValueChange={v => setSupportUploadCategory(v as SupportDocCategory)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SUPPORT_DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <button type="button" onClick={() => setSupportUploadRequired(!supportUploadRequired)}
                            className={`w-8 h-4.5 rounded-full transition-colors ${supportUploadRequired ? "bg-emerald-500" : "bg-gray-300"} relative`}>
                            <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${supportUploadRequired ? "left-4" : "left-0.5"}`} />
                          </button>
                          Required for Contract Ready
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="text-xs h-7 bg-[#1B2A4A] hover:bg-[#2A3F6A]" onClick={() => { void handleSupportDocUpload(); }}>
                          <FileUp className="w-3 h-3 mr-1" /> Upload
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSupportUpload(false)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Supporting docs list — the SAME set the counter above counts */}
                {(() => {
                  const filtered = visibleSupportDocs;
                  return filtered.length > 0 ? (
                    <div className="space-y-2">
                      {filtered.map(doc => (
                        <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors hover:bg-muted/30 ${doc.status === "archived" ? "opacity-60" : ""}`}>
                          <Badge variant="outline" className="text-[9px] shrink-0">{doc.category}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                              {doc.name}
                              {doc.isRequiredForContractReady && (
                                <Badge variant="outline" className="text-[9px] border-emerald-300 bg-emerald-50 text-emerald-700">Required</Badge>
                              )}
                              {doc.status === "archived" && <Badge variant="secondary" className="text-[9px]">Archived</Badge>}
                            </p>
                            {/* `toLocaleDateString` RETURNS the string "Invalid Date"
                                for an unparseable value instead of throwing, so a
                                try/catch is no guard. formatRecordedDate returns
                                null and we say the date is not recorded. */}
                            <p className="text-xs text-muted-foreground truncate">{doc.fileName} · v{doc.version} · {doc.uploadedBy} · {formatRecordedDate(doc.uploadedAt) ?? "upload date not recorded"}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                  toggleRequiredForContract(doc.id);
                                  forceUpdate(n => n + 1);
                                  toast.success(`"${doc.name}" ${!doc.isRequiredForContractReady ? "marked" : "unmarked"} as required`);
                                }}>
                                  {doc.isRequiredForContractReady ? <ToggleRight className="w-3.5 h-3.5 text-emerald-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Toggle required for contract</p></TooltipContent>
                            </Tooltip>
                            {activeCycle && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                    linkDocToCycle(doc.id, activeCycle.id);
                                    forceUpdate(n => n + 1);
                                    toast.success(`Linked to Cycle #${activeCycle.cycleNumber}`);
                                  }}>
                                    <Link2 className={`w-3.5 h-3.5 ${doc.linkedCycleId ? "text-blue-600" : "text-muted-foreground"}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">{doc.linkedCycleId ? "Linked to cycle" : "Link to cycle"}</p></TooltipContent>
                              </Tooltip>
                            )}
                            {doc.status === "active" ? (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                onClick={() => { void handleSupportDocArchive(doc.id, doc.name); }}>
                                <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                onClick={() => { void handleSupportDocRestore(doc.id, doc.name); }}>
                                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Card className="border border-border shadow-none">
                      <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                        {wsSupportDocs.length > 0
                          ? `No supporting document matches the "${supportDocFilter}" category (${wsSupportDocs.length} loaded).`
                          : "No supporting documents are loaded for this proposal."}
                        <div className="mt-3">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowSupportUpload(true)}>
                            <Upload className="w-3 h-3" /> Upload First Document
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Legacy documents section (below supporting docs) */}
                {(() => {
                  const wsDocs = getDocumentsByWorkspace(ws.id, showDocArchived);
                  if (wsDocs.length === 0) return null;
                  return (
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legacy Documents</h4>
                      <div className="space-y-2">
                        {wsDocs.map(doc => {
                          const isClickable = hasRealFile(doc);
                          return (
                            <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${isClickable ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"}`}
                              onClick={() => { if (isClickable) setViewerDoc(doc); }}>
                              <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-1.5">{doc.name}{isClickable && <Eye className="w-3 h-3 text-muted-foreground" />}</p>
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
                    </div>
                  );
                })()}
                <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} onDocumentChanged={() => forceUpdate(n => n + 1)} />

                {/* ── P&L Summary (moved here from the duplicate documents tab) ── */}
                <hr className="border-border my-6" />
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-muted-foreground" /> P&amp;L Summary
                    <Badge variant="secondary" className="text-[10px]">Snapshot</Badge>
                  </h3>
                  <Card className="border border-border shadow-none">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div><p className="text-[10px] text-muted-foreground uppercase">Est. Revenue</p><p className="text-sm font-medium mt-0.5 data-value">{formatSAR(ws.estimatedValue)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">GP%</p><p className={`text-sm font-medium mt-0.5 data-value ${ws.gpPercent >= 22 ? "text-emerald-600" : ws.gpPercent >= 15 ? "text-amber-600" : "text-red-600"}`}>{formatPercent(ws.gpPercent)}</p></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase">Service Type</p><p className="text-sm font-medium mt-0.5">{customer?.serviceType ?? <span className="text-muted-foreground">Not recorded</span>}</p></div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-3">Read from the commercial ticket. The P&amp;L calculator is not available in this build.</p>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Customer snapshot (moved here from the duplicate documents tab) ── */}
                <hr className="border-border my-6" />
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" /> Customer Snapshot
                    <Badge variant="secondary" className="text-[10px]">Read-only</Badge>
                  </h3>
                  <Card className="border border-border shadow-none">
                    <CardContent className="p-4">
                      {customer ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div><p className="text-[10px] text-muted-foreground uppercase">Customer Grade</p><p className="text-sm font-medium mt-0.5">{customer.grade ?? <span className="text-muted-foreground">Not recorded</span>}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Payment Status</p><p className="text-sm font-medium mt-0.5">{customer.paymentStatus ?? <span className="text-muted-foreground">Not recorded</span>}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">DSO</p><p className="text-sm font-medium mt-0.5 data-value">{customerRisk.dsoDays === null ? <span className="font-sans text-muted-foreground">Not recorded</span> : `${customerRisk.dsoDays} days`}</p></div>
                          <div><p className="text-[10px] text-muted-foreground uppercase">Industry</p><p className="text-sm font-medium mt-0.5">{customer.industry ?? <span className="text-muted-foreground">Not recorded</span>}</p></div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{customerUnavailableNote}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              /* Legacy documents tab (feature flag OFF) */
              <>
                {(() => {
                  const wsDocs = getDocumentsByWorkspace(ws.id, showDocArchived);
                  return (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5" /> Workspace Documents ({wsDocs.length})
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant={showDocArchived ? "default" : "outline"} className="gap-1.5 text-xs" onClick={() => setShowDocArchived(!showDocArchived)}>
                            {showDocArchived ? "Showing Archived" : "Show Archived"}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowDocUpload(true)}>
                            <Upload className="w-3 h-3" /> Upload
                          </Button>
                        </div>
                      </div>
                      {wsDocs.length > 0 ? (
                        <div className="space-y-2">
                          {wsDocs.map(doc => {
                            const isClickable = hasRealFile(doc);
                            return (
                              <div key={doc.id} className={`flex items-center gap-3 p-3 rounded-lg border border-border transition-colors ${isClickable ? "hover:bg-muted/30 cursor-pointer" : "opacity-60"}`}
                                onClick={() => { if (isClickable) setViewerDoc(doc); }}>
                                <Badge variant="outline" className={`text-[9px] shrink-0 ${getFileTypeColor(doc.fileType)}`}>{doc.fileType}</Badge>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate flex items-center gap-1.5">{doc.name}{isClickable && <Eye className="w-3 h-3 text-muted-foreground" />}</p>
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
                        <Card className="border border-border shadow-none">
                          <CardContent className="py-12 text-center text-sm text-muted-foreground">
                            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                            No documents yet
                            <div className="mt-3"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDocUpload(true)}><Upload className="w-3 h-3" /> Upload First Document</Button></div>
                          </CardContent>
                        </Card>
                      )}
                      <DocumentViewer document={viewerDoc} open={!!viewerDoc} onClose={() => setViewerDoc(null)} onDocumentChanged={() => forceUpdate(n => n + 1)} />
                      <UploadDialog open={showDocUpload} onClose={() => setShowDocUpload(false)} defaultCategory="Supporting"
                        suggestedName={`${customer?.name ?? ws.customerName} — ${ws.title}`}
                        onUpload={async ({ name, category, file, notes, tags }) => {
                          await uploadDocument({ name, category: category as DocumentCategory, customerId: ws.customerId, customerName: customer?.name ?? ws.customerName, workspaceId: ws.id, workspaceName: ws.title, file, notes, tags });
                          toast.success(`Document "${name}" uploaded.`);
                          forceUpdate(n => n + 1);
                        }} />
                    </>
                  );
                })()}
              </>
            )}
          </TabsContent>

          {/* ═══ ESCALATIONS TAB ═══ */}
          <TabsContent value="escalations">
            <WorkspaceEscalationsTab
              workspaceId={ws.id}
              escalations={workspaceEscalations}
              onRefresh={setWorkspaceEscalations}
            />
          </TabsContent>

          {/* ═══ COMMERCIAL AUDIT TAB (CW-010) ═══ */}
          {isCommercial && (
            <TabsContent value="audit">
              <CommercialAuditTrailTab workspaceId={ws.id} />
            </TabsContent>
          )}

          {/* ═══ AUDIT TAB (non-commercial fallback) ═══ */}
          {!isCommercial && (
          <TabsContent value="audit">
            {wsOverrides.length > 0 && (
              <Card className="border border-amber-200 bg-amber-50/30 shadow-none mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <ShieldOff className="w-4 h-4 text-amber-600" /> Governance Overrides ({wsOverrides.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-amber-200/60">
                    {wsOverrides.map((ov, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-1.5">
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                            {getStageDisplayName(ov.fromStage)} → {getStageDisplayName(ov.toStage)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{ov.userName}</span>
                          <span className="text-[10px] text-muted-foreground data-value ml-auto">{formatRecordedDate(ov.timestamp, "datetime") ?? "date not recorded"}</span>
                        </div>
                        <p className="text-xs text-amber-800 mb-1"><span className="font-medium">Reason:</span> {ov.overrideReason}</p>
                        <div className="flex flex-wrap gap-1">
                          {ov.overriddenRules.map((rule, j) => (
                            <Badge key={j} variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">{rule}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {wsStageHistory.length > 0 && (
              <Card className="border border-border shadow-none mb-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" /> Stage History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {wsStageHistory.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.action === "advanced" ? "bg-emerald-500" : entry.action === "advanced_with_override" ? "bg-amber-500" : "bg-orange-400"}`} />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="text-[10px] shrink-0">{getStageDisplayName(entry.fromStage)}</Badge>
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          <Badge variant={entry.action === "reverted" ? "secondary" : "default"} className="text-[10px] shrink-0">{getStageDisplayName(entry.toStage)}</Badge>
                          {entry.action === "reverted" && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0"><Undo2 className="w-2.5 h-2.5 mr-0.5" />Reverted</Badge>}
                          {entry.action === "advanced_with_override" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 shrink-0 cursor-help"><ShieldOff className="w-2.5 h-2.5 mr-0.5" />Override</Badge>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs p-2">
                                {entry.overrideRecord && (
                                  <div className="text-xs space-y-1">
                                    <p><span className="font-medium">Reason:</span> {entry.overrideRecord.overrideReason}</p>
                                    <p><span className="font-medium">Rules:</span> {entry.overrideRecord.overriddenRules.join(", ")}</p>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{entry.userName}</span>
                        <span className="text-[10px] text-muted-foreground data-value shrink-0">{formatRecordedDate(entry.timestamp, "datetime") ?? "date not recorded"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border border-border shadow-none"><CardContent className="p-0">
              <div className="divide-y divide-border">
                {wsAudit.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entry.userName}</span>
                        <span className="text-xs text-muted-foreground">{entry.action}</span>
                        {(entry.action === "stage_advanced_override" || entry.action.includes("override")) && (
                          <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700">override</Badge>
                        )}
                        {entry.action.startsWith("contract_cycle") && (
                          <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700">cycle</Badge>
                        )}
                        {entry.action.startsWith("renewal") && (
                          <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-700">renewal</Badge>
                        )}
                        {entry.action.startsWith("supporting_doc") && (
                          <Badge variant="outline" className="text-[9px] border-[#075eea]/30 text-[#075eea]">docs</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.details}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground data-value shrink-0">{formatRecordedDate(entry.timestamp, "datetime") ?? "date not recorded"}</span>
                  </div>
                ))}
                {wsAudit.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No audit entries</div>}
              </div>
            </CardContent></Card>
          </TabsContent>
          )}
          {/* ═══ TENDER TEAM TAB ═══ */}
          {isTender && (
            <TabsContent value="team">
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-serif">Tender Team</CardTitle>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => toast.info("Add team member — coming soon")}>
                      <Plus className="w-3 h-3 mr-1" /> Add Member
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* SC-01 W04 (T08-B correction pass): this list used to contain
                      two invented people — "Hano" (Commercial Analyst, active) and
                      "Nasser" (Technical Reviewer, pending). Neither was read from
                      anywhere. There is no team-membership source in this build, so
                      the only person shown is the owner actually recorded on the
                      ticket, and no membership status is claimed for anyone. */}
                  <div className="space-y-3">
                    {ws.owner ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ws.owner}</p>
                          <p className="text-xs text-muted-foreground">Recorded owner on this ticket</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No owner is recorded on this ticket.</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      No team-membership records are stored for tenders in this build, so no other members,
                      roles or statuses are shown. This is an absence of data, not an empty team.
                    </p>
                  </div>
                  {/* Convert to Commercial CTA */}
                  {ws.tenderStage === "won" && (
                    <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-emerald-800">Tender Won — Ready to Convert</p>
                          <p className="text-xs text-emerald-700 mt-0.5">Create a commercial workspace to begin the deal execution lifecycle.</p>
                        </div>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => toast.success("Convert to Commercial Workspace — coming soon")}>
                          Convert to Commercial <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>

      {/* ═══ TEMPLATE PICKER MODAL ═══ */}
      {/* SC-01 ruling R5: pricing lock is absent in this build (SX-007) — no
          override modal exists and nothing blocks manual pricing work. */}
    </TooltipProvider>
  );
}
