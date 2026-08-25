import { useState, type ReactNode } from "react";
import { Clock, Layers, Radio, Send } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";

import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
import SubmissionLogTab from "./SubmissionLogTab";
import SubmittedVersionTab from "./SubmittedVersionTab";
import CrmSyncTab from "./CrmSyncTab";
import TenderAuditTrailTab from "./TenderAuditTrailTab";

interface StageProps {
  ws: TenderWorkspace;
  activeTab: string;
  reload: () => void;
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
}

interface StageViewProps {
  ws: TenderWorkspace;
  reload: () => void;
  intelMetrics: TenderStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  /** Data-presence flag from the stage shell (used only when the tab is clean). */
  hasStoredData?: boolean;
}

function SubmittedStageShell<T extends string>({
  activeSection,
  onSectionChange,
  sections,
  stageIntelOpen,
  onStageIntelOpenChange,
  intelMetrics,
  onOpenDocuments,
  onOpenGlobalIntel,
  saved,
  unsaved,
  children,
}: {
  activeSection: T;
  onSectionChange: (section: T) => void;
  sections: TenderStageSectionTab<T>[];
  stageIntelOpen: boolean;
  onStageIntelOpenChange: (open: boolean) => void;
  intelMetrics: TenderStageMetric[];
  onOpenDocuments?: () => void;
  onOpenGlobalIntel?: () => void;
  saved?: boolean;
  unsaved?: boolean;
  children: ReactNode;
}) {
  return (
    <TenderStageTaskShell
      stageTitle="Submitted Stage Menu"
      stageBadge="Stage 10"
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionTabs={sections}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={onStageIntelOpenChange}
      metrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
      unsaved={unsaved}
    >
      {children}
    </TenderStageTaskShell>
  );
}

/* TCW-T4 (F8): each view previously offered TWO section-menu entries that
   rendered the SAME child component twice ("Submission Record"/"Receipt
   Confirmation", "Version Snapshot"/"Block Snapshot", "Pipeline
   Transition"/"Sync Details") — implied views that did not exist. Each view now
   declares the single section its child actually renders. */

type LogSection = "record";
const LOG_SECTIONS: TenderStageSectionTab<LogSection>[] = [
  { key: "record", label: "Submission Record & Receipt", icon: <Send className="w-3.5 h-3.5" /> },
];

function SubmissionLogView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<LogSection>("record");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists AND
  // the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <SubmittedStageShell
      sections={LOG_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={!!hasStoredData && !tabDirty}
      unsaved={tabDirty}
    >
      <SubmissionLogTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
    </SubmittedStageShell>
  );
}

type VersionSection = "snapshot";
const VERSION_SECTIONS: TenderStageSectionTab<VersionSection>[] = [
  { key: "snapshot", label: "Version Record & Blocks", icon: <Layers className="w-3.5 h-3.5" /> },
];

function SubmittedVersionView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<VersionSection>("snapshot");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <SubmittedStageShell
      sections={VERSION_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={!!hasStoredData && !tabDirty}
      unsaved={tabDirty}
    >
      <SubmittedVersionTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
    </SubmittedStageShell>
  );
}

type SyncSection = "sync";
const SYNC_SECTIONS: TenderStageSectionTab<SyncSection>[] = [
  { key: "sync", label: "CRM Sync Record", icon: <Radio className="w-3.5 h-3.5" /> },
];

function CrmSyncView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<SyncSection>("sync");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <SubmittedStageShell
      sections={SYNC_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={!!hasStoredData && !tabDirty}
      unsaved={tabDirty}
    >
      <CrmSyncTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
    </SubmittedStageShell>
  );
}

type AuditSection = "events";
const AUDIT_SECTIONS: TenderStageSectionTab<AuditSection>[] = [
  { key: "events", label: "Event Log", icon: <Clock className="w-3.5 h-3.5" /> },
];

function AuditTrailView({ ws, intelMetrics, onOpenDocuments, onOpenGlobalIntel }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<AuditSection>("events");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

  return (
    <SubmittedStageShell
      sections={AUDIT_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      /* TCW-T4 (C3): read-only audit projection — nothing here can hold
         unsaved edits, so "Saved" states the in-sync fact. */
      saved={true}
    >
      <div>
        <TenderAuditTrailTab ws={ws} />
      </div>
    </SubmittedStageShell>
  );
}

export default function SubmittedStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const sub = td?.submission ?? {};

  const hasSubmission = !!(sub.submission_record?.submitted_at || sub.submission_record?.submitted_by);
  const hasReceipt = sub.submission_record?.receipt_confirmed === true;
  const hasVersion = !!(sub.submitted_version?.version_label || sub.submitted_version?.frozen_at);
  const hasCrmSync = !!(sub.crm_sync?.crm_stage_after || sub.crm_sync?.synced_at);
  const syncStatus = sub.crm_sync?.sync_status || "pending";
  const syncStatusLabel = syncStatus === "synced"
    ? "Synced"
    : syncStatus === "failed"
      ? "Failed"
      : syncStatus === "manual"
        ? "Manual Update"
        : "Pending";
  // TCW-T4 (F5): activityEvents and auditEntries are two projections of the
  // SAME commercial_ticket_audit rows — count ONE of them.
  const auditCount = Array.isArray(ws.auditEntries) ? ws.auditEntries.length : 0;

  const intelMetrics = [
    { label: "Submission", value: hasSubmission ? "Recorded" : "Not recorded" },
    { label: "Receipt", value: hasReceipt ? "Confirmed" : "Pending" },
    { label: "Version", value: hasVersion ? (sub.submitted_version?.version_label || "Recorded") : "Not recorded" },
    { label: "CRM Record", value: hasCrmSync ? syncStatusLabel : "Not recorded" },
    { label: "Audit Rows", value: String(auditCount) },
  ];

  if (activeTab === "submission_log")
    return <SubmissionLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasSubmission || hasReceipt} />;
  if (activeTab === "submitted_version")
    return <SubmittedVersionView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasVersion} />;
  if (activeTab === "crm_sync")
    return <CrmSyncView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasCrmSync} />;
  if (activeTab === "audit_trail")
    return <AuditTrailView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} />;

  return <SubmissionLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasSubmission || hasReceipt} />;
}
