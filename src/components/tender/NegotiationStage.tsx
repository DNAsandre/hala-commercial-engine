/**
 * NegotiationStage — Stage 13: Active contract term negotiation with client.
 *
 * 4 Tabs (each with Qualification-pattern section tabs):
 *  1. Negotiation Log — sections: Meeting Log, Activity Log
 *  2. Requested Changes — sections: Change Register, Audit Trail
 *  3. Negotiation Margin — sections: Margin Tracker, Activity Log
 *  4. Revised Versions — sections: Terms Tracker
 *
 * Each tab wraps its original content in the standard StageMenuHeader.
 * DATA SOURCE: ONLY Supabase. No AI. No mock data.
 */
import { useState, type ReactNode } from "react";
import {
  MessageSquare, ClipboardList, DollarSign, FileText,
  Activity, Clock, CheckCircle2,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";

import NegotiationLogTab from "./NegotiationLogTab";
import NegotiationChangesTab from "./NegotiationChangesTab";
import NegotiationMarginTab from "./NegotiationMarginTab";
import NegotiationRevisedTermsTab from "./NegotiationRevisedTermsTab";
import TenderActivityTab from "./TenderActivityTab";
import TenderAuditTrailTab from "./TenderAuditTrailTab";

// ─── Props ──────────────────────────────────────────────────

interface StageProps {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

// ─── Stage Menu Header (reusable) ────────────────────────

function StageMenuHeader<T extends string>({
  sections, activeSection, setActiveSection, stageIntelOpen, setStageIntelOpen, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved,
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
}) {
  return (
    <TenderStageTaskShell
      stageTitle="Negotiation Stage Menu"
      stageBadge="Stage 13"
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      sectionTabs={sections}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={(open) => setStageIntelOpen(() => open)}
      metrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 1: NEGOTIATION LOG
// Section 1 — Meeting Log    → NegotiationLogTab  (negotiation_data.negotiation_log)
// Section 2 — Activity Log   → TenderActivityTab  (activity log)
// ═══════════════════════════════════════════════════════════

type LogSection = "meeting_log" | "activity_log";
const LOG_SECTIONS: { key: LogSection; label: string; icon: ReactNode }[] = [
  { key: "meeting_log",   label: "Meeting Log",    icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "activity_log",  label: "Activity Log",   icon: <Activity className="w-3.5 h-3.5" /> },
];

function NegotiationLogView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<LogSection>("meeting_log");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={LOG_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "meeting_log" ? "hidden" : ""}>
        <NegotiationLogTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "activity_log" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: REQUESTED CHANGES
// Section 1 — Change Register → NegotiationChangesTab (negotiation_data.requested_changes)
// Section 2 — Audit Trail     → TenderAuditTrailTab   (ws.auditEntries)
// ═══════════════════════════════════════════════════════════

type ChangesSection = "change_register" | "changes_audit";
const CHANGES_SECTIONS: { key: ChangesSection; label: string; icon: ReactNode }[] = [
  { key: "change_register", label: "Change Register",     icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: "changes_audit",   label: "Audit Trail",         icon: <Clock className="w-3.5 h-3.5" /> },
];

function RequestedChangesView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<ChangesSection>("change_register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={CHANGES_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "change_register" ? "hidden" : ""}>
        <NegotiationChangesTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "changes_audit" ? "hidden" : ""}>
        <TenderAuditTrailTab ws={ws} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: NEGOTIATION MARGIN
// Section 1 — Margin Tracker  → NegotiationMarginTab (negotiation_data.margin_impact)
// Section 2 — Activity Log    → TenderActivityTab    (activity log)
// ═══════════════════════════════════════════════════════════

type MarginSection = "margin_tracker" | "margin_activity";
const MARGIN_SECTIONS: { key: MarginSection; label: string; icon: ReactNode }[] = [
  { key: "margin_tracker",  label: "Margin Tracker",  icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "margin_activity", label: "Activity Log",    icon: <Activity className="w-3.5 h-3.5" /> },
];

function NegotiationMarginView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<MarginSection>("margin_tracker");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={MARGIN_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "margin_tracker" ? "hidden" : ""}>
        <NegotiationMarginTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "margin_activity" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: REVISED VERSIONS
// Section 1 — Terms Tracker → NegotiationRevisedTermsTab (negotiation_data.revised_terms)
// ═══════════════════════════════════════════════════════════

type RevisedSection = "terms_tracker";
const REVISED_SECTIONS: { key: RevisedSection; label: string; icon: ReactNode }[] = [
  { key: "terms_tracker", label: "Terms Tracker", icon: <FileText className="w-3.5 h-3.5" /> },
];

function RevisedVersionsView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<RevisedSection>("terms_tracker");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={REVISED_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "terms_tracker" ? "hidden" : ""}>
        <NegotiationRevisedTermsTab ws={ws} reload={reload} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function NegotiationStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const neg = td?.negotiation_data ?? {};

  const negLog: any[] = Array.isArray(neg.negotiation_log) ? neg.negotiation_log : [];
  const changes: any[] = Array.isArray(neg.requested_changes) ? neg.requested_changes : [];
  const margin = neg.margin_impact ?? {};
  const revised = neg.revised_terms ?? {};

  const openChanges = changes.filter((c: any) => c.status === "open" || c.hala_position === "pending").length;

  const intelMetrics = [
    { label: "Meetings",         value: negLog.length > 0 ? `${negLog.length} logged` : "None logged" },
    { label: "Open Changes",     value: openChanges > 0 ? `${openChanges} open` : changes.length > 0 ? "All resolved" : "None logged" },
    { label: "Margin Drift",     value: margin.current_gp ? `${margin.current_gp}% GP` : "Not tracked" },
    { label: "Contract",         value: revised.contract_readiness === "ready" ? "Ready" : revised.contract_readiness === "near_ready" ? "Near Ready" : "Not ready" },
  ];

  // Compute saved state per tab from actual Supabase data
  const hasLog = negLog.length > 0;
  const hasChanges = changes.length > 0;
  const hasMargin = !!(margin.current_gp || margin.current_value);
  const hasRevised = !!(revised.contract_readiness && revised.contract_readiness !== "not_ready") || (Array.isArray(revised.terms) && revised.terms.length > 0);

  if (activeTab === "negotiation_log")
    return <NegotiationLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasLog} />;
  if (activeTab === "requested_changes")
    return <RequestedChangesView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasChanges} />;
  if (activeTab === "negotiation_margin")
    return <NegotiationMarginView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasMargin} />;
  if (activeTab === "revised_versions")
    return <RevisedVersionsView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasRevised} />;

  // Default fallback
  return <NegotiationLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasLog} />;
}
