/**
 * LostWithdrawnStage — Stage 15: Tender lost or withdrawn. Close and capture lessons.
 *
 * 4 Tabs (each with Qualification-pattern section tabs):
 *  1. Loss Reason           — sections: Loss Details, Activity Log
 *  2. Lessons Learned       — sections: Lessons Register, Audit Trail
 *  3. Competitor Intelligence — sections: Competitor Register, Activity Log
 *  4. Rebid Potential       — sections: Rebid Assessment
 *
 * Each tab wraps its original content in the standard StageMenuHeader.
 * DATA SOURCE: ONLY Supabase. No AI. No mock data.
 */
import { useState, type ReactNode } from "react";
import {
  XCircle, BookOpen, Eye, TrendingUp,
  Activity, Clock,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";

import LossReasonTab from "./LossReasonTab";
import LessonsLearnedTab from "./LessonsLearnedTab";
import CompetitorIntelTab from "./CompetitorIntelTab";
import RebidPotentialTab from "./RebidPotentialTab";
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

// ─── Stage Menu Header (reusable — exact copy from SubmittedStage) ────────────────────────

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
      stageTitle="Lost / Withdrawn Stage Menu"
      stageBadge="Stage 15"
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

// ═══════════════════════════════════════════════════════════
// TAB 1: LOSS REASON
// Section 1 — Loss Details  → LossReasonTab (lost_withdrawn_data.loss_reason)
// Section 2 — Activity Log  → TenderActivityTab (activity log)
// ═══════════════════════════════════════════════════════════

type LossSection = "loss_details" | "loss_activity";
const LOSS_SECTIONS: { key: LossSection; label: string; icon: ReactNode }[] = [
  { key: "loss_details",  label: "Loss Details",  icon: <XCircle className="w-3.5 h-3.5" /> },
  { key: "loss_activity", label: "Activity Log",  icon: <Activity className="w-3.5 h-3.5" /> },
];

function LossReasonView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; hasStoredData?: boolean }) {
  const [activeSection, setActiveSection] = useState<LossSection>("loss_details");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={LOSS_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
        saved={!!hasStoredData && !tabDirty} unsaved={tabDirty} />
      <div className={activeSection !== "loss_details" ? "hidden" : ""}>
        <LossReasonTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
      <div className={activeSection !== "loss_activity" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: LESSONS LEARNED
// Section 1 — Lessons Register → LessonsLearnedTab (lost_withdrawn_data.lessons_learned)
// Section 2 — Audit Trail      → TenderAuditTrailTab (ws.auditEntries)
// ═══════════════════════════════════════════════════════════

type LessonsSection = "lessons_register" | "lessons_audit";
const LESSONS_SECTIONS: { key: LessonsSection; label: string; icon: ReactNode }[] = [
  { key: "lessons_register", label: "Lessons Register", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: "lessons_audit",    label: "Audit Trail",      icon: <Clock className="w-3.5 h-3.5" /> },
];

function LessonsLearnedView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; hasStoredData?: boolean }) {
  const [activeSection, setActiveSection] = useState<LessonsSection>("lessons_register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={LESSONS_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
        saved={!!hasStoredData && !tabDirty} unsaved={tabDirty} />
      <div className={activeSection !== "lessons_register" ? "hidden" : ""}>
        <LessonsLearnedTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
      <div className={activeSection !== "lessons_audit" ? "hidden" : ""}>
        <TenderAuditTrailTab ws={ws} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: COMPETITOR INTELLIGENCE
// Section 1 — Competitor Register → CompetitorIntelTab (lost_withdrawn_data.competitor_intel)
// Section 2 — Activity Log        → TenderActivityTab (activity log)
// ═══════════════════════════════════════════════════════════

type CompetitorSection = "competitor_register" | "competitor_activity";
const COMPETITOR_SECTIONS: { key: CompetitorSection; label: string; icon: ReactNode }[] = [
  { key: "competitor_register", label: "Competitor Register", icon: <Eye className="w-3.5 h-3.5" /> },
  { key: "competitor_activity", label: "Activity Log",        icon: <Activity className="w-3.5 h-3.5" /> },
];

function CompetitorIntelView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; hasStoredData?: boolean }) {
  const [activeSection, setActiveSection] = useState<CompetitorSection>("competitor_register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={COMPETITOR_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
        saved={!!hasStoredData && !tabDirty} unsaved={tabDirty} />
      <div className={activeSection !== "competitor_register" ? "hidden" : ""}>
        <CompetitorIntelTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
      <div className={activeSection !== "competitor_activity" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: REBID POTENTIAL
// Section 1 — Rebid Assessment → RebidPotentialTab (lost_withdrawn_data.rebid_potential)
// ═══════════════════════════════════════════════════════════

type RebidSection = "rebid_assessment";
const REBID_SECTIONS: { key: RebidSection; label: string; icon: ReactNode }[] = [
  { key: "rebid_assessment", label: "Rebid Assessment", icon: <TrendingUp className="w-3.5 h-3.5" /> },
];

function RebidPotentialView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; hasStoredData?: boolean }) {
  const [activeSection, setActiveSection] = useState<RebidSection>("rebid_assessment");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={REBID_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel}
        saved={!!hasStoredData && !tabDirty} unsaved={tabDirty} />
      <div className={activeSection !== "rebid_assessment" ? "hidden" : ""}>
        <RebidPotentialTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function LostWithdrawnStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const lw = td?.lost_withdrawn_data ?? {};

  const lossReason = lw.loss_reason ?? {};
  const lessons = lw.lessons_learned ?? {};
  const compIntel = lw.competitor_intel ?? {};
  const rebid = lw.rebid_potential ?? {};

  const lessonCount = Array.isArray(lessons.lessons) ? lessons.lessons.length : 0;
  const compCount = Array.isArray(compIntel.competitors) ? compIntel.competitors.length : 0;

  const intelMetrics = [
    { label: "Outcome",     value: lossReason.outcome_type ? lossReason.outcome_type.replace(/_/g, " ") : "Not captured" },
    { label: "Lessons",     value: lessonCount > 0 ? `${lessonCount} captured` : "None captured" },
    { label: "Competitors", value: compCount > 0 ? `${compCount} logged` : "None logged" },
    { label: "Rebid",       value: rebid.likelihood === "high" ? "Likely" : rebid.likelihood === "medium" ? "Possible" : rebid.likelihood === "low" ? "Unlikely" : "Not assessed" },
  ];

  // Compute saved state per tab from actual Supabase data
  const hasLoss = !!(lossReason.outcome_type || lossReason.primary_reason);
  const hasLessons = lessonCount > 0 || !!(lessons.what_went_well || lessons.what_went_wrong);
  const hasCompIntel = compCount > 0 || !!(compIntel.market_notes);
  const hasRebid = !!(rebid.likelihood && rebid.likelihood !== "none");

  if (activeTab === "loss_reason")
    return <LossReasonView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasLoss} />;
  if (activeTab === "lessons_learned")
    return <LessonsLearnedView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasLessons} />;
  if (activeTab === "competitor_intelligence")
    return <CompetitorIntelView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasCompIntel} />;
  if (activeTab === "rebid_potential")
    return <RebidPotentialView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasRebid} />;

  // Default fallback
  return <LossReasonView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasLoss} />;
}
