/**
 * ApprovalMatrixStage — Stage 8: Record human-selected participants and decisions.
 *
 * 4 tabs dispatched by activeTab, each with Qualification-pattern section tabs:
 *   1. approval_matrix   → 3 sections: Data Sources, Approval Participants, Human Control
 *   2. signoff_tracker    → 2 sections: Signoff Progress, Decision History
 *   3. exception_notes    → 1 section: Rejected / Exception Items
 *   4. governance_log     → 2 sections: Governance Rules, Audit Trail
 *
 * DATA SOURCE: ONLY from this tender's own stages.
 * The bot does NOT approve. Humans approve. AI is advisory only.
 * No mock data.
 */
import { useState, useMemo, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Users,
  ChevronDown, ChevronRight, FileCheck2, TrendingUp, Clock, Trash2,
  BarChart3, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
import { updateTenderApprovalMatrixData } from "@/lib/supabase-tender-actions";
import { getCurrentUser } from "@/lib/auth-state";
import { reportSaveOutcome, wsRevisionToken } from "./tender-save-outcome";
import { nanoid } from "nanoid";

// ─── Types ─────────────────────────────────────────────────

interface Props {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

interface ApprovalRecord {
  id: string;
  role: string;
  role_label: string;
  type: "approval" | "feasibility";
  decision: "pending" | "approved" | "rejected";
  decided_by: string;
  comment: string;
  decided_at: string | null;
}

// ─── Extract GP% ONLY from this tender's pricing stage ────

function extractGpFromTender(t: any): { gp: number | null; source: string } {
  const pricing = t.pricingData;
  if (pricing && typeof pricing === "object") {
    if (pricing.summary && pricing.summary.lowest_gp_percent) {
      const lowest = Number(pricing.summary.lowest_gp_percent);
      if (!isNaN(lowest) && lowest > 0) return { gp: lowest, source: "P&L Pricing (lowest scenario)" };
    }
    if (Array.isArray(pricing.scenarios) && pricing.scenarios.length > 0) {
      const gps = pricing.scenarios.map((s: any) => Number(s.gp_percent)).filter((n: number) => !isNaN(n) && n > 0);
      if (gps.length > 0) {
        const lowest = Math.min(...gps);
        return { gp: lowest, source: `P&L Pricing (${gps.length} scenario${gps.length > 1 ? "s" : ""})` };
      }
    }
  }
  if (typeof t.targetGpPercent === "number" && t.targetGpPercent > 0) {
    return { gp: t.targetGpPercent, source: "Tender target GP%" };
  }
  return { gp: null, source: "Not captured in any tender stage" };
}

// ─── Extract pallet volume ONLY from this tender's solution design ─

function extractPalletsFromTender(t: any): { pallets: number | null; source: string } {
  const sd = t.solutionDesignData;
  if (sd && typeof sd === "object") {
    if (sd.hop?.warehouse?.storage_capacity) {
      const cap = Number(sd.hop.warehouse.storage_capacity);
      if (!isNaN(cap) && cap > 0) return { pallets: cap, source: "Solution Design (HOP warehouse)" };
    }
    if (sd.hop?.warehouse?.pallet_positions) {
      const pp = Number(sd.hop.warehouse.pallet_positions);
      if (!isNaN(pp) && pp > 0) return { pallets: pp, source: "Solution Design (HOP pallet positions)" };
    }
    if (sd.configuration?.pallet_volume) {
      const pv = Number(sd.configuration.pallet_volume);
      if (!isNaN(pv) && pv > 0) return { pallets: pv, source: "Solution Design (configuration)" };
    }
  }
  return { pallets: null, source: "Not captured in Solution Design stage" };
}

// ─── Stage Menu Header (reusable) ────────────────────────

function StageMenuHeader<T extends string>({
  sections, activeSection, setActiveSection, stageIntelOpen, setStageIntelOpen, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved, unsaved,
}: {
  sections: TenderStageSectionTab<T>[];
  activeSection: T;
  setActiveSection: (section: T) => void;
  stageIntelOpen: boolean;
  setStageIntelOpen: (fn: (prev: boolean) => boolean) => void;
  intelMetrics: TenderStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  saved?: boolean;
  unsaved?: boolean;
}) {
  return (
    <TenderStageTaskShell
      stageTitle="Approval Matrix Stage Menu"
      stageBadge="Stage 8"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={sections}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={(open) => setStageIntelOpen(() => open)}
      metrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
      unsaved={unsaved}
    />
  );
}

// ─── Component ────────────────────────────────────────────

export default function ApprovalMatrixStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: Props) {
  const t = ws.tender as any;
  const tenderId = t.id;

  // Extract data ONLY from this tender's stages
  const { gp: gpPercent, source: gpSource } = useMemo(() => extractGpFromTender(t), [t]);
  const { pallets: palletVolume, source: palletSource } = useMemo(() => extractPalletsFromTender(t), [t]);

  // Canonical Stage 8 facts take precedence; legacy drafting data remains readable.
  const existingApprovals: ApprovalRecord[] = useMemo(() => {
    const details = t.typeDetails ?? t.type_details ?? {};
    const td = t.tenderDraftingData ?? {};
    const canonical = details.approval_matrix;
    const canonicalRecord = canonical && typeof canonical === "object" && !Array.isArray(canonical)
      ? canonical as Record<string, any>
      : {};
    const matrix = Object.keys(canonicalRecord).length > 0
      ? canonicalRecord
      : td.approval_matrix;
    if (!matrix || !Array.isArray(matrix.approvals)) return [];
    return matrix.approvals
      .filter((record: unknown) => record && typeof record === "object")
      .map((record: any) => ({
        id: record.id || `apr-${nanoid(8)}`,
        role: record.role || `participant-${nanoid(6)}`,
        role_label: record.role_label || record.roleLabel || record.role || "Approval participant",
        type: record.type === "feasibility" ? "feasibility" : "approval",
        decision: record.decision === "approved" || record.decision === "rejected" ? record.decision : "pending",
        decided_by: record.decided_by || "",
        comment: record.comment || "",
        decided_at: record.decided_at || null,
      }));
  }, [t]);

  const approvalRows = existingApprovals;

  const approvedCount = approvalRows.filter(r => r.decision === "approved").length;
  const rejectedCount = approvalRows.filter(r => r.decision === "rejected").length;
  const pendingCount = approvalRows.filter(r => r.decision === "pending").length;
  const allApproved = pendingCount === 0 && rejectedCount === 0 && approvalRows.length > 0;
  const signoffPct = approvalRows.length > 0 ? Math.round((approvedCount / approvalRows.length) * 100) : 0;

  // UI state
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newApprovalType, setNewApprovalType] = useState<"approval" | "feasibility">("approval");

  // TCW-T4 (P2a): every approval write threads the UI-load-time revision and
  // surfaces the honest outcome (stale / audit-warning / failure).
  const saveApprovals = useCallback(async (approvals: ApprovalRecord[], reason: string) => {
    return updateTenderApprovalMatrixData(tenderId, "approvals", approvals, reason, wsRevisionToken(ws));
  }, [tenderId, ws]);

  const handleAddParticipant = useCallback(async () => {
    const roleLabel = newRoleLabel.trim();
    if (!roleLabel) {
      toast.error("Enter the participant or role name.");
      return;
    }

    const roleBase = roleLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "participant";
    const role = `${roleBase}_${nanoid(5)}`;
    const participant: ApprovalRecord = {
      id: `apr-${nanoid(8)}`,
      role,
      role_label: roleLabel,
      type: newApprovalType,
      decision: "pending",
      decided_by: "",
      comment: "",
      decided_at: null,
    };

    setSaving("new-participant");
    try {
      const result = await saveApprovals([...existingApprovals, participant], `Participant added: ${roleLabel}`);
      // Stale/failure keeps the typed participant name in the input.
      if (!reportSaveOutcome(result, `${roleLabel} added to this Tender's approval record.`)) return;
      setNewRoleLabel("");
      setNewApprovalType("approval");
      reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to add participant.");
    } finally {
      setSaving(null);
    }
  }, [existingApprovals, newApprovalType, newRoleLabel, reload, saveApprovals]);

  // Save approval decision
  const handleDecision = useCallback(async (role: string, roleLabel: string, type: "approval" | "feasibility", decision: "approved" | "rejected") => {
    setSaving(role);
    try {
      const next = existingApprovals.map((record) => record.role === role ? {
        ...record,
        role_label: roleLabel,
        type,
        decision,
        // P4 (F1): the persisted decider is the SESSION user (auth-state
        // mirror; signed-out sessions record its honest "Unauthenticated"
        // literal) — never the fabricated string "Current User".
        decided_by: getCurrentUser().name,
        comment: approvalComment,
        decided_at: new Date().toISOString(),
      } : record);
      const result = await saveApprovals(next, `${roleLabel}: ${decision}`);
      // Stale/failure keeps the typed comment for a retry.
      if (!reportSaveOutcome(result, `${roleLabel}: ${decision === "approved" ? "Approved" : "Rejected"}`)) return;
      setApprovalComment("");
      setExpandedRole(null);
      reload();
    } catch (err: any) {
      toast.error(err.message || "Save failed.");
    } finally {
      setSaving(null);
    }
  }, [approvalComment, existingApprovals, reload, saveApprovals]);

  // Reset a decision
  const handleReset = useCallback(async (role: string) => {
    setSaving(role);
    try {
      const next = existingApprovals.map((record) => record.role === role ? {
        ...record,
        decision: "pending" as const,
        decided_by: "",
        comment: "",
        decided_at: null,
      } : record);
      const result = await saveApprovals(next, `Decision reset: ${role}`);
      if (reportSaveOutcome(result, "Decision reset to pending.")) reload();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(null); }
  }, [existingApprovals, reload, saveApprovals]);

  const handleRemoveParticipant = useCallback(async (role: string, roleLabel: string) => {
    setSaving(role);
    try {
      const result = await saveApprovals(
        existingApprovals.filter((record) => record.role !== role),
        `Participant removed: ${roleLabel}`,
      );
      if (reportSaveOutcome(result, `${roleLabel} removed from this Tender's approval record.`)) {
        setExpandedRole(null);
        reload();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove participant.");
    } finally {
      setSaving(null);
    }
  }, [existingApprovals, reload, saveApprovals]);

  // Intel metrics shared across all tabs
  const intelMetrics = [
    { label: "GP%", value: gpPercent !== null ? `${gpPercent.toFixed(1)}%` : "Not captured" },
    { label: "Pallet Volume", value: palletVolume !== null ? palletVolume.toLocaleString() : "Not captured" },
    { label: "Signoff Progress", value: `${approvedCount}/${approvalRows.length} (${signoffPct}%)` },
    { label: "Status", value: allApproved ? "All Approved" : rejectedCount > 0 ? `${rejectedCount} Rejected` : `${pendingCount} Pending` },
  ];

  // TCW-T4 (B10): real badge state for the editable tab — approvals persist on
  // click, so "Unsaved" is exactly a typed-but-unsubmitted input (participant
  // name / decision comment); "Saved" requires stored approvals AND no pending
  // input; an empty record with no input renders the grey "Not Saved".
  const pendingInput = newRoleLabel.trim() !== "" || approvalComment.trim() !== "";

  // ─── Tab 1: Approval Matrix ─────────────────────────────
  if (activeTab === "approval_matrix") {
    return <ApprovalMatrixTab
      gpPercent={gpPercent} gpSource={gpSource}
      palletVolume={palletVolume} palletSource={palletSource}
      approvalRows={approvalRows} expandedRole={expandedRole} setExpandedRole={setExpandedRole}
      approvalComment={approvalComment} setApprovalComment={setApprovalComment}
      saving={saving} handleDecision={handleDecision} handleReset={handleReset}
      handleRemoveParticipant={handleRemoveParticipant}
      newRoleLabel={newRoleLabel} setNewRoleLabel={setNewRoleLabel}
      newApprovalType={newApprovalType} setNewApprovalType={setNewApprovalType}
      handleAddParticipant={handleAddParticipant}
      allApproved={allApproved} intelMetrics={intelMetrics}
      badgeSaved={approvalRows.length > 0 && !pendingInput} badgeUnsaved={pendingInput}
      onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
    />;
  }

  // ─── Tab 2: Signoff Tracker ────────────────────────────
  if (activeTab === "signoff_tracker") {
    return <SignoffTrackerTab
      approvalRows={approvalRows} approvedCount={approvedCount} rejectedCount={rejectedCount}
      pendingCount={pendingCount} signoffPct={signoffPct} allApproved={allApproved}
      existingApprovals={existingApprovals} intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
    />;
  }

  // ─── Tab 3: Exception Notes ────────────────────────────
  if (activeTab === "exception_notes") {
    return <ExceptionNotesTab
      approvalRows={approvalRows} existingApprovals={existingApprovals}
      handleReset={handleReset} saving={saving} intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
    />;
  }

  // ─── Tab 4: Governance Log ─────────────────────────────
  if (activeTab === "governance_log") {
    return <GovernanceLogTab
      existingApprovals={existingApprovals} gpPercent={gpPercent} palletVolume={palletVolume}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
    />;
  }

  return <p className="text-sm text-muted-foreground text-center py-8">No Approval Matrix view configured for this tab.</p>;
}

// ═══════════════════════════════════════════════════════════
// TAB 1: APPROVAL MATRIX
// ═══════════════════════════════════════════════════════════

type MatrixSection = "data_sources" | "approvals" | "governance";
const MATRIX_SECTIONS: { key: MatrixSection; label: string; icon: ReactNode }[] = [
  { key: "data_sources", label: "Data Sources", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { key: "approvals", label: "Approval Participants", icon: <Users className="w-3.5 h-3.5" /> },
  { key: "governance", label: "Human Control", icon: <Shield className="w-3.5 h-3.5" /> },
];

function ApprovalMatrixTab({ gpPercent, gpSource, palletVolume, palletSource,
  approvalRows, expandedRole, setExpandedRole, approvalComment, setApprovalComment,
  saving, handleDecision, handleReset, handleRemoveParticipant, newRoleLabel, setNewRoleLabel,
  newApprovalType, setNewApprovalType, handleAddParticipant,
  allApproved, intelMetrics, badgeSaved, badgeUnsaved, onOpenDocuments, onOpenGlobalIntel }: any) {

  const [activeSection, setActiveSection] = useState<MatrixSection>("data_sources");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B10): real state from the parent — never a literal. */}
      <StageMenuHeader sections={MATRIX_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={badgeSaved} unsaved={badgeUnsaved} />

      {/* ── 1. Data Sources ── */}
      <div className={activeSection !== "data_sources" ? "hidden" : "space-y-4"}>
        <Card className="border-2 border-[var(--color-hala-navy)]/20 shadow-none bg-gradient-to-r from-[var(--color-hala-navy)]/5 to-transparent">
          <div className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-hala-navy)] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold">Approval Matrix</h3>
              <p className="text-[10px] text-muted-foreground">Human-selected approval participants with Tender facts shown as context</p>
            </div>
            {allApproved && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
                <CheckCircle2 className="w-3 h-3" /> All Approved
              </Badge>
            )}
          </div>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tender Data Inputs</span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-lg border p-2.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Gross Profit %</span>
                      {gpPercent !== null ? (
                        <span className="text-sm font-bold text-slate-700">{gpPercent.toFixed(1)}%</span>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">—</span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{gpSource}</p>
                    {gpPercent !== null && <Badge variant="outline" className="text-[8px] mt-1">Captured context</Badge>}
                  </div>
                  <div className="rounded-lg border p-2.5 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Pallet Volume</span>
                      {palletVolume !== null ? (
                        <span className="text-sm font-bold text-slate-700">{palletVolume.toLocaleString()}</span>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">—</span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{palletSource}</p>
                    {palletVolume !== null && <Badge variant="outline" className="text-[8px] mt-1">Captured context</Badge>}
                  </div>
                </div>
                {(gpPercent === null || palletVolume === null) && (
                  <div className="mt-2 flex items-start gap-1.5 text-[9px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>
                      {gpPercent === null && palletVolume === null
                        ? "GP% and pallet volume have not been captured yet. You can still maintain the approval participants and decisions."
                        : gpPercent === null
                          ? "GP% has not been captured yet. Approval participants remain under human control."
                          : "Pallet volume has not been captured yet. Approval participants remain under human control."
                      }
                    </span>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signoff Progress</span>
                </div>
                <div className="flex gap-3">
                  {(() => {
                    const pct = approvalRows.length > 0 ? Math.round((approvalRows.filter((r: any) => r.decision === "approved").length / approvalRows.length) * 100) : 0;
                    const circ = 2 * Math.PI * 26;
                    return (
                      <div className={`flex flex-col items-center justify-center p-2 rounded-lg border min-w-[80px] ${allApproved ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200" />
                          <circle cx="32" cy="32" r="26" fill="none" strokeWidth="5"
                            className={allApproved ? "stroke-emerald-500" : pct > 0 ? "stroke-blue-500" : "stroke-slate-300"}
                            strokeDasharray={`${circ}`} strokeDashoffset={`${circ - (pct / 100) * circ}`}
                            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }} />
                        </svg>
                        <span className={`text-lg font-bold -mt-11 ${allApproved ? "text-emerald-600" : "text-slate-700"}`}>{pct}%</span>
                        <span className="text-[8px] text-muted-foreground mt-5">Signoff</span>
                      </div>
                    );
                  })()}
                  <div className="flex-1 space-y-1.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="text-center p-1.5 rounded-md bg-slate-50 border border-slate-200">
                        <span className="text-sm font-bold text-slate-700">{approvalRows.filter((r: any) => r.decision === "pending").length}</span>
                        <p className="text-[8px] text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center p-1.5 rounded-md bg-emerald-50 border border-emerald-200">
                        <span className="text-sm font-bold text-emerald-700">{approvalRows.filter((r: any) => r.decision === "approved").length}</span>
                        <p className="text-[8px] text-muted-foreground">Approved</p>
                      </div>
                      <div className="text-center p-1.5 rounded-md bg-red-50 border border-red-200">
                        <span className="text-sm font-bold text-red-700">{approvalRows.filter((r: any) => r.decision === "rejected").length}</span>
                        <p className="text-[8px] text-muted-foreground">Rejected</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Approval Participants ── */}
      <div className={activeSection !== "approvals" ? "hidden" : "space-y-4"}>
        <div className="flex items-center gap-2 px-1">
          <FileCheck2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Approval Participants ({approvalRows.length})</span>
        </div>
        <div className="grid gap-2 border border-border bg-muted/10 p-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <Input
            value={newRoleLabel}
            onChange={(event) => setNewRoleLabel(event.target.value)}
            placeholder="Participant or role name"
            className="h-9 text-xs"
          />
          <Select value={newApprovalType} onValueChange={setNewApprovalType}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="approval">Approval decision</SelectItem>
              <SelectItem value="feasibility">Feasibility confirmation</SelectItem>
            </SelectContent>
          </Select>
          <Button className="h-9" onClick={handleAddParticipant} disabled={saving === "new-participant"}>
            <Users className="w-3.5 h-3.5 mr-1.5" /> Add Participant
          </Button>
        </div>
        {approvalRows.length === 0 && (
          <div className="border border-dashed border-border py-10 text-center text-muted-foreground">
            <Users className="w-7 h-7 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No approval participants recorded yet.</p>
            <p className="text-xs mt-1">Add the people or roles selected for this Tender.</p>
          </div>
        )}
        {approvalRows.map((row: any) => {
          const isExpanded = expandedRole === row.role;
          const isSaving = saving === row.role;
          const decisionColor = row.decision === "approved" ? "border-emerald-300 bg-emerald-50/50"
            : row.decision === "rejected" ? "border-red-300 bg-red-50/50" : "border-border";
          return (
            <Card key={row.role} className={`shadow-none ${decisionColor}`}>
              <CardHeader className="py-2.5 px-4 cursor-pointer hover:bg-muted/10" onClick={() => setExpandedRole(isExpanded ? null : row.role)}>
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-700">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold">{row.role_label}</span>
                    <p className="text-[9px] text-muted-foreground">{row.type === "feasibility" ? "Feasibility confirmation" : "Approval decision"}</p>
                  </div>
                  {row.decision === "approved" && <Badge variant="outline" className="text-[8px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> Approved</Badge>}
                  {row.decision === "rejected" && <Badge variant="outline" className="text-[8px] border-red-300 text-red-700 bg-red-50 gap-0.5"><XCircle className="w-2.5 h-2.5" /> Rejected</Badge>}
                  {row.decision === "pending" && <Badge variant="outline" className="text-[8px] border-slate-200 text-slate-500 gap-0.5"><Clock className="w-2.5 h-2.5" /> Pending</Badge>}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="p-4 pt-0 space-y-3">
                  {row.decision !== "pending" && (
                    <div className={`flex items-center gap-2 text-[10px] rounded-md border px-3 py-2 ${row.decision === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                      {row.decision === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      <span><strong>{row.decided_by}</strong> — {row.decided_at ? new Date(row.decided_at).toLocaleString() : "—"}</span>
                      {row.comment && <span className="ml-1 text-muted-foreground">"{row.comment}"</span>}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Textarea placeholder={`Comment for ${row.role_label} decision (optional)...`} className="text-xs min-h-[60px]"
                      value={expandedRole === row.role ? approvalComment : ""} onChange={(e: any) => setApprovalComment(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isSaving}
                        onClick={() => handleDecision(row.role, row.role_label, row.type, "approved")}>
                        <CheckCircle2 className="w-3.5 h-3.5" />{row.type === "feasibility" ? "Confirm Feasibility" : "Approve"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5 border-red-300 text-red-700 hover:bg-red-50" disabled={isSaving}
                        onClick={() => handleDecision(row.role, row.role_label, row.type, "rejected")}>
                        <XCircle className="w-3.5 h-3.5" />Reject
                      </Button>
                      {row.decision !== "pending" && (
                        <Button size="sm" variant="ghost" className="h-8 text-[11px] gap-1 text-muted-foreground" disabled={isSaving} onClick={() => handleReset(row.role)}>Reset</Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-[11px] gap-1 text-red-700 ml-auto" disabled={isSaving} onClick={() => handleRemoveParticipant(row.role, row.role_label)}>
                        <Trash2 className="w-3.5 h-3.5" /> Remove Participant
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── 3. Human Control ── */}
      <div className={activeSection !== "governance" ? "hidden" : ""}>
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2.5">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">The Tender team controls this approval record.</p>
            <p className="mt-0.5">GP and pallet values are context only. They do not assign a participant, change the Tender stage, disable editing, or prevent browsing. Every recorded decision remains a human action.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: SIGNOFF TRACKER
// ═══════════════════════════════════════════════════════════

type TrackerSection = "progress" | "history";
const TRACKER_SECTIONS: { key: TrackerSection; label: string; icon: ReactNode }[] = [
  { key: "progress", label: "Signoff Progress", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: "history", label: "Decision History", icon: <Clock className="w-3.5 h-3.5" /> },
];

function SignoffTrackerTab({ approvalRows, approvedCount, rejectedCount, pendingCount, signoffPct, allApproved, existingApprovals, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: any) {
  const [activeSection, setActiveSection] = useState<TrackerSection>("progress");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const decidedApprovals = existingApprovals.filter((a: ApprovalRecord) => a.decision !== "pending" && a.decided_at);
  const sortedHistory = [...decidedApprovals].sort((a: any, b: any) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime());

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B10): read-only projection of stored decisions — nothing here
          can hold unsaved edits, so "Saved" states the in-sync fact. */}
      <StageMenuHeader sections={TRACKER_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      {/* ── 1. Signoff Progress ── */}
      <div className={activeSection !== "progress" ? "hidden" : "space-y-4"}>
        <div className="grid grid-cols-4 gap-3">
          <Card className="shadow-none border-border"><CardContent className="p-4 text-center">
            <span className="text-2xl font-bold">{approvalRows.length}</span>
            <p className="text-[10px] text-muted-foreground">Participants</p>
          </CardContent></Card>
          <Card className="shadow-none border-emerald-200 bg-emerald-50/50"><CardContent className="p-4 text-center">
            <span className="text-2xl font-bold text-emerald-700">{approvedCount}</span>
            <p className="text-[10px] text-muted-foreground">Approved</p>
          </CardContent></Card>
          <Card className="shadow-none border-red-200 bg-red-50/50"><CardContent className="p-4 text-center">
            <span className="text-2xl font-bold text-red-700">{rejectedCount}</span>
            <p className="text-[10px] text-muted-foreground">Rejected</p>
          </CardContent></Card>
          <Card className="shadow-none border-slate-200"><CardContent className="p-4 text-center">
            <span className="text-2xl font-bold text-slate-600">{pendingCount}</span>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </CardContent></Card>
        </div>
        <Card className="shadow-none border-border"><CardContent className="p-4">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-3 flex-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${signoffPct}%` }} />
            </div>
            <span className="text-sm font-bold">{signoffPct}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{allApproved ? "All recorded participants have approved." : `${pendingCount} recorded decision(s) remain pending.`}</p>
        </CardContent></Card>
      </div>

      {/* ── 2. Decision History ── */}
      <div className={activeSection !== "history" ? "hidden" : ""}>
        {sortedHistory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No decisions recorded yet.</p>
            <p className="text-xs mt-1">Decisions will appear here as approvers sign off.</p>
          </div>
        ) : (
          <Card className="shadow-none border-border"><CardContent className="p-0">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50 border-b"><tr>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Decision</th>
                <th className="px-3 py-2 text-left font-semibold">Decided By</th>
                <th className="px-3 py-2 text-left font-semibold">Comment</th>
                <th className="px-3 py-2 text-left font-semibold w-32">Date</th>
              </tr></thead>
              <tbody>
                {sortedHistory.map((a: any, i: number) => (
                  <tr key={a.id || i} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{a.role_label}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[8px] ${a.decision === "approved" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-red-300 text-red-700 bg-red-50"}`}>{a.decision}</Badge>
                    </td>
                    <td className="px-3 py-2">{a.decided_by}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.comment || "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.decided_at ? new Date(a.decided_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: EXCEPTION NOTES
// ═══════════════════════════════════════════════════════════

type ExSection = "exceptions";
const EX_SECTIONS: { key: ExSection; label: string; icon: ReactNode }[] = [
  { key: "exceptions", label: "Rejected Items", icon: <Inbox className="w-3.5 h-3.5" /> },
];

function ExceptionNotesTab({ approvalRows, existingApprovals, handleReset, saving, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: any) {
  const [activeSection, setActiveSection] = useState<ExSection>("exceptions");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const rejectedRows = approvalRows.filter((r: any) => r.decision === "rejected");

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B10): projection of stored decisions with an immediate reset
          action — no draft interval exists, so "Saved" states the in-sync fact. */}
      <StageMenuHeader sections={EX_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      <div className={activeSection !== "exceptions" ? "hidden" : ""}>
        {rejectedRows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-400" />
            <p className="text-sm font-medium">No exceptions — no approvals have been rejected.</p>
            <p className="text-xs mt-1">Rejected approvals will appear here for review.</p>
          </div>
        ) : (
          <Card className="shadow-none border-border"><CardContent className="p-0">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50 border-b"><tr>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-left font-semibold">Rejected By</th>
                <th className="px-3 py-2 text-left font-semibold">Comment</th>
                <th className="px-3 py-2 text-left font-semibold w-28">Date</th>
                <th className="px-3 py-2 text-center font-semibold w-24">Action</th>
              </tr></thead>
              <tbody>
                {rejectedRows.map((row: any, i: number) => (
                  <tr key={row.role} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{row.role_label}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[8px]">{row.type === "feasibility" ? "Feasibility" : "Approval"}</Badge></td>
                    <td className="px-3 py-2">{row.decided_by || "Unknown"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.comment || "No comment"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.decided_at ? new Date(row.decided_at).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" disabled={saving === row.role} onClick={() => handleReset(row.role)}>Reset</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: GOVERNANCE LOG
// ═══════════════════════════════════════════════════════════

type GovSection = "rules" | "audit";
const GOV_SECTIONS: { key: GovSection; label: string; icon: ReactNode }[] = [
  { key: "rules", label: "Human Control", icon: <Shield className="w-3.5 h-3.5" /> },
  { key: "audit", label: "Audit Trail", icon: <Clock className="w-3.5 h-3.5" /> },
];

function GovernanceLogTab({ existingApprovals, gpPercent, palletVolume, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: any) {
  const [activeSection, setActiveSection] = useState<GovSection>("rules");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  const allRecords = [...existingApprovals].sort((a: any, b: any) => {
    const da = a.decided_at ? new Date(a.decided_at).getTime() : 0;
    const db = b.decided_at ? new Date(b.decided_at).getTime() : 0;
    return db - da;
  });

  return (
    <div className="space-y-4">
      {/* TCW-T4 (B10): read-only projection — "Saved" states the in-sync fact. */}
      <StageMenuHeader sections={GOV_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={true} />

      {/* ── 1. Human Control ── */}
      <div className={activeSection !== "rules" ? "hidden" : "space-y-3"}>
        <Card className="shadow-none border-border">
          <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-[#075eea]" />
              <span className="text-xs font-semibold">Human-Controlled Approval Record</span>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-[11px]">
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 bg-muted/10">
                <Users className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" />
                <div><strong>Participants:</strong> the Tender team selects the people or roles relevant to this Tender.</div>
              </div>
              <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 bg-muted/10">
                <TrendingUp className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" />
                <div><strong>Commercial context:</strong> GP% ({gpPercent ?? "not captured"}) and pallet volume ({palletVolume ?? "not captured"}) are displayed without assigning participants.</div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground bg-muted/30 rounded-lg border border-border px-3 py-2.5 mt-3">
              <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Records do not control access or stage movement.</p>
                <p className="mt-0.5">A pending or rejected decision does not disable editing, prevent browsing, or move the Tender. Stage movement remains a separate human action.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Audit Trail ── */}
      <div className={activeSection !== "audit" ? "hidden" : ""}>
        {allRecords.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No audit records yet.</p>
            <p className="text-xs mt-1">All approval decisions will be logged here.</p>
          </div>
        ) : (
          <Card className="shadow-none border-border"><CardContent className="p-0">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50 border-b"><tr>
                <th className="px-3 py-2 text-left font-semibold w-32">Timestamp</th>
                <th className="px-3 py-2 text-left font-semibold">Role</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Decision</th>
                <th className="px-3 py-2 text-left font-semibold">Decided By</th>
                <th className="px-3 py-2 text-left font-semibold">Comment</th>
              </tr></thead>
              <tbody>
                {allRecords.map((a: any, i: number) => (
                  <tr key={a.id || i} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.decided_at ? new Date(a.decided_at).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 font-medium">{a.role_label}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[8px] ${a.decision === "approved" ? "border-emerald-300 text-emerald-700 bg-emerald-50" : a.decision === "rejected" ? "border-red-300 text-red-700 bg-red-50" : "border-slate-200 text-slate-600"}`}>{a.decision}</Badge>
                    </td>
                    <td className="px-3 py-2">{a.decided_by}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
