/**
 * ClientEvaluationStage - merged client technical and commercial evaluation.
 *
 * Replaces the old separate "Technical Review" and "Commercial Review" stages.
 * All data writes stay under type_details.client_evaluation.*.
 * No AI. No mock data.
 */
import { useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, DollarSign, FileText, MessageSquare } from "lucide-react";
import { type TenderWorkspace } from "@/lib/tender-workspace-data";

import {
  TenderStageTaskShell,
  type TenderStageMetric,
  type TenderStageSectionTab,
} from "./TenderStageTaskShell";
import ClientRequestLogTab from "./ClientRequestLogTab";
import ClientClarificationsTab, { type ClientClarificationSection } from "./ClientClarificationsTab";
import ClientBafoManagerTab from "./ClientBafoManagerTab";
import ClientMarginImpactTab from "./ClientMarginImpactTab";
import ClientEvaluationStatusTab from "./ClientEvaluationStatusTab";
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
  saved?: boolean;
}

function ClientEvaluationShell<T extends string>({
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
      stageTitle="Client Evaluation Stage Menu"
      stageBadge="Stage 12"
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

type RequestSection = "request_register" | "activity_log";
const REQUEST_SECTIONS: TenderStageSectionTab<RequestSection>[] = [
  { key: "request_register", label: "Request Register", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "activity_log", label: "Activity Log", icon: <Activity className="w-3.5 h-3.5" /> },
];

function RequestLogView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<RequestSection>("request_register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <ClientEvaluationShell
      sections={REQUEST_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
    >
      <div className={activeSection !== "request_register" ? "hidden" : ""}>
        <ClientRequestLogTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "activity_log" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </ClientEvaluationShell>
  );
}

type ClientClarificationsSection = ClientClarificationSection;
const CLIENT_CLARIFICATION_SECTIONS: TenderStageSectionTab<ClientClarificationsSection>[] = [
  { key: "clarification_register", label: "Clarification Register", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: "response_tracking", label: "Response Tracking", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { key: "impact_review", label: "Impact Review", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: "notes_documents", label: "Notes / Documents", icon: <FileText className="w-3.5 h-3.5" /> },
];

function ClientClarificationsView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<ClientClarificationsSection>("clarification_register");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <ClientEvaluationShell
      sections={CLIENT_CLARIFICATION_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
    >
      <ClientClarificationsTab ws={ws} reload={reload} activeSection={activeSection} />
    </ClientEvaluationShell>
  );
}

type BafoSection = "bafo_details" | "bafo_audit";
const BAFO_SECTIONS: TenderStageSectionTab<BafoSection>[] = [
  { key: "bafo_details", label: "BAFO Details", icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: "bafo_audit", label: "BAFO Audit Trail", icon: <Clock className="w-3.5 h-3.5" /> },
];

function BafoManagerView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<BafoSection>("bafo_details");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <ClientEvaluationShell
      sections={BAFO_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
    >
      <div className={activeSection !== "bafo_details" ? "hidden" : ""}>
        <ClientBafoManagerTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "bafo_audit" ? "hidden" : ""}>
        <TenderAuditTrailTab ws={ws} />
      </div>
    </ClientEvaluationShell>
  );
}

type MarginSection = "pricing_impact" | "margin_activity";
const MARGIN_SECTIONS: TenderStageSectionTab<MarginSection>[] = [
  { key: "pricing_impact", label: "Pricing Impact", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { key: "margin_activity", label: "Activity Log", icon: <Activity className="w-3.5 h-3.5" /> },
];

function MarginImpactView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<MarginSection>("pricing_impact");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <ClientEvaluationShell
      sections={MARGIN_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
    >
      <div className={activeSection !== "pricing_impact" ? "hidden" : ""}>
        <ClientMarginImpactTab ws={ws} reload={reload} />
      </div>
      <div className={activeSection !== "margin_activity" ? "hidden" : ""}>
        <TenderActivityTab ws={ws} tenderId={ws.tender.id} reload={reload} />
      </div>
    </ClientEvaluationShell>
  );
}

type StatusSection = "status_tracker";
const STATUS_SECTIONS: TenderStageSectionTab<StatusSection>[] = [
  { key: "status_tracker", label: "Status Tracker", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function EvaluationStatusView({ ws, reload, intelMetrics, onOpenDocuments, onOpenGlobalIntel, saved }: StageViewProps) {
  const [activeSection, setActiveSection] = useState<StatusSection>("status_tracker");
  const [stageIntelOpen, setStageIntelOpen] = useState(false);
  return (
    <ClientEvaluationShell
      sections={STATUS_SECTIONS}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      stageIntelOpen={stageIntelOpen}
      onStageIntelOpenChange={setStageIntelOpen}
      intelMetrics={intelMetrics}
      onOpenDocuments={onOpenDocuments}
      onOpenGlobalIntel={onOpenGlobalIntel}
      saved={saved}
    >
      <div className={activeSection !== "status_tracker" ? "hidden" : ""}>
        <ClientEvaluationStatusTab ws={ws} reload={reload} />
      </div>
    </ClientEvaluationShell>
  );
}

export default function ClientEvaluationStage({ ws, activeTab, reload, onOpenDocuments, onOpenGlobalIntel }: StageProps) {
  const t = ws.tender as any;
  const td = t.typeDetails || t.type_details || {};
  const ce = td?.client_evaluation ?? {};

  const requestLog: any[] = Array.isArray(ce.request_log) ? ce.request_log : [];
  const openRequests = requestLog.filter((r: any) => r.status === "pending" || r.status === "in_progress" || r.status === "overdue").length;
  const clientClarificationsData = ce.client_clarifications ?? {};
  const clientClarifications: any[] = Array.isArray(clientClarificationsData)
    ? clientClarificationsData
    : Array.isArray(clientClarificationsData?.rows) ? clientClarificationsData.rows : [];
  const openClientClarifications = clientClarifications.filter((r: any) => {
    const status = String(r.response_status || r.status || "Open").toLowerCase().replace(/_/g, " ");
    return status === "open" || status === "in progress" || status === "pending";
  }).length;
  const respondedClientClarifications = clientClarifications.filter((r: any) => {
    const status = String(r.response_status || r.status || "").toLowerCase().replace(/_/g, " ");
    return status === "responded" || status === "closed";
  }).length;
  const bafo = ce.bafo ?? {};
  const marginImpact = ce.margin_impact ?? {};
  const evalStatus = ce.evaluation_status ?? {};

  const intelMetrics = [
    { label: "Open Requests", value: openRequests > 0 ? `${openRequests} pending` : requestLog.length > 0 ? "All responded" : "None logged" },
    { label: "Clarifications", value: clientClarifications.length > 0 ? `${openClientClarifications} open / ${respondedClientClarifications} closed` : "None logged" },
    { label: "BAFO Status", value: bafo.bafo_status ? bafo.bafo_status.replace(/_/g, " ") : "Not requested" },
    { label: "Evaluation", value: evalStatus.overall_status || "Not assessed" },
  ];

  const hasRequestLog = requestLog.length > 0;
  const hasClientClarifications = clientClarifications.length > 0 ||
    !!(!Array.isArray(clientClarificationsData) && clientClarificationsData?.notes);
  const hasBafo = !!(bafo.bafo_status && bafo.bafo_status !== "not_requested");
  const hasMarginImpact = !!(marginImpact.current_gp || marginImpact.current_value);
  const hasEvalStatus = !!(evalStatus.technical_status && evalStatus.technical_status !== "unknown") ||
                        !!(evalStatus.commercial_status && evalStatus.commercial_status !== "unknown");

  if (activeTab === "request_log")
    return <RequestLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasRequestLog} />;
  if (activeTab === "client_clarifications")
    return <ClientClarificationsView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasClientClarifications} />;
  if (activeTab === "bafo_manager")
    return <BafoManagerView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasBafo} />;
  if (activeTab === "margin_impact")
    return <MarginImpactView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasMarginImpact} />;
  if (activeTab === "evaluation_status")
    return <EvaluationStatusView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasEvalStatus} />;

  return <RequestLogView ws={ws} reload={reload} intelMetrics={intelMetrics} onOpenDocuments={onOpenDocuments} onOpenGlobalIntel={onOpenGlobalIntel} saved={hasRequestLog} />;
}
