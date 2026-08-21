import { useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, MessageSquare } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";

import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
import ClarificationQALogTab from "./ClarificationQALogTab";
import ClarificationResponseTab from "./ClarificationResponseTab";
import ClarificationMarginImpactTab from "./ClarificationMarginImpactTab";
import ClarificationStatusTab from "./ClarificationStatusTab";
import TenderActivityTab from "./TenderActivityTab";
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
  /** Data-presence flag from the stage dispatcher (used only when the tab is clean). */
  hasStoredData?: boolean;
}

function ClarificationStageShell<T extends string>({
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
      stageTitle="Clarification Stage Menu"
      stageBadge="Stage 11"
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

type QASection = "qa_register" | "response_tracking";
const QA_SECTIONS: TenderStageSectionTab<QASection>[] = [
  { key: "qa_register", label: "Q&A Register", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "response_tracking", label: "Response Tracking", icon: <Activity className="w-3.5 h-3.5" /> },
];

function QALogView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<QASection>("qa_register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <ClarificationStageShell
      sections={QA_SECTIONS}
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
      <div className={activeSection !== "qa_register" ? "hidden" : ""}>
        <ClarificationQALogTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
      <div className={activeSection !== "response_tracking" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </ClarificationStageShell>
  );
}

type DraftSection = "formal_response" | "draft_audit";
const DRAFT_SECTIONS: TenderStageSectionTab<DraftSection>[] = [
  { key: "formal_response", label: "Formal Response", icon: <FileText className="w-3.5 h-3.5" /> },
  { key: "draft_audit", label: "Response Audit Trail", icon: <Clock className="w-3.5 h-3.5" /> },
];

function ResponseDraftsView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<DraftSection>("formal_response");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <ClarificationStageShell
      sections={DRAFT_SECTIONS}
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
      <div className={activeSection !== "formal_response" ? "hidden" : ""}>
        <ClarificationResponseTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
      <div className={activeSection !== "draft_audit" ? "hidden" : ""}>
        <TenderAuditTrailTab ws={ws} />
      </div>
    </ClarificationStageShell>
  );
}

type ImpactSection = "margin_impact" | "scope_change";
const IMPACT_SECTIONS: TenderStageSectionTab<ImpactSection>[] = [
  { key: "margin_impact", label: "Margin Impact", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: "scope_change", label: "Scope Change", icon: <Activity className="w-3.5 h-3.5" /> },
];

function ImpactAnalysisView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<ImpactSection>("margin_impact");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <ClarificationStageShell
      sections={IMPACT_SECTIONS}
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
      <div className={activeSection !== "margin_impact" ? "hidden" : ""}>
        <ClarificationMarginImpactTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
      <div className={activeSection !== "scope_change" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </ClarificationStageShell>
  );
}

type StatusSection = "overall_status";
const STATUS_SECTIONS: TenderStageSectionTab<StatusSection>[] = [
  { key: "overall_status", label: "Overall Status", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function ClarificationStatusView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, hasStoredData }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<StatusSection>("overall_status");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  // TCW-T4 (C3): the badge reflects SAVE state, not data presence — amber
  // while the tab holds unsaved edits, green only when stored data exists
  // AND the tab is clean, grey when nothing is recorded yet.
  const [tabDirty, setTabDirty] = useState(false);

  return (
    <ClarificationStageShell
      sections={STATUS_SECTIONS}
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
      <div className={activeSection !== "overall_status" ? "hidden" : ""}>
        <ClarificationStatusTab ws={ws} reload={reload} onDirtyChange={setTabDirty} />
      </div>
    </ClarificationStageShell>
  );
}

export default function ClarificationStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const cl = td?.clarification ?? {};

  const qaLog: any[] = Array.isArray(cl.qa_log) ? cl.qa_log : [];
  const openQa = qaLog.filter((q: any) => q.status === "pending" || q.status === "in_progress").length;
  const respondedQa = qaLog.filter((q: any) => q.status === "responded").length;
  const response = cl.response ?? {};
  const marginImpact = cl.margin_impact ?? {};
  const status = cl.status ?? {};

  const responseStatus = String(response.response_status || "not_started").toLowerCase();
  const responseLabel = responseStatus.replace(/_/g, " ");

  const intelMetrics = [
    { label: "Open Questions", value: openQa > 0 ? `${openQa} pending` : qaLog.length > 0 ? "All answered" : "None logged" },
    { label: "Responded", value: respondedQa > 0 ? `${respondedQa} of ${qaLog.length}` : "Not captured yet" },
    { label: "Response", value: responseStatus === "not_started" ? "Not started" : responseLabel },
    { label: "Margin Impact", value: marginImpact.current_gp ? `${marginImpact.current_gp}% GP` : "Not assessed" },
  ];

  const hasQaLog = qaLog.length > 0;
  const hasResponse = !!(
    (responseStatus && responseStatus !== "not_started") ||
    response.received_date ||
    response.due_date ||
    response.scope_changes ||
    response.submitted_date ||
    response.response_notes ||
    response.pricing_notes
  );
  const hasMargin = !!(marginImpact.current_gp || marginImpact.current_value);
  const statusValue = String(status.round_status || "").toLowerCase();
  const hasStatus = !!(statusValue && statusValue !== "unknown" && statusValue !== "pending");

  if (activeTab === "q&a_log")
    return <QALogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasQaLog} />;
  if (activeTab === "response_drafts")
    return <ResponseDraftsView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasResponse} />;
  if (activeTab === "impact_analysis")
    return <ImpactAnalysisView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasMargin} />;
  if (activeTab === "clarification_status")
    return <ClarificationStatusView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasStatus} />;

  return <QALogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} hasStoredData={hasQaLog} />;
}
