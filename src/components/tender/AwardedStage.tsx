/**
 * AwardedStage — Stage 14: Tender awarded. Contract to be signed.
 *
 * 4 Tabs (each with Qualification-pattern section tabs):
 *  1. Award Notice    — sections: Award Details, Activity Log
 *  2. Contract Prep   — sections: Contract Status, Audit Trail
 *  3. SLA Prep        — sections: SLA Summary, Activity Log
 *  4. Handover Prep   — sections: Handover Checklist
 *
 * Each tab wraps its original content in the standard StageMenuHeader.
 * DATA SOURCE: ONLY Supabase. No AI. No mock data.
 */
import { useState, type ReactNode } from "react";
import {
  Trophy, FileText, Shield, Users,
  Activity, Clock,
} from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";
import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";

import AwardNoticeTab from "./AwardNoticeTab";
import AwardContractPrepTab from "./AwardContractPrepTab";
import AwardSlaPrepTab from "./AwardSlaPrepTab";
import AwardHandoverTab from "./AwardHandoverTab";
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
      stageTitle="Awarded Stage Menu"
      stageBadge="Stage 14"
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
// TAB 1: AWARD NOTICE
// Section 1 — Award Details → AwardNoticeTab (awarded_data.award_notice)
// Section 2 — Activity Log  → TenderActivityTab (activity log)
// ═══════════════════════════════════════════════════════════

type NoticeSection = "award_details" | "award_activity";
const NOTICE_SECTIONS: { key: NoticeSection; label: string; icon: ReactNode }[] = [
  { key: "award_details",  label: "Award Details",  icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: "award_activity", label: "Activity Log",   icon: <Activity className="w-3.5 h-3.5" /> },
];

function AwardNoticeView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<NoticeSection>("award_details");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={NOTICE_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "award_details" ? "hidden" : ""}>
        <AwardNoticeTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "award_activity" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 2: CONTRACT PREP
// Section 1 — Contract Status → AwardContractPrepTab (awarded_data.contract_prep)
// Section 2 — Audit Trail     → TenderAuditTrailTab  (ws.auditEntries)
// ═══════════════════════════════════════════════════════════

type ContractSection = "contract_status" | "contract_audit";
const CONTRACT_SECTIONS: { key: ContractSection; label: string; icon: ReactNode }[] = [
  { key: "contract_status", label: "Contract Status",  icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "contract_audit",  label: "Audit Trail",      icon: <Clock className="w-3.5 h-3.5" /> },
];

function ContractPrepView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<ContractSection>("contract_status");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={CONTRACT_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "contract_status" ? "hidden" : ""}>
        <AwardContractPrepTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "contract_audit" ? "hidden" : ""}>
        <TenderAuditTrailTab ws={ws} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 3: SLA PREP
// Section 1 — SLA Summary   → AwardSlaPrepTab  (awarded_data.sla_prep)
// Section 2 — Activity Log  → TenderActivityTab (activity log)
// ═══════════════════════════════════════════════════════════

type SlaSection = "sla_summary" | "sla_activity";
const SLA_SECTIONS: { key: SlaSection; label: string; icon: ReactNode }[] = [
  { key: "sla_summary",  label: "SLA Summary",   icon: <Shield className="w-3.5 h-3.5" /> },
  { key: "sla_activity", label: "Activity Log",   icon: <Activity className="w-3.5 h-3.5" /> },
];

function SlaPrepView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<SlaSection>("sla_summary");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={SLA_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "sla_summary" ? "hidden" : ""}>
        <AwardSlaPrepTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "sla_activity" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB 4: HANDOVER PREP
// Section 1 — Handover Checklist → AwardHandoverTab (awarded_data.handover)
// ═══════════════════════════════════════════════════════════

type HandoverSection = "handover_checklist";
const HANDOVER_SECTIONS: { key: HandoverSection; label: string; icon: ReactNode }[] = [
  { key: "handover_checklist", label: "Handover Checklist", icon: <Users className="w-3.5 h-3.5" /> },
];

function HandoverPrepView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: { ws: TenderWorkspace; reload: () => void; intelMetrics: { label: string; value: string }[]; onOpenDocuments?: () => void; onOpenGlobalIntel?: () => void; saved?: boolean }) {
  const [activeSection, setActiveSection] = useState<HandoverSection>("handover_checklist");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <div className="space-y-4">
      <StageMenuHeader sections={HANDOVER_SECTIONS} activeSection={activeSection} setActiveSection={setActiveSection}
        stageIntelOpen={stageIntelOpen} setStageIntelOpen={setStageIntelOpen} intelMetrics={intelMetrics}
        onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={saved} />
      <div className={activeSection !== "handover_checklist" ? "hidden" : ""}>
        <AwardHandoverTab ws={ws} reload={reload} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function AwardedStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const aw = td?.awarded_data ?? {};

  const notice = aw.award_notice ?? {};
  const contract = aw.contract_prep ?? {};
  const sla = aw.sla_prep ?? {};
  const handover = aw.handover ?? {};

  const intelMetrics = [
    { label: "Award Status",   value: notice.award_date ? `Awarded ${notice.award_date}` : "Not recorded" },
    { label: "Contract",       value: contract.contract_status ? contract.contract_status.replace(/_/g, " ") : "Not started" },
    { label: "SLA",            value: sla.sla_status ? sla.sla_status.replace(/_/g, " ") : "Not started" },
    { label: "Handover",       value: handover.handover_status ? handover.handover_status.replace(/_/g, " ") : "Not started" },
  ];

  // Compute saved state per tab from actual Supabase data
  const hasNotice = !!(notice.award_date || notice.award_reference);
  const hasContract = !!(contract.contract_status && contract.contract_status !== "not_started");
  const hasSla = !!(sla.sla_status && sla.sla_status !== "not_started") || !!(sla.notes);
  const hasHandover = !!(handover.handover_status && handover.handover_status !== "not_started") || (Array.isArray(handover.checklist) && handover.checklist.length > 0);

  if (activeTab === "award_notice")
    return <AwardNoticeView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasNotice} />;
  if (activeTab === "contract_prep")
    return <ContractPrepView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasContract} />;
  if (activeTab === "sla_prep")
    return <SlaPrepView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasSla} />;
  if (activeTab === "handover_prep")
    return <HandoverPrepView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasHandover} />;

  // Default fallback
  return <AwardNoticeView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasNotice} />;
}
