import { useState, type ReactNode } from "react";
import { CheckCircle2, Clock, FileText, Layers, Lock, Radio, Send } from "lucide-react";
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
  saved?: boolean;
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
    >
      {children}
    </TenderStageTaskShell>
  );
}

type LogSection = "record" | "receipt";
const LOG_SECTIONS: TenderStageSectionTab<LogSection>[] = [
  { key: "record", label: "Submission Record", icon: <Send className="w-3.5 h-3.5" /> },
  { key: "receipt", label: "Receipt Confirmation", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function SubmissionLogView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<LogSection>("record");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

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
      saved={saved}
    >
      <div className={activeSection !== "record" ? "hidden" : ""}>
        <SubmissionLogTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "receipt" ? "hidden" : ""}>
        <SubmissionLogTab ws={ws} reload={reload} />
      </div>
    </SubmittedStageShell>
  );
}

type VersionSection = "snapshot" | "blocks";
const VERSION_SECTIONS: TenderStageSectionTab<VersionSection>[] = [
  { key: "snapshot", label: "Version Snapshot", icon: <Lock className="w-3.5 h-3.5" /> },
  { key: "blocks", label: "Block Snapshot", icon: <Layers className="w-3.5 h-3.5" /> },
];

function SubmittedVersionView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<VersionSection>("snapshot");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

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
      saved={saved}
    >
      <div className={activeSection !== "snapshot" ? "hidden" : ""}>
        <SubmittedVersionTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "blocks" ? "hidden" : ""}>
        <SubmittedVersionTab ws={ws} reload={reload} />
      </div>
    </SubmittedStageShell>
  );
}

type SyncSection = "pipeline" | "details";
const SYNC_SECTIONS: TenderStageSectionTab<SyncSection>[] = [
  { key: "pipeline", label: "Pipeline Transition", icon: <Radio className="w-3.5 h-3.5" /> },
  { key: "details", label: "Sync Details", icon: <FileText className="w-3.5 h-3.5" /> },
];

function CrmSyncView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<SyncSection>("pipeline");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);

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
      saved={saved}
    >
      <div className={activeSection !== "pipeline" ? "hidden" : ""}>
        <CrmSyncTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "details" ? "hidden" : ""}>
        <CrmSyncTab ws={ws} reload={reload} />
      </div>
    </SubmittedStageShell>
  );
}

type AuditSection = "events";
const AUDIT_SECTIONS: TenderStageSectionTab<AuditSection>[] = [
  { key: "events", label: "Event Log", icon: <Clock className="w-3.5 h-3.5" /> },
];

function AuditTrailView({ ws, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
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
      saved={saved}
    >
      <div className={activeSection !== "events" ? "hidden" : ""}>
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
  const auditCount = Array.isArray(ws.activityEvents) ? ws.activityEvents.length : 0;

  const intelMetrics = [
    { label: "Submission", value: hasSubmission ? "Recorded" : "Not recorded" },
    { label: "Receipt", value: hasReceipt ? "Confirmed" : "Pending" },
    { label: "Version", value: hasVersion ? (sub.submitted_version?.version_label || "Recorded") : "Not recorded" },
    { label: "CRM Sync", value: hasCrmSync ? (syncStatus === "synced" ? "Synced" : syncStatus === "failed" ? "Failed" : "Pending") : "Not recorded" },
  ];

  if (activeTab === "submission_log")
    return <SubmissionLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasSubmission || hasReceipt} />;
  if (activeTab === "submitted_version")
    return <SubmittedVersionView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasVersion} />;
  if (activeTab === "crm_sync")
    return <CrmSyncView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasCrmSync} />;
  if (activeTab === "audit_trail")
    return <AuditTrailView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={auditCount > 0} />;

  return <SubmissionLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasSubmission || hasReceipt} />;
}
